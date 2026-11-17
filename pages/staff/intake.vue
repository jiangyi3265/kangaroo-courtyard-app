<template>
  <view class="k-page intake">
    <!-- 1 列表：线上任务审核（本城线上任务 / 代运营 / 抖音卖房）；?kind=jobs 时是派给本城换工主理人的商家岗位 -->
    <template v-if="s === 1">
      <k-topbar :title="jobsMode ? '商家岗位' : '商家需求审核'" back />
      <view class="k-body k-pad-tab">
        <view class="req-head">
          <view class="req-head__copy"><text class="req-head__title">{{ list.city.value ? list.city.value + ' · ' : '' }}{{ jobsMode ? '商家岗位' : kindInfo(kind).name }}</text><text class="req-head__sub">{{ jobsMode ? '商家发布的换工、兼职、全职，完善后由你上架' : '和商家沟通、核实详情后，确认转给商家服务人' }}</text></view>
          <view v-if="!jobsMode" class="req-head__act" hover-class="k-press-s" @click="openSubmit"><k-icon name="plus" :size="15" color="red" /><text>代商家提交</text></view>
        </view>
        <!-- 主人 2026-11-03：「每个项目区分开别放到一起」——线上任务 / 代运营 / 抖音卖房分开看，红色数字是待核实（商家岗位不分） -->
        <view v-if="!jobsMode" class="req-kinds"><view v-for="k in REQUEST_KINDS" :key="k.type" class="req-kind" :class="{ active: kind === k.type }" hover-class="k-press-s" @click="setKind(k.type)"><text>{{ k.label }}</text><text v-if="kindBadge(kindCounts, k.type)" class="req-kind__badge">{{ kindBadge(kindCounts, k.type) }}</text></view></view>
        <scroll-view scroll-x class="req-tabs" :show-scrollbar="false"><view class="req-tabs__row"><view v-for="t in tabs" :key="t.status" class="req-tab" :class="{ active: status === t.status }" hover-class="k-press" @click="setStatus(t.status)"><text>{{ t.label }}</text></view></view></scroll-view>
        <view v-if="list.error.value" class="req-state"><text>{{ list.error.value }}</text><k-button label="重新加载" size="md" type="outline" @click="reloadList" /></view>
        <template v-else>
          <k-request-row v-for="r in list.rows.value" :key="r.requestId" :item="r" @open="openRow(r)" />
          <view v-if="list.hasMore.value" class="req-more" hover-class="k-press" @click="list.more"><text>{{ list.loading.value ? '正在加载…' : '加载更多' }}</text></view>
          <view v-if="!list.rows.value.length" class="req-state"><text>{{ list.loading.value || !list.loaded.value ? '正在读取…' : emptyText }}</text></view>
        </template>
      </view>
      <k-tabbar mode="staff" active="business" />
    </template>

    <!-- 2 详情：核实、备注、确认转发、退回 -->
    <template v-else-if="s === 2">
      <k-topbar title="需求详情" back custom-back @back="leaveDetail" />
      <view class="k-body" :class="actions.length ? 'req-pad-bar' : 'k-pad-tab'">
        <view v-if="detailError" class="req-state"><text>{{ detailError }}</text><k-button label="重新加载" size="md" type="outline" @click="reloadDetail" /></view>
        <view v-else-if="!detail" class="req-state"><text>正在读取…</text></view>
        <template v-else>
          <k-request-detail :detail="detail" callable :show-note="!actions.length" />
          <view v-if="actions.length" class="req-note">
            <view class="req-note__head"><text>核实备注</text><text v-if="noteDirty" class="req-note__save" @click="saveNote">{{ noteSaving ? '保存中…' : '保存备注' }}</text></view>
            <textarea v-if="noteEditing" class="pub-area" :value="noteDraft" maxlength="500" placeholder="和商家沟通了什么、核实结果（商家看不到）" placeholder-class="pub-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="noteDraft = $event.detail.value" @blur="endNote" />
            <view v-else class="pub-area pub-area--idle" hover-class="k-press" @click="noteEditing = true"><text :class="{ 'pub-ph': !noteDraft }">{{ noteDraft || '和商家沟通了什么、核实结果（商家看不到）' }}</text></view>
            <text class="req-note__tip">确认转发时一起带给商家服务人。</text>
          </view>
        </template>
      </view>
      <view v-if="actions.length" class="req-bar">
        <view class="req-bar__btn"><k-button block type="secondary" label="退回商家" @click="returnToMerchant" /></view>
        <view class="req-bar__btn"><k-button block :label="working ? '处理中…' : '确认并转发'" @click="forward" /></view>
      </view>
      <k-tabbar v-else mode="staff" active="business" />
    </template>

    <!-- 3 代商家提交代运营 / 抖音卖房 -->
    <template v-else>
      <k-topbar title="代商家提交" back custom-back @back="leaveSubmit" />
      <view class="pub-form req-pad-bar">
        <view class="pub-sec">
          <view id="sf-requestType" class="pub-field">
            <view class="pub-label"><text>需求类型</text><text class="pub-req">*</text></view>
            <view class="pub-chips pub-chips--2"><text v-for="t in SUBMIT_TYPES" :key="t.value" class="pub-chip" :class="{ on: form.requestType === t.value }" @click="form.requestType = t.value">{{ t.label }}</text></view>
          </view>
          <view id="sf-store" class="pub-field">
            <view class="pub-label"><text>商家</text><text class="pub-req">*</text></view>
            <view class="pub-row" :class="{ 'pub-row--err': err.store }" hover-class="k-press" @click="pickStore"><k-icon name="store" :size="18" color="red" /><text class="pub-row__text" :class="{ muted: !storeText }">{{ storeText || '选择本城商家店，或填写店名' }}</text><k-icon name="chevron-right" :size="16" color="muted" /></view>
            <input v-if="manualStore" class="pub-input store-input" :value="form.storeName" maxlength="64" placeholder="商家店名" placeholder-class="pub-ph" @input="form.storeName = $event.detail.value" />
            <text v-if="err.store" class="pub-err">{{ err.store }}</text>
            <text v-else class="pub-hint">还没开通商家身份的店，直接填店名就行</text>
          </view>
          <view id="sf-content" class="pub-field">
            <view class="pub-label"><text>需求说明</text><text class="pub-req">*</text><text class="pub-count">{{ form.content.length }}/2000</text></view>
            <textarea v-if="contentEditing" class="pub-area pub-area--tall" :value="form.content" maxlength="2000" placeholder="商家想做什么、现在什么情况、什么时候要" placeholder-class="pub-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="form.content = $event.detail.value" @blur="endContent" />
            <view v-else class="pub-area pub-area--tall pub-area--idle" :class="{ 'pub-area--err': err.content }" hover-class="k-press" @click="contentEditing = true"><text :class="{ 'pub-ph': !form.content }">{{ form.content || '商家想做什么、现在什么情况、什么时候要' }}</text></view>
            <text v-if="err.content" class="pub-err">{{ err.content }}</text>
          </view>
          <view id="sf-contactName" class="pub-field">
            <view class="pub-label"><text>联系人</text><text class="pub-req">*</text></view>
            <input class="pub-input" :class="{ 'pub-input--err': err.contactName }" :value="form.contactName" maxlength="32" placeholder="商家联系人称呼" placeholder-class="pub-ph" @input="form.contactName = $event.detail.value" />
            <text v-if="err.contactName" class="pub-err">{{ err.contactName }}</text>
          </view>
          <view id="sf-contactPhone" class="pub-field">
            <view class="pub-label"><text>手机号</text><text class="pub-req">*</text></view>
            <input class="pub-input" :class="{ 'pub-input--err': err.contactPhone }" type="number" :value="form.contactPhone" maxlength="11" placeholder="商家手机号" placeholder-class="pub-ph" @input="form.contactPhone = $event.detail.value" />
            <text v-if="err.contactPhone" class="pub-err">{{ err.contactPhone }}</text>
          </view>
          <view class="pub-field">
            <view class="pub-label"><text>图片</text><text class="pub-opt">选填，最多 {{ SUBMIT_MAX_IMAGES }} 张</text></view>
            <view class="sf-images"><view v-for="(url, i) in form.images" :key="url" class="sf-image" hover-class="k-press-s"><image :src="absUrl(url)" mode="aspectFill" /><view class="sf-image__del" @click="removeImage(i)"><k-icon name="x" :size="13" color="white" /></view></view><view v-if="form.images.length < SUBMIT_MAX_IMAGES" class="sf-image sf-image--add" hover-class="k-press-s" @click="addImages"><k-icon name="image-plus" :size="24" color="muted" /><text>{{ form.images.length }}/{{ SUBMIT_MAX_IMAGES }}</text></view></view>
          </view>
        </view>
      </view>
      <view class="req-bar"><view class="req-bar__btn"><k-button block :label="working ? '提交中…' : '提交'" @click="submit" /></view></view>
    </template>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 换工主理人「线上任务审核」（V63，业务页入口，服务端要 intake 权限）：
