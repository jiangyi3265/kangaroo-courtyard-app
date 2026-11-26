// 2026-10-31 主人：报名结束页「分享给亲友」「安全负责人」，亲友打开的行程页。真接口、真页面的走查在 forms-batch/try/user-side/tools/，这里钉纯逻辑和模板。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'
import * as T from '../pages/jobs/trip-share.js'
import { API_BASE } from '../common/config.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8')
const norm = (s) => s.replace(/\r\n/g, '\n')
const sfc = (rel) => parse(src(rel)).descriptor

test('分享标题：三种岗位的说法；没称呼写「我的朋友」', () => {
  const t = { name: '小杨', arrival: '2026-11-07', place: '平潭袋鼠小院' }
  assert.equal(T.tripTitle({ ...t, jobType: 'volunteer' }), '小杨 11月7日 到 平潭袋鼠小院 做换工')
  assert.equal(T.tripTitle({ ...t, jobType: 'parttime' }), '小杨 11月7日 到 平潭袋鼠小院 做兼职')
  assert.equal(T.tripTitle({ ...t, jobType: 'fulltime' }), '小杨 11月7日 到 平潭袋鼠小院 工作')
  assert.equal(T.tripTitle({ ...t, name: '', jobType: 'volunteer' }), '我的朋友 11月7日 到 平潭袋鼠小院 做换工')
  assert.equal(T.tripTitle({ ...t, name: '13812345678', jobType: 'volunteer' }), '我的朋友 11月7日 到 平潭袋鼠小院 做换工', '简历称呼写成手机号也不能发出去')
  assert.equal(T.monthDay('2026-01-02'), '1月2日')
  assert.equal(T.monthDay('乱写'), '')
})

test('称呼：拒手机号、网址、标签；去空白；最多 8 个字，表情算一个', () => {
  assert.equal(T.cleanName(' 小 杨 '), '小杨')
  assert.equal(T.cleanName('13812345678'), '')
  assert.equal(T.cleanName('138-0000-0000'), '', '隔开写也算')
  assert.equal(T.cleanName('１３８１２３４５６７８'), '', '全角数字也算')
  assert.equal(T.cleanName('小杨1234'), '小杨1234', '四位数字以内的昵称可以')
  assert.equal(T.cleanName('http://x'), '')
  assert.equal(T.cleanName('www.a'), '')
  assert.equal(T.cleanName('a.com'), '')
  assert.equal(T.cleanName('<b>杨</b>'), '')
  assert.equal(T.cleanName('{杨}'), '')
  assert.equal(T.cleanName('一二三四五六七八九十'), '一二三四五六七八')
  assert.equal(Array.from(T.cleanName('😀😀😀😀😀😀😀😀😀')).length, 8)
  assert.equal(T.cleanName(null), '')
  assert.equal(T.cleanName(undefined), '')
})

test('分享路径：只带 jobId、date、days、name；绝不带手机号；称呼编码', () => {
  const p = T.tripPath({ jobId: 12, arrival: '2026-11-07', days: 30, name: '小杨', phone: '13812345678', place: '平潭' })
  assert.equal(p, '/pages/jobs/itinerary?jobId=12&date=2026-11-07&days=30&name=' + encodeURIComponent('小杨'))
  assert.doesNotMatch(p, /phone|138|place/)
  assert.deepEqual([...new URL('http://x' + p).searchParams.keys()], ['jobId', 'date', 'days', 'name'])
  assert.equal(new URL('http://x' + T.tripPath({ jobId: 1, arrival: '2026-11-07', days: 0, name: '13812345678' })).searchParams.get('name'), '')
  assert.equal(T.tripPath({ jobId: 1, arrival: '2026-11-07', days: null, name: '' }), '/pages/jobs/itinerary?jobId=1&date=2026-11-07&days=&name=')
})

