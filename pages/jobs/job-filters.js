// 岗位列表的筛选条件（2026-10-16 第二轮改版，对照效果图 23）：四个页签各有一组条件，选了的条件在「筛选▾」后面列成可去掉的胶囊。
// 参数名和取值与后端 GET /app/job/list 约定一致（cities / gender / restModes / roomTypes / skills / minStay / assured，
// 2026-10-17 起兼职 / 全职另有 board / payDay / payMonthMin / payMonthMax / categories；老的 workKind / salaryMin / salaryMax / train / skill 后端照旧认）。
// 只在 jobs 分包里用，不进主包。
//
// 口径（主人 10-16 拍板）：
//   · 性别偏好只给换宿旅行：选「女」看「只要女生」和「男女不限」的岗位；「男女不限」等于不筛。兼职、全职不提供（招聘写性别有就业歧视风险）。
//   · 技能、休息排班、住宿条件门店可以不填；没填的岗位不算符合这些条件。技能多选，命中任一个就算。
//   · 在店时长 = 「我能待 N 天」，只看最短在店天数不超过 N 的岗位（老的 minStay 口径）。
//   · 安心保障 = 门店已通过安心商家认证并且岗位含保险，线上任务没有。
// 2026-10-17 主人反馈：每个页签自己一套条件，城市在胶囊行和选城市面板里单独选，面板里不再有「已选城市」那一行：
//   · 换宿旅行：性别 / 技能 / 排班 / 时长 / 住宿 / 保障 / 换工类型（和之前一样，组名缩成两个字，去掉说明小字）；
//   · 兼职旅行：食宿 + 日薪三档（80 / 100 / 120 元/天以上，按岗位起薪折成日薪比）；
//   · 全职旅行：类型（民宿 / 酒店 / 咖啡餐饮 / 酒吧 / 其他，后端按门店名 + 岗位标题归类）+ 食宿 + 月薪三档（3000以下 / 3000–5000 / 5000以上）；
//   · 线上任务：任务类型；
//   · 换页签时，新页签用不上的条件清掉，用得上的（兼职 ↔ 全职的食宿）带过去，城市照旧共用（见 filterForTab）。

export const TYPES = ['volunteer', 'parttime', 'fulltime', 'online']
export const TYPE_NAMES = { volunteer: '换工旅行', parttime: '兼职旅行', fulltime: '全职旅行', online: '线上任务' }
export const MAX_CITIES = 5
// 技能最多选几个（后端 AppJobController.MAX_SKILLS 也是 8，多了会被拒）
export const MAX_SKILLS = 8
export const ASSURED_LABEL = '经袋鼠实地拍摄并含保险'

