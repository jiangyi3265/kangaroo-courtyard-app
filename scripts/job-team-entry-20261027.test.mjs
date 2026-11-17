import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import * as teamPage from '../pages/jobs/team-page.js'
import * as storePage from '../pages/jobs/store-page.js'
import * as companionsPage from '../pages/jobs/companions-page.js'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(app, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const original = compiler.parse(fs.readFileSync(path.join(app, 'pages/jobs/team.vue'), 'utf8')).descriptor.scriptSetup.content
const tick = () => new Promise(resolve => setImmediate(resolve))
function sourceFor(platform) {
  const keep = [], result = []
  for (const line of original.split('\n')) {
    const match = /^\s*\/\/\s*#(ifdef|ifndef|endif)\b\s*([\w-]*)/.exec(line)
    if (match) { if (match[1] === 'endif') keep.pop(); else keep.push(match[1] === 'ifdef' ? match[2] === platform : match[2] !== platform); continue }
    if (keep.every(Boolean)) result.push(line)
  }
  return result.join('\n')
}
function harness(platform = 'H5') {
  const source = sourceFor(platform), ast = compiler.babelParse(source, { sourceType: 'module' })
  const log = { teams: [], details: [], toasts: [], copies: [], routes: [], writes: [], shares: null, shops: [] }
  const data = { fail: false, team: { job: { jobId: 7, status: 'paused', title: '测试小院', jobType: 'parttime', storeId: 102 }, remaining: 2, members: [] }, detail: { jobId: 7, status: 'paused' } }
  let onLoad
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) {
    const actual = n.source.value === './team-page.js' ? teamPage : n.source.value === './store-page.js' ? storePage : n.source.value === './companions-page.js' ? companionsPage : null
    sandbox[s.local.name] = actual ? actual[s.imported.name] : () => undefined
  }
  Object.assign(sandbox, {
    ref: vue.ref, computed: vue.computed, ensureSession: async () => {},
    useScreen: (_, opts) => { onLoad = opts.onLoad; return vue.ref(1) },
    onShareAppMessage: fn => { log.shares = fn },
    toast: text => log.toasts.push(text), copy: value => log.copies.push(value), go: route => log.routes.push(route),
    errText: (e, fallback) => e?.message || fallback, absUrl: value => value || '',
    R: { jobsList: '/pages/jobs/list', jobDetail: '/pages/jobs/detail', jobCompanions: '/pages/jobs/companions', publish: '/pages/community/publish' },
    window: { location: { href: 'https://example.test/#/pages/jobs/team?jobId=7' } },
    apiJobDetail: async id => { log.details.push(id); return { data: data.detail } },
    apiJobTeam: async id => { log.teams.push(id); if (data.fail) throw new Error('岗位不存在或已下架'); return { data: data.team } },
    apiJoinTeam: async (...args) => { log.writes.push(args); return { data: data.team } },
    apiStoreReviews: async id => { log.shops.push(id); return { data: { store: { storeId: id }, list: [], rows: [] } } }
  })
  vm.createContext(sandbox)
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  vm.runInContext(body, sandbox)
  return { log, data, run: code => vm.runInContext(code, sandbox), open: async query => { await onLoad(query); await tick() } }
}

for (const platform of ['H5', 'MP-WEIXIN']) {
  test(`${platform}：缺失、非法岗位编号不请求岗位、不生成岗位0链接`, async () => {
    for (const jobId of [undefined, '', '0', '-1', 'Infinity', 'abc']) {
      const h = harness(platform); await h.open({ jobId })
      assert.match(h.run('entryError.value'), /缺少有效岗位/)
      for (const code of ['openJob()', 'copyLink()', "tapWay('community')", "tapWay('moments')", 'openCompanions()', 'savePoster()']) await h.run(code)
      assert.equal(h.run('jobReady.value'), false)
      assert.deepEqual(h.log.teams, []); assert.deepEqual(h.log.details, [])
      assert.deepEqual(h.log.routes, []); assert.deepEqual(h.log.copies, []); assert.deepEqual(h.log.writes, [])
      assert.equal(h.log.shares().path, '/pages/jobs/list')
    }
  })
  test(`${platform}：暂停岗位游客可查看分享，入口不再要求报名`, async () => {
    const h = harness(platform); await h.open({ jobId: '7' })
    assert.equal(h.run('jobReady.value'), true)
    assert.match(h.run('entryNotice.value'), /暂停招聘，暂不能报名/)
    assert.equal(h.log.shares().path, '/pages/jobs/detail?jobId=7')
    h.run('copyLink()'); assert.match(h.log.copies[0], /jobId=7/)
    h.run('openCompanions()'); assert.equal(h.log.routes.at(-1), '/pages/jobs/companions?jobId=7')
    assert.deepEqual(h.log.writes, [])
  })
}
test('同行接口失败后隐藏失效分享；重新加载成功恢复真实岗位', async () => {
  const h = harness(); h.data.fail = true; await h.open({ jobId: '7' })
  assert.equal(h.run('jobReady.value'), false); assert.match(h.run('entryError.value'), /不存在或已下架/)
  h.run('copyLink()'); assert.deepEqual(h.log.copies, [])
  h.data.fail = false; await h.run('retryEntry()')
  assert.equal(h.run('entryError.value'), ''); assert.equal(h.run('jobReady.value'), true)
  assert.equal(h.log.teams.length, 2)
})
test('接口未返回岗位或错返回其他岗位时不分享错误关联', async () => {
  for (const data of [null, {}, { job: { jobId: 8 } }]) {
    const h = harness(); h.data.team = data; await h.open({ jobId: '7' })
    assert.equal(h.run('jobReady.value'), false); assert.match(h.run('entryError.value'), /不存在或已下架/)
  }
})
test('门店评价直达不要求岗位编号', async () => {
  const h = harness(); await h.open({ storeId: '102' })
  assert.equal(h.run('entryError.value'), ''); assert.equal(h.run('s.value'), 4)
  assert.deepEqual(h.log.teams, []); assert.deepEqual(h.log.shops, [102])
})
test('暂停、结束、满员和关闭原因跟随真实状态；未知名额不当成满员', () => {
  assert.match(teamPage.teamEntryNotice({ status: 'paused' }, {}, 2), /暂停招聘/)
  assert.match(teamPage.teamEntryNotice({ status: 'closed' }, {}, 2), /结束招聘/)
  assert.match(teamPage.teamEntryNotice({ status: 'published' }, {}, 0), /名额已满/)
  assert.match(teamPage.teamEntryNotice({}, { acceptsApplication: false, applyClosedReason: '已过截止时间' }, 2), /已过截止时间/)
  for (const remaining of [undefined, null, '', 2]) assert.match(teamPage.teamEntryNotice({}, {}, remaining), /^查看主动加入的伙伴/)
})
