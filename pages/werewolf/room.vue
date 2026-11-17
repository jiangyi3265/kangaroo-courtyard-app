<template>
	<view class="ww-page">
		<k-topbar title="好友房间" back :fab="false" custom-back @back="goLobby" />
		<view class="ww-body">
			<view v-if="!code" class="ww-state">房间号无效，请返回大厅重新加入</view>
			<view v-else-if="loading && !room" class="ww-state">正在打开房间…</view>
			<view v-if="error" class="ww-error">
				<text>{{ error }}</text>
				<button class="ww-link" @click="refresh">重试</button>
			</view>
			<template v-if="room">
				<view class="room-summary">
					<view hover-class="k-press" @click="copy(code, '房间号已复制')">
						<view class="ww-row">
							<text class="room-summary__code">房间号 {{ code }}</text>
							<k-icon name="copy" :size="15" color="white" />
						</view>
						<text class="room-summary__meta">
							发言{{ room.speechSeconds }}秒 · 夜间{{ room.nightSeconds }}秒 · 投票{{ room.voteSeconds }}秒
						</text>
						<text class="room-summary__meta">{{ room.allowExtension ? '每轮可加时30秒' : '本局关闭加时' }}</text>
						<text class="room-summary__meta">{{ modeLabel(room.playMode) }} · 6–12人 · 按到场人数开局</text>
					</view>
					<button class="room-settings" @click="settings">
						<k-icon class="room-settings-content" name="settings" :size="19" color="white" />
						<text class="room-settings-content">设置</text>
					</button>
				</view>
				<ww-sound :active="pageActive" />
				<view class="ww-heading">
					<text class="ww-heading__title">等待好友入座</text>
					<text class="seat-count">{{ seated }}/{{ room.playerCount || 6 }}</text>
				</view>
				<ww-table
					:player-count="room.playerCount || 6" :play-mode="room.playMode"
					:players="room.players"
					:host-id="room.hostId"
					:me-id="room.me?.userId"
					:disabled="busy"
					center-label="袋鼠好友局"
					@seat="chooseSeat"
				/>
				<view v-if="showSettings" class="room-settings-mask" @click="showSettings = false"><scroll-view scroll-y class="room-options" @click.stop>
					<view class="ww-row"><text class="ww-note">{{ isHost ? '仅房主可修改，保存后生效' : '仅房主可以修改设置' }}</text><button class="ww-link" @click="showSettings = false">关闭</button></view>
					<text class="room-options__title">本局玩法</text>
					<text class="ww-note">{{ lineupText(roleCountsFor(Math.max(6, seated))) }}</text>
					<view class="room-options__choices"><button v-for="mode in PLAY_MODES" :key="mode.key" :class="{selected:draftSettings.playMode === mode.key}" :disabled="!isHost || busy" @click="draftSettings.playMode = mode.key">{{ mode.label }}</button></view>
					<text class="ww-note">进入即入座并自动准备，6–12人可开局，身份按到场人数分配；开局时按座位顺序连续编号。</text>
					<text class="room-options__title">本局时间设置</text>
					<view
						v-for="setting in timeSettings"
						:key="setting.key"
						class="room-options__row"
					>
						<text>{{ setting.label }}</text>
						<view class="room-options__choices">
							<button
								v-for="seconds in setting.values"
								:key="seconds"
								:class="{ selected: draftSettings[setting.key] === seconds }"
								:disabled="!isHost || busy"
								@click="draftSettings[setting.key] = seconds"
							>
								{{ seconds }}秒
							</button>
						</view>
					</view>
					<view class="room-options__row">
						<text>每轮允许一次 +30 秒</text>
						<switch
							:checked="draftSettings.allowExtension"
							:disabled="!isHost || busy"
							color="#537b40"
							@change="draftSettings.allowExtension = $event.detail.value"
						/>
					</view>
					<text class="ww-note">设置保存后同步给全房间，保留当前准备状态。夜晚共{{ Math.max(6, seated) >= 10 ? 4 : 3 }}个环节，总计{{ draftSettings.nightSeconds * (Math.max(6, seated) >= 10 ? 4 : 3) }}秒。</text>
					<text v-if="error" class="settings-error">{{ error }}</text>
					<k-button v-if="isHost" block :disabled="busy" @click="saveSettings"
						>{{ busy ? '正在保存…' : '保存本局设置' }}</k-button
					>
				</scroll-view>
				</view><view class="ww-lineup">
					<text>{{ lineupText(room.roleCounts || roleCountsFor(room.playerCount)) }}</text>
				</view>
				<text v-if="room.me && !room.me.seat" class="ww-note">
					点一张空椅子坐下，准备和朋友一起玩
				</text>
				<view v-if="unseated.length" class="ww-muted">
					<text>正在同步座位</text>
					<view v-for="person in unseated" :key="person.userId" class="unseated-player">
						<text>{{ person.name }}{{ person.online ? '' : ' · 暂时离线' }}</text>
						<button
							v-if="isHost && person.canKick && person.userId !== room.me.userId"
							class="ww-link"
							:disabled="busy"
							@click="removePlayer(person)"
						>
							移出
						</button>
					</view>
				</view>
				<ww-chat :active="pageActive" :recorded-voice="room.playMode !== 'face_to_face'" :key="room.me?.userId" v-if="room.me && !showSettings" :room="room" :busy="busy" @send="send" @refresh="refresh" />
				<text class="ww-note">入座即准备。等待中离线超过2分钟自动腾位；房主可提前移出离线朋友。</text>
				<view class="ww-bottom">
					<k-button v-if="!room.me" block :disabled="busy" @click="act('join')">
						加入房间
					</k-button>
					<template v-else>
						<view class="ww-actions-row">
							<view>
								<k-button
									block
									:type="canStart ? 'outline' : 'primary'"
									size="md"
									icon="share-2"
									@click="go('/pages/werewolf/invite?code=' + code)"
								>
									邀请好友入座
								</k-button>
							</view>

						</view>
						<template v-if="isHost">
							<text class="ww-note">
								{{
									canStart ? '大家准备好了，开始本局吧' : '至少6位玩家入座即可开局'
								}}
							</text>
							<k-button block :disabled="busy || !canStart" @click="act('start')">
								开始游戏
							</k-button>
						</template>
						<text v-else class="ww-note">已自动准备，等待房主开局</text>
						<button class="ww-link leave-room" @click="leave">退出房间</button>
					</template>
				</view>
				<view class="ww-rule"><text class="ww-rule__title">{{ modeLabel(room.playMode) }} · 6–12人 · 按到场人数开局</text><text class="ww-rule__copy">{{ lineupText(room.roleCounts || roleCountsFor(room.playerCount)) }}</text><text class="ww-rule__copy">{{ room.playMode === 'face_to_face' ? '每人用自己的手机入座并查看身份；夜晚各自操作，白天面对面按顺序发言，无需开启麦克风。' : '按住录音，松开发送，点击语音条收听。等待好友和结算时自由交流，对局中按发言回合发送，也可以打字。' }}</text></view>
			</template>
			<text class="ww-note">录音语音版 · {{ APP_VERSION }}</text>
		</view>
	</view>
