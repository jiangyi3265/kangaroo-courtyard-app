import test from 'node:test'
import assert from 'node:assert/strict'
import { employmentContent, employmentSchedule, employmentSkills } from '../pages/jobs/employment-presentation.js'

test('numbered duties retain every source sentence while moving the introduction into its disclosure', () => {
  const intro = '我们是平潭袋鼠小院，现招募2名兼职伙伴，期待你的加入。'
  assert.deepEqual(employmentContent([intro, '1. 接待访客', '2、保持公共区域整洁']), { introduction: intro, lines: ['接待访客', '保持公共区域整洁'] })
  assert.deepEqual(employmentContent(['接待访客', '负责清洁']), { introduction: '', lines: ['接待访客', '负责清洁'] })
  assert.deepEqual(employmentContent(['单独一段岗位描述']), { introduction: '', lines: ['单独一段岗位描述'] })
  assert.deepEqual(employmentContent(), { introduction: '', lines: [] })
})

test('old combined weekly schedule is split only when both explicit values are unambiguous', () => {
  const source = { note: '每周 2 天，每天 4 小时', mode: '', hours: '', rest: '每周 2 天，每天 4 小时' }
  assert.deepEqual(employmentSchedule(source), { ...source, mode: '每周2天', hours: '4小时', note: '' })
  assert.equal(source.note, '每周 2 天，每天 4 小时', 'presentation cannot mutate the API object')
  for (const note of ['每周2天，每天4至6小时', '旺季每周2天，每天4小时', '每周2天，每天4小时，另有夜班', '排班待商议']) {
    assert.deepEqual(employmentSchedule({ note }), { note })
  }
  const structured = { mode: '做五休二', hours: '8小时', note: '每周2天，每天4小时' }
  assert.deepEqual(employmentSchedule(structured), structured, 'structured fields remain authoritative')
  assert.equal(employmentSchedule(null), null)
})

test('employment manager skills omit volunteer wording without changing shared source text', () => {
  const skills = '直播带岗、小院运营、换工接待'
  assert.equal(employmentSkills(skills), '直播带岗、小院运营、接待')
  assert.equal(skills, '直播带岗、小院运营、换工接待')
  assert.equal(employmentSkills('换工、接待'), '接待')
  assert.equal(employmentSkills('义工、义工接待、换工接待'), '接待、接待')
  assert.equal(employmentSkills(), '')
})
