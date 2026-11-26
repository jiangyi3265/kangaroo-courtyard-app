// 2026-10-16 主人两项要求的静态回归（node --test，不构建、不发请求）：
//   一、线上任务「提交成果」的成果链接粘贴什么收什么（去首尾空白，500 字内，V47 放宽列宽）：小红书、抖音的「链接 + 口令」不再被
//       「成果链接需以 http(s):// 开头」拒掉；门店验收页、接单人交付页都显示全文，其中第一个网址标红、点了复制，保留「复制链接」，另有「复制全文」；
//   二、员工端「创建活动」加「活动介绍」（1000 字，字数提示，新建 / 修改 / 本机草稿都带上）；用户看的活动详情保留换行、在页面里展开全文。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/java/com/ruoyi/kangaroo/'
const taskJava = await read(javaRoot + 'ext/staff/KgOnlineTaskService.java')
const activityJava = await read(javaRoot + 'ext/community/KgActivityService.java')
const v47 = await read('../../RuoYi-Vue/sql/kangaroo/V47__online_link_text.sql')
const deliver = await read('../pages/jobs/deliver.vue')
const onlineJobs = await read('../pages/staff/online-jobs.vue')
const staffActs = await read('../pages/staff/activities.vue')
const userAct = await read('../pages/community/activity.vue')
const staff = await import('../pages/staff/online-material.js')
const jobs = await import('../pages/jobs/material-files.js')

const XHS = 'https://xhslink.cn/o/AYmULXdGz76 复制口令，打开【小红书】即可畅读全文'
const DOUYIN = '7.43 复制打开抖音，看看【小院的作品】海边日落 https://v.douyin.com/iRNBho6u/ abc:/ 10/23 Kjc:/'

test('从分享口令里取第一个网址：两个分包的本地模块结果一样', () => {
  for (const m of [staff, jobs]) {
    assert.equal(m.firstUrl(XHS), 'https://xhslink.cn/o/AYmULXdGz76')
    assert.equal(m.firstUrl(DOUYIN), 'https://v.douyin.com/iRNBho6u/')
    assert.equal(m.firstUrl('网盘：https://pan.baidu.com/s/1abc，提取码 x1y2'), 'https://pan.baidu.com/s/1abc', '碰到全角标点就断开')
    assert.equal(m.firstUrl('(https://example.com/a).'), 'https://example.com/a', '末尾的英文标点不算')
    assert.equal(m.firstUrl('0F2tNkU7d0ZzWn9 只有口令'), '')
    assert.equal(m.firstUrl(null), '')
    assert.deepEqual(m.splitLink(XHS), { before: '', url: 'https://xhslink.cn/o/AYmULXdGz76', after: ' 复制口令，打开【小红书】即可畅读全文' })
    assert.deepEqual(m.splitLink('只有口令'), { before: '只有口令', url: '', after: '' })
    const p = m.splitLink(DOUYIN)
    assert.equal(p.before + p.url + p.after, DOUYIN, '三段拼起来就是原文')
  }
})