//   s=1 列表：按当前门店的城市列本城的线上任务 / 代运营 / 抖音卖房（服务端强校验城市）；?kind=jobs 时列派给本城的商家岗位，点开切到那家店去岗位管理完善、上架
//   s=2 详情：商家联系方式、备注；确认并转发（选本城商家服务人，全部通知，服务端自动补这家店的授权）；退回商家（写原因）。本城没有商家服务人时转平台
//   s=3 代商家提交代运营 / 抖音卖房（选本城商家店，或只填店名）
// 接口在页面里直接用 request.js，不往主包 common/api.js 加。
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onShow, onUnload, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { get, post, put } from '@/common/request.js'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, selectStaffStore } from '@/common/experience.js'
import { errText, confirm, prompt, pickPaged } from '@/common/ui.js'
import { absUrl, chooseImages, uploadTo } from '@/common/upload.js'
import { useRequestList } from './request-list.js'
import { INTAKE_API, MERCHANT_JOBS_API, INTAKE_TABS, MERCHANT_JOB_TABS, SUBMIT_TYPES, SUBMIT_MAX_IMAGES, REQUEST_KINDS, kindInfo, pickKind, kindBadge, tabOf, intakeActions, forwardChoices, newSubmitForm, submitErrors, submitPayload } from './request-view.js'
import KRequestRow from './components/k-request-row.vue'
import KRequestDetail from './components/k-request-detail.vue'

