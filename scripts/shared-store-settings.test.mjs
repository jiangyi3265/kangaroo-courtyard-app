import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as interviewVideo from '../../RuoYi-Vue3/src/utils/interviewVideo.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, '袋鼠旅游2/package.json'))
const vue = require('vue')
const source = fs.readFileSync(path.join(root, 'RuoYi-Vue3/src/views/kangaroo/job/StoreDisplaySettings.vue'), 'utf8')
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*\r?\n/gm, '')
const plain = v => JSON.parse(JSON.stringify(v))
const flush = () => new Promise(resolve => setImmediate(resolve))

async function harness() {
  const calls = [], props = { storeId: 102, busy: false }
  const profile = { storeId: 102, storeName: '已填写的换工门店', managerName: '阿青', interviewMode: 'online', interviewVideo: '/profile/upload/videos/existing.mp4', interviewSeconds: 600, interviewNote: '原采访说明', facilities: ['parking'], inheritFacilities: false }
  // 上面把 import 都去掉了，10-31 新引的提示文字和小判断要放回运行环境（用真的那份）
  const ctx = {
    ...interviewVideo, nextTick: vue.nextTick,
    ref: vue.ref, computed: vue.computed, defineProps: () => props,
    defineEmits: () => () => {}, onBeforeUnmount() {},
    getCurrentInstance: () => ({ proxy: { $auth: { hasPermi: () => true }, $modal: { msgWarning() {} } } }),
    watch: (get, callback) => { ctx.reload = callback; callback() },
    useStoreInterviewVideo: () => ({ videoUi: { running: false }, cancelVideoUpload() {} }),
    getStoreProfile: async () => ({ data: plain(profile) }),
    updateStoreProfile: async (...args) => calls.push(plain(args)),
    defineExpose: api => { ctx.api = api }
  }
  vm.createContext(ctx); vm.runInContext(script, ctx); await flush()
  return { ctx, calls, props, profile, run: value => vm.runInContext(value, ctx) }
}

test('existing shared store data loads without reopening fields or requiring a second save', async () => {
  const h = await harness()
  assert.equal(h.run('profile.value.managerName'), '阿青')
  assert.equal(h.run('profile.value.interviewNote'), '原采访说明')
  assert.deepEqual(plain(h.run('displayFacilities.value')), ['parking'])
  assert.equal(h.run('editing.value'), false)
  assert.equal(await h.ctx.api.saveIfDirty(), false)
  assert.deepEqual(h.calls, [])
})

test('editing one shared field saves only the changed value and then becomes clean', async () => {
  const h = await harness()
  h.run("profile.value.interviewNote = '自己编辑的采访说明'")
  assert.equal(await h.ctx.api.saveIfDirty(), true)
  assert.deepEqual(h.calls, [[102, { interviewNote: '自己编辑的采访说明' }]])
  assert.equal(await h.ctx.api.saveIfDirty(), false)
})

test('switching stores replaces shared data instead of copying the previous store', async () => {
  const h = await harness()
  h.props.storeId = 103
  Object.assign(h.profile, { storeId: 103, storeName: '另一家店', managerName: '小林', interviewNote: '另一家采访' })
  h.run('editing.value = true')
  await h.ctx.reload(); await flush()
  assert.equal(h.run('profile.value.managerName'), '小林')
  assert.equal(h.run('profile.value.interviewNote'), '另一家采访')
  assert.equal(h.run('editing.value'), false)
  assert.equal(await h.ctx.api.saveIfDirty(), false)
})
