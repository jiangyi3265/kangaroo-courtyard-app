// 10-16 改版后的小修跟进（node --test，不构建、不发请求）：
//   · 默认头像换成主人自己画的袋鼠贴纸：文件名、路径不变（约 31 处引用、老数据里也存着这个路径），只换内容——
//     奶油底（#F3EBDD）的正方形 JPEG，贴纸居中、比方块小一圈（到处都是圆形裁切）；比原图大一些、更清楚，但每张只多 2KB 以内（主包）；
//   · 「我的活动」顶栏写页名（之前写品牌名「袋鼠小院」，页里又有一行大字「我的活动」，同一页说两遍）；
//   · 经营日报的日期框按字数变宽、不折行；指标名后面的「（系统）/（手动）」不再从中间断开。
// 首页结果卡技能行、切换城市字母索引的测试在 home-feed.test.mjs 末尾。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = fileURLToPath(new URL('..', import.meta.url))
const read = (rel) => readFileSync(join(APP, rel), 'utf8').replace(/\r\n/g, '\n')

/** 读 JPEG 帧头（SOF）：宽、高、颜色分量数、是不是基线编码 */
function jpegInfo(buf) {
  assert.equal(buf.readUInt16BE(0), 0xFFD8, '不是 JPEG')
  let i = 2
  while (i < buf.length) {
    assert.equal(buf[i], 0xFF, '标记段错位')
    const marker = buf[i + 1]
    const len = buf.readUInt16BE(i + 2)
    if (marker >= 0xC0 && marker <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(marker)) {
      return { baseline: marker === 0xC0, height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), components: buf[i + 9] }
    }
    i += 2 + len
  }
  throw new Error('没找到 SOF')
}

// 换图前的原文件大小（71×71 2,091 B / 68×68 1,994 B），用来卡主包增量
const AVATARS = [
  { file: 'static/media/profile-avatar.jpg', before: 2091, minSide: 120 },
  { file: 'static/media/profile-avatar-lg.jpg', before: 1994, minSide: 160 }
]

test('默认头像：同名同路径，奶油底正方形 JPEG（小程序不认本地 WebP），比原来清楚，每张最多多 2KB', () => {
  for (const a of AVATARS) {
    const buf = readFileSync(join(APP, a.file))
    const info = jpegInfo(buf)
    assert.equal(info.width, info.height, `${a.file} 要是正方形，圆形裁切才居中`)
    assert.ok(info.width >= a.minSide, `${a.file} 至少 ${a.minSide}px，64–80px 的圆头像在高清屏上不糊`)
    assert.ok(info.width <= 240, `${a.file} 不用更大，主包要省`)
    assert.equal(info.components, 3, '彩色 JPEG')
    assert.ok(info.baseline, '基线编码，各端都能解')
    assert.ok(buf.length <= a.before + 2048, `${a.file} ${buf.length} B，比原图多了超过 2KB`)
  }
  // 贴纸原图还在（首页品牌、社区顶栏、AI 头像用它），头像是另外合成的 JPEG，不是直接拿透明 PNG 去当头像
  for (const f of ['static/media/brand-kangaroo.png', 'static/media/brand-kangaroo-lg.png']) assert.ok(statSync(join(APP, f)).size > 0)
})

test('默认头像在页面里都是定宽定高的 aspectFill：换成更大的正方形图，显示尺寸不变', () => {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(join(APP, dir))) {
      const rel = dir + '/' + name
      if (statSync(join(APP, rel)).isDirectory()) walk(rel)
      else if (rel.endsWith('.vue')) files.push(rel)
    }
  }
  walk('pages'); walk('components')
  let refs = 0
  for (const rel of files) {
    const src = read(rel)
    if (!/\/static\/media\/profile-avatar(-lg)?\.jpg/.test(src)) continue
    refs += (src.match(/\/static\/media\/profile-avatar(-lg)?\.jpg/g) || []).length
    // 按图片原始尺寸撑开的模式（widthFix / heightFix）会让大图变大；头像不能用
    const tpl = src.split('<script')[0]
    for (const m of tpl.matchAll(/<image\b[^>]*>/g)) {
      if (/avatar|Avatar|profile-avatar/.test(m[0])) assert.doesNotMatch(m[0], /mode="(widthFix|heightFix)"/, `${rel}: ${m[0]}`)
    }
  }
  assert.ok(refs >= 25, `还应有二十多处引用默认头像（现在 ${refs}）`)
})

