// One unfinished application per account on this device. Never store verification state.
const fields = { contactName: 32, city: 80, storeType: 30, storeName: 64, intro: 500 }
export const emptyMerchantForm = () => Object.fromEntries(Object.keys(fields).map(k => [k, '']))
const key = owner => {
  if (!owner || !/^\d+$/.test(String(owner))) throw new Error('请先登录后保存申请')
  return `kangaroo:merchant-application:v1:${owner}`
}
export function merchantDraftData(value) {
  return Object.fromEntries(Object.entries(fields).map(([k, max]) => [k, typeof value?.[k] === 'string' ? value[k].slice(0, max) : '']))
}
export function readMerchantDraft(owner) {
  const saved = uni.getStorageSync(key(owner))
  if (!saved || saved.version !== 1 || !saved.data || typeof saved.data !== 'object') return null
  return merchantDraftData(saved.data)
}
export function saveMerchantDraft(owner, form) {
  const data = merchantDraftData(form)
  if (!Object.values(data).some(v => v.trim())) { removeMerchantDraft(owner); return false }
  uni.setStorageSync(key(owner), { version: 1, data, updatedAt: Date.now() })
  return true
}
export function removeMerchantDraft(owner) { uni.removeStorageSync(key(owner)) }
