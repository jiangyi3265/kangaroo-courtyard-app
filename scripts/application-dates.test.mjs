import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as helpers from '../components/k-application-dates/dates.js'
const require = createRequire(import.meta.url), compiler = require('@vue/compiler-sfc'), vue = require('vue')
const tick = () => new Promise(resolve => setImmediate(resolve))
const src = compiler.parse(fs.readFileSync(new URL('../components/k-application-dates/k-application-dates.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const ast = compiler.babelParse(src, { sourceType: 'module' })
const code = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => src.slice(n.start, n.end)).join('\n')
function harness(merchant = false) {
  const state = { data: { appId: 81, revision: 1, state: 'pending', startDate: '2026-12-01', endDate: '2026-12-30', minDate: '2026-11-09', minDays: 7, canConfirm: !merchant, canEdit: merchant, applicationStart: '2026-11-15', applicationEnd: '2026-12-14' }, failed: false, saveError: null, delayed: null }
  const log = { reads: [], proposals: [], confirms: [], events: [], toasts: [] }, hooks = {}, props = vue.reactive({ appId: 81, merchant }), experience = vue.reactive({ account: { id: merchant ? 8 : 7 } })
  const ctx = vm.createContext({ ...helpers, ...vue, props, experience, console,
    defineProps: () => props, defineEmits: () => (...args) => log.events.push(args),
    onShow: fn => hooks.show = fn, onHide: fn => hooks.hide = fn, onUnmounted: fn => hooks.destroy = fn,
    getSessionRevision: () => 1, getToken: () => state.token || 'fixture', setInterval: fn => { hooks.poll = fn; return 1 }, clearInterval() {},
    shiftDate: (s, n) => new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10), errText: (e, d) => e?.message || d,
    toast: t => log.toasts.push(t), go: url => log.events.push(['navigate', url]), R: { chat: '/chat' },
    apiApplicationDates: async (...args) => { log.reads.push(args); if (state.failed) throw new Error('加载失败'); return { data: structuredClone(state.data) } },
    apiProposeApplicationDates: async (...args) => { log.proposals.push(args); if (state.saveError) throw state.saveError; if (state.delayed) return state.delayed; return { data: { ...state.data, ...args[1], revision: state.data.revision + 1 } } },
    apiConfirmApplicationDates: async (...args) => { log.confirms.push(args); if (state.saveError) throw state.saveError; if (state.delayed) return state.delayed; return { data: { ...state.data, state: 'confirmed', canConfirm: false, confirmedTime: '2026-11-09 20:00:00' } } }
  })
  const scope = vue.effectScope(); scope.run(() => vm.runInContext(code, ctx))
  return { state, log, hooks, experience, props, run: s => vm.runInContext(s, ctx), stop: () => { hooks.destroy(); scope.stop() } }
}
test('日期天数含起止日，拒绝不存在日期、反向、早于岗位开始、短于最短期限和超过365天', () => {
  assert.equal(helpers.dateDays('2028-02-28', '2028-03-01'), 3)
  for (const [a, b] of [['2027-02-29','2027-03-03'], ['2026-12-04','2026-12-01']]) assert.equal(helpers.dateDays(a, b), 0)
  const d = { minDate: '2026-12-01', minDays: 7 }
  assert.equal(helpers.dateError('2026-12-01','2026-12-07',d), '')
  for (const [a,b] of [['2026-11-30','2026-12-30'],['2026-12-01','2026-12-06'],['2026-12-01','2027-12-31']]) assert(helpers.dateError(a,b,d))
})
test('错位响应、无效版本、空日期不冒充已确认计划', () => {
  for (const d of [{appId:82,revision:1,state:'pending'}, {appId:81,revision:-1,state:'confirmed'}, {appId:81,revision:1,state:'confirmed'}]) assert.throws(() => helpers.datePlan(d,81))
})
test('商家选择起止日期，最短期限自动衔接；提交携带当前版本，未确认前不改为已确认', async () => {
  const h = harness(true); await tick(); h.run('edit(); calendar.value = "start"; pickDate("2027-01-01")')
  assert.equal(h.run('end.value'), '2027-01-07')
  await h.run('submit()'); assert.equal(h.log.proposals.length,1); assert.equal(h.log.proposals[0][1].revision,1)
  assert.equal(h.run('data.value.state'),'pending'); assert.equal(h.run('editing.value'),false); h.stop()
})
test('只读员工与未设置计划的用户没有写动作；取消编辑不发送', async () => {
  const h = harness(true); await tick(); h.run('edit(); cancelEdit()'); await tick(); assert.equal(h.log.proposals.length,0)
  h.state.data.canEdit = false; await h.run('load()'); h.run('edit(); submit()'); assert.equal(h.run('editing.value'),false); h.stop()
  const u = harness(); await tick(); u.state.data = { ...u.state.data, revision:0,state:'not_set',canConfirm:false }; await u.run('load()'); await u.run('accept()'); assert.equal(u.log.confirms.length,0); u.stop()
})
test('用户只确认正在查看的版本；重复点击只提交一次，成功更新确认状态', async () => {
  const h = harness(); await tick(); await Promise.all([h.run('accept()'), h.run('accept()')])
  assert.deepEqual(h.log.confirms, [[81,1]]); assert.equal(h.run('data.value.state'),'confirmed'); assert.equal(h.log.events[0][0],'updated'); h.stop()
})
test('旧版本409必须重载新日期，不能自动确认新的版本', async () => {
  const h = harness(); await tick(); h.state.data.revision=2; h.state.data.startDate='2026-12-02'; h.state.saveError={code:409,message:'时间段已更新'}
  await h.run('accept()'); await tick(); assert.equal(h.run('data.value.revision'),2); assert.equal(h.run('data.value.state'),'pending'); assert.deepEqual(h.log.confirms,[[81,1]]); h.stop()
})
test('断网失败保留待确认，编辑时不轮询覆盖草稿；重新显示时刷新', async () => {
  const h = harness(true); await tick(); h.run('edit()'); const count=h.log.reads.length; h.hooks.poll(); assert.equal(h.log.reads.length,count)
  h.state.saveError=new Error('断网'); await h.run('submit()'); assert.equal(h.run('editing.value'),true); assert.equal(h.run('data.value.state'),'pending')
  h.hooks.hide(); h.state.data.revision=3; h.hooks.show(); await tick(); assert.equal(h.run('data.value.revision'),3); h.stop()
})
test('换号或关闭页面后迟到的确认不污染新会话，也不弹成功提示', async () => {
  const h = harness(); await tick(); let resolve; h.state.delayed=new Promise(r=>resolve=r); h.run('accept()'); h.hooks.hide()
  resolve({data:{...h.state.data,state:'confirmed'}}); await tick(); assert.equal(h.log.events.length,0); assert.equal(h.log.toasts.length,0)
  h.experience.account={id:9}; await tick(); assert.equal(h.run('data.value'),null); h.stop()
})
