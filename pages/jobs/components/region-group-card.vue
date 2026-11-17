<template>
  <view v-if="groupChatEnabled" class="region-group">
    <view class="region-group__head" role="button" :aria-expanded="opened" hover-class="k-press" @click="toggle">
      <view class="region-group__icon"><k-icon name="users" :size="23" color="green" /></view>
      <view class="region-group__copy"><text class="region-group__title">{{ group.name || '地区换工畅玩群' }}</text><text class="region-group__sub">结识同地区换工伙伴，一起探索当地</text></view>
      <k-icon :name="opened ? 'chevron-up' : 'chevron-right'" :size="20" color="muted" />
    </view>
    <view v-if="opened" class="region-group__body">
      <text v-if="loading" class="region-group__hint">正在获取最新群码…</text>
      <template v-else-if="error">
        <text class="region-group__hint">{{ error }}</text>
        <k-button size="md" type="outline" block label="重新加载" @click="load" />
      </template>
      <template v-else-if="group.state === 'ready' && group.qrUrl && !imageError">
        <text v-if="group.note" class="region-group__note">{{ group.note }}</text>
        <image class="region-group__qr" :src="absUrl(group.qrUrl)" mode="aspectFit" show-menu-by-longpress @click="preview" @error="imageError = true" />
        <text class="region-group__hint">长按识别二维码，或保存后用微信扫一扫</text>
        <text class="region-group__expire">有效期至 {{ group.expire }}，到期后请重新打开获取</text>
      </template>
      <template v-else>
        <text class="region-group__hint">{{ imageError ? '群码图片加载失败，请重新获取' : group.state === 'expired' ? '地区群二维码已过期，正在等待更新' : '该地区的入群二维码暂未配置' }}</text>
        <k-button size="md" type="outline" block label="获取最新群码" @click="load" />
        <k-button size="md" type="outline" block label="联系平台客服获取入群方式" @click="go(R.support)" />
      </template>
    </view>
  </view>
</template>

<script setup>
import { groupChatEnabled } from '@/common/features.js'
import { ref, watch, onUnmounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { get, getToken } from '@/common/request.js'
import { experience, getSessionRevision } from '@/common/experience.js'
import { absUrl } from '@/common/upload.js'
import { go } from '@/common/screen.js'
import { errText } from '@/common/ui.js'
import R from '@/common/routes.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({ appId: { type: Number, required: true } })
const opened = ref(false), group = ref({}), loading = ref(false), error = ref(''), imageError = ref(false)
let version = 0, visible = true, expiryTimer
function expireLater() {
  clearTimeout(expiryTimer)
  const until = Number(group.value.validUntil)
  if (group.value.state !== 'ready' || !until || !visible) return
  const delay = until - Date.now()
  if (delay <= 0) { group.value = { ...group.value, state: 'expired', qrUrl: null }; return }
  expiryTimer = setTimeout(expireLater, Math.min(delay, 2147483647))
}
async function load() {
  if (!groupChatEnabled.value || !visible || loading.value || !Number.isSafeInteger(props.appId) || props.appId <= 0) return false
  const ticket = ++version, id = props.appId, account = experience.account?.id, session = getSessionRevision(), token = getToken()
  const current = () => visible && ticket === version && id === props.appId && account === experience.account?.id && session === getSessionRevision() && token === getToken()
  loading.value = true; error.value = ''; imageError.value = false; clearTimeout(expiryTimer)
  try {
    const response = await get('/app/application/' + id + '/region-group')
    if (!current()) return false
    group.value = response.data || {}; expireLater()
    return true
  } catch (e) {
    if (current()) { group.value = {}; error.value = errText(e, '地区群暂时加载失败，请重试') }
    return false
  } finally { if (ticket === version) loading.value = false }
}
function toggle() { opened.value = !opened.value; if (opened.value) load() }
async function preview() {
  if (await load() && group.value.state === 'ready' && group.value.qrUrl)
    uni.previewImage({ urls: [absUrl(group.value.qrUrl)], current: 0, showmenu: true })
}
watch(() => [props.appId, experience.account?.id], () => { version++; loading.value = false; group.value = {}; opened.value = false; load() }, { immediate: true, flush: 'sync' })
watch(groupChatEnabled, enabled => { version++;loading.value=false;group.value={};opened.value=false;clearTimeout(expiryTimer);if(enabled)load() })
onShow(() => { visible = true; load() })
onHide(() => { visible = false; version++; loading.value = false; group.value = {}; clearTimeout(expiryTimer) })
onUnmounted(() => { visible = false; version++; clearTimeout(expiryTimer) })
</script>

<style scoped>
.region-group { margin-top: 12px; border: 1px solid var(--k-line); border-radius: 14px; background: var(--k-paper); overflow: hidden; }
.region-group__head { display: flex; align-items: center; gap: 10px; padding: 16px 14px; }
.region-group__icon { display: flex; align-items: center; justify-content: center; flex: 0 0 40px; height: 40px; border-radius: 12px; background: var(--k-green-soft); }
.region-group__copy { flex: 1; min-width: 0; }.region-group__title { display: block; font-size: 17px; font-weight: 700; line-height: 1.5; overflow-wrap: anywhere; }
.region-group__sub { display: block; margin-top: 4px; color: var(--k-muted); font-size: 12px; line-height: 1.6; }
.region-group__body { border-top: 1px solid var(--k-line); padding: 16px 14px; text-align: center; }
.region-group__note { display: block; font-size: 13px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; text-align: left; }
.region-group__qr { display: block; width: 100%; max-width: 240px; height: 240px; margin: 12px auto; }
.region-group__hint { display: block; color: var(--k-ink2); font-size: 13px; line-height: 1.7; margin-bottom: 10px; }
.region-group__expire { display: block; color: var(--k-muted); font-size: 11px; line-height: 1.7; }
.region-group__body :deep(.k-button) { margin-top: 10px; }
</style>
