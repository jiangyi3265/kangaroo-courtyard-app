// 商家需求（V63）的页面规则：换工主理人「线上任务审核」、商家服务人、城市负责人三个角色的页面共用。
// 纯函数，不碰 vue / uni，node 测试直接 import；放在 staff 分包里，不占主包。
// 状态文字一律用服务端给的 statusLabel / typeLabel，这里只决定分组、按钮和提示。

export const INTAKE_PAGE = '/pages/staff/intake'
export const SERVICE_PAGE = '/pages/staff/service'
export const CITY_PAGE = '/pages/staff/city'
export const CITY_FINANCE_PAGE = '/pages/staff/city-finance'
export const SERVICE_ACTIVITIES_PAGE = '/pages/staff/service-activities'
export const ONLINE_DAILY_PAGE = '/pages/staff/online-daily'
// 活动页直接进创建屏（工作台「发布 · 活动」、商家首页「发布活动」）；s=2 让页面一打开就是表单，create=1 让它按新建填默认值
export const ACTIVITY_CREATE_PAGE = '/pages/staff/activities?s=2&create=1'

export const INTAKE_API = '/app/staff/intake'
export const MERCHANT_JOBS_API = '/app/staff/merchant-jobs'
export const SERVICE_API = '/app/staff/service/requests'
export const CITY_API = '/app/staff/city/requests'
export const CITY_OVERVIEW_API = '/app/staff/city/overview'
export const CITY_FINANCE_API = '/app/staff/city-finance'
export const SERVICE_ACTIVITIES_API = '/app/staff/service/activities'
export const ONLINE_DAILY_API = '/app/staff/daily/online'

// 小院主理人开了「兼任商家服务人」时显示的角色文字
export const ALSO_SERVICE_ROLE = '小院主理人 + 商家服务人'
/** 门店切换页、工作台的角色文字：兼任的写两个，其余用服务端给的 roleName */
export const roleTextOf = (g) => (g && g.alsoService === true ? ALSO_SERVICE_ROLE : (g && g.roleName) || '')

export const INTAKE_TABS = [
  { status: 'pending_verify', label: '待核实' }, { status: 'forwarded', label: '已转发' }, { status: 'accepted', label: '处理中' },
  { status: 'done', label: '已完成' }, { status: 'returned', label: '已退回' }, { status: 'unassigned', label: '等平台' }
]
export const MERCHANT_JOB_TABS = [
  { status: 'dispatched', label: '待完善' }, { status: 'published', label: '已上架' }, { status: 'closed', label: '已关闭' }
]
// status 为空 = 服务端的「转过来的全部」
export const SERVICE_TABS = [
  { status: 'forwarded', label: '待接手' }, { status: 'accepted', label: '处理中' }, { status: 'done', label: '已完成' }, { status: '', label: '全部' }
]
export const CITY_TABS = [
  { status: '', label: '全部' }, { status: 'unassigned', label: '等平台' }, { status: 'pending_verify', label: '待核实' }, { status: 'dispatched', label: '完善中' },
  { status: 'forwarded', label: '已转发' }, { status: 'accepted', label: '处理中' }, { status: 'published', label: '已上架' }, { status: 'done', label: '已完成' },
  { status: 'returned', label: '已退回' }, { status: 'closed', label: '已关闭' }
]
/** 打开页面带的 ?status= 只认这一页有的页签，别的落到第一个 */
export const tabOf = (tabs, status) => (tabs.some(t => t.status === status) ? status : tabs[0].status)

