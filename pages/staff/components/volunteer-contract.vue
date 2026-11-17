<template>
  <view class="vc">
    <button class="vc-entry" :disabled="loading || saving" @click="open">核对换工三方协议 <text>›</text></button>
    <view v-if="opened" class="vc-body">
      <text v-if="loading">正在读取协议…</text>
      <template v-else-if="doc">
        <text v-if="!doc.record">报名人尚未提交新的三方协议。已签旧责任书的报名沿用原确认记录。</text>
        <template v-else>
          <text class="vc-title">{{ doc.record.status === 'pending' ? '待店家核对' : doc.record.status === 'confirmed' ? '双方已确认' : '已退回修改' }}</text>
          <text>编号：{{ doc.record.agreementNo }}</text>
          <text>用户确认：{{ time(doc.record.signedTime) }}</text>
          <k-agreement-reader :content-key="doc.record.contentHash" :text="doc.record.contentMasked" @read="markRead" />
          <template v-if="doc.record.status === 'pending' && doc.status === 'store_confirmed'">
            <text class="vc-tip">请核对店家名称、地址、联系人和视频沟通差异。信息有误请退回，不能替报名人修改已确认的协议。</text>
            <label class="vc-field"><text>乙方授权签署人姓名 *</text><input v-model="name" :disabled="saving" maxlength="32" placeholder="填写真实姓名" aria-label="乙方授权签署人姓名" /></label>
            <checkbox-group @change="agree = $event.detail.value.includes('agree')"><label class="vc-check"><checkbox value="agree" :checked="agree" :disabled="saving || !readComplete" color="#966331" /><text>我已获本店授权，已核对本协议全部信息、岗位条件及差异事项，同意代表乙方确认。</text></label></checkbox-group>
            <button class="vc-primary" :disabled="saving || !readComplete || !agree || !name.trim()" @click="decide('confirm')">{{ saving ? '正在保存…' : '代表店家确认协议' }}</button>
            <label class="vc-field"><text>需要修改时填写退回原因</text><textarea v-model="reason" :disabled="saving" maxlength="500" auto-height placeholder="说明需要报名人修改或重新核对的具体内容" aria-label="协议退回原因" /></label>
            <button class="vc-secondary" :disabled="saving || !readComplete || !reason.trim()" @click="decide('reject')">退回报名人修改</button>
          </template>
          <text v-if="doc.record.merchantSigner">店家确认人：{{ doc.record.merchantSigner }}</text>
          <text v-if="doc.record.merchantSignedTime">处理时间：{{ time(doc.record.merchantSignedTime) }}</text>
          <text v-if="doc.record.rejectReason">退回原因：{{ doc.record.rejectReason }}</text>
        </template>
      </template>
      <text v-if="error" class="vc-error" role="alert">{{ error }}</text>
      <button class="vc-secondary" :disabled="saving || loading" @click="load">刷新协议</button>
      <button class="vc-secondary" :disabled="saving" @click="opened = false">收起</button>
    </view>
  </view>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { get, post } from '@/common/request.js'
import { errText } from '@/common/ui.js'
const props = defineProps({ appId: [Number, String] }), emit = defineEmits(['changed'])
const opened = ref(false), loading = ref(false), saving = ref(false), doc = ref(null), error = ref(''), name = ref(''), reason = ref(''), agree = ref(false)
const readComplete = ref(false)
function markRead(value) { readComplete.value = value; if (!value) agree.value = false }
let generation = 0
const api = () => '/app/staff/applications/' + props.appId + '/volunteer-contract'
const time = v => String(v || '').replace('T',' ').slice(0,19)
async function open() { opened.value = true; await load() }
defineExpose({ open })
async function load() {
  if (saving.value) return
  const seq = ++generation; loading.value = true; error.value = ''; agree.value = false; readComplete.value = false; doc.value = null
  try { const data = (await get(api())).data; if (seq === generation) doc.value = data }
  catch (e) { if (seq === generation) error.value = errText(e, '协议读取失败') }
  finally { if (seq === generation) loading.value = false }
}
async function decide(action) {
  if (saving.value || !readComplete.value || !doc.value?.record) return
  if (action === 'confirm' && (!agree.value || !name.value.trim())) return
  if (action === 'reject' && !reason.value.trim()) return
  saving.value = true; error.value = ''; const seq = generation
  try {
    const data = (await post(api() + '/decision', { action, name: name.value, agree: agree.value, reason: reason.value, contractId: doc.value.record.contractId, hash: doc.value.record.contentHash })).data
    if (seq === generation) { doc.value = data; agree.value = false; emit('changed') }
  } catch (e) { if (seq === generation) { error.value = errText(e, '处理失败'); agree.value = false } }
  finally { if (seq === generation) saving.value = false }
}
watch(() => props.appId, () => { generation++; opened.value = false; doc.value = null; loading.value = false; saving.value = false; name.value = ''; reason.value = ''; agree.value = false; error.value = '' })
onBeforeUnmount(() => generation++)
</script>
<style scoped>
.vc{margin:18px 0;color:#40372d;font-size:14px;line-height:1.75}.vc-entry{background:#eee6d6;color:#76502c;text-align:left;padding:12px 16px;line-height:1.6;font-size:16px;font-weight:600;border-radius:12px}.vc-entry text{float:right}.vc-body{padding:16px 0}.vc-body>text{display:block;overflow-wrap:anywhere}.vc-title{font-size:18px;font-weight:600;margin-bottom:8px}.vc-copy{white-space:pre-wrap;background:#fffdf7;padding:16px;border:1px solid #e1d7c6;border-radius:12px;margin:16px 0}.vc-tip{font-size:13px;color:#786247}.vc-field{display:block;margin-top:18px}.vc-field>text{display:block;margin-bottom:8px}.vc-field input,.vc-field textarea{box-sizing:border-box;width:100%;padding:12px;background:#fffdf7;border:1px solid #d9cebe;border-radius:10px;font-size:15px;min-height:46px}.vc-field textarea{min-height:90px}.vc-check{display:flex;align-items:flex-start;margin:16px 0;gap:6px}.vc-check checkbox{flex-shrink:0;transform:scale(.82);transform-origin:top left}.vc-check text{flex:1;font-size:13px}.vc-primary,.vc-secondary{font-size:15px;line-height:1.5;padding:13px 14px;min-height:48px;margin:12px 0;border-radius:24px}.vc-primary{background:#966331;color:#fffaf0}.vc-secondary{background:#eee8da;color:#76502c}.vc-primary[disabled],.vc-secondary[disabled]{background:#e4ddcf;color:#8a8174}.vc-error{color:#a53c2d}
</style>
