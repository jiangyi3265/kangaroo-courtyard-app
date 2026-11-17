import test from 'node:test'
import { featureState } from '../common/features.js'
test.beforeEach(() => { featureState.communityEnabled = true; featureState.wishEnabled = true; featureState.stayBookingEnabled = true })
test.afterEach(() => { featureState.communityEnabled = false; featureState.wishEnabled = false; featureState.stayBookingEnabled = false })
import assert from 'node:assert/strict'
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '../common/public-share.js'

test('Chinese city and content IDs survive message and timeline URL roundtrip', () => {
  const message = publicShare('/pages/stays/list', { city: '平潭 & 海边', stayId: 27 }, '平潭旅居')
  const timeline = timelineShare(message)
  assert.equal(new URLSearchParams(timeline.query).get('city'), '平潭 & 海边')
  assert.equal(new URLSearchParams(timeline.query).get('stayId'), '27')
  assert.equal(message.path, '/pages/stays/list?' + timeline.query)
  assert.equal(timeline.title, '平潭旅居')
  assert.equal('path' in timeline, false)
})
test('public links omit account, payment, credential, draft and internal screen parameters', () => {
  const message = publicShare('/pages/community/index', { postId: 101, token: 'fake-token', appId: 9, orderId: 8, draftId: 7, s: 4, from: 'mine' })
  assert.equal(message.path, '/pages/community/index?postId=101')
  const timeline = timelineShare({ path: '/pages/community/index?postId=101&token=fake&%ZZ=x&from=mine' })
  assert.equal(timeline.query, 'postId=101')
})
test('titles and public covers are kept, and absent cover never captures private on-screen data', () => {
  const message = shareWithCover({ title: '海边散步', path: '/pages/community/activity?id=8', imageUrl: 'https://example.test/public.jpg' })
  assert.equal(timelineShare(message).imageUrl, 'https://example.test/public.jpg')
  assert.equal(publicShare('/pages/home/index').imageUrl, '/static/share/brand-cover.jpg')
  assert.equal(shareWithCover({ title: 'a'.repeat(130) }).title.length, 100)
})
test('public rooms use invite code, while no room role/player/turn data enters links', () => {
  const message = publicShare('/pages/werewolf/invite', { code: '123456', role: 'witch', userId: 9, turn: 3 })
  assert.equal(timelineShare(message).query, 'code=123456')
})
test('empty parameters produce a valid public root without stale query state', () => {
  assert.equal(publicShare('/pages/wish/index', { city: '', id: null, tab: undefined }).path, '/pages/wish/index')
  assert.equal(timelineShare(publicShare('/pages/home/index')).query, '')
})
test('both official share menu entries are enabled', () => {
  let options
  globalThis.uni = { showShareMenu(value) { options = value } }
  showPublicShareMenu()
  assert.deepEqual(options.menus, ['shareAppMessage', 'shareTimeline'])
  assert.equal(options.withShareTicket, false)
  delete globalThis.uni
})
