// 2026-10-17 社区 / 发布页改版（主人豆包效果图 图 1、图 3）：
//   · 找搭子自动识别没命中时话题是「其他」：标题不再显示成「其他｜酒吧」，只显示标题（卡片 / 详情 / 我的发布同一个 titleOf，服务端也不再给）；
//   · 「旅居日常」改名「旅居日常」（代码还是 daily，老帖子、老草稿自动变成新名字）；
//   · 发布页：顶栏右上「草稿箱」、三个大类型胶囊、白卡（图片 / 标题 0/60 / 正文 0/500，每类自己的提示字）、
//     「关联帖子」「补充信息」两张可展开的卡、底部固定「存草稿 / 发布」，不再写死 font-family: sans-serif；
//   · 关联：只关联 小院 / 门店、岗位、活动（不关联别人的帖子），存在 refType / refId；经验分享的 ref 还是经历那段报名；
//   · 发出去进「发布成功」页（发布成功 / 已提交审核、已关联到 XXX、查看帖子 / 继续发布 / 回社区）；
//   · 两个新页面（关联选择页、发布成功页）都在 community 分包里（主包没地方了）。
//   · r2（V52）：关联单独存 link_type / link_id，经验分享也能自己选（不选照旧自动关联经历的岗位）；发布带 linkType / linkId，
//     找搭子 / 旅居日常另外照旧带 refType / refId（老后端照样认，老版本小程序只带 refType / refId 新后端也认）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  FEED_TABS, FEED_KIND, PUBLISH_TYPES, PUBLISH_KIND, SEARCH_PLACEHOLDER, restoreType, titleOf, topicOf
} from '../pages/community/community-feed.js'
import {
  LINK_TABS, LINK_TYPES, linkRoute, linkView, linkPayload, restoreLink, openLinkPicker, finishLinkPicker, linkRequest,
  rememberPublished, publishedOf, publishedUrl, publishedText, DIARY_AUTO_LINK_HINT
} from '../pages/community/post-link.js'

const require = createRequire(import.meta.url)
const { parse } = require('@vue/compiler-sfc')
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const icons = (await import('../common/icons.js')).default
const index = await read('../pages/community/index.vue')
const publish = await read('../pages/community/publish.vue')
const mine = await read('../pages/community/mine.vue')
const linkPage = await read('../pages/community/link.vue')
const donePage = await read('../pages/community/published.vue')
const postLinkJs = await read('../pages/community/post-link.js')
const api = await read('../common/api.js')
const pagesJson = JSON.parse(await read('../pages.json'))
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const postJava = await read(javaRoot + 'ext/community/KgPostService.java')
const ctlJava = await read(javaRoot + 'controller/app/AppCommunityController.java')
const moduleJava = await read(javaRoot + 'ext/community/KgCommunityModule.java')
const tpl = (src) => parse(src).descriptor.template.content
const noComments = (s) => s.replace(/<!--[\s\S]*?-->/g, '')
const css = (src) => parse(src).descriptor.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
const script = (src) => parse(src).descriptor.scriptSetup.content
const screen1 = (src) => { const t = tpl(src); return t.slice(t.indexOf('<template v-if="s === 1">'), t.indexOf('<template v-else-if="s === 2">')) }

// ---------------------------------------------------------------- 「其他｜」前缀

