// 线上任务复核（2026-10-13 第二轮）的静态回归（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · 交付页「请平台介入」请求的地址和后端 AppOnlineController 的映射一致；
//   · 过期自动关闭（closeExpiredTasks）：只告诉门店自己提交的草稿，消息链接带 storeId，线上任务页按它切门店；
//     已上架的任务关闭时还有没审核的接单申请，提醒门店驳回，链接参数是报名列表页认得的那几个；
//   · 「接单人请平台介入验收」和验收申诉的处理结果用 online_submission 类型发给门店，负责验收的线上任务专员才看得到；
//   · 通知里拼退回原因、平台处理结果时去掉句末标点，不出现「。。」。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const onlineJava = await read(javaRoot + 'ext/staff/KgOnlineTaskService.java')
const onlineCtl = await read(javaRoot + 'controller/app/AppOnlineController.java')
const deliver = await read('../pages/jobs/deliver.vue')
const onlineJobs = await read('../pages/staff/online-jobs.vue')
const applications = await read('../pages/staff/applications.vue')

const method = (src, name) => {
  const i = src.indexOf(' ' + name + '(')
  assert.ok(i > 0, name + ' not found')
  const open = src.indexOf('{', i)
  let depth = 0
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') depth++
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1)
  }
  throw new Error(name + ' not closed')
}

test('交付页请平台介入的地址与后端映射一致', () => {
  const base = /@RequestMapping\("([^"]+)"\)/.exec(onlineCtl)[1]
  const sub = /@PostMapping\("([^"]*escalate)"\)/.exec(onlineCtl)[1]
  assert.equal(base + sub, '/app/online/assignments/{appId}/escalate')
  assert.match(deliver, /post\('\/app\/online\/assignments\/' \+ id \+ '\/escalate', \{ reason \}\)/)
  assert.match(onlineCtl, /body\.get\("reason"\)/)
})

test('过期自动关闭：只通知门店自己提交的草稿，链接带门店', () => {
  const m = method(onlineJava, 'closeExpiredTasks')
  // 2026-11-09：多取截止时间，接单人那条按它算还能不能重新提交（notifyClosed）
  assert.match(m, /select j\.job_id, j\.store_id, j\.title, j\.status, j\.source, t\.deadline_time from kg_job/)
  assert.match(m, /"staff"\.equals\(str\(j\.get\("source"\)\)\)/)
  assert.match(m, /"\/pages\/staff\/online-jobs\?jobId=" \+ jobId \+ "&storeId=" \+ storeId/)
  // 线上任务页按链接里的 storeId 加载任务（多门店员工当前门店不是这家时不会提示「任务不存在」）
  // 2026-11-03 简化复查：任务取不到就退到任务列表（if (!task.value) await loadTasks()），不停在空详情
  assert.match(onlineJobs, /else if \(Number\(q\?\.jobId\)\) \{ await loadTask\(Number\(q\.jobId\), Number\(q\.storeId\) \|\| sid\(\)\); if \(!task\.value\) await loadTasks\(\); s\.value = 2 \}/)
})

test('过期自动关闭：还有没审核的接单申请时提醒门店驳回，链接参数报名列表页都认得', () => {
  // 2026-11-09：上过架的任务到期关闭后的通知挪到 notifyClosed（门店 + 还在做的接单人），closeExpiredTasks 只管关
  assert.match(method(onlineJava, 'closeExpiredTasks'), /notifyClosed\(jobId, storeId, /)
  const m = method(onlineJava, 'void notifyClosed')
  assert.match(m, /from kg_application where job_id = :j and del_flag = '0' and status = 'submitted'/)
  // 门店那条只发给能管线上任务的人；接单人只发还在做、没有结算单的
  assert.match(m, /support\.notifyOnline\(storeId, false, null, /)
  assert.match(m, /not exists \(select 1 from kg_online_settlement s where s\.app_id = a\.app_id\)/)
  const link = /"(\/pages\/staff\/applications\?[^"]+)"/.exec(m)?.[1]
  assert.ok(link, '提醒驳回的链接')
  const q = Object.fromEntries(new URLSearchParams(link.split('?')[1] + '0'))
  assert.equal(q.status, 'submitted')
  assert.equal(q.jobType, 'online')
  assert.ok('storeId' in q)
  assert.match(applications, /if \(q\?\.status === 'submitted'\) statusTab\.value = '待审核'/)
  assert.match(applications, /\['online','volunteer','parttime','fulltime'\]\.includes\(q\?\.jobType\)/)
  assert.match(applications, /listStoreId\.value = Number\(q\?\.storeId\) > 0/)
})

test('验收催办和验收申诉结果，线上任务专员的消息中心看得到', async () => {
  const acl = await read('../../RuoYi-Vue/ruoyi-kangaroo/src/main/resources/mapper/kangaroo/KgMessageMapper.xml')
  const allowed = /biz_type in \(([^)]*)\) and exists\(\s*select 1 from kg_application a join kg_job j/.exec(acl)?.[1] || ''
  assert.ok(allowed.includes("'online_submission'"), '专员能看的消息类型里有 online_submission')
  assert.match(method(onlineJava, 'escalate'), /"online_submission", appId, "\/pages\/staff\/online-jobs\?appId=" \+ appId/)
  assert.match(method(onlineJava, 'appealHandled'), /settle \? bizType : "online_submission"/)
})

test('通知里拼原因和处理结果时去掉句末标点', () => {
  assert.match(onlineJava, /static String clause\(String s\)/)
  assert.match(method(onlineJava, 'appealHandled'), /"平台处理结果：" \+ StaffSupport\.cut\(clause\(reply\), 200\)/)
  // V41 起退回通知只放预览（去掉句末标点、前 60 字）+ 截图数 + 截止提醒，由 returnNotice 拼；截止时间放在最后，不会被站内信的 500 字截掉
  const notice = method(onlineJava, 'returnNotice')
  assert.match(notice, /String t = clause\(text\)/)
  assert.match(notice, /StaffSupport\.cut\(t, 60\)/)
  assert.match(notice, /"。请在 " \+ StaffSupport\.fmt\(until, "MM-dd HH:mm"\) \+ " 前修改后重新提交"/)
  assert.match(onlineJava, /"成果被退回修改", returnNotice\(/)
})