test('打开行程页：坏参数给「打不开」，时长不对只是不显示，称呼过不了用「我的朋友」', () => {
  const good = { jobId: '12', date: '2026-11-07', days: '30', name: '小杨' }
  assert.deepEqual(T.parseTripQuery(good), { invalid: false, jobId: 12, date: '2026-11-07', days: 30, name: '小杨' })
  for (const bad of [
    null, {}, { ...good, jobId: 'abc' }, { ...good, jobId: '0' }, { ...good, jobId: '-1' }, { ...good, jobId: '1.5' }, { ...good, jobId: '' }, { ...good, jobId: '12 or 1=1' },
    { ...good, date: '' }, { ...good, date: '2026-02-30' }, { ...good, date: '2026-13-01' }, { ...good, date: '2026/11/07' }, { ...good, date: '11月7日' }
  ]) assert.deepEqual(T.parseTripQuery(bad), { invalid: true }, JSON.stringify(bad))
  assert.equal(T.parseTripQuery({ ...good, days: '0' }).days, 0)
  assert.equal(T.parseTripQuery({ ...good, days: '366' }).days, 0)
  assert.equal(T.parseTripQuery({ ...good, days: 'abc' }).days, 0)
  assert.equal(T.parseTripQuery({ ...good, days: '' }).days, 0)
  assert.equal(T.parseTripQuery({ ...good, days: '365' }).days, 365)
  assert.equal(T.parseTripQuery({ ...good, name: '' }).name, '我的朋友')
  assert.equal(T.parseTripQuery({ ...good, name: '13812345678' }).name, '我的朋友')
  assert.equal(T.parseTripQuery({ ...good, name: 'http://evil' }).name, '我的朋友')
  assert.equal(T.parseTripQuery({ ...good, name: '快来这家店报名吧真的很好' }).name, '我的朋友', '正常分享最多 8 个字，超了就是被改过')
  assert.equal(T.parseTripQuery({ ...good, name: '一二三四五六七八' }).name, '一二三四五六七八')
})

test('复制给亲友的一段话：网页版用当前站点，地址里没有手机号', () => {
  const trip = { name: '小杨', arrival: '2026-11-07', place: '平潭袋鼠小院', jobType: 'volunteer', days: 30, jobId: 12, phone: '13812345678' }
  assert.equal(T.tripCopyText(trip, 'http://127.0.0.1:5491/#/pages/jobs/apply?jobId=12'),
    '小杨 11月7日 到 平潭袋鼠小院 做换工，预计待一个月。行程：http://127.0.0.1:5491/#/pages/jobs/itinerary?jobId=12&date=2026-11-07&days=30&name=' + encodeURIComponent('小杨'))
  const copied = T.tripCopyText({ ...trip, days: 0 })
  assert.equal(copied, '小杨 11月7日 到 平潭袋鼠小院 做换工。行程：' + API_BASE +
    '/#/pages/jobs/itinerary?jobId=12&date=2026-11-07&days=&name=' + encodeURIComponent('小杨'))
  assert.doesNotMatch(copied, /138/)
  for (const href of ['about:blank', 'invalid']) {
    assert.equal(T.tripCopyText({ ...trip, days: 0 }, href), copied)
  }
})

test('转发：有行程发行程，没有发岗位详情；本地占位图、空封面不传 imageUrl', () => {
  const trip = { name: '小杨', arrival: '2026-11-07', place: '平潭袋鼠小院', jobType: 'volunteer', days: 30, jobId: 12 }
  const fallback = T.jobShareFallback(12, '平潭海岛体验官')
  assert.deepEqual(fallback, { title: '平潭海岛体验官', path: '/pages/jobs/detail?jobId=12' })
  assert.deepEqual(T.jobShareFallback(undefined, ''), { title: '袋鼠全球青年', path: '/pages/home/index' })
  assert.deepEqual(T.tripShareMessage(null, fallback), fallback)
  assert.deepEqual(T.tripShareMessage({ ...trip, arrival: '' }, fallback), fallback)
  const m = T.tripShareMessage({ ...trip, imageUrl: T.tripImageUrl('https://x/a.jpg') }, fallback)
  assert.equal(m.title, '小杨 11月7日 到 平潭袋鼠小院 做换工')
  assert.match(m.path, /^\/pages\/jobs\/itinerary\?jobId=12&/)
  assert.equal(m.imageUrl, 'https://x/a.jpg')
  assert.equal('imageUrl' in T.tripShareMessage({ ...trip, imageUrl: T.tripImageUrl('/static/media/cover-empty.png') }, fallback), false)
  assert.equal('imageUrl' in T.tripShareMessage({ ...trip, imageUrl: T.tripImageUrl('') }, fallback), false)
})

