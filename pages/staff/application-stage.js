// 员工端「报名详情」（pages/staff/applications.vue）顶部的「当前：…」状态条和进度步骤的纯逻辑。
// 2026-11-03 主人：截图上六步全打勾、下面一大段积分规则，看不出这份报名现在到底是什么状态（「确认换工完成当前入职成功」）。
// 所以步骤上面加一条「当前：已入职（入职成功）」+ 日期；进行中的那一步和已完成的画法分开；被拒的那一步画成停住。
// 放 staff 分包，不进主包，不引 @/，node --test 直接跑。文件名不和页面同名（同名会被打到包根目录、算进主包）。
// 状态以服务端为准（ApplicationStatus），这里只把状态翻成员工看得懂的话。

export const OFFLINE_STEPS = ['提交', '审核', '面试', '确认', '签约', '入职']
export const ONLINE_STEPS = ['提交', '审核', '确认']

// 当前停在第几步（1 起；比步骤数大 1 = 全部完成；0 = 流程中止，不落在任何一步）。
// 详情屏的六步进度条此前把 done/current 写死成 i===1 / i===2，后来改成按状态算；终态（已撤回 / 已终止）不画成「正在第 N 步」
export const STEP_BY_STATUS = {
  submitted: 2,
  review_passed: 3, review_rejected: 2,
  interview_booked: 3,
  interview_done: 4, user_confirmed: 4,
  store_confirmed: 5, contract_signed: 6,
  onboarded: 7,
  withdrawn: 0, terminated: 0
}
export const ONLINE_STEP_BY_STATUS = { submitted: 2, review_rejected: 2, review_passed: 3, interview_booked: 3, interview_done: 3, user_confirmed: 3, store_confirmed: 3, contract_signed: 3, onboarded: 4 }

/** 第 i 步（0 起）怎么画：done 已完成（打勾）/ current 正在这一步 / stopped 停在这一步（审核未通过）/ '' 还没到 */
export function stepState(i, step, status) {
  const n = i + 1
  if (n < step) return 'done'
  if (n === step) return status === 'review_rejected' ? 'stopped' : 'current'
  return ''
}

/** 时间显示成「11-02 14:30」；只有日期的显示「11-02」；认不出就不显示 */
export function shortTime(v) {
  const m = String(v || '').match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (!m) return ''
  return m[2] + '-' + m[3] + (m[4] ? ' ' + m[4] + ':' + m[5] : '')
}

const when = (v, suffix) => { const t = shortTime(v); return t ? t + ' ' + suffix : '' }

/**
 * 「当前：…」状态条。返回 { label, date, tone }，没有状态时返回 null。
 * tone：wait 进行中 / ok 已完成（入职成功、结算完成）/ stop 停了（未通过、撤回、终止）。
 * date 只用详情接口给的时间（老服务端没有这几个时间字段时就不显示日期，状态照常显示）。
 */
export function stageBanner(status, { online = false, detail = {}, interview = null } = {}) {
  if (!status) return null
  const d = detail || {}
  const stop = (label, date = '') => ({ label, date, tone: 'stop' })
  const wait = (label, date = '') => ({ label, date, tone: 'wait' })
  if (status === 'review_rejected') return stop('审核未通过', when(d.auditTime, '审核'))
  if (status === 'withdrawn') return stop('候选人已撤回报名', when(d.withdrawTime, '撤回'))
  if (status === 'terminated') return stop('流程已终止')
  if (status === 'submitted') return wait(d.urgent === true ? '待审核（已加急）' : '待审核', when(d.submitTime, '提交'))
  if (online) {
    // 线上接单通过后状态一直是 review_passed，进度看结算：结算完成算「完成」
    const step = Number(d.onlineStep) || ONLINE_STEP_BY_STATUS[status] || 0
    if (d.settleStatus === 'confirmed' || step >= 4) return { label: '已结算完成', date: '', tone: 'ok' }
    return wait(d.settleStatus && d.statusLabel ? '已通过 · ' + d.statusLabel : '已通过，接单进行中', when(d.auditTime, '通过'))
  }
  switch (status) {
    case 'review_passed': return wait('审核已通过，待安排面试', when(d.auditTime, '通过'))
    case 'interview_booked': return wait('已预约面试', interview && interview.dateText ? interview.dateText + ' 面试' : '')
    case 'interview_done': return wait('面试已结束，待候选人确认意向')
    case 'user_confirmed': return wait('候选人已确认意向，待门店确认录用', when(d.userConfirmTime, '确认意向'))
    case 'store_confirmed': return wait(d.jobType === 'volunteer' && d.volunteerContractStatus === 'pending' ? '用户已确认协议，待店家核对' : d.jobType === 'volunteer' && d.volunteerContractStatus === 'rejected' ? '协议已退回，待用户重新确认' : '已确认录用，待候选人签约', when(d.storeConfirmTime, '录用'))
    case 'contract_signed': return wait('已签约，待到岗后标记入职')
    case 'onboarded': return { label: d.volunteerDone === true ? '已入职 · 换工已完成' : '已入职（入职成功）', date: when(d.onboardTime, '入职'), tone: 'ok' }
    default: return wait(d.statusLabel || '处理中')
  }
}

/**
 * 已入职、可以「确认换工完成」时，下面那句提示只说下一步做什么（一行），积分规则收进「积分规则」展开。
 * 之前这里是服务端 volunteerFinishTip 整段（「换工结束（或提前离开）后……自动确认并发积分。」），主人看着像一堵墙。
 */
export function volunteerNextHint(detail = {}) {
  const d = detail || {}
  const line = '下一步：TA 已入职，换工结束（或提前离开）后点下方「确认换工完成」填实际天数。'
  if (Number(d.volunteerPerDay) !== 0) return line
  // 会员规则开着时每天积分也给 0，但确认完成照样按会员口径发分（服务端积分说明里写着「会员规则」），不能说「不发积分」
  if (/会员规则/.test(String(d.volunteerFinishTip || ''))) return line + '积分按会员规则发，详见积分规则。'
  // 每天积分为 0：积分上线前就结束的、或积分暂停发放，确认完成不发积分（原因在积分规则里）
  return line + '这次确认不发积分，原因见积分规则。'
}

/** 「积分规则」展开后的全文：以服务端 volunteerFinishTip 为准，老服务端没有时用原来的说法 */
export function volunteerRule(detail = {}) {
  const d = detail || {}
  return d.volunteerFinishTip || `换工结束（或提前离开）后，点「确认换工完成」填实际天数，系统按每天 ${d.volunteerPerDay} 积分发给 TA；计划结束 3 天后还没确认的，按报名天数自动发。`
}
