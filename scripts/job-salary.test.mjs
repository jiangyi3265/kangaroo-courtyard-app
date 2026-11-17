import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
const source = await readFile(new URL('../common/job-salary.js', import.meta.url), 'utf8')
const { validateSalaryForm, salaryPayload, parseSalaryAmount, jobBenefits } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

test('amount accepts cents and rejects missing, zero, negative, excessive precision and exponent notation', () => {
  for (const v of ['', null, undefined, '0', '-1', '1.234', '100000.01', '1e2', 'NaN', 'Infinity', '25元']) assert.equal(parseSalaryAmount(v), null, String(v))
  for (const [v, expected] of [['25.50', 25.5], ['0.01', 0.01], ['150', 150], ['100000', 100000]]) assert.equal(parseSalaryAmount(v), expected)
})
for (const type of ['hourly', 'daily', 'weekly', 'monthly']) {
  test(`${type} supports bonus and commission together without adding them to base pay`, () => {
    const form = { pay: 'salary', salaryType: type, salary: '25.50', bonusEnabled: true, bonusDesc: ' 达标奖 500 元 ', commissionEnabled: true, commissionDesc: ' 销售额 5% ' }
    assert.equal(validateSalaryForm(form), '')
    assert.deepEqual(salaryPayload(form), { salaryType: type, salary: 25.5, bonusEnabled: true, bonusDesc: '达标奖 500 元', commissionEnabled: true, commissionDesc: '销售额 5%' })
  })
}

for (const boardEnabled of [true, false]) {
  for (const salaryEnabled of [true, false]) {
    test(`independent food=${boardEnabled} and salary=${salaryEnabled} override legacy choice`, () => {
      const form = { pay: 'board', boardEnabled, salaryEnabled, salaryType: 'monthly', salary: '5000', bonusEnabled: true, bonusDesc: '达标奖500元' }
      assert.deepEqual(jobBenefits(form), { boardEnabled, salaryEnabled })
      assert.equal(validateSalaryForm(form), '')
      assert.equal(salaryPayload(form).salary, salaryEnabled ? 5000 : 0)
      assert.equal(salaryPayload(form).salaryType, salaryEnabled ? 'monthly' : 'none')
      assert.equal(salaryPayload(form).bonusDesc, '达标奖500元')
      if (salaryEnabled) assert.notEqual(validateSalaryForm({ ...form, salary: '' }), '')
    })
  }
}

test('unchecking salary suppresses stale salary without losing food or extras', () => {
  const f = { pay: 'salary', boardEnabled: true, salaryEnabled: false, salaryType: 'monthly', salary: 'bad', commissionEnabled: true, commissionDesc: '销售额5%' }
  assert.equal(validateSalaryForm(f), '')
  assert.deepEqual(jobBenefits(f), { boardEnabled: true, salaryEnabled: false })
  assert.deepEqual(salaryPayload(f), { salaryType: 'none', salary: 0, bonusEnabled: false, bonusDesc: null, commissionEnabled: true, commissionDesc: '销售额5%' })
})
test('selected supplements require nonblank rules and enforce length limit', () => {
  const form = { pay: 'salary', salaryType: 'monthly', salary: 5000, bonusEnabled: true, bonusDesc: ' ' }
  assert.equal(validateSalaryForm(form), '请填写奖金规则')
  assert.equal(validateSalaryForm({ ...form, bonusDesc: '奖'.repeat(121) }), '奖金规则不能超过 120 字')
  assert.equal(validateSalaryForm({ ...form, bonusEnabled: false, commissionEnabled: true }), '请填写提成规则')
  assert.equal(validateSalaryForm({ ...form, bonusEnabled: false, salaryType: 'yearly' }), '请选择底薪周期')
})
test('unchecking only bonus retains commission and drops hidden bonus text from request', () => {
  const form = { pay: 'salary', salaryType: 'monthly', salary: 5000, bonusEnabled: false, bonusDesc: '旧奖金', commissionEnabled: true, commissionDesc: '销售额 5%' }
  assert.equal(validateSalaryForm(form), '')
  assert.equal(salaryPayload(form).bonusDesc, null)
  assert.equal(salaryPayload(form).commissionDesc, '销售额 5%')
})
test('food or no base pay clears old base amounts while preserving selected supplements', () => {
  for (const pay of ['board', 'none']) {
    const form = { pay, salaryType: 'monthly', salary: 5000, bonusEnabled: true, bonusDesc: '奖金', commissionEnabled: true, commissionDesc: '提成' }
    assert.equal(validateSalaryForm(form), '')
    assert.deepEqual(salaryPayload(form), { salaryType: 'none', salary: 0, bonusEnabled: true, bonusDesc: '奖金', commissionEnabled: true, commissionDesc: '提成' })
  }
})

for (const pay of ['board', 'none']) {
  for (const [bonusEnabled, commissionEnabled] of [[true,false], [false,true], [true,true], [false,false]]) {
    test(`${pay}: bonus=${bonusEnabled}, commission=${commissionEnabled} without base salary`, () => {
      const form = { pay, bonusEnabled, bonusDesc: ' 服务满 30 天奖 500 元 ', commissionEnabled, commissionDesc: ' 销售额 5% ' }
      assert.equal(validateSalaryForm(form), '')
      assert.deepEqual(salaryPayload(form), { salaryType: 'none', salary: 0, bonusEnabled, bonusDesc: bonusEnabled ? '服务满 30 天奖 500 元' : null, commissionEnabled, commissionDesc: commissionEnabled ? '销售额 5%' : null })
      if (bonusEnabled) assert.equal(validateSalaryForm({ ...form, bonusDesc: '' }), '请填写奖金规则')
      if (commissionEnabled) assert.equal(validateSalaryForm({ ...form, commissionDesc: '提'.repeat(121) }), '提成规则不能超过 120 字')
    })
  }
}
