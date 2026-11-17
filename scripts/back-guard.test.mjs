import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

// 系统返回拦截（common/back-guard.js）：每页只有栈顶顶栏的拦截生效；navigateBack 前先撤掉当前页的拦截再真正返回
const source = await readFile(new URL('../common/back-guard.js', import.meta.url), 'utf8')
let pages = []
let interceptor = null
const backs = []
globalThis.getCurrentPages = () => pages
globalThis.uni = {
  addInterceptor: (name, hook) => { assert.equal(name, 'navigateBack'); interceptor = hook },
  navigateBack: (args) => { if (interceptor.invoke(args) !== false) backs.push(args) }
}
const mod = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const page = (id) => ({ getPageId: () => id })
const guard = () => ({ armed: { value: false }, enabled: () => true })
const wait = (ms) => new Promise(r => setTimeout(r, ms))

test('only the newest top bar on a page intercepts, the previous one takes over when it leaves', async () => {
  pages = [page('p1')]
  const a = guard(), b = guard()
  mod.addGuard('p1', a)
  await wait(120)
  assert.equal(a.armed.value, true)
  mod.addGuard('p1', b)
  assert.equal(a.armed.value, false)
  await wait(120)
  assert.deepEqual([a.armed.value, b.armed.value], [false, true])
  mod.removeGuard('p1', b)
  await wait(120)
  assert.equal(a.armed.value, true)
  mod.removeGuard('p1', a)
})

test('navigateBack first releases the guard of the current page, then really goes back', async () => {
  mod.installBackGuard()
  pages = [page('p1'), page('p2')]
  const g = guard()
  mod.addGuard('p2', g)
  await wait(120)
  assert.equal(g.armed.value, true)
  uni.navigateBack({ delta: 1 })
  assert.equal(g.armed.value, false)
  assert.equal(backs.length, 0)
  await wait(120)
  assert.deepEqual(backs, [{ delta: 1 }])
  // 页面已经退掉：不再把拦截挂回去
  pages = [page('p1')]
  await wait(700)
  assert.equal(g.armed.value, false)
  mod.removeGuard('p2', g)
})

test('navigateBack on a page without an active guard is not delayed', () => {
  pages = [page('p1'), page('p3')]
  backs.length = 0
  uni.navigateBack({})
  assert.equal(backs.length, 1)
})

test('top bar wires the hidden container only for custom-back and only in the mini program', async () => {
  const bar = await readFile(new URL('../components/k-topbar/k-topbar.vue', import.meta.url), 'utf8')
  assert.match(bar, /#ifdef MP-WEIXIN -->\s*<!--[^>]*-->\s*<page-container v-if="customBack && back && !parked" :show="armed"/)
  assert.match(bar, /@beforeleave="onSystemBack"/)
  const app = await readFile(new URL('../App.vue', import.meta.url), 'utf8')
  assert.match(app, /#ifdef MP-WEIXIN[\s\S]*installBackGuard\(\)[\s\S]*#endif/)
})

test('the hidden back-guard container must not freeze page scrolling', async () => {
  // 微信基础库 page-container 显示时给 body 写行内 position: fixed（togglePageScroll），整页滑不动；App.vue 用 !important 盖掉
  const app = await readFile(new URL('../App.vue', import.meta.url), 'utf8')
  assert.match(app, /#ifdef MP-WEIXIN \*\/[\s\S]*?page \{\s*position: static !important;\s*top: auto !important;\s*\}[\s\S]*?#endif/)
})
