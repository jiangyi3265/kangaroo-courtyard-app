<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <k-feature-gate feature="recruitment">
  <view class="k-page filter-page">
    <template v-if="s === 1">
      <k-topbar title="筛选条件" back custom-back @back="back" />
    <k-subscribe scenes="job_new" label="订阅新机会提醒" />
      <!-- 一张白底卡片、分隔线隔开（2026-10-16）：每组一行标题 + 一行胶囊；换工类型三列两行；
           「最低在店时长」和岗位列表的筛选面板同一组选项（最少一周 / 半个月 / 20天 / 一个月）；
           「安心保障」= 经袋鼠实地拍摄并含保险（门店已认证 + 岗位含保险，和列表同一口径），另有满月红包；线上任务没有这一组。期望薪资不再提供（老版本小程序传了后端照样认） -->
      <view class="filter-body">
        <text v-if="isOnline" class="nationwide-note">线上任务全国可接，无需选择城市</text>
        <view class="sheet">
          <view v-if="!isOnline" class="sec"><view class="sec-head"><text class="sec-head__title">城市</text><view class="sec-head__meta" hover-class="k-press" @click="pickMoreCity"><text class="filter-head__meta">{{ cityMeta }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view><view class="pills pills--5"><view v-for="item in cityOptions" :key="item" class="pill" hover-class="k-press-s" :class="{ on: f.cities.includes(item) }" @click="tapCity(item)"><text>{{ item }}</text></view></view></view>
          <view v-if="!isOnline && !tabMode" class="sec sec--line" hover-class="k-press" @click="pickFrom"><text class="sec-head__title">可到岗日期</text><view class="sec-head__meta"><text class="sec-line__value">{{ fromLabel }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view>
          <view v-for="group in filterGroups" :key="group.title" class="sec"><view class="sec-head"><text class="sec-head__title">{{ group.title }}</text><view v-if="group.meta" class="sec-head__meta" hover-class="k-press" @click="tapGroupMeta(group)"><text class="filter-head__meta">{{ group.meta }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view><view class="pills" :class="'pills--' + (group.cols || 5)"><view v-for="(item,i) in group.options" :key="item" class="pill" hover-class="k-press-s" :class="{ on: isSelected(group.selected, i) }" @click="tapOption(group, i)"><text>{{ item }}</text></view></view></view>
          <view v-if="!isOnline && !tabMode" class="sec"><view class="sec-head"><text class="sec-head__title">安心保障</text></view><view class="pills pills--assure"><view class="pill pill--assured" hover-class="k-press-s" :class="{ on: f.safe && f.insured }" @click="toggleAssured"><image class="pill__icon" src="/static/media/brand-kangaroo.png" mode="aspectFit" /><text>经袋鼠实地拍摄并含保险</text></view><view class="pill" hover-class="k-press-s" :class="{ on: f.monthBonus }" @click="f.monthBonus = !f.monthBonus"><text>满月红包</text></view></view></view>
        </view>
      </view>
      <k-bottom><view class="foot-reset" hover-class="k-press" @click="reset"><text>重置</text></view><view class="foot-main"><k-button block @click="runSearch(true)">{{ countLabel }}</k-button></view></k-bottom>
    </template>

    <template v-else-if="s === 2">
      <k-topbar :title="currentSubId || (subLoading && expectCurrent) ? '当前订阅' : '新机会订阅'" back custom-back @back="subBack" />
      <view class="subscribe-body k-pad-safe">
        <text v-if="sub.jobType === 'online'" class="nationwide-note">接收全国线上任务提醒，不限所在城市</text>
        <view v-for="group in subscriptionGroups" :key="group.title" class="subscribe-card"><view class="filter-head"><view class="k-row k-gap8"><k-icon :name="group.icon" :size="21" color="ink" /><text>{{ group.title }}</text><text class="subscribe-card__hint">{{ group.hint }}</text></view><view class="k-row k-gap4" hover-class="k-press" @click="addSubItem(group)"><text class="filter-head__meta">已选 {{ group.items.length }} 个</text><k-icon name="chevron-right" :size="17" color="muted" /></view></view><view class="selected-row"><view v-for="item in group.items" :key="item" class="selected-chip" hover-class="k-press-s" @click="removeSubItem(group, item)"><text>{{ item }}</text><k-icon name="x" :size="13" color="muted" /></view><view class="selected-chip" hover-class="k-press-s" @click="addSubItem(group)"><k-icon name="plus" :size="14" color="muted" /><text>{{ group.add }}</text></view></view></view>
        <view v-if="sub.jobType !== 'online'" class="subscribe-line" hover-class="k-press" @click="pickSubFrom"><view class="k-row k-gap10"><k-icon name="calendar-days" :size="21" color="ink" /><text>可到岗日期</text></view><view class="k-row k-gap6"><text>{{ subFromLabel }}</text><k-icon name="chevron-right" :size="17" color="muted" /></view></view>
        <view class="match-slider"><view class="k-row k-gap10"><k-icon name="heart" :size="21" color="ink" /><text>最低匹配度</text></view><view class="slider"><view class="slider__active" :style="{ width: matchPos }" /><view class="slider__knob" :style="{ left: matchPos }"><text>{{ sub.minMatch }}%</text></view><view v-for="n in [60,70,80,90,95]" :key="n" class="slider__mark" hover-class="k-press" @click="sub.minMatch = n"><view /><text>{{ n }}%</text></view></view></view>
        <view class="message-switch"><view class="k-row k-gap10"><k-icon name="bell" :size="21" color="ink" /><view><text class="message-switch__title">微信订阅消息</text><text class="message-switch__sub">微信订阅消息待平台配置模板，目前通过消息中心提醒</text></view></view><view class="k-switch" hover-class="k-press" @click="wxTip" /></view>
        <view class="frequency"><view class="k-row k-gap10"><k-icon name="list-checks" :size="21" color="ink" /><text>推送频率</text></view><view class="frequency__choices"><view class="frequency__item" hover-class="k-press" @click="sub.freq = 'instant'"><view class="k-radio" :class="{ checked: sub.freq === 'instant' }" /><view><text>即时推送</text><text>有新机会立即通知你</text></view></view><view class="frequency__item" hover-class="k-press" @click="sub.freq = 'daily'"><view class="k-radio" :class="{ checked: sub.freq === 'daily' }" /><view><text>每日汇总</text><text>每天上午 9:00 汇总推送</text></view></view></view></view>
        <view v-if="subLoadError" class="manage-note" @click="retrySubscription"><text>{{ subLoadError }}，{{ subNeedsLogin ? '点击登录' : '点击重试' }}</text></view><view class="save-button"><k-button block :disabled="savingSub || subLoading || !!subLoadError" :label="savingSub ? '保存中…' : subLoading ? '加载中…' : currentSubId ? '保存修改' : '保存订阅'" @click="saveSub" /></view><view class="manage-note"><k-icon name="lock-keyhole" :size="15" color="muted" /><text>有新机会时通过消息中心通知你，可在「我的 → 设置 → 通知管理」里暂停</text></view><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else-if="s === 3">
      <k-topbar :title="title" back custom-back @back="s = 1" />
      <view class="result-body k-pad-safe">
        <view class="chosen"><view v-for="item in chips" :key="item.label" hover-class="k-press" @click="dropChip(item)"><text>{{ item.label }}</text></view><view hover-class="k-press" @click="s = 1"><k-icon name="filter" :size="14" color="ink" /><text>筛选</text></view></view>
        <text class="result-count">共 {{ res.total || 0 }} 个机会</text>
        <view v-for="job in jobs" :key="job.jobId" class="job-card" hover-class="k-press-s" @click="openJob(job)"><view class="job-card__cover"><image class="job-card__image" :src="job.image" mode="aspectFill" /><view v-if="job.assured" class="job-card__badge"><job-badge size="card" /></view></view><view class="job-card__copy"><view class="k-between"><text class="job-card__title">{{ job.title }}</text><k-chip v-if="job.match" tone="green"><text>{{ job.match }}%匹配</text></k-chip></view><view class="job-card__tags"><k-chip v-for="tag in job.tags" :key="tag"><text>{{ tag }}</text></k-chip></view><view v-if="job.place" class="job-card__meta"><k-icon name="store" :size="13" color="muted" /><text>{{ job.place }}</text></view><view v-if="job.date" class="job-card__meta"><k-icon name="map-pin" :size="13" color="muted" /><text>{{ job.date }}</text></view><view class="job-card__bottom"><view class="k-row k-gap4"><k-icon name="shield-check" :size="14" color="ochre" /><text>{{ job.badge }}</text></view><view class="job-card__price"><text class="k-price">{{ job.price }}</text><text>{{ job.unit }}</text></view></view></view><view class="job-card__star" @click.stop><k-icon name="star" :size="20" :color="favs[job.jobId] ? 'ochre' : 'muted'" @click="star(job)" /></view></view>
        <view v-if="counting" class="skeleton"><view class="skeleton__image" /><view class="skeleton__lines"><view class="skeleton__line is-long" /><view class="skeleton__line is-short" /><view class="skeleton__line" /><view class="skeleton__line is-mid" /></view></view>
        <view v-if="counting" class="loading"><view class="loading__spinner" /><text>正在加载...</text></view><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else>
      <k-topbar :title="title" back custom-back @back="s = 1" />
      <view class="empty-body k-pad-safe">
        <view class="chosen"><view v-for="item in chips" :key="item.label" hover-class="k-press" @click="dropChip(item)"><text>{{ item.label }}</text></view><view hover-class="k-press" @click="s = 1"><k-icon name="filter" :size="14" color="ink" /><text>筛选</text></view></view>
        <image class="empty-image" src="/static/media/jobs-empty.png" mode="aspectFit" />
        <text class="empty-title">没有符合条件的机会</text><text class="empty-desc">当前筛选条件过于严格，或时间与部分机会冲突</text>
        <view class="conflict"><text class="conflict__title">条件冲突</text><text v-if="conflicts[0]">· {{ conflicts[0] }}</text><text v-if="conflicts[1]">· {{ conflicts[1] }}</text></view>
        <view class="suggestions"><text class="conflict__title">放宽建议（共 {{ relax.length }} 条）</text><view v-for="item in relax" :key="item.key" class="suggestion"><text>{{ item.label }}</text><k-button type="outline" size="xs" @click="applyRelax(item)">调整</k-button></view></view>
        <k-button block class="adjust" @click="s = 1">调整筛选</k-button><k-button type="outline" block icon="bell" class="subscribe-btn" @click="openSubscribe">订阅新机会</k-button><view class="service" hover-class="k-press-s" @click="contact"><k-icon name="headphones" :size="18" color="ink" /><text>联系袋鼠全球青年（工作日 9:00-18:00）</text></view><view class="k-home-indicator" />
      </view>
    </template>
    <!-- 可到岗日期之前是 60 天的分页菜单（「下一页…」翻好几页）；改成日历点选，「不限日期」也在日历里 -->
    <k-date-picker v-if="fromPick" title="可到岗日期" allow-empty :value="fromPick === 'sub' ? sub.fromDate : f.fromDate" :min-date="todayCn()" :max-date="shiftDate(todayCn(), 59)" @cancel="fromPick = ''" @confirm="confirmFrom" />
    <!-- 「联系客服」：AI袋鼠在本页底部弹出，不跳页 -->
    <k-ai-sheet :show="aiOpen" ctx="city" @close="aiOpen = false" />
  </view>
  </k-feature-gate>
</template>

<script setup>
import { selectCities } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 岗位筛选接入情况：
//   s=1 筛选：城市（城市字典热门 + 更多）、可到岗日期、最低在店时长、岗位类型、每天工时、食宿，「安心保障」里的经袋鼠实地拍摄并含保险 / 满月红包；
//       底部按钮实时显示符合条件的数量（apiJobSearch）
//       岗位大类（?type= 预选，列表页的筛选胶囊会带上当前分类）显示在「岗位类型」右上角，点它可切换 / 改为不限；
//       期望薪资 2026-10-16 起去掉（一屏放不下、用得少）；后端仍认 salaryMin / salaryMax，老版本小程序照常
//   s=2 新机会订阅：城市 / 岗位类型 / 到岗日期 / 最低匹配度 / 推送频率 → apiAddJobSub；推送走消息中心
//       （微信订阅消息需要在微信后台配置模板，未配置前不开放）
//   s=3 结果：真实岗位，匹配度按简历技能重合计算（没写简历技能时不显示匹配度）
//   s=4 空结果：列出冲突条件与放宽建议，一键放宽后重新筛选
// ---------------------------------------------------------------------------
import { ref, reactive, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiJobSearch, apiAddJobSub, apiEditJobSub, apiCities, apiToggleFavorite, apiJobSubs, apiJobKinds } from '@/common/api.js'
import { experience, ensureSession } from '@/common/experience.js'
import { pickPaged, shiftDate, todayCn, errText } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import JobBadge from './components/job-badge.vue'
import { blankFilter, cloneFilter, panelGroups, pickOption, filterForTab, filterFromQuery, filterChips, dropChip as dropTabChip, PAY_MONTH_OPTS } from './job-filters.js'
import { currentJobSubscription, splitSubscription } from './subscription-model.js'
const aiOpen = ref(false)

let filtersReady = false
const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    loadCities()
    if (q?.type) f.types = []
    // 岗位大类（列表页带 ?type=）放进 f.jobType，按 kg_job.job_type 精确筛；
    // 旧版列表页把大类代码当 ?q= 传，也认出来归到 f.jobType —— 塞进关键词只会去 like 标题，永远 0 条
    const jt = isJobType(q?.type) ? q.type : (isJobType(q?.q) ? q.q : '')
    if (jt) f.jobType = jt
    // 列表页「换工换宿」选了换工类型再点筛选，带 ?kind= 过来预选
    if (jt === 'volunteer' && /^[a-z0-9_-]{1,32}$/.test(String(q?.kind || ''))) f.kinds = [String(q.kind)]
    loadKinds()
    if (q?.q && !isJobType(q.q)) f.types = [q.q]
    fromList(q || {}, jt)
    // 兼职 / 全职：列表页带过来的这个页签的条件（?board= / ?payDay= / ?payMonth= / ?categories=，和列表页地址同一套参数，见 job-filters.filterQuery）
    if (TAB_TYPES.includes(jt)) Object.assign(tf, cloneFilter({ ...filterFromQuery({ ...(q || {}), type: jt }), cities: [] }))
    sub.jobType = f.jobType
    // 订阅屏预选的城市跟着带进来的条件走（岗位列表点小铃铛时带着列表选的城市）
    sub.cities = [...f.cities]
    // 订阅命中通知的深链 ?source=sub&sub=<订阅 id>：按这条订阅的城市 / 岗位类型搜索，而不是按默认条件（之前 sub 参数被忽略）
    if (q?.sub) {
      try {
        const mine = (await apiJobSubs()).data || []
        const sub = mine.find(x => String(x.subId) === String(q.sub))
        if (sub) {
          const cities = String(sub.cities || '').split(',').map(x => x.trim()).filter(Boolean)
          const types = String(sub.jobTypes || '').split(',').map(x => x.trim()).filter(Boolean)
          if (cities.length) f.cities = cities.slice(0, 5)
          // 订阅里的岗位大类存的是代码，拆出来走 jobType；其余才是关键词（与后端推送匹配同一口径）
          f.jobType = types.find(isJobType) || ''
          f.types = types.filter(t => !isJobType(t))
          if (sub.fromDate) f.fromDate = String(sub.fromDate).slice(0, 10)
        }
      } catch (e) { /* 取不到订阅就按默认条件搜 */ }
    }
    // 2026-11-03：列表页已有订阅时带 cur=1（加载完之前标题就写「当前订阅」）；岗位详情城市负责人卡片带 addCity=城市（把它加进当前订阅）
    expectCurrent.value = q?.cur === '1'
    addCity = String(q?.addCity || '').trim().slice(0, 16)
    if (s.value === 2) await loadCurrentSubscription()
    filtersReady = true
    // 一打开就统计一次：之前要等改了条件才去数，按钮一直写着「查看 0 个机会」
    runSearch(s.value === 3 || q?.source === 'sub')
  }
})
const home = (experience.cities && experience.cities[0]) || '大理'
// jobType 是岗位大类（kg_job.job_type：volunteer / parttime / fulltime / online），和下面「岗位类型」那组关键词胶囊是两回事：
// 关键词按标题 / 标签模糊匹配，大类按列精确匹配。空串 = 不限（后端此时只返回到店岗位）
const JOB_TYPE_NAMES = { volunteer: '换宿旅行', parttime: '兼职旅行', fulltime: '全职旅行', online: '线上任务' }
const JOB_TYPE_CODES = Object.keys(JOB_TYPE_NAMES)
// 只认这四个代码（不用 JOB_TYPE_NAMES[t] 判断：?type=constructor 这类原型属性名会被当成真值）
const isJobType = (t) => JOB_TYPE_CODES.indexOf(t) >= 0
// monthBonus：只看门店勾了「做满一个月有红包」的岗位（V44）
// 城市默认不选（= 全部城市，2026-10-17）：之前默认塞进首页城市（多半是首页自动定位到的），主人「选择地址的时候默认我在的位置也加到里面了」。
// 首页城市仍排在城市胶囊第一个，点一下就选上；带了 ?city= / ?cities= 进来的照旧按带来的选（fromList）
const f = reactive({ cities: [], fromDate: '', minStay: 0, jobType: '', types: [], kinds: [], hours: 0, board: 'none', safe: false, insured: false, monthBonus: false })
// 换工类型（后台字典，运营可改）：岗位大类是「换工换宿」时，「类型」一栏换成这些（按门店选的类型精确筛，还没选类型的换工岗位归在「其他」里）；
// 之前换工也只能选写死的「手作老师 / 店员助手…」关键词去模糊匹配标题。f.kinds 存的是类型值（如 photo）
const kindOptions = ref([])
const useKinds = computed(() => f.jobType === 'volunteer' && kindOptions.value.length > 0)
const kindLabelOf = (v) => (kindOptions.value.find(k => k.value === v) || {}).label || v
async function loadKinds() {
  try { kindOptions.value = (await apiJobKinds()).data || [] } catch (e) { kindOptions.value = [] }
}
async function loadCities() {
  try {
    const d = (await apiCities()).data
    const hot = (d.hot || []).filter(c => c !== home).slice(0, 3)
    cityOptions.value = [home, ...hot, '更多']
  } catch (e) { /* 城市字典失败时保留默认 */ }
}
const cityOptions = ref([home, '丽江', '成都', '杭州', '更多'])
// 从别的页面带条件进来：城市（city= 一个，空 = 全部城市；岗位列表点小铃铛订阅时带 cities=a,b，最多 5 个）、最低在店时长（minStay）、食宿（board）、线上任务类型（task）。
// 之前只带大类，进来城市总是写死成常住城市，列表页选好的条件全丢了
function fromList(q, jt) {
  if (q.city !== undefined) f.cities = String(q.city).trim() ? [String(q.city).trim().slice(0, 16)] : []
  if (q.cities !== undefined) f.cities = [...new Set(String(q.cities).split(',').map(c => c.trim().slice(0, 16)).filter(Boolean))].slice(0, 5)
  const ms = Number(q.minStay)
  if (STAY.indexOf(ms) > 0) f.minStay = ms
  if (BOARD.indexOf(q.board) > 0) f.board = q.board
  if (jt === 'online' && ONLINE_TYPES.indexOf(q.task) >= 0) f.types = [q.task]
}
async function tapCity(item) {
  if (item === '更多') return pickMoreCity()
  const i = f.cities.indexOf(item)
  if (i >= 0) f.cities.splice(i, 1)
  else if (f.cities.length < 5) f.cities.push(item)
}
async function pickMoreCity() {
  const result = await selectCities({ selected: f.cities, max: 5, title: '筛选城市' })
  if (result !== null) f.cities = result
}
const cityMeta = computed(() => `已选 ${f.cities.length} 个`)
const fromLabel = computed(() => (f.fromDate ? `${f.fromDate} 及以后` : '不限'))
// 'from' = 筛选屏，'sub' = 订阅屏；空串 = 日历关着
const fromPick = ref('')
const pickFrom = () => { fromPick.value = 'from' }
function confirmFrom(v) {
  if (fromPick.value === 'sub') sub.fromDate = v || ''
  else f.fromDate = v || ''
  fromPick.value = ''
}
// 最低在店时长 = 我能待多少天（只看最短在店不超过它的岗位），和岗位列表筛选面板同一组：最少一周 / 半个月 / 20天 / 一个月
const STAY = [0, 7, 15, 20, 30]
const HOURS = [0, 4, 6, 8, 99]
// 食宿只有三档：之前还有「包三餐」「包部分」，实际分别按 all / room 查，和「包食宿」「包住宿」结果一模一样（后端只认这两种）
const BOARD = ['none', 'all', 'room']
const BOARD_LABEL = ['不限', '包食宿', '包住宿']
const STAY_LABEL = { 7: '最少一周', 15: '最少半个月', 20: '最少20天', 30: '最少一个月' }
const TYPES = ['手作老师', '店员/助手', '主理人助理', '摄影师', '其他']
const ONLINE_TYPES = ['内容写作', '图片设计', '视频剪辑', '社群运营', '数据整理', '其他']
const isOnline = computed(() => f.jobType === 'online')
// 兼职 / 全职页签自己的条件（2026-10-17）：tf 和列表页的筛选草稿同一个结构（job-filters.blankFilter），只用 board / payDay / payMonth / categories
const TAB_TYPES = ['parttime', 'fulltime']
const tabMode = computed(() => TAB_TYPES.includes(f.jobType))
const tf = reactive(blankFilter())
const typeOptions = computed(() => isOnline.value ? ONLINE_TYPES : TYPES)
// 「岗位类型」右上角的说明里同时写出岗位大类，点它可以换大类或改成不限（不增加控件）
const typesMeta = computed(() => {
  const n = useKinds.value ? f.kinds.length : f.types.length
  return [JOB_TYPE_NAMES[f.jobType] || '不限大类', n ? `已选 ${n} 个` : ''].filter(Boolean).join(' · ')
})
// 每组一行胶囊：停留、工时各 5 个短胶囊，食宿 3 个（也按 5 列排，和上面对齐）；类型三列（换工类型通常 6 个，三列两行）
// 兼职 / 全职（2026-10-17 主人：每个页签自己一套条件）：和岗位列表筛选面板同一组（job-filters.panelGroups）——
// 兼职 = 食宿 / 日薪，全职 = 类型 / 食宿 / 月薪；四个以内的选项一行排开，类型五个排三列（「咖啡餐饮」320 宽五列放不下），日薪字多排两列；第一组右上角照旧可以换岗位大类
const tabGroups = () => panelGroups(f.jobType, tf).map((g, gi) => ({
  key: 'tab:' + g.key, tab: g.key, title: g.title, cols: g.long ? 2 : g.options.length <= 4 ? g.options.length : 3,
  meta: gi === 0 ? JOB_TYPE_NAMES[f.jobType] : '', switchType: gi === 0,
  options: g.options.map(o => o.label), values: g.options.map(o => o.value),
  selected: g.options.map((o, i) => (o.on ? i : -1)).filter(i => i >= 0)
}))
const filterGroups = computed(() => tabMode.value ? tabGroups() : isOnline.value ? [
  { key: 'types', title: '任务类型', meta: typesMeta.value, cols: 3, options: ONLINE_TYPES, selected: f.types.map(t => ONLINE_TYPES.indexOf(t)).filter(i => i >= 0) }
] : [
  { key: 'stay', title: '最低在店时长', options: ['不限', '一周', '半个月', '20天', '一个月'], selected: STAY.indexOf(f.minStay) },
  useKinds.value
    ? { key: 'kinds', title: '换工类型', meta: typesMeta.value, cols: 3, options: kindOptions.value.map(k => k.label), selected: f.kinds.map(v => kindOptions.value.findIndex(k => k.value === v)).filter(i => i >= 0) }
    : { key: 'types', title: '岗位类型', meta: typesMeta.value, cols: 3, options: TYPES, selected: f.types.map(t => TYPES.indexOf(t)).filter(i => i >= 0) },
  { key: 'hours', title: '每天工时（小时）', options: ['不限', '4以内', '4-6', '6-8', '8以上'], selected: HOURS.indexOf(f.hours) },
  { key: 'board', title: '食宿', options: BOARD_LABEL, selected: Math.max(0, BOARD.indexOf(f.board)) }
])
function tapOption(group, i) {
  if (group.tab) { pickOption(tf, group.tab, group.values[i]); return }
  if (group.key === 'stay') f.minStay = STAY[i]
  else if (group.key === 'hours') f.hours = HOURS[i]
  else if (group.key === 'board') f.board = BOARD[i]
  else if (group.key === 'kinds') {
    const v = (kindOptions.value[i] || {}).value
    const k = f.kinds.indexOf(v)
    if (k >= 0) f.kinds.splice(k, 1)
    else if (v) f.kinds.push(v)
  }
  else {
    const t = typeOptions.value[i]
    const k = f.types.indexOf(t)
    if (k >= 0) f.types.splice(k, 1)
    else f.types.push(t)
  }
}
const isSelected = (selected, i) => (Array.isArray(selected) ? selected.includes(i) : selected === i)
async function tapGroupMeta(group) {
  if (group.key !== 'types' && group.key !== 'kinds' && !group.switchType) return
  const i = await pickPaged(['不限岗位大类', ...JOB_TYPE_CODES.map(c => JOB_TYPE_NAMES[c])], '岗位大类')
  if (i >= 0) {
    f.jobType = i === 0 ? '' : JOB_TYPE_CODES[i - 1]; f.types = []; f.kinds = []
    // 换大类：兼职 / 全职的条件只留新大类用得上的（兼职 ↔ 全职的食宿带过去），和列表页换页签同一口径
    Object.assign(tf, filterForTab(TAB_TYPES.includes(f.jobType) ? f.jobType : 'volunteer', { ...tf, cities: [] }))
  }
}
function reset() {
  Object.assign(tf, blankFilter())
  Object.assign(f, { cities: [], fromDate: '', minStay: 0, jobType: f.jobType, types: [], kinds: [], hours: 0, board: 'none', safe: false, insured: false, monthBonus: false })
  toast('已重置')
}
// 安心保障：门店已认证（safe）并且岗位含保险（insured）两个一起开关；线上任务没有这一组
const toggleAssured = () => { const on = !(f.safe && f.insured); f.safe = on; f.insured = on }
// 兼职 / 全职（2026-10-17）：只带城市、大类和这个页签自己的条件（食宿 / 日薪 / 月薪 / 类型），和岗位列表同一口径（后端 JobTabFilters）
const tabPayload = () => {
  const month = PAY_MONTH_OPTS[tf.payMonth - 1]
  return {
    cities: f.cities, jobType: f.jobType, board: tf.board || 'none',
    payDay: f.jobType === 'parttime' && tf.payDay ? tf.payDay : undefined,
    payMonthMin: f.jobType === 'fulltime' && month && month[1] ? month[1] : undefined,
    payMonthMax: f.jobType === 'fulltime' && month && month[2] ? month[2] : undefined,
    categories: f.jobType === 'fulltime' ? tf.categories : []
  }
}
const payload = () => isOnline.value ? ({ jobType: 'online', cities: [], types: f.types }) : tabMode.value ? tabPayload() : ({
  cities: f.cities, fromDate: f.fromDate || undefined, minStay: f.minStay, jobType: f.jobType || undefined, types: f.types.filter(t => t !== '其他'), hours: f.hours, board: f.board,
  // 换工类型只对换工换宿生效（后端按 kg_job.work_kind 精确筛，选「其他」时连还没选类型的换工岗位一起列出）
  workKinds: f.jobType === 'volunteer' ? f.kinds : [],
  safe: f.safe, insured: f.insured, monthBonus: f.monthBonus
})
const res = ref({ jobs: [], total: 0 })
const counting = ref(false)
let timer = null
let searchRequest = 0
watch([f, tf], () => {
  clearTimeout(timer)
  timer = setTimeout(() => runSearch(false), 400)
}, { deep: true })
async function runSearch(show) {
  clearTimeout(timer)
  timer = null
  const request = ++searchRequest
  counting.value = true
  try {
    const data = (await apiJobSearch(payload())).data
    if (request !== searchRequest) return
    res.value = data || { jobs: [], total: 0 }
    if (show) s.value = res.value.total ? 3 : 4
  } catch (e) {
    if (request !== searchRequest) return
    toast(errText(e, '筛选失败'))
  } finally {
    if (request === searchRequest) counting.value = false
  }
}
onShow(() => { if (filtersReady && s.value === 2 && subNeedsLogin.value) loadCurrentSubscription(); if (filtersReady && (s.value === 3 || s.value === 4)) runSearch(true) })
const countLabel = computed(() => (counting.value ? '正在统计…' : `查看 ${res.value.total || 0} 个机会`))

