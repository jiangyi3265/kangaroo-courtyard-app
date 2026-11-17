// 人工客服小钮：用户端和商家端固定显示在右侧。
// node --test，不构建、不发请求；真实界面的重叠检查在 forms-batch/fab-overlap.json（Playwright），真机打开客服会话要主人或模拟器验。
// 守住这几件事：
//   · 哪一页、什么身份出：用户身份一律出；员工身份只有合作商家出；名单里的页面、深色顶栏、登录态恢复前不出；传 :fab="false" 不出；
//   · 小程序是 open-type="contact" 的按钮（直接打开微信客服会话），网页版去客服中心；
//   · 只放在 k-topbar 一处：每个页面至少一处顶栏、任意两处不能同时显示（不然屏幕上两个钮）；
//   · 样子：贴右边、宽 28、状态栏往下 396（小屏 268，高过固定底栏）、竖排 13px 字；
//   · 新逻辑是不 import 任何东西的纯函数，不把别的模块带进主包。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const sfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const { FAB_HIDDEN_ROUTES, fabVisible, fabSessionFrom } = await vite.ssrLoadModule('/common/support-fab.js')
await vite.close()

const on = { route: 'pages/home/index', restored: true, mode: 'user', roleCode: undefined, dark: false }

test('用户身份（含游客）一律出，切到用户身份的员工也出', () => {
  assert.equal(fabVisible(on), true)
  assert.equal(fabVisible({ ...on, roleCode: 'keeper' }), true, '有员工授权但当前是用户身份')
  assert.equal(fabVisible({ ...on, route: 'pages/manage/tasks' }), true, '门店任务页也给没有员工授权的在店换工用，他们是用户身份')
})

test('员工身份只有合作商家出', () => {
  assert.equal(fabVisible({ ...on, mode: 'staff', roleCode: 'merchant' }), true)
  for (const roleCode of ['manager', 'keeper', 'staff', 'online_staff', 'merchant_service', 'city_lead', undefined, null, '']) {
    assert.equal(fabVisible({ ...on, mode: 'staff', roleCode }), false, String(roleCode))
  }
})

test('登录态恢复前、深色顶栏、读不到页面路径、名单里的页面都不出', () => {
  assert.equal(fabVisible({ ...on, restored: false }), false, '老员工冷启动不能闪一下')
  assert.equal(fabVisible({ ...on, dark: true }), false, '面试视频屏')
  assert.equal(fabVisible({ ...on, route: '' }), false)
  assert.equal(fabVisible({ ...on, route: undefined }), false)
  for (const route of FAB_HIDDEN_ROUTES) {
    assert.equal(fabVisible({ ...on, route }), false, route)
    assert.equal(fabVisible({ ...on, route, mode: 'staff', roleCode: 'merchant' }), false, route)
  }
})

test('不出的页面名单：登录流程、全屏选择器、客服页本身、聊天页、状态样例、给亲友看的行程页；每一个都是真实页面', () => {
  assert.deepEqual([...FAB_HIDDEN_ROUTES].sort(), [
    'pages/auth/identity', 'pages/auth/legal', 'pages/auth/login', 'pages/auth/onboarding',
    'pages/community/chat', 'pages/home/assistant', 'pages/home/city-picker', 'pages/jobs/itinerary',
    'pages/notice/states', 'pages/notice/support', 'pages/system/picker'
  ])
  const config = JSON.parse(read('pages.json'))
  const routes = [...config.pages.map(p => p.path), ...config.subPackages.flatMap(s => s.pages.map(p => s.root + '/' + p.path))]
  assert.deepEqual(FAB_HIDDEN_ROUTES.filter(r => !routes.includes(r)), [])
})

test('session-from 的格式和客服页 contactFrom 一样：用户编号|support-情境，情境写 fab；游客写 guest', () => {
  assert.equal(fabSessionFrom(7), '7|support-fab')
  assert.equal(fabSessionFrom('abc'), 'abc|support-fab')
  assert.equal(fabSessionFrom(null), 'guest|support-fab')
  assert.equal(fabSessionFrom(undefined), 'guest|support-fab')
  assert.match(read('common/support-chat.js'), /String\(\(experience\.account && experience\.account\.id\) \|\| 'guest'\) \+ '\|support-' \+ ctx\.value/)
})

test('小钮规则是纯函数：不 import 任何东西，主包不会多带模块', () => {
  assert.doesNotMatch(read('common/support-fab.js'), /^\s*import\s/m)
})

// ---------------------------------------------------------------- 顶栏里的小钮
const topbar = sfc('components/k-topbar/k-topbar.vue')

