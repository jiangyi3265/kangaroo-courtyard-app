// 底栏「发布」（10-16 主人定，收回 10-15 的平放红块）：暖棕圆钮，「发布」两个字写在圆里，一圈白边 + 柔和阴影，往上凸出底栏；
// 圆钮下面不再写字。凸出来的那一截会盖住页面最底下的内容，所以 .k-pad-tab 的留白要 ≥ 底栏高 + 凸出高度 + 一点空隙，
// 拉到底时最后一行露在圆钮上面（各页实际截图核对见本轮 shell 验收）。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = fs.readFileSync(path.join(APP, 'components/k-tabbar/k-tabbar.vue'), 'utf8')
const [tpl, css] = [src.split('<script')[0], src.split('<style')[1]]
const theme = fs.readFileSync(path.join(APP, 'styles/theme.scss'), 'utf8')
const rule = (text, sel) => {
  const m = new RegExp(sel.replace(/[.]/g, '\\.') + ' \\{([^}]*)\\}').exec(text)
  assert.ok(m, `缺 ${sel}`)
  return m[1]
}
const px = (body, prop) => {
  const m = new RegExp(`(?:^|;)\\s*${prop}:\\s*(-?[\\d.]+)px`).exec(body)
  return m ? Number(m[1]) : 0
}

test('「发布」是凸出底栏的暖棕圆钮：字写在圆里、白边、阴影，下面不再写字', () => {
  assert.match(tpl, /<view v-if="item\.key === 'publish'" class="k-tabbar__publish"><k-icon v-if="theme === 'journal'"[^>]*\/><text>发布<\/text><\/view>/, '圆里写「发布」')
  assert.match(tpl, /<text v-if="item\.key !== 'publish'" class="k-tabbar__label">/, '圆钮下面不再写「发布」')
  assert.match(tpl, /<k-icon v-if="theme === 'journal'" name="plus"/, '只有生活日记主题使用加号，默认暖棕主题只有发布文字')
  const pub = rule(css, '.k-tabbar__publish')
  const size = px(pub, 'width')
  assert.equal(px(pub, 'height'), size, '正圆')
  assert.match(pub, /border-radius: 50%/)
  assert.match(pub, /background: var\(--k-grad-brown\)/, '参考图的暖棕渐变')
  assert.match(pub, /border: \d+px solid var\(--k-paper\)/, '一圈白边')
  assert.match(pub, /box-shadow: /, '柔和阴影')
  assert.match(pub, /color: #fff/, '圆里白字')
  assert.ok(px(pub, 'font-size') >= 14, '圆里的字不小于 14px')
})

test('圆钮往上凸、不往下伸；页面底部留白够，拉到底时圆钮不压最后一行', () => {
  const pub = rule(css, '.k-tabbar__publish'), row = rule(css, '.k-tabbar__row')
  assert.match(rule(css, '.k-tabbar__item.publish'), /justify-content: flex-start/, '发布这一格从顶上排，凸出高度只由 margin-top 决定')
  assert.ok(!/(?:^|;)\s*margin:/.test(pub), '只写 margin-top，不用 margin 简写')
  const rise = -px(pub, 'margin-top'), size = px(pub, 'height'), rowH = px(row, 'height')
  assert.ok(rise >= 12 && rise <= 28, `圆钮要明显凸出底栏（现在 ${rise}px）`)
  assert.ok(size - rise <= rowH, '圆钮下沿不超出底栏')
  const pad = /\.k-pad-tab \{ padding-bottom: calc\((\d+)px \+ var\(--k-safe-bottom\)\); \}/.exec(theme)
  assert.ok(pad, '缺 .k-pad-tab')
  assert.ok(Number(pad[1]) >= rowH + rise + 12, `.k-pad-tab 留白 ${pad[1]}px，至少要底栏 ${rowH} + 凸出 ${rise} + 12`)
})

test('攒局用笑脸图标；选中用主色，未读角标用提醒红；员工底栏没有发布圆钮', () => {
  assert.match(src, /\{ key: 'community', label: '攒局', icon: 'smile', url: '\/pages\/community\/index' \}/)
  assert.match(rule(css, '.k-tabbar__item.active'), /color: var\(--k-red\)/)
  assert.match(rule(css, '.k-tabbar__badge'), /background: var\(--k-alert\)/)
  const staff = /const staffItems = computed\(\(\) => \[([\s\S]*?)\]\)/.exec(src)[1]
  assert.ok(!/publish/.test(staff), '员工底栏没有发布')
  assert.ok(px(rule(css, '.k-tabbar__item'), 'gap') >= 3, '图标和文字之间至少留 3px')
})
