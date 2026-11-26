// 内测反馈 2.0（2026-10-16）社区前端：发布页草稿（恢复 / 丢弃、按账号存、只有图片也能恢复、「草稿」入口）、
// 经验分享一选类型就查经历（暂时不能用的灰着列原因）、社区首页下拉刷新。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

import vm from 'node:vm'
import * as drafts from '../common/local-drafts.js'
import * as feed from '../pages/community/community-feed.js'
import * as schedule from '../pages/community/buddy-schedule.js'
import * as links from '../pages/community/post-link.js'

const require = createRequire(import.meta.url)
const { parse } = require('@vue/compiler-sfc')
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const publish = await read('../pages/community/publish.vue')
const index = await read('../pages/community/index.vue')
const draftBox = await read('../pages/profile/drafts.vue')
const pagesJson = JSON.parse(await read('../pages.json'))
const tpl = (src) => parse(src).descriptor.template.content
const script = (src) => parse(src).descriptor.scriptSetup.content

// 从页面脚本里取出一段顶层函数 / 箭头函数的源码（到下一个顶层声明为止）
const pick = (src, name) => {
  const s = script(src)
  const re = new RegExp(`^(?:async )?(?:function ${name}\\b|const ${name} = )`, 'm')
  const m = re.exec(s)
  assert.ok(m, `找不到 ${name}`)
  const rest = s.slice(m.index)
  const end = rest.slice(1).search(/\n(?=(?:async )?function |const |let |\/\/ ---|onPullDownRefresh|onShow|onHide|onUnload|watch\()/)
  return end < 0 ? rest : rest.slice(0, end + 1)
}

function draftPage(source, account, options = {}) {
  const vue = require('vue')
  const hooks = {}, state = { experience: account }
  const input = script(source)
  const ast = require('@vue/compiler-sfc').babelParse(input, { sourceType: 'module' })
  const statements = ast.program.body.filter(n => n.type !== 'ImportDeclaration').map(n => input.slice(n.start, n.end))
  const sandbox = {
    ...vue, ...feed, ...schedule, ...drafts, ...links, console, experience: account, uni: globalThis.uni,
    useScreen: (_, h) => { hooks.load = h.onLoad; return vue.ref(1) }, onShow: fn => { hooks.show = fn }, onUnload: fn => { hooks.unload = fn },
    currentCity: () => '大理', todayCn: () => '2026-11-20', shiftDate: () => '2026-11-22', isYmd: value => /^\d{4}-\d{2}-\d{2}$/.test(value || ''),
    ensureSession: async () => {}, absUrl: s => s, TONES: [], wishEnabled: vue.ref(true), communityEnabled: vue.ref(true),
    confirm: async () => true, toast() {}, go() {}, fail(e) { throw e }, ...options
  }
  const ctx = vm.createContext(sandbox)
  state.scope = vue.effectScope()
  state.scope.run(() => vm.runInContext(statements.join('\n'), ctx))
  state.run = s => vm.runInContext(s, ctx)
  return { ...state, hooks }
}
function draftStorage(t) {
  const data = new Map()
  const previous = globalThis.uni
  t.after(() => { globalThis.uni = previous })
  globalThis.uni = { getStorageSync: k => structuredClone(data.get(k)), setStorageSync: (k, v) => data.set(k, JSON.parse(JSON.stringify(v))),
    removeStorageSync: k => data.delete(k), showLoading() {}, hideLoading() {} }
  return data
}
const account = id => require('vue').reactive({ account: { id } })
const photo = '/profile/upload/photo.jpg'

test('旧版账号草稿从草稿箱恢复，保留自定义分类和图片，可删图再存', async t => {
  const data = draftStorage(t), a = account(7)
  data.set('kangaroo:publish-draft:7', { type: '找搭子', categoryText: '观星', title: '一起出发', body: '集合', uploads: [{ url: photo }] })
  const p = draftPage(publish, a), box = draftPage(draftBox, a)
  await box.hooks.show()
  const row = box.run('rows.value[0]')
  assert.equal(row.id, 'legacy-community')
  await p.hooks.load({ draftId: row.id })
  assert.equal(p.run('categoryText.value'), '观星')
  assert.equal(p.run('uploads.value[0].img'), photo)
  p.run('removeUpload(0)')
  await p.run('saveDraft()')
  assert.deepEqual(drafts.listDrafts(7)[0].data.uploads, [])
  assert.equal(drafts.listDrafts(7)[0].data.body, '集合')
  assert.equal(drafts.listDrafts(8).length, 0)
})

test('新发帖不自动覆盖已有草稿；只有图片也可单独保存，回到发布页更新草稿数量', async t => {
  draftStorage(t)
  const a = account(7), p = draftPage(publish, a)
  await p.hooks.load({ kind: 'daily' })
  await p.run('saveDraft()')
  assert.equal(drafts.listDrafts(7).length, 0)
  p.run("uploads.value = [{url:'/profile/upload/only.jpg',img:'preview'}]")
  await p.run('saveDraft()')
  const id = drafts.listDrafts(7)[0].id
  const empty = draftPage(publish, a)
  await empty.hooks.load({ kind: 'daily' })
  assert.equal(empty.run('uploads.value.length'), 0)
  assert.equal(empty.run('draftCount.value'), 1)
  drafts.removeLocalDraft(7, id)
  await empty.hooks.show?.()
  assert.equal(empty.run('draftCount.value'), 0)
})

test('换账号时清空已打开的发布表单和草稿列表，旧上传晚到不能加入新账号', async t => {
  draftStorage(t)
  let finish
  const a = account(7), p = draftPage(publish, a, {
    chooseImages: async () => ['temp:first'],
    uploadTo: () => new Promise(r => { finish = r })
  }), box = draftPage(draftBox, a)
  await p.hooks.load({ kind: 'buddy' })
  p.run("title.value = '甲的草稿'; categoryText.value = '露营'")
  await p.run('saveDraft()')
  await box.hooks.show()
  assert.equal(box.run('rows.value[0].data.title'), '甲的草稿')
  const upload = p.run('addImages()')
  await new Promise(r => setImmediate(r))
  a.account = { id: 8 }
  await require('vue').nextTick()
  finish({ data: { url: photo } }); await upload
  assert.equal(p.run('title.value'), '')
  assert.equal(p.run('categoryText.value'), '')
  assert.equal(p.run('uploads.value.length'), 0)
  await p.run('saveDraft()')
  assert.equal(drafts.listDrafts(8).length, 0)
  assert.equal(box.run('rows.value.length'), 0)
  assert.equal(drafts.listDrafts(7)[0].data.title, '甲的草稿')
})

test('草稿箱能继续编辑、删除指定草稿；个人发布入口仍可访问', async t => {
  draftStorage(t)
  const a = account(7), paths = [], box = draftPage(draftBox, a, { go: u => paths.push(u) })
  const one = drafts.saveLocalDraft(7, { kind: 'community', label: '旅居日常', data: { title: '日常' } })
  const two = drafts.saveLocalDraft(7, { kind: 'community', label: '找搭子', data: { title: '同游' } })
  await box.hooks.show()
  box.run("edit(rows.value.find(row => row.data.title === '日常'))")
  assert.deepEqual(paths, ['/pages/community/publish?draftId=' + encodeURIComponent(one.id)])
  await box.run("remove(rows.value.find(row => row.data.title === '日常'))")
  assert.deepEqual(drafts.listDrafts(7).map(r => r.id), [two.id])
  assert.match(tpl(publish), /@click="go\(R\.myPosts\)">我的发布/)
})

test('重选封面只替换所选封面，原封面已删除时保留下张照片；连点添加最多九张', async t => {
  draftStorage(t)
  let finish, picks = 0
  const p = draftPage(publish, account(7), {
    chooseImages: async n => { picks++; return Array(n).fill('temp:file') },
    uploadTo: () => new Promise(r => { finish = r })
  })
  await p.hooks.load({ kind: 'buddy' })
  p.run("uploads.value=[{url:'a.jpg'},{url:'b.jpg'}]")
  const replacing = p.run('replaceCover()')
  await new Promise(r => setImmediate(r))
  p.run('removeUpload(0)')
  finish({ data: { url: photo } }); await replacing
  assert.equal(p.run('uploads.value[0].url'), 'b.jpg')
  p.run("uploads.value=Array.from({length:8},(_,i)=>({url:String(i)}))")
  const first = p.run('addImages()'), second = p.run('addImages()')
  await new Promise(r => setImmediate(r))
  finish({ data: { url: photo } })
  await Promise.all([first, second])
  assert.equal(picks, 2, '一次换封面、一次添加')
  assert.equal(p.run('uploads.value.length'), 9)
})

test('原账号的发布结果晚于换账号返回，不跳转也不删除任何人的草稿', async t => {
  draftStorage(t)
  const a = account(7), routes = []
  let complete
  const p = draftPage(publish, a, {
    gated: fn => fn(), apiPublishPost: () => new Promise(resolve => { complete = resolve }),
    replace: url => routes.push(url)
  })
  await p.hooks.load({ kind: 'daily' })
  p.run("title.value='甲的标题';publishConsent.value={open:async()=>true}")
  await p.run('saveDraft()')
  const publishing = p.run('submit()')
  await new Promise(r => setImmediate(r))
  a.account = { id: 8 }
  p.run("title.value='乙的标题'")
  await p.run('saveDraft()')
  complete({ data: { postId: 991 } })
  await publishing
  assert.deepEqual(routes, [])
  assert.equal(drafts.listDrafts(8)[0].data.title, '乙的标题')
  assert.equal(drafts.listDrafts(7)[0].data.title, '甲的标题')
})

test('发布成功只删本页恢复 / 保存的那份草稿', () => {
  assert.match(pick(publish, 'submit'), /if \(draftMine\) dropDraft\(\)/)
  assert.doesNotMatch(publish, /removeStorageSync\(DRAFT_KEY\)/)
})

test('恢复草稿：过期日期不恢复、图片最多 9 张、类型认旧名', () => {
  const apply = pick(publish, 'applyDraft')
  assert.match(apply, /eventDate\.value = isYmd\(d\.eventDate\) && d\.eventDate >= todayCn\(\) \? d\.eventDate : ''/)
  assert.match(apply, /\.filter\(u => u && u\.url\)\.slice\(0, 9\)/)
  assert.match(apply, /if \(type\.value === '经验分享'\) loadExperiences\(\)/)
})

test('经验分享：一选类型就查经历，没有可用经历在类型卡下面直接说明', () => {
  const t = tpl(publish)
  assert.match(t, /@click="pickType\(item\.name\)"/)
  assert.match(pick(publish, 'pickType'), /if \(name === '经验分享'\) loadExperiences\(\)/)
  assert.match(t, /<template v-if="type === '经验分享'">[\s\S]*?还没有可以用来分享的岗位经历[\s\S]*?简历里自己填写的经历、活动报名不能作为经验分享的依据[\s\S]*?<\/template>/)
  assert.match(t, /v-if="expOff\.length" class="exp-hint__link" hover-class="k-press" @click="s = 3"><text>查看原因<\/text>/)
})

test('经历校验页：暂时不能用的灰着列原因、不能选；页面写明简历自填经历和活动报名不算', () => {
  const t = tpl(publish)
  const off = /<view v-for="item in expOff" :key="item\.key" class="experience-card experience-card--off">([\s\S]*?)<\/template>/.exec(t)
  assert.ok(off, '有暂时不能用的列表')
  assert.doesNotMatch(off[1], /@click|radio/, '灰着的不能选')
  assert.match(off[1], /\{\{ item\.reason \}\}/)
  assert.match(t, /<view class="experience-rule">[\s\S]*?<text>简历里自己填写的经历、活动报名不能作为经验分享的依据<\/text><\/view>/)
})

test('经历接口：unavailable 在 data 旁边或 data 里都认，没有也不报错；进行中的标「进行中」', async () => {
  const s = script(publish)
  const load = pick(publish, 'loadExperiences')
  assert.match(load, /const off = \(res && res\.unavailable\) \|\| \(data && !Array\.isArray\(data\) && data\.unavailable\) \|\| \[\]/)
  assert.match(load, /expOffRaw\.value = Array\.isArray\(off\) \? off : \[\]/)
  // 跑一遍 endYmd：结束日在今天以后就是进行中
  // eslint-disable-next-line no-new-func
  const endYmd = new Function(`${pick(publish, 'endYmd')}\nreturn endYmd`)()
  assert.equal(endYmd('2026.10.01–2026.10.30'), '2026-10-30')
  assert.equal(endYmd('—'), '')
  assert.match(s, /stateText: x\.statusLabel \|\| \(ongoing \? '进行中' : '已完成'\), dateLabel: ongoing \? '时间' : '完成时间'/)
  // 服务端（POST-BE）给的是和可用经历同一套字段 title；早先约定的 jobTitle / storeName 也认
  assert.match(s, /title: x\.title \|\| \[x\.jobTitle, x\.storeName\]\.filter\(Boolean\)\.join\(' · '\)/)
})

test('社区首页下拉刷新：只开社区首页；弹层开着直接停；s=1 重拉当前页签，详情同时刷新帖子和评论', () => {
  const sub = pagesJson.subPackages.find(p => p.root === 'pages/community')
  const pages = Object.fromEntries(sub.pages.map(p => [p.path, p.style || {}]))
  assert.equal(pages.index.enablePullDownRefresh, true)
  assert.notEqual(pages.publish.enablePullDownRefresh, true, '发布页不开（正文输入框会被拉动）')
  const s = script(index)
  assert.match(s, /import \{[^}]*onPullDownRefresh[^}]*\} from '@dcloudio\/uni-app'/)
  assert.match(s, /onPullDownRefresh\(\(\) => \{\n  if \(filterOpen\.value \|\| dateOpen\.value\) \{ uni\.stopPullDownRefresh\(\); return \}\n  const job = s\.value === 1 \? reload\(\) : s\.value === 3 \? refreshPost\(\) : null\n  Promise\.resolve\(job\)\.finally\(\(\) => uni\.stopPullDownRefresh\(\)\)\n\}\)/)
  assert.match(s, /const reload = \(\) => \(feedTab\.value === BUDDY_TAB \? loadBuddies\(\) : loadFeed\(\)\)/)
  const refresh = pick(index, 'refreshPost')
  assert.match(refresh, /if \(canInteract\(d\)\) await loadComments\(\)/)
  assert.match(refresh, /if \(d && detail\.value\.postId === id\)/, '刷新途中切走了帖子就不盖')
})