// ---------------- 2026-11-03 主人：「每个项目区分开别放到一起」 ----------------
// 商家服务人、换工主理人的商家需求页顶上先按项目分（线上任务 | 代运营 | 抖音卖房），每个项目里再按状态分；type 就是服务端的 requestType
export const REQUEST_KINDS = [
  { type: 'online_task', label: '线上任务', name: '线上任务需求', icon: 'laptop' },
  { type: 'managed', label: '代运营', name: '代运营', icon: 'store' },
  { type: 'cloud_chain', label: '抖音卖房', name: '抖音卖房', icon: 'clapperboard' }
]
export const kindInfo = (type) => REQUEST_KINDS.find(k => k.type === type) || REQUEST_KINDS[0]
/** 打开页面时选哪个项目：地址带了就用它；没带（老消息、老入口）落到第一个有待办的，都没有就线上任务 */
export const pickKind = (type, counts) => (REQUEST_KINDS.some(k => k.type === type) ? type
  : (REQUEST_KINDS.find(k => Number(counts && counts[k.type]) > 0) || REQUEST_KINDS[0]).type)
/** 项目页签上的待办数（商家服务人是待接手，换工主理人是待核实）：没取到就不显示 */
export const kindBadge = (counts, type) => { const n = Number(counts && counts[type]) || 0; return n > 99 ? '99+' : n > 0 ? String(n) : '' }

// 「线上任务管理」（主人 2026-11-03 问「任务页是哪个」）：商家服务人接手的线上任务，上架后在这里进任务页接单、验收、付款登记
export const MANAGE_TABS = [{ status: 'accepted', label: '进行中' }, { status: 'done', label: '已完成' }]
/** 列表上这一行能不能直接「管理任务」：线上任务、已上架过（不是草稿）、是他接手的（老服务端没有 mine 时交给服务端把关） */
export const canManageRow = (r) => !!r && r.requestType === 'online_task' && r.jobId != null && !!r.jobStatus && r.jobStatus !== 'draft'
  && ['accepted', 'done'].includes(r.status) && r.mine !== false
/**
 * 每个任务待处理的报名、成果：线上任务概况（/app/staff/daily/online）按任务给的数，只取他接手的那几个任务（jobIds）。
 * 返回 { byJob: { jobId: { toReview, toAccept } }, toReview, toAccept }
 */
export function taskTodos(tasks, jobIds) {
  const ids = new Set((jobIds || []).map(String))
  const out = { byJob: {}, toReview: 0, toAccept: 0 }
  for (const t of tasks || []) {
    if (!ids.has(String(t.jobId))) continue
    const review = Number(t.toReview) || 0, accept = Number(t.toAccept) || 0
    out.byJob[t.jobId] = { toReview: review, toAccept: accept }
    out.toReview += review
    out.toAccept += accept
  }
  return out
}

/**
 * 商家服务工作台（主人 2026-11-03：「做成小院主理人那样的快捷入口，一个项目一个按钮，哪个有待办就有红点」）。
 * c：{ online_task, managed, cloud_chain（各自待接手）, audit（待审核活动）, toReview, toAccept（他接手的任务里待审核报名、待验收成果） }，读不到的是 null。
 * 返回快捷入口（每个一格，badge 是红色数字）和「优先处理」（有数的才出，最多 4 条，和小院主理人工作台同一个样子）。
 */
export function serviceWorkbench(c = {}, first = {}) {
  const n = (k) => (c[k] == null ? 0 : Number(c[k]) || 0)
  const badge = (v) => (v > 99 ? '99+' : v > 0 ? String(v) : '')
  const manage = n('toReview') + n('toAccept')
  const quick = [
    { key: 'manage', icon: 'clipboard-check', color: 'red', label: '线上任务管理', badge: badge(manage) },
    ...REQUEST_KINDS.map(k => ({ key: k.type, icon: k.icon, color: 'ochre', label: k.name, badge: badge(n(k.type)) })),
    { key: 'audit', icon: 'calendar-check', color: 'red', label: '待审核活动', badge: badge(n('audit')) },
    { key: 'daily', icon: 'chart-column', color: 'ink', label: '招募概况', badge: '' }
  ]
  const sub = (r) => (r ? [r.storeName, r.title && r.title !== [r.typeLabel, r.storeName].filter(Boolean).join(' · ') ? r.title : ''].filter(Boolean).join(' · ') : '')
  const priority = []
  for (const k of REQUEST_KINDS) {
    if (n(k.type)) priority.push({ key: k.type, icon: k.icon, tone: 'red', num: n(k.type), title: '条' + k.name + '待接手', sub: sub(first[k.type]) || '本城换工主理人核实后转来' })
  }
  if (n('toReview')) priority.push({ key: 'manage', icon: 'file-pen', tone: 'ochre', num: n('toReview'), title: '份线上任务报名待审核', sub: '在「线上任务管理」里接单' })
  if (n('toAccept')) priority.push({ key: 'manage', icon: 'clipboard-check', tone: 'ochre', num: n('toAccept'), title: '份线上任务成果待验收', sub: '在「线上任务管理」里验收、登记付款' })
  if (n('audit')) priority.push({ key: 'audit', icon: 'calendar-check', tone: 'green', num: n('audit'), title: '场活动待审核', sub: sub(first.audit) || '本城商家提交的活动，通过后公开' })
  return { quick, priority: priority.slice(0, 4) }
}

