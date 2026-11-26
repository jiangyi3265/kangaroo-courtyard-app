import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function page(file, stubs) {
  const sfc = readFileSync(new URL('../pages/community/' + file + '.vue', import.meta.url), 'utf8')
  const code = sfc.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
  const hooks = {}
  const scope = vm.createContext({
    ref: value => ({value}), computed: get => ({get value() { return get() }}),
    onLoad: fn => { hooks.open = fn }, onUnload: fn => { hooks.leave = fn }, onReachBottom() {},
    useScreen: (_, options) => { hooks.open = options.onLoad },
    ...stubs
  })
  vm.runInContext(code, scope)
  return {hooks, run: s => vm.runInContext(s, scope)}
}

test('double confirmation keeps the publisher open and closes the picker just once', () => {
  let backs = 0
  const results = []
  const p = page('link', {
    linkRequest: () => ({current: {type: 'job', id: 7, title: '前台'}}), linkView: x => x,
    finishLinkPicker: (id, row) => results.push([id, row]), back: () => { backs++ },
    apiPostLinkables: async () => ({data: {rows: []}})
  })
  p.hooks.open({request: '1'})
  p.run("confirmSelection(); choose('none')")
  assert.equal(backs, 1)
  assert.equal(results.length, 1)
  assert.equal(results[0][1].title, '前台')
})

test('back while a link search is pending cancels selection and silences its late error', async () => {
  let reject
  const messages = [], results = []
  const p = page('link', {
    linkRequest: () => null, linkView: x => x,
    apiPostLinkables: () => new Promise((_, fail) => { reject = fail }),
    uni: {showToast: entry => messages.push(entry)}, errText: e => e.message,
    finishLinkPicker: (id, row) => results.push([id, row])
  })
  p.hooks.open({request: '42'})
  p.hooks.leave()
  reject(Error('旧请求失败'))
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(results, [['42', null]])
  assert.equal(messages.length, 0)
})

test('organizer can retry a failed session restore from the check-in page', async () => {
  let attempts = 0, reads = 0
  const p = page('activity-checkin', {
    ensureSession: async () => { if (++attempts === 1) throw Error('网络不可用') },
    apiStaffActivityCheckinCode: async () => { reads++; return {data: {pin: '012345'}} },
    errText: e => e.message
  })
  await p.hooks.open({id: '13'})
  assert.equal(p.run('loading.value'), false)
  assert.equal(p.run('loadError.value'), '网络不可用')
  await p.run('load()')
  assert.equal(reads, 1)
  assert.equal(p.run('info.value.pin'), '012345')
})

test('PIN-only check-in directs participants to enter the number', async () => {
  const p = page('activity-checkin', {
    ensureSession: async () => {}, apiStaffActivityCheckinCode: async () => ({data: {pin: '012345', code: {state: 'error'}}})
  })
  await p.hooks.open({id: '13'})
  assert.match(p.run('wxFailText.value'), /输入.*签到码/)
  assert.doesNotMatch(p.run('wxFailText.value'), /这张二维码/)
})
