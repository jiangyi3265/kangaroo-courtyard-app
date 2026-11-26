<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="dateOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。日历开着时锁住页面滚动；只在小程序里加，网页版用 lockPageScroll 锁 body（同 jobs.vue） -->
  <!-- #endif -->
  <view class="k-page rb">
    <!-- 填写屏不出浮动客服钮（主线定的：字段从屏幕边开始，钮会压字）。小院主理人是员工，操作条里也没有客服钮，提交按钮占满 -->
    <k-topbar v-if="mode === 'form'" :title="rowId ? '修改后再交' : '新增报销'" back custom-back :fab="false" @back="leaveForm" />
    <k-topbar v-else :title="mode === 'detail' ? '报销详情' : '采购报销'" back />

    <!-- ========== 列表：这家店的报销表 ========== -->
    <view v-if="mode === 'list'" class="fc-form">
      <view v-if="store" class="fc-block">
        <text class="fc-group__title rb-store">{{ store.storeName }}</text>
        <text v-if="store.canSubmit" class="rb-rule">{{ RULE_NOTE }}</text>
        <text v-else class="fc-notice rb-closed">这家店不是直营小院，不能新交报销，之前的记录还能看。</text>
        <view class="rb-tabs">
          <view v-for="tab in tabs" :key="tab.value" class="rb-tab" :class="{ on: status === tab.value }" hover-class="k-press" @click="pickStatus(tab.value)"><text class="rb-tab__t">{{ tab.label }}</text><text class="rb-tab__n">{{ tab.count }}</text></view>
        </view>
      </view>
      <view v-if="rows.length" class="fc-block">
        <view v-for="row in rows" :key="row.reimburseId" class="rb-row" hover-class="k-press" @click="openRow(row)">
          <view class="rb-row__main">
            <view class="rb-row__title"><text class="rb-row__name k-ellipsis">{{ row.itemName }}</text><text class="rb-row__qty">× {{ row.quantity }}</text></view>
            <text class="rb-row__meta">{{ cnDate(row.purchaseDate) }} 购买</text>
            <text v-if="submitterText(row)" class="rb-row__meta">{{ submitterText(row) }}</text>
            <text v-if="row.rejectReason" class="rb-row__reason k-ellipsis">驳回理由：{{ row.rejectReason }}</text>
          </view>
          <view class="rb-row__side">
            <text class="rb-row__amount">¥{{ row.amount }}</text>
            <text class="rb-tag" :class="'rb-tag--' + statusTone(row.status)">{{ row.statusText }}</text>
          </view>
          <k-icon name="chevron-right" :size="18" color="muted" />
        </view>
      </view>
      <view v-else class="fc-block rb-state">
        <text class="rb-state__t">{{ listStateText }}</text>
        <view v-if="listError && listRetry" class="rb-retry" hover-class="k-press" @click="reload"><text>重新加载</text></view>
      </view>
      <text v-if="hasMore" class="fc-footnote rb-more">{{ listLoading ? '正在读取…' : '往上滑看更多' }}</text>
      <view v-if="store && store.canSubmit" class="fc-bar"><view class="fc-bar__btns"><view class="fc-btn" hover-class="k-press-s" @click="openCreate"><text>新增报销</text></view></view></view>
    </view>

    <!-- ========== 详情：通知点开也到这里 ========== -->
    <view v-else-if="mode === 'detail'" class="fc-form">
      <template v-if="row">
        <view class="fc-block rb-sum">
          <view class="rb-sum__top"><text class="rb-tag" :class="'rb-tag--' + statusTone(row.status)">{{ row.statusText }}</text><text class="rb-sum__hint">{{ statusHint(row) }}</text></view>
          <text class="rb-sum__amount">¥{{ row.amount }}</text>
          <text class="rb-sum__name">{{ row.itemName }} × {{ row.quantity }}</text>
        </view>
        <text v-if="row.rejectReason" class="fc-notice fc-notice--alert">驳回理由：{{ row.rejectReason }}</text>
        <view class="fc-block">
          <view class="fc-row"><text class="fc-row__k">购买日期</text><text class="fc-row__v">{{ cnDate(row.purchaseDate) }}</text></view>
          <view class="fc-row"><text class="fc-row__k">小院</text><text class="fc-row__v">{{ row.storeName }}</text></view>
          <view class="fc-row"><text class="fc-row__k">提交人</text><text class="fc-row__v">{{ row.isMine ? '我' : row.submitterName }}</text></view>
          <view class="fc-row"><text class="fc-row__k">提交时间</text><text class="fc-row__v">{{ cnTime(row.submitTime) }}</text></view>
          <view v-if="row.revision > 1" class="fc-row"><text class="fc-row__k">提交次数</text><text class="fc-row__v">第 {{ row.revision }} 次</text></view>
          <view v-if="row.auditTime" class="fc-row"><text class="fc-row__k">审核时间</text><text class="fc-row__v">{{ cnTime(row.auditTime) }}</text></view>
          <view v-if="row.paidTime" class="fc-row"><text class="fc-row__k">打款时间</text><text class="fc-row__v">{{ cnTime(row.paidTime) }}</text></view>
          <view v-if="row.remark" class="fc-field"><view class="fc-label"><text class="fc-label__t">备注</text></view><text class="rb-remark">{{ row.remark }}</text></view>
        </view>
        <view class="fc-block">
          <view class="fc-field">
            <view class="fc-label"><text class="fc-label__t">凭证照片</text><text class="fc-count">{{ (row.receipts || []).length }} 张</text></view>
            <view class="fc-photos">
              <view v-for="(url, index) in row.receipts" :key="url" class="fc-photo" hover-class="k-press-s" @click="preview(row.receipts, index)"><image class="fc-photo__img" :src="absUrl(url)" mode="aspectFill" /></view>
            </view>
            <text class="fc-note">点照片看大图</text>
          </view>
        </view>
        <view v-if="row.canEdit || row.canWithdraw" class="fc-bar"><view class="fc-bar__btns">
          <view v-if="row.canEdit" class="fc-btn" hover-class="k-press-s" @click="openEdit"><text>修改后再交</text></view>
          <view v-if="row.canWithdraw" class="fc-btn rb-btn--danger" hover-class="k-press-s" @click="withdraw"><text>{{ acting ? '撤回中…' : '撤回这笔报销' }}</text></view>
        </view></view>
      </template>
      <view v-else class="fc-block rb-state">
        <text class="rb-state__t">{{ detailError || '正在读取…' }}</text>
        <view v-if="detailError && detailRetry" class="rb-retry" hover-class="k-press" @click="loadDetail"><text>重新加载</text></view>
      </view>
    </view>

    <!-- ========== 填写：新增、驳回后修改。版式同其他填写页（form-clean.scss） ========== -->
    <view v-else class="fc-form">
      <view v-if="formBlock || formLoading" class="fc-block rb-state">
        <text class="rb-state__t">{{ formBlock || '正在读取…' }}</text>
      </view>
      <template v-else>
        <text v-if="rejectReason" class="fc-notice fc-notice--alert">驳回理由：{{ rejectReason }}</text>
        <view class="fc-block">
          <text class="fc-group__title">采购内容</text>
          <view v-if="manyStores && formStoreName" class="fc-row"><text class="fc-row__k">小院</text><text class="fc-row__v fc-row__v--plain">{{ formStoreName }}</text></view>
          <view id="rb-itemName" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">品名</text><text class="fc-req">必填</text><text class="fc-count">{{ itemCount }}/{{ ITEM_MAX }}</text></view>
            <input class="fc-input" :class="{ 'fc-input--err': errs.itemName }" :value="form.itemName" :maxlength="ITEM_MAX" placeholder="买了什么，例如：床单" placeholder-class="fc-ph" @input="form.itemName = $event.detail.value" />
            <text v-if="errs.itemName" class="fc-err">{{ errs.itemName }}</text>
          </view>
          <view id="rb-quantity" class="fc-row" :class="{ 'fc-row--err': errs.quantity, 'fc-row--open': errs.quantity }">
            <text class="fc-row__k">数量</text><text class="fc-req">必填</text>
            <view class="fc-num"><input class="fc-num__input" :class="{ 'fc-num__input--err': errs.quantity }" type="number" :value="form.quantity" maxlength="6" @input="form.quantity = $event.detail.value" /></view>
          </view>
          <view v-if="errs.quantity" class="fc-sub"><text class="fc-err rb-err--sub">{{ errs.quantity }}</text></view>
          <view id="rb-amount" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">金额</text><text class="fc-req">必填</text></view>
            <view class="fc-money" :class="{ 'fc-money--err': errs.amount }"><text class="fc-money__sign">¥</text><input class="fc-money__input" type="digit" :value="form.amount" maxlength="12" placeholder="这一笔一共多少钱" placeholder-class="fc-ph" @input="form.amount = $event.detail.value" /><text class="fc-money__unit">元</text></view>
            <text v-if="errs.amount" class="fc-err">{{ errs.amount }}</text>
          </view>
          <view id="rb-purchaseDate" class="fc-row" :class="{ 'fc-row--err': errs.purchaseDate, 'fc-row--open': errs.purchaseDate }" hover-class="k-press" @click="dateOpen = true">
            <text class="fc-row__k">购买日期</text><text class="fc-req">必填</text>
            <text class="fc-row__v" :class="{ 'fc-row__v--empty': !form.purchaseDate }">{{ form.purchaseDate ? cnDate(form.purchaseDate) : '请选择' }}</text>
            <k-icon name="chevron-right" :size="18" color="muted" />
          </view>
          <view v-if="errs.purchaseDate" class="fc-sub"><text class="fc-err rb-err--sub">{{ errs.purchaseDate }}</text></view>
        </view>
        <view class="fc-block">
          <text class="fc-group__title">凭证与备注</text>
          <view id="rb-receipts" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">凭证照片</text><text class="fc-req">必填</text><text class="fc-count">{{ form.receipts.length }}/{{ MAX_RECEIPTS }}</text></view>
            <view class="fc-photos">
              <view v-for="(url, index) in form.receipts" :key="url" class="fc-photo" hover-class="k-press-s" @click="preview(form.receipts, index)">
                <image class="fc-photo__img" :src="absUrl(url)" mode="aspectFill" />
                <view class="fc-photo__del" hover-class="k-press" hover-stop-propagation @click.stop="removeReceipt(index)"><view class="fc-photo__x"><k-icon name="x" :size="14" color="white" :stroke="2.2" /></view></view>
              </view>
              <view v-if="form.receipts.length < MAX_RECEIPTS" class="fc-photo" hover-class="k-press-s" @click="addReceipts"><view class="fc-photo__add"><k-icon name="plus" :size="22" color="ink2" /><text>{{ uploading ? '上传中' : '添加' }}</text></view></view>
            </view>
            <text v-if="errs.receipts" class="fc-err">{{ errs.receipts }}</text>
            <text v-else class="fc-note">小票、发票或付款截图都可以，点照片看大图</text>
          </view>
          <view id="rb-remark" class="fc-field">
            <view class="fc-label"><text class="fc-label__t">备注</text><text class="fc-count">{{ remarkCount }}/{{ REMARK_MAX }}</text></view>
            <!-- 小程序 textarea 是原生层，会盖住日历：不在输入时换成同样外观的 view，点了才换回来（同 jobs.vue） -->
            <textarea v-if="remarkEditing" class="fc-area fc-area--short" :class="{ 'fc-area--err': errs.remark }" :value="form.remark" :maxlength="REMARK_MAX" placeholder="买给哪间房，没有可以不写" placeholder-class="fc-ph" :focus="true" auto-focus :show-confirm-bar="false" @input="form.remark = $event.detail.value" @blur="remarkEditing = false" />
            <view v-else class="fc-area fc-area--short fc-area--idle" :class="{ 'fc-area--err': errs.remark }" hover-class="k-press" @click="remarkEditing = true"><text :class="{ 'fc-ph': !form.remark }">{{ form.remark || '买给哪间房，没有可以不写' }}</text></view>
            <text v-if="errs.remark" class="fc-err">{{ errs.remark }}</text>
          </view>
        </view>
        <text class="fc-footnote">{{ RULE_NOTE }}</text>
        <view class="fc-bar">
          <view v-if="errCount" class="fc-bar__err" hover-class="k-press" @click="jumpToError"><text>还有 {{ errCount }} 项要补，点这里看</text></view>
          <view class="fc-bar__btns"><view class="fc-btn" :class="{ 'fc-btn--off': submitting || uploading }" hover-class="k-press-s" @click="submit"><text>{{ submitLabel }}</text></view></view>
        </view>
      </template>
    </view>

    <k-date-picker v-if="dateOpen" title="选择购买日期" :value="form.purchaseDate || todayCn()" :min-date="MIN_DATE" :max-date="todayCn()" @cancel="dateOpen = false" @confirm="confirmDate" />
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 采购报销（R12，V66，2026-10-31 主人拍板）：直营小院的小院主理人在这里提交，主人在电脑后台看表格、通过或驳回、标记已打款。系统只记账不打款。
// 一页三用，靠地址区分（见 reimburse-logic.js 的 pageOf），返回走页面栈：
//   ?storeId=             这家店的报销表（工作台入口）
//   ?id=&storeId=         一笔的详情；通过、驳回、打款的通知点开就是这个地址（服务端 KgReimburseService.route 写死的）
//   ?id=&edit=1&storeId=  驳回后修改再交
//   ?create=1&storeId=    新增
// 接口直接用 common/request.js，不进主包的 common/api.js。金额是字符串，页面不转数字；按钮看服务端给的 canEdit、canWithdraw。
// ---------------------------------------------------------------------------
import { computed, reactive, ref, watch } from 'vue'
import { onHide, onLoad, onPullDownRefresh, onReachBottom, onShow, onUnload } from '@dcloudio/uni-app'
import { del, get, post, put } from '@/common/request.js'
import { back, go, replace, toast } from '@/common/screen.js'
import { alert, confirm, errText, todayCn } from '@/common/ui.js'
import { absUrl, chooseImages, uploadTo } from '@/common/upload.js'
import { currentStaffStore, ensureSession, staffStores } from '@/common/experience.js'
import {
  FIELD_ORDER, ITEM_MAX, MAX_RECEIPTS, MIN_DATE, REIMBURSE_API, REMARK_MAX, RULE_NOTE,
  alreadySubmitted, cnDate, cnTime, createUrl, detailUrl, editUrl, formErrors, formFromRow, listUrl, mergeRows, newForm, pageOf, payloadOf, statusHint, statusTone, submitterText, tabsOf
} from './reimburse-logic.js'

