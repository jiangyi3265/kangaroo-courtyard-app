<template>
  <!-- 一键多投（2026-10-31 主人）：报名成功页下面「再投几家」。选城市 + 类型，极简卡片：点文字进详情，点右边圆圈勾选，一次最多 5 家；
       底部「一键投递（N 家）」在页面的底栏（apply.vue），点了让 submitTick 加一，这里接着 submit()。投完这一块换成逐家结果，「再选几家」回到列表。 -->
  <view class="ma">
    <view class="ma-head">
      <text class="ma-title">{{ listOpen ? '再投几家' : '投递结果' }}</text>
      <text v-if="listOpen && picks.length" class="ma-count">已选 {{ picks.length }}/{{ MAX_PICK }}</text>
    </view>
    <text v-if="listOpen" class="ma-sub">用同一份简历，到岗时间和时长按每家的要求自动调整</text>

    <!-- 投递结果：逐家显示，已投递的点进去看进度；失败的写服务端原话，可以重试 -->
    <view v-if="results.length" class="ma-group ma-results">
      <view v-for="rowItem in results" :key="rowItem.jobId" class="ma-result" :class="'is-' + rowItem.state" :hover-class="rowItem.state === 'done' ? 'k-press' : 'none'" @click="openResult(rowItem)">
        <view class="ma-result__main">
          <text class="ma-result__name">{{ displayWording(rowItem.title, [rowItem.storeName]) }}</text>
          <text class="ma-result__plan">{{ rowItem.planText }}{{ rowItem.moved ? '（已按这家调整）' : '' }}</text>
          <text v-if="rowItem.state === 'failed'" class="ma-result__msg">{{ rowItem.stateText }}</text>
          <text v-else-if="rowItem.state === 'skipped'" class="ma-result__plan">{{ rowItem.stateText }}</text>
        </view>
        <view v-if="rowItem.canRetry" class="ma-retry" role="button" hover-class="k-press-s" @click.stop="retry(rowItem)"><text>重试</text></view>
        <view v-else-if="rowItem.state === 'done'" class="ma-result__state"><text>{{ rowItem.stateText }}</text><k-icon name="chevron-right" :size="12" color="green" /></view>
        <text v-else class="ma-result__state">{{ rowItem.stateText }}</text>
      </view>
    </view>
    <view v-if="!listOpen && !busy" class="ma-more" role="button" hover-class="k-press-s" @click="reopenList"><text>再选几家</text></view>

    <template v-if="listOpen">
      <view class="ma-filters">
        <view class="ma-city" role="button" :aria-label="'选择城市，现在是' + (city || '全部城市')" hover-class="k-press-s" @click="pickCity"><k-icon name="map-pin" :size="14" color="muted" /><text class="ma-city__name">{{ city || '全部城市' }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view>
        <view class="ma-types"><view v-for="chip in TYPE_CHIPS" :key="chip[1]" class="ma-type" :class="{ on: type === chip[1] }" role="button" :aria-pressed="type === chip[1]" hover-class="k-press-s" @click="pickType(chip[1])"><text>{{ chip[0] }}</text></view></view>
      </view>

      <view v-if="listState === 'loading'" class="ma-state"><text>正在找合适的岗位…</text></view>
      <view v-else-if="listState === 'failed'" class="ma-state" role="button" hover-class="k-press-s" @click="load()"><text>岗位暂时读不到，点这里重试</text></view>
      <view v-else-if="!cards.length" class="ma-state"><text>{{ city ? '这个城市暂时没有其他合适的岗位，换个城市看看' : '暂时没有其他合适的岗位，过两天再来看看' }}</text></view>
      <view v-else class="ma-group">
        <view v-for="jobItem in cards" :key="jobItem.jobId" class="ma-card" :class="{ on: jobItem.picked }">
          <view class="ma-card__main" role="button" :aria-label="'查看' + jobItem.title" hover-class="k-press" @click="openJob(jobItem)">
            <image class="ma-card__img" :src="jobItem.img" mode="aspectFill" />
            <view class="ma-card__text"><text class="ma-card__name">{{ displayWording(jobItem.title, [jobItem.storeName]) }}</text><text class="ma-card__meta">{{ jobItem.meta }}</text></view>
          </view>
          <view class="ma-card__pick" role="checkbox" :aria-checked="jobItem.picked" :aria-label="(jobItem.picked ? '取消选择' : '选择') + jobItem.title" hover-class="k-press-s" @click.stop="toggle(jobItem)"><view class="ma-dot" :class="{ on: jobItem.picked }"><k-icon v-if="jobItem.picked" name="check" :size="14" color="white" /></view></view>
        </view>
      </view>
      <view v-if="canMore" class="ma-more" role="button" hover-class="k-press-s" @click="more"><text>{{ loadingMore ? '正在读取…' : '再看看' }}</text></view>
      <text class="ma-foot">确认后，简历会发给选中的每家店的主理人</text>
    </template>

    <!-- 提交前确认：逐家列清日期和时长，按这家要求调过的写明。用底部弹层不用微信自带弹窗（那个居中、折行后看不清哪句是哪家的） -->
    <view v-if="confirming.length" class="k-mask" @click="closeConfirm" @touchmove.stop.prevent />
    <view v-if="confirming.length" class="k-sheet ma-sheet">
      <view class="k-sheet__handle" />
      <text class="ma-sheet__title">投给这 {{ confirming.length }} 家</text>
      <view v-for="planItem in confirming" :key="planItem.jobId" class="ma-sheet__row">
        <text class="ma-sheet__name">{{ displayWording(planItem.title, [planItem.storeName]) }}</text>
        <view class="ma-sheet__plan"><text>{{ planItem.planText }}</text><text v-if="planItem.moved" class="ma-sheet__moved">已按这家调整</text></view>
      </view>
      <text class="ma-sheet__foot">确认后，简历会发给这 {{ confirming.length }} 家店的主理人</text>
      <view class="ma-sheet__btns">
        <view class="k-flex1"><k-button block type="outline" label="再想想" @click="closeConfirm" /></view>
        <view class="k-flex1"><k-button block label="确认投递" @click="send" /></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { displayWording } from '@/common/display-wording.js'
import { computed, onUnmounted, ref, watch } from 'vue'
import { experience } from '@/common/experience.js'
import { onShow } from '@dcloudio/uni-app'
import { apiJobList, apiMyApplications, apiSubmitApplication } from '@/common/api.js'
import { bindShareAfterApply } from '@/common/share.js'
import { selectCity } from '@/common/city-picker.js'
import { absUrl } from '@/common/upload.js'
import { go, toast } from '@/common/screen.js'
import { todayCn } from '@/common/ui.js'
import R from '@/common/routes.js'
import { coordinatorCity } from '../city-coordinator.js'
import { loadJobCities } from '../job-city-source.js'
import { MAX_PICK, PAGE_SIZE, TYPE_CHIPS, appliedSet, candidates, cardMeta, collectCandidates, genderParam, makeRow, planFor, planText, stateText, submitAll, summaryText, togglePick } from '../multi-apply.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  job: { type: Object, default: () => ({}) },
  jobId: { type: [Number, String], default: null },
  arrival: { type: String, default: '' },
  days: { type: Number, default: 30 },
  gender: { type: String, default: '' },
  submitTick: { type: Number, default: 0 }
})
const emit = defineEmits(['picked', 'busy', 'login'])