// ---------------- s=2 订阅 ----------------
const sub = reactive({ cities: [...f.cities], jobType: '', types: [], fromDate: '', minMatch: 70, freq: 'instant' })
const openSubscribe = async () => { sub.cities = [...f.cities]; sub.jobType = f.jobType; sub.types = f.types.filter(t => t !== '其他'); sub.fromDate = f.fromDate; subFrom = s.value; s.value = 2; await loadCurrentSubscription() }
// 订阅屏从哪来回哪去：之前左上角返回一律回第 1 屏筛选条件，从列表页「有新机会提醒我」直接进来（?s=2）的要多退一层才回得去；
// 保存后还会被带到一屏从没要过的筛选结果。现在直接进来的返回 / 保存后都回列表页，从空结果屏进来的回空结果屏
let subFrom = 0
const subBack = () => (subFrom ? (s.value = subFrom) : back())
// 最低匹配度的滑块之前固定画在 56% 处（设计稿位置），点 90% 只有气泡数字变、滑块不动，看着像没点上；现在跟着所选刻度走
const matchPos = computed(() => `calc(${Math.max(0, [60, 70, 80, 90, 95].indexOf(sub.minMatch)) * 20}% + 10px)`)
// 订阅的「岗位类型」一栏同时列出岗位大类（显示中文名）和关键词；保存时大类以代码存进 jobTypes，
// 后端推送按 j.job_type 精确匹配、其余按关键词匹配（KgUserHubService.push 与 search 同一口径）
// 订阅的城市也不再默认塞首页城市（2026-10-17，和筛选同一口径）：只预选列表页带来的城市，一个没选时说明「不选就是全部城市」
// （后端只要有城市或岗位类型之一就能保存；列表页点小铃铛进来总是带着岗位大类）
const subscriptionGroups = computed(() => [
  ...(sub.jobType === 'online' ? [] : [{ key: 'cities', icon: 'map-pin', title: '所在城市', hint: sub.cities.length ? '（可多选）' : '（不选就是全部城市）', items: sub.cities, add: '添加城市' }]),
  { key: 'types', icon: 'briefcase-business', title: '岗位类型', hint: '（可多选）', items: [...(sub.jobType ? [JOB_TYPE_NAMES[sub.jobType]] : []), ...sub.types.map(t => JOB_TYPE_NAMES[t] || t)], add: '添加类型' }
])
const removeSubItem = (group, item) => {
  if (group.key === 'types' && sub.jobType && item === JOB_TYPE_NAMES[sub.jobType]) { sub.jobType = ''; return }
  const list = sub[group.key]; const i = list.findIndex(t => t === item || (group.key === 'types' && JOB_TYPE_NAMES[t] === item)); if (i >= 0) list.splice(i, 1)
}
async function addSubItem(group) {
  if (group.key === 'cities') {
    const result = await selectCities({ selected: sub.cities, max: 0, title: '订阅城市' })
    if (result !== null) sub.cities = result
    return
  }
  // 还没选岗位大类时，把四个大类也放进可选项；大类只能选一个
  const kinds = sub.jobType ? [] : JOB_TYPE_CODES.map(c => JOB_TYPE_NAMES[c])
  const pool = (sub.jobType === 'online' ? ONLINE_TYPES : TYPES).filter(t => t !== '其他')
  const list = [...kinds, ...pool.filter(x => !sub.types.includes(x))]
  if (!list.length) return
  const i = await pickPaged(list, '添加订阅类型')
  if (i < 0) return
  if (i < kinds.length) sub.jobType = JOB_TYPE_CODES[i]
  else sub.types.push(list[i])
}
const subFromLabel = computed(() => (sub.fromDate ? `${sub.fromDate} 及以后` : '不限'))
const pickSubFrom = () => { fromPick.value = 'sub' }
const wxTip = () => toast('微信订阅消息需要平台在微信后台配置模板，配置前提醒都发到消息中心')
// 保存订阅要等服务端返回：连点会建两条一样的订阅
const currentSubId = ref(null)
const subLoading = ref(false)
const subLoadError = ref('')
const subNeedsLogin = ref(false)
const retrySubscription = () => subNeedsLogin.value ? go(R.login) : loadCurrentSubscription()
const subExtras = ref({})
// 2026-11-03 主人：订阅每人只能写一条，剩下的都是修改「当前订阅」。不管从哪进来（列表铃铛、筛选结果「订阅新机会」、城市负责人卡片），
// 都先查有没有：有就进编辑那一条（保存走修改，不会新建第二条）；老数据有好几条时取生效中最新的一条（和服务端同一口径，见 subscription-model）
const expectCurrent = ref(false)
let addCity = ''
async function loadCurrentSubscription() {
  subLoading.value = true; subLoadError.value = ''; subNeedsLogin.value = false
  try {
    const row = currentJobSubscription((await apiJobSubs()).data || [])
    currentSubId.value = row?.subId || null
    subExtras.value = {}
    if (row) {
      const types = splitSubscription(row.jobTypes)
      sub.cities = splitSubscription(row.cities)
      sub.jobType = types.find(isJobType) || ''
      sub.types = types.filter(x => x !== sub.jobType)
      sub.fromDate = row.fromDate ? String(row.fromDate).slice(0, 10) : ''
      sub.minMatch = Number(row.minMatch) || 70; sub.freq = row.freq || 'instant'
      subExtras.value = { keyword: row.keyword || '', storeId: row.storeId || undefined }
    }
    // 要加的城市：新建时预选它；已有订阅且限定了城市时加进去（不限城市的已经包含它，不去收窄）；线上任务不分城市
    if (addCity && sub.jobType !== 'online' && (!row || sub.cities.length) && !sub.cities.includes(addCity)) {
      sub.cities = [...sub.cities, addCity]
      if (row) toast(`已把「${addCity}」加进当前订阅，点「保存修改」生效`)
    }
  } catch (e) { subNeedsLogin.value = Number(e?.code) === 401; subLoadError.value = subNeedsLogin.value ? '登录后可设置当前订阅' : errText(e, '订阅加载失败') }
  finally { subLoading.value = false }
}
const savingSub = ref(false)
async function saveSub() {
  if (savingSub.value || subLoading.value || subLoadError.value) return
  savingSub.value = true
  try {
    const payload = { ...subExtras.value, cities: sub.jobType === 'online' ? [] : sub.cities, jobTypes: [...(sub.jobType ? [sub.jobType] : []), ...sub.types], fromDate: sub.jobType === 'online' ? undefined : (sub.fromDate || undefined), minMatch: sub.minMatch, freq: sub.freq }
    const r = (await (currentSubId.value ? apiEditJobSub(currentSubId.value, payload) : apiAddJobSub(payload))).data
    currentSubId.value = r.subId
    toast((r && r.message) || '订阅已保存')
    setTimeout(() => (subFrom && res.value.total ? (s.value = 3) : back()), 800)
  } catch (e) {
    toast(errText(e, '订阅失败'))
  } finally {
    savingSub.value = false
  }
}

