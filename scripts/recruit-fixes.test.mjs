// 招聘流程 10-13 复查修复的静态回归（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · 选面试时段页的时长按时段起止算，不再写死「预计 20 分钟」，面试方式写腾讯会议（不是微信视频）；
//   · 审核通过、还没约面试时，进度页第 2 屏底栏有「撤回报名」；
//   · 「技能匹配机会」一键报名的可停留天数由本人填，不再替人编 max(7, 最短天数)；
//   · 候选人面试后问卷的四个字段名：候选人提交、后端员工端回读、员工端两页显示，三处同一套名字；
//   · 门店报名详情的「经历记录」读后端补充接口，不再是写死的空数组；门店新增时段会提醒等时段的候选人；
//   · 岗位详情不能报名时读后端的 applyClosedReason，游客报名 / 收藏 / 关注先去登录。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const progress = await read('../pages/jobs/progress.vue')
const interview = await read('../pages/jobs/interview.vue')
const detail = await read('../pages/jobs/detail.vue')
const apply = await read('../pages/jobs/apply.vue')
const opportunities = await read('../pages/profile/opportunities.vue')
const staffApps = await read('../pages/staff/applications.vue')
const staffInterviews = await read('../pages/staff/interviews.vue')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const interviewJava = await read(javaRoot + 'ext/staff/KgStaffInterviewService.java')
const slotJava = await read(javaRoot + 'ext/staff/KgStaffSlotService.java')
const extJava = await read(javaRoot + 'controller/app/AppStaffExtController.java')
const jobJava = await read(javaRoot + 'controller/app/AppJobController.java')

/** 取出 `const NAME = (...) => { ... }`（到下一行顶格的 `}` 为止）的源码 */
const arrowFn = (src, name) => {
  const m = new RegExp(`const ${name} = \\([^)]*\\) => \\{[\\s\\S]*?\\n\\}\\n`).exec(src)
  assert.ok(m, name + ' not found')
  return m[0]
}
const slotDuration = Function(arrowFn(progress, 'parseTime') + arrowFn(progress, 'formatSlotDuration') + 'return formatSlotDuration')()

test('面试时段的时长按起止时间算，跨整点、整小时、缺结束时间都对', () => {
  assert.equal(slotDuration('2026-10-14 23:20:00', '2026-10-14 23:50:00'), '30 分钟')
  assert.equal(slotDuration('2026-10-14 10:00:00', '2026-10-14 11:30:00'), '1 小时 30 分钟')
  assert.equal(slotDuration('2026-10-14 10:00:00', '2026-10-14 12:00:00'), '2 小时')
  assert.equal(slotDuration('2026-10-14 23:30:00', '2026-10-15 00:10:00'), '40 分钟')
  assert.equal(slotDuration('2026-10-14 10:00:00', null), '')
  assert.equal(slotDuration('2026-10-14 10:00:00', '2026-10-14 10:00:00'), '')
})

test('候选人页不再说微信视频、预计 20 分钟', () => {
  // 只看页面上会显示的文字（去掉 // 注释，注释里记着旧说法）
  assert.doesNotMatch(progress.replace(/\/\/.*$/gm, ''), /微信视频|预计 20 分钟/)
  assert.match(progress, /腾讯会议/)
  assert.match(progress, /dur: formatSlotDuration\(o\.startTime, o\.endTime\)/)
})

test('审核通过屏底栏有撤回报名，且审核通过在可撤回状态里', () => {
  const pass = /<!-- 2 审核通过 -->[\s\S]*?<\/k-bottom>/.exec(progress)
  assert.ok(pass, '第 2 屏没找到')
  assert.match(pass[0], /@click="withdraw">撤回报名</)
  const withdrawable = Function('return ' + /const WITHDRAWABLE = (\[[^\]]*\])/.exec(progress)[1])()
  assert.ok(withdrawable.includes('review_passed'))
})

test('一键报名的可停留天数由本人填写，不再替人编', () => {
  assert.doesNotMatch(opportunities, /Math\.max\(7/)
  assert.match(opportunities, /days: Number\(days\.value\)/)
  assert.doesNotMatch(opportunities, /已包含基本信息、经历、技能等|已选，支持调整/)
})

test('面试后问卷的字段名：候选人提交、后端回读、员工端显示三处一致', () => {
  const keys = ['understandJob', 'acceptBoard', 'confirmArrival', 'feedbackNote']
  for (const k of keys) {
    assert.match(interview, new RegExp('\\b' + k + ': '), '候选人提交缺 ' + k)
    assert.match(interviewJava, new RegExp('d\\.put\\("' + k + '"'), '后端回读缺 ' + k)
  }
  for (const src of [staffApps, staffInterviews]) {
    const labels = Function('return ' + /const FEEDBACK_LABELS = (\[[\s\S]*?\]\])/.exec(src)[1])()
    assert.deepEqual(labels.map(x => x[0]), keys)
  }
  // 员工端面试详情和报名详情补充接口都带问卷
  assert.match(interviewJava, /i\.understand_job, i\.accept_board, i\.confirm_arrival, i\.feedback_note/)
  assert.match(interviewJava, /public Map<String, Object> ofApplication\(Long appId\)/)
})

test('门店报名详情的经历、面试入口来自补充接口', () => {
  assert.doesNotMatch(staffApps, /const experiences = computed\(\(\) => \[\]\)/)
  assert.match(staffApps, /get\('\/app\/staff\/applications\/' \+ appId \+ '\/extras'\)/)
  assert.match(extJava, /@GetMapping\("\/applications\/\{appId\}\/extras"\)/)
  assert.match(staffApps, /R\.staffInterviews \+ '\?id=' \+ interviewInfo\.value\.interviewId/)
})

test('门店新增面试时段会提醒还在等时段的候选人，点开是审核进度页', () => {
  assert.match(slotJava, /notifyWaiting\(c\.storeId,null,id\);/)
  assert.match(slotJava, /a\.status='review_passed'/)
  assert.match(slotJava, /"\/pages\/jobs\/progress\?appId="\+appId/)
})

test('岗位详情：不能报名读后端原因字段，游客写操作先去登录', () => {
  assert.match(jobJava, /data\.put\("applyClosedReason"/)
  assert.match(detail, /d\.applyClosedReason/)
  assert.match(apply, /d\.applyClosedReason/)
  for (const what of ['报名', '收藏', '关注门店']) assert.match(detail, new RegExp(`await needLogin\\('${what}'\\)`))
  // 页面自己问「去登录」时同步标上 loginHandled，request.js 不再叠一个通用登录框（见 scripts/recruit-review-r2.test.mjs）
  assert.match(apply, /if \(e\?\.code === 401\) \{ e\.loginHandled = true; askLogin\(\); return \}/)
})
