import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { periodTotalFen, periodTotalOf, roomTypeTotalPayload } from '../pages/staff/stay-submission.js'

const adminSource = readFileSync(new URL('../../RuoYi-Vue3/src/utils/roomWeekPrice.js', import.meta.url), 'utf8')
const admin = await import('data:text/javascript;base64,' + Buffer.from(adminSource).toString('base64'))
const base = { roomTypeId: 1, typeName: '床位', roomKind: 'shared', capacity: 6, stock: 3, status: '0', weekTotal: '130', originalWeekTotalFen: 13000 }
const noPriceBase = { typeName: '床位', roomKind: 'shared', capacity: 6, stock: 3, status: '0' }

test('两端周期总价保留精确到分的输入，并校验各周期上下限', () => {
  for (const parse of [periodTotalFen, admin.roomPeriodInputFen]) for (const nights of [15, 30]) {
    assert.equal(parse('850.07', nights), 85007)
    assert.equal(parse(String(nights), nights), nights * 100)
    assert.equal(parse(String(nights * 100000), nights), nights * 10000000)
    for (const blank of ['', '  ', undefined, null]) assert.equal(parse(blank, nights), null)
    for (const invalid of ['0', '-1', '1e3', '100.001', '12元', true, NaN, Infinity, String(nights - 0.01), String(nights * 100000 + 0.01)]) assert.throws(() => parse(invalid, nights))
  }
  assert.equal(periodTotalOf(null), '')
  assert.equal(periodTotalOf(85007), '850.07')
})

test('小程序新建、改价和清空分别传新金额及明确null，不混入逐晚价', () => {
  const create = roomTypeTotalPayload({ ...base, roomTypeId: 0, halfMonthTotal: '850.07', monthTotal: '1600.08' })
  assert.deepEqual(create, { ...noPriceBase, weekTotalFen: 13000, halfMonthTotalFen: 85007, monthTotalFen: 160008 })
  const clear = roomTypeTotalPayload({ ...base, halfMonthTotal: '', monthTotal: '1600.08', originalPeriodPrices: { halfMonthTotalFen: 85007, monthTotalFen: 160008 } })
  assert.deepEqual(clear, { ...noPriceBase, halfMonthTotalFen: null })
  const edit = roomTypeTotalPayload({ ...base, halfMonthTotal: '825.10', monthTotal: '', originalPeriodPrices: { halfMonthTotalFen: 85007, monthTotalFen: null } })
  assert.deepEqual(edit, { ...noPriceBase, halfMonthTotalFen: 82510 })
})

test('小程序只改名称库存不会回写或抹掉周期价格，错误标明具体输入字段', () => {
  assert.deepEqual(roomTypeTotalPayload({ ...base, halfMonthTotal: '850.07', monthTotal: '', originalPeriodPrices: { halfMonthTotalFen: 85007 } }), noPriceBase)
  assert.deepEqual(roomTypeTotalPayload(base), noPriceBase, '老表单未带新字段时不改变周期价')
  assert.throws(() => roomTypeTotalPayload({ ...base, halfMonthTotal: '0' }), error => error.field === 'halfMonthTotal')
  assert.throws(() => roomTypeTotalPayload({ ...base, monthTotal: '0' }), error => error.field === 'monthTotal')
})

test('后台创建、改价、清空和同值编辑不损伤其他价格字段', () => {
  assert.deepEqual(admin.roomPeriodPayload({ typeName: '房间' }, {}, { halfMonthTotalFen: '850.07', monthTotalFen: '1600.08' }, false), { typeName: '房间', halfMonthTotalFen: 85007, monthTotalFen: 160008 })
  const previous = { halfMonthTotalFen: 85007, monthTotalFen: 160008 }
  const generic = { ...previous, typeName: '改名', weekPriceFen: '1700,1700,1700,1700,1700,2200,2300' }
  const unchanged = admin.roomPeriodPayload(generic, previous, { halfMonthTotalFen: 850.07, monthTotalFen: 1600.08 }, true)
  assert.deepEqual(unchanged, { typeName: '改名', weekPriceFen: generic.weekPriceFen })
  const cleared = admin.roomPeriodPayload(generic, previous, { halfMonthTotalFen: '', monthTotalFen: undefined }, true)
  assert.deepEqual(cleared, { typeName: '改名', weekPriceFen: generic.weekPriceFen, halfMonthTotalFen: null, monthTotalFen: null })
  assert.deepEqual(admin.roomPeriodPayload({}, {}, {}, true), {}, '旧服务器未返回新字段时不发送空值')
  assert.equal(generic.halfMonthTotalFen, 85007)
})
