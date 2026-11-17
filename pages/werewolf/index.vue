<template>
	<view class="ww-page">
		<k-topbar back title="袋鼠狼人杀" :fab="false" />
		<view class="ww-body">
			<view class="ww-tabs">
				<button :class="{ on: tab === 'lobby' }" @click="tab = 'lobby'">大厅</button>
				<button :class="{ on: tab === 'history' }" @click="openHistory">我的战绩</button>
				<button @click="go('/pages/werewolf/rules')">玩法说明</button>
			</view>
			<template v-if="tab === 'lobby'">
				<ww-hero title="好友组局" subtitle="6–12人 · 线上或面对面">
					<k-button
						block
						:disabled="busy"
						:label="busy ? '正在创建房间…' : '一键开房'"
						@click="create"
					/>
				</ww-hero>
				<text class="ww-note">默认6人局，房主可在设置中调整人数与玩法</text>
				<view
					v-if="currentRoom"
					class="resume-room"
					hover-class="k-press"
					@click="go(routeFor(currentRoom))"
				>
					<view>
						<text class="resume-room__title">继续你的房间</text>
						<text class="ww-muted">
							{{ currentRoom.code }} ·
							{{
								currentRoom.phase === 'waiting'
									? '好友等你入座'
									: currentRoom.phase === 'finished'
										? '查看本局结果'
										: '对局进行中'
							}}
						</text>
					</view>
					<k-icon name="chevron-right" :size="22" color="green" />
				</view>
				<view class="ww-row join-row">
					<input
						v-model="joinCode"
						class="ww-field"
						type="number"
						maxlength="6"
						placeholder="输入6位房间号"
						confirm-type="go"
						@confirm="join"
					/>
					<k-button type="green" :disabled="busy" @click="join">加入</k-button>
				</view>
				<view v-if="error" class="ww-error">
					<text>{{ error }}</text>
				</view>
				<view class="ww-heading">
					<text class="ww-heading__title">认识你的袋鼠伙伴</text>
					<button class="ww-link" @click="go('/pages/werewolf/rules')">查看规则 ›</button>
				</view>
				<view class="role-guides">
					<button
						v-for="role in guides"
						:key="role.short"
						class="role-guide"
						hover-class="k-press"
						@click="go('/pages/werewolf/rules')"
					>
						<view class="role-guide__art"><ww-role-art :role="role" /></view>
						<text>{{ role.label }}</text>
					</button>
				</view>
				<view class="ww-rule">
					<text class="ww-rule__title">围坐一桌，准备开局</text>
					<text class="ww-rule__copy">
						创建房间后分享给朋友，进入房间自动入座并准备，也可以点击空椅子换座。人数到齐后，房主即可开始游戏。
					</text>
				</view>
			</template>
			<template v-else>
				<text class="ww-muted">保留最近7天、最多30场对局</text>
				<view v-if="historyLoading" class="ww-state">正在读取战绩…</view>
				<view v-else-if="error" class="ww-state">
					<text>{{ error }}</text>
					<k-button block type="outline" @click="openHistory">重试</k-button>
				</view>
				<view v-else-if="!games.length" class="ww-state">
					<text>还没有对局记录</text>
					<k-button block @click="tab = 'lobby'">邀请朋友开一局</k-button>
				</view>
				<view
					v-for="game in games"
					:key="game.gameId"
					class="game-history"
					hover-class="k-press"
					@click="
						go('/pages/werewolf/result?code=' + game.code + '&gameId=' + game.gameId)
					"
				>
					<view>
						<text class="ww-rule__title">{{ resultLabel(game.winner) }}</text>
						<text class="ww-muted">
							{{ roleOf(game.role).label }} · {{ game.day }}天
						</text>
						<text class="history-date">
							{{ new Date(Number(game.finishedAt)).toLocaleString() }}
						</text>
					</view>
					<k-icon name="chevron-right" :size="20" color="muted" />
				</view>
			</template>
		</view>
	</view>
</template>
<script setup>
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { ref, watch } from 'vue'
import { onShow, onHide, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { ensureSession, experience } from '@/common/experience.js'
import { getToken } from '@/common/request.js'
import { go } from '@/common/screen.js'
import WwHero from './components/ww-hero.vue'
import WwSprite from './components/ww-sprite.vue'
import WwRoleArt from './components/ww-role-art.vue'
import {
	ROLES,
	createRoom,
	myRoom,
	history,
	requestId,
	roomCode,
	routeFor,
	roleOf,
	resultLabel
} from './api.js'
const guides = [ROLES.wolf, ROLES.seer, ROLES.witch, ROLES.hunter, ROLES.guard, ROLES.villager]
const tab = ref('lobby')
const joinCode = ref('')
const busy = ref(false)
const error = ref('')
const currentRoom = ref(null)
const games = ref([])
const historyLoading = ref(false)
let createId = requestId()
let epoch = 0
watch(
	() => experience.account?.id,
	() => {
		games.value = []
		currentRoom.value = null
	}
)
async function create() {
	if (busy.value) return
	busy.value = true
	error.value = ''
	const token = getToken()
	try {
		const room = await createRoom(createId)
		if (getToken() !== token) return
		createId = requestId()
		go(routeFor(room))
	} catch (e) {
		error.value = e.message
	} finally {
		busy.value = false
	}
}
function join() {
	const code = roomCode(joinCode.value)
	if (!code) {
		error.value = '请输入6位房间号'
		return
	}
	error.value = ''
	go('/pages/werewolf/invite?code=' + code)
}
async function openHistory() {
	tab.value = 'history'
	error.value = ''
	historyLoading.value = true
	const token = getToken()
	try {
		const data = await history()
		if (getToken() === token) games.value = data || []
	} catch (e) {
		error.value = e.message
	} finally {
		historyLoading.value = false
	}
}
onShow(async () => {
	const version = ++epoch
	await ensureSession()
	if (version !== epoch) return
	currentRoom.value = null
	if (!experience.account) return
	if (tab.value === 'history') openHistory()
	const token = getToken()
	try {
		const data = await myRoom()
		if (version === epoch && getToken() === token) currentRoom.value = data
	} catch (e) {
		if (version === epoch) error.value = e.message
	}
})
onHide(() => {
	epoch++
})

const pageShareMessage = () => publicShare('/pages/werewolf/index', {}, '袋鼠狼人杀 · 邀请好友一起开局')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>
<style lang="scss">
@import './werewolf.scss';
</style>
<style scoped>
.join-row {
	margin: 20px 0 8px;
}
.resume-room {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 14px;
	margin-top: 18px;
	background: var(--k-green-soft);
	border-radius: 12px;
}
.resume-room__title {
	display: block;
	font-size: 15px;
	font-weight: 600;
	margin-bottom: 4px;
}
.role-guides {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10px;
}
.role-guide {
	padding: 8px 2px 12px;
	flex: 1;
	min-width: 0;
	margin: 0;
	line-height: 1.5;
	border-radius: 12px;
	background: var(--k-paper2);
	color: var(--k-ink);
	font-size: 13px;
}
.role-guide::after {
	border: 0;
}
.role-guide__art {
	height: 130px;
}
.game-history {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 20px 0;
	border-bottom: 1px solid var(--k-line);
}
.history-date {
	display: block;
	color: var(--k-muted);
	font-size: 12px;
	margin-top: 5px;
}
</style>
