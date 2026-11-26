// 10-14 回归（R3）社区 / 旅居 / 招聘几处修复的静态 + 小段逻辑回归（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · Vlog 详情的评论入口不再挂在（经常为空的）简介文字上；
//   · 活动凭证：取消 / 退款中 / 已退款的报名不盖「报名成功」章、不显示集合提醒和活动群；
//     门店员工自己也报了名时，「查看报名」能看到自己的凭证；
//   · 线上任务不收报名时，报名页写出任务名和原因，不再摆出线下那套报名表；
//   · 旅居列表余量文字整块换行；房源详情的早鸟标签写出真正的早鸟价；
//   · 脱敏简历屏不展示像联系方式的技能标签。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { periodDisplay } from '../pages/stays/period-price.js'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const stayDetail = await read('../pages/stays/detail.vue')
const stayList = await read('../pages/stays/list.vue')
const activity = await read('../pages/community/activity.vue')
const apply = await read('../pages/jobs/apply.vue')
const staffApps = await read('../pages/staff/applications.vue')
const between = (s, a, b) => {
  const i = s.indexOf(a)
  const j = s.indexOf(b, i)
  assert.ok(i >= 0 && j > i, `找不到 ${a} … ${b}`)
  return s.slice(i, j)
}
const ref = (v) => ({ value: v })
const computed = (fn) => ({ get value() { return fn() } })

test('Vlog 详情：评论入口不依赖简介，简介为空时也看得到', () => {
  assert.doesNotMatch(stayDetail, /<text class="vlog-desc" @click="commentVlog">\{\{ cur\.description \|\| '' \}\}<\/text>/)
  assert.match(stayDetail, /<text v-if="cur\.description" class="vlog-desc"/)
  const row = /<view class="vlog-comment" @click="commentVlog">[\s\S]*?<\/view>/.exec(stayDetail)
  assert.ok(row, '没有独立的评论入口')
  assert.match(row[0], /写评论 \/ 看评论/)
  assert.match(stayDetail, /\.vlog-comment \{[^}]*min-height: 42px/)
})

test('房源详情：早鸟标签写出早鸟价；只有带 promoId 进来时才标房型卡片', () => {
  assert.doesNotMatch(stayDetail, /<k-chip v-if="d\.promo" tone="ochre" @click="openPromo"><text>早鸟价<\/text><\/k-chip>/)
  assert.match(stayDetail, /'早鸟 ¥' \+ promoPrice \+ '\/晚'/)
  const code = between(stayDetail, 'const promo = computed(', 'const showStory')
  const run = (data, promoId, loadedRows) => new Function('computed', 'd', 'promoId', 'yuan', 'roomsLoaded', 'roomRows', 'periodDisplay', code + ';return { promo, promoPrice, rooms }')(
    computed, ref(data), promoId, (fen) => String(Number(fen) / 100), ref(!!loadedRows), ref(loadedRows || []), periodDisplay)
  const data = { priceFromFen: 18000, roomTypes: [{ roomTypeId: 389, typeName: '早鸟大床房', priceFromFen: 20000 }, { roomTypeId: 390, typeName: '日常双床房', priceFromFen: 18000 }],
    promo: { promoId: 4, roomTypeId: 389, priceFen: 15000 }, promos: [{ promoId: 4, roomTypeId: 389, priceFen: 15000 }] }
  const fromBird = run(data, 4)
  assert.equal(fromBird.promoPrice.value, '150')
  assert.deepEqual(fromBird.rooms.value.map(r => r.promoPrice), ['150', ''])
  assert.deepEqual(run(data, 4, [data.roomTypes[1]]).rooms.value.map(r => r.promoPrice), [''])
  const plain = run(data, 0)
  assert.equal(plain.promoPrice.value, '150')
  assert.deepEqual(plain.rooms.value.map(r => r.promoPrice), ['', ''], '没带 promoId 时预订页按日常价报价，不能在房型卡片上标早鸟价')
  // 老接口只有 promo、没有 promos 时照样能用
  assert.equal(run({ ...data, promos: undefined }, 4).promo.value.promoId, 4)
  assert.equal(run({ roomTypes: [] }, 0).promo.value, null)
})

test('旅居列表：余量文字和日期各自整块换行', () => {
  assert.match(stayList, /<view class="k-row k-gap6 home__avail"><text class="k-green avail"/)
  assert.match(stayList, /\.home__avail \{ flex-wrap: wrap; row-gap: 2px; \}\.home__avail>text \{ white-space: nowrap; \}/)
})