const TONES = {
  pending_verify: 'ochre', dispatched: 'ochre', unassigned: 'red', returned: 'red',
  forwarded: 'blue', accepted: 'blue', published: 'green', done: 'green', closed: 'neutral'
}
// jobStatus：招募上架后岗位又暂停、关闭时，文字是「已暂停」「已关闭」，颜色不能还是绿的
export const statusTone = (status, jobStatus) => (status === 'published' && ['paused', 'closed'].includes(jobStatus) ? 'neutral' : TONES[status] || 'neutral')
/** 列表卡片的小标签：「已退回，可修改后再提交」是说给商家听的，员工这边只写前半句 */
export const shortStatus = (r) => (r && r.status === 'returned' ? '已退回' : (r && r.statusLabel) || '')
// 代运营、抖音卖房没写标题时，标题就是「代运营 · 店名」（服务端拼的），这一行不再重复，改写是谁提交的
export const requestMeta = (r) => {
  const meta = [r && r.typeLabel, r && r.storeName].filter(Boolean).join(' · ')
  return r && r.title === meta ? (r.source === 'manager' ? '换工主理人代商家提交' : '商家提交') : meta
}
export const sourceText = (r) => (r && r.source === 'manager' ? '换工主理人代商家提交' : '商家提交')

const yuanText = (fen) => {
  const n = Math.round(Number(fen) || 0)
  const y = Math.floor(n / 100), f = n % 100
  return '¥' + y + (f ? '.' + (f < 10 ? '0' + f : f % 10 ? f : f / 10) : '')
}
/**
 * 岗位 / 线上任务的要点（详情页一行一条）：线上任务有交付物、验收标准、佣金、截止时间；招募岗位是人数、工作内容、要求。空的不写。
 * summary 是需求说明：线上任务的说明常常就是岗位内容，同样的话不写两遍
 */
export function jobFacts(job, summary = '') {
  if (!job) return []
  const rows = [
    ['任务类型', job.taskType],
    ['交付物', job.deliverables],
    ['验收标准', job.criteria],
    ['单人佣金', Number(job.commissionFen) > 0 ? yuanText(job.commissionFen) : ''],
    ['截止时间', job.deadlineTime],
    [job.taskType ? '名额' : '招募人数', Number(job.headcount) > 0 ? job.headcount + ' 人' : ''],
    ['工作内容', String(job.content || '').trim() === String(summary || '').trim() ? '' : job.content],
    ['要求', job.requirement]
  ]
  return rows.filter(r => r[1] != null && String(r[1]).trim()).map(r => ({ label: r[0], value: String(r[1]) }))
}

/** 换工主理人在详情页能做什么：只有待核实的能转发、退回（服务端同样按状态拒绝）；只填店名代提交的没有商家账号，退回去没人能接着改，不给退回 */
export const intakeActions = (d) => (d && d.status === 'pending_verify' ? (d.canReturn === false ? ['forward'] : ['forward', 'return']) : [])

