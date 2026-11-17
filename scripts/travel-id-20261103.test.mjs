// 2026-11-03 出行证件（主人：「订票以后让他提交这个身份证号」），node --test 直接跑：
//   · pages/jobs/travel-id.js：录用后才问、校验位和服务端同一算法、提示说人话；
//   · 卡片组件：证件号只放请求体（PUT），读回来的只有打码的；保险与完成屏只保留一处，订票共用；
//   · 服务端：/app/me/travel-id、密文存储、注销删除、V69。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { TRAVEL_ID_STATUSES, shouldAskTravelId, normalizeId, idChecksumOk, validName, checkTravelId } from '../pages/jobs/travel-id.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc')
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8').replace(/\r\n/g, '\n')
const JAVA = '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const ID = '11010519491231002X'

test('录用后（门店确认 / 已签署 / 已入职）的到店岗位才问证件号', () => {
  assert.deepEqual(TRAVEL_ID_STATUSES, ['store_confirmed', 'contract_signed', 'onboarded'])
  assert.equal(shouldAskTravelId('contract_signed', 'volunteer'), true)
  assert.equal(shouldAskTravelId('store_confirmed', ''), true)
  assert.equal(shouldAskTravelId('contract_signed', 'online'), false, '线上任务不用')
  for (const s of ['submitted', 'review_passed', 'interview_booked', 'interview_done', 'user_confirmed', 'withdrawn', 'terminated', '']) assert.equal(shouldAskTravelId(s, 'volunteer'), false, s)
})

test('校验：去空格、末位 x 大写、GB 11643 校验位、中文姓名', () => {
  assert.equal(normalizeId(' 110105 19491231 002x '), ID)
  assert.equal(idChecksumOk(ID), true)
  assert.equal(idChecksumOk('110105194912310021'), false)
  assert.equal(idChecksumOk('11010519491231002'), false)
  assert.equal(validName('张三'), true)
  assert.equal(validName('阿依古丽·买买提'), true)
  assert.equal(validName('Tom'), false)
  assert.equal(checkTravelId('张三', '110105 19491231 002x'), '')
  assert.equal(checkTravelId('', ID), '请填写证件上的姓名')
  assert.equal(checkTravelId('Tom', ID), '姓名请填身份证上的中文姓名')
  assert.equal(checkTravelId('张三', ''), '请填写身份证号')
  assert.equal(checkTravelId('张三', '1101051949'), '身份证号应为 18 位，现在是 10 位')
  assert.equal(checkTravelId('张三', '110105194912310021'), '身份证号好像填错了一位，请对着证件再核对一下')
})

test('卡片：证件号只走 PUT 请求体，不进链接；不弹窗、可以先跳过；模板可编译', () => {
  const src = read('pages/jobs/components/travel-id-card.vue')
  assert.match(src, /request\(\{ url: '\/app\/me\/travel-id', method: 'PUT', data: \{ name: String\(name\.value\)\.trim\(\), idNo: normalizeId\(idNo\.value\) \} \}\)/)
  assert.ok(!/travel-id\?|idNo=/.test(src), '链接里没有证件号')
  assert.ok(!/\bmodal\(|\bconfirm\(|\bprompt\(|showModal/.test(src), '不弹窗')
  assert.match(src, /暂不方便可稍后填写/)
  assert.match(src, /\{\{ info\.name \}\} · \{\{ info\.idMasked \}\}/, '交了以后只显示打码的号码')
  const { descriptor, errors } = compiler.parse(src, { filename: 'travel-id-card.vue' })
  assert.equal(errors.length, 0)
  const script = compiler.compileScript(descriptor, { id: 'tid' })
  const tpl = compiler.compileTemplate({ source: descriptor.template.content, filename: 'travel-id-card.vue', id: 'tid', compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(tpl.errors, [])
})

test('去掉订票页证件入口，仅在保险与完成页提交一次；联系人仍在订票页', () => {
  const contract = read('pages/jobs/contract.vue')
  const arrival = contract.slice(contract.indexOf('<view v-else-if="s === 3"'), contract.indexOf('<view v-else-if="s === 4" class="finish-body">'))
  const finish = contract.slice(contract.indexOf('<view v-else-if="s === 4" class="finish-body">'), contract.indexOf('<view v-else-if="s === 5"'))
  assert.ok(!arrival.includes('<travel-id-card'))
  assert.equal((contract.match(/<travel-id-card\b/g) || []).length, 1, '订票和保险只保留一个证件提交入口')
  assert.match(arrival, /<safety-share/)
  assert.match(finish, /<travel-id-card :status="c\.status"/)
  assert.match(contract, /import TravelIdCard from '\.\/components\/travel-id-card\.vue'/)
  const interview = read('pages/jobs/interview.vue')
  const progress = interview.slice(interview.indexOf('<view v-else class="progress-body'), interview.indexOf('<k-ai-sheet'))
  assert.ok(!progress.includes('<travel-id-card') && !progress.includes('<safety-share'))
  assert.ok(!progress.includes('class="help"'))
  // 组件和校验都在 jobs 分包里，主包（common/api.js、routes.js）不加东西
  assert.ok(!read('common/api.js').includes('travel-id'))
  assert.ok(!read('common/routes.js').includes('travel-id'))
})

test('服务端：密文存储、校验口径同实名、注销删除', () => {
  const svc = read(JAVA + 'ext/user/KgTravelIdService.java')
  assert.match(svc, /AES\/GCM\/NoPadding/)
  assert.match(svc, /KgAccountService\.idChecksumOk\(id\)/)
  assert.match(svc, /insert into kg_user_travel_id \(user_id, id_name, id_no_enc, id_last4, id_hash, create_time, update_time\)/)
  const ctl = read(JAVA + 'controller/app/AppTravelIdController.java')
  assert.match(ctl, /@RequestMapping\("\/app\/me\/travel-id"\)/)
  assert.match(ctl, /@PutMapping/)
  assert.match(read(JAVA + 'ext/user/KgAccountService.java'), /"delete from kg_user_travel_id where user_id = :u"/)
  assert.ok(fs.existsSync(path.join(APP, '../RuoYi-Vue/sql/kangaroo/V69__travel_id.sql')))
})
