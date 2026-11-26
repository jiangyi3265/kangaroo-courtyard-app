// 2026-10-17 主人反馈的静态回归（node --test，不构建、不发请求）：
//   有人一次发了不止一篇帖子 ——「两个帖子分两栏提交两个地址，三个就分开提交三个」，每栏选填。
//   · 接单人交付页「提交成果」第一步从系统输入框（只有一栏）换成底部面板里的三栏（帖子 1 / 帖子 2（选填）/ 帖子 3（选填）），每个 500 字内；
//   · 后端收 links（最多 3 个），用换行连起来存在 kg_online_submission.link（V50 放宽到 varchar(1600)），老版本小程序只传 link 照旧；
//   · 交付记录、门店验收页两处都一个一个显示，不止一个时标「链接 1 / 2 / 3」，各自「复制链接」「复制全文」。
import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const taskJava = await read(javaRoot + 'ext/staff/KgOnlineTaskService.java')
const schemaJava = await read(javaRoot + 'config/schema/OnlineLinksSchema.java')
const v50 = await read('../../RuoYi-Vue/sql/kangaroo/V50__online_links.sql')
const v50back = await read('../../RuoYi-Vue/sql/kangaroo/V50__rollback.sql')
const deliver = await read('../pages/jobs/deliver.vue')
const onlineJobs = await read('../pages/staff/online-jobs.vue')
const staff = await import('../pages/staff/online-material.js')
const jobs = await import('../pages/jobs/material-files.js')

const XHS = 'https://xhslink.cn/o/AYmULXdGz76 复制口令，打开【小红书】即可畅读全文'
const BLOG = 'https://example.com/post/3'

test('splitLinks：两个分包各一份，按换行拆、空的去掉，老数据就是一个', () => {
  for (const m of [staff, jobs]) {
    assert.deepEqual(m.splitLinks(XHS + '\n' + BLOG), [XHS, BLOG])
    assert.deepEqual(m.splitLinks('\n ' + XHS + ' \n\n' + BLOG + '\n'), [XHS, BLOG], '首尾空白和空行去掉')
    assert.deepEqual(m.splitLinks(XHS), [XHS], '老数据（V50 之前）就是一个链接')
    assert.deepEqual(m.splitLinks(''), [])
    assert.deepEqual(m.splitLinks(null), [])
    assert.deepEqual(m.splitLinks(undefined), [])
  }
  assert.equal(jobs.LINKS_MAX, 3)
  assert.equal(jobs.oneLine('  【作品】海边\n\nhttps://v.douyin.com/x/ \t 复制\r\n'), '【作品】海边 https://v.douyin.com/x/ 复制', '和后端 oneLine 一样：换行、连续空白并成一个空格')
  assert.equal(jobs.oneLine(null), '')
})

test('两个分包各引自己的模块，不跨分包引用（跨了 uni-app 会把模块挪进主包）', () => {
  assert.match(deliver, /LINK_MAX, firstUrl, splitLink, splitLinks, oneLine \} from '\.\/material-files\.js'/)
  assert.doesNotMatch(deliver, /from '[^']*online-material/)
  assert.match(onlineJobs, /splitLink, splitLinks \} from '\.\/online-material\.js'/)
  assert.doesNotMatch(onlineJobs, /from '[^']*material-files/)
})

