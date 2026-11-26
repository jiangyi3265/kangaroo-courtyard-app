// k-icon 找不到图标名时会退回空心圆（components/k-icon/k-icon.vue），页面上看就是一个莫名其妙的圆圈。
// 2026-10-13 线上岗位详情「排班方式」就是这样（calendar-range 不在图标库里）；这里把写死的图标名都对一遍 common/icons.js。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse, babelParse, walk: walkAst } = require('@vue/compiler-sfc')

const src = readFileSync('common/icons.js', 'utf8')
const icons = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1))
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(vue|js)$/.test(p)) files.push(p)
  }
}
;['pages', 'components'].forEach(walk)
// name 只有属于 k-icon 才是图标名；slot / input 等元素的 name 不应误算。
// icon prop 和脚本里 icon 字段仍检查，不以插槽名白名单绕过非法图标。
const NOT_ICONS = new Set(['none'])
function literalIcons(source, isVue = true) {
  const names = []
  let script = source
  if (isVue) {
    const { descriptor, errors } = parse(source)
    assert.deepEqual(errors, [])
    const walk = node => {
      if (node.type === 1) for (const prop of node.props || []) {
        if (prop.type === 6 && prop.value && (prop.name === 'icon' || (node.tag === 'k-icon' && prop.name === 'name'))) names.push(prop.value.content)
      }
      for (const child of node.children || []) walk(child)
    }
    if (descriptor.template?.ast) walk(descriptor.template.ast)
    script = [descriptor.script?.content, descriptor.scriptSetup?.content].filter(Boolean).join('\n')
  }
  if (/\bicon\s*:/.test(script)) {
    const nativeToastOptions = new Set()
    const ast = babelParse(script, { sourceType: 'module', errorRecovery: true, plugins: ['typescript'] })
    walkAst(ast.program, { enter(node, parent) {
      if (node.type === 'CallExpression' && node.callee.object?.name === 'uni' && node.callee.property?.name === 'showToast') {
        nativeToastOptions.add(node.arguments[0])
      }
      if (node.type === 'ObjectProperty' && node.key.name === 'icon' && node.value.type === 'StringLiteral' &&
          /^[a-z][a-z0-9-]*$/.test(node.value.value) && !nativeToastOptions.has(parent)) {
        names.push(node.value.value)
      }
    } })
  }
  return names
}

test('scanner distinguishes slot names from icons and still catches invalid icons', () => {
  assert.deepEqual(literalIcons('<template><slot name="subscription"/><input name="nickname"/><k-icon name="bell"/><k-button icon="check"/></template>'), ['bell', 'check'])
  assert.deepEqual(literalIcons('<template><k-icon name="subscription"/><k-icon :name="dynamic"/></template><script setup>const a = { icon: "not-a-real-icon" }</script>'), ['subscription', 'not-a-real-icon'])
  assert.ok(!icons.subscription)
  assert.ok(icons.bell)
  assert.deepEqual(literalIcons("uni.showToast({ title: '完成', icon: 'success' }); const action = { icon: 'success' }", false), ['success'])
})

test('every literal icon name exists in common/icons.js', () => {
  const missing = []
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    for (const n of literalIcons(s, f.endsWith('.vue'))) {
      if (!icons[n] && !NOT_ICONS.has(n)) missing.push(`${f}: ${n}`)
    }
  }
  assert.deepEqual(missing, [])
})
