// 岗位分享码：打开员工分享的链接时按岗位记下分享码并回传一次访问，报名成功后把分享码归到这条报名上。
// 只用于员工端"分享追踪"的统计，不影响报名本身；回传失败静默忽略。
import { apiShareVisit, apiShareBind } from './api.js'

const key = (jobId) => 'kangaroo:share:' + jobId
const CODE = /^[A-Z0-9]{8}$/

export function noteShareVisit(jobId, code) {
  if (!jobId || !CODE.test(code || '')) return
  try { uni.setStorageSync(key(jobId), { code, at: Date.now() }) } catch (e) { /* 存不下只影响归因 */ }
  apiShareVisit(code).catch(() => {})
}

export function bindShareAfterApply(jobId, appId) {
  if (!jobId || !appId) return
  let v = null
  try { v = uni.getStorageSync(key(jobId)) } catch (e) { v = null }
  // 7 天内打开过的分享链接才算报名来源
  if (!v || !CODE.test(v.code || '') || Date.now() - (v.at || 0) > 7 * 86400000) return
  apiShareBind(appId, v.code).catch(() => {})
}