// [显示文字, 参数值]
export const GENDER_OPTS = [['男', 'M'], ['女', 'F'], ['男女不限', '']]
// 技能的参数值是后端技能词典 KgSkills 的标签：选「拍摄」传「摄影」，摄影 / 拍照 / 拍摄 / 相机这些写法的岗位都算
export const SKILL_BASE = [['会做饭', '做饭'], ['拍摄', '摄影'], ['开车', '开车'], ['玩游戏', '玩游戏']]
export const SKILL_MORE = [['咖啡制作', '咖啡制作'], ['拉花', '拉花'], ['视频剪辑', '视频剪辑'], ['门店服务', '门店服务'], ['收银接待', '收银接待'], ['社群运营', '社群运营'], ['活动策划', '活动策划'], ['内容创作', '内容创作'], ['手作', '手作'], ['烘焙', '烘焙'], ['教学讲解', '教学讲解'], ['外语', '外语'], ['民宿管家', '民宿管家']]
export const REST_OPTS = [['做一休一', '1-1'], ['做四休三', '4-3'], ['做二休一', '2-1'], ['做五休二', '5-2'], ['做三休二', '3-2'], ['做三休一', '3-1'], ['做六休一', '6-1']]
// 2026-10-17：「最少一周」读起来像岗位的要求，其实是「我能待多久」，选项直接写「能待…」，不再要下面那行说明
export const STAY_OPTS = [['能待一周', 7], ['能待半个月', 15], ['能待20天', 20], ['能待一个月', 30]]
export const BATH_OPTS = [['不限',''],['独卫','private'],['公卫','shared']]
export const ROOM_OPTS = [['单人间', 'single'], ['双人间', 'double'], ['三人间', 'triple'], ['多人间', 'multi']]
// 食宿（兼职、全职）：包住 / 包吃都含包吃包住；不包食宿 = 门店没写食宿（后端 JobTabFilters.BOARDS，self 是 2026-10-17 新加的）
export const BOARD_OPTS = [['包吃包住', 'all'], ['包住', 'room'], ['包吃', 'meal'], ['不包食宿', 'self']]
// 兼职「日薪」三档（主人：薪资 80、100、120 三个档即可）：参数 payDay = 起薪折成元/天后不低于它（时薪 × 8、周薪 ÷ 5、月薪 ÷ 21.75）
export const PAY_DAY_OPTS = [['80元/天以上', 80], ['100元/天以上', 100], ['120元/天以上', 120]]
// 全职「月薪」三档 [文字, 下限（含）, 上限]，0 = 不限；4500 为含边界，3000 为不含边界。保留用户指定的三档，4500–5000 的岗位在不限薪资时仍可见
export const PAY_MONTH_OPTS = [['3000以下', 0, 3000], ['3000–4500', 3000, 4500], ['5000以上', 5000, 0]]
// 全职「类型」：门店 / 岗位没有业态字段，后端按门店名 + 岗位标题里的词归类（JobTabFilters.CATEGORY_WORDS），「其他」= 哪一类都不是
export const CATEGORY_OPTS = [['民宿', 'homestay'], ['酒店', 'hotel'], ['咖啡餐饮', 'food'], ['酒吧', 'bar'], ['其他', 'other']]
// 线上任务的任务类型：后端按门店发布时选的类型精确匹配（选「其他」时没有类型的老任务也算），和员工发布任务时的类型同一组
export const TASK_OPTS = ['内容写作', '图片设计', '视频剪辑', '社群运营', '数据整理', '其他']

// 每个页签的条件组（顺序就是面板里的顺序）
export const GROUPS = {
  volunteer: ['gender', 'skills', 'restModes', 'minStay', 'roomTypes', 'bathroom', 'assured', 'workKind'],
  parttime: ['board', 'payDay'],
  fulltime: ['categories', 'board', 'payMonth'],
  online: ['task']
}
// 组名一律两个字（2026-10-17 主人：筛选排得乱）：左边组名一列等宽，右边选项对齐；「日薪 / 月薪」本身就说明了按什么比
export const TITLES = { bathroom:'卫浴条件', gender: '性别偏好', skills: '技能需求', restModes: '休息排班', minStay: '可停留时长', roomTypes: '住宿条件', assured: '安心保障', workKind: '换工类型', board: '食宿条件', payDay: '日薪（元/天）', payMonth: '月薪（元/月）', categories: '店铺类型', task: '任务类型' }
// 多选组；其余是单选（再点一次取消）
const MULTI = ['skills', 'restModes', 'roomTypes', 'categories']
const TEXT_ONE = ['bathroom', 'gender', 'workKind', 'board', 'task']
const NUM_ONE = ['minStay', 'payDay', 'payMonth']
const FLAGS = ['assured']

export const blankFilter = () => ({ cities: [], bathroom:'', gender: '', skills: [], restModes: [], minStay: 0, roomTypes: [], assured: false, workKind: '', board: '', payDay: 0, payMonth: 0, categories: [], task: '' })
export const cloneFilter = (f) => {
  const out = { ...blankFilter(), ...f }
  for (const k of ['cities', ...MULTI]) out[k] = [...((f && f[k]) || [])]
  return out
}

export const skillOpts = (type) => (type === 'volunteer' ? SKILL_BASE : SKILL_BASE.concat(SKILL_MORE))
const labelOf = (opts, v) => (opts.find(o => o[1] === v) || [''])[0]
const has = (type, key) => (GROUPS[type] || []).includes(key)

