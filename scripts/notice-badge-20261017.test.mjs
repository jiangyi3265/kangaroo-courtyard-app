// 2026-10-17 主人反馈「消息和系统通知的角标消不掉，所有消息我都阅读过了」的回归（node --test，不构建、不发请求）。
// 原因：报名过线上任务后多出一条要弹窗的公告「线上兼职须知」（audience=online、popup=1）。进「系统通知」时要弹窗的公告不记「看过」
// （留给首页弹窗），弹窗又没出来，「系统通知」角标就一直是 1；左上角「全部已读」也不碰公告。
// 现在：进过「系统通知」或点了「全部已读」，公告就不再算进角标（另记一份「角标已清」）；要弹窗的公告照样在首页弹一次（弹窗只看「看过」）。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const store = new Map()
globalThis.uni = {
  getStorageSync: (k) => (store.has(k) ? store.get(k) : ''),
  setStorageSync: (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))) },
  removeStorageSync: (k) => { store.delete(k) }
}
const notice = await import('../common/notice.js')
const messages = await read('../pages/messages/index.vue')
const inbox = await read('../pages/notice/inbox.vue')

test('角标规则：没看过当前版本、也没清过当前版本的角标才算；版本更新后又会算', () => {
  const n = { noticeId: 1, version: 2, read: false, popup: true }
  assert.equal(notice.noticeBadged(n, {}, {}), true)
  assert.equal(notice.noticeBadged({ ...n, read: true }, {}, {}), false, '服务器记着看过')
  assert.equal(notice.noticeBadged(n, { 1: 2 }, {}), false, '本机看过当前版本')
  assert.equal(notice.noticeBadged(n, {}, { 1: 2 }), false, '角标清过当前版本')
  assert.equal(notice.noticeBadged(n, {}, { 1: 1 }), true, '只清过旧版本，改了内容要再提醒')
})

test('清角标：记下当前版本、只增不减；不动「看过」（首页弹窗照样弹）', () => {
  store.clear()
  const cleared = notice.clearNoticeBadge([{ noticeId: 1, version: 2 }, { noticeId: 'x', version: 1 }])
  assert.deepEqual(cleared, { 1: 2 })
  assert.deepEqual(notice.clearNoticeBadge([{ noticeId: 1, version: 1 }]), { 1: 2 }, '不会退回旧版本')
  assert.deepEqual(notice.readNoticeBadgeCleared(), { 1: 2 })
  assert.deepEqual(notice.readSeenNotices(), {}, '弹窗看的「看过」记录没被动')
})

test('进「系统通知」清掉所有新公告的角标（含要弹窗的）；消息页角标按新规则算，「全部已读」也清公告角标', () => {
  assert.match(inbox, /clearNoticeBadge\(notices\.value\.filter\(n => n\.fresh\)\)/)
  assert.match(inbox, /if \(n\.fresh && !n\.popup\) rememberNoticeSeen/, '要弹窗的公告仍不记「看过」')
  assert.match(messages, /const unseenNotices = computed\(\(\) => notices\.value\.filter\(n => noticeBadged\(n, noticeSeen\.value, badgeCleared\.value\)\)\.length\)/)
  assert.match(messages, /badgeCleared\.value = readNoticeBadgeCleared\(\)/)
  assert.match(messages, /await markAllMessagesRead\(\)\s+badgeCleared\.value = clearNoticeBadge\(notices\.value\)/)
})
