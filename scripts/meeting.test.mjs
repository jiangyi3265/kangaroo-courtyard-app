import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

// 腾讯会议（common/meeting.js）：后端只存一段 meetingInfo 文字，前端靠这里认会议号、拼固定写法、一键拉起腾讯会议小程序。
// 认错号（把电话、日期当会议号）候选人会被带进一个不存在的会议；认不出则退回「复制会议信息」，所以两头都要守住
const source = await readFile(new URL('../common/meeting.js', import.meta.url), 'utf8')
const load = (src) => import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'))
const m = await load(source)
// 模拟 H5 构建：条件编译会去掉 #ifdef MP-WEIXIN 整段
const h5 = await load(source.replace(/\/\/ #ifdef MP-WEIXIN[\s\S]*?\/\/ #endif/g, ''))
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8'))

const code = (t) => m.parseTencentMeeting(t)?.code
const pwd = (t) => m.parseTencentMeeting(t)?.pwd

test('accepts codes typed whole, with spaces or with dashes, 9 to 12 digits', () => {
  for (const t of ['900000001', '900 000 001', '900-000-001', ' 900 000 001 ']) assert.equal(code(t), '900000001', t)
  assert.equal(code('123456789012'), '123456789012')
  assert.equal(code('123 456 789 012'), '123456789012')
  assert.equal(code('腾讯会议号：1234 5678 9012'), '123456789012')
  assert.equal(code('会议号 12345678'), undefined)
  assert.equal(code('1234567890123'), undefined)
})

test('reads Chinese and English labels, with or without a password', () => {
  assert.deepEqual(m.parseTencentMeeting('会议号：900 000 001 密码：6666'), { code: '900000001', pwd: '6666', note: '', link: '' })
  assert.deepEqual(m.parseTencentMeeting('腾讯会议：900-000-001'), { code: '900000001', pwd: '', note: '', link: '' })
  assert.equal(code('会议 ID：900000001'), '900000001')
  assert.equal(code('Meeting ID: 900 000 001'), '900000001')
  assert.deepEqual(m.parseTencentMeeting('code=900000001&pwd=1234'), { code: '900000001', pwd: '1234', note: '', link: '' })
  assert.equal(pwd('会议号 900000001 口令 Ab12'), 'Ab12')
  assert.equal(pwd('会议号 900000001 会议密码：abc123'), 'abc123')
  // 不是 4–12 位字母数字的不当密码（2026-11-03 起放宽到 12 位）
  assert.equal(pwd('会议号 900000001 密码：无'), '')
  assert.equal(pwd('会议号 900000001 密码 12'), '')
  assert.equal(pwd('会议号 900000001 密码 1234567890123'), '')
  assert.equal(pwd('会议号 900000001 密码 1234567'), '1234567')
})

test('phone numbers and dates are not mistaken for meeting codes', () => {
  for (const t of ['面试电话：13800138000', '13800138000', '手机 138 0013 8000', '联系电话：0591-8888-8888',
    '2026-10-13 14:00 视频面试', '会议：2026-10-13 14:00', '202610131400', 'QQ 123456789', '订单号 202610131234']) {
    assert.equal(m.parseTencentMeeting(t), null, t)
  }
  // 有「会议号」字样时认字样后面的号，旁边的电话、日期不抢
  assert.equal(code('联系电话 13800138000，腾讯会议 900 000 001'), '900000001')
  assert.equal(code('会议时间 2026-10-13 14:00\n会议号 900000001'), '900000001')
  // 字样后面换行接电话不算（不跨行）
  assert.equal(m.parseTencentMeeting('面试方式：腾讯会议\n13800138000'), null)
  // 400/800 热线、工号、金额这类裸数字也不当会议号
  for (const t of ['客服 400-820-8820', '如有问题请拨打 400 820 8820', '8008208820', '工号 900000001', '金额 123456789 元']) {
    assert.equal(m.parseTencentMeeting(t), null, t)
  }
})

test('meeting codes of other tools (Zoom, DingTalk, Feishu) are not opened as Tencent Meeting', () => {
  for (const t of ['Join Zoom Meeting\nMeeting ID: 912 3456 7890\nPasscode: 123456', '钉钉会议 会议号：123 456 789', '飞书视频会议 会议 ID：123 456 789']) {
    assert.equal(m.parseTencentMeeting(t), null, t)
  }
  assert.equal(code('腾讯会议 900000001（不用 Zoom）'), '900000001')
})

test('old free text and links without a code stay unparsed', () => {
  for (const t of ['', null, undefined, '请加微信 kangaroo 视频面试', 'https://example.com/dm/AbCdEf', '腾讯会议，链接见短信']) {
    assert.equal(m.parseTencentMeeting(t), null, String(t))
  }
})

test('a pasted Tencent Meeting invitation yields code, password and a note without the boilerplate', () => {
  const invite = '张三 邀请您参加腾讯会议\n会议主题：面试\n会议时间：2026/10/13 14:00-15:00 (GMT+08:00) 中国标准时间 - 北京\n\n'
    + '点击链接入会，或添加至会议列表：\nhttps://meeting.tencent.com/dm/UnitTestOnlyNotAMeeting\n\n#腾讯会议：900-000-001\n会议密码：6666\n\n复制该信息，打开手机腾讯会议即可参与'
  const r = m.parseTencentMeeting(invite)
  assert.equal(r.code, '900000001')
  assert.equal(r.pwd, '6666')
  assert.equal(r.note, '会议主题：面试\n会议时间：2026/10/13 14:00-15:00 (GMT+08:00) 中国标准时间 - 北京')
  assert.equal(m.parseTencentMeeting('明天 14:00 腾讯会议 900 000 001 密码 1234 请准时').note, '明天 14:00 请准时')
  // 邀请里的拨号入会段落也是固定内容；「入会密码」同样认作密码
  const dial = '#腾讯会议：900-000-001\n入会密码：6666\n\n手机一键拨号入会\n+8675536550000,,900000001# (中国大陆)\n\n根据您的位置拨号\n+8675536550000 (中国大陆)'
  assert.deepEqual(m.parseTencentMeeting(dial), { code: '900000001', pwd: '6666', note: '', link: '' })
  // 员工自己写的备注不被当成邀请套话删掉：普通链接、「邀请您参加面试」都照常保留
  const own = '诚挚邀请您参加面试，备用链接 https://example.com/a'
  assert.equal(m.parseTencentMeeting(m.formatTencentMeeting('900000001', '', own)).note, own)
})

test('format writes the canonical text and parses back to the same fields', () => {
  assert.equal(m.formatTencentMeeting('900-000-001', '6666', ' 请提前 5 分钟入会 '), '腾讯会议号：900 000 001\n密码：6666\n请提前 5 分钟入会')
  assert.equal(m.formatTencentMeeting('900000001'), '腾讯会议号：900 000 001')
  assert.equal(m.formatTencentMeeting('123456789012', '', ''), '腾讯会议号：123 456 789 012')
  assert.equal(m.groupCode('900000001'), '900 000 001')
  for (const c of ['900000001', '1234567890', '12345678901', '123456789012']) {
    for (const [p, n] of [['', ''], ['6666', ''], ['Ab12cd', '请提前 5 分钟入会，迟到请联系主理人']]) {
      const text = m.formatTencentMeeting(c, p, n)
      assert.ok(text.length <= 500)
      assert.deepEqual(m.parseTencentMeeting(text), { code: c, pwd: p, note: n, link: '' }, text)
    }
  }
})

test('staff input helpers strip separators, unpack a pasted invite and validate', () => {
  assert.deepEqual(m.readCodeInput('900 000-001', ''), { code: '900000001', pwd: '', link: '' })
  assert.deepEqual(m.readCodeInput('#腾讯会议：900-000-001\n会议密码：6666', ''), { code: '900000001', pwd: '6666', link: '' })
  // 2026-11-03：粘贴的邀请里有密码就以邀请为准（之前密码框填过就不换，旧的错密码会一直留着）；邀请里没密码才保留密码框
  assert.deepEqual(m.readCodeInput('腾讯会议：900-000-001 密码：6666', '8888'), { code: '900000001', pwd: '6666', link: '' })
  assert.deepEqual(m.readCodeInput('腾讯会议：900-000-001', '8888'), { code: '900000001', pwd: '8888', link: '' })
  assert.equal(m.tencentInputError('900 000 001', ''), '')
  assert.equal(m.tencentInputError('900000001', ' Ab12 '), '')
  assert.match(m.tencentInputError('', ''), /9–12 位数字/)
  assert.match(m.tencentInputError('12345678', ''), /9–12 位数字/)
  assert.match(m.tencentInputError('900000001', '12'), /4–12 位/)
  assert.match(m.tencentInputError('900000001', '密码1234'), /4–12 位/)
})

const mockUni = (onNavigate) => {
  const calls = { navigate: [], clipboard: [], toast: [] }
  globalThis.uni = {
    navigateToMiniProgram: (o) => { calls.navigate.push(o); onNavigate && onNavigate(o) },
    setClipboardData: (o) => { calls.clipboard.push(o.data); o.success && o.success() },
    showToast: (o) => calls.toast.push(o.title)
  }
  return calls
}

test('mini program: opens Tencent Meeting with the documented appId and path', () => {
  const calls = mockUni()
  m.openTencentMeeting({ code: '900 000 001', pwd: '6666', nickname: '小袋鼠 A&B' })
  assert.equal(calls.navigate.length, 1)
  const o = calls.navigate[0]
  assert.equal(o.appId, 'wx33fd6cdc62520063')
  assert.equal(o.envVersion, 'release')
  assert.equal(o.path, 'pages/index/index?chn=DaishuYard&code=900000001&pwd=6666&nm=' + encodeURIComponent('小袋鼠 A&B'))
  assert.match(o.path.split('chn=')[1], /^[A-Z][A-Za-z0-9]*&/)
  // 没有密码、取不到昵称时不带这两个参数
  m.openTencentMeeting({ code: '900000001' })
  assert.equal(calls.navigate[1].path, 'pages/index/index?chn=DaishuYard&code=900000001')
  // 昵称是半个 emoji（后端截断）时不抛错，去掉昵称照样拉起
  m.openTencentMeeting({ code: '900000001', nickname: '小袋鼠\ud83d' })
  assert.equal(calls.navigate[2].path, 'pages/index/index?chn=DaishuYard&code=900000001')
  assert.deepEqual([calls.clipboard, calls.toast], [[], []])
})

test('mini program: a failed jump copies code and password with a hint, a user cancel does not', () => {
  let calls = mockUni((o) => o.fail({ errMsg: 'navigateToMiniProgram:fail invalid appid' }))
  m.openTencentMeeting({ code: '900000001', pwd: '6666' })
  assert.deepEqual(calls.clipboard, ['腾讯会议号：900 000 001\n密码：6666'])
  assert.match(calls.toast[0], /腾讯会议/)
  calls = mockUni((o) => o.fail({ errMsg: 'navigateToMiniProgram:fail cancel' }))
  m.openTencentMeeting({ code: '900000001', pwd: '6666' })
  assert.deepEqual([calls.clipboard, calls.toast], [[], []])
})

test('H5 build has no navigateToMiniProgram: copies the code and says how to join', () => {
  const calls = mockUni()
  h5.openTencentMeeting({ code: '900-000-001' })
  assert.deepEqual(calls.navigate, [])
  assert.deepEqual(calls.clipboard, ['腾讯会议号：900 000 001'])
  assert.match(calls.toast[0], /打开腾讯会议/)
})

test('pages offer one-tap joining and the staff editors save the canonical text', async () => {
  const lobby = await read('../pages/jobs/interview.vue')
  const staff = await read('../pages/staff/interviews.vue')
  const slots = await read('../components/k-interview-slots/k-interview-slots.vue')
  for (const src of [lobby, staff]) {
    assert.match(src, /from '@\/common\/meeting\.js'/)
    assert.match(src, /label="进入腾讯会议"/)
    assert.match(src, /'复制会议号'/)
    assert.match(src, /openTencentMeeting\(\{ code: /)
    // 认不出会议号的旧文字照旧可以整段复制
    assert.match(src, /复制会议信息/)
  }
  for (const src of [staff, slots]) {
    assert.match(src, /formatTencentMeeting\(/)
    assert.match(src, /tencentInputError\(/)
    // 会议号 / 密码 / 备注都是单行 input，不再有会盖住底部导航的原生 textarea
    assert.doesNotMatch(src, /<textarea/)
  }
  for (const src of [lobby, staff, slots]) assert.doesNotMatch(src, /约定的会议工具|腾讯会议等会议工具/)
})
