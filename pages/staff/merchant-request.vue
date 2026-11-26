<template>
  <view class="k-page mreq">
    <k-topbar :title="pageTitle" back />
    <view class="k-body k-pad-safe">
      <!-- 新申请（?type=managed | cloud_chain）或被退回后修改：需求说明、联系人、电话、可传图 -->
      <view v-if="editing" class="card form">
        <text class="form__tip">{{ tip }}</text>
        <view v-if="returnReason" class="reason"><text class="reason__label">退回原因</text><text>{{ returnReason }}</text></view>
        <k-field v-model="form.content" label="需求说明" required type="textarea" counter placeholder="店在哪、现在什么情况、想要什么帮助" :maxlength="2000" />
        <k-field v-model="form.contactName" row label="联系人" required placeholder="怎么称呼你" :maxlength="32" />
        <k-field v-model="form.contactPhone" row label="电话" required type="number" placeholder="11 位手机号" :maxlength="11" />
        <view class="pics">
          <view class="pics__label"><text>图片</text><text class="pics__hint">选填，最多 {{ MAX_IMAGES }} 张</text></view>
          <view class="pics__grid">
            <view v-for="(url, i) in form.images" :key="url" class="pic">
              <image class="pic__img" :src="absUrl(url)" mode="aspectFill" @click="preview(i, form.images)" />
              <view class="pic__del" hover-class="k-press-s" @click="removeImage(i)"><k-icon name="x" :size="13" color="white" :stroke="2.4" /></view>
            </view>
            <view v-if="form.images.length < MAX_IMAGES" class="pic pic--add" hover-class="k-press-s" @click="addImages"><k-icon name="image-plus" :size="24" color="muted" /></view>
          </view>
        </view>
        <view class="form__agree"><merchant-agreement v-if="(applyType || detail?.requestType) === 'managed'" ref="merchantAgreement" :store-id="storeId" type="managed" /></view>
        <k-button block :disabled="submitting || uploading" :label="submitting ? '提交中…' : '提交'" @click="submit" />
      </view>

      <!-- 一条需求的进度（?id=）。核实备注、接手人服务端不给，这里只有商家自己该看的 -->
      <template v-else-if="detail">
        <view class="card head">
          <view class="head__row"><text class="tag">{{ detail.typeLabel }}</text><text class="status" :class="'is-' + tone">{{ staffWording(detail.statusLabel) }}</text></view>
          <text class="head__title">{{ detail.title }}</text>
          <text class="head__meta">{{ metaLine }}</text>
        </view>
        <view class="card">
          <text class="sec">进度</text>
          <view v-for="(step, i) in steps" :key="step.label" class="step" :class="'is-' + step.state">
            <view class="step__rail"><view class="step__dot"><k-icon v-if="step.state === 'done'" name="check" :size="11" color="white" :stroke="3" /></view><view v-if="i < steps.length - 1" class="step__line" /></view>
            <text class="step__text">{{ step.label }}</text>
          </view>
        </view>
        <view v-if="detail.returnReason" class="reason"><text class="reason__label">退回原因</text><text>{{ detail.returnReason }}</text></view>
        <view class="card">
          <text class="sec">提交的内容</text>
          <text class="body">{{ detail.content || '—' }}</text>
          <view v-if="detail.images && detail.images.length" class="pics__grid pics__grid--view">
            <image v-for="(url, i) in detail.images" :key="url" class="pic pic__img" :src="absUrl(url)" mode="aspectFill" @click="preview(i, detail.images)" />
          </view>
          <text v-if="detail.contactName || detail.contactPhone" class="contact">联系人：{{ detail.contactName }} {{ detail.contactPhone }}</text>
        </view>
        <k-button v-if="detail.canEdit" block label="修改后再提交" @click="startEdit" />
        <k-button v-if="followUp" block type="outline" :label="followUp.label" @click="go(followUp.url)" />
      </template>

      <view v-else class="state"><text class="k-meta">{{ loadError || '正在读取…' }}</text><k-button v-if="loadError && requestId" type="ghost" size="sm" label="重新加载" @click="load" /></view>
    </view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 商家需求（V63，2026-10-30）：
