import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as interviewVideo from '../../RuoYi-Vue3/src/utils/interviewVideo.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const code = fs.readFileSync(path.join(root, 'RuoYi-Vue3/src/composables/useStoreInterviewVideo.js'), 'utf8')
  .replace(/^import .*\r?\n/gm, '').replace('export function', 'function')
function harness(options = {}) {
  const calls = [], videos = [], cleanup = [], errors = []
  const profile = { value: { storeId: 102 } }, profileOpen = { value: true }
  // 上面把 import 都去掉了，10-31 新引的提示文字和小判断要放回运行环境（用真的那份）
  const context = {
    ...interviewVideo,
    ref: value => ({ value }), reactive: value => value, onBeforeUnmount: fn => cleanup.push(fn),
    setTimeout, clearTimeout, AbortController, isFinite, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    document: { createElement: () => { const video = { duration: 60, load() {}, removeAttribute() {} }; videos.push(video); return video } },
    beginStoreVideoUpload: async data => { calls.push(data); return { data: { uploadId: 'test', partBytes: 100, parts: 1 } } },
    uploadStoreVideoPart: async () => {}, finishStoreVideoUpload: async () => ({ data: { url: '/profile/upload/videos/test.mp4' } }), abortStoreVideoUpload: async () => {},
    options, profile, profileOpen, proxy: { $modal: { msgError: message => errors.push(message), msgSuccess() {} } }
  }
  vm.createContext(context)
  vm.runInContext(code + '\nthis.api = useStoreInterviewVideo({...options, profile, profileOpen, proxy})', context)
  const event = () => ({ target: { value: 'video', files: [{ name: 'test.mp4', size: 64, slice: () => new Uint8Array(64) }] } })
  return { ...context, calls, videos, cleanup, errors, event }
}
test('读取视频信息时取消，随后收到元数据也不会发起上传', async () => {
  const h = harness(), chosen = h.api.onVideoChosen(h.event())
  assert.equal(h.api.videoUi.running, true)
  h.api.cancelVideoUpload()
  h.videos[0].onloadedmetadata()
  await chosen
  assert.equal(h.calls.length, 0)
  assert.equal(h.api.videoUi.running, false)
})
test('关闭表单或切换门店，不会把迟到的视频上传到另一家店', async () => {
  for (const action of ['unmount', 'store']) {
    const h = harness(), chosen = h.api.onVideoChosen(h.event())
    if (action === 'unmount') h.cleanup.forEach(fn => fn())
    else h.profile.value.storeId = 103
    h.videos[0].onloadedmetadata()
    await chosen
    assert.equal(h.calls.length, 0)
    assert.equal(h.api.videoUi.running, false)
  }
})
test('视频信息校验完成后正常分段上传，写入当前门店表单并结束忙碌态', async () => {
  const h = harness(), chosen = h.api.onVideoChosen(h.event())
  h.videos[0].onloadedmetadata()
  await chosen
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].duration, 60)
  assert.equal(h.profile.value.interviewVideo, '/profile/upload/videos/test.mp4')
  assert.equal(h.profile.value.interviewSeconds, 60)
  assert.equal(h.api.videoUi.running, false)
})

// 2026-10-31 主人拍板去掉 60 秒下限：原来钉死 59、59.99 必须拒，现在多短都能传；时长无效仍然不上传
test('采访视频多短都能传，60秒和超过原5分钟上限也能正常上传', async () => {
  for (const seconds of [0.5, 5, 59, 59.99, 60, 301.5, 1800]) {
    const h = harness(), chosen = h.api.onVideoChosen(h.event())
    h.videos[0].duration = seconds
    h.videos[0].onloadedmetadata()
    await chosen
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.calls.length, 1)
    assert.deepEqual(h.errors, [])
    assert.equal(h.calls[0].duration, seconds)
  }
})

test('房源短视频使用独立上传接口，允许不足60秒并只更新当前表单', async () => {
  const saved = []
  const h = harness({ limits: { maxSeconds: 180, maxBytes: 100 * 1024 * 1024 }, api: {
    begin: async data => { saved.push(data); return { data: { uploadId: 'stay', parts: 1, partBytes: 100 } } },
    append: async () => {}, finish: async () => ({ data: { url: '/profile/upload/videos/stay.mp4' } }), abort: async () => {}
  } })
  const chosen = h.api.onVideoChosen(h.event()); h.videos[0].duration = 8; h.videos[0].onloadedmetadata(); await chosen
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(saved[0].duration, 8); assert.equal(h.calls.length, 0)
  assert.equal(h.profile.value.interviewVideo, '/profile/upload/videos/stay.mp4')
})

test('小院和房型/日常视频分别校验3分钟和1分钟上限', async () => {
  for (const [maxSeconds, duration, accepted] of [[180,180,true],[180,182,false],[60,8,true],[60,62,false]]) {
    const h = harness({ limits: { maxSeconds } }), chosen = h.api.onVideoChosen(h.event())
    h.videos[0].duration = duration; h.videos[0].onloadedmetadata(); await chosen
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(h.calls.length, accepted ? 1 : 0)
    if (!accepted) assert.match(h.errors[0], /不能超过/)
  }
})

test('后台短视频超出体积上限时在读取和上传前拒绝', async () => {
  const h = harness({ limits: { maxSeconds: 60, maxBytes: 50 * 1024 * 1024 } }), event = h.event()
  event.target.files[0].size = 51 * 1024 * 1024
  await h.api.onVideoChosen(event)
  assert.equal(h.videos.length, 0); assert.equal(h.calls.length, 0); assert.match(h.errors[0], /超过 50MB/)
})