/**
 * 换页签（2026-10-17）：只留新页签用得上的条件，别的清掉；城市照旧带着（三个到店页签共用，线上任务不用但留着，切回来还在）。
 * 兼职 ↔ 全职的「食宿」两边都有，带过去；薪资两边档位不同（日薪 / 月薪），各是各的，不带
 */
export function filterForTab(type, f) {
  const out = blankFilter()
  out.cities = [...((f && f.cities) || [])]
  for (const key of GROUPS[type] || []) {
    if (!f || f[key] === undefined) continue
    out[key] = Array.isArray(f[key]) ? [...f[key]] : f[key]
  }
  return out
}

/** 当前页签用到的条件 → /app/job/list 的参数（不用的组、空值都不带） */
export function filterParams(type, f) {
  const p = {}
  if (type !== 'online' && f.cities && f.cities.length) p.cities = f.cities.slice(0, MAX_CITIES).join(',')
  if (has(type, 'gender') && f.gender) p.gender = f.gender
  if (has(type,'bathroom') && f.bathroom) p.bathroom=f.bathroom
  if (has(type, 'skills') && f.skills.length) p.skills = f.skills.join(',')
  if (has(type, 'restModes') && f.restModes.length) p.restModes = f.restModes.join(',')
  if (has(type, 'minStay') && f.minStay) p.minStay = f.minStay
  if (has(type, 'roomTypes') && f.roomTypes.length) p.roomTypes = f.roomTypes.join(',')
  if (has(type, 'assured') && f.assured) p.assured = 1
  if (has(type, 'workKind') && f.workKind) p.workKind = f.workKind
  if (has(type, 'categories') && f.categories.length) p.categories = f.categories.join(',')
  if (has(type, 'board') && f.board) p.board = f.board
  if (has(type, 'payDay') && f.payDay > 0) p.payDay = f.payDay
  if (has(type, 'payMonth') && f.payMonth > 0) {
    const o = PAY_MONTH_OPTS[f.payMonth - 1]
    if (o) { if (o[1]) p.payMonthMin = o[1]; if (o[2]) p.payMonthMax = o[2] }
  }
  if (has(type, 'task') && f.task) p.skill = f.task
  return p
}

/** 选了的条件（城市在最前），一个条件一枚胶囊；key 用来点掉它 */
export function filterChips(type, f, kinds = []) {
  const out = []
  if (type !== 'online') (f.cities || []).forEach(c => out.push({ key: 'city:' + c, text: c }))
  if (has(type,'bathroom') && f.bathroom) out.push({key:'bathroom',text:labelOf(BATH_OPTS,f.bathroom)})
  if (has(type, 'gender') && f.gender) out.push({ key: 'gender', text: '性别：' + labelOf(GENDER_OPTS, f.gender) })
  if (has(type, 'skills')) f.skills.forEach(v => out.push({ key: 'skills:' + v, text: labelOf(skillOpts(type), v) || v }))
  if (has(type, 'restModes')) f.restModes.forEach(v => out.push({ key: 'restModes:' + v, text: labelOf(REST_OPTS, v) || v }))
  if (has(type, 'minStay') && f.minStay) out.push({ key: 'minStay', text: labelOf(STAY_OPTS, f.minStay) || '能待' + f.minStay + '天' })
  if (has(type, 'roomTypes')) f.roomTypes.forEach(v => out.push({ key: 'roomTypes:' + v, text: labelOf(ROOM_OPTS, v) || v }))
  if (has(type, 'categories')) f.categories.forEach(v => out.push({ key: 'categories:' + v, text: labelOf(CATEGORY_OPTS, v) || v }))
  if (has(type, 'board') && f.board) out.push({ key: 'board', text: labelOf(BOARD_OPTS, f.board) || f.board })
  if (has(type, 'payDay') && f.payDay > 0) out.push({ key: 'payDay', text: labelOf(PAY_DAY_OPTS, f.payDay) || f.payDay + '元/天以上' })
  if (has(type, 'payMonth') && f.payMonth > 0) {
    const o = PAY_MONTH_OPTS[f.payMonth - 1]
    if (o) out.push({ key: 'payMonth', text: '月薪 ' + o[0] })
  }
  if (has(type, 'task') && f.task) out.push({ key: 'task', text: f.task })
  if (has(type, 'assured') && f.assured) out.push({ key: 'assured', text: ASSURED_LABEL })
  // 换工类型排在主人那六组（性别偏好、技能需求、休息排班、可停留时长、住宿条件、安心保障）后面，和面板里的顺序一致（2026-10-19）
  if (has(type, 'workKind') && f.workKind) out.push({ key: 'workKind', text: (kinds.find(k => k.value === f.workKind) || {}).label || '换工类型' })
  return out
}

