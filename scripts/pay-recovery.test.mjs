import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ref, computed, nextTick, watch } from 'vue'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { stayPayEntry } from '../pages/stays/stays-pay-entry.js'

// Execute the production functions, replacing only network, native APIs and timers.
// No request is sent to a payment provider and no requestPayment call reaches a device.
const flowSource = readFileSync(new URL('../common/pay-flow.js', import.meta.url), 'utf8')
const pageSource = readFileSync(new URL('../pages/stays/pay.vue', import.meta.url), 'utf8')
const { descriptor } = parse(pageSource)
const yuan = fen => (Number(fen || 0) / 100).toFixed(2)
const pendingOrder = () => ({
  orderNo: 'STAY-1', payNo: 'PAY-1', status: 'pending_payment', payFen: 12800,
  serverTime: new Date().toISOString(), expireTime: new Date(Date.now() + 900000).toISOString(),
  stay: { stayName: '测试小院' }
})
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

function loadFlow(overrides = {}, platform = 'MP-WEIXIN') {
  const calls = { native: 0, prepay: 0, query: 0, sleep: 0, confirm: 0 }
  const deps = {
    apiPayConfig: async () => ({ data: { mode: 'mock' } }),
    apiPayPrepay: async () => { calls.prepay++; return { data: { channel: 'wechat', params: { package: 'prepay_id=fixture' } } } },
    apiPayStatus: async () => { calls.query++; return { data: { status: 'paid', channel: 'wechat' } } },
    apiPayMockConfirm: async () => { calls.confirm++ },
    modal: async () => ({ confirm: true }), yuan,
    sleep: async () => { calls.sleep++ },
    uni: { requestPayment: options => { calls.native++; options.success() } },
    ...overrides
  }
  const source = flowSource
    .replace(/\/\/ #ifndef MP-WEIXIN\r?\n([\s\S]*?)\/\/ #endif/g, (_, body) => platform === 'MP-WEIXIN' ? '' : body)
    .replace(/^import .*\r?\n/gm, '').replace(/export /g, '')
  return { ...new Function(...Object.keys(deps), `${source}; return { payFlow, channelLabel }`)(...Object.values(deps)), calls }
}

function loadPage(overrides = {}) {
  const calls = { show: [], unmount: [], toasts: [], pay: 0, create: 0, query: 0, detail: 0, back: 0 }
  const deps = {
    ref, computed, nextTick, watchStayGate: watch, stayPayEntry,
    stayBookingEnabled: ref(true), groupChatEnabled: ref(true),
    refreshFeatures: async () => ({ stayBookingEnabled: true }),
    todayCn: () => '2026-11-06', stayState: {}, saveStayState: () => {},
    onShow: fn => calls.show.push(fn), onUnmounted: fn => calls.unmount.push(fn),
    useScreen: (_count, extra) => { calls.load = extra.onLoad; return ref(1) },
    absUrl: value => value, go: () => {}, back: () => { calls.back++ }, toast: message => calls.toasts.push(message),
    apiStayQuote: async () => ({ data: { stay: {}, policy: {}, agreement: {}, bookable: true, payFen: 12800 } }),
    apiStayCreateOrder: async () => { calls.create++; return { data: { orderNo: 'STAY-1', payNo: 'PAY-1' } } },
    apiStayOrder: async () => { calls.detail++; return { data: pendingOrder() } },
    apiStayCancelOrder: async () => {},
    apiPayConfig: async () => ({ data: { mode: 'wechat' } }),
    apiPayStatus: async () => { calls.query++; return { data: { status: 'pending', channel: 'wechat' } } },
    ensureSession: async () => {}, experience: { account: { id: 1 } },
    errText: (error, fallback) => error?.message || fallback,
    modal: async () => ({ confirm: true }), prompt: async () => null, sheet: async () => -1, copy: () => {}, yuan,
    serverTs: value => Date.parse(value) || 0, pad2: value => String(value).padStart(2, '0'),
    payFlow: async () => { calls.pay++; return { status: 'unknown' } },
    labelOf: mode => mode === 'wechat' ? '微信支付' : mode === 'mock' ? '模拟支付（联调，不扣款）' : '支付方式确认中',
    apiStayEnrollActivity: async () => ({}), gated: fn => fn(),
    dayText: value => value, weekText: () => '', nightsBetween: () => 1,
    R: { stayOrder: '/pages/stays/order', login: '/pages/auth/login' },
    uni: { getStorageSync: () => ({}), setStorageSync: () => {}, navigateBack: () => { calls.back++ } },
    getCurrentPages: () => [{ route: 'pages/home/index' }, { route: 'pages/stays/pay' }],
    setInterval: () => 1, clearInterval: () => {}, ...overrides
  }
  const source = descriptor.scriptSetup.content.replace(/^import .*\r?\n/gm, '')
  const exposed = 's,q,order,activeOrderNo,orderLoading,orderError,payMode,paymentBlocked,quoteReady,chooseMember,requote,agreed,noticeRead,onNoticeRead,onAgreeTap,now,paying,refreshing,toPay,loadOrder,refreshOrderStatus,pay,syncStatus,init,clock,expired,timeElapsed,payBtnText,closedText,paymentDeadlineText,resultTitle,resultSub,bookingActive,nextActions,onBack'
  const page = new Function(...Object.keys(deps), `${source}; return { ${exposed}, params, form, cancelOrder, recoveredOrder }`)(...Object.values(deps))
  Object.assign(page.params, { stayId:1, roomTypeId:1, checkIn:'2026-11-07', checkOut:'2026-11-14', guests:1 })
  async function acceptNotice() {
    page.onNoticeRead(true)
    await page.onAgreeTap()
  }
  return { ...page, calls, acceptNotice }
}

test('payment SFC compiles with recovery and refund states', () => {
  const script = compileScript(descriptor, { id: 'payment-test' })
  const template = compileTemplate({ source: descriptor.template.content, filename: 'pay.vue', id: 'payment-test', compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
})

test('native success requires server confirmation and launches payment once', async () => {
  const flow = loadFlow()
  assert.equal((await flow.payFlow('PAY-1')).status, 'paid')
  assert.deepEqual(flow.calls, { native: 1, prepay: 1, query: 1, sleep: 0, confirm: 0 })
})

test('non-cancel native failure still discovers a successfully paid transaction', async () => {
  let requests = 0
  const flow = loadFlow({ uni: { requestPayment: options => { requests++; options.fail({ errMsg: 'requestPayment:fail network' }) } } })
  assert.equal((await flow.payFlow('PAY-1')).status, 'paid')
  assert.equal(flow.calls.query, 1)
  assert.equal(requests, 1)
})

test('unconfirmed native failure performs bounded queries and does not claim failure or retry payment', async () => {
  let queries = 0, native = 0
  const flow = loadFlow({
    uni: { requestPayment: options => { native++; options.fail({ errMsg: 'requestPayment:fail' }) } },
    apiPayStatus: async () => { queries++; throw new Error('offline') }
  })
  assert.equal((await flow.payFlow('PAY-1')).status, 'unknown')
  assert.equal(queries, 5)
  assert.equal(native, 1)
  assert.equal(flow.calls.sleep, 4)
})

test('transient status query failures are retried without a second payment request', async () => {
  let queries = 0
  const flow = loadFlow({ apiPayStatus: async () => { if (++queries < 3) throw new Error('offline'); return { data: { status: 'paid' } } } })
  assert.equal((await flow.payFlow('PAY-1')).status, 'paid')
  assert.equal(flow.calls.native, 1)
  assert.equal(queries, 3)
})

test('cancel callback cannot override already paid server status', async () => {
  const flow = loadFlow({ uni: { requestPayment: options => options.fail({ errMsg: 'requestPayment:fail cancel' }) } })
  assert.equal((await flow.payFlow('PAY-1')).status, 'paid')
  assert.equal(flow.calls.query, 1)
})

test('cancel with pending server status preserves cancel intent and does not poll repeatedly', async () => {
  let queries = 0
  const flow = loadFlow({
    uni: { requestPayment: options => options.fail({ errMsg: 'requestPayment:fail cancel' }) },
    apiPayStatus: async () => { queries++; return { data: { status: 'pending' } } }
  })
  assert.equal((await flow.payFlow('PAY-1')).status, 'cancel')
  assert.equal(queries, 1)
})

test('already-paid prepay rejection recovers existing payment rather than launching another', async () => {
  const flow = loadFlow({ apiPayPrepay: async () => { throw new Error('already paid') } })
  assert.equal((await flow.payFlow('PAY-1')).status, 'paid')
  assert.equal(flow.calls.native, 0)
})

test('pending prepay rejection retains the real error', async () => {
  const flow = loadFlow({
    apiPayPrepay: async () => { throw new Error('merchant unavailable') },
    apiPayStatus: async () => ({ data: { status: 'pending' } })
  })
  await assert.rejects(flow.payFlow('PAY-1'), /merchant unavailable/)
  assert.equal(flow.calls.native, 0)
})

test('H5 refuses real payment both with known mode and if prepay disagrees with config', async () => {
  for (const mode of ['wechat', 'mock', '']) {
    const flow = loadFlow({ apiPayConfig: async () => ({ data: { mode } }) }, 'H5')
    await assert.rejects(flow.payFlow('PAY-1'), /微信小程序内/)
    assert.equal(flow.calls.native, 0)
  }
})

test('unknown channel is never labeled as simulation', () => {
  const flow = loadFlow()
  for (const mode of ['', undefined, 'other']) assert.doesNotMatch(flow.channelLabel(mode), /模拟|联调/)
  assert.match(flow.channelLabel('mock'), /不扣款/)
})

test('lost mock confirmation response also reconciles server payment', async () => {
  const flow = loadFlow({
    apiPayPrepay: async () => ({ data: { channel: 'mock', amount: 100 } }),
    apiPayMockConfirm: async () => { throw new Error('response lost') }
  })
  assert.equal((await flow.payFlow('PAY-1')).status, 'paid')
  assert.equal(flow.calls.native, 0)
})

test('created order survives detail failure and retry never creates a second order', async () => {
  let online = false
  const page = loadPage({ apiStayOrder: async () => { if (!online) throw new Error('offline'); return { data: pendingOrder() } } })
  await page.init()
  await page.acceptNotice()
  await page.toPay()
  assert.equal(page.activeOrderNo.value, 'STAY-1')
  assert.equal(page.order.value, null)
  assert.equal(page.s.value, 3)
  assert.match(page.orderError.value, /offline/)
  await page.pay()
  assert.equal(page.calls.pay, 0)
  online = true
  await page.toPay()
  assert.equal(page.calls.create, 1)
  assert.equal(page.order.value.orderNo, 'STAY-1')
  assert.equal(page.orderError.value, '')
})

test('retry after a lost booking response recovers the original guest and amount', async () => {
  const requests = [], saved = []
  const page = loadPage({
    apiStayCreateOrder: async body => {
      requests.push(body)
      if (requests.length === 1) throw Error('回包丢失')
      return { data: {orderNo: 'STAY-1', recoveredOrder: true} }
    },
    apiStayOrder: async () => ({data: {...pendingOrder(), guestName: '原入住人'}}),
    uni: {getStorageSync: () => ({}), setStorageSync: (_key, value) => saved.push(value)}
  })
  await page.init()
  await page.acceptNotice()
  page.form.value.guestName = '原入住人'
  await page.toPay()
  page.form.value.guestName = '后填的人'
  await page.toPay()
  assert.equal(requests[1].idemKey, requests[0].idemKey)
  assert.equal(page.recoveredOrder.value, true)
  assert.equal(page.order.value.guestName, '原入住人')
  assert.equal(page.order.value.payFen, 12800)
  assert.deepEqual(saved, [])
  assert.equal(page.calls.pay, 0)
})

test('two taps open one cancellation prompt and a dismissed page cannot submit it', async () => {
  const dialog = deferred()
  let dialogs = 0, cancels = 0
  const page = loadPage({
    modal: () => { dialogs++; return dialog.promise },
    apiStayCancelOrder: async () => { cancels++ }
  })
  page.order.value = pendingOrder()
  page.activeOrderNo.value = 'STAY-1'
  const first = page.cancelOrder(), second = page.cancelOrder()
  page.calls.unmount[0]()
  dialog.resolve({confirm: true})
  await Promise.all([first, second])
  assert.equal(dialogs, 1)
  assert.equal(cancels, 0)
})

test('a failed detail refresh after cancellation only reports the failed refresh', async () => {
  const page = loadPage({apiStayOrder: async () => { throw Error('查单断网') }})
  page.order.value = pendingOrder()
  page.activeOrderNo.value = 'STAY-1'
  await page.cancelOrder()
  assert.deepEqual(page.calls.toasts, ['查单断网'])
})

test('returning to foreground reconciles the existing order without starting payment', async () => {
  const page = loadPage({ apiStayOrder: async () => ({ data: { ...pendingOrder(), status: 'confirmed' } }) })
  page.order.value = pendingOrder()
  page.activeOrderNo.value = 'STAY-1'
  page.s.value = 3
  await page.calls.show[0]()
  assert.equal(page.order.value.status, 'confirmed')
  assert.equal(page.s.value, 4)
  assert.equal(page.calls.pay, 0)
  assert.equal(page.calls.query, 1)
})

test('service error after payment still shows server-confirmed booking', async () => {
  const page = loadPage({
    payFlow: async () => { throw new Error('client callback lost') },
    apiStayOrder: async () => ({ data: { ...pendingOrder(), status: 'confirmed' } })
  })
  page.order.value = pendingOrder()
  page.activeOrderNo.value = 'STAY-1'
  await page.pay()
  assert.equal(page.s.value, 4)
  assert.equal(page.bookingActive.value, true)
  assert.match(page.resultTitle.value, /支付成功/)
  assert.equal(page.paying.value, false)
  assert.equal(page.calls.toasts.length, 0)
})

test('a refresh already running before payment callback cannot suppress the final reconciliation', async () => {
  const status = deferred()
  let queries = 0, details = 0
  const page = loadPage({
    apiPayStatus: async () => { if (++queries === 1) return status.promise; return { data: { status: 'paid' } } },
    apiStayOrder: async () => ({ data: { ...pendingOrder(), status: ++details === 1 ? 'pending_payment' : 'confirmed' } }),
    payFlow: async () => {
      page.calls.show[0]()
      return { status: 'paid' }
    }
  })
  page.order.value = pendingOrder(); page.activeOrderNo.value = 'STAY-1'
  const payment = page.pay()
  await Promise.resolve()
  status.resolve({ data: { status: 'pending' } })
  await payment
  assert.equal(queries, 2)
  assert.equal(page.order.value.status, 'confirmed')
  assert.equal(page.s.value, 4)
})

test('refund and cancelled states do not promise successful check-in or expose arrival actions', async () => {
  for (const status of ['refund_pending', 'refunding', 'cancelled', 'closed', 'completed', 'no_show']) {
    const page = loadPage()
    page.order.value = { ...pendingOrder(), status }
    assert.equal(page.bookingActive.value, false, status)
    assert.doesNotMatch(page.resultTitle.value, /支付成功|已通知门店/, status)
    assert.doesNotMatch(page.resultSub.value, /期待您的到来/, status)
    assert.equal(page.nextActions.value.some(action => /核销码|加入门店群/.test(action.label)), false, status)
  }
})

test('client countdown reaching zero queries server and never invents a closed state', async () => {
  const page = loadPage()
  page.order.value = { ...pendingOrder(), expireTime: new Date(Date.now() - 10000).toISOString() }
  page.activeOrderNo.value = 'STAY-1'
  assert.equal(page.clock.value, '00:00')
  assert.equal(page.expired.value, false)
  assert.equal(page.timeElapsed.value, true)
  assert.equal(page.payBtnText.value, '查询订单状态')
  assert.doesNotMatch(page.paymentDeadlineText.value, /已关闭|已取消/)
  await page.pay()
  assert.equal(page.calls.pay, 0)
  assert.equal(page.calls.query, 1)
})

test('missing expire time does not appear as a timed-out order', () => {
  const page = loadPage()
  page.order.value = { ...pendingOrder(), expireTime: null }
  assert.equal(page.clock.value, '--:--')
  assert.equal(page.timeElapsed.value, false)
})

test('closed order can still query a late payment and show the actual refund state', async () => {
  const page = loadPage({ apiStayOrder: async () => ({ data: { ...pendingOrder(), status: 'refund_pending' } }) })
  page.order.value = { ...pendingOrder(), status: 'closed' }
  page.activeOrderNo.value = 'STAY-1'
  assert.equal(page.payBtnText.value, '查询订单状态')
  await page.pay()
  assert.equal(page.calls.pay, 0)
  assert.equal(page.s.value, 4)
  assert.equal(page.resultTitle.value, '退款申请审核中')
  assert.equal(page.bookingActive.value, false)
})

test('failed refresh preserves known order but makes the next tap a query only', async () => {
  const page = loadPage({ apiStayOrder: async () => { throw new Error('offline') } })
  await page.init()
  page.order.value = pendingOrder(); page.activeOrderNo.value = 'STAY-1'
  await page.refreshOrderStatus(false, true)
  assert.equal(page.order.value.orderNo, 'STAY-1')
  assert.equal(page.payBtnText.value, '查询订单状态')
  await page.pay()
  assert.equal(page.calls.pay, 0)
})

test('older order response cannot overwrite a newer confirmed server result', async () => {
  const first = deferred()
  let reads = 0
  const page = loadPage({ apiStayOrder: async () => ++reads === 1 ? first.promise : { data: { ...pendingOrder(), status: 'confirmed' } } })
  const oldRequest = page.loadOrder('STAY-1', true)
  await page.loadOrder('STAY-1', true)
  first.resolve({ data: pendingOrder() })
  assert.equal(await oldRequest, false)
  assert.equal(page.order.value.status, 'confirmed')
  assert.equal(page.s.value, 4)
})

test('unknown config remains unknown and preserves server-order recovery', async () => {
  const page = loadPage({ apiPayConfig: async () => { throw new Error('offline') } })
  await page.init()
  assert.equal(page.payMode.value, '')
  assert.doesNotMatch(page.payBtnText.value, /模拟支付/)
})

test('back after successful create and failed detail does not reopen create form', async () => {
  const page = loadPage({ apiStayOrder: async () => { throw new Error('offline') } })
  await page.init()
  await page.acceptNotice()
  await page.toPay()
  page.onBack()
  assert.equal(page.s.value, 3)
  assert.equal(page.calls.back, 1)
})

test('create sends the exact cancellation policy key the user agreed to', async () => {
  const key = 'v1|custom|3|percent|25|15:00'
  let payload
  const page = loadPage({
    apiStayQuote: async () => ({ data: { stay: {}, policy: { key }, agreement: { version: '2026-10' }, bookable: true, payFen: 12800 } }),
    apiStayCreateOrder: async body => { payload = body; return { data: { orderNo: 'STAY-1' } } }
  })
  await page.init(); await page.acceptNotice(); await page.toPay()
  assert.equal(payload.expectedPolicyKey, key)
})

test('policy change requires new agreement and never silently retries creating', async () => {
  let creates = 0, quotes = 0
  const page = loadPage({
    apiStayQuote: async () => ({ data: { stay: {}, policy: { key: ++quotes === 1 ? 'old' : 'new' }, agreement: {}, bookable: true, payFen: 12800 } }),
    apiStayCreateOrder: async () => { creates++; throw { code: 409, message: '取消退款规则已更新' } }
  })
  await page.init(); await page.acceptNotice(); await page.toPay()
  assert.equal(page.q.value.policy.key, 'new')
  assert.equal(page.agreed.value, false)
  await page.toPay()
  assert.equal(creates, 1)
  assert.equal(page.activeOrderNo.value, '')
})

test('booking notice edits refresh title and full text and require new consent', async () => {
  let quotes = 0, payload
  const page = loadPage({
    apiStayQuote: async () => ({ data: { stay: {}, policy: {}, agreement: ++quotes === 1 ? { title: '原须知', summary: '原正文', version: 'notice-old' } : { title: '新须知', summary: '新正文\n第二条', version: 'notice-new' }, bookable: true, payFen: 12800 } }),
    apiStayCreateOrder: async body => { payload = body; throw { code: 409, message: '预订须知已更新，请重新阅读并同意' } }
  })
  await page.init(); await page.acceptNotice()
  await page.toPay()
  assert.equal(payload.agreementVersion, 'notice-old')
  assert.deepEqual(page.q.value.agreement, { title: '新须知', summary: '新正文\n第二条', version: 'notice-new' })
  assert.equal(page.agreed.value, false)
  assert.equal(page.noticeRead.value, false)
  await page.toPay()
  assert.equal(page.calls.toasts.at(-1), '请先阅读并同意《新须知》')
})


test('an unpaid stay at a store without collection is stopped before creating any order', async () => {
  let enabled = false
  const page = loadPage({
    apiStayQuote: async () => ({ data: { bookable: true, payFen: 12800, onlinePaymentAvailable: enabled } })
  })
  await page.init()
  assert.equal(page.paymentBlocked.value, true)
  assert.equal(page.q.value.payFen, 12800)
  await page.acceptNotice()
  await page.toPay()
  assert.equal(page.calls.create, 0)
  enabled = true
  await page.calls.show[0]()
  assert.equal(page.paymentBlocked.value, false)
  await page.acceptNotice()
  await page.toPay()
  assert.equal(page.calls.create, 1)
})

test('only a server-quoted zero balance on selected free-night vouchers bypasses store collection', async () => {
  const page = loadPage({
    apiStayQuote: async ({ memberWalletIds }) => ({ data: {
      bookable: true, payFen: memberWalletIds.length === 2 ? 0 : 2500,
      onlinePaymentAvailable: false, memberMode: memberWalletIds.length ? 'nights' : null
    } })
  })
  await page.init()
  await page.chooseMember(8)
  await page.acceptNotice()
  await page.toPay()
  assert.equal(page.calls.create, 0)
  await page.chooseMember(9)
  assert.equal(page.paymentBlocked.value, false)
  await page.acceptNotice()
  await page.toPay()
  assert.equal(page.calls.create, 1)
})

test('a stale enabled quote and a failed retry cannot open a checkout for a different room', async () => {
  const old = deferred()
  let n = 0
  const page = loadPage({
    apiStayQuote: async () => {
      if (++n === 1) return old.promise
      if (n === 3) throw new Error('网络暂不可用')
      return { data: { bookable: true, payFen: 9900, onlinePaymentAvailable: false } }
    }
  })
  const init = page.init()
  while (!n) await new Promise(r => setImmediate(r))
  page.params.roomTypeId = 2
  await page.requote()
  old.resolve({ data: { bookable: true, payFen: 10000, onlinePaymentAvailable: true } })
  await init
  assert.equal(page.paymentBlocked.value, true)
  await page.requote()
  assert.equal(page.quoteReady.value, false)
  await page.acceptNotice()
  await page.toPay()
  assert.equal(page.calls.create, 0)
  await page.requote()
  assert.equal(page.paymentBlocked.value, true)
})