const SHOW_STEP = 5 // 一次露几家，页面不堆成一长串；「再看看」往下放
const city = ref('')
const type = ref('volunteer')
const rows = ref([])
const shownCount = ref(SHOW_STEP)
const listState = ref('loading')
const hasMore = ref(false)
const loadingMore = ref(false)
const picks = ref([])
const results = ref([])
const listOpen = ref(true)
const busy = ref(false)
let pageNum = 0
let loadVersion = 0
let left = false
let applied = new Set()

const setPicks = (next) => { picks.value = next; emit('picked', next.length) }
const setBusy = (v) => { busy.value = v; emit('busy', v) }

const keep = (list) => candidates(list, { currentJobId: props.jobId, appliedJobIds: applied })
const load = async ({ append = false } = {}) => {
  const version = ++loadVersion
  if (append) loadingMore.value = true
  else { listState.value = 'loading'; rows.value = []; shownCount.value = SHOW_STEP; pageNum = 0; hasMore.value = false }
  try {
    const got = await collectCandidates(
      (p) => apiJobList({ type: type.value, cities: city.value || undefined, gender: genderParam(props.gender), pageNum: p, pageSize: PAGE_SIZE }),
      { startPage: pageNum + 1, need: SHOW_STEP + 1, keep }
    )
    if (version !== loadVersion) return
    const known = new Set(rows.value.map(j => String(j.jobId)))
    rows.value = append ? rows.value.concat(got.rows.filter(j => !known.has(String(j.jobId)))) : got.rows
    pageNum = got.pageNum
    hasMore.value = got.hasMore
    listState.value = 'ready'
  } catch (e) {
    if (version !== loadVersion) return
    if (append) toast((e && e.message) || '读取失败，请重试')
    else listState.value = 'failed'
  } finally {
    if (version === loadVersion) loadingMore.value = false
  }
}
// 投过的不能再推荐；读不到就先按没有算（真投过的提交时服务端会说「已报名」，显示「之前投过」）
const loadApplied = async () => {
  try { applied = appliedSet((await apiMyApplications()).data) } catch (e) { /* 见上 */ }
}
// 默认本岗位的城市和类型。岗位到了才开始（报名成功才显示这个组件，这时候一定有了；写成 watch 是免得哪天先于岗位挂上）
let started = false
watch(() => props.job && props.job.jobType, (jobType) => {
  if (started || !jobType) return
  started = true
  city.value = coordinatorCity(String(props.job.city || '').split('·')[0])
  type.value = TYPE_CHIPS.some(c => c[1] === jobType) ? jobType : 'volunteer'
  loadApplied().then(() => load())
}, { immediate: true })

