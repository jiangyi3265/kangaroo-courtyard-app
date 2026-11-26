// 报名流程（2026-10-18 主人：报名页、进度页都用同一条 7 步进度）：
//   提交资料 → 确认信息 → 约定视频时间 → 签署安全协议 → 订票确认 → 进入地区群 → 到店确认
// 进度按报名的真实状态点亮（ApplicationStatus），系统里没有记录的环节（订票、进群）不假装已经做了：
//   submitted 已提交（门店在看资料）            → 停在第 2 步「确认信息」
//   review_rejected 审核未通过                  → 停在第 2 步（进度页另写原因）
//   review_passed / interview_booked            → 第 3 步「约定视频时间」（约好了也停在这里，面试做完才算过）
//   interview_done / user_confirmed / store_confirmed → 第 4 步「签署安全协议」（双向确认、等签责任书）
//   contract_signed 已签安全协议                → 第 5 步「订票确认」（订票、进群系统里没有记录，和主理人线下确认，门店确认到店后一起点亮）
//   onboarded 已到店入职                        → 7 步全部完成（current = 8）
//   withdrawn / terminated / 不认识的状态       → 0：整条不亮，不把已结束的报名说成还在某一步
// 线上任务没有这套（它有自己的交付六步，见 progress.vue）。
// 另外放报名页用到的小工具：到岗日期默认值、预计时长选项、「我的简历」卡片。只在 jobs 分包里用，不进主包；不引用 @/ 下的模块，node --test 直接测。

export const FLOW_STEPS = ['提交资料', '确认信息', '约定视频时间', '签署安全协议', '订票确认', '到店准备', '到店确认', '工作结束']
// 进度条上每步分两行写（7 步挤在一行，一格只有 45px 左右）
export const FLOW_LINES = [['提交', '资料'], ['确认', '信息'], ['约定', '视频时间'], ['签署', '安全协议'], ['订票', '确认'], ['到店', '准备'], ['到店', '确认'], ['工作', '结束']]
export const FLOW_DONE = FLOW_STEPS.length + 1

const STEP_BY_STATUS = {
  submitted: 2, review_rejected: 2,
  review_passed: 3, interview_booked: 3,
  interview_done: 4, user_confirmed: 4, store_confirmed: 4,
  contract_signed: 5,
  onboarded: 8, completed: FLOW_DONE
}
/** 报名状态 → 7 步进度的当前步（1 起；8 = 全部完成；0 = 已结束、整条不亮） */
export function flowStepOf(status, workEndTime, arrivalStep) {
  if (status === 'onboarded' && workEndTime) return FLOW_DONE
  if (status === 'contract_signed' && [6, 7].includes(Number(arrivalStep))) return Number(arrivalStep)
  return STEP_BY_STATUS[status] || 0
}

// 进度条下面一句话：当前这一步在等什么（只说系统里真有的事）
const HINTS = {
  submitted: '资料已送到门店，主理人确认信息后会通知你约视频时间',
  review_rejected: '这次没有通过门店审核，可以看看其他岗位',
  review_passed: '门店已通过你的资料，下一步选一个视频面试时间',
  interview_booked: '视频面试时间已约好，到点进入会议即可',
  interview_done: '面试已完成，双方确认后签署安全协议',
  user_confirmed: '你已确认愿意前往，等门店确认录用后签署安全协议',
  store_confirmed: '门店已确认录用，请签署安全协议',
  contract_signed: '安全协议已签好，填写车票和到店信息后，可在“到店准备”核对出行安排；到店后进入第 7 步核对门店确认结果',
  onboarded: '已到店确认，当前在岗。需要提前离开时可在第 8 步申请。',
  completed: '这段工作已结束',
  withdrawn: '这次报名已撤回',
  terminated: '这次报名已结束'
}
export function flowHint(status, arrivalStep) {
  if (status === 'contract_signed' && Number(arrivalStep) === 6) return '到店信息已提交，请在到店准备中核对行程安排。'
  if (status === 'contract_signed' && Number(arrivalStep) === 7) return '已到预计到店日期，请到店后联系门店确认入职。'
  return HINTS[status] || ''
}

/** 报名草稿只属于保存时的岗位；换岗后日期、时长、接单说明都重新按新岗位填写。 */
export function applicationDraftForJob(draft, jobId) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft) || !jobId || !draft.jobId) return {}
  return String(draft.jobId) === String(jobId) ? draft : {}
}

// ---------------- 到岗日期 ----------------
const ymd = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''))
  return m ? m[1] + '-' + m[2] + '-' + m[3] : ''
}
/** 能选的最早到岗日：岗位开始日期和今天里晚的那个（岗位开始日是 2026-09-15T00:00:00.000-08:00 这种，只取年月日，不按时区换算） */
export function arrivalStart(startDate, today) {
  const s = ymd(startDate)
  const t = ymd(today)
  if (!s) return t
  return !t || s > t ? s : t
}
/** 到岗日期默认值 = 能选的最早那天（岗位开始日；开始日已经过了就是今天）；草稿里存的日期还有效就用草稿的 */
export function defaultArrival(startDate, today, saved = '') {
  const min = arrivalStart(startDate, today)
  const s = ymd(saved)
  return s && s >= min ? s : min
}
/** 「2026-10-25」→「10月25日 周六」 */
export function arrivalText(v) {
  const s = ymd(v)
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return m + '月' + d + '日 周' + '日一二三四五六'[new Date(y, m - 1, d).getDay()]
}

