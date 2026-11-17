import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fullDirection, landscapeTurn } from '../pages/stays/stays-media.js'
const require = createRequire(import.meta.url)
const vue = require('vue'), compiler = require('@vue/compiler-sfc')
const source = fs.readFileSync(new URL('../pages/stays/stay-video-player.vue', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const js = compiler.parse(source).descriptor.scriptSetup.content.replace(/\/\/ #ifdef H5[\s\S]*?\/\/ #endif/g, '')
const body = compiler.babelParse(js, { sourceType: 'module' }).program.body.filter(n => n.type !== 'ImportDeclaration').map(n => js.slice(n.start, n.end)).join('\n')
function player(landscape = false) {
  const props = vue.reactive({ src: '/video.mp4', poster: '', title: '', landscape })
  const calls = [], events = [], ticks = new Map(), unmount = []
  let id = 0
  const ctx = { requestFullScreen: o => calls.push(JSON.parse(JSON.stringify(o))), stop: () => calls.push('stop') }
  const sandbox = { ...vue, fullDirection, landscapeTurn, absUrl: x => x, defineProps: () => props, defineEmits: () => e => events.push(e),
    getCurrentInstance: () => ({ uid: 1, proxy: {} }), onBeforeUnmount: f => unmount.push(f),
    setTimeout: f => { ticks.set(++id, f); return id }, clearTimeout: n => ticks.delete(n),
    uni: { getSystemInfoSync: () => ({ statusBarHeight: 20 }), createVideoContext: () => ctx, showToast() {} } }
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body + '\n;globalThis.api = { onMeta, onFull, close }', sandbox))
  return { ...sandbox.api, props, calls, events, fallback: () => [...ticks.values()].forEach(f => f()),
    dispose: () => { unmount.forEach(f => f()); scope.stop() } }
}
test('评价视频指定横屏，包括竖拍素材；重复元数据不会反复请求', async () => {
  const p = player(true)
  p.onMeta({ detail: { width: 720, height: 1280 } }); await vue.nextTick()
  p.onMeta({ detail: { width: 720, height: 1280 } }); await vue.nextTick()
  assert.deepEqual(p.calls, [{ direction: 90 }])
  p.onFull({ detail: { fullScreen: true } }); p.onFull({ detail: { fullScreen: false } })
  assert.deepEqual(p.events, ['close'])
  p.dispose()
})
test('元数据缓慢时，评价仍请求横屏；默认播放器允许修正自动方向', async () => {
  const review = player(true)
  review.fallback(); await vue.nextTick()
  assert.deepEqual(review.calls, [{ direction: 90 }]); review.dispose()
  const normal = player()
  normal.fallback(); await vue.nextTick()
  normal.onMeta({ detail: { width: 1280, height: 720 } }); await vue.nextTick()
  assert.deepEqual(normal.calls, [{}, { direction: 90 }]); normal.dispose()
})
test('详情和生活碎片的竖视频继续竖屏，关闭或卸载后不会迟到请求全屏', async () => {
  const normal = player()
  normal.onMeta({ detail: { width: 720, height: 1280 } }); await vue.nextTick()
  assert.deepEqual(normal.calls, [{ direction: 0 }]); normal.dispose()
  for (const action of ['close', 'dispose']) {
    const p = player(true)
    p.onMeta({ detail: { width: 1280, height: 720 } }); p[action](); await vue.nextTick()
    assert.deepEqual(p.calls, [])
    if (action === 'close') p.dispose()
  }
})
test('切换视频丢弃上一个视频的待处理全屏请求', async () => {
  const p = player(true)
  p.props.src = '/second.mp4'
  p.onMeta({ detail: { width: 1280, height: 720 } }); await vue.nextTick()
  assert.deepEqual(p.calls, [])
  p.onMeta({ detail: { width: 1280, height: 720 } }); await vue.nextTick()
  assert.deepEqual(p.calls, [{ direction: 90 }]); p.dispose()
})
