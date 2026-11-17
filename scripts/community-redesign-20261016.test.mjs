// 2026-10-16 社区改版（对照主人样稿 21）的静态回归（node --test，不构建、不发请求）。
// 守住这几件事：
//   · 页签 全部 / 找搭子 / 旅居日常 / 经验分享；「经验分享」= 原「换工日记」（后端代码还是 diary），下面一行小字 全部 / 换宿旅行 / 线下兼职 / 全职，发 jobType；
//   · 找搭子留在社区页（不再跳 s=2）：分类小字 +「筛选」（日期 / 同行天数 / 同行性别 / 只看已验证）+ 出行安全须知 + apiBuddies 列表 +「发起认识一下」；
//   · 顶栏「袋鼠小院」+ 袋鼠贴纸 + 城市（.brand__city 不改名）；白色搜索条 + 圆形搜索按钮，提示字不写「活动」；排序缩成页签右边的小「最新 ▾」，保留「已关注」；
//   · 卡片按数据排：第一条带图的大图卡、挨着的带图两两一行、落单的右边小图、没图的文字卡（不拿占位图凑）、热门活动「去看看」卡插在「全部」里；
//   · 标题「话题｜标题」；关注、分享（open-type="share"）、审核中都还在；
//   · 发布页类型 找搭子 / 旅居日常 / 经验分享，改名前的草稿「换工日记」认成「经验分享」；我的发布、个人主页的名字跟着改；
//   · 后端：KIND_LABEL diary → 经验分享，feed 的 jobType 只在 diary 下生效，topicLabel 一页一次查齐，经历放宽到兼职 / 全职，后台选项改名。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { displayWording } from '../common/display-wording.js'
import {
  FEED_TABS, FEED_KIND, BUDDY_TAB, DIARY_TAB, JOB_CHIPS, PUBLISH_TYPES, PUBLISH_KIND, restoreType,
  BUDDY_CATS, CAT_KEY, catIcon, shortDate, titleOf, buildBlocks, postTags, canShare, cityLabel
} from '../pages/community/community-feed.js'

const require = createRequire(import.meta.url)
const { parse, babelParse } = require('@vue/compiler-sfc')
const vue = require('vue')
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const icons = (await import('../common/icons.js')).default
const index = await read('../pages/community/index.vue')
const publish = await read('../pages/community/publish.vue')
const mine = await read('../pages/community/mine.vue')
const user = await read('../pages/community/user.vue')
const feedJs = await read('../pages/community/community-feed.js')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const postJava = await read(javaRoot + 'ext/community/KgPostService.java')
const ctlJava = await read(javaRoot + 'controller/app/AppCommunityController.java')
const moduleJava = await read(javaRoot + 'ext/community/KgCommunityModule.java')
const tpl = (src) => parse(src).descriptor.template.content
const css = (src) => parse(src).descriptor.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')

test('页签、经验分享小字、发布类型的名字和顺序', () => {
  // 2026-10-17：「旅居日常」改名「旅居日常」（代码还是 daily）
  assert.deepEqual(FEED_TABS, ['全部', '找搭子', '旅居日常', '经验分享'])
  assert.equal(BUDDY_TAB, '找搭子')
  assert.equal(DIARY_TAB, '经验分享')
  assert.deepEqual(FEED_KIND, { 全部: '', 旅居日常: 'daily', 经验分享: 'diary' })
  assert.deepEqual(JOB_CHIPS.map(j => j.label), ['换宿旅行', '线下兼职', '全职'])
  assert.deepEqual(JOB_CHIPS.map(j => j.key), ['volunteer', 'parttime', 'fulltime'])
  // 2026-10-17 发布页样稿 图 3 的顺序：找搭子 / 经验分享 / 旅居日常
  assert.deepEqual(PUBLISH_TYPES.map(t => t.name), ['找搭子', '经验分享', '旅居日常'])
  assert.deepEqual(PUBLISH_KIND, { 找搭子: 'buddy', 旅居日常: 'daily', 经验分享: 'diary' })
  for (const t of PUBLISH_TYPES) assert.ok(icons[t.icon], t.icon)
  // 2026-10-17：改名前草稿的映射里多了「旅居日常 → 旅居日常」
  assert.equal(restoreType('旅居攻略'), '旅居日常')
})

