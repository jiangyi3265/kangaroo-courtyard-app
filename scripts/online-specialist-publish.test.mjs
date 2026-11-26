// 线上任务专员发布任务 / 底栏高亮 / 工作台挪进分包 / 去掉接站需求（2026-10 主人拍板）的静态回归（node --test，不需要构建、不发请求）。
// 守住这几件事：
//   · 专员能进线上任务发布页（?s=1）、能点「发布任务」：online-jobs.vue 原先四道拦截都去掉了，「按技能找人」仍不给专员；
//   · 专员工作台多一个「发布任务」入口（→ 发布页，副标题「提交平台审核」），工作台组件从主包 components/ 挪进 staff 分包，
//     只在 pages/staff/index、business 里显式引入，主包里再没有任何地方引用它；
//   · 底栏：专员在报名列表亮「报名」（第二格），在任务 / 验收页亮「工作台」；其他角色不变；
//   · 员工端报名详情不再显示「接站需求」和那句「请联系报名人确认安排」，「更新于…」提示保留；
//   · 后端：发布接口对专员开放、查「线上任务·编辑」，发布后通知本店主理人；线上任务的审核结果点开去任务详情，消息中心对专员放行这一类。
import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const onlineJobs = await read('../pages/staff/online-jobs.vue')
const applications = await read('../pages/staff/applications.vue')
const staffIndex = await read('../pages/staff/index.vue')
const business = await read('../pages/staff/business.vue')
const work = await read('../pages/staff/components/k-online-work.vue')
const tabbar = await read('../components/k-tabbar/k-tabbar.vue')
const pagesJson = JSON.parse(await read('../pages.json'))
const extCtl = await read(javaRoot + 'controller/app/AppStaffExtController.java')
const opsCtl = await read(javaRoot + 'controller/app/AppStaffOpsController.java')
const perms = await read(javaRoot + 'ext/staff/StaffPerms.java')
const onlineJava = await read(javaRoot + 'ext/staff/KgOnlineTaskService.java')
const jobImpl = await read(javaRoot + 'service/impl/KgJobServiceImpl.java')
const mapper = await read('../../RuoYi-Vue/ruoyi-kangaroo/src/main/resources/mapper/kangaroo/KgMessageMapper.xml')

const method = (src, name) => {
  // 取方法定义，不取调用处：调用是分号先于大括号（10-30 create() 里调用排在定义前面）
  let i = src.indexOf(' ' + name + '(')
  while (i > 0) {
    const semi = src.indexOf(';', i), brace = src.indexOf('{', i)
    if (brace >= 0 && (semi < 0 || brace < semi)) break
    i = src.indexOf(' ' + name + '(', i + 1)
  }
  assert.ok(i > 0, name + ' not found')
  const open = src.indexOf('{', i)
  let depth = 0
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') depth++
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1)
  }
  throw new Error(name + ' not closed')
}
const readUtf8 = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const tabbars = (src) => [...src.matchAll(/<k-tabbar [^>]*\/>/g)].map(m => m[0])

// ---------------------------------------------------------------- 发布页不再拦专员

