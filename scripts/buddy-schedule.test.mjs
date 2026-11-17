import test from 'node:test'
import assert from 'node:assert/strict'
import { restoreSchedule, checkSchedule, scheduleTime } from '../pages/community/buddy-schedule.js'

const now = Date.parse('2026-11-16T10:00:00+08:00')
const base = { date:'2026-11-16', time:'11:37', endDate:'2026-11-16', endTime:'13:19', deadlineDate:'2026-11-16', deadlineTime:'11:12' }
test('当天和任意分钟按北京时间原样提交', () => {
  const r = checkSchedule(base, now)
  assert.equal(r.error, undefined)
  assert.equal(r.startTime, '2026-11-16 11:37')
  assert.equal(r.endTime, '2026-11-16 13:19')
  assert.equal(r.deadline, '2026-11-16 11:12')
  assert.equal(r.hours, 1.7)
})
test('跨天与紧凑手输时刻可保存', () => {
  const r = checkSchedule({...base, time:'2337', endDate:'2026-11-17', endTime:'1：19'}, now)
  assert.equal(r.error, undefined)
  assert.equal(r.startTime, '2026-11-16 23:37')
  assert.equal(r.endTime, '2026-11-17 01:19')
})
test('非法日期、时间、倒置时段、过期及晚于开始的截止不能提交', () => {
  for (const changes of [{date:'2026-02-30'}, {time:'24:00'}, {time:'12:60'}, {time:''}, {time:'10:59'}, {endTime:'11:37'}, {endTime:'10:00'}, {deadlineTime:'10:00'}, {deadlineTime:'11:38'}]) {
    assert.ok(checkSchedule({...base,...changes},now).error, JSON.stringify(changes))
  }
  assert.equal(checkSchedule({...base,time:'11:00',deadlineTime:'11:00'},now).error,undefined)
})
test('旧草稿时长与截止预设转换为可编辑的确切时刻', () => {
  const old = restoreSchedule({date:'2026-11-16',time:'23:30',hours:3,deadline:'h2',place:'小院'},'2026-11-18')
  assert.equal(old.endDate,'2026-11-17'); assert.equal(old.endTime,'02:30')
  assert.equal(old.deadlineDate,'2026-11-16'); assert.equal(old.deadlineTime,'21:30')
  assert.deepEqual(restoreSchedule(old,'2026-11-18'),old)
  assert.equal(restoreSchedule({date:'2026-11-16',time:'08:00'},'2026-11-18').deadlineDate,'2026-11-15')
})
test('过去日期的草稿保留供纠正，不偷偷改成默认日期', () => {
  const old = restoreSchedule({date:'2026-11-15',time:'08:00'},'2026-11-18')
  assert.equal(old.date,'2026-11-15'); assert.ok(checkSchedule(old,now).error)
  assert.ok(Number.isNaN(scheduleTime('2026-02-30','09:30')))
})
