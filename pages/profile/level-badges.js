// 会员成长等级徽章（2026-10-15）：6 枚袋鼠成长圆章，用同一套零件在运行时拼成 SVG，再转成 base64 图片地址给 <image> 用。
// 之前是 static/media/profile-level-1..6.jpg：6 张几乎一样的线稿袋鼠，带米色底，合计约 22KB，压在主包里。
// 这个文件只给 profile 分包的页面用（「我的」、会员权益），构建后跟着分包走，不进主包；别的分包要用时另放一份，
// 两个分包引用同一个模块，uni-app 会把它挪进主包。
// SVG 只用 circle / ellipse / path / rect / g、transform、opacity，不用 style / filter / clipPath，和 k-icon 在小程序里的用法一样；
// 里面全是 ASCII 字符，base64 编码照抄 components/k-icon/k-icon.vue。
// 等级固定 6 级（后台只能改名字和门槛，不能增删），序号 0..5 对应：
//   0 幼崽鼠：还在妈妈的育儿袋里，只探出头和小爪    1 小袋鼠：第一次自己站起来，系着小红围巾
//   2 袋鼠：背上小背包出发                        3 大袋鼠：戴上旅行草帽，旁边一颗星
//   4 巨袋鼠：育儿袋里带着小袋鼠（带新人），两颗星    5 袋鼠王：金冠、红披风、三颗星
// 2026-10-16 改版：「我的」会员卡和会员信息屏要一只大号吉祥物，加了 levelMascot()：同一套袋鼠成长形象，
// 去掉圆章底、按原尺寸画（不再缩小塞进圆里），脚下一圈淡影子；画布收窄到袋鼠本身（56×62），图片给多大就画多大。
// 6 级阶梯和会员权益页的小徽章仍用带圆章的 levelBadge()（小尺寸时圆章更好认）。

const COLOR = {
  fur: '#E6B47E', belly: '#FAE9D2', line: '#7A4E2D', ear: '#F2B3A0', eye: '#2B1D16', blush: '#F09A86', white: '#FFFFFF',
  red: '#A94734', ochre: '#C99043', gold: '#E9B949', spark: '#D9A23A', strap: '#9A6A22', hat: '#E7C27A', pouch: '#B97F4F',
  ring2: '#AFC0CC', ring3: '#4F7A66',
  bg0: '#EAF1E4', bg1: '#F7EEDD', bg2: '#E7EDF1', bg3: '#E5EFE6', bg4: '#F6E9D2', bg5: '#FBEBC0'
}
const toGrey = (hex) => {
  const v = parseInt(hex.slice(1), 16)
  const l = Math.round(0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255))
  const h = (l < 16 ? '0' : '') + l.toString(16).toUpperCase()
  return '#' + h + h + h
}
// 灰色配色：没达到的等级现在用 CSS filter: grayscale(1) 灰显；万一哪台手机的微信不认 filter，改用 levelBadge(i, true) 拿这套灰色画的图
export const GREY = Object.keys(COLOR).reduce((out, k) => { out[k] = toGrey(COLOR[k]); return out }, {})

const num = (v) => Math.round(v * 100) / 100
const g = (t, s) => `<g transform="${t}">${s}</g>`
// 把 64x64 画布上的整只袋鼠按比例缩小、保持居中（dy 往下挪一点）
const fit = (s, dy = 0) => `translate(${num(32 - 32 * s)} ${num(33 - 33 * s + dy)}) scale(${s})`

