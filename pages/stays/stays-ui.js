// 旅居订房入口 / 房源列表 / 房源详情改版（2026-10-17，主人发来的效果图 5–7）共用的小函数。
// 不碰 vue / uni，node 测试里能直接 import；放在 pages/stays 分包里，不占主包。

/** 列表页标题：点哪个城市就显示「城市 + 房源」（丽江房源）；之前写死「全部房源」。还没定城市时仍叫「全部房源」 */
export const cityTitle = (city) => {
  const c = String(city || '').trim()
  return c ? c + '房源' : '全部房源'
}

/** 区县取当前城市的正式目录，合并线上房源的数量和自定义区域；不带入其它城市。 */
export function cityDistricts(city, directory = [], listed = []) {
  const name = String(city || '').trim()
  if (!name) return []
  const canonical = v => String(v || '').trim().replace(/市$/, '')
  const parents = new Set([canonical(name)])
  for (const row of directory) {
    if ([row.name, row.fullName].some(v => v && canonical(v) === canonical(name))) {
      parents.add(canonical(row.name))
      parents.add(canonical(row.fullName))
    }
  }
  const rows = [], aliases = new Map()
  for (const row of directory) {
    if (row.level !== 'district' || !parents.has(canonical(row.parentName))) continue
    const full = row.fullName || row.name
    if (!full) continue
    if (!rows.some(r => r.name === full)) rows.push({ name: full, count: 0 })
    aliases.set(row.name, full)
    aliases.set(full, full)
  }
  for (const row of listed) {
    if (!row?.name) continue
    const full = aliases.get(row.name) || row.name
    let item = rows.find(r => r.name === full)
    if (!item) { item = { name: full, count: 0 }; rows.push(item) }
    item.count += Math.max(0, Number(row.count) || 0)
  }
  return rows.sort((a, b) => b.count - a.count)
}

/** 来源名：直营 → 袋鼠直营，代运营 / 加盟 → 袋鼠合作（列表「袋鼠合作」页签查的就是「不是直营」的全部）。
 *  只改住客看到的字：后端的 operateModeLabel（直营 / 代运营 / 加盟）员工端房源管理页也在用，那里要分清代运营和加盟，所以后端不动 */
export const srcLabel = (mode) => (!mode || mode === 'direct' ? '袋鼠直营' : '袋鼠合作')

/** 选项胶囊排成几行、每一行都铺满，不留空洞（主人：「不要双人间底下是空着的，要排列好看」）。
 *  n 个选项、每行最多 max 个（1–4）：先算要几行，再尽量平均分（5 个 → 3 + 2，7 个 → 4 + 3，8 个 → 4 + 4），
 *  返回每个选项在 12 栏网格里占几栏（一行 3 个各占 4 栏、2 个各占 6 栏），同一行加起来正好 12 */
export function evenSpans(n, max = 4) {
  const m = Math.max(1, Math.min(4, Math.floor(max) || 1))
  if (!(n > 0)) return []
  const rows = Math.ceil(n / m)
  const base = Math.floor(n / rows)
  const extra = n % rows
  const out = []
  for (let r = 0; r < rows; r++) {
    const k = base + (r < extra ? 1 : 0)
    for (let i = 0; i < k; i++) out.push(12 / k)
  }
  return out
}

/** 评分一行拆成两段：{ score: '4.8分', count: '127条评价' }；没评分或没评价时返回 null，页面写「暂无评价」 */
export const ratingParts = (rating, count) => {
  const r = Number(rating)
  const c = Number(count)
  return r > 0 && c > 0 ? { score: r.toFixed(1) + '分', count: c + '条评价' } : null
}

/** 房型卡片上的「少量余房」：能订、只剩 1–3 间 / 床 */
export const FEW_LEFT = 3
export const fewLeft = (room) => !!room && room.bookable !== false && Number(room.remain) > 0 && Number(room.remain) <= FEW_LEFT

/** 房型卡片一行说明：「可住2人 | 独立卫浴 | 空调」（可住人数 + 房型亮点前两个，都是房型接口已有的字段） */
export const roomLine = (r) => [Number(r && r.capacity) > 0 ? `可住${r.capacity}人` : '', ...((r && r.features) || []).slice(0, 2)].filter(Boolean).join(' | ')

/** 2026-10-18 房型卡规格一行（效果图「1人｜独立卫浴｜空调｜可做饭」）：可住人数 + 房型亮点前三个，全角竖线隔开 */
export const roomSpec = (r) => [Number(r && r.capacity) > 0 ? `${r.capacity}人` : '', ...((r && r.features) || []).slice(0, 3)].filter(Boolean).join('｜')

