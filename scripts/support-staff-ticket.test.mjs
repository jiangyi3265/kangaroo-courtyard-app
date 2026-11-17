// 客服工单 / 员工消息的静态回归（node --test，不需要构建、不发请求，只读源码）。
// 守住 2026-10-14 回归（R3）修的几件事：
//   · 线上任务专员账号在员工身份收得到客服回复和授权变更通知（消息中心可见范围放行 support_ticket / grant）；
//   · 业务页未读数和员工身份消息中心同一口径，不再出现清不掉的红点；主理人授予角色的通知 biz_id 是授权ID；
//   · 员工身份工单的来源仍记页面，身份记在摘要标记里；
//   · 追问超长提前说清能写多少字；追问后的新工单页能看到自己写的追问；
//   · 「附近有什么兼职？」只答兼职；房源匹配理由末尾不再多一个逗号；
//   · 人员管理的成员名字后面带会员编号。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const mapper = await read('../../RuoYi-Vue/ruoyi-kangaroo/src/main/resources/mapper/kangaroo/KgMessageMapper.xml')
const support = await read(javaRoot + 'ext/user/KgSupportService.java')
const home = await read(javaRoot + 'ext/user/KgHomeService.java')
const team = await read(javaRoot + 'ext/staff/KgStaffTeamService.java')
const assistant = await read('../pages/home/assistant.vue')
const business = await read('../pages/staff/business.vue')

test('线上任务专员：员工身份的客服回复与授权通知在消息中心可见', () => {
  const start = mapper.indexOf('<sql id="currentChatReception">')
  const acl = mapper.slice(start, mapper.indexOf('</sql>', start))
  const restricted = acl.slice(acl.indexOf("restricted.role_code='online_staff'"), acl.indexOf("biz_type in ('application','online_submission')"))
  assert.match(restricted, /or biz_type in \('grant','support_ticket','notice_reply','merchant_request','recruit_daily'\)/)
})

test('业务页未读数走消息中心同一口径', () => {
  const hub = team.slice(team.indexOf('public Map<String, Object> hub('), team.indexOf('public Map<String, Object> stores('))
  assert.match(hub, /messages\.countUnread\(c\.uid\(\), "staff"\)/)
  assert.doesNotMatch(hub, /from kg_message/)
})

test('主理人授予角色的通知 biz_id 是授权ID', () => {
  const grant = team.slice(team.indexOf('public String grant('), team.indexOf('public String revoke('))
  assert.match(grant, /grantId = db\.insert\("kg_staff_grant", row\)/)
  assert.match(grant, /切换到员工身份即可使用工作台。", grantId\);/)
})

test('员工身份工单：来源记页面，身份记摘要标记，回复按标记发回员工身份', () => {
  assert.match(support, /static final String STAFF_MARK = "【员工身份】";/)
  assert.doesNotMatch(support, /staff \? "staff" :/)
  assert.match(support, /\("staff"\.equals\(str\(r\.get\("context"\)\)\) \|\| str\(r\.get\("summary"\)\)\.startsWith\(STAFF_MARK\)\)/)
  // 用户自己的工单页不显示标记
  assert.match(support, /m\.put\("summary", r\.get\("summary"\) == null \? null : str\(r\.get\("summary"\)\)\.replace\(STAFF_MARK, ""\)\)/)
})

test('助手按问的岗位类型作答', () => {
  assert.match(support, /js = home\.jobsOfTypes\(city, types, 3\)/)
  assert.match(home, /public List<Map<String, Object>> jobsOfTypes\(String city, List<String> types, int limit\)/)
  assert.match(home, /j\.job_type in \(:t\)/)
})

test('房源 / 活动匹配理由：空字符串不再拼出多余的逗号', () => {
  assert.doesNotMatch(home, /s\.get\("area"\) == null/)
  assert.match(home, /\(area\.isEmpty\(\) \? "" : "，" \+ area\)/)
  assert.match(home, /\(place\.isEmpty\(\) \? "" : "，集合：" \+ place\)/)
})

test('追问：超长先说清能写多少；新工单页显示自己写的追问', () => {
  const submit = assistant.slice(assistant.indexOf('async function submitTicket()'), assistant.indexOf('async function addSupplement()'))
  // 先检查长度、再置 submitting：提前 return 不能把提交锁住
  assert.ok(submit.indexOf("'追问最多 480 字") > 0 && submit.indexOf("'追问最多 480 字") < submit.indexOf('submitting = true'))
  assert.match(assistant, /写下你还想问客服的（480 字以内）/)
  assert.match(assistant, /<text>\{\{ problemText \}\}<\/text>/)
  assert.match(assistant, /const problemText = computed\(/)
})

test('人员管理：成员名字后面带会员编号', () => {
  const open = business.slice(business.indexOf('async function openRole('), business.indexOf('async function newRole('))
  assert.match(open, /（会员编号 \$\{m\.userId\}）/)
  assert.match(open, /撤销 \$\{who\(m\)\} 的/)
})
