import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { displayWording, wordingChanged, messageWording } from '../common/display-wording.js'
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(app, 'package.json'))
const compiler = require('@vue/compiler-sfc')
const admin = await import(pathToFileURL(path.resolve(app, '../RuoYi-Vue3/src/utils/displayWording.js')))

test('plain historical text uses current terminology without modifying stored message fields', () => {
  const original = Object.freeze({ id: '义工-01', category: 'apply', title: '义工报名已提交', content: '你报名的义工岗位已审核', route: '/posts/义工', peerName: '义工小王', sourceLabel: '直播义工' })
  const shown = messageWording(original)
  assert.equal(shown.title, '换工报名已提交')
  assert.equal(shown.content, '你报名的换工岗位已审核')
  assert.equal(shown.sourceLabel, '直播换工')
  assert.equal(original.title, '义工报名已提交')
  assert.equal(original.content, '你报名的义工岗位已审核')
  assert.equal(original.route, '/posts/义工')
  assert.equal(original.peerName, '义工小王')
})
test('personal and group names remain exact while content changes', () => {
  for (const category of ['chat', 'group', 'comment', 'like']) {
    const shown = messageWording({ category, title: '义工小王', peerName: '义工小王', content: '义工小王一起做义工' })
    assert.equal(shown.title, '义工小王')
    assert.equal(shown.content, '义工小王一起做换工')
  }
})
test('platform notification template job labels update inside brackets; actual user quotations stay exact', () => {
  const content = '你报名的「鲸起直播义工」已审核'
  assert.equal(messageWording({ category: 'apply', content }).content, '你报名的「鲸起直播换工」已审核')
  assert.equal(admin.messageWording({ category: 'apply', content }).content, '你报名的「鲸起直播换工」已审核')
  assert.equal(messageWording({ category: 'chat', content }).content, content)
})
test('URLs, code and quoted originals remain intact, visible unquoted text updates', () => {
  const value = '义工 [招募义工](https://example.test/义工?q=义工) “原文义工” 「义工」 `义工`\n> 义工引用\n义工 ```义工```'
  assert.equal(displayWording(value), '换工 [招募换工](https://example.test/义工?q=义工) “原文义工” 「义工」 `义工`\n> 义工引用\n换工 ```义工```')
})
test('structured chat payload is not rewritten and repeatedly applying display is stable', () => {
  const raw = JSON.stringify({ title: '义工', objectId: '义工-1', url: '/义工' })
  assert.equal(displayWording(raw), raw)
  assert.equal(displayWording(displayWording('义工，义工。')), '换工，换工。')
  assert.equal(wordingChanged('换工'), false)
  assert.equal(wordingChanged('义工'), true)
  assert.equal(displayWording(null), '')
})
test('admin and mini display helpers have identical results', () => {
  for (const input of ['义工岗位', '义工小王和义工', '“义工” 原文 义工', 'https://a.test/义工', '{"content":"义工"}', '正常中文']) {
    assert.equal(admin.displayWording(input, ['义工小王']), displayWording(input, ['义工小王']))
  }
})
test('admin record previews never transform protected entities, names, URLs or form source', () => {
  const raw = Object.freeze({ title: '义工帖子', content: '义工工作', nickname: '义工小王', image: '/义工.png', agreementText: '义工协议' })
  assert.equal(admin.displayRecordField('post', 'title', raw), '换工帖子')
  assert.equal(admin.displayRecordField('post', 'content', raw), '换工工作')
  assert.equal(admin.displayRecordField('post', 'nickname', raw), '义工小王')
  assert.equal(admin.displayRecordField('post', 'image', raw), '/义工.png')
  assert.equal(admin.displayRecordField('contract', 'content', raw), '义工工作')
  assert.equal(admin.displayRecordField('post', 'agreementText', raw), '义工协议')
  assert.equal(raw.content, '义工工作')
})
test('changed mini/admin SFCs parse and templates compile without errors', () => {
  const files = ['components/k-display-text/k-display-text.vue', 'pages/community/index.vue', 'pages/community/chat.vue', 'pages/community/mine.vue', 'pages/community/user.vue', 'pages/community/published.vue', 'pages/community/trip.vue', 'pages/messages/index.vue', 'pages/messages/reminders.vue', 'pages/notice/inbox.vue', 'pages/home/index.vue', 'pages/jobs/list.vue', 'pages/jobs/detail.vue', 'pages/jobs/apply.vue', 'pages/jobs/interview.vue', 'pages/jobs/companions.vue', 'pages/jobs/team.vue', 'pages/jobs/contract.vue', 'pages/jobs/notices.vue', 'pages/jobs/components/application-messages.vue', 'pages/jobs/components/multi-apply.vue', 'pages/profile/orders.vue', 'pages/profile/follows.vue', 'pages/profile/opportunities.vue', '../RuoYi-Vue3/src/views/kangaroo/message/index.vue', '../RuoYi-Vue3/src/views/kangaroo/ext/ExtCrud.vue']
  for (const file of files) {
    const { descriptor, errors } = compiler.parse(fs.readFileSync(path.join(app, file), 'utf8'), { filename: file })
    assert.deepEqual(errors, [], file)
    const script = compiler.compileScript(descriptor, { id: file })
    assert.ok(script.content, file)
    const built = compiler.compileTemplate({ id: file, source: descriptor.template.content, filename: file })
    assert.deepEqual(built.errors, [], file)
  }
})
