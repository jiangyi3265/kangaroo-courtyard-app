<template>
	<view class="ww-page">
		<k-topbar title="对局结算" back custom-back :fab="false" @back="lobby" />
		<view class="ww-body">
			<view v-if="loading && !result" class="ww-state">正在读取对局结果…</view>
			<view v-if="error || archiveError" class="ww-error">
				<text>{{ archiveError || error }}</text>
				<button class="ww-link" @click="reload">重试</button>
			</view>
			<template v-if="result">
				<ww-hero
					compact
					:title="resultLabel(result.winner)"
					:subtitle="'共' + result.day + '天 · 用时' + minutes + '分钟'"
				/>
				<view class="my-result">
					<view class="my-result__art">
						<ww-role-art :role="roleOf(result.me?.role)" bust />
					</view>
					<view class="my-result__copy">
						<text class="my-result__label">本局身份</text>
						<text class="ww-pill">{{ roleOf(result.me?.role).label }}</text>
					</view>
					<text v-if="roleOf(result.me?.role).team" class="my-result__team" :class="roleOf(result.me?.role).team === '狼人阵营' ? 'my-result__team--wolf' : ''">{{ roleOf(result.me?.role).team }}</text>
				</view>
				<view class="ww-heading">
					<view class="ww-row result-heading">
						<text class="ww-heading__title">身份揭晓</text>
						<text class="ww-muted">房间 {{ code }}</text>
					</view>
					<ww-sound :active="pageActive" />
				</view>
				<ww-table
					:player-count="result.playerCount || 6" :play-mode="result.playMode"
					:players="result.players"
					:me-id="result.me?.userId"
					:host-id="result.hostId"
					phase="finished"
					center-label="本局结束"
				/>
				<view class="ww-bottom">
					<k-button
						v-if="!gameId && room?.hostId === room?.me?.userId"
						block
						:disabled="busy"
						@click="act('replay')"
					>
						原班人马再来一局
					</k-button>
					<text v-else-if="!gameId" class="ww-note">
						等待房主再来一局，准备后会自动进入房间
					</text>
					<k-button block :type="gameId ? 'primary' : 'outline'" round @click="lobby">返回大厅</k-button>
				</view>
				<ww-chat :active="pageActive" :recorded-voice="room.playMode !== 'face_to_face'" :key="room.me?.userId"
					v-if="!gameId && room?.me"
					:room="room"
					:busy="busy"
					@send="act('message', { text: $event })"
					@refresh="refresh"
				/>
				<view class="review-card">
					<button class="review-toggle" @click="review = !review">
						<k-icon name="list" :size="16" color="green" />
						<text>{{ review ? '收起对局回顾' : '查看对局回顾' }}</text>
						<k-icon
							:name="review ? 'chevron-up' : 'chevron-down'"
							:size="16"
							color="muted"
							class="review-toggle__chevron"
						/>
					</button>
					<view v-if="review" class="ww-panel">
						<text v-for="(event, index) in result.events" :key="index" class="result-event">
							{{ event }}
						</text>
					</view>
				</view>
			</template>
		</view>
	</view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { getToken } from '@/common/request.js'
