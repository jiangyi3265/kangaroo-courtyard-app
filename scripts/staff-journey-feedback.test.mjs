// Pure checks of the acceptance harness guards; these do not claim HTTP/DB/UI integration.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./check-staff-journey.mjs', import.meta.url), 'utf8')
const start = source.indexOf('const openRealFeedback = async ')
const end = source.indexOf('const ANSWERS = ', start)
assert.ok(start >= 0 && end > start, 'Real feedback helpers must be present in the runnable C23 script')
const build = new Function('assert', 'appDetail', 'appApi', 'enabled', 'button', 'statusOf',
  source.slice(start, end) + '\nreturn { openRealFeedback, submitRealFeedback }')

function fixture(overrides = {}) {
  const state = {
    meetingInfo: null, appId: '42', beforeStatus: 'interview_booked',
    afterStatus: 'interview_booked', durationSeconds: null, videoCount: 0,
    httpStatus: 200, code: 200, postedDuration: null, clicks: [], ...overrides,
  }
  const response = {
    status: () => state.httpStatus,
    json: async () => ({ code: state.code }),
    request: () => ({
      method: () => 'POST',
      postDataJSON: () => ({ durationSeconds: state.postedDuration }),
    }),
    url: () => 'http://localhost:8180/app/application/42/finish-interview',
  }
  const p = {
    locator: selector => ({
      count: async () => selector === '.video-body' ? state.videoCount : 1,
      first: () => ({ waitFor: async () => {} }),
      filter: ({ hasText }) => ({ click: async () => {
        assert.ok(hasText.test('面试已结束，填写反馈'))
        state.clicks.push('meeting-feedback')
      } }),
    }),
    waitForResponse: async predicate => {
      assert.equal(predicate({ ...response, url: () => 'http://localhost:8180/app/application/99/finish-interview' }), false,
        'A different applicant response must not satisfy the wait')
      assert.equal(predicate({ ...response, request: () => ({ method: () => 'GET' }) }), false,
        'A read request must not satisfy the feedback wait')
      assert.equal(predicate(response), true)
      return response
    },
  }
  const helpers = build(assert,
    async () => ({ application: { status: state.beforeStatus }, interview: { durationSeconds: state.durationSeconds } }),
    async () => ({ code: 200, data: { appId: state.appId, interview: { meetingInfo: state.meetingInfo } } }),
    async () => {},
    (_page, label) => ({ click: async () => { state.clicks.push(label) } }),
    async () => state.afterStatus)
  return { ...helpers, p, state }
}

test('opening real feedback follows both user meeting-info branches without advancing state', async () => {
  for (const meetingInfo of [null, '隔离测试会议信息']) {
    const f = fixture({ meetingInfo })
    await f.openRealFeedback(f.p, 42, 'fixture-token')
    assert.deepEqual(f.state.clicks, meetingInfo
      ? ['会议信息 / 填写反馈', 'meeting-feedback'] : ['会议信息 / 填写反馈'])
  }
})

test('opening feedback fails for wrong applicant, fake video or premature state changes', async () => {
  for (const invalid of [
    { appId: '99' }, { durationSeconds: 2 }, { videoCount: 1 },
    { beforeStatus: 'interview_done' }, { afterStatus: 'interview_done' },
  ]) {
    const f = fixture(invalid)
    await assert.rejects(() => f.openRealFeedback(f.p, 42, 'fixture-token'), assert.AssertionError)
  }
})

test('feedback requires the same applicant POST and explicitly null duration', async () => {
  const f = fixture()
  await f.submitRealFeedback(f.p, 42, '还想考虑')
  assert.deepEqual(f.state.clicks, ['还想考虑'])
})

test('feedback guard rejects failed HTTP/business replies and fabricated or absent duration', async () => {
  for (const invalid of [{ httpStatus: 500 }, { code: 409 }, { postedDuration: 2 }, { postedDuration: undefined }]) {
    const f = fixture(invalid)
    await assert.rejects(() => f.submitRealFeedback(f.p, 42, '不合适'), assert.AssertionError)
  }
})
