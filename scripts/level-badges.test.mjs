// 会员等级徽章（2026-10-15）：node --test，不构建、不发请求。
// 守住这几件事：
//   · 6 枚徽章各不相同，都是 data:image/svg+xml;base64 地址，SVG 里只有 ASCII 字符，base64 编码正确；
//   · 只用小程序里 k-icon 已经验证过的写法（circle / ellipse / path / rect / g、transform、opacity），不用 style / filter / clipPath / text / image；
//   · 同一枚只拼一次（有缓存），序号超出 0..5 或不是数字时按最近的一级；灰色版只用灰色；
//   · 模块只在 profile 分包里被引用（两个分包都引用的话 uni-app 会把它挪进主包）；旧的等级图、邮戳图从 static 里删掉了，生成脚本里也没有它们。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const APP = fileURLToPath(new URL('..', import.meta.url))
const read = (rel) => readFileSync(join(APP, rel), 'utf8').replace(/\r\n/g, '\n')
const { levelBadge, levelMascot, GREY, LEVEL_COUNT } = await import('../pages/profile/level-badges.js')
const PREFIX = 'data:image/svg+xml;base64,'
const decode = (uri) => Buffer.from(uri.slice(PREFIX.length), 'base64').toString('latin1')

test('6 枚徽章各不相同，都是 base64 的 SVG 图片地址', () => {
  assert.equal(LEVEL_COUNT, 6)
  const all = [0, 1, 2, 3, 4, 5].map(i => levelBadge(i))
  assert.equal(new Set(all).size, 6)
  for (const uri of all) {
    assert.ok(uri.startsWith(PREFIX))
    const svg = decode(uri)
    // 自己写的 base64 和 Node 的结果一致（解出来再编回去不变）
    assert.equal(Buffer.from(svg, 'latin1').toString('base64'), uri.slice(PREFIX.length))
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64">[\s\S]*<\/svg>$/)
  }
})

