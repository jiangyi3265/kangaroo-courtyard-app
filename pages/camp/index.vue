<template>
  <k-feature-gate feature="group-chat">
  <view class="k-page camp">
    <k-topbar title="袋鼠青年营地" back />
    <view class="camp-body">
      <text class="eyebrow">在这里，遇见旅途同伴</text>
      <text class="camp-title">一座城的日常，<br />下一站的期待。</text>
      <text class="intro">找到身边的朋友，也提前认识下一站的同行者。</text>
      <view class="city-line"><k-icon name="map-pin" :size="17" color="green" /><text>{{ locating ? '正在识别当前城市…' : (current ? '当前城市：' + current : '尚未获取当前城市') }}</text><button :disabled="locating" @click="locate">重新定位</button></view>
      <text v-if="locationHint" class="hint">{{ locationHint }}</text>
      <view v-if="loading" class="loading" role="status">正在读取社群信息…</view>
      <view v-else-if="error" class="load-error"><text>{{ error }}</text><button @click="loadGroups">重新加载</button></view>
      <template v-else>
        <view v-for="item in cards" :key="item.kind" class="group-section">
          <view class="group-heading"><text>{{ item.kind === 'current' ? '此刻所在' : '下一站想去' }}</text><button @click="choose(item.kind)">选择城市 ›</button></view>
          <button class="group-card" :class="'group-card--' + item.kind" @click="openGroup(item.kind)">
            <view class="group-card__text"><text class="group-name">{{ item.city ? item.name : (item.kind === 'current' ? '找到你的同城群' : '找到你的目的地群') }}</text><text class="group-desc">{{ item.city ? (item.kind === 'current' ? '约一场活动，分享身边的新鲜事' : '出发前先聊聊，让陌生的城市熟悉起来') : '选择一座城市，看看有哪些旅途同伴' }}</text><text class="group-status">{{ !item.city ? '选择城市' : item.state === 'ready' ? '查看入群活码' : '社群暂未开放' }}</text></view><k-icon name="chevron-right" :size="23" color="green" />
          </button>
          <text v-if="item.kind === 'destination' && item.city" class="hint">{{ data.destinationSource === 'signup' ? '根据你最近报名的城市推荐' : destinationManual ? '你选择的目的地' : '根据你最近浏览的城市推荐' }}</text>
        </view>
      </template>
      <view class="camp-footer" @click="go('/pages/camp/handbook')"><k-icon name="book-open" :size="18" color="muted" /><text>第一次来？翻开袋鼠使用手册</text><text>›</text></view>
    </view>
    <view v-if="activeKind" class="qr-mask" @click="closeGroup" @touchmove.stop.prevent>
      <view class="qr-dialog" role="dialog" aria-modal="true" :aria-label="activeGroup?.name || '入群活码'" @click.stop>
        <button class="qr-close" aria-label="关闭" @click="closeGroup">×</button>
        <text class="qr-title">{{ activeGroup?.name || '入群活码' }}</text>
        <text v-if="qrLoading" class="qr-state">正在获取最新活码…</text>
        <template v-else-if="activeGroup?.state === 'ready' && !qrError">
          <image class="qr-image" :src="absUrl(activeGroup.qrUrl)" mode="aspectFit" show-menu-by-longpress @error="qrError = '活码图片加载失败，请重新获取'" />
          <text class="qr-instruction">长按识别加入</text><text class="hint">企业微信群 · 入群后请遵守群内约定</text>
        </template>
        <template v-else><text class="qr-state">{{ qrError || '本城市社群暂未开放，请稍后再来' }}</text><button class="qr-retry" @click="openGroup(activeKind)">重新获取</button></template>
      </view>
    </view>
  </view>
  </k-feature-gate>