test('小程序是微信客服按钮，网页版去客服中心；两段各在自己的条件编译里', () => {
  const tpl = topbar.template.content
  assert.match(tpl, /<!-- #ifdef MP-WEIXIN -->\s*<button v-if="fabOn" class="k-fab" :style="fabStyle" open-type="contact" :session-from="fabFrom"[^>]*>/)
  assert.match(tpl, /<!-- #ifndef MP-WEIXIN -->\s*<view v-if="fabOn" class="k-fab" :style="fabStyle" hover-class="k-press-s"[^>]*@click="openSupport">/)
  const script = topbar.scriptSetup.content
  assert.match(script, /\/\/ #ifndef MP-WEIXIN\nimport \{ go \} from '@\/common\/screen\.js'\n\/\/ #endif/)
  assert.match(script, /\/\/ #ifndef MP-WEIXIN\nconst openSupport = \(\) => go\('\/pages\/notice\/support'\)\n\/\/ #endif/)
  // 返回拦截那段不能被插开（back-guard.test.mjs 钉着相邻关系），小钮是单独的一段
  assert.match(tpl, /@beforeleave="onSystemBack" \/>\s*<!-- #endif -->/)
})

function runTopbar({ fab = true, dark = false, route = 'pages/home/index', mode = 'user', roleCode, restored = true, accountId = 7, pages, system } = {}) {
  const source = topbar.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const gone = []
  const sandbox = {
    console, Date, uni: system ? { getSystemInfoSync: () => system } : {}, ref: vue.ref, computed: vue.computed, watch() {}, onMounted: (fn) => fn(), onBeforeUnmount() {}, getCurrentInstance: () => null,
    defineOptions() {}, defineEmits: () => () => {}, defineProps: () => ({ fab, dark, back: false, customBack: false }),
    getCurrentPages: () => pages === undefined ? [{ route: 'pages/earlier' }, { route }] : pages,
    addGuard() {}, removeGuard() {}, armSoon() {}, newsTip: {}, openNewsTip() {},
    experience: { mode, account: accountId ? { id: accountId } : null }, session: { restored }, currentStaffStore: { value: roleCode ? { roleCode } : null },
    fabVisible, fabSessionFrom, go: u => gone.push(u)
  }
  vm.createContext(sandbox)
  vm.runInContext(body, sandbox, { filename: 'k-topbar.vue' })
  return { on: vm.runInContext('fabOn.value', sandbox), from: vm.runInContext('fabFrom.value', sandbox), style: vm.runInContext('fabStyle', sandbox), open: () => vm.runInContext('openSupport()', sandbox), gone }
}

test('顶栏把当前页面、身份、深色带给规则；:fab="false" 的填写屏不出；路径取最上面一页', () => {
  assert.equal(runTopbar().on, true)
  assert.equal(runTopbar({ fab: false }).on, false, '填写屏字段从屏幕边开始，钮改放底部操作条')
  assert.equal(runTopbar({ dark: true }).on, false)
  assert.equal(runTopbar({ route: 'pages/community/chat' }).on, false)
  assert.equal(runTopbar({ mode: 'staff', roleCode: 'keeper' }).on, false)
  assert.equal(runTopbar({ mode: 'staff', roleCode: 'merchant' }).on, true)
  assert.equal(runTopbar({ restored: false }).on, false)
  assert.equal(runTopbar({ pages: [] }).on, false, '读不到页面就不出，不报错')
  assert.equal(runTopbar().from, '7|support-fab')
  assert.equal(runTopbar({ accountId: 0 }).from, 'guest|support-fab')
  const h = runTopbar()
  h.open()
  assert.deepEqual(h.gone, ['/pages/notice/support'])
})

test('fab 属性是 Boolean、默认 true：老页面不用改就有小钮', () => {
  assert.match(topbar.scriptSetup.content, /fab: \{ type: Boolean, default: true \}/)
})

test('高度：内容从状态栏往下排，就从状态栏往下量（高屏 396、小屏 268）；再矮也不碰底部操作条；取不到屏幕信息用样式里的 55%', () => {
  const topOf = (windowHeight, statusBarHeight) => runTopbar({ system: { windowHeight, statusBarHeight } }).style
  assert.equal(topOf(812, 44), 'top:440px')
  assert.equal(topOf(844, 47), 'top:443px')
  assert.equal(topOf(640, 24), 'top:420px')
  assert.equal(topOf(639, 24), 'top:292px', '不到 640 高的小屏放高一点，让开页面最后的提交按钮')
  assert.equal(topOf(568, 20), 'top:288px')
  assert.equal(topOf(480, 20), 'top:270px', '再矮也不碰底部操作条')
  assert.equal(runTopbar().style, '', '取不到屏幕信息')
  // 固定底栏最高的是 stays/order 的退款钮：到底部 142（再加安全区，刘海屏才有）。钮的下沿都要在它上面
  const height = Number(/height: (\d+)px;/.exec(/\.k-fab \{([^}]*)\}/.exec(topbar.styles[0].content)[1])[1])
  for (const [windowHeight, status, safe] of [[640, 24, 0], [667, 20, 0], [568, 20, 0], [480, 20, 0], [812, 44, 34], [844, 47, 34], [896, 48, 34]]) {
    const top = Number(/top:(\d+)px/.exec(topOf(windowHeight, status))[1])
    assert.ok(top + height <= windowHeight - 142 - safe, `${windowHeight} 高：下沿 ${top + height}`)
  }
})

test('样子：贴屏幕右边、不跟着滑、宽 28；字 13px 竖排', () => {
  const css = topbar.styles[0].content
  const fab = /\.k-fab \{([^}]*)\}/.exec(css)[1]
  assert.match(fab, /position: fixed;/)
  assert.match(fab, /right: 0;/)
  assert.match(fab, /left: auto;/)
  assert.match(fab, /border-radius: 12px 0 0 12px;/)
  assert.match(fab, /top: 55%;/)
  assert.match(fab, /width: 28px;/)
  assert.ok(Number(/height: (\d+)px;/.exec(fab)[1]) >= 44, '高度够手指点')
  assert.match(fab, /flex-direction: column;/)
  const text = /\.k-fab__text \{([^}]*)\}/.exec(css)[1]
  assert.match(text, /font-size: 13px;/)
  assert.match(css, /\.k-fab::after \{ border: 0; \}/, '微信 button 自带的边框要去掉')
  const tpl = topbar.template.content
  assert.equal((tpl.match(/<text class="k-fab__text">客<\/text><text class="k-fab__text">服<\/text>/g) || []).length, 2, '两段模板都是竖排两个字')
})

// ---------------------------------------------------------------- 只放在 k-topbar 一处
// 每个页面至少一处顶栏；一个页面里任意两处都在同一组 v-if / v-else 的不同分支里，不会同时显示（不然屏幕上两个钮）
function topbarsOf(rel) {
  const { descriptor } = compiler.parse(read(rel), { filename: rel })
  if (!descriptor.template) return []
  const out = []
  const walk = (node, chain) => {
    if (node.tag === 'k-topbar') out.push({ line: node.loc.start.line, chain })
    let group = '', index = 0
    for (const kid of node.children || []) {
      if (kid.type !== 1) continue
      const dir = (kid.props || []).find(p => p.type === 7 && ['if', 'else-if', 'else'].includes(p.name))
      let next = chain
      if (dir) {
        if (dir.name === 'if') { group = kid.loc.start.line + ':' + kid.loc.start.column; index = 0 } else index++
        next = chain.concat({ group, index })
      }
      walk(kid, next)
    }
  }
  walk({ children: descriptor.template.ast.children }, [])
  return out
}
const exclusive = (a, b) => a.chain.some(x => b.chain.some(y => x.group === y.group && x.index !== y.index))

test('全部页面：每页至少一处顶栏（小钮才有地方放），任意两处不能同时显示', () => {
  const config = JSON.parse(read('pages.json'))
  const routes = [...config.pages.map(p => p.path), ...config.subPackages.flatMap(s => s.pages.map(p => s.root + '/' + p.path))]
  assert.ok(routes.length >= 84)
  const none = [], both = []
  for (const route of routes) {
    const list = topbarsOf(route + '.vue')
    if (!list.length) none.push(route)
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (!exclusive(list[i], list[j])) both.push(`${route} 第 ${list[i].line} 行和第 ${list[j].line} 行`)
    }
  }
  assert.deepEqual(none, [])
  assert.deepEqual(both, [])
})

test('工作台的四个角色首页组件自带顶栏：合作商家首页也有小钮', () => {
  for (const rel of ['pages/staff/components/k-merchant-work.vue', 'pages/staff/components/k-service-work.vue', 'pages/staff/components/k-city-work.vue', 'pages/staff/components/k-online-work.vue']) {
    assert.ok(topbarsOf(rel).length >= 1, rel)
  }
})

test('页面自己的底部客服钮（填写屏）和浮动钮不会同时出现：放了 fc-kefu 的页面，顶栏都按屏传了 :fab', () => {
  const walk = (dir) => fs.readdirSync(path.join(APP, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(dir + '/' + e.name) : (e.name.endsWith('.vue') ? [dir + '/' + e.name] : []))
  for (const rel of walk('pages')) {
    const src = read(rel)
    if (!/<fc-kefu\b/.test(src)) continue
    assert.match(src, /:fab="[^"]+"/, rel + ' 底部有客服钮，顶栏要传 :fab')
  }
})

test('简历的两屏填写屏：不出浮动钮（字段从屏幕边开始），客服放顶栏返回箭头旁边；谁能看到还是同一条规则', () => {
  const page = sfc('pages/profile/resume.vue')
  assert.match(page.template.content, /<k-topbar :title="titles\[s - 1\]" back custom-back :fab="!editing" @back="onBack">/)
  assert.match(page.template.content, /<!-- #ifdef MP-WEIXIN -->\s*<button v-if="navKefu" class="nav-kefu" open-type="contact" :session-from="kefuFrom"/)
  // 网页版去客服中心：写字面路径，和 k-topbar、fc-kefu 一样（ai-sheet-20261016 不许页面里出现 go(R.support，那条老测试不放宽）
  assert.match(page.template.content, /<!-- #ifndef MP-WEIXIN -->\s*<view v-if="navKefu" class="nav-kefu"[^>]*@click="go\('\/pages\/notice\/support'\)"/)
  assert.match(page.scriptSetup.content, /const editing = computed\(\(\) => s\.value === 2 \|\| s\.value === 3\)/)
  assert.match(page.scriptSetup.content, /editing\.value && fabVisible\(\{ route: 'pages\/profile\/resume'/)
})
