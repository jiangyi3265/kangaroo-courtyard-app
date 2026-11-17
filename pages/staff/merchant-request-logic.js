// 商家需求（V63，2026-10-30）的页面逻辑：商家首页「我发布的」和 merchant-request.vue 共用。放 staff 分包，不进主包。
// 状态、类型的中文都由服务端给（statusLabel / typeLabel），这里只管进度条怎么画、点一行去哪、表单先挡哪些漏填。

export const REQUEST_PAGE = '/pages/staff/merchant-request'
export const REQUEST_API = '/app/staff/merchant/requests'

// 商家首页单独的两个入口（10-31 主人拍板）：都是这里的简单表单。cloud_chain 是内部编码，不改；用户看到的都是「抖音卖房」
// 2026-11-03 主人：简化商家端文案——商家看到的一律叫「袋鼠工作人员」，不分换工主理人 / 商家服务人
export const APPLY_KINDS = {
  managed: { title: '申请代运营', tip: '说说你的店和想让我们帮什么，袋鼠工作人员核实后跟进。' },
  cloud_chain: { title: '申请抖音卖房', tip: '说说你的店和想怎么在抖音上卖房，袋鼠工作人员核实后跟进。' }
}

/** 2026-11-03 主人：简化商家端文案。服务端给的状态字（「待换工主理人核实」「换工主理人完善中」这类）在商家的页面上统一换成「袋鼠工作人员」；内部员工页面不用这个 */
export function staffWording(text) {
  return String(text == null ? '' : text).replace(/换工主理人|义工主理人|商家服务人|城市负责人/g, '袋鼠工作人员')
}

const JOB_TYPES = ['volunteer', 'parttime', 'fulltime']

/** 进度条：[{ label, state: done | now | todo }]。退回、关闭是提前结束的，只画两步。
 *  2026-11-03 主人：简化——招募是「已提交 → 袋鼠核实中 → 已上架」，线上任务 / 代运营 / 抖音卖房是「已提交 → 袋鼠处理中 → 已完成」（原来 4 步、分谁核实谁处理，商家不用管） */
export function requestSteps(type, status) {
  const build = (labels, now) => labels.map((label, i) => ({ label, state: i < now ? 'done' : (i === now ? 'now' : 'todo') }))
  if (status === 'returned') return build(['已提交', '已退回，可修改后再提交'], 1)
  if (status === 'closed') return build(['已提交', '已关闭'], 1)
  if (JOB_TYPES.includes(type)) return build(['已提交', '袋鼠核实中', '已上架'], status === 'published' ? 3 : 1)
  return build(['已提交', '袋鼠处理中', '已完成'], status === 'done' ? 3 : 1)
}

/** 列表上状态的颜色：good 已上架 / 已完成，bad 被退回，mute 已关闭（含上架后岗位被暂停、关闭的），其余是处理中 */
export function requestTone(status, jobStatus) {
  if (status === 'published' && (jobStatus === 'paused' || jobStatus === 'closed')) return 'mute'
  if (status === 'published' || status === 'done') return 'good'
  if (status === 'returned') return 'bad'
  if (status === 'closed') return 'mute'
  return 'wait'
}

/** 点进一条需求之后，往哪儿看后续：线上任务上架后看报名和成果，招募上架后看岗位 */
export function requestFollowUp(detail, routes) {
  if (!detail || !detail.jobId || !detail.job || detail.job.jobStatus !== 'published') return null
  const store = detail.storeId ? '&storeId=' + detail.storeId : ''
  if (detail.requestType === 'online_task') return { label: '查看报名与成果', url: routes.staffOnline + '?jobId=' + detail.jobId + store }
  return { label: '查看岗位', url: routes.staffJobs + (detail.storeId ? '?storeId=' + detail.storeId : '') }
}

/** 被退回的线上任务回到发布表单里改；代运营、抖音卖房就在需求页改 */
export function resubmitUrl(detail, routes) {
  const store = detail.storeId ? '&storeId=' + detail.storeId : ''
  return routes.staffOnline + '?s=1&requestId=' + detail.requestId + store
}

/** 表单先挡常见漏填（服务端照样每一项都校验） */
export function formProblem(form) {
  if (!String(form.content || '').trim()) return '请填写需求说明'
  if (!String(form.contactName || '').trim()) return '请填写联系人'
  if (!/^1[3-9]\d{9}$/.test(String(form.contactPhone || '').trim())) return '请填写 11 位手机号'
  return ''
}