</template>
<script setup>
import { ref, computed } from 'vue'
import { refreshFeatures } from '@/common/features.js'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { apiCampGroups } from '@/common/api.js'
import { experience, ensureSession } from '@/common/experience.js'
import { recentDestination } from '@/common/camp-history.js'
import { locateCity } from '@/common/locate.js'
import { selectCity } from '@/common/city-picker.js'
import { absUrl } from '@/common/upload.js'
import { go } from '@/common/screen.js'
import { errText } from '@/common/ui.js'
const current = ref(''), destination = ref(''), visitedAt = ref(0), destinationManual = ref(false)
const locating = ref(false), locationHint = ref(''), loading = ref(true), error = ref(''), data = ref({})
const activeKind = ref(''), activeGroup = ref(null), qrLoading = ref(false), qrError = ref('')
let requestId = 0, qrRequest = 0, locationRequest = 0, owner = null, disposed = false
const cards = computed(() => ['current','destination'].map(kind => ({ kind, ...(data.value[kind] || {}) })))
const params = () => ({ current: current.value, destination: destination.value, visitedAt: visitedAt.value })
async function loadGroups() {
  if (!(await refreshFeatures()).groupChatEnabled) return
  const id = ++requestId
  loading.value = true; error.value = ''
  try { const res = await apiCampGroups(params()); if (id === requestId && !disposed) data.value = res.data || {} }
  catch(e) { if(id === requestId) error.value = errText(e, '社群信息加载失败，请重试') }
  finally { if(id === requestId) loading.value = false }
}
async function locate() {
  const id = ++locationRequest
  locating.value = true; locationHint.value = ''
  const result = await locateCity({ onFailure: message => { if(id === locationRequest) locationHint.value = message } })
  if(id !== locationRequest || disposed) return
  locating.value = false
  if(result) { current.value = result.name; loadGroups() }
}
async function choose(kind) {
  const city = await selectCity({ value: kind === 'current' ? current.value : destination.value })
  if(!city || disposed) return
  if(kind === 'current') { ++locationRequest; locating.value=false; current.value=city; locationHint.value='已手动选择城市，可重新定位更新' }
  else { destination.value=city; visitedAt.value=Date.now(); destinationManual.value=true }
  loadGroups()
}
async function openGroup(kind) {
  if(!data.value[kind]?.city) return choose(kind)
  activeKind.value=kind; activeGroup.value=data.value[kind]; qrLoading.value=true; qrError.value=''
  const id = ++qrRequest
  try { const res = await apiCampGroups(params()); if(id === qrRequest) { data.value=res.data || {}; activeGroup.value=data.value[kind] } }
  catch(e) { if(id === qrRequest) qrError.value=errText(e, '活码读取失败，请重试') }
  finally { if(id === qrRequest) qrLoading.value=false }
}
function closeGroup() { ++qrRequest; activeKind.value=''; activeGroup.value=null }
onLoad(async () => { if((await refreshFeatures()).groupChatEnabled) locate() })
onShow(async () => {
  await ensureSession()
  const nextOwner = experience.account?.id || 'guest'
  if(owner !== nextOwner) { owner=nextOwner; destinationManual.value=false; closeGroup(); data.value={} }
  if(!destinationManual.value) { const recent=recentDestination(experience.account?.id); destination.value=recent.city; visitedAt.value=recent.at }
  loadGroups()
})
onUnload(() => { disposed=true; ++requestId; ++qrRequest; ++locationRequest })
</script>
<style scoped>
.camp { min-height:100vh; }.camp-body { max-width:640px; margin:auto; padding:28px 22px calc(36px + var(--k-safe-bottom)); }.eyebrow { display:block; font-size:12px; color:#4a6e3a; letter-spacing:1px; }.camp-title { display:block; margin:12px 0; font-size:29px; font-weight:700; line-height:1.45; color:#3a322b; }.intro { display:block; color:#6f6a65; font-size:14px; line-height:1.8; }.city-line { display:flex; align-items:center; gap:6px; padding:26px 0 8px; font-size:12px; }.city-line>text { flex:1; }.city-line button,.group-heading button { margin:0; padding:4px 0 4px 8px; background:transparent; font-size:12px; color:#4a6e3a; line-height:1.5; flex-shrink:0; }.city-line button::after,.group-heading button::after,.group-card::after,.qr-close::after { border:0; }.hint { display:block; margin-top:8px; color:#6f6a65; font-size:12px; line-height:1.7; }.group-section { margin-top:28px; }.group-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; font-size:13px; color:#6f6a65; }.group-card { display:flex; align-items:center; gap:14px; text-align:left; margin:0; padding:24px 20px; border-radius:16px; line-height:1.5; background:#e4edda; }.group-card--destination { background:#f3ebdd; }.group-card__text { flex:1; min-width:0; }.group-name,.group-desc,.group-status { display:block; }.group-name { font-size:22px; color:#3a322b; font-weight:600; overflow-wrap:anywhere; }.group-desc { font-size:13px; color:#5a5149; margin:10px 0 22px; }.group-status { font-size:13px; font-weight:600; color:#4a6e3a; }.camp-footer { display:flex; align-items:center; gap:10px; padding-top:30px; margin-top:24px; border-top:1px solid #e2dbcf; font-size:12px; color:#6f6a65; }.camp-footer>text:first-of-type { flex:1; }.loading,.load-error { padding:40px 0; color:#6f6a65; font-size:14px; }.load-error button { margin-top:12px; font-size:14px; }.qr-mask { position:fixed; inset:0; z-index:200; background:rgba(40,34,28,.48); display:flex; align-items:center; justify-content:center; padding:24px; }.qr-dialog { position:relative; width:100%; max-width:340px; box-sizing:border-box; background:#fcf9f3; padding:40px 24px 28px; border-radius:20px; text-align:center; }.qr-close { position:absolute; right:6px; top:4px; background:transparent; font-size:26px; line-height:40px; width:44px; padding:0; color:#6f6a65; }.qr-title { display:block; font-size:21px; font-weight:600; color:#3a322b; }.qr-image { width:100%; height:230px; margin:24px 0 18px; }.qr-instruction { display:block; font-size:18px; font-weight:600; color:#4a6e3a; }.qr-state { display:block; padding:40px 0; font-size:14px; color:#6f6a65; }.qr-retry { font-size:14px; color:#4a6e3a; background:#e4edda; }
</style>
