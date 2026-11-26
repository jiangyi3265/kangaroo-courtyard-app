<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="s === 2 && (dateWhich || tagPop) ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。日历、技能标签弹框开着时锁住页面滚动：弹框里的 scroll-view 不能用 catchtouchmove 拦（拦了它自己也滑不动）。
       弹框只在筛选屏里显示，系统返回切回标签云时它们的状态还留着，所以要带上 s === 2，否则别的屏会滑不动；只在小程序里加：H5 的 page-meta 关弹窗时清不掉这条样式，顶栏会从此不吸顶 -->
  <!-- #endif -->
  <k-feature-gate feature="recruitment">
  <view class="k-page talents-page">
    <template v-if="s===1">
      <k-topbar title="技能标签" back />
      <view class="cloud-page k-pad-tab"><view class="cloud-head"><text>按人员数量从大到小 ⓘ</text><button @click="switchView"><text>切换视图</text></button></view><view class="skill-cloud"><view v-for="(t,i) in skills" :key="t.name" :class="['skill-pill','size-'+t.size,{green:t.green}]" @click="toggleTag(t.name)"><k-icon :name="t.icon" :size="t.size===3?22:t.size===2?18:16" :color="t.green?'green':'ink'" /><text>{{t.name}}</text><text>{{t.count}} 人</text></view></view><view class="more-tags-row"><text class="more-tags" @click="showAllTags = !showAllTags">{{ showAllTags ? '收起标签' : '更多标签' }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view><view class="cloud-bottom"><view><text>已选标签 {{ selTags.length }} 个</text><text @click="clearTags">清空</text></view><button @click="toFilter"><text>筛选人才（{{ cloud.total || 0 }} 人）</text></button></view></view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===2">
      <k-topbar title="标签筛选" back custom-back @back="s=1" />
      <view class="filter-page k-pad-tab"><view class="filter-title"><text>筛选条件</text><text @click="reset">重置</text></view><text class="filter-label">技能标签 <text>多选</text></text><view class="chips"><text v-if="selTags[0]" @click="removeTag(0)">{{ selTags[0] }}　×</text><text v-if="selTags[1]" @click="removeTag(1)">{{ selTags[1] }}　×</text><text v-if="selTags[2]" @click="removeTag(2)">{{ selTags[2] }}　×</text><text class="add" @click="addTag">＋ 添加标签</text></view><view class="filter-block"><text class="filter-label">逻辑关系</text><view class="logic"><text :class="{ active: logic === 'or' }" @click="logic = 'or'">◉ 满足任一标签（或）</text><text class="active" :style="logic === 'and' ? '' : neutral" @click="logic = 'and'">◉ 满足全部标签（且）</text></view></view><view class="filter-block"><text class="filter-label">所在城市 <text>多选</text></text><view class="chips"><text v-if="selCities[0]" @click="removeCity(0)">{{ selCities[0] }}　×</text><text v-if="selCities[1]" @click="removeCity(1)">{{ selCities[1] }}　×</text><text class="add" @click="addCity">＋ 选择城市</text></view></view><view class="filter-block"><text class="filter-label">可到岗日期</text><view class="date-pair"><view @click="pickDate('from')"><text>{{ from || '选择日期' }}</text><k-icon name="calendar-days" :size="16" color="muted" /></view><text>至</text><view @click="pickDate('to')"><text>{{ to || '选择日期' }}</text><k-icon name="calendar-days" :size="16" color="muted" /></view></view></view><view class="filter-block"><text class="filter-label">经历类型 <text>多选</text></text><view class="seg"><text :class="{ active: kinds.includes('volunteer') }" @click="toggleKind('volunteer')">换工</text><text :class="{ active: kinds.includes('parttime') }" @click="toggleKind('parttime')">兼职</text><text class="active" :style="kinds.includes('fulltime') ? '' : neutral" @click="toggleKind('fulltime')">全职</text></view></view><view class="filter-block"><text class="filter-label">平台履约次数</text><view class="seg four"><text :class="{ active: fulfilled === 0 }" @click="fulfilled = 0">全部</text><text :class="{ active: fulfilled === 1 }" @click="fulfilled = 1">1次+</text><text class="active" :style="fulfilled === 3 ? '' : neutral" @click="fulfilled = 3">3次+</text><text :class="{ active: fulfilled === 5 }" @click="fulfilled = 5">5次+</text></view></view><view class="filter-result"><view><text>符合条件人数</text><text>{{ count }} <text>人</text></text></view><button @click="toResults"><text>查看结果</text></button></view></view><k-tabbar mode="staff" active="work" />
      <!-- 可到岗日期：日历选，「不限日期」= 清空（之前要手敲 yyyy-MM-dd） -->
      <k-date-picker v-if="dateWhich" :title="dateWhich === 'from' ? '可到岗日期（从）' : '可到岗日期（至）'" :value="dateWhich === 'from' ? from : to" :min-date="dateWhich === 'to' ? from : ''" :max-date="dateWhich === 'from' ? to : ''" allow-empty @cancel="dateWhich = ''" @confirm="confirmDate" />
      <!-- 添加技能标签：之前是每页 5 个的分页菜单，一屏选完。标题和按钮区不会滚，拖动时拦住，之前在上面拖背后的页面会跟着滚 -->
      <view v-if="tagPop" class="chip-pop">
        <view class="chip-pop__mask" @click="tagPop = null" @touchmove.stop.prevent />
        <view class="chip-pop__panel">
          <view class="chip-pop__head" @touchmove.stop.prevent><text class="chip-pop__title">选择技能标签</text><text class="chip-pop__hint">最多 3 个，已选 {{ tagPop.length }}</text></view>
          <scroll-view scroll-y class="chip-pop__scroll"><view class="chip-pop__chips"><text v-for="x in tagOptions" :key="x" class="chip-pop__chip" :class="{ on: tagPop.includes(x) }" @click="toggleDraftTag(x)">{{ x }}</text></view></scroll-view>
          <view class="chip-pop__foot" @touchmove.stop.prevent><view class="chip-pop__btn"><k-button block type="secondary" label="清空" @click="tagPop = []" /></view><view class="chip-pop__btn chip-pop__btn--main"><k-button block label="确定" @click="confirmTags" /></view></view>
        </view>
      </view>
    </template>
    <template v-else-if="s===3">
      <k-topbar title="人员列表" back custom-back @back="s = listFromCloud ? 1 : 2" />
      <view class="people-page k-pad-tab"><view class="people-head"><text>共 <text>{{ res.total }}</text> 人</text><button @click="s = 2"><k-icon name="refresh-cw" :size="14" color="muted" /><text>调整筛选</text></button><view class="people-sort"><text @click="pickSort">{{ sortText }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></view><view v-for="p in people" :key="p.userId" class="person-card" @click="openProfile(p)"><image :src="p.avatar" mode="aspectFill" /><view class="person-copy"><text>{{p.name}}　<text>◈</text></text><text v-if="p.city">{{p.city}}</text><text v-if="p.role">{{p.role}}</text><view class="person-tags"><text v-for="t in p.tags" :key="t">{{t}}</text></view><text>相关经历 {{p.exp}} 段</text></view><view class="person-side"><text>可到岗</text><text>{{p.date}}</text><text>匹配岗位 {{p.matches}} 个</text><button :style="canProfile ? '' : noProfileStyle"><text>{{ canProfile ? '查看档案' : '无档案权限' }}</text></button></view></view><text class="loaded">{{ people.length ? '— 已加载全部 —' : '— 没有符合条件的人才 —' }}</text></view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else>
      <k-topbar title="人才档案" back custom-back @back="s=3" />
      <view class="profile-page"><view class="profile-head"><image :src="P.avatar ? absUrl(P.avatar) : '/static/media/profile-avatar.jpg'" mode="aspectFill" /><view><text>{{ P.name }}　 <text v-if="P.level">{{ P.level }}</text></text><text>{{ P.basic }}</text></view><view><text>可到岗</text><text>{{ P.date }}</text></view></view><view class="profile-actions"><view v-for="a in profileActions" :key="a.label" @click="act(a)"><k-icon :name="a.icon" :size="27" color="ink" /><text>{{a.label}}</text></view></view><view class="skill-section"><view class="section-head"><text>原始技能 <text>（自由填写）</text></text><text @click="showRaw">查看全部</text></view><text>{{ P.rawSkills }}</text></view><view class="skill-section ai"><view class="section-head"><text>技能标签 <text>（来源：平台技能词表归类）</text></text></view><view><text v-if="tg[0]">{{ tg[0] }}</text><text v-if="tg[1]">{{ tg[1] }}</text><text v-if="tg[2]">{{ tg[2] }}</text><text v-if="tg[3]">{{ tg[3] }}</text><text v-if="tg[4]">{{ tg[4] }}</text></view></view><view class="profile-tabs"><text class="active" :style="profTab === 'exp' ? '' : tabOff" @click="profTab = 'exp'">经历</text><text :class="{ active: profTab === 'reviews' }" @click="profTab = 'reviews'">评价（{{ P.reviewCount || 0 }}）</text><text :class="{ active: profTab === 'trainings' }" @click="profTab = 'trainings'">培训考核（{{ P.certs || 0 }}）</text><text :class="{ active: profTab === 'activity' }" @click="profTab = 'activity'">档案动态</text></view><view v-if="profTab === 'exp'" class="exp-filters"><text :style="expChipStyle('')" @click="expKind = ''">全部 {{ P.expCounts[0] }}</text><text :style="expChipStyle('volunteer')" @click="expKind = 'volunteer'">换工 {{ P.expCounts[1] }}</text><text :style="expChipStyle('parttime')" @click="expKind = 'parttime'">兼职 {{ P.expCounts[2] }}</text><text :style="expChipStyle('fulltime')" @click="expKind = 'fulltime'">全职 {{ P.expCounts[3] }}</text></view><view class="timeline"><view v-for="e in timeline" :key="e.key"><view class="dot" /><text>{{e.date}}</text><view><text>{{e.title}}</text><text>{{e.desc}}</text></view></view></view><text class="recommend-title">可推荐岗位</text><view class="recommend"><view v-for="r in (P.recommends.length ? P.recommends : [{ name: '暂无技能重合的在招岗位', match: null }])" :key="r.name"><text class="recommend__name">{{r.name}}</text><text v-if="r.match != null">匹配度 {{r.match}}%</text></view><view @click="moreJobs"><text>更多 ·</text><text>岗位</text></view></view><view class="contact"><view><text>联系权限</text><text>可见范围</text><text>{{ P.visibility || '曾报名本店' }}</text></view><button @click="applyContact"><text>{{ P.inviteText || '申请联系' }}</text></button><view><text>报名时已授权本店查看简历</text><view class="switch"><view /></view></view></view></view>
    </template>
  </view>
  </k-feature-gate>
</template>

<script setup>
import { selectCities } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 人才库接入情况（员工端）：
//   人才池 = 曾向本店报名的用户（报名时已把简历交给本店），姓名脱敏、年龄只给区间、城市只到城市；看档案会留访问记录
//   s=1 技能标签云：按人数从多到少，标签由平台技能词表归类（不是 AI）；最多选 3 个
//   s=2 标签筛选：标签（或 / 且）、城市（≤2）、可到岗日期（按最近一次报名本店的到岗日期）、经历类型、平台履约次数
//   s=3 人员列表：匹配岗位 = 本店在招岗位里与其技能标签有重合的个数
//   s=4 人才档案：「申请联系」= 给对方发本店在招岗位的报名邀请，对方报名前门店看不到联系方式
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import { apiTalentTags, apiTalentSearch, apiTalent, apiTalentMark, apiTalentInvite, apiTalentJobs } from '@/common/api.js'
import { ensureSession, currentStaffStoreId } from '@/common/experience.js'
import { sheet, prompt, alert, confirm, pickPaged, isYmd, errText } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { staffCan } from '@/common/staff-perms.js'

// 看档案（以及收藏、隐藏、邀请）服务端要「岗位管理·编辑」（主理人、管家）；标签云和人员列表只要「查看」，普通员工也能用。
// 原先普通员工的每张卡片都能点「查看档案」，点了必被拒。现在卡片照常展示，按钮如实写明没有权限，点击说明原因
const canProfile = computed(() => staffCan('jobs', 'edit'))
const noProfileStyle = 'color: var(--k-muted); border-color: var(--k-line2)'
const PROFILE_DENIED = '人才档案仅对本店换工主理人或小院主理人开放；你可以继续按标签筛选查看人才概况'

let booting = true
const sid = () => currentStaffStoreId() || undefined
const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    if (q?.tags) selTags.value = String(q.tags).split(',').filter(Boolean).slice(0, 3)
    await loadTags()
    if (s.value === 2) countNow()
    if (s.value >= 3) await search()
    booting = false
  }
})
watch(s, (v) => { if (booting) return; if (v === 2) countNow(); if (v === 3) search() })

