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
					<text class="ww-note lobby-note">默认6人局，房主可在设置中调整人数与玩法</text>
				</ww-hero>
				<view
					v-if="currentRoom"
					class="resume-room"
					hover-class="k-press"
					@click="go(routeFor(currentRoom))"
				>
					<view class="resume-room__icon"><k-icon name="door-open" :size="22" color="green" /></view>
					<view class="resume-room__copy">
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
					<k-icon name="chevron-right" :size="16" color="muted" />
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
					<button class="ww-link" @click="go('/pages/werewolf/rules')"><text>查看规则</text><k-icon name="chevron-right" :size="12" color="muted" /></button>
				</view>
				<view class="role-guides">
					<button
						v-for="role in guides"
						:key="role.short"
						class="role-guide"
						:class="{ 'role-guide--wolf': role.team === '狼人阵营' }"
						hover-class="k-press"
						@click="go('/pages/werewolf/rules')"
					>
						<view class="role-guide__art"><ww-role-art :role="role" bust /></view>
						<text>{{ role.label }}</text>
					</button>
				</view>
				<view class="ww-rule">
					<view class="lobby-start"><k-icon name="users" :size="16" color="green" /><text class="ww-rule__title">围坐一桌，准备开局</text></view>
					<text class="ww-rule__copy">
						创建房间后分享给朋友，进入房间自动入座并准备，也可以点击空椅子换座。人数到齐后，房主即可开始游戏。
					</text>
				</view>
			</template>
			<template v-else>
				<text class="ww-muted history-note">保留最近7天、最多30场对局</text>
				<view v-if="historyLoading" class="ww-state">正在读取战绩…</view>
				<view v-else-if="error" class="ww-state history-empty">
					<view class="history-empty__icon"><k-icon name="alert-circle" :size="32" color="red" /></view>
					<text>{{ error }}</text>
					<k-button block type="outline" size="sm" round @click="openHistory">重试</k-button>
				</view>
				<view v-else-if="!games.length" class="ww-state history-empty">
					<view class="history-empty__icon"><k-icon name="trophy" :size="32" color="red" /></view>
					<text>还没有对局记录</text>
					<text class="history-empty__desc">和朋友打完一局，战绩会出现在这里</text>
					<k-button block size="sm" round @click="tab = 'lobby'">邀请朋友开一局</k-button>
				</view>
				<view v-if="games.length" class="history-list">
					<view
						v-for="game in games"
						:key="game.gameId"
						class="game-history"
						hover-class="k-press"
						@click="
							go('/pages/werewolf/result?code=' + game.code + '&gameId=' + game.gameId)
						"
					>
						<view class="game-history__art"><ww-sprite :index="roleOf(game.role).sprite" /></view>
						<view class="game-history__copy">
							<text class="game-history__title" :class="'game-history__title--' + game.winner">{{ resultLabel(game.winner) }}</text>
							<view class="game-history__meta">
								<text class="ww-muted">
									{{ roleOf(game.role).label }} · {{ game.day }}天
								</text>
								<text class="history-date">
									{{ new Date(Number(game.finishedAt)).toLocaleString() }}
								</text>
							</view>
						</view>
						<k-icon name="chevron-right" :size="16" color="muted" />
					</view>
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
/* 11-18 第三轮：大厅一屏只有「一键开房」一个暖棕主按钮；输入框、加入按钮、开房按钮同为 44 高；角色宫格白卡；战绩是一张带角色头像的列表卡 */
.join-row {
	margin: 12px 0 0;
	gap: 8px;
}
/* 「加入」：和输入框一样高的白底细边次按钮 */
.join-row :deep(.k-button) {
	height: 44px;
	padding: 0 20px;
	border-color: var(--k-line);
	border-radius: 22px;
	background: var(--k-paper);
	color: var(--k-ink);
	font-size: 15px;
}
.resume-room {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px 16px;
	margin-top: 16px;
	background: var(--k-paper);
	border-radius: 12px;
}
.resume-room__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 40px;
	height: 40px;
	border-radius: 12px;
	background: var(--k-green-soft);
}
.resume-room__copy {
	flex: 1;
	min-width: 0;
}
.resume-room__title {
	display: block;
	font-size: 15px;
	font-weight: 600;
	line-height: 1.4;
	margin-bottom: 2px;
}
.resume-room .ww-muted {
	font-size: 12px;
}
.ww-error {
	margin: 12px 0 0;
}
.role-guides {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}
.role-guide {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 8px 4px 10px;
	min-width: 0;
	margin: 0;
	line-height: 1.4;
	border-radius: 12px;
	background: var(--k-paper);
	color: var(--k-ink);
	font-size: 13px;
	font-weight: 500;
}
.role-guide::after {
	border: 0;
}
.role-guide__art {
	width: 100%;
	height: 112px;
	margin-bottom: 4px;
}
.ww-rule {
	margin-top: 24px;
}
.history-note {
	display: block;
	margin: 0 0 12px;
	font-size: 12px;
	text-align: center;
}
/* 返修第 3 轮：空状态直接放在页面底色上，不再是「框里一句话」 */
.history-empty {
	box-sizing: border-box;
	justify-content: center;
	padding: 40px 16px 0;
}
.history-empty__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 56px;
	height: 56px;
	margin-bottom: 12px;
	border-radius: 16px;
	background: var(--k-red-soft);
}
.history-empty text {
	font-size: 14px;
	font-weight: 500;
	line-height: 1.5;
	color: var(--k-ink);
}
.history-empty .history-empty__desc {
	margin-top: 4px;
	font-size: 12px;
	font-weight: 400;
	color: var(--k-muted);
}
.history-empty :deep(.k-button) {
	width: auto;
	height: 36px;
	padding: 0 20px;
	font-size: 14px;
	font-weight: 600;
}
.history-list {
	padding: 0 16px;
	border-radius: 12px;
	background: var(--k-paper);
}
.game-history {
	position: relative;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 0;
}
.game-history + .game-history::before {
	content: '';
	position: absolute;
	left: 56px;
	right: 0;
	top: 0;
	height: 1px;
	background: var(--k-line);
	transform: scaleY(0.5);
}
.game-history__art {
	flex-shrink: 0;
	width: 44px;
	height: 44px;
	border-radius: 12px;
	background: var(--k-red-soft);
	overflow: hidden;
}
.game-history__art :deep(.ww-sprite) {
	height: 140%;
}
.game-history__copy {
	flex: 1;
	min-width: 0;
}
.game-history__head {
	display: flex;
	align-items: center;
	gap: 8px;
}
.game-history__title {
	display: block;
	min-width: 0;
	font-size: 15px;
	font-weight: 600;
	line-height: 1.4;
}
/* 返修第 2 轮：阵营只用标题颜色区分（好人绿、狼人红、平局墨灰） */
.game-history__title--good {
	color: var(--k-green);
}
.game-history__title--wolf {
	color: var(--k-alert);
}
.game-history__title--draw {
	color: var(--k-ink2);
}
.game-history .ww-muted {
	display: block;
	font-size: 12px;
	line-height: 1.5;
}
/* 返修第 3 轮：日期挪到标题行右侧，一行两层字，行高约 64 */
.history-date {
	display: block;
	flex-shrink: 0;
	margin-left: auto;
	color: var(--k-light);
	font-size: 11px;
	line-height: 1.5;
	font-variant-numeric: tabular-nums;
}
/* 返修第 4 轮：角色宫格插图区加一块阵营浅底（好人豆绿、狼人浅红），六张卡成一套；卡片内边距四周 6 */
.role-guide {
	padding: 6px 6px 10px;
}
.role-guide__art {
	height: 108px;
	margin-bottom: 6px;
	border-radius: 8px;
	background: var(--k-green-soft);
	overflow: hidden;
}
.role-guide--wolf .role-guide__art {
	background: var(--k-alert-soft);
}
/* 返修第 5 轮：战绩时间还原成原来的完整日期时间，放到第二行「角色 · 天数」后面；行右侧只剩箭头一条线 */
.game-history__meta {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	column-gap: 8px;
	margin-top: 2px;
}
.game-history__meta .history-date {
	margin-left: 0;
}
/* 空状态往下放（块中心约在屏高 38%），不再上挤下空 */
.history-empty {
	padding-top: 96px;
}
/* 页底说明卡：标题左边 16 号图标（间距 6，同规则页「如何开局」），正文 13/1.6 */
.lobby-start {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 6px;
}
.lobby-start .ww-rule__title {
	margin: 0;
}
.ww-rule .ww-rule__copy {
	font-size: 13px;
	line-height: 1.6;
}
/* ===== 11-18 第四轮（r6）===== */
/* 头图是一张完整的「开局卡」：标题、人数、一键开房、默认 6 人局说明都在头图里（奶油色 12 号、按钮下 8） */
.lobby-note {
	margin: 8px 0 0;
	color: var(--ww-cream);
	opacity: 0.8;
}
/* 继续房间、加入胶囊离头图 16 */
.resume-room {
	margin-top: 16px;
}
/* 加入：合成一根 44 高白胶囊，右端内嵌 36 高浅豆绿「加入」（无描边） */
.join-row {
	margin: 16px 0 0;
	height: 44px;
	padding: 0 4px 0 0;
	gap: 0;
	border-radius: 22px;
	background: var(--k-paper);
	box-sizing: border-box;
}
.join-row .ww-field {
	border: 0;
	background: transparent;
}
.join-row :deep(.k-button) {
	flex-shrink: 0;
	height: 36px;
	padding: 0 18px;
	border: 0;
	border-radius: 18px;
	background: var(--k-green-soft) !important;
	color: var(--k-green) !important;
	font-size: 15px;
	font-weight: 600;
}
/* 宫格：插图统一按阵营上色（狼人浅红、其余豆绿）；半身像 96 高，角章成为主要区分点；名字 14/500 */
.role-guide {
	font-size: 14px;
}
.role-guide__art {
	position: relative;
	height: 96px;
}
.role-guide__art :deep(.role-art__symbol) {
	right: 6px;
	bottom: 6px;
}
/* 11-19：页底说明回到 13/1.6（390 宽两行，末行不再只剩「游戏。」） */
/* 11-19 微信复评：不再白卡里套彩色插图块——插图块直接放在页面底色上（12 圆角、104 高），名字在下面 8；
   底色只按阵营分两种（好人豆绿、狼人浅红），第二排三只同图袋鼠靠右下角章区分 */
.role-guides {
	column-gap: 12px;
	row-gap: 16px;
}
.role-guide {
	padding: 0;
	background: transparent;
}
.role-guide__art {
	height: 104px;
	margin-bottom: 8px;
	border-radius: 12px;
}
@media (max-width: 360px) {
	.role-guides {
		column-gap: 8px;
	}
	.role-guide__art {
		height: 96px;
	}
}
</style>
