// 「我的」首屏 10-16 改版（设计图 22）的回归：node --test，不构建、不发请求。
// 守住这几件事：
//   · 双色手绘图标模块 profile-icons.js：页面用到的图标名都有、各不相同；SVG 只有 ASCII、只用小程序里稳妥的元素；
//     模块只在 profile 分包里被引用（别的分包也引用的话 uni-app 会把它挪进主包）；
//   · 资料卡（白卡 + 暖棕描边「编辑资料」进个人资料）、会员卡（大号吉祥物、等级名、暖棕积分、描边「会员权益」、粗进度条）；
//     E2E 依赖的类名和文字（.me__avatar / .me__name / 会员编号 N / .member-level / .member-points__num / .member-cta / .member-badge）都还在；
//   · 升级提示去掉「」；s=2 底部按钮改叫「编辑简历资料」；
//   · 三组宫格 + 更多服务 + 员工工作台的顺序；线上任务专员「工作与成长」只剩 3 格时 3 列铺满；
//   · 窄屏（≤359px）的缩小规则；角标用提醒红；
//   · 10-16 复查：升级进度写「累计 160/300」、最高等级不重复积分；设置屏名字不被挤；会员编号、编辑资料点按区域 ≥44px。
//   · 10-16 第二次复查：「累计 N/M」挪到可用积分那一行；会员信息屏的会员编号点按区域 ≥44px；直接打开设置屏也读私信权限；
//     个人资料屏没填的项一律「未填写」（手机号「未绑定」）。
//   · 2026-10-17 主人反馈：会员卡太大，收成约 66px 的一条（小吉祥物 45×50、等级名 17px、6px 进度条、一行升级提示，不再放「累计 N/M」）；
//     资料卡头像 48px、昵称 20px、「编辑资料」胶囊 32px；宫格图标 32px、文字 14px，375×667 的 H5 首屏能露全「内容与关注」。
//     会员信息屏按主人样稿重做，细节见 member-mine-messages-20261017.test.mjs。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const readSfc = (rel) => compiler.parse(read(rel), { filename: rel }).descriptor
const { userIconPicture } = await import('../common/user-icons/art.js')

const PAGE = 'pages/profile/index.vue'
const sfc = readSfc(PAGE)
const tpl = sfc.template.content
const script = sfc.scriptSetup.content
const css = sfc.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = (selector, source = css) => [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].split(',').map(x => x.trim()).includes(selector)).map(m => m[2])
const mediaBlocks = (width) => {
  const out = []
  for (const m of css.matchAll(new RegExp('@media \\(max-width: ' + width + 'px\\) \\{([\\s\\S]*?)\\n\\}', 'g'))) out.push(m[1])
  return out.join('\n')
}
// 资料卡、会员卡、宫格的窄屏规则从 359px 起用（341–359 宽之前吃不到，「会员编号 N」折行、「技能与机会」被截断）
const media359 = mediaBlocks(359)
const media374 = mediaBlocks(374)
const media340 = mediaBlocks(340)

const cellArt = [...script.matchAll(/\bart: '([a-z-]+)'/g)].map(m => m[1])

test('个人中心每个业务入口都显示各自的透明 PNG 插画', () => {
  assert.match(tpl, /:art="cellItem\.art"/)
  assert.deepEqual(cellArt, [
    'mine-trip', 'mine-review', 'mine-income', 'mine-resume', 'mine-create', 'nav-messages', 'nav-publish', 'wish-mine',
    'mine-save', 'mine-guide', 'mine-invite', 'mine-ai', 'mine-merchant', 'mine-settings'
  ])
  const images = cellArt.map(name => fs.readFileSync(path.join(APP, userIconPicture(name))))
  assert.equal(new Set(images.map(bytes => bytes.toString('base64'))).size, cellArt.length)
  for (const bytes of images) {
    assert.equal(bytes.readUInt32BE(0), 0x89504E47)
    assert.equal(bytes.readUInt32BE(16), bytes.readUInt32BE(20))
    assert.ok(bytes[25] === 6 || bytes.includes(Buffer.from('tRNS')), '插画需有透明通道')
  }
})