/** 点掉一枚胶囊（key 来自 filterChips） */
export function dropChip(f, key) {
  const at = key.indexOf(':')
  const group = at > 0 ? key.slice(0, at) : key
  const value = at > 0 ? key.slice(at + 1) : ''
  if (group === 'city') f.cities = f.cities.filter(c => c !== value)
  else if (MULTI.includes(group)) f[group] = f[group].filter(v => v !== value)
  else if (TEXT_ONE.includes(group)) f[group] = ''
  else if (NUM_ONE.includes(group)) f[group] = 0
  else if (FLAGS.includes(group)) f[group] = false
}

/** 面板里点一个选项：多选组切换，单选组再点一次取消。技能已经选满 MAX_SKILLS 个时不再加，返回 false */
export function pickOption(f, key, value) {
  if (key === 'skills' && !f.skills.includes(value) && f.skills.length >= MAX_SKILLS) return false
  if (MULTI.includes(key)) {
    f[key] = f[key].includes(value) ? f[key].filter(v => v !== value) : f[key].concat(value)
  } else if (TEXT_ONE.includes(key)) {
    f[key] = f[key] === value ? '' : value
  } else if (NUM_ONE.includes(key)) {
    const n = Number(value) || 0
    f[key] = f[key] === n ? 0 : n
  } else if (FLAGS.includes(key)) {
    f[key] = !f[key]
  }
  return true
}

/** 某个页签有没有选任何条件（城市另算） */
export const anyCondition = (type, f) => Object.keys(filterParams(type, { ...f, cities: [] })).length > 0

// 选项按 3 列等宽排（见 job-filter-panel.vue 的 .fp-opts）。放不放得下按字宽估：汉字算 1 个字宽，数字、字母、符号算半个多一点。
// 超过 LONG_UNITS 的（「100元/天以上」）字号小一号，仍在一格里；超过 WIDE_UNITS 的（「经袋鼠实地拍摄并含保险」、字典里长的换工类型）占满一整行
export const PANEL_COLS = 3
export const LONG_UNITS = 5.2
export const WIDE_UNITS = 6.5
export const textUnits = (s) => [...String(s)].reduce((n, ch) => n + (/[\x20-\x7e]/.test(ch) ? 0.55 : ch === '–' ? 0.6 : 1), 0)
/**
 * 面板里的条件组：[{ key, title, long, options: [{ label, value, on, wide, long }] }]；kinds 是后台字典里的换工类型。
 * 2026-10-17 改版（主人效果图 2）：每组左边一列固定宽度的组名，右边选项按 3 列等宽网格排，折行后对齐到第一个选项下面。
 * 同日主人第二次反馈（「整个筛选排得乱」）：组名一律两个字、不再有说明小字（在店时长写成「能待…」，薪资写成「日薪 / 月薪」），
 * 组和组之间一道浅分隔线；面板里不再有城市那一行
 */
