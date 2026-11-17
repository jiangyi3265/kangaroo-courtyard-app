import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { parse, babelParse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'

const pageUrl = new URL('../pages/governance/mediation.vue', import.meta.url)
const source = parse(fs.readFileSync(pageUrl, 'utf8')).descriptor.scriptSetup.content
const body = babelParse(source, { sourceType: 'module' }).program.body
  .filter(node => node.type !== 'ImportDeclaration')
  .map(node => source.slice(node.start, node.end)).join('\n')
const choices = [{ value: 'user', label: '支持用户' }, { value: 'both', label: '双方均有责' }]
const sample = () => ({
  caseId: 7, viewerRole: 'city', canHandle: true, status: 'ready',
  jury: { status: 'closed', resultJson: '{"user":1,"both":1}' },
  votes: [{ voteId: 41, choice: 'user', reason: '', valid: '1', cityAdopted: null },
    { voteId: 42, choice: 'both', reason: '照片支持双方补充沟通', valid: '1', cityAdopted: null }]
})
function fixture() {
  const requests = [], current = sample()
  const context = vm.createContext({
    ref, computed, onLoad() {}, onShow() {}, states: { ready: '待裁决' }, juryChoices: choices,
    uni: {}, get: async path => ({ data: path === 'context' ? {} : current }),
    post: async (path, data) => { requests.push({ path, data }); return { data: null } }
  })
  vm.runInContext(body, context)
  context.sample = current
  const run = code => vm.runInContext(code, context)
  run('detail.value=sample;caseId.value=7;setAdoptionValues()')
  return { run, requests }
}

test('个人采纳保留未知，不能用整体采纳开关代替逐条核定', async () => {
  const h = fixture()
  h.run('decision.value.juryAdopted=true')
  await h.run('submitDecision()')
  assert.equal(h.run('adoptionReady.value'), false)
  assert.equal(h.run('adoptionValues.value[41]'), '')
  assert.equal(h.requests.length, 0)
  assert.match(h.run('error.value'), /逐条核定/)
})

test('逐条选择只提交已采纳票号，空选填理由仍可核定采纳', async () => {
  const h = fixture()
  h.run("adoptionValues.value={41:'1',42:'0'}")
  await h.run('submitDecision()')
  assert.equal(h.requests[0].path, 'cases/7/decision')
  assert.deepEqual(Array.from(h.requests[0].data.adoptedVoteIds), [41])
})

test('明确全部未采纳使用空数组，和未知字段状态有区别', async () => {
  const h = fixture()
  h.run("adoptionValues.value={41:'0',42:'0'}")
  await h.run('submitDecision()')
  assert.ok(Object.hasOwn(h.requests[0].data, 'adoptedVoteIds'))
  assert.equal(h.requests[0].data.adoptedVoteIds.length, 0)
})

test('重载已核定记录保留三态，非处理人只能读取', () => {
  const h = fixture()
  h.run("detail.value.votes[0].cityAdopted='0';detail.value.votes[1].cityAdopted='1';setAdoptionValues()")
  assert.equal(h.run('adoptionValues.value[41]'), '0')
  assert.equal(h.run('adoptionValues.value[42]'), '1')
  assert.equal(h.run('canRecordAdoption.value'), true)
  h.run('detail.value.canHandle=false')
  assert.equal(h.run('canRecordAdoption.value'), false)
})

test('兼容只有历史理由摘要的轮次，并保留复杂纠纷核心优先选项', () => {
  const h = fixture()
  h.run("detail.value.votes=[];detail.value.jury.resultJson=JSON.stringify({both:1,reasons:[{choice:'both',reason:'历史匿名理由'}]})")
  assert.equal(h.run('juryOpinions.value[0].reason'), '历史匿名理由')
  assert.equal(h.run('jury.value.corePriority'), false)
})

test('三个调解界面模板和脚本均可编译，后台区分敷衍及其他无效原因', () => {
  const files = [pageUrl, new URL('../pages/governance/jury.vue', import.meta.url),
    new URL('../../RuoYi-Vue3/src/views/kangaroo/governance/index.vue', import.meta.url)]
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    const result = parse(text, { filename: file.pathname })
    assert.deepEqual(result.errors, [])
    compileScript(result.descriptor, { id: 'gold-juror-check' })
    assert.deepEqual(compileTemplate({ source: result.descriptor.template.content, filename: file.pathname, id: 'gold-juror-check' }).errors, [])
  }
  const admin = fs.readFileSync(files[2], 'utf8')
  assert.match(admin, /value="perfunctory"/)
  assert.match(admin, /value="invalid"/)
  assert.match(admin, /缺席和空理由不自动判定为敷衍/)
  assert.match(admin, /restoration\.logId/)
})
