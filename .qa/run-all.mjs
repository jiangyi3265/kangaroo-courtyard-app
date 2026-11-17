// 全量验收：52 页 × 4 屏截图 + 与设计图并排比对 + 错误/横向溢出检查
// 用法: node .qa/run-all.mjs [NN,NN...]   （可选：只跑指定图号）
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const MAP = [
  ['01', '/pages/auth/login'], ['02', '/pages/auth/onboarding'], ['03', '/pages/home/index'], ['04', '/pages/home/city'],
  ['05', '/pages/jobs/list'], ['06', '/pages/jobs/filter'], ['07', '/pages/jobs/detail'], ['08', '/pages/jobs/team'],
  ['09', '/pages/jobs/apply'], ['10', '/pages/jobs/progress'], ['11', '/pages/jobs/interview'], ['12', '/pages/jobs/contract'],
  ['13', '/pages/stays/list'], ['14', '/pages/stays/detail'], ['15', '/pages/stays/booking'], ['16', '/pages/stays/pay'],
  ['17', '/pages/stays/order'], ['18', '/pages/stays/shop'], ['19', '/pages/community/index'], ['20', '/pages/community/publish'],
  ['21', '/pages/community/activity'], ['22', '/pages/community/activity-mine'], ['23', '/pages/community/trip'], ['24', '/pages/community/chat'],
  ['25', '/pages/messages/index'], ['26', '/pages/profile/index'], ['27', '/pages/profile/resume'], ['28', '/pages/profile/opportunities'],
  ['29', '/pages/profile/orders'], ['30', '/pages/profile/review'], ['31', '/pages/staff/index'], ['32', '/pages/staff/applications'],
  ['33', '/pages/staff/interviews'], ['34', '/pages/staff/rooms'], ['35', '/pages/staff/jobs'], ['36', '/pages/staff/dispatch'],
  ['37', '/pages/staff/activities'], ['38', '/pages/staff/reviews'], ['39', '/pages/staff/insurance'], ['40', '/pages/staff/talents'],
  ['41', '/pages/manage/weekly'], ['42', '/pages/manage/tasks'], ['43', '/pages/manage/daily'], ['44', '/pages/manage/dashboard'],
  ['45', '/pages/manage/wallet'], ['46', '/pages/manage/honor'], ['47', '/pages/staff/online-jobs'], ['48', '/pages/notice/states'],
  ['49', '/pages/messages/reminders'], ['50', '/pages/staff/vlog'], ['51', '/pages/home/assistant'], ['52', '/pages/staff/business']
]
const only = process.argv[2] ? process.argv[2].split(',') : null
const root = process.cwd()
const out = path.join(root, '.qa', 'out')
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
const page = await context.newPage()
const report = []
for (const [num, route] of MAP) {
  if (only && !only.includes(num)) continue
  for (let k = 1; k <= 4; k++) {
    const errors = []
    const onErr = e => errors.push(e.message)
    const onCon = m => { if (m.type() === 'error') errors.push(m.text()) }
    page.on('pageerror', onErr); page.on('console', onCon)
    try {
      // 同一路由仅改变查询参数时，uni-app 不会再次触发 onLoad；先离开页面，
      // 确保 ?s=1..4 每一屏都按“直达”语义重新创建页面实例。
      await page.goto('about:blank')
      await page.goto(`http://127.0.0.1:5173/#${route}?s=${k}`, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(450)
    } catch (e) { errors.push('goto: ' + e.message) }
    const m = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      textLen: document.body.innerText.trim().length,
      placeholder: document.body.innerText.includes('占位页')
    }))
    const file = path.join(out, `${num}-${k}.png`)
    await page.screenshot({ path: file })
    try { execFileSync('python', [path.join(root, '.qa', 'pair.py'), num, String(k), file, path.join(out, `${num}-${k}-pair.png`)]) } catch (e) { errors.push('pair: ' + e.message.slice(0, 120)) }
    page.off('pageerror', onErr); page.off('console', onCon)
    const pass = !m.overflowX && !m.placeholder && m.textLen > 20 && !errors.length
    report.push({ num, k, route, ...m, errors, pass })
    console.log(`${num}-${k} ${pass ? 'OK ' : 'FAIL'} ${m.placeholder ? 'placeholder ' : ''}${m.overflowX ? 'overflowX ' : ''}${errors.slice(0, 1).join(' ')}`)
  }
}
await browser.close()
await fs.writeFile(path.join(root, '.qa', 'report.json'), JSON.stringify(report, null, 2))
const failed = report.filter(r => !r.pass)
console.log(`\ntotal ${report.length}, passed ${report.length - failed.length}, failed ${failed.length}`)
