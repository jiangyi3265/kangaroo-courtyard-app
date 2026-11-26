<template>
  <view class="ma">
    <view class="ma__entry" hover-class="k-press-s" @click="open">
      <view><text class="ma__title">{{ type === 'volunteer_notice' ? '换工使用规范告知书' : type === 'stay' ? '旅居合作协议' : '商家合作协议' }}</text><text class="ma__hint">{{ doc?.accepted ? '已确认 · 可查看协议与记录' : '首次提交前，请阅读并确认对应协议' }}</text></view>
      <view class="ma__link ma__go"><text>查看</text><k-icon name="chevron-right" :size="12" color="#8A5E36" /></view>
    </view>
    <view v-if="visible" class="ma__mask" @click="close">
      <view class="ma__sheet" @click.stop>
        <view class="ma__head"><text class="ma__title">{{ history ? '协议确认记录' : '商家合作协议' }}</text><text class="ma__link" @click="close">关闭</text></view>
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
            <text class="ma__hint">当前门店：{{ doc.storeName }}</text>
            <rich-text :nodes="doc.html" />
            <view v-if="doc.records?.length" class="ma__records">
              <text class="ma__title">我的确认记录</text>
              <view v-for="record in doc.records" :key="record.id" class="ma__record" hover-class="k-press" @click="readRecord(record.id)"><text>{{ record.confirmedAt }}</text><view class="ma__link ma__go"><text>查看原文</text><k-icon name="chevron-right" :size="12" color="#8A5E36" /></view></view>
            </view>
          </view>
        </view>
        <view v-if="!loading && !error && doc && !history" class="ma__foot">
          <text v-if="notice" class="ma__notice">{{ notice }}</text>
          <template v-if="doc.draft"><text class="ma__notice">协议草稿，尚未生效；定稿发布后再阅读确认。</text><button class="ma__secondary" @click="close">关闭</button></template>
          <template v-else-if="!doc.accepted">
            <checkbox-group @change="agreed = $event.detail.value.includes('agree')">
              <label class="ma__check"><checkbox value="agree" :checked="agreed" :disabled="saving" color="#966331" /><text>我已阅读并同意《{{ doc.title }}》</text></label>
            </checkbox-group>
            <button class="ma__primary" :disabled="!agreed || saving" @click="accept">{{ saving ? '正在保存…' : '确认同意' }}</button>
          </template>
          <template v-else><text class="ma__hint">已确认当前版本，后续提交无需重复勾选。</text><button class="ma__primary" @click="finish(true)">完成</button></template>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { get, post } from '@/common/request.js'
import { errText } from '@/common/ui.js'
import { experience } from '@/common/experience.js'
const props = defineProps({ storeId: [String, Number], type: String })
const API = '/app/staff/merchant/agreements'
const visible = ref(false), loading = ref(false), saving = ref(false), agreed = ref(false)
const doc = ref(null), history = ref(null), error = ref(''), notice = ref('')
let generation = 0, pending = null, recordId = null
function finish(value) { visible.value = false; const resolve = pending; pending = null; if (resolve) resolve(value) }
function close() {
  if (saving.value) return
  generation++
  loading.value = false
  finish(false)
}
async function load() {
  const seq = ++generation
  saving.value = false
  doc.value = null; history.value = null; recordId = null; agreed.value = false; error.value = ''; loading.value = true
  try {
    if (!props.storeId || !props.type) throw new Error('请先选择门店和业务')
    const d = (await get(API, { storeId: props.storeId, type: props.type })).data
    if (seq !== generation) return false
    if (!d?.html?.trim() || !d.version) throw new Error('协议内容未加载，请重试')
    doc.value = d; return true
  } catch (e) { if (seq === generation) error.value = errText(e, '协议读取失败，请重试'); return false }
  finally { if (seq === generation) loading.value = false }
}
async function open() { visible.value = true; notice.value = ''; await load() }
async function confirm() {
  if (pending || saving.value || loading.value) return false
  notice.value = ''
  const reading = load(), seq = generation
  const ready = await reading
  if (seq !== generation) return false
  if (!ready) { visible.value = true; return false }
  if (doc.value.draft || doc.value.accepted) return true
  visible.value = true
  return new Promise(resolve => { pending = resolve })
}
async function accept() {
  if (!agreed.value || saving.value || loading.value || !doc.value?.version || !doc.value.html?.trim() || doc.value.draft || doc.value.accepted) return
  saving.value = true; const seq = generation
  try {
    const d = (await post(API + '/' + props.type + '/accept', { agreed: true, version: doc.value.version }, { params: { storeId: props.storeId } })).data
    if (seq !== generation) return
    if (!d?.accepted) throw new Error('确认未保存，请重试')
    doc.value = d; finish(true)
  } catch (e) {
    if (seq !== generation) return
    if (e.code === 409) { if (await load()) notice.value = '协议已更新，请重新阅读并勾选。' }
    else notice.value = errText(e, '确认失败，请重试')
  } finally { if (seq === generation) saving.value = false }
}
async function readRecord(id) {
  if (saving.value) return
  const seq = ++generation; recordId = id; loading.value = true; error.value = ''; agreed.value = false
  try { const d = (await get(API + '/records/' + id, { storeId: props.storeId })).data; if (seq === generation) history.value = d }
  catch (e) { if (seq === generation) error.value = errText(e, '记录读取失败，请重试') }
  finally { if (seq === generation) loading.value = false }
}
function retry() { return recordId ? readRecord(recordId) : load() }
watch([() => props.storeId, () => props.type, () => experience.account?.id, () => experience.mode], () => {
  generation++
  finish(false)
  doc.value = null; history.value = null; loading.value = false; saving.value = false
  agreed.value = false
}, { flush: 'sync' })
onBeforeUnmount(() => { generation++; finish(false) })
defineExpose({ confirm })
</script>

