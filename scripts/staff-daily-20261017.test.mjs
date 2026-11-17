// 2026-10-17 R4 员工端「每日概况」的回归（node --test，不构建、不发请求）。
// 主人：「我手机的员工端能不能实现每天更新每个城市和小院的报名情况入住情况」。守住这几件事：
//   · 日期切换 ‹ 今天 ›：今天 / 昨天 / 明天的叫法，往前一年、往后 180 天到头箭头变灰（和后端一致）；
//   · 合计卡两行八格、城市小计一句话、小院四个数（入住 / 在住 / 离店 / 入住率）、门店报名四个数；
//   · 点小院：今天进订单台对应分组，别的日子进房态图从那天看；点报名进报名管理（当天新报名 / 待审核）；都带那家门店；
//   · 页面在 staff 分包、接口在页面里直接 get，不往主包 common/api.js / routes.js 里加；业务中心和工作台各一个入口。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as v from '../pages/staff/daily-view.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const noComments = (t) => t.replace(/<!--[\s\S]*?-->/g, '')
const R = { staffStayOrders: '/pages/staff/stay-orders', staffApplications: '/pages/staff/applications' }

// 和后端 KgStaffDailyService 返回的形状一致（数字取自 KgStaffDailyServiceTest 的样例）
const DATA = {
  date: '2026-10-17', label: '10月17日 周六', today: '2026-10-17', isToday: true, updatedAt: '09:05', city: '',
  cityOptions: ['平潭', '大理'],
  scope: { stores: 2, stays: true, apps: true },
  total: { stays: 3, cities: 2, arrivals: 1, arrived: 0, inHouse: 3, guests: 9, units: 8, stock: 22, occupancyBp: 3636, occupancyText: '36.4%', departures: 1, departed: 0, newOrders: 1, refundPending: 0, newApps: 4, pending: 5, toReview: 4, hired: 1, arriving: 2, onboarded: 1 },
  cities: [
    { city: '平潭', sum: { inHouse: 2, occupancyText: '25%', newApps: 3 },
      stays: [{ stayId: 6, stayName: '平潭海边小院', storeId: 102, storeName: '平潭店', online: true, arrivals: 1, arrived: 0, inHouse: 2, guests: 3, units: 3, stock: 8, occupancyText: '37.5%', departures: 0, departed: 0, newOrders: 0, refundPending: 1 },
        { stayId: 7, stayName: '平潭山居', storeId: 102, storeName: '平潭店', online: true, arrivals: 0, arrived: 0, inHouse: 0, guests: 0, units: 0, stock: 4, occupancyText: '0%', departures: 1, departed: 0, newOrders: 0, refundPending: 0 }],
      apps: [{ storeId: 102, storeName: '平潭店', newApps: 3, pending: 5, toReview: 4, hired: 1, arriving: 2, onboarded: 1 }] },
    { city: '大理', sum: { inHouse: 1, occupancyText: '50%', newApps: 0 },
      stays: [{ stayId: 8, stayName: '大理古城院', storeId: 103, storeName: '大理店', online: true, arrivals: 0, inHouse: 1, guests: 6, units: 5, stock: 10, occupancyText: '50%', departures: 0, newOrders: 1 }],
      apps: [{ storeId: 103, storeName: '大理店', newApps: 0, pending: 1, toReview: 0, hired: 0, arriving: 0, onboarded: 0 }] }
  ]
}

test('日期切换：今天 / 昨天 / 明天，范围到头箭头不能点', () => {
  const t = v.dayNav('2026-10-17', '2026-10-17')
  assert.equal(t.title, '今天 · 10月17日 周六')
  assert.equal(t.isToday, true)
  assert.equal(v.dayNav('2026-10-16', '2026-10-17').word, '昨天')
  assert.equal(v.dayNav('2026-10-18', '2026-10-17').word, '明天')
  assert.equal(v.dayNav('2026-10-20', '2026-10-17').title, '10月20日 周二')
  assert.equal(v.shiftDay('2026-10-31', 1), '2026-11-01')
  assert.equal(v.shiftDay('2026-01-01', -1), '2025-12-31')
  const far = v.dayNav(v.shiftDay('2026-10-17', 180), '2026-10-17')
  assert.equal(far.canNext, false)
  assert.equal(far.canPrev, true)
  assert.equal(v.dayNav(v.shiftDay('2026-10-17', -366), '2026-10-17').canPrev, false)
  assert.equal(t.min, '2025-10-16')
  assert.equal(t.max, '2027-04-15')
})

