import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, babelParse } from '@vue/compiler-sfc'
import { ref, computed } from 'vue'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const choices = [
  { value: 'user', label: '支持用户' },
  { value: 'merchant', label: '支持店家' },
  { value: 'both', label: '双方均有责' },
  { value: 'insufficient', label: '证据不足' }
]

function page(name) {
  const source = fs.readFileSync(path.join(appRoot, 'pages/governance', name + '.vue'), 'utf8')
  const descriptor = parse(source).descriptor
  const script = descriptor.scriptSetup.content
  const statements = babelParse(script, { sourceType: 'module' }).program.body
  const body = statements.filter(node => node.type !== 'ImportDeclaration')
    .map(node => script.slice(node.start, node.end)).join('\n')
  const scope = vm.createContext({ ref, computed, onLoad() {}, onShow() {}, onHide() {}, onUnload() {}, watch() {}, getMessageScopeKey:()=> 'fixture', states: {}, juryChoices: choices, choices })
  vm.runInContext(body, scope)
  return { template: descriptor.template.content, run: expression => vm.runInContext(expression, scope) }
}

test('匿名投票理由选填，同时保留1000字限制和提交状态限制', () => {
  const { template, run } = page('jury')
  const disabled = template.match(/<button class="primary" :disabled="([^"]+)" @click="vote">提交评审意见/)[1]
    .replace(/\b(busy|choice|reason)\b/g, '$1.value')
  run("choice.value='both'")
  assert.equal(run(disabled), false)
  run("reason.value='认可'")
  assert.equal(run(disabled), false)
  run("reason.value='字'.repeat(1000)")
  assert.equal(run(disabled), false)
  run("reason.value='字'.repeat(1001)")
  assert.equal(run(disabled), true)
  run("reason.value='';busy.value=true")
  assert.equal(run(disabled), true)
  assert.match(template, /选填，简要说明判断依据，最多1000字/)
})

test('城市负责人能看到票数及匿名评审理由，普通当事人界面保留权限条件', () => {
  const { template, run } = page('mediation')
  run(`detail.value={viewerRole:'city',jury:{status:'closed',resultJson:JSON.stringify({both:2,reasons:[{choice:'both',reason:'照片表明双方在交接时均应说明住宿安排'}]})}}`)
  assert.equal(run('juryOpinions.value.length'), 1)
  assert.equal(run('juryOpinions.value[0].reason'), '照片表明双方在交接时均应说明住宿安排')
  assert.match(run('jurySummary(detail.value.jury.resultJson)'), /双方均有责 2票/)
  assert.match(template, /v-if="isCity&&detail.jury.status==='closed'"/)
  assert.match(template, /{{opinion.reason}}/)
  assert.doesNotMatch(template, /v-html/)
})

test('旧评审结果没有理由、空值或异常格式时可以正常查看', () => {
  const { run } = page('mediation')
  for (const raw of [null, 'null', '{}', '{"both":1}', '[]', 'invalid']) {
    run(`detail.value={jury:{resultJson:${JSON.stringify(raw)}}}`)
    assert.equal(run('juryOpinions.value.length'), 0)
  }
  run(`detail.value={jury:{resultJson:{both:1,reasons:[null,{choice:'both',reason:''},{choice:'invalid',reason:'无效选项'},{choice:'both',reason:'具体判断依据'}]}}}`)
  assert.equal(run('juryOpinions.value.length'), 1)
  assert.match(run('jurySummary(detail.value.jury.resultJson)'), /双方均有责 1票/)
})
