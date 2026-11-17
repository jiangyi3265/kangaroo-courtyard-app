<template>
	<view class="ww-chat">
		<view class="ww-chat__head" hover-class="k-press" @click="expanded = !expanded">
			<view class="ww-row">
				<k-icon name="message-circle" :size="17" color="green" />
				<text>{{ room.phase === 'waiting' ? '房间聊天' : '发言记录' }}</text>
			</view>
			<text class="ww-chat__toggle">
				{{ expanded ? '收起' : '展开' }} {{ messages.length ? '· ' + messages.length : '' }}
			</text>
		</view>
		<view v-if="expanded" class="ww-chat__messages">
			<button v-if="messages.length > visibleCount" class="ww-link" @click="visibleCount += 12">查看更早的发言</button>
			<text v-if="!messages.length" class="ww-muted">
				{{ room.phase === 'waiting' ? '和朋友打个招呼吧' : '等待大家的发言' }}
			</text>
			<view v-for="message in messages.slice(-visibleCount)" :key="message.id" class="ww-chat__message">
				<text class="ww-chat__name">{{ message.seat || '' }} {{ message.name }}</text>
				<text v-if="message.text" class="ww-chat__text">{{ message.text }}</text>
				<button v-else class="ww-chat__voice" :disabled="recording" @click="play(message)">
					<k-icon
						:name="playing === message.id ? 'pause' : 'volume-2'"
						:size="17"
						color="green"
					/>
					<text>
						{{ loadingId === message.id ? '正在读取' : playing === message.id ? '正在播放' : '点击播放' }} ·
						{{ message.duration }}秒
					</text>
				</button>
			</view>
		</view>
		<view v-if="expanded && !voiceOnly && room.me?.canSpeak" class="ww-chat__compose">
			<input
				v-model="text"
				class="ww-field"
				maxlength="300"
				placeholder="说说你的想法…"
				confirm-type="send"
				@confirm="send"
			/>
			<k-button size="md" type="green" :disabled="busy || !text.trim()" @click="send">
				发送
			</k-button>
		</view>
		<button
			v-if="recordedVoice && expanded && room.me?.canSpeak"
			class="ww-chat__record"
			:class="{ 'ww-chat__record--on': recording }"
			:disabled="uploading"
			@touchstart.stop.prevent="startRecording"
			@touchmove.stop.prevent="moveRecording"
			@touchend.stop.prevent="stopRecording"
			@touchcancel="cancelRecording"
			@mousedown="startRecording"
			@mouseup="stopRecording"
			@mouseleave="cancelRecording"
		>
			<k-icon name="mic" :size="17" color="green" />
			<text>
				{{
					uploading
						? '正在发送语音…'
						: recording
							? (cancelOnRelease ? '松开取消发送' : '松开发送 · ' + recordedSeconds + '/' + recordLimit + '秒')
							: '按住录音，松开发送'
				}}
			</text>
		</button>
		<text v-if="recordedVoice && expanded" class="ww-chat__hint">{{ room.me?.canSpeak ? '语音消息 · 上滑取消，每条最多60秒；请在本轮倒计时结束前发送' : '现在可以点击收听，轮到你发言时可录音或打字' }}</text>
		<view v-if="voiceError" class="ww-chat__error">
			<text>{{ voiceError }}</text>
			<button v-if="draft" class="ww-link" :disabled="uploading" @click="upload">
				重试发送
			</button>
			<!-- #ifdef MP-WEIXIN -->
			<button v-if="permissionDenied" class="ww-link" @click="openSettings">麦克风设置</button>
			<!-- #endif -->
		</view>
	</view>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { getToken } from '@/common/request.js'
