// 岗位详情改版（2026-10-18，主人效果图 41「门店页」）：线下岗位（换宿旅行 / 兼职 / 全职）详情页用的小函数。
// 不碰 vue / uni，node 测试里能直接 import；只在 pages/jobs 分包里用，不进主包。
// 数据来自 GET /app/job/{jobId}：岗位本身的字段 + data.storePage（门店资料：采访方式、采访视频、店长、该店亮点、交通参考、营业执照、店里日常；
// 后台没填的项服务端已用这家店的小院资料兜底）。老服务端没有 storePage（或为 null）时一律按「没有」处理，页面照样能看。
//
// 口径（主人 10-18 拍板）：只有两种门店——「袋鼠实地探访（+保险）」和「袋鼠线上采访」；实地探访 == 安心商家认证（safe_cert='0'）。
// 只显示接口给的真实数据：没有的块整块不出，不编评分、不写「无押金 / 无中介费」这类门店没承诺过的话。

/** 头图左上角角标：实地探访 + 含保险 → assured（经袋鼠实地拍摄并含保险）；只有实地探访 → onsite；线上采访 → online；都没有 → ''（不挂） */
export const BADGE_TEXT = { assured: '经袋鼠实地拍摄并含保险', onsite: '经袋鼠实地探访', online: '经袋鼠线上采访' }

/** 该店亮点代码 → 图标（common/icons.js 里已有的，不往主包加图标）；文字以接口给的 label 为准 */
export const FACILITY_ICON = {
  gym: 'activity', pool: 'waves-ladder', ebike: 'bike', parking: 'car', cook: 'cooking-pot', lounge: 'coffee',
  wifi: 'wifi', ac: 'wind', washer: 'shirt', study: 'book-open', bath: 'bath'
}
export const FACILITY_LABEL = {
  gym: '健身房', pool: '游泳池', ebike: '电动车可用', parking: '免费停车', cook: '可做饭', lounge: '公共休闲区',
  wifi: '无线网络', ac: '空调', washer: '洗衣机', study: '学习室', bath: '独立卫浴'
}

export const TRAVEL_NOTE = '仅供参考，出行前请核对实时班次'
export const INTERVIEW_CAPTION = {
  onsite: '袋鼠工作人员线下实拍，店长讲清工作、食宿与真实氛围',
  online: '袋鼠工作人员视频连线店长，讲清工作、食宿与真实氛围'
}
export const INTERVIEW_CHIP = { onsite: '已完成线下实地核验', online: '已完成线上视频采访' }
export const MODE_TEXT = { onsite: '袋鼠实地探访', online: '袋鼠线上采访' }

const str = (v) => (v == null ? '' : String(v).trim())
const MODES = ['onsite', 'online']

/** storePage 原样数据 → 页面用的干净对象；null / 缺字段 / 类型不对都兜成「没有」 */
export function normalizeStorePage(sp) {
  const p = sp && typeof sp === 'object' ? sp : {}
  const mode = MODES.includes(p.interviewMode) ? p.interviewMode : ''
  const iv = p.interview && typeof p.interview === 'object' ? p.interview : null
  const m = p.manager && typeof p.manager === 'object' ? p.manager : null
  const t = p.travel && typeof p.travel === 'object' ? p.travel : {}
  const seconds = iv && Number(iv.seconds) > 0 ? Math.round(Number(iv.seconds)) : 0
  return {
    present: !!(sp && typeof sp === 'object'),
    interviewMode: mode,
    interview: mode && iv && str(iv.video) ? { video: str(iv.video), cover: str(iv.cover), seconds, note: str(iv.note) } : null,
    manager: m ? {
      name: str(m.name), avatar: str(m.avatar), years: str(m.years), skills: str(m.skills), quote: str(m.quote),
      rating: m.rating != null && m.rating !== '' && Number.isFinite(Number(m.rating)) && Number(m.rating) > 0 ? Number(m.rating) : null
    } : null,
    facilities: (Array.isArray(p.facilities) ? p.facilities : [])
      .map((f) => (typeof f === 'string' ? { code: f } : f || {}))
      .map((f) => ({ code: str(f.code), label: str(f.label) || FACILITY_LABEL[str(f.code)] || '' }))
      .filter((f) => f.code && f.label),
    travel: { rail: str(t.rail), airport: str(t.airport), cost: str(t.cost) },
    licenseImage: str(p.licenseImage),
    dailyImages: (Array.isArray(p.dailyImages) ? p.dailyImages : []).map(str).filter(Boolean)
  }
}

