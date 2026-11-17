// 2026-10-31 主人：申请代运营和云连锁，首先把云连锁改成抖音卖房，然后拿出来。
// 守住：小程序、后台、后端代码里 0 处老名字（以后谁再写进来就红）；内部编码 cloud_chain 不改（老版本小程序、老数据都靠它）；已存数据靠 V66 改。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc')
const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8')
const OLD = '云' + '连锁'

const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const logic = await vite.ssrLoadModule('/pages/staff/merchant-request-logic.js')
const view = await vite.ssrLoadModule('/pages/staff/request-view.js')
await vite.close()

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
  ? (e.name === 'node_modules' ? [] : walk(path.join(dir, e.name)))
  : (/\.(vue|js|mjs|ts|scss|css|json|java|xml|yml|sql)$/.test(e.name) ? [path.join(dir, e.name)] : []))

test('小程序、后台、后端代码里一处老名字都没有（注释也算）', () => {
  const hits = []
  for (const dir of ['袋鼠旅游2/pages', '袋鼠旅游2/components', '袋鼠旅游2/common', 'RuoYi-Vue3/src', 'RuoYi-Vue/ruoyi-kangaroo/src/main']) {
    for (const file of walk(path.join(ROOT, dir))) {
      if (fs.readFileSync(file, 'utf8').includes(OLD)) hits.push(path.relative(ROOT, file))
    }
  }
  assert.deepEqual(hits, [])
})

test('申请表单：标题和说明都是抖音卖房；两种申请的编码没变', () => {
  assert.deepEqual(Object.keys(logic.APPLY_KINDS), ['managed', 'cloud_chain'])
  assert.equal(logic.APPLY_KINDS.managed.title, '申请代运营')
  assert.equal(logic.APPLY_KINDS.cloud_chain.title, '申请抖音卖房')
  assert.match(logic.APPLY_KINDS.cloud_chain.tip, /抖音上卖房/)
  assert.equal(logic.ONLINE_CHOICES, undefined, '不再三选一')
})

test('换工主理人代商家提交的入口保留，只改名：提交的还是 cloud_chain', () => {
  assert.deepEqual(view.SUBMIT_TYPES, [{ value: 'managed', label: '代运营' }, { value: 'cloud_chain', label: '抖音卖房' }])
  assert.equal(view.submitErrors({ requestType: 'x' }).requestType, '请选择代运营或抖音卖房')
  assert.match(read('pages/staff/intake.vue'), /<!-- 3 代商家提交代运营 \/ 抖音卖房 -->/)
})

test('商家首页：四个板块不动，下面单独两个入口，各一句说明；点「线上任务」不再弹选择', () => {
  const { descriptor } = compiler.parse(read('pages/staff/components/k-merchant-work.vue'))
  const tpl = descriptor.template.content, js = descriptor.scriptSetup.content
  assert.match(js, /\{ kind: 'managed', label: '申请代运营', desc: '[^']+', icon: 'store' \}/)
  assert.match(js, /\{ kind: 'cloud_chain', label: '抖音卖房', desc: '[^']+', icon: 'clapperboard' \}/)
  assert.match(tpl, /v-for="entry in applyBoards"[^>]*@click="openBoard\(entry\.kind\)"/)
  assert.match(tpl, /\{\{ entry\.desc \}\}/)
  assert.ok(tpl.indexOf('applyBoards') > tpl.indexOf('v-for="b in boards"') && tpl.indexOf('applyBoards') < tpl.indexOf('boards-tip'), '两个入口紧跟四个板块，说明文字在它们下面')
  assert.doesNotMatch(js, /\bsheet\b/, '不再三选一，也不用引 sheet')
  const icons = (() => { const s = read('common/icons.js'); return JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1)) })()
  assert.ok(icons.store && icons.clapperboard)
})

test('商家服务人的两个页面写的是抖音卖房', () => {
  // 2026-11-03 主人要求三类分开：页签、工作台格子都从 REQUEST_KINDS 来
  assert.match(read('pages/staff/request-view.js'), /\{ type: 'cloud_chain', label: '抖音卖房', name: '抖音卖房', icon: 'clapperboard' \}/)
  assert.match(read('pages/staff/service.vue'), /转来的抖音卖房需求/)
  assert.match(read('pages/staff/components/k-service-work.vue'), /REQUEST_KINDS/)
})

test('V66 把已存的数据也改了：字典备注、菜单备注、需求标题、站内信；只动这几处，标题和通知都防超长', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'RuoYi-Vue/sql/kangaroo/V66__forms.sql'), 'utf8')
  assert.match(sql, /update sys_dict_data set remark = replace\(remark,\s*'云连锁',\s*'抖音卖房'\)[^;]*dict_type\s*=\s*'kg_staff_role'[^;]*dict_value\s*=\s*'merchant_service'/i)
  assert.match(sql, /update sys_menu set remark = replace\(remark,\s*'云连锁',\s*'抖音卖房'\)[^;]*perms\s*=\s*'kangaroo:merchantrequest:list'/i)
  assert.match(sql, /update kg_merchant_request set title = left\(replace\(title,\s*'云连锁',\s*'抖音卖房'\),\s*64\)[^;]*request_type\s*=\s*'cloud_chain'/i)
  assert.match(sql, /update kg_message[^;]*left\(replace\(title,\s*'云连锁',\s*'抖音卖房'\),\s*128\)[^;]*left\(replace\(content,\s*'云连锁',\s*'抖音卖房'\),\s*500\)[^;]*biz_type\s*=\s*'merchant_request'/i)
})