test('合计卡：两行八格；看别的日子写「当天」；待审退款 / 待处理报名有数时标红', () => {
  const tiles = v.summaryTiles(DATA.total, true)
  assert.deepEqual(tiles.map(x => x.label), ['在住', '入住率', '今日入住', '今日离店', '新订单', '待审退款', '新报名', '待处理报名'])
  assert.deepEqual(tiles.map(x => x.value), [3, '36.4%', 1, 1, 1, 0, 4, 5])
  assert.equal(tiles[0].sub, '9人', '间数写在入住率下面（8/22），320 宽不挤')
  assert.equal(tiles[1].sub, '8/22')
  assert.equal(tiles[5].warn, false)
  assert.equal(tiles[7].warn, true)
  assert.equal(tiles[7].sub, '待审核 4')
  assert.deepEqual(v.summaryTiles(DATA.total, false).slice(2, 4).map(x => x.label), ['当天入住', '当天离店'])
  assert.equal(v.summaryTiles({ stock: 0 }).find(x => x.key === 'occ').value, '—', '没有库存时不写 0%')
  assert.equal(v.totalTitle(DATA.total, ''), '全部 · 2 个城市 · 3 家小院')
  assert.equal(v.totalTitle({ stays: 2, cities: 1 }, '平潭'), '平潭 · 2 家小院')
})

test('城市 → 小院 / 门店报名；小计一句话', () => {
  const blocks = v.cityBlocks(DATA, R)
  assert.deepEqual(blocks.map(b => b.city), ['平潭', '大理'])
  assert.equal(blocks[0].stayCount, 2)
  assert.equal(blocks[0].sumLine, '在住 2 · 入住率 25% · 新报名 3')
  const s6 = blocks[0].stays[0]
  assert.deepEqual(s6.stats.map(x => [x.label, x.value, x.sub]), [['入住', 1, '已到 0'], ['在住', 2, '3人'], ['离店', 0, ''], ['入住率', '37.5%', '3/8']])
  assert.deepEqual(s6.flags, [{ text: '待审退款 1', tone: 'alert' }])
  assert.deepEqual(blocks[1].stays[0].flags, [{ text: '新订单 1', tone: 'green' }])
  assert.deepEqual(v.stayFlags({ online: false }), [{ text: '未上线', tone: 'muted' }])
  const a = blocks[0].apps[0]
  assert.deepEqual(a.stats.map(x => [x.label, x.value, x.sub]), [['新报名', 3, ''], ['待处理', 5, '待审核 4'], ['录用', 1, ''], ['到岗', 2, '已入职 1']])
  assert.equal(a.stats[1].warn, true)
})

test('点小院：今天进订单台对应分组，别的日子进房态图；点报名进报名管理', () => {
  const blocks = v.cityBlocks(DATA, R)
  assert.equal(blocks[0].stays[0].link, '/pages/staff/stay-orders?stayId=6&tab=arrivals', '有今日到店先看到店')
  assert.equal(blocks[0].stays[1].link, '/pages/staff/stay-orders?stayId=7&tab=departures')
  assert.equal(blocks[1].stays[0].link, '/pages/staff/stay-orders?stayId=8&tab=inhouse')
  const past = v.cityBlocks({ ...DATA, date: '2026-10-15', isToday: false }, R)
  assert.equal(past[0].stays[0].link, '/pages/staff/stay-orders?stayId=6&s=4&start=2026-10-15')
  assert.equal(blocks[0].apps[0].link, '/pages/staff/applications?submitDate=2026-10-17')
  assert.equal(v.appLink({ newApps: 0, toReview: 2 }, '2026-10-17', R), '/pages/staff/applications?status=submitted')
  assert.equal(blocks[1].apps[0].link, '/pages/staff/applications')
})

test('线上任务的报名单独一组（10-19 复查：之前叫「不限」像个城市名）；没有小院的组小计只写报名', () => {
  assert.equal(v.ONLINE_GROUP, '线上任务')
  const data = { ...DATA, cities: DATA.cities.concat([{ city: '线上任务', sum: { inHouse: 0, newApps: 2, pending: 1 }, stays: [], apps: [{ storeId: 102, storeName: '平潭店', newApps: 2, pending: 1, toReview: 1 }] }]) }
  const blocks = v.cityBlocks(data, R)
  const online = blocks[blocks.length - 1]
  assert.equal(online.countText, '不分城市')
  assert.equal(online.sumLine, '新报名 2 · 待处理 1', '不写「在住 0 · 入住率 —」')
  assert.equal(blocks[0].countText, '2 家小院')
  assert.equal(v.cityCountText('平潭', 0), '没有小院')
  const t = noComments(readSfc('pages/staff/daily.vue').template.content)
  assert.match(t, /<text class="city__count">\{\{ c\.countText \}\}<\/text>/)
  // 后端同名常量（分组和排序都认它）
  const java = fs.readFileSync(path.join(APP, '..', 'RuoYi-Vue', 'ruoyi-kangaroo', 'src', 'main', 'java', 'com', 'ruoyi', 'kangaroo', 'ext', 'staff', 'KgStaffDailyService.java'), 'utf8')
  assert.match(java, /static final String ONLINE_GROUP = "线上任务";/)
})

