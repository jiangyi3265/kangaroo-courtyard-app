// 10-16 改版配色（主人定）：奶白底 #FCF9F3、纯白卡片、暖棕主色 #9A6B3F、浅豆绿点缀，提醒类单独用 --k-alert 红。
// 颜色的「真值」在 styles/theme.scss；下面这些地方读不到 CSS 变量，只能抄一份十六进制，必须和 theme.scss 同步：
// k-icon 的 TONES（图标画在 SVG 里）、pages.json 的 globalStyle、岗位海报 common/poster.js（画布）、操作菜单 common/ui.js。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8')
const theme = read('styles/theme.scss')
const token = (name) => {
  const m = new RegExp(`--k-${name}: ([^;]+);`).exec(theme)
  assert.ok(m, `theme.scss 缺 --k-${name}`)
  return m[1].trim()
}
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

test('主人定的几种颜色', () => {
  assert.equal(token('bg'), '#FCF9F3')
  assert.equal(token('paper'), '#FFFFFF')
  assert.equal(token('ink'), '#3A322B')
  assert.equal(token('muted'), '#6F6A65', '次要字：主人定的 #7A7570 在页面底色上只有 4.34:1，10-16 调深一档')
  assert.equal(token('red'), '#9A6B3F', '主色暖棕（变量名沿用 --k-red）')
  assert.equal(token('paper2'), '#F3EBDD', '奶油色胶囊底')
  assert.equal(token('green-soft'), '#E4EDDA', '浅豆绿')
  assert.equal(token('radius'), '16px')
  assert.match(token('alert'), /^#[0-9A-F]{6}$/)
  // 10-19 主人「字体统一，都换一下」：品牌名和标题用思源黑体（--k-display-font = "KG Sans" + 系统黑体兜底），正文系统黑体
  assert.equal(token('brand'), 'var(--k-display-font)', '品牌名用标题字体（思源黑体）')
  assert.match(token('display-font'), /^"KG Sans", var\(--k-sans\)$/)
  assert.match(token('sans'), /^"Source Han Sans SC"/, '正文先找手机自带的思源黑体')
  assert.match(theme, /@font-face \{ font-family: "KG Sans"; font-weight: 700;[^}]*kg-sans-bold\.woff2/)
  assert.match(theme, /@font-face \{ font-family: "KG Sans"; font-weight: 900;[^}]*kg-sans-heavy\.woff2/)
  assert.ok(!/Songti|STSong|SimSun|Georgia/.test(theme), 'theme.scss 不再引用宋体 / Georgia')
})

test('字和底色的对比度够（WCAG 4.5:1）', () => {
  const pairs = [
    ['#FFFFFF', token('red'), '主按钮白字'],
    ['#FFFFFF', token('alert'), '未读角标白字'],
    ['#FFFFFF', token('green'), '绿按钮白字'],
    [token('alert'), token('paper'), '白卡上的报错字'],
    [token('alert'), token('alert-soft'), '浅红底上的提醒字'],
    [token('red-deep'), token('red-soft'), '选中胶囊的棕字'],
    [token('red-deep'), token('paper2'), '奶油底上的棕字'],
    [token('green'), token('green-soft'), '浅豆绿底上的绿字'],
    [token('ink2'), token('paper2'), '奶油胶囊上的正文字'],
    [token('muted'), token('paper'), '白卡上的次要字'],
    [token('muted'), token('bg'), '页面底色上的次要字（时间、地点、说明小字）'],
    [token('muted'), token('paper2'), '奶油底上的次要字（建议还是用 --k-ink2）'],
    [token('red-deep'), token('bg'), '页面底色上的小号棕字'],
    [token('ochre-deep'), token('ochre-soft'), '赭黄浅底上的小字（k-chip tone="ochre"、消息「订单 / 活动」标签）'],
    [token('ochre-deep'), token('paper'), '白卡上的赭黄小字（切换门店、待审核、去查看建议）'],
    [token('ochre-deep'), token('bg'), '页面底色上的赭黄小字'],
    [token('ochre-deep'), token('paper2'), '奶油底上的赭黄小字'],
    [token('ink'), token('bg'), '页面标题']
  ]
  for (const [fg, bg, what] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${what} ${fg} / ${bg} 只有 ${contrast(fg, bg).toFixed(2)}:1`)
})

test('读不到 CSS 变量的地方抄的颜色和 theme.scss 一致', () => {
  const icon = read('components/k-icon/k-icon.vue')
  const tones = Object.fromEntries([...icon.matchAll(/(\w+): '(#[0-9A-F]{6})'/g)].map(m => [m[1], m[2]]))
  for (const k of ['ink', 'ink2', 'muted', 'light', 'red', 'alert', 'green', 'ochre', 'indigo']) assert.equal(tones[k], token(k), `k-icon TONES.${k}`)
  assert.equal(tones.line, token('line2'), 'TONES.line 用输入框描边色')
  assert.equal(tones.paper, token('paper'))
  const pages = JSON.parse(read('pages.json')).globalStyle
  assert.equal(pages.backgroundColor, token('bg'))
  assert.equal(pages.navigationBarBackgroundColor, token('bg'))
  const poster = read('common/poster.js')
  for (const k of ['bg', 'ink', 'red']) assert.ok(poster.includes(`'${token(k)}'`), `海报要用 --k-${k} ${token(k)}`)
  // 海报摘要（canvas 读不到 CSS 变量）和 --k-muted 同一个值
  assert.ok(poster.includes(`'${token('muted')}'`), `海报摘要要用 --k-muted ${token('muted')}`)
  assert.ok(!/#A94734|#241B17|#FBF7F0|#6B635C/.test(poster), '海报里没有旧配色')
  assert.match(read('common/ui.js'), new RegExp(`const SHEET_COLOR = '${token('ink')}'`))
})

test('提醒类（未读、报错、名额紧张、危险操作）用 --k-alert，不跟主色变棕', () => {
  assert.match(theme, /\.k-badge \{[^}]*background: var\(--k-alert\)/)
  assert.match(theme, /\.k-dot \{[^}]*background: var\(--k-alert\)/)
  assert.match(theme, /\.k-input--error \{ border-color: var\(--k-alert\); \}/)
  assert.match(theme, /\.k-alert \{ color: var\(--k-alert\); \}/, '给页面用的提醒红文字类')
  assert.match(read('components/k-tabbar/k-tabbar.vue'), /\.k-tabbar__badge \{[^}]*background: var\(--k-alert\)/)
  const chip = read('components/k-chip/k-chip.vue')
  assert.match(chip, /\.is-red \{ color: var\(--k-alert\); background: var\(--k-alert-soft\); \}/, 'tone="red" 的小标签（加急、避雷、退回）是提醒')
  assert.match(chip, /red: 'alert'/)
  assert.match(read('components/k-field/k-field.vue'), /\.k-field__error \{ font-size: 12px; color: var\(--k-alert\); \}/)
  assert.match(read('pages/messages/index.vue'), /\.dot\{width:8px;height:8px;border-radius:50%;background:var\(--k-alert\)\}/, '消息未读红点')
  assert.match(read('pages/community/activity.vue'), /\.quota\.few \{ color: var\(--k-alert\);/, '名额紧张')
  assert.match(read('pages/jobs/progress.vue'), /content: '撤回后需重新提交报名，确定撤回吗？', confirmColor: '#C04437'/, '撤回报名的确认键用提醒红')
  assert.equal(token('alert'), '#C04437')
})

test('卡片、按钮、胶囊换成新圆角和新颜色', () => {
  assert.match(read('components/k-card/k-card.vue'), /radius: \{ type: \[Number, String\], default: 16 \}/)
  const btn = read('components/k-button/k-button.vue')
  assert.match(btn, /\.k-button \{[^}]*border-radius: var\(--k-radius\);/)
  assert.match(btn, /\.is-secondary \{ color: var\(--k-red\); background: var\(--k-paper\); border-color: var\(--k-red-line\); \}/)
  assert.match(btn, /\.is-primary \{ color: #fff; background: var\(--k-grad-brown\); \}/)
  const chip = read('components/k-chip/k-chip.vue')
  assert.match(chip, /\.is-selected \{ color: var\(--k-red-deep\); background: var\(--k-red-soft\); border-color: var\(--k-red-line\);/)
  assert.match(chip, /\.k-chip \{[^}]*color: var\(--k-ink2\); background: var\(--k-paper2\);/, '奶油底上的小字用 --k-ink2（--k-muted 对比度不够）')
})

// 写死的旧漆红 #A94734 / rgba(169,71,52,…) 已换成 token。例外：level-badges.js 里是袋鼠画像本身的颜色（红围巾/红披风，画在 SVG 里读不到 CSS 变量），「我的」组决定保留
const PENDING = new Set(['pages/profile/level-badges.js'])
test('全站不再写死旧主色（只剩待别组改的几个文件）', () => {
  const left = []
  const walk = (dir) => {
    for (const name of fs.readdirSync(path.join(APP, dir))) {
      const rel = `${dir}/${name}`
      if (fs.statSync(path.join(APP, rel)).isDirectory()) walk(rel)
      else if (/\.(vue|js|scss|json)$/.test(name) && /#A94734|rgba\(169, ?7[01], ?52/i.test(read(rel)) && !PENDING.has(rel)) left.push(rel)
    }
  }
  ;['pages', 'components', 'common', 'styles'].forEach(walk)
  for (const f of ['App.vue', 'pages.json']) if (/#A94734|rgba\(169, ?7[01], ?52/i.test(read(f))) left.push(f)
  assert.deepEqual(left, [])
})

// 「全站系统黑体」：样式里不再写 Georgia 衬线数字（注释里提到不算）。社区组的两个文件已在合并时改好，名单清空
const SERIF_PENDING = new Set([])
test('样式里不再用 Georgia 衬线数字（只剩待别组改的文件）', () => {
  const left = []
  const walk = (dir) => {
    for (const name of fs.readdirSync(path.join(APP, dir))) {
      const rel = `${dir}/${name}`
      if (fs.statSync(path.join(APP, rel)).isDirectory()) walk(rel)
      else if (name.endsWith('.vue') && !SERIF_PENDING.has(rel)) {
        const css = read(rel).split('<style').slice(1).join('').replace(/\/\*[\s\S]*?\*\//g, '')
        if (/font(-family)?:[^;}]*Georgia/.test(css)) left.push(rel)
      }
    }
  }
  ;['pages', 'components'].forEach(walk)
  assert.deepEqual(left, [])
})

// 10-16 回归复查：下面这些是提醒（未读、未通过、没排房、逾期、下降、申诉、报错），换主色后不能跟着变棕；浅底上的小号棕字用深棕
test('回归复查：提醒类不跟主色变棕，浅底小号棕字用 --k-red-deep', () => {
  assert.match(read('pages/staff/business.vue'), /\.head-icon>text\{[^}]*background:var\(--k-alert\)/, '业务中心右上角消息角标')
  assert.match(read('pages/jobs/progress.vue'), /\.reason__title \{[^}]*color: var\(--k-alert\); \}/, '报名未通过的原因标题')
  const stay = read('pages/staff/stay-orders.vue')
  assert.match(stay, /\.order__room\.miss \{ color: var\(--k-alert\); \}/, '还没排房')
  assert.match(stay, /o\.missing > 0 \? 'alert' : 'green'/)
  const online = read('pages/staff/online-jobs.vue')
  assert.match(online, /class="deadline" :class="\{ 'is-over': overdue \}"/, '过了截止才标红，倒计时中保持棕色')
  assert.match(online, /\.deadline\.is-over\{color:var\(--k-alert\)\}/)
  assert.match(read('pages/staff/index.vue'), /it\.up === false \? 'color: var\(--k-alert\)'/, '工作台「较昨日」下降')
  const dash = read('pages/manage/dashboard.vue')
  assert.ok(!/'red'|'k-red'/.test(dash.split('<script')[0]), '数据看板的下降箭头 / 排名下降用提醒红')
  assert.match(dash, /width: sparkW \+ 'px'/, '指标卡折线按屏宽算，320 宽不伸出卡片')
  assert.match(read('pages/staff/vlog.vue'), /startsWith\('↓'\) \? \{ color: 'var\(--k-alert\)' \}/)
  assert.match(read('pages/staff/activities.vue'), /deltaDir\(st\.delta\) > 0 \? 'green' : 'alert'/)
  const income = read('pages/profile/income.vue')
  assert.match(income, /\.summary__num--red \{ color: var\(--k-alert\); \}/, '申诉中的金额和红色小标签一致')
  assert.match(income, /\.income-row__amount\.is-red \{ color: var\(--k-alert\); \}/)
  const iv = read('pages/staff/interviews.vue')
  assert.match(iv, /\.interview-card:before\{[^}]*background:var\(--k-alert\)\}/, '面试「待确认」（要门店处理）')
  assert.match(iv, /\.red-text\{color:var\(--k-red-deep\)\}/, '当天场数只是强调')
  const disp = read('pages/staff/dispatch.vue')
  assert.match(disp, /\.log-head>text\.red\{background:var\(--k-alert-soft\);color:var\(--k-alert\)\}/, '调度日志「加急」')
  assert.match(disp, /\.city-head text:last-child\{[^}]*color:var\(--k-red-deep\)/, '城市卡「急缺」小字')
  assert.match(read('pages/messages/index.vue'), /\.g-red\{background:var\(--k-red-soft\);color:var\(--k-red-deep\)\}/)
  assert.match(read('components/k-steps/k-steps.vue'), /\.current \.k-steps__label \{ color: var\(--k-red-deep\);/)
  for (const f of ['pages/profile/orders.vue', 'pages/profile/resume.vue', 'pages/profile/review.vue']) assert.ok(!/#FFF8F0/i.test(read(f)), `${f} 棕底按钮用纯白字`)
  const act = read('pages/community/activity.vue')
  assert.match(act, /:class="\{ few: item\.few && !item\.full, full: item\.full \}"/, '已满可候补不用名额紧张的红')
  const review = read('pages/profile/review.vue')
  assert.match(review, /tone: 'alert', title: '支付已超时'/)
  assert.match(review, /\.perm__icon\.is-alert \{ background: var\(--k-alert-soft\); \}/)
  assert.match(read('pages/messages/reminders.vue'), /\.large-icon--purple\{background:#7E5E9C\}/, '商家端会话提醒的图标底色')
})

// 10-16 复验第二轮：趋势颜色（涨绿 ↑、跌提醒红 ↓、持平 / — / 0 灰色不画箭头）、危险操作提醒红、赭黄小字和 --k-light 写内容
const fnSrc = (src, name) => {
  const m = new RegExp(String.raw`const ${name} = \(v(, up)?(, cost)?\) => (\{[\s\S]*?\n\}|[^\n]+)\n`).exec(src)
  assert.ok(m, `没找到 ${name}`)
  return m[0]
}
test('复验二：日报 / 周报 / 数据看板的涨跌颜色和箭头按变化值定', () => {
  const daily = read('pages/manage/daily.vue')
  const tpl = daily.split('<script')[0]
  assert.ok(!/item\.up \? 'k-red'|'k-red' : 'k-green'/.test(daily), '日报不再「涨棕跌绿」')
  assert.match(tpl, /<text class="metric__delta">较昨日 <text :class="item\.trend\.cls">\{\{ item\.trend\.text \}\}<\/text><\/text>/)
  assert.match(tpl, /<text :class="profitTrend\.cls">\{\{ profitTrend\.text \}\}<\/text>/, '收支结余的较昨日也按方向上色')
  assert.match(tpl, /<text :class="card\.trend\.cls">\{\{ card\.trend\.text \}\}<\/text>/, '汇总卡的较昨日也按方向上色')
  assert.match(daily, /\.profit__delta text \{ font-weight: 700; \}/, '不再把结余变化写死成主色')
  assert.match(daily, /\.summary-card__delta text \{ font-weight: 700; \}/)
  const trend = Function(`${fnSrc(daily, 'trendText')}${fnSrc(daily, 'trendDir')}${fnSrc(daily, 'trend')}return trend`)()
  const cases = [['+12.5%', true, 'k-green', '+12.5% ↑'], ['-88.9%', false, 'k-alert', '-88.9% ↓'], ['持平', true, 'k-muted', '持平'], ['+0.0%', true, 'k-muted', '+0.0%'],
    ['—', true, 'k-muted', '—'], [null, true, 'k-muted', '—'], ['新增', true, 'k-green', '新增 ↑'], ['较昨日 新增 ↓', false, 'k-alert', '新增 ↓'], ['较昨日 持平 ↑', true, 'k-muted', '持平'], ['较昨日 -3.1% ↓', false, 'k-alert', '-3.1% ↓']]
  for (const [v, up, cls, text] of cases) assert.deepEqual([trend(v, up).cls, trend(v, up).text], [cls, text], String(v))
  // 支出类反过来：花得多是坏消息（涨提醒红、降绿色），箭头方向不变
  const costly = Function(`${/const costly = [^\n]+\n/.exec(daily)[0]}return costly`)()
  assert.deepEqual([costly({ name: '采购支出' }), costly({ label: '总支出' }), costly({ name: '订房收入' }), costly({ label: '总营收' })], [true, true, false, false])
  assert.deepEqual([trend('+12%', true, true).cls, trend('+12%', true, true).text], ['k-alert', '+12% ↑'])
  assert.deepEqual([trend('-5%', false, true).cls, trend('-5%', false, true).text], ['k-green', '-5% ↓'])
  assert.equal(trend('持平', true, true).cls, 'k-muted')
  assert.match(daily, /trend: trend\(x\.delta, x\.up, costly\(x\)\)/, '明细指标按支出类上色')
  const weekly = read('pages/manage/weekly.vue')
  assert.ok(!/c\.up \? 'k-red'/.test(weekly), '周报不再「涨棕跌绿」')
  const deltaTone = Function(`${fnSrc(weekly, 'deltaTone')}return deltaTone`)()
  assert.deepEqual(['+5%', '-2%', '持平', '—', '+0%', '新增'].map(v => deltaTone(v, !String(v).startsWith('-'))), ['k-green', 'k-alert', 'k-muted', 'k-muted', 'k-muted', 'k-green'])
  const dash = read('pages/manage/dashboard.vue')
  const dashTpl = dash.split('<script')[0]
  assert.equal((dashTpl.match(/<k-icon v-if="(m|good|t|r)\.dir"/g) || []).length, 5, '5 处箭头都只在有涨跌时画')
  assert.ok(!/:name="\w+\.up \?/.test(dashTpl), '箭头方向不再直接用服务端的 up（没有对比值时也是 true）')
  assert.match(dashTpl, /\{\{ r\.changeText \}\}/, '名次没变写「持平」，不是绿色「↑ 0」')
  const dir = Function(`${fnSrc(dash, 'trendDir')}return trendDir`)()
  assert.deepEqual(['—', '持平', '+0%', '0', '+3.2%', '-1%', '新增'].map(v => dir(v, true)), [0, 0, 0, 0, 1, -1, 1])
})

test('复验二：申诉 ¥0 不标红、印章不盖字、活动折线按屏宽、筛选格 320 不折行', () => {
  const income = read('pages/profile/income.vue')
  assert.match(income, /<text class="summary__num" :class="\{ 'summary__num--red': hasDispute \}">/, '没有申诉时「申诉中 ¥0」用墨色')
  assert.match(income, /const hasDispute = computed\(\(\) => Number\(totals\.value\.disputedCount\) > 0 \|\|/)
  const order = read('pages/stays/order.vue')
  assert.match(order, /\.verified>image \{[^}]*mix-blend-mode: darken; \}/, '印章叠在横幅上：底色不出方框、压到的字看得见')
  assert.match(order, /@media \(max-width: 350px\) \{ \.verified>image \{ right: 8px; width: 64px; height: 54px; \} \}/, '窄屏印章缩小，不盖副标题')
  const act = read('pages/staff/activities.vue')
  assert.match(act, /const W = Math\.max\(200, winW - 64\), H = 90/, '活动数据折线宽度按屏宽算')
  assert.match(act, /\.data-body \.chart__plot\{height:90px\}/, '折线高度和画布高度一致：0 值的点落在横轴上，不压到日期')
  assert.ok(!/const W = 296/.test(act) && !/width: 296px/.test(act))
  const review = read('pages/profile/review.vue')
  assert.match(review, /\.filter text \{ white-space: nowrap; \}/)
  assert.match(review, /@media \(max-width: 340px\) \{ \.filter \{ padding: 0 8px; \} \}/)
})

test('复验二：危险操作（退出群聊、举报该群、撤回报名）用提醒红，撤回报名不是实心主按钮', () => {
  const chat = read('pages/community/chat.vue')
  assert.match(chat, /<k-button type="outline" size="lg" block class="danger" @click="leaveGroup">退出群聊<\/k-button>/)
  assert.match(chat, /\.detail-body>\.k-button\.danger\{color:var\(--k-alert\);/)
  assert.match(chat, /\.report-group\{[^}]*color:var\(--k-alert\)/)
  const progress = read('pages/jobs/progress.vue')
  assert.match(progress, /<view class="k-flex1 danger"><k-button type="outline" block :disabled="blank \|\| !canWithdraw" @click="withdraw">撤回报名<\/k-button><\/view>/)
  assert.match(progress, /<view v-if="!isOnline" class="withdraw danger"><k-button type="outline"/)
  assert.ok(!/<k-button block :disabled="blank \|\| !canWithdraw" @click="withdraw">/.test(progress), '撤回报名不用实心主色按钮')
  assert.match(progress, /\.danger :deep\(\.k-button\) \{ color: var\(--k-alert\);/)
  assert.match(progress, /\.danger :deep\(\.k-button\.is-disabled\) \{ color: var\(--k-light\);/, '不能撤回时仍是禁用灰')
})

test('复验二：赭黄小字用 --k-ochre-deep，内容不用 --k-light，浅底小号棕字用 --k-red-deep', () => {
  assert.equal(token('ochre-deep'), '#8A5A1C')
  assert.match(read('components/k-chip/k-chip.vue'), /\.is-ochre \{ color: var\(--k-ochre-deep\); background: var\(--k-ochre-soft\); \}/)
  const msg = read('pages/messages/index.vue')
  assert.match(msg, /\.g-ochre\{background:var\(--k-ochre-soft\);color:var\(--k-ochre-deep\)\}/, '消息「订单 / 活动」标签')
  assert.match(msg, /\.row__side\{[^}]*color:var\(--k-muted\)\}/, '消息列表的时间')
  const steps = read('components/k-steps/k-steps.vue')
  assert.match(steps, /\.k-steps__item \{[^}]*color: var\(--k-muted\);/, '还没到的步骤名')
  assert.match(steps, /\.k-steps__dot \{[^}]*color: var\(--k-muted\); \}/, '还没到的步骤序号')
  assert.match(read('pages/staff/index.vue'), /\.switch-btn \{[^}]*color: var\(--k-ochre-deep\);/, '工作台「切换门店」')
  const vlog = read('pages/staff/vlog.vue')
  assert.match(vlog, /\.k-ochre\{color:var\(--k-ochre-deep\)\}/, '「去查看建议」')
  assert.match(vlog, /\.period\.active\{color:var\(--k-red-deep\);/, '「近7天」')
  const act = read('pages/staff/activities.vue')
  assert.match(act, /\.audit--ochre \{ color: var\(--k-ochre-deep\);/, '「待审核」')
  assert.match(act, /\.weather__btn \{[^}]*color: var\(--k-ochre-deep\);/)
  const deliver = read('pages/jobs/deliver.vue')
  assert.match(deliver, /\n\.k-link \{ color: var\(--k-red-deep\); \}/, '交付页「复制」「复制链接」')
  assert.match(deliver, /\.flow__label \{[^}]*color: var\(--k-muted\);/, '交付步骤里还没到的步骤')
  assert.match(read('pages/jobs/contract.vue'), /\.flow>view\.active \{ color: var\(--k-red-deep\);/, '责任书当前步骤')
})
