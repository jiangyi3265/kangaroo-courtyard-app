<template>
  <view class="trip-sign">
    <text class="ts-title">换工三方协议</text>
    <text class="ts-hint">你填写确认后，由本次报名的店家核对确认。双方完成后可继续订票与到店准备。</text>
    <template v-if="record && !editing">
      <view class="ts-status"><text>{{ statusText }}</text><text>协议编号：{{ record.agreementNo }}</text><text>本人确认：{{ time(record.signedTime) }}</text><text v-if="record.merchantSigner">店家确认人：{{ record.merchantSigner }}</text><text v-if="record.merchantSignedTime">店家处理时间：{{ time(record.merchantSignedTime) }}</text><text v-if="record.rejectReason">退回原因：{{ record.rejectReason }}</text></view>
      <button class="ts-secondary" :disabled="busy" @click="showRecord = !showRecord">{{ showRecord ? '收起原文' : '查看本次确认原文' }}</button>
      <text v-if="showRecord" class="ts-document" selectable>{{ record.contentMasked }}</text>
      <button v-if="record.status === 'pending'" class="ts-primary" :disabled="busy" @click="refresh">刷新店家核对进度</button>
      <button v-else-if="record.status === 'rejected' && doc.status === 'store_confirmed'" class="ts-primary" @click="editing = true">修改填写内容并重新确认</button>
      <button v-else-if="record.status === 'confirmed'" class="ts-primary" @click="$emit('next')">双方已确认，继续到店准备</button>
    </template>
    <template v-else-if="preview">
      <text class="ts-section">确认完整协议</text>
      <text class="ts-hint">请核对所有填写信息及条款。身份证在此脱敏显示，完整号码会加密存入本次确认记录。</text>
      <k-agreement-reader :content-key="preview.hash" :text="preview.text" @read="onPreviewRead" />
      <checkbox-group @change="agree = $event.detail.value.includes('agree')"><label class="ts-check"><checkbox value="agree" :checked="agree" :disabled="busy || !previewRead" color="#966331" /><text>我已阅读并同意以上完整协议，确认填写信息真实准确。</text></label></checkbox-group>
      <button class="ts-primary" :disabled="busy || !previewRead || !agree" @click="submit">{{ busy ? '正在提交…' : '本人确认，提交店家核对' }}</button>
      <button class="ts-secondary" :disabled="busy" @click="preview = null; agree = false">返回修改</button>
    </template>
    <template v-else>
      <text class="ts-section">甲方：本人信息</text>
      <label v-for="f in personalFields" :key="f.key" class="ts-field"><text>{{ f.label }} <text class="ts-required">*</text></text><input v-model="form[f.key]" :maxlength="f.max" :disabled="busy" :placeholder="f.hint" :aria-label="f.label" /></label>
      <label class="ts-field"><text>需告知的健康状况 <text class="ts-required">*</text></text><textarea v-model="form.health" maxlength="500" :disabled="busy" placeholder="与本次出行、协助工作相关的情况，无特殊情况请写无" aria-label="需告知的健康状况" auto-height /></label>
      <checkbox-group @change="form.familyInformed = $event.detail.value.includes('family')"><label class="ts-check"><checkbox value="family" :checked="form.familyInformed" :disabled="busy" color="#966331" /><text>我已告知家属本次旅行安排，并已告知紧急联系人其姓名和电话将用于本次出行的紧急联系。</text></label></checkbox-group>
      <text class="ts-section">乙方：本次报名店家</text>
      <view class="ts-store">
        <view v-for="f in storeFields" :key="f.key" class="ts-store-row"><text>{{ f.label }}</text><text selectable>{{ storeInfo[f.key] || '店家尚未填写' }}</text></view>
      </view>
      <view v-if="missingStoreInfo"><text class="ts-hint">请联系店家补全签约资料，刷新后即可继续。</text><button class="ts-secondary" :disabled="busy" @click="refresh">刷新门店资料</button></view>
      <text class="ts-section">视频沟通内容核对</text>
      <text class="ts-hint">视频沟通中所述的住宿、工作内容、工时、餐食，是否与平台展示一致？</text>
      <radio-group class="ts-radios" @change="form.consistent = $event.detail.value">
        <label class="ts-radio-option"><radio class="ts-radio-input" value="yes" :checked="form.consistent === 'yes'" :disabled="busy" /><k-icon name="circle" :art="form.consistent === 'yes' ? 'radio-on' : 'circle'" :size="18" /><text>是，一致</text></label>
        <label class="ts-radio-option"><radio class="ts-radio-input" value="no" :checked="form.consistent === 'no'" :disabled="busy" /><k-icon name="circle" :art="form.consistent === 'no' ? 'radio-on' : 'circle'" :size="18" /><text>不一致</text></label>
      </radio-group>
      <label v-if="form.consistent === 'no'" class="ts-field"><text>具体差异 <text class="ts-required">*</text></text><textarea v-model="form.differences" maxlength="1000" :disabled="busy" placeholder="写明何处不同，店家将核对后确认或退回" aria-label="具体差异" auto-height /></label>
      <view class="ts-platform"><text>丙方：袋鼠全球青年</text><text>提前通知：2天 · 免费续住：2天</text><text>协议编号和确认日期由系统生成。平台记录在线确认，不生成印章。</text></view>
      <checkbox-group @change="form.privacyAgreed = $event.detail.value.includes('privacy')"><label class="ts-check"><checkbox value="privacy" :checked="form.privacyAgreed" :disabled="busy" color="#966331" /><text>同意平台为本次协议确认及出行安全处理所填身份证、健康状况和联系方式，并向本次店家的授权处理人展示必要信息；完整身份证加密保存、页面脱敏显示。</text></label></checkbox-group>
      <button class="ts-primary" :disabled="busy || missingStoreInfo || doc.status !== 'store_confirmed'" @click="makePreview">{{ busy ? '正在生成…' : '预览完整协议' }}</button>
    </template>
    <text v-if="error" class="ts-error" role="alert">{{ error }}</text>
    <view v-if="doc.history?.length > 1" class="ts-history"><text class="ts-section">历次确认记录</text><button v-for="h in doc.history" :key="h.contractId" class="ts-secondary" :disabled="busy" @click="readHistory(h.contractId)">{{ h.agreementNo }} · {{ h.status === 'rejected' ? '已退回' : h.status === 'confirmed' ? '双方已确认' : '待店家核对' }}</button><text v-if="historyText" class="ts-document" selectable>{{ historyText }}</text></view>
  </view>
