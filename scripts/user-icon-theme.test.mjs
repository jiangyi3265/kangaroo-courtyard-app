import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isUserIconPage } from '../common/user-icons/scope.js'
import { drawings } from '../common/user-icons/drawings.js'
import { userIconSvg, userIconPicture } from '../common/user-icons/art.js'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const config = JSON.parse(read('pages.json'))
const routes = [...config.pages.map(page => page.path),
  ...config.subPackages.flatMap(pack => pack.pages.map(page => pack.root + '/' + page.path))]
const normal = { color: '#3A322B', tone: 'ink', fill: true, size: 24, stroke: '' }

test('消费者页面接入统一主题，并与原图标的页面范围一致', () => {
  for (const route of routes) {
    const template = read(route + '.vue').split('<script')[0]
    const bindings = template.match(/<view\b[^<>]*:class="[^"]*\$userSurface\b[^"]*"/g) || []
    assert.equal(bindings.length, isUserIconPage(route) ? 1 : 0, route)
  }
})

test('狼人杀的全部页面和工作人员页面沿用各自原本的图标', () => {
  const game = routes.filter(route => route.startsWith('pages/werewolf/'))
  assert.deepEqual(game.map(route => route.split('/').pop()).sort(), ['game', 'index', 'invite', 'result', 'room', 'rules'])
  for (const route of routes.filter(route => /^pages\/(werewolf|staff|manage)\//.test(route))) {
    assert.equal(isUserIconPage('/' + route + '?s=2'), false, route)
  }
  for (const route of ['pages/community/index', 'pages/party/index', 'pages/undercover/room', 'pages/home/index']) {
    assert.equal(isUserIconPage(route), true, route)
  }
  assert.equal(isUserIconPage(''), false)
  assert.equal(Object.keys(drawings).some(name => /^(role|seat)-/.test(name)), false)
})

test('攒局分类直接展示信息流，四个玩法仍有独立页面', () => {
  const template = read('pages/community/index.vue').split('<script')[0]
  assert.doesNotMatch(template, /play-scroll|play-grid|袋鼠狼人杀|谁是卧底|好友桌游|聚会小工具/)
  assert.match(template, /@click="onFeedTab\(t\)"/)
  assert.match(template, /@click="toggleSort"/)
  for (const route of ['pages/werewolf/index', 'pages/undercover/index', 'pages/party/index', 'pages/undercover/tools']) {
    assert.ok(routes.includes(route), route)
  }
})

test('选中、未选、反白和旧图标名均可解析，未收录图标交回原渲染器', () => {
  for (const key of ['heart', 'star', 'bookmark']) {
    const selected = userIconSvg(key, normal)
    const outline = userIconSvg(key, { ...normal, fill: false })
    assert.notEqual(selected, outline)
    assert.equal(outline, userIconSvg(key + '-outline', normal))
  }
  const ordinary = userIconSvg('check', normal)
  const light = userIconSvg('check', { ...normal, tone: 'white', color: '#FFFFFF' })
  assert.match(ordinary, /#89735E/)
  assert.match(light, /#FFFFFF/)
  assert.equal(userIconSvg('wifi', normal), userIconSvg('amenity-wifi', normal))
  assert.equal(userIconSvg('amenity-washer', normal), userIconSvg('amenity-laundry', normal))
  assert.equal(userIconSvg('unknown', normal), '')
  assert.equal(userIconPicture('role-wolf'), '')
})
