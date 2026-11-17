// 内测反馈 2.0（2026-10-16）社区前端：发布页草稿（恢复 / 丢弃、按账号存、只有图片也能恢复、「草稿」入口）、
// 经验分享一选类型就查经历（暂时不能用的灰着列原因）、社区首页下拉刷新。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse } = require('@vue/compiler-sfc')
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const publish = await read('../pages/community/publish.vue')
const index = await read('../pages/community/index.vue')
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

// 假的本机存储 + 账号：跑真实的 draftKey / migrateDraft / readDraft / hasContent
function draftKit(accountId, store) {
  const uni = {
    getStorageSync: (k) => (k in store ? store[k] : ''),
    setStorageSync: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)) },
    removeStorageSync: (k) => { delete store[k] }
  }
  const experience = { account: accountId ? { id: accountId } : null }
  const src = [pick(publish, 'LEGACY_DRAFT_KEY'), pick(publish, 'draftKey'), pick(publish, 'migrateDraft'), pick(publish, 'hasContent'), pick(publish, 'readDraft')].join('\n')
  // eslint-disable-next-line no-new-func
  return new Function('uni', 'experience', `${src}\nreturn { draftKey, migrateDraft, readDraft, hasContent }`)(uni, experience)
}

test('草稿键带账号 id；旧键只归给第一次打开的登录账号一次，游客不认领', () => {
  const store = { 'kangaroo:publish-draft': { type: '旅居日常', title: '旧草稿' } }
  const guest = draftKit(null, store)
  guest.migrateDraft()
  assert.ok(store['kangaroo:publish-draft'], '游客打开不动旧键')
  assert.equal(guest.readDraft(), null, '游客读的是自己的键')

  const a = draftKit(7, store)
  assert.equal(a.draftKey(), 'kangaroo:publish-draft:7')
  a.migrateDraft()
  assert.equal(store['kangaroo:publish-draft'], undefined, '旧键迁完删掉')
  assert.equal(a.readDraft().title, '旧草稿')

  const b = draftKit(8, store)
  b.migrateDraft()
  assert.equal(b.readDraft(), null, '换账号看不到上一个账号的草稿')

  // 本账号已有新草稿：旧键不覆盖它
  const store2 = { 'kangaroo:publish-draft': { title: '旧' }, 'kangaroo:publish-draft:7': { title: '新', savedAt: '10-16 14:20' } }
  const c = draftKit(7, store2)
  c.migrateDraft()
  assert.equal(c.readDraft().title, '新')
  assert.equal(store2['kangaroo:publish-draft'], undefined)
})

test('只有图片的草稿也算有内容、能恢复；全空的不算', () => {
  const { hasContent } = draftKit(1, {})
  assert.equal(hasContent({ title: '', body: '', uploads: [{ url: '/profile/upload/a.jpg' }] }), true)
  assert.equal(hasContent({ title: '  ', body: '', uploads: [] }), false)
  assert.equal(hasContent({ body: '正文' }), true)
  assert.equal(hasContent(null), false)
  assert.doesNotMatch(publish, /d && \(d\.title \|\| d\.body\)/, '不再只认标题或正文')
})

test('打开发布页：有草稿先问「恢复 / 丢弃」，写上标题、类型、保存时间；验证手机号进来的不问', () => {
  const s = script(publish)
  assert.match(s, /if \(q\?\.need === 'phone'\) \{ needPhoneOnly = true; s\.value = 2; return \}/); assert.match(s, /migrateDraft\(\)\s+if \(q\?\.fresh === '1'\) draftInfo\.value = readDraft\(\)\s+else offerDraft\(\)/)
  const offer = pick(publish, 'offerDraft')
  assert.match(offer, /modal\('恢复草稿', `本机有一份未发布的草稿\$\{draftDesc\(d\)\}。恢复后可继续编辑；丢弃会删除这份草稿。`, \{ confirmText: '恢复草稿', cancelText: '丢弃草稿' \}\)/)
  assert.match(offer, /if \(r\.cancel\) \{ dropDraft\(\); toast\('已丢弃草稿'\); return \}/)
  assert.match(offer, /if \(r\.confirm\) restoreDraft\(d\)/)
  assert.match(s, /const draftDesc = \(d\) => `\$\{draftName\(d\)\}，类型：\$\{restoreType\(d\.type\)\}\$\{d\.savedAt \? '，保存于 ' \+ d\.savedAt : ''\}`/)
  // 不再静默填回
  assert.doesNotMatch(s, /onLoad[\s\S]{0,200}restoreDraft\(\)/)
})

