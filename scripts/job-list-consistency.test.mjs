// 列表口径一致性的静态回归（node --test，不需要构建、不发请求，只读源码）。
// 守住 2026-10-13 复查修的几件事：
//   · 线上任务列表的「任务类型」胶囊和「全部筛选」页同一口径：按发布时选的任务类型精确匹配，不再展开技能同义词；
//     两边的选项和员工发布任务时的类型是同一组；全部筛选页也不再算进过了截止时间的线上任务；
//   · 线上任务卡片的发单方不再是发布员工的个人微信昵称，员工发布的显示门店名；
//   · 「转给门店同事」不把看不到这份报名的线上任务专员算进收件人（跨店转发同理）；
//   · 「我的评价」里举报成立被隐藏的评价显示「已被平台隐藏」，不再一直写「待平台复核」；
//   · 后台客服工单的「来源」认得员工身份提交的工单（context='staff'）。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const list = await read('../pages/jobs/list.vue')
const filters = await read('../pages/jobs/job-filters.js')
const filter = await read('../pages/jobs/filter.vue')
const jobCtl = await read(javaRoot + 'controller/app/AppJobController.java')
const hub = await read(javaRoot + 'ext/user/KgUserHubService.java')
const userModule = await read(javaRoot + 'ext/user/KgUserModule.java')
const workbench = await read(javaRoot + 'ext/staff/KgWorkbenchService.java')
const share = await read(javaRoot + 'ext/staff/KgResumeShareService.java')
const onlineTask = await read(javaRoot + 'ext/staff/KgOnlineTaskService.java')
const support = await read(javaRoot + 'ext/user/KgSupportService.java')
const mapper = await read('../../RuoYi-Vue/ruoyi-kangaroo/src/main/resources/mapper/kangaroo/KgJobMapper.xml')

const literal = (src, name) => {
  const m = new RegExp(`const ${name} = (\\[[^\\n]*\\])\\n`).exec(src)
  assert.ok(m, name + ' not found')
  return Function('return (' + m[1] + ')')()
}
// 取一个 Java 方法体（从签名到下一个同缩进的右花括号）
const method = (src, sig) => {
  const at = src.indexOf(sig)
  assert.ok(at >= 0, sig + ' not found')
  const end = src.indexOf('\n    }\n', at)
  return src.slice(at, end)
}

test('线上任务类型：列表胶囊、全部筛选、员工发布用同一组类型', () => {
  const types = JSON.parse('[' + /static final List<String> TYPES = Arrays\.asList\(([^)]*)\)/.exec(onlineTask)[1] + ']')
  assert.deepEqual(literal(filters, 'TASK_OPTS'), types)
  assert.deepEqual(literal(filter, 'ONLINE_TYPES'), types)
})

