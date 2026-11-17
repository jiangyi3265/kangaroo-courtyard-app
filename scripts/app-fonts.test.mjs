import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Exercise the actual native launch hook, including statement boundaries between font registrations.
const source = readFileSync(new URL('../App.vue', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/^\s*import .+$/gm, '')
  .replace('export default', 'globalThis.app =')
function launch(wx, origin = 'https://daishu.oksja.cn') {
  let sessionCalls = 0
  const context = vm.createContext({ wx, API_BASE: origin, ensureSession: () => { sessionCalls++ }, noteInviter() {}, installBackGuard() {}, startNewsPolling() {}, stopNewsPolling() {}, console })
  vm.runInContext(source, context)
  context.app.onLaunch({})
  assert.equal(sessionCalls, 1)
}
test('native startup registers shared fonts without interrupting app launch', () => {
  const calls = []
  launch({ loadFontFace(options) { calls.push(options) } })
  assert.deepEqual(calls.filter(x => x.family === 'KG Detail').map(x => x.desc.weight), ['400', '500', '600', '700', '900'])
  assert.equal(calls.filter(x => x.family === 'KG Sans').length, 2)
  for (const options of calls) { assert.equal(options.global, true); assert.match(options.source, /^url\("https:\/\/daishu\.oksja\.cn\/static\/h5\/fonts\//); options.fail() }
})
test('missing font support or a development proxy does not block native startup', () => {
  launch({})
  launch({ loadFontFace() { throw new Error('A relative proxy must not be used as a native font origin') } }, '/dev-api')
})