//   ?type=managed | cloud_chain  申请代运营 / 抖音卖房（POST /app/staff/merchant/requests）；
//   ?id=  看一条需求的进度（GET .../{id}）；被退回的可以改了再交（PUT .../{id}），线上任务回发布表单里改。
// 接口直接用 common/request.js，不进主包的 common/api.js。
// 2026-11-03 主人：简化商家端文案——状态字、提交后的提示里的「换工主理人 / 商家服务人」都换成「袋鼠工作人员」（staffWording），进度条三步（requestSteps）。
// ---------------------------------------------------------------------------
import { computed, reactive, ref, watch } from 'vue'
import MerchantAgreement from './components/merchant-agreement.vue'
const merchantAgreement = ref(null)
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { get, post, put } from '@/common/request.js'
import { go, replace, toast } from '@/common/screen.js'
import { alert, errText } from '@/common/ui.js'
import { absUrl, chooseImages, uploadTo } from '@/common/upload.js'
import { currentStaffStoreId, ensureSession, experience } from '@/common/experience.js'
import R from '@/common/routes.js'
import { APPLY_KINDS, REQUEST_API, formProblem, requestFollowUp, requestSteps, requestTone, resubmitUrl, staffWording } from './merchant-request-logic.js'

const MAX_IMAGES = 9
const requestId = ref(null)
const applyType = ref('')
const storeId = ref(null)
const detail = ref(null)
const loadError = ref('')
const editing = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const form = reactive({ content: '', contactName: '', contactPhone: '', images: [] })
let generation = 0, initialized = false, uploadIndicator = false
function invalidate() {
  generation++
  initialized = false
  if (uploadIndicator) { uni.hideLoading(); uploadIndicator = false }
  uploading.value = false
  submitting.value = false
  detail.value = null
  requestId.value = null
  storeId.value = null
  applyType.value = ''
  editing.value = false
  Object.assign(form, { content: '', contactName: '', contactPhone: '', images: [] })
}
watch([() => experience.account?.id, () => experience.mode], () => {
  if (!initialized) return
  invalidate()
  loadError.value = '当前身份已切换，请返回商家首页重新进入'
}, { flush: 'sync' })
onUnload(invalidate)

const kind = computed(() => APPLY_KINDS[applyType.value] || APPLY_KINDS[detail.value?.requestType] || null)
const pageTitle = computed(() => {
  if (requestId.value == null) return kind.value ? kind.value.title : '我的需求'
  return editing.value ? '修改后再提交' : '需求进度'
})
const tip = computed(() => kind.value ? kind.value.tip : '')
const returnReason = computed(() => (editing.value && detail.value && detail.value.returnReason) || '')
const steps = computed(() => detail.value ? requestSteps(detail.value.requestType, detail.value.status) : [])
const tone = computed(() => detail.value ? requestTone(detail.value.status) : 'wait')
const metaLine = computed(() => {
  const d = detail.value || {}
  return [d.storeName, d.createTime ? String(d.createTime).slice(0, 10) + ' 提交' : ''].filter(Boolean).join(' · ')
})
const followUp = computed(() => requestFollowUp(detail.value, R))

