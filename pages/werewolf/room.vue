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
					<view class="room-summary__main" hover-class="k-press" @click="copy(code, '房间号已复制')">
						<view class="ww-row room-summary__code-row">
							<text class="room-summary__code">房间号 {{ code }}</text>
							<k-icon name="copy" :size="16" color="white" />
						</view>
						<text class="room-summary__meta">
							发言{{ room.speechSeconds }}秒 · 夜间{{ room.nightSeconds }}秒 · 投票{{ room.voteSeconds }}秒
						</text>
						<text class="room-summary__meta">{{ room.allowExtension ? '每轮可加时30秒' : '本局关闭加时' }}</text>
						<text class="room-summary__meta">{{ modeLabel(room.playMode) }} · 6–12人 · 按到场人数开局</text>
					</view>
					<button class="room-settings" @click="settings">
						<k-icon class="room-settings-content" name="settings" :size="16" color="white" />
						<text class="room-settings-content">设置</text>
					</button>
				</view>
				<view class="ww-heading">
					<view class="ww-row">
						<text class="ww-heading__title">等待好友入座</text>
						<text class="seat-count">{{ seated }}/{{ room.playerCount || 6 }}</text>
					</view>
					<ww-sound :active="pageActive" />
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
				<view v-if="showSettings" class="room-settings-mask" @click="showSettings = false"><view class="room-options" @click.stop>
					<view class="room-options__head"><view class="ww-row"><text class="room-options__title">本局玩法</text><button class="room-options__close" aria-label="关闭" @click="showSettings = false"><k-icon name="x" :size="16" color="muted" /><text class="room-options__close-text">关闭</text></button></view><text class="ww-note">{{ isHost ? '仅房主可修改，保存后生效' : '仅房主可以修改设置' }}</text></view>
					<scroll-view scroll-y class="room-options__scroll">
					<text class="ww-note">{{ lineupText(roleCountsFor(Math.max(6, seated))) }}</text>
					<view class="room-options__choices room-options__mode"><button v-for="mode in PLAY_MODES" :key="mode.key" :class="{selected:draftSettings.playMode === mode.key}" :disabled="!isHost || busy" @click="draftSettings.playMode = mode.key">{{ mode.label }}</button></view>
					<text class="ww-note">进入即入座并自动准备，6–12人可开局，身份按到场人数分配；开局时按座位顺序<text class="ww-tail">连续编号。</text></text>
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
					</scroll-view>
					<view v-if="error || isHost" class="room-options__foot">
					<text v-if="error" class="settings-error">{{ error }}</text>
					<k-button v-if="isHost" block :disabled="busy" @click="saveSettings"
						>{{ busy ? '正在保存…' : '保存本局设置' }}</k-button
					>
					</view>
				</view>
				</view><view class="ww-lineup">
					<text>{{ lineupText(room.roleCounts || roleCountsFor(room.playerCount)) }}</text>
				</view>
				<text v-if="room.me && !room.me.seat" class="ww-note">
					点一张空椅子坐下，准备和朋友一起玩
				</text>
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
									round
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
							<k-button block round class="room-start" :disabled="busy || !canStart" @click="act('start')">
								开始游戏
							</k-button>
						</template>
						<text v-else class="ww-note">已自动准备，等待房主开局</text>
						<button class="ww-link leave-room" @click="leave">退出房间</button>
					</template>
				</view>
				<view v-if="unseated.length" class="ww-muted unseated">
					<view class="ww-row unseated__label"><k-icon name="users" :size="14" color="muted" /><text>正在同步座位</text></view>
					<view class="unseated__list"><view v-for="person in unseated" :key="person.userId" class="unseated-player">
						<text>{{ person.name }}{{ person.online ? '' : ' · 暂时离线' }}</text>
						<button
							v-if="isHost && person.canKick && person.userId !== room.me.userId"
							class="ww-link"
							:disabled="busy"
							@click="removePlayer(person)"
						>
							移出
						</button>
					</view></view>
				</view>
				<ww-chat :active="pageActive" :recorded-voice="room.playMode !== 'face_to_face'" :key="room.me?.userId" v-if="room.me && !showSettings" :room="room" :busy="busy" @send="send" @refresh="refresh" />
				<text class="ww-note room-chat-note">入座即准备。等待中离线超过2分钟自动腾位；房主可提前移出<text class="ww-tail">离线朋友。</text></text>
				<view class="ww-rule room-footnote"><text class="ww-rule__title">{{ modeLabel(room.playMode) }} · 6–12人 · 按到场人数开局</text><text class="ww-rule__copy">{{ lineupText(room.roleCounts || roleCountsFor(room.playerCount)) }}</text><text class="ww-rule__copy">{{ room.playMode === 'face_to_face' ? '每人用自己的手机入座并查看身份；夜晚各自操作，白天面对面按顺序发言，无需开启麦克风。' : '按住录音，松开发送，点击语音条收听。等待好友和结算时自由交流，对局中按发言回合发送，也可以打字。' }}</text></view>
			</template>
			<text class="ww-note room-version">录音语音版 · {{ APP_VERSION }}</text>
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
/* 11-18 第三轮：房间号是一张深绿「房卡」，设置收成右上角小胶囊；背景音乐挪到「等待好友入座」标题行右边；
   聊天、未入座名单、玩法说明都是白卡；设置弹层 16 圆角，选项胶囊 32 高 */