const jobsMode = ref(false)
const status = ref(INTAKE_TABS[0].status)
const tabs = computed(() => (jobsMode.value ? MERCHANT_JOB_TABS : INTAKE_TABS))
const emptyText = computed(() => (jobsMode.value ? '这一类还没有商家岗位' : '「' + kindInfo(kind.value).name + '」这一栏还没有需求'))
const storeParams = () => ({ storeId: currentStaffStoreId() })
// 主人 2026-11-03：需求按项目分开（?type=online_task / managed / cloud_chain；没带就落到第一个有待核实的）
const kind = ref(REQUEST_KINDS[0].type)
const list = useRequestList(async (pageNum) => {
  const res = await get(jobsMode.value ? MERCHANT_JOBS_API : INTAKE_API, { ...storeParams(), ...(jobsMode.value ? {} : { type: kind.value }), status: status.value, pageNum, pageSize: 20 })
  return res.data
})
const setStatus = (v) => { if (status.value !== v) { status.value = v; list.reload() } }
// 换项目：状态回到待核实
const setKind = (v) => { if (kind.value !== v) { kind.value = v; status.value = INTAKE_TABS[0].status; list.reload() } }
// 项目页签上的待核实数；读不到就不显示数字
const kindCounts = ref({})
let countSeq = 0
async function loadKindCounts() {
  if (jobsMode.value) return
  const id = ++countSeq
  try {
    const res = await Promise.all(REQUEST_KINDS.map(k => get(INTAKE_API, { ...storeParams(), type: k.type, status: 'pending_verify', pageSize: 1 })))
    if (id !== countSeq) return
    const c = {}
    REQUEST_KINDS.forEach((k, i) => { c[k.type] = Number(res[i].data?.total) || 0 })
    kindCounts.value = c
  } catch (e) {
    if (id === countSeq) kindCounts.value = {}
  }
}
function reloadList() {
  loadKindCounts()
  return list.reload()
}

let booted = false, shown = false, landedOnDetail = false, landedOnSubmit = false
const s = useScreen(3, { onLoad: boot })
async function boot(q) {
  jobsMode.value = q.kind === 'jobs'
  status.value = tabOf(tabs.value, q.status)
  try {
    await ensureSession()
    if (!hasStaffAccess.value) return
    // 消息点进来带着门店：通知发给他在本城的那家店，先切过去再取数
    if (q.storeId && String(q.storeId) !== String(currentStaffStoreId())) await selectStaffStore(q.storeId)
  } catch (e) {
    toast(errText(e, '切换门店失败'))
  }
  booted = true
  if (s.value === 3) { landedOnSubmit = true; openSubmit() }
  const named = REQUEST_KINDS.some(k => k.type === q.type)
  if (Number(q.requestId)) {
    landedOnDetail = true
    await openDetail(q.requestId)
    // 消息点进来的：回到列表时落在这条需求的项目上
    kind.value = pickKind(named ? q.type : detail.value && detail.value.requestType, {})
  } else if (s.value === 1) {
    // 没指定项目（老消息、老入口）：先看哪个项目有待核实的，落到那一栏
    if (!jobsMode.value && !named) await loadKindCounts()
    kind.value = pickKind(q.type, kindCounts.value)
    if (named) loadKindCounts()
    list.reload()
  }
}
onShow(() => { if (shown && booted && s.value === 1) reloadList(); shown = true })
onUnload(() => { list.cancel(); detailSeq++ })
onReachBottom(() => { if (s.value === 1) list.more() })
onPullDownRefresh(async () => {
  if (s.value === 1) await reloadList()
  else if (s.value === 2) await reloadDetail()
  uni.stopPullDownRefresh()
})
// 从详情、代提交回到列表：数和状态可能都变了
watch(s, (v, old) => { if (v === 1 && old !== 1 && booted) reloadList() })