async function load() {
  const current = generation
  loadError.value = ''
  try {
    const res = await get(REQUEST_API + '/' + requestId.value, { storeId: storeId.value })
    if (generation !== current) return
    detail.value = res.data || null
    if (!detail.value) loadError.value = '这条需求不存在'
  } catch (e) {
    if (generation === current) loadError.value = errText(e, '读取失败，请重试')
  }
}
// 新申请：联系人先带上上一条需求留的（没有就用昵称），可以改
async function prefillContact() {
  const current = generation, initialName = experience.account?.nickname || ''
  form.contactName = initialName
  try {
    const last = ((await get(REQUEST_API, { storeId: storeId.value, pageSize: 1 })).data || {}).rows?.[0]
    if (generation === current && last && last.contactPhone) {
      if (last.contactName && form.contactName === initialName) form.contactName = last.contactName
      if (!form.contactPhone) form.contactPhone = last.contactPhone
    }
  } catch (e) { /* 带不上就自己填 */ }
}
onLoad(async (q) => {
  const current = generation
  await ensureSession()
  if (generation !== current) return
  initialized = true
  storeId.value = q?.storeId || currentStaffStoreId()
  if (/^[1-9]\d*$/.test(String(q?.id || ''))) {
    requestId.value = String(q.id)
    load()
  } else if (APPLY_KINDS[q?.type]) {
    applyType.value = q.type
    editing.value = true
    prefillContact()
  } else {
    loadError.value = '没有这条需求'
  }
})

function startEdit() {
  const d = detail.value
  if (d.requestType === 'online_task') return replace(resubmitUrl(d, R))
  Object.assign(form, { content: d.content || '', contactName: d.contactName || '', contactPhone: d.contactPhone || '', images: [...(d.images || [])] })
  editing.value = true
}

async function addImages() {
  if (!editing.value || uploading.value || submitting.value) return
  const current = generation
  uploading.value = true
  let failed = 0
  let lastError = null
  try {
    const paths = await chooseImages(MAX_IMAGES - form.images.length)
    if (current !== generation || !paths?.length) return
    uni.showLoading({ title: '上传中', mask: true })
    uploadIndicator = true
    for (const p of paths) {
      if (current !== generation || form.images.length >= MAX_IMAGES) break
      try {
        const url = (await uploadTo('/app/upload/image', p))?.data?.url
        if (current !== generation) return
        if (url && !form.images.includes(url)) form.images.push(url)
      } catch (e) {
        failed++
        lastError = e
      }
    }
    if (current === generation && failed) toast(failed === paths.length ? errText(lastError, '图片上传失败，请重试') : `有 ${failed} 张没传上，可以再加一次`)
  } catch (e) {
    if (current === generation) toast(errText(e, '图片选择失败，请重试'))
  } finally {
    if (current === generation) {
      if (uploadIndicator) { uni.hideLoading(); uploadIndicator = false }
      uploading.value = false
    }
  }
}
const removeImage = (i) => { form.images.splice(i, 1) }
const preview = (i, list) => uni.previewImage({ current: i, urls: list.map(absUrl) })

async function submit() {
  if (!editing.value || submitting.value || uploading.value) return
  const current = generation
  const bad = formProblem(form)
  if (bad) return toast(bad)
  submitting.value = true
  const body = { content: form.content.trim(), contactName: form.contactName.trim(), contactPhone: String(form.contactPhone).trim(), images: [...form.images] }
  const opts = { params: { storeId: storeId.value } }
  try {
    if ((applyType.value || detail.value?.requestType) === 'managed' && !await merchantAgreement.value?.confirm()) return
    if (current !== generation) return
    const out = requestId.value == null
      ? await post(REQUEST_API, { ...body, requestType: applyType.value }, opts)
      : await put(REQUEST_API + '/' + requestId.value, body, opts)
    if (current !== generation) return
    await alert('已提交', staffWording((out.data && out.data.message) || out.msg || ''))
    // 回首页：「我发布的」重新读，能看到这一条的进度
    if (current === generation) uni.reLaunch({ url: R.staff })
  } catch (e) {
    if (current === generation) toast(errText(e, '提交失败，请重试'))
  } finally {
    if (current === generation) submitting.value = false
  }
}
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边、不加阴影），页边距 12、卡片之间 8；标题用系统黑体，状态、类型收成小标签。
   填写那张卡（需求说明、联系人、电话、图片）的字号和输入框高度没动，只收圆角和间距 */