/**
 * 采访方式：以 storePage.interviewMode 为准；老服务端没有 storePage 时按安心商家认证推（认证 == 去现场拍过 == 实地探访），没认证就当没采访。
 * 线上任务永远没有。
 */
export function interviewMode({ isOnline, storePage, safeCertified }) {
  if (isOnline) return ''
  const sp = normalizeStorePage(storePage)
  if (sp.present) return sp.interviewMode
  return safeCertified ? 'onsite' : ''
}

/** 头图角标用哪一种（job-badge 的 variant）；'' = 不挂 */
export function heroVariant({ isOnline, mode, insured }) {
  if (isOnline) return ''
  if (mode === 'onsite') return insured ? 'assured' : 'onsite'
  if (mode === 'online') return 'online'
  return ''
}

/** 采访视频卡：{url, cover, title, caption, chip}；没有视频（或没采访）返回 null，整张卡不出 */
export function interviewCard(sp, mode) {
  const p = normalizeStorePage(sp)
  const iv = p.interview
  if (!iv || !MODES.includes(mode)) return null
  const kind = mode === 'onsite' ? '实地采访' : '线上采访'
  const minutes = iv.seconds ? Math.max(1, Math.round(iv.seconds / 60)) : 0
  return {
    url: iv.video,
    cover: iv.cover,
    title: minutes ? minutes + '分钟' + kind : kind + '视频',
    caption: iv.note || INTERVIEW_CAPTION[mode],
    chip: INTERVIEW_CHIP[mode]
  }
}

/** 顶部照片：两张以上 = 左边大图 + 右边最多 4 格（多出来的在最后一格写 +N）；一张 = 整幅 */
export function heroLayout(images) {
  const list = (images || []).filter(Boolean)
  if (list.length < 2) return { main: list[0] || '', grid: [], more: 0 }
  const grid = list.slice(1, 5).map((src, i) => ({ src, index: i + 1 }))
  return { main: list[0], grid, more: Math.max(0, list.length - 5) }
}

/** 标题下的一行：换工类型（没有就用岗位标签）| 食宿（有奖金 / 满月红包时 +奖金）| 还招 N 人 / 不能报名的短原因 */
export function tagLine(d, { kindLabel = '', board = '', bonus = false, status = '' } = {}) {
  const kind = kindLabel || ((d && d.tags) || []).filter(Boolean).slice(0, 2).join(' / ')
  const boardPart = board ? board + (bonus ? '+奖金' : '') : (bonus ? '有奖金' : '')
  return [kind, boardPart, status].map(str).filter(Boolean)
}

/** 整段文字 → 一条条（按换行拆，去掉原文自带的「·」「-」等项目符号） */
export function bullets(text) {
  return String(text || '').split(/\r?\n/).map((line) => line.trim().replace(/^[·•\-*]\s*/, '')).filter(Boolean)
}

/** 要求卡：换宿旅行叫「换工要求」、写性别；兼职 / 全职叫「岗位要求」、不写性别（招聘写性别有就业歧视风险）。什么都没有返回 null */
export function requirementCard(d, gender = '') {
  const volunteer = d && d.jobType === 'volunteer'
  const rows = []
  if (volunteer && gender) rows.push({ k: d.genderMaleCount != null && d.genderFemaleCount != null ? '招募计划' : '性别', v: gender })
  for (const line of bullets(d && d.requirement)) rows.push({ k: '', v: line })
  return rows.length ? { title: volunteer ? '换工要求' : '岗位要求', rows } : null
}