/**
 * 转发时选谁：只有一位直接列他；多位时第一项是「全部」（userId = null，服务端给本城每位都补这家店的授权，谁先接手谁处理）。
 * 没有人时返回空，页面改问要不要转平台。
 */
export function forwardChoices(staff) {
  const list = (staff || []).map(p => ({ label: p.name, userId: p.userId }))
  return list.length > 1 ? [{ label: '本城全部商家服务人（谁先接手谁处理）', userId: null }].concat(list) : list
}

const isOnline = (d) => d.requestType === 'online_task' && d.jobId != null
const jobDraft = (d) => isOnline(d) && d.job && d.job.jobStatus === 'draft'
/**
 * 商家服务人在详情页能做什么（和 KgMerchantRequestService 的规则一致）：
 * 待接手 → 接手；接手之后只有接手的人能继续：线上任务没上架 → 上架（没上架不能标完成），其余 → 标记完成；
 * 上架后的线上任务可以去现有的任务页管接单、验收和付款登记。
 */
export function serviceActions(d) {
  if (!d) return []
  if (d.status === 'forwarded') return ['accept']
  if (!d.mine) return []
  if (d.status === 'accepted') return jobDraft(d) ? ['publish'] : (isOnline(d) ? ['done', 'manage'] : ['done'])
  return d.status === 'done' && isOnline(d) && !jobDraft(d) ? ['manage'] : []
}
/**
 * 2026-11-03 主人：简化——待接手的线上任务（岗位还是草稿）底栏多一个「接手并上架」：接手成功后紧接着调上架，一键做完两步。
 * 代运营、抖音卖房没有岗位可上架，只有「接手」
 */
export const acceptPublishable = (d) => !!d && d.status === 'forwarded' && jobDraft(d)
export function serviceHint(d) {
  if (!d) return ''
  if (d.status === 'forwarded') return '接手后由你负责这条需求，其他商家服务人就不能再处理了。'
  if (d.status === 'done') return '这条需求已完成。'
  if (d.status !== 'accepted') return ''
  if (!d.mine) return '这条需求已由其他商家服务人接手。'
  if (jobDraft(d)) return '任务还没上架。核对无误后点「审核通过并上架」，用户才能接单；要商家改的点「退回商家」。'
  if (isOnline(d)) return '任务已上架。接单、验收和付款登记在「管理任务」里做，全部做完再标记完成。'
  return '和商家沟通办理，办完后标记完成，商家会收到通知。'
}

// ---------------- 商家服务人审核活动（service-activities 页） ----------------
const FEE_MODE = { offline: '到场支付', online: '在线支付', aa: '现场平摊，平台不收' }
const minuteOf = (t) => String(t || '').slice(0, 16)
/** 待审核活动的要点（详情页一行一条），字段见接口 /app/staff/service/activities；空的不写 */
export function activityFacts(a) {
  if (!a) return []
  const end = minuteOf(a.endTime)
  const fee = [a.priceText, FEE_MODE[a.feeMode]].filter(Boolean).join(' · ')
  const rows = [
    ['活动时间', minuteOf(a.startTime) + (end ? ' 至 ' + end : '')],
    ['报名截止', minuteOf(a.deadline)],
    ['集合地点', a.place],
    ['费用', fee],
    ['费用包含', a.feeIncludes],
    ['名额', Number(a.capacity) > 0 ? a.capacity + ' 人' : ''],
    ['发起门店', a.storeName],
    ['发起人', a.creator],
    ['提交时间', minuteOf(a.submitTime)]
  ]
  return rows.filter(r => r[1] != null && String(r[1]).trim()).map(r => ({ label: r[0], value: String(r[1]) }))
}
/** 和服务端一样的规则，就地提示：驳回必须写原因，审核原因这一列只有 255 字 */
export function auditReasonError(reason) {
  const text = String(reason || '').trim()
  if (!text) return '驳回要写原因，商家才知道改什么'
  return text.length > 255 ? '原因最多 255 字，现在 ' + text.length + ' 字' : ''
}

