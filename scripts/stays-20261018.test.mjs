// 2026-10-18 晚 主人反馈「旅居页面太丑」C 节（订房入口 / 房源列表 / 房源详情 / 家人评价 / 订房流程）的回归（node --test，不构建、不发请求）。
// 守住这几件事：
//   · 订房入口：日期一颗大胶囊点开区间日历，人数 + 区域两颗胶囊；筛选胶囊四组都是四列等宽（价格四档、评分四档）；
//   · 房源详情：每个房型一张全宽卡，带它自己的评分（接口 rating / reviewCount，没有评价不显示）；「住过的家人评价」左边总结分；底部暖棕栏；
//   · 订房流程：房态日历（或低价日推荐）之后直接进确认订单，不再有「活动加购」这一屏；
//   · 确认订单：醒目的「请带好身份证，小院现场登记」，预订须知摊在页面上按换行显示。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as ui from '../pages/stays/stays-ui.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const noComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '')
const css = (d) => d.styles.map(s => s.content).join('\n')
const compiles = (d, name) => {
  const r = compiler.compileTemplate({ source: d.template.content, filename: name, id: name })
  assert.deepEqual(r.errors, [], name + ' 模板能编译')
}

test('房型规格一行和房型自己的评分', () => {
  assert.equal(ui.roomSpec({ capacity: 1, features: ['独立卫浴', '空调', '可做饭', '书桌'] }), '1人｜独立卫浴｜空调｜可做饭')
  assert.equal(ui.roomSpec({ capacity: 0, features: [] }), '')
  assert.deepEqual(ui.roomRate({ rating: 4.67, reviewCount: 3 }), { score: '4.7', count: 3 })
  assert.equal(ui.roomRate({ rating: null, reviewCount: 0 }), null, '没有评价不显示分，不拿小院总分顶替')
  assert.equal(ui.roomRate({ rating: 4.5, reviewCount: 0 }), null)
  assert.equal(ui.roomRate(null), null)
})