test('交付页：成果链接换成三栏面板，textarea 不限字数、在 fixed 面板里要 fixed，后面的页面锁住', () => {
  assert.doesNotMatch(deliver, /prompt\('成果链接/, '不再用只有一栏的系统输入框')
  assert.match(deliver, /const LINK_LABELS = \['帖子 1', '帖子 2（选填）', '帖子 3（选填）'\]/)
  assert.match(deliver, /<view v-for="\(boxLabel, boxIndex\) in LINK_LABELS" :key="boxIndex" class="lsheet__box">/)
  assert.match(deliver, /<text class="lsheet__label">\{\{ boxLabel \}\}<\/text>/)
  const areas = deliver.match(/<textarea [^>]*>/g) || []
  assert.equal(areas.length, 1, '一个 textarea 跟着 LINK_LABELS 画三栏')
  assert.match(areas[0], /:value="linkInitial\[boxIndex\]"/)
  for (const event of ['input', 'blur']) assert.ok(areas[0].includes('@' + event + '="editLink(boxIndex, $event)"'))
  assert.match(areas[0], /:maxlength="-1"/, '粘贴长口令不被悄悄截断')
  assert.match(areas[0], / auto-height /)
  assert.match(areas[0], /:fixed="true"/, 'position: fixed 的面板里要 fixed，不然小程序里输入框位置不对')
  assert.match(areas[0], /:placeholder="boxIndex === 0 \? LINK_HINT : /)
  assert.match(deliver, /const LINK_HINT = '粘贴作品链接，或小红书、抖音复制的分享口令'/)
  assert.match(deliver, /const linkBoxes = ref\(\['', '', ''\]\)/)
  assert.match(deliver, /<text class="lsheet__title">成果链接或分享口令（选填）<\/text>/)
  assert.match(deliver, /<text class="lsheet__hint">可填写成果合集链接，或分栏填写；只交图片的可留空/)
  assert.match(deliver, /@click="closeLinks\(null\)"><text>取消<\/text><\/view>/)
  assert.match(deliver, /<k-button block label="下一步" @click="nextLinks" \/>/)
  // 锁页面滚动：遮罩拦 touchmove；小程序 page-meta 放在第一个节点，H5 自己锁 body
  assert.match(deliver, /<view v-if="linkPanel" class="k-mask" @click="closeLinks\(null\)" @touchmove\.stop\.prevent \/>/)
  assert.match(deliver, /^<template>\n  <!-- #ifdef MP-WEIXIN -->\n  <page-meta :page-style="linkPanel \? 'overflow: hidden' : ''" \/>/)
  assert.match(deliver, /watch\(linkPanel, \(open\) => \{ if \(pageShown\) lockPageScroll\(open\) \}\)/)
  assert.match(deliver, /onUnload\(\(\) => \{ lockPageScroll\(false\); closeLinks\(null\) \}\)/)
  assert.match(deliver, /\.lsheet \{[^}]*max-height: 85vh; overflow-y: auto;/, '面板超高时自己滚')
})

/** 把交付页里面板那几个函数抠出来跑一遍（ref / toast 用替身） */
function panelHarness() {
  const start = deliver.indexOf('let linkDone = null')
  const end = deliver.indexOf('// H5 锁页面滚动')
  assert.ok(start > 0 && end > start)
  const toasts = []
  const ref = (v) => ({ value: v })
  const linkPanel = ref(false)
  const linkBoxes = ref(['', '', ''])
  const make = new Function('linkPanel', 'linkBoxes', 'linkInitial', 'a', 'submittedCount', 'toast', 'oneLine', 'LINK_MAX',
    deliver.slice(start, end) + '\nreturn { askLinks, closeLinks, nextLinks }')
  return { ...make(linkPanel, linkBoxes, ref([]), ref({}), ref(''), (t) => toasts.push(t), jobs.oneLine, jobs.LINK_MAX), linkPanel, linkBoxes, toasts }
}

test('面板：下一步交回去掉空栏的列表；有一栏超过 500 字提示第几个、面板不关；取消交回 null（busy 能松开）', async () => {
  const h = panelHarness()
  let p = h.askLinks()
  assert.equal(h.linkPanel.value, true)
  h.linkBoxes.value = ['  ' + XHS + '\n', '', '帖子三\n的口令']
  h.nextLinks()
  assert.deepEqual(await p, [XHS, '帖子三 的口令'], '空栏不算，每栏收成一行')
  assert.equal(h.linkPanel.value, false)

  p = h.askLinks()
  h.linkBoxes.value = [XHS, '字'.repeat(501), '']
  h.nextLinks()
  assert.deepEqual(h.toasts, ['第 2 个链接或口令最多 500 字，现在 501 字'])
  assert.equal(h.linkPanel.value, true, '超了就停在面板上改')
  h.linkBoxes.value = [XHS, '字'.repeat(500), '']
  h.nextLinks()
  assert.equal((await p).length, 2, '500 字正好放得下')

  p = h.askLinks()
  h.closeLinks(null)
  assert.equal(await p, null, '取消（或点遮罩）也要交回，不然提交按钮一直锁着')
  assert.equal(h.linkPanel.value, false)

  const first = h.askLinks()
  const second = h.askLinks()
  assert.equal(await first, null, '又开了一次：上一次的等待先交回 null')
  h.closeLinks(null)
  assert.equal(await second, null)
})

function deliveryFixture(stubs = {}) {
  const writes = [], notices = []
  const scope = {
    ref: value => ({value}), computed: fn => ({get value(){return fn()}}), watch(){},
    onLoad(){}, onUnload(){}, onShow(){}, onHide(){}, onUnmounted(){}, setInterval(){},
    fileEnv:()=>({}), absUrl:v=>v, splitLink:jobs.splitLink, oneLine:jobs.oneLine, LINK_MAX:jobs.LINK_MAX,
    experience:{account:{id:5}}, prompt:async()=>'  完成  ', confirm:async()=>false,
    apiOnlineSubmit:async(id,body)=>{writes.push({id,body});return {data:{stateLabel:'待验收'}}},
    toast:v=>notices.push(v), errText:(e,f)=>e?.message||f, ...stubs
  }
  const js = deliver.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm,'')
  vm.runInNewContext(js+';this.form={submit, confirmPaid, nextLinks, appId, a, linkBoxes, submittedCount, busy}',scope)
  scope.form.appId.value=63
  scope.form.a.value={canSubmit:true,rewardMode:'per_item',itemsPerPerson:3}
  return {...scope,...scope.form,writes,notices}
}

test('交付连点只提交一轮，条数、图片和两份口令保存在同一份成果', async () => {
  const h=deliveryFixture({confirm:async()=>true,chooseImages:async()=>['a'],uploadTo:async()=>({data:{url:'/photo.jpg'}})})
  const first=h.submit(), second=h.submit()
  h.linkBoxes.value=['  第一篇 ','','第二篇'];h.submittedCount.value='2';h.nextLinks()
  await Promise.all([first,second])
  assert.deepEqual(JSON.parse(JSON.stringify(h.writes)),[{id:63,body:{submittedCount:2,link:'第一篇\n第二篇',links:['第一篇','第二篇'],images:['/photo.jpg'],note:'完成'}}])
  assert.deepEqual(Array.from(h.linkBoxes.value),['','',''])
})

test('选了两张图而第二张上传失败时保留口令，整份成果可重试', async () => {
  const h=deliveryFixture({confirm:async()=>true,chooseImages:async()=>['a','b'],uploadTo:async(_,p)=>{
    if(p==='b')throw Error('图片未上传');return {data:{url:'/a.jpg'}}
  }})
  const pending=h.submit();h.linkBoxes.value=['口令','',''];h.submittedCount.value='1';h.nextLinks();await pending
  assert.deepEqual(h.writes,[]);assert.deepEqual(h.notices,['图片未上传'])
  assert.equal(h.linkBoxes.value[0],'口令');assert.equal(h.busy.value,false)
})

test('收款确认框打开后切换账号，原弹窗不会提交', async () => {
  let finish
  const h=deliveryFixture({confirm:()=>new Promise(resolve=>{finish=resolve}),apiOnlineConfirm:()=>assert.fail('不应确认旧账单')})
  h.a.value={settlement:{amount:'12.00',canConfirm:true}}
  const pending=h.confirmPaid();h.experience.account.id=9;finish(true);await pending
  assert.deepEqual(h.notices,[])
})

test('交付记录：每个链接各一块，不止一个时标「链接 N」，各自复制；老后端没有 links 时自己拆', () => {
  assert.match(deliver, /<view v-for="\(lk, lkIndex\) in linksOf\(x\)" :key="lkIndex" class="link-item k-mt8">/)
  assert.match(deliver, /<text v-if="linksOf\(x\)\.length > 1" class="link__label">链接 \{\{ lkIndex \+ 1 \}\}<\/text>/)
  assert.match(deliver, /<text v-if="linkParts\(lk\)\.url !== lk" class="k-link" @click="copyAll\(lk\)">复制全文<\/text>/)
  assert.match(deliver, /const linksOf = \(x\) => \(Array\.isArray\(x\.links\) \? x\.links : splitLinks\(x\.link\)\)/)
  assert.doesNotMatch(deliver, /x\.link\)\.url/, '不再把整段 link 当一个链接显示')
})

test('门店验收页：两处都按 latestLinks 一个一个显示，标「链接 N」，没有链接时写「（没有链接）」', () => {
  assert.match(onlineJobs, /const latestLinks = computed\(\(\) => \(!latest\.value \? \[\] : \(Array\.isArray\(latest\.value\.links\) \? latest\.value\.links : splitLinks\(latest\.value\.link\)\)\)\)/)
  assert.equal((onlineJobs.match(/v-for="\(lk, lkIndex\) in latestLinks" :key="lkIndex"/g) || []).length, 2)
  assert.match(onlineJobs, /\{\{ latestLinks\.length > 1 \? '链接 ' \+ \(lkIndex \+ 1\) : '成果链接 \/ 分享口令' \}\}/)
  assert.match(onlineJobs, /<text v-if="latestLinks\.length > 1" class="result-link__label">链接 \{\{ lkIndex \+ 1 \}\}<\/text>/)
  assert.match(onlineJobs, /<view v-if="!latestLinks\.length" class="url url--text"><text>（没有链接）<\/text><\/view>/)
  assert.match(onlineJobs, /<text v-if="!latestLinks\.length">（没有链接）<\/text>/)
  assert.match(onlineJobs, /const copyLinkText = \(lk\) => \(lk \? copy\(lk, /)
  assert.doesNotMatch(onlineJobs, /linkParts\.value|linkParts\.url/, '不再按整段 link 算')
})

test('后端：links 最多 3 个、每个 500 字，超了说清是第几个；换行只当分隔符；老版本的 link 照旧；返回拆好的 links', () => {
  assert.match(taskJava, /static final int LINKS_MAX = 3;/)
  assert.match(taskJava, /static final int LINK_MAX = 500;/)
  assert.match(taskJava, /return str\(v\)\.replaceAll\("\\\\s\+", " "\)\.trim\(\);/)
  assert.match(taskJava, /boolean listed = b\.get\("links"\) instanceof List;/)
  assert.match(taskJava, /String link = String\.join\("\\n", links\);/)
  assert.match(taskJava, /throw new ServiceException\("最多提交 " \+ LINKS_MAX \+ " 个链接或口令", 422\);/)
  assert.match(taskJava, /throw new ServiceException\("第 " \+ \(i \+ 1\) \+ " 个链接或口令超过 " \+ LINK_MAX \+ " 字", 422\);/)
  assert.match(taskJava, /\(!listed && link\.length\(\) > LINK_MAX\)/, '老版本一段 link 仍按 500 字、原提示拦')
  assert.match(taskJava, /guard\.check\(texts\.toArray\(new String\[0\]\)\);/)
  assert.match(taskJava, /s\.put\("links", splitLinks\(x\.get\("link"\)\)\);/)
})

test('V50：只放宽成果链接一列到 1600（3 × 500 + 换行），要先有 V49；回退有超过 500 字的就拒绝；启动核对 ≥ 1600', () => {
  assert.match(v50, /call kg_assert_env\('49'\);/)
  assert.match(v50, /alter table kg_online_submission modify column link varchar\(1600\) not null default ''/)
  assert.match(v50, /character_maximum_length < 1600\) then/)
  assert.match(v50, /values \(50, 'online_links', now\(\), '[0-9a-f]{64}'\)/)
  assert.doesNotMatch(v50, /\r\n/)
  assert.match(v50back, /@kg_allow_online_links_rollback/)
  assert.match(v50back, /char_length\(link\) > 500/)
  assert.match(v50back, /modify column link varchar\(500\) not null default ''/)
  assert.match(schemaJava, /character_maximum_length >= 1600 and is_nullable = 'NO'/)
  assert.match(schemaJava, /static final String MIGRATION = "sql\/kangaroo\/V50__online_links\.sql";/)
  assert.match(schemaJava, /@Component\npublic class OnlineLinksSchema implements KgSchemaContributor/)
})