.mreq { --k-bg: #F7F5F2; --k-sh1: none; background: #F7F5F2; font-size: 14px; line-height: 1.6; }
.mreq :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
.mreq :deep(.k-button) { border-radius: 999px; }
.mreq .k-body { display: flex; flex-direction: column; gap: 8px; padding: 8px 12px calc(16px + var(--k-safe-bottom)); }
.card { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.form { gap: 14px; padding: 14px 12px; }
.form__tip { font-size: 13px; color: var(--k-ink2); }
/* 协议入口组件自己左右留 12、上下留 10：这里抵掉左右，和输入框对齐；上下各收 7，没有协议时这一层不多占地方 */
.form__agree { margin: -7px -12px; }
/* 协议入口本身是白卡，放在这张白卡里会看不见边、文字像没对齐：这里换成页面那种浅灰底，成为卡里一块浅色小区域（左边缘和输入框对齐） */
.form__agree :deep(.ma__entry) { background: #F7F5F2; }
.reason { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: var(--k-alert-soft); font-size: 13px; color: var(--k-alert); }
.reason__label { font-size: 12px; font-weight: 600; }
.pics { display: flex; flex-direction: column; gap: 8px; }
.pics__label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--k-ink); }
.pics__hint { font-weight: 400; color: var(--k-light); }
.pics__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.pics__grid--view { margin-top: 2px; }
.pic { position: relative; width: 100%; height: 72px; border-radius: 8px; overflow: hidden; background: var(--k-paper2); }
.pic__img { display: block; width: 100%; height: 72px; border-radius: 8px; }
.pic__del { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 50%; background: rgba(58, 50, 43, .62); display: flex; align-items: center; justify-content: center; }
.pic--add { display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px var(--k-line2); }
.head { gap: 6px; }
.head__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tag { height: 17px; padding: 0 5px; border-radius: 4px; background: #F5F1EB; font-size: 10px; font-weight: 500; line-height: 17px; color: var(--k-ink2); }
.status { font-size: 12px; font-weight: 600; color: var(--k-red-deep); }
.status.is-good { color: var(--k-green); }
.status.is-bad { color: var(--k-alert); }
.status.is-mute { color: var(--k-muted); }
.head__title { font-family: var(--k-sans); font-size: 16px; font-weight: 700; line-height: 22px; color: var(--k-ink); }
.head__meta { font-size: 11px; color: var(--k-muted); }
/* 卡内小标题（11-18）：14 / 600，和员工那边的需求详情（k-request-detail 的 .req-card__label）一致 */
.sec { font-family: var(--k-sans); font-size: 14px; font-weight: 600; color: var(--k-ink); }
.step { display: flex; align-items: flex-start; gap: 10px; }
.step__rail { display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; width: 18px; }
.step__dot { width: 18px; height: 18px; border-radius: 50%; background: var(--k-paper2); box-shadow: inset 0 0 0 1px var(--k-line2); display: flex; align-items: center; justify-content: center; }
.step__line { width: 2px; height: 16px; background: var(--k-line2); }
.step.is-done .step__dot { background: var(--k-red); box-shadow: none; }
.step.is-done .step__line { background: var(--k-red); }
.step.is-now .step__dot { background: var(--k-red-soft); box-shadow: inset 0 0 0 2px var(--k-red); }
.step__text { font-size: 13px; line-height: 18px; color: var(--k-muted); }
.step.is-done .step__text { color: var(--k-ink2); }
.step.is-now .step__text { color: var(--k-ink); font-weight: 600; }
.body { font-size: 13px; line-height: 1.7; color: var(--k-ink2); white-space: pre-wrap; word-break: break-all; }
.contact { font-size: 12px; color: var(--k-muted); }
.state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 0; }
/* 进度屏底下直接摆在页面上的按钮（「修改后再提交」「查看报名与成果」）：主按钮 44 高；次按钮暖棕细边、暖棕字。
   只选 .k-body 的直接子级，填写屏卡片里那个 48 高的「提交」按填写页规定不动 */
.mreq .k-body > :deep(.k-button.is-lg) { height: 44px; font-size: 15px; }
.mreq .k-body > :deep(.k-button.is-outline) { border-color: var(--k-red-line); color: var(--k-red-deep); }
</style>
