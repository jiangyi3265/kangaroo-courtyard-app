<template>
  <view class="ma">
    <view class="ma__entry" @click="open">
      <view><text class="ma__title">行前安全须知</text><text class="ma__hint">{{ doc?.accepted ? '已确认 · 可查看协议与记录' : '出发前，请阅读并确认本次报名须知' }}</text></view>
      <text class="ma__link">查看 ›</text>
    </view>
    <view v-if="visible" class="ma__mask" @click="close">
      <view class="ma__sheet" @click.stop>
        <view class="ma__head"><text class="ma__title">{{ history ? '协议确认记录' : '行前安全须知' }}</text><text class="ma__link" @click="close">关闭</text></view>
        <view class="ma__scroll">
          <view v-if="loading" class="ma__state">正在读取协议…</view>
          <view v-else-if="error" class="ma__state"><text>{{ error }}</text><button class="ma__secondary" @click="retry">重新加载</button></view>
          <view v-else-if="history" class="ma__body">
            <text class="ma__hint">门店：{{ history.storeName }} · 确认人：{{ history.operatorName }}</text>
            <text class="ma__hint">确认时间：{{ history.confirmedAt }}</text>
            <rich-text :nodes="history.contentHtml" />
            <button class="ma__secondary" @click="history = null">返回当前协议</button>
          </view>
          <view v-else-if="doc" class="ma__body">
            <text class="ma__hint">报名门店：{{ doc.storeName }}</text>
            <k-agreement-reader :content-key="doc.version" :html="doc.html" height="38vh" @read="markRead" />
            <view v-if="doc.records?.length" class="ma__records">
              <text class="ma__title">我的确认记录</text>
              <view v-for="record in doc.records" :key="record.id" class="ma__record" @click="readRecord(record.id)"><text>{{ record.confirmedAt }}</text><text class="ma__link">查看原文 ›</text></view>
            </view>
          </view>
        </view>
        <view v-if="!loading && !error && doc && !history" class="ma__foot">
          <text v-if="notice" class="ma__notice">{{ notice }}</text>
          <template v-if="doc.draft"><text class="ma__notice">协议草稿，尚未生效；定稿发布后再阅读确认。</text><button class="ma__secondary" @click="close">关闭</button></template>
          <template v-else-if="!doc.accepted">
            <checkbox-group @change="agreed = $event.detail.value.includes('agree')">
              <label class="ma__check"><checkbox value="agree" :checked="agreed" :disabled="saving || !readComplete" color="#966331" /><text>我已阅读并同意《{{ doc.title }}》</text></label>
            </checkbox-group>
            <button class="ma__primary" :disabled="!readComplete || !agreed || saving" @click="accept">{{ saving ? '正在保存…' : '确认同意' }}</button>
          </template>
          <template v-else><text class="ma__hint">已确认当前版本，本次报名无需重复勾选。</text><button class="ma__primary" @click="finish(true)">完成</button></template>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { get, post } from '@/common/request.js'
import { errText } from '@/common/ui.js'
const props = defineProps({ appId: [String, Number] })
const api = () => '/app/application/' + props.appId + '/departure-notice'
const visible = ref(false), loading = ref(false), saving = ref(false), agreed = ref(false)
const readComplete = ref(false)
function markRead(value) { readComplete.value = value; if (!value) agreed.value = false }
const doc = ref(null), history = ref(null), error = ref(''), notice = ref('')
let generation = 0, pending = null, recordId = null
function finish(value) { visible.value = false; const resolve = pending; pending = null; if (resolve) resolve(value) }
function close() { if (!saving.value) finish(false) }
async function load() {
  const seq = ++generation
  doc.value = null; history.value = null; recordId = null; agreed.value = false; readComplete.value = false; error.value = ''; loading.value = true
  try {
    if (!props.appId) throw new Error('请从具体报名进入')
    const d = (await get(api())).data
    if (seq !== generation) return false
    if (!d?.html || !d?.version) throw new Error('协议内容未加载，请重试')
    doc.value = d; return true
  } catch (e) { if (seq === generation) error.value = errText(e, '协议读取失败，请重试'); return false }
  finally { if (seq === generation) loading.value = false }
}
async function open() { visible.value = true; notice.value = ''; await load() }
async function confirm() {
  if (pending || saving.value) return false
  notice.value = ''
  if (!await load()) { visible.value = true; return false }
  if (doc.value.draft || doc.value.accepted) return true
  visible.value = true
  return new Promise(resolve => { pending = resolve })
}
async function accept() {
  if (!readComplete.value || !agreed.value || saving.value || !doc.value || loading.value) return
  saving.value = true; const seq = generation
  try {
    const d = (await post(api() + '/accept', { agreed: true, version: doc.value.version })).data
    if (seq !== generation) return
    if (!d?.accepted) throw new Error('确认未保存，请重试')
    doc.value = d; finish(true)
  } catch (e) {
    if (seq !== generation) return
    if (e.code === 409) { await load(); notice.value = '协议已更新，请重新阅读并勾选。' }
    else notice.value = errText(e, '确认失败，请重试')
  } finally { saving.value = false }
}
async function readRecord(id) {
  const seq = ++generation; recordId = id; loading.value = true; error.value = ''
  try { const d = (await get(api() + '/records/' + id)).data; if (seq === generation) history.value = d }
  catch (e) { if (seq === generation) error.value = errText(e, '记录读取失败，请重试') }
  finally { if (seq === generation) loading.value = false }
}
function retry() { return recordId ? readRecord(recordId) : load() }
watch(() => [props.appId], () => { generation++; finish(false); doc.value = null; agreed.value = false })
onBeforeUnmount(() => { generation++; finish(false) })
defineExpose({ confirm })
</script>

<style scoped>
.ma { margin: 16px 0; color: #342c24; font-size: 14px; }
.ma__entry { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px; background: #fffdf8; border: 1px solid #e6dccc; border-radius: 16px; }
.ma__title { display: block; font-weight: 600; font-size: 16px; }
.ma__hint { display: block; color: #776e62; font-size: 12px; margin-top: 6px; line-height: 1.6; }
.ma__link { color: #966331; flex-shrink: 0; padding: 8px 0; }
.ma__mask { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; }
.ma__sheet { width: 100%; height: 85vh; background: #fffdf8; border-radius: 24px 24px 0 0; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; }
.ma__head { padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee7dd; }
.ma__scroll { flex: 1; height: 0; min-height: 0; overflow: auto; }
.ma__body { padding: 8px 20px 24px; font-size: 14px; line-height: 1.85; overflow-wrap: anywhere; }
.ma__state { padding: 30px 20px; text-align: center; line-height: 1.8; }
.ma__foot { border-top: 1px solid #eee7dd; padding: 12px 20px 16px; }
.ma__check { display: flex; align-items: flex-start; font-size: 13px; line-height: 1.6; margin-bottom: 12px; }
.ma__check checkbox { flex-shrink: 0; transform: scale(.82); margin-right: 3px; }
.ma__primary, .ma__secondary { font-size: 15px; border-radius: 24px; line-height: 46px; }
.ma__primary { background: #966331; color: #fff; }
.ma__primary[disabled] { background: #e5ddd1; color: #8d8376; }
.ma__secondary { margin-top: 14px; color: #966331; background: #f4eee3; }
.ma__records { border-top: 1px solid #e6dccc; padding-top: 16px; margin-top: 24px; }
.ma__record { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; padding: 8px 0; }
.ma__notice { display: block; color: #ad3e29; font-size: 13px; margin-bottom: 8px; }
</style>