// ---------------- s=3 / s=4 ----------------
const HOUR_LABEL = { 4: '4小时内', 6: '6小时内', 8: '8小时内', 99: '8小时以上' }
const chips = computed(() => tabMode.value ? [
  ...f.cities.map(c => ({ label: c + ' ×', drop: () => f.cities.splice(f.cities.indexOf(c), 1) })),
  { label: JOB_TYPE_NAMES[f.jobType] + ' ×', drop: () => { f.jobType = '' } },
  // 兼职 / 全职自己的条件（食宿 / 日薪 / 月薪 / 类型），文字和列表页胶囊一样
  ...filterChips(f.jobType, { ...tf, cities: [] }).map(c => ({ label: c.text + ' ×', drop: () => dropTabChip(tf, c.key) }))
] : [
  ...(isOnline.value ? [] : f.cities.map(c => ({ label: c + ' ×', drop: () => f.cities.splice(f.cities.indexOf(c), 1) }))),
  ...(!isOnline.value && f.fromDate ? [{ label: `可到岗 ${f.fromDate.slice(5)} 以后 ×`, drop: () => { f.fromDate = '' } }] : []),
  ...(f.jobType ? [{ label: JOB_TYPE_NAMES[f.jobType] + ' ×', drop: () => { f.jobType = '' } }] : []),
  ...f.types.map(t => ({ label: t + ' ×', drop: () => f.types.splice(f.types.indexOf(t), 1) })),
  ...(f.jobType === 'volunteer' ? f.kinds : []).map(v => ({ label: kindLabelOf(v) + ' ×', drop: () => f.kinds.splice(f.kinds.indexOf(v), 1) })),
  ...(!isOnline.value && f.minStay ? [{ label: STAY_LABEL[f.minStay] + ' ×', drop: () => { f.minStay = 0 } }] : []),
  ...(!isOnline.value && f.hours ? [{ label: HOUR_LABEL[f.hours] + ' ×', drop: () => { f.hours = 0 } }] : []),
  ...(!isOnline.value && BOARD.indexOf(f.board) > 0 ? [{ label: BOARD_LABEL[BOARD.indexOf(f.board)] + ' ×', drop: () => { f.board = 'none' } }] : []),
  // 能待多久、食宿和「更多」里的三个开关之前不列在这里：选了看不出来，也没法在结果页去掉
  ...(f.safe && f.insured ? [{ label: '经袋鼠实地拍摄并含保险 ×', drop: () => { f.safe = false; f.insured = false } }] : []),
  ...(f.safe && !f.insured ? [{ label: '安心商家 ×', drop: () => { f.safe = false } }] : []),
  ...(f.insured && !f.safe ? [{ label: '含保险 ×', drop: () => { f.insured = false } }] : []),
  ...(!isOnline.value && f.monthBonus ? [{ label: '满月红包 ×', drop: () => { f.monthBonus = false } }] : [])
])
const dropChip = (c) => { c.drop(); setTimeout(() => runSearch(true), 450) }
const titleKinds = computed(() => (f.jobType === 'volunteer' && f.kinds.length ? f.kinds.map(kindLabelOf) : f.types))
const title = computed(() => isOnline.value ? '线上任务 · 全国' : `${titleKinds.value.length ? titleKinds.value[0] : (JOB_TYPE_NAMES[f.jobType] || '全部岗位')}${titleKinds.value.length > 1 ? '等' : ''} · ${f.cities[0] || '全部城市'}${f.cities.length > 1 ? '等 ' + f.cities.length + ' 城' : ''}`)
const favs = ref({})
watch(() => res.value.jobs, (list) => {
  const m = {}
  ;(list || []).forEach((j) => { m[j.jobId] = !!j.favorite })
  favs.value = m
}, { immediate: true })
const jobs = computed(() => (res.value.jobs || []).map((j, i) => ({
  // 换工类型（如「摄影换工」）放在标签最前面
  ...j, image: j.cover ? absUrl(j.cover) : '/static/media/cover-empty.png', tags: [...new Set([...(j.workKindLabel ? [j.workKindLabel] : []), ...(j.tags || [])])].slice(0, 3),
  // 门店已认证并且含保险：封面挂「经袋鼠实地拍摄并含保险」，底行就不再重复写；只有一样时照旧写在底行
  assured: j.jobType !== 'online' && !!j.safe && !!j.insured,
  badge: [j.safe && !j.insured ? '安心商家' : '', j.insured && !j.safe ? '含保险' : '', j.monthRedpacket ? '满月红包' : ''].filter(Boolean).join(' · ') || (j.board || '以岗位详情为准')
})))
const openJob = (j) => go(R.jobDetail + '?jobId=' + j.jobId)
async function star(j) {
  const on = !favs.value[j.jobId]
  try {
    await apiToggleFavorite(j.jobId, on)
    favs.value = { ...favs.value, [j.jobId]: on }
    toast(on ? '已收藏' : '已取消收藏')
  } catch (e) {
    toast(errText(e, '收藏失败'))
  }
}
const conflicts = computed(() => res.value.conflicts || [])
const relax = computed(() => res.value.relax || [])
function applyRelax(r) {
  if (r.key === 'fromDate') f.fromDate = ''
  if (r.key === 'minStay') f.minStay = 0
  if (r.key === 'hours') f.hours = 0
  if (r.key === 'monthBonus') f.monthBonus = false
  if (r.key === 'board') { f.board = 'none'; tf.board = '' }
  if (r.key === 'payBand') { tf.payDay = 0; tf.payMonth = 0 }
  if (r.key === 'categories') tf.categories = []
  setTimeout(() => runSearch(true), 450)
}
// 「联系袋鼠小院」：AI袋鼠在本页底部弹出（之前跳到城市页的客服屏）
const contact = () => { aiOpen.value = true }
</script>