</template>
<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { onHide } from '@dcloudio/uni-app'
import { experience } from '@/common/experience.js'
import { get, post } from '@/common/request.js'
import { errText } from '@/common/ui.js'
const props = defineProps({ appId: [String, Number], doc: Object, beforeSign: Function })
const emit = defineEmits(['refresh', 'next'])
const emptyForm = () => ({ name: '', idNo: '', phone: '', emergencyName: '', emergencyPhone: '', health: '', familyInformed: false, consistent: '', differences: '', privacyAgreed: false })
const form = reactive(emptyForm())
const previewRead = ref(false)
function onPreviewRead(value) { previewRead.value = value; if (!value) agree.value = false }
const busy = ref(false), error = ref(''), preview = ref(null), agree = ref(false), editing = ref(false), showRecord = ref(false), historyText = ref(''), savedDoc = ref(null)
const doc = computed(() => savedDoc.value || props.doc)
const record = computed(() => doc.value?.record)
const statusText = computed(() => ['withdrawn', 'terminated', 'review_rejected'].includes(doc.value?.status) && record.value?.status !== 'confirmed' ? '本次报名已结束，协议不再继续确认' : ({ pending: '本人已确认，等待店家核对', rejected: '店家退回，请修改后重新确认', confirmed: '双方已确认' }[record.value?.status] || ''))
const api = () => '/app/application/' + props.appId + '/volunteer-contract'
const personalFields = [{ key: 'name', label: '本人姓名', hint: '与本人身份证及报名姓名一致', max: 16 }, { key: 'idNo', label: '完整身份证号', hint: '18位本人身份证号', max: 18 }, { key: 'phone', label: '本人联系电话', hint: '填写可联系到本人的号码', max: 24 }, { key: 'emergencyName', label: '紧急联系人姓名', hint: '填写真实姓名', max: 32 }, { key: 'emergencyPhone', label: '紧急联系人电话', hint: '填写可接通的联系电话', max: 24 }]
const storeFields = [{ key: 'storeName', label: '店家签约名称' }, { key: 'storeAddress', label: '店家地址' }, { key: 'storeContact', label: '店家联系人' }, { key: 'storePhone', label: '店家联系电话' }]
const storeInfo = computed(() => doc.value?.defaults || {})
const missingStoreInfo = computed(() => storeFields.some(f => !String(storeInfo.value[f.key] || '').trim()))
watch(() => props.doc?.defaults, d => {
  if (d && !form.name) form.name = d.name || ''
  if (d && !form.phone) form.phone = d.phone || ''
}, { immediate: true })
watch(() => props.doc, () => { savedDoc.value = null })
let revision = 0
function discardPreview() {
  revision++
  preview.value = null; previewRead.value = false; agree.value = false
  busy.value = false; error.value = ''
}
watch([() => props.appId, () => experience.account?.id], () => {
  discardPreview()
  Object.assign(form, emptyForm())
  savedDoc.value = null; historyText.value = ''; showRecord.value = false; editing.value = false
}, { flush: 'sync' })
watch([() => props.doc?.version, () => props.doc?.body, () => props.doc?.status, () => props.doc?.record?.contentHash,
  ...storeFields.map(f => () => props.doc?.defaults?.[f.key])], discardPreview, { flush: 'sync' })
