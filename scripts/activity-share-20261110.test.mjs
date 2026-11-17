import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activitySharePayload } from '../common/activity-share.js'

test('activity share exposes only public activity fields and routes to detail', () => {
  const result = activitySharePayload({activityId: 12, title: '周末聚会', img: '/profile/a.jpg', timeText: '周五', place: '平潭', signupId: 345, signupNo:'PRIVATE', name:'私人姓名', phone:'13800000000', checkinCode:'secret'}, 'https://daishu.uuok.top/')
  assert.equal(result.path, '/pages/community/activity?id=12&channel=share')
  assert.equal(result.url, 'https://daishu.uuok.top/#/pages/community/activity?id=12&channel=share')
  assert.equal(result.summary, '周五 · 平潭')
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|345|私人姓名|13800000000|secret|signup|checkin/)
})

test('invalid or missing activity ID shares the public list rather than an order', () => {
  for (const activityId of [undefined, 0, -1, 1.2, '12&signupId=99', Number.MAX_SAFE_INTEGER+1]) {
    const result = activitySharePayload({activityId}, 'https://daishu.uuok.top')
    assert.equal(result.activityId, null)
    assert.equal(result.path, '/pages/community/activity')
  }
})
