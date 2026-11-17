import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const code = await readFile(new URL('../common/job-gender.js', import.meta.url), 'utf8')
const { genderPlanError, genderPlanPayload, genderCountText } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const form = (male, female) => ({ jobType: 'volunteer', genderCountsEnabled: true, genderMaleCount: male, genderFemaleCount: female, headcount: 99 })
test('male/female counts produce the same total and gender filter on submit', () => {
  assert.deepEqual(genderPlanPayload(form('1','2')), { genderCountsEnabled: true, genderMaleCount: 1, genderFemaleCount: 2, headcount: 3, genderPref: '' })
  assert.equal(genderPlanPayload(form(0,2)).genderPref, 'F')
  assert.equal(genderPlanPayload(form(2,0)).genderPref, 'M')
  assert.equal(genderCountText(form(1,2)), '男生 1 人 · 女生 2 人')
})
test('empty, fractional, negative and over-limit counts block submission', () => {
  for (const f of [form('',1),form(1.5,1),form(-1,2),form(0,0),form(50,50)]) assert.ok(genderPlanError(f))
  assert.equal(genderPlanError(form(0,99)), '')
})
test('unrestricted and legacy single-gender modes clear split counts', () => {
  const p=genderPlanPayload({...form(1,2),genderCountsEnabled:false,headcount:3,genderPref:'M'})
  assert.equal(p.genderMaleCount,null); assert.equal(p.headcount,3); assert.equal(p.genderPref,'M')
  assert.equal(genderPlanPayload({...form(1,2),jobType:'parttime'}).genderCountsEnabled,false)
})
