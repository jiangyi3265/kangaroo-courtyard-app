// 2026-10-16 岗位列表 / 筛选页 / 满月红包的静态回归（node --test，不需要构建、不发请求）。
// 守住这几件事（10-16 第二轮改版后，对照效果图 23）：
//   · 列表页选城市是右侧面板（多选最多 5 个、文字联想、有岗位的城市 + 热门、带 × 的标签、重置 / 确定），不跳城市选择页；
//   · 换宿「最低在店时长」最少一周 / 半个月 / 20天 / 一个月，参数仍是 minStay；
//   · 筛选页去掉期望薪资，「安心保障」里有经袋鼠实地拍摄并含保险 / 满月红包，样式不再整页宋体；
//   · 满月红包（V44 kg_job.month_redpacket，0 有 1 没有）：门店发布能勾、后台能勾、列表卡片和详情显示标签、列表和筛选都能按它筛；
//   · 小程序列表的城市按包含匹配（城市字典叫「平潭」、岗位写「平潭岛」）。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse } = require('@vue/compiler-sfc')
const read = async (p) => (await readFile(new URL(p, import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const list = await read('../pages/jobs/list.vue')
const filter = await read('../pages/jobs/filter.vue')
const filters = await read('../pages/jobs/job-filters.js')
const filterPanel = await read('../pages/jobs/components/job-filter-panel.vue')
const cityPanel = await read('../pages/jobs/components/job-city-panel.vue')
const detail = await read('../pages/jobs/detail.vue')
const staff = await read('../pages/staff/jobs.vue')
const admin = await read('../../RuoYi-Vue3/src/views/kangaroo/job/index.vue')
const javaRoot = '../../RuoYi-Vue/ruoyi-kangaroo/src/main/'
const jobCtl = await read(javaRoot + 'java/com/ruoyi/kangaroo/controller/app/AppJobController.java')
const hub = await read(javaRoot + 'java/com/ruoyi/kangaroo/ext/user/KgUserHubService.java')
const staffJava = await read(javaRoot + 'java/com/ruoyi/kangaroo/ext/staff/KgStaffJobService.java')
const mapper = await read(javaRoot + 'resources/mapper/kangaroo/KgJobMapper.xml')
const v44 = await read('../../RuoYi-Vue/sql/kangaroo/V44__job_month_redpacket.sql')
const v44r = await read('../../RuoYi-Vue/sql/kangaroo/V44__rollback.sql')

const css = (src) => parse(src).descriptor.styles.map(s => s.content).join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = (src, selector) => {
  const m = [...css(src).matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(x => x[1].trim() === selector)
  assert.ok(m, selector + ' 没有样式')
  return m[2]
}
const literal = (src, name) => {
  const m = new RegExp(`const ${name} = (\\[[^\\n]*\\])\\n`).exec(src)
  assert.ok(m, name + ' not found')
  return Function('return (' + m[1] + ')')()
}

test('列表页选城市：半屏面板多选（最多 5 个），文字联想 + 热门，带 × 的标签，重置 / 确定；不跳城市选择页', () => {
  // 2026-10-16 第二轮改版（效果图 23）：之前是本页单选下拉（全部城市 → 有岗位的城市 → 热门 → A–Z），现在是 pages/jobs/components 里的侧面板
  assert.doesNotMatch(list, /selectCity|selectCities|'more-city'/)
  assert.match(list, /import JobCityPanel from '\.\/components\/job-city-panel\.vue'/)
  assert.match(list, /<job-city-panel v-if="cityOpen" :type="curType\(\)" :value="cityValue" :max="MAX_CITIES" @close="cityOpen = false" @confirm="onCityConfirm" \/>/)
  assert.match(filters, /export const MAX_CITIES = 5\n/)
  const t = parse(cityPanel).descriptor.template.content
  // 不输入时：有岗位的城市（带岗位数）在热门前面；输入时是联想结果（带所属省 / 上级、岗位数）
  const order = ['<template v-if="query">', '<text class="cp-head">热门城市</text>'].map(x => t.indexOf(x))
  assert.ok(order.every(i => i > 0), String(order))
  assert.deepEqual([...order].sort((a, b) => a - b), order)
  assert.doesNotMatch(t, /有岗位的城市/)
  assert.match(t, /\{\{ rowItem\.count \}\} 个岗位/)
  // 搜索框占位：窄屏（< 360，比如 320 宽）换一句短的，长句在 320 宽会被截掉
  assert.match(t, /:placeholder="searchPh"/)
  assert.match(cityPanel, /const SEARCH_PH = '搜索城市、区县或拼音'\n/)
  assert.match(cityPanel, /const SEARCH_PH_NARROW = '搜索城市、区县或拼音'\n/)
  assert.match(cityPanel, /\(uni\.getSystemInfoSync\(\)\.windowWidth \|\| 375\) < 360 \? SEARCH_PH_NARROW : SEARCH_PH/)
  // 选了的城市列成标签，点一下去掉；底部重置 / 确定
  // 标签只写城市名：和别处重名的城市字典里叫「湘潭·湖南省」，标签写「湘潭」（选中、查岗位仍用原名）
  assert.match(t, /v-for="pickedName in picked"[^>]*@click="toggle\(pickedName\)"><k-icon name="circle-check"[^>]*\/><text class="cp-tag__name">\{\{ shortCity\(pickedName\) \}\}<\/text><k-icon name="x"/)
  assert.match(t, /<view class="cp__reset" hover-class="k-press" @click="picked = \[\]"><text>重置<\/text><\/view>/)
  assert.match(t, /class="cp__ok" hover-class="k-press-s" @click="confirm">/)
  // 联想、区县换所属城市、最多 5 个，都复用主包里已有的城市工具；有岗位的城市从分包里自己调接口，不进 common/api.js
  assert.match(cityPanel, /import \{ groupCities, businessCityName \} from '@\/common\/city-directory\.js'/)
  // 主人 10-15 要求的「拼音首字母分组」：不搜索时热门下面按字母分组列出全部城市（不含区县），字母条点了跳到那一组
  assert.match(cityPanel, /const letterGroups = computed\(\(\) => \(dirTick\.value > 0 \? groupCities\(dirRows\.filter\(row => row\.level !== 'district'\)\)\.map\(/)
  assert.match(t, /<scroll-view scroll-y class="cp__body" :scroll-into-view="intoView">/)
  assert.match(t, /<button v-for="(\w+) in letterGroups"[^>]*@click="jumpLetter\(\1\.letter\)"/)
  assert.match(t, /:id="'cpl-' \+ groupItem\.letter"/)
  assert.match(cityPanel, /intoView\.value = 'cpl-' \+ letter/)
  assert.match(cityPanel, /import \{ toggleCitySelection \} from '@\/common\/city-picker-model\.js'/)
  assert.match(cityPanel, /loadJobCities\(type\)/)
  assert.match(cityPanel, /const next = toggleCitySelection\(picked\.value, city, props\.max\)/)
  assert.match(cityPanel, /max: \{ type: Number, default: 5 \}/)
  // 城市字典（3000 多行）放在模块变量里，不进渲染数据；联想最多列 40 行
  assert.match(cityPanel, /<script>\n[\s\S]*let dirRows = \[\][\s\S]*<\/script>/)
  assert.match(cityPanel, /citySuggestions\(dirRows, jobCities\.value, query\.value\)/)
  // 面板顶边让开顶栏（小程序右上角胶囊按钮），条件区自己滚
  assert.match(list, /navTop = \(uni\.getSystemInfoSync\(\)\.statusBarHeight \|\| 20\) \+ 44/)
  assert.match(rule(cityPanel, '.cp__body'), /flex: 1; height: 0; min-height: 0;/)
})

// 2026-10-17：选项改写成「能待…」（「最少一周」读起来像岗位要求），面板里那行说明去掉了
test('换宿「时长」：能待一周 / 半个月 / 20天 / 一个月，参数仍是 minStay（我能待 N 天）', () => {
  assert.deepEqual(literal(filters, 'STAY_OPTS'), [['能待一周', 7], ['能待半个月', 15], ['能待20天', 20], ['能待一个月', 30]])
  assert.match(filters, /if \(has\(type, 'minStay'\) && f\.minStay\) p\.minStay = f\.minStay/)
  // 面板里的选项是一个个胶囊（不再是一行一个的文字行）
  const t = parse(filterPanel).descriptor.template.content
  // 2026-10-17：太长的选项（安心保障）多一个 fp-opt--wide，占满一行；字多的（「100元/天以上」）fp-opt--long 小一号字
  assert.match(t, /<view v-for="optItem in groupItem\.options" :key="optItem\.value" class="fp-opt" :class="\{ on: optItem\.on, 'fp-opt--wide': optItem\.wide, 'fp-opt--long': optItem\.long, 'fp-opt--assured': groupItem\.key === 'assured' \}" hover-class="k-press-s" @click="pick\(groupItem\.key, optItem\.value\)">/)
})

test('列表页视觉（效果图 23；10-19 按参考图一比一还原）：选中页签大字橙棕 + 圆头短粗线，白色大胶囊搜索框，浅橙描边条件胶囊，卡片 16px 圆角', () => {
  assert.match(rule(list, '.job-kind'), /font-size: 17px; font-weight: 700; color: #3B2A1E;/)
  assert.match(rule(list, '.job-kind.active'), /font-size: 17px; font-weight: 600; color: #8A603D;/)
  assert.match(rule(list, '.job-kind.active .job-kind__bar'), /background: linear-gradient\(90deg, #D08A45 0%, #A9692F 100%\);/)
  assert.match(rule(list, '.job-kind__bar'), /width: 24px; height: 4px;[^}]*border-radius: 2px;/)
  assert.match(list, /<job-search/); assert.match(list, /import JobSearch/ )
  assert.match(list, /@search="doSearch"/)
  // 换宿的占位那句很长：折成最多两行的文字（不点也能读全），点框照样输入
  assert.match(list, /:type="curType\(\)"/)
  assert.match(rule(list, '.fchip'), /border-radius: 15px; background: #FBEBD8; box-shadow: inset 0 0 0 1px #E6B98A;[^}]*font-size: 14px; font-weight: 700; color: #A0632E;/)
  assert.match(rule(list, '.card'), /border-radius: 16px; background: var\(--k-paper\); box-shadow: 0 8px 24px rgba\(120, 84, 48, \.10\)/)
  assert.match(rule(list, '.cond'), /background: #F7F2EA;/)
  assert.match(rule(list, '.cond__dot'), /border-radius: 50%; background: linear-gradient\(135deg, #F0A35A 0%, #DB8233 100%\);/)
  // 2026-10-17 主人效果图 2：面板 20px 大圆角白卡；选中（10-19 参考图）= 浅橙底 + 橙棕描边 + 橙棕粗字
  assert.match(rule(filterPanel, '.fp'), /border-radius: 20px 20px 0 0; background: #FFFDFA;/)
  assert.match(rule(filterPanel, '.fp-opt.on'), /border-color: #B79772; background: #F4E9DB; color: #78512E; font-weight: 600;/)
})

test('满月红包：列表卡片和详情页显示标签（后端给布尔）', () => {
  assert.match(list, /redpacket: type !== 'online' && j\.monthRedpacket === true/)
  assert.match(list, /<view v-if="job\.redpacket" class="tag tag--gift"><k-icon name="gift"[^>]*\/><text>满月红包<\/text><\/view>/)
  assert.match(detail, /const redpacket = computed\(\(\) => !isOnline\.value && !!detail\.value && detail\.value\.monthRedpacket === true\)/)
  assert.match(detail, /<view v-if="redpacket" class="redpacket-tag"><text>满月红包<\/text><\/view>/)
  assert.match(jobCtl, /m\.put\("monthRedpacket", Boolean\.valueOf\("0"\.equals\(job\.getMonthRedpacket\(\)\)\)\);/)
})

test('筛选页：去掉期望薪资；「安心保障」里是经袋鼠实地拍摄并含保险 / 满月红包（线上任务没有这一组）；最低在店时长和列表同一组', () => {
  assert.doesNotMatch(filter, /SALARY|期望薪资（元\/天）|f\.salary|salaryMin: SALARY/)
  assert.match(filter, /safe: f\.safe, insured: f\.insured, monthBonus: f\.monthBonus\n\}\)/)
  assert.match(filter, /if \(r\.key === 'monthBonus'\) f\.monthBonus = false/)
  const t = parse(filter).descriptor.template.content
  const more = t.slice(t.indexOf('<text class="sec-head__title">安心保障</text>'))
  assert.ok(more.length > 0 && t.includes('<text class="sec-head__title">安心保障</text>'))
  // 2026-10-17：兼职 / 全职只有自己那几组（食宿 / 日薪 / 类型 / 月薪），没有「安心保障」和「可到岗日期」
  assert.match(t, /<view v-if="!isOnline && !tabMode" class="sec"><view class="sec-head"><text class="sec-head__title">安心保障<\/text>/)
  assert.ok(more.includes('<text>经袋鼠实地拍摄并含保险</text>'))
  assert.ok(more.includes('<text>满月红包</text>'))
  assert.match(more, /class="pill pill--assured" hover-class="k-press-s" :class="\{ on: f\.safe && f\.insured \}" @click="toggleAssured">/)
  assert.match(filter, /const toggleAssured = \(\) => \{ const on = !\(f\.safe && f\.insured\); f\.safe = on; f\.insured = on \}/)
  assert.doesNotMatch(css(filter), /\.filter-page \{ font-family/)
  // 一行标题 18px + 一行 30px 胶囊；在店时长 / 工时 / 食宿 5 个一行，类型三列
  assert.match(rule(filter, '.sec-head'), /height: 18px;/)
  assert.match(rule(filter, '.pill'), /height: 30px;/)
  assert.match(rule(filter, '.pills--5'), /repeat\(5, minmax\(0, 1fr\)\)/)
  assert.match(rule(filter, '.pills--3'), /repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(filter, /title: '最低在店时长', options: \['不限', '一周', '半个月', '20天', '一个月'\]/)
  assert.match(filter, /const STAY = \[0, 7, 15, 20, 30\]/)
  assert.match(filter, /title: '每天工时（小时）', options: \['不限', '4以内', '4-6', '6-8', '8以上'\]/)
  assert.match(filter, /title: '换工类型', meta: typesMeta\.value, cols: 3,/)
})

test('满月红包：后端列表 / 全部筛选都能按它筛，门店发布和后台都能勾', () => {
  assert.match(jobCtl, /@RequestParam\(required = false\) String monthBonus,/)
  assert.match(jobCtl, /params\.put\("monthBonus", Boolean\.TRUE\)/)
  assert.match(mapper, /<if test="params\.monthBonus == true"> and j\.month_redpacket = '0'<\/if>/)
  assert.match(hub, /where\.append\(" and j\.month_redpacket = '0'"\);/)
  assert.match(staffJava, /row\.put\("month_redpacket", d\.monthRedpacket\);/)
  assert.match(staff, /<text class="fc-row__k">做满一个月有红包<\/text>/)
  assert.match(staff, /monthRedpacket: false, headcount: 2/)
  // 勾上只记标记，不再顺手打开奖金；取消时奖金规则还是自动填的那句就清掉
  const toggle = staff.slice(staff.indexOf('const toggleRedpacket'), staff.indexOf('\n}\n', staff.indexOf('const toggleRedpacket')))
  assert.doesNotMatch(toggle, /bonusEnabled = true/)
  assert.doesNotMatch(toggle, /bonusDesc = REDPACKET_RULE/)
  assert.match(toggle, /if \(!on && String\(form\.value\.bonusDesc \|\| ''\)\.trim\(\) === REDPACKET_RULE\) \{\n    form\.value\.bonusDesc = ''\n    form\.value\.bonusEnabled = false/)
  // 线上任务不显示这个勾选框（后端也会把线上任务存成「没有」）
  assert.match(admin, /<el-checkbox v-if="!isOnline" v-model="form\.monthRedpacket" true-value="0" false-value="1"[^>]*>做满一个月有红包<\/el-checkbox>/)
  assert.match(admin, /monthRedpacket: "1",/)
})

test('小程序岗位列表的城市按包含匹配，先归一成业务城市名', () => {
  // 2026-10-16 审计后改为「等于或以城市 / 别名结尾」（KgJobCity），不再是包含匹配
  assert.match(mapper, /or trim\(j\.city\) like #\{cityLike\}/)
  assert.match(mapper, /<when test="city != null and city != ''"> and \(trim\(j\.city\) = #\{city\} or j\.job_type = 'online'\)<\/when>/)
  assert.match(jobCtl, /query\.setCity\(appCity\(city\)\);/)
  assert.match(jobCtl, /cityService\.businessCity\(c\)/)
})

test('V44：加列、老岗位按奖金规则自动勾一次、注销账号点赞修复；回退要授权', () => {
  assert.match(v44, /call kg_assert_env\('43'\);/)
  assert.match(v44, /month_redpacket char\(1\) not null default ''1''/)
  assert.match(v44, /and not exists \(select 1 from kg_schema_version v where v\.version = 44\)/)
  assert.match(v44, /delete l from kg_post_like l join kg_app_user u on u\.user_id = l\.app_user_id and u\.del_flag = '2';/)
  assert.match(v44, /values \(44, 'job_month_redpacket', now\(\), '[0-9a-f]{64}'\)/)
  assert.match(v44r, /@kg_allow_month_redpacket_rollback/)
  assert.match(v44r, /delete from kg_schema_version where version = 44;/)
})