/**
 * 一条要求 / 一行工作内容 → { k, v }（2026-11-03 主人：「文字都加粗不要有冒号」）：门店写的「年龄：18周岁以上」「前台：接待客人」，
 * 冒号前那几个字是 k（页面上加粗，后面空一点再接 v，不写冒号）。已经有 k 的（性别）原样返回。
 * 冒号前要是 1–6 个字、不带数字和标点才拆：「9:00 到岗」「早上9:30开门」「注意，周末：要早起」都不拆，整句原样。
 */
export function labelRow(row) {
  const r = typeof row === 'string' ? { k: '', v: row } : (row || { k: '', v: '' })
  if (r.k) return r
  const m = /^([^：:，,。、；;\s\d]{1,6})[：:]\s*(.+)$/.exec(String(r.v || ''))
  return m ? { k: m[1], v: m[2] } : { k: '', v: String(r.v || '') }
}

/**
 * 工作内容的一行 → { k, v }：「按模板帮我写」写出来的是「4. 休息安排：做五休二。」，前面已经有圆点，序号去掉；
 * 再按 labelRow 把「休息安排」拆成加粗标签、不写冒号。「1.5 小时」这种小数不当序号
 */
export function workRow(line) {
  return labelRow(String(line || '').replace(/^\d{1,2}[.．、](?!\d)\s*/, ''))
}

/**
 * 要求统一横排，保留填写顺序和完整内容，不再按字数拆成两种版式。
 * 旧岗位有「性格活泼开朗」这种无冒号写法，仅在要求区识别这个明确前缀。
 */
export function requirementLayout(rows) {
  return (rows || []).map(row => {
    const r = labelRow(row)
    if (r.k) return r
    const legacy = /^性格\s*([^：:\s][\s\S]*)$/.exec(r.v)
    return legacy ? { k: '性格', v: legacy[1] } : r
  })
}

/** startDate（2026-10-22T00:00:00.000+08:00）→ 2026-10-22；直接取字符串，不经 new Date（时区会让日期偏一天） */
export function ymd(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''))
  return m ? m[1] + '-' + m[2] + '-' + m[3] : ''
}

/** 列表、详情和报名按钮共用剩余名额；兼容尚未返回 remainingCount 的旧接口。 */
export function remainingHeadcount(d) {
  if (!d) return null
  if (d.remainingCount != null && Number.isFinite(Number(d.remainingCount))) return Math.max(0, Number(d.remainingCount))
  if (d.headcount == null || !Number.isFinite(Number(d.headcount))) return null
  const used = d.jobType === 'volunteer' && d.reservedCount != null ? d.reservedCount : d.hiredCount
  return Math.max(0, Number(d.headcount) - (Number(used) || 0))
}

/** 三栏：招募信息（剩余人数） | 到岗时间 | 最短期限；满员仍显示 0人。 */
export function statStrip(d) {
  const x = d || {}
  const left = remainingHeadcount(x)
  const head = left == null ? '' : left + '人'
  const days = Number(x.minDays) > 0 ? Number(x.minDays) + '天起' : str(x.minDaysText)
  return [
    { k: '招募信息', v: head },
    { k: '到岗时间', v: ymd(x.startDate) },
    { k: '最短期限', v: days }
  ].filter((r) => r.v)
}

/**
 * 工作时间：每日时长 + 休息排班（做五休二 · 门店写的排班说明 · 上班时段）；都没有返回 null。
 * rest 是连在一起的一整句（兼职 / 全职「排班与工时」小字用）；mode 是排班档位（做五休二）、note 是门店写的排班说明 + 上班时段，
 * 换宿旅行右边那一窄栏只把 hours / mode 写成大字，note 小字另起一行（2026-10-19：之前整句大字挤在 116px 里折成四五行，参考图只有「每日4小时」「上2休1」两行大字）
 */