test('SVG 只有 ASCII 字符，只用小程序里稳妥的元素和属性', () => {
  for (const grey of [false, true]) {
    for (let i = 0; i < 6; i++) {
      const svg = decode(levelBadge(i, grey))
      assert.ok(/^[\x20-\x7E]*$/.test(svg), `第 ${i} 枚有非 ASCII 字符`)
      const tags = new Set([...svg.matchAll(/<([a-zA-Z]+)/g)].map(m => m[1]))
      for (const tag of tags) assert.ok(['svg', 'circle', 'ellipse', 'path', 'rect', 'g'].includes(tag), `第 ${i} 枚用了 <${tag}>`)
      assert.doesNotMatch(svg, /style=|filter|clip|mask|url\(|<text|<image|NaN|undefined/)
      assert.equal((svg.match(/<g /g) || []).length, (svg.match(/<\/g>/g) || []).length, '<g> 要成对')
      // 每个颜色都是 6 位十六进制
      for (const m of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) assert.match(m[1], /^(none|#[0-9A-F]{6})$/, `第 ${i} 枚颜色 ${m[1]}`)
    }
  }
})

test('同一枚只拼一次：第二次取直接用缓存', async () => {
  // 另起一份模块实例（缓存是空的），数 base64 编码时读字符的次数
  const fresh = await import('../pages/profile/level-badges.js?cache-test')
  const original = String.prototype.charCodeAt
  let calls = 0
  String.prototype.charCodeAt = function (...args) { calls++; return original.apply(this, args) }
  try {
    const first = fresh.levelBadge(3)
    assert.ok(calls > 0, '第一次要现拼')
    calls = 0
    assert.equal(fresh.levelBadge(3), first)
    assert.equal(fresh.levelBadge('3'), first)
    assert.equal(calls, 0, '缓存过的徽章不该再编码一次')
  } finally {
    String.prototype.charCodeAt = original
  }
})

test('序号超出 0..5、不是数字时按最近的一级', () => {
  assert.equal(levelBadge(-1), levelBadge(0))
  assert.equal(levelBadge(-Infinity), levelBadge(0))
  assert.equal(levelBadge(6), levelBadge(5))
  assert.equal(levelBadge(99), levelBadge(5))
  assert.equal(levelBadge(Infinity), levelBadge(5))
  assert.equal(levelBadge(undefined), levelBadge(0))
  assert.equal(levelBadge(null), levelBadge(0))
  assert.equal(levelBadge('abc'), levelBadge(0))
  assert.equal(levelBadge('4'), levelBadge(4))
  assert.equal(levelBadge(2.7), levelBadge(2))
})

test('灰色版：万一微信不认 CSS grayscale 时的备用图，只用灰色', () => {
  for (const hex of Object.values(GREY)) assert.match(hex, /^#([0-9A-F]{2})\1\1$/)
  for (let i = 0; i < 6; i++) {
    const grey = levelBadge(i, true)
    assert.notEqual(grey, levelBadge(i))
    for (const m of decode(grey).matchAll(/(?:fill|stroke)="(#[0-9A-F]{6})"/g)) assert.match(m[1], /^#([0-9A-F]{2})\1\1$/)
  }
})

test('吉祥物版（10-16 改版）：6 级各不相同、没有圆章底、只用稳妥的元素，序号规则和缓存同徽章', async () => {
  const all = [0, 1, 2, 3, 4, 5].map(i => levelMascot(i))
  assert.equal(new Set(all).size, 6)
  for (let i = 0; i < 6; i++) {
    const uri = all[i]
    assert.ok(uri.startsWith(PREFIX))
    assert.notEqual(uri, levelBadge(i), '吉祥物和圆章徽章是两张图')
    const svg = decode(uri)
    assert.equal(Buffer.from(svg, 'latin1').toString('base64'), uri.slice(PREFIX.length))
    // 画布收窄到袋鼠本身（56×62），不再是 64×64 的圆章
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="4 1 56 62">[\s\S]*<\/svg>$/)
    assert.ok(/^[\x20-\x7E]*$/.test(svg), `第 ${i} 只有非 ASCII 字符`)
    const tags = new Set([...svg.matchAll(/<([a-zA-Z]+)/g)].map(m => m[1]))
    for (const tag of tags) assert.ok(['svg', 'circle', 'ellipse', 'path', 'rect', 'g'].includes(tag), `第 ${i} 只用了 <${tag}>`)
    assert.doesNotMatch(svg, /style=|filter|clip|mask|url\(|<text|<image|NaN|undefined/)
    assert.equal((svg.match(/<g /g) || []).length, (svg.match(/<\/g>/g) || []).length, '<g> 要成对')
    for (const m of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) assert.match(m[1], /^(none|#[0-9A-F]{6})$/, `第 ${i} 只颜色 ${m[1]}`)
    // 没有圆章底（徽章版的底是 r="30.5" 的整圆），脚下是一圈淡影子
    assert.doesNotMatch(svg, /r="30\.5"|r="29\.6"|r="27"/, `第 ${i} 只还带着圆章`)
    assert.match(svg, /<ellipse cx="32" cy="59\.6" rx="15" ry="2\.2" fill="#7A4E2D" opacity="\.16"\/>/)
  }
  assert.equal(levelMascot(-3), levelMascot(0))
  assert.equal(levelMascot(9), levelMascot(5))
  assert.equal(levelMascot('2'), levelMascot(2))
  assert.equal(levelMascot(undefined), levelMascot(0))
  const fresh = await import('../pages/profile/level-badges.js?mascot-cache-test')
  const first = fresh.levelMascot(4)
  const original = String.prototype.charCodeAt
  let calls = 0
  String.prototype.charCodeAt = function (...args) { calls++; return original.apply(this, args) }
  try {
    assert.equal(fresh.levelMascot(4), first)
    assert.equal(calls, 0, '缓存过的吉祥物不该再编码一次')
  } finally {
    String.prototype.charCodeAt = original
  }
})

// 2026-10-22：统一为成熟侧身袋鼠剪影徽章，等级图标仍只放在 profile 分包。
// level-badges.js 不再被页面引用（模块和上面的单元测试先留着，不打进任何包）
test('页面接入：会员卡、会员信息屏、等级阶梯、我的权益、会员权益页都用 level-icon.vue；组件只在 profile 分包里', () => {
  const profile = read('pages/profile/index.vue')
  const benefits = read('pages/profile/benefits.vue')
  const icon = read('pages/profile/components/level-icon.vue')
  for (const src of [profile, benefits]) {
    assert.match(src, /import LevelIcon from '\.\/components\/level-icon\.vue'/)
    assert.doesNotMatch(src, /level-badges/)
  }
  assert.match(profile, /<view class="member-mascot"><level-icon :level="currentLevel" :size="44" \/><\/view>/)
  assert.match(profile, /<level-icon :level="levelItem\.level" :size="48" :off="levelItem\.off" \/>/)
  assert.match(profile, /<level-icon :level="selectedPerk\.level" :size="46" \/>/)
  // 2026-11-17 改版「小而精」：会员信息屏顶部的等级徽章从 98 收到 64
  assert.match(profile, /<level-icon :level="currentLevel" :size="64" \/>/)
  assert.match(benefits, /<level-icon v-if="member" :level="member\.level" :size="26" \/>/)
  assert.match(benefits, /<k-tabbar active="profile" :mode="experience\.mode" \/>/, '员工身份打开会员权益，底栏也要是员工底栏')
  assert.match(icon, /src="\/pages\/profile\/static\/member-travel-atlas\.png"/)
  assert.ok(existsSync(join(APP, 'pages/profile/static/member-travel-atlas.png')), 'PNG 兼容版图标真实存在')
  assert.doesNotMatch(icon, /brand-kangaroo\.png|LEVEL_ORNAMENTS|linear-gradient|crown/)
  const users = []
  const walk = (dir) => {
    for (const name of readdirSync(join(APP, dir))) {
      const rel = dir + '/' + name
      if (statSync(join(APP, rel)).isDirectory()) walk(rel)
      else if (/\.(vue|js)$/.test(name)) {
        // 同名治理徽章组件位于自己的分包，不是会员图标的跨包引用。
        for (const hit of read(rel).matchAll(/from\s+['"]([^'"]*(?:level-badges|level-icon|membership-emblem)[^'"]*)['"]/g)) {
          const target = hit[1].startsWith('@/') ? resolve(APP, hit[1].slice(2)) : resolve(APP, dirname(rel), hit[1])
          if (target.startsWith(resolve(APP, 'pages/profile') + sep)) users.push(rel)
        }
      }
    }
  }
  ;['pages', 'components', 'common'].forEach(walk)
  assert.deepEqual(users.filter(rel => !rel.startsWith('pages/profile/')), [], '两个分包都引用的话 uni-app 会把它挪进主包')
})

test('新会员徽章：六级及未解锁状态均可解码，异常等级有边界回退', async () => {
  const { membershipEmblem, memberLevelIndex } = await import('../pages/profile/membership-emblem.js')
  const badges = Array.from({ length: 6 }, (_, i) => membershipEmblem(i))
  assert.equal(new Set(badges).size, 6)
  for (const uri of [...badges, membershipEmblem(5, true)]) {
    assert.ok(uri.startsWith(PREFIX))
    const svg = decode(uri)
    assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    assert.ok(svg.endsWith('</svg>'))
    assert.doesNotMatch(svg, /NaN|undefined|[\u0080-\uffff]/)
    assert.equal(Buffer.from(svg, 'ascii').toString('base64'), uri.slice(PREFIX.length))
  }
  assert.equal(new Set(Array.from({ length: 6 }, (_, i) => membershipEmblem(i, true))).size, 6, '未解锁仍保留各等级的成长轮廓')
  for (const [input, expected] of [[-1, 0], [9, 5], ['3', 3], ['bad', 0], [null, 0]]) {
    assert.equal(memberLevelIndex(input), expected)
    assert.equal(membershipEmblem(input), badges[expected])
  }
})

test('旧的等级图和邮戳图从主包 static 里删掉，生成脚本里也不再有（否则 art.mjs install 会把它们重新导出来）', async () => {
  for (const name of ['profile-level-1', 'profile-level-2', 'profile-level-3', 'profile-level-4', 'profile-level-5', 'profile-level-6', 'profile-level-kangaroo', 'profile-stamp']) {
    assert.equal(existsSync(join(APP, 'static/media', name + '.jpg')), false, name)
  }
  // 生成脚本在仓库外层的 .dev 里；只拿到 App 目录时跳过
  const art = join(APP, '../.dev/art/art.mjs')
  if (!existsSync(art)) return
  const { items } = await import(pathToFileURL(art).href)
  assert.deepEqual(items.map(it => it.name).filter(name => name.startsWith('profile-')), [])
})

test('「我的」只拉未读数给底栏「消息」红点，不再拉整份消息列表；「我的提醒」入口已去掉（10-16 主人拍板）', () => {
  const profile = read('pages/profile/index.vue')
  assert.doesNotMatch(profile, /loadMessages/)
  assert.match(profile, /await refreshUnread\(\)/)
  // 看消息只在底栏「消息」；通知开关还在「设置 → 通知管理」（提醒中心 ?s=4）
  assert.doesNotMatch(profile, /label: '我的提醒'/)
  assert.doesNotMatch(profile, /art: 'reminders'/)
  assert.match(profile, /@click="go\(R\.reminders \+ '\?s=4'\)"/)
})