test('标题：话题是「其他」时不加前缀，只显示标题；别的话题照旧「话题｜标题」', () => {
  assert.equal(titleOf({ topicLabel: '其他', title: '酒吧' }), '酒吧', '老接口还会给「其他」')
  assert.equal(titleOf({ topicLabel: '拼饭', title: '一起吃火锅' }), '拼饭｜一起吃火锅')
  assert.equal(titleOf({ topicLabel: '线下兼职', title: '咖啡店的一个月' }), '线下兼职｜咖啡店的一个月')
  assert.equal(titleOf({ topicLabel: '', title: '洱海日落' }), '洱海日落')
  assert.equal(titleOf({ title: '没有话题' }), '没有话题')
  assert.equal(titleOf(null), '')
  assert.equal(topicOf({ topicLabel: '其他' }), '')
  // 卡片、详情、我的发布都用这一个
  assert.match(index, /titleText: displayWording\(titleOf\(p\), \[p\.author\?\.name\]\)/)
  assert.match(index, /<k-display-text class="detail__title" :value="titleOf\(detail\)/)
  assert.match(mine, /<text class="my-post-title">\{\{ displayWording\(titleOf\(post\), \[post\.author\?\.name\]\) \}\}<\/text>/)
  const original = Object.freeze({ title: '义工经历', topicLabel: '其他' })
  assert.equal(titleOf(original), '义工经历', '标题组合函数仍保留原文，只在模板展示时更新称呼')
  assert.equal(original.title, '义工经历')
  assert.match(mine, /import \{ titleOf, kindOf \} from '\.\/community-feed\.js'/)
  assert.doesNotMatch(mine, /post\.topicLabel \+ '｜'/)
  // 服务端：分类是 other 不当话题（老版本小程序也跟着好），找搭子列表的分类小标签照旧
  assert.match(postJava, /String cat = "other"\.equals\(str\(r\.get\("category"\)\)\) \? null : CATEGORY_LABEL\.get\(str\(r\.get\("category"\)\)\);/)
  assert.match(postJava, /CATEGORY_LABEL\.put\("other", "其他"\);/)
})

// ---------------------------------------------------------------- 改名

test('旅居日常：沿用 daily 数据和旧草稿，后端旧标签保持兼容', () => {
  assert.deepEqual(FEED_TABS, ['全部', '找搭子', '旅居日常', '经验分享'])
  assert.equal(FEED_KIND['旅居日常'], 'daily')
  assert.deepEqual(PUBLISH_TYPES.map(t => t.name), ['找搭子', '经验分享', '旅居日常'])
  assert.equal(PUBLISH_KIND['旅居日常'], 'daily')
  assert.equal(SEARCH_PLACEHOLDER, '搜索搭子、旅居日常、经验分享')
  assert.doesNotMatch(SEARCH_PLACEHOLDER, /活动/, '活动搜不到，提示字不写「活动」')
  // 老草稿存的类型名
  assert.equal(restoreType('旅居攻略'), '旅居日常')
  assert.equal(restoreType('换工日记'), '经验分享')
  assert.equal(restoreType('义工日记'), '经验分享')
  // 界面上（注释不算）不再出现旧名字
  for (const [name, src] of [['index', index], ['publish', publish], ['mine', mine], ['link', linkPage], ['published', donePage]]) {
    assert.doesNotMatch(noComments(tpl(src)), /旅居攻略/, name)
  }
  assert.match(tpl(index), /placeholder="搜索搭子、旅居日常、经验分享"/)
  assert.match(index, /'这里还没有旅居日常'/)
  assert.match(mine, /<text>找搭子 · 旅居日常 · 经验分享<\/text>/)
  assert.match(postJava, /KIND_LABEL\.put\("daily", "旅居攻略"\);/)
  assert.doesNotMatch(postJava, /KIND_LABEL\.put\("daily", "旅居日常"\)/)
  assert.match(moduleJava, /"daily:旅居攻略,buddy:找搭子,diary:经验分享"/)
  // 发布页按新名字分支：旅居日常直接发、伙伴说只在旅居日常下
  assert.match(publish, /if \(type\.value === '旅居日常'\) return submit\(\)/)
  // 2026-11-03 简化：伙伴说是页面内按钮组（原来点一行弹底部菜单）
  assert.match(tpl(publish), /<view v-if="type === '旅居日常'" class="publish-opt">[^\n]*v-for="t in TONES"[^\n]*@click="tone = t\.key"/)
})

// ---------------------------------------------------------------- 发布页布局

test('发布页：顶栏显示当前类型并可返回，草稿箱、类型、图片和正文可用', () => {
  const t = screen1(publish)
  // 2026-10-17 主人真机截图：草稿箱放在顶栏右边会被系统胶囊挤到中间压住标题，挪到正文第一行右边
  assert.match(t, /<k-topbar :title="type" back \/>/)
  assert.match(t, /<view class="pub-tools"><view class="drafts" hover-class="k-press" @click="openDraft">[\s\S]*?<text>草稿箱<\/text>/)
  assert.match(t, /<view v-for="item in types" :key="item\.name" class="type-pill" :class="\{ active: type === item\.name \}" hover-class="k-press-s" @click="pickType\(item\.name\)"><text>\{\{ item\.name \}\}<\/text><\/view>/)
  assert.match(t, /<view class="compose">/)
  assert.match(t, /class="media-empty" hover-class="k-press" @click="addImages"[\s\S]*?<text class="media-empty__title">添加照片<\/text><text class="media-empty__sub">最多 9 张，第一张是封面<\/text>/)
  assert.match(t, /class="cover__edit" hover-class="k-press-s" @click="replaceCover"[\s\S]*?<text>更换封面<\/text>/)
  assert.match(t, /v-if="uploads\.length < 9" class="upload-add" hover-class="k-press" @click="addImages"/)
  assert.match(t, /<text class="field-label">标题<\/text><text class="counter">\{\{ title\.length \}\}\/60<\/text>[\s\S]*?<input v-model="title" maxlength="60" :placeholder="typeInfo\.titlePh"/)
  assert.match(t, /<text class="field-label">正文<\/text><text class="counter">\{\{ body\.length \}\}\/500<\/text>[\s\S]*?<textarea v-if="editingBody" v-model="body" maxlength="500"[^>]*:placeholder="typeInfo\.bodyPh"/)
  // 不打字时正文是一块替身（原生 textarea 会盖住底部操作条），空着时显示提示字
  assert.match(t, /<view v-else class="publish-area-idle" @click="editingBody = true"><text :class="\{ 'publish-area-ph': !body \}">\{\{ body \|\| typeInfo\.bodyPh \}\}<\/text><\/view>/)
  for (const icon of ['file-pen', 'image-plus', 'pencil', 'link', 'sliders-horizontal', 'chevron-up', 'chevron-down', 'store', 'briefcase-business', 'calendar-days', 'house', 'clock', 'check']) assert.ok(icons[icon], icon)
})

test('每个类型自己的标题 / 正文提示字和「补充信息」副标题', () => {
  const by = Object.fromEntries(PUBLISH_TYPES.map(t => [t.name, t]))
  assert.equal(by['找搭子'].titlePh, '给这次出发起个标题')
  assert.equal(by['找搭子'].bodyPh, '说说你想去哪里、想找什么样的同行伙伴')
  assert.equal(by['经验分享'].titlePh, '分享你的真实经历')
  assert.equal(by['旅居日常'].titlePh, '记录今天的旅居日常')
  for (const t of PUBLISH_TYPES) {
    assert.ok(t.bodyPh && t.extraSub && icons[t.icon], t.name)
    assert.ok(t.titlePh.length <= 20, '提示字一行放得下')
  }
  assert.match(publish, /const typeInfo = computed\(\(\) => types\.find\(t => t\.name === type\.value\) \|\| types\[0\]\)/)
})

test('「关联帖子」「补充信息」两张可展开的卡；补充信息保留城市 / 日期 / 性别 / 伙伴说', () => {
  const t = screen1(publish)
  assert.match(t, /<view class="fold link-card" hover-class="k-press-s" @click="pickLink">[\s\S]*?关联帖子<text class="fold__opt">（选填）<\/text>/)
  assert.match(t, /<text class="link-pick__on">已关联<\/text><view class="link-pick__x" hover-class="k-press" hover-stop-propagation @click\.stop="clearLink"><text>不关联<\/text><\/view>/)
  // r2：经验分享也是同一张能点的卡（不再单独一张点不了的），没选时提示会自动关联经历的岗位
  assert.doesNotMatch(t, /<view v-if="type === '经验分享'" class="fold link-card">/)
  assert.equal((t.match(/class="fold link-card"/g) || []).length, 1)
  assert.match(t, /<text v-if="!link0" class="fold__sub">\{\{ linkSub \}\}<\/text>/)
  const extra = t.slice(t.indexOf('<view class="fold extra">'))
  assert.match(extra, /<view class="fold__head" hover-class="k-press" @click="extraOpen = !extraOpen">[\s\S]*?补充信息<text class="fold__opt">（选填）<\/text>[\s\S]*?\{\{ extraOpen \? typeInfo\.extraSub : extraSummary \}\}/)
  assert.match(extra, /<view v-if="extraOpen" class="fold__body">/)
  for (const fn of ['pickCity', 'pickDate']) assert.match(extra, new RegExp(`class="publish-row" hover-class="k-press" @click="${fn}"`), fn)
  // 保留同行性别和伙伴说的页面内按钮组。
  for (const [list, model] of [['GENDER_LIMITS', 'genderLimit'], ['TONES', 'tone']]) assert.match(extra, new RegExp(`class="publish-opt">[^\\n]*v-for="\\w+ in ${list}"[^\\n]*@click="${model} = `), list)
  assert.doesNotMatch(publish, /pickBuddyCat|pickBuddyDays|pickGenderLimit|pickTone/)
  assert.match(publish, /const extraOpen = ref\(false\)/, '默认收起')
  // 收起时副标题写着现在选的
  assert.match(publish, /const out = \[city\.value, dateLabel\.value\]/)
  // 原来的「关联订单或岗位」（自己的报名 / 订单，发出去哪里都不显示）换成了关联帖子
  assert.doesNotMatch(noComments(tpl(publish)), /关联订单或岗位/)
  assert.doesNotMatch(script(publish), /apiPostRefs|pickRef\b|ref0/)
})

test('底部固定「存草稿 / 发布」，这一屏不放底部导航；旅居日常写「发布」，要再走一步的写「下一步」', () => {
  const t = screen1(publish)
  assert.match(t, /<view class="pbar">\s*<view class="pbar__row">\s*<view class="pbar__draft" hover-class="k-press" @click="saveDraft"><text>存草稿<\/text><\/view>\s*<view class="pbar__go"[^>]*hover-class="k-press-s" @click="next"><text>\{\{ nextLabel \}\}<\/text><\/view>/)
  assert.doesNotMatch(t, /<k-tabbar/, '和底部操作条叠在一起太挤')
  assert.match(publish, /const nextLabel = computed\(\(\) => submitting\.value \? '发布中…' : \(type\.value === '旅居日常' \? '发布' : '下一步'\)\)/)
  const c = css(publish)
  assert.match(c, /\.pbar \{ position: fixed; left: 0; right: 0; bottom: 0;/)
  assert.match(c, /\.pbar__go \{[^}]*background: var\(--k-red\);/)
  assert.match(c, /\.type-pill\.active \{ background: var\(--k-red\); color: var\(--k-paper\);/)
  // 字体：不再写死 sans-serif，跟全站系统黑体走；也不加载网络字体
  assert.doesNotMatch(publish, /font-family: sans-serif/)
  for (const src of [publish, index, linkPage, donePage]) assert.doesNotMatch(src, /@font-face|fonts\.googleapis|\.woff/)
  // 原来的流程都还在：经验分享走经历校验，找搭子先查手机验证再同步活动板
  const s = script(publish)
  assert.match(s, /if \(type\.value === '经验分享'\) \{ loadExperiences\(\); s\.value = 3; return \}/)
  assert.match(s, /s\.value = phoneVerified\.value \? 4 : 2/)
  assert.match(s, /submit\(\{ refType: 'application', refId: hit\.appId \}\)/)
  assert.match(s, /toast\('请选择一段经历'\)/)
})

test('经验分享的「选择经历类型」只是预选：经历校验把这一类排前面、先选上，规则还是必须选一段报名', () => {
  const t = screen1(publish)
  assert.match(t, /<text class="exp-types__label">选择经历类型<\/text>[\s\S]*?<view v-for="j in EXP_TYPES" :key="j\.key" class="exp-type-pill" :class="\{ on: expType === j\.key \}" hover-class="k-press" @click="pickExpType\(j\.key\)">/)
  const s = script(publish)
  assert.match(s, /const EXP_TYPES = JOB_CHIPS\.filter\(j => j\.key\)/)
  assert.match(s, /return expType\.value \? \[\.\.\.list\.filter\(x => x\.jobType === expType\.value\), \.\.\.list\.filter\(x => x\.jobType !== expType\.value\)\] : list/)
  assert.match(s, /if \(hit\) selected\.value = hit\.appId/)
  // 发布按钮照旧要选了经历才能点
  assert.match(tpl(publish), /<k-button size="lg" block :disabled="!selected" @click="submitDiary">发布<\/k-button>/)
})

// ---------------------------------------------------------------- 关联

test('关联的跳转地址：小院详情 / 门店在招岗位 / 岗位详情 / 活动详情；不认识的不给入口', () => {
  assert.deepEqual(LINK_TYPES, ['stay', 'store', 'job', 'activity'])
  assert.equal(linkRoute({ type: 'stay', id: 3 }), '/pages/stays/detail?stayId=3')
  assert.equal(linkRoute({ type: 'store', id: 4 }), '/pages/profile/follows?storeId=4')
  assert.equal(linkRoute({ type: 'job', id: 5 }), '/pages/jobs/detail?jobId=5')
  assert.equal(linkRoute({ type: 'activity', id: 6 }), '/pages/community/activity?id=6&channel=community')
  assert.equal(linkRoute({ type: 'post', id: 7 }), '', '不关联别人的帖子')
  assert.equal(linkRoute({ type: 'stay' }), '')
  assert.equal(linkRoute(null), '')
  const v = linkView({ type: 'job', id: '5', title: ' 前台换宿 ', label: '换宿旅行', city: '大理' })
  assert.deepEqual(v, { type: 'job', id: 5, title: '前台换宿', cover: '', city: '大理', label: '换宿旅行', sub: '', to: '/pages/jobs/detail?jobId=5' })
  assert.equal(linkView({ type: 'stay', id: 3, title: '小院' }).label, '小院', '没给小标签按类型补')
  assert.equal(linkView({ type: 'stay_order', id: 3, title: '我的订单' }), null, '自己的订单不公开')
  assert.equal(linkView({ type: 'stay', id: 3, title: '  ' }), null)
})

test('发布带的字段：选了才带 linkType / linkId（r2），找搭子 / 旅居日常另带 refType / refId；经验分享不带 ref（ref 是经历那段报名）', () => {
  const link = { type: 'stay', id: 3, title: '平潭袋鼠小院' }
  assert.deepEqual(linkPayload('daily', link), { refType: 'stay', refId: 3, linkType: 'stay', linkId: 3 })
  assert.deepEqual(linkPayload('buddy', { type: 'activity', id: 8, title: '骑行' }), { refType: 'activity', refId: 8, linkType: 'activity', linkId: 8 })
  assert.deepEqual(linkPayload('diary', link), { linkType: 'stay', linkId: 3 })
  assert.deepEqual(linkPayload('diary', null), {}, '经验分享没选：不带，服务端自动关联经历的岗位')
  assert.deepEqual(linkPayload('daily', null), {})
  assert.deepEqual(linkPayload('daily', { refType: 'application', refId: 2, label: '岗位 · 老草稿' }), {}, '老草稿的私有关联不带')
  // 页面里：关联字段在前，经历校验给的 extra 在后（经验分享的 application 不会被盖掉）
  assert.match(publish, /\.\.\.linkPayload\(KIND\[type\.value\], link0\.value\), \.\.\.extra/)
  // 草稿：存关联对象；恢复时只认四种公开对象
  assert.match(publish, /link: link0\.value \? \{ \.\.\.link0\.value \} : null, expType: expType\.value,/)
  assert.match(publish, /link0\.value = restoreLink\(d\.link\)/)
  assert.deepEqual(restoreLink({ type: 'store', id: '4', title: '洱海咖啡', city: '大理' }), { type: 'store', id: 4, title: '洱海咖啡', cover: '', city: '大理', label: '门店', sub: '' })
  assert.equal(restoreLink({ refType: 'application', refId: 2 }), null)
})

test('关联选择页：打开带上发布页的城市和已选的；选一个 / 不关联 / 直接返回 各交还一次结果', async () => {
  const urls = []
  const nav = (o) => urls.push(o.url)
  const p1 = openLinkPicker({ city: '大理', current: { type: 'stay', id: 3, title: '小院' } }, nav)
  assert.match(urls[0], /^\/pages\/community\/link\?request=\d+$/)
  const id = urls[0].split('=')[1]
  assert.deepEqual(linkRequest(id), { city: '大理', current: { type: 'stay', id: 3, title: '小院' } })
  assert.equal(await openLinkPicker({}, nav), null, '已经开着一个就不再开第二个')
  finishLinkPicker(id, { type: 'job', id: 5, title: '前台' })
  finishLinkPicker(id, 'none')
  assert.deepEqual(await p1, { type: 'job', id: 5, title: '前台' }, '只交一次')
  assert.equal(linkRequest(id), null)
  // 页面打不开：当作没选
  assert.equal(await openLinkPicker({}, (o) => o.fail()), null)
  assert.equal(await openLinkPicker({}, () => { throw new Error('x') }), null)
  // 页面：返回 / 侧滑 = null；不关联 = 'none'；发布页按这个改
  assert.match(linkPage, /onUnload\(\(\) => finishLinkPicker\(requestId, null\)\)/)
  assert.match(tpl(linkPage), /class="selection-bar__clear"[^>]*@click="choose\('none'\)">/)
  assert.match(publish, /if \(res === null\) return\n  link0\.value = res === 'none' \? null : restoreLink\(res\)/)
  assert.match(publish, /openLinkPicker\(\{ city: city\.value, current: link0\.value \}, \(o\) => uni\.navigateTo\(o\)\)/)
})

test('关联选择页：搜索框 + 页签 小院/门店 / 岗位 / 活动，列表卡（封面 / 标题 / 类型小标签 / 城市），分页', () => {
  assert.deepEqual(LINK_TABS.map(t => [t.key, t.label]), [['place', '小院/门店'], ['job', '岗位'], ['activity', '活动']])
  const t = tpl(linkPage)
  assert.match(t, /<k-topbar title="关联帖子" back \/>/)
  assert.match(t, /<input v-model="kwDraft" class="search__input" confirm-type="search" maxlength="30" placeholder="搜索小院、门店、岗位或活动"[^>]*@confirm="runSearch"/)
  assert.match(t, /<view v-for="t in LINK_TABS" :key="t\.key" class="tab" :class="\{ on: tab === t\.key \}" hover-class="k-press" @click="setTab\(t\.key\)">/)
  assert.match(t, /<view v-for="it in rows" :key="it\.type \+ it\.id" class="item" :class="\{ on: isSelected\(it\) \}"[^>]*@click="choose\(it\)">/)
  // 2026-10-18：类型小标签按类型分颜色（item__tag--stay / job / activity）
  assert.match(t, /<text class="item__tag" :class="'item__tag--' \+ it\.type">\{\{ it\.label \}\}<\/text>/)
  assert.match(t, /@click="confirmSelection"><text>确认关联<\/text>/)
  assert.doesNotMatch(t, /<text [^>]*hover-class/)
  assert.match(linkPage, /apiPostLinkables\(\{ type: tab\.value, keyword: keyword\.value \|\| undefined, city: city\.value \|\| undefined, page: next \}\)/)
  assert.match(linkPage, /onReachBottom\(\(\) => load\(true\)\)/)
  assert.match(linkPage, /if \(my !== seq\) return/, '连着切只认最后一次')
  assert.match(api, /export const apiPostLinkables = \(params\) => get\('\/app\/community\/linkables', params\)/)
})

test('信息流 / 详情 / 我的发布：关联了就多一行「关联：XXX」，点了打开它（半张卡里点它不打开帖子）', () => {
  const t = tpl(index)
  assert.match(index, /tags: postTags\(p\), link: linkView\(p\.link\)/)
  assert.match(index, /const openLink = \(l\) => \{ if \(l && l\.to\) go\(l\.to\) \}/)
  assert.match(t, /<view v-if="b\.post\.link" class="fc__link" hover-class="k-press" @click="openLink\(b\.post\.link\)">[\s\S]*?<text class="fc__link-title">关联：\{\{ displayWording\(b\.post\.link\.title\) \}\}<\/text>/)
  assert.match(t, /<view v-if="c\.post\.link" class="fc-col__link" hover-class="k-press" @click\.stop="openLink\(c\.post\.link\)">/)
  assert.match(t, /<view v-if="detailLink" class="link-card" hover-class="k-press-s" @click="openLink\(detailLink\)">/)
  assert.match(index, /const detailLink = computed\(\(\) => linkView\(detail\.value\.link\)\)/)
  assert.match(tpl(mine), /<view v-if="linkOf\(post\)" class="my-post-link" hover-class="k-press" @click="go\(linkOf\(post\)\.to\)">/)
})

// Layout is verified in acceptance/20261021-community-profile/browser.mjs.

// ---------------------------------------------------------------- 发布成功页

test('发出去进「发布成功」页：已上线说发布成功，先审后发说已提交审核；关联的标题不进地址栏', () => {
  assert.equal(publishedUrl({ postId: 42, status: 'online' }), '/pages/community/published?postId=42&status=online')
  assert.equal(publishedUrl({ postId: 43, status: 'pending' }), '/pages/community/published?postId=43&status=pending')
  assert.equal(publishedUrl({ postId: 44, status: 'weird' }), '/pages/community/published?postId=44&status=pending')
  assert.equal(publishedText('online').title, '发布成功')
  // 2026-10-19 复查：先审后发也明确写「发布成功」，再说在等审核（主人：「发布成功页：明确告诉用户发布成功」）
  assert.equal(publishedText('pending').title, '发布成功')
  assert.match(publishedText('pending').sub, /审核通过后会展示在社区/)
  assert.equal(publishedText('rejected').title, '帖子未通过审核')
  assert.equal(publishedText('offline').title, '帖子已下架')
  const mem = rememberPublished({ postId: 42, status: 'online', activityId: 9, link: { type: 'stay', id: 3, title: '平潭袋鼠小院', label: '小院' } }, 'daily')
  assert.equal(mem.link.title, '平潭袋鼠小院')
  assert.equal(mem.link.to, '/pages/stays/detail?stayId=3')
  assert.equal(publishedOf(42), mem)
  assert.equal(publishedOf('42'), mem)
  assert.equal(publishedOf(41), null, '别的帖子不认')
  assert.equal(rememberPublished({ postId: 50, status: 'pending', link: null }).link, null, '没关联就不显示')
  // 发布页：发完换成成功页，不再直接落到「我的发布?submitted=」
  const s = script(publish)
  assert.match(s, /if \(draftMine\) dropDraft\(\)\n[\s\S]*?rememberPublished\(res, payload\.kind\)\n    replace\(publishedUrl\(res\)\)/)
  assert.doesNotMatch(s, /replace\(R\.myPosts \+ '\?submitted='/)
  // 从别处进「我的发布」带 ?submitted= 的高亮照旧
  assert.match(mine, /onLoad\(q => \{ submittedId\.value = Number\(q\?\.submitted\) \|\| 0 \}\)/)
  assert.match(tpl(mine), /:class="\{ newest: post\.postId === submittedId \}"/)
})

test('发布成功页：已关联到 XXX（没关联不显示）、查看帖子 / 继续发布 / 回社区；取不到记下的结果就按 postId 查', () => {
  const t = tpl(donePage)
  // 2026-10-19：大标题挂 k-display（全站大标题统一 class）
  assert.match(t, /<text class="done-title">\{\{ text\.title \}\}<\/text>/)
  assert.match(t, /<view v-if="link" class="done-link" hover-class="k-press-s" @click="openLink">[\s\S]*?<text class="done-link__label">已关联到<\/text><text class="done-link__title">\{\{ displayWording\(link\.title\) \}\}<\/text>/)
  assert.equal(linkView({ type: 'job', id: 91, title: '直播义工' }).title, '直播义工', '引用仍保留原始岗位标题，只有展示模板转换')
  assert.match(t, /@click="viewPost"><text>查看帖子<\/text>/)
  assert.match(t, /@click="again"><text>继续发布<\/text>/)
  assert.match(t, /@click="toCommunity"><text>回社区<\/text>/)
  assert.doesNotMatch(t, /<text [^>]*hover-class/)
  const s = script(donePage)
  assert.match(s, /const viewPost = \(\) => \(postId\.value \? go\(R\.community \+ '\?postId=' \+ postId\.value \+ '&from=mine'\) : go\(R\.myPosts\)\)/)
  assert.match(s, /const again = \(\) => replace\(R\.publish \+ '\?fresh=1'\)/)
  assert.match(s, /const toCommunity = \(\) => relaunch\(R\.community\)/)
  assert.match(s, /const mem = publishedOf\(postId\.value\)/)
  assert.match(s, /const d = \(await apiPost\(postId\.value\)\)\.data \|\| \{\}/)
})

// ---------------------------------------------------------------- 分包

test('两个新页面都登记在 community 分包里，不进主包；只引用主包公共模块和本分包的文件', () => {
  const sub = pagesJson.subPackages.find(p => p.root === 'pages/community')
  const paths = sub.pages.map(p => p.path)
  for (const p of ['link', 'published']) {
    assert.ok(paths.includes(p), p)
    assert.equal(sub.pages.find(x => x.path === p).style.navigationStyle, 'custom')
    assert.ok(!pagesJson.pages.some(x => x.path.includes('community/' + p)), '主包里没有 ' + p)
    assert.ok(existsSync(new URL('../pages/community/' + p + '.vue', import.meta.url)), p + '.vue')
  }
  assert.ok(existsSync(new URL('../pages/community/post-link.js', import.meta.url)), 'post-link.js 放在分包目录里')
  assert.doesNotMatch(postLinkJs, /from '@\//, 'post-link.js 不引用 @/ 下的模块（node 里能直接测）')
  for (const src of [linkPage, donePage, publish]) {
    for (const m of script(src).matchAll(/from '([^']+)'/g)) {
      assert.ok(/^(vue|@dcloudio\/uni-app|@\/common\/|\.\/)/.test(m[1]), m[1])
    }
  }
})

// ---------------------------------------------------------------- 后端

test('后端：关联存在 ref_type / ref_id，发布时校验能选，信息流 / 详情带 link，选择页搜索接口', () => {
  assert.match(postJava, /LINK_LABEL\.put\("stay", "小院"\);\s*LINK_LABEL\.put\("store", "门店"\);\s*LINK_LABEL\.put\("job", "岗位"\);\s*LINK_LABEL\.put\("activity", "活动"\);/)
  assert.match(postJava, /if \(linkId != null\)\s*\{[\s\S]*?if \(pickableLink\(linkType, linkId\) == null\)/)
  assert.match(postJava, /m\.put\("link", linked\.get\(id\)\);/)
  assert.match(postJava, /m\.put\("link", refId == null && linkId == null \? null : links\(/)
  assert.match(postJava, /public Map<String, Object> linkables\(String type, String keyword, String city, int page\)/)
  assert.match(ctlJava, /@AppAuth\(required = false\)\s*@GetMapping\("\/linkables"\)/)
  assert.match(ctlJava, /posts\.linkables\(type, keyword, city, page\)/)
  // 经验分享照旧必须是自己的经历（application）
  assert.match(postJava, /boolean ok = refId != null && "application"\.equals\(refType\);/)
})

// ---------------------------------------------------------------- r2：经验分享也能选关联（V52 link_type / link_id）

test('r2：经验分享的「关联帖子」卡能点、和别的类型同一个选择页；没选时提示自动关联经历的岗位', () => {
  const s = script(publish)
  assert.match(s, /const linkSub = computed\(\(\) => \(type\.value === '经验分享' \? DIARY_AUTO_LINK_HINT : '关联一个小院 \/ 门店、岗位或活动，看帖子的人点一下就能打开'\)\)/)
  assert.match(s, /import \{ openLinkPicker, restoreLink, (?:linkFromQuery, )?linkPayload, rememberPublished, publishedUrl, DIARY_AUTO_LINK_HINT \} from '\.\/post-link\.js'/)
  assert.equal(DIARY_AUTO_LINK_HINT, '不选的话，会自动关联你在「经历校验」里选的那段经历的岗位')
  // pickLink 不分类型；切到经验分享不清掉已选的关联（之前不发、现在照发）
  assert.match(s, /async function pickLink\(\) \{\n  const res = await openLinkPicker/)
  assert.doesNotMatch(s, /'经验分享'[^\n]*link0\.value = null/)
  // 经验分享发出去：经历校验给的 application 在 extra 里，关联只带 linkType / linkId，不会盖掉 ref
  const payload = { ...linkPayload('diary', { type: 'job', id: 5, title: '前台' }), ...{ refType: 'application', refId: 2 } }
  assert.deepEqual(payload, { linkType: 'job', linkId: 5, refType: 'application', refId: 2 })
})

test('r2 兼容：新后端认 linkType / linkId，也认老版本小程序只带的 refType / refId；找搭子 / 旅居日常照旧写 ref_* 给老后端看', () => {
  assert.match(postJava, /String linkType = str\(b\.get\("linkType"\)\)\.trim\(\);\s*Long linkId = KgJdbc\.asLong\(b\.get\("linkId"\)\);/)
  assert.match(postJava, /if \(linkId == null && !"diary"\.equals\(kind\) && refId != null && LINK_LABEL\.containsKey\(refType\)\)/)
  assert.match(postJava, /row\.put\("link_type", linkType\);\s*row\.put\("link_id", linkId\);/)
  assert.match(postJava, /if \(!"diary"\.equals\(kind\) && \(refId == null \|\| LINK_LABEL\.containsKey\(refType\)\)\)\s*\{\s*refType = linkType;\s*refId = linkId;/)
  // 读：先 link_* 再 ref_*；经验分享选的下线了退回自动关联
  assert.match(postJava, /static Object\[\] storedLink\(Map<String, Object> r\)/)
  assert.match(postJava, /if \(t == null \|\| out\.containsKey\(e\.getKey\(\)\)\)/)
  // 老后端（只认 refType / refId）也照样能发：找搭子 / 旅居日常的 refType / refId 还在，经验分享的 application 还在
  assert.match(publish, /submit\(\{ refType: 'application', refId: hit\.appId \}\)/)
  assert.deepEqual(Object.keys(linkPayload('daily', { type: 'stay', id: 3, title: '小院' })), ['refType', 'refId', 'linkType', 'linkId'])
})
