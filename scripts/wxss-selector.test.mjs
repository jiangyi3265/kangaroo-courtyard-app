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

// 2026-11-18：Vue 只会转换一个选择器里的第一个 :deep()，`.a :deep(.b) + :deep(.b)` 里第二个原样留进 wxss，
// 微信编译报错，整个分包（攒局）打不开。要写成 `.a :deep(.b + .b)`。
test('no selector uses :deep() twice', () => {
  const bad = []
  for (const f of files) {
    if (!f.endsWith('.vue')) continue
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      const css = m[1].replace(/\/\*[\s\S]*?\*\//g, '')
      for (const rule of css.matchAll(/([^{}]+)\{/g)) {
        for (const sel of rule[1].split(',')) if ((sel.match(/:deep\(/g) || []).length > 1) bad.push(`${f}: ${sel.trim()}`)
      }
    }
  }
  assert.deepEqual(bad, [])
})