const mode = ref('list')
const rowId = ref(null)
const storeId = ref(null)

// 带了门店就看那家（通知、工作台入口都带）；没带用当前门店，当前门店不是小院主理人身份时不传，服务端取第一家
const storeFrom = (q) => {
  if (q && q.storeId) return q.storeId
  const current = currentStaffStore.value
  return current && ['keeper', 'city_lead'].includes(current.roleCode) ? current.storeId : null
}
let ready = Promise.resolve()
onLoad((q) => {
  const page = pageOf(q)
  mode.value = page.mode
  rowId.value = page.id
  ready = start(q)
})
async function start(q) {
  await ensureSession()
  storeId.value = storeFrom(q)
  if (mode.value === 'form') await openForm()
}
onShow(async () => {
  await ready
  if (mode.value === 'list') reload()
  if (mode.value === 'detail') loadDetail()
})
onReachBottom(() => { if (mode.value === 'list') more() })
onPullDownRefresh(async () => {
  try {
    if (mode.value === 'list') await reload()
    if (mode.value === 'detail') await loadDetail()
  } finally {
    uni.stopPullDownRefresh()
  }
})
// 没有上一页（链接直接打开）时不退回首页，回报销表
const leavePage = () => { if (getCurrentPages().length > 1) back(); else replace(listUrl(storeId.value)) }
const preview = (list, index) => uni.previewImage({ current: index, urls: list.map(absUrl) })
// 没权限、已撤回，重试也一样，不放「重新加载」
const canRetry = (e) => !(e && (e.code === 403 || e.code === 404))

