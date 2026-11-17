// 「待申请保险」名单里的续保行（服务端 renew=true，daysLeft 按上一张保单止保日算）：
// 卡片写保单到期日和「几天后到期 / 已过期几天」，已过期的算「超时」，「7日内到店」只放新录用的。
// 跑的是 insurance.vue 真实的 script setup（接口一律挂起不返回），只看名单怎么分栏、怎么写，不涉及 HTTP / 数据库。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')

function load() {
  const parsed = compiler.parse(fs.readFileSync(path.join(APP, 'pages/staff/insurance.vue'), 'utf8'), { filename: 'insurance.vue' })
  assert.equal(parsed.errors.length, 0)
  const source = parsed.descriptor.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console, Date, Math, Promise, JSON, setTimeout, clearTimeout }
  // 其余导入（接口、弹窗等）一律给一个永远不返回的函数：这里不点任何按钮
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, useScreen: () => vue.ref(1), onShow() {}, onHide() {}, onUnload() {},
    experience: vue.reactive({ account: null, mode: 'user' }), staffStores: vue.computed(() => []), currentStaffStore: vue.computed(() => null),
    hasStaffAccess: vue.computed(() => false), getToken: () => '', getSessionRevision: () => 0, currentStaffStoreId: () => null,
    serverTs: s => Date.parse(String(s).replace(' ', 'T') + '+08:00')
  })
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: 'insurance.vue:script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}

test('to-buy list shows renewals by policy end date and keeps 7-day tab for new arrivals', (t) => {
  const h = load()
  t.after(h.stop)
  h.run(`tb.value = { counts: { all: 4, within7: 1, overdue: 1 }, rows: [
    { appId: 1, name: '新录用', arrivalDate: '2026-10-20', daysLeft: 3, renew: false },
    { appId: 2, name: '快到期', arrivalDate: '2026-09-01', lastEnd: '2026-10-16', daysLeft: 3, renew: true },
    { appId: 3, name: '今天到期', arrivalDate: '2026-09-01', lastEnd: '2026-10-13', daysLeft: 0, renew: true },
    { appId: 4, name: '已过期', arrivalDate: '2026-09-01', lastEnd: '2026-10-10', daysLeft: -3, renew: true }
  ] }`)
  const view = () => JSON.parse(JSON.stringify(h.run('pending.value')))
  const all = view()
  assert.deepEqual(all.map(p => p.appId), [1, 2, 3, 4])
  assert.equal(all[0].date, '到店日期　2026-10-20')
  assert.deepEqual(all.slice(1).map(p => [p.date, p.left, p.late]), [
    ['保单到期　2026-10-16', '3 天后到期·待续保', false],
    ['保单到期　2026-10-13', '今天到期·待续保', false],
    ['保单到期　2026-10-10', '已过期 3 天·待续保', true]
  ])
  h.run(`tab.value = 'within7'`)
  assert.deepEqual(view().map(p => p.appId), [1], '「7日内到店」只放新录用的')
  h.run(`tab.value = 'overdue'`)
  assert.deepEqual(view().map(p => p.appId), [4], '保单已过期的算超时')
})