// 点进详情自己投了，回来要从列表和已选里消失
onShow(async () => {
  if (busy.value) return
  await loadApplied()
  rows.value = keep(rows.value)
  setPicks(picks.value.filter(j => !applied.has(String(j.jobId))))
})
watch(() => experience.account?.id, () => { left = true }, { flush: 'sync' })
onUnmounted(() => { left = true })

const cards = computed(() => {
  const picked = new Set(picks.value.map(j => String(j.jobId)))
  return rows.value.slice(0, shownCount.value).map(j => ({
    jobId: j.jobId, title: j.title, meta: cardMeta(j), img: absUrl(j.cover) || '/static/media/cover-empty.png', picked: picked.has(String(j.jobId))
  }))
})
const canMore = computed(() => listState.value === 'ready' && (shownCount.value < rows.value.length || hasMore.value))
const more = async () => {
  if (loadingMore.value) return
  shownCount.value += SHOW_STEP
  if (shownCount.value > rows.value.length && hasMore.value) await load({ append: true })
}

const pickType = (value) => { if (type.value !== value) { type.value = value; load() } }
const pickCity = async () => {
  let items
  try { items = await loadJobCities(type.value) } catch (e) { return toast('城市列表读取失败，请重试') }
  const picked = await selectCity({ title: '想去哪个城市', value: city.value, allowAll: true, items })
  if (picked === null || picked === city.value) return
  city.value = picked
  load()
}
const openJob = (card) => go(R.jobDetail + '?jobId=' + card.jobId)
const toggle = (card) => {
  const job = rows.value.find(j => String(j.jobId) === String(card.jobId))
  if (!job || busy.value) return
  const r = togglePick(picks.value, job)
  if (r.limited) return toast('一次最多投 ' + MAX_PICK + ' 家')
  setPicks(r.picks)
}