<style scoped lang="scss">
.nationwide-note { display: block; color: var(--k-green); font-size: 14px; line-height: 1.6; margin: 4px 0 14px; }
/* 「重置」挪到底栏、主按钮左边（像爱彼迎筛选页的「清除全部 | 显示 N 个结果」）。之前放在顶栏右边：小程序里右侧插槽要给胶囊让位往左推，
   标题又是绝对定位居中，320 宽的手机上「筛选条件」直接压在「重置」上。
   用行高居中、不用 flex：flex 容器里的文字成了独立的块，外层写的下划线画不到它身上 */
.foot-reset { flex: 0 0 auto; height: 44px; line-height: 44px; padding: 0 6px; font-size: 15px; font-weight: 600; text-decoration: underline; }
.foot-main { flex: 1; min-width: 0; }
/* 一屏放下（2026-10-16）：一张白底卡片，各组之间一条分隔线；每组 = 18px 标题行 + 一行 30px 胶囊，「更多」标题和胶囊同一行。
   H5 按刘海屏量：375×667 顶栏（88）和底栏（72 + 底部安全区 34）之间约 470px，320×640 约 440px，这里排下来约 438px，两种都不用滚。
   之前每组一张卡片、一行 3 个 34px 的格子，加上期望薪资和两行开关，要往下滑两屏才看得到「含保险」。
   底部留白正好等于底栏高度：多留一点整页就能上下滑一小截 */