test('行程页在 jobs 分包，不进主包；游客能开（不在 staff / manage 拦截名单）；模板用的都定义了', () => {
  const pages = JSON.parse(src('pages.json').replace(/\/\/.*$/gm, ''))
  const jobs = pages.subPackages.find(p => p.root === 'pages/jobs')
  assert.ok(jobs.pages.some(p => p.path === 'itinerary' && p.style.navigationStyle === 'custom'))
  assert.equal(pages.pages.some(p => /itinerary/.test(p.path)), false)
  assert.doesNotMatch(src('common/routes.js'), /itinerary/)
  assert.doesNotMatch(src('main.js'), /itinerary/)
  // 页面名和逻辑文件不同名（同名的 .js 会被打到包根目录，merchant-app 钉过）
  assert.equal(fs.existsSync(path.join(APP, 'pages/jobs/itinerary.js')), false)
  const d = sfc('pages/jobs/itinerary.vue')
  const s = d.scriptSetup.content
  assert.match(s, /parseTripQuery\(decodeQuery\(q0\)\)/, '用 decodeQuery，不要自己再解一次')
  assert.match(s, /onShareAppMessage\(/)
  assert.match(s, /apiJobDetail\(query\.value\.jobId\)/)
  assert.doesNotMatch(s + d.template.content, /phone|手机号码|mobile/i)
  assert.match(d.template.content, /不会显示手机号/)
  assert.match(d.template.content, /查看这个地方/)
  assert.match(d.template.content, /这个行程链接打不开了/)
})

test('小入口窄屏不截断：角色、地点都写全，放不下就在两段中间折行', () => {
  const d = sfc('pages/jobs/components/safety-share.vue')
  const t = norm(d.template.content)
  // 2026-11-03 主人：「安全负责人 · 换工主理人」改成一句「有问题找当地主理人」
  assert.match(t, /<text class="ss-label">\{\{ isService \? '有问题找客服' : '有问题找' \+ contactParty \}\}<\/text>/)
  assert.doesNotMatch(t, /<text>安全负责人 ·/)
  assert.match(t, /userRoleWording\(safety\.roleLabel\)/)
  assert.match(t, /直接联系这位当地主理人/)
  assert.match(t, /<view class="ss-name ss-name--small ss-name--pair"><text>\{\{ shareWhen \}\}<\/text><text>\{\{ sharePlace \}\}<\/text><\/view>/)
  assert.match(d.styles.map(s => s.content).join('\n'), /\.ss-label--pair, \.ss-name--pair \{[^}]*flex-wrap: wrap;[^}]*white-space: normal;/)
})

