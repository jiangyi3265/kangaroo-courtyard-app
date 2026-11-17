// 10-16 主人拍板两件事 + 三处小修的回归（node --test，不构建、不发请求）：
//   · 「AI袋鼠」改成当前页底部弹出的对话（components/k-ai-sheet），不再跳页：我的、消息、城市页悬浮袋鼠、订单页（带订单号，退款试算照常）、
//     岗位筛选 / 门店 / 面试 / 评价 / 状态页的「联系客服」都在本页弹出；整页客服 pages/notice/support 留给深链接；
//   · 「我的」去掉「我的提醒」，看消息只在底栏「消息」，通知开关仍在「设置 → 通知管理」（提醒中心 ?s=4）；
//   · 岗位详情「评价」没有评分时写「暂无评分」；筛选页 320×640 一屏放下；选城市 A–Z 分组只写城市名、不截断。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const flush = () => new Promise(resolve => setImmediate(resolve))
const plain = (x) => JSON.parse(JSON.stringify(x))
const SHEET = 'components/k-ai-sheet/k-ai-sheet.vue'

/** 在沙箱里跑一段脚本：import 全部先给永远不返回的函数，再用 stubs 覆盖；defineXxx 编译宏换成桩 */
function runScript(source, stubs, filename) {
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end).replace(/^export\s+/, '')).join('\n')
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive, nextTick: vue.nextTick,
    onUnmounted() {}, defineOptions() {}
  }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename }))
  return { run: code => vm.runInContext(code, sandbox), sandbox, stop: () => scope.stop() }
}

