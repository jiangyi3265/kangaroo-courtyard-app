// 线上任务名额 / 截止 / 交付页按钮的静态回归（node --test，不需要构建、不发请求）。
// 守住 2026-10-13 修掉的几件事：
//   · 线上任务的名额按「进行中的接单人数」算：KgJobMapper.selectKgJobVo 里数的状态和 KgOnlineTaskService.WORKING 同一套，
//     小程序列表、详情、提交报名都读这个数（之前读 hired_count，线上任务永远是 0，名额满了照样能报名）；
//   · 小程序列表不再列出过了截止时间的线上任务；
//   · 交付页：申诉中也能确认已到账（canConfirm），成果交了几天门店不验收可以请平台介入（canEscalate），都按服务端给的开关显示；
//   · 门店退回面板和交付页倒计时用的重新提交小时数与服务端 RESUBMIT_HOURS 一致。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/'
const onlineJava = await read(javaRoot + 'java/com/ruoyi/kangaroo/ext/staff/KgOnlineTaskService.java')
const jobMapper = await read(javaRoot + 'resources/mapper/kangaroo/KgJobMapper.xml')
const deliver = await read('../pages/jobs/deliver.vue')
const onlineJobs = await read('../pages/staff/online-jobs.vue')

const javaList = (src, name) => {
  const m = new RegExp(name + '\\s*=\\s*Arrays\\.asList\\(([\\s\\S]*?)\\);').exec(src)
  assert.ok(m, name + ' not found')
  return [...m[1].matchAll(/"([a-z_]+)"/g)].map(x => x[1])
}
const sqlBlock = (id) => {
  const m = new RegExp(`<(sql|select) id="${id}"[\\s\\S]*?</(sql|select)>`).exec(jobMapper)
  assert.ok(m, id + ' not found')
  return m[0]
}

test('线上任务名额按进行中的接单人数算，状态和 WORKING 同一套', () => {
  const vo = sqlBlock('selectKgJobVo')
  const m = /case when j\.job_type = 'online' then \(select count\(1\) from kg_application oa[\s\S]*?oa\.status in \(([^)]*)\)\)\s*else j\.hired_count end hired_count/.exec(vo)
  assert.ok(m, 'selectKgJobVo 里线上任务的 hired_count 要按进行中的接单人数算')
  const statuses = [...m[1].matchAll(/'([a-z_]+)'/g)].map(x => x[1])
  assert.deepEqual(statuses.sort(), javaList(onlineJava, 'WORKING').sort())
  // 只有一处出 hired_count，不能再把原列也查出来（同名列后一个会盖掉前一个）
  assert.equal((vo.match(/hired_count/g) || []).length, 2)
})

test('小程序列表不再列出过了截止时间的线上任务', () => {
  const list = sqlBlock('selectAppJobList')
  assert.match(list, /not exists \(select 1 from kg_online_task ot\s+where ot\.job_id = j\.job_id and ot\.deadline_time is not null and ot\.deadline_time &lt; now\(\)\)/)
})

test('交付页按服务端开关显示确认收款与请平台介入', () => {
  assert.match(deliver, /v-if="a\.settlement && \(a\.settlement\.canDispute \|\| a\.settlement\.canConfirm\)"/)
  assert.match(deliver, /v-if="a\.settlement\.canConfirm"[^\n]*@click="confirmPaid"/)
  assert.match(deliver, /v-else-if="a\.canEscalate \|\| a\.escalated"/)
  assert.match(deliver, /'\/app\/online\/assignments\/' \+ id \+ '\/escalate'/)
  // 服务端：申诉中（disputed）也能确认收款
  assert.match(onlineJava, /status in \('payout_registered', 'disputed'\)/)
})

test('退回后重新提交的小时数前后端一致', () => {
  const hours = Number(/static final int RESUBMIT_HOURS = (\d+);/.exec(onlineJava)?.[1])
  assert.ok(hours > 0)
  assert.match(onlineJobs, new RegExp(`A\\.value\\.resubmitHours \\|\\| ${hours}`))
})
