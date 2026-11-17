// 微信小程序的 WXSS 不支持冒号前不带元素的选择器（如 `.a > :first-child`），编译报错会让整个小程序上传失败。
// 2026-10-11 城市页就因为这一条上传失败过；这里扫一遍所有页面和组件的样式，提前拦住。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['pages', 'components', 'styles']
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(vue|scss|css)$/.test(p)) files.push(p)
  }
}
roots.forEach(walk)

test('no selector starts with a bare pseudo-class after a combinator', () => {
  const bad = []
  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    const styles = f.endsWith('.vue') ? Array.from(src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), m => m[1]) : [src]
    for (const style of styles) {
      const css = style.replace(/\/\*[\s\S]*?\*\//g, '')
      // Vue's :deep() is removed by the compiler, unlike an actual bare pseudo-class.
      for (const hit of css.matchAll(/[>+~]\s*:(?!:|deep\()[a-z-]+/gi)) bad.push(`${f}: ${hit[0]}`)
    }
  }
  assert.deepEqual(bad, [])
})
