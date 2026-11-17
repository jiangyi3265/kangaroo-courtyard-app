// 内测反馈 2.0（10-16）活动 / 旅居相关（node --test，不构建、不发请求）：
//   (a1) 集合地点：小程序里活动标了地图位置就打开微信地图，没标或在网页版就复制地址；员工端、用户发起都能在地图上选集合点（选填，网页版不显示）
//   (a2) 活动详情大图、报名凭证图用 absUrl（员工上传的 /profile/upload/… 相对路径在小程序里是空白）
//   (b)  卡片上收藏、卡片带报名截止；「我的活动」加「收藏」页签（GET /app/activities/favorites）
//   (c)  社区里从没选过城市时，活动列表跟首页城市走（不再落到写死的「大理」）
//   (d)  订单页没有住客群码时只写一句话 + 大一点的「联系门店」
//   (e)  房源详情：网页版一律复制地址（门店坐标兜底在服务端，KgStayDetailMapPointTest）
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'

const APP = fileURLToPath(new URL('..', import.meta.url))
const read = (rel) => readFileSync(join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const between = (s, a, b) => {
  const i = s.indexOf(a)
  const j = s.indexOf(b, i + a.length)
  assert.ok(i >= 0 && j > i, `找不到 ${a} … ${b}`)
  return s.slice(i, j)
}
/** 按平台处理脚本里的条件编译（只处理 H5 / 非 H5 两种写法） */
const cond = (code, h5) => code
  .replace(/\/\/ #ifdef H5\n([\s\S]*?)\/\/ #endif\n?/g, (_, body) => (h5 ? body : ''))
  .replace(/\/\/ #ifndef H5\n([\s\S]*?)\/\/ #endif\n?/g, (_, body) => (h5 ? '' : body))
const tplOf = (src) => parse(src).descriptor.template.content

const activity = read('pages/community/activity.vue')
const mine = read('pages/community/activity-mine.vue')
const staff = read('pages/staff/activities.vue')
const stayDetail = read('pages/stays/detail.vue')
const order = read('pages/stays/order.vue')

// ---------------------------------------------------------------- (a1) 集合地点

function placeHarness(h5) {
  const code = cond(between(activity, 'let mapOk = true', 'const hostLogo'), h5)
  const calls = { open: [], copy: [], toast: [] }
  const uni = { openLocation: (o) => calls.open.push(o) }
  const copy = async (text, tip) => { calls.copy.push({ text, tip }); return true }
  const toast = (t) => calls.toast.push(t)
  const api = new Function('uni', 'copy', 'toast', code + ';return { openPlace, placeTag, meetPoint, placeText }')(uni, copy, toast)
  return { ...api, calls }
}
const withPoint = { place: '袋鼠小院门口', city: '平潭', title: '万圣节', meetLat: 25.510123, meetLng: 119.7912 }
const noPoint = { place: '袋鼠小院门口', city: '平潭', title: '万圣节', meetLat: null, meetLng: null }

test('(a1) 小程序：标了地图位置点集合地点打开微信地图，没标就复制「城市 + 集合地点」', async () => {
  const h = placeHarness(false)
  assert.equal(h.placeTag(withPoint), '地图')
  assert.equal(h.placeTag(noPoint), '复制')
  h.openPlace(withPoint)
  assert.equal(h.calls.open.length, 1)
  assert.equal(h.calls.open[0].latitude, 25.510123)
  assert.equal(h.calls.open[0].longitude, 119.7912)
  assert.equal(h.calls.open[0].name, '袋鼠小院门口')
  assert.equal(h.calls.open[0].address, '平潭 袋鼠小院门口')
  await h.openPlace(noPoint)
  assert.deepEqual(h.calls.copy, [{ text: '平潭 袋鼠小院门口', tip: '主办方没标地图位置，集合地点已复制' }])
  // 0,0 / 半个点 / 乱码都当没标
  for (const bad of [{ meetLat: 0, meetLng: 0 }, { meetLat: 25.5, meetLng: null }, { meetLat: 'x', meetLng: 'y' }, { meetLat: '', meetLng: '' }]) assert.equal(h.meetPoint(bad), null)
  // 集合地点里已经写了城市就不再重复
  assert.equal(h.placeText({ place: '平潭袋鼠小院门口', city: '平潭' }), '平潭袋鼠小院门口')
})

test('(a1) 网页版：没有地图 key，有坐标也只复制地址', async () => {
  const h = placeHarness(true)
  assert.equal(h.placeTag(withPoint), '复制')
  await h.openPlace(withPoint)
  assert.equal(h.calls.open.length, 0)
  assert.deepEqual(h.calls.copy, [{ text: '平潭 袋鼠小院门口', tip: '集合地点已复制，可在地图 App 里搜索' }])
})

test('(a1) 详情和报名凭证的「集合」行都能点，行尾写「地图 / 复制」', () => {
  const t = tplOf(activity)
  assert.match(t, /<view class="detail-line detail-line--tap" hover-class="k-press" @click="openPlace\(detail\)">[^\n]*集合：\{\{ detail\.place \}\}<\/text><text class="place-tag">\{\{ placeTag\(detail\) \}\}<\/text><\/view>/)
  assert.match(t, /<view class="detail-line detail-line--tap" hover-class="k-press" @click="openPlace\(ticket\)">[^\n]*集合：\{\{ ticket\.place \}\}<\/text><text class="place-tag">\{\{ placeTag\(ticket\) \}\}<\/text><\/view>/)
  assert.doesNotMatch(t, /<text[^>]*hover-class/, 'text 上不放 hover-class')
})

test('(a1) 员工端、用户发起都能在地图上选集合点：只在小程序里显示，选了才带 meetLat / meetLng，清除时带一对 null', () => {
  for (const [name, src] of [['员工端', staff], ['用户发起', mine]]) {
    const t = tplOf(src)
    // 2026-11-03 主人：地点和地图位置合成一行 —— 点地点那一行就打开微信地图选点（名称、地址、坐标一起填）；网页版没有地图，直接写文字
    assert.match(t, /@click="pickPlace"/, name)
    assert.doesNotMatch(t, /@click="pickMeetPoint"|在地图上选集合点（选填）/, name)
    assert.match(src, /uni\.chooseLocation\(\{ \.\.\.\(meet\.value \|\| \{\}\), success: resolve, fail: reject \}\)/, name)
    const fn = between(src, 'async function pickPlace() {', '\n}\n')
    assert.match(fn, /^async function pickPlace\(\) \{\n {2}let map = false\n {2}\/\/ #ifndef H5\n {2}map = true\n {2}\/\/ #endif\n {2}if \(!map\) return editPlaceText\(\)\n/, name)
    assert.match(fn, /return pickMeetPoint\(\)/, name)
    const line = src.split('\n').find(l => l.includes('if (meet.value || hadMeet) Object.assign(payload'))
    assert.ok(line, name)
    const run = (meet, hadMeet) => { const payload = {}; new Function('meet', 'hadMeet', 'payload', line)({ value: meet }, hadMeet, payload); return payload }
    assert.deepEqual(run(null, false), {}, `${name}：没选点不带这两个键（服务端保持不变）`)
    assert.deepEqual(run({ latitude: 25.5, longitude: 119.7 }, false), { meetLat: 25.5, meetLng: 119.7 }, name)
    assert.deepEqual(run(null, true), { meetLat: null, meetLng: null }, `${name}：原来有点、清除后保存`)
    // 修改时回填原来的点
    assert.match(src, /meet\.value = validPoint\(a\.meetLat, a\.meetLng\)\n\s+hadMeet = !!meet\.value/, name)
  }
  // 员工端草稿也存地图位置；「更换封面」那种整条保存不带坐标（服务端不动原来的点）
  assert.match(staff, /intro: intro\.value, meet: meet\.value \}\)/)
  // 2026-11-03：「相册管理（更换封面）」并进「修改活动」，那条单独换封面的整条保存（editPayload / changeCover）已删掉
  assert.doesNotMatch(staff, /const editPayload = |async function changeCover/)
})

// ---------------------------------------------------------------- (a2) 图片地址

test('(a2) 详情大图、报名凭证图先补全成服务器地址', () => {
  const t = tplOf(activity)
  assert.match(t, /<image class="detail-hero" :src="detail\.img \? absUrl\(detail\.img\) : '\/static\/media\/cover-empty\.png'"/)
  assert.match(t, /<image class="ticket-img" :src="ticket\.img \? absUrl\(ticket\.img\) : '\/static\/media\/cover-empty\.png'"/)
  assert.doesNotMatch(t, /:src="(detail|ticket)\.img \|\|/)
})

// ---------------------------------------------------------------- (b) 收藏

test('(b) 列表卡片：封面右上角的心（不触发进详情），报名中且设了截止时间才多一行截止', () => {
  const t = tplOf(activity)
  assert.match(t, /<view class="fav-dot" hover-class="k-press" @click\.stop="toggleFav\(item\)"><k-icon name="heart"[^>]*:fill="!!item\.favorited"/)
  assert.match(t, /<view v-if="item\.deadlineLine" class="meta meta--deadline">/)
  const deadlineLine = new Function(between(activity, 'const deadlineLine = ', '\n') + ';return deadlineLine')()
  assert.equal(deadlineLine({ phase: 'open', deadlineText: '10月30日 18:00' }), '截止 10月30日 18:00')
  assert.equal(deadlineLine({ phase: 'open', deadlineText: '开始前' }), '')
  assert.equal(deadlineLine({ phase: 'closed', deadlineText: '10月30日 18:00' }), '')
  // 收藏后改的是列表里的原数据（卡片是 computed 副本），详情页收藏也同步回列表
  const fn = between(activity, 'async function toggleFav(item) {', '\n}\n')
  assert.match(fn, /for \(const g of list\.value\.groups \|\| \[\]\) for \(const x of g\.items \|\| \[\]\) if \(x\.activityId === item\.activityId\) x\.favorited = res\.favorited/)
  assert.match(between(activity, 'async function favorite() {', '\n}\n'), /x\.favorited = res\.favorited/)
})

test('(b) 我的活动加「收藏」页签：调 /app/activities/favorites，?tab=fav 直接停在这一页，卡片只有取消收藏 / 查看详情', () => {
  assert.match(mine, /const mineTabs = \['已报名', '已完成', '我发起的', '收藏'\]/)
  assert.match(mine, /收藏: 'fav' \}/)
  assert.match(mine, /tab === '收藏' \? \(await get\('\/app\/activities\/favorites'\)\)\.data/)
  assert.match(mine, /import \{ get \} from '@\/common\/request\.js'/)
  assert.match(mine, /const tabName = Object\.keys\(TAB\)\.find\(k => TAB\[k\] === q\?\.tab\)\n\s+if \(tabName\) mineTab\.value = tabName/)
  const t = tplOf(mine)
  assert.match(t, /<view v-if="item\.fav" class="mine-actions" @click\.stop><k-button[^>]*@click\.stop="unfavorite\(item\)">取消收藏<\/k-button>/)
  assert.match(t, /:class="\{ 'mine-card--ended': item\.ended \}"/)
  assert.match(mine, /\.mine-card--ended\{opacity:\.6\}/)
  // 收藏页的卡片下方一行写报名截止
  assert.match(mine, /\{ \.\.\.x, fav: true, attend: x\.deadlineNote \|\| '' \}/)
})

// ---------------------------------------------------------------- (c) 城市

test('(c) 活动列表起步城市：社区选过的优先，没选过跟首页城市走，首页没城市 / 选了全部城市就是全部城市（不再是大理）', () => {
  const code = between(activity, 'const savedCommunityCity = () => {', 'const city = ref(startCity())')
  const make = (stored, exp) => new Function('uni', 'experience', code + ';return { startCity, queryCity }')({ getStorageSync: (k) => stored[k] }, exp)
  const acc = { account: { id: 7 }, cities: ['厦门'], allCities: false }
  assert.equal(make({ 'kangaroo:7:community-city': '丽江' }, acc).startCity(), '丽江')
  assert.equal(make({ 'kangaroo:7:community-city': '全部城市' }, acc).startCity(), '全部城市')
  assert.equal(make({}, acc).startCity(), '厦门')
  assert.equal(make({}, { ...acc, allCities: true }).startCity(), '全部城市')
  assert.equal(make({}, { account: null, cities: [], allCities: false }).startCity(), '全部城市')
  assert.equal(make({ 'kangaroo:guest:community-city': '大理' }, { account: null, cities: ['厦门'] }).startCity(), '大理')
  assert.equal(make({}, acc).queryCity({ city: '%E5%B9%B3%E6%BD%AD' }), '平潭')
  assert.equal(make({}, acc).queryCity({ city: '平潭' }), '平潭')
  assert.equal(make({}, acc).queryCity({}), '')
  // 本机键名和 common/community.js 的 communityCityKey 一致
  assert.match(read('common/community.js'), /const communityCityKey = \(\) => `kangaroo:\$\{experience\.account\?\.id \|\| 'guest'\}:community-city`/)
  assert.match(code, /uni\.getStorageSync\(`kangaroo:\$\{experience\.account\?\.id \|\| 'guest'\}:community-city`\)/)
  // 登录态恢复后（扫码落地的分支之后）再定一次
  assert.match(activity, /if \(Number\(q\?\.signupId\)\) return openTicket\(Number\(q\.signupId\)\)\n[^\n]*\n\s+city\.value = queryCity\(q\) \|\| startCity\(\)/)
  assert.doesNotMatch(activity, /communityCity\(\)/)
})

// ---------------------------------------------------------------- (d) 住客群

test('(d) 订单页没有群码：只写一句话 + 大号「联系门店」，不再显示「门店未设有效期」和长按保存', () => {
  const t = tplOf(order)
  const withQr = between(t, '<template v-if="group.qrUrl">', '</template>')
  assert.match(withQr, /\{\{ qrNote \}\}/)
  assert.match(withQr, /无法识别二维码？/)
  assert.match(t, /<view v-else class="no-qr"><text class="no-qr__text">门店暂未提供住客群，可点「联系门店」<\/text><k-button size="lg" block icon="phone" @click="callStore">联系门店<\/k-button><\/view>/)
  const outside = t.replace(withQr, '').replace(/<!--[\s\S]*?-->/g, '')
  assert.doesNotMatch(outside, /qrNote|长按保存|expireText/)
  assert.doesNotMatch(between(order, 'const expireText = computed(', '\n'), /门店暂未提供/)
})

// ---------------------------------------------------------------- (e) 房源地图

test('(e) 房源详情：地址打开目的地地图，复制按钮独立阻止冒泡，不把用户当前位置当目的地', () => {
  const tpl = tplOf(stayDetail)
  assert.match(tpl, /class="location" @click="openMap">/)
  assert.match(tpl, /class="location-action" @click.stop="copyAddress"/)
  assert.match(tpl, /<text>复制地址<\/text>/)
  assert.match(stayDetail, /const mapPoint = computed\(\(\) => coordinates\(d.value\)\)/)
  assert.match(stayDetail, /return city && !locationText\.value\.includes/)
  const map = between(stayDetail, 'const openMap = () => {', '\n}\n')
  assert.match(map, /stayMapUrl\(\{ \.\.\.d\.value, address: searchAddress\.value \}\)/)
  assert.match(map, /window\.location\.assign\(url\)/)
  assert.match(map, /openNativePlace\(d\.value, uni, toast\)/)
  assert.doesNotMatch(map, /getLocation|chooseLocation/)
})