test('改名前存下的草稿类型「换工日记」认成「经验分享」，认不出的回到默认', () => {
  assert.equal(restoreType('换工日记'), '经验分享')
  assert.equal(PUBLISH_KIND[restoreType('换工日记')], 'diary')
  for (const t of ['找搭子', '旅居日常', '经验分享']) assert.equal(restoreType(t), t)
  assert.equal(restoreType('旅居攻略'), '旅居日常', '改名前的草稿')
  assert.equal(restoreType(undefined), '找搭子')
  assert.equal(restoreType('乱写的', '旅居日常'), '旅居日常')
  assert.match(publish, /type\.value = restoreType\(d\.type, '找搭子'\)/)
  assert.doesNotMatch(publish, /Object\.assign\(type, \{ value: d\.type/)
})

test('卡片标题「话题｜标题」，没有话题只显示标题', () => {
  assert.equal(titleOf({ topicLabel: '线下兼职', title: '咖啡店的一个月' }), '线下兼职｜咖啡店的一个月')
  assert.equal(titleOf({ topicLabel: '', title: '洱海日落' }), '洱海日落')
  assert.equal(titleOf({ title: '旧接口没有话题' }), '旧接口没有话题')
  assert.match(index, /titleText: displayWording\(titleOf\(p\), \[p\.author\?\.name\]\)/)
  assert.match(index, /<k-display-text class="detail__title" :value="titleOf\(detail\)[^"]*" :preserve="\[detail\.author\.name\]"/, '详情标题使用同一标题规则，保留作者姓名')
  assert.equal(displayWording(titleOf({ topicLabel: '义工经历', title: '义工小李的义工生活' }), ['义工小李']), '换工经历｜义工小李的换工生活')
  // 2026-10-17：我的发布和卡片同一个 titleOf（话题是「其他」时不加前缀）
  assert.match(mine, /\{\{ displayWording\(titleOf\(post\), \[post\.author\?\.name\]\) \}\}/)
  assert.match(user, /p\.topicLabel \? p\.topicLabel \+ '｜' : ''/)
})

test('找搭子分类、没图时的分类图标和日期', () => {
  assert.deepEqual(BUDDY_CATS, ['全部', '徒步登山', '摄影', '拼饭', '美食分享', '骑行', '跑步', '其他'])
  assert.deepEqual(Object.values(CAT_KEY), ['hike', 'photo', 'meal', 'food', 'ride', 'run', 'other'])
  for (const c of BUDDY_CATS.slice(1)) assert.ok(icons[catIcon(c)], c)
  assert.equal(catIcon(undefined), 'users')
  assert.equal(shortDate('10月18日 08:00'), '10/18')
  assert.equal(shortDate('日期待定'), '待定')
})

const post = (id, n = 0) => ({ postId: id, imgs: Array.from({ length: n }, (_, i) => 'img' + i) })
const act = (id) => ({ activityId: id })
const kinds = (blocks) => blocks.map(b => b.type + ':' + (b.items ? b.items.map(c => (c.act ? 'a' + c.act.activityId : c.post.postId)).join('+') : (b.act ? 'a' + b.act.activityId : b.post.postId)))

test('卡片按数据排：大图卡 / 一行两列 / 右边小图 / 文字卡 / 活动卡', () => {
  // 1 文字；2 带图 → 第一条带图的是大图卡；3、4 挨着带图 → 一行两列；5 文字（凑不成对，被带图的 6 打断 → 通栏）；6 带图落单 → 右边小图
  assert.deepEqual(kinds(buildBlocks([post(1), post(2, 3), post(3, 1), post(4, 2), post(5), post(6, 1)])),
    ['text:1', 'thumb:2', 'thumb:3', 'thumb:4', 'text:5', 'thumb:6'])
  // 活动插在第 3 条动态前，之后每隔 5 条一张；挨着文字时是通栏活动卡；活动不当大图卡。
  // 2026-10-18：没图的动态「两张并排 / 一张通栏」交替（pair 里是两张文字卡），活动不打断文字帖配对
  const posts = Array.from({ length: 12 }, (_, i) => post(i + 1))
  posts[2] = post(3, 1)
  assert.deepEqual(kinds(buildBlocks(posts, [act(70), act(71), act(72)])),
    ['text:1', 'text:2', 'act:a70', 'thumb:3', 'text:4', 'text:5', 'text:6', 'text:7', 'act:a71', 'text:8', 'text:9', 'text:10', 'text:11', 'text:12'])
  // 带图动态后面紧跟活动：两两一行；后面两条文字并排
  assert.deepEqual(kinds(buildBlocks([post(1, 1), post(2, 1), post(3), post(4)], [act(9)])), ['thumb:1','thumb:2','act:a9','text:3','text:4'])
  // 全是文字：第一条是开篇卡（类型色底 + 引号，不是照片），没有占位图
  const plain = buildBlocks([post(1), post(2), post(3)])
  assert.deepEqual(plain.map(b => b.type), ['text','text','text'])
  // 动态太少够不着第一个位置：活动排在最后，最多两张（挨着的两张活动一行两列）
  assert.deepEqual(kinds(buildBlocks([post(1)], [act(1), act(2), act(3)])), ['text:1','act:a1','act:a2'])
  assert.deepEqual(kinds(buildBlocks([], [act(1)])), ['act:a1'])
  // key 不重复
  const keys = buildBlocks(posts, [act(70), act(71), act(72)]).map(b => b.key)
  assert.equal(new Set(keys).size, keys.length)
})

// Layout is verified in acceptance/20261021-community-profile/browser.mjs.

test('经验分享的小字发 jobType；热门活动只插在「全部」里', () => {
  assert.match(tpl(index), /v-if="feedTab === DIARY_TAB" class="subchips"/)
  assert.match(tpl(index), /v-for="j in JOB_CHIPS"[^>]*@click="setJobType\(j\.key\)"/)
  assert.match(index, /if \(feedTab\.value === DIARY_TAB && jobType\.value\) params\.jobType = jobType\.value/)
  assert.match(index, /const showActs = computed\(\(\) => feedTab\.value === '全部' && !keyword\.value && sort\.value !== 'follow'\)/)
  assert.match(index, /buildBlocks\(posts\.value, showActs\.value \? hots\.value : \[\]\)/)
  assert.match(index, /const goJobs = \(\) => go\(R\.jobsList \+ '\?type=' \+ \(jobType\.value \|\| 'volunteer'\)/)
  // 2026-10-17：不再把社区城市（多半是定位来的）带进岗位列表，和首页入口一样默认全部城市
  assert.doesNotMatch(index, /const goJobs = .*&city=/)
})

test('找搭子留在社区页：分类 + 筛选 + 安全须知 + apiBuddies 列表 + 发起认识一下', () => {
  const t = tpl(index)
  assert.doesNotMatch(index, /s\.value = 2; loadBuddies/, '点页签不再跳到单独一屏')
  assert.doesNotMatch(t, /s === 2/)
  assert.match(index, /if \(s\.value === 2\) \{ s\.value = 1; feedTab\.value = BUDDY_TAB \}/, '旧的 ?s=2 落到找搭子页签')
  assert.match(index, /const reload = \(\) => \(feedTab\.value === BUDDY_TAB \? loadBuddies\(\) : loadFeed\(\)\)/)
  assert.match(t, /<template v-if="feedTab === BUDDY_TAB">/)
  assert.match(t, /v-for="c in cats"[^>]*@click="setCat\(c\)"/)
  assert.match(t, /class="bbar__filter"[^>]*hover-class="k-press" @click="openFilter"/)
  for (const s of ['出发日期', '同行天数', '同行性别', '只看已验证的发布者', '重置', '确定', '出行安全须知', '发起认识一下']) assert.ok(t.includes(s), s)
  assert.match(t, /<view @click\.stop><k-button size="sm" @click\.stop="meet\(mate\)">\{\{[^<]*发起认识一下[^<]*\}\}<\/k-button><\/view>/, '按钮的 tap 不冒泡到卡片')
  // 2026-10-19 起参数先放进 q（选的城市空着时同一份条件再看全国的，见 community-fallback-20261019.test.mjs）
  assert.match(index, /const q = \{ city: city\.value,[^}]*category: CAT_KEY\[cat\.value\], verified: bq\.value\.verified, gender: bq\.value\.gender \|\| undefined, keyword: keyword\.value \|\| undefined \}[\s\S]*?apiBuddies\(q\)/)
  assert.match(index, /String\(e\.message \|\| ''\)\.includes\('个人资料'\)/, '性别限定 422 →「去填写」')
  assert.match(index, /apiCommunityRules\('buddy'\)/)
  // 没图的找搭子卡左边是分类图标 + 日期，不用「暂无图片」占位图
  assert.match(t, /<image v-if="mate\.img" class="mate__img"/)
  assert.doesNotMatch(index, /HOT_IMG|cover-empty\.png' : HOT|mate\.img \|\| /)
})

test('卡片：关注、分享按钮、审核中都还在；可点的 view 有按压反馈、text 上没有 hover-class', () => {
  const t = tpl(index)
  assert.match(t, /open-type="share"[^>]*:data-post-id="b\.post\.postId"/)
  assert.match(index, /onShareAppMessage\(/)
  assert.match(t, /class="follow" :class="\{ on: b\.post\.followed \}" hover-class="k-press" @click="toggleFollow\(b\.post\)"/)
  // 审核中 / 仅限女生·男生 / 伙伴说：大卡片和半张卡用同一份 postTags
  assert.match(index, /tags: postTags\(p\)/)
  assert.match(t, /<view v-if="b\.post\.tags\.length" class="fc__tags"><k-chip v-for="t in b\.post\.tags" :key="t\.key" :tone="t\.tone">\{\{ t\.text \}\}<\/k-chip><\/view>/)
  assert.match(t, /<view v-if="c\.post\.tags\.length" class="fc__tags fc-col__tags"><k-chip v-for="t in c\.post\.tags" :key="t\.key" :tone="t\.tone">\{\{ t\.text \}\}<\/k-chip><\/view>/)
  for (const src of [index, publish, mine, user]) assert.doesNotMatch(tpl(src), /<text [^>]*hover-class/)
  // 信息流这一屏（详情、评论屏另算）：可点的 view 都有按压反馈；遮罩不算
  const feedScreen = t.slice(0, t.indexOf('<!-- 3 帖子详情 -->'))
  let n = 0
  for (const m of feedScreen.matchAll(/<view [^>]*@click(?:\.stop)?="[^"]+"[^>]*>/g)) {
    if (/class="(?:k-mask|fmask)"/.test(m[0])) continue
    n++
    assert.match(m[0], /hover-class=/, m[0])
  }
  assert.ok(n > 20, String(n))
})

test('页面颜色：没有写死的旧红色；页面底色上的小字不用次要灰', () => {
  for (const src of [index, publish, mine, user]) assert.doesNotMatch(src, /#A94734|169, ?71, ?52/i)
  const c = css(index)
  assert.match(c, /\.feed-empty__sub \{ font-size: 14px;/)
  // 选中分类用深棕正文色和字重区分，避免依赖浅色识别。
  assert.match(c, /\.ftab\.on \{ color: var\(--k-ink\); font-weight: 600; \}/)
  assert.match(css(mine), /\.status-rejected \{ color: var\(--k-alert\); \}/)
  assert.doesNotMatch(c, /\.feed \{ padding: 0 16px calc/, '底部留白交给 k-pad-tab（发布圆钮凸起后加高）')
})

test('发布页：经验分享走经历校验，兼职 / 全职经历带类型小标签', () => {
  const t = tpl(publish)
  assert.match(publish, /const KIND = PUBLISH_KIND/)
  assert.match(publish, /if \(type\.value === '经验分享'\) \{ loadExperiences\(\); s\.value = 3; return \}/)
  assert.match(t, /发布“经验分享”需关联一段岗位经历/)
  assert.match(t, /<text v-if="item\.jobTypeLabel" class="exp-type">\{\{ item\.jobTypeLabel \}\}<\/text>/)
  assert.match(t, /@click="selected = item\.appId"/)
  assert.doesNotMatch(t.replace(/<!--[\s\S]*?-->/g, ''), /换工日记|换工经历/, '界面上不再出现旧名字（注释里说明改名的不算）')
  assert.match(publish, /toast\('请选择一段经历'\)/)
  assert.match(mine, /<text>找搭子 · 旅居日常 · 经验分享<\/text>/)
  assert.doesNotMatch(mine, /换工日记/)
})

test('经历校验卡：标题两行、小标签另起一行、没填服务不写「服务：」、完成时间看得全；去找机会不写死换宿', () => {
  const t = tpl(publish)
  assert.match(t, /<text class="experience-name">\{\{ item\.title \}\}<\/text><view class="experience-tags"><text v-if="item\.jobTypeLabel" class="exp-type">/)
  assert.doesNotMatch(t, /experience-title-row/)
  assert.match(t, /<text v-if="item\.service" class="experience-meta">服务：\{\{ item\.service \}\}<\/text>/)
  assert.match(t, /<text class="experience-meta experience-date">\{\{ item\.dateLabel \}\}：\{\{ item\.date \}\}<\/text>/)
  const c = css(publish)
  assert.match(c, /\.experience-name \{ display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;/)
  assert.match(c, /\.experience-meta\.experience-date \{ white-space: normal; overflow: visible; \}/)
  // 经验分享换宿 / 兼职 / 全职都算：打开岗位列表默认页签，不带 ?type=volunteer
  assert.match(publish, /const goJobs = \(\) => go\(R\.jobsList\)\n/)
  assert.doesNotMatch(publish, /type=volunteer'/)
})

test('卡片小标签：审核中 / 限定性别 / 伙伴说，大卡片和半张卡同一份', () => {
  assert.deepEqual(postTags(null), [])
  assert.deepEqual(postTags({ status: 'online', kind: 'daily' }), [])
  assert.deepEqual(postTags({ status: 'pending', kind: 'buddy', genderLimit: 'female', genderLimitLabel: '仅限女生' }).map(x => [x.text, x.tone]),
    [['动态待审核·仅自己可见', 'ochre'], ['仅限女生', 'red']])
  assert.deepEqual(postTags({ kind: 'buddy', genderLimit: 'male' }).map(x => x.text), ['仅限男生'], '老接口没有 label 时自己补')
  assert.deepEqual(postTags({ kind: 'daily', genderLimit: 'female', tone: 'avoid', toneLabel: '避雷' }).map(x => [x.text, x.tone]),
    [['伙伴说 · 避雷', 'red']], '只有找搭子才有限定性别')
  assert.deepEqual(postTags({ kind: 'daily', tone: 'recommend', toneLabel: '推荐' }).map(x => x.tone), ['green'])
  const keys = postTags({ status: 'pending', kind: 'buddy', genderLimit: 'female', toneLabel: '推荐' }).map(x => x.key)
  assert.equal(new Set(keys).size, keys.length)
})

test('半张卡：赞 / 评论是 0 不写数字（2026-10-19 起各种宽度都一样）；评论入口在小屏仍保留', () => {
  const t = tpl(index)
  assert.match(t, /<text v-if="c\.post\.likes" class="fc-col__num">\{\{ c\.post\.likes \}\}<\/text>/)
  assert.match(t, /<text v-if="c\.post\.comments" class="fc-col__num">\{\{ c\.post\.comments \}\}<\/text>/)
  assert.doesNotMatch(t, /c\.post\.(likes|comments) \|\| 0/)
  assert.match(t, /class="fc-col__stat fc-col__stat--cmt"/)
  assert.match(css(index), /\.fc-col__tags \{ gap: 4px; margin-top: 6px; \}/)
})

test('顶栏城市：窄屏「全部城市」显示成「全部」，品牌间距收窄；发给服务端的还是「全部城市」', () => {
  assert.equal(cityLabel('全部城市', true), '全部')
  assert.equal(cityLabel('全部城市', false), '全部城市')
  assert.equal(cityLabel('西双版纳', true), '西双版纳')
  assert.match(tpl(index), /<text class="brand__city-name">\{\{ cityText \}\}<\/text>/)
  assert.match(index, /const cityText = computed\(\(\) => cityLabel\(city\.value, winW < 360\)\)/)
  // 2026-10-19：选的城市空着时自动看全国（community-fallback-20261019.test.mjs），往下翻页才接着发「全部城市」
  assert.match(index, /city: more && feedWide\.value \? ALL_CITIES : city\.value, sort: sort\.value/, 'feed 照常发 city.value')
  assert.match(css(index), /@media \(max-width: 359px\) \{\s*\.brand \{ gap: 2px; padding-left: 4px; \}\s*\.brand__name \{ font-size: 18px; letter-spacing: 0; \}\s*\.brand__city \{ margin-left: 4px; gap: 2px; \}/)
})

test('第一张热门活动卡下面有「更多活动 ›」，进完整的活动列表', () => {
  const marked = (blocks) => blocks.filter(b => b.moreActs).map(b => b.key)
  const posts = [post(1), post(2), post(3), post(4)]
  // 活动挨着文字：通栏活动卡带入口；后面的活动卡不带
  const b1 = buildBlocks([...posts, post(5), post(6), post(7), post(8)], [act(70), act(71)])
  assert.deepEqual(marked(b1), ['a70'])
  // 活动和带图动态一行两列：那一行带入口
  const b2 = buildBlocks([post(1, 1), post(2, 1), post(3)], [act(9)])
  assert.deepEqual(b2.filter(b => b.moreActs).map(b => b.type), ['act'])
  // 没有活动（找搭子以外的页签、在搜索、已关注）：没有入口
  assert.deepEqual(marked(buildBlocks(posts, [])), [])
  assert.match(tpl(index), /<view v-if="b\.moreActs" class="acts-more"><view class="acts-more__link" hover-class="k-press" @click="go\(R\.activity\)"><text>更多活动<\/text>/)
})

test('审核中的动态不能分享：复制链接、私信、小程序转发按钮都拦', () => {
  assert.equal(canShare({ postId: 1, status: 'online' }), true)
  assert.equal(canShare({ postId: 1 }), true, '老接口没有 status 照常能分享')
  assert.equal(canShare({ postId: 1, status: 'pending' }), false)
  assert.equal(canShare({ postId: 1, status: 'rejected' }), false)
  assert.equal(canShare(null), false)
  assert.match(index, /async function shareOther\(p\) \{\n[^\n]*\n  if \(!canShare\(p\)\) return toast\('动态审核通过后才能分享'\)/)
  assert.match(index, /async function shareToChat\(p\) \{\n  if \(!p \|\| !p\.postId\) return\n  if \(!canShare\(p\)\) return toast\('动态审核通过后才能分享'\)/)
  const t = tpl(index)
  assert.match(t, /<button v-if="canShare\(b\.post\)" class="fc__act fc__act--share share-btn" open-type="share"/)
  assert.match(t, /<button v-if="canShare\(detail\)" class="actbar__item share-btn" open-type="share"/)
  // 2026-10-17（community-pending-20261017）：不能分享时按钮还灰掉（--off）
  assert.match(t, /<view v-else class="fc__act fc__act--share fc__act--off" hover-class="k-press" @click="shareOther\(b\.post\)">/)
  assert.match(t, /<view v-else class="actbar__item actbar__item--off" hover-class="k-press" @click="shareOther\(detail\)">/)
  assert.match(index, /if \(hit && !canShare\(hit\)\) return \{ title: '袋鼠全球青年 · 同城社区', path: R\.community \}/)
})

test('文字卡正文保留摘要；卡片上只放一个验证标签', () => {
  const c = css(index)
  assert.match(c, /\.fc__text \{ display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;/)
  // 验证信息保留为作者旁的小标记，行程认证优先，未认证时不显示。
  assert.match(tpl(index), /<view v-if="b\.post\.verified \|\| b\.post\.phone" class="fc__verified">[\s\S]*?<text>\{\{ b\.post\.verified \? '行程已验证' : '手机已验证' \}\}<\/text>/)
})

test('后端：改名、jobType、topicLabel、经历放宽、后台选项', () => {
  assert.match(postJava, /KIND_LABEL\.put\("diary", "经验分享"\);/)
  assert.doesNotMatch(postJava, /KIND_LABEL\.put\("diary", "换工日记"\)/)
  assert.match(postJava, /DIARY_JOB_LABEL\.put\("volunteer", "换宿旅行"\);\s*DIARY_JOB_LABEL\.put\("parttime", "线下兼职"\);\s*DIARY_JOB_LABEL\.put\("fulltime", "全职"\);/)
  assert.match(postJava, /if \("diary"\.equals\(kind\) && jobType != null && DIARY_JOB_LABEL\.containsKey\(jobType\)\)/)
  assert.match(postJava, /m\.put\("topicLabel", topicLabel\(r, diaryJobs\)\);/)
  assert.match(postJava, /j\.job_type in \('volunteer','parttime','fulltime'\)/)
  assert.match(postJava, /发布经验分享需要先选择一段已完成的换宿、兼职或全职经历/)
  assert.match(ctlJava, /@RequestParam\(required = false\) String jobType\)/)
  assert.match(ctlJava, /posts\.feed\(AppUserContext\.currentUserId\(\), kind, city, sort, page, keyword, jobType\)/)
  assert.match(moduleJava, /"daily:旅居攻略,buddy:找搭子,diary:经验分享"/)
})

/** 在沙箱里跑页面的 script setup（同 jobs-redesign-20261016 的做法）：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(src, stubs) {
  const d = parse(src).descriptor
  const source = d.scriptSetup.content
  const ast = babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, setTimeout, clearTimeout }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  // uni.xxx() 一律什么都不做
  const uni = new Proxy({}, { get: () => () => ({}) })
  Object.assign(sandbox, { uni, ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, onShow() {}, onHide() {}, onUnload() {} }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: 'script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
const plain = (v) => JSON.parse(JSON.stringify(v))

test('H5：找搭子「筛选」弹层开着时锁住页面滚动，关掉、离开本页时还原，回来再锁（小程序仍用 page-meta）', async (t) => {
  const hooks = { show: [], hide: [], unload: [] }
  const doc = { documentElement: { style: { overflow: '' } }, body: { style: { overflow: 'scroll' } } }
  const h = runSetup(index, {
    document: doc,
    useScreen: () => vue.ref(1),
    onShow: (fn) => hooks.show.push(fn),
    onHide: (fn) => hooks.hide.push(fn),
    onUnload: (fn) => hooks.unload.push(fn)
  })
  t.after(h.stop)
  const fire = (k) => hooks[k].forEach(fn => fn())
  const body = () => doc.body.style.overflow
  fire('show')
  assert.equal(body(), 'scroll', '弹层没开不锁')
  h.run('openFilter()')
  await flush()
  assert.equal(body(), 'hidden')
  // 只锁 body，html 不动（html 一写 hidden，body 自己变成一屏高的滚动框，页面跳回顶上）
  assert.equal(doc.documentElement.style.overflow, '')
  // 点遮罩 / ×：还原成原来的值
  h.run('filterOpen.value = false')
  await flush()
  assert.equal(body(), 'scroll')
  // 点「确定」收起也还原
  h.run('openFilter()')
  await flush()
  assert.equal(body(), 'hidden')
  h.run('applyFilter()')
  await flush()
  assert.equal(body(), 'scroll')
  // 弹层开着时离开本页（onHide）：先还原，回来再锁上
  h.run('openFilter()')
  await flush()
  fire('hide')
  assert.equal(body(), 'scroll')
  fire('show')
  assert.equal(body(), 'hidden')
  // 弹层只画在信息流这一屏：换到别的屏就不锁，回到信息流还开着就再锁
  h.run('s.value = 3')
  await flush()
  assert.equal(body(), 'scroll')
  h.run('s.value = 1')
  await flush()
  assert.equal(body(), 'hidden')
  // 页面关掉（onUnload）：还原
  fire('unload')
  assert.equal(body(), 'scroll')
  h.run('filterOpen.value = false')
  await flush()
  // 页面不在前台时打开弹层（理论上不会）：不去动 body，回到前台再锁
  fire('hide')
  h.run('openFilter()')
  await flush()
  assert.equal(body(), 'scroll')
  fire('show')
  assert.equal(body(), 'hidden')
  h.run('filterOpen.value = false')
  await flush()
  assert.equal(body(), 'scroll')
  assert.equal(doc.documentElement.style.overflow, '')

  // 源码：小程序的 page-meta 原样保留；H5 的锁只编进 H5；遮罩拦 touchmove、弹层自己不拦（超高时要能在弹层里滚）
  assert.match(index, /^<template>\n  <!-- #ifdef MP-WEIXIN -->\n  <page-meta :page-style="filterOpen \? 'overflow: hidden' : ''" \/>/)
  assert.match(index, /function lockPageScroll\(on\) \{\n  \/\/ #ifdef H5\n[\s\S]*?\n  \/\/ #endif\n\}/)
  assert.match(index, /onUnload\(\(\) => lockPageScroll\(false\)\)/)
  const tp = tpl(index)
  assert.match(tp, /<view v-if="filterOpen" class="k-mask" @click="filterOpen = false" @touchmove\.stop\.prevent \/>\n\s*<view v-if="filterOpen" class="k-sheet fsheet">\n/)
  assert.match(css(index), /\.fsheet \{ max-height: 82vh; overflow-y: auto; \}/)
  assert.match(index, /\/\* #ifdef H5 \*\/\n\/\*[^\n]*\*\/\n\.fsheet \{ overscroll-behavior: contain; \}\n\/\* #endif \*\//)
})

test('个人主页的动态：小标签和信息流卡片同一份（审核中 / 仅限女生·男生 / 伙伴说）', async (t) => {
  let loaded
  const rows = [
    { postId: 1, kind: 'buddy', status: 'online', genderLimit: 'female', genderLimitLabel: '仅限女生', tone: '', toneLabel: '', title: 'a' },
    { postId: 2, kind: 'buddy', status: 'pending', genderLimit: 'male', genderLimitLabel: '仅限男生', tone: '', toneLabel: '', title: 'b' },
    { postId: 3, kind: 'daily', status: 'online', genderLimit: '', genderLimitLabel: '不限', tone: 'avoid', toneLabel: '避雷', title: 'c' },
    { postId: 4, kind: 'diary', status: 'online', genderLimit: '', genderLimitLabel: '不限', tone: '', toneLabel: '', title: 'd' }
  ]
  const more = [
    { postId: 4, kind: 'diary', status: 'online', title: 'd' },
    { postId: 5, kind: 'daily', status: 'pending', tone: 'recommend', toneLabel: '推荐', title: 'e' }
  ]
  const h = runSetup(user, {
    postTags,
    experience: vue.reactive({ account: null }),
    getSessionRevision: () => 1,
    onLoad: (fn) => { loaded = fn },
    ensureSession: async () => {},
    apiUserProfile: async (uid, page) => ({ data: page === 1 ? { userId: uid, name: 'E', hasMore: true, posts: rows } : { userId: uid, name: 'E', hasMore: false, posts: more } })
  })
  t.after(h.stop)
  await loaded({ uid: '9409' })
  const chips = () => plain(h.run('posts.value')).map(p => [p.postId, p.chips.map(c => c.text + '/' + c.tone)])
  assert.deepEqual(chips(), [
    [1, ['仅限女生/red']],
    [2, ['动态待审核·仅自己可见/ochre', '仅限男生/red']],
    [3, ['伙伴说 · 避雷/red']],
    [4, []]
  ])
  // 上滑加载更多的那一页也带上小标签（重复的那条不再加）
  await h.run('load(false)')
  assert.deepEqual(chips().slice(3), [[4, []], [5, ['动态待审核·仅自己可见/ochre', '伙伴说 · 推荐/green']]])
  // 模板：一份 v-for 画出来，不再自己写审核中 / 伙伴说
  const tu = tpl(user)
  assert.match(user, /import \{ postTags, kindOf \} from '\.\/community-feed\.js'/)
  assert.match(tu, /<k-chip v-for="t in p\.chips" :key="t\.key" :tone="t\.tone">\{\{ t\.text \}\}<\/k-chip>/)
  assert.doesNotMatch(tu, /审核中|伙伴说/)
})
