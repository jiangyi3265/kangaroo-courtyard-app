<template>
  <view v-if="state || error" class="work-end">
    <text class="title">工作结束</text>
    <text v-if="error" class="line">{{ error }}</text>
    <template v-if="state">
      <text class="line">{{ state.ended ? '这段工作已结束' : state.pending ? (state.canDecide ? '收到提前结束申请，请确认。' : '提前结束申请已提交，等待对方确认。') : state.rejected ? '上次申请未获同意，当前仍在岗。' : '当前在岗' }}</text>
      <text v-if="state.reason" class="line">{{ state.reason }}</text>
      <textarea v-if="state.canRequest || state.canFinish" v-model="reason" maxlength="180" placeholder="填写结束工作的原因" auto-height />
      <view class="actions">
        <k-button v-if="state.canRequest" type="outline" :disabled="busy" :label="state.role === 'user' ? '申请提前离职' : '协商提前结束'" @click="act('request')" />
        <k-button v-if="state.canFinish" type="outline" :disabled="busy" label="标记工作已结束" @click="act('finish')" />
        <k-button v-if="state.canDecide" type="outline" :disabled="busy" label="暂不同意" @click="act('reject')" />
        <k-button v-if="state.canDecide" :disabled="busy" label="同意结束" @click="act('approve')" />
      </view>
    </template>
    <k-button v-if="error || state?.pending" type="secondary" size="sm" label="刷新进度" :disabled="busy" @click="load" />
  </view>
</template>
<script setup>
import { computed, nextTick, onScopeDispose, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { experience, getMessageScopeKey, getSessionRevision } from '@/common/experience.js'
import { get, post } from '@/common/request.js'
import { modal } from '@/common/ui.js'
import { toast } from '@/common/screen.js'
const props = defineProps({ appId: [Number, String], staff: Boolean, focusOnLoad: Boolean })
const emit = defineEmits(['updated', 'focus'])
const state = ref(null), reason = ref(''), error = ref(''), busy = ref(false)
const url = computed(() => (props.staff ? '/app/staff/applications/' : '/app/application/') + props.appId + '/work-end')
let seq = 0, visible = true, disposed = false
const context = () => JSON.stringify([url.value, getSessionRevision(), getMessageScopeKey()])
const stillCurrent = (request, key) => visible && !disposed && request === seq && key === context()
function clear() {
  seq++
  state.value = null
  reason.value = ''
  error.value = ''
  busy.value = false
}
async function load() {
  if (!visible || disposed || !props.appId || !experience.account?.id || busy.value) return
  const request = ++seq, key = context()
  error.value = ''
  try {
    const res = await get(url.value)
    if (stillCurrent(request, key)) state.value = res.data
  } catch (e) {
    if (stillCurrent(request, key)) { state.value = null; error.value = e?.message || '工作进度读取失败' }
  }
  if (props.focusOnLoad && stillCurrent(request, key)) {
    await nextTick()
    if (props.focusOnLoad && stillCurrent(request, key)) emit('focus', props.appId)
  }
}
async function act(action) {
  if (!visible || disposed || busy.value || !state.value) return
  const target = url.value, revision = state.value.revision, note = reason.value.trim()
  if (['request', 'finish'].includes(action) && !note) return toast('请先填写结束工作的原因')
  const request = ++seq, key = context()
  busy.value = true
  try {
    const labels = { request: '提交提前结束申请', finish: '标记当前工作已结束', approve: '同意结束这段工作', reject: '不同意提前结束' }
    if (!(await modal(labels[action], action === 'request' ? '提交后将通知对方处理。' : action === 'reject' ? '义工将继续在岗。' : '确认后将记录离岗时间，通知义工和门店。')).confirm || !stillCurrent(request, key)) return
    const res = await post(target, { action, revision, reason: note })
    if (!stillCurrent(request, key)) return
    state.value = res.data
    error.value = ''
    reason.value = ''
    emit('updated', res.data)
  } catch (e) { if (stillCurrent(request, key)) error.value = e?.message || '操作失败，请刷新后重试' }
  finally { if (stillCurrent(request, key)) busy.value = false }
}
watch(context, () => { clear(); load() }, { immediate: true, flush: 'sync' })
onHide(() => { visible = false; clear() })
onShow(() => { if (!visible && !disposed) { visible = true; load() } })
onScopeDispose(() => { disposed = true; clear() })
</script>
<style scoped>
.work-end{margin:12px 0;padding:14px;background:var(--k-paper);border-radius:12px}
.title,.line{display:block}.title{font-size:16px;font-weight:600}.line{font-size:13px;color:var(--k-muted);margin:8px 0}
textarea{box-sizing:border-box;width:100%;padding:10px;margin:10px 0;background:var(--k-paper2);border-radius:8px;font-size:14px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
</style>
