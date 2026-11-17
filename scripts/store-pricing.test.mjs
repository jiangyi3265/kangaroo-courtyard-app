import test from 'node:test'
import assert from 'node:assert/strict'
import { settlementPricePreview, roomTypePayload } from '../pages/staff/stay-submission.js'

test('自营与合作显示不同用户价，所有类型提交的后台定价保持不变', () => {
  assert.equal(settlementPricePreview('17', 'direct'), '用户价 ¥17 · 自营不加价 · 免平台服务费')
  for (const type of ['partner', 'franchise', 'managed']) {
    assert.equal(settlementPricePreview('17', type), '用户价 ¥17.85 · 已含5%加价')
    assert.equal(settlementPricePreview('1.10', type), '用户价 ¥1.16 · 已含5%加价')
  }
  assert.equal(roomTypePayload({typeName:'测试',roomKind:'private',capacity:1,stock:1,price:'17'}).basePriceFen,1700)
})

test('类型未载入和输入金额无效时不显示错误预估', () => {
  for (const type of [null, undefined, '', 'unknown']) assert.equal(settlementPricePreview('17', type),'读取门店运营类型后显示用户价')
  for (const price of ['0','-17','17.555','invalid']) assert.equal(settlementPricePreview(price,'partner'),'填写每晚价格后显示用户价')
})