// bare 为 true 时画吉祥物版：没有圆章底、袋鼠不缩小，脚下加影子（levelMascot 用）
function draw(i, c, bare) {
  const st = `stroke="${c.line}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`
  const f = (fill) => `fill="${fill}" ${st}`
  // 头（带耳朵）以 (32,24) 为中心：大袋鼠原尺寸用，小袋鼠缩小用
  const ears = `<ellipse cx="26.5" cy="12.5" rx="3.4" ry="7.5" transform="rotate(-14 26.5 12.5)" ${f(c.fur)}/><ellipse cx="37.5" cy="12.5" rx="3.4" ry="7.5" transform="rotate(14 37.5 12.5)" ${f(c.fur)}/>`
    + `<ellipse cx="26.6" cy="13" rx="1.5" ry="4.8" transform="rotate(-14 26.6 13)" fill="${c.ear}"/><ellipse cx="37.4" cy="13" rx="1.5" ry="4.8" transform="rotate(14 37.4 13)" fill="${c.ear}"/>`
  const face = `<ellipse cx="32" cy="24" rx="10.5" ry="9.5" ${f(c.fur)}/><ellipse cx="32" cy="27.6" rx="5.2" ry="3.7" fill="${c.belly}"/>`
    + `<ellipse cx="25.4" cy="27.2" rx="2.1" ry="1.3" fill="${c.blush}" opacity=".6"/><ellipse cx="38.6" cy="27.2" rx="2.1" ry="1.3" fill="${c.blush}" opacity=".6"/>`
    + `<circle cx="28" cy="23" r="1.6" fill="${c.eye}"/><circle cx="36" cy="23" r="1.6" fill="${c.eye}"/><circle cx="28.5" cy="22.4" r=".55" fill="${c.white}"/><circle cx="36.5" cy="22.4" r=".55" fill="${c.white}"/>`
    + `<ellipse cx="32" cy="26.4" rx="1.4" ry="1" fill="${c.eye}"/><path d="M30.5 28.4q1.5 1.2 3 0" fill="none" stroke="${c.eye}" stroke-width="1" stroke-linecap="round"/>`
  const head = ears + face
  const body = `<path d="M23 47c-6 1-11 4-14 9 5 0 10-2 15-5z" ${f(c.fur)}/>`
    + `<path d="M22 46c0-9 4-14 10-14s10 5 10 14c0 7-4 11-10 11s-10-4-10-11z" ${f(c.fur)}/>`
    + `<ellipse cx="32" cy="47" rx="6" ry="7.5" fill="${c.belly}"/>`
    + `<ellipse cx="27" cy="57" rx="5.6" ry="2.3" ${f(c.fur)}/><ellipse cx="37.4" cy="57" rx="5.6" ry="2.3" ${f(c.fur)}/>`
  const paw = (x, y, deg) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="3" transform="rotate(${deg} ${x} ${y})" ${f(c.fur)}/>`
  const paws = paw(28, 40, 25) + paw(36, 40, -25)
  const pawsWide = paw(24.6, 41, 20) + paw(39.4, 41, -20)
  const medal = (bg, ring) => `<circle cx="32" cy="32" r="30.5" fill="${bg}"/>` + (ring ? `<circle cx="32" cy="32" r="29.6" fill="none" stroke="${ring}" stroke-width="1.8"/>` : '')
  const spark = (x, y, s, fill) => `<path d="M${x} ${num(y - s)}q${num(s * 0.25)} ${num(s * 0.75)} ${s} ${s}q${num(-s * 0.75)} ${num(s * 0.25)} ${-s} ${s}q${num(-s * 0.25)} ${num(-s * 0.75)} ${-s} ${-s}q${num(s * 0.75)} ${num(-s * 0.25)} ${s} ${-s}z" fill="${fill}"/>`
  // 配件
  const scarf = `<path d="M25.5 32.6q6.5 3.4 13 0l-.4 2.6q-6.1 2.8-12.2 0z" fill="${c.red}"/><path d="M35.5 34.6l2.4 5.2-3.2.4-.9-5z" fill="${c.red}"/>`
  const pack = `<rect x="14.5" y="34" width="10" height="14" rx="3.5" ${f(c.ochre)}/><path d="M16 40h7" stroke="${c.line}" stroke-width="1.2"/>`
  const straps = `<path d="M25.6 34.5l3.4 9M38.4 34.5l-3.4 9" stroke="${c.strap}" stroke-width="1.8" stroke-linecap="round"/>`
  const hat = `<ellipse cx="32" cy="16.2" rx="12.5" ry="2.8" ${f(c.hat)}/><path d="M25 16c0-4.6 3-7 7-7s7 2.4 7 7z" ${f(c.hat)}/><path d="M25.3 14.2h13.4" stroke="${c.red}" stroke-width="1.8"/>`
  const pouchJoey = g('translate(16 32) scale(.5)', head) + `<path d="M24.5 47.5q7.5 3.5 15 0c0 5-3 8.5-7.5 8.5s-7.5-3.5-7.5-8.5z" ${f(c.belly)}/>`
  const crown = `<path d="M25.5 9.5l2.6 3.2 3.9-5 3.9 5 2.6-3.2v6.2h-13z" ${f(c.gold)}/><circle cx="32" cy="7.4" r="1" fill="${c.red}"/>`
  const cape = `<path d="M24 33c-4 6-6 14-5 22h26c1-8-1-16-5-22z" fill="${c.red}" opacity=".9"/>`
  // 吉祥物版：圆章底换成脚下一圈淡影子，袋鼠按原尺寸画（徽章版要缩小塞进圆里）
  const shadow = `<ellipse cx="32" cy="59.6" rx="15" ry="2.2" fill="${c.line}" opacity=".16"/>`
  const base = (bg, ring) => (bare ? shadow : medal(bg, ring))
  const fig = (s, dy, parts) => (bare ? parts : g(fit(s, dy), parts))

  // 幼崽鼠的吉祥物版：没有圆章可借，画成妈妈圆鼓鼓的育儿袋，小袋鼠从袋口探出头和小爪，整组放大一点
  if (i === 0 && bare) return shadow + g('translate(-4.8 -10.2) scale(1.15)', `<path d="M13.5 42.5c1-4.6 8.6-7.3 18.5-7.3s17.5 2.7 18.5 7.3c2.6 3.4 3.8 7 3.8 9.4 0 6.4-9.8 10.1-22.3 10.1S9.7 58.3 9.7 51.9c0-2.4 1.2-6 3.8-9.4z" ${f(c.fur)}/>`
    + `<ellipse cx="32" cy="43.4" rx="13.6" ry="2.6" fill="${c.pouch}"/>` + g('translate(4.8 12.6) scale(.85)', head)
    + `<path d="M18.2 43.2c-.6 9.4 5.6 15.4 13.8 15.4s14.4-6 13.8-15.4c-4.5 1.9-9 2.7-13.8 2.7s-9.3-.8-13.8-2.7z" ${f(c.belly)}/>`
    + `<ellipse cx="26.4" cy="44.4" rx="2.5" ry="1.9" ${f(c.fur)}/><ellipse cx="37.6" cy="44.4" rx="2.5" ry="1.9" ${f(c.fur)}/>`)
    + spark(12, 24, 2.6, c.ochre) + spark(53, 19, 2, c.ochre)
  if (i === 0) return medal(c.bg0) + `<path d="M4 44Q32 33 60 44A30.5 30.5 0 0 1 4 44z" fill="${c.fur}"/><path d="M4 44Q32 33 60 44" fill="none" ${st}/>`
    + `<ellipse cx="32" cy="43" rx="14" ry="2.6" fill="${c.pouch}"/>` + g('translate(8 15.5) scale(.75)', head)
    + `<path d="M18 43c0 8.5 6 14 14 14s14-5.5 14-14c-4.5 1.8-9 2.6-14 2.6s-9.5-.8-14-2.6z" ${f(c.belly)}/>`
    + `<ellipse cx="26.5" cy="44" rx="2.3" ry="1.8" ${f(c.fur)}/><ellipse cx="37.5" cy="44" rx="2.3" ry="1.8" ${f(c.fur)}/>`
  if (i === 1) return base(c.bg1) + fig(0.8, 1.5, body + head + scarf + paws)
  if (i === 2) return base(c.bg2, c.ring2) + fig(0.88, 0.5, pack + body + straps + head + paws)
  if (i === 3) return base(c.bg3, c.ring3) + fig(0.92, 0, pack + body + straps + ears + hat + face + paws) + spark(52, 15, 3, c.ochre)
  if (i === 4) return base(c.bg4, c.ochre) + fig(0.94, 0, body + head + pouchJoey + pawsWide) + spark(11, 16, 3, c.ochre) + spark(53, 13, 2.4, c.ochre)
  return base(c.bg5, c.gold) + (bare ? '' : `<circle cx="32" cy="32" r="27" fill="none" stroke="${c.gold}" stroke-width=".8" opacity=".7"/>`)
    + fig(0.92, 1, cape + body + head + crown + paws) + spark(10, 18, 3.2, c.spark) + spark(54, 14, 3, c.spark) + spark(51, 50, 2.2, c.spark)
}

const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const b64 = (s) => {
  let out = ''
  for (let i = 0; i < s.length; i += 3) {
    const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2)
    const n = (a << 16) | ((b || 0) << 8) | (c || 0)
    out += CH[(n >> 18) & 63] + CH[(n >> 12) & 63] + (isNaN(b) ? '=' : CH[(n >> 6) & 63]) + (isNaN(c) ? '=' : CH[n & 63])
  }
  return out
}

export const LEVEL_COUNT = 6
const cache = {}
const levelIndex = (level) => Math.max(0, Math.min(LEVEL_COUNT - 1, Math.floor(Number(level)) || 0))
/** 第 level 级（0..5，超出范围按最近的一级）的徽章图片地址；grey 为 true 时用灰色配色。同一枚只拼一次 */
export function levelBadge(level, grey = false) {
  const i = levelIndex(level)
  const key = i + (grey ? 'g' : '')
  if (!cache[key]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${draw(i, grey ? GREY : COLOR)}</svg>`
    cache[key] = `data:image/svg+xml;base64,${b64(svg)}`
  }
  return cache[key]
}
/** 第 level 级的大号吉祥物（没有圆章底，画布 56×62，宽高比约 0.9）：会员卡和会员信息屏用。序号规则和缓存同 levelBadge */
export function levelMascot(level) {
  const i = levelIndex(level)
  const key = i + 'm'
  if (!cache[key]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 1 56 62">${draw(i, COLOR, true)}</svg>`
    cache[key] = `data:image/svg+xml;base64,${b64(svg)}`
  }
  return cache[key]
}