// 商家岗位在那家店的岗位管理里完善、上架：他已被自动授权，切过去就是那家店的换工主理人
function openRow(r) {
  if (jobsMode.value) return go('/pages/staff/jobs?storeId=' + r.storeId)
  openDetail(r.requestId)
}

// ---------------- s=2 详情 ----------------
const detail = ref(null), detailError = ref('')
const noteDraft = ref(''), noteSaved = ref(''), noteEditing = ref(false), noteSaving = ref(false)
const actions = computed(() => intakeActions(detail.value))
const noteDirty = computed(() => noteDraft.value.trim() !== noteSaved.value.trim())
let detailSeq = 0, openId = null
async function reloadDetail() {
  const id = ++detailSeq
  detailError.value = ''
  try {
    const d = (await get(INTAKE_API + '/' + openId, storeParams())).data || {}
    if (id !== detailSeq) return
    detail.value = d
    noteDraft.value = noteSaved.value = d.verifyNote || ''
  } catch (e) {
    if (id === detailSeq) detailError.value = errText(e, '详情加载失败')
  }
}
function openDetail(requestId) {
  openId = requestId
  detail.value = null
  noteEditing.value = false
  s.value = 2
  return reloadDetail()
}
function leaveDetail() {
  if (landedOnDetail && getCurrentPages().length > 1) return back()
  landedOnDetail = false
  s.value = 1
}
function endNote(e) {
  if (e && e.detail && e.detail.value !== undefined) noteDraft.value = e.detail.value
  noteEditing.value = false
}
async function saveNote() {
  if (noteSaving.value || !noteDirty.value) return
  noteSaving.value = true
  try {
    const res = await put(INTAKE_API + '/' + openId + '/note?storeId=' + currentStaffStoreId(), { verifyNote: noteDraft.value.trim() })
    noteSaved.value = noteDraft.value.trim()
    toast(res.msg || '备注已保存')
  } catch (e) {
    toast(errText(e, '备注保存失败'))
  } finally {
    noteSaving.value = false
  }
}
// 转发、退回：弹框期间和请求途中再点都只处理一次
const working = ref(false)
async function actOnDetail(path, body) {
  working.value = true
  try {
    const res = await post(INTAKE_API + '/' + openId + '/' + path + '?storeId=' + currentStaffStoreId(), body)
    toast(res.msg || '已处理')
    leaveDetail()
  } catch (e) {
    toast(errText(e, '操作失败'))
    // 409：别人刚处理过，把最新状态拿回来，不留着点不动的按钮
    if (e && e.code === 409) reloadDetail()
  } finally {
    working.value = false
  }
}
async function forward() {
  if (working.value) return
  let staff
  try {
    staff = (await get(INTAKE_API + '/options', storeParams())).data?.serviceStaff || []
  } catch (e) {
    return toast(errText(e, '商家服务人名单读取失败'))
  }
  const choices = forwardChoices(staff)
  let serviceUserId = null
  if (!choices.length) {
    if (!(await confirm('本城还没有商家服务人', '确认后这条需求转给平台安排，核实备注会保留。'))) return
  } else {
    const i = await pickPaged(choices.map(c => c.label), '转给谁')
    if (i < 0) return
    serviceUserId = choices[i].userId
    if (!(await confirm('确认转发', `已和商家核实好了？确认后提醒${serviceUserId == null ? '本城全部商家服务人' : choices[i].label}接手，商家也会收到进度。`))) return
  }
  if (working.value) return
  const verifyNote = noteDraft.value.trim()
  await actOnDetail('forward', verifyNote ? { serviceUserId, verifyNote } : { serviceUserId })
}
async function returnToMerchant() {
  if (working.value) return
  const reason = await prompt('退回原因（会发给商家）', { placeholder: '例如：佣金没写清楚，请补充后再提交' })
  if (reason === null) return
  if (!reason) return toast('请填写退回原因')
  if (reason.length > 500) return toast('退回原因最多 500 字')
  if (working.value) return
  await actOnDetail('return', { reason })
}