// ---------------- 投递：逐家串行，一家失败不影响别家 ----------------
const viewRow = (row) => {
  row.planText = planText(row)
  row.stateText = stateText(row)
  row.canRetry = row.state === 'failed' || row.state === 'skipped'
}
const submitOne = (row) => apiSubmitApplication({ jobId: row.jobId, arrival: row.arrival, days: row.days, idemKey: row.idemKey })
const runRows = async (list) => {
  setBusy(true)
  let r
  try {
    r = await submitAll(list, submitOne, viewRow, () => left)
  } finally {
    if (!left) setBusy(false)
  }
  if (left) return r
  for (const row of list) {
    if (row.state === 'done' || row.state === 'applied') applied.add(String(row.jobId))
    if (row.state === 'done' && row.appId) bindShareAfterApply(row.jobId, row.appId)
  }
  rows.value = keep(rows.value)
  if (r.stopped === 'login') { emit('login'); return r }
  toast(summaryText(r))
  return r
}
// 底栏「一键投递」：先弹确认，列清每家的日期和时长
const confirming = ref([])
function submit() {
  if (busy.value || !picks.value.length) return
  const today = todayCn()
  confirming.value = picks.value.map(job => {
    const plan = planFor(job, { arrival: props.arrival, days: props.days, today })
    return { jobId: job.jobId, title: job.title, ...plan, planText: planText(plan) }
  })
}
const closeConfirm = () => { confirming.value = [] }
async function send() {
  const plans = confirming.value
  if (busy.value || !plans.length) return
  confirming.value = []
  const list = plans.map(p => {
    const row = makeRow(p, p)
    viewRow(row)
    return row
  })
  // 这一批放到结果最上面；之前投过的老行还留着（同一家重新勾选的，老行去掉）
  const ids = new Set(list.map(x => String(x.jobId)))
  results.value = list.concat(results.value.filter(x => !ids.has(String(x.jobId))))
  listOpen.value = false
  await runRows(results.value.slice(0, list.length))
  setPicks([])
}
const retry = (rowItem) => {
  if (busy.value) return
  runRows(results.value.filter(x => String(x.jobId) === String(rowItem.jobId)))
}
const openResult = (rowItem) => { if (rowItem.state === 'done' && rowItem.appId) go(R.jobProgress + '?appId=' + rowItem.appId) }
const reopenList = () => { listOpen.value = true; if (!rows.value.length) load() }
watch(() => props.submitTick, (now, before) => { if (now !== before) submit() })
</script>