test('专员能打开发布页（?s=1）并提交，「按技能找人」仍不给专员', () => {
  assert.match(onlineJobs, /<view v-if="s === 1" class="fc-form publish-page">/)
  assert.doesNotMatch(onlineJobs, /s === 1 && !onlineStaff/)
  // 只有既不带任务 / 接单、也不是 ?s=1 发布时才送回工作台
  assert.match(onlineJobs, /if \(onlineStaff\.value && !Number\(q\?\.appId\) && !Number\(q\?\.jobId\) && Number\(q\?\.s\) !== 1\) \{ uni\.redirectTo\(\{url: R\.staff\}\); return \}/)
  const publish = onlineJobs.slice(onlineJobs.indexOf('async function publish()'), onlineJobs.indexOf('// ---------------- s=2'))
  assert.doesNotMatch(publish, /if \(onlineStaff\.value\) return/)
  assert.match(publish, /apiOnlineCreate\(\{ \.\.\.f, \.\.\.feeFields \}, sid\(\)\)/)
  // 专员提交前说清会通知负责付款的人（角色切换前后不是同一个角色，所以不点名）。2026-11-03 简化：不再弹确认框，这句一直写在表单最后（flowNote）
  assert.doesNotMatch(publish, /await confirm\(/)
  assert.match(onlineJobs, /onlineStaff\.value \? '，并通知本店负责付款的人' : ''/)
  // 门店还没有任务：专员也留在发布页，不再被送回工作台
  const init = onlineJobs.slice(onlineJobs.indexOf('async function initTask()'), onlineJobs.indexOf('const T = computed'))
  assert.match(init, /else \{ toast\('暂无线上任务'\); s\.value = 1 \}/)
  assert.doesNotMatch(init, /redirectTo/)
  // 2026-11-03 简化：合作商家也没有人才库权限，一起藏
  assert.match(onlineJobs, /<view v-if="!onlineStaff && !merchantStaff" class="k-row k-gap4" hover-class="k-press" @click="findTalents">/)
  // 专员仍看不到结算登记
  assert.match(onlineJobs, /<view v-if="!onlineStaff" class="payment">/)
})

// ---------------------------------------------------------------- 工作台入口与分包

test('专员工作台有「发布任务」入口，指向发布页', () => {
  assert.match(work, /<button v-if="recruitmentEnabled" @click="go\(R\.staffOnline \+ '\?s=1'\)"><k-icon name="square-plus" [^>]*\/><text>发布任务<\/text><text class="k-meta">提交平台审核<\/text><\/button>/)
  assert.match(work, /<text class="k-meta">线上任务专员<\/text><text class="store-name">\{\{ identity\.name \}\}<\/text>/)
  assert.match(work, /<text v-if="identity\.scope" class="k-meta">\{\{ identity\.scope \}\}<\/text>/)
  assert.match(work, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/)
  assert.match(work, /import R from '@\/common\/routes\.js'/)
  assert.match(work, /import \{ goFromWorkbench as go \} from '@\/common\/visit-subscriptions\.js'/)
})

test('线上任务工作台挪进 staff 分包，两个页面显式引入，主包里没有它', () => {
  assert.ok(!existsSync(join(ROOT, 'components/k-online-work')), '主包 components/ 下不能再有 k-online-work（easycom 会把它打进主包）')
  for (const src of [staffIndex, business]) {
    assert.match(src, /import KOnlineWork from '\.\/components\/k-online-work\.vue'/)
    assert.match(src, /^<template>\n {2}<k-staff-pending v-if="pendingScope" \/>\n {2}<k-online-work v-else-if="onlineStaff" \/>/)
  }
  // staff 是分包，组件文件在它的根目录下
  const staffPack = pagesJson.subPackages.find(p => p.root === 'pages/staff')
  assert.ok(staffPack, 'pages/staff 是分包')
  assert.ok(!pagesJson.easycom, 'pages.json 没有自定义 easycom 规则把 k-* 指回 components/')
  // 除了 staff 分包里这两页，任何地方都不引用它（主包 = 不在任何分包根目录下的文件）
  const roots = pagesJson.subPackages.map(p => p.root + '/')
  const users = []
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = dir + '/' + name
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel)
      else if (/\.(vue|js)$/.test(name) && /k-online-work|KOnlineWork/.test(readUtf8(rel))) users.push(rel)
    }
  }
  for (const d of ['pages', 'components', 'common']) walk(d)
  for (const f of ['App.vue', 'main.js']) if (/k-online-work/.test(readUtf8(f))) users.push(f)
  assert.deepEqual(users.sort(), ['pages/staff/business.vue', 'pages/staff/index.vue'])
  assert.ok(users.every(u => roots.some(r => u.startsWith(r))), '引用方都在分包里')
  assert.ok(existsSync(join(ROOT, 'pages/staff/components/k-online-work.vue')) && roots.includes('pages/staff/'), '组件在 staff 分包根目录下')
})

// ---------------------------------------------------------------- 底栏高亮

test('底栏：专员在报名列表亮「报名」、在任务页亮「工作台」，商家服务人在报名列表亮业务', () => {
  // 专员的第二格（key=business）就是报名列表
  assert.match(tabbar, /\.\.\.\(threeTabStaff\.value \? \[\] : \[\{ key: 'business', label: onlineStaff\.value \? '报名' : '业务', icon: 'briefcase-business', url: onlineStaff\.value \? '\/pages\/staff\/applications\?jobType=online' : '\/pages\/staff\/business' \}\]\),/)
  const appBars = tabbars(applications)
  assert.equal(appBars.length, 2)
  for (const bar of appBars) assert.equal(bar, `<k-tabbar mode="staff" :active="onlineStaff || merchantService ? 'business' : 'work'" />`)
  assert.match(applications, /import \{[^}]*\bonlineStaff\b[^}]*\} from '@\/common\/experience\.js'/)
  assert.deepEqual(tabbars(onlineJobs), [`<k-tabbar v-if="s !== 1" mode="staff" :active="onlineStaff ? 'work' : 'business'" />`])
  assert.deepEqual(tabbars(work), ['<k-tabbar mode="staff" active="work" />'])
})

// ---------------------------------------------------------------- 接站需求去掉

