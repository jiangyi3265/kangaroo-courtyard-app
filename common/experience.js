import { reactive, computed } from 'vue'
import R from './routes.js'
import {
  apiAccount, apiLogout, apiMarkAllRead, apiMarkRead, apiDeleteMessage, apiMessages, apiUnreadCount, apiWxLogin
} from './api.js'
import { clearToken, getToken, setMessageScopeProvider, setForbiddenHandler, setToken, setUnauthorizedHandler, wxLoginCode } from './request.js'
import { bindPendingInviter } from './invite.js'
import { grantKey, groupStaffIdentities, findStaffIdentity } from './staff-identities.js'
export { staffIdentityLabel } from './staff-identities.js'

// 账号与员工授权只能来自服务端。绝不从 UI 选择、手机号、query 串或本地存储推断权限。
//
// unread 是服务端未读数的缓存。tabbar 红点在每个页面都要显示，但只有消息中心和个人中心
// 会拉 messages；其余页面（首页、岗位列表、提醒中心…）没有本地消息可数，只能靠这个缓存。
// messagesMore：服务端分页时还有没有下一页（true / false）；null 表示这份列表没分页（老接口，或没带 bucket）
// allCities：首页城市选了「全部城市」（只有首页 / 城市页 / 首页情境助手读它，兴趣城市列表 cities 不动）
export const experience = reactive({ account: null, mode: 'user', cities: [], allCities: false, messages: [], messagesMore: null, unread: 0, unreadAuthoritative: false, staffStoreId: null })
const messageScopeRevision = reactive({ value: 0 })
let messageListRequest = 0
let messageUnreadRequest = 0
function invalidateMessageScope() {
  messageScopeRevision.value++
  experience.messages = []
  experience.messagesMore = null
  experience.unread = 0
  experience.unreadAuthoritative = false
}
function captureMessageScope() {
  return { revision: messageScopeRevision.value, id: experience.account?.id, mode: experience.mode, token: getToken() }
}
function isCurrentMessageScope(scope) {
  return !!experience.account && scope.revision === messageScopeRevision.value && scope.id === experience.account.id
    && scope.mode === experience.mode && scope.token === getToken()
}
let sessionRevision = 0
let accountRevision = 0
let loginAttempt = 0
export const getSessionRevision = () => sessionRevision
const cancelledSession = () => new Error('登录状态已变化，请重新授权')
const key = (name) => `kangaroo:${experience.account?.id || 'guest'}:${name}`
const read = (name, fallback) => {
  try { return uni.getStorageSync(key(name)) || fallback } catch { return fallback }
}
export function loadPreferences() {
  const saved = read('cities', [])
  experience.cities = Array.isArray(saved) ? saved.filter(c => typeof c === 'string') : []
  experience.allCities = read('all-cities', false) === true
}
export function savePreferences(cities) {
  uni.setStorageSync(key('cities'), [...cities])
  experience.cities = [...cities]
}
// 首页换回「全部城市」只记这个开关：之前是把兴趣城市清空，社区、订房、选兴趣城市页用的那份列表跟着没了。
// 在切换城市里再选某个城市时关掉（那个城市照旧排到兴趣城市第一个）
export function saveAllCities(on) {
  try { uni.setStorageSync(key('all-cities'), !!on) } catch (e) { /* 存不下只影响下次打开时首页显示的城市 */ }
  experience.allCities = !!on
}
export const hasStaffAccess = computed(() => !!experience.account?.staffGrants?.some(g => g.active === true))
// 员工端"当前门店"：只是在已授权门店里挑一家作为默认数据范围，权限仍由服务端逐请求按授权校验。
// 记在本机（按账号分开），换账号或授权被撤销后自动落回第一家授权门店。
export const staffStores = computed(() => (experience.account?.staffGrants || []).filter(g => g.active === true))
export const staffIdentities = computed(() => groupStaffIdentities(staffStores.value))
// 未开店的城市授权也能作为当前身份；不把城市编号当作门店编号传给业务接口。
export function staffGrantKey(grant) {
  return grantKey(grant)
}
export const currentStaffStore = computed(() => {
  const list = staffIdentities.value
  const saved = experience.staffStoreId ?? read('staff-store', null)
  return findStaffIdentity(list, saved) || list[0] || null
})
// 页面自己的列表和分类统计也使用同一版本；同账号同门店的授权刷新不能接回旧身份的数据。
export function getMessageScopeKey() {
  const grant = experience.mode === 'staff' ? currentStaffStore.value : null
  return JSON.stringify([messageScopeRevision.value, experience.account?.id, experience.mode,
    grant ? staffGrantKey(grant) : null, grant?.roleCode, getToken()])
}
setMessageScopeProvider(() => {
  const grant = currentStaffStore.value
  if (experience.mode !== 'staff') return 'user'
  if (grant?.scopeKind === 'service-city') return grant.identityKey
  return grant ? `${grant.storeId != null ? 'store:' + grant.storeId : 'city:' + grant.cityId}:${grant.roleCode}` : 'none'
})
export const merchantStaff = computed(() => currentStaffStore.value?.roleCode === 'merchant')
export const onlineStaff = computed(() => currentStaffStore.value?.roleCode === 'online_staff')
export const merchantService = computed(() => currentStaffStore.value?.roleCode === 'merchant_service')
export const cityLead = computed(() => currentStaffStore.value?.roleCode === 'city_lead')
// 切换后的城市负责人（2026-11-01）：本城全部门店、全部二级角色的权限。服务端授权带 fullAccess 才算，老后端、切换前没有这个字段，还是原来只读的城市工作台
export const cityLeadFull = computed(() => cityLead.value && currentStaffStore.value?.fullAccess === true)
// 小院主理人这家店的授权开了「兼任商家服务人」（V63）：工作台多出商家需求和线上任务概况；角色还是 keeper，不用切门店
export const currentAlsoService = computed(() => currentStaffStore.value?.roleCode === 'keeper' && currentStaffStore.value?.alsoService === true)
// 商家服务人通过「业务」统一处理本城申请；合作商家仍使用本店首页。
export const threeTabStaff = computed(() => merchantStaff.value || (cityLead.value && !cityLeadFull.value))
export function currentStaffStoreId() {
  return currentStaffStore.value ? currentStaffStore.value.storeId : null
}
export function setStaffStore(storeId) {
  const grant = findStaffIdentity(staffIdentities.value, storeId)
  if (!grant) throw new Error('该门店或城市暂无员工授权，请刷新后重试')
  // 使用授权里的编号，兼容接口或旧缓存中的数字/字符串差异，且不做可能丢精度的 Number 转换。
  const id = staffGrantKey(grant)
  if (String(staffGrantKey(currentStaffStore.value)) !== String(id) || currentStaffStore.value?.roleCode !== grant.roleCode) invalidateMessageScope()
  // 旧版只存编号。明确选择同店某个角色时，一并记住角色，避免账号刷新后又选回第一条授权。
  const selection = storeId?.roleCode && grant.storeId != null && !grant.identityKey ? { identityKey: id, roleCode: grant.roleCode } : id
  experience.staffStoreId = selection
  try { uni.setStorageSync(key('staff-store'), selection) } catch (e) { /* 存不下只影响下次默认身份 */ }
}
/** 给经营页地址带上门店：日报、周报、看板、任务按这家门店取数和记账，不再让服务端默认到第一家主理门店。 */
export function staffStoreUrl(url, storeId = currentStaffStoreId()) {
  if (storeId == null || storeId === '') return url
  return url + (url.includes('?') ? '&' : '?') + 'storeId=' + encodeURIComponent(storeId)
}
export function acceptAuthenticatedAccount(account, { preserveMode = false } = {}) {
  if (!account?.id) throw new Error('登录信息不完整，请重新登录')
  const sameAccount = String(experience.account?.id) === String(account.id)
  const previousMode = experience.mode
  if (experience.account?.id && !sameAccount) sessionRevision++
  accountRevision++
  experience.account = account
  if (!sameAccount) experience.staffStoreId = null
  // 把旧门店缓存升级为城市身份；其中一家店撤权或排序变化不会丢掉仍有效的城市身份。
  const identity = currentStaffStore.value
  if (identity?.scopeKind === 'service-city') {
    experience.staffStoreId = identity.identityKey
    try { uni.setStorageSync(key('staff-store'), identity.identityKey) } catch (e) { /* 本次会话仍保留选择 */ }
  }
  // 账号资料刷新也令此前待返回的消息请求失效，避免恢复旧缓存。
  invalidateMessageScope()
  experience.mode = preserveMode && sameAccount && previousMode === 'user'
    ? 'user' : (hasStaffAccess.value ? 'staff' : 'user')
  loadPreferences()
  return hasStaffAccess.value ? R.staff : R.home
}
export function logout() {
  sessionRevision++
  accountRevision++
  experience.account = null
  experience.staffStoreId = null
  experience.mode = 'user'
  invalidateMessageScope()
  // 上一个会话的授权核对状态不能延续到下一个账号
  accessUnchangedAt = 0
  accessNoticeOpen = false
  clearToken()
  loadPreferences()
}
export function switchMode(mode) {
  if (mode === 'staff' && !hasStaffAccess.value) return R.identity
  experience.mode = mode
  // 身份切换立刻清空列表和红点；即使随后切回同一身份，旧请求也不能重建缓存。
  invalidateMessageScope()
  return mode === 'staff' ? R.staff : R.home
}
export function saveApplicationDraft(draft) { uni.setStorageSync(key('application-draft'), { ...draft }) }
export function loadApplicationDraft() {
  const draft = read('application-draft', {})
  return draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {}
}
// Only authenticated, recipient-scoped notifications belong in the message list.
export const visibleMessages = computed(() => experience.account
  ? experience.messages.filter(m => m.recipientId === experience.account.id && (m.mode || 'user') === experience.mode)
  : [])