<style scoped lang="scss">
.ma { margin-top: 22px; }
.ma-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.ma-title { font-family: var(--k-display-font); font-size: 18px; font-weight: 700; color: #3B2A1E; }
.ma-count { font-size: 14px; font-weight: 700; color: var(--k-red-deep); }
.ma-sub { display: block; margin-top: 2px; font-size: 13px; line-height: 20px; color: var(--k-muted); }
.ma-filters { margin-top: 10px; display: flex; align-items: center; gap: 8px; }
.ma-city { flex: 0 1 auto; min-width: 0; max-width: 44%; height: 40px; padding: 0 8px 0 10px; border: 1px solid #E5D6C4; border-radius: 20px; background: var(--k-paper); display: flex; align-items: center; gap: 3px; color: var(--k-ink); font-size: 14px; font-weight: 600; box-sizing: border-box; }
.ma-city__name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ma-types { flex: 1; min-width: 0; height: 40px; padding: 3px; border-radius: 20px; background: #F3EBDD; display: flex; gap: 2px; box-sizing: border-box; }
.ma-type { flex: 1; min-width: 0; border-radius: 17px; display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--k-ink2); }
.ma-type.on { background: #8A603D; color: #FFFFFF; font-weight: 700; }
.ma-group { margin-top: 10px; border: 1px solid #E9DFD3; border-radius: 15px; background: var(--k-paper); overflow: hidden; }
.ma-card { display: flex; align-items: center; }
.ma-card + .ma-card { border-top: 1px solid var(--k-line); }
.ma-card.on { background: #FBF4E9; }
.ma-card__main { flex: 1; min-width: 0; min-height: 76px; padding: 12px 0 12px 12px; display: flex; align-items: center; gap: 10px; box-sizing: border-box; }
.ma-card__img { flex: 0 0 auto; width: 52px; height: 52px; border-radius: 10px; background: var(--k-paper2); }
.ma-card__text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ma-card__name { font-size: 15px; line-height: 22px; font-weight: 700; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ma-card__meta { font-size: 13px; line-height: 18px; color: var(--k-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 圆圈的点击区 52×76，比画出来的大，手抖也点得到 */
.ma-card__pick { flex: 0 0 auto; width: 52px; align-self: stretch; display: flex; align-items: center; justify-content: center; }
.ma-dot { width: 26px; height: 26px; border: 2px solid #C9B7A3; border-radius: 50%; background: var(--k-paper); display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
.ma-dot.on { border-color: #8A603D; background: #8A603D; }
.ma-state { margin-top: 10px; min-height: 76px; padding: 14px; border: 1px solid #E9DFD3; border-radius: 15px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; text-align: center; font-size: 14px; line-height: 22px; color: var(--k-ink2); box-sizing: border-box; }
.ma-more { margin-top: 10px; height: 44px; border-radius: 22px; background: #F3EBDD; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; color: var(--k-red-deep); }
.ma-foot { display: block; margin-top: 10px; font-size: 13px; line-height: 20px; color: var(--k-muted); }
.ma-result { min-height: 60px; padding: 10px 12px 10px 14px; display: flex; align-items: center; gap: 10px; box-sizing: border-box; }
.ma-result + .ma-result { border-top: 1px solid var(--k-line); }
.ma-result__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ma-result__name { font-size: 15px; line-height: 22px; font-weight: 700; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ma-result__plan { font-size: 13px; line-height: 18px; color: var(--k-muted); }
.ma-result__msg { font-size: 13px; line-height: 18px; color: var(--k-alert); }
.ma-result__state { flex: 0 0 auto; display: flex; align-items: center; gap: 1px; font-size: 14px; font-weight: 600; color: var(--k-muted); }
.is-done .ma-result__state { color: var(--k-green); }
.is-sending .ma-result__state { color: var(--k-red-deep); }
.ma-sheet { max-height: 86vh; overflow-y: auto; box-sizing: border-box; }
.ma-sheet__title { display: block; font-family: var(--k-display-font); font-size: 18px; line-height: 26px; font-weight: 700; color: #3B2A1E; }
.ma-sheet__row { padding: 10px 0; border-bottom: 1px solid var(--k-line); }
.ma-sheet__name { display: block; font-size: 15px; line-height: 22px; font-weight: 700; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ma-sheet__plan { margin-top: 1px; display: flex; align-items: center; flex-wrap: wrap; gap: 2px 8px; font-size: 14px; line-height: 20px; color: var(--k-ink2); }
.ma-sheet__moved { padding: 0 6px; border-radius: 4px; background: #F5E9D8; color: var(--k-red-deep); font-size: 12px; line-height: 20px; }
.ma-sheet__foot { display: block; margin-top: 10px; font-size: 13px; line-height: 20px; color: var(--k-muted); }
.ma-sheet__btns { margin-top: 12px; display: flex; gap: 10px; }
.ma-retry { flex: 0 0 auto; height: 36px; min-width: 60px; padding: 0 12px; border: 1px solid var(--k-red-line); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; color: var(--k-red-deep); box-sizing: border-box; }
@media (max-width: 359px) {
  .ma-filters { gap: 6px; }
  .ma-city { max-width: 40%; font-size: 13px; }
  .ma-type { font-size: 13px; }
}
/* 2026-11-17 改版「小而精」：白卡 12 圆角、不描边；城市和类型两个选择器收到 36 高；岗位行封面 8 圆角、标题 14 / 600；
   勾选圆圈的可点范围不变（整行高、52 宽）。选城市、三种类型、勾选、再看看、重试、确认弹层都照旧。 */
.ma { margin-top: 16px; }
.ma-head { padding: 0 2px; }
.ma-title { font-family: var(--k-sans); font-size: 15px; color: var(--k-ink); }
.ma-count { font-size: 12px; font-weight: 600; }
.ma-sub { padding: 0 2px; font-size: 11px; line-height: 16px; }
.ma-filters { margin-top: 8px; }
.ma-city { height: 36px; padding: 0 8px 0 10px; border: 0; border-radius: 18px; gap: 4px; font-size: 13px; font-weight: 500; }
/* 三种类型：白底的一条，选中的是里面一颗 30 高的暖棕胶囊；每一格用透明边把可点范围撑满 36（原来 34，不能缩） */
.ma-types { height: 36px; padding: 0; gap: 0; border-radius: 18px; background: var(--k-paper); }
.ma-type { border: 3px solid transparent; border-radius: 18px; font-size: 13px; }
.ma-type.on { background: linear-gradient(135deg, #B5814D, #8E5E33) padding-box; font-weight: 600; }
.ma-group { margin-top: 8px; border: 0; border-radius: 12px; }
.ma-card.on { background: #FFFBF6; }
.ma-card__main { min-height: 68px; padding: 10px 0 10px 12px; }
.ma-card__img { width: 48px; height: 48px; border-radius: 8px; background: #F5F1EB; }
.ma-card__name { font-size: 14px; line-height: 20px; font-weight: 600; }
.ma-card__meta { font-size: 11px; line-height: 16px; }
.ma-dot { width: 22px; height: 22px; border-width: 1.5px; border-color: var(--k-line2); }
.ma-dot.on { border-color: var(--k-red-deep); background: var(--k-red-deep); }
.ma-state { margin-top: 8px; min-height: 68px; border: 0; border-radius: 12px; font-size: 13px; line-height: 20px; color: var(--k-muted); }
.ma-more { margin-top: 8px; height: 40px; border-radius: 20px; background: var(--k-paper); box-shadow: inset 0 0 0 1px var(--k-red-line); font-size: 13px; font-weight: 500; }
.ma-foot { margin-top: 8px; padding: 0 2px; font-size: 11px; line-height: 16px; }
.ma-result { min-height: 56px; padding: 8px 12px; }
.ma-result__name { font-size: 14px; line-height: 20px; font-weight: 600; }
.ma-result__plan, .ma-result__msg { font-size: 11px; line-height: 16px; }
.ma-result__state { font-size: 12px; font-weight: 500; }
.ma-retry { height: 36px; font-size: 13px; font-weight: 500; }
.ma-sheet__title { font-family: var(--k-sans); font-size: 16px; line-height: 24px; color: var(--k-ink); }
.ma-sheet__name { font-size: 14px; line-height: 20px; font-weight: 600; }
.ma-sheet__plan { font-size: 12px; line-height: 18px; }
.ma-sheet__moved { padding: 0 5px; background: var(--k-red-soft); font-size: 10px; line-height: 17px; }
.ma-sheet__foot { font-size: 11px; line-height: 16px; }
.ma-sheet__btns :deep(.k-button) { height: 44px; border-radius: 22px; font-size: 15px; }
.ma-sheet__btns :deep(.k-button.is-primary) { background: linear-gradient(135deg, #B5814D, #8E5E33); box-shadow: none; }
/* —— 第二轮精修（11-18）—— */
.ma-title { font-size: 16px; line-height: 22px; }
/* 类型切换按分段控件：浅灰底槽 + 白色选中块，不再是实心棕胶囊（可点高度仍 36） */
.ma-types { background: #F0EBE4; }
.ma-type { border-width: 2px; border-radius: 18px; font-size: 13px; font-weight: 400; color: var(--k-ink2); }
.ma-type.on { background: #FFFFFF padding-box; color: var(--k-ink); font-weight: 600; }
/* 分隔线改发丝线 */
.ma-card + .ma-card, .ma-result + .ma-result { border-top: 0; background-image: linear-gradient(to bottom, var(--k-line) 50%, transparent 50%); background-size: 100% 1px; background-repeat: no-repeat; background-position: left top; }
.ma-sheet__row { border-bottom: 0; background-image: linear-gradient(to top, var(--k-line) 50%, transparent 50%); background-size: 100% 1px; background-repeat: no-repeat; background-position: left bottom; }
</style>