test('个人中心专属插画只在 profile 分包，跨页面复用的插画在主包', () => {
  const shared = new Set(['nav-messages', 'nav-publish', 'mine-ai', 'wish-mine'])
  for (const name of cellArt) {
    const file = userIconPicture(name)
    assert.equal(file, (shared.has(name) ? '/static/user-icons/' : '/pages/profile/static/user-icons/') + name + '.png')
    if (!shared.has(name)) assert.equal(fs.existsSync(path.join(APP, 'static/user-icons', name + '.png')), false)
  }
  assert.equal(userIconPicture('unregistered'), '')
})

// Layout is verified in acceptance/20261021-community-profile/browser.mjs.

// Layout is verified in acceptance/20261021-community-profile/browser.mjs.

// Layout is verified in acceptance/20261021-community-profile/browser.mjs.

// Layout is verified in acceptance/20261021-community-profile/browser.mjs.

// 点按区域：可见的胶囊 / 文字行不变，外面一层透明内边距 + 等量负外边距（和 .member-cta 一样），版面不动
const prop = (r, name) => (r.match(new RegExp('(?:^|;)\\s*' + name + ':\\s*([^;]+)')) || [])[1]
const box = (value) => {
  const [t, r = t, b = t, l = r] = String(value || '').trim().split(/\s+/).map(x => parseFloat(x))
  return { t, r, b, l }
}
// Layout is verified in acceptance/20261021-community-profile/browser.mjs.

// Layout is verified in acceptance/20261021-community-profile/browser.mjs.

test('设置屏：名字不缩不折行，右边说明占剩下的地方、放不下显示「…」（320 宽「注销账号」不再一字一行）', () => {
  const s4 = tpl.slice(tpl.indexOf('<!-- 4 账号与隐私设置 -->'))
  for (const row of s4.matchAll(/<view class="srow__main">([\s\S]*?)<\/view>/g)) assert.doesNotMatch(row[1], /srow__label k-flex1/, '名字不再 flex:1（会被说明挤成一字一行）')
  for (const label of ['授权管理', '导出数据']) assert.match(s4, new RegExp(`<text class="srow__label">${label}</text>\\s*<text class="k-small k-muted srow__hint">`))
  assert.match(s4, /<text class="srow__label k-alert">注销账号<\/text>\s*<text class="k-small k-muted srow__hint">注销后将无法恢复，请谨慎操作<\/text>/) // 11-18 第二轮精修：说明改灰字，红色只留在「注销账号」上
  assert.match(s4, /<text class="srow__label">\{\{ r\.label \}\}<\/text>\s*<view v-if="r\.green" class="k-row k-gap6 srow__hint">[\s\S]*?<text v-else class="k-small k-muted srow__hint">\{\{ r\.value \}\}<\/text>/)
  assert.ok(rules('.srow__label').some(r => /flex: 0 0 auto/.test(r) && /white-space: nowrap/.test(r)))
  // 说明的 flex-basis 用 0：只有它伸缩，前后图标不会被一起压扁
  assert.ok(rules('.srow__hint').some(r => /flex: 1 1 0/.test(r) && /min-width: 0/.test(r) && /text-align: right/.test(r) && /overflow: hidden/.test(r) && /text-overflow: ellipsis/.test(r) && /white-space: nowrap/.test(r)))
  assert.ok(rules('.srow__hint.k-row').some(r => /justify-content: flex-end/.test(r)))
  // 「谁可以私信我」的说明分两段，320 宽右边是「互相关注的人」时在两段之间换行，不断成「发不 / 起私信」
  assert.match(s4, /<view class="srow__sub k-mt2"><text class="k-meta">不满足条件的人<\/text><text class="k-meta">发不起私信<\/text><\/view>/)
  assert.ok(rules('.srow__sub').some(r => /display: flex/.test(r) && /flex-wrap: wrap/.test(r)))
  assert.ok(rules('.srow__sub text').some(r => /white-space: nowrap/.test(r)))
  assert.ok(rules('.srow--tall').some(r => /min-height: 64px/.test(r) && /padding-top: 8px/.test(r) && /padding-bottom: 8px/.test(r)), '折成两行时字不贴卡片下沿')
})

// Layout is verified in acceptance/20261021-community-profile/browser.mjs.