test('四个页面都有安全行程转发钩子；进度页的联系人移到责任书后的订票屏', () => {
  const apply = norm(sfc('pages/jobs/apply.vue').template.content)
  const progress = norm(sfc('pages/jobs/progress.vue').template.content)
  const interview = norm(sfc('pages/jobs/interview.vue').template.content)
  assert.match(apply, /<safety-share v-if="saved && !isOnline && appId" :app-id="appId" @ready="onTrip" \/>/)
  assert.match(progress, /<view v-if="detail && !isOnline" class="safety-entry"><safety-share compact :app-id="appId" :status="detail\.status" @ready="onTrip" \/><\/view>/)
  assert.match(interview, /<safety-share v-if="appId && detail" compact :app-id="appId" :status="status" @ready="onTrip" \/>/)
  const inVideo = interview.slice(interview.indexOf('v-else-if="s === 2"'), interview.indexOf('v-else class="progress-body'))
  assert.doesNotMatch(inVideo, /safety-share/, '视频示意屏和问卷屏不放')
  const contract = norm(sfc('pages/jobs/contract.vue').template.content)
  assert.match(contract, /<safety-share v-if="appId" compact :app-id="appId" :status="c\.status" @ready="onTrip" \/>/)
  const departure = contract.slice(contract.indexOf('v-else-if="s === 3"'), contract.indexOf('v-else class="finish-body"'))
  assert.match(departure, /safety-share/)
  assert.doesNotMatch(interview.slice(interview.indexOf('v-else class="progress-body')), /safety-share/)
  for (const f of ['pages/jobs/apply.vue', 'pages/jobs/progress.vue', 'pages/jobs/interview.vue', 'pages/jobs/contract.vue']) {
    const s = sfc(f).scriptSetup.content
    assert.match(s, /onShareAppMessage\(\(\) => tripShareMessage\(trip\.value, jobShareFallback\(/, f)
    assert.match(s, /const trip = ref\(null\)/, f)
    assert.match(s, /const onTrip = /, f)
    assert.match(s, /import SafetyShare from '\.\/components\/safety-share\.vue'/, f)
    assert.match(s, /import \{ [^}]*onShareAppMessage[^}]*\} from '@dcloudio\/uni-app'/, f)
  }
})

test('安全负责人组件：接口写在组件里不进 api.js；四种情况都有退路；网页版改复制', () => {
  const d = sfc('pages/jobs/components/safety-share.vue')
  const tpl = d.template.content
  const s = d.scriptSetup.content
  assert.match(s, /get\('\/app\/application\/' \+ props\.appId \+ '\/after-apply'\)/)
  assert.doesNotMatch(src('common/api.js'), /after-apply/)
  assert.doesNotMatch(s, /@\/common\/api\.js/)
  assert.doesNotMatch(s, /support-fab/, '不依赖主包的新模块')
  // 线上任务、已结束的不出
  assert.match(s, /!d\.online && !d\.ended && !!d\.trip && !!d\.safety/)
  // 有人：进门店会话；没人：微信里是客服会话按钮，网页版去客服中心
  assert.match(s, /safety\.value\.designated \? '&contact=lead' : ''/)
  assert.match(s, /go\('\/pages\/notice\/support'\)/)
  assert.match(tpl, /#ifdef MP-WEIXIN -->\s*<button v-if="isService" class="ss-act" open-type="contact" :session-from="contactFrom"/)
  assert.match(tpl, /#ifndef MP-WEIXIN -->\s*<view v-if="isService" class="ss-act"[^>]*@click="openSupport"/)
  assert.match(s, /'\|support-safety'/, 'session-from 同现有 contactFrom 的格式：用户ID|support-情境')
  // 分享：微信是转发按钮，网页版改复制；称呼能临时改，不写回简历
  assert.match(tpl, /open-type="share" label="分享给亲友"/)
  assert.match(tpl, /label="复制行程发给亲友" @click="copyTrip"/)
  assert.match(s, /const editName = async/)
  assert.doesNotMatch(s, /apiSaveResume|\/app\/resume/)
  assert.match(tpl, /不会带上你的手机号/)
  assert.match(tpl, /联系人信息暂时读不到，点这里重试/)
  for (const m of tpl.matchAll(/<view\b[^>]*@click[^>]*>/g)) assert.match(m[0], /hover-class/, m[0])
  assert.doesNotMatch(s.slice(s.indexOf('const shareTrip'), s.indexOf('const shareTitle')), /contactPhone|phoneNumber/, '门店联系电话不进入分享行程')
})

test('support-fab 的名单含行程页：亲友看的页面不放客服钮', { skip: !fs.existsSync(path.join(APP, 'common/support-fab.js')) }, () => {
  assert.match(src('common/support-fab.js'), /pages\/jobs\/itinerary/)
})
