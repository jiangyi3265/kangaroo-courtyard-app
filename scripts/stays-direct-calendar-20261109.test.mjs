import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { MIN_NIGHTS, MAX_NIGHTS, nightsOf, addDays } from '../pages/stays/stays-range.js'
import { bookingPriceDisplay } from '../pages/stays/period-price.js'
const require = createRequire(import.meta.url)
const { parse, babelParse } = require('@vue/compiler-sfc')
const { ref, computed, reactive } = require('vue')
const source = parse(fs.readFileSync(new URL('../pages/stays/booking.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const body = babelParse(source, { sourceType: 'module' }).program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
const flush = () => new Promise(resolve => setImmediate(resolve))
function harness() {
  const calls = { calendars: [], quotes: [], back: 0, gone: [], toasts: [] }
  let onLoad
  const sandbox = {
    ref, computed, console, Date, Number, JSON, MIN_NIGHTS, MAX_NIGHTS, bookingPriceDisplay,
    stayBookingEnabled: ref(true), refreshFeatures: async () => ({stayBookingEnabled:true}), watchStayGate() {},
    onShow(fn) { calls.show = fn }, experience: { account: { id: 1 } },
    useScreen: (max, opts) => { onLoad = opts.onLoad; return ref(1) },
    stayState: reactive({ checkIn: '2026-11-15', checkOut: '2026-11-22', guests: 2 }),
    normalizeDates() {}, saveStayState() {}, nightsBetween: nightsOf, shiftDate: addDays, dayText: x => x, weekText: () => '',
    yuan: v => String(Number(v) / 100), toast: t => calls.toasts.push(t), errText: (e, fallback) => e.message || fallback,
    back: () => calls.back++, go: url => calls.gone.push(url), R: { stayPay: '/pages/stays/pay' },
    apiStayDetail: async () => ({ data: { stayId: 7, stayName: '自营小院', houseType: 'direct', operateMode: 'direct' } }),
    apiStayRoomTypes: async () => ({ data: [{ roomTypeId: 31, typeName: '双人间', bookable: true, capacity: 2, priceFromFen: 8800 }, { roomTypeId: 32, typeName: '早鸟房型', promo: true, bookable: true, capacity: 2, priceFromFen: 6000 }] }),
    apiStayCalendar: async (...args) => { calls.calendars.push(args); return { data: { month: args[1], days: [] } } },
    apiStayQuote: async params => { calls.quotes.push(params); return { data: { roomFen: 26400, bookable: true } } },
    apiStayRecommend: async () => ({ data: null })
  }
  vm.createContext(sandbox); vm.runInContext(body, sandbox)
  return { sandbox, calls, run: code => vm.runInContext(code, sandbox), open: async q => { onLoad(q); await flush(); await flush() } }
}

test('指定房型直接打开日历，重新报价保留日期人数，返回不再进入房型列表', async () => {
  const h = harness()
  await h.open({ stayId: '7', roomTypeId: '31', vlogId: '9' })
  assert.equal(h.run('s.value'), 2)
  assert.equal(h.run('selRoomId.value'), 31)
  assert.equal(h.run('entryError.value'), '')
  assert.deepEqual(h.calls.calendars, [[31, '2026-11', undefined]])
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls.quotes[0])), { roomTypeId: 31, checkIn: '2026-11-15', checkOut: '2026-11-22', guests: 2 })
  await h.run('next2()')
  assert.equal(h.calls.gone[0], '/pages/stays/pay?stayId=7&roomTypeId=31&checkIn=2026-11-15&checkOut=2026-11-22&guests=2&vlogId=9')
  h.run('onBack()'); assert.equal(h.calls.back, 1); assert.equal(h.run('s.value'), 2)
})

test('慢加载期间保持日历入口，房型请求失败可重试且不换房型', async () => {
  const h = harness()
  const api = h.sandbox.apiStayRoomTypes
  let fail
  h.sandbox.apiStayRoomTypes = () => new Promise((resolve, reject) => { fail = reject })
  await h.open({ stayId: '7', roomTypeId: '31' })
  assert.equal(h.run('s.value'), 2); assert.equal(h.run('entryLoading.value'), true)
  fail(new Error('offline')); await flush()
  assert.match(h.run('entryError.value'), /房型价格与余量加载失败/)
  assert.equal(h.calls.calendars.length, 0); assert.equal(h.calls.quotes.length, 0)
  h.sandbox.apiStayRoomTypes = api
  await h.run('init()'); await flush()
  assert.equal(h.run('entryError.value'), ''); assert.equal(h.calls.calendars[0][0], 31)
})

test('房型失效不替换成早鸟房型，不发报价或日历请求', async () => {
  const h = harness()
  await h.open({ stayId: '7', roomTypeId: '999', promoId: '4' })
  assert.equal(h.run('s.value'), 2)
  assert.equal(h.run('missingEntryRoom.value'), true)
  assert.match(h.run('entryError.value'), /所选房型已下架/)
  assert.equal(h.calls.calendars.length, 0); assert.equal(h.calls.quotes.length, 0)
})

test('早鸟只对匹配房型生效，普通房型不带早鸟参数', async () => {
  for (const [roomTypeId, expected] of [['32', 4], ['31', undefined]]) {
    const h = harness()
    await h.open({ stayId: '7', roomTypeId, promoId: '4' })
    assert.equal(h.calls.calendars[0][2], expected)
    assert.equal(h.calls.quotes[0].promoId, expected)
  }
})

