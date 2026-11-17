import test from 'node:test'
import assert from 'node:assert/strict'
import { jobUrgency, urgencyDeadline } from '../common/job-urgency.js'
import { urgentResult } from '../pages/staff/urgent-result.js'
const now = Date.parse('2026-11-17T08:00:00Z')
const job = { status: 'published', urgentLevel: 3, urgentDeadline: '2026-11-19 18:00:00' }

test('北京时间截止在不同时区设备上仍为同一时刻，截止即隐藏', () => {
  const deadline = Date.parse('2026-11-19T10:00:00Z')
  assert.equal(urgencyDeadline(job.urgentDeadline), deadline)
  assert.equal(urgencyDeadline('2026-11-19 18:00'), deadline)
  assert.equal(urgencyDeadline('2026-11-19T10:00:00Z'), deadline)
  assert.equal(jobUrgency(job, deadline - 1).label, '紧急招募')
  assert.equal(jobUrgency(job, deadline), null)
  assert.equal(jobUrgency(job, deadline + 1), null)
})
test('普通、暂停、失效和非法数据均不显示紧急标记', () => {
  for (const status of ['paused', 'draft', 'ended', 'closed']) assert.equal(jobUrgency({ ...job, status }, now), null)
  for (const urgentLevel of [0, -1, 5, 1.2, 'bad', null]) assert.equal(jobUrgency({ ...job, urgentLevel }, now), null)
  for (const urgentDeadline of ['invalid', '2026-11-16 18:00:00']) assert.equal(jobUrgency({ ...job, urgentDeadline }, now), null)
  assert.equal(jobUrgency(null, now), null)
})
test('四种有效等级正确区分，兼容无截止的历史数据', () => {
  for (const [i, label] of ['一般招募', '较急招募', '紧急招募', '特急招募'].entries())
    assert.equal(jobUrgency({ ...job, urgentLevel: i + 1 }, now).label, label)
  assert.equal(jobUrgency({ ...job, urgentDeadline: null }, now).deadlineText, '')
  assert.equal(jobUrgency(job, now).deadlineText, '2026-11-19 18:00')
})
test('通知回执只展示实际站内成功数，解释频控和用户设置', () => {
  const r = urgentResult({ staffNotified: 1, usersMatched: 9, usersNotified: 2, usersSkipped: 7,
    skipReasons: { preferenceOff: 3, quietHours: 2, dailyDigest: 2 } })
  assert.match(r.summary, /用户 2 人，员工 1 人/)
  assert.equal(r.reasons.length, 3)
  assert.match(r.reasons.join(' '), /每日汇总 2 人/)
  assert.doesNotMatch(r.summary, /9|微信/)
  assert.match(urgentResult({ usersNotified: 0, throttled: true }).reasons[0], /24小时/)
  assert.match(urgentResult({ skipReasons: { notWritten: 2 }, staffSkipped: 1 }).reasons.join(' '), /未生成站内通知 2 人/)
})