onHide(() => { if (busy.value) discardPreview() })
onBeforeUnmount(() => { revision++ })
const time = value => String(value || '').replace('T', ' ').slice(0, 19)
const payload = () => ({ ...form, idNo: form.idNo.trim().toUpperCase() })
async function makePreview() {
  if (busy.value) return
  error.value = ''; agree.value = false; previewRead.value = false
  if (missingStoreInfo.value) { error.value = '请联系店家补全签约资料后刷新。'; return }
  for (const f of personalFields) if (!String(form[f.key]).trim()) { error.value = '请填写' + f.label; return }
  if (!form.health.trim() || !form.familyInformed || !form.privacyAgreed || !form.consistent || (form.consistent === 'no' && !form.differences.trim())) { error.value = '请补全健康告知、家属告知、视频核对及个人信息处理确认。'; return }
  busy.value = true
  const scope = revision
  try {
    const data = (await post(api() + '/preview', payload())).data
    if (scope === revision) preview.value = data
  } catch (e) { if (scope === revision) error.value = errText(e, '预览失败，请重试') }
  finally { if (scope === revision) busy.value = false }
}
async function submit() {
  if (busy.value || !previewRead.value || !agree.value || !preview.value) return
  busy.value = true; error.value = ''
  const scope = revision
  try {
    if (props.beforeSign && !await props.beforeSign()) return
    if (scope !== revision) return
    const data = (await post(api() + '/sign', { ...payload(), agree: true, hash: preview.value.hash })).data
    if (scope !== revision) return
    savedDoc.value = data
    form.idNo = ''; preview.value = null; agree.value = false; editing.value = false; emit('refresh')
  } catch (e) {
    if (scope !== revision) return
    error.value = errText(e, '提交失败，请重试')
    if (e?.code === 409) { preview.value = null; agree.value = false; emit('refresh') }
  } finally { if (scope === revision) busy.value = false }
}
async function refresh() { error.value = ''; emit('refresh') }
async function readHistory(id) {
  if (busy.value) return
  const scope = revision
  busy.value = true; error.value = ''; historyText.value = ''
  try {
    const data = (await get(api() + '/records/' + id)).data
    if (scope === revision) historyText.value = data.contentMasked
  } catch (e) { if (scope === revision) error.value = errText(e, '读取失败') }
  finally { if (scope === revision) busy.value = false }
}
</script>
<style scoped>
.trip-sign{padding:20px 18px 40px;color:#40372d;font-size:15px;line-height:1.7}.ts-title{display:block;font-size:23px;font-weight:650}.ts-section{display:block;font-size:18px;font-weight:600;margin:28px 0 12px}.ts-hint{display:block;color:#756b5d;font-size:13px;margin:8px 0 14px}.ts-field{display:block;margin:16px 0}.ts-field>text{display:block;margin-bottom:7px}.ts-required{color:#a84b36}.ts-field input,.ts-field textarea{width:100%;box-sizing:border-box;padding:12px;background:#fffdf8;border:1px solid #d9cebe;border-radius:10px;font-size:15px;min-height:46px}.ts-field textarea{min-height:98px;line-height:1.7}.ts-check{display:flex;align-items:flex-start;font-size:13px;margin:18px 0;gap:6px}.ts-check checkbox{flex-shrink:0;transform:scale(.82);transform-origin:top left}.ts-check text{flex:1}.ts-radios{display:flex;gap:22px;flex-wrap:wrap;margin:15px 0}.ts-platform,.ts-status{padding:16px;background:#eee9dc;border-radius:12px;margin:20px 0}.ts-platform text,.ts-status text{display:block;overflow-wrap:anywhere}.ts-platform{font-size:13px}.ts-primary,.ts-secondary{font-size:15px;line-height:1.5;padding:13px 15px;border-radius:26px;margin:12px 0;min-height:48px}.ts-primary{background:#966331;color:#fffaf0}.ts-secondary{background:#eee8da;color:#76502c}.ts-primary[disabled],.ts-secondary[disabled]{background:#e4ddcf;color:#8a8174}.ts-document{display:block;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;font-size:14px;background:#fffdf8;padding:18px 14px;border:1px solid #e4dacb;border-radius:12px;margin:16px 0}.ts-error{display:block;color:#a53c2d;padding:12px 0;overflow-wrap:anywhere}.ts-history{margin-top:24px}
/* 2026-11-17 改版「小而精」：和签约页别的屏一个样子——页边距 12、标题 17 / 小节 15、输入框白底细边 10 圆角、提示块浅色 12 圆角不描边、
   主按钮暖棕渐变胶囊、次按钮白底细棕边。要本人填写的页面：输入框高度和输入字号不动。 */
.trip-sign{padding:8px 12px 32px;color:var(--k-ink);font-size:14px}
.ts-title{font-size:17px;font-weight:700}
.ts-section{font-size:16px;font-weight:700;line-height:22px;margin:16px 2px 8px}
.ts-hint{color:var(--k-muted);font-size:12px;margin:4px 2px 10px}
.ts-field{margin:12px 0}
.ts-store{background:var(--k-paper);border-radius:10px;padding:3px 12px}
.ts-store-row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;font-size:13px}
.ts-store-row+.ts-store-row{border-top:1px solid var(--k-line2)}
.ts-store-row text:first-child{flex-shrink:0;color:var(--k-muted)}
.ts-store-row text:last-child{text-align:right;overflow-wrap:anywhere}
.ts-field>text{margin:0 2px 6px;font-size:13px;color:var(--k-ink2)}
.ts-required{color:var(--k-alert)}
.ts-field input,.ts-field textarea{background:var(--k-paper);border-color:var(--k-line2)}
.ts-check{margin:14px 2px;font-size:12px;color:var(--k-ink2)}
.ts-radios{margin:10px 2px;font-size:14px}
.ts-radio-option{position:relative;display:inline-flex;align-items:center;gap:4px}
.ts-radio-input{position:absolute;inset:0;z-index:1;opacity:0}
.ts-radio-option:focus-within{outline:2px solid var(--k-red-line);outline-offset:2px}
.ts-platform,.ts-status{padding:12px;margin:12px 0;background:var(--k-paper);font-size:12px;color:var(--k-ink2)}
.ts-status{background:var(--k-red-soft);font-size:13px;color:var(--k-ink)}
.ts-primary,.ts-secondary{margin:10px 0;padding:11px 15px;min-height:44px;border-radius:22px;font-size:15px;font-weight:600}
.ts-primary{background:linear-gradient(135deg,#B5814D,#8E5E33);color:#fff}
.ts-secondary{background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-weight:500}
.ts-primary[disabled]{background:linear-gradient(135deg,#B5814D,#8E5E33);box-shadow:none;color:#fff;opacity:.45}.ts-secondary[disabled]{background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);opacity:.45}
.ts-primary::after,.ts-secondary::after{border:0}
.ts-document{padding:14px 12px;margin:12px 0;border:0;background:var(--k-paper);font-size:13px;line-height:1.85}
.ts-error{color:var(--k-alert);font-size:13px}
.ts-history{margin-top:20px}
</style>