// ---------------- s=1 ----------------
const cloud = ref({ tags: [], cities: [], total: 0 })
const selTags = ref([])
const showAllTags = ref(false)
async function loadTags() {
  try {
    cloud.value = (await apiTalentTags(sid())).data || cloud.value
  } catch (e) {
    toast(errText(e, '人才库加载失败'))
  }
}
const skills = computed(() => {
  const list = (cloud.value.tags || []).map(t => ({ ...t, green: selTags.value.includes(t.name) }))
  if (!list.length) return [{ name: '人才池还没有技能标签', count: 0, icon: 'info', size: 1, green: false }]
  return showAllTags.value ? list : list.slice(0, 18)
})
function toggleTag(name) {
  if (!cloud.value.tags.length) return
  if (selTags.value.includes(name)) selTags.value = selTags.value.filter(x => x !== name)
  else if (selTags.value.length >= 3) toast('最多选 3 个标签')
  else selTags.value = [...selTags.value, name]
}
const clearTags = () => { selTags.value = [] }
// 之前点了只弹「暂时只支持标签视图」；现在可切到列表视图：不按标签筛，直接看人才池全部人员（返回回到标签视图）
const listFromCloud = ref(false)
async function switchView() {
  const i = await sheet(['标签视图（当前）', '列表视图：全部人员'])
  if (i !== 1) return
  reset()
  listFromCloud.value = true
  s.value = 3
}
const toFilter = () => { listFromCloud.value = false; s.value = 2 }