export function workTime(d) {
  const x = d || {}
  const rawHours = str(x.dailyHours)
  const hours = /^\d+(\.\d+)?$/.test(rawHours) ? `每天 ${rawHours} 小时` : rawHours
  const mode = str(x.restModeLabel)
  const note = [x.shiftDesc, x.shiftTime].map(str).filter(Boolean).join(' · ')
  const rest = [mode, note].filter(Boolean).join(' · ')
  return hours || rest ? { hours, rest, mode, note } : null
}

/**
 * 福利卡：换宿旅行勾了「做满一个月有红包」叫「做满一个月福利」，没勾叫「福利待遇」；兼职 / 全职叫「工作待遇」（2026-10-18 主人：兼职、全职详情「岗位要求」「工作待遇」）。
 * highlights（上面两个浅底格子）：食宿说明、薪资待遇；items（下面的小点）：住宿条件、满月红包、奖金、提成、结算、全职的试用期 / 培训、保险（只有含保险才写）。
 * 只写门店填了的；一项都没有返回 null。
 */
export function welfareCard(d, { board = '', redpacket = false, insured = false } = {}) {
  const x = d || {}
  const highlights = [...new Set([board, str(x.compensationText) || str(x.salaryText)].filter(Boolean))]
  const items = []
  const room = str(x.roomTypeLabel)
  const boardText = highlights.join(' ').replace(/\s/g, '')
  if (room && !boardText.includes(room.replace(/\s/g, ''))) items.push('住宿：' + room)
  // 餐补（V66，只有不包吃的岗位才有）：服务端读的时候已按食宿收口，老服务端没有这个字段时不写
  if (str(x.mealAllowanceText)) items.push('餐补：' + str(x.mealAllowanceText))
  if (redpacket) items.push('做满一个月发放满月红包')
  if (str(x.bonusDesc)) items.push('奖金：' + str(x.bonusDesc))
  if (str(x.commissionDesc)) items.push('提成：' + str(x.commissionDesc))
  if (str(x.settleDesc)) items.push('结算：' + str(x.settleDesc))
  // 全职：试用期、培训（2026-10-18 商家端发布表开始填 kg_job.probation / train_desc，填了才写）
  if (x.jobType === 'fulltime' && str(x.probation)) items.push('试用期：' + str(x.probation))
  if (x.jobType === 'fulltime' && str(x.trainDesc)) items.push('培训：' + str(x.trainDesc))
  if (insured) items.push('平台统一购买意外险')
  // /app/job 将后台逗号分隔的福利转换成数组；兼容旧接口的字符串，原样保留门店承诺。
  const configured = Array.isArray(x.benefits) ? x.benefits : typeof x.benefits === 'string' ? x.benefits.split(/[,，\n]/) : []
  for (const benefit of configured) {
    const text = typeof benefit === 'string' ? benefit.trim() : ''
    if (text && !highlights.includes(text) && !items.includes(text)) items.push(text)
  }
  if (!highlights.length && !items.length) return null
  const title = x.jobType === 'volunteer' ? (redpacket ? '做满一个月福利' : '福利待遇') : (x.jobType === 'parttime' || x.jobType === 'fulltime' ? '工作待遇' : '福利待遇')
  return { title, highlights, items }
}

const pathList = (v) => (Array.isArray(v) ? v : []).map(str).filter(Boolean)

/** 住宿展示：换宿或包住宿的岗位保留展示区；未上传素材时由页面说明。旧接口有素材仍可展示。 */
export function lodgingCard(d) {
  const x = d || {}
  if (x.jobType === 'online') return null
  const images = pathList(x.lodgingImages)
  const video = str(x.lodgingVideo)
  const providesLodging = x.jobType === 'volunteer' || ['all', 'room'].includes(x.boardType)
  if (!images.length && !video && !providesLodging) return null
  return { images, video, cover: video ? str(x.lodgingVideoCover) : '' }
}