// 收到当前身份的有效未读数后，服务端计数是红点的依据。旧列表可能仍含已读前的行，
// 不能用这些行把更新的服务端 0 抬高；尚未收到计数时才用收件人/身份过滤后的本地行。
export const unreadCount = computed(() => {
  if (!experience.account) return 0
  if (experience.unreadAuthoritative) return experience.unread || 0
  const local = visibleMessages.value
  const localUnread = local.reduce((sum,m) => sum + (m.read ? 0 : Number(m.unreadCount || 1)), 0)
  return Math.max(localUnread, experience.unread || 0)
})
export function markMessageRead(id) {
  const message = visibleMessages.value.find(m => m.id === id)
  if (message) {
    const scope = captureMessageScope()
    const wasUnread = !message.read
    message.read = true
    // 缓存要同步递减，否则离开消息中心后 visibleMessages 仍在但别的页面回退到缓存时红点不消
    if (wasUnread && experience.unread > 0) experience.unread = Math.max(0, experience.unread - Number(message.unreadCount || 1))
    // 服务端才是已读状态的权威来源；本地先改是为了列表立刻响应，失败也不回滚，
    // 下次 loadMessages 会以服务端结果为准。
    return apiMarkRead(id).then(res => {
      if (!isCurrentMessageScope(scope)) return false
      // 历史已读无时间：仅在服务端本次补时成功后安排刷新，不在失败时猜测期限。
      return true
    }).catch(() => false)
  }
  return Promise.resolve(false)
}

