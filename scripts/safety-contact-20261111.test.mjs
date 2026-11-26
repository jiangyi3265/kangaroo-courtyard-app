import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ref, computed } from 'vue'
import { parse } from '@vue/compiler-sfc'
import { tripCopyText } from '../pages/jobs/trip-share.js'

const component = parse(fs.readFileSync(new URL('../pages/jobs/components/safety-share.vue', import.meta.url), 'utf8')).descriptor
const code = component.scriptSetup.content.replace(/^import .*$/gm, '')
function setup(href) {
  let choice = 1, unmount
  const calls = [], routes = [], notices = [], menus = [], shares = [], copied = []
  const data = { online: false, ended: false, safety: { kind: 'manager', name: '测试主理人', appId: 300, contactPhone: '059188881234' }, trip: { name: '旅客', jobId: 55, arrival: '2026-11-20', place: '测试小院' } }
  const deps = {
    ref, computed, watch: () => {}, onUnmounted: fn => { unmount = fn }, defineOptions: () => {},
    defineProps: () => ({ appId: 300, status: 'review_passed', compact: true }), defineEmits: () => (...v) => shares.push(v),
    get: async () => ({ data }), absUrl: x => x, go: x => routes.push(x), toast: x => notices.push(x),
    location: href ? { href } : undefined, copy: text => copied.push(text), prompt: () => {}, sheet: async options => { menus.push(options); return typeof choice === 'function' ? choice() : choice },
    experience: { account: { id: 7 } }, R: { chat: '/pages/community/chat' }, durationLabel: () => '',
    FALLBACK_NAME: '朋友', cleanName: x => x, monthDay: x => x, tripCopyText, tripImageUrl: x => x, tripTitle: () => '',
    uni: { makePhoneCall: options => calls.push(options) }
  }
  const api = new Function(...Object.keys(deps), code + '\nreturn {load,contactPerson,shareTrip,copyTrip};')(...Object.values(deps))
  return { ...api, data, calls, routes, notices, menus, copied, choose: x => { choice = x }, unmount: () => unmount() }
}

test('电话使用门店联系方式，在线联系仍进入本报名会话，分享不带电话', async () => {
  const c = setup(); await c.load(); await c.contactPerson()
  assert.deepEqual(c.menus[0], ['在线联系商家', '电话联系（门店电话）'])
  assert.equal(c.calls[0].phoneNumber, '059188881234')
  assert.equal(c.shareTrip.value.contactPhone, undefined)
  c.choose(0); await c.contactPerson()
  assert.deepEqual(c.routes, ['/pages/community/chat?appId=300'])
  c.choose(-1); await c.contactPerson(); assert.equal(c.calls.length, 1)
})

test('H5 复制给亲友：保留部署子路径，清除当前页面查询和原报名参数', async () => {
  const c = setup('https://example.test/travel/h5/index.html?source=test&private=sample#/pages/jobs/apply?appId=300')
  await c.load()
  assert.match(component.template.content, /label="复制行程发给亲友" @click="copyTrip"/)
  c.copyTrip()
  assert.deepEqual(c.copied, [
    '旅客 11月20日 到 测试小院 工作。行程：https://example.test/travel/h5/index.html#/pages/jobs/itinerary?jobId=55&date=2026-11-20&days=&name=' + encodeURIComponent('旅客')
  ])
})

test('城市固定换工联系人使用主理人专属对话，电话号码注明仍归门店', async () => {
  const c = setup()
  c.data.safety.designated = true
  await c.load()
  c.choose(0)
  await c.contactPerson()
  assert.deepEqual(c.menus[0], ['在线联系当地主理人', '电话联系（门店电话）'])
  assert.deepEqual(c.routes, ['/pages/community/chat?appId=300&contact=lead'])
})

test('没有有效号码时提示在线联系，不发起拨号；拨号取消不报错', async () => {
  const c = setup(); await c.load()
  for (const phone of ['', '138****5678', '123;4567']) {
    c.data.safety.contactPhone = phone; await c.contactPerson()
  }
  assert.equal(c.calls.length, 0); assert.equal(c.notices.length, 3)
  c.data.safety.contactPhone = '+8613900000000'; await c.contactPerson()
  c.calls[0].fail({ errMsg: 'makePhoneCall:fail cancel' }); assert.equal(c.notices.length, 3)
  c.calls[0].fail({ errMsg: 'makePhoneCall:fail unavailable' }); assert.match(c.notices.at(-1), /暂时无法拨打/)
})

test('选择联系方式期间报名变化或组件退出，取消旧拨号操作', async () => {
  for (const invalidate of [c => c.load(), c => c.unmount()]) {
    const c = setup(); await c.load()
    let resolve
    c.choose(() => new Promise(r => { resolve = r }))
    const pending = c.contactPerson(); await invalidate(c); resolve(1); await pending
    assert.equal(c.calls.length, 0)
  }
})

test('结束、线上任务、客服回退都不能调用主理人电话', async () => {
  for (const change of [d => { d.ended = true }, d => { d.online = true }, d => { d.safety.kind = 'service' }]) {
    const c = setup(); change(c.data); await c.load(); await c.contactPerson(); assert.equal(c.calls.length, 0)
  }
})
