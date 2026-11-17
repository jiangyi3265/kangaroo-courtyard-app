// Decimal strings preserve all signed-Long IDs in native runtimes without BigInt.
const MAX_ID = '9223372036854775807'
export function activityId(value) {
  const id = String(value == null ? '' : value)
  if (!/^[1-9][0-9]{0,18}$/.test(id) || (id.length === 19 && id > MAX_ID)) throw new Error('活动码编号无效')
  return id
}
function decimalFrom36(value) {
  if (!/^[1-9a-z][0-9a-z]{0,12}$/.test(value)) throw new Error('活动码编号无效')
  let out = '0'
  for (const c of value) {
    let carry = parseInt(c, 36), next = ''
    for (let i = out.length - 1; i >= 0; i--) { const n = Number(out[i]) * 36 + carry; next = n % 10 + next; carry = Math.floor(n / 10) }
    out = (carry ? String(carry) : '') + next
    if (out.length > 19) throw new Error('活动码编号无效')
  }
  return activityId(out)
}
export function parseActivityScene(raw) {
  if (typeof raw !== 'string' || raw.length > 96) throw new Error('活动码参数无效')
  let scene
  try { scene = decodeURIComponent(raw) } catch { throw new Error('活动码参数无效') }
  if (scene.length > 32) throw new Error('活动码参数无效')
  const m = /^(a|c)_([1-9a-z][0-9a-z]{0,12})(?:_([0-9a-f]{12}|[0-9a-f]{16}))?$/.exec(scene)
  if (!m || (m[1] === 'c') !== !!m[3]) throw new Error('活动码参数无效')
  return { id: decimalFrom36(m[2]), checkin: m[3] || '', scene, channel: m[1] === 'a' ? 'group' : 'official' }
}
export function activityLanding(q = {}) {
  if (Object.prototype.hasOwnProperty.call(q, 'scene')) {
    if (q.id || q.checkin || q.signupId) throw new Error('活动码参数冲突')
    return parseActivityScene(q.scene)
  }
  if (!q.id) return null
  const id = activityId(q.id), checkin = q.checkin || ''
  if (checkin && !/^(?:[0-9a-f]{12}|[0-9a-f]{16})$/.test(checkin)) throw new Error('签到码参数无效')
  return { id, checkin, scene: '', channel: q.channel || q.from || 'other' }
}
// Login may return only to this one validated page; never accept a general URL.
export function activityReturnPath(raw) {
  if (!raw) return ''
  const q = parseActivityScene(raw)
  return '/pages/community/activity?scene=' + encodeURIComponent(q.scene)
}
export function activityLoginQuery(landing) {
  if (landing.scene) return '?activityScene=' + encodeURIComponent(parseActivityScene(landing.scene).scene)
  const q = activityLanding({ id: landing.id, checkin: landing.checkin })
  return '?activityId=' + q.id + '&activityCheckin=' + encodeURIComponent(q.checkin)
}
export function loginActivityReturn(q = {}) {
  if (q.activityScene && (q.activityId || q.activityCheckin)) throw new Error('活动码参数冲突')
  if (q.activityScene) return activityReturnPath(q.activityScene)
  if (!q.activityId) return ''
  const target = activityLanding({ id: q.activityId, checkin: q.activityCheckin })
  return '/pages/community/activity?id=' + target.id + (target.checkin ? '&checkin=' + target.checkin : '')
}
export function codeMessage(info) {
  if (info?.state === 'mock') return '本地联调模式：未调用微信，不提供可扫码小程序码'
  if (info?.state === 'ready' && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(info.image || '')) return info.message || '微信小程序码'
  return info?.message || '微信小程序码暂时不可用'
}
export async function previewActivityCode(info, key) {
  if (info?.state !== 'ready' || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(info.image || '')) throw new Error(codeMessage(info))
  const uri = info.image
  // #ifdef MP-WEIXIN
  const file = `${wx.env.USER_DATA_PATH}/activity-code-${activityId(key)}.png`
  await new Promise((resolve, reject) => uni.getFileSystemManager().writeFile({ filePath: file, data: uri.split(',')[1], encoding: 'base64', success: resolve, fail: () => reject(new Error('小程序码文件保存失败，请重试')) }))
  return new Promise((resolve, reject) => uni.previewImage({ urls: [file], success: resolve, fail: () => reject(new Error('小程序码打开失败，请重试')) }))
  // #endif
  // #ifndef MP-WEIXIN
  return new Promise((resolve, reject) => uni.previewImage({ urls: [uri], success: resolve, fail: () => reject(new Error('小程序码打开失败，请重试')) }))
  // #endif
}