// ---------------- 预计时长 ----------------
const DURATION_PRESETS = [7, 15, 30, 60, 90, 180]
const DURATION_WORDS = { 7: '一周', 14: '两周', 15: '半个月', 30: '一个月', 45: '一个半月', 60: '两个月', 90: '三个月', 120: '四个月', 180: '半年', 365: '一年' }
/** 30 →「一个月」，20 →「20天」 */
export const durationLabel = (n) => DURATION_WORDS[Number(n)] || (Number(n) > 0 ? Number(n) + '天' : '')
// 岗位没写最短期限时的默认：换宿一般一个月起，全职按三个月，兼职一周
const DEFAULT_DAYS = { volunteer: 30, fulltime: 90, parttime: 7 }
/** 预计时长默认 = 岗位最短期限（最短 30 天就默认「一个月」）；没写最短期限按类型给一个常见值 */
export const defaultDuration = (minDays, jobType = 'volunteer') => (Number(minDays) > 0 ? Math.min(365, Number(minDays)) : (DEFAULT_DAYS[jobType] || 30))
// 选项最多几个：6 个正好两行三列；页面下面另有一整行「其他天数」自己填
export const DURATION_MAX_OPTIONS = 6
/**
 * 预计时长的选项：最短期限本身（不在常用档里时单独放第一个，如「20天」）+ 比它长的常用档；不给比最短期限短的。
 * 返回 [{ days, label }]，页面在下面另放一整行「其他天数」自己填（同样不能短于最短期限、最多 365 天）。
 * 最多 DURATION_MAX_OPTIONS 个：最短期限不到一周（如 3 天）时是「3天、一周…三个月」，「半年」用「其他天数」填（2026-10-19：之前 7 个 + 其他天数，第二行剩一个孤零零的胶囊）
 */
export function durationOptions(minDays) {
  // 岗位没写最短期限：只给常用档（一周起），不出「1天」这种怪选项
  if (!(Number(minDays) > 0)) return DURATION_PRESETS.map(d => ({ days: d, label: durationLabel(d) }))
  const min = Math.min(365, Number(minDays))
  const days = [...new Set([min, ...DURATION_PRESETS.filter(d => d > min)])].slice(0, DURATION_MAX_OPTIONS)
  return days.map(d => ({ days: d, label: durationLabel(d) }))
}
/** 选项排几列，保证每一行都排满、胶囊一样宽：1–5 个排一行，6 个排两行三列 */
export const durationColumns = (n) => (Number(n) >= 6 ? 3 : Math.max(1, Number(n) || 1))
/** 自己填的天数：整数、不短于最短期限、不超过 365；不合格返回提示文字 */
export function checkDuration(raw, minDays) {
  const n = Number(String(raw || '').trim())
  if (!Number.isInteger(n) || n <= 0) return { ok: false, message: '请填写天数（整数）' }
  const min = Number(minDays) > 0 ? Number(minDays) : 1
  if (n < min) return { ok: false, message: '这个岗位最短要待 ' + min + ' 天' }
  if (n > 365) return { ok: false, message: '最多填 365 天' }
  return { ok: true, days: n }
}

// ---------------- 我的简历卡片 ----------------
/**
 * GET /app/resume 的返回 → 报名页「我的简历」卡片。
 * ready：能直接投递（线下岗位要 称呼 + 年龄 + 手机；线上任务要 称呼 + 手机）；简历里没写手机但账号绑了手机也算（服务端会用绑定的手机号）。
 * missing：还差哪几项（「称呼」「年龄」「手机号」），卡片上写「简历还差：…」。从没建过简历（isNew）时 exists = false
 */
export function resumeCard(data, { online = false, accountPhone = '' } = {}) {
  const r = (data && data.resume) || {}
  const exists = !!data && !!data.resume && !r.isNew
  const name = String(r.name || '').trim()
  const age = r.age == null || r.age === '' ? '' : String(r.age)
  const phone = String(r.phone || '').trim()
  const missing = []
  if (!name) missing.push('称呼')
  if (!online && !age) missing.push('年龄')
  if (!phone && !accountPhone) missing.push('手机号')
  const tags = ((data && data.tags) || []).map(t => (t && t.name) || '').filter(Boolean)
  const skillText = String(r.skillText || '').replace(/\s+/g, ' ').trim()
  const skills = tags.length ? tags.slice(0, 4).join(' · ') : (skillText.length > 28 ? skillText.slice(0, 28) + '…' : skillText)
  return {
    exists, ready: exists && !missing.length, missing,
    name, age, city: String(r.city || '').trim(), gender: r.gender || '',
    phone: maskPhone(phone || accountPhone), skills,
    completeness: Number(data && data.completeness) || 0
  }
}
/** 13812345678 → 138****5678 */
export const maskPhone = (p) => (/^1\d{10}$/.test(String(p || '')) ? String(p).slice(0, 3) + '****' + String(p).slice(7) : '')
