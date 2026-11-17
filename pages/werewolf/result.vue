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
				<ww-sound :active="pageActive" />
				<view class="my-result">
					<view class="my-result__art">
						<ww-role-art :role="roleOf(result.me?.role)" />
					</view>
					<text>本局身份</text>
					<text class="ww-pill">{{ roleOf(result.me?.role).label }}</text>
				</view>
				<view class="ww-heading">
					<text class="ww-heading__title">身份揭晓</text>
					<text class="ww-muted">房间 {{ code }}</text>
				</view>
				<ww-table
					:player-count="result.playerCount || 6" :play-mode="result.playMode"
					:players="result.players"
					:me-id="result.me?.userId"
					:host-id="result.hostId"
					phase="finished"
					center-label="本局结束"
				/>
				<ww-chat :active="pageActive" :recorded-voice="room.playMode !== 'face_to_face'" :key="room.me?.userId"
					v-if="!gameId && room?.me"
					:room="room"
					:busy="busy"
					@send="act('message', { text: $event })"
					@refresh="refresh"
				/>
				<button class="review-toggle" @click="review = !review">
					<k-icon name="list" :size="18" color="green" />
					<text>{{ review ? '收起对局回顾' : '查看对局回顾' }}</text>
					<k-icon
						:name="review ? 'chevron-up' : 'chevron-down'"
						:size="16"
						color="green"
					/>
				</button>
				<view v-if="review" class="ww-panel">
					<text v-for="(event, index) in result.events" :key="index" class="result-event">
						{{ event }}
					</text>
				</view>
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
					<k-button block type="outline" @click="lobby">返回大厅</k-button>
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
.my-result {
	display: flex;
	gap: 12px;
	align-items: center;
	padding: 6px 14px;
	border-radius: 0 0 16px 16px;
	background: var(--k-green-soft);
	font-size: 14px;
}
.my-result__art {
	width: 46px;
	height: 66px;
}
.review-toggle {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	width: 100%;
	margin: 16px 0;
	padding: 12px;
	border-radius: 12px;
	background: var(--k-green-soft);
	color: var(--k-green);
	line-height: 1.5;
	font-size: 14px;
}
.review-toggle::after {
	border: 0;
}
.result-event {
	display: block;
	padding: 8px 0;
	font-size: 14px;
	line-height: 1.7;
}
</style>