// ============================================================================
// 以下为服务端会话与数据接入。上面的导出签名与行为保持不变，页面无需改调用方式。
// ============================================================================

/** 登录态恢复中，用于首页等页面避免在恢复完成前判定为未登录 */
export const session = reactive({ restoring: false, restored: false, lastError: '' })

/**
 * 微信登录：uni.login 取 code -> 服务端 code2session -> 返回账号与员工授权。
 *
 * 返回 acceptAuthenticatedAccount 给出的落地路由，调用方直接 relaunch 即可。
 */
export async function loginWithWeixin(profile, { isCurrent = () => true } = {}) {
  const revision = sessionRevision
  const attempt = ++loginAttempt
  const assertCurrent = () => {
    if (revision !== sessionRevision || attempt !== loginAttempt || !isCurrent()) throw cancelledSession()
  }
  const code = await wxLoginCode()
  assertCurrent()
  const guestCities = [...experience.cities]
  const guestAll = experience.allCities
  const res = await apiWxLogin(code, profile)
  assertCurrent()
  if (!res.token || !res.account?.id) throw new Error('登录信息不完整，请重新登录')
  setToken(res.token)
  const route = acceptAuthenticatedAccount(res.account)
  // 游客期选过的兴趣城市，在新账号还没有偏好时迁移过去；首页的「全部城市」开关跟着一起搬，
  // 之前只搬城市，游客「选平潭 → 换回全部城市 → 登录」后首页又变成平潭。账号自己有兴趣城市时两样都不动
  if (!experience.cities.length && guestCities.length) {
    savePreferences(guestCities)
    saveAllCities(guestAll)
  }
  // 打开过朋友分享的邀请链接（?inviter=邀请码）：登录后交给服务端绑定邀请人；不符合条件或失败都静默，不影响登录
  bindPendingInviter()
  return route
}