test('活动凭证：只有还有效的报名才盖章、显示集合提醒和活动群', () => {
  assert.match(activity, /<image v-if="ticket\.status === 'confirmed'" class="success-stamp"/)
  assert.match(activity, /<view v-if="ticketLive" class="reminder">/)
  const code = between(activity, 'const ticketLive = computed(', '\n') + '\n'
  for (const [status, live] of [['confirmed', true], ['waitlist', true], ['pending_payment', true], ['refund_pending', false], ['refunding', false], ['refunded', false], ['cancelled', false], ['closed', false]]) {
    const ticket = ref({ status })
    assert.equal(new Function('computed', 'ticket', code + 'return ticketLive')(computed, ticket).value, live, status)
  }
  const actions = between(activity, 'const successActions = computed(', '\n])')
  assert.match(actions, /ticket\.value\.status === 'confirmed' && ticket\.value\.convId && groupChatEnabled\.value \? \{ title: '加入活动群'/)
  assert.match(actions, /title: '查看活动详情'/)
})

test('活动详情：员工自己也报了名时，「查看报名」能打开自己的凭证', async () => {
  const code = between(activity, 'let signing = false', '// ---------------- s=4 凭证')
  const run = async (d, choice) => {
    const calls = []
    const deps = {
      ref, detail: ref(d), go: (u) => calls.push(['go', u]), R: { activityMine: '/mine', staffActivities: '/staff' },
      sheet: async (opts) => { calls.push(['sheet', opts]); return choice }, payTicket: (id) => calls.push(['pay', id]), openTicket: (id) => calls.push(['ticket', id]),
      toast: () => {}, confirm: async () => false, gated: async () => ({}), apiActivitySignup: async () => ({}), channel: ref('other'), payFlow: async () => {}, fail: () => {}
    }
    const names = Object.keys(deps)
    const { signup } = new Function(...names, code + ';return { signup }')(...names.map(n => deps[n]))
    await signup()
    return calls
  }
  const store = { activityId: 633, source: 'merchant', isOwner: true, mySignupId: 665, myStatus: 'confirmed' }
  assert.deepEqual(await run(store, 0), [['sheet', ['查看我的报名', '管理活动']], ['ticket', 665]])
  assert.deepEqual(await run(store, 1), [['sheet', ['查看我的报名', '管理活动']], ['go', '/staff?s=4&id=633']])
  assert.deepEqual(await run(store, -1), [['sheet', ['查看我的报名', '管理活动']]])
  assert.deepEqual(await run({ ...store, mySignupId: undefined }, 0), [['go', '/staff?s=4&id=633']])
  assert.deepEqual(await run({ ...store, isOwner: false }, 0), [['ticket', 665]])
  assert.deepEqual(await run({ ...store, source: 'user', mySignupId: undefined }, 0), [['go', '/mine?id=633']])
})

test('报名页：不收报名的线上任务写出任务名和原因，不显示报名表', async () => {
  // 2026-10-18 报名页改成「用简历投递」的一屏：进度条只给到店岗位；不收报名时只写岗位名和原因，简历卡 / 到岗安排 / 底部按钮都不出
  assert.match(apply, /<view v-if="!closedReason && jobType && !isOnline" class="ap-card ap-flow">/)
  assert.match(apply, /<view v-else-if="closedReason" class="ap-card ap-state">[\s\S]*?<\/view>\n\n      <!-- 投递成功 -->/)
  assert.match(apply, /<view v-else-if="jobReady" class="ap-form">/)
  assert.match(apply, /<k-bottom v-if="!closedReason && \(jobReady \|\| saved\)"\s/)
  const code = between(apply, 'const closedReason = ref(', '// ---------------- 我的简历')
  const run = async (data) => {
    const s = { jobId: ref(14424), jobReady: ref(false), jobTitleError: ref(''), jobTitle: ref(''), jobType: ref('') }
    const api = async () => ({ data })
    const deps = { restoreDraft: () => {}, job: ref({}), isOnline: { value: false }, arrival: ref(''), days: ref(0), draft: {}, today: '2026-10-18', absUrl: (u) => u,
      computed: (f) => ({ get value() { return f() } }), defaultArrival: () => '2026-10-18', defaultDuration: () => 30 }
    const names = Object.keys(deps)
    const out = new Function('ref', 'jobId', 'jobReady', 'jobTitleError', 'jobTitle', 'jobType', 'apiJobDetail', ...names, code + ';return { closedReason, loadJob }')(
      ref, s.jobId, s.jobReady, s.jobTitleError, s.jobTitle, s.jobType, api, ...names.map(n => deps[n]))
    await out.loadJob()
    return { ...s, closedReason: out.closedReason }
  }
  const full = await run({ title: '小红书探店笔记', jobType: 'online', acceptsApplication: false, applyClosedReason: '这个任务的名额已满，暂不接受报名' })
  assert.equal(full.jobTitle.value, '小红书探店笔记')
  assert.equal(full.jobType.value, 'online')
  assert.equal(full.closedReason.value, '这个任务的名额已满，暂不接受报名')
  assert.equal(full.jobReady.value, false)
  assert.equal(full.jobTitleError.value, '', '不收报名不是加载失败，不给「重新加载岗位」')
  const open = await run({ title: '前台', jobType: 'volunteer', acceptsApplication: true })
  assert.equal(open.closedReason.value, '')
  assert.equal(open.jobReady.value, true)
  const paused = await run({ title: '前台', jobType: 'volunteer', acceptsApplication: false, status: 'paused' })
  assert.equal(paused.closedReason.value, '该岗位暂停招聘中，暂不接受报名')
})

test('脱敏简历屏：像电话、微信号的技能标签不展示', () => {
  const line = between(staffApps, 'const CONTACT_LIKE = ', '\n')
  const re = new Function(line + ';return CONTACT_LIKE')()
  for (const t of ['138-1234-5678', '138 1234 5678', '微信 kgtest_0101', 'QQ 12345678', 'me@qq.com', '１３８１２３４５６７８', '加V abc12345', '电话[手机号已隐藏]', '证件***']) assert.ok(re.test(t), t)
  for (const t of ['咖啡制作', '摄影', '微信公众号运营', '做过 3 年前台']) assert.ok(!re.test(t), t)
  assert.match(staffApps, /<view class="skill-row"><text v-for="t in maskedSkills" :key="t">\{\{t\}\}<\/text><\/view><\/view>/)
  assert.match(staffApps, /<text v-for="t in shownSkills" :key="t">\{\{t\}\}<\/text><text v-for="t in storeTags"/)
})