/** 店里的宠物（V66，只给换工，服务端已收口）：没填返回 null，整块不出；没有 / 有 各写一句，有的话带照片 */
export function petCard(d) {
  const x = d || {}
  if (x.petStatus === 'none') return { text: '店里没有宠物', images: [] }
  if (x.petStatus === 'yes') return { text: '店里有宠物', images: pathList(x.petImages) }
  return null
}

/**
 * 图格的格子：视频（有的话）放第一格，没有封面就是深色底 + 播放钮（不拿第一张照片顶，紧挨着重复一张不好看）；最多 6 格，放不下的在最后一格写 +N。
 * index 是这张照片在照片列表里的位置，点开大图从这张开始
 */
export function mediaCells({ images, video = '', cover = '' }, max = 6) {
  const list = images || []
  const cells = []
  if (video) cells.push({ key: 'video', video: true, src: cover || '', index: -1, more: 0 })
  const room = max - cells.length
  list.slice(0, room).forEach((src, index) => cells.push({ key: src + index, video: false, src, index, more: 0 }))
  const hidden = list.length - Math.min(room, list.length)
  if (hidden > 0) cells[cells.length - 1].more = hidden
  return cells
}

/** 换宿福利两栏：食宿/奖励与结算/保障分开，避免 CSS 分栏把同一条说明截在两边。 */
export function volunteerWelfareColumns(card, boardType = '') {
  if (!card) return []
  const benefits = [], service = []
  for (const item of card.items) {
    // 保留门店填写的奖励条件，避免把同一份满月红包在小卡里重复展示。
    if (item === '做满一个月发放满月红包' && card.items.some(text => /^奖金：/.test(text) && text.includes('满月红包'))) continue
    if (/^结算：|^平台统一购买意外险$/.test(item)) service.push(item)
    else benefits.push(item)
  }
  const hasSettlement = service.some(item => item.startsWith('结算：'))
  const hasInsurance = service.includes('平台统一购买意外险')
  const boardTitle = boardType === 'all' || (!boardType && ['包吃包住', '包吃住'].includes(card.highlights[0]))
    ? '包吃住' : card.highlights[0] || '岗位福利'
  return [
    { title: boardTitle, items: [...card.highlights.slice(1), ...benefits] },
    { title: hasSettlement && hasInsurance ? '结算与保障' : hasInsurance ? '保险保障' : '结算说明', items: service }
  ].filter((column, index) => column.items.length || (index === 0 && card.highlights.length))
}

/** 店长卡：名字 / 头像 / 年限 / 擅长 / 店长说 一样都没有返回 null；评分没有时不写（不编） */
export function managerCard(sp) {
  const m = normalizeStorePage(sp).manager
  if (!m || !(m.name || m.avatar || m.years || m.skills || m.quote)) return null
  return { ...m, ratingText: m.rating != null ? m.rating.toFixed(1) : '' }
}

/** 该店亮点格子：[{code, label, icon}] */
export function facilityGrid(sp) {
  return normalizeStorePage(sp).facilities.map((f) => ({ ...f, icon: FACILITY_ICON[f.code] || 'sparkles' }))
}

/** 交通参考：高铁 / 机场两行（填了才有）+ 预估最低出行成本 */
export function travelInfo(sp) {
  const t = normalizeStorePage(sp).travel
  const rows = [{ k: '高铁', v: t.rail }, { k: '机场', v: t.airport }].filter((r) => r.v)
  return { rows, cost: t.cost }
}

/** 用户反馈：门店评价（已经拉过的 /app/stores/{id}/reviews）里前 2 条有文字的；没有返回 [] */
export function feedbackLines(list) {
  return (list || []).map((r) => str(r && r.content)).filter(Boolean).slice(0, 2)
}

/** 门店综合分的写法：一位小数（4 →「4.0」）；没有分（null / 0 / 不是数）返回 ''。岗位详情「用户反馈」、门店卡片、「查看全部」商家评价页都用它，同一家店写出来是同一个数 */
export const scoreText = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v).toFixed(1) : '')

