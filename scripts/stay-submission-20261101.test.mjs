import test from 'node:test'
import assert from 'node:assert/strict'
import { staySubmissionMissing, roomTypePayload } from '../pages/staff/stay-submission.js'

test('提交前同时检查封面、可用房型与必填资质；过期不能算齐全，选填可留空', () => {
  const stay = { address: '测试路', cover: '', roomTypes: [{ status: '1' }], quals: [
    { title: '营业执照', required: true, uploaded: true, expired: true },
    { title: '消防证明', required: true, uploaded: false },
    { title: '特种行业', required: false, uploaded: false }
  ] }
  assert.deepEqual(staySubmissionMissing(stay), ['房源封面', '至少一个可用房型', '营业执照（已过期）', '消防证明'])
  stay.cover = '/profile/test.jpg'; stay.roomTypes[0].status = '0'
  stay.quals[0].expired = false; stay.quals[1].uploaded = true
  assert.deepEqual(staySubmissionMissing(stay), [])
})

test('房型输入边界与金额精度，非法数值不能发往服务端', () => {
  const good = { typeName: ' 大床房 ', roomKind: 'private', capacity: '2', stock: '1', price: '128.50', status: '0' }
  assert.deepEqual(roomTypePayload(good), { typeName: '大床房', roomKind: 'private', capacity: 2, stock: 1, basePriceFen: 12850, status: '0' })
  for (const values of [{ price: '0' }, { price: '1.005' }, { price: '1e3' }, { price: '100001' }, { capacity: '1.5' }, { capacity: '21' }, { stock: '0' }, { stock: '1000' }, { typeName: ' ' }, { roomKind: 'other' }]) {
    assert.throws(() => roomTypePayload({ ...good, ...values }))
  }
  assert.equal(roomTypePayload({ ...good, roomKind: 'shared', price: '1.01' }).basePriceFen, 101)
})
