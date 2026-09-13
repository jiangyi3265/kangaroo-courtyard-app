import { reactive, computed } from 'vue'
import R from './routes.js'

// This project currently has no authentication API. A backend adapter must supply
// the authenticated account and its grants; never infer grants from a UI choice,
// phone number, query string, or local storage.
export const experience = reactive({ account: null, mode: 'user', cities: [], messages: [] })
const key = (name) => `kangaroo:${experience.account?.id || 'guest'}:${name}`
const read = (name, fallback) => {
  try { return uni.getStorageSync(key(name)) || fallback } catch { return fallback }
}
export function loadPreferences() {
  const saved = read('cities', [])
  experience.cities = Array.isArray(saved) ? saved.filter(c => typeof c === 'string') : []
}
export function savePreferences(cities) {
  uni.setStorageSync(key('cities'), [...cities])
  experience.cities = [...cities]
}
export const hasStaffAccess = computed(() => !!experience.account?.staffGrants?.some(g => g.active === true))
export function acceptAuthenticatedAccount(account) {
  if (!account?.id) throw new Error('登录信息不完整，请重新登录')
  experience.account = account
  experience.messages = []
  experience.mode = hasStaffAccess.value ? 'staff' : 'user'
  loadPreferences()
  return hasStaffAccess.value ? R.staff : R.home
}
// Explicit local preview only. Replace with the result of real WeChat login.
export function enterUserPreview() {
  const guestCities = [...experience.cities]
  const route = acceptAuthenticatedAccount({ id: 'local-preview', preview: true, staffGrants: [] })
  if (!experience.cities.length && guestCities.length) savePreferences(guestCities)
  return route
}
export function logout() {
  experience.account = null
  experience.mode = 'user'
  experience.messages = []
  loadPreferences()
}
export function switchMode(mode) {
  if (mode === 'staff' && !hasStaffAccess.value) return R.identity
  experience.mode = mode
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
export const unreadCount = computed(() => visibleMessages.value.filter(m => !m.read).length)
export function markMessageRead(id) {
  const message = visibleMessages.value.find(m => m.id === id)
  if (message) message.read = true
}