test('我的活动：顶栏写「我的活动」（和「我的行程」一样写页名），页里不再重复一行大标题，「创办活动」入口还在', () => {
  const src = read('pages/community/activity-mine.vue')
  const tpl = src.split('<script')[0]
  const s1 = tpl.slice(tpl.indexOf('<template v-if="s === 1">'), tpl.indexOf('<template v-else-if="s === 2">'))
  assert.ok(s1.includes('<k-topbar title="我的活动" back />'))
  assert.ok(!s1.includes('title="袋鼠小院"'))
  const visible = s1.replace(/<!--[\s\S]*?-->/g, '')
  assert.equal((visible.match(/我的活动/g) || []).length, 1, '整屏只在顶栏出现一次「我的活动」')
  assert.doesNotMatch(src, /page-heading/)
  assert.ok(s1.includes('<view class="mine-head"><view class="create-link" hover-class="k-press" @click="startCreate"><k-icon name="plus" :size="15" color="red" /><text>创办活动</text></view></view>'))
  assert.match(src, /\.mine-head \{ display:flex; justify-content:flex-end;/, '入口靠右，和原来的位置一样')
  // 已报名 / 已完成 / 我发起的 三个页签照旧
  assert.ok(s1.includes('<view class="k-tabs mine-tabs">'))
})

test('经营日报：日期框按字数变宽、不折行（之前写死 222px，「2026年10月17日（周六）」挤成两行撑出框）', () => {
  const src = read('pages/manage/daily.vue')
  const css = src.slice(src.indexOf('<style'))
  const box = css.match(/\.date-box \{[^}]*\}/)[0]
  assert.doesNotMatch(box, /[^-]width: \d+px/, '不再写死宽度')
  assert.match(box, /min-width: 200px;/)
  assert.match(box, /max-width: 100%;/)
  assert.match(box, /white-space: nowrap;/)
  assert.match(box, /display: inline-flex;/, '汇总屏里单独一行时也只占字的宽度')
  assert.doesNotMatch(css, /\.summary-date \{[^}]*width: \d+px/)
  // 日期框 + 「系统已同步 14:07」在 375 / 320 一行放不下：同步状态换到下一行，不再把日期挤折行
  assert.match(css, /\.date-line \{ display: flex; flex-wrap: wrap;/)
  // 估一下最长的日期在 320 宽放得下：16px 粗体，8 个数字约 9.5px，7 个全角字 16px，加图标 20、间距 8、内边距 24、边框 2
  const need = 8 * 9.5 + 7 * 16 + 20 + 8 + 24 + 2
  assert.ok(need <= 320 - 32, `日期框约 ${need}px，320 宽内容区 288px`)
  // 日期两处（日报、汇总）都还是点了选日期
  assert.equal((src.match(/class="date-box[^"]*" @click="pickDate"><text>\{\{ d\.dateText \}\}<\/text><k-icon name="calendar-days"/g) || []).length, 2)
})

test('经营日报：指标名和「（系统）/（手动）」分两段，窄屏整段换行，不从中间断开；≤340 宽字小一号', () => {
  const src = read('pages/manage/daily.vue')
  const tpl = src.split('<script')[0]
  assert.ok(tpl.includes('<view class="metric__main"><view class="metric__name"><text>{{ item.name }}</text><text class="metric__source">（{{ item.source }}）</text></view><text class="metric__detail">{{ item.detail }}</text></view>'))
  const css = src.slice(src.indexOf('<style'))
  assert.match(css, /\.metric__name \{ display: flex; flex-wrap: wrap; align-items: baseline;/)
  assert.match(css, /\.metric__source \{ font-size: 12px; white-space: nowrap; \}/)
  assert.match(css, /@media \(max-width: 340px\) \{ \.metric \{ gap: 10px; \} \.metric__name \{ font-size: 15px; \} \.metric__source \{ font-size: 11px; \} \}/)
})