.filter-body { padding: 2px 14px calc(72px + var(--k-safe-bottom)); }
/* 10-19 和列表页的筛选面板同一套视觉（参考图「换宿旅行列表与筛选」）：暖米渐变底、白卡暖阴影、没选浅灰米底、选中浅橙底橙棕描边 */
.filter-page { --k-bg: #F7EFE6; background: linear-gradient(180deg, #F7EFE6 0%, #FBF7F1 360px, #FBF7F1 100%); }
.sheet { padding: 0 12px; border-radius: 18px; background: var(--k-paper); box-shadow: 0 8px 24px rgba(120, 84, 48, .08), 0 0 0 1px rgba(160, 120, 80, .1); }
.sec { padding: 6px 0; border-bottom: 1px solid var(--k-line); }
.sec:last-child { border-bottom: 0; }
.sec-head { height: 18px; display: flex; align-items: center; justify-content: space-between; }
.sec-head__title { font-size: 14px; font-weight: 700; line-height: 18px; color: #3B2A1E; }
.sec-head__meta { min-width: 0; height: 18px; display: flex; align-items: center; gap: 2px; }
/* 订阅屏的标题行仍用 filter-head */
.filter-head { min-height: 24px; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; }
.filter-head__meta { color: var(--k-muted); font-size: 12px; font-weight: 400; white-space: nowrap; }
.sec--line { height: 31px; padding: 0; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; }
.sec--more { display: flex; align-items: center; gap: 10px; }
.sec--more .pills { flex: 1; min-width: 0; margin-top: 0; }
.sec-line__value { font-size: 13px; color: var(--k-ink2); }
.pills { display: grid; gap: 5px; margin-top: 5px; }
.pills--5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.pills--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pills--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.pills--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.pills--assure { grid-template-columns: minmax(0, 1fr) auto; }
.pill { height: 30px; min-width: 0; box-sizing: border-box; padding: 0 2px; border: 1px solid transparent; border-radius: 999px; background: #F4F1EC; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #3A322B; white-space: nowrap; overflow: hidden; }
.pill--assured { gap: 4px; padding: 0 10px 0 8px; }
.pill__icon { flex: 0 0 auto; width: 15px; height: 16px; }
.pills--assure .pill:last-child { padding: 0 12px; }
/* 320 宽：「经袋鼠实地拍摄并含保险」11 个字写全，字号小一号 */
@media (max-width: 359px) { .pill--assured { padding: 0 6px 0 5px; font-size: 12px; } .pills--assure .pill:last-child { padding: 0 9px; font-size: 12px; } }
/* 320 宽一行 5 个胶囊每个只有约 45px，「西双版纳」这类四个字的城市名放不下：窄屏字号小一点，还放不下就省略号，不硬裁 */
.pill text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 359px) { .pills--5 .pill { padding: 0 1px; font-size: 12px; } }
.pill.on { border-color: #E0A86E; color: #A0632E; background: #FCEBD7; font-weight: 700; }
/* 320×640 量出来卡片底边比底栏上沿低 18px，最后一组「安心保障」被底栏压住、整页要滑一下：
   ≤360 宽每组上下各收 2px、胶囊矮 2px、间距 4px，卡片短约 45px，一屏放得下 */
@media (max-width: 360px) {
  .sec { padding: 4px 0; }
  .sec--line { padding: 0; }
  .pills { gap: 4px; margin-top: 4px; }
  .pill { height: 28px; }
}
.subscribe-body { position: relative; min-height: calc(100vh - 88px); padding: 8px 14px calc(18px + var(--k-safe-bottom)); }
.subscribe-card, .subscribe-line, .match-slider, .message-switch, .frequency { padding: 14px; margin-bottom: 12px; border-radius: 18px; background: var(--k-paper); box-shadow: 0 8px 24px rgba(120, 84, 48, .08), 0 0 0 1px rgba(160, 120, 80, .1); }
.subscribe-card__hint { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.selected-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.selected-chip { height: 31px; padding: 0 12px; border-radius: 16px; background: var(--k-paper2); color: var(--k-ink2); display: flex; align-items: center; gap: 8px; font-size: 12px; }
.subscribe-line { height: 55px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 700; }
.slider { position: relative; height: 58px; margin-top: 12px; }
.slider::before { content: ''; position: absolute; left: 0; right: 0; top: 16px; height: 4px; border-radius: 2px; background: var(--k-line); }
.slider__active { position: absolute; left: 0; width: 56%; top: 16px; height: 4px; background: var(--k-green); }
.slider__knob { position: absolute; left: 56%; top: 10px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; border: 2px solid var(--k-green); background: var(--k-paper); }
.slider__knob text { position: absolute; left: 50%; bottom: 17px; transform: translateX(-50%); padding: 3px 6px; border-radius: 5px; color: #fff; background: var(--k-green); font-size: 11px; white-space: nowrap; }
.slider__mark { position: relative; z-index: 2; float: left; width: 20%; padding-top: 33px; color: var(--k-muted); font-size: 10px; }
.message-switch { display: flex; align-items: center; justify-content: space-between; }
.message-switch__title { display: block; font-size: 14px; font-weight: 700; }
.message-switch__sub { display: block; margin-top: 4px; color: var(--k-muted); font-size: 10px; }
.frequency__choices { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 20px; margin-top: 14px; }
.frequency__item { display: flex; align-items: flex-start; gap: 8px; }
.frequency__item text { display: block; font-size: 12px; }
.frequency__item text + text { margin-top: 5px; color: var(--k-muted); font-size: 10px; }
.save-button { margin-top: 18px; }
.manage-note { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--k-muted); font-size: 11px; }
.result-body { position: relative; min-height: calc(100vh - 88px); padding: 8px 14px calc(22px + var(--k-safe-bottom)); }
/* 已选条件：之前一行放不下的直接被裁掉看不见，现在自动换行 */
.chosen { display: flex; flex-wrap: wrap; gap: 6px; }
.chosen view { height: 30px; max-width: 100%; box-sizing: border-box; padding: 0 11px; border-radius: 15px; background: var(--k-paper2); color: var(--k-red-deep); display: flex; align-items: center; gap: 3px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 0 auto; }
.result-count { display: block; margin: 16px 2px 10px; font-size: 13px; }
.job-card { position: relative; min-height: 132px; margin-bottom: 12px; display: flex; overflow: hidden; border-radius: var(--k-radius); background: var(--k-paper); box-shadow: var(--k-sh1); }
/* 封面 100px 宽：左上角放得下两行的「经袋鼠实地拍摄并含保险」角标，不压标题 */
.job-card__cover { position: relative; flex: 0 0 auto; width: 100px; }
.job-card__image { width: 100px; height: 100%; min-height: 132px; }
.job-card__badge { position: absolute; left: 4px; top: 6px; }
.job-card__copy { flex: 1; min-width: 0; padding: 11px 10px; }
.job-card__title { flex: 1; min-width: 0; font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.job-card__tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; padding-right: 22px; }
.job-card__meta { display: flex; align-items: center; gap: 5px; margin-top: 7px; color: var(--k-muted); font-size: 10px; }
.job-card__bottom { display: flex; align-items: flex-end; justify-content: space-between; gap: 6px; margin-top: 7px; padding-right: 30px; color: var(--k-muted); font-size: 10px; }
/* 右下角收藏星标是绝对定位的：底行给它让出位置，否则星标压在「元/天」上 */
.job-card__price { flex: 0 0 auto; white-space: nowrap; }
.job-card__price { color: var(--k-red); }
.job-card__price .k-price { margin-right: 3px; }
.job-card__star { position: absolute; right: 10px; bottom: 10px; }
.skeleton { height: 120px; padding: 12px; display: flex; gap: 12px; border-radius: var(--k-radius); background: var(--k-paper); }
.skeleton__image { width: 84px; border-radius: 8px; background: var(--k-paper2); }
.skeleton__lines { flex: 1; padding-top: 4px; }
.skeleton__line { height: 12px; margin-bottom: 12px; border-radius: 6px; background: var(--k-paper2); width: 80%; }
.skeleton__line.is-long { width: 72%; } .skeleton__line.is-short { width: 36%; } .skeleton__line.is-mid { width: 60%; }
.loading { margin-top: 18px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--k-muted); font-size: 12px; }
.loading__spinner { width: 20px; height: 20px; border: 3px dotted var(--k-red); border-radius: 50%; }
.empty-body { position: relative; min-height: calc(100vh - 88px); padding: 8px 14px calc(18px + var(--k-safe-bottom)); }
.empty-image { width: 160px; height: 160px; margin: 48px auto 0; }
.empty-title { display: block; margin-top: 6px; text-align: center; font-size: 20px; font-weight: 700; }
.empty-desc { display: block; margin-top: 8px; text-align: center; color: var(--k-muted); font-size: 12px; }
.conflict, .suggestions { margin-top: 14px; padding: 14px; border-radius: var(--k-radius); background: var(--k-paper); box-shadow: var(--k-sh1); display: flex; flex-direction: column; gap: 9px; font-size: 12px; }
.conflict__title { font-size: 15px; font-weight: 700; }
.suggestion { min-height: 32px; display: flex; align-items: center; justify-content: space-between; color: var(--k-muted); }
.adjust { margin-top: 14px; }
.subscribe-btn { margin-top: 10px; }
.service { height: 48px; margin-top: 10px; border-radius: var(--k-radius); background: var(--k-paper); box-shadow: var(--k-sh1); display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; }
@import "flow-premium.scss";
</style>