test('原未选房型入口仍可选房，点击后直接到日历，可返回改选', async () => {
  const h = harness()
  await h.open({ stayId: '7' })
  assert.equal(h.run('s.value'), 1); assert.equal(h.calls.calendars.length, 0)
  h.run('selectRoom(allRoomTypes.value[0])'); await flush()
  assert.equal(h.run('s.value'), 2); assert.equal(h.calls.calendars[0][0], 31)
  h.run('onBack()'); assert.equal(h.run('s.value'), 1); assert.equal(h.calls.back, 0)
})

test('按所选入住晚数的总价排序，未知价格在两个方向均排在末尾', async () => {
  const h = harness()
  h.sandbox.stayState.checkOut = '2026-11-30'
  const prices = [[90,210],[95,180],[80,null],[100,200],[105,240],[110,230]]
  h.sandbox.apiStayRoomTypes = async () => ({data:prices.map(([week,selected],i) => ({
    roomTypeId:i+1,typeName:'房型'+i,capacity:2,bookable:true,
    displayPayFen:selected == null ? null : selected * 100,periodPrices:[{nights:7,payFen:week*100}]
  }))})
  await h.open({stayId:7})
  for (const [choice,expected] of [[1,[2,4,1,6,5,3]],[2,[5,6,1,4,2,3]]]) {
    h.sandbox.sheet=async()=>choice
    await h.run('filterRooms(3)')
    assert.deepEqual([...h.run('roomTypes.value.map(r=>r.roomTypeId)')],expected)
  }
})

test('最晚可入住日后仍能选合法离店日，最后一晚有余量才可进确认页', async () => {
  const h=harness()
  const days=Array.from({length:32},(_,i)=>({date:addDays('2026-11-16',i),day:i+1,status:i?'beyond':'available',priceFen:1200}))
  h.sandbox.apiStayCalendar=async()=>({data:{days}})
  await h.open({stayId:7,roomTypeId:31})
  const cell=date=>h.run(`calendar.value.find(c=>c.ymd==='${date}')`)
  h.run("tapDay(calendar.value.find(c=>c.ymd==='2026-11-17'))")
  assert.equal(h.sandbox.stayState.checkIn,'2026-11-15')
  h.run("tapDay(calendar.value.find(c=>c.ymd==='2026-11-16'))"); await flush()
  assert.equal(cell(addDays('2026-11-16',6)).outside,true)
  assert.equal(cell(addDays('2026-11-16',30)).outside,false)
  assert.equal(cell(addDays('2026-11-16',31)).outside,true)
  assert.equal(cell('2026-11-30').outside,false)
  h.sandbox.apiStayQuote=async()=>({data:{bookable:false,reason:'期间满房',payFen:0}})
  h.run("tapDay(calendar.value.find(c=>c.ymd==='2026-11-30'))"); await flush()
  assert.equal(h.sandbox.stayState.checkOut,'2026-11-30')
  assert.equal(h.run('picking.value'),'in')
  await h.run('next2()')
  assert.equal(h.calls.gone.length,0)
  assert.match(h.calls.toasts.at(-1),/满房/)
  h.sandbox.apiStayQuote=async()=>({data:{bookable:true,payFen:16800}})
  await h.run('requote()'); await h.run('next2()')
  assert.match(h.calls.gone[0],/checkIn=2026-11-16&checkOut=2026-11-30/)
})

test('房态日历少于7晚不改变选择，报价和下一步也拦截短住', async () => {
  const h = harness()
  await h.open({ stayId: '7', roomTypeId: '31' })
  h.run("tapDay({ ymd: '2026-11-16', status: 'available' })")
  await flush()
  assert.equal(h.sandbox.stayState.checkOut, '2026-11-23')
  for (let n = 1; n < 7; n++) {
    h.run(`tapDay({ ymd: '${addDays('2026-11-16', n)}', status: 'available' })`)
    assert.equal(h.sandbox.stayState.checkOut, '2026-11-23')
    assert.match(h.calls.toasts.at(-1), /一周起订/)
  }
  h.run("tapDay({ ymd: '2026-11-23', status: 'available' })"); await flush()
  assert.equal(h.run('picking.value'), 'in')
  const quoted = h.calls.quotes.length
  h.sandbox.stayState.checkOut = '2026-11-18'
  await h.run('requote()'); await h.run('next2()'); h.run('toPay()')
  assert.equal(h.calls.quotes.length, quoted)
  assert.equal(h.calls.gone.length, 0)
  assert.match(h.run('quoteError.value'), /一周起订/)
})

test('未开收款时没有足额间夜不进填单；归来刷新开通状态和券余额', async () => {
  const h = harness()
  h.sandbox.stayState.guests = 1
  let enabled = false, vouchers = []
  h.sandbox.apiStayQuote = async () => ({ data: {
    onlinePaymentAvailable: enabled, bookable: true, roomFen: 49000, units: 1, guests: 1,
    nightly: Array.from({ length: 7 }, () => ({ priceFen: 7000 })), memberVouchers: vouchers
  } })
  await h.open({ stayId: '7', roomTypeId: '31' })
  assert.equal(h.run('collectionUnavailable.value'), true)
  await h.run('next2()')
  assert.equal(h.calls.gone.length, 0)
  vouchers = [{ walletId: 1 }]
  await h.run('requote()')
  assert.equal(h.run('collectionUnavailable.value'), true)
  vouchers = Array.from({ length: 7 }, (_, walletId) => ({ walletId }))
  h.calls.show()
  await flush()
  assert.equal(h.run('canTryFreeNights.value'), true)
  await h.run('next2()')
  assert.equal(h.calls.gone.length, 1)
  enabled = true
  vouchers = []
  await h.run('requote()')
  assert.equal(h.run('collectionUnavailable.value'), false)
})