// ---------------- s=3 代商家提交 ----------------
const form = ref(newSubmitForm())
const tried = ref(false), contentEditing = ref(false), manualStore = ref(false)
const merchantStores = ref([])
const err = computed(() => (tried.value ? submitErrors(form.value) : {}))
const storeText = computed(() => form.value.merchantStoreName || (manualStore.value ? '手动填写店名' : ''))
async function openSubmit() {
  form.value = newSubmitForm()
  tried.value = false
  contentEditing.value = false
  manualStore.value = false
  s.value = 3
  try {
    merchantStores.value = (await get(INTAKE_API + '/options', storeParams())).data?.merchantStores || []
  } catch (e) {
    merchantStores.value = []
  }
}
async function pickStore() {
  const labels = merchantStores.value.map(x => x.storeName).concat(['手动填写店名'])
  const i = await pickPaged(labels, '本城商家店')
  if (i < 0) return
  const picked = merchantStores.value[i]
  manualStore.value = !picked
  form.value.merchantStoreId = picked ? picked.storeId : null
  form.value.merchantStoreName = picked ? picked.storeName : ''
  if (picked) form.value.storeName = ''
}
function endContent(e) {
  if (e && e.detail && e.detail.value !== undefined) form.value.content = e.detail.value
  contentEditing.value = false
}
const formDirty = () => {
  const f = form.value
  return !!(f.merchantStoreId != null || String(f.storeName).trim() || String(f.content).trim() || String(f.contactName).trim() || String(f.contactPhone).trim() || f.images.length)
}
async function leaveSubmit() {
  if (formDirty() && !(await confirm('先不提交了？', '已经填的内容不会保存。'))) return
  if (landedOnSubmit && getCurrentPages().length > 1) return back()
  landedOnSubmit = false
  s.value = 1
}
let uploading = false
async function addImages() {
  if (uploading) return
  const left = SUBMIT_MAX_IMAGES - form.value.images.length
  if (left <= 0) return
  const paths = await chooseImages(left)
  if (!paths || !paths.length) return
  uploading = true
  uni.showLoading({ title: '上传中', mask: true })
  let failed = 0
  try {
    for (const p of paths) {
      try {
        const url = (await uploadTo('/app/upload/image', p))?.data?.url
        if (url && !form.value.images.includes(url)) form.value.images.push(url)
      } catch (e) {
        failed++
      }
    }
  } finally {
    uni.hideLoading()
    uploading = false
  }
  if (failed) toast(`有 ${failed} 张没传上，可以再加一次`)
}
const removeImage = (i) => { form.value.images.splice(i, 1) }
async function submit() {
  if (working.value) return
  if (uploading) return toast('图片还在上传，请稍等')
  tried.value = true
  const errs = submitErrors(form.value)
  const first = ['requestType', 'store', 'content', 'contactName', 'contactPhone'].find(k => errs[k])
  if (first) {
    toast(errs[first])
    if (uni.pageScrollTo) uni.pageScrollTo({ selector: '#sf-' + first, duration: 200, offsetTop: -72 })
    return
  }
  working.value = true
  try {
    const res = await post(INTAKE_API + '/submit?storeId=' + currentStaffStoreId(), submitPayload(form.value))
    toast(res.msg || '已提交')
    // 回到列表时停在刚提交的那个项目（代运营 / 抖音卖房）
    kind.value = pickKind(form.value.requestType, {})
    form.value = newSubmitForm()
    tried.value = false
    if (landedOnSubmit && getCurrentPages().length > 1) return back()
    landedOnSubmit = false
    s.value = 1
  } catch (e) {
    toast(errText(e, '提交失败'))
  } finally {
    working.value = false
  }
}
</script>

<style scoped lang="scss">
/* 代提交表单和发布表单同一套样式（./publish-form.scss），列表与详情在 ./request-pages.scss */
@import './publish-form.scss';
@import './request-pages.scss';
.pub-area--idle{overflow-y:auto;white-space:pre-wrap;word-break:break-all}
.store-input{margin-top:9px}
.muted{color:var(--k-muted)}
.sf-images{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.sf-image{position:relative;height:72px;border-radius:8px;overflow:hidden;background:var(--k-paper2)}
.sf-image>image{width:100%;height:100%;display:block}
.sf-image__del{position:absolute;top:0;right:0;width:24px;height:24px;border-radius:0 0 0 8px;background:rgba(36,27,23,.6);display:flex;align-items:center;justify-content:center}
.sf-image--add{border:1px dashed var(--k-line2);background:var(--k-bg);box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;color:var(--k-muted)}
</style>