// ---------------- s=2 ----------------
const logic = ref('or')
const selCities = ref([])
const from = ref('')
const to = ref('')
const kinds = ref([])
const fulfilled = ref(0)
const count = ref(0)
const neutral = 'color: var(--k-ink); border-color: var(--k-line2)'
const filters = () => ({ tags: selTags.value, logic: logic.value, cities: selCities.value, from: from.value, to: to.value, kinds: kinds.value, fulfilled: fulfilled.value, sort: sort.value })
let timer = null
function countNow() {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      count.value = (await apiTalentSearch(filters(), true, sid())).data.total
    } catch (e) {
      toast(errText(e, '统计失败'))
    }
  }, 300)
}
watch([selTags, logic, selCities, from, to, kinds, fulfilled], () => { if (s.value === 2) countNow() }, { deep: true })
const reset = () => { selTags.value = []; logic.value = 'or'; selCities.value = []; from.value = ''; to.value = ''; kinds.value = []; fulfilled.value = 0 }
const removeTag = (i) => { selTags.value = selTags.value.filter((_, k) => k !== i) }
const tagPop = ref(null)
const tagOptions = computed(() => (cloud.value.tags || []).map(t => t.name))
function addTag() {
  if (!tagOptions.value.length) return toast('人才池还没有技能标签')
  tagPop.value = selTags.value.slice()
}
function toggleDraftTag(x) {
  const list = tagPop.value || []
  if (list.includes(x)) tagPop.value = list.filter(t => t !== x)
  else if (list.length >= 3) toast('最多选 3 个标签')
  else tagPop.value = [...list, x]
}
const confirmTags = () => {
  const list = tagPop.value || []
  tagPop.value = null
  selTags.value = list
}
const removeCity = (i) => { selCities.value = selCities.value.filter((_, k) => k !== i) }
async function addCity() {
  const result = await selectCities({ selected: selCities.value, items: cloud.value.cities || [], max: 2, hint: '选择人才池中的城市，最多 2 个', emptyText: '人才池里暂无城市' })
  if (result !== null) selCities.value = result
}
const dateWhich = ref('')
const pickDate = (which) => { dateWhich.value = which }
const confirmDate = (v) => {
  const which = dateWhich.value
  dateWhich.value = ''
  if (which === 'from') from.value = v || ''
  else if (which === 'to') to.value = v || ''
}
const toggleKind = (k) => { kinds.value = kinds.value.includes(k) ? kinds.value.filter(x => x !== k) : [...kinds.value, k] }
const kindStyle = (k, first) => (kinds.value.includes(k) ? '' : first ? neutral : '')
const toResults = () => { listFromCloud.value = false; s.value = 3 }

