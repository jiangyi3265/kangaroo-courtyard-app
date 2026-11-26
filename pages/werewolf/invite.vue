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
						<view v-else class="invite-way" :class="{ 'invite-way--solo': !room.me }">
							<view class="invite-method">
								<view class="invite-method__icon"><k-icon name="door-open" :size="room.me ? 16 : 14" :color="room.me ? 'green' : 'muted'" /></view>
								<text class="invite-method__text">在大厅输入房间号加入</text>
							</view>
							<button
								v-if="room.me"
								class="invite-qr-btn"
								:disabled="qrLoading"
								@click="loadQr"
							>
								<view class="invite-method__icon"><k-icon name="qr-code" :size="16" color="green" /></view>
								<text class="invite-method__text">{{ qrLoading ? '正在生成小程序码…' : '生成微信小程序码' }}</text>
								<k-icon name="chevron-right" :size="12" color="muted" />
							</button>
							<view v-if="qrError" class="invite-code-error"><k-icon name="info" :size="14" color="muted" /><text>{{ qrError }}</text></view>
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
								round
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
								round
								:disabled="saving"
								@click="save"
							>
								{{ saving ? '正在生成…' : '保存邀请卡' }}
							</k-button>
						</view>
					</view>
					<k-button v-if="room.me" block type="ghost" size="md" class="invite-back" @click="go(routeFor(room))">
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
/* 11-18 第三轮：邀请卡 12 圆角无投影；房间号 40 号等宽大字是这一屏唯一的焦点；按钮一主两次，44 / 40 两档 */
.invite-card {
	border-radius: 12px;
	overflow: hidden;
	background: var(--k-paper);
}
.invite-card__body {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 20px 16px 24px;
	text-align: center;
}
.invite-host {
	font-size: 14px;
	line-height: 1.5;
	color: var(--k-ink2);
	margin-bottom: 16px;
}
.invite-card__body > .ww-muted {
	font-size: 12px;
}
.invite-number {
	color: var(--ww-deep);
	font-size: 40px;
	font-weight: 700;
	letter-spacing: 4px;
	padding: 0 12px;
	margin: 4px 0 8px;
	line-height: 1.3;
	font-variant-numeric: tabular-nums;
}
.invite-qr {
	width: 168px;
	height: 168px;
	margin-top: 16px;
}
/* 返修第 1 轮：「在大厅输入房间号加入」收成一行（32 浅绿圆 + 13 号字），不再像空状态
   返修第 2 轮：「生成微信小程序码」从这块里拿出来，做成下面单独一颗 40 高描边按钮；出错说明在按钮下 8 */
/* 返修第 3 轮：「在大厅输入房间号加入」「生成微信小程序码」合成一组「其它加入方式」：同一块浅底，中间发丝线；小程序码是一行文字入口，不再是第二颗通栏描边按钮 */
.invite-way {
	width: 100%;
	margin-top: 20px;
	border-radius: 12px;
	background: var(--k-page);
	overflow: hidden;
}
.invite-method {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	min-height: 48px;
	padding: 8px 12px;
	text-align: left;
	box-sizing: border-box;
	font-size: 13px;
	line-height: 1.5;
	color: var(--k-ink2);
}
.invite-method__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background: var(--k-green-soft);
}
.invite-method__text {
	flex: 1;
	min-width: 0;
}
.invite-qr-btn {
	position: relative;
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	min-height: 48px;
	margin: 0;
	padding: 8px 12px;
	box-sizing: border-box;
	border: 0;
	border-radius: 0;
	background: transparent;
	color: var(--k-ink);
	font-size: 14px;
	font-weight: 500;
	line-height: 1.5;
	text-align: left;
}
.invite-qr-btn::before {
	content: '';
	position: absolute;
	left: 52px;
	right: 0;
	top: 0;
	height: 1px;
	background: var(--k-line);
	transform: scaleY(0.5);
}
.invite-qr-btn::after {
	border: 0;
}
.invite-qr-btn[disabled] {
	color: var(--k-light);
	background: transparent;
}
/* 返修第 4 轮：出错说明和上面两行文字同一条左边线（12 + 32 圆 + 8 = 52） */
.invite-code-error {
	display: flex;
	align-items: flex-start;
	gap: 4px;
	padding: 0 12px 12px 52px;
	text-align: left;
	color: var(--k-muted);
	font-size: 12px;
	line-height: 1.6;
}
.ww-bottom {
	padding-top: 16px;
}
.ww-actions-row :deep(.k-button) {
	height: 44px;
	font-size: 14px;
}
/* 返修第 5 轮：主按钮 → 12 → 两颗次按钮（都 44 高）→ 8 → 文字按钮「返回我的房间」 */
.ww-bottom > .ww-actions-row {
	margin-top: 4px;
}
.ww-bottom .invite-back {
	height: 40px;
	color: var(--k-muted);
	font-size: 13px;
	font-weight: 500;
}
/* 返修第 4 轮：没加入时这一组只剩「在大厅输入房间号加入」一行且不能点——去掉浅底块，改成居中一行灰字说明 */
.invite-way--solo {
	margin-top: 12px;
	border-radius: 0;
	background: transparent;
}
.invite-way--solo .invite-method {
	justify-content: center;
	gap: 4px;
	min-height: 0;
	padding: 0;
	font-size: 12px;
	color: var(--k-muted);
}
.invite-way--solo .invite-method__icon {
	width: auto;
	height: auto;
	background: transparent;
}
.invite-way--solo .invite-method__text {
	flex: none;
}
/* 11-19：去掉卡中卡的灰底框，两行和卡片内容同一条左右线；组顶一根发丝线，两行之间一根（从文字起） */
.invite-way {
	position: relative;
	margin-top: 16px;
	border-radius: 0;
	background: transparent;
	overflow: visible;
}
.invite-way::before {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	height: 1px;
	background: var(--k-line);
	transform: scaleY(0.5);
}
.invite-way .invite-method,
.invite-way .invite-qr-btn {
	padding-left: 0;
	padding-right: 0;
}
.invite-way .invite-qr-btn::before {
	left: 40px;
}
.invite-way .invite-code-error {
	padding: 0 0 8px 40px;
}
.invite-way--solo {
	margin-top: 12px;
}
.invite-way--solo::before {
	content: none;
}
</style>
