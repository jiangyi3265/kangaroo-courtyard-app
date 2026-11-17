import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

// 2026-11-03 主人：「面试时段设置」把腾讯会议链接粘进会议号栏，提示「腾讯会议号应为 9–12 位数字」存不了。
// 现在整段邀请 / 只有链接 / 只有会议号都能粘，自动拆出会议号、密码、链接；候选人那边会议号、密码、链接各自可复制
const source = await readFile(new URL('../common/meeting.js', import.meta.url), 'utf8')
const load = (src) => import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))
const m = await load(source)
const h5 = await load(source.replace(/\/\/ #ifdef MP-WEIXIN[\s\S]*?\/\/ #endif/g, ''))
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8'))

const LINK = 'https://meeting.tencent.com/dm/UnitTestOnlyNotAMeeting'
// 腾讯会议「复制邀请」的整段文字
const INVITE = `袋鼠旅游 邀请您参加腾讯会议
会议主题：袋鼠旅游面试
会议时间：2026/11/05 10:00-10:30 (GMT+08:00) 中国标准时间 - 北京

点击链接入会，或添加至会议列表：
${LINK}

#腾讯会议：900-000-001
会议密码：654321

手机一键拨号入会
+8675536550000,,900000001#,,#,654321# (中国大陆)
+85230018898,,,2,900000001#,,#,654321# (中国香港)

根据您的位置拨号
+8675536550000 (中国大陆)

复制该信息，打开手机腾讯会议即可参与`

test('synthetic regression: a link pasted into the code box plus password 654321 now saves', () => {
  const r = m.readCodeInput(LINK, '654321', '')
  assert.deepEqual(r, { code: '', pwd: '654321', link: LINK })
  assert.equal(m.tencentInputError(r.code, r.pwd, r.link), '')
  const text = m.formatTencentMeeting(r.code, r.pwd, '', r.link)
  assert.equal(text, '腾讯会议链接：' + LINK + '\n密码：654321')
  assert.deepEqual(m.parseTencentMeeting(text), { code: '', pwd: '654321', note: '', link: LINK })
})

test('a whole invitation yields code, password and link, also when pasted into a single-line box', () => {
  const want = { code: '900000001', pwd: '654321', link: LINK }
  const r = m.parseTencentMeeting(INVITE)
  assert.deepEqual({ code: r.code, pwd: r.pwd, link: r.link }, want)
  // 单行输入框会把换行吞掉，各行连在一起
  const flat = m.parseTencentMeeting(INVITE.replace(/\n/g, ''))
  assert.deepEqual({ code: flat.code, pwd: flat.pwd, link: flat.link }, want)
  // 粘到会议号栏、粘贴框，三栏都填上；邀请里的密码盖掉密码框里原来的
  assert.deepEqual(m.readCodeInput(INVITE, '0000', ''), want)
  assert.deepEqual(m.readMeetingPaste(INVITE, { code: '', pwd: '0000', link: '' }), want)
  // 存下来再读出来一样
  const text = m.formatTencentMeeting(want.code, want.pwd, '请提前 5 分钟入会', want.link)
  assert.equal(text, '腾讯会议号：900 000 001\n腾讯会议链接：' + LINK + '\n密码：654321\n请提前 5 分钟入会')
  assert.deepEqual(m.parseTencentMeeting(text), { ...want, note: '请提前 5 分钟入会' })
})

test('paste box keeps fields the paste did not mention and ignores unrelated text', () => {
  assert.deepEqual(m.readMeetingPaste('900 000 001', { pwd: '1234', link: LINK }), { code: '900000001', pwd: '1234', link: LINK })
  assert.deepEqual(m.readMeetingPaste(LINK, { code: '900000001', pwd: '1234' }), { code: '900000001', pwd: '1234', link: LINK })
  for (const t of ['', '明天见', 'https://example.com/room/1', '13800138000']) assert.equal(m.readMeetingPaste(t, {}), null, t)
})

test('links: no scheme, personal room /p/ and wemeet://, random slugs are not meeting codes', () => {
  assert.equal(m.parseTencentMeeting('meeting.tencent.com/dm/UnitTestOnlyNotAMeeting').link, 'https://meeting.tencent.com/dm/UnitTestOnlyNotAMeeting')
  assert.equal(m.parseTencentMeeting('https://meeting.tencent.com/p/9000000011').code, '9000000011')
  assert.equal(m.parseTencentMeeting('wemeet://page/inmeeting?meeting_code=900000001').code, '900000001')
  // 链接里的随机串碰巧有一串数字，也不当会议号
  assert.deepEqual(m.parseTencentMeeting('https://meeting.tencent.com/dm/UnitTestOnlyNotAMeeting'), { code: '', pwd: '', note: '', link: 'https://meeting.tencent.com/dm/UnitTestOnlyNotAMeeting' })
  // 链接后面跟的句号、括号不算链接
  assert.equal(m.parseTencentMeeting('入会链接：' + LINK + '。').link, LINK)
  assert.equal(m.cleanLink('  点这里 ' + LINK + ' 进入'), LINK)
  assert.equal(m.cleanLink('https://example.com/x'), 'https://example.com/x')
})

test('password box: pasted label sentences, spaces and full-width digits are cleaned', () => {
  assert.equal(m.cleanPwd('会议密码：654321'), '654321')
  assert.equal(m.cleanPwd(' 6543 21 '), '654321')
  assert.equal(m.cleanPwd('６５４３２１'), '654321')
  assert.equal(m.parseTencentMeeting('腾讯会议号：９００ ０００ ００１ 密码：６５４３２１').pwd, '654321')
  assert.equal(m.tencentInputError('900000001', 'Ab12cd34'), '')
  assert.match(m.tencentInputError('900000001', '12'), /4–12 位/)
})

test('validation: a number or a Tencent link is required, other links are refused', () => {
  assert.match(m.tencentInputError('', '', ''), /粘贴腾讯会议邀请/)
  assert.match(m.tencentInputError('', '', 'https://example.com/x'), /腾讯会议链接/)
  assert.match(m.tencentInputError(LINK, '', ''), /9–12 位数字/)
  assert.equal(m.tencentInputError('900000001', '', ''), '')
})

test('old saved texts read the same as before', () => {
  assert.deepEqual(m.parseTencentMeeting('腾讯会议号：900 000 001\n密码：6666\n请提前 5 分钟入会'), { code: '900000001', pwd: '6666', note: '请提前 5 分钟入会', link: '' })
  assert.equal(m.parseTencentMeeting('视频面试链接：https://example.com/room/abc，进不去请联系主理人'), null)
})

const mockUni = (onNavigate) => {
  const calls = { navigate: [], clipboard: [], toast: [], modal: [] }
  globalThis.uni = {
    navigateToMiniProgram: (o) => { calls.navigate.push(o); onNavigate && onNavigate(o) },
    setClipboardData: (o) => { calls.clipboard.push(o.data); o.success && o.success() },
    showToast: (o) => calls.toast.push(o.title),
    showModal: (o) => calls.modal.push(o.title + '|' + o.content)
  }
  return calls
}

test('link-only meeting: entering copies the link and says where to open it (mini program and H5)', () => {
  for (const mod of [m, h5]) {
    const calls = mockUni()
    mod.openTencentMeeting({ code: '', pwd: '654321', link: LINK })
    assert.deepEqual(calls.navigate, [])
    assert.deepEqual(calls.clipboard, [LINK])
    assert.match(calls.modal[0], /浏览器/)
  }
})

test('code + link: mini program still joins by code; H5 copies code, link and password', () => {
  let calls = mockUni()
  m.openTencentMeeting({ code: '900000001', pwd: '654321', link: LINK })
  assert.equal(calls.navigate[0].path, 'pages/index/index?chn=DaishuYard&code=900000001&pwd=654321')
  calls = mockUni()
  h5.openTencentMeeting({ code: '900000001', pwd: '654321', link: LINK })
  assert.deepEqual(calls.clipboard, ['腾讯会议号：900 000 001\n腾讯会议链接：' + LINK + '\n密码：654321'])
})

test('pages: slot settings has the paste box and link field; candidates copy code, password and link separately', async () => {
  const slots = await read('../components/k-interview-slots/k-interview-slots.vue')
  assert.match(slots, /粘贴腾讯会议邀请/)
  assert.match(slots, /readMeetingPaste\(/)
  assert.match(slots, /v-model="link"/)
  assert.match(slots, /tencentInputError\(code\.value,pwd\.value,link\.value\)/)
  assert.doesNotMatch(slots, /maxlength="6"/)
  const lobby = await read('../pages/jobs/interview.vue')
  for (const k of ['code', 'pwd', 'link']) assert.match(lobby, new RegExp(`copyText\\(tm\\.${k}\\)`))
  assert.match(lobby, /link: tm\.value\.link/)
  const staff = await read('../pages/staff/interviews.vue')
  assert.match(staff, /v-model="mLink"/)
  assert.match(staff, /link: dm\.value\.link/)
  assert.doesNotMatch(staff, /maxlength="6"/)
})
