import { shallowRef } from 'vue'
import { apiSubscribeAccept, apiSubscribePrepare } from './api.js'
import { currentStaffStore, experience, getSessionRevision, staffGrantKey } from './experience.js'
import { createVisitSubscriptions } from './subscription-core.js'
import { go } from './screen.js'

export const subscriptionState = shallowRef({ groups: [], remaining: 0 })
const surface = () => experience.account?.id + ':' + (experience.mode === 'staff' ? currentStaffStore.value?.roleCode || 'staff' : 'user')
export const subscriptionScope = () => {
  if (!experience.account || experience.account.preview) return ''
  const grant = experience.mode === 'staff' && currentStaffStore.value
  return JSON.stringify([surface(), getSessionRevision(), grant ? staffGrantKey(grant) : null])
}

function forCurrentSurface(response) {
  const data = response.data || {}
  if (experience.mode === 'staff' || !Array.isArray(data.rows)) return data
  return { ...data, rows: data.rows.filter(row => !(row.bizKey?.startsWith('ops_') || row.bizKey === 'work_task')) }
}

export const visitSubscriptions = createVisitSubscriptions({
  scope: subscriptionScope, surface,
  prepare: async () => forCurrentSurface(await apiSubscribePrepare()),
  accept: async body => forCurrentSurface(await apiSubscribeAccept(body)),
  request: options => {
    // #ifdef MP-WEIXIN
    uni.requestSubscribeMessage(options)
    // #endif
    // #ifndef MP-WEIXIN
    options.fail({ message: '请在微信小程序内订阅消息' })
    // #endif
  },
  readCursor(key) {
    try { return uni.getStorageSync('kangaroo:subscription-cursor:' + key) } catch { return '' }
  },
  writeCursor(key, id) {
    try { uni.setStorageSync('kangaroo:subscription-cursor:' + key, id) } catch { /* 当前批次仍已记录 */ }
  },
  changed: state => { subscriptionState.value = state }
})

export function askOnVisit() {
  // #ifdef MP-WEIXIN
  visitSubscriptions.ask()
  // #endif
}

export function goFromWorkbench(url) {
  askOnVisit()
  return go(url)
}
