import test from 'node:test'
import assert from 'node:assert/strict'
import { applicationDraftForJob, defaultArrival, defaultDuration } from '../pages/jobs/apply-flow.js'

test('报名草稿跨岗位隔离：不把旧日期、时长和接单说明投给新岗位', () => {
  const old = { jobId: 12, arrival: '2026-11-24', days: '60', note: '仅针对上一岗位的说明' }
  const current = applicationDraftForJob(old, 13)
  assert.deepEqual(current, {})
  assert.equal(defaultArrival('2026-10-24', '2026-10-22', current.arrival), '2026-10-24')
  assert.equal(defaultDuration(30), 30)
  assert.equal(old.note, '仅针对上一岗位的说明')
})

test('同一岗位草稿兼容数字和字符串编号；无岗位旧草稿、非法值不恢复', () => {
  const saved = { jobId: 12, arrival: '2026-11-24', days: '60', note: '我的接单说明' }
  assert.deepEqual(applicationDraftForJob(saved, '12'), saved)
  for (const value of [null, [], 'invalid', { arrival: '2026-11-24' }, { jobId: 0 }]) {
    assert.deepEqual(applicationDraftForJob(value, 12), {})
  }
  assert.deepEqual(applicationDraftForJob(saved, null), {})
})
