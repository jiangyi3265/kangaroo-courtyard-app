// 一键多投（2026-10-31 主人：「他投了一个之后，可以选择多个投递，再选城市，然后同时多点几家就多选投出来」）。
// 没有批量接口：逐家调 POST /app/application（60 次/小时、同岗 12 次/天，一次 5 家够用），串行才能逐家显示结果。
// 只在 jobs 分包里用，不进主包；不引用 @/ 下的模块，node --test 直接测。
import { defaultArrival, durationLabel } from './apply-flow.js'
import { monthDay } from './trip-share.js'

export const MAX_PICK = 5
export const PAGE_SIZE = 30
export const TYPE_CHIPS = [['换工', 'volunteer'], ['兼职', 'parttime'], ['全职', 'fulltime']]
const TYPE_TEXT = { volunteer: '换工', parttime: '兼职', fulltime: '全职' }

/** 简历性别 → 列表筛选（服务端不挡性别，一键投递又跳过了看详情，不滤就可能把男生投给「仅女生」）；其他 / 没填不传 */
export const genderParam = (g) => (g === '女' ? 'F' : g === '男' ? 'M' : undefined)

/** 我的报名 → 投过的岗位（任何状态都算，被拒、撤回的也不再推荐；想重新报的从详情页走） */
export const appliedSet = (rows) => new Set((rows || []).map(x => String(x && x.jobId)).filter(id => id && id !== 'undefined' && id !== 'null'))

/** 排除：当前岗位、已投过、暂停和不再招的、满员、线上任务（remainingCount 没给的不算满员） */
export const candidates = (rows, { currentJobId, appliedJobIds }) => (rows || []).filter(j => j
  && j.jobType !== 'online' && j.status === 'published'
  && !(j.remainingCount != null && Number(j.remainingCount) <= 0)
  && String(j.jobId) !== String(currentJobId) && !(appliedJobIds && appliedJobIds.has(String(j.jobId))))

/**
 * 列表要滤掉一部分，滤完不够就自动再取一页，最多连取 maxPages 页（都是别人投过的、满员的时候不能翻太多）。
 * fetchPage(pageNum) 返回接口原样 { rows, total, hasMore }；keep(rows) 是滤完的行；返回 { rows, pageNum, hasMore }
 */
export async function collectCandidates(fetchPage, { startPage = 1, need = 6, maxPages = 3, keep = (x) => x, pageSize = PAGE_SIZE } = {}) {
  const out = []
  const seen = new Set()
  let pageNum = startPage - 1
  let hasMore = true
  let tried = 0
  while (hasMore && tried < maxPages && out.length < need) {
    pageNum += 1
    tried += 1
    const res = await fetchPage(pageNum)
    const rows = (res && res.rows) || []
    for (const j of keep(rows)) {
      if (seen.has(String(j.jobId))) continue
      seen.add(String(j.jobId))
      out.push(j)
    }
    hasMore = typeof (res && res.hasMore) === 'boolean' ? res.hasMore : pageNum * pageSize < Number((res && res.total) || 0)
    if (!rows.length) hasMore = false
  }
  return { rows: out, pageNum, hasMore }
}

/** 卡片第二行：「平潭 · 换工 · 30天起」 */
export function cardMeta(job) {
  const j = job || {}
  const city = String(j.city || '').split('·')[0].trim()
  const days = Number(j.minDays) > 0 ? Number(j.minDays) + '天起' : String(j.minDaysText || '').trim()
  return [city, TYPE_TEXT[j.jobType] || '', days].filter(Boolean).join(' · ')
}

/** 沿用刚才填的；早于这家的最早日期、短于这家的最短期限就自动调 */
export function planFor(job, { arrival, days, today }) {
  const date = defaultArrival(job && job.startDate, today, arrival)
  const min = Number(job && job.minDays) > 0 ? Number(job.minDays) : 1
  const stay = Math.min(365, Math.max(Number(days) || 0, min))
  return { arrival: date, days: stay, moved: date !== arrival || stay !== Number(days) }
}