// ---------------------------------------------------------------- 列表
const store = ref(null)
const rows = ref([])
const counts = ref({})
const status = ref('')
const hasMore = ref(false)
const listLoading = ref(false)
const listLoaded = ref(false)
const listError = ref('')
const listRetry = ref(true)
const tabs = computed(() => tabsOf(counts.value))
const listStateText = computed(() => {
  if (listError.value) return listError.value
  if (!listLoaded.value) return '正在读取…'
  if (!status.value) return '还没有报销记录'
  const tab = tabs.value.find(one => one.value === status.value)
  return '没有' + (tab ? tab.label : '') + '的报销'
})
let listSeq = 0
let loadedPages = 1
let rowsStatus = ''
// 回到这一页（看完详情、改完、交完）都重新取：翻过几页就取几页，一起换上，已经滑到的位置不跳
async function reload() {
  const seq = ++listSeq
  const wanted = status.value
  listLoading.value = true
  listError.value = ''
  try {
    let collected = []
    let last = {}
    let page = 1
    for (; page <= loadedPages; page++) {
      last = (await get(REIMBURSE_API, { storeId: storeId.value, status: wanted, page })).data || {}
      if (seq !== listSeq) return
      collected = mergeRows(collected, last.rows)
      if (!last.hasMore) break
    }
    loadedPages = Math.max(1, Math.min(page, loadedPages))
    rows.value = collected
    rowsStatus = wanted
    counts.value = last.counts || {}
    hasMore.value = !!last.hasMore
    if (last.store) {
      store.value = last.store
      storeId.value = last.store.storeId
    }
    listLoaded.value = true
  } catch (e) {
    if (seq !== listSeq) return
    // 刷新失败不清空已经看到的；换页签失败要说清楚，不能把上一个页签的行留在这里
    if (rows.value.length && rowsStatus === wanted) toast(errText(e, '刷新失败，请重试'))
    else {
      rows.value = []
      hasMore.value = false
      listError.value = errText(e, '读取失败，请重试')
      listRetry.value = canRetry(e)
    }
  } finally {
    if (seq === listSeq) listLoading.value = false
  }
}
async function more() {
  if (listLoading.value || !hasMore.value) return
  const seq = ++listSeq
  listLoading.value = true
  try {
    const data = (await get(REIMBURSE_API, { storeId: storeId.value, status: status.value, page: loadedPages + 1 })).data || {}
    if (seq !== listSeq) return
    rows.value = mergeRows(rows.value, data.rows)
    hasMore.value = !!data.hasMore
    counts.value = data.counts || counts.value
    loadedPages += 1
  } catch (e) {
    if (seq === listSeq) toast(errText(e, '加载失败，请重试'))
  } finally {
    if (seq === listSeq) listLoading.value = false
  }
}
function pickStatus(value) {
  if (status.value === value) return
  status.value = value
  // 网慢时上一个页签的行不能留在这个页签底下：先收起来，写「正在读取」
  rows.value = []
  hasMore.value = false
  listLoaded.value = false
  loadedPages = 1
  reload()
}
const openRow = (one) => go(detailUrl(one.reimburseId, one.storeId || storeId.value))
const openCreate = () => go(createUrl(storeId.value))

