import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = page => readFileSync(new URL('../pages/' + page + '.vue', import.meta.url), 'utf8')

test('历史无人需求的接办按钮由后端能力控制，成功后进入对应业务', () => {
  const city = source('staff/city')
  assert.match(city, /v-if="detail.canResume"/)
  assert.match(city, /resume\?storeId=/)
  assert.match(city, /result.data.route/)
})

test('出单消息还原登记身份，详情只按本笔 canRegister 显示表单', () => {
  const account = source('staff/insurance-account')
  assert.match(account, /initialQuery.registrationRole/)
  assert.match(account, /v-if="selected.canRegister"/)
})

test('候选时段和岗位归档均读取服务端为本条记录返回的能力', () => {
  assert.match(source('staff/applications'), /:offer-role="detail.interviewOfferRole"/)
  assert.match(source('staff/jobs'), /canArchive/)
})

test('代岗日报标记与本城线上招募概况的门店参数可见', () => {
  assert.match(source('staff/operations'), /report.auto\?\.standIn/)
  const hub = source('staff/business')
  assert.match(hub, /isCityLead && cityLeadFull/)
  assert.match(hub, /staffStoreUrl\(ONLINE_DAILY_PAGE, hub.storeId\)/)
})

test('店内和跨店简历的城市收件人都需要当前目标的资格', () => {
  const app = source('staff/applications')
  assert.match(app, /canForwardToLead\) choices/)
  assert.match(app, /store.storeId === targetStoreId.value && store.canForwardToLead/)
  assert.match(app, /leadOnly: target.value === 'cross_store' && targetAllowsLead.value && forwardLeadOnly.value/)
})

test('紧急招募显示城市补位人数，群码提醒按房源号打开原有操作', () => {
  assert.match(source('staff/dispatch'), /staffFallbackCount|cityLeadNotified/)
  const rooms = source('staff/rooms')
  assert.match(rooms, /q\?\.action === 'groupQr'/)
  assert.match(rooms, /updateGroupQr\(Number\(q.stayId\)\)/)
})