test('城市筛选：只有一个城市时不显示；选了的那个高亮', () => {
  assert.deepEqual(v.cityChips(['平潭'], ''), [])
  assert.deepEqual(v.cityChips(['平潭', '大理'], '大理').map(c => [c.label, c.on]), [['全部城市', false], ['平潭', false], ['大理', true]])
})

test('页面：staff 分包注册、下拉刷新、接口直接 get、点进去带门店', () => {
  const pages = JSON.parse(fs.readFileSync(path.join(APP, 'pages.json'), 'utf8'))
  const staff = pages.subPackages.find(p => p.root === 'pages/staff')
  const page = staff.pages.find(p => p.path === 'daily')
  assert.ok(page, '注册在 staff 分包')
  assert.equal(page.style.enablePullDownRefresh, true)
  assert.ok(!pages.pages.some(p => /daily/.test(p.path) && /staff/.test(p.path)), '不进主包')
  const d = readSfc('pages/staff/daily.vue')
  const t = noComments(d.template.content)
  const js = d.scriptSetup.content
  assert.match(js, /import \{ get \} from '@\/common\/request\.js'/)
  assert.match(js, /await get\(DAILY_API, \{ date: date\.value, city: city\.value \|\| undefined \}\)/)
  assert.match(js, /const open = \(url, storeId\) => go\(staffStoreUrl\(url, storeId\)\)/)
  assert.match(js, /onPullDownRefresh\(/)
  assert.match(t, /<text class="dmeta__time">\{\{ loading \? '更新中…' : \(data\.updatedAt \? '更新于 ' \+ data\.updatedAt : ''\) \}\}<\/text>/)
  assert.match(t, /@click="move\(-1\)"/)
  assert.match(t, /@click="move\(1\)"/)
  assert.match(t, /<k-date-picker v-if="calendarOpen" title="看哪一天的概况" :value="date" :min-date="nav\.min" :max-date="nav\.max"/)
  assert.ok(!read('common/api.js').includes('/app/staff/daily'), '不往主包 api.js 里加')
  assert.ok(!read('common/routes.js').includes('staff/daily'), '不往主包 routes.js 里加（入口用分包里的 DAILY_PAGE）')
  assert.equal(v.DAILY_PAGE, '/pages/staff/volunteers')
  assert.ok(staff.pages.some(p => p.path === 'volunteers'), '当地换工概况入口已注册')
  assert.equal(v.DAILY_API, '/app/staff/daily')
})

test('入口：业务中心一张卡、工作台「今日概览」旁边一个链接；订单台认 stayId / tab / start', () => {
  const b = readSfc('pages/staff/business.vue')
  assert.match(noComments(b.template.content), /<text class="group-title">每日概况<\/text><view class="owner-entry stay-entry daily-entry" hover-class="k-press-s" @click="go\(DAILY_PAGE\)">/)
  assert.match(b.scriptSetup.content, /import \{ DAILY_PAGE \} from '\.\/daily-view\.js'/)
  const w = readSfc('pages/staff/index.vue')
  assert.match(noComments(w.template.content), /<view v-else class="k-row k-gap4 daily-link" hover-class="k-press" @click="go\(DAILY_PAGE\)"><text class="k-small k-muted">\{\{ today \}\}<\/text><text class="daily-link__text">当地换工概况<\/text>/)
  assert.match(w.scriptSetup.content, /import \{ DAILY_PAGE \} from '\.\/daily-view\.js'/)
  const o = readSfc('pages/staff/stay-orders.vue').scriptSetup.content
  assert.match(o, /if \(Number\(q\?\.stayId\) > 0\) stayId\.value = Number\(q\.stayId\)/)
  assert.match(o, /else if \(q\?\.allStays\) allStaysLink = true/)
  assert.match(o, /\['unassigned', 'arrivals', 'inhouse', 'departures', 'upcoming', 'done'\]\.includes\(q\?\.tab\)/)
  assert.match(o, /boardStart\.value = q\.start/)
  assert.match(o, /await loadOverview\(\)/)
})
