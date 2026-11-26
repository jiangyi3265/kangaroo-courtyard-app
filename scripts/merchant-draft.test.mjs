import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyMerchantForm, readMerchantDraft, saveMerchantDraft, removeMerchantDraft } from '../pages/profile/merchant-draft.js'

function setup() {
  const data = new Map()
  globalThis.uni = {
    getStorageSync: key => structuredClone(data.get(key)),
    setStorageSync: (key, value) => data.set(key, structuredClone(value)),
    removeStorageSync: key => data.delete(key)
  }
  return data
}
test('unfinished applications survive reopening and remain isolated by account', () => {
  setup()
  const form = { ...emptyMerchantForm(), contactName: '小院店长', city: '平潭', intro: '正在填写\n尚未完成' }
  saveMerchantDraft(7, form)
  form.city = '大理'
  assert.equal(readMerchantDraft(7).city, '平潭')
  assert.equal(readMerchantDraft(8), null)
  saveMerchantDraft(8, { ...emptyMerchantForm(), storeName: '另一个人的店' })
  removeMerchantDraft(7)
  assert.equal(readMerchantDraft(7), null)
  assert.equal(readMerchantDraft(8).storeName, '另一个人的店')
})
test('only form fields persist; a draft cannot assert phone verification or approval', () => {
  setup()
  saveMerchantDraft(7, { phone: '13800000000', storeName: 'a'.repeat(90), phoneVerified: true, approved: true, token: 'not-a-real-token' })
  assert.deepEqual(Object.keys(readMerchantDraft(7)), Object.keys(emptyMerchantForm()))
  assert.equal(readMerchantDraft(7).storeName.length, 64)
  assert.equal(readMerchantDraft(7).phoneVerified, undefined)
  assert.throws(() => saveMerchantDraft(null, {}), /先登录/)
})
test('reopening a previous draft retains the application fields and discards the obsolete phone entry', () => {
  const storage = setup()
  storage.set('kangaroo:merchant-application:v1:7', {
    version: 1, data: { storeName: '旧草稿中的小院', phone: '13800000000', phoneVerified: true }
  })
  const draft = readMerchantDraft(7)
  assert.equal(draft.storeName, '旧草稿中的小院')
  assert.equal(draft.phone, undefined)
  assert.equal(draft.phoneVerified, undefined)
  saveMerchantDraft(7, draft)
  assert.equal(storage.get('kangaroo:merchant-application:v1:7').data.phone, undefined)
})
test('clearing and corrupt data do not restore stale values; failed saves propagate', () => {
  const data = setup()
  saveMerchantDraft(7, { intro: '保留旧稿' })
  const key = [...data.keys()][0]
  uni.setStorageSync = () => { throw new Error('disk full') }
  assert.throws(() => saveMerchantDraft(7, { intro: '新内容' }), /disk full/)
  assert.equal(readMerchantDraft(7).intro, '保留旧稿')
  data.set(key, 'corrupt')
  assert.equal(readMerchantDraft(7), null)
  assert.equal(saveMerchantDraft(7, emptyMerchantForm()), false)
  assert.equal(data.has(key), false)
})
