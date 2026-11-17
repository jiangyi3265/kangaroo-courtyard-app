import { chromium } from 'playwright'
import nodeAssert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'

// verify.py 对 C02/C05/C06/C10/C12/C14 都配了"最少断言数"下限，
// 理由写在那段注释里：只看退出码是不够的，把断言删光很多命令照样返回 0。
// 本文件此前没有输出任何可计数的东西，于是 C08 只能看退出码 ——
// 把下面所有 assert 删掉，C08 仍然是绿的。
// 这里给 assert 套一层计数代理，末尾把条数打出来给 verify.py 当下限用。
let assertCount = 0
const assert = new Proxy(nodeAssert, {
  apply(target, thisArg, args) { assertCount += 1; return Reflect.apply(target, thisArg, args) },
  get(target, key, recv) {
    const v = Reflect.get(target, key, recv)
    if (typeof v !== 'function') return v
    return (...args) => { assertCount += 1; return v.apply(target, args) }
  },
})

const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] })
// 浏览器时区必须和后端对齐。后端把 JVM 钉在 Asia/Shanghai（业务面向国内），
// 而开发机的操作系统未必也在这个时区 —— 本机就差了 16 小时，
// 于是页面上的「今天」在后端看来是昨天，报名会被「到岗日期不能早于今天」正确地拒掉。
// 那是环境错配，不是产品缺陷；真实用户的手机和服务器都在国内。
// 固定成 Asia/Shanghai，测的才是生产里的那种关系。
const page = await browser.newPage({
  viewport: { width: 390, height: 844 }, isMobile: true,
  timezoneId: 'Asia/Shanghai', locale: 'zh-CN',
})
const errors = []
page.on('pageerror', error => errors.push(error.message))
const base = process.env.FLOW_TEST_URL || 'http://127.0.0.1:5273/'
// 后端地址在多处用到（绑定手机号后回调 account、挑岗位），提到顶层来
const API_BASE = process.env.FLOW_API_BASE || 'http://localhost:8080'

