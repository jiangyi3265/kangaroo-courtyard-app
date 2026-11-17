import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../pages/werewolf/room.vue', import.meta.url), 'utf8')
const settingsSource = source.slice(source.indexOf('function settings()'), source.indexOf('const send ='))

function fixture(host, succeeds = true) {
  const actions = []
  const context = vm.createContext({
    uni: { showToast() {} },
    isHost: { value: host },
    room: { value: { speechSeconds: 90, nightSeconds: 45, voteSeconds: 45, allowExtension: true } },
    draftSettings: { value: {} }, showSettings: { value: false },
    act: async (action, data) => {
      actions.push({ action, ...data })
      return succeeds ? { ok: true } : null
    }
  })
  vm.runInContext(settingsSource, context)
  return { context, actions }
}

test('opening settings shows room values without mutating the room', () => {
  const { context, actions } = fixture(true)
  vm.runInContext('settings()', context)
  assert.equal(context.showSettings.value, true)
  assert.equal(context.draftSettings.value.speechSeconds, 90)
  context.draftSettings.value.speechSeconds = 120
  assert.equal(context.room.value.speechSeconds, 90)
  assert.equal(actions.length, 0)
  assert.ok(source.includes('values: [30, 45, 60, 90, 120]'))
})

test('host saves all settings and closes only after success', async () => {
  const { context, actions } = fixture(true)
  vm.runInContext('settings()', context)
  context.draftSettings.value = { speechSeconds: 120, nightSeconds: 60, voteSeconds: 30, allowExtension: false }
  await vm.runInContext('saveSettings()', context)
  assert.deepEqual(actions, [{ action: 'settings', speechSeconds: 120, nightSeconds: 60, voteSeconds: 30, allowExtension: false }])
  assert.equal(context.showSettings.value, false)
})

test('failed save preserves the open form and values for retry', async () => {
  const { context, actions } = fixture(true, false)
  vm.runInContext('settings()', context)
  context.draftSettings.value.speechSeconds = 120
  await vm.runInContext('saveSettings()', context)
  assert.equal(context.showSettings.value, true)
  assert.equal(context.draftSettings.value.speechSeconds, 120)
  assert.equal(actions.length, 1)
})

test('other participants can view settings and cannot submit changes', async () => {
  const { context, actions } = fixture(false)
  vm.runInContext('settings()', context)
  assert.equal(context.showSettings.value, true)
  await vm.runInContext('saveSettings()', context)
  assert.equal(actions.length, 0)
  assert.ok(source.includes(':disabled="!isHost || busy"'))
})