import { ensureSession, experience } from '@/common/experience.js'
import { roleOf, roomCode, routeFor, resultLabel, gameResult } from './api.js'
import { useRoom } from './use-room.js'
import WwHero from './components/ww-hero.vue'
import WwSprite from './components/ww-sprite.vue'
import WwRoleArt from './components/ww-role-art.vue'
import WwTable from './components/ww-table.vue'
import WwChat from './components/ww-chat.vue'
import WwSound from './components/ww-sound.vue'
const code = ref('')
const liveCode = ref('')
const gameId = ref('')
const result = ref(null)
const review = ref(false)
const archiveError = ref('')
watch(
	() => experience.account?.id,
	() => {
		result.value = null
	}
)
let moving = false
const { room, error, loading, busy, refresh, act, stop, pageActive } = useRoom(liveCode, (data) => {
	if (gameId.value) return
	if (data.phase === 'finished' && data.me) result.value = data
	else if (data.me && !moving) {
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
	gameId.value = String(q.gameId || '')
	liveCode.value = gameId.value ? '' : code.value
})
const minutes = computed(() =>
	Math.max(
		1,
		Math.round(((result.value?.finishedAt || 0) - (result.value?.startedAt || 0)) / 60000)
	)
)
async function reload() {
	if (!gameId.value) return refresh()
	archiveError.value = ''
	const token = getToken()
	try {
		const data = await gameResult(code.value, gameId.value)
		if (token === getToken()) result.value = data
	} catch (e) {
		archiveError.value = e.message
	}
}
onShow(async () => {
	await ensureSession()
	if (gameId.value) reload()
})
function lobby() {
	moving = true
	stop()
	uni.redirectTo({ url: '/pages/werewolf/index' })
}
</script>
<style lang="scss">
@import './werewolf.scss';
</style>
<style scoped>
/* 11-18 第三轮：头图和「本局身份」拼成一张卡；背景音乐放到「身份揭晓」标题行右边；回顾是一条白色展开行 */
.my-result {
	display: flex;
	gap: 12px;
	align-items: center;
	height: 64px;
	padding: 8px 16px 8px 12px;
	box-sizing: border-box;
	border-radius: 0 0 12px 12px;
	background: var(--k-paper);
	overflow: hidden;
}
/* 返修第 1 轮：身份插图放进 48 的浅棕方块，行高 64 上下各留 8 */
.my-result__art {
	flex-shrink: 0;
	width: 48px;
	height: 48px;
	border-radius: 12px;
	background: var(--k-red-soft);
	overflow: hidden;
}
/* 11-18 第四轮：头像用半身像（按原比例、顶对齐），身份角章不再藏，缩到 20 贴在头像右下角 */
.my-result__art {
	position: relative;
}
.my-result__art :deep(.role-art__symbol) {
	right: 1px;
	bottom: 1px;
	transform: scale(0.72);
	transform-origin: 100% 100%;
}
/* 返修第 2 轮：「本局身份」12 号灰字在上、角色名 15/600 在下，一个清楚的身份块，不再用胶囊 */
.my-result__copy {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-width: 0;
}
.my-result__label {
	font-size: 12px;
	line-height: 1.5;
	color: var(--k-muted);
}
.my-result .ww-pill {
	display: block;
	height: auto;
	padding: 0;
	border-radius: 0;
	background: transparent;
	color: var(--k-ink);
	font-size: 17px;
	font-weight: 600;
	line-height: 1.4;
}
/* 返修第 3 轮：阵营小标签（好人绿、狼人红，同规则页） */
.my-result__team {
	flex-shrink: 0;
	height: 20px;
	padding: 0 8px;
	border-radius: 10px;
	background: var(--k-green-soft);
	color: var(--k-green);
	font-size: 11px;
	font-weight: 600;
	line-height: 20px;
}
.my-result__team--wolf {
	background: var(--k-alert-soft);
	color: var(--k-alert);
}
.result-heading {
	align-items: baseline;
}
.result-heading .ww-muted {
	font-size: 12px;
	font-variant-numeric: tabular-nums;
}
/* 回顾和对局页「对局记录」同一做法：同一张卡里展开，标题行下面接发丝线 */
.review-card {
	margin: 12px 0 0;
	border-radius: 12px;
	background: var(--k-paper);
	overflow: hidden;
}
.review-toggle {
	display: flex;
	align-items: center;
	gap: 6px;
	width: 100%;
	height: 48px;
	margin: 0;
	padding: 0 16px;
	border-radius: 0;
	background: transparent;
	color: var(--k-ink);
	line-height: 48px;
	font-size: 15px;
	font-weight: 600;
	box-sizing: border-box;
}
.review-toggle::after {
	border: 0;
}
.review-toggle text {
	flex: 1;
	text-align: left;
}
.review-card .ww-panel {
	position: relative;
	margin: 0;
	border-radius: 0;
	background: transparent;
}
.review-card .ww-panel::before {
	content: '';
	position: absolute;
	left: 16px;
	right: 16px;
	top: 0;
	height: 1px;
	background: var(--k-line);
	transform: scaleY(0.5);
}
.result-event {
	display: block;
	padding: 10px 0;
	font-size: 13px;
	line-height: 1.6;
	color: var(--k-ink2);
}
.result-event + .result-event {
	border-top: 1px solid var(--k-line);
}
.ww-bottom {
	padding-top: 16px;
}
/* 11-18 第四轮：「原班人马再来一局 / 返回大厅」做成贴底操作条（白底、顶部发丝线、贴安全区），
   第一屏就能点到；返回大厅是 112 宽次按钮放左边，主按钮占满右边 */
.ww-body {
	padding-bottom: calc(84px + env(safe-area-inset-bottom));
}
/* 11-19：sticky 翻到下面会回到原位（木桌下一条白带），改成 fixed 一直贴底 */
.ww-bottom {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 20;
	flex-direction: row-reverse;
	align-items: center;
	gap: 8px;
	margin: 0;
	padding: 8px 16px calc(8px + env(safe-area-inset-bottom));
	background: var(--k-paper);
}
.ww-bottom::before {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	height: 1px;
	background: var(--k-line);
	transform: scaleY(0.5);
}
.ww-bottom :deep(.k-button) {
	flex: 1;
	min-width: 0;
	height: 44px;
}
.ww-bottom :deep(.k-button.is-outline) {
	flex: 0 0 112px;
}
.ww-bottom > .ww-note {
	flex: 1;
	min-width: 0;
	margin: 0;
	text-align: left;
}
</style>