// ---------------- s=3 ----------------
const sort = ref('match')
const res = ref({ total: 0, rows: [] })
async function search() {
  try {
    res.value = (await apiTalentSearch(filters(), false, sid())).data || res.value
  } catch (e) {
    toast(errText(e, '人才加载失败'))
  }
}
// 原来按下标把设计稿里的四张真人照片依次套在真实候选人身上，等于给每个真实人物配了一张别人的脸：
// 有真实头像用真实头像，没有就用品牌默认图（袋鼠线稿，不是任何人）
const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
const people = computed(() => (res.value.rows || []).map((p) => ({ ...p, avatar: p.avatar ? absUrl(p.avatar) : DEFAULT_AVATAR })))
async function pickSort() {
  const opts = [['match', '匹配岗位最多'], ['date', '最早可到岗'], ['exp', '经历最多']]
  // 恢复已隐藏人才同样要「岗位管理·编辑」，没有权限的角色不列这一项
  const i = await sheet([...opts.map(x => x[1]), ...(canProfile.value ? ['管理已隐藏人才'] : [])])
  if (i < 0) return
  if (i === opts.length) return restoreHidden()
  sort.value = opts[i][0]
  search()
}
async function restoreHidden() {
  try {
    const rows = (await apiTalentSearch({ hidden: true }, false, sid())).data?.rows || []
    if (!rows.length) return toast('本店没有已隐藏人才')
    const i = await sheet(rows.map(p => p.name || p.nickname || '用户' + p.userId))
    if (i < 0 || !(await confirm('恢复人才', '恢复后会重新出现在本店人才库，确认？'))) return
    await apiTalentMark(rows[i].userId, { what: 'hidden', on: false }, sid())
    await search()
    toast('已恢复到本店人才库')
  } catch (e) { toast(errText(e, '恢复失败')) }
}
const sortText = computed(() => ({ match: '默认排序', date: '最早可到岗', exp: '经历最多' })[sort.value])

// ---------------- s=4 ----------------
const pf = ref(null)
const cur = ref(0)
async function openProfile(p) {
  if (!canProfile.value) return toast(PROFILE_DENIED)
  try {
    pf.value = (await apiTalent(p.userId, sid())).data
    cur.value = p.userId
    profTab.value = 'exp'
    expKind.value = ''
    s.value = 4
  } catch (e) {
    toast(errText(e, '档案打开失败'))
  }
}
const P = computed(() => pf.value || { tags: [], experiences: [], expCounts: [0, 0, 0, 0], recommends: [], reviews: [], trainings: [], activity: [] })