/** 「11月7日 · 一个月」 */
export const planText = (plan) => [monthDay(plan.arrival), durationLabel(plan.days)].filter(Boolean).join(' · ')

/** 勾选：再点取消；满 5 家不加，limited = true 时页面提示 */
export function togglePick(picks, job, max = MAX_PICK) {
  const list = picks || []
  const id = String(job && job.jobId)
  if (list.some(j => String(j.jobId) === id)) return { picks: list.filter(j => String(j.jobId) !== id), limited: false }
  if (list.length >= max) return { picks: list, limited: true }
  return { picks: [...list, job], limited: false }
}

/** 投递结果里的一行。idemKey 第一次生成，重试复用同一个，服务端把重复请求收成同一条报名（同 apply.vue 的 makeIdemKey） */
export function makeRow(job, plan, now = Date.now(), rand = Math.random()) {
  return {
    jobId: job.jobId, title: String(job.title || '').trim() || '这个岗位', arrival: plan.arrival, days: plan.days, moved: !!plan.moved,
    idemKey: job.jobId + '-' + now + '-' + rand.toString(36).slice(2, 10), state: 'waiting', msg: '', appId: null
  }
}

/**
 * 串行投递，一家失败不影响别家。每行：waiting → sending → done(appId) | applied | failed(msg) | skipped
 *   · 服务端说「已报名该岗位」：之前投过，不算失败
 *   · 401：登录失效，这家和后面的都不发（loginHandled 同步标上，登录框由页面问），返回 stopped = 'login'
 *   · 429：提交太频繁，再发也是被拒，后面的都不发，返回 stopped = 'limit'
 *   · shouldStop()：离开页面了，后面的不发，已成功的不受影响
 * 已经成功的行（重试时）跳过。
 */
export async function submitAll(rows, submit, onRow = () => {}, shouldStop = () => false) {
  let stopped = ''
  for (const row of rows) {
    if (row.state === 'done' || row.state === 'applied') continue
    if (!stopped && shouldStop()) stopped = 'leave'
    if (stopped) { row.state = 'skipped'; row.msg = ''; onRow(row); continue }
    row.state = 'sending'
    row.msg = ''
    onRow(row)
    try {
      const res = await submit(row)
      row.state = 'done'
      row.appId = (res && res.data && res.data.appId) || null
    } catch (e) {
      const msg = (e && e.message) || '投递失败，请重试'
      const code = Number(e && e.code)
      if (code === 401) {
        if (e && typeof e === 'object') e.loginHandled = true
        row.state = 'skipped'
        stopped = 'login'
      } else if (/已报名该岗位/.test(msg)) {
        row.state = 'applied'
      } else {
        row.state = 'failed'
        row.msg = msg
        if (code === 429) stopped = 'limit'
      }
    }
    onRow(row)
  }
  return {
    stopped,
    done: rows.filter(r => r.state === 'done').length,
    applied: rows.filter(r => r.state === 'applied').length,
    failed: rows.filter(r => r.state === 'failed').length,
    skipped: rows.filter(r => r.state === 'skipped').length
  }
}

const STATE_TEXT = { waiting: '等待投递', sending: '投递中…', done: '已投递', applied: '之前投过', skipped: '未提交' }
/** 结果行右边写什么：失败写服务端原话 */
export const stateText = (row) => (row.state === 'failed' ? (row.msg || '投递失败') : (STATE_TEXT[row.state] || ''))

/** 投完弹一句 */
export function summaryText({ done, applied, failed, skipped }) {
  const miss = failed + skipped
  if (!miss) return done ? '已投递 ' + (done + applied) + ' 家' : '都已经投过了'
  if (!done && !applied) return '这次没投上，可以看看原因再重试'
  return '已投递 ' + (done + applied) + ' 家，' + miss + ' 家没投上'
}
