<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <k-feature-gate feature="recruitment">
  <view class="k-page filter-page" :class="$userSurface">
    <template v-if="s === 1">
      <k-topbar title="筛选条件" back custom-back @back="back" />
    <k-subscribe scenes="job_new" label="订阅新机会提醒" />
      <!-- 一张白底卡片、分隔线隔开（2026-10-16）：每组一行标题 + 一行胶囊；换工类型三列两行；
           「最低在店时长」和岗位列表的筛选面板同一组选项（最少一周 / 半个月 / 20天 / 一个月）；
           「安心保障」= 经袋鼠实地拍摄并含保险（门店已认证 + 岗位含保险，和列表同一口径），另有满月红包；线上任务没有这一组。期望薪资不再提供（老版本小程序传了后端照样认） -->
      <view class="filter-body">
        <text v-if="isOnline" class="nationwide-note">线上任务全国可接，无需选择城市</text>
        <view class="sheet">
          <view v-if="!isOnline" class="sec"><view class="sec-head"><text class="sec-head__title">城市</text><view class="sec-head__meta" hover-class="k-press" @click="pickMoreCity"><text class="filter-head__meta">{{ cityMeta }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><view class="pills pills--5"><view v-for="item in cityOptions" :key="item" class="pill" hover-class="k-press-s" :class="{ on: f.cities.includes(item), 'pill--more': item === '更多' }" @click="tapCity(item)"><text>{{ item }}</text><k-icon v-if="item === '更多'" name="chevron-down" :size="12" color="red" /></view></view></view>
          <view v-if="!isOnline && !tabMode" class="sec sec--line" hover-class="k-press" @click="pickFrom"><text class="sec-head__title">可到岗日期</text><view class="sec-head__meta"><text class="sec-line__value">{{ fromLabel }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view>
          <view v-for="group in filterGroups" :key="group.title" class="sec"><view class="sec-head"><text class="sec-head__title">{{ group.title }}</text><view v-if="group.meta" class="sec-head__meta" hover-class="k-press" @click="tapGroupMeta(group)"><text class="filter-head__meta">{{ group.meta }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><view class="pills" :class="'pills--' + (group.cols || 5)"><view v-for="(item,i) in group.options" :key="item" class="pill" hover-class="k-press-s" :class="{ on: isSelected(group.selected, i) }" @click="tapOption(group, i)"><text>{{ item }}</text></view></view></view>
          <view v-if="!isOnline && !tabMode" class="sec"><view class="sec-head"><text class="sec-head__title">安心保障</text></view><view class="pills pills--assure"><view class="pill pill--assured" hover-class="k-press-s" :class="{ on: f.safe && f.insured }" @click="toggleAssured"><k-icon name="shield-check" :size="14" :color="f.safe && f.insured ? 'green' : 'red'" /><text>经袋鼠实地拍摄并含保险</text></view><view class="pill" hover-class="k-press-s" :class="{ on: f.monthBonus }" @click="f.monthBonus = !f.monthBonus"><text>满月红包</text></view></view></view>
        </view>
      </view>
      <k-bottom><view class="foot-reset" hover-class="k-press" @click="reset"><text>重置</text></view><view class="foot-main"><k-button block @click="runSearch(true)">{{ countLabel }}</k-button></view></k-bottom>
    </template>

    <template v-else-if="s === 2">
      <k-topbar :title="currentSubId || (subLoading && expectCurrent) ? '当前订阅' : '新机会订阅'" back custom-back @back="subBack" />
      <view class="subscribe-body k-pad-safe">
        <text v-if="sub.jobType === 'online'" class="nationwide-note">接收全国线上任务提醒，不限所在城市</text>
        <view class="sub-group"><view v-for="group in subscriptionGroups" :key="group.title" class="subscribe-card"><view class="filter-head"><view class="k-row k-gap8"><k-icon :name="group.icon" :size="18" color="ink2" /><text>{{ group.title }}</text><text class="subscribe-card__hint">{{ group.hint }}</text></view><view class="k-row k-gap4" hover-class="k-press" @click="addSubItem(group)"><text class="filter-head__meta">已选 {{ group.items.length }} 个</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><view class="selected-row"><view v-for="item in group.items" :key="item" class="selected-chip" hover-class="k-press-s" @click="removeSubItem(group, item)"><text>{{ item }}</text><k-icon name="x" :size="12" color="muted" /></view><view class="selected-chip selected-chip--add" hover-class="k-press-s" @click="addSubItem(group)"><k-icon name="plus" :size="12" color="red" /><text>{{ group.add }}</text></view></view></view>
        <view v-if="sub.jobType !== 'online'" class="subscribe-line" hover-class="k-press" @click="pickSubFrom"><view class="k-row k-gap10"><k-icon name="calendar-days" :size="18" color="ink2" /><text>可到岗日期</text></view><view class="k-row k-gap6"><text>{{ subFromLabel }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view></view>
        <view class="sub-group"><view class="match-slider"><view class="k-row k-gap10"><k-icon name="target" :size="18" color="ink2" /><text>最低匹配度</text></view><view class="slider"><view class="slider__active" :style="{ width: matchPos }" /><view class="slider__knob" :style="{ left: matchPos }"><text>{{ sub.minMatch }}%</text></view><view v-for="n in [60,70,80,90,95]" :key="n" class="slider__mark" hover-class="k-press" @click="sub.minMatch = n"><view /><text>{{ n }}%</text></view></view></view>
        <view class="message-switch"><view class="k-row k-gap10"><k-icon name="bell" :size="18" color="ink2" /><view><text class="message-switch__title">微信订阅消息</text><text class="message-switch__sub">统一管理本端的微信提醒</text></view></view><view class="k-switch" hover-class="k-press" @click="wxTip" /></view>
        <view class="frequency"><view class="k-row k-gap10"><k-icon name="list-checks" :size="18" color="ink2" /><text>推送频率</text></view><view class="frequency__choices"><view class="frequency__item" hover-class="k-press" @click="sub.freq = 'instant'"><k-icon name="circle" :art="sub.freq === 'instant' ? 'radio-on' : 'circle'" :size="18" /><view><text>即时推送</text><text>有新机会立即通知你</text></view></view><view class="frequency__item" hover-class="k-press" @click="sub.freq = 'daily'"><k-icon name="circle" :art="sub.freq === 'daily' ? 'radio-on' : 'circle'" :size="18" /><view><text>每日汇总</text><text>每天上午 9:00 汇总推送</text></view></view></view></view></view>
        <view v-if="subLoadError" class="manage-note" @click="retrySubscription"><text>{{ subLoadError }}，{{ subNeedsLogin ? '点击登录' : '点击重试' }}</text></view><k-bottom flat pad="8px 12px"><view class="k-flex1 save-button"><view class="manage-note manage-note--bar"><k-icon name="lock-keyhole" :size="14" color="muted" /><text>有新机会时通过消息中心通知你，可在「我的 → 设置 → 通知管理」里暂停</text></view><k-button block :disabled="savingSub || subLoading || !!subLoadError" :label="savingSub ? '保存中…' : subLoading ? '加载中…' : currentSubId ? '保存修改' : '保存订阅'" @click="saveSub" /></view></k-bottom><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else-if="s === 3">
      <k-topbar :title="title" back custom-back @back="s = 1" />
      <view class="result-body k-pad-safe">
        <view class="chosen-wrap"><view class="chosen"><view hover-class="k-press" @click="s = 1"><k-icon name="filter" :size="14" color="red" /><text>筛选</text></view><view v-for="item in chips" :key="item.label" hover-class="k-press" @click="dropChip(item)"><text>{{ item.label.slice(0, -2) }}</text><k-icon name="x" :size="12" color="red" /></view></view></view>
        <text class="result-count">共 {{ res.total || 0 }} 个机会</text>
        <view v-for="job in jobs" :key="job.jobId" class="job-card" hover-class="k-press-s" @click="openJob(job)"><view class="job-card__cover"><image class="job-card__image" :src="job.image" mode="aspectFill" /></view><view class="job-card__copy"><view class="k-between"><text class="job-card__title">{{ job.title }}</text></view><view class="job-card__tags"><view v-if="job.assured" class="job-card__badge"><k-icon name="shield-check" :size="12" color="green" /><job-badge size="card" /></view><k-chip v-if="job.match" tone="green"><text>{{ job.match }}%匹配</text></k-chip><k-chip v-for="tag in job.tags" :key="tag"><text>{{ tag }}</text></k-chip></view><view v-if="job.place" class="job-card__meta"><k-icon name="store" :size="12" color="light" /><text>{{ job.place }}</text></view><view v-if="job.date" class="job-card__meta"><k-icon name="map-pin" :size="12" color="light" /><text>{{ job.date }}</text></view><view class="job-card__bottom"><view class="k-row k-gap4"><k-icon :name="job.badge.includes('安心') || job.badge.includes('保险') ? 'shield-check' : job.badge.includes('红包') ? 'gift' : job.badge.includes('食') || job.badge.includes('住') ? 'utensils' : 'info'" :size="14" :color="job.badge.includes('安心') || job.badge.includes('保险') ? 'green' : 'muted'" /><text>{{ job.badge }}</text></view><view class="job-card__price" :class="{ 'job-card__price--word': isNaN(parseFloat(job.price)) }"><text class="k-price">{{ job.price }}</text><text>{{ job.unit }}</text></view></view></view><view class="job-card__star" @click.stop><k-icon name="star" :size="16" :color="favs[job.jobId] ? 'red' : 'ink2'" @click="star(job)" /></view></view>
        <view v-if="counting" class="skeleton"><view class="skeleton__image" /><view class="skeleton__lines"><view class="skeleton__line is-long" /><view class="skeleton__line is-short" /><view class="skeleton__line" /><view class="skeleton__line is-mid" /></view></view>
        <view v-if="counting" class="loading"><view class="loading__spinner"><k-icon name="loader-circle" :size="20" color="red" /></view><text>正在加载...</text></view><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else>
      <k-topbar :title="title" back custom-back @back="s = 1" />
      <view class="empty-body k-pad-safe" :class="{ 'empty-body--bare': !conflicts.length && !relax.length }">
        <view class="chosen-wrap"><view class="chosen"><view hover-class="k-press" @click="s = 1"><k-icon name="filter" :size="14" color="red" /><text>筛选</text></view><view v-for="item in chips" :key="item.label" hover-class="k-press" @click="dropChip(item)"><text>{{ item.label.slice(0, -2) }}</text><k-icon name="x" :size="12" color="red" /></view></view></view>
        <view class="empty-image empty-icon"><k-icon name="search" :size="32" color="muted" /></view>
        <text class="empty-title">没有符合条件的机会</text><text class="empty-desc">当前筛选条件过于严格，或时间与部分机会冲突</text>
        <!-- 第三轮（11-18）：「条件冲突」「放宽建议」合成一张白卡、两段列表（返修 5：和改前一样总是显示，不另加显示条件） -->
        <view class="advice">
          <view class="conflict"><text class="conflict__title">条件冲突</text><text v-if="conflicts[0]">· {{ conflicts[0] }}</text><text v-if="conflicts[1]">· {{ conflicts[1] }}</text></view>
          <view class="suggestions"><text class="conflict__title">放宽建议（共 {{ relax.length }} 条）</text><view v-for="item in relax" :key="item.key" class="suggestion"><text>{{ item.label }}</text><k-button type="outline" size="xs" @click="applyRelax(item)">调整</k-button></view></view>
        </view>
        <view class="adjust-wrap"><k-button block class="adjust" @click="s = 1">调整筛选</k-button></view><view class="subscribe-wrap"><k-button type="outline" block class="subscribe-btn" @click="openSubscribe"><k-icon name="bell" :size="14" color="red" /><text>订阅新机会</text></k-button></view><view class="service" hover-class="k-press-s" @click="contact"><k-icon name="headphones" :size="14" color="muted" /><text>联系袋鼠全球青年（工作日 9:00-18:00）</text></view><view class="k-home-indicator" />
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
const JOB_TYPE_NAMES = { volunteer: '换工旅行', parttime: '兼职旅行', fulltime: '全职旅行', online: '线上任务' }
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
const wxTip = () => go('/pages/profile/subscriptions')
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
.loading__spinner { display: flex; animation: filter-loading .9s linear infinite; }
@keyframes filter-loading { to { transform: rotate(360deg); } }
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
/* ==== r3jobsb 第三轮 start ==== */
/* 第三轮（11-18 主人：每页抠到最精致）——只管本页，放在 flow-premium 后面盖过去。
   s=1 筛选：原来七组挤在上半屏（每组上下 6、标题到胶囊 5、胶囊间 5）、底下空 1/4 屏、分隔线时有时无。
   改成页边距 16、卡内 16；每组上下 14、标题 15/600、标题到胶囊 12、胶囊 32 高全圆角、间距 8；组与组之间一条发丝线（伪元素画，每条都看得见）。 */
.filter-page .filter-body { padding: 8px 16px calc(88px + var(--k-safe-bottom)); }
.filter-page :deep(.subscribe-entry) { padding: 8px 16px 0; }
.filter-page :deep(.subscribe-entry button) { min-height: 40px; border-radius: 12px; font-size: 13px; font-weight: 500; }
.filter-page .nationwide-note { margin: 4px 4px 12px; font-size: 12px; line-height: 1.6; }
.filter-page .sheet { padding: 0 16px; border-radius: 12px; }
.filter-page .sec { position: relative; padding: 14px 0; background-image: none; }
.filter-page .sec + .sec::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.filter-page .sec-head { height: 20px; }
.filter-page .sec-head__title { font-size: 15px; font-weight: 600; line-height: 20px; color: var(--k-ink); }
.filter-page .sec-head__meta { height: 20px; gap: 4px; }
.filter-page .filter-head__meta { font-size: 12px; color: var(--k-muted); }
.filter-page .sec--line { height: 52px; padding: 0; }
.filter-page .sec-line__value { font-size: 13px; color: var(--k-ink2); }
.filter-page .pills { gap: 8px; margin-top: 12px; }
.filter-page .pill { height: 32px; padding: 0 4px; border: 1px solid transparent; border-radius: 16px; background: var(--k-fill); font-size: 13px; font-weight: 400; color: var(--k-ink2); }
.filter-page .pill.on { border-color: var(--k-red-line); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 500; }
.filter-page .pill--assured { gap: 4px; padding: 0 12px; }
.filter-page .pill__icon { width: 14px; height: 14px; }
.filter-page .pills--assure .pill:last-child { padding: 0 16px; }
/* 「重置」：检查钉着下划线；做细——14 / 500 墨色字，下划线是浅灰细线、离字 4 */
.filter-page .foot-reset { padding: 0 16px 0 4px; font-size: 14px; font-weight: 500; color: var(--k-ink); text-decoration-color: var(--k-line2); text-decoration-thickness: 1px; text-underline-offset: 5px; }

/* s=2 订阅：滑块右边原来钻到「客服」小钮底下（95% 被盖一半），实心深棕气泡太重 */
.filter-page .match-slider { padding-right: 32px; }
.filter-page .slider { margin-left: 8px; margin-top: 32px; height: 52px; }
.filter-page .slider__knob { width: 16px; height: 16px; margin-left: -8px; top: 9px; box-sizing: border-box; }
.filter-page .slider__knob text { bottom: 22px; height: 20px; padding: 0 8px; border-radius: 10px; background: var(--k-paper); box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-size: 12px; font-weight: 600; line-height: 20px; font-variant-numeric: tabular-nums; }
.filter-page .slider__mark { font-size: 11px; font-variant-numeric: tabular-nums; }

.filter-page .subscribe-card__hint { margin-left: -2px; font-size: 12px; }
.filter-page .selected-row { margin-top: 8px; }
.filter-page .selected-chip { color: var(--k-ink2); }
.filter-page .manage-note { gap: 4px; margin-top: 12px; padding: 0 8px; align-items: flex-start; line-height: 1.6; }
.filter-page .manage-note :deep(.k-icon) { flex: 0 0 auto; margin-top: 2px; }

/* s=3 结果：已选条件胶囊的「×」换成图标后，字和图标隔 4；角标挪到封面底部，黑色渐变托住白字，不再盖住照片上半截 */
.filter-page .chosen view { gap: 4px; }
.filter-page .result-count { margin: 12px 4px 8px; }
.filter-page .job-card__badge { left: 0; right: 0; top: auto; bottom: 0; padding: 20px 6px 6px; }
.filter-page .job-card__badge :deep(.jb--card) { padding: 0; border-radius: 0; background: transparent; box-shadow: none; color: var(--k-paper); }
.filter-page .job-card__badge :deep(.jb--card .jb__text) { font-size: 10px; font-weight: 500; line-height: 13px; color: var(--k-paper); }
.filter-page .job-card__copy { padding: 10px 12px 10px 10px; }
.filter-page .job-card__title { font-size: 14px; font-weight: 600; line-height: 20px; }
/* 卡片行内小图标直接写 :size="12"（返修 3 删掉 :deep 压尺寸） */
.filter-page .job-card__meta { gap: 4px; }
.filter-page .job-card__bottom { align-items: center; margin-top: 6px; }
.filter-page .job-card__price { display: flex; align-items: baseline; gap: 2px; color: var(--k-muted); font-size: 11px; }
.filter-page .job-card__price .k-price { margin-right: 0; font-size: 18px; font-weight: 700; color: var(--k-red); font-variant-numeric: tabular-nums; }
.filter-page .job-card__price--word .k-price { font-size: 13px; font-weight: 500; color: var(--k-red-deep); }
.filter-page .job-card__star { right: 10px; bottom: 10px; }

/* s=4 无结果：插画 → 标题 → 说明；有冲突 / 放宽建议时一张白卡两段列表；「调整筛选」44 主按钮；
   「订阅新机会」36 高、随字宽的次按钮小胶囊居中；「联系袋鼠全球青年」是居中的一行灰字 + 14 号耳机图标（不再是白卡） */
.filter-page .empty-image { width: 128px; height: 128px; margin-top: 40px; }
.filter-page .empty-title { margin-top: 12px; font-size: 16px; font-weight: 600; line-height: 22px; color: var(--k-ink); }
.filter-page .empty-desc { margin-top: 4px; font-size: 12px; line-height: 1.6; }
.filter-page .advice { margin-top: 20px; padding: 0 16px; border-radius: 12px; background: var(--k-paper); }
.filter-page .advice .conflict, .filter-page .advice .suggestions { position: relative; margin: 0; padding: 14px 0; gap: 6px; border-radius: 0; background: transparent; box-shadow: none; font-size: 13px; line-height: 1.6; color: var(--k-ink2); }
.filter-page .advice .conflict + .suggestions::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.filter-page .advice .conflict__title { margin-bottom: 2px; font-size: 14px; font-weight: 600; line-height: 20px; color: var(--k-ink); }
.filter-page .advice .suggestion { min-height: 36px; gap: 12px; color: var(--k-ink2); }
.filter-page .advice .suggestion > text { flex: 1; min-width: 0; }
.filter-page .advice .suggestion :deep(.k-button) { flex: 0 0 auto; height: 28px; padding: 0 12px; border-radius: 14px; border-color: var(--k-red-line); font-size: 12px; font-weight: 500; color: var(--k-red-deep); }
.filter-page .adjust { margin-top: 24px; }
.filter-page .subscribe-wrap { margin-top: 12px; display: flex; justify-content: center; }
.filter-page .subscribe-wrap :deep(.k-button) { width: auto; height: 36px; padding: 0 16px; gap: 4px; border-radius: 18px; border-color: var(--k-red-line); font-size: 13px; font-weight: 500; color: var(--k-red-deep); }

.filter-page .service { height: 32px; margin-top: 16px; gap: 4px; border-radius: 0; background: transparent; box-shadow: none; font-size: 12px; color: var(--k-muted); }

@media (max-width: 359px) {
  .filter-page .filter-body { padding-left: 12px; padding-right: 12px; }
  .filter-page :deep(.subscribe-entry) { padding-left: 12px; padding-right: 12px; }
  .filter-page .sheet { padding: 0 12px; }
  .filter-page .sec { padding: 12px 0; }
  .filter-page .sec--line { padding: 0; height: 48px; }
  .filter-page .pills { gap: 6px; margin-top: 10px; }
  .filter-page .pill { font-size: 12px; padding: 0 2px; }
  .filter-page .pill--assured { padding: 0 8px; }
  .filter-page .pills--assure .pill:last-child { padding: 0 10px; }
  /* 320 宽：结果卡封面收成 88（仍 1:1），右边文字多一点地方，标题少折一行 */
  .filter-page .job-card__cover { width: 88px; height: 88px; }
  .filter-page .job-card__image { width: 88px; height: 88px; }
  .filter-page .advice .suggestion { font-size: 12px; }
}

/* —— 返修 1（独立评审第 1 轮）—— */
/* s=1：第一屏要露出「安心保障」的胶囊——每组上下 12、标题到胶囊 10、日期行 48；「更多」不是城市，改成无底色的深棕字 + 向下小箭头；
   「经袋鼠实地拍摄」的袋鼠标没选时收成单色（和线性图标一个分量），选中才显出品牌色 */
.filter-page .sec { padding: 12px 0; }
.filter-page .pills { margin-top: 10px; }
.filter-page .sec--line { height: 48px; }
.filter-page .pill--more { gap: 2px; background: transparent; color: var(--k-red-deep); font-weight: 500; }
.filter-page .pill__icon { filter: grayscale(1); opacity: .7; }
.filter-page .pill.on .pill__icon { filter: none; opacity: 1; }
/* s=2：六张设置卡合成两张分组卡（城市 / 岗位类型 / 到岗日期；匹配度 / 微信消息 / 推送频率），卡内 16、卡间 20、行间发丝线；页边距和 s=1 一样 16；
   图标到字统一 8；铃铛对齐标题行；底部说明限宽居中 */
.filter-page .subscribe-body { padding: 8px 16px calc(24px + var(--k-safe-bottom)); }
.filter-page .sub-group { margin-bottom: 20px; padding: 0 16px; border-radius: 12px; background: var(--k-paper); }
.filter-page .sub-group > .subscribe-card, .filter-page .sub-group > .subscribe-line, .filter-page .sub-group > .match-slider, .filter-page .sub-group > .message-switch, .filter-page .sub-group > .frequency { position: relative; margin: 0; padding: 16px 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.filter-page .sub-group > .subscribe-card { padding: 14px 0 16px; }
.filter-page .sub-group > .subscribe-line { height: 52px; padding: 0; box-sizing: border-box; }
.filter-page .sub-group > view + view::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.filter-page .sub-group > .match-slider { padding-right: 24px; }
.filter-page .filter-head { min-height: 20px; }
.filter-page .subscribe-body .k-gap10 { gap: 8px; }
.filter-page .subscribe-body .k-gap8 > :deep(.k-icon), .filter-page .subscribe-body .k-gap10 > :deep(.k-icon) { flex: 0 0 auto; }
.filter-page .slider { margin-left: 12px; }
.filter-page .message-switch > .k-row { align-items: flex-start; }
.filter-page .message-switch > .k-row > :deep(.k-icon) { margin-top: 1px; }
.filter-page .message-switch__sub { padding-right: 12px; }
.filter-page .save-button { margin-top: 0; }
.filter-page .subscribe-body .manage-note { max-width: 300px; margin: 12px auto 0; }
/* s=3 / s=4：已选条件一行横向滑动，「筛选」固定排第一个，右边渐隐；页边距 16 */
.filter-page .result-body, .filter-page .empty-body { padding-left: 16px; padding-right: 16px; }
.filter-page .chosen { flex-wrap: nowrap; gap: 8px; margin-right: -16px; padding-right: 24px; overflow-x: auto; -webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent); mask-image: linear-gradient(to right, black calc(100% - 28px), transparent); }
.filter-page .chosen::-webkit-scrollbar { display: none; width: 0; height: 0; }
.filter-page .chosen view { flex: 0 0 auto; max-width: none; }
/* 结果卡：卡内 12、封面 96 方图（320 宽 84）、图文间距 12；收藏星挪到封面右上角的白色小圆里（右侧「客服」悬浮钮再也压不到它）；
   日期 / 门店行只显示一行（之前「每天 6 小 / 时」拆两行） */
.filter-page .job-card { min-height: 0; padding: 12px; gap: 12px; align-items: flex-start; }
.filter-page .job-card__cover { width: 96px; height: 96px; margin: 0; }
.filter-page .job-card__image { width: 96px; height: 96px; }
.filter-page .job-card__copy { padding: 0; }
.filter-page .job-card__tags { padding-right: 0; }
.filter-page .job-card__meta > text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.filter-page .job-card__meta :deep(.k-icon) { flex: 0 0 auto; }
.filter-page .job-card__bottom { padding-right: 0; }
.filter-page .job-card__star { left: 80px; right: auto; top: 16px; bottom: auto; width: 24px; height: 24px; border-radius: 12px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; }

/* s=4：没有冲突和建议时整组下移，「没有符合条件的机会」落在屏高约 40% 处；冲突两条悬挂缩进（圆点挂在左边，字和放宽建议对齐） */
.filter-page .empty-body--bare .empty-image { margin-top: 72px; }
.filter-page .advice .conflict > text:not(.conflict__title) { display: block; margin-left: -1.3em; padding-left: 1.3em; text-indent: -1.3em; }

@media (max-width: 359px) {
  .filter-page .subscribe-body { padding-left: 12px; padding-right: 12px; }
  .filter-page .sub-group { padding: 0 12px; }
  .filter-page .frequency__choices { grid-template-columns: minmax(0, 1fr); gap: 12px; }
  .filter-page .result-body, .filter-page .empty-body { padding-left: 12px; padding-right: 12px; }
  .filter-page .chosen { margin-right: -12px; }
  .filter-page .job-card__cover, .filter-page .job-card__image { width: 84px; height: 84px; }
  .filter-page .job-card__star { left: 68px; }
  .filter-page .advice .suggestion > text, .filter-page .advice .conflict > text:not(.conflict__title) { word-break: keep-all; overflow-wrap: anywhere; line-height: 1.5; }
}
/* —— 返修 2 start —— */
/* s=1：「订阅新机会提醒」白条和下面的筛选卡隔 12（原来 8 像粘在一起），字用深棕 */
.filter-page .filter-body { padding-top: 12px; }
.filter-page :deep(.subscribe-entry button) { color: var(--k-red-deep); }
/* 「更多 ∨」收到格子右边（和别的行胶囊右边缘同一条线），箭头和字同为暖棕 */
.filter-page .pill--more { justify-content: flex-end; padding-right: 0; }
/* 袋鼠小标不再灰掉（14px 的灰图像一块脏斑），原色 16 */
.filter-page .pill__icon { width: 16px; height: 16px; filter: none; opacity: 1; }
/* s=2：底部说明限宽 280、左对齐，锁图标顶对齐第一行，字两行均分 */
.filter-page .subscribe-body .manage-note { max-width: 280px; }
.filter-page .subscribe-body .manage-note > text { flex: 1; min-width: 0; text-wrap: balance; }
/* 「+ 添加城市 / 类型」：白底 + 虚线框 + 深棕字，一眼看出是「加」 */
.filter-page .selected-chip--add { position: relative; background: var(--k-paper) padding-box; color: var(--k-red-deep); }
.filter-page .selected-chip--add::after { content: ''; position: absolute; left: 0; top: 0; right: 0; bottom: 0; border: 1px dashed var(--k-line2); border-radius: 14px; pointer-events: none; }
/* s=3 / s=4：已选条件胶囊一律浅棕底深棕字（flow-premium 旧规则把最后一颗刷成白底墨字）；「筛选」排第一，白底深棕字做区分 */
.filter-page .chosen view:last-child { background: var(--k-red-soft) padding-box; color: var(--k-red-deep); }
.filter-page .chosen view:first-child { background: var(--k-paper) padding-box; color: var(--k-red-deep); font-weight: 500; }
/* 胶囊之间只靠 4px 透明边留出 8 的间距（原来再加 gap 8，看上去隔 16） */
.filter-page .chosen { gap: 0; }
/* 「共 15 个机会」和胶囊、结果卡左边同一条线 */
.filter-page .result-count { margin: 12px 0 8px; }
/* 封面角标：字 11/600、加一点字影；渐变只托住字那一截、颜色更浅，不再把照片下半截压暗 */
.filter-page .job-card__badge { padding: 12px 6px 6px; }
.filter-page .job-card__badge :deep(.jb--card .jb__text) { font-size: 11px; font-weight: 600; line-height: 14px; text-shadow: 0 1px 2px rgba(0, 0, 0, .35); }
/* 卡内标签 11 号（公共默认 10 低于 11 档） */
.filter-page .job-card :deep(.k-chip) { height: 18px; font-size: 11px; }
/* s=4：没有冲突和建议时整组再往下放，标题落在屏高约 45% */
.filter-page .empty-body--bare .empty-image { margin-top: 104px; }
/* 「订阅新机会」按钮里的铃铛和字隔 4 */
.filter-page .subscribe-wrap :deep(.k-button__label) { display: flex; align-items: center; gap: 4px; }
/* 冲突两条：圆点落在内容线上，折行的字缩进 12 */
.filter-page .advice .conflict > text:not(.conflict__title) { margin-left: 0; padding-left: 12px; text-indent: -12px; }
@media (max-width: 359px) {
  /* 320 宽：「调整」固定 52 宽，建议文字多一点地方，数字和量词不拆行 */
  .filter-page .advice .suggestion { gap: 8px; }
  .filter-page .advice .suggestion :deep(.k-button) { width: 52px; padding: 0; }
  .filter-page .advice .suggestion > text { text-wrap: pretty; }
}
/* —— 返修 2 end —— */
/* —— 返修 3 start（11-18 晚）—— */
/* s=1：滑到底时卡片底边和底栏之间清楚空开 24；底栏左右 16、「重置」点击区 44 宽靠左、到主按钮 12 */
.filter-page .filter-body { padding-bottom: calc(92px + var(--k-safe-bottom)); }
.filter-page :deep(.k-bottom__inner) { padding: 12px 16px !important; gap: 12px; }
.filter-page .foot-reset { min-width: 44px; padding: 0; text-align: left; }
/* 「经袋鼠实地拍摄并含保险」：线性盾牌 14、和字隔 4 */
.filter-page .pill--assured { gap: 4px; }
/* s=2：订阅说明右边只让开关 + 16，不剩两个字一行；匹配度滑块：轨道 6、圆点 20 白底暖棕边、已选段至少画到圆点中心 */
.filter-page .message-switch__sub { padding-right: 0; font-size: 12px; line-height: 18px; }
.filter-page .message-switch > .k-row { flex: 1; min-width: 0; margin-right: 16px; }
.filter-page .slider__active { top: 15px; height: 6px; border-radius: 3px; }
.filter-page .slider__knob { top: 8px; width: 20px; height: 20px; margin-left: -10px; border: 2px solid var(--k-red); background: var(--k-paper); box-shadow: 0 1px 2px rgba(0, 0, 0, .12); }
/* s=4 有冲突：横滑条右边留 16 收尾 */
.filter-page .chips-scroll, .filter-page .summary-chips { padding-right: 16px; }
/* —— 返修 3 end —— */
/* —— 返修 4 start（11-18 夜）—— */
/* s=2：保存按钮下面的说明左对齐，左边和卡片内容同一条线，锁图标跟着第一行 */
.filter-page .subscribe-body .manage-note { max-width: none; margin: 12px 16px 0; padding: 0; justify-content: flex-start; align-items: flex-start; text-align: left; }
.filter-page .subscribe-body .manage-note > text { flex: 1; min-width: 0; font-size: 12px; text-wrap: wrap; }
/* s=3：匹配度挪到标签行第一个，标题独占整行、最多两行 */
.filter-page .job-card__title { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; white-space: normal; overflow: hidden; text-overflow: clip; overflow-wrap: anywhere; }
/* 「经袋鼠实地拍摄并含保险」不再压在封面上：挪到封面正下方，两行 11/500 豆绿字（和底部「安心」同一种颜色），照片完整露出 */
.filter-page .job-card__cover { height: auto; overflow: visible; border-radius: 0; }
.filter-page .job-card__image { border-radius: 8px; background: var(--k-paper2); }
.filter-page .job-card__cover { background: none; }
.filter-page .job-card__badge { position: static; margin-top: 6px; padding: 0; background: none; }
.filter-page .job-card__badge :deep(.jb--card) { display: flex; padding: 0; border-radius: 0; background: none; box-shadow: none; }
.filter-page .job-card__badge :deep(.jb__fold), .filter-page .job-card__badge :deep(.jb__seal) { display: none; }
.filter-page .job-card__badge :deep(.jb--card .jb__text) { font-size: 11px; font-weight: 500; line-height: 16px; letter-spacing: 0; color: var(--k-green); text-shadow: none; }
/* s=3 / s=4：已选条件横滑条外面包一层定位，右边 24 渐隐到页面底色 */
.filter-page .chosen-wrap { position: relative; margin-right: -16px; }
.filter-page .chosen { margin-right: 0; -webkit-mask-image: none; mask-image: none; }
.filter-page .chosen-wrap::after { content: ''; position: absolute; top: 0; right: 0; bottom: 0; width: 24px; background: linear-gradient(to right, transparent, var(--k-page)); pointer-events: none; }
/* s=4：「放宽建议」每条前面也是和「条件冲突」一样的小圆点，两段列表同一种写法 */
.filter-page .advice .suggestion > text { position: relative; padding-left: 12px; }
.filter-page .advice .suggestion > text::before { content: ''; position: absolute; left: 2px; top: 9px; width: 3px; height: 3px; border-radius: 50%; background: var(--k-ink2); }
/* s=4 没有冲突和建议：整组上移 24，中心落在约 45% 屏高 */
.filter-page .empty-body--bare .empty-image { margin-top: 80px; }
@media (max-width: 359px) {
  .filter-page .subscribe-body .manage-note { margin-left: 12px; margin-right: 12px; }
  .filter-page .chosen-wrap { margin-right: -12px; }
  .filter-page .chosen { margin-right: 0; }
  .filter-page .advice .suggestion > text::before { top: 8px; }
  /* 320 宽：卡片里的地点 / 日期行放不下时折到第二行写全，不省略 */
  .filter-page .job-card__meta { align-items: flex-start; }
  .filter-page .job-card__meta > text { white-space: normal; overflow: visible; text-overflow: clip; line-height: 16px; }
}
/* —— 返修 4 end —— */
/* —— 返修 5 start（11-18 深夜）—— */
/* s=1：每组上下 10、标题到胶囊 8，首屏「安心保障」胶囊和底栏之间空得开 */
.filter-page .sec { padding-top: 10px; padding-bottom: 10px; }
.filter-page .sec-head { margin-bottom: 8px; }
/* s=2：匹配度轨道用深一档的线色，看得出是一条轨道；刻度点 6 */
.filter-page .slider::before { height: 4px; border-radius: 2px; background: var(--k-line2); }
/* 「所在城市 （可多选）」：全角括号自带留白，和标题只隔 2 */
.filter-page .subscribe-card__hint { margin-left: -6px; }
/* s=3：「经袋鼠实地拍摄并含保险」改成标签行里的豆绿小标签（一行写完），封面固定 96 方图 */
.filter-page .job-card__cover { height: 96px; }
.filter-page .job-card__tags > .job-card__badge { position: static; margin: 0; padding: 0 6px; height: 18px; border-radius: 4px; background: var(--k-green-soft); display: flex; align-items: center; }
.filter-page .job-card__tags > .job-card__badge :deep(.jb__lines) { flex-direction: row; }
.filter-page .job-card__tags > .job-card__badge :deep(.jb--card .jb__text) { font-size: 11px; font-weight: 500; line-height: 18px; color: var(--k-green); }
/* s=4：空状态和本组其它空状态同一种做法：56 浅棕方块 + 32 线性图标；整组上移 */
.filter-page .empty-icon { width: 56px; height: 56px; margin: 40px auto 0; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.filter-page .empty-body--bare .empty-image { margin-top: 48px; }
.filter-page .empty-title { margin-top: 16px; }
.filter-page .empty-desc { text-wrap: balance; }
/* 冲突和建议：只在空格和标点处折行、两行均分，数字和量词（「6 个」）不拆开 */
.filter-page .advice .conflict > text, .filter-page .advice .suggestion > text { word-break: keep-all; overflow-wrap: anywhere; text-wrap: balance; }
@media (max-width: 359px) {
  .filter-page .job-card__cover, .filter-page .job-card__image { width: 64px; height: 64px; }
  .filter-page .job-card__star { left: 48px; }
  /* 320 宽：日期 · 天数 · 时长一行写完（11 号），实在放不下才省略，不再把「6 小时」拆两行 */
  .filter-page .job-card__meta { align-items: center; }
  .filter-page .job-card__meta > text { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .filter-page .advice .conflict > text, .filter-page .advice .suggestion > text { font-size: 13px; }
}
/* —— 返修 5 end —— */
/* ==== r3jobsb 第四轮 start（11-18 夜，以微信实拍为准）==== */
/* s=1 顶部订阅：不再单独占一张白卡，改成筛选卡上方一行暖棕文字（高 32） */
.filter-page :deep(.subscribe-entry) { padding: 4px 16px 0; }
.filter-page :deep(.subscribe-entry button) { min-height: 32px; height: 32px; padding: 0; border-radius: 0; background: transparent; font-size: 13px; font-weight: 500; line-height: 32px; }
.filter-page .filter-body { padding-top: 4px; }
/* 选项胶囊：统一流式（宽度随字数、间距 8、高 32），没选 --k-fill 底；选中加实线暖棕边 + 600，一眼分得开 */
.filter-page .pills { display: flex; flex-wrap: wrap; gap: 8px; grid-template-columns: none; }
.filter-page .pill { flex: 0 0 auto; min-width: 56px; height: 32px; padding: 0 14px; border: 1px solid transparent; border-radius: 16px; background: var(--k-fill); font-size: 13px; font-weight: 400; color: var(--k-ink2); }
.filter-page .pill.on { border-color: var(--k-red); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
.filter-page .pill--more { min-width: 0; margin-left: auto; padding: 0 0 0 4px; border-color: transparent; background: transparent; color: var(--k-muted); font-weight: 400; }
.filter-page .pills--assure .pill:last-child, .filter-page .pill--assured { padding: 0 14px; }
.filter-page .sec { padding-top: 16px; padding-bottom: 16px; }
.filter-page .sec--line { padding-top: 14px; padding-bottom: 14px; }
.filter-page .sec-head { margin-bottom: 12px; }
/* 底栏「重置」：和旅居筛选一样的次按钮，宽 96、高 44 */
.filter-page .foot-reset { flex: 0 0 96px; width: 96px; min-width: 0; height: 44px; box-sizing: border-box; padding: 0; border: 1px solid var(--k-red-line); border-radius: 22px; background: var(--k-paper); font-size: 15px; font-weight: 600; line-height: 42px; color: var(--k-red-deep); text-decoration: none; text-align: center; }
.filter-page :deep(.k-bottom__inner) { padding: 8px 12px !important; gap: 12px; }
.filter-page :deep(.k-bottom) { background: var(--k-paper); }
/* s=2：「+ 添加」改成不带框的暖棕文字按钮；匹配度气泡去掉底和边；保存进底栏后页面底部留出底栏高 */
.filter-page .selected-chip--add { height: 28px; min-height: 28px; margin: 4px 0; padding: 0 4px; gap: 4px; border: 0; background: transparent; color: var(--k-red); font-size: 13px; font-weight: 500; }
.filter-page .selected-chip--add::after { display: none; border: 0; }
.filter-page .slider__knob text { padding: 0; background: transparent; box-shadow: none; color: var(--k-red-deep); font-size: 13px; font-weight: 600; }
.filter-page .subscribe-body { padding-bottom: calc(84px + var(--k-safe-bottom)); }
.filter-page .save-button { margin: 0; padding: 0; }
.filter-page .subscribe-body .manage-note { margin: 12px 16px 0; font-size: 13px; color: var(--k-muted); }
/* s=3：保障单独一行（无底色绿字 + 盾牌），其它标签保持中性底；信息行图标退成浅灰；放不下时换行，不再被省略号吃掉；价格行贴卡底 */
.filter-page .job-card__tags > .job-card__badge { flex: 0 0 100%; order: -1; height: 16px; margin: 0 0 2px; padding: 0; gap: 4px; border-radius: 0; background: none; display: flex; align-items: center; }
.filter-page .job-card__tags > .job-card__badge :deep(.jb--card .jb__text) { line-height: 16px; }
.filter-page .job-card__copy { align-self: stretch; display: flex; flex-direction: column; min-height: 96px; }
.filter-page .job-card__bottom { margin-top: auto; padding-top: 6px; }
.filter-page .job-card__meta > text { white-space: normal; overflow: visible; text-overflow: clip; word-break: keep-all; overflow-wrap: anywhere; line-height: 18px; }
.filter-page .job-card__meta { align-items: flex-start; }
.filter-page .job-card__meta :deep(.k-icon) { margin-top: 3px; }
/* s=4：空状态整组按约 40% 屏高放；没冲突没建议时不套白卡，两行灰色说明 + 发丝线；两颗按钮同宽 240、居中，让开右侧客服竖条 */
.filter-page .empty-icon { margin-top: 14vh; }
.filter-page .empty-body--bare .advice { margin: 16px 24px 0; padding: 0; background: transparent; }
.filter-page .empty-body--bare .advice .conflict, .filter-page .empty-body--bare .advice .suggestions { padding: 10px 0; text-align: center; }
.filter-page .empty-body--bare .advice .conflict__title { margin: 0; font-size: 14px; font-weight: 500; color: var(--k-ink2); }
.filter-page .adjust-wrap { width: 240px; margin: 24px auto 0; }
.filter-page .adjust { margin-top: 0; }
.filter-page .adjust-wrap :deep(.k-button) { height: 40px; border-radius: 20px; font-size: 15px; }
.filter-page .subscribe-wrap { margin: 12px auto 0; width: 240px; }
.filter-page .subscribe-wrap :deep(.k-button) { width: 240px; height: 40px; border-radius: 20px; font-size: 15px; font-weight: 600; }
.filter-page .service { margin-top: 16px; }
@media (max-width: 359px) {
  .filter-page .pill { min-width: 48px; padding: 0 12px; }
  .filter-page .job-card__meta > text { font-size: 11px; white-space: normal; overflow: visible; text-overflow: clip; }
  .filter-page .adjust-wrap, .filter-page .subscribe-wrap, .filter-page .subscribe-wrap :deep(.k-button) { width: 220px; }
}
/* ==== r3jobsb 第四轮 end ==== */
/* ==== r3jobsb 第四轮返修 start（11-19，复评遗留）==== */
/* s=1 城市 / 在店时长 / 每天工时 / 食宿（pills--5）：改回 5 格等分网格，一行 5 颗不再掉字；岗位类型等其它组仍按字数流式 */
.filter-page .pills--5 { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
.filter-page .pills--5 .pill { min-width: 0; padding: 0; }
/* 「更多 ⌄」留在第 5 格里靠右，不再被顶到下一行 */
.filter-page .pills--5 .pill--more { margin-left: 0; justify-content: flex-end; }
/* s=3 匹配度：无底绿字 12/600，和上一行「经袋鼠实地拍摄并含保险」同一种做法，一行只剩一种底色 */
.filter-page .job-card__tags :deep(.k-chip.is-green) { padding-left: 0; padding-right: 4px; background: transparent; font-size: 12px; font-weight: 600; }
/* s=3 价格：数字 20/700，文字价（面议 / 奖金）16/600，层级差一档而不是差一截 */
.filter-page .job-card__price .k-price { font-size: 20px; line-height: 24px; }
.filter-page .job-card__price--word .k-price { font-size: 16px; font-weight: 600; line-height: 24px; color: var(--k-red); }
/* s=4 没有冲突也没有建议：两行灰标题合成居中一行 12 号浅灰（中间 3px 圆点），去掉发丝线 */
.filter-page .empty-body--bare .advice { display: flex; justify-content: center; align-items: center; gap: 0 16px; margin: 12px 24px 0; }
.filter-page .empty-body--bare .advice .conflict, .filter-page .empty-body--bare .advice .suggestions { position: relative; padding: 0; }
.filter-page .empty-body--bare .advice .conflict__title { font-size: 12px; font-weight: 400; line-height: 18px; color: var(--k-light); }
.filter-page .empty-body--bare .advice .conflict + .suggestions::before { left: -10px; right: auto; top: 8px; width: 3px; height: 3px; border-radius: 50%; background: var(--k-line2); transform: none; }
/* s=4 有冲突 / 建议：图标上方只留 32，「调整筛选」回到首屏里；14vh 只给没内容的那种 */
.filter-page .empty-body:not(.empty-body--bare) .empty-icon { margin-top: 32px; }
/* 320 宽：5 格每格约 46，字退到 12 号给微信字宽留余量 */
@media (max-width: 359px) { .filter-page .pills--5 .pill { font-size: 12px; } }
/* ==== r3jobsb 第四轮返修 end ==== */
/* ==== r3jobsb 第五轮 start（11-19，按微信实拍复评）==== */
/* s=1 选项胶囊：没选中的不再是一面灰底墙——透明底 + 0.5px 线色细边（高 32、圆角 16 不变）；选中保持暖棕实线边 + 浅棕底 + 600 */
.filter-page .pill { border: 0.5px solid var(--k-line2); background: transparent; }
.filter-page .pill.on { border: 1px solid var(--k-red); background: var(--k-red-soft); }
.filter-page .pill--more { border-color: transparent; background: transparent; }
/* 各组标题右侧「已选 0 个 ›」「不限 ›」和「更多 ⌄」：箭头字形和胶囊行右边缘对在同一条线（图标自带的右侧留白用负边距抵掉） */
.filter-page .sec-head__meta { margin-right: -4px; }
.filter-page .pill--more :deep(.k-icon) { margin-right: -3px; }
/* s=2：页尾说明挪进底栏、按钮上方（12 号灰字居中、锁图标跟着第一行、下距 8），一直看得见，不再被固定底栏拦腰盖住 */
.filter-page .subscribe-body .manage-note--bar { display: block; margin: 0 0 8px; padding: 0 8px; text-align: center; font-size: 12px; line-height: 18px; color: var(--k-muted); }
.filter-page .subscribe-body .manage-note--bar > text { display: inline; font-size: 12px; line-height: 18px; }
.filter-page .manage-note--bar :deep(.k-icon) { display: inline-block; margin: 0 4px 0 0; vertical-align: -2px; }
.filter-page .subscribe-body { padding-bottom: calc(132px + var(--k-safe-bottom)); }
/* s=3 结果卡：封面改 104×128 竖图（4:5、圆角 8），右栏最小高度跟着 128，图片下面不再各空一截；收藏星跟着封面右上角 */
.filter-page .job-card__cover { flex: 0 0 104px; width: 104px; height: 128px; }
.filter-page .job-card__image { width: 104px; height: 128px; border-radius: 8px; }
.filter-page .job-card__copy { min-height: 128px; overflow: hidden; }
.filter-page .job-card__star { left: 88px; }
/* 标签不再是一排灰底小块：12 号次墨色文字、用「·」隔开（和信息行同一种写法）；折行时行首的圆点落在右栏左边外面、被裁掉 */
.filter-page .job-card__tags { margin-left: -12px; column-gap: 0; row-gap: 2px; }
.filter-page .job-card__tags > .job-card__badge { flex-basis: calc(100% - 12px); margin-left: 12px; }
.filter-page .job-card__tags :deep(.k-chip) { position: relative; height: 18px; margin-left: 12px; padding: 0; border: 0; border-radius: 0; background: transparent; font-size: 12px; font-weight: 400; line-height: 18px; color: var(--k-ink2); }
.filter-page .job-card__tags :deep(.k-chip)::before { content: '·'; position: absolute; left: -9px; top: 0; width: 6px; text-align: center; color: var(--k-light); }
.filter-page .job-card__tags :deep(.k-chip.is-green) { padding: 0; font-weight: 600; color: var(--k-green); }
/* s=4：没有冲突也没有建议时那一行「条件冲突 · 放宽建议（共 0 条）」改成 13 号灰字，不再像没删干净的浅灰残留；空状态方块用本组统一的中性浅底 + 灰色图标 */
.filter-page .empty-body--bare .advice .conflict__title { font-size: 13px; line-height: 20px; color: var(--k-muted); }
.filter-page .empty-body--bare .advice .conflict + .suggestions::before { top: 9px; }
.filter-page .empty-icon { background: var(--k-fill); }
@media (max-width: 359px) {
  .filter-page .job-card__cover { flex-basis: 80px; }
  .filter-page .job-card__cover, .filter-page .job-card__image { width: 80px; height: 100px; }
  .filter-page .job-card__copy { min-height: 100px; }
  .filter-page .job-card__star { left: 64px; }
}
/* ==== r3jobsb 第五轮 end ==== */
/* ==== r3jobsb 第六轮 start（11-19，复评收尾）==== */
/* s=3 标签之间的「·」：圆点放在 12 宽的格子里居中（以前格子只有 6 宽，系统字的圆点比格子宽、往右溢出，贴着下一个标签），前后空隙一样 */
.filter-page .job-card__tags :deep(.k-chip)::before { left: -12px; width: 12px; }
/* s=3 封面加宽到 104 后右栏窄了 8：两行信息（门店、日期·时长·工时）退一档到 11 号、行高 16，「…· 每天 6 小时」在 375 宽微信里也留得出 8 以上余量，不再把「小时」挤到下一行 */
.filter-page .job-card__meta > text { font-size: 11px; line-height: 16px; }
.filter-page .job-card__meta :deep(.k-icon) { margin-top: 2px; }
/* ==== r3jobsb 第六轮 end ==== */
/* ==== r3jobsb 第三轮 end ==== */

.filter-page.user-surface {
  .sheet, .subscribe-card { border-radius: 12px; }
  .sec-head { align-items: baseline; gap: 8px; }
  .pill.on:not(.pill--assured), .frequency__item.on { background: var(--k-red-soft); color: var(--k-red-deep); border-color: var(--k-red-line); }
  .foot-main, .foot-reset { min-height: 44px; border-radius: 10px; }
}
</style>