// ---------------- 线上任务招募概况（online-daily 页） ----------------
/** 任务状态的颜色：招募中是绿的，暂停、关闭是灰的 */
export const onlineTaskTone = (t) => (t && t.status === 'published' ? 'green' : 'neutral')
/** 任务卡片下面那一排数：warn 的有数时标红（缺人、等人处理） */
export function onlineTaskStats(t) {
  const n = (k) => Number(t && t[k]) || 0
  return [
    { label: '名额', value: n('headcount') },
    { label: '在做', value: n('working') },
    { label: '缺口', value: n('shortfall'), warn: n('shortfall') > 0 },
    { label: '待审核', value: n('toReview'), warn: n('toReview') > 0 },
    { label: '待验收', value: n('toAccept'), warn: n('toAccept') > 0 }
  ]
}

// ---------------- 代商家提交（代运营 / 抖音卖房） ----------------
export const SUBMIT_TYPES = [{ value: 'managed', label: '代运营' }, { value: 'cloud_chain', label: '抖音卖房' }]
export const SUBMIT_MAX_IMAGES = 9
const MOBILE = /^1[3-9]\d{9}$/
export const cleanPhone = (v) => String(v || '').replace(/[\s-]/g, '')
export const newSubmitForm = () => ({ requestType: 'managed', merchantStoreId: null, merchantStoreName: '', storeName: '', content: '', contactName: '', contactPhone: '', images: [] })
/** 和服务端一样的规则，就地提示；键是表单项 */
export function submitErrors(f) {
  const e = {}
  if (!SUBMIT_TYPES.some(t => t.value === f.requestType)) e.requestType = '请选择代运营或抖音卖房'
  if (f.merchantStoreId == null) {
    const name = String(f.storeName || '').trim()
    if (!name) e.store = '请选择本城商家店，或填写店名'
    else if (name.length > 64) e.store = '店名最多 64 字'
  }
  const content = String(f.content || '').trim()
  if (!content) e.content = '请填写需求说明'
  else if (content.length > 2000) e.content = '需求说明最多 2000 字'
  const contact = String(f.contactName || '').trim()
  if (!contact) e.contactName = '请填写联系人'
  else if (contact.length > 32) e.contactName = '联系人最多 32 字'
  if (!MOBILE.test(cleanPhone(f.contactPhone))) e.contactPhone = '请填写 11 位手机号'
  return e
}
/** 选了本城商家店就只带门店编号，没选才带店名 */
export function submitPayload(f) {
  const out = {
    requestType: f.requestType, content: String(f.content || '').trim(), contactName: String(f.contactName || '').trim(),
    contactPhone: cleanPhone(f.contactPhone), images: (f.images || []).slice()
  }
  if (f.merchantStoreId != null) out.merchantStoreId = f.merchantStoreId
  else out.storeName = String(f.storeName || '').trim()
  return out
}

// ---------------- 换工主理人完善商家岗位：把岗位表的列填回发布表单（jobs.vue） ----------------
const BOARD_DEFAULT = { all: '包吃包住', room: '包住宿', meal: '包三餐' }
const listOf = (v) => (Array.isArray(v) ? v.filter(Boolean) : [])
/**
 * GET /app/staff/merchant-jobs/{jobId} 的 job → 发布表单（base = newForm(jobType)）+ 标题 / 工作内容 / 其他要求（gen）。
 * 和 jobs.vue 提交时的合成相反：年龄、性格、技能行从「要求」里拆出来（提交时再由 requirementText 合回去，不会多写一遍；「年龄：不限」按没写）；
 * 全职的门店类型存成第一个标签，这里拆回 category；没写食宿说明时服务端存的是默认文字，拆回空，免得改了食宿类型还留着旧说法；
 * 工作地点就是门店地址的算没选（提交时服务端照旧用门店的地址和坐标）。
 */