<style scoped>
/* 2026-11-17 改版「小而精」：入口行是一张 12 圆角的白卡（左右各留 12，不再顶到屏幕边），颜色都换成主题变量；协议弹层圆角 16，主按钮暖棕、次按钮白底细边 */
.ma { margin: 10px 12px; color: var(--k-ink); font-size: 14px; }
/* 11-18 第二轮精修：白卡不再描边 */
.ma__entry { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 12px; background: var(--k-paper); border: 0; border-radius: 12px; }
.ma__title { display: block; font-weight: 600; font-size: 16px; }
.ma__hint { display: block; color: var(--k-muted); font-size: 12px; margin-top: 4px; line-height: 1.6; }
.ma__link { color: var(--k-red-deep); flex-shrink: 0; padding: 8px 0; }
/* 「查看」后面的箭头换成 12 号线性图标（原来是字体里的「›」），和字排一行 */
.ma__go { display: flex; align-items: center; gap: 2px; }
.ma__mask { position: fixed; inset: 0; z-index: 999; background: rgba(0,0,0,.45); display: flex; align-items: flex-end; }
.ma__sheet { width: 100%; height: 85vh; background: var(--k-paper); border-radius: 16px 16px 0 0; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom); box-sizing: border-box; }
.ma__head { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--k-line); }
.ma__scroll { flex: 1; height: 0; min-height: 0; overflow: auto; }
.ma__body { padding: 8px 16px 24px; font-size: 14px; line-height: 1.85; overflow-wrap: anywhere; }
.ma__state { padding: 30px 20px; text-align: center; line-height: 1.8; }
.ma__foot { border-top: 1px solid var(--k-line); padding: 12px 16px 16px; }
.ma__check { display: flex; align-items: flex-start; font-size: 13px; line-height: 1.6; margin-bottom: 12px; }
.ma__check checkbox { flex-shrink: 0; transform: scale(.82); margin-right: 3px; }
.ma__primary, .ma__secondary { font-size: 15px; font-weight: 600; border-radius: 23px; line-height: 46px; }
.ma__primary { background: linear-gradient(135deg, #B5814D, #8E5E33); color: #fff; }
/* 不可点：保持原配色整体变淡；!important 盖住微信 button[disabled] 自带的灰色（写法同 k-button） */
.ma__primary[disabled] { background: linear-gradient(135deg, #B5814D, #8E5E33) !important; color: #fff !important; opacity: .45; }
.ma__secondary { margin-top: 12px; color: var(--k-red-deep); background: var(--k-paper); box-shadow: inset 0 0 0 1px var(--k-red-line); }
.ma__records { border-top: 1px solid var(--k-line); padding-top: 16px; margin-top: 24px; }
.ma__record { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 13px; padding: 8px 0; }
.ma__notice { display: block; color: var(--k-alert); font-size: 13px; margin-bottom: 8px; }
</style>