export function panelGroups(type, f, kinds = []) {
  const opt = (label, value, on) => {
    const n = textUnits(label)
    return { label, value: String(value), on, wide: n > WIDE_UNITS, long: n > LONG_UNITS && n <= WIDE_UNITS }
  }
  const out = []
  for (const key of GROUPS[type] || []) {
    let options = []
    if(key==='bathroom') options=BATH_OPTS.map(o=>opt(o[0],o[1],f.bathroom===o[1]))
    else if (key === 'gender') options = GENDER_OPTS.map(o => opt(o[0], o[1], f.gender === o[1]))
    else if (key === 'skills') options = skillOpts(type).map(o => opt(o[0], o[1], f.skills.includes(o[1])))
    else if (key === 'restModes') options = REST_OPTS.map(o => opt(o[0], o[1], f.restModes.includes(o[1])))
    else if (key === 'minStay') options = STAY_OPTS.map(o => opt(o[0], o[1], f.minStay === o[1]))
    else if (key === 'roomTypes') options = ROOM_OPTS.map(o => opt(o[0], o[1], f.roomTypes.includes(o[1])))
    else if (key === 'assured') options = [opt(ASSURED_LABEL, '1', f.assured)]
    else if (key === 'workKind') { if (!kinds.length) continue; options = kinds.map(k => opt(k.label, k.value, f.workKind === k.value)) }
    else if (key === 'categories') options = CATEGORY_OPTS.map(o => opt(o[0], o[1], f.categories.includes(o[1])))
    else if (key === 'board') options = BOARD_OPTS.map(o => opt(o[0], o[1], f.board === o[1]))
    else if (key === 'payDay') options = PAY_DAY_OPTS.map(o => opt(o[0], o[1], f.payDay === o[1]))
    else if (key === 'payMonth') options = PAY_MONTH_OPTS.map((o, i) => opt(o[0], i + 1, f.payMonth === i + 1))
    else if (key === 'task') options = TASK_OPTS.map(t => opt(t, t, f.task === t))
    // long：这一组里有字多的选项，窄屏（< 375）上这一组改成两列，字不再被截成「100元/天…」
    out.push({ key, title: TITLES[key], long: options.some(o => o.long), options })
  }
  return out
}

// 筛选时收起底部导航，面板始终位于安全顶栏下方；只让条件区滚动。
export const H5_SAFE_BOTTOM = 34
export const PANEL_HEAD_H = 56
export const PANEL_CITY_H = 0
export const PANEL_FOOT_H = 100
export const PANEL_GAP = 8
export const PANEL_BOTTOM_GAP = 12

export function panelLayout({ windowHeight, navBottom = 0, safeBottom = 0, online = false }) {
  const top = navBottom + PANEL_GAP
  const chrome = PANEL_HEAD_H + PANEL_FOOT_H
  const safe = Math.max(0, Number(safeBottom) || 0)
  const bodyMax = Math.max(0, Math.floor(windowHeight - safe - PANEL_BOTTOM_GAP - top - chrome))
  return { top, bodyMax, bottom: top + chrome + bodyMax }
}

// 地址里的条件（2026-10-17，每个页签自己那几项）：参数名和 filterQuery 一致，取值只认选项里有的，别的丢掉
const pickList = (raw, opts, max = 8) => [...new Set(String(raw || '').split(',').map(v => v.trim()).filter(v => opts.some(o => o[1] === v)))].slice(0, max)

/**
 * 列表页地址里带的条件：城市（显式筛选链接带 ?city= / ?cities=）+ 这个页签（?type=，不带 = 换宿旅行）自己的条件，
 * 如换工类型 ?kind=、兼职 ?board=room&payDay=100、全职 ?categories=homestay&payMonth=2；别的页签的条件不认。
 * 首页 5 个入口 2026-10-17 起不再把首页（定位）城市带进来（主人：「选择地址的时候默认我在的位置也加到里面了」），
 * 所以不带城市进来就是全部城市，城市只在用户自己选了之后才有
 */