import { requestId } from '../api.js'
import { recorder, sendVoice, loadVoice, createVoicePlayer } from '../voice.js'
import { voiceFocus } from '../audio-focus.js'
const props = defineProps({ room: Object, active: { type: Boolean, default: true }, busy: Boolean, recordedVoice: Boolean, voiceOnly: Boolean, game: { type: String, default: 'werewolf' } })
const emit = defineEmits(['send', 'refresh'])
const expanded = ref(true)
const visibleCount = ref(12)
const text = ref('')
const recording = ref(false)
const recordedSeconds = ref(0)
const recordLimit = ref(60)
const cancelOnRelease = ref(false)
const permissionDenied = ref(false)
const uploading = ref(false)
const voiceError = ref('')
const playing = ref('')
const loadingId = ref('')
const draft = ref(null)
const messages = computed(() => props.room.messages || [])
const focus = voiceFocus()
watch(() => recording.value || uploading.value || !!playing.value || !!loadingId.value, focus, { flush: 'sync' })
let active = props.active, epoch = 0, captured, audio, resource, pendingText = null
let startY = 0, lastTouchAt = 0, recordTimer, playTimeout
let receivedAt = Date.now()
watch(() => props.room.serverTime, () => { receivedAt = Date.now() })
function sameTurn(item) {
  return active && item && item.token === getToken() && item.code === props.room.code
    && item.userId === props.room.me?.userId && item.phaseToken === props.room.phaseToken
    && props.room.me?.canSpeak && !props.room.me?.skipAt
}
function send() {
  if (text.value.trim() && !props.busy && props.room.me?.canSpeak) {
    pendingText = { text: text.value.trim(), existing: new Set(messages.value.map(m => m.id)) }
    emit('send', pendingText.text)
  }
}
watch(messages, list => {
  if (pendingText && list.some(m => !pendingText.existing.has(m.id) && m.userId === props.room.me?.userId && m.text === pendingText.text)) {
    if (text.value.trim() === pendingText.text) text.value = ''
    pendingText = null
  }
})
function clearTimer() { clearInterval(recordTimer); recordTimer = null }
function discardDraft() {
  const item = draft.value
  draft.value = null
  if (item && !uploading.value) item.release()
}
const mic = recorder(result => {
  recording.value = false; clearTimer()
  if (!sameTurn(captured)) { result.release(); return }
  discardDraft()
  draft.value = { ...result, id: requestId(), ...captured }
  upload()
}, error => {
  recording.value = false; clearTimer()
  if (!active) return
  voiceError.value = error.message
  permissionDenied.value = /麦克风|权限/.test(error.message)
}, () => {
  if (!recording.value || !sameTurn(captured)) return
  const began = Date.now(); recordedSeconds.value = 0; clearTimer()
  recordTimer = setInterval(() => { recordedSeconds.value = Math.min(recordLimit.value, Math.floor((Date.now() - began) / 1000)) }, 200)
})
function startRecording(event = {}) {
  if (event.type === 'mousedown' && Date.now() - lastTouchAt < 800) return
  if (event.type === 'touchstart') lastTouchAt = Date.now()
  if (!active || !props.recordedVoice || props.busy || uploading.value || recording.value || mic.busy() || !props.room.me?.canSpeak || props.room.me?.skipAt) return
  let limit = 60
  if (props.room.deadline) {
    const serverNow = Number(props.room.serverTime) + Date.now() - receivedAt
    limit = Math.min(60, Math.floor((props.room.deadline - serverNow) / 1000) - 2)
  }
  if (limit < 1) { voiceError.value = '本轮即将结束，请等待下一次发言'; return }
  stopAudio(); discardDraft()
  captured = { token: getToken(), phaseToken: props.room.phaseToken, code: props.room.code, userId: props.room.me.userId }
  startY = event.touches?.[0]?.clientY || 0
  cancelOnRelease.value = false; permissionDenied.value = false; voiceError.value = ''
  recordLimit.value = limit; recordedSeconds.value = 0; recording.value = true
  mic.start({ maxSeconds: limit })
}
function moveRecording(event) {
  if (recording.value && event.touches?.length) cancelOnRelease.value = startY - event.touches[0].clientY > 60
}
function stopRecording() {
  if (!recording.value) return
  if (cancelOnRelease.value) { cancelRecording(); return }
  clearTimer(); mic.stop()
}
function cancelRecording() {
  recording.value = false; cancelOnRelease.value = false; clearTimer(); mic.cancel()
}
function openSettings() { uni.openSetting({}) }
async function upload() {
  const item = draft.value
  if (!item || uploading.value) return
  if (!sameTurn(item)) { discardDraft(); voiceError.value = '发言回合已结束，这段录音未发送'; return }
  uploading.value = true; voiceError.value = ''
  try {
    await sendVoice(item.code, item.file, { requestId: item.id, phaseToken: item.phaseToken, duration: item.duration }, props.game)
    if (draft.value === item) draft.value = null
    if (active && item.token === getToken()) emit('refresh')
  } catch (error) {
    if (sameTurn(item) && draft.value === item) voiceError.value = error.message
    else if (active) voiceError.value = '发言回合已结束，这段录音未发送，请以发言记录为准'
  } finally {
    uploading.value = false
    if (draft.value !== item || !sameTurn(item)) {
      if (draft.value === item) draft.value = null
      item.release()
    }
  }
}
function stopAudio() {
  epoch++; clearTimeout(playTimeout)
  const previous = audio; audio = null
  previous?.stop(); previous?.destroy()
  resource?.release(); resource = null
  playing.value = ''; loadingId.value = ''
}
async function play(message) {
  if (recording.value || !active) return
  if (playing.value === message.id || loadingId.value === message.id) { stopAudio(); return }
  stopAudio(); const version = epoch, token = getToken(), code = props.room.code
  voiceError.value = ''; loadingId.value = message.id
  try {
    const loaded = await loadVoice(code, message.audio, props.game)
    if (!active || version !== epoch || token !== getToken() || code !== props.room.code) { loaded.release(); return }
    resource = loaded
    const player = createVoicePlayer(); audio = player; player.src = loaded.url
    player.onPlay(() => { if (audio === player) { clearTimeout(playTimeout); loadingId.value = ''; playing.value = message.id } })
    player.onEnded(() => { if (audio === player) stopAudio() })
    player.onError(() => { if (audio === player) { stopAudio(); voiceError.value = '播放失败，请点击重试' } })
    playTimeout = setTimeout(() => { if (audio === player) { stopAudio(); voiceError.value = '播放超时，请点击重试' } }, 15000)
    player.play()
  } catch (error) {
    if (active && version === epoch) { stopAudio(); voiceError.value = error.message }
  }
}
watch(() => [props.room.code, props.room.me?.userId, props.room.phaseToken, props.room.me?.canSpeak, props.room.me?.skipAt].join('|'), () => {
  const hadRecording = recording.value || draft.value
  cancelRecording(); discardDraft(); pendingText = null
  if (hadRecording && active) voiceError.value = '发言状态已变化，未完成的录音已取消'
})
watch(() => [props.room.code, props.room.createdAt, props.room.me?.userId].join('|'), stopAudio)
function cleanup() {
  active = false; cancelRecording(); stopAudio(); discardDraft()
  focus(false)
}
watch(() => props.active, value => { if (value) active = true; else cleanup() }, { flush: 'sync' })
onHide(cleanup)
onBeforeUnmount(cleanup)
onShow(() => { active = props.active })
</script>
<style scoped>
.ww-chat {
	margin-top: 10px;
	padding: 12px;
	background: var(--k-paper2);
	border-radius: 12px;
}
.ww-chat__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	min-height: 30px;
	font-size: 14px;
	font-weight: 600;
}
.ww-chat__toggle {
	color: var(--k-muted);
	font-size: 12px;
	font-weight: 400;
}
.ww-chat__messages {
	max-height: 220px;
	overflow-y: auto;
	padding: 8px 0;
}
.ww-chat__message {
	display: flex;
	gap: 8px;
	padding: 6px 0;
	align-items: flex-start;
	font-size: 14px;
	line-height: 1.6;
}
.ww-chat__name {
	min-width: 44px;
	max-width: 74px;
	color: var(--k-muted);
	flex-shrink: 0;
	overflow-wrap: anywhere;
}
.ww-chat__text {
	flex: 1;
	min-width: 0;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}
.ww-chat__compose {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 8px;
}
.ww-chat__voice,
.ww-chat__record {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 8px;
	background: var(--k-green-soft);
	color: var(--k-green);
	border-radius: 10px;
	font-size: 14px;
	line-height: 1.5;
	padding: 8px 12px;
	margin: 0;
}
.ww-chat__voice::after,
.ww-chat__record::after {
	border: 0;
}
.ww-chat__record {
	width: 100%;
	margin-top: 10px;
	min-height: 44px;
	user-select: none;
}
.ww-chat__hint { display: block; margin-top: 8px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.ww-chat__record--on {
	background: var(--k-green);
	color: var(--k-paper);
}
.ww-chat__error {
	font-size: 13px;
	line-height: 1.6;
	color: var(--k-alert);
	padding-top: 8px;
}
</style>
