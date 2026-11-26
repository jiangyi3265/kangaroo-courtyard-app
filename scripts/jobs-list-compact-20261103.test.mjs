// 2026-11-03 主人截图反馈（换宿旅行列表）的静态回归（node --test，不需要构建、不发请求）：
//   · 卡片和字收小一档：大图封面压矮，iPhone 12 一屏能看到两家以上；
//   · 筛选、选城市做成底部半屏弹层（暗色遮罩、点暗处关、条件区自己滚、按钮固定在底部）；
//   · 订阅挪到「全国 / 筛选」那一行右边（替掉纸飞机装饰）；每人只有一条订阅：没有就新建，有了直接改「当前订阅」，不弹原生小菜单。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { coveredBySubscription } from '../pages/jobs/city-coordinator.js'
import { currentJobSubscription } from '../pages/jobs/subscription-model.js'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const list = await read('../pages/jobs/list.vue')
const premium = await read('../pages/jobs/list-premium.scss')
const panel = await read('../pages/jobs/components/job-filter-panel.vue')
const cityPanel = await read('../pages/jobs/components/job-city-panel.vue')
const filter = await read('../pages/jobs/filter.vue')
const coordinator = await read('../pages/jobs/components/job-city-subscribe.vue')
const homeCity = await read('../pages/home/city.vue')

