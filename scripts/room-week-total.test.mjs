import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileTemplate } from '@vue/compiler-sfc'
import { roomWeekTotalFen, weekTotalFen, weekTotalOf, roomTypeTotalPayload, weekTotalPricePreview, weekPriceText } from '../pages/staff/stay-submission.js'

const adminSource = readFileSync(new URL('../../RuoYi-Vue3/src/utils/roomWeekPrice.js', import.meta.url), 'utf8')
const admin = await import('data:text/javascript;base64,' + Buffer.from(adminSource).toString('base64'))
const fields = { typeName: '六人间床位', roomKind: 'shared', capacity: 6, stock: 3, status: '0' }
const unevenRoom = { roomTypeId: 12, basePriceFen: 1700, weekPriceFen: '1700,1700,1700,1700,1700,2200,2300' }

test('新旧房型回显七晚合计，两端口径一致', () => {
  for (const readTotal of [roomWeekTotalFen, admin.roomWeekTotalFen]) {
    assert.equal(readTotal(unevenRoom), 13000)
    assert.equal(readTotal({ basePriceFen: 1700 }), 11900)
    assert.equal(readTotal({ weekTotalFen: 10001 }), 10001)
    assert.equal(readTotal({ basePriceFen: 1700, weekPriceFen: '100,invalid' }), 11900)
    assert.equal(readTotal({}), null)
    assert.equal(readTotal({ basePriceFen: -10 }), null)
  }
  assert.equal(weekTotalOf(unevenRoom), '130')
  assert.equal(weekPriceText(unevenRoom), '7天总价 ¥130')
})

test('两端按分精确接收总价并校验边界，拒绝空白和无效金额', () => {
  for (const parseFen of [weekTotalFen, admin.roomWeekInputFen]) {
    assert.equal(parseFen('100.01'), 10001)
    assert.equal(parseFen(119), 11900)
    assert.equal(parseFen('7.00'), 700)
    assert.equal(parseFen('700000'), 70000000)
    for (const value of ['', undefined, null, '6.99', '700000.01', '-1', '1e3', '100.001', NaN, Infinity]) assert.throws(() => parseFen(value))
  }
})

test('小程序创建和改价只提交整数分总价，不混传旧价格字段', () => {
  const create = roomTypeTotalPayload({ ...fields, weekTotal: '100.01', prices: ['17'], price: '17' })
  assert.deepEqual(create, { ...fields, weekTotalFen: 10001 })
  const edit = roomTypeTotalPayload({ ...fields, roomTypeId: 12, weekTotal: '100.01', originalWeekTotalFen: 13000 })
  assert.equal(edit.weekTotalFen, 10001)
  assert.equal('basePriceFen' in edit, false)
  assert.equal('weekPriceFen' in edit, false)
})

test('小程序仅改名称库存保留旧周末差价，旧仅每晚价格同样不重写', () => {
  for (const room of [unevenRoom, { roomTypeId: 13, basePriceFen: 1700 }]) {
    const result = roomTypeTotalPayload({ ...fields, roomTypeId: room.roomTypeId, typeName: '更新名称', stock: 8, weekTotal: weekTotalOf(room), originalWeekTotalFen: roomWeekTotalFen(room) })
    assert.deepEqual(result, { ...fields, typeName: '更新名称', stock: 8 })
  }
})

test('后台同值保存不回写任何价格，新建及修改总价只发weekTotalFen', () => {
  const genericData = { typeName: '更新名称', stock: 8, basePriceFen: 1700, weekPriceFen: unevenRoom.weekPriceFen, weekTotalFen: 13000 }
  assert.deepEqual(admin.roomWeekPayload(genericData, unevenRoom, '130.00', true), { typeName: '更新名称', stock: 8 })
  assert.deepEqual(admin.roomWeekPayload(genericData, { basePriceFen: 1700 }, '119', true), { typeName: '更新名称', stock: 8 })
  assert.deepEqual(admin.roomWeekPayload(genericData, unevenRoom, '100.01', true), { typeName: '更新名称', stock: 8, weekTotalFen: 10001 })
  assert.deepEqual(admin.roomWeekPayload({}, {}, '100.01', false), { weekTotalFen: 10001 })
  assert.equal(genericData.basePriceFen, 1700, '转换不修改编辑原始记录')
})

test('用户七晚参考价保留自营零服务费、合作逐夜加价四舍五入', () => {
  assert.equal(weekTotalPricePreview('119', 'direct'), '用户7晚参考价 ¥119 · 自营不加价 · 免平台服务费')
  assert.equal(weekTotalPricePreview('119', 'partner'), '用户7晚参考价 ¥124.95 · 已含逐晚5%加价')
  // 1429分×5晚 + 1428分×2晚；每晚加71分，共加497分。
  assert.equal(weekTotalPricePreview('100.01', 'partner'), '用户7晚参考价 ¥104.98 · 已含逐晚5%加价')
  const old = { weekPriceFen: '110,110,110,110,110,110,110' }
  assert.equal(weekTotalPricePreview('7.7', 'partner', old), '用户7晚参考价 ¥8.12 · 已含逐晚5%加价')
  assert.equal(weekTotalPricePreview('', 'direct'), '填写7天总价后显示用户价')
})

test('后台及小程序真实模板可编译，保留房态单日编辑', () => {
  for (const file of ['../pages/staff/room-types.vue', '../../RuoYi-Vue3/src/views/kangaroo/ext/ExtCrud.vue', '../../RuoYi-Vue3/src/views/kangaroo/ext/roomtype/index.vue']) {
    const { descriptor, errors } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'))
    assert.deepEqual(errors, [])
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file, id: 'weekly-total' }).errors, [])
  }
})