test('存草稿记 savedAt；没内容不存；已有别的草稿先问覆盖；文案写明仅本机、失败如实说', () => {
  const save = pick(publish, 'saveDraft')
  assert.match(save, /if \(!hasContent\(d\)\) return toast\('还没有填写标题、正文或图片'\)/)
  assert.match(save, /if \(prev && !draftMine && !\(await confirm\('保存草稿'/)
  assert.match(save, /savedAt: `\$\{pad2\(n\.getMonth\(\) \+ 1\)\}-\$\{pad2\(n\.getDate\(\)\)\} \$\{pad2\(n\.getHours\(\)\)\}:\$\{pad2\(n\.getMinutes\(\)\)\}`/)
  assert.match(save, /toast\('已存为草稿（仅本机）'\)/)
  assert.match(save, /toast\('草稿保存失败'\)/)
  // 关联的对象（2026-10-17 起是 小院 / 门店 / 岗位 / 活动）、经历类型、同步活动的信息也存
  const snap = pick(publish, 'snapshot')
  for (const k of ['link:', 'expType:', 'act:', 'people:', 'syncOn:', 'uploads:']) assert.ok(snap.includes(k), k)
})

test('恢复后顶部提示条「已恢复 … 存的草稿 · 清空」，清空先确认、表单和本机草稿一起清', () => {
  const t = tpl(publish)
  assert.match(t, /<view v-if="restoredAt" class="draft-bar">[\s\S]*?\{\{ restoredText \}\}[\s\S]*?@click="clearDraft"><text>清空<\/text><\/view><\/view>/)
  assert.match(publish, /`已恢复 \$\{restoredAt\.value\} 存的草稿`/)
  const clear = pick(publish, 'clearDraft')
  assert.match(clear, /if \(!\(await confirm\('清空草稿'/)
  assert.match(clear, /dropDraft\(\)\n  resetForm\(\)/)
})

test('右上角「草稿箱」：有草稿时带个 1，继续编辑 / 删除（删除再确认一次）；「我的发布」入口还在', () => {
  const t = tpl(publish)
  // 2026-10-17 发布页样稿 图 3：草稿入口挪到顶栏右上角的「草稿箱」描边小胶囊
  // 2026-10-17：草稿箱从顶栏右边挪到正文第一行右边（顶栏右边会被系统胶囊挤到中间压住标题）
  assert.match(t, /<view class="pub-tools"><view class="drafts" hover-class="k-press" @click="openDraft">[\s\S]*?<text>草稿箱<\/text><text v-if="draftInfo" class="drafts__num">1<\/text><\/view>/)
  assert.match(t, /<button hover-class="k-press" @click="go\(R\.myPosts\)">我的发布/)
  const open = pick(publish, 'openDraft')
  assert.match(open, /modal\('本机草稿', `\$\{draftDesc\(d\)\}`, \{ confirmText: '继续编辑', cancelText: '删除草稿' \}\)/)
  assert.match(open, /if \(!\(await confirm\('删除草稿'/)
  assert.match(open, /if \(hasContent\(snapshot\(\)\) && !\(await confirm\('继续编辑草稿'/)
  assert.match(open, /if \(sameAsForm\(d\)\) return toast\('正在编辑的就是这份草稿'\)/, '表单就是这份草稿时不再问替换')
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

test('社区首页下拉刷新：只开社区首页；弹层开着直接停；s=1 重拉当前页签，s=3 重拉帖子，s=4 重拉评论', () => {
  const sub = pagesJson.subPackages.find(p => p.root === 'pages/community')
  const pages = Object.fromEntries(sub.pages.map(p => [p.path, p.style || {}]))
  assert.equal(pages.index.enablePullDownRefresh, true)
  assert.notEqual(pages.publish.enablePullDownRefresh, true, '发布页不开（正文输入框会被拉动）')
  const s = script(index)
  assert.match(s, /import \{[^}]*onPullDownRefresh[^}]*\} from '@dcloudio\/uni-app'/)
  assert.match(s, /onPullDownRefresh\(\(\) => \{\n  if \(filterOpen\.value \|\| dateOpen\.value\) \{ uni\.stopPullDownRefresh\(\); return \}\n  const job = s\.value === 1 \? reload\(\) : s\.value === 3 \? refreshPost\(\) : s\.value === 4 \? loadComments\(\) : null\n  Promise\.resolve\(job\)\.finally\(\(\) => uni\.stopPullDownRefresh\(\)\)\n\}\)/)
  assert.match(s, /const reload = \(\) => \(feedTab\.value === BUDDY_TAB \? loadBuddies\(\) : loadFeed\(\)\)/)
  const refresh = pick(index, 'refreshPost')
  assert.match(refresh, /if \(d && detail\.value\.postId === id\)/, '刷新途中切走了帖子就不盖')
})