// 档案下方四个页签原先只有样式、点了没反应，「评价（0）」是写死的；全部 / 换工 / 兼职 / 全职也筛不了。
// 数据都来自档案接口：experiences（带 kind）/ reviews（本店面试评价）/ trainings（证书 + 培训经历）/ activity（与本店的往来）
const profTab = ref('exp')
const expKind = ref('')
const tabOff = 'color: var(--k-ink); border-bottom: 0'
// 第一个筛选项的选中外观写在样式表里（:first-child），其余项选中时用内联样式补同样的外观
const expChipStyle = (k) => {
  const on = expKind.value === k
  if (k === '') return on ? '' : 'color: var(--k-ink); border-color: transparent'
  return on ? 'color: var(--k-red); border: 1px solid var(--k-red-line)' : ''
}
const TAB_EMPTY = {
  exp: ['还没有经历记录', '对方简历里还没有填写经历'],
  kind: ['没有这一类经历', '可切换到「全部」查看其他经历'],
  reviews: ['暂无本店评价', '本店面试后给出的评分和评语会显示在这里'],
  trainings: ['暂无培训考核记录', '平台登记的技能证书和对方填写的培训经历会显示在这里'],
  activity: ['暂无档案动态', '对方在本店的报名、本店的邀请与查看记录会显示在这里']
}
const timeline = computed(() => {
  const p = P.value
  const tab = profTab.value
  let rows
  if (tab === 'reviews') rows = p.reviews || []
  else if (tab === 'trainings') rows = p.trainings || []
  else if (tab === 'activity') rows = p.activity || []
  else rows = (p.experiences || []).filter(e => !expKind.value || e.kind === expKind.value)
  if (!rows.length) {
    const [title, desc] = TAB_EMPTY[tab === 'exp' && expKind.value ? 'kind' : tab]
    rows = [{ date: '—', title, desc }]
  }
  return rows.map((e, i) => ({ ...e, key: tab + ':' + i }))
})
const tg = computed(() => P.value.tags || [])
const profileActions = computed(() => [
  { label: '联系TA', icon: 'phone' }, { label: '发消息', icon: 'message-circle' }, { label: P.value.favorite ? '已收藏' : '收藏', icon: 'star' },
  { label: '分享', icon: 'share-2' }, { label: '更多', icon: 'ellipsis' }
])
let marking = false
let inviting = false
async function act(a) {
  if (a.label === '联系TA' || a.label === '发消息') return applyContact()
  if (a.label === '分享') return alert('分享', '为保护个人信息，人才档案不支持分享。')
  if (a.label === '收藏' || a.label === '已收藏') {
    // 连点会收藏又取消
    if (marking) return
    marking = true
    try {
      toast((await apiTalentMark(cur.value, { what: 'favorite', on: !P.value.favorite }, sid())).data.message)
      pf.value = { ...pf.value, favorite: !P.value.favorite }
    } catch (e) {
      toast(errText(e, '操作失败'))
    } finally {
      marking = false
    }
    return
  }
  const i = await sheet(['不感兴趣（本店隐藏此人）'])
  if (i !== 0) return
  if (!(await confirm('隐藏此人', '隐藏后本店人才库里不再显示 TA（不影响 TA 的报名）。确认？'))) return
  try {
    toast((await apiTalentMark(cur.value, { what: 'hidden', on: true }, sid())).data.message)
    s.value = 3
  } catch (e) {
    toast(errText(e, '操作失败'))
  }
}
const showRaw = () => alert('原始技能（自由填写）', P.value.rawSkills || '—')
async function applyContact() {
  let jobs = []
  try {
    jobs = (await apiTalentJobs(sid())).data || []
  } catch (e) {
    return toast(errText(e, '岗位加载失败'))
  }
  if (!jobs.length) return toast('本店没有在招岗位，发布岗位后再邀请')
  const i = await pickPaged(jobs.slice(0, 20).map(j => j.title), '邀请报名的岗位')
  if (i < 0) return
  if (!(await confirm('邀请报名', `邀请 TA 报名「${jobs[i].title}」？对方报名后你会在报名管理里看到 TA 的报名信息；在此之前看不到联系方式。`)) || inviting) return
  inviting = true
  try {
    toast((await apiTalentInvite(cur.value, jobs[i].jobId, sid())).data.message)
    pf.value = (await apiTalent(cur.value, sid())).data
  } catch (e) {
    toast(errText(e, '邀请失败'))
  } finally {
    inviting = false
  }
}
const moreJobs = () => go(R.staffJobs)
</script>