/**
 * 冷启动时用本机令牌恢复登录态。
 *
 * 账号信息与员工授权都重新向服务端拉取，因此后台撤销授权后，
 * 用户下次进入小程序就会失去员工身份。
 */
export async function restoreSession({ isCurrent = () => true, strictErrors = false } = {}) {
  const token = getToken()
  const revision = sessionRevision
  const snapshotRevision = accountRevision
  if (!token) {
    session.restored = true
    return null
  }
  session.restoring = true
  try {
    const res = await apiAccount()
    if (revision !== sessionRevision || token !== getToken() || !isCurrent()) throw cancelledSession()
    // 冷启动的旧读取不能覆盖更新更晚的绑定或资料保存结果。
    if (snapshotRevision !== accountRevision) return null
    const route = acceptAuthenticatedAccount(res.data, { preserveMode: true })
    session.lastError = ''
    return route
  } catch (e) {
    // 旧请求不能清除新会话；绑定流程也不能把网络故障当作过期后另建登录。
    if (revision !== sessionRevision || !isCurrent() || (getToken() && token !== getToken())) {
      if (strictErrors) throw cancelledSession()
      return null
    }
    if (e?.code !== 401) {
      session.lastError = e?.message || ''
      if (strictErrors) throw e
      return null
    }
    // 令牌失效：清掉本机登录态，回到游客态，不弹窗打断冷启动
    clearToken()
    experience.account = null
    experience.mode = 'user'
    invalidateMessageScope()
    session.lastError = e?.message || ''
    return null
  } finally {
    session.restoring = false
    session.restored = true
  }
}

let restorePromise = null
let restoreToken

/**
 * 保证登录态已恢复完毕，返回同一个 Promise。
 *
 * 冷启动时恢复是异步的，而路由守卫是同步判断 hasStaffAccess 的；
 * 不等恢复完成就判断，会把持有有效令牌的员工误踢到身份页。
 */
export function ensureSession() {
  const token = getToken()
  if (!restorePromise || token !== restoreToken) {
    restoreToken = token
    const pending = restoreSession().then(route => {
      // 断网时令牌仍然有效，留给下次操作重试。晚返回的旧请求不能清掉新会话。
      if (!route && token && restorePromise === pending) restorePromise = null
      return route
    })
    restorePromise = pending
  }
  return restorePromise
}

