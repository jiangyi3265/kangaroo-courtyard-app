<template>
  <!-- 2026-11-03 主人：「订票以后让他提交这个身份证号」。录用后的到店岗位：没交时是一张填写卡（不弹窗、可以先不填，但每次进来都在），
       交了以后缩成一行「出行证件已提交 · 脱敏号码」，点「修改」能改。完整号码只有本店换工主理人 / 城市负责人导出名单时看得到。 -->
  <view v-if="state === 'failed'" class="tid-retry" role="button" hover-class="k-press-s" @click="load"><k-icon name="refresh-cw" :size="16" color="red" /><text>出行证件状态暂时读不到，点这里重试</text></view>
  <view v-else-if="shown" class="tid" :class="{ 'tid--done': done }">
    <view v-if="done" class="tid-row">
      <view class="tid-face"><k-icon name="id-card" :size="18" color="green" /></view>
      <view class="tid-main"><text class="tid-label">出行证件已提交</text><text class="tid-name">{{ info.name }} · {{ info.idMasked }}</text><text class="tid-tip">订票、投保共用，无需重复提交</text></view>
      <view class="tid-act" role="button" aria-label="修改出行证件" hover-class="k-press-s" @click="startEdit"><text>修改</text></view>
    </view>
    <template v-else>
      <view class="tid-row tid-row--head">
        <view class="tid-face tid-face--todo"><k-icon name="id-card" :size="18" color="red" /></view>
        <view class="tid-main"><text class="tid-title">{{ editing ? '修改出行证件' : '出行证件，只需提交一次' }}</text><text class="tid-tip">{{ tip }}</text></view>
      </view>
      <view class="tid-field"><text>证件姓名</text><input v-model="name" class="tid-input" maxlength="16" placeholder="身份证上的姓名" placeholder-class="k-placeholder" /></view>
      <view class="tid-field"><text>身份证号</text><input v-model="idNo" class="tid-input" type="idcard" maxlength="22" placeholder="18 位身份证号" placeholder-class="k-placeholder" /></view>
      <text v-if="error" class="tid-error">{{ error }}</text>
      <view class="tid-actions">
        <view v-if="editing" class="tid-cancel"><k-button type="outline" size="md" block label="取消" @click="cancelEdit" /></view>
        <view class="tid-submit"><k-button size="md" block :disabled="saving" :label="saving ? '提交中…' : '提交证件信息'" @click="submit" /></view>
      </view>
      <text class="tid-foot">只用于门店订票、买保险；只有本店主理人能看到完整号码</text>
    </template>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { get, request } from '@/common/request.js'
import { toast } from '@/common/screen.js'
import { checkTravelId, normalizeId, shouldAskTravelId } from '../travel-id.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  // 报名状态 / 岗位类型：只有到店岗位、门店确认录用之后才显示
  status: { type: String, default: '' },
  jobType: { type: String, default: '' }
})
const emit = defineEmits(['saved'])

const info = ref(null)
// idle 不用显示 / loading 读取中 / ready 读到了 / failed 读不到（给一行重试，不打断主流程）
const state = ref('idle')
const editing = ref(false)
const name = ref('')
const idNo = ref('')
const error = ref('')
const saving = ref(false)
const ask = computed(() => shouldAskTravelId(props.status, props.jobType))

let version = 0
async function load() {
  const v = ++version
  if (!ask.value) { state.value = 'idle'; return }
  state.value = 'loading'
  try {
    const res = await get('/app/me/travel-id')
    if (v !== version) return
    info.value = (res && res.data) || {}
    if (!info.value.submitted && !name.value) name.value = info.value.defaultName || ''
    state.value = 'ready'
  } catch (e) {
    if (v !== version) return
    state.value = [401, 403, 404].includes(Number(e && e.code)) ? 'idle' : 'failed'
  }
}
watch(() => [props.status, props.jobType], load, { immediate: true })

const shown = computed(() => state.value === 'ready' && !!info.value)
const done = computed(() => !!(info.value && info.value.submitted) && !editing.value)
const tip = computed(() => {
  if (editing.value) return '改完提交后，门店导出的名单会用新的号码'
  if (info.value && info.value.needResubmit) return '之前提交的证件信息已失效，请重新填一次'
  return '订好票后填写一次，门店订票和投保共用。暂不方便可稍后填写。'
})