test('线上任务类型：列表胶囊按任务类型精确匹配，不展开技能同义词', () => {
  // list() 把「是不是线上任务列表」传给 putChipFilters
  assert.match(jobCtl, /putChipFilters\(params, salaryMin, salaryMax, board, skill, minStay, train, JobType\.ONLINE\.equals\(type\)\);/)
  const body = method(jobCtl, 'static void putChipFilters(Map<String, Object> params, Long salaryMin, Long salaryMax, String board, String skill, Integer minStay, String train, boolean online)')
  const onlineBranch = body.slice(body.indexOf('if (online)'), body.indexOf('else', body.indexOf('if (online)')))
  assert.match(onlineBranch, /params\.put\("taskType", sk\)/)
  assert.match(onlineBranch, /params\.put\("taskTypeUntyped", Boolean\.valueOf\("其他"\.equals\(sk\)\)\)/)
  assert.doesNotMatch(onlineBranch, /wordsOf|skillWords/)
  // 老的 7 参签名还在（KgJobListChipFilterTest 用反射调它），到店岗位照旧展开同义词
  assert.match(jobCtl, /putChipFilters\(params, salaryMin, salaryMax, board, skill, minStay, train, false\);/)
  // SQL：任务类型走参数绑定、等值匹配；「其他」才带上没有类型的老线上岗位
  const block = mapper.slice(mapper.indexOf('<if test="params.taskType != null'), mapper.indexOf('<!-- 停留时长'))
  assert.match(block, /and j\.job_type = 'online'/)
  assert.match(block, /ot\.task_type = #\{params\.taskType\}/)
  assert.match(block, /<if test="params\.taskTypeUntyped == true">\s*or not exists \(select 1 from kg_online_task ot where ot\.job_id = j\.job_id\)/)
  assert.doesNotMatch(block, /like/)
})

test('线上任务类型：全部筛选只看线上任务时同样按任务类型精确匹配，并排除过了截止时间的任务', () => {
  const body = method(hub, 'static void appendJobTypes(')
  const online = body.slice(body.indexOf('if (codes.size() == 1 && "online".equals(codes.get(0)))'), body.indexOf('StringBuilder tc'))
  assert.ok(online.length > 0, '缺少只看线上任务的分支')
  assert.match(online, /ot\.task_type in \(:tt\)/)
  assert.match(online, /tt\.contains\("其他"\)/)
  assert.match(online, /return;/)
  assert.doesNotMatch(online, /j\.title like|j\.tags like/)
  const search = method(hub, 'public Map<String, Object> search(Long me, Map<String, Object> b)')
  // 和 KgJobMapper.selectAppJobList 同一条截止时间规则
  const rule = 'not exists (select 1 from kg_online_task ot where ot.job_id = j.job_id and ot.deadline_time is not null and ot.deadline_time < now())'
  assert.ok(search.includes(rule), 'search 缺少截止时间过滤')
  assert.ok(mapper.replace(/&lt;/g, '<').replace(/\s+/g, ' ').includes(rule.replace(/\s+/g, ' ')), 'mapper 的截止时间规则变了，两边要一起改')
})

test('线上任务卡片：发单方不显示员工个人昵称', () => {
  // 后端：员工发布的（source=staff）或没填发单方的，下发门店名
  assert.match(jobCtl, /m\.put\("publisherName", "staff"\.equals\(job\.getSource\(\)\) \|\| StringUtils\.isEmpty\(job\.getPublisherName\(\)\) \? job\.getStoreName\(\) : job\.getPublisherName\(\)\);/)
  // 前端：没有发单方时退到门店名，不退到地址
  assert.match(list, /loc: j\.publisherName \|\| j\.storeName \|\| base\.loc,/)
})

test('转给门店同事：非线上岗位的报名不算线上任务专员；跨店转发也不算', () => {
  const body = method(workbench, 'public Map<String, Object> forward(Long storeId, Long appId, String target, String suggestion, boolean track)')
  assert.match(body, /j\.job_type from kg_application a join kg_job j/)
  assert.match(body, /boolean onlineJob = "online"\.equals\(str\(a\.get\("jobType"\)\)\);/)
  assert.match(body, /if \(!onlineJob && com\.ruoyi\.kangaroo\.enums\.StaffRole\.onlineOnly\(role\)\)\s*\{\s*continue;/)
  // 同一个人有两条授权时只算一次
  assert.match(body, /!targets\.contains\(uid\)/)
  // 跨店：收件人和可选门店都不算线上任务专员（他们看不到这类站内信，也打不开脱敏简历）
  assert.match(share, /select distinct app_user_id from kg_staff_grant where store_id=:s and status='0' and del_flag='0' and app_user_id<>:u and role_code not in \('online_staff','merchant_service','city_lead'\)/)
  assert.match(share, /g\.app_user_id<>:u and g\.role_code not in \('online_staff','merchant_service','city_lead'\)\)/)
})

test('我的评价：举报成立隐藏的显示「已被平台隐藏」', () => {
  const body = method(hub, 'public List<Map<String, Object>> reviewsMine(Long me, boolean featuredOnly)')
  assert.match(body, /rp\.target_type = 'review' and rp\.target_id = v\.review_id "\s*\+ "and rp\.status = 'upheld' and rp\.del_flag = '0'\) upheld_reports/)
  assert.match(body, /"已被平台隐藏" : "已隐藏（待平台复核）"/)
})

test('后台客服工单：来源认得员工身份', () => {
  // 员工身份提交的工单：来源仍记页面，身份记在摘要开头的【员工身份】（KgSupportService.createTicket）；
  // 改之前提交的旧工单 context 是 staff，后台仍要认得
  assert.match(support, /row\.put\("context", StaffSupport\.cut\(str\(b\.get\("context"\)\), 16\)\)/)
  assert.match(support, /staff \? STAFF_MARK \+ sum : sum/)
  const ticket = userModule.slice(userModule.indexOf('ExtEntity ticket'), userModule.indexOf('ExtEntity sub'))
  assert.match(ticket, /ExtField\.of\("context", "来源", "select"\)\.options\("[^"]*,staff:员工身份(,[^"]*)?"\)/)
})