/** 每次进入员工端都向服务端确认授权；欢迎页可直接发起微信登录。 */
export async function resolveStaffEntry({ authenticate = false, isCurrent = () => true } = {}) {
  const revision = sessionRevision
  const current = () => revision === sessionRevision && isCurrent()
  await restoreSession({ isCurrent: current, strictErrors: true })
  if (!current()) throw cancelledSession()
  if (!experience.account) {
    if (!authenticate) return R.login + '?entry=staff'
    await loginWithWeixin(undefined, { isCurrent: current })
  }
  if (!current()) throw cancelledSession()
  return hasStaffAccess.value ? switchMode('staff') : R.identity
}

let accountRefresh = null
/**
 * 会话中途重新读取账号与员工授权，不改变当前身份；并发调用合并成同一次请求。
 * 冷启动的 ensureSession 只跑一次，后台新增 / 撤销授权要靠这里才能在本次会话里生效。
 * 网络等错误照常抛出，由调用方提示；令牌失效（401）按 restoreSession 的规则回到游客态。
 */
export function refreshAccount() {
  if (!accountRefresh) {
    accountRefresh = restoreSession({ strictErrors: true }).finally(() => { accountRefresh = null })
  }
  return accountRefresh
}

/**
 * 切换当前门店。本机授权是上次登录 / 刷新时的快照，切换页的门店列表却来自服务端实时授权，
 * 会话中新授予的门店本机还没有：先刷新一次账号再判断，不在服务端已接受之后才报"暂无授权"。
 */
export async function selectStaffStore(storeId) {
  const known = () => !!findStaffIdentity(staffIdentities.value, storeId)
  if (!known()) {
    const revision = sessionRevision
    await refreshAccount()
    if (revision !== sessionRevision) throw cancelledSession()
  }
  setStaffStore(storeId)
}

// ----------------------------------------------------------------------------
// 员工授权在会话中途失效。
//
// 服务端每个请求都重读授权（AppIdentityLoader），撤销授权或停用门店后立刻 403；
// 本机的 staffGrants 却要到下次冷启动才更新，于是每个员工页都只剩"没有该门店的操作权限"，
// 门店切换页也是空的。这里在员工端接口 403 时向服务端核对一次，按结果改用仍有效的门店，
// 或在一家都不剩时回到用户身份。只核对、不重试原请求，所以不会形成请求循环。
// ----------------------------------------------------------------------------
const STAFF_API = /^\/app\/(staff|manage)\//
// 核对结果是"授权没变"时，短时间内的其他 403 不再重复刷新账号：那是角色或业务规则的拒绝。
const ACCESS_RECHECK_GAP = 2000
let accessCheck = null
let accessUnchangedAt = 0
let accessNoticeOpen = false
const sameStore = (a, b) => a != null && a !== '' && b != null && String(a) === String(b)

/**
 * 向服务端核对员工授权并纠正本机状态。并发调用共享同一次核对。
 *
 * 返回 null 表示授权没有变化（这次 403 不是门店授权问题，页面照常显示服务端原因）；否则返回
 *   { kind: 'revoked' }  已没有任何有效门店，身份随账号刷新回到用户；
 *   { kind: 'switched' } 当前门店失效，已改用仍有效的门店 to；
 *   { kind: 'lost' }     当前门店仍有效，失效的是请求指定的门店（requestedLost）或其他门店。
 * lost 为本次失效的授权（含门店名，用于提示）。
 */
export function recheckStaffAccess({ storeId = null } = {}) {
  if (accessCheck) return accessCheck
  if (Date.now() - accessUnchangedAt < ACCESS_RECHECK_GAP) return Promise.resolve(null)
  const revision = sessionRevision
  const before = staffStores.value.slice()
  const previous = currentStaffStore.value
  accessCheck = (async () => {
    await refreshAccount()
    // 核对期间换了账号或已登出：结果属于旧会话，不能拿来改新会话的门店
    if (revision !== sessionRevision || !experience.account) return null
    const kept = id => staffStores.value.some(g => sameStore(staffGrantKey(g), id))
    const lost = before.filter(g => !kept(staffGrantKey(g)))
    const requestedLost = storeId != null && storeId !== '' && !kept(storeId)
    if (!lost.length && !requestedLost) {
      accessUnchangedAt = Date.now()
      return null
    }
    if (!staffStores.value.length) return { kind: 'revoked', lost, requestedLost, from: previous, to: null }
    const currentLost = !!previous && !findStaffIdentity(staffIdentities.value, previous)
    const to = currentStaffStore.value
    // currentStaffStore 已自动落到第一家仍有效的门店；同时写回本机，冷启动后不会再选回失效的那家
    if (currentLost && to) setStaffStore(to)
    return { kind: currentLost ? 'switched' : 'lost', lost, requestedLost, from: previous, to }
  })().finally(() => { accessCheck = null })
  return accessCheck
}

