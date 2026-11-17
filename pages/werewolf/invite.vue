<template>
	<view class="ww-page">
		<k-topbar title="邀请好友" back :fab="false" />
		<view class="ww-body">
			<view v-if="!code" class="ww-state">邀请链接无效，请向朋友确认房间号</view>
			<view v-else-if="loading && !room" class="ww-state">正在读取房间邀请…</view>
			<view v-if="error" class="ww-error">
				<text>{{ error }}</text>
				<button class="ww-link" @click="refresh">重试</button>
			</view>
			<template v-if="room">
				<view class="invite-card">
					<ww-hero compact title="一起玩袋鼠狼人杀" />
					<view class="invite-card__body">
						<text class="invite-host">{{ hostName }}邀请你围坐一桌</text>
						<text class="ww-muted">房间号</text>
						<view
							class="invite-number"
							hover-class="k-press"
							@click="copy(code, '房间号已复制')"
						>
							{{ code }}
						</view>
						<text class="ww-muted">
							{{ room.playerCount || 6 }}人局 · {{ room.playMode === 'face_to_face' ? '线下面对面' : '线上组局' }} ·
							{{
								room.phase !== 'waiting'
									? '本局已开始'
									: room.players.length >= (room.playerCount || 6)
										? '好友已到齐'
										: '还差' + ((room.playerCount || 6) - room.players.length) + '人'
							}}
						</text>
						<image
							v-if="qr?.state === 'ready'"
							class="invite-qr"
							:src="qr.image"
							mode="aspectFit"
						/>
						<view v-else class="invite-method">
							<k-icon name="door-open" :size="28" color="green" />
							<text>在大厅输入房间号加入</text>
							<button
								v-if="room.me"
								class="ww-link"
								:disabled="qrLoading"
								@click="loadQr"
							>
								{{ qrLoading ? '正在生成小程序码…' : '生成微信小程序码' }}
							</button>
							<text v-if="qrError" class="invite-code-error">{{ qrError }}</text>
						</view>
						<text v-if="qr?.state === 'ready'" class="ww-note">扫码加入房间</text>
					</view>
				</view>
				<view class="ww-bottom">
					<k-button
						v-if="!room.me"
						block
						:disabled="busy || room.phase !== 'waiting' || room.players.length >= (room.playerCount || 6)"
						:label="
							room.phase !== 'waiting'
								? '本局已开始，暂时无法加入'
								: room.players.length >= (room.playerCount || 6)
									? '房间已满'
									: busy
										? '正在加入…'
										: '加入房间，自动入座'
						"
						@click="join"
					/>
					<k-button v-else block icon="share-2" open-type="share" @click="share">
						分享给好友
					</k-button>
					<view class="ww-actions-row">
						<view>
							<k-button
								block
								type="outline"
								size="md"
								@click="copy(inviteText(code), '邀请已复制')"
							>
								复制邀请链接
							</k-button>
						</view>
						<view>
							<k-button
								block
								type="outline"
								size="md"
								:disabled="saving"
								@click="save"
							>
								{{ saving ? '正在生成…' : '保存邀请卡' }}
							</k-button>
						</view>
					</view>
					<k-button v-if="room.me" block type="ghost" @click="go(routeFor(room))">
						返回我的房间
					</k-button>
				</view>
			</template>
		</view>
	</view>
</template>
<script setup>
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { getToken } from '@/common/request.js'
import { copy } from '@/common/ui.js'
import { go, toast } from '@/common/screen.js'
import WwHero from './components/ww-hero.vue'
import { invitePath, inviteText, inviteCode, routeFor, roomCode } from './api.js'
import { useRoom } from './use-room.js'
import { saveInvitation } from './invitation-poster.js'
const code = ref('')
const { room, error, loading, busy, refresh, act } = useRoom(code)
const qr = ref(null)
const qrError = ref('')
const qrLoading = ref(false)
const saving = ref(false)
const hostName = computed(
	() => room.value?.players.find((p) => p.userId === room.value.hostId)?.name || '袋鼠朋友'
)
onLoad((q) => {
	let value = q.code
	if (q.scene) {
		try {
			value = decodeURIComponent(q.scene).replace(/^w_/, '')
		} catch {
			value = ''
		}
	}
	code.value = roomCode(value)
})
const pageShareMessage = () => ({
	title: hostName.value + '邀请你玩袋鼠狼人杀，房间' + code.value,
	path: invitePath(code.value)
})
async function join() {
	const joined = await act('join')
	if (joined) go(routeFor(joined))
}
function share() {
	// #ifdef H5
	copy(inviteText(code.value), '邀请已复制，发给朋友即可')
	// #endif
}
async function loadQr() {
	if (qrLoading.value) return
	qrLoading.value = true
	qrError.value = ''
	let env
	// #ifdef MP-WEIXIN
	try {
		env = wx.getAccountInfoSync().miniProgram.envVersion
	} catch {}
	// #endif
	const token = getToken()
	try {
		const result = await inviteCode(code.value, env)
		if (token !== getToken()) return
		qr.value = result
		if (result.state !== 'ready')
			qrError.value = result.message || '小程序码暂时不可用，可用房间号加入'
	} catch (e) {
		qrError.value = e.message
	} finally {
		qrLoading.value = false
	}
}
async function save() {
	if (saving.value) return
	saving.value = true
	try {
		toast(await saveInvitation(code.value, qr.value, room.value))
	} catch (e) {
		toast(e.message)
	} finally {
		saving.value = false
	}
}

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>
<style lang="scss">
@import './werewolf.scss';
</style>
<style scoped>
.invite-card {
	border-radius: 20px;
	overflow: hidden;
	background: var(--k-paper);
	box-shadow: var(--k-sh1);
}
.invite-card__body {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 24px 16px;
	text-align: center;
}
.invite-host {
	font-size: 15px;
	margin-bottom: 22px;
}
.invite-number {
	color: #244b3c;
	font-size: 48px;
	font-weight: 700;
	letter-spacing: 6px;
	padding: 8px 12px;
	line-height: 1.3;
	font-variant-numeric: tabular-nums;
}
.invite-qr {
	width: 180px;
	height: 180px;
	margin-top: 20px;
}
.invite-method {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 10px;
	width: 100%;
	margin-top: 20px;
	padding: 18px 10px;
	box-sizing: border-box;
	background: var(--k-green-soft);
	border-radius: 12px;
	font-size: 14px;
	color: var(--k-green);
}
.invite-code-error {
	color: var(--k-muted);
	font-size: 12px;
	line-height: 1.6;
}
</style>
