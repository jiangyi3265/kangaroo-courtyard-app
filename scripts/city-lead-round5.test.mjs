import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { intakeActions } from '../pages/staff/request-view.js'

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('手填需求没有退回按钮，无其他日报收件人时隐藏发送', () => {
  assert.deepEqual(intakeActions({ status: 'pending_verify', canReturn: false }), ['forward'])
  assert.match(source('../pages/staff/intake.vue'), /v-if="actions.includes\('return'\)"[^>]+><k-button[^>]+label="退回商家"/)
  assert.match(source('../pages/manage/daily.vue'), /<k-button v-if="manager"[^>]+@click="sendReport"/)
})

test('权限弹窗和城市首页说明实际办理范围', () => {
  assert.match(source('../pages/staff/business.vue'), /@click="editPerm">权限说明/)
  assert.match(source('../pages/staff/business.vue'), /row.note/)
  assert.match(source('../pages/staff/components/k-city-work.vue'), /缺人需你办理或转平台时会提醒，其余可在「本城商家需求」查看/)
})