test('订房入口：保留预订信息，房型、价格和评分只在更深的页面选择', () => {
  const d = sfc('pages/stays/list.vue')
  const t = noComments(d.template.content)
  const js = d.scriptSetup.content
  const entry = t.slice(t.indexOf('<view class="k-body k-pad-tab entry">'), t.indexOf('<k-tabbar v-if="!dateOpen" active="home" />'))
  assert.match(entry, /@click="pickDates\('start'\)"/)
  assert.match(entry, /@click="pickDates\('end'\)"/)
  assert.match(entry, /<view class="cpill" hover-class="k-press" @click="pickGuests">/)
  assert.match(entry, /<view class="cpill" hover-class="k-press" @click="pickAreaSheet">/)
  assert.doesNotMatch(entry, /room-pick|roomOpts|bathOpts|priceOpts|scoreOpts|筛选条件/)
  assert.match(entry, /class="entry-search"[^>]*@click="search"/)
  const inner = t.slice(t.indexOf('<view v-else-if="s === 2">'))
  for (const name of ['roomOpts', 'bathOpts', 'priceOpts', 'scoreOpts']) assert.ok(inner.includes(name), name + ' 在内层可选')
  assert.match(inner, /更多筛选/)
  const literal = (name) => new Function('return ' + new RegExp(`const ${name} = (\\[[^\\]]*\\])`).exec(js)[1])()
  assert.deepEqual(literal('priceOpts'), ['不限', '¥200以下', '¥200–400', '¥400以上'])
  assert.deepEqual(literal('scoreOpts'), ['不限', '4.0分以上', '4.5分以上', '4.8分以上'])
  const range = new Function('return ' + /const PRICE_RANGE = (\{[^\n]*\})/.exec(js)[1])()
  assert.deepEqual(range['¥200以下'], [0, 20000], '第一档从 0 起：几十块的床位也算进来')
  assert.deepEqual(range['¥400以上'], [40000, undefined])
  const score = new Function('return ' + /const SCORE_MIN = (\{[^\n]*\})/.exec(js)[1])()
  assert.equal(score['4.8分以上'], 48)
  // 可租小院：图上叠来源、名字下面评分
  assert.match(entry, /<text class="pv__src">\{\{ h\.src \}\}<\/text>/)
  assert.match(js, /rate: ratingParts\(h\.rating, h\.reviewCount\)/)
  // 列表卡：标签行有「可订」（订不了写原因），来源 / 安心住的颜色不再被后面的 .chip 盖掉
  assert.match(t, /<view v-if="h\.dates" class="chip" :class="h\.available \? 'chip--ok' : 'chip--off'"><text>\{\{ h\.availText \}\}<\/text><\/view>/)
  assert.match(css(d), /\.chip\.chip--src \{/)
  compiles(d, 'list.vue')
})

test('房源详情：全宽房型卡带自己的评分、规格一行；评价入口左边总结分；底部暖棕栏', () => {
  const d = sfc('pages/stays/detail.vue')
  const t = noComments(d.template.content)
  const js = d.scriptSetup.content
  assert.match(js, /line: roomSpec\(r\), rate: roomRate\(r\)/)
  assert.match(t, /<view v-if="r\.ai\.ready \|\| r\.rate" class="rt__rate">/)
  assert.match(js, /ai: stayAiSummary\(r\.ai\)/, 'AI分绑定本房型，不能用小院总分填充')
  assert.match(css(d), /\.rt__pic \{ padding-bottom: 42%; \}/, '按参考图调整房型封面比例')
  assert.match(t, /\{\{ reviewAi\.score \|\| ratingMain \|\| '—' \}\}/)
  assert.match(t, /reviewAi\.ready \? 'AI综合评分' : \(ratingMain \? '住客评分' : '暂无家人评价'\)/)
  assert.match(js, /const ratingMain = computed\(\(\) => roomRate\(d\.value\)\?\.score \|\| ''\)/)
  assert.match(t, /<view class="pickbar"><view class="picked"[^>]*>[\s\S]*?<template v-else-if="pickedRoom">/)
  assert.match(t, /<text class="picked__hint">选择房型与日期<\/text>/)
  assert.match(t, /<view v-if="s === 1 && !barSolid" class="bar-pill" :style="pillStyle"><text>房源详情<\/text><\/view>/)
  compiles(d, 'detail.vue')
})

test('订房流程：日历之后直接确认订单，不再有低价日推荐或活动加购', () => {
  const d = sfc('pages/stays/booking.vue')
  const t = d.template.content
  const js = d.scriptSetup.content
  assert.ok(!/活动加购|addon-body|togglePick|apiStayAddons/.test(noComments(t) + js.replace(/\/\/[^\n]*/g, '')),'加购这一屏整个去掉（注释里的说明不算）')
  // 房态日历直接进入确认订单，低价日推荐和活动加购均已移除。
  assert.match(js, /const s = useScreen\(2, \{/)
  assert.match(js, /const titles = \['房型选择', '房态日历'\]/)
  assert.match(t, /:label="quoteLoading \? '正在查询报价' : '下一步：确认订单'" @click="next2"/)
  assert.doesNotMatch(t, /低价日|rec-tip|省钱提示|recommend-body|keep-dates/)
  assert.match(js, /if \(!q\.value\.bookable\) return toast\(q\.value\.reason \|\| '所选日期不可订'\)\n  toPay\(\)\n\}/)
  assert.ok(!js.includes("'acts='"), '不再带加购活动')
  assert.ok(!read('common/api.js').includes('apiStayAddons'), '没有调用点的接口函数从主包里去掉')
  compiles(d, 'booking.vue')
})

test('确认订单：身份证提醒醒目、预订须知按换行摊在页面上', () => {
  const d = sfc('pages/stays/pay.vue')
  const t = d.template.content
  const step2 = t.slice(t.indexOf('<view v-else-if="s === 2"'), t.indexOf('<!-- 3 微信支付 -->'))
  assert.ok(step2.indexOf('class="idcard"') > 0 && step2.indexOf('class="idcard"') < step2.indexOf('房费明细'), '身份证提醒放在确认页最上面')
  assert.match(step2, /<text class="idcard__title">请带好身份证，小院现场登记<\/text>/)
  // 2026-11-03 简化：须知默认只露前几行，「展开全文」在页面里展开
  assert.match(step2, /<text class="notice__text" :class="\{ 'notice__text--clamp': !noticeOpen \}">\{\{ q\.agreement\.summary \}\}<\/text>/)
  assert.match(step2, /@click="noticeOpen = !noticeOpen"><text>\{\{ noticeOpen \? '收起' : '展开全文' \}\}<\/text>/)
  assert.match(css(d), /\.notice__text \{[^}]*white-space: pre-line;/)
  assert.match(css(d), /\.policy__copy \{[^}]*white-space: pre-line;/)
  // 须知已经在页面上：点勾选框直接勾上；2026-11-03 简化：老接口没给须知正文时也不弹窗（之前要弹「同意 / 关闭」）
  const js = d.scriptSetup.content
  const block = js.slice(js.indexOf('async function onAgreeTap() {'), js.indexOf('\n}\n', js.indexOf('async function onAgreeTap() {')) + 2)
  const run = async (agreement) => {
    const agreed = { value: false }
    const modals = []
    const fn = new Function('agreed', 'q', 'modal', block + '\nreturn onAgreeTap')(agreed, { value: { agreement } }, async (...a) => { modals.push(a); return { confirm: true } })
    await fn()
    return { agreed: agreed.value, modals: modals.length }
  }
  return Promise.all([run({ summary: '1. 一\n2. 二' }), run({})]).then(([a, b]) => {
    assert.deepEqual(a, { agreed: true, modals: 0 })
    assert.deepEqual(b, { agreed: true, modals: 0 })
  })
})

test('后端：房型评分来自绑定了房型的评价；预订须知一条一行、写明带身份证', () => {
  const java = read('../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/ext/stay/KgStayBrowseService.java')
  assert.equal((java.match(/roomScore\(t, scores\.get\(KgJdbc\.asLong\(rt\.get\("roomTypeId"\)\)\)\);/g) || []).length, 2, '详情和房型接口都带')
  assert.match(java, /join kg_stay_order o on v\.biz_type = 'stay_order' and o\.order_id = v\.biz_id and o\.stay_id = v\.target_id/)
  assert.match(java, /AGREEMENT_SUMMARY = "1\. [^"]*；\\n"/)
  assert.match(java, /"2\. 请带好入住人本人身份证/)
})