// ---------------------------------------------------------------- 弹层本身
test('弹层的样子：遮罩 + 75% 屏高、顶部 16px 圆角；顶栏「AI袋鼠」+ 转人工 + ×；快捷问题、气泡（最多 3 个按钮）、底部输入框防键盘遮挡', () => {
  const d = readSfc(SHEET)
  const t = d.template.content, css = d.styles.map(s => s.content).join('\n')
  assert.match(t, /<view v-if="show" class="k-ai" role="dialog" aria-modal="true"/)
  assert.match(t, /<view class="k-ai__mask" @click="close" @touchmove\.stop\.prevent="noop" \/>/)
  assert.match(t, /<text class="k-ai__title">AI袋鼠<\/text>/)
  assert.match(t, /<view class="k-ai__x" hover-class="k-press" aria-role="button" aria-label="关闭" @click="close">/)
  assert.match(t, /<!-- #ifdef MP-WEIXIN -->\s*<button class="k-ai__human" open-type="contact" :session-from="contactFrom">/)
  assert.match(t, /<!-- #ifndef MP-WEIXIN -->\s*<view class="k-ai__human" hover-class="k-press" @click="toHuman">/)
  assert.match(t, /v-for="chipText in chips"[^>]*@click="ask\(chipText\)"/)
  assert.match(t, /<scroll-view scroll-y class="k-ai__body" :scroll-top="scrollTop"/)
  assert.match(t, /v-for="linkItem in msgItem\.links"[^>]*@click="openLink\(linkItem\)"/)
  assert.match(t, /<view v-if="msgItem\.refund" class="k-ai__refund">/)
  assert.match(t, /<input v-model="input" confirm-type="send" :maxlength="200" :adjust-position="true" :cursor-spacing="20"/)
  // 按住顶栏往下拖收起
  assert.match(t, /<view class="k-ai__head" @touchstart="dragStart" @touchmove\.stop\.prevent="dragMove" @touchend="dragEnd" @touchcancel="dragEnd">/)
  assert.match(css, /\.k-ai__sheet \{[^}]*height: 75vh;[^}]*border-radius: 16px 16px 0 0;/)
  // 盖住底栏（50）、选城市面板（81），比系统弹窗 / 轻提示（999）低：网页版「转人工」的确认框要在弹层上面
  const z = Number(css.match(/\.k-ai \{[^}]*z-index: (\d+);/)[1])
  assert.ok(z > 81 && z < 999, String(z))
  // 主包组件只能用主包里的图（分包 pages/notice/static 的图主包里取不到）
  for (const m of t.matchAll(/(?<!:)src="([^"]+)"/g)) assert.match(m[1], /^\/static\//, m[1])
  // 小程序的 text 不支持 hover-class；循环别名用长名字（短名字会和图标属性提升撞名）
  assert.doesNotMatch(t, /<text [^>]*hover-class/)
  for (const m of t.matchAll(/v-for="\(?(\w+)/g)) assert.ok(m[1].length > 3, m[1])
})

function sheet(props0 = {}) {
  const emits = [], gone = [], starts = []
  const props = vue.reactive({ show: false, ctx: 'profile', orderNo: '', ...props0 })
  const h = runScript(readSfc(SHEET).scriptSetup.content, {
    defineProps: () => props, defineEmits: () => (...a) => emits.push(a),
    go: (u) => gone.push(u),
    useSupportChat: (opts) => ({ opts, chips: vue.ref([]), msgs: vue.ref([]), input: vue.ref(''), asking: vue.ref(false), order: vue.ref(null), contactFrom: vue.ref(''), orderTitle: vue.ref(''), orderDates: vue.ref(''), start: (c, n) => starts.push([c, n]), ask() {}, send() {}, openFaq() {}, openLink() {}, toHuman() {} })
  }, SHEET)
  return { ...h, props, emits, gone, starts }
}

test('弹层打开时开场（带情境和订单号），收起再打开接着聊，换了情境 / 订单才重开', async () => {
  const s = sheet({ ctx: 'order', orderNo: 'SO1' })
  assert.deepEqual(s.starts, [], '没打开不发请求')
  s.props.show = true; await flush()
  assert.deepEqual(s.starts, [['order', 'SO1']])
  s.props.show = false; await flush()
  s.props.show = true; await flush()
  assert.deepEqual(s.starts, [['order', 'SO1']])
  s.props.show = false; s.props.orderNo = 'SO2'; await flush()
  s.props.show = true; await flush()
  assert.deepEqual(s.starts, [['order', 'SO1'], ['order', 'SO2']])
  s.stop()
})

test('点回答里的按钮 / 卡片：先收起（告诉宿主页是要跳走）再跳；遮罩、× 只收起；往下拖过 80px 收起，拖得短不收', () => {
  const s = sheet()
  s.run("open('/pages/jobs/progress?appId=1')")
  assert.deepEqual(plain(s.emits), [['close', 'nav']])
  assert.deepEqual(s.gone, ['/pages/jobs/progress?appId=1'])
  s.run("openCard({ url: '' })")
  assert.equal(s.gone.length, 1, '没有地址的卡片点了不跳')
  s.run('close()')
  assert.deepEqual(plain(s.emits).at(-1), ['close'])
  s.run('dragStart({ touches: [{ clientY: 100 }] })')
  s.run('dragMove({ touches: [{ clientY: 150 }] })')
  assert.equal(s.run('dragY.value'), 50, '跟着手往下走')
  s.run('dragEnd()')
  assert.equal(s.emits.length, 2, '拖 50px 松手不收')
  assert.equal(s.run('dragY.value'), 0)
  s.run('dragStart({ touches: [{ clientY: 100 }] })')
  s.run('dragMove({ touches: [{ clientY: 60 }] })')
  assert.equal(s.run('dragY.value'), 0, '往上拖不动')
  s.run('dragMove({ touches: [{ clientY: 200 }] })')
  s.run('dragEnd()')
  assert.deepEqual(plain(s.emits).at(-1), ['close'])
  s.stop()
})

test('网页版打开时锁住 body 滚动（同岗位列表的 lockPageScroll），收起、页面销毁时原样还原；小程序靠宿主页的 page-meta', () => {
  const script = readSfc(SHEET).scriptSetup.content
  assert.match(script, /function lockPageScroll\(on\) \{\n\s+\/\/ #ifdef H5\n/)
  assert.match(script, /body\.style\.overflow = 'hidden'/)
  assert.match(script, /watch\(\(\) => props\.show, \(on\) => \{\n\s+lockPageScroll\(on\)/)
  assert.match(script, /onUnmounted\(\(\) => lockPageScroll\(false\)\)/)
})

// ---------------------------------------------------------------- 各页入口
const HOSTS = {
  'pages/profile/index.vue': ['profile', '@close="aiOpen = false"'],
  'pages/messages/index.vue': ['profile', '@close="aiOpen = false"'],
  'pages/home/city.vue': ['city', '@close="closeAi"'],
  'pages/stays/order.vue': ['order', ':order-no="aiOrderNo" @close="aiOpen = false"'],
  'pages/jobs/filter.vue': ['city', '@close="aiOpen = false"'],
  'pages/jobs/team.vue': ['city', '@close="aiOpen = false"'],
  'pages/jobs/interview.vue': ['profile', '@close="closeAi"'],
  'pages/profile/review.vue': ['profile', '@close="aiOpen = false"'],
  'pages/notice/states.vue': ['profile', '@close="aiOpen = false"']
}

test('各页「AI袋鼠 / 联系客服」都在本页弹出：放一个 k-ai-sheet（情境对），小程序页首 page-meta 跟着弹层锁滚动', () => {
  for (const [rel, [ctx, rest]] of Object.entries(HOSTS)) {
    const src = read(rel)
    assert.ok(src.includes(`<k-ai-sheet :show="aiOpen" ctx="${ctx}" ${rest} />`), rel)
    assert.ok(src.startsWith(`<template>\n  <!-- #ifdef MP-WEIXIN -->\n  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />`), rel + ' 的 page-meta 是第一个节点、只在小程序里')
    assert.match(src, /const aiOpen = ref\(false\)/, rel)
  }
})

test('不再有问问题跳去客服页 / 城市页客服屏的入口（整页客服只留给深链接：老消息 ?s=4、旧版 assistant?ctx=）', () => {
  const pages = []
  const walk = (dir) => { for (const e of fs.readdirSync(path.join(APP, dir), { withFileTypes: true })) { const p = dir + '/' + e.name; if (e.isDirectory()) walk(p); else if (/\.(vue|js)$/.test(e.name)) pages.push(p) } }
  walk('pages'); walk('components')
  for (const rel of pages) {
    const src = read(rel)
    // 例外（2026-10-30 主人）：商家端的「体验反馈」要能转人工，直接去整页客服
    // 地区群没有可用二维码时，明确联系平台人工客服；这不是提问入口改成整页 AI。
    if (rel === 'pages/staff/components/k-merchant-work.vue' || rel === 'pages/profile/index.vue' || rel === 'pages/jobs/components/region-group-card.vue') {
      assert.doesNotMatch(src, /R\.assistant \+ '\?ctx|R\.city \+ '\?s=3'/, rel)
      continue
    }
    assert.doesNotMatch(src, /go\(R\.support|R\.assistant \+ '\?ctx|R\.city \+ '\?s=3'/, rel)
  }
  // 订单页：带上这张订单号打开，退款试算照常出来
  const order = readSfc('pages/stays/order.vue').scriptSetup.content
  assert.match(order, /const askAssistant = \(\) => \{ aiOrderNo\.value = od\.value\.orderNo \|\| orderNo; aiOpen\.value = true \}/)
  // 消息页：底部「联系袋鼠小院客服」、落地页是客服中心（?s=4）的消息都在本页弹出；老链接 ?s=4 直接打开的仍转整页客服
  const msg = read('pages/messages/index.vue')
  assert.match(msg, /<view class="help" hover-class="k-press" @click="aiOpen = true">[\s\S]*?<text>联系袋鼠全球青年客服<\/text>[\s\S]*?<\/view>/)
  assert.match(msg, /else if \(\/\[\?&\]s=4\(&\|\$\)\/\.test\(m\.route\)\) aiOpen\.value = true/)
  assert.match(msg, /const legacyUrl = \(q\) => q\.s === '4' \? R\.support/)
  // 面试页：点了回答里的按钮跳走的，回来时刷新进度
  assert.match(read('pages/jobs/interview.vue'), /const closeAi = \(why\) => \{ aiOpen\.value = false; if \(why === 'nav'\) awayToPage = true \}/)
})

test('地区群：正常群码只预览实际图片，缺码 / 过期 / 加载失败才提供明确的人工客服兜底', () => {
  const src = read('pages/jobs/components/region-group-card.vue')
  const ready = src.slice(src.indexOf('<template v-else-if="group.state'), src.indexOf('<template v-else>'))
  const fallback = src.slice(src.indexOf('<template v-else>'), src.indexOf('</template>', src.indexOf('<template v-else>')))
  assert.match(ready, /group\.state === 'ready' && group\.qrUrl && !imageError/)
  assert.match(ready, /:src="absUrl\(group\.qrUrl\)"[^>]*@click="preview"/)
  assert.doesNotMatch(ready, /R\.support/)
  assert.match(fallback, /二维码暂未配置/)
  assert.match(fallback, /二维码已过期/)
  assert.match(fallback, /群码图片加载失败/)
  assert.match(fallback, /label="联系平台客服获取入群方式" @click="go\(R\.support\)"/)
  assert.match(src, /if \(await load\(\) && group\.value\.state === 'ready' && group\.value\.qrUrl\)/, '预览前重新校验群码状态')
  assert.doesNotMatch(src, /已加入|已入群/, '预览群码不能宣称已入群')
})

// ---------------------------------------------------------------- 去掉「我的提醒」
test('「我的」不再有「我的提醒」；「更多服务」剩 3 格按 3 列铺满；别处的文案改指「设置 → 通知管理」', () => {
  const profile = read('pages/profile/index.vue')
  assert.doesNotMatch(profile, /我的提醒'|R\.reminders, badge/)
  // 10-18「更多服务」加了「成为商家」，变回 4 格：邀请有礼、AI袋鼠、成为商家、设置
  for (const label of ['邀请有礼', 'AI袋鼠', '成为商家', '设置']) assert.ok(profile.includes(label))
  assert.match(profile, /'grid--3': groupItem\.items\.length === 3/); assert.match(profile, /'grid--2': groupItem\.items\.length === 2/)
  // 通知开关还在：设置 → 通知管理 → 提醒中心 ?s=4（通知偏好设置）
  assert.match(profile, /<view class="srow srow--tall has-line" hover-class="k-press" @click="go\(R\.reminders \+ '\?s=4'\)">/)
  assert.ok(JSON.parse(read('pages.json').replace(/^﻿/, '')).pages.some(p => p.path === 'pages/messages/reminders'), '提醒中心页面还在（?s=4 要能打开）')
  assert.match(read('pages/jobs/filter.vue'), /有新机会时通过消息中心通知你，可在「我的 → 设置 → 通知管理」里暂停/)
  assert.doesNotMatch(read('pages/profile/profile-icons.js'), /reminders:/)
})

// ---------------------------------------------------------------- 三处小修
test('岗位详情「用户反馈」：还没有评分时不写分数和星（不再是大号「—」+「分」+ 五颗空星），没有评价时如实说', () => {
  // 2026-10-18：「评价」页签去掉了，评价放进页面里「用户反馈」那一块；综合分只有算得出来时才写
  const d = readSfc('pages/jobs/detail.vue')
  assert.match(d.template.content, /<text v-if="digest\.avgText" class="sp-fbk__num">\{\{ digest\.avgText \}\}<\/text><k-icon v-if="digest\.avgText" name="star"/)
  assert.match(d.template.content, /<text v-else-if="!digest\.count" class="sp-fbk__none">还没有做过这类岗位的伙伴写评价/)
  assert.doesNotMatch(d.template.content, /rating-total/)
})

test('筛选页 ≤360 宽：每组上下各收 2px、胶囊 28px，320×640 一屏放得下（之前卡片底边被底栏压住 18px）', () => {
  const css = readSfc('pages/jobs/filter.vue').styles.map(s => s.content).join('\n')
  const block = css.slice(css.indexOf('@media (max-width: 360px) {'))
  assert.match(block, /^@media \(max-width: 360px\) \{\n\s+\.sec \{ padding: 4px 0; \}\n\s+\.sec--line \{ padding: 0; \}\n\s+\.pills \{ gap: 4px; margin-top: 4px; \}\n\s+\.pill \{ height: 28px; \}\n\}/)
  assert.ok(css.indexOf('@media (max-width: 360px) {') > css.indexOf('.pill {'), '写在基础样式后面才盖得住')
})

test('选城市 A–Z 分组：「湘潭·湖南省」只写「湘潭」，放得下时省份小字跟在后面；长名字不截断（折行）；选中仍用原名', async () => {
  const cd = await import('data:text/javascript;base64,' + Buffer.from(read('common/city-directory.js')).toString('base64'))
  const jf = await import('data:text/javascript;base64,' + Buffer.from(read('pages/jobs/job-filters.js')).toString('base64'))
  const rows = [
    { name: '湘潭·湖南省', cityName: '湘潭·湖南省', province: '湖南省', level: 'city', initial: 'X' },
    { name: '厦门', province: '福建省', level: 'city', initial: 'X' },
    { name: '乌鲁木齐·新疆维吾尔自治区', province: '新疆维吾尔自治区', level: 'city', initial: 'W' },
    { name: '朝阳·辽宁省', province: '辽宁省', level: 'city', initial: 'Z' },
    { name: '巴音郭楞蒙古自治州', province: '新疆维吾尔自治区', level: 'city', initial: 'B' },
    { name: '思明区', cityName: '厦门', province: '福建省', level: 'district', initial: 'S' }
  ]
  const d = readSfc('pages/jobs/components/job-city-panel.vue')
  const h = runScript(d.script.content + '\n' + d.scriptSetup.content, {
    defineProps: () => ({ type: 'volunteer', value: ['湘潭·湖南省'], max: 5, top: 0 }), defineEmits: () => () => {},
    loadJobCityDirectory: async () => ({ all: rows, hot: ['大理'] }), loadJobCities: async () => [], citySuggestions: (await import('../pages/jobs/job-city-search.js')).citySuggestions,
    filterCities: cd.filterCities, groupCities: cd.groupCities, businessCityName: cd.businessCityName, scenicSuggest: jf.scenicSuggest,
    toggleCitySelection: (sel, name) => ({ selected: sel.includes(name) ? sel.filter(x => x !== name) : [...sel, name], limited: false }),
    uni: { getSystemInfoSync: () => ({ windowWidth: 320 }), showToast() {}, hideKeyboard() {} }
  }, 'job-city-panel')
  await flush(); await flush()
  const groups = plain(h.run('letterGroups.value'))
  const cell = (n) => groups.flatMap(g => g.items).find(c => c.name === n)
  assert.deepEqual(cell('湘潭·湖南省'), { name: '湘潭·湖南省', city: '湘潭·湖南省', label: '湘潭', prov: '湖南' })
  assert.deepEqual(cell('厦门'), { name: '厦门', city: '厦门', label: '厦门', prov: '' }, '不重名的城市不加省份')
  assert.equal(cell('乌鲁木齐·新疆维吾尔自治区').label, '乌鲁木齐')
  assert.equal(cell('乌鲁木齐·新疆维吾尔自治区').prov, '', '「乌鲁木齐 新疆」6 个字一格放不下，不写省份')
  assert.equal(cell('朝阳·辽宁省').prov, '辽宁')
  assert.equal(cell('巴音郭楞蒙古自治州').label, '巴音郭楞蒙古自治州', '长名字整个写出来')
  assert.ok(!groups.flatMap(g => g.items).some(c => c.name === '思明区'), '区县不进字母分组')
  // 已选标签、联想结果也只写城市名
  assert.equal(h.run("shortCity('湘潭·湖南省')"), '湘潭')
  h.run("keyword.value = '湘潭'")
  assert.equal(plain(h.run('results.value')).find(r => r.name === '湘潭·湖南省').label, '湘潭')
  const t = d.template.content
  assert.match(t, /class="cp-cell cp-cell--az" :class="\{ on: picked\.includes\(cityRow\.city\) \}" hover-class="k-press-s" @click="toggle\(cityRow\.name\)"><text class="cp-cell__name cp-cell__name--full">\{\{ cityRow\.label \}\}<\/text><text v-if="cityRow\.prov" class="cp-cell__prov">\{\{ cityRow\.prov \}\}<\/text>/)
  const css = d.styles.map(s => s.content).join('\n')
  assert.match(css, /\.cp-cell \{ min-height: 42px;/)
  assert.match(css, /\.cp-cell__name \{[^}]*white-space: normal;/)
  h.stop()
})