function startEdit() {
  editing.value = true
  error.value = ''
  name.value = (info.value && info.value.name) || ''
  idNo.value = ''
}
function cancelEdit() {
  editing.value = false
  error.value = ''
  idNo.value = ''
}
async function submit() {
  if (saving.value) return
  error.value = checkTravelId(name.value, idNo.value)
  if (error.value) return
  saving.value = true
  try {
    // 证件号只放在请求体里（PUT），不进链接
    const res = await request({ url: '/app/me/travel-id', method: 'PUT', data: { name: String(name.value).trim(), idNo: normalizeId(idNo.value) } })
    info.value = (res && res.data) || { submitted: true }
    editing.value = false
    idNo.value = ''
    toast('证件已提交，无需重复填写')
    emit('saved', info.value)
  } catch (e) {
    error.value = (e && e.message) || '提交失败，请稍后再试'
  } finally {
    saving.value = false
  }
}
defineExpose({ load })
</script>

<style scoped lang="scss">
.tid { margin-top: 12px; padding: 12px 14px; border: 1px solid #E6D6BF; border-radius: 15px; background: #FBF4EA; box-shadow: 0 3px 10px rgba(91, 61, 32, .04); }
.tid--done { padding: 4px 14px; border-color: #D3DEC9; background: #F3F7EE; }
.tid-row { min-height: 52px; display: flex; align-items: center; gap: 12px; }
.tid-row--head { align-items: flex-start; min-height: 0; }
.tid-face { flex: 0 0 auto; width: 38px; height: 38px; border-radius: 50%; background: #E3ECDA; display: flex; align-items: center; justify-content: center; }
.tid-face--todo { background: #F5E2C8; }
.tid-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tid-label { font-size: 13px; line-height: 18px; color: #506E3C; }
.tid-name { font-size: 15px; line-height: 22px; font-weight: 600; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tid-title { font-size: 16px; line-height: 22px; font-weight: 700; color: var(--k-ink); }
.tid-tip { font-size: 12px; line-height: 18px; color: #8A7865; }
.tid-act { flex: 0 0 auto; min-width: 52px; height: 32px; padding: 0 12px; box-sizing: border-box; border: 1px solid #D3DEC9; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #506E3C; background: #fff; }
.tid-field { margin-top: 10px; min-height: 44px; padding: 0 12px; border: 1px solid #E6D6BF; border-radius: 10px; background: #fff; display: flex; align-items: center; gap: 10px; }
.tid-field>text { flex: 0 0 auto; width: 64px; font-size: 14px; color: var(--k-ink); }
.tid-input { flex: 1; min-width: 0; height: 44px; font-size: 15px; color: var(--k-ink); }
.tid-error { display: block; margin-top: 8px; font-size: 12px; line-height: 18px; color: var(--k-red-deep); }
.tid-actions { margin-top: 12px; display: flex; gap: 10px; }
.tid-cancel { flex: 0 0 96px; }
.tid-submit { flex: 1; min-width: 0; }
.tid-foot { display: block; margin-top: 8px; font-size: 11px; line-height: 16px; color: #8A7865; text-align: center; }
.tid-retry { margin-top: 12px; min-height: 44px; padding: 0 14px; border: 1px dashed #E6D6BF; border-radius: 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--k-red-deep); }
/* 2026-11-17 改版「小而精」：白卡 12 圆角、不描边、不加阴影；图标放在 36 的浅色圆角方块里；已提交是浅豆绿底的一行。
   要本人填写：两个输入框的高度和输入字号不动。 */
.tid { margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
.tid--done { padding: 4px 12px; background: var(--k-green-soft); }
.tid-row { gap: 10px; }
.tid-face { width: 36px; height: 36px; border-radius: 10px; background: rgba(255, 255, 255, .7); }
.tid-face--todo { background: linear-gradient(160deg, #FFF6EA, #FFE7CC); }

.tid-label { font-size: 11px; line-height: 16px; color: var(--k-green); }
.tid-name { font-size: 14px; line-height: 20px; }
.tid-title { font-size: 15px; }
.tid-tip { font-size: 11px; line-height: 16px; color: var(--k-muted); }
/* 「修改」：看上去 28 高的白色小胶囊，透明边把可点范围撑到 36（原来 32） */
.tid-act { height: 36px; min-width: 60px; border: 4px solid transparent; border-radius: 18px; background: #fff padding-box; font-size: 12px; color: var(--k-green); }
.tid-field { border: 0; background: #F5F1EB; }
.tid-field > text { font-size: 13px; color: var(--k-ink2); }
.tid-error { color: var(--k-alert); }
.tid-foot { color: var(--k-muted); }
.tid-retry { margin-top: 8px; padding: 0 12px; border: 0; background: var(--k-paper); }
</style>