test('编辑资料屏（反馈 2.0）：标题叫「编辑资料」，底部简历入口是一行浅色文字链接，不再是整宽大按钮', () => {
  assert.match(script, /const titles = \['我的', '编辑资料', '会员信息', '账号与隐私设置'\]/)
  assert.match(tpl, /<view v-if="recruitmentEnabled" class="resume-link" hover-class="k-press" @click="go\(R\.resume \+ '\?s=2'\)"><text>报名用的简历资料，去简历里修改<\/text>/)
  assert.doesNotMatch(tpl, /<k-button[^>]*>编辑简历资料<\/k-button>/)
  assert.doesNotMatch(tpl, />编辑资料<\/k-button>/)
})

// ---------------------------------------------------------------- 跑页面真实的 script setup（接口一律换成假函数）
function runSetup(stubs) {
  const ast = compiler.babelParse(script, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => script.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive,
    onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}
  }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: PAGE + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}
const harness = (online, enabled = true) => runSetup({
  recruitmentEnabled: vue.ref(enabled), communityEnabled: vue.ref(enabled), wishEnabled: vue.ref(enabled),
  useScreen: () => vue.ref(1),
  experience: vue.reactive({ account: { id: 7, nickname: '小院同学' }, mode: 'user' }),
  hasStaffAccess: vue.computed(() => false), onlineStaff: vue.computed(() => online), unreadCount: vue.ref(120),
  R: { orders: '/o', trip: '/t', activityMine: '/a', resume: '/r', opportunities: '/op', tasks: '/tk', myIncome: '/i', myFollows: '/f', invite: '/iv', reminders: '/rm', assistant: '/as', myPosts: '/mp', merchant: '/m', community: '/c', wishMine: '/pages/wish/mine' },
  profileIcon: (name) => 'icon:' + name, levelMascot: (level) => 'mascot:' + level, levelBadge: (level) => 'badge:' + level
})

test('分组入口复用原页面；线上专员不出现门店任务；会员等级跟服务端走', (t) => {
  const h = harness(false)
  t.after(h.stop)
  const groups = JSON.parse(h.run('JSON.stringify(groups.value)'))
  assert.deepEqual(groups.map(g => g.title), ['订单与行程', '工作与成长', '内容与关注', '更多服务'])
  assert.deepEqual(groups.map(g => g.items.map(it => it.label)), [
    ['我的行程', '我的评价', '我的收入'], ['简历与机会', '创办活动', '进入袋鼠群聊', '大众评审'],
    ['我的发布', '我的心愿', '收藏与关注', '全国攻略'], ['邀请有礼', 'AI袋鼠', '成为商家', '设置']
  ])
  assert.deepEqual(groups.map(g => g.items.map(it => it.url || '')), [
    ['/o?cat=stay', '/o?s=2', '/i'], ['/r', '/a?view=create', '/pages/camp/index', '/pages/governance/jury'],
    ['', '/pages/wish/mine', '/f?mode=fav', '/c?tab=guide&all=1'], ['/iv', '', '/m', '']
  ])
  for (const g of groups) for (const it of g.items) assert.ok(h.run('CELL_LINE[' + JSON.stringify(it.label) + ']'), it.label)
  const restricted = harness(true, false)
  t.after(restricted.stop)
  assert.equal(restricted.run("groups.value.some(g => g.items.some(it => it.label === '门店任务'))"), false)
  assert.deepEqual(JSON.parse(restricted.run('JSON.stringify(groups.value[1].items.map(it => it.label))')), ['进入袋鼠群聊', '大众评审'])
  assert.equal(restricted.run('groups.value[2].items[0].label'), '历史心愿订单')
  assert.match(tpl, /go\('\/pages\/governance\/badges'\)/)
  assert.equal(h.run('aiOpen.value'), false)
  h.run("groups.value[3].items.find(it => it.label === 'AI袋鼠').action()")
  assert.equal(h.run('aiOpen.value'), true)
  assert.match(tpl, /v-if="hasStaffAccess" class="card staff"[^>]*@click="openStaff"/)
  h.run("me.value = { levelName: '巨袋鼠', level: 4, points: 2100, upgradeTip: '再获得 2900 积分升到「袋鼠王」', pointsProgress: '2100/5000', pointsPercent: 42 }")
  assert.equal(h.run('currentLevel.value'), 4)
  assert.equal(h.run('upgradeTip.value'), '再获得 2900 积分升到袋鼠王')
  // 会员信息屏「升级进度」：左边「2100/5000」、右边「再获得 2900 积分升级到袋鼠王」
  assert.equal(h.run('progressCount.value'), '2100/5000')
  assert.equal(h.run('upgradeLine.value'), '再获得 2900 积分升级到袋鼠王')
  h.run("me.value = { levelName: '袋鼠王', level: 5, points: 6000, upgradeTip: '已达到最高成长等级' }")
  assert.equal(h.run('upgradeTip.value'), '已达到最高成长等级')
  assert.equal(h.run('progressCount.value'), '', '没有进度时不显示')
  // 最高等级时服务端给「123456 积分」，和当前积分重复：不显示
  h.run("me.value = { levelName: '袋鼠王', level: 5, points: 123456, upgradeTip: '已达到最高成长等级', pointsProgress: '123456 积分', pointsPercent: 100 }")
  assert.equal(h.run('progressCount.value'), '')
})