const onStaffPage = () => {
  try {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    return /^pages\/(staff|manage)\//.test(pages[pages.length - 1]?.route || '')
  } catch (e) {
    return false
  }
}
const storeLabel = (grant) => (grant?.storeName || grant?.city ? '「' + (grant.storeName || grant.city) + '」' : '该门店')

/** 把核对结果明确告诉员工；当前页面依赖的门店已失效时，确认后回到仍有效的工作台或身份页。 */
function noticeStaffAccess(result) {
  // 并发的几个 403 共享同一次核对结果，只提示、只跳转一次
  if (!result || result.noticed || accessNoticeOpen) return
  result.noticed = true
  const names = result.lost.length ? result.lost.map(storeLabel).join('、') : storeLabel(null)
  let route = null
  let content
  if (result.kind === 'revoked') {
    route = R.identity
    content = `${names}的员工授权已被撤销或门店已停用，当前账号暂无可用门店，已切换回用户身份。`
  } else if (result.kind === 'switched') {
    route = R.staff
    content = `${storeLabel(result.from)}的员工授权已被撤销或门店已停用，已自动切换到${storeLabel(result.to)}。`
  } else {
    if (result.requestedLost) route = R.staff
    content = `${names}的员工授权已被撤销或门店已停用，该门店的数据已不可查看或操作。`
  }
  // 只在员工页上才需要离开：个人中心、消息页等身份通用的页面不受门店影响，原地刷新即可
  const leave = route && onStaffPage() ? route : null
  if (result.kind === 'lost' && leave && result.to) content += `即将返回${storeLabel(result.to)}的工作台。`
  const done = () => {
    accessNoticeOpen = false
    if (leave) uni.reLaunch({ url: leave })
  }
  if (typeof uni.showModal !== 'function') return done()
  accessNoticeOpen = true
  uni.showModal({ title: '员工授权已变更', content, showCancel: false, confirmText: '知道了', complete: done })
}

// 只核对员工端接口，且只在员工身份下处理：用户身份下的 403（例如换工任务的认领限制）与员工授权无关。
setForbiddenHandler(({ url, params, data } = {}) => {
  if (!STAFF_API.test(url || '') || experience.mode !== 'staff' || !hasStaffAccess.value) return
  const storeId = params?.storeId ?? (data && typeof data === 'object' ? data.storeId : null) ?? null
  recheckStaffAccess({ storeId }).then(noticeStaffAccess).catch(() => {
    // 核对本身失败（网络等）时不跳转，页面照常显示服务端给出的拒绝原因
  })
})

/** 服务端登出。即使请求失败也清理本地会话，避免本地残留登录态。 */
export async function logoutFromServer() {
  let pending
  try {
    if (getToken()) pending = apiLogout()
    // 发出请求时已捕获旧 token，立即使旧登录失效，避免等待网络期间被恢复。
    logout()
    await pending
  } catch (e) {
    // 忽略：本地清理才是关键
  }
}

/**
 * 拉取当前账号、当前身份的消息。
 *
 * 服务端已按 recipientId + mode 过滤，这里再经 visibleMessages 过滤一次，
 * 双重保证不会串号显示。
 *
 * more（可选）：{ bucket, page, size }，只要消息页下面那一组（bucket=main）的一页，不再一次拉全量
 * （店长员工身份原来一次 869 行）。append 为真时把这一页接在已有列表后面，按 id 去重
 * （新消息进来会把后面的行往下挤，下一页开头可能和上一页末尾重复）；否则整份替换。
 */
