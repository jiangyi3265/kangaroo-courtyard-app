// 「我的」宫格的双色手绘图标（2026-10-16 改版，对照设计图 22）：绿色线条 + 桃色错位底色 + 橙色点缀。
// 和 level-badges.js 一样在运行时拼 SVG、转 base64 图片地址给 <image> 用；只给 profile 分包的页面用，构建后跟着分包走，
// 不进主包（别的分包要用时另放一份：两个分包引用同一个模块，uni-app 会把它挪进主包）。
// 主包 common/icons.js 是单色 lucide 图标，k-icon 只能上一种颜色，所以这里另做一套，不往主包里加东西。
// SVG 只用 path / circle / g、transform、opacity，不用 style / filter / clipPath / text / image，里面全是 ASCII 字符。
// 画布 48×48：桃色底色整体往右下错开 2，线条压在上面，看起来像手工套色印的；扳手、齿轮的外形取自 lucide（ISC 许可），放大后重描。

const C = { line: '#4F8A5B', accent: '#EC9A5A', soft: '#FADBBD' }
const W = 2.6
const line = (d, color = C.line, w = W) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
const fill = (d, color = C.accent) => `<path d="${d}" fill="${color}"/>`
// 桃色错位底色：和线条同一个外形，往右下挪 2
const under = (d) => `<path d="${d}" fill="${C.soft}" transform="translate(2 2)"/>`
const dot = (cx, cy, r, color = C.accent) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`
const num = (v) => Math.round(v * 100) / 100
// 五角星（外半径 R、内半径 r）
const star = (cx, cy, R, r) => {
  let d = ''
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 5 * k - Math.PI / 2, rad = k % 2 ? r : R
    d += (k ? 'L' : 'M') + num(cx + rad * Math.cos(a)) + ' ' + num(cy + rad * Math.sin(a))
  }
  return d + 'z'
}
// 四角闪光（和会员徽章里的小星光同一个画法）
const spark = (x, y, s) => `M${x} ${num(y - s)}q${num(s * 0.25)} ${num(s * 0.75)} ${s} ${s}q${num(-s * 0.75)} ${num(s * 0.25)} ${-s} ${s}q${num(-s * 0.25)} ${num(-s * 0.75)} ${-s} ${-s}q${num(s * 0.75)} ${num(-s * 0.25)} ${s} ${-s}z`

const CAL = 'M13 10.5h22a4.5 4.5 0 0 1 4.5 4.5v20a4.5 4.5 0 0 1-4.5 4.5H13A4.5 4.5 0 0 1 8.5 35V15a4.5 4.5 0 0 1 4.5-4.5z'
const MAP = 'M8 13l11-4 10 4 11-4v27l-11 4-10-4-11 4z'
const FLAG = 'M13 10.5c5-3 9-1.5 13 .5s8 2.5 11.5.5v15c-3.5 2-7.5 1.5-11.5-.5s-8-3.5-13-.5z'
const BUBBLE = 'M14 9h20a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H24.5l-7.5 6.5V32H14a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5z'
const DOC = 'M14 7h14l9 9v22.5a3.5 3.5 0 0 1-3.5 3.5H14a3.5 3.5 0 0 1-3.5-3.5v-28A3.5 3.5 0 0 1 14 7z'
// lucide wrench（24 格）放大 1.6 倍
const WRENCH = 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z'
const AWNING = 'M9 18l3.5-8.5h23L39 18a3.75 3.75 0 0 1-7.5 0 3.75 3.75 0 0 1-7.5 0 3.75 3.75 0 0 1-7.5 0 3.75 3.75 0 0 1-7.5 0z'
const SHOP = 'M11.5 21.5V38a2 2 0 0 0 2 2h21a2 2 0 0 0 2-2V21.5'
const WALLET = 'M12 15h24.5a4 4 0 0 1 4 4v17a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V19a4 4 0 0 1 4-4z'
const PENCIL = 'M30.5 9.5a3.2 3.2 0 0 1 4.5 0l3.5 3.5a3.2 3.2 0 0 1 0 4.5L18 38l-9 2 2-9z'
const MARK = 'M15 7.5h18a3 3 0 0 1 3 3V40l-12-7.5L12 40V10.5a3 3 0 0 1 3-3z'
const HOUSE = 'M24 9.5l-12 10V37a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3V19.5z'
const BOOK = 'M24 13c-4-3-9.5-4-15.5-3v26c6-1 11.5 0 15.5 3 4-3 9.5-4 15.5-3V10c-6-1-11.5 0-15.5 3z'
const GIFT = 'M11 22h26v14.5a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z'
const LID = 'M10 15.5h28a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 21v-4a1.5 1.5 0 0 1 1.5-1.5z'
const CHAT = 'M24 9c9.4 0 16 5.8 16 13s-6.6 13-16 13c-1.8 0-3.5-.2-5-.6L11.5 38l1.6-6.4C9.9 29.2 8 25.8 8 22c0-7.2 6.6-13 16-13z'
// lucide settings 齿轮外圈（24 格）放大 1.75 倍
const GEAR = 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915'
const BAG = 'M12 16h24a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4z'
const zoom = (s, t, inner) => `<g transform="translate(${t}) scale(${s})">${inner}</g>`

// 名字 → 图标内容。订单与行程 / 工作与成长 / 内容与关注 / 更多服务 + 员工工作台
export const PROFILE_ICONS = {
  badge: under('M15 29l-3 12 12-5 12 5-3-12z') + line('M16 29l-4 12 12-5 12 5-4-12') + dot(24, 20, 14, C.soft) + line('M38 20a14 14 0 1 1-28 0 14 14 0 0 1 28 0z') + fill(star(24, 20, 8, 3.8)),
  // 我的订单：日历，表头桃色，里面一个橙色对勾
  orders: under(CAL) + fill('M13 10.5h22a4.5 4.5 0 0 1 4.5 4.5v5.5h-31V15a4.5 4.5 0 0 1 4.5-4.5z', C.soft) + line(CAL) + line('M8.5 20.5h31M17 7v7M31 7v7') + line('M18.5 29.5l4 4 7.5-7.5', C.accent, 2.8),
  // 我的行程：折叠地图，橙色路线和终点
  trip: under(MAP) + line(MAP) + line('M19 9v27M29 13v27') + line('M12.5 31.5c3-4.5 6.5-5 9-2.5s6 2 8-2.5 4.5-6 6.5-6', C.accent, 2.4) + dot(36, 20.5, 2.6),
  // 我的活动：插在地上的小旗，旗面一颗橙星，旁边一点闪光
  activity: under(FLAG) + line(FLAG) + line('M13 41V8.5M9 41h8') + fill(star(25.2, 18.8, 4.6, 2.1)) + fill(spark(38.5, 34, 2.6)) + dot(32.5, 39, 1.4),
  // 我的评价：对话气泡里一颗橙星
  review: under(BUBBLE) + line(BUBBLE) + fill(star(24, 20.5, 7, 3.2)),
  // 我的简历：带折角的简历，左上角橙色头像
  resume: under(DOC) + line(DOC) + line('M28 7v6.5a2.5 2.5 0 0 0 2.5 2.5H37') + dot(19.5, 19.5, 3.2) + line('M14.8 29a4.7 4.7 0 0 1 9.4 0', C.accent, 2.4) + line('M28.5 22.5h3.5M28.5 28.5h3.5M16 35.5h16', C.line, 2.2),
  // 技能与机会：扳手 + 橙色闪光
  skills: zoom(1.6, '3 10', under(WRENCH).replace('translate(2 2)', 'translate(1.25 1.25)') + line(WRENCH, C.line, 1.62)) + fill(spark(40.5, 9, 4.4)) + fill(spark(44, 18.5, 2)),
  // 门店任务：带遮阳棚的小店
  tasks: under(AWNING) + fill(AWNING, C.soft) + line(AWNING) + line('M16.5 18l1.5-8.5M24 18V9.5M31.5 18L30 9.5', C.accent, 2) + line(SHOP) + line('M20 40v-6.5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2V40'),
  // 我的收入：钱包，橙色背带和扣子
  income: under(WALLET) + line(WALLET) + line('M13 15l15-6.4a2 2 0 0 1 2.6 1.1L32.6 15', C.accent, 2.4) + line('M40.5 23H34a4.5 4.5 0 0 0 0 9h6.5') + dot(34.5, 27.5, 1.7),
  // 我的发布：铅笔，橙色笔尖，下面一道写出来的线
  posts: under(PENCIL) + fill('M11 31l7 7-9 2z') + line(PENCIL) + line('M26.5 13.5l8 8') + line('M28 40h11', C.accent, 2.4),
  // 我的收藏：书签里一颗橙心
  favorites: under(MARK) + line(MARK) + fill('M24 25.5s-6.5-4-6.5-8.3a3.6 3.6 0 0 1 6.5-2.2 3.6 3.6 0 0 1 6.5 2.2c0 4.3-6.5 8.3-6.5 8.3z'),
  // 我的关注：小房子（关注的门店），橙色门
  follows: under(HOUSE) + fill('M20.5 40v-7.5a3.5 3.5 0 0 1 7 0V40z') + line('M8.5 22.5L24 9.5l15.5 13') + line('M12 19.5V37a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3V19.5') + line('M32.5 14.5V10'),
  // 攻略申请：翻开的书，橙色书签带
  guide: under(BOOK) + line(BOOK) + line('M24 13v26') + line('M12.5 17c2.8-.3 5.3 0 7.5 1M12.5 22.5c2.8-.3 5.3 0 7.5 1', C.line, 2) + fill('M30.5 10.3h5.4v10.2l-2.7-2.2-2.7 2.2z'),
  // 邀请有礼：礼盒，橙色丝带和蝴蝶结
  invite: under(GIFT) + line(GIFT) + line(LID) + line('M24 15.5v24', C.accent, 2.6) + fill('M24 15.5c-1.5-4.5-6-7.5-8.5-5.5s.5 5.5 8.5 5.5zM24 15.5c1.5-4.5 6-7.5 8.5-5.5s-.5 5.5-8.5 5.5z'),
  // AI袋鼠：对话气泡里的橙色闪光
  assistant: under(CHAT) + line(CHAT) + fill(spark(24, 22, 6.2)) + fill(spark(32.5, 15.5, 2.2)),
  // 设置：齿轮，橙色轴心
  settings: zoom(1.75, '3 3', under(GEAR).replace('translate(2 2)', 'translate(1.15 1.15)') + line(GEAR, C.line, 1.5)) + dot(24, 24, 4.8),
  // 员工工作台：公文包，橙色锁扣
  staff: under(BAG) + line(BAG) + line('M18.5 16v-3a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3v3') + line('M8 26c10 3.5 22 3.5 32 0') + fill('M21.5 25h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1z')
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

const cache = {}
/** 图标图片地址；名字不认识时画一个空心圆（和 k-icon 找不到图标时一样），同一枚只拼一次 */
export function profileIcon(name) {
  const key = PROFILE_ICONS[name] ? name : ''
  if (!cache[key]) {
    const body = PROFILE_ICONS[name] || line('M24 10a14 14 0 1 0 0 28 14 14 0 1 0 0-28z')
    cache[key] = `data:image/svg+xml;base64,${b64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${body}</svg>`)}`
  }
  return cache[key]
}
