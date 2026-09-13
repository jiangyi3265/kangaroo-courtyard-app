import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, server: { middlewareMode: true } })
const {
  experience, acceptAuthenticatedAccount, enterUserPreview, logout, hasStaffAccess,
  switchMode, savePreferences, visibleMessages, unreadCount, markMessageRead,
  loadApplicationDraft, saveApplicationDraft
} = await server.ssrLoadModule('/common/experience.js')
const { default: R } = await server.ssrLoadModule('/common/routes.js')
await server.close()

const storage = new Map()
globalThis.uni = { getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value) }

test('new users go straight home without preferences, resume, or staff grants', () => {
  logout()
  assert.equal(enterUserPreview(), R.home)
  assert.deepEqual(experience.cities, [])
  assert.equal(hasStaffAccess.value, false)
  assert.equal(switchMode('staff'), R.identity)
  assert.equal(unreadCount.value, 0)
})

test('authenticated active staff grants route directly to work; revoked grants do not', () => {
  assert.equal(acceptAuthenticatedAccount({ id: 'employee', staffGrants: [{ active: true }] }), R.staff)
  assert.equal(switchMode('user'), R.home)
  assert.equal(switchMode('staff'), R.staff)
  assert.equal(acceptAuthenticatedAccount({ id: 'employee', staffGrants: [{ active: false }] }), R.home)
  assert.equal(switchMode('staff'), R.identity)
})

test('preferences and application drafts are isolated by account and survive relogin', () => {
  acceptAuthenticatedAccount({ id: 'alice' })
  savePreferences(['大理'])
  saveApplicationDraft({ name: '测试用户', days: '7' })
  acceptAuthenticatedAccount({ id: 'bob' })
  assert.deepEqual(experience.cities, [])
  assert.deepEqual(loadApplicationDraft(), {})
  acceptAuthenticatedAccount({ id: 'alice' })
  assert.deepEqual(experience.cities, ['大理'])
  assert.equal(loadApplicationDraft().days, '7')
  savePreferences([])
  assert.deepEqual(experience.cities, [])
})

test('notifications and unread counts only include the active recipient and mode', () => {
  acceptAuthenticatedAccount({ id: 'alice', staffGrants: [{ active: true }] })
  switchMode('user')
  experience.messages = [
    { id: 'own', recipientId: 'alice', category: '系统', read: false },
    { id: 'other', recipientId: 'bob', category: '订单', read: false },
    { id: 'work', recipientId: 'alice', mode: 'staff', read: false }
  ]
  assert.deepEqual(visibleMessages.value.map(m => m.id), ['own'])
  assert.equal(unreadCount.value, 1)
  markMessageRead('other')
  assert.equal(experience.messages[1].read, false)
  markMessageRead('own')
  assert.equal(unreadCount.value, 0)
  switchMode('staff')
  assert.equal(unreadCount.value, 1)
  logout()
  assert.equal(unreadCount.value, 0)
  assert.deepEqual(visibleMessages.value, [])
})