.settings-error{display:block;color:var(--k-alert);font-size:13px;line-height:1.6;padding:8px 0}
.room-settings-mask{position:fixed;inset:0;z-index:220;background:var(--ww-mask);display:flex;align-items:center;justify-content:center;padding:24px 16px}
/* 返修第 3 轮：弹层分上中下三段——标题和关闭固定、中间滚动、底部「保存本局设置」固定，矮屏也完整可见 */
.room-settings-mask .room-options{display:flex;flex-direction:column;width:100%;height:80vh;max-height:680px;background:var(--k-paper);padding:4px 20px 0;border-radius:16px;box-sizing:border-box;border:0;overflow:hidden}
.room-options__scroll{flex:1;height:0;min-height:0}
.room-options__foot{position:relative;flex-shrink:0;margin:0 -20px;padding:12px 20px 16px}
.room-options__foot::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.room-options__foot .settings-error{padding:0 0 8px}
.room-options .room-options__mode{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.room-options .room-options__mode button{padding:0;text-align:center}
.room-settings-content{pointer-events:none}
.ww-rule__copy{display:block}
.ww-rule__copy + .ww-rule__copy{margin-top:4px}
/* 返修第 2 轮：「设置」胶囊浮在房卡右上角，三行说明拿到整张卡的宽度，320 宽也不折行 */
.room-summary {
	position: relative;
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 12px;
	padding: 16px;
	border-radius: 12px;
	color: var(--ww-cream);
	background: var(--ww-deep);
}
.room-summary__main {
	flex: 1;
	min-width: 0;
}
.room-summary__code-row {
	gap: 6px;
	margin-bottom: 8px;
}
.room-summary__code {
	font-size: 20px;
	font-weight: 700;
	line-height: 28px;
	letter-spacing: 1px;
	font-variant-numeric: tabular-nums;
}
.room-summary__meta {
	display: block;
	font-size: 12px;
	line-height: 1.6;
	opacity: 0.82;
	word-break: keep-all;
}
.ww-rule__title {
	word-break: keep-all;
}
@media (max-width: 350px) {
	.room-summary__meta { font-size: 11px; }
	.room-summary__code { font-size: 18px; }
}
.room-settings {
	position: absolute;
	top: 14px;
	right: 16px;
	display: flex;
	align-items: center;
	gap: 4px;
	flex-shrink: 0;
	height: 32px;
	margin: 0;
	padding: 0 12px;
	line-height: 32px;
	font-size: 12px;
	color: var(--ww-cream);
	background: var(--ww-night-tint);
	border-radius: 16px;
}
.room-settings::after {
	border: 0;
}
.ww-heading {
	margin: 24px 0 12px;
}
.ww-heading .ww-row {
	gap: 8px;
	align-items: baseline;
}
.seat-count {
	font-size: 15px;
	font-weight: 600;
	color: var(--k-green);
	font-variant-numeric: tabular-nums;
}
.ww-lineup {
	padding: 12px 0 0;
}
/* 返修第 2 轮：没入座名单收成一行——左边 12 号灰字，右边名字是 28 高浅底胶囊 */
.unseated {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-top: 12px;
	padding: 12px 16px;
	border-radius: 12px;
	background: var(--k-paper);
	font-size: 12px;
}
.unseated__label {
	flex-shrink: 0;
	gap: 4px;
}
.unseated__list {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-start;
	gap: 8px;
	flex: 1;
	min-width: 0;
}
.unseated-player {
	display: flex;
	align-items: center;
	gap: 4px;
	height: 28px;
	padding: 0 12px;
	border-radius: 14px;
	background: var(--k-page);
	color: var(--k-ink);
	font-size: 13px;
}
.unseated-player .ww-link {
	min-height: 28px;
	color: var(--k-alert);
	font-size: 12px;
}
/* 返修第 4 轮：邀请 / 开始游戏整段挪到身份配置下面（第一屏就能看到），聊天和说明排在按钮后面 */
.ww-bottom {
	padding: 16px 0 12px;
}
.ww-bottom .ww-note {
	margin: 4px 0;
}
.leave-room {
	align-self: center;
	color: var(--k-muted);
	font-size: 13px;
	min-height: 40px;
}
.ww-rule {
	margin-top: 16px;
}
/* 返修第 1 轮：玩法说明降成页脚注释，不和上面的操作区抢
   返修第 2 轮：标题也降成 12/500 灰字，和版本号合成一块脚注；文字左边对齐到页边距 16 */
.ww-rule.room-footnote {
	margin-top: 24px;
	padding: 0;
	border-radius: 0;
	background: transparent;
}
.room-footnote .ww-rule__title {
	margin-bottom: 2px;
	font-size: 11px;
	font-weight: 500;
	line-height: 1.6;
	color: var(--k-light);
}
.room-footnote .ww-rule__copy {
	font-size: 11px;
	line-height: 1.6;
	color: var(--k-light);
}
.room-chat-note {
	margin: 8px 0 0;
	padding: 0;
	text-align: left;
}
.unseated > text {
	flex-shrink: 0;
}
.room-options__close {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	margin: 0 -6px 0 0;
	padding: 0;
	background: transparent;
	border: 0;
}
.room-options__close::after {
	border: 0;
}
.room-version {
	margin-top: 16px;
	font-size: 11px;
	color: var(--k-light);
}
.room-footnote + .room-version {
	margin-top: 8px;
	text-align: left;
}
.room-options {
	padding: 16px 0;
}
/* 返修第 2 轮：弹层头部 = 标题「本局玩法」17/600 + 关闭按钮，说明在标题下 12 号，下面一条发丝线 */
.room-options__head {
	position: relative;
	padding: 12px 0;
	margin-bottom: 12px;
}
.room-options__head::after {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 1px;
	background: var(--k-line);
	transform: scaleY(0.5);
}
.room-options .ww-row {
	justify-content: space-between;
}
.room-options__head .room-options__title {
	margin: 0;
	font-size: 17px;
}
.room-options__head .ww-note {
	margin: 2px 0 0;
	text-align: left;
}
.room-options .ww-row .ww-link {
	font-size: 14px;
	color: var(--k-ink2);
}
.room-options .ww-note {
	text-align: left;
}
.room-options__title {
	display: block;
	color: var(--k-ink);
	font-size: 16px;
	font-weight: 600;
	line-height: 1.4;
	margin: 16px 0 8px;
}
.room-options__row {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	align-items: center;
	gap: 8px;
	margin-bottom: 16px;
	font-size: 13px;
	color: var(--k-muted);
}
.room-options__choices {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
/* 返修第 2 轮：时长选项按 5 格等分（3 个选项的那行对齐前 3 格），320 宽也不会单个掉到第二行 */
.room-options__row > .room-options__choices {
	flex-basis: 100%;
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: 6px;
}
.room-options__row > .room-options__choices button {
	padding: 0;
	text-align: center;
}
.room-options__choices button {
	height: 32px;
	margin: 0;
	padding: 0 12px;
	background: var(--k-page);
	line-height: 32px;
	font-size: 13px;
	color: var(--k-ink2);
	border-radius: 16px;
}
.room-options__choices button.selected {
	background: var(--k-green-soft);
	color: var(--k-green);
	font-weight: 600;
}
.room-options__choices button::after {
	border: none;
}
.room-options__foot :deep(.k-button) {
	margin-top: 0;
}
/* 返修第 5 轮：弹层 80vh（最高 680），滚动区最后一段说明下面留 12，打开时整段可见 */
.room-options__scroll .ww-note:last-child {
	display: block;
	padding-bottom: 12px;
}
@media (max-width: 360px) {
	.room-options__row > .room-options__choices {
		gap: 4px;
	}
	.room-options__row > .room-options__choices button {
		font-size: 12px;
	}
}
/* 「退出房间」到「正在同步座位」卡约 24（原来 44） */
.ww-bottom + .unseated {
	margin-top: 0;
}
/* 聊天卡下的说明降成 12 号灰字，和页脚注释并成一组：离聊天卡 16，组内 8 */
.room-chat-note {
	margin-top: 16px;
	font-size: 12px;
	line-height: 1.6;
	color: var(--k-muted);
}
.room-chat-note + .ww-rule.room-footnote {
	margin-top: 8px;
}
.room-footnote .ww-rule__copy:nth-child(2) {
	word-break: keep-all;
}
/* 返修第 3 轮：「邀请好友入座」「开始游戏」同为 44 高；没到齐时开始游戏是主按钮 40% 透明（werewolf.scss） */
/* 11-18 第四轮：「关闭」两个字看得见——x 图标 16 + 13 号灰字（间距 4），整颗 32 高，贴标题行右端 */
.room-options__close {
	width: auto;
	gap: 4px;
	padding: 0 4px;
	margin: 0 -4px 0 0;
	line-height: 32px;
}
.room-options__close-text {
	font-size: 13px;
	color: var(--k-muted);
}
/* 11-19：说明末尾整词不折开，末行不会只剩「号。」「朋友。」 */
.ww-tail {
	white-space: nowrap;
}
</style>
