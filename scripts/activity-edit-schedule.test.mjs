import test from 'node:test'
import assert from 'node:assert/strict'
import { activitySchedule, checkActivitySchedule } from '../pages/community/activity-schedule.js'
const now = Date.parse('2026-11-16T10:00:00+08:00')
const original = { startTime:'2026-11-16 11:37:21', endTime:'2026-11-17 01:19:12', deadline:'2026-11-15 20:07:03' }
test('编辑回填任意分钟、跨天及原截止，不丢秒数', () => {
  const form = activitySchedule(original, '2026-11-20')
  assert.equal(form.time,'11:37'); assert.equal(form.endTime,'01:19')
  assert.deepEqual(checkActivitySchedule(form, original, now), original)
})
test('保留过期截止；主动改成过期或晚于集合的截止被拦截', () => {
  const form = activitySchedule(original, '2026-11-20')
  for (const changes of [{deadlineTime:'19:59'},{deadlineDate:'2026-11-16',deadlineTime:'11:38'}]) assert.ok(checkActivitySchedule({...form,...changes},original,now).error)
  assert.equal(checkActivitySchedule({...form,deadlineDate:'2026-11-16',deadlineTime:'11:12'},original,now).deadline,'2026-11-16 11:12')
})
test('旧活动未设截止可保持，新建必须填具体时间', () => {
  const old = {...original,deadline:''}, form = activitySchedule(old,'2026-11-20')
  assert.equal(checkActivitySchedule(form,old,now).deadline,'')
  assert.ok(checkActivitySchedule(form,{},now).error)
})
test('临近开始可保留原时间；改时间须提前1小时，开始后不能重排', () => {
  const old={...original,startTime:'2026-11-16 10:30:00'},form=activitySchedule(old,'2026-11-20')
  assert.equal(checkActivitySchedule(form,old,now).error,undefined)
  assert.ok(checkActivitySchedule({...form,time:'10:45'},old,now).error)
  assert.ok(checkActivitySchedule(form,old,now+3600000).error)
})
test('新活动支持今天、任意分钟、跨天，拒绝倒置和无效时刻', () => {
  const form={date:'2026-11-16',time:'2337',endDate:'2026-11-17',endTime:'1：19',deadlineDate:'2026-11-16',deadlineTime:'22:13'}
  const result=checkActivitySchedule(form,{},now)
  assert.equal(result.startTime,'2026-11-16 23:37');assert.equal(result.endTime,'2026-11-17 01:19')
  for(const changes of [{date:'2026-02-30'},{time:'24:00'},{endDate:'2026-11-16'},{deadlineTime:'23:59'}]) assert.ok(checkActivitySchedule({...form,...changes},{},now).error)
})