test('员工端报名详情不再显示接站需求，「更新于…」提示保留', () => {
  assert.doesNotMatch(applications, /接站/)
  assert.doesNotMatch(applications, /needPickup/)
  const fields = applications.slice(applications.indexOf('const arrivalFields = computed'), applications.indexOf('const arrivalTickets'))
  assert.deepEqual([...fields.matchAll(/label: '([^']+)'/g)].map(m => m[1]), ['到达日期', '到达时间', '交通方式', '车次 / 航班'])
  assert.match(applications, /<text v-if="arrivalInfo\.updateTime" class="arrival-info__hint">更新于 \{\{ arrivalInfo\.updateTime \}\}<\/text>/)
  assert.match(applications, /\.arrival-info__hint\{display:block;margin-top:10px;color:var\(--k-muted\);font-size:12px;line-height:1\.6\}/)
})

// ---------------------------------------------------------------- 后端

test('发布接口对专员开放、查「线上任务·编辑」；线下岗位发布仍不开放', () => {
  const create = extCtl.slice(extCtl.indexOf('@PostMapping("/online/tasks")') - 120, extCtl.indexOf('return AjaxResult.success(online.create(c, body));'))
  assert.match(create, /@AppAuth\(staff = true, onlineStaff = true, merchant = true, merchantService = true\)\n {4}@PostMapping\("\/online\/tasks"\)/)
  assert.match(create, /support\.need\(c, "online", StaffPerms\.EDIT, "online_create", "发布线上任务"\)/)
  assert.doesNotMatch(create, /"jobs", StaffPerms\.EDIT/)
  const offline = opsCtl.slice(opsCtl.indexOf('@PostMapping("/jobs")') - 80, opsCtl.indexOf('public AjaxResult createJob('))
  assert.doesNotMatch(offline, /onlineStaff = true/)
  assert.match(opsCtl, /@RequestMapping\("\/app\/staff"\)\n@AppAuth\(staff = true\)\npublic class AppStaffOpsController/)
  assert.match(perms, /ITEMS\.put\("online", "线上任务（编辑=发布、验收）"\);/)
})

test('专员发布后通知本店有线上任务付款权限的人员，点开是这个任务', () => {
  const create = method(onlineJava, 'create')
  assert.match(create, /if \(StaffRole\.ONLINE_STAFF\.equals\(c\.role\) \|\| StaffRole\.CITY_LEAD\.equals\(c\.role\)\)/)
  const notify = method(onlineJava, 'notifyManagersOfSpecialistTask')
  assert.match(notify, /switched \? "role_code in \('merchant','merchant_service'\) " : "role_code = 'manager' "/)
  assert.match(notify, /and status = '0' and del_flag = '0' and app_user_id <> :me/)
  assert.match(notify, /"专员 " \+ c\.name\(\) \+ " 提交了线上任务「"/)
  assert.match(notify, /平台审核通过后上线；/)
  assert.match(notify, /switched \? "验收后请线下付款并登记" : "验收后由你线下付款"/)
  assert.match(notify, /"\/pages\/staff\/online-jobs\?jobId=" \+ jobId \+ "&storeId=" \+ c\.storeId/)
  assert.match(notify, /support\.notifyStaff\(uid, "system", "专员提交了线上任务", content, "job", jobId, route\)/)
})

test('线上任务的平台审核结果点开去任务详情，消息中心对专员只放行这一类 job 通知', () => {
  const n = method(jobImpl, 'notifyStaffJob')
  assert.match(n, /boolean online = JobType\.ONLINE\.equals\(KgJdbc\.asStr\(j\.get\("jobType"\)\)\);\s*String route = online \? "\/pages\/staff\/online-jobs\?jobId=" \+ jobId \+ "&storeId=" \+ storeId : "\/pages\/staff\/jobs"/)
  // 专员进不了岗位管理：线上任务通过的文字说去线上任务里看，线下岗位文字不变
  assert.match(n, /ok \? \(online \? "已上线，可以在线上任务里查看和分享" : "已上架，可以在岗位管理里分享招募"\)/)
  const start = mapper.indexOf('<sql id="currentChatReception">')
  const acl = mapper.slice(start, mapper.indexOf('</sql>', start)).replace(/<!--[\s\S]*?-->/g, '')
  // 2026-11-09：线上任务到期关闭、还有接单申请没审核时，门店那条点开是线上接单的报名列表（jobType=online），同一条规则一并放行
  const clause = /or \(biz_type='job' and \(kg_message\.route like '\/pages\/staff\/online-jobs\?%' or kg_message\.route like '\/pages\/staff\/applications\?%jobType=online%'\) and exists\(([\s\S]*?)\)\)\)/.exec(acl)
  assert.ok(clause, '放行条件在 currentChatReception 里')
  // 必须是线上任务、收件人在任务所属门店有在职授权、门店正常
  for (const part of ["j.job_id=kg_message.biz_id", "j.job_type='online'", "g.store_id=j.store_id and g.app_user_id=#{recipientId}", "g.status='0' and g.del_flag='0'", "st.status='0' and st.del_flag='0'"]) {
    assert.ok(clause[1].includes(part), part)
  }
  // 放行条件挂在「带专员授权的账号」那一组 or 里（不影响其他账号），且在会话那段之前
  assert.ok(acl.indexOf("restricted.role_code='online_staff'") < clause.index)
  assert.ok(clause.index < acl.indexOf("and (biz_type &lt;&gt; 'chat_conv'"))
  // 草稿到期没上架的通知同样落在线上任务页（这条规则才能覆盖它）
  assert.match(method(onlineJava, 'closeExpiredTasks'), /"job", jobId,\s*"\/pages\/staff\/online-jobs\?jobId=" \+ jobId \+ "&storeId=" \+ storeId\)/)
})