test('后端：成果链接不再查格式，500 字内，和说明一起过内容检查；V47 把列放宽到 500', () => {
  assert.doesNotMatch(taskJava, /link\.matches\(/)
  assert.doesNotMatch(taskJava, /成果链接需以 http\(s\):\/\/ 开头/)
  assert.match(taskJava, /static final int LINK_MAX = 500;/)
  assert.match(taskJava, /link\.length\(\) > LINK_MAX/)
  assert.match(taskJava, /guard\.check\(link, note\);/)
  assert.equal(jobs.LINK_MAX, 500)
  assert.match(v47, /alter table kg_online_submission modify column link varchar\(500\) not null default ''/)
  assert.match(v47, /call kg_assert_env\('46'\);/)
})

test('接单人交付页：标题和提示改成「链接或分享口令」，不再拦 http(s)，超过 500 字才拦', () => {
  assert.doesNotMatch(deliver, /链接需以 http\(s\):\/\/ 开头/)
  assert.doesNotMatch(deliver, /\^https\?:/)
  // 2026-10-17 起：系统输入框换成三栏面板（见 online-links-20261017.test.mjs），标题和提示文字照旧，每个 500 字内
  assert.match(deliver, /<text class="lsheet__title">成果链接或分享口令（选填）<\/text>/)
  assert.match(deliver, /const LINK_HINT = '粘贴作品链接，或小红书、抖音复制的分享口令'/)
  assert.match(deliver, /if \(list\[i\]\.length > LINK_MAX\) return toast\(`第 \$\{i \+ 1\} 个链接或口令最多 \$\{LINK_MAX\} 字/)
  // 自己交过的成果：全文显示，网址标红可点，「复制链接」「复制全文」（2026-10-17 起每个链接各一份）
  assert.match(deliver, /class="link__url" @click="copyLink\(lk\)">\{\{ linkParts\(lk\)\.url \}\}/)
  assert.match(deliver, /@click="copyLink\(lk\)">复制链接<\/text>/)
  assert.match(deliver, /@click="copyAll\(lk\)">复制全文<\/text>/)
  assert.match(deliver, /\.link \{[^}]*white-space: pre-wrap/)
})

test('门店验收页：两处都显示全文、网址点了复制，保留「复制链接」，另有「复制全文」', () => {
  assert.doesNotMatch(onlineJobs, /\{\{ latest && latest\.link \? latest\.link : '（没有链接）' \}\}/, '不再只显示一行被截断的链接')
  // 2026-10-17 起一轮最多 3 个链接：两处都按 latestLinks 一个一个显示，每个各有「复制链接」「复制全文」
  assert.equal((onlineJobs.match(/@click="copyLink\(lk\)">\{\{ linkParts\(lk\)\.url \}\}<\/text>/g) || []).length, 2)
  assert.equal((onlineJobs.match(/@click="copyLink\(lk\)">复制链接<\/text>/g) || []).length, 2)
  assert.equal((onlineJobs.match(/@click="copyLinkText\(lk\)">复制全文<\/text>/g) || []).length, 2)
  assert.match(onlineJobs, /const linkParts = splitLink\n/)
  // 有网址只复制网址，没有网址复制全文
  assert.match(onlineJobs, /return linkParts\(lk\)\.url \? copy\(linkParts\(lk\)\.url, [^)]*\) : copyLinkText\(lk\)/)
  assert.match(onlineJobs, /\.url\.url--text,\.group-page \.url\.url--text\{height:auto;[^}]*white-space:pre-wrap;word-break:break-all\}/)
})

test('创建活动：活动介绍 1000 字，字数提示，新建 / 修改 / 草稿都带上；后端同样 1000 字、超了说清楚', () => {
  // 2026-11-03 主人：「活动介绍放到活动标题上面」—— 从单独一块挪进「基本信息」，在标题前面
  assert.match(staffActs, /<text class="fc-label__t">活动介绍<\/text>/)
  assert.ok(staffActs.indexOf('<text class="fc-label__t">活动介绍</text>') < staffActs.indexOf('<text class="fc-label__t">活动标题</text>'), '介绍在标题上面')
  assert.match(staffActs, /<textarea v-if="editingIntro" v-model="intro" :maxlength="-1" :placeholder="INTRO_HINT"/)
  assert.match(staffActs, /\{\{ intro\.trim\(\)\.length \}\}\/\{\{ INTRO_MAX \}\}/)
  assert.match(staffActs, /const INTRO_MAX = 1000/)
  assert.match(staffActs, /const INTRO_HINT = '[^']*流程、亮点、集合方式和注意事项/)
  assert.match(staffActs, /if \(introText\.length > INTRO_MAX\) return toast\(/)
  assert.match(staffActs, /\.\.\.feeBody\(feeKind\.value, fee\.value, aaFee\.value, aaNote\.value\), intro: introText\n/, '新建和修改都按表单带上介绍')
  assert.doesNotMatch(staffActs, /payload\.intro = a\.intro/, '修改时不再用详情里的旧介绍覆盖表单')
  // 10-16 fb2：草稿里多存一项地图集合点（meet）
  assert.match(staffActs, /fee: fee\.value,\n\s+productKind: productKind\.value, feeKind: feeKind\.value, aaFee: aaFee\.value, aaNote: aaNote\.value, intro: intro\.value, meet: meet\.value \}\)/, '本机草稿存介绍')
  assert.match(staffActs, /if \(dr\.intro != null\) intro\.value = String\(dr\.intro\)/, '恢复草稿带回介绍')
  assert.match(staffActs, /intro\.value = a\.intro \|\| ''/, '修改活动时带出现有介绍')
  assert.match(activityJava, /static final int INTRO_MAX = 1000;/)
  assert.match(activityJava, /static final int USER_INTRO_MAX = 2000;/)
  assert.match(activityJava, /int introMax = staff \? INTRO_MAX : USER_INTRO_MAX;/)
  assert.match(activityJava, /if \(intro\.length\(\) > introMax\)/)
  assert.doesNotMatch(activityJava, /StaffSupport\.cut\(str\(b\.get\("intro"\)\), 1000\)/, '不再悄悄截断')
  assert.match(activityJava, /guard\.check\(str\(cols\.get\("title"\)\), str\(cols\.get\("intro"\)\), str\(cols\.get\("place"\)\), str\(cols\.get\("safety_note"\)\)\)/)
})

test('用户看的活动详情：介绍保留换行，长的在页面里展开全文（不再弹窗）', () => {
  assert.doesNotMatch(userAct, /expandIntro/)
  assert.match(userAct, /<text class="detail-text" :class="\{ 'detail-text--open': introOpen \}">\{\{ detail\.intro \|\| '主办方暂未填写活动介绍' \}\}<\/text>/)
  assert.match(userAct, /<view v-if="introFolds" class="expand" @click="introOpen = !introOpen"><text>\{\{ introOpen \? '收起' : '展开' \}\}<\/text>/)
  assert.match(userAct, /\.detail-text \{[^}]*white-space: pre-line;/)
  assert.match(userAct, /\.detail-text--open \{ display: block;/)
})