export async function loadMessages(category, more, append) {
  if (!experience.account) {
    invalidateMessageScope()
    return []
  }
  const scope = captureMessageScope()
  const request = ++messageListRequest
  // 列表和单独未读请求共同竞争同一份红点缓存。
  const unreadRequest = ++messageUnreadRequest
  const res = await apiMessages(scope.mode, category, more)
  if (!isCurrentMessageScope(scope) || request !== messageListRequest) return []
  const rows = Array.isArray(res.rows) ? res.rows : []
  const seen = new Set(append ? experience.messages.map(m => m.id) : [])
  experience.messages = append ? experience.messages.concat(rows.filter(m => !seen.has(m.id))) : rows
  experience.messagesMore = typeof res.hasMore === 'boolean' ? res.hasMore : null
  // 列表接口一并返回了服务端未读总数，它不受 category / bucket 过滤和分页影响，比数本地行数准
  if (unreadRequest === messageUnreadRequest) {
    const validUnread = typeof res.unread === 'number' && Number.isFinite(res.unread) && res.unread >= 0
    experience.unread = validUnread ? res.unread : visibleMessages.value.reduce((sum,m) => sum + (m.read ? 0 : Number(m.unreadCount || 1)), 0)
    experience.unreadAuthoritative = validUnread
  }
  return experience.messages
}

/** 仅刷新未读数（tabbar 红点用，比拉全量列表轻）。结果写回缓存，供没拉过列表的页面使用。 */
export async function refreshUnread() {
  if (!experience.account) {
    invalidateMessageScope()
    return 0
  }
  const scope = captureMessageScope()
  const request = ++messageUnreadRequest
  const res = await apiUnreadCount(scope.mode)
  if (!isCurrentMessageScope(scope) || request !== messageUnreadRequest) return 0
  const unread = res?.data?.unread
  if (typeof unread !== 'number' || !Number.isFinite(unread) || unread < 0) throw new Error('消息未读数无效')
  experience.unread = unread
  experience.unreadAuthoritative = true
  return unread
}

/** 全部标记已读 */
export async function markAllMessagesRead() {
  if (!experience.account) return
  const scope = captureMessageScope()
  await apiMarkAllRead(scope.mode)
  if (!isCurrentMessageScope(scope)) return
  // 成功写入后的本地状态不能再被写入前的在途读取恢复成未读。
  messageListRequest++
  messageUnreadRequest++
  visibleMessages.value.forEach(m => {
    // 保留服务端已有到期时间；反复点“全部已读”不能延长首次已读后的保留期。
    m.read = true
  })
  experience.unread = 0
  experience.unreadAuthoritative = true
}

/** 服务端确认删除后再移除本地提醒；账号切换及删除前的在途列表不能把消息带回来。 */
export async function deleteMessage(id) {
  if (!experience.account) throw new Error('请先登录')
  const scope = captureMessageScope()
  const res = await apiDeleteMessage(id, scope.mode)
  if (!isCurrentMessageScope(scope)) return false
  messageListRequest++
  messageUnreadRequest++
  const removed = visibleMessages.value.find(m => String(m.id) === String(id))
  experience.messages = experience.messages.filter(m => String(m.id) !== String(id))
  const unread = res?.data?.unread
  if (typeof unread === 'number' && Number.isFinite(unread) && unread >= 0) {
    experience.unread = unread
    experience.unreadAuthoritative = true
  } else if (removed && !removed.read) experience.unread = Math.max(0, experience.unread - Number(removed.unreadCount || 1))
  return true
}

// 令牌失效时统一回到游客态。注册在这里而不是 request.js，避免请求层反向依赖业务状态。
setUnauthorizedHandler(() => {
  experience.account = null
  experience.mode = 'user'
  invalidateMessageScope()
})