<style scoped lang="scss">
.talents-page{background:var(--k-bg)}button{margin:0;padding:0;border:0;background:transparent}.cloud-page{padding:0 14px calc(170px + var(--k-safe-bottom))}.cloud-head{height:51px;display:flex;align-items:center;justify-content:space-between;color:var(--k-muted);font-size:12px}.cloud-head button{height:29px;display:flex;align-items:center;justify-content:center;padding:0 11px;border:1px solid var(--k-line2);border-radius:15px;color:#9A7442}.skill-cloud{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 9px}.skill-pill{height:42px;padding:0 15px;border:1px solid var(--k-line2);border-radius:24px;background:var(--k-paper);display:flex;align-items:center;gap:8px;font-family:var(--k-serif);font-weight:700}.skill-pill.size-3{width:45%;height:48px;font-size:20px}.skill-pill.size-2{font-size:15px}.skill-pill.size-1{height:35px;font-size:13px}.skill-pill>text:last-child{font-family:var(--k-sans);font-size:12px;font-weight:400}.skill-pill.green{background:#F1F6ED;color:var(--k-green)}.more-tags{display:block;margin:16px;text-align:center;color:var(--k-muted)}.cloud-bottom{position:fixed;left:0;right:0;bottom:calc(66px + var(--k-safe-bottom));z-index:43;padding:10px 14px;background:var(--k-bg)}.cloud-bottom>view{display:flex;justify-content:space-between;color:var(--k-muted);font-size:12px}.cloud-bottom button{width:100%;height:47px;display:flex;align-items:center;justify-content:center;margin-top:9px;border-radius:8px;background:var(--k-red);color:#fff;font-family:var(--k-serif);font-size:17px;font-weight:700}
.filter-page{padding:0 14px calc(88px + var(--k-safe-bottom))}.filter-title{height:43px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--k-line);font-family:var(--k-serif);font-size:16px;font-weight:700}.filter-title text:last-child{color:var(--k-muted);font-size:12px}.filter-label{display:flex;margin:13px 0 8px;font-family:var(--k-serif);font-size:15px;font-weight:700}.filter-label>text{margin-left:auto;color:var(--k-muted);font-size:11px}.chips{display:flex;flex-wrap:wrap;gap:7px}.chips>text{height:34px;padding:0 11px;border:1px solid #C9D5C3;border-radius:8px;background:#F1F6ED;color:var(--k-green);display:flex;align-items:center}.chips .add{background:var(--k-paper);border-color:var(--k-line2);color:var(--k-muted)}.filter-block{margin-top:12px;padding-top:1px;border-top:1px solid var(--k-line)}.logic,.seg{display:flex;gap:8px}.logic text,.seg text{height:39px;flex:1;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;font-size:12px}.logic .active{color:var(--k-green);border-color:#B7BDAA}.date-pair{display:flex;align-items:center;gap:8px}.date-pair>view{height:39px;flex:1;padding:0 10px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;justify-content:space-between;color:var(--k-muted)}.seg .active{color:var(--k-red);border-color:#CFA89E}.seg.four text{font-size:12px}.filter-result{height:78px;display:flex;align-items:center}.filter-result>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px}.filter-result>view>text:first-child{font-family:var(--k-serif);font-weight:700}.filter-result>view>text:last-child{color:var(--k-green);font-size:28px}.filter-result>view>text:last-child text{font-size:13px;color:var(--k-ink)}.filter-result button{width:190px;height:45px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:var(--k-red);color:#fff;font-family:var(--k-serif);font-size:17px;font-weight:700}
.people-page{padding:0 14px calc(88px + var(--k-safe-bottom))}.people-head{height:46px;display:flex;align-items:center;justify-content:space-between}.people-head>text:first-child{font-family:var(--k-serif);font-size:15px;font-weight:700}.people-head>text:first-child text{color:var(--k-green)}.people-head button{height:29px;padding:0 10px;border:1px solid var(--k-line2);border-radius:15px;display:flex;align-items:center;gap:5px;color:var(--k-muted)}.people-head>text:last-child{color:var(--k-muted);font-size:11px}.person-card{min-height:121px;margin-bottom:8px;padding:10px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;gap:11px}.person-card>image{width:48px;height:48px;border-radius:50%}.person-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:7px;color:var(--k-muted);font-size:10px}.person-copy>text{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.person-tags{overflow:hidden}.person-copy>text:first-child{font-family:var(--k-serif);font-size:15px;font-weight:700;color:var(--k-ink)}.person-copy>text:first-child text{color:var(--k-green)}.person-copy>view{display:flex;gap:6px}.person-copy>view text{flex-shrink:0;padding:4px 8px;border-radius:12px;background:#EEF4E9;color:var(--k-green);font-size:11px}.person-side{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:6px;color:var(--k-muted);font-size:10px}.person-side>text:nth-child(2){font-size:14px;color:var(--k-ink)}.person-side button{width:78px;height:31px;display:flex;align-items:center;justify-content:center;margin-top:auto;border:1px solid var(--k-red-line);border-radius:7px;color:var(--k-red);font-family:var(--k-serif);font-weight:700}.loaded{display:block;text-align:center;color:var(--k-muted)}
.profile-page{padding:0 14px calc(32px + var(--k-safe-bottom))}.profile-head{height:70px;display:flex;align-items:center;gap:12px}.profile-head>image{width:58px;height:58px;border-radius:50%}.profile-head>view:nth-child(2){min-width:0;flex:1;display:flex;flex-direction:column;gap:8px}.profile-head>view:nth-child(2)>text:first-child{font-family:var(--k-serif);font-size:17px;font-weight:700}.profile-head>view:nth-child(2)>text:first-child text{padding:4px 7px;border-radius:12px;background:var(--k-green-soft);color:var(--k-green);font-size:10px}.profile-head>view:nth-child(2)>text:last-child{color:var(--k-muted);font-size:12px}.profile-head>view:last-child{padding:7px;border-radius:8px;background:var(--k-green-soft);display:flex;flex-direction:column;gap:6px;color:var(--k-green);font-size:11px}.profile-head>view:last-child text:last-child{font-size:16px}.profile-actions{height:57px;display:flex}.profile-actions>view{flex:1;border-right:1px solid var(--k-line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:10px}.profile-actions>view:last-child{border-right:0}.skill-section{padding:9px 0;border-bottom:1px solid var(--k-line);font-size:11px;line-height:1.55}.section-head{display:flex;justify-content:space-between;margin-bottom:5px}.section-head>text:first-child{font-family:var(--k-serif);font-size:15px;font-weight:700}.section-head>text:first-child text{font-family:var(--k-sans);font-size:10px;color:var(--k-muted);font-weight:400}.section-head>text:last-child{color:var(--k-green)}.skill-section.ai>view:last-child{display:flex;flex-wrap:wrap;gap:6px}.skill-section.ai>view:last-child text{padding:4px 9px;border-radius:13px;background:#EEF4E9;color:var(--k-green)}.profile-tabs{height:39px;display:flex;border-bottom:1px solid var(--k-line)}.profile-tabs text{flex:1;display:flex;align-items:center;justify-content:center;font-family:var(--k-serif);font-size:13px;font-weight:700}.profile-tabs .active{color:var(--k-red);border-bottom:2px solid var(--k-red)}.exp-filters{height:37px;display:flex;gap:7px;align-items:center}.exp-filters text{padding:5px 10px;border-radius:13px;background:var(--k-paper2);font-size:10px}.exp-filters text:first-child{color:var(--k-red);border:1px solid var(--k-red-line)}.timeline{border-bottom:1px solid var(--k-line)}.timeline>view{position:relative;min-height:55px;padding-left:15px;display:grid;grid-template-columns:88px 1fr;font-size:10px}.timeline .dot{position:absolute;left:0;top:4px;width:9px;height:9px;border:1px solid var(--k-line2);border-radius:50%}.timeline>view>view:last-child{display:flex;flex-direction:column;gap:5px}.timeline>view>view:last-child text:first-child{font-weight:700}.timeline>view>view:last-child text:last-child{color:var(--k-muted)}.recommend-title{display:block;margin:9px 0 7px;font-family:var(--k-serif);font-size:15px;font-weight:700}.recommend{display:flex;gap:7px}.recommend>view{min-width:0;height:46px;flex:1;padding:0 4px;border:1px solid var(--k-line2);border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:10px}.recommend>view text:last-child{color:var(--k-green)}.recommend__name{max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--k-ink)!important}.contact{height:82px;margin-top:9px;padding-top:8px;border-top:1px solid var(--k-line);display:flex;align-items:center}.contact>view:first-child{display:flex;flex-direction:column;gap:6px;font-size:10px}.contact>view:first-child text:first-child{font-family:var(--k-serif);font-size:15px;font-weight:700}.contact button{width:145px;height:45px;display:flex;align-items:center;justify-content:center;margin-left:auto;border-radius:8px;background:var(--k-red);color:#fff;font-family:var(--k-serif);font-size:16px;font-weight:700}.contact>view:last-child{margin-left:auto;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:9px}.switch{width:43px;height:25px;padding:2px;border-radius:15px;background:var(--k-green)}.switch>view{width:21px;height:21px;margin-left:18px;border-radius:50%;background:#fff}
.chip-pop{position:fixed;inset:0;z-index:1000}.chip-pop__mask{position:absolute;inset:0;background:rgba(36,27,23,.45)}.chip-pop__panel{position:absolute;left:0;right:0;bottom:0;padding:18px 16px calc(16px + var(--k-safe-bottom));border-radius:20px 20px 0 0;background:var(--k-paper)}.chip-pop__head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.chip-pop__title{font-family:var(--k-serif);font-size:18px;font-weight:700}.chip-pop__hint{color:var(--k-muted);font-size:13px}.chip-pop__scroll{max-height:50vh;margin:16px 0 20px}.chip-pop__chips{display:flex;flex-wrap:wrap;gap:10px}.chip-pop__chip{padding:8px 14px;border:1px solid var(--k-line);border-radius:18px;font-size:14px;background:var(--k-bg)}.chip-pop__chip.on{color:#fff;border-color:var(--k-red);background:var(--k-red);font-weight:600}.chip-pop__foot{display:flex;gap:12px}.chip-pop__btn{flex:1;min-width:0}.chip-pop__btn--main{flex:2}
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边），标题用系统黑体；标签收成小标签，主按钮收成暖棕渐变胶囊，次按钮白底细边。
   筛选项、按钮、文字一个不少；9–10px 的小字提到 11px。共用写法在 ./work-lite.scss。 */
@import './work-lite.scss';
.talents-page{@include lite-page}
.cloud-page{padding:0 12px calc(170px + var(--k-safe-bottom))}.cloud-head{height:48px}.cloud-head button{height:28px;border-color:var(--k-red-line);background:var(--k-paper);color:var(--k-red-deep);font-size:12px}
.skill-pill{border:0;font-family:var(--k-sans);font-weight:600}.skill-pill.size-3{font-size:17px}.skill-pill.size-2{font-size:14px}.skill-pill.green{background:var(--k-green-soft)}
.more-tags{font-size:12px}
.cloud-bottom{padding:10px 12px}.cloud-bottom button{height:44px;border-radius:999px;background:linear-gradient(135deg,#B5814D,#8E5E33);font-family:var(--k-sans);font-size:15px;font-weight:600}
.filter-page{padding:0 12px calc(88px + var(--k-safe-bottom))}
.filter-title{font-family:var(--k-sans);font-size:15px}.filter-label{font-family:var(--k-sans);font-size:14px;font-weight:600}
.chips>text{height:32px;border:0;border-radius:999px;background:var(--k-green-soft);font-size:13px}.chips .add{border:1px dashed var(--k-line2);background:var(--k-paper)}
/* 逻辑关系、经历类型、履约次数：有一格的「没选中」是脚本用内联样式（只改字色和边框色）盖出来的，所以选中态只能用字色 + 边框色表达，不加底色和粗细 */
.logic text,.seg text{height:38px;border-radius:10px}.logic .active{border-color:var(--k-green)}.seg .active{color:var(--k-red-deep);border-color:var(--k-red-line)}
.date-pair>view{height:40px;border:0;border-radius:10px}
.filter-result>view>text:first-child{font-family:var(--k-sans);font-weight:600}.filter-result>view>text:last-child{font-size:24px;font-weight:700}
.filter-result button{height:44px;border-radius:999px;background:linear-gradient(135deg,#B5814D,#8E5E33);font-family:var(--k-sans);font-size:15px;font-weight:600}
.people-page{padding:0 12px calc(88px + var(--k-safe-bottom))}.people-head>text:first-child{font-family:var(--k-sans)}.people-head button{height:28px;border:0;background:var(--k-paper);font-size:12px}
.person-card{padding:12px;border:0;border-radius:12px}.person-copy{gap:5px;font-size:11px}.person-copy>text:first-child{font-family:var(--k-sans);font-size:14px;font-weight:600}
.person-copy>view text{height:17px;padding:0 5px;border-radius:4px;background:var(--k-green-soft);font-size:10px;font-weight:500;line-height:17px}
.person-side{font-size:11px}.person-side>text:nth-child(2){font-size:13px;font-weight:600}
.person-side button{height:28px;border-radius:999px;color:var(--k-red-deep);font-family:var(--k-sans);font-size:12px;font-weight:500}
.loaded{font-size:12px}
.profile-page{padding:0 12px calc(32px + var(--k-safe-bottom))}
.profile-head>view:nth-child(2)>text:first-child{font-family:var(--k-sans)}.profile-head>view:nth-child(2)>text:first-child text{padding:2px 5px;border-radius:4px;font-weight:500}
.profile-head>view:last-child{border-radius:8px}.profile-head>view:last-child text:last-child{font-size:14px;font-weight:600}
.profile-actions{height:64px;border-radius:12px;background:var(--k-paper)}.profile-actions>view{gap:5px;font-size:11px;color:var(--k-ink2)}
/* 五个操作的图标收到 22（原来 27，挤着上下边），和别处的入口图标一样大 */
.profile-actions :deep(.k-icon){width:22px!important;height:22px!important}
.skill-section{font-size:12px}.section-head>text:first-child{font-family:var(--k-sans);color:var(--k-ink)}.section-head>text:first-child text{font-size:11px}
.skill-section.ai>view:last-child text{padding:2px 6px;border-radius:4px;background:var(--k-green-soft);font-size:11px}
.profile-tabs text{font-family:var(--k-sans);font-weight:600}.profile-tabs .active{color:var(--k-red-deep)}
.exp-filters text{padding:4px 10px;border-radius:999px;background:var(--k-paper);font-size:11px}
.timeline>view{font-size:11px}.timeline>view>view:last-child text:first-child{font-weight:600}
.recommend-title{font-family:var(--k-sans)}.recommend>view{border:0;border-radius:8px;background:var(--k-paper);font-size:11px}
.contact>view:first-child{font-size:11px}.contact>view:first-child text:first-child{font-family:var(--k-sans)}.contact>view:last-child{font-size:10px}
.contact button{height:44px;border-radius:999px;background:linear-gradient(135deg,#B5814D,#8E5E33);font-family:var(--k-sans);font-size:15px;font-weight:600}
.chip-pop__panel{border-radius:16px 16px 0 0}.chip-pop__title{font-family:var(--k-sans);font-size:16px}.chip-pop__chip{border:0;border-radius:999px;background:#F5F1EB;font-size:13px}.chip-pop__chip.on{background:var(--k-red-soft);color:var(--k-red-deep);box-shadow:inset 0 0 0 1px var(--k-red-line)}
/* 2026-11-18 第二轮精修（标签云、筛选、人员列表、人才档案），按精修词典统一：
   大号标签不再被压成 45% 宽、文字折成几行（不换行、按内容变宽，至少 45%），三档图标 22 / 18 / 16；「⌄」换成下拉箭头图标；
   人数用 ink、刷新图标收小；筛选里的分隔换发丝线、逻辑关系选中用暖棕；档案页的技能、页签 + 经历、联系权限各成一张白卡，开关打开是暖棕。
   筛选项、按钮、文字一个不少；页签和经历筛选的选中颜色有一部分写在脚本的行内样式里，这次没动脚本 */
.skill-pill{white-space:nowrap}.skill-pill>text{flex-shrink:0}
.skill-pill.size-3{width:auto;min-width:45%;box-sizing:border-box;padding:0 14px;justify-content:center;font-size:16px}
/* 「更多标签」「排序」后面的箭头换成图标：字的右边留出 16 的可点范围，箭头叠在上面、点它等于点字 */
.more-tags-row{display:flex;align-items:center;justify-content:center;margin:8px 16px}
.more-tags{margin:0 -14px 0 0;padding:8px 16px 8px 0}
.more-tags-row :deep(.k-icon),.people-sort :deep(.k-icon){pointer-events:none}
.people-head>text:first-child text{color:var(--k-ink)}
.people-sort{display:flex;align-items:center}
.people-sort>text{margin-right:-14px;padding:10px 16px 10px 8px;color:var(--k-muted);font-size:12px}
.filter-title{position:relative;border-bottom:0}
.filter-title::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.filter-block{position:relative;border-top:0}
.filter-block::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.logic .active{color:var(--k-red-deep);border-color:var(--k-red-line)}
.filter-result>view>text:last-child{color:var(--k-ink);font-variant-numeric:tabular-nums}
.skill-section{margin-top:8px;padding:12px;border-bottom:0;border-radius:12px;background:var(--k-paper)}
.section-head>text:first-child{font-size:16px}.section-head>text:last-child{font-size:12px;color:var(--k-muted)}
.profile-actions>view{border-right:0}
/* 页签 + 经历筛选 + 时间线合成一张白卡 */
.profile-tabs{position:relative;margin-top:8px;padding:0 4px;border-bottom:0;border-radius:12px 12px 0 0;background:var(--k-paper);justify-content:space-around}
.profile-tabs::after{content:'';position:absolute;left:12px;right:12px;bottom:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.profile-tabs text{flex:none;font-weight:500;color:var(--k-ink)}
.exp-filters{height:auto;padding:10px 12px 2px;background:var(--k-paper)}
.exp-filters text{border:1px solid transparent;background:#F5F1EB}
.timeline{padding:4px 12px;border-bottom:0;border-radius:0 0 12px 12px;background:var(--k-paper)}
.recommend-title{margin:16px 2px 8px;font-size:16px}
.contact{height:auto;min-height:82px;margin-top:8px;padding:12px;border-top:0;border-radius:12px;background:var(--k-paper)}
.contact>view:first-child text:first-child{font-size:16px}
/* 联系权限一行三栏：左边标题不折行（原来 320 宽被拆成「联系权 / 限」），按钮宽度不让，右边的说明去收缩、居中折行；小屏按钮收到 112 */
.contact{gap:8px}.contact>view:first-child{flex-shrink:0}.contact>view:first-child text:first-child{white-space:nowrap}
.contact button{flex-shrink:0}.contact>view:last-child{min-width:0;flex-shrink:1;text-align:center}
@media (max-width:360px){.contact button{width:112px}}
.switch{background:var(--k-red-deep)}
</style>
