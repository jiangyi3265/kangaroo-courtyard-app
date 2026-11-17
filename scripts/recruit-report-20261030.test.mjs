// 换工主理人的招募账日报、换工招募情况周报（2026-10-30）：页面读服务端字段，旅居账 / 代运营周报的老文字留作兜底。
// 用法：node --test scripts/recruit-report-20261030.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const sfc = (p) => parse(read(p), { filename: p }).descriptor

for (const p of ['pages/manage/daily.vue', 'pages/manage/weekly.vue']) {
  test(p + ' 能编译', () => {
    const d = sfc(p)
    const script = compileScript(d, { id: 'x' })
    assert.ok(script.content.length > 0)
    const t = compileTemplate({ source: d.template.content, filename: p, id: 'x', compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(t.errors, [])
  })
}

test('日报：标题、小节、说明、收件人跟服务端走，旅居账文字兜底', () => {
  const s = read('pages/manage/daily.vue')
  for (const k of ['d.value.title', 'd.sectionTitle', 'd.dataNote', 'd.sourceText', 'd.recipientTitle', 'd.value.recipientNote', 'd.value.recipientEmpty']) assert.ok(s.includes(k), k)
  for (const k of ['每日经营报表', '系统数据（自动同步）', '发送给换工主理人', '总营收']) assert.ok(s.includes(k), k)
})

test('日报：瓦片带 direction 时按它开表单，老逻辑（manual + key）还在', () => {
  const s = read('pages/manage/daily.vue')
  const fn = s.slice(s.indexOf('function onMetric'), s.indexOf('// ---------------- s=2'))
  assert.ok(fn.indexOf('item.direction') < fn.indexOf('item.manual'))
  assert.match(fn, /item\.category \|\| ''/)
  assert.match(fn, /item\.key === '采购支出'/)
})

// 把 pickCategory 的分组逻辑单独拿出来跑
function pickerOf(src) {
  const body = src.slice(src.indexOf('async function pickCategory'), src.indexOf('async function inputAmount'))
  return new Function('form', 'd', 'sheet', `${body}; return pickCategory`)
}

async function pick(cats, answers) {
  const shown = []
  const form = { value: { direction: 'income', category: '' } }
  const d = { value: { incomeCats: cats } }
  const sheet = async (items) => { shown.push(items); return answers.shift() }
  await pickerOf(read('pages/manage/daily.vue'))(form, d, sheet)()
  return { shown, category: form.value.category }
}

test('科目两步选：招募账第二步只列这一组', async () => {
  const cats = ['保险收入', '其他收入/兼职', '其他收入/全职', '其他收入/其他收入']
  const r = await pick([...cats], [1, 2])
  assert.deepEqual(r.shown, [['保险收入', '其他收入'], ['兼职', '全职', '其他收入']])
  assert.equal(r.category, '其他收入/其他收入')
  const direct = await pick([...cats], [0])
  assert.deepEqual(direct.shown, [['保险收入', '其他收入']])
  assert.equal(direct.category, '保险收入')
})

test('科目：旅居账还是只选一次；取消不改', async () => {
  const r = await pick(['线下房费', '线下二消', '其他收入'], [2])
  assert.equal(r.shown.length, 1)
  assert.equal(r.category, '其他收入')
  assert.equal((await pick(['保险收入', '其他收入/兼职'], [-1])).category, '')
  assert.equal((await pick(['保险收入', '其他收入/兼职'], [1, -1])).category, '')
})

test('周报：标题由服务端给，招募周报的板块和没权限的店', () => {
  const s = read('pages/manage/weekly.vue')
  assert.match(s, /wl\.value\.title \|\| '代运营周报'/)
  assert.match(s, /reportType === 'recruit'/)
  assert.match(s, /wl\.shopMode/)
  assert.match(s, /sp\.canSeeMoney \?/)
  assert.ok(s.includes('收支：你没有这家店的权限'))
  // 代运营周报的小节都还在
  for (const k of ['本周完成工作', '经营数据总览', '营收趋势', '报名与订单']) assert.ok(s.includes(k), k)
})

test('周报预览的小节序号：招募周报多一节各店情况，没填费用就跳过费用', () => {
  const s = read('pages/manage/weekly.vue')
  const body = s.slice(s.indexOf('const secNo ='), s.indexOf('const TONE ='))
  const run = (isRecruit, showFees) => new Function('isRecruit', 'showFees', `${body}; return secNo`)({ value: isRecruit }, { value: showFees })
  const ops = run(false, true)
  assert.equal(ops('fees'), '四、')
  assert.equal(ops('proofs'), '八、')
  const recruit = run(true, false)
  assert.equal(recruit('shops'), '四、')
  assert.equal(recruit('risk'), '五、')
  assert.equal(recruit('proofs'), '八、')
  assert.equal(run(true, true)('proofs'), '九、')
})

test('周报：支出涨是坏消息，收入涨是好消息', () => {
  const s = read('pages/manage/weekly.vue')
  const body = s.slice(s.indexOf('const deltaTone ='), s.indexOf('// 支出花得多是坏消息'))
  const tone = new Function(`${body}; return deltaTone`)()
  assert.equal(tone('+10.0%', true), 'k-green')
  assert.equal(tone('-10.0%', false), 'k-alert')
  assert.equal(tone('+10.0%', true, true), 'k-alert')
  assert.equal(tone('-10.0%', false, true), 'k-green')
  assert.equal(tone('持平', true, true), 'k-muted')
  assert.equal(tone('新增', true), 'k-green')
  assert.equal(tone('新增', true, true), 'k-alert')
})

test('主包没动：不往 common/api.js 里加招募周报的东西', () => {
  assert.ok(!read('common/api.js').includes('recruit'))
})
