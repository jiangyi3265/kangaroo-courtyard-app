<template>
  <view class="k-page follows">
    <k-topbar :title="storeId ? (store.storeName || '门店在招岗位') : '收藏与关注'" back custom-back @back="onBack" />

    <!-- 2026-10-18 主人：「我的收藏」「我的关注」合成「收藏与关注」，顶部下拉选看哪一个；下面一排页签跟着换：
         我的收藏 = 岗位 / 房源 / 服务 / 帖子 / 活动，我的关注 = 门店 / 用户（2026-10-11 起社区里关注的人也在这里） -->
    <view v-if="!storeId" class="modebar">
      <view class="mode" hover-class="k-press" @click="modeOpen = !modeOpen">
        <view class="mode__pill"><text>{{ mode === 'fav' ? '我的收藏' : '我的关注' }}</text><k-icon :name="modeOpen ? 'chevron-up' : 'chevron-down'" :size="15" color="red" :stroke="2" /></view>
      </view>
      <view class="k-tabs k-tabs--left tabs">
        <view v-for="t in (mode === 'fav' ? FAV_TABS : TABS)" :key="t.key" class="k-tabs__item" :class="{ active: (mode === 'fav' ? favTab : tab) === t.key }" @click="pickTab(t.key)"><text>{{ t.label }}</text></view>
      </view>
      <view v-if="modeOpen" class="mode-menu">
        <view v-for="modeItem in MODES" :key="modeItem.key" class="mode-menu__item" :class="{ on: mode === modeItem.key }" hover-class="k-press" @click="setMode(modeItem.key)">
          <text>{{ modeItem.label }}</text><k-icon v-if="mode === modeItem.key" name="check" :size="16" color="red" :stroke="2.2" />
        </view>
      </view>
    </view>
    <view v-if="modeOpen" class="mode-mask" @click="modeOpen = false" @touchmove.stop.prevent />

    <view v-if="!storeId && !sessionReady" class="k-body k-pad-safe state"><text class="k-meta">正在确认登录状态…</text></view>
    <view v-else-if="!storeId && !experience.account?.id" class="k-body k-pad-safe state auth-state">
      <k-icon :name="mode === 'fav' ? 'bookmark' : 'users'" :size="34" color="muted" />
      <text class="state__title">登录后查看{{ mode === 'fav' ? '收藏' : '关注' }}</text>
      <text class="k-meta">{{ mode === 'fav' ? '收藏过的岗位、房源等，会保存在你的账号里。' : '登录后查看你关注的门店和用户。' }}</text>
      <k-button type="secondary" size="sm" label="去登录" @click="go(R.login)" />
    </view>

    <!-- 0 我的收藏：一类一个页签，点一行进详情（原来是系统菜单选类别、再翻页选名字） -->
    <view v-else-if="!storeId && mode === 'fav'" class="k-body k-pad-safe">
      <view v-if="favLoading && !favRows.length" class="state"><text class="k-meta">正在读取收藏…</text></view>
      <view v-else-if="favError" class="state"><text>{{ favError }}</text><k-button type="ghost" size="sm" label="重新加载" @click="loadFav" /></view>
      <view v-else-if="!favRows.length" class="state">
        <k-icon name="bookmark" :size="34" color="muted" />
        <text class="state__title">还没有收藏的{{ favLabel }}</text>
        <text class="k-meta">在详情页点收藏，就会出现在这里。</text>
      </view>
      <view v-for="favItem in favRows" :key="favItem.key" class="store-row fav-row" hover-class="k-press-s" @click="openFav(favItem)">
        <image v-if="favItem.cover" class="store-row__cover" :src="favItem.cover" mode="aspectFill" />
        <view v-else class="store-row__cover store-row__cover--empty"><k-icon :name="favIcon" :size="24" color="green" /></view>
        <view class="store-row__main">
          <k-job-urgency v-if="favItem.kind === 'job'" :job="favItem.urgency" />
          <text class="store-row__name">{{ favItem.title }}</text>
          <text v-if="favItem.meta" class="store-row__jobs">{{ favItem.meta }}</text>
          <text v-if="favItem.note" class="k-tiny">{{ favItem.note }}</text>
          <text v-if="favItem.status" class="fav-row__status" :class="{ off: favItem.off }">{{ favItem.status }}</text>
          <button v-if="favItem.kind === 'job'" class="fav-row__cancel" role="button" :disabled="!!cancelingJobs[favItem.id]" :loading="!!cancelingJobs[favItem.id]" :aria-label="'取消收藏：' + favItem.title" @click.stop="cancelFavJob(favItem)">{{ cancelingJobs[favItem.id] ? '取消中' : '取消收藏' }}</button>
        </view>
        <k-icon name="chevron-right" :size="16" color="muted" />
      </view>
      <text v-if="favRows.length" class="k-tiny footnote">共 {{ favRows.length }} 个收藏的{{ favLabel }}</text>
    </view>

    <!-- 1b 我关注的用户：点一行进 TA 的个人主页，可取消关注 -->
    <view v-else-if="!storeId && tab === 'user'" class="k-body k-pad-safe">
      <view class="note"><k-icon name="users" :size="15" color="ochre" /><text>在社区点作者头像进 TA 的主页就能关注；信息流选「已关注」只看这些人发的动态。</text></view>
      <view v-if="userLoading && !users.length" class="state"><text class="k-meta">正在读取关注的人…</text></view>
      <view v-else-if="userError" class="state"><text>{{ userError }}</text><k-button type="ghost" size="sm" label="重新加载" @click="loadUsers" /></view>
      <view v-else-if="!users.length" class="state">
        <k-icon name="users" :size="34" color="muted" />
        <text class="state__title">还没有关注的人</text>
        <text class="k-meta">在社区里点帖子作者的头像，进 TA 的主页点「关注」。</text>
        <k-button v-if="communityEnabled" type="secondary" size="sm" label="去社区看看" @click="go(R.community)" />
      </view>
      <view v-for="userRow in users" :key="userRow.userId" class="store-row" @click="openUser(userRow)">
        <image class="user-row__avatar" :src="userRow.avatar ? absUrl(userRow.avatar) : DEFAULT_AVATAR" mode="aspectFill" />
        <view class="store-row__main">
          <view class="user-row__name-line"><text class="store-row__name">{{ userRow.name }}</text><k-chip v-if="userRow.mutual" tone="green">互相关注</k-chip></view>
          <text class="k-tiny">{{ userRow.followTime ? userRow.followTime + ' 关注' : '' }}{{ userRow.phoneVerified ? (userRow.followTime ? ' · ' : '') + '手机已验证' : '' }}</text>
        </view>
        <!-- 小程序里组件上的 @click.stop 只拦自定义事件，按钮的原生 tap 仍会冒泡到整行（打开主页）；套一层 view 编译成 catchtap 才拦得住 -->
        <view class="row-action" @click.stop><k-button size="xs" type="outline" label="取消关注" :disabled="busyUser === userRow.userId" @click="unfollowUser(userRow)" /></view>
      </view>
      <text v-if="users.length" class="k-tiny footnote">已关注 {{ users.length }} 人</text>
    </view>

    <!-- 1 我关注的门店 -->
    <view v-else-if="!storeId" class="k-body k-pad-safe">
      <view class="note"><k-icon name="bell" :size="15" color="ochre" /><text>{{ note }}</text></view>
      <view v-if="loading && !rows.length" class="state"><text class="k-meta">正在读取关注的门店…</text></view>
      <view v-else-if="error" class="state"><text>{{ error }}</text><k-button type="ghost" size="sm" label="重新加载" @click="loadList" /></view>
      <view v-else-if="!rows.length" class="state">
        <k-icon name="store" :size="34" color="muted" />
        <text class="state__title">还没有关注的门店</text>
        <text class="k-meta">在岗位详情的门店卡片上点「关注」，这家店发布新岗位时会在消息中心通知你。</text>
        <k-button type="secondary" size="sm" label="去看看岗位" @click="go(R.jobsList)" />
      </view>
      <view v-for="storeRow in rows" :key="storeRow.storeId" class="store-row" @click="openStore(storeRow)">
        <image v-if="storeRow.cover" class="store-row__cover" :src="absUrl(storeRow.cover)" mode="aspectFill" />
        <view v-else class="store-row__cover store-row__cover--empty"><k-icon name="store" :size="24" color="green" /></view>
        <view class="store-row__main">
          <text class="store-row__name">{{ storeRow.storeName }}</text>
          <text class="store-row__jobs" :class="{ 'is-open': storeRow.openJobs > 0 }">{{ storeRow.city ? storeRow.city + ' · ' : '' }}{{ storeRow.jobsText }}</text>
          <text class="k-tiny">{{ storeRow.followTime ? storeRow.followTime + ' 关注 · ' : '' }}{{ storeRow.freqText }}</text>
        </view>
        <!-- 同上：不套这层，点取消关注会顺带切到这家店的岗位页 -->
        <view class="row-action" @click.stop><k-button size="xs" type="outline" label="取消关注" :disabled="busyId === storeRow.storeId" @click="unfollow(storeRow)" /></view>
      </view>
      <text v-if="rows.length" class="k-tiny footnote">已关注 {{ rows.length }} 家，最多可关注 {{ max }} 家</text>
    </view>

    <!-- 2 某家门店的在招岗位 -->
    <view v-else class="k-body k-pad-safe">
      <view v-if="loading && !store.storeId" class="state"><text class="k-meta">正在读取门店…</text></view>
      <view v-else-if="error" class="state"><text>{{ error }}</text><k-button type="ghost" size="sm" label="重新加载" @click="loadStore" /></view>
      <template v-else>
        <view class="store-head">
          <image v-if="store.cover" class="store-head__cover" :src="absUrl(store.cover)" mode="aspectFill" />
          <view v-else class="store-head__cover store-row__cover--empty"><k-icon name="store" :size="26" color="green" /></view>
          <view class="store-head__main">
            <text class="store-head__name">{{ store.storeName }}</text>
            <text class="k-meta">{{ storeMeta }}</text>
          </view>
          <k-button size="sm" :type="following ? 'outline' : 'secondary'" :icon="following ? 'check' : 'plus'" :label="following ? '已关注' : '关注'" :disabled="busyId === storeId" @click="toggleFollow" />
        </view>
        <text class="hint">{{ following ? '已关注：这家店发布新岗位时，会在消息中心通知你。' : '关注后，这家店发布新岗位时会在消息中心通知你，不会告诉门店是谁关注了它。' }}</text>
        <text v-if="store.intro" class="intro">{{ store.intro }}</text>
        <view class="section"><text class="section__title">在招岗位</text><text class="k-meta">{{ jobs.length }} 个</text></view>
        <view v-if="!jobs.length" class="state">
          <k-icon name="briefcase" :size="30" color="muted" />
          <text class="k-meta">{{ store.active === false ? '这家店暂停营业，暂时看不到它的岗位。' : '这家店暂时没有在招的岗位' + (following ? '，有新岗位会通知你。' : '，关注后有新岗位会通知你。') }}</text>
        </view>
        <view v-for="jobRow in jobs" :key="jobRow.jobId" class="job-row" @click="openJob(jobRow)">
          <view class="job-row__main">
            <k-job-urgency :job="jobRow" />
            <view class="job-row__head"><k-chip :tone="jobRow.jobType === 'online' ? 'blue' : 'green'"><text>{{ jobRow.typeLabel }}</text></k-chip><text class="job-row__title">{{ displayWording(jobRow.title, [jobRow.storeName]) }}</text></view>
            <text class="k-meta">{{ jobMeta(jobRow) }}</text>
          </view>
          <view class="job-row__price"><text class="job-row__num">{{ jobRow.price }}</text><text class="k-tiny">{{ jobRow.unit }}</text></view>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { communityEnabled, privateChatEnabled, stayBookingEnabled } from "@/common/features.js"