export function draftJobForm(job, base, { categories = [], storeAddress = '' } = {}) {
  const j = job || {}
  const volunteer = j.jobType === 'volunteer'
  const tags = String(j.tags || '').split(',').map(t => t.trim()).filter(Boolean)
  const category = j.jobType === 'fulltime' ? categories.find(c => tags.includes(c[0])) : null
  let age = ''
  let personality = []
  const hope = []
  for (const raw of String(j.requirement || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('技能：')) continue
    if (line.startsWith('年龄：')) age = line.slice(3).trim()
    // 2026-11-03：性格（V67 可配的选项，最多 3 个，顿号隔开）
    else if (line.startsWith('性格：')) personality = line.slice(3).split(/[、,，]/).map(t => t.trim()).filter(Boolean).slice(0, 3)
    else hope.push(line)
  }
  if (age === '不限') age = ''
  const salaryEnabled = !!j.salaryType && j.salaryType !== 'none' && Number(j.salaryMin) > 0
  const known = volunteer ? ['all', 'room'] : ['all', 'room', 'meal', 'none']
  const boardType = known.includes(j.boardType) ? j.boardType : (volunteer ? 'all' : 'none')
  const boardEnabled = boardType !== 'none'
  const sameAsStore = !j.address || (!!storeAddress && String(j.address).trim() === String(storeAddress).trim())
  const form = {
    ...base,
    jobType: j.jobType,
    workKind: j.workKind || '',
    images: Array.isArray(j.images) ? j.images.filter(Boolean) : [],
    address: sameAsStore ? '' : j.address,
    latitude: sameAsStore ? null : (j.latitude ?? null),
    longitude: sameAsStore ? null : (j.longitude ?? null),
    startDate: String(j.startDate || '').slice(0, 10),
    minDays: Number(j.minDays) > 0 ? Number(j.minDays) : null,
    headcount: Number(j.headcount) > 0 ? Number(j.headcount) : base.headcount,
    genderCountsEnabled: j.jobType === 'volunteer' && j.genderMaleCount != null && j.genderFemaleCount != null,
    genderMaleCount: j.genderMaleCount ?? null, genderFemaleCount: j.genderFemaleCount ?? null,
    genderPref: j.genderPref || '', restMode: j.restMode || '', roomType: j.roomType || '',
    age, personality,
    keywords: tags.filter(t => !(category && t === category[0])).slice(0, 4),
    category: category ? category[1] : '',
    hours: j.shiftDesc || '',
    dailyHours: j.dailyHours || '', shiftTime: j.shiftTime || '',
    boardType, boardEnabled,
    boardDesc: !boardEnabled || j.boardDesc === BOARD_DEFAULT[boardType] ? '' : (j.boardDesc || ''),
    salaryEnabled,
    salaryType: salaryEnabled ? j.salaryType : base.salaryType,
    salary: salaryEnabled ? String(Number(j.salaryMin)) : '',
    pay: salaryEnabled ? 'salary' : (boardEnabled ? 'board' : 'none'),
    settleDesc: j.settleDesc || '', probation: j.probation || '', trainDesc: j.trainDesc || '',
    bonusEnabled: !!j.bonusDesc, bonusDesc: j.bonusDesc || '',
    commissionEnabled: !!j.commissionDesc, commissionDesc: j.commissionDesc || '',
    insuranceFlag: j.insuranceFlag === '0' ? '0' : '1',
    monthRedpacket: j.monthRedpacket === '0',
    // V66 的七个键：接口给的是库里的原值（不收口）；老服务端没这些字段时也不报错
    mealAllowance: j.mealAllowance || '', mealAllowanceUnit: j.mealAllowanceUnit || 'day', petStatus: j.petStatus || '', petImages: listOf(j.petImages),
    lodgingImages: listOf(j.lodgingImages), lodgingVideo: j.lodgingVideo || '', lodgingVideoCover: j.lodgingVideoCover || ''
  }
  return { form, gen: { title: j.title || '', work: j.content || '', hope: hope.join('\n') } }
}