/** 岗位类型 → 评价筛选（/app/stores/{id}/reviews?filter=…，和「查看全部」商家评价页的筛选胶囊同名）：岗位页只看同类岗位的评价，不混住宿客人的 */
export const REVIEW_KIND = { volunteer: '换工', parttime: '兼职', fulltime: '全职' }

/**
 * 「用户反馈」那一块（2026-10-18 主人：去掉顶上「岗位信息 / 评价」页签，评价就放在页面里）：
 * 这家店同类岗位的真实评价（/app/stores/{id}/reviews?filter=换工 / 兼职 / 全职，见 REVIEW_KIND；点「查看全部」进商家评价页带同一个筛选，
 * 同一批、同一个顺序）→ 综合分、条数，加前 3 条评价（头像、昵称、驻店天数、日期、星级、正文；只打了分没写字的也算一条，写「只打了分」）。
 * 没有评价时 count = 0、items 为空。
 * 综合分用服务端算好的这一批的平均（filteredAvg，保留一位小数）、条数用 filteredTotal：和「查看全部」页顶上的分、门店卡片是同一个数。
 * 2026-10-19 复查：之前用岗位评价五个分项（jobDims）的平均，同一家店这里写 4.2、唯一一条评价是 4 星、点进去又是 4.0；
 * 后来改成不带筛选又把住宿客人「房间很干净」这类评价也放上了招人的岗位页。老服务端没有 filteredAvg / filteredTotal 时退回 avg / count
 */
export function reviewDigest(rv, { limit = 3 } = {}) {
  const x = rv || {}
  const avgText = scoreText(x.filteredAvg !== undefined ? x.filteredAvg : x.avg)
  const avg = avgText ? Number(avgText) : null
  const list = Array.isArray(x.list) ? x.list : []
  const count = Number(x.filteredTotal !== undefined ? x.filteredTotal : x.count) || list.length
  const items = list.slice(0, limit).map((r, i) => {
    const rating = r && r.rating != null && r.rating !== '' ? Math.max(0, Math.min(5, Number(r.rating) || 0)) : null
    return {
      key: (r && r.reviewId) || 'r' + i,
      name: str(r && r.name) || '伙伴', avatar: str(r && r.avatar),
      days: Number(r && r.stayDays) > 0 ? '驻店 ' + Number(r.stayDays) + ' 天' : '',
      date: str(r && r.date), rating, stars: rating == null ? 0 : Math.round(rating),
      text: str(r && r.content) || '只打了分，没有写文字'
    }
  })
  return { avg, avgText, count, goodRate: str(x.jobGoodRate), items }
}

/** 店里日常：门店资料里的照片（服务端已用小院生活碎片兜底），再没有就用岗位照片；最多 9 张 */
export function dailyPhotos(sp, jobImages) {
  const own = normalizeStorePage(sp).dailyImages
  return (own.length ? own : (jobImages || []).filter(Boolean)).slice(0, 9)
}

/** 袋鼠安心保障：保险保障（含保险才有）、门店资质（传了营业执照才有，点了看执照）、平台协助（一直有） */
export function assuranceRows({ insured, licenseImage }) {
  const rows = []
  if (insured) rows.push({ key: 'insurance', k: '保险保障', v: '本岗位由袋鼠平台统一购买意外险' })
  if (licenseImage) rows.push({ key: 'license', k: '门店资质', v: '门店已提供营业执照', link: '查看营业执照' })
  rows.push({ key: 'help', k: '平台协助', v: '服务期间遇到问题，可联系袋鼠平台协调处理' })
  return rows
}

/** 门店卡副标题：平台审核岗位 · 袋鼠实地探访 / 袋鼠线上采访（没采访只写前半句） */
export function storeSubline(mode) {
  return ['平台审核岗位', MODE_TEXT[mode] || ''].filter(Boolean).join(' · ')
}