export function filterFromQuery(q = {}) {
  const type = TYPES.includes(q.type) ? q.type : 'volunteer'
  const f = blankFilter()
  // 多选结果（含明确清空）覆盖旧的单城市参数，不能把来源页的城市又合并回来。
  const selected = Object.prototype.hasOwnProperty.call(q, 'cities') ? q.cities : q.city
  const raw = String(selected || '').split(',').map(c => c.trim().slice(0, 16)).filter(c => c && c !== '全部城市')
  f.cities = [...new Set(raw)].slice(0, MAX_CITIES)
  if (/^[a-z0-9_-]{1,32}$/.test(String(q.kind || ''))) f.workKind = String(q.kind)
  if(BATH_OPTS.some(o=>o[1]===q.bathroom))f.bathroom=q.bathroom
  if (GENDER_OPTS.some(o => o[1] && o[1] === q.gender)) f.gender = q.gender
  f.skills = pickList(q.skills, skillOpts(type), MAX_SKILLS)
  f.restModes = pickList(q.restModes, REST_OPTS)
  f.roomTypes = pickList(q.roomTypes, ROOM_OPTS)
  f.categories = pickList(q.categories, CATEGORY_OPTS)
  const stay = Number(q.minStay)
  if (STAY_OPTS.some(o => o[1] === stay)) f.minStay = stay
  if (String(q.assured) === '1') f.assured = true
  if (BOARD_OPTS.some(o => o[1] === q.board)) f.board = q.board
  const day = Number(q.payDay)
  if (PAY_DAY_OPTS.some(o => o[1] === day)) f.payDay = day
  const month = Number(q.payMonth)
  if (month >= 1 && month <= PAY_MONTH_OPTS.length) f.payMonth = month
  if (TASK_OPTS.includes(q.task)) f.task = q.task
  // 只留这个页签用得上的（workKind 不在地址里的页签也会被清掉）
  return filterForTab(type, f)
}

/** 当前页签的条件 → 地址参数（filterFromQuery 认得回来）：type + 城市 + 这个页签选了的条件，空的不带 */
export function filterQuery(type, f) {
  const q = { type }
  const cur = filterForTab(type, f)
  if (type !== 'online' && cur.cities.length) q.cities = cur.cities.slice(0, MAX_CITIES).join(',')
  for (const key of GROUPS[type] || []) {
    const v = cur[key]
    if (Array.isArray(v) ? !v.length : !v) continue
    if (key === 'workKind') q.kind = v
    else if (key === 'assured') q.assured = '1'
    else q[key] = Array.isArray(v) ? v.join(',') : String(v)
  }
  return q
}

/** 地址参数对象 → 「?a=1&b=2」（值做 encodeURIComponent） */
export const queryString = (q) => Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&')

/** 卡片上的「最短 N 天」：后端给数字 minDays，没填（或 ≤ 0）不显示 */
export const minDaysLabel = (n) => (Number(n) > 0 ? '最短' + Number(n) + '天' : '')
/** 「经袋鼠实地拍摄并含保险」：门店已认证（safeCert '0'）且岗位含保险（insuranceFlag '0'），线上任务永远不挂 */
export const isAssured = (j) => !!j && j.jobType !== 'online' && String(j.safeCert) === '0' && String(j.insuranceFlag) === '0'

// ---------------------------------------------------------------------------
// 选城市联想里的景区片区（2026-10-18 主人效果图 42：输入「大理」下面出「大理、大理古城…」）。岗位、门店按城市名存，
// 片区只是方便搜：选「大理古城」等于选「大理」。只收常去的换宿目的地，城市名和城市字典 / 岗位上的写法一致
// ---------------------------------------------------------------------------
export const SCENIC_AREAS = [
  ['大理古城', '大理'], ['双廊', '大理'], ['喜洲古镇', '大理'], ['洱海', '大理'],
  ['丽江古城', '丽江'], ['束河古镇', '丽江'], ['泸沽湖', '丽江'], ['玉龙雪山', '丽江'],
  ['平潭岛', '平潭'], ['鼓浪屿', '厦门'], ['西湖', '杭州'], ['千岛湖', '杭州'],
  ['涠洲岛', '北海'], ['莫干山', '湖州'], ['乌镇', '嘉兴']
]
/** 输入的词能联想到的景区片区：[{ name: '大理古城', city: '大理' }]，片区名或所属城市名里带这个词的都算，最多 6 个 */
export function scenicSuggest(q) {
  const k = String(q || '').trim()
  if (!k) return []
  return SCENIC_AREAS.filter(([name, city]) => name !== city && (name.includes(k) || city.includes(k))).slice(0, 6).map(([name, city]) => ({ name, city }))
}