test('个人资料屏：没填的项一律写「未填写」（浅色字），手机号没绑写「未绑定」；资料还没读到时先空着', (t) => {
  const h = harness(false)
  t.after(h.stop)
  const fields = () => JSON.parse(h.run('JSON.stringify(fields.value.map(f => [f.label, f.value, f.empty]))'))
  // 资料还在读：其余空着，不闪一下「未填写」（2026-11-03 简化：昵称不再是点一行弹输入框，搬到「账号资料」区的输入框里，不在 fields 里）
  assert.deepEqual(fields(), [['性别', '', false], ['生日', '', false], ['常驻城市', '', false]])
  assert.equal(h.run('nickname.value'), '小院同学', '昵称先用登录态里的')
  assert.equal(h.run('introShown.value'), '')
  assert.equal(h.run('phoneShown.value'), '')
  // 服务端原样：没填性别时 genderLabel 是「未填写」，生日、城市、自我介绍、手机号是空字符串
  h.run("me.value = { nickname: '星辰', gender: '0', genderLabel: '未填写', birthday: '', birthdayLabel: '', city: '', intro: '', phone: '' }")
  assert.deepEqual(fields(), [['性别', '未填写', true], ['生日', '未填写', true], ['常驻城市', '未填写', true]])
  assert.equal(h.run('introShown.value'), '未填写')
  assert.equal(h.run('phoneShown.value'), '未绑定')
  h.run("me.value = { nickname: '星辰', gender: '2', genderLabel: '女', birthday: '03-05', birthdayLabel: '3月5日', city: '大理', intro: '爱爬山', phone: '139****2936' }")
  assert.deepEqual(fields(), [['性别', '女', false], ['生日', '3月5日', false], ['常驻城市', '大理', false]])
  assert.equal(h.run('introShown.value'), '爱爬山')
  assert.equal(h.run('intro.value.length'), 3, '字数仍按真实的自我介绍算，不把「未填写」算进去')
  assert.equal(h.run('phoneShown.value'), '139****2936')
  // 模板：空项加浅色类；自我介绍、手机号也走同一个类
  const s2 = tpl.slice(tpl.indexOf('<!-- 2 个人资料 -->'), tpl.indexOf('<!-- 3 会员信息与成长积分 -->'))
  assert.match(s2, /<text class="frow__value" :class="\{ 'frow__value--empty': f\.empty \}">\{\{ f\.value \}\}<\/text>/)
  // 2026-11-03 简化：昵称、自我介绍是「账号资料」区里的输入框 + 一个保存钮（原来各弹一个系统输入框）
  assert.match(s2, /<input type="nickname" name="nickname" :value="draft\.nickname" @input="draft\.nickname=\$event\.detail\.value" @blur="draft\.nickname=\$event\.detail\.value" maxlength="16"/)
  assert.match(s2, /<textarea v-if="editingIntro" v-model="draft\.intro" class="acct__textarea" maxlength="60"/)
  assert.match(s2, /<text class="frow__value" :class="\{ 'frow__value--empty': !phone \}">\{\{ phoneShown \}\}<\/text>/)
  assert.match(s2, /\{\{ draft\.intro\.length \}\}\/60/)
  assert.ok(rules('.frow__value--empty').some(r => /color: var\(--k-muted\)/.test(r)))
})

