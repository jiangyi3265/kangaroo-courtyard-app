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
        <merchant-agreement v-if="(applyType || detail?.requestType) === 'managed'" ref="merchantAgreement" :store-id="storeId" type="managed" />
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

      <view v-else class="state"><text class="k-meta">{{ loadError || '正在读取…' }}</text><k-button v-if="loadError" type="ghost" size="sm" label="重新加载" @click="load" /></view>
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
import { computed, reactive, ref } from 'vue'
import MerchantAgreement from './components/merchant-agreement.vue'
const merchantAgreement = ref(null)
import { onLoad } from '@dcloudio/uni-app'
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
  loadError.value = ''
  try {
    detail.value = (await get(REQUEST_API + '/' + requestId.value, { storeId: storeId.value })).data || null
    if (!detail.value) loadError.value = '这条需求不存在'
  } catch (e) {
    loadError.value = errText(e, '读取失败，请重试')
  }
}
// 新申请：联系人先带上上一条需求留的（没有就用昵称），可以改
async function prefillContact() {
  if (experience.account && experience.account.nickname) form.contactName = experience.account.nickname
  try {
    const last = ((await get(REQUEST_API, { storeId: storeId.value, pageSize: 1 })).data || {}).rows?.[0]
    if (last && last.contactPhone) {
      if (last.contactName) form.contactName = last.contactName
      if (!form.contactPhone) form.contactPhone = last.contactPhone
    }
  } catch (e) { /* 带不上就自己填 */ }
}
onLoad(async (q) => {
  await ensureSession()
  storeId.value = q?.storeId || currentStaffStoreId()
  if (Number(q?.id)) {
    requestId.value = Number(q.id)
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
  if (uploading.value) return
  const paths = await chooseImages(MAX_IMAGES - form.images.length)
  if (!paths || !paths.length) return
  uploading.value = true
  uni.showLoading({ title: '上传中', mask: true })
  let failed = 0
  let lastError = null
  try {
    for (const p of paths) {
      if (form.images.length >= MAX_IMAGES) break
      try {
        const url = (await uploadTo('/app/upload/image', p))?.data?.url
        if (url && !form.images.includes(url)) form.images.push(url)
      } catch (e) {
        failed++
        lastError = e
      }
    }
  } finally {
    uni.hideLoading()
    uploading.value = false
  }
  if (failed) toast(failed === paths.length ? errText(lastError, '图片上传失败，请重试') : `有 ${failed} 张没传上，可以再加一次`)
}
const removeImage = (i) => { form.images.splice(i, 1) }
const preview = (i, list) => uni.previewImage({ current: i, urls: list.map(absUrl) })

async function submit() {
  if (submitting.value || uploading.value) return
  const bad = formProblem(form)
  if (bad) return toast(bad)
  submitting.value = true
  const body = { content: form.content.trim(), contactName: form.contactName.trim(), contactPhone: String(form.contactPhone).trim(), images: [...form.images] }
  const opts = { params: { storeId: storeId.value } }
  try {
    if ((applyType.value || detail.value?.requestType) === 'managed' && !await merchantAgreement.value?.confirm()) return
    const out = requestId.value == null
      ? await post(REQUEST_API, { ...body, requestType: applyType.value }, opts)
      : await put(REQUEST_API + '/' + requestId.value, body, opts)
    await alert('已提交', staffWording((out.data && out.data.message) || out.msg || ''))
    // 回首页：「我发布的」重新读，能看到这一条的进度
    uni.reLaunch({ url: R.staff })
  } catch (e) {
    toast(errText(e, '提交失败，请重试'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
@import '../../styles/look.scss';
.mreq { --k-bg: #{$look-bg-top}; background: $look-bg; font-size: 14px; line-height: 1.6; }
.mreq .k-body { display: flex; flex-direction: column; gap: 12px; }
.card { display: flex; flex-direction: column; gap: 10px; padding: 16px 14px; border-radius: 20px; background: var(--k-paper); border: $look-hairline; box-shadow: $look-shadow; }
.form { gap: 14px; }
.form__tip { font-size: 13px; color: var(--k-ink2); }
.reason { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 14px; background: #FBEEE9; font-size: 14px; color: #8C3B28; }
.reason__label { font-size: 12px; font-weight: 600; }
.pics { display: flex; flex-direction: column; gap: 8px; }
.pics__label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--k-ink); }
.pics__hint { font-weight: 400; color: var(--k-light); }
.pics__grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.pics__grid--view { margin-top: 2px; }
.pic { position: relative; width: 100%; height: 72px; border-radius: 10px; overflow: hidden; background: var(--k-paper2); }
.pic__img { display: block; width: 100%; height: 72px; border-radius: 10px; }
.pic__del { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border-radius: 50%; background: rgba(58, 50, 43, .62); display: flex; align-items: center; justify-content: center; }
.pic--add { display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px var(--k-line2); }
.head { gap: 6px; }
.head__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.tag { height: 22px; padding: 0 8px; border-radius: 11px; background: var(--k-paper2); font-size: 12px; line-height: 22px; color: var(--k-ink2); }
.status { font-size: 13px; font-weight: 600; color: #8A5E36; }
.status.is-good { color: var(--k-green); }
.status.is-bad { color: #B4472E; }
.status.is-mute { color: var(--k-muted); }
.head__title { font-family: var(--k-display-font); font-size: 18px; font-weight: 700; color: var(--k-ink); }
.head__meta { font-size: 12px; color: var(--k-muted); }
.sec { font-family: var(--k-display-font); font-size: 15px; font-weight: 700; color: var(--k-ink); }
.step { display: flex; align-items: flex-start; gap: 10px; }
.step__rail { display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; width: 18px; }
.step__dot { width: 18px; height: 18px; border-radius: 50%; background: var(--k-paper2); box-shadow: inset 0 0 0 1px var(--k-line2); display: flex; align-items: center; justify-content: center; }
.step__line { width: 2px; height: 16px; background: var(--k-line2); }
.step.is-done .step__dot { background: var(--k-red); box-shadow: none; }
.step.is-done .step__line { background: var(--k-red); }
.step.is-now .step__dot { background: #F8EEE2; box-shadow: inset 0 0 0 2px var(--k-red); }
.step__text { font-size: 14px; line-height: 18px; color: var(--k-muted); }
.step.is-done .step__text { color: var(--k-ink2); }
.step.is-now .step__text { color: var(--k-ink); font-weight: 600; }
.body { font-size: 14px; color: var(--k-ink); white-space: pre-wrap; word-break: break-all; }
.contact { font-size: 13px; color: var(--k-ink2); }
.state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 0; }
</style>