</template>
<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { go } from '@/common/screen.js'
import { copy } from '@/common/ui.js'
import WwTable from './components/ww-table.vue'
import WwChat from './components/ww-chat.vue'
import WwSound from './components/ww-sound.vue'
import { APP_VERSION } from '@/common/config.js'
import { roomCode, routeFor, invitePath, PLAY_MODES, modeLabel, roleCountsFor, lineupText } from './api.js'
import { useRoom } from './use-room.js'
const code = ref('')
const showSettings = ref(false)
const draftSettings = ref({})
const timeSettings = [
	{ key: 'speechSeconds', label: '每人发言', values: [30, 45, 60, 90, 120] },
	{ key: 'nightSeconds', label: '每个身份行动', values: [15, 20, 30, 45, 60] },
	{ key: 'voteSeconds', label: '放逐投票', values: [30, 45, 60] }
]
let moving = false
const { room, error, loading, busy, refresh, act, stop, pageActive } = useRoom(code, (data) => {
	if (data.me && data.phase !== 'waiting' && !moving) {
		moving = true
		stop()
		uni.redirectTo({
			url: routeFor(data),
			complete: () => {
				moving = false
			}
		})
	}
})
onLoad((q) => {
	code.value = roomCode(q.code)
})
onShareAppMessage(() => ({ title: '一起围坐一桌，玩袋鼠狼人杀', path: invitePath(code.value) }))
const isHost = computed(() => room.value?.hostId === room.value?.me?.userId)
const seated = computed(() => room.value?.players.filter((p) => p.seat > 0).length || 0)
const unseated = computed(() => room.value?.players.filter((p) => !p.seat) || [])
const canStart = computed(() => seated.value >= 6 && seated.value <= 12 && room.value.players.every((p) => p.seat > 0 && p.ready))
function goLobby() { moving = true; stop(); uni.redirectTo({ url: '/pages/werewolf/index' }) }
async function chooseSeat(seat) {
	if (!room.value.me) {
		await act('join')
		if (!room.value.me) return
	}
	if (!seat.player) {
		await act('seat', { seat: seat.number })
		return
	}
	if (isHost.value && seat.player.canKick && seat.player.userId !== room.value.me.userId) {
		removePlayer(seat.player)
	} else
		uni.showToast({
			title:
				seat.player.userId === room.value.me.userId ? '你正坐在这里' : '这张椅子已经有人啦',
			icon: 'none'
		})
}
function removePlayer(person) {
	uni.showModal({
		title: '移出离线玩家',
		content: person.name + '已离线超过一分钟，移出后可以邀请新朋友。',
		success: (r) => {
			if (r.confirm) act('kick', { userId: person.userId })
		}
	})
}
function settings() {
	if (!room.value) return
	draftSettings.value = {
		playMode: room.value.playMode || 'online',
		speechSeconds: room.value.speechSeconds,
		nightSeconds: room.value.nightSeconds,
		voteSeconds: room.value.voteSeconds,
		allowExtension: room.value.allowExtension
	}
	showSettings.value = !showSettings.value
}
async function saveSettings() {
	if (!isHost.value) return
	if (await act('settings', { ...draftSettings.value })) { showSettings.value = false; uni.showToast({ title: '设置已保存', icon: 'success' }) }
}
const send = (text) => act('message', { text })
function leave() {
	uni.showModal({
		title: '退出房间',
		content: isHost.value ? '退出后，房主将交给下一位朋友。' : '退出后将腾出你的座位。',
		success: async (r) => {
			if (r.confirm && (await act('leave'))) goLobby()
		}
	})
}
</script>
<style lang="scss">
@import './werewolf.scss';
</style>
<style scoped>
.settings-error{display:block;color:var(--k-alert);font-size:13px;line-height:1.6;padding:8px 0}
.room-settings-mask{position:fixed;inset:0;z-index:220;background:#0007;display:flex;align-items:center;justify-content:center;padding:22px}
.room-settings-mask .room-options{width:100%;height:75vh;background:#fff9ef;padding:18px;border-radius:18px;box-sizing:border-box}
.room-settings-content{pointer-events:none}
.ww-rule__copy{display:block}
.room-summary {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 14px;
	border-radius: 14px;
	color: #fff5df;
	background: #244b3c;
}
.room-summary__code {
	font-size: 17px;
	font-weight: 600;
	letter-spacing: 0.5px;
}
.room-summary__meta {
	display: block;
	font-size: 12px;
	margin-top: 4px;
	opacity: 0.85;
}
.room-settings {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 3px;
	margin: 0;
	padding: 4px 0 4px 12px;
	line-height: 1.4;
	font-size: 12px;
	color: #fff5df;
	background: transparent;
}
.room-settings::after {
	border: 0;
}
.seat-count {
	font-size: 18px;
	font-weight: 600;
	color: var(--k-green);
}
.leave-room {
	color: var(--k-muted);
	margin-top: 2px;
}
.unseated-player {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	min-height: 40px;
}
.room-options {
	padding: 16px 0;
	border-bottom: 1px solid var(--k-line2);
}
.room-options__title {
	display: block;
	font-size: 17px;
	font-weight: 600;
	margin-bottom: 16px;
}
.room-options__row {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	align-items: center;
	gap: 10px;
	margin-bottom: 18px;
	font-size: 14px;
}
.room-options__choices {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}
.room-options__choices button {
	margin: 0;
	padding: 6px 10px;
	background: var(--k-paper2);
	line-height: 1.4;
	font-size: 13px;
	color: var(--k-ink);
	border-radius: 9px;
}
.room-options__choices button.selected {
	background: var(--k-green);
	color: var(--k-paper);
}
.room-options__choices button::after {
	border: none;
}
</style>