// ---------------------------------------------------------------- 详情
const row = ref(null)
const detailError = ref('')
const detailRetry = ref(true)
const acting = ref(false)
let detailSeq = 0
async function loadDetail() {
  const seq = ++detailSeq
  detailError.value = ''
  try {
    const data = (await get(REIMBURSE_API + '/' + rowId.value)).data || null
    if (seq !== detailSeq) return
    row.value = data
    if (data && data.storeId) storeId.value = data.storeId
    if (!data) detailError.value = '报销不存在或已撤回'
  } catch (e) {
    if (seq !== detailSeq) return
    row.value = null
    detailError.value = errText(e, '读取失败，请重试')
    detailRetry.value = canRetry(e)
  }
}
const openEdit = () => go(editUrl(rowId.value, storeId.value))
async function withdraw() {
  if (acting.value || !row.value || !row.value.canWithdraw) return
  if (!(await confirm('撤回这笔报销？', '撤回后平台就看不到了，要报销得重新提交。'))) return
  acting.value = true
  try {
    const out = await del(REIMBURSE_API + '/' + rowId.value)
    toast(out.msg || '已撤回')
    leavePage()
  } catch (e) {
    // 多半是平台刚审完：说清原因，再按最新状态显示
    await alert('撤回失败', errText(e, '撤回失败，请重试'))
    loadDetail()
  } finally {
    acting.value = false
  }
}

