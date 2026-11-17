// 招聘区 10-13 第二轮复查的回归（node --test，不需要构建、不发请求）：
//   · 报名页、同行页自己问「去登录」时，要在任何 await 之前给错误标上 e.loginHandled，request.js 就不再叠一个通用登录框
//     （两个框接连弹，后一个顶掉前一个；同行页的 await modal 永远不回来，「这家店缺人了提醒我」会一直锁着点不动）；
//   · 岗位详情不能报名时，标题旁的灰色胶囊先按服务端给的原因说：线上任务过了截止时间又恰好暂停 / 满员时写「已过截止时间」，
//     和红色提示条说同一件事；服务端说名额已满时写「名额已满」；
//   · 报名详情读简历失败时，重试说明指向这一屏真有的按钮（「刷新到店信息」在经历记录下方，脱敏简历屏没有这个按钮）；
//   · 这几个后端文件原本是 CRLF 换行，不能整文件转成 LF（round 1 曾把 AppStaffExtController.java 整个转掉）。
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import assert from 'node:assert/strict'
import { remainingHeadcount } from '../pages/jobs/store-page.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const JAVA = path.resolve(APP, '../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo')
const require = createRequire(path.join(APP, 'package.json'))
const compiler = require('@vue/compiler-sfc'), vue = require('vue')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n/g, '\n')

/** 在沙箱里跑页面的 script setup：导入一律先给永远不返回的函数，再用 stubs 覆盖用得到的那几个 */
function runSetup(rel, stubs) {
  const d = compiler.parse(src(rel), { filename: rel }).descriptor
  const source = d.scriptSetup.content
  const ast = compiler.babelParse(source, { sourceType: 'module' })
  const body = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => source.slice(n.start, n.end)).join('\n')
  const sandbox = { console }
  for (const n of ast.program.body.filter(n => n.type === 'ImportDeclaration')) for (const s of n.specifiers) sandbox[s.local.name] = () => new Promise(() => {})
  Object.assign(sandbox, {
    remainingHeadcount,
    ref: vue.ref, computed: vue.computed, watch: vue.watch, reactive: vue.reactive,
    onShow() {}, onHide() {}, onUnload() {}, onUnmounted() {}
  }, stubs)
  vm.createContext(sandbox)
  const scope = vue.effectScope()
  scope.run(() => vm.runInContext(body, sandbox, { filename: rel + ':script-setup' }))
  return { run: code => vm.runInContext(code, sandbox), stop: () => scope.stop() }
}

test('报名页、同行页的 401 分支在弹自己的「去登录」之前同步标上 loginHandled', () => {
  for (const [rel, call] of [['pages/jobs/apply.vue', 'askLogin('], ['pages/jobs/team.vue', 'await modal(']]) {
    const s = src(rel)
    const at = s.indexOf('code === 401')
    assert.ok(at > 0, rel + ' 没有 401 分支')
    assert.equal(s.indexOf('code === 401', at + 1), -1, rel + ' 有多个 401 分支，请逐个检查')
    const end = s.indexOf(call, at)
    assert.ok(end > at, rel + ' 的 401 分支里没有 ' + call)
    const seg = s.slice(at, end).replace(/\/\/.*$/gm, '')   // 只看代码，不看注释
    assert.match(seg, /e\.loginHandled = true/, rel + '：401 时要标上 loginHandled')
    assert.doesNotMatch(seg, /\bawait\b/, rel + '：标记要在任何 await 之前（request.js 在下一轮宏任务里看这个标记）')
  }
})

test('岗位详情：胶囊短说法先跟服务端原因走，和红色提示条一致', (t) => {
  const h = runSetup('pages/jobs/detail.vue', { useScreen: () => vue.ref(1), experience: vue.reactive({ account: null }), absUrl: x => x })
  t.after(h.stop)
  const chip = (d) => {
    h.run('detail.value = ' + JSON.stringify(d))
    return JSON.parse(h.run('JSON.stringify([blockedShort.value, applyBlockedText.value])'))
  }
  const DEADLINE = '这个任务已过截止时间，不再接单'
  // 过了截止时间又满员：服务端原因是截止时间，胶囊不能写「名额已满」
  assert.deepEqual(chip({ jobType: 'online', status: 'published', acceptsApplication: false, applyClosedReason: DEADLINE, headcount: 3, hiredCount: 3 }), ['已过截止时间', DEADLINE])
  // 暂停中又过了截止时间：服务端原因同样是截止时间
  assert.deepEqual(chip({ jobType: 'online', status: 'paused', acceptsApplication: false, applyClosedReason: DEADLINE, headcount: 3, hiredCount: 1 }), ['已过截止时间', DEADLINE])
  // 服务端说名额已满（线上任务按进行中的接单人数算），胶囊也写名额已满
  assert.equal(chip({ jobType: 'online', status: 'published', acceptsApplication: false, applyClosedReason: '这个任务的名额已满，暂不接受报名', headcount: 3, hiredCount: 2 })[0], '名额已满')
  // 原来的几种照旧
  assert.equal(chip({ jobType: 'volunteer', status: 'paused', acceptsApplication: false, applyClosedReason: '该岗位暂停招聘中，暂不接受报名', headcount: 5, hiredCount: 2 })[0], '已暂停招聘')
  assert.equal(chip({ jobType: 'volunteer', status: 'published', acceptsApplication: true, headcount: 4, hiredCount: 4 })[0], '名额已满')
  assert.equal(chip({ jobType: 'volunteer', status: 'published', acceptsApplication: true, headcount: 5, hiredCount: 2 })[0], '')
})

test('报名详情读简历失败时，重试说明指向这一屏真有的按钮', () => {
  const s = src('pages/staff/applications.vue')
  assert.doesNotMatch(s, /可点上方「刷新到店信息」/)
  assert.match(s, /s\.value === 2 \? '简历读取失败，可点下方「刷新到店信息」重新读取' : '简历读取失败，请回到报名详情点「刷新到店信息」重新读取'/)
  // 第 2 屏里「刷新到店信息」确实在经历记录下方
  const screen2 = /<template v-else-if="s === 2">[\s\S]*?<\/template>\n\n/.exec(s)[0]
  assert.ok(screen2.indexOf('经历记录') < screen2.indexOf('label="刷新到店信息"'))
})

test('招聘区原本是 CRLF 的后端文件仍是 CRLF', () => {
  for (const rel of ['controller/app/AppStaffExtController.java', 'ext/staff/KgTalentService.java', 'ext/staff/KgResumeShareService.java', 'ext/user/KgResumeService.java']) {
    const b = fs.readFileSync(path.join(JAVA, rel))
    let lf = 0, crlf = 0
    for (let i = 0; i < b.length; i++) if (b[i] === 10) { lf++; if (i > 0 && b[i - 1] === 13) crlf++ }
    assert.ok(lf > 0 && crlf === lf, `${rel}: ${crlf}/${lf} 行是 CRLF`)
  }
})
