import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// 在店换工（没有员工授权）认领门店任务：入口、路由守卫与换工视图（2026-10-13 端到端检查发现换工根本打不开任务页）
const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('route guard lets a signed-in volunteer into the store task page only', () => {
  const main = read('main.js')
  // 只有门店任务页对已登录的非员工放行，其他经营页照旧送去员工入口
  assert.match(main, /!hasStaffAccess\.value && !\(route === 'pages\/manage\/tasks' && experience\.account\)/)
  assert.match(main, /uni\.redirectTo\(\{ url: '\/pages\/auth\/identity' \}\)/)
})

// 2026-10-18 主人重排「我的」：去掉「门店任务」入口（换工从门店发的消息、员工端进任务页；路由守卫照旧放行在店换工）
test('profile no longer shows a store-task entry (owner 10-18); the task page itself still lets volunteers in', () => {
  const profile = read('pages/profile/index.vue')
  assert.doesNotMatch(profile, /label: '门店任务'/)
  assert.doesNotMatch(profile, /url: R\.tasks/)
})

test('volunteers only see volunteer tasks and can ask instead of opening the staff appeal page', () => {
  const tasks = read('pages/manage/tasks.vue')
  assert.match(tasks, /<view v-if="!volunteerView" class="k-between"><text class="section-title">员工任务<\/text>/)
  assert.match(tasks, /<view v-if="!volunteerView" class="task-card">/)
  assert.match(tasks, /const appeal = \(\) => \(hasStaffAccess\.value \? go\(R\.honor/)
})

test('birthday toast no longer promises a gift to everyone', () => {
  const profile = read('pages/profile/index.vue')
  assert.equal(profile.includes('当天领礼物'), false)
  assert.match(profile, /\['manager', 'city_lead'\]\.includes\(g\.roleCode\)/)
})