// ---------------------------------------------------------------- 填写
const form = reactive(newForm())
const formLoading = ref(false)
const formBlock = ref('')
const formStoreName = ref('')
const rejectReason = ref('')
const tried = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const dateOpen = ref(false)
const remarkEditing = ref(false)
let baseline = ''
// 管几家小院才写钱记到哪家；只管一家不多占一行
const manyStores = computed(() => staffStores.value.filter(grant => ['keeper', 'city_lead'].includes(grant.roleCode)).length > 1)
const itemCount = computed(() => Array.from(form.itemName || '').length)
const remarkCount = computed(() => Array.from(form.remark || '').length)
// 点过一次提交才开始标红，还没填的时候不吓人；之后改一项消一项
const errs = computed(() => (tried.value ? formErrors(form, todayCn()) : {}))
const errCount = computed(() => Object.keys(errs.value).length)
const submitLabel = computed(() => {
  if (submitting.value) return '提交中…'
  if (uploading.value) return '照片上传中…'
  return rowId.value ? '改好了，再交一次' : '提交报销'
})
async function openForm() {
  if (rowId.value) {
    formLoading.value = true
    try {
      const data = (await get(REIMBURSE_API + '/' + rowId.value)).data || {}
      if (!data.canEdit) formBlock.value = '这一笔现在不能修改，请回到详情看最新状态'
      else {
        Object.assign(form, formFromRow(data))
        rejectReason.value = data.rejectReason || ''
        formStoreName.value = data.storeName || ''
        storeId.value = data.storeId || storeId.value
      }
    } catch (e) {
      formBlock.value = errText(e, '读取失败，请返回重试')
    } finally {
      formLoading.value = false
    }
  } else {
    // 表单先出来；门店名、能不能交听服务端的。读不到不挡填写，提交时服务端还会查一遍
    get(REIMBURSE_API + '/access', { storeId: storeId.value }).then((res) => {
      const data = res.data || {}
      formStoreName.value = data.storeName || ''
      if (data.storeId) storeId.value = data.storeId
      if (!data.canSubmit) formBlock.value = '只有直营小院的小院主理人可以提交采购报销'
    }).catch(() => {})
  }
  baseline = JSON.stringify(form)
}
const formDirty = () => JSON.stringify(form) !== baseline
async function leaveForm() {
  if (uploading.value || submitting.value) return toast('正在处理，请稍候')
  if (formDirty() && !(await confirm(rowId.value ? '先不改了？' : '先不交了？', '已经填的内容不会保存。'))) return
  leavePage()
}
function confirmDate(date) {
  dateOpen.value = false
  if (date) form.purchaseDate = date
}
async function addReceipts() {
  if (uploading.value || submitting.value) return
  const left = MAX_RECEIPTS - form.receipts.length
  if (left <= 0) return
  const paths = await chooseImages(left)
  if (!paths || !paths.length) return
  uploading.value = true
  uni.showLoading({ title: '上传中', mask: true })
  let failed = 0
  let lastError = null
  try {
    for (const path of paths) {
      if (form.receipts.length >= MAX_RECEIPTS) break
      try {
        const url = (await uploadTo('/app/upload/image', path))?.data?.url
        if (url && !form.receipts.includes(url)) form.receipts.push(url)
      } catch (e) {
        failed++
        lastError = e
      }
    }
  } finally {
    uni.hideLoading()
    uploading.value = false
  }
  if (failed) toast(failed === paths.length ? errText(lastError, '照片上传失败，请重试') : `有 ${failed} 张没传上，可以再加一次`)
}
const removeReceipt = (index) => { form.receipts.splice(index, 1) }
// 顶栏盖着上面一截：字段名要露在顶栏下面。网页版不认 offsetTop，照常滚
function scrollToField(key) {
  if (typeof uni === 'undefined' || !uni.pageScrollTo) return
  let bar = 76
  try { bar = (uni.getSystemInfoSync().statusBarHeight || 20) + 56 } catch (e) { bar = 76 }
  try { uni.pageScrollTo({ selector: '#rb-' + key, duration: 200, offsetTop: -bar }) } catch (e) { /* 定位不到就算了，红字和提示照样有 */ }
}
function jumpToError() {
  const first = FIELD_ORDER.find(key => errs.value[key])
  if (!first) return
  toast(errs.value[first])
  scrollToField(first)
}
async function submit() {
  if (submitting.value) return
  if (uploading.value) return toast('照片还在上传，请稍候')
  tried.value = true
  if (errCount.value) return jumpToError()
  submitting.value = true
  const body = payloadOf(form)
  try {
    const out = rowId.value
      ? await put(REIMBURSE_API + '/' + rowId.value, body)
      : await post(REIMBURSE_API, body, { params: { storeId: storeId.value } })
    baseline = JSON.stringify(form)
    toast(out.msg || '提交好了，等平台审核')
    leavePage()
  } catch (e) {
    // 连点、超时后重试：服务端说这一笔已经进表了，当成功回去
    if (alreadySubmitted(e)) {
      baseline = JSON.stringify(form)
      toast(e.message)
      leavePage()
      return
    }
    await alert('提交失败', errText(e, '提交失败，填的内容还在，请重试'))
    // 修改时平台那边状态变了（比如已经再交成功了）：回详情看最新状态
    if (rowId.value && e && e.code === 409) {
      baseline = JSON.stringify(form)
      leavePage()
    }
  } finally {
    submitting.value = false
  }
}

