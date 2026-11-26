<template>
  <view class="am">
    <view class="am-head"><text>消息提醒</text><button class="am-refresh" :disabled="loading" @click="load"><k-icon name="refresh-cw" :size="12" color="muted" /><text>{{ loading ? '刷新中' : '刷新' }}</text></button></view>
    <view v-if="error" class="am-error" role="button" @click="load"><text>{{ error }}，点击重试</text><k-icon name="chevron-right" :size="12" color="red" /></view>
    <view class="am-list">
      <view class="am-row" role="button" aria-label="查看商家聊天" hover-class="k-press" @click="openStore">
        <view class="am-icon am-icon--store"><k-icon name="store" :size="22" color="red" /><text v-if="data?.store && !data.store.read" class="am-dot" /></view>
        <view class="am-main"><view class="am-title-row"><text class="am-name">{{ storeName || data?.storeName || '商家聊天' }}</text><text class="am-tag">商家</text></view><text class="am-copy">{{ data ? data.store?.content || '暂无聊天消息，点击联系门店' : error ? '点击进入商家聊天' : '正在读取商家消息…' }}</text><text v-if="data?.store?.createTime" class="am-time">{{ messageTime(data.store.createTime) }}</text></view>
        <k-icon name="chevron-right" :size="12" color="muted" />
      </view>
      <view class="am-row" role="button" aria-label="查看本次报名通知" hover-class="k-press" @click="openNotices">
        <view class="am-icon am-icon--system"><k-icon name="bell" :size="22" color="green" /><text v-if="data?.unread" class="am-dot" /></view>
        <view class="am-main"><view class="am-title-row"><text class="am-name">本次报名通知</text><text v-if="data?.unread" class="am-unread">{{ data.unread > 99 ? '99+' : data.unread }} 条未读</text><text v-else class="am-tag">系统</text></view><text class="am-copy">{{ displayWording(data ? latest?.content || latest?.title || '暂无通知，有新进展会在这里提醒' : error ? '点击查看报名通知' : '正在读取报名通知…', [latest?.actorName, latest?.peerName, storeName], { preserveQuotes: false }) }}</text><text v-if="latest?.createTime" class="am-time">{{ messageTime(latest.createTime) }}</text></view>
        <k-icon name="chevron-right" :size="12" color="muted" />
      </view>
    </view>
  </view>
</template>
<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { displayWording } from '@/common/display-wording.js'
import { onShow, onHide } from '@dcloudio/uni-app'
import { apiApplicationMessages } from '@/common/api.js'
import { experience, getSessionRevision } from '@/common/experience.js'
import { getToken } from '@/common/request.js'
import { errText } from '@/common/ui.js'
import R from '@/common/routes.js'
import { applicationMessages, messageTime, validId } from '../application-messages.js'
const props = defineProps({ appId: { type: [String, Number], required: true }, storeName: { type: String, default: '' } })
const emit = defineEmits(['navigate'])
const data = ref(null), error = ref(''), loading = ref(false)
const latest = computed(() => data.value?.rows?.[0])
let version = 0, visible = true, timer = null
function start() { clearInterval(timer); timer = setInterval(() => { if (visible) load() }, 20000) }
async function load() {
  if (!validId(props.appId) || loading.value || !visible) return
  const ticket = ++version, appId = props.appId, account = experience.account?.id
  const session = getSessionRevision(), token = getToken()
  const current = () => ticket === version && account === experience.account?.id && session === getSessionRevision() && token === getToken() && visible
  loading.value = true
  try {
    const result = (await apiApplicationMessages(appId, { size: 1 })).data
    if (!current()) return
    data.value = applicationMessages(result, appId); error.value = ''
  } catch (e) { if (current()) { data.value = null; error.value = errText(e, '消息暂时加载失败') } }
  finally { if (ticket === version) loading.value = false }
}
watch(() => [props.appId, experience.account?.id], () => { version++; loading.value = false; data.value = null; error.value = ''; load(); if (visible) start() }, { immediate: true, flush: 'sync' })
onShow(() => { visible = true; load(); start() })
onHide(() => { visible = false; version++; loading.value = false; clearInterval(timer) })
onUnmounted(() => { visible = false; version++; clearInterval(timer) })
function openStore() { if (validId(props.appId)) emit('navigate', R.chat + '?appId=' + validId(props.appId)) }
function openNotices() {
  if (validId(props.appId)) emit('navigate', R.jobNotices + '?appId=' + validId(props.appId) + (latest.value ? '&messageId=' + latest.value.id : ''))
}
</script>
<style scoped>
.am { margin-top: 18px; }
.am-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 17px; font-weight: 700; }
.am-refresh { display: flex; align-items: center; gap: 5px; min-height: 44px; padding: 0 8px; margin: 0 10px 0 0; font-size: 12px; font-weight: 400; color: var(--k-muted); background: transparent; }
.am-refresh::after { border: 0; }
.am-list { border: 1px solid var(--k-line); border-radius: 14px; background: var(--k-paper); overflow: hidden; }
.am-row { display: flex; align-items: center; gap: 10px; min-height: 88px; padding: 14px 12px; }
.am-row + .am-row { border-top: 1px solid var(--k-line); }
.am-icon { flex: 0 0 40px; width: 40px; height: 40px; border-radius: 14px; display: flex; align-items: center; justify-content: center; position: relative; }
.am-icon--store { background: var(--k-paper2); }.am-icon--system { background: var(--k-green-soft); }
.am-dot { position: absolute; right: -1px; top: -1px; width: 8px; height: 8px; border: 2px solid var(--k-paper); border-radius: 50%; background: var(--k-red); }
.am-main { flex: 1; min-width: 0; }.am-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 7px; }
.am-name { max-width: 100%; font-size: 15px; font-weight: 650; line-height: 1.45; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.am-tag { padding: 2px 6px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; }.am-unread { color: var(--k-red-deep); font-size: 11px; }
.am-copy { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; margin-top: 5px; font-size: 13px; line-height: 1.6; color: var(--k-ink2); }
.am-time { display: block; margin-top: 5px; font-size: 11px; color: var(--k-muted); }
.am-error { display: flex; align-items: center; gap: 6px; padding: 9px 0 12px; font-size: 12px; line-height: 1.6; color: var(--k-red-deep); }.am-error > text { flex: 1; }
/* 2026-11-17 改版「小而精」：白卡 12 圆角、不描边；两行入口收小一档，图标放在 40 的浅色圆角方块里；刷新、重试、未读红点都照旧 */
.am { margin-top: 12px; }
.am-head { padding-left: 2px; font-size: 15px; }
.am-refresh { margin-right: 0; padding: 0 2px 0 8px; gap: 3px; }
.am-list { border: 0; border-radius: 12px; }
.am-row { min-height: 68px; padding: 10px 12px; }
.am-row + .am-row { position: relative; border-top: 0; }
.am-row + .am-row::before { content: ''; position: absolute; left: 62px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.am-icon { border-radius: 12px; }

.am-icon--store { background: linear-gradient(160deg, #FFF6EA, #FFE7CC); }
.am-dot { background: var(--k-alert); }
.am-name { font-size: 14px; font-weight: 600; line-height: 20px; }
.am-tag { padding: 0 5px; font-size: 10px; font-weight: 500; line-height: 17px; }
.am-unread { color: var(--k-alert); }
.am-copy { margin-top: 2px; font-size: 12px; }
.am-time { margin-top: 2px; }

.am-head { font-size: 16px; line-height: 22px; }
</style>