test('按主人参考图：「全国 / 筛选」行右边是纸飞机虚线装饰；订阅在数量行「当前订阅 | 5秒更新」', () => {
  assert.match(list, /<view class="jobs-discovery__decor"><view class="jobs-discovery__trail" \/><view class="jobs-discovery__plane"><k-icon name="send"/)
  assert.match(premium, /\.jobs-discovery__decor \{ position: absolute; right: 18px; bottom: 12px;/)
  const row = list.slice(list.indexOf('<view class="fchips">'), list.indexOf('<view v-if="filterOpen" class="jobs-filter-mask"'))
  assert.doesNotMatch(row, /class="bell"/)
  const status = list.slice(list.indexOf('<view class="list-status">'), list.indexOf('</view>', list.indexOf('class="refresh"')))
  assert.match(status, /class="count"[\s\S]*<view class="bell" :class="\{ on: notify \}" hover-class="k-press" @click="openSubscribe">[\s\S]*class="refresh"/)
  assert.match(status, /\{\{ notify \? '当前订阅' : '订阅' \}\}/)
  assert.match(status, /refreshSeconds \+ '秒更新'/)
  assert.match(premium, /\.bell \+ \.refresh::before \{/)
})

test('点订阅不弹原生小菜单：有订阅直接进「当前订阅」，没有才去新建', () => {
  // 注释里会提到旧菜单，只查代码
  assert.doesNotMatch(list.replace(/\/\/[^\n]*/g, ''), /showActionSheet|管理已有订阅/)
  assert.match(list, /function openSubscribe\(\) \{\n  if \(notify\.value\) return go\(R\.jobsFilter \+ '\?s=2&cur=1'\)\n  openNewSub\(\)\n\}/)
})

test('订阅页不管从哪进来都先查当前订阅，有就编辑那一条（保存走修改）；cur=1 时加载中标题也写「当前订阅」', () => {
  assert.match(filter, /:title="currentSubId \|\| \(subLoading && expectCurrent\) \? '当前订阅' : '新机会订阅'"/)
  assert.match(filter, /currentSubId\.value \? apiEditJobSub\(currentSubId\.value, payload\) : apiAddJobSub\(payload\)/)
  assert.match(filter, /const openSubscribe = async \(\) => \{[^\n]*await loadCurrentSubscription\(\) \}/)
  // 带 addCity 进来：已有且限定城市就加进去；不限城市的不收窄；线上任务不分城市
  assert.match(filter, /if \(addCity && sub\.jobType !== 'online' && \(!row \|\| sub\.cities\.length\) && !sub\.cities\.includes\(addCity\)\)/)
  // 加载失败时保存按钮不可点：查不清有没有订阅时不会误建第二条
  assert.match(filter, /:disabled="savingSub \|\| subLoading \|\| !!subLoadError"/)
})

test('老数据有好几条订阅时取生效中最新的一条；门店关注不算订阅', () => {
  const rows = [
    { subId: 3, status: '1', cities: '大理' },
    { subId: 5, status: '0', cities: '丽江' },
    { subId: 9, status: '0', storeId: 7 },
    { subId: 4, status: '0', cities: '平潭' }
  ]
  assert.equal(currentJobSubscription(rows).subId, 5)
  assert.equal(currentJobSubscription([{ subId: 3, status: '1', cities: '大理' }, { subId: 6, status: '1', cities: '丽江' }]).subId, 6)
  assert.equal(currentJobSubscription([{ subId: 9, status: '0', storeId: 7 }]), null)
})

test('城市负责人卡片：当前订阅已管到本城就算已订阅；已有别的订阅时去「当前订阅」加城市，不再另建一条', () => {
  const sub = (o) => ({ subId: 1, status: '0', cities: '丽江,平潭', jobTypes: 'volunteer', ...o })
  assert.equal(coveredBySubscription(sub({}), '平潭岛'), true)
  assert.equal(coveredBySubscription(sub({ cities: '' }), '平潭'), true)
  assert.equal(coveredBySubscription(sub({ cities: '丽江' }), '平潭'), false)
  assert.equal(coveredBySubscription(sub({ jobTypes: 'online' }), '平潭'), false)
  assert.equal(coveredBySubscription(sub({ jobTypes: '咖啡,前台' }), '平潭'), true)
  assert.equal(coveredBySubscription(sub({ status: '1' }), '平潭'), false)
  assert.equal(coveredBySubscription(null, '平潭'), false)
  assert.match(coordinator, /else if \(wantSubscribe && !has && mine\) \{\n[^\n]*\n\s*go\(R\.jobsFilter \+ '\?s=2&cur=1&addCity=' \+ encodeURIComponent\(cityName\.value\)\)/)
  assert.match(coordinator, /\} else if \(wantSubscribe && !has\) \{\n\s*const payload = localSubscriptionPayload/)
  // 城市页「订阅新机会」：已有订阅也是去改当前那条
  assert.match(homeCity, /if \(mine\.length\) return go\(R\.jobsFilter \+ '\?s=2&cur=1&addCity=' \+ encodeURIComponent\(c\)\)\n\s*await apiAddJobSub/)
})

test('筛选是半屏弹层，选城市是全屏弹层：定高（小程序 scroll-view 要确定高度）、条件区自己滚、按钮固定在底部、点暗处关', () => {
  assert.match(panel, /\.fp \{ display: flex; flex-direction: column; height: 56vh; max-height: 56vh;/)
  assert.match(panel, /<scroll-view class="fp__body" scroll-y/)
  assert.match(panel, /\.fp__body \{ flex: 1; height: 0; min-height: 0;/)
  assert.match(panel, /\.fp__foot \{ flex-shrink: 0;/)
  assert.match(list, /<view v-if="filterOpen" class="jobs-filter-mask" @click="filterOpen = false" @touchmove\.stop\.prevent \/>/)
  assert.match(list, /\.jobs-filter \{ position: fixed; left: 0; right: 0; bottom: 0; z-index: 81;/)
  assert.match(cityPanel, /\.cp \{ position: fixed; left: 0; right: 0; bottom: 0; height: 100vh; max-height: 100vh;/)
  assert.match(cityPanel, /<view class="cp-mask" @click="emit\('close'\)" @touchmove\.stop\.prevent \/>/)
  assert.match(cityPanel, /\.cp__body \{[^}]*flex: 1; height: 0; min-height: 0;/)
  // 小程序锁背景滚动仍是 page-meta
  assert.match(list, /<page-meta :page-style="noticePopup\.show \|\| cityOpen \|\| filterOpen \? 'overflow: hidden' : ''" \/>/)
})

test('卡片按参考图：封面约 100px、标题 17px、条件 13px，排班和房型并一行', () => {
  assert.match(premium, /\.card--photo \.card__left \{ height: 200rpx; min-height: 90px; max-height: 120px;/)
  assert.match(premium, /\.card--photo \.title \{ font-size: 17px;/)
  assert.match(list, /fact\(j\.restModeLabel \? 'calendar' : 'bed-double', \[j\.restModeLabel, j\.roomTypeLabel\]\.filter\(Boolean\)\.join\(' · '\)\)/)
  assert.match(premium, /\.card \.title \{[^}]*font-size: 15px;/)
  assert.match(premium, /\.card__fact \{[^}]*min-height: 26px;[^}]*font-size: 13px;/)
  assert.match(premium, /\.job-kind\.active \{ font-size: 16px;/)
  assert.match(premium, /\.job-kind \{ height: 38px; font-size: 15px;/)
})