// H5 锁页面滚动（小程序靠顶上的 page-meta）
let restoreScroll = null
function lockPageScroll(on) {
  // #ifdef H5
  if (typeof document === 'undefined') return
  if (on && !restoreScroll) {
    const body = document.body
    const before = body.style.overflow
    body.style.overflow = 'hidden'
    restoreScroll = () => { body.style.overflow = before }
  } else if (!on && restoreScroll) {
    restoreScroll()
    restoreScroll = null
  }
  // #endif
}
watch(dateOpen, (open) => lockPageScroll(open))
onHide(() => lockPageScroll(false))
onUnload(() => {
  listSeq++
  detailSeq++
  lockPageScroll(false)
})
</script>

<style scoped lang="scss">
@import './form-clean.scss';

.rb-store { padding-bottom: 10px; overflow-wrap: anywhere; }
// 主人要写明的那一句：显眼，就一句
.rb-rule { display: block; margin: 0 16px; padding: 10px 12px; border-radius: 12px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 16px; font-weight: 600; line-height: 24px; text-align: center; }
.rb-closed { margin-top: 0; }
.rb-tabs { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; padding: 12px 16px 16px; }
.rb-tab { min-height: 60px; border-radius: 12px; background: var(--k-paper2); color: var(--k-ink2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.rb-tab.on { background: var(--k-red-deep); color: var(--k-paper); }
.rb-tab__t { font-size: 14px; line-height: 20px; white-space: nowrap; }
.rb-tab__n { font-size: 18px; font-weight: 600; line-height: 24px; }

.rb-row { position: relative; box-sizing: border-box; min-height: 76px; padding: 12px 10px 12px 16px; display: flex; align-items: center; gap: 8px; }
.rb-row::after { content: ''; position: absolute; left: 16px; right: 0; bottom: 0; height: 1px; background: var(--k-line); }
.rb-row:last-child::after { display: none; }
.rb-row__main { flex: 1; min-width: 0; }
.rb-row__title { display: flex; align-items: baseline; gap: 6px; }
.rb-row__name { min-width: 0; font-size: 16px; font-weight: 500; line-height: 24px; color: var(--k-ink); }
.rb-row__qty { flex-shrink: 0; font-size: 14px; line-height: 24px; color: var(--k-muted); }
.rb-row__meta { display: block; font-size: 14px; line-height: 22px; color: var(--k-muted); }
.rb-row__reason { display: block; font-size: 14px; line-height: 22px; color: var(--k-alert); }
.rb-row__side { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.rb-row__amount { font-size: 17px; font-weight: 700; line-height: 24px; color: var(--k-ink); font-variant-numeric: tabular-nums; }
// 状态：字写着，颜色帮着认。对比度都在 4.5:1 以上
.rb-tag { display: inline-block; padding: 0 8px; border-radius: 4px; font-size: 13px; line-height: 24px; white-space: nowrap; }
.rb-tag--wait { background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
.rb-tag--pass { background: var(--k-indigo-soft); color: var(--k-indigo); }
.rb-tag--back { background: var(--k-alert-soft); color: var(--k-alert); }
.rb-tag--paid { background: var(--k-green-soft); color: var(--k-green); }

.rb-state { padding: 40px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.rb-state__t { font-size: 15px; line-height: 24px; color: var(--k-muted); text-align: center; }
.rb-retry { min-height: 44px; padding: 0 20px; border-radius: 12px; background: var(--k-paper2); display: flex; align-items: center; font-size: 15px; color: var(--k-ink); }
.rb-more { text-align: center; }

.rb-sum { padding: 16px; }
.rb-sum__top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rb-sum__hint { font-size: 14px; line-height: 24px; color: var(--k-ink2); }
.rb-sum__amount { display: block; margin-top: 10px; font-size: 30px; font-weight: 700; line-height: 38px; color: var(--k-ink); font-variant-numeric: tabular-nums; }
.rb-sum__name { display: block; font-size: 16px; line-height: 24px; color: var(--k-ink); overflow-wrap: anywhere; }
.rb-remark { display: block; font-size: 16px; line-height: 26px; color: var(--k-ink2); white-space: pre-wrap; overflow-wrap: anywhere; }
// 撤回是危险操作，用提醒红的浅底（4.5:1），不抢「修改后再交」那种主操作的实心棕
.rb-btn--danger { background: var(--k-alert-soft); color: var(--k-alert); }
.rb-err--sub { margin-top: 0; }
</style>