import { displayWording } from '@/common/display-wording.js'
// ---------------------------------------------------------------------------
// 我的关注（「我的」→ 我的关注；岗位详情门店卡片、关注上新的消息也会带 ?storeId= 直接打开第 2 屏）
//   第 1 屏：关注的门店（门店名、城市、在招岗位数），可取消关注，点一家进第 2 屏
//   第 2 屏：这家店在招的岗位，点岗位进详情；顶部可关注 / 取消关注
// 关注只作用在自己账号上：门店上新时通过消息中心通知你，不会通知门店。
// 2026-10-11 起第 1 屏分「门店 / 用户」两个页签（?tab=user 直接打开用户）：用户页签列出我在社区关注的人，点一行进 TA 的主页，可取消关注。
// ---------------------------------------------------------------------------
import { ref, computed, watch, onUnmounted } from 'vue'
import { onLoad, onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { go, back, toast } from '@/common/screen.js'
import { apiMyFollows, apiStoreJobs, apiFollowStore, apiFollowingUsers, apiFollow } from '@/common/api.js'
import { apiToggleFavorite, apiJobFavorites, apiStayFavorites, apiServiceFavorites, apiPostFavorites, apiActivityFavorites } from '@/common/api.js'
import { ensureSession, experience, getSessionRevision } from '@/common/experience.js'
import { onJobFavoriteChange, publishJobFavoriteChange } from '@/common/job-favorite-events.js'
import { confirm, errText } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'

const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
const TABS = computed(() => [{ key: 'store', label: '门店' }, ...(communityEnabled.value && privateChatEnabled.value ? [{ key: 'user', label: '用户' }] : [])])
const tab = ref('store')
// 顶部下拉：我的收藏 / 我的关注（「我的」进来带 ?mode=fav；门店页 ?storeId=、关注的人 ?tab=user 等老链接照旧落到关注）
const MODES = [{ key: 'fav', label: '我的收藏' }, { key: 'follow', label: '我的关注' }]
const mode = ref('follow')
const modeOpen = ref(false)
function setMode(key) {
  modeOpen.value = false
  if (mode.value === key) return
  mode.value = key
  reload()
}
const pickTab = (key) => (mode.value === 'fav' ? setFavTab(key) : setTab(key))
// ---------------- 我的收藏（2026-10-18 从「我的」首屏的系统菜单搬过来） ----------------
const FAV_TABS = computed(() => [{ key: 'job', label: '岗位', icon: 'briefcase' }, { key: 'stay', label: '房源', icon: 'bed' }, { key: 'service', label: '服务', icon: 'shopping-bag' },
  { key: 'post', label: '帖子', icon: 'file-text' }, { key: 'activity', label: '活动', icon: 'ticket' }].filter(item => (communityEnabled.value || item.key !== 'post') && (stayBookingEnabled.value || item.key !== 'stay')))
const favTab = ref('job')
const favRows = ref([])
watch(stayBookingEnabled, enabled => { if(!enabled && favTab.value==='stay'){favTab.value='job';favRows.value=[];reload()} })
watch(privateChatEnabled, enabled => { if(!enabled && tab.value==='user'){tab.value='store';users.value=[];reload()} })
watch(communityEnabled, enabled => { if (!enabled) { if (favTab.value === 'post') { favTab.value='job';favRows.value=[];reload() } if (tab.value === 'user') { tab.value='store';reload() } } })
const favLoading = ref(false)
const favError = ref('')
let favSeq = 0
const cancelingJobs = ref({})
const stopFavoriteSync = onJobFavoriteChange(change => {
  if (change.accountId !== String(experience.account?.id || '') || change.favorite || favTab.value !== 'job') return
  // Any read started before this confirmed cancellation may still contain the job.
  ++favSeq
  favLoading.value = false
  favRows.value = favRows.value.filter(row => row.kind !== 'job' || String(row.id) !== change.jobId)
})
onUnmounted(stopFavoriteSync)
async function cancelFavJob(row) {
  syncAccountScope()
  if (row.kind !== 'job' || cancelingJobs.value[row.id]) return
  if (!experience.account?.id) return go(R.login)
  const scope = captureAccountScope(), accountId = experience.account.id
  cancelingJobs.value = { ...cancelingJobs.value, [row.id]: true }
  try {
    const res = await apiToggleFavorite(row.id, false)
    if (!isAccountScopeCurrent(scope)) return
    if (res?.data?.favorite !== false) throw new Error('取消收藏未成功，请重试')
    publishJobFavoriteChange(accountId, row.id, false)
    toast('已取消收藏')
  } catch (e) {
    if (isAccountScopeCurrent(scope)) toast(errText(e, '取消收藏失败，请重试'))
  } finally {
    if (isAccountScopeCurrent(scope)) {
      const pending = { ...cancelingJobs.value }
      delete pending[row.id]
      cancelingJobs.value = pending
    }
  }
}
const favOf = () => FAV_TABS.value.find(t => t.key === favTab.value) || FAV_TABS.value[0]
const favLabel = computed(() => favOf().label)
const favIcon = computed(() => favOf().icon)
function setFavTab(key) {
  if (favTab.value === key) return
  favTab.value = key
  favRows.value = []
  loadFav()
}
const listOf = (d) => (Array.isArray(d) ? d : (d && d.rows) || [])
const firstImage = (x) => x.cover || x.image || x.img || (Array.isArray(x.images) ? x.images[0] : String(x.images || '').split(',')[0]) || ''
const yuan = (fen) => (fen == null || fen === '' ? '' : '¥' + (Number(fen) / 100).toFixed(Number(fen) % 100 ? 2 : 0))
// 各类收藏的字段不一样，统一成 标题 / 一行信息 / 一行小字 / 右边状态
const FAV_ROW = {
  job: (x) => ({ id: x.jobId, title: x.title, urgency: x, meta: [x.typeLabel || x.workKindLabel, x.storeName, x.city].filter(Boolean).join(' · '), note: x.salaryText || '', status: x.statusText || '', off: !!x.ended }),
  stay: (x) => ({ id: x.stayId, title: x.stayName || x.name, meta: [x.areaDesc, x.rating ? Number(x.rating).toFixed(1) + ' 分' : ''].filter(Boolean).join(' · '), note: x.priceFromFen != null ? yuan(x.priceFromFen) + ' 起' : '' }),
  service: (x) => ({ id: x.serviceId, title: x.name || x.serviceName, meta: [x.storeName, x.priceFen != null ? yuan(x.priceFen) + (x.unitLabel ? '/' + x.unitLabel : '') : ''].filter(Boolean).join(' · '), status: x.statusText || '', off: !!x.offline }),
  post: (x) => ({ id: x.postId, title: x.title || String(x.content || '').slice(0, 30), meta: [x.typeLabel || x.kindLabel, x.authorName || x.nickname, x.city].filter(Boolean).join(' · ') }),
  activity: (x) => ({ id: x.activityId, title: x.title, meta: [x.city, x.timeText || x.startText].filter(Boolean).join(' · '), note: x.deadlineNote || '', status: x.state || '', off: !!x.ended })
}
async function loadFav() {
  syncAccountScope()
  if (!experience.account?.id) return
  const token = ++favSeq, kind = favTab.value, scope = captureAccountScope()
  const current = () => token === favSeq && isAccountScopeCurrent(scope)
  favLoading.value = true
  favError.value = ''
  try {
    let d
    if (kind === 'job') d = (await apiJobFavorites()).data
    if (kind === 'stay') d = (await apiStayFavorites({ pageNum: 1, pageSize: 50 })).data
    if (kind === 'service') d = (await apiServiceFavorites()).data
    if (kind === 'post') d = (await apiPostFavorites(1)).data
    if (kind === 'activity') d = (await apiActivityFavorites()).data
    if (!current()) return
    favRows.value = listOf(d).map((x, i) => {
      const row = FAV_ROW[kind](x)
      const img = firstImage(x)
      return { ...row, kind, key: kind + '-' + (row.id || i), title: row.title || '（未命名）', cover: img ? absUrl(img) : '' }
    })
  } catch (e) {
    if (current()) favError.value = errText(e, '收藏读取失败，请重试')
  } finally {
    if (current()) favLoading.value = false
  }
}
function openFav(row) {
  if (row.kind === 'job') return go(R.jobDetail + '?jobId=' + row.id)
  if (row.kind === 'stay') return go(R.stayDetail + '?stayId=' + row.id)
  if (row.kind === 'post') return go(R.community + '?postId=' + row.id + '&from=fav')
  if (row.kind === 'activity') return go(R.activity + '?id=' + row.id)
  if (row.off) return toast('这个服务下架了，看看别的吧')
  go(R.stayShop + '?serviceId=' + row.id)
}
const users = ref([])
const userLoading = ref(false)
const userError = ref('')
const busyUser = ref(0)
let userSeq = 0
const storeId = ref(0)
// 从别的页面直接打开某家门店（?storeId=）时，返回就回那个页面；从本页列表点进去的，返回回到列表
let landingStore = false
const rows = ref([])
const note = ref('关注的门店发布新岗位时，会在消息中心通知你。')
const max = ref(50)
const store = ref({})
const following = ref(false)
const jobs = ref([])
const loading = ref(false)
const error = ref('')
const busyId = ref(0)
const sessionReady = ref(false)
let ready = false
let seq = 0
let disposed = false
const captureAccountScope = () => ({ accountId: String(experience.account?.id || ''), revision: getSessionRevision() })
const isAccountScopeCurrent = scope => !disposed && scope.accountId === String(experience.account?.id || '') && scope.revision === getSessionRevision()
let accountScope = captureAccountScope()
function syncAccountScope() {
  if (isAccountScopeCurrent(accountScope)) return
  accountScope = captureAccountScope()
  ++favSeq; ++userSeq; ++seq
  favRows.value = []; users.value = []; rows.value = []; jobs.value = []
  store.value = {}; following.value = false
  favLoading.value = false; userLoading.value = false; loading.value = false
  favError.value = ''; userError.value = ''; error.value = ''
  cancelingJobs.value = {}; busyUser.value = 0; busyId.value = 0
}
watch(() => [experience.account?.id, getSessionRevision()], syncAccountScope, { flush: 'sync' })
onUnmounted(() => { disposed = true; ++favSeq; ++userSeq; ++seq })

onLoad(async (q) => {
  storeId.value = Number(q && q.storeId) || 0
  landingStore = !!storeId.value
  if (communityEnabled.value && privateChatEnabled.value && q && q.tab === 'user') tab.value = 'user'
  // 只有「我的」带 ?mode=fav 进来才先看收藏；?fav= 直接停在某一类收藏
  if (q && q.mode === 'fav' && q.tab !== 'user') mode.value = 'fav'
  if (q && FAV_TABS.value.some(t => t.key === q.fav)) favTab.value = q.fav
  await ensureSession()
  if (disposed) return
  sessionReady.value = true
  await reload()
  ready = true
})
// 从岗位详情改了关注再回来、或从门店页返回列表时，按服务端重读，不靠本地记的状态
onShow(() => { if (ready) reload() })
onPullDownRefresh(() => Promise.resolve(reload()).finally(() => uni.stopPullDownRefresh()))

const reload = () => (storeId.value ? loadStore() : mode.value === 'fav' ? loadFav() : (tab.value === 'user' ? loadUsers() : loadList()))
function setTab(key) {
  if (tab.value === key) return
  tab.value = key
  reload()
}

async function loadUsers() {
  syncAccountScope()
  if (!experience.account?.id) return
  const token = ++userSeq
  const scope = captureAccountScope(), current = () => token === userSeq && isAccountScopeCurrent(scope)
  userLoading.value = true
  userError.value = ''
  try {
    const rows = (await apiFollowingUsers()).data || []
    if (current()) users.value = rows
  } catch (e) {
    if (current()) userError.value = errText(e, '关注的人读取失败，请重试')
  } finally {
    if (current()) userLoading.value = false
  }
}
const openUser = (row) => go(R.userProfile + '?uid=' + row.userId)
async function unfollowUser(row) {
  syncAccountScope()
  if (busyUser.value) return
  const scope = captureAccountScope()
  if (!(await confirm('取消关注', `不再关注「${row.name}」？信息流「已关注」里就看不到 TA 的动态了。`))) return
  if (!isAccountScopeCurrent(scope) || busyUser.value) return
  busyUser.value = row.userId
  try {
    const res = await apiFollow(row.userId)
    if (!isAccountScopeCurrent(scope)) return
    // 关注接口是「点一下切换」：万一服务端那边已经取消过（返回 followed=true，又关注上了），再点一次切回去
    if (res.data && res.data.followed) await apiFollow(row.userId)
    if (!isAccountScopeCurrent(scope)) return
    ++userSeq
    userLoading.value = false
    users.value = users.value.filter(x => x.userId !== row.userId)
    toast('已取消关注')
  } catch (e) {
    if (isAccountScopeCurrent(scope)) toast(errText(e, '操作失败，请重试'))
  } finally {
    if (isAccountScopeCurrent(scope)) busyUser.value = 0
  }
}

async function loadList() {
  syncAccountScope()
  if (!experience.account?.id) return
  const token = ++seq
  const scope = captureAccountScope(), current = () => token === seq && isAccountScopeCurrent(scope)
  loading.value = true
  error.value = ''
  try {
    const d = (await apiMyFollows()).data || {}
    if (!current()) return
    rows.value = d.rows || []
    if (d.note) note.value = d.note
    if (d.max) max.value = d.max
  } catch (e) {
    if (current()) error.value = errText(e, '关注的门店读取失败，请重试')
  } finally {
    if (current()) loading.value = false
  }
}

async function loadStore() {
  syncAccountScope()
  const token = ++seq
  const scope = captureAccountScope(), current = () => token === seq && isAccountScopeCurrent(scope)
  loading.value = true
  error.value = ''
  try {
    const d = (await apiStoreJobs(storeId.value)).data || {}
    if (!current()) return
    store.value = d.store || {}
    following.value = !!d.following
    jobs.value = d.jobs || []
  } catch (e) {
    if (current()) error.value = errText(e, '门店读取失败，请重试')
  } finally {
    if (current()) loading.value = false
  }
}

const storeMeta = computed(() => {
  const s = store.value || {}
  if (s.active === false) return '门店暂停营业'
  const parts = []
  if (s.city) parts.push(s.city)
  if (s.rating) parts.push(Number(s.rating).toFixed(1) + ' 分' + (s.reviewCount ? '（' + s.reviewCount + ' 条评价）' : ''))
  if (s.safe) parts.push('安心商家')
  return parts.join(' · ') || '门店'
})

const jobMeta = (j) => [
  j.jobType === 'online' ? '远程完成 · 不限城市' : j.city,
  j.board,
  j.minDays ? '至少 ' + j.minDays + ' 天' : '',
  j.startDate ? String(j.startDate).slice(5).replace('-', '月') + '日起' : ''
].filter(Boolean).join(' · ')

function openStore(row) {
  storeId.value = Number(row.storeId) || 0
  store.value = { storeName: row.storeName }
  jobs.value = []
  loadStore()
}
const openJob = (j) => go(R.jobDetail + '?jobId=' + j.jobId)

function onBack() {
  if (storeId.value && !landingStore) {
    storeId.value = 0
    store.value = {}
    loadList()
    return
  }
  back()
}

async function unfollow(row) {
  syncAccountScope()
  if (busyId.value) return
  const scope = captureAccountScope()
  if (!(await confirm('取消关注', `不再接收「${row.storeName}」的新岗位通知？`))) return
  if (!isAccountScopeCurrent(scope) || busyId.value) return
  busyId.value = row.storeId
  try {
    const res = await apiFollowStore(row.storeId, false)
    if (!isAccountScopeCurrent(scope)) return
    ++seq
    loading.value = false
    rows.value = rows.value.filter(x => x.storeId !== row.storeId)
    toast((res.data && res.data.message) || '已取消关注')
  } catch (e) {
    if (isAccountScopeCurrent(scope)) toast(errText(e, '操作失败，请重试'))
  } finally {
    if (isAccountScopeCurrent(scope)) busyId.value = 0
  }
}

async function toggleFollow() {
  syncAccountScope()
  if (busyId.value || !storeId.value) return
  if (!experience.account?.id) return go(R.login)
  const scope = captureAccountScope(), targetStore = storeId.value
  const next = !following.value
  if (!next && !(await confirm('取消关注', `不再接收「${store.value.storeName || '这家店'}」的新岗位通知？`))) return
  if (!isAccountScopeCurrent(scope) || targetStore !== storeId.value || busyId.value) return
  busyId.value = targetStore
  try {
    const res = await apiFollowStore(targetStore, next)
    if (!isAccountScopeCurrent(scope) || targetStore !== storeId.value) return
    ++seq
    loading.value = false
    following.value = res.data ? !!res.data.following : next
    toast((res.data && res.data.message) || (next ? '已关注' : '已取消关注'))
  } catch (e) {
    if (isAccountScopeCurrent(scope) && targetStore === storeId.value) toast(e && e.code === 401 ? '登录后才能关注门店' : errText(e, '操作失败，请重试'))
  } finally {
    if (isAccountScopeCurrent(scope)) busyId.value = 0
  }
}
</script>

<style scoped lang="scss">
@import '../../styles/look.scss';
.follows { font-size: 14px; line-height: 1.6; }
.note { display: flex; align-items: flex-start; gap: 6px; padding: 10px 12px; border-radius: 10px; background: #FBF4E8; font-size: 12px; line-height: 1.6; color: var(--k-ink); }
.state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 16px; text-align: center; }
.state__title { font-family: var(--k-display-font); font-size: 16px; font-weight: 700; color: var(--k-ink); }
.store-row { display: flex; align-items: center; gap: 12px; margin-top: 10px; padding: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.store-row__cover { width: 56px; height: 56px; border-radius: 10px; flex: 0 0 auto; }
.store-row__cover--empty { display: flex; align-items: center; justify-content: center; background: var(--k-green-soft); }
.store-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.store-row__name { font-family: var(--k-display-font); font-size: 16px; font-weight: 700; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.store-row__jobs { font-size: 12px; color: var(--k-muted); }
.store-row__jobs.is-open { color: var(--k-green); }
/* 取消关注外层：不被挤窄；用 flex 免得行高把按钮撑偏 */
.row-action { flex: 0 0 auto; display: flex; }
.tabs { padding: 0 8px; }
/* 顶部下拉（10-18）：左边暖棕描边胶囊「我的收藏 ▾」，点开一张白色小菜单，选中的打勾；下面是这一类的页签 */
.modebar { position: relative; z-index: 20; background: var(--k-bg); }
.mode { display: flex; align-items: center; min-height: 44px; padding: 0 16px; }
.mode__pill { display: flex; align-items: center; gap: 4px; height: 32px; padding: 0 12px 0 14px; border-radius: 16px; border: 1px solid var(--k-red); background: var(--k-paper); color: var(--k-red-deep, #8A5E36); font-size: 15px; font-weight: 700; }
.mode-menu { position: absolute; left: 16px; top: 44px; width: 160px; padding: 4px 0; border-radius: 14px; background: var(--k-paper); box-shadow: var(--k-sh3, 0 8px 24px rgba(58, 50, 43, .16)); }
.mode-menu__item { display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 14px; font-size: 15px; color: var(--k-ink); }
.mode-menu__item.on { color: var(--k-red); font-weight: 600; }
.mode-mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 19; }
.fav-row__cancel { align-self: flex-start; min-width: 88px; min-height: 32px; margin: 5px 0 0; padding: 0 11px; font-size: 12px; line-height: 32px; color: #94683F; background: #F8F1E7; border-radius: 16px; }
.fav-row__cancel::after { border: 1px solid #E7D8C7; border-radius: 32px; }
.fav-row__cancel[disabled] { color: #A59688; background: #F5F1EC; }
.fav-row__status { flex: 0 0 auto; font-size: 12px; color: var(--k-green); }
.fav-row__status.off { color: var(--k-muted); }
/* 收藏与关注的卡：白卡圆角 16、柔和阴影（不再描边） */
.store-row { border: 0; border-radius: 16px; box-shadow: var(--k-sh1); }
.user-row__avatar { width: 48px; height: 48px; border-radius: 50%; flex: 0 0 auto; background: var(--k-paper2); }
.user-row__name-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.footnote { display: block; margin-top: 14px; text-align: center; }
.store-head { display: flex; align-items: center; gap: 12px; padding: 14px 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.store-head__cover { width: 64px; height: 64px; border-radius: 12px; flex: 0 0 auto; }
.store-head__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.store-head__name { font-family: var(--k-display-font); font-size: 18px; font-weight: 700; color: var(--k-ink); overflow-wrap: anywhere; }
.hint { display: block; margin-top: 8px; font-size: 12px; color: var(--k-muted); }
.intro { display: block; margin-top: 10px; font-size: 13px; line-height: 1.7; color: var(--k-ink); white-space: pre-line; }
.section { display: flex; align-items: baseline; justify-content: space-between; margin: 18px 0 4px; }
.section__title { font-family: var(--k-display-font); font-size: 16px; font-weight: 700; color: var(--k-ink); }
.job-row { display: flex; align-items: center; gap: 10px; margin-top: 8px; padding: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.job-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.job-row__head { display: flex; align-items: center; gap: 6px; min-width: 0; }
.job-row__title { flex: 1; min-width: 0; font-size: 15px; font-weight: 700; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.job-row__price { display: flex; flex-direction: column; align-items: flex-end; flex: 0 0 auto; }
.job-row__num { color: var(--k-red); font-family: var(--k-sans); font-size: 16px; font-weight: 700; }
/* ---------------------------------------------------------------------------------------------------------------
   2026-10-19 一比一还原（全局视觉语言）：暖米渐变页面底、白卡圆角 20 + 柔阴影 + 细边、标题用标题字体（700 / 900）、主按钮暖棕渐变。只改样式
   --------------------------------------------------------------------------------------------------------------- */
.follows { --k-bg: #{$look-bg-top}; background: $look-bg; }
.store-row, .store-head, .job-row { border: $look-hairline; border-radius: 20px; background: #fff; box-shadow: $look-shadow; }
.store-row__cover, .store-head__cover { border-radius: 14px; }
.mode__pill { border-color: $look-chip-on-line; background: $look-chip-on-bg; color: $look-chip-on-ink; font-family: var(--k-display-font); font-weight: 700; }
.mode-menu { border-radius: 18px; }
.note { border-radius: 14px; background: #FBF2E6; }
.job-row__title { font-family: var(--k-display-font); font-weight: 700; }
.job-row__num { font-family: var(--k-display-font); font-weight: 900; color: $look-brown; }

.follows { --k-bg:#FCF9F5; background:linear-gradient(180deg,#FCF9F5,#F8F7F4); }
.modebar { padding-top:12px; }.mode__pill { padding:10px 16px; background:#F6EBD9; border:0; }
.store-row,.store-head,.job-row { border:1px solid rgba(160,120,80,.07); border-radius:18px; box-shadow:0 4px 16px rgba(120,84,48,.045); }
.store-row { padding:14px 12px; gap:12px; }.store-row__cover { width:76px; height:76px; border-radius:12px; }.store-row__name { font-size:16px; line-height:1.45; }.store-row__jobs { font-size:13px; line-height:1.55; }
.state { padding:50px 20px; }.state__title { font-size:17px; }.note { background:#F4EFE6; font-size:13px; line-height:1.6; }
.fav-row { align-items:flex-start; }
.fav-row .store-row__name { white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow-wrap:anywhere; }
.fav-row .store-row__jobs { overflow-wrap:anywhere; }
.fav-row__status { align-self:flex-start; }
@media (max-width:350px) { .fav-row .store-row__cover { width:64px; height:64px; } }

</style>
