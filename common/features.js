import { computed, reactive } from 'vue'
import { API_BASE } from './config.js'

// Never restore an enabled switch from device storage. Unknown/network failure is closed.
export const featureState = reactive({ communityEnabled: false, wishEnabled: false, groupChatEnabled: false, privateChatEnabled: false, stayBookingEnabled: false, recruitmentEnabled: false, loaded: false })
export const recruitmentEnabled = computed(() => featureState.recruitmentEnabled)
export const stayBookingEnabled = computed(() => featureState.stayBookingEnabled)
export const communityEnabled = computed(() => featureState.communityEnabled)
export const wishEnabled = computed(() => featureState.wishEnabled)
export const groupChatEnabled = computed(() => featureState.groupChatEnabled)
export const privateChatEnabled = computed(() => featureState.privateChatEnabled)
let pending = null, fetchedAt = 0, timer = null
export function refreshFeatures(force = false) {
  if (pending) return pending
  if (!force && featureState.loaded && Date.now() - fetchedAt < 3000) return Promise.resolve(featureState)
  pending = new Promise(resolve => {
    const finish = data => {
      for (const key of ['communityEnabled','wishEnabled','groupChatEnabled','privateChatEnabled','stayBookingEnabled','recruitmentEnabled']) featureState[key] = data?.[key] === true
      featureState.loaded = true
      fetchedAt = Date.now()
      resolve(featureState)
    }
    try {
      uni.request({ url: API_BASE + '/app/features', method: 'GET', timeout: 8000,
        success: res => finish(res.statusCode === 200 && res.data?.code === 200 ? res.data?.data : null),
        fail: () => finish(false) })
    } catch { finish(false) }
  }).finally(() => { pending = null })
  return pending
}
export function startFeaturePolling() {
  refreshFeatures(true)
  if (!timer) timer = setInterval(() => refreshFeatures(true), 20000)
}
export function stopFeaturePolling() { if (timer) clearInterval(timer); timer = null }
export function wishPage(path) { return /^\/?pages\/wish\/(index|publish|detail)(?:\?|$)/.test(String(path || '')) }
export function closedSharePage(path) { return (!featureState.recruitmentEnabled && recruitmentPage(path)) || (!featureState.stayBookingEnabled && stayBookingPage(path)) || (!featureState.communityEnabled && communitySharePage(path)) || (!featureState.wishEnabled && wishPage(path)) }
export function communityPage(path) {
  return /^\/?pages\/community\/(index|publish|published|mine|user|link)(?:\?|$)/.test(String(path || ''))
}
export function communitySharePage(path) {
  return communityPage(path) || /^\/?pages\/community\/(activity|trip)(?:\?|$)/.test(String(path || ''))
}

export function stayBookingPage(path) { return /^\/?pages\/stays\/(list|detail|booking|pay|reviews|diary|past-activities)(?:\?|$)/.test(String(path || '')) }

export function recruitmentPage(path) { if (/^\/?pages\/staff\/online-jobs\?/.test(String(path || '')) && /[?&](?:jobId|appId)=[1-9][0-9]*|[?&]s=[234](?:&|$)/.test(path)) return false; return /^\/?pages\/(jobs\/(list|detail|filter|apply|reviews|team|companions)|profile\/(resume|opportunities|merchant)|staff\/(jobs|talents|online-jobs))(?:\?|$)/.test(String(path || '')) }