/** 2026-10-18 房型自己的评分（接口 rating / reviewCount，来自绑定了这个房型的家人评价）：{ score: '4.8', count: 12 }；
 *  这个房型还没有评价时返回 null，卡片上不显示分数（不拿小院总分顶替） */
export const roomRate = (r) => {
  const v = Number(r && r.rating)
  const n = Number(r && r.reviewCount)
  return Number.isFinite(v) && v > 0 && v <= 5 && Number.isSafeInteger(n) && n > 0 ? { score: v.toFixed(1), count: n } : null
}

/** 日期段「10.17-10.18」（入参是 9.5 这种点号日期） */
export const dateRange = (a, b) => (a && b ? `${a}-${b}` : '')

/** 订房入口那条暖棕横条：「已选：大理古城 | 1人 | 10.17-10.18 | 不限房型」（房型 + 卫浴都选了写成「单人间·独立卫浴」） */
export const searchLine = ({ area, guests, dates, room, bath }) => {
  const r = room && room !== '不限' ? room : ''
  const b = bath && bath !== '不限' ? bath : ''
  return '已选：' + [area || '全部区域', (Number(guests) || 1) + '人', dates, [r, b].filter(Boolean).join('·') || '不限房型'].filter(Boolean).join(' | ')
}

/** 详情页底部浮条：「已选：单人间 | 10.17-10.18 | 1晚」；还没选房型时写「未选房型」。
 *  页面按段画（pickedParts），每段不拆行：窄屏放不下时整段换到下一行，不会把「10.17-10.18」拆成两半 */
export const pickedParts = (roomName, dates, nights) => [roomName || '未选房型', dates, Number(nights) > 0 ? nights + '晚' : ''].filter(Boolean)
export const pickedLine = (roomName, dates, nights) => '已选：' + pickedParts(roomName, dates, nights).join(' | ')

// ---------------- 2026-10-17 R2：区县、主理人、出行参考、学习室 / 健身房 ----------------

/** 列表「位置」下拉的区县一组：「全部位置」+ 有房源的区县（带家数），数据来自 /app/stay/districts；
 *  value 是区县名（列表按它精确筛选），all 是这座城市的全部家数（「全部位置(12)」） */
export const districtChoices = (districts, all) => [{ value: '', label: Number(all) > 0 ? `全部位置(${all})` : '全部位置' }]
  .concat((districts || []).filter(d => d && d.name).map(d => ({ value: d.name, label: Number(d.count) > 0 ? `${d.name}(${Number(d.count)})` : d.name })))

/** 列表卡的位置一行：「道外区 · 中央大街步行 5 分钟」；位置描述里已经写了区县的不再重复 */
export const whereLine = (district, areaDesc) => {
  const d = String(district || '').trim()
  const a = String(areaDesc || '').trim()
  return [d && !a.includes(d) ? d : '', a].filter(Boolean).join(' · ')
}

/** 小院主理人卡的几行：称呼 / 年龄 / 籍贯 / 擅长，只放填了的（员工端、后台手填） */
export const hostFacts = (host) => {
  const h = host || {}
  return [['称呼', h.name], ['年龄', h.age], ['籍贯', h.hometown], ['擅长', h.skills]]
    .map(([k, v]) => [k, String(v == null ? '' : v).trim()]).filter(([, v]) => v).map(([k, v]) => ({ k, v }))
}

/** 「出行参考」卡的几行：优点 / 缺点 / 机场 / 高铁，只放填了的；一行都没有时页面整张卡不显示。
 *  这是员工手填的文字（主人拍板不接大模型），卡片上不写 AI */
export const travelRows = (travel) => {
  const t = travel || {}
  return [['优点', t.pros], ['缺点', t.cons], ['机场', t.airport], ['高铁', t.rail]]
    .map(([k, v]) => [k, String(v == null ? '' : v).trim()]).filter(([, v]) => v).map(([k, v]) => ({ k, v }))
}

/** 评分写成一位小数（4 → 「4.0」）；没有分时返回 '' */
export const scoreText = (v) => (v != null && v !== '' && Number(v) > 0 ? Number(v).toFixed(1) : '')

/** 进预订页的参数：带 roomTypeId 时直接打开所选房型的房态日历。 */
export const bookingQuery = ({ stayId, roomTypeId, promoId, vlogId }) => {
  const q = ['stayId=' + stayId]
  if (roomTypeId) q.push('roomTypeId=' + roomTypeId)
  if (promoId) q.push('promoId=' + promoId)
  if (vlogId) q.push('vlogId=' + vlogId)
  return q.join('&')
}