const open = async route => { await page.goto(`${base}#${route}`); await page.locator('uni-page-body .k-page').waitFor(); await page.waitForLoadState('networkidle') }
const waitForPhoneBinding = () => page.waitForURL(url => {
  const [path, query] = url.hash.slice(1).split('?')
  const params = new URLSearchParams(query)
  // uni-h5 navigateTo canonicalizes the first page (auth/login) to '/'.
  return ['/', '/pages/auth/login'].includes(path) && params.get('s') === '4' && params.get('mode') === 'bind-phone'
})
const click = async text => {
  const label = page.getByText(text, { exact: true })
  const button = page.locator('.k-button').filter({ has: label })
  if (await button.count()) await button.click()
  else await label.click()
}
const capture = async name => {
  await page.screenshot({ path: `artifacts/entry-flow/${name}.png`, fullPage: true })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`)
}
await mkdir('artifacts/entry-flow', { recursive: true })
try {
  await open('/pages/auth/login')
  await capture('login')
  const channel = await (await fetch(API_BASE + '/app/auth/ping')).json()
  assert.equal(channel.data?.wxMock, true, '本浏览器用例只允许连接隔离的本地微信 mock 后端')
  assert.equal(await page.locator('input[type="number"]').count(), 0, '登录不再收集手填手机号')
  await click('本地联调登录')
  await page.getByText('请先阅读并同意协议', { exact: false }).waitFor()
  assert.ok(page.url().includes('/pages/auth/login'), '未同意协议不得登录')
  await page.locator('uni-toast').waitFor({ state: 'hidden', timeout: 15000 })
  await page.locator('.agree .k-check').first().click()
  await click('本地联调登录')
  await page.waitForURL('**#/pages/home/index', { timeout: 60000 })
  await open('/pages/profile/index?s=2')
  await page.locator('.frow').filter({ hasText: '手机号' }).click()
  await waitForPhoneBinding()
  assert.ok(page.url().includes('mode=bind-phone'), '个人资料手机号入口进入微信绑定页')
  assert.equal(await page.locator('input[type="number"]').count(), 0, '绑定入口不再保留手填或短信输入框')
  await page.getByText('请在微信小程序内授权', { exact: true }).waitFor()
  await capture('phone-binding-web')

  // 浏览器不能提供微信手机号授权弹窗。在此明确注入 mock 授权码，
  // 运行同一个绑定模块并调用真实隔离后端；不能把它称为真实微信授权。
  const boundPhone = '139' + String(Date.now()).slice(-8)
  const binding = await page.evaluate(async (phone) => {
    const { bindWechatPhone } = await import('/common/phone-binding.js')
    let invalidRejected = false
    try { await bindWechatPhone({ detail: { code: 'invalid', errMsg: 'getPhoneNumber:ok' } }, { agreed: true }) }
    catch { invalidRejected = true }
    const account = await bindWechatPhone({ detail: { code: 'mock-phone-' + phone, errMsg: 'getPhoneNumber:ok' } }, { agreed: true })
    return { invalidRejected, id: account.id }
  }, boundPhone)
  assert.equal(binding.invalidRejected, true, '非法授权码必须被后端拒绝')
  const readAccount = () => page.evaluate(async (api) => {
    let raw = window.localStorage.getItem('kangaroo:app-token') || ''
    try { const p = JSON.parse(raw); if (p && p.data) raw = p.data } catch {}
    const headers = { 'X-App-Token': raw }
    return {
      account: await (await fetch(api + '/app/auth/account', { headers })).json(),
      profile: await (await fetch(api + '/app/me/profile', { headers })).json()
    }
  }, API_BASE)
  const saved = await readAccount()
  assert.equal(saved.account.code, 200, 'account api')
  assert.equal(saved.account.data.id, binding.id, '手机号不能切换账号')
  assert.equal(saved.account.data.phoneBound, true, '绑定保存到服务器')
  assert.equal(saved.profile.data.phoneVerified, true, '授权绑定同时保存核验状态')
  assert.match(saved.account.data.phone, /^\d{3}\*{4}\d{4}$/, '服务端只下发脱敏手机号')
  assert.notEqual(saved.account.data.phone, boundPhone, '不下发完整号码')
  await page.reload()
  await page.locator('uni-page-body .k-page').waitFor()
  const restored = await readAccount()
  assert.equal(restored.account.data.phone, saved.account.data.phone, '刷新后号码仍然保留')
  assert.equal(restored.profile.data.phoneVerified, true, '刷新后核验状态仍然保留')
  await click('暂不更换，返回设置')
  await page.waitForURL('**#/pages/profile/index?s=4')
  await page.getByText(saved.account.data.phone, { exact: true }).waitFor()
  await page.locator('.srow').filter({ has: page.getByText('手机号', { exact: true }) }).click()
  await waitForPhoneBinding()
  assert.equal(await page.locator('input').count(), 0, '账号设置手机号入口也没有手填或短信表单')
  await click('暂不更换，返回设置')
  await page.waitForURL('**#/pages/profile/index?s=4')
  const afterCancel = await readAccount()
  assert.equal(afterCancel.account.data.id, binding.id, '取消更换号码不退出当前账号')
  // 10-15 首页改版：「可能感兴趣的城市」卡片和「会员权益」条都删了，「为你推荐」改名「旅居推荐」；10-16 搜索条改成「问 AI 袋鼠，找换工 / 旅居」，5 个入口还是 .entry
  await open('/pages/home/index')
  await page.getByText('问 AI 袋鼠，找换工 / 旅居', { exact: true }).waitFor()
  assert.equal(await page.locator('.entry').count(), 5, '首页应有 5 个入口')
  await page.getByText('旅居推荐', { exact: true }).waitFor()
  assert.equal(await page.getByText('可能感兴趣的城市', { exact: false }).count(), 0, '首页不再有兴趣城市卡片')
  assert.equal(await page.getByText('为你推荐', { exact: true }).count(), 0, '「为你推荐」已改名「旅居推荐」')
  // 兴趣城市页这一轮先保留（下一轮换成首页城市下拉时再处理），首页已经没有入口，直接打开它
  await open('/pages/auth/onboarding')
  await page.getByText('下一站，想去哪里？', { exact: true }).waitFor()
  assert.equal(await page.locator('.city.selected').count(), 0)
  await capture('interests-empty')
  await click('暂不设置，继续逛逛')
  await page.waitForURL('**#/pages/home/index')
  await open('/pages/auth/onboarding')
  await page.locator('.city').filter({ hasText: '大理' }).click()
  await page.locator('.city').filter({ hasText: '成都' }).click()
  await click('保存并返回首页')
  await page.waitForURL('**#/pages/home/index')
  // 首页城市胶囊显示选中的第一个兴趣城市
  await page.locator('.location').filter({ hasText: '大理' }).waitFor()
  await capture('home')
  await open('/pages/auth/onboarding')
  assert.equal(await page.locator('.city.selected').count(), 2)
  await click('暂不设置，继续逛逛')
  await page.waitForURL('**#/pages/home/index')
  // 10-15 消息页改版：上面「系统通知 / 评论 / 赞」三个入口，下面一条统一列表；新账号全是空的、没有红点
  // 「系统通知」入口的角标会算上没看过的公告：先截下消息页自己取到的公告，后台有公告时这个角标不算违规
  const noticesLoaded = page.waitForResponse(r => new URL(r.url()).pathname === '/app/notices' && r.request().method() === 'GET')
  await click('消息')
  await page.getByText('还没有消息', { exact: true }).waitFor()
  const noticeCount = ((await (await noticesLoaded).json()).data || []).length
  await capture('messages-empty')
  assert.equal(await page.locator('.entry').count(), 3, '消息页上面应有三个入口')
  assert.equal(await page.locator('.row').count(), 0, '新账号的消息列表应为空')
  assert.equal(await page.locator('.k-tabbar__badge').count(), 0)
  // 除「系统通知」入口上的公告角标外，页面上不该有任何角标
  assert.equal(await page.locator('.badge').count(), await page.locator('.entry .badge').count(), '入口以外不该有角标')
  for (const entry of ['评论', '赞']) {
    assert.equal(await page.locator('.entry').filter({ hasText: entry }).locator('.badge').count(), 0, `「${entry}」入口不该有角标`)
  }
  const sysBadge = page.locator('.entry').filter({ hasText: '系统通知' }).locator('.badge')
  if (!noticeCount) assert.equal(await sysBadge.count(), 0, '没有公告时「系统通知」不该有角标')
  else if (await sysBadge.count()) assert.ok(parseInt((await sysBadge.innerText()).trim(), 10) <= noticeCount, '「系统通知」角标只能来自没看过的公告')
  for (const [entry, empty] of [['系统通知', '暂无系统通知'], ['评论', '还没有人评论你的动态'], ['赞', '还没有收到赞']]) {
    await open('/pages/messages/index')
    await page.getByText(entry, { exact: true }).first().click()
    await page.getByText(empty, { exact: true }).waitFor()
  }
  // 报名现在会真的提交到后端，需要一个真实的在招岗位。
  // 岗位的最短停留天数是服务端校验的，这里把它一并读出来，按岗位要求填，
  // 否则测试会被"该岗位要求最短停留 N 天"正确地拦下来。
  const apiBase = API_BASE
  // 必须挑一个还有名额的岗位：名额已满的岗位后端会正确地拒绝报名，
  // 那种失败是业务规则生效，不该被当成测试失败。
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai'}).format(new Date()))
  let job = null
  for (let pageNum=1; !job; pageNum++) {
    const jobsBody = await (await fetch(`${apiBase}/app/job/list?type=volunteer&pageSize=50&pageNum=${pageNum}`)).json()
    assert.equal(jobsBody.code, 200, 'job list api')
    job = (jobsBody.rows || []).find(j => (j.hiredCount || 0) < (j.headcount || 1) && (!j.startDate || j.startDate.slice(0,10)<=today) && (!j.endDate || j.endDate.slice(0,10)>=today))
    if (pageNum*50>=jobsBody.total || !jobsBody.rows?.length) break
  }
  assert.ok(job, '需要至少一个允许今天到岗且还有名额的换工岗位，先跑 seed_demo_data.py')
  const stayDays = String(Math.max(job.minDays || 1, 1))

  await open(`/pages/jobs/apply?jobId=${job.jobId}`)
  await page.getByText('确定感兴趣后，再填写本次报名需要的资料。', { exact: true }).waitFor()
  assert.equal(await page.locator('input').first().inputValue(), '')
  await click('下一步')
  await page.getByText('请填写姓名', { exact: true }).waitFor()
  await page.locator('.k-field input').nth(0).fill('测试旅人')
  await page.locator('.k-field input').nth(1).fill('25')
  await page.locator('.k-field input').nth(2).fill('13800000000')
  await capture('application')
  await click('下一步')
  await page.getByText('预计到岗日期 *', { exact: true }).waitFor()
  await click('下一步')
  await page.getByText('请选择今天或之后的到岗日期', { exact: true }).waitFor()
  await capture('application-schedule')
  await page.locator('.date-field').click()
  await page.locator('.uni-picker-action-confirm').click()
  await page.locator('.k-field input').first().fill(stayDays)
  await click('下一步')
  await page.getByText('核对本次报名资料', { exact: true }).waitFor()
  const submitted = page.waitForResponse(r=>r.url().endsWith('/app/application') && r.request().method()==='POST')
  await click('提交报名')
  const submittedResponse = await submitted
  const submittedPayload = submittedResponse.request().postDataJSON()
  assert.ok(typeof submittedPayload.idemKey === 'string' && submittedPayload.idemKey.length > 0,
    '首次真实提交必须携带幂等键')
  const submittedBody = await submittedResponse.json()
  assert.equal(submittedBody.code,200,'报名业务结果：'+submittedBody.msg)
  assert.ok(submittedBody.data?.appId, '首次提交必须返回持久化报名ID')
  await page.getByText('报名已提交，主理人会尽快审核，可在进度页查看结果。', { exact: true }).waitFor()
  await capture('application-saved')

  // 成功后入口已经变为查看进度，不能再点击已不存在的提交按钮。
  // 同时重放首次真实请求的原 payload（包括原 idemKey），继续验证服务端幂等。
  assert.equal(await page.getByText('提交报名', { exact: true }).count(), 0,
    '提交成功后不得继续显示重复提交入口')
  const replay = await page.evaluate(async ([base, payload]) => {
    // uni-app H5 的 setStorageSync 对字符串直接存原文，对其他类型才包一层 JSON，
    // 所以这里两种形态都要兼容
    const stored = localStorage.getItem('kangaroo:app-token') || ''
    let raw = stored
    try { const parsed = JSON.parse(stored); raw = typeof parsed === 'string' ? parsed : (parsed?.data ?? stored) } catch (e) { raw = stored }
    const headers = { 'X-App-Token': raw, 'Content-Type': 'application/json' }
    const repeated = await fetch(`${base}/app/application`, { method: 'POST', headers, body: JSON.stringify(payload) })
    const duplicate = await repeated.json()
    const r = await fetch(`${base}/app/application/mine`, { headers })
    return { duplicate, mine: await r.json() }
  }, [apiBase, submittedPayload])
  assert.equal(replay.duplicate.code, 200, '同一幂等键的重复请求应返回原报名')
  assert.equal(replay.duplicate.data?.appId, submittedBody.data.appId, '重复请求必须返回同一报名ID')
  assert.equal(replay.duplicate.data?.appNo, submittedBody.data.appNo, '重复请求必须返回同一报名编号')
  const mineResp = replay.mine
  assert.equal(mineResp.code, 200, 'mine api')
  assert.equal(mineResp.data.length, 1, '重复提交不应产生第二条报名')
  assert.equal(mineResp.data[0].appId, submittedBody.data.appId, '重新查询仍是首次保存的报名')
  await open('/pages/staff/index')
  await page.waitForURL('**#/pages/auth/identity')
  await capture('staff-entry')
  await click('刷新员工权限')
  await page.getByText('当前账号暂无员工授权，请联系管理员授权后刷新。', { exact: true }).waitFor()
  await open('/pages/auth/login?entry=staff')
  await page.locator('.agree .k-check').first().click()
  await click('员工入口')
  // 员工入口现在会真的走微信登录，只是这个新账号没有被授予员工授权
  await page.getByText('当前微信账号暂无员工授权，请联系管理员授权后点击员工入口重试。', { exact: true }).waitFor()
  await open('/pages/auth/onboarding?s=4')
  await page.waitForURL('**#/pages/auth/identity')
  await page.setViewportSize({ width: 320, height: 740 })
  await open('/pages/auth/onboarding')
  await page.getByText('下一站，想去哪里？', { exact: true }).waitFor()
  await capture('interests-320')
  assert.deepEqual(errors, [], 'browser runtime errors')
  console.log('PASS: 本地mock登录与微信手机号绑定模块、持久化核验及刷新回读、登录落地首页、首页改版（AI袋鼠搜索条、旅居推荐、无兴趣城市卡）、兴趣城市可跳过/保存/重进修改、新账号消息三个入口全部空态无红点、报名表单校验与真实提交、重复提交幂等、员工入口无授权被拦、旧 identity 深链接重定向、320px 布局')
  console.log(`断言 ${assertCount} 条，全部通过`)
} catch (error) {
  await page.screenshot({ path: 'artifacts/entry-flow/failure.png', fullPage: true })
  console.error('Current route:', page.url())
  console.error(await page.locator('body').innerText())
  throw error
} finally { await browser.close() }