test('直接打开设置屏（?s=4）：登录态恢复后再去读「谁可以私信我」，不再一直显示默认的「所有人」', async (t) => {
  const tick = () => new Promise(resolve => setTimeout(resolve, 0))
  const make = (account) => {
    const calls = []
    const experience = vue.reactive({ account, mode: 'user' })
    const screen = vue.ref(4)
    const h = runSetup({
      useScreen: () => screen, experience,
      hasStaffAccess: vue.computed(() => false), onlineStaff: vue.computed(() => false), unreadCount: vue.ref(0),
      R: {}, profileIcon: (name) => 'icon:' + name, levelMascot: () => '', levelBadge: () => '',
      apiDmPrivacy: async () => { calls.push(1); return { data: { value: 'mutual' } } }
    })
    t.after(h.stop)
    return { h, calls, experience, screen }
  }
  // H5 刷新 / 从登录页回来：页面先建好，这时登录态还没恢复
  const cold = make(null)
  await tick()
  assert.equal(cold.calls.length, 0, '没登录不去读')
  assert.equal(cold.h.run('dmLabel.value'), '所有人')
  cold.experience.account = { id: 7, nickname: '小院同学' }
  await tick(); await tick()
  assert.equal(cold.calls.length, 1, '登录态恢复后读一次')
  assert.equal(cold.h.run('dmLabel.value'), '互相关注的人')
  // 读到过就不再重复读：切到别的屏再回来
  cold.screen.value = 1; await tick()
  cold.screen.value = 4; await tick()
  assert.equal(cold.calls.length, 1)
  // 原来就能用的路径：已登录，从「我的」点「设置」进来
  const warm = make({ id: 7, nickname: '小院同学' })
  warm.screen.value = 1; await tick()
  assert.equal(warm.calls.length, 1, '一打开就是 s=4 时立刻读')
  assert.equal(warm.h.run('dmLabel.value'), '互相关注的人')
})
test('设置切换账号后重读当前私信权限，旧账号的慢响应不能覆盖', async t => {
  const account = vue.reactive({ account: { id: 1 } })
  const reads = []
  const h = runSetup({
    experience: account, useScreen: () => vue.ref(4), apiDmPrivacy: () => new Promise(resolve => reads.push(resolve))
  })
  t.after(h.stop)
  account.account = { id: 2 }
  await vue.nextTick()
  assert.equal(reads.length, 2)
  reads[1]({ data: { value: 'mutual' } })
  await Promise.resolve()
  reads[0]({ data: { value: 'following' } })
  await Promise.resolve()
  assert.equal(h.run('dmValue.value'), 'mutual')
})

test('离开原账号后不执行原确认框的操作，实名草稿也不会带给下一人', async t => {
  const experience = vue.reactive({ account: { id: 1 } })
  let finish, exits = 0, revoked = 0
  const h = runSetup({
    experience, useScreen: () => vue.ref(4), currentStaffStore: vue.ref({ storeName: '甲店' }),
    uni: { showModal: options => { finish = yes => options.success({ confirm: yes }) } },
    apiMeSessions: async () => ({ data: { rows: [{ current: false, device: '旧设备', id: 1 }] } }),
    sheet: async () => 1, apiMeRevokeOthers: async () => { revoked++; return {} },
    post: async () => { exits++; return {} }, recheckAccount: async () => {}, toast: () => {}, relaunch: () => {}, switchMode: () => '', hasStaffAccess: vue.ref(false)
  })
  t.after(h.stop)
  h.run("realOpen.value=true; realForm.name='甲'; realForm.idNo='旧账号的证件号码'")
  const exit = h.run('exitMerchant()')
  experience.account = { id: 2 }
  finish(true)
  await exit
  assert.equal(exits, 0)
  assert.equal(h.run('realForm.idNo'), '')
  assert.equal(h.run('realOpen.value'), false)
  const sessions = h.run('openSessions()')
  await new Promise(resolve => setTimeout(resolve, 0))
  experience.account = { id: 3 }
  finish(true)
  await sessions
  assert.equal(revoked, 0)
})
