<template>
	<view class="ww-page" :class="{ 'game-night': night }">
		<k-topbar
			:title="room?.phase === 'starting' ? '准备开局' : '第' + (room?.day || 1) + (night ? '夜' : '天')"
			back
			custom-back
			:dark="night"
			:bg="night ? '#193d34' : ''"
			:fab="false"
			@back="back"
		/>
		<view class="ww-body">
			<view v-if="loading && !room" class="ww-state">正在同步对局…</view>
			<view v-if="error" class="ww-error">
				<text>{{ error }}</text>
				<button class="ww-link" @click="refresh">重试</button>
			</view>
			<template v-if="room?.me">
				<view class="game-phase">
					<view class="ww-row">
						<k-icon
							:name="night ? 'moon-star' : 'sun'"
							:size="20"
							:color="night ? 'white' : 'green'"
						/>
						<text>{{ phaseLabel }}</text>
					</view>
					<text>房间 {{ code }}</text>
				</view>
				<ww-sound :active="pageActive" :dark="night" />
				<view v-if="nightInfo" class="night-progress">
					<view class="night-progress__steps"><text v-for="(step,index) in nightInfo.stages" :key="step.key" :class="{current:index === nightInfo.index,done:index < nightInfo.index}">{{ index + 1 }} {{ step.label }}</text></view>
					<text>第{{ room.day }}夜 · {{ nightInfo.index + 1 }}/{{ nightInfo.stages.length }}环节 · 本环节{{ clockText(secondsLeft) }}</text>
					<text>整夜剩余 {{ clockText(nightInfo.total) }}，完成所有环节后天亮</text>
				</view>
				<button class="game-cues ww-link" @click="cuesEnabled = !cuesEnabled">
					提示音{{ cuesEnabled ? '已开' : '已关' }}
				</button>
				<ww-table
					:player-count="room.playerCount || 6" :play-mode="room.playMode"
					:players="room.players"
					:host-id="room.hostId"
					:me-id="room.me.userId"
					:phase="room.phase"
					:speaker="room.speaker"
					:selected="target"
					:night="night"
					:selectable-seats="selectableSeats"
					:disabled="busy || !!room.me.skipAt"
					:center-label="tableLabel"
					:countdown="countdown"
					:urgent="secondsLeft <= 10"
					@seat="selectTarget($event.number)"
				/>
				<view v-if="room.phase === 'starting'" class="ww-note"
					>马上开局，请准备查看自己的身份</view
				>
				<button
					v-else
					class="identity"
					:class="{ 'identity--hidden': !revealed, 'identity--small': true }"
					hover-class="k-press"
					@click="revealed = !revealed"
				>
					<template v-if="revealed">
						<view class="identity__art"><ww-role-art :role="role" /></view>
						<view class="identity__copy">
							<text class="identity__title">{{ role.label }}</text>
							<text class="identity__team">{{ role.team }}</text>
							<view class="identity__private">
								<k-icon name="lock" :size="12" :color="night ? 'white' : 'muted'" />
								<text>仅自己可见 · 点击收起</text>
							</view>
						</view>
					</template>
					<template v-else>
						<k-icon name="lock" :size="28" :color="night ? 'white' : 'green'" />
						<view>
							<text class="identity__title">查看我的身份</text>
							<text class="identity__private">请避开其他玩家的视线</text>
						</view>
					</template>
				</button>
				<view v-if="revealed && room.me.role === 'wolf'" class="private-note">
					狼人同伴 ·
					{{
						room.me.wolves
							.filter((n) => n !== room.me.seat)
							.map((n) => n + '号')
							.join('、')
					}}
				</view>
				<view v-if="room.me.wolfTargets?.length && (room.playMode !== 'face_to_face' || revealed)" class="private-note wolf-choices">
                    <text class="wolf-choices__title">狼队行动 · 实时同步</text><text class="ww-note">仅存活狼人可见，确认后本阶段不可更改。</text><text v-for="choice in room.me.wolfTargets" :key="choice.seat" style="display:block">{{ choice.seat }}号：{{ choice.target ? (choice.submitted ? '已确认 ' : '正在选择 ') + choice.target + '号' : choice.submitted ? '已跳过' : '尚未选择' }}</text>
                    <text>狼队选择平票时，本夜无人被狼人淘汰。</text>
                </view>
                <view v-if="revealed && inspections.length" class="private-note">
					<text v-for="check in inspections" :key="check[0]">
						{{ check[0] }}号 · {{ check[1] }}　
					</text>
				</view>
				<view v-if="revealed && room.me.role === 'guard'" class="private-note">上一晚守护：{{ room.me.lastGuard ? room.me.lastGuard + '号，本晚不能连续守护' : '未守护任何人' }}</view>
				<text v-if="room.playMode === 'face_to_face'" class="ww-note">面对面模式 · 夜晚各自在手机操作，白天按座位顺序交流</text>
				<view class="ww-heading">
					<text class="ww-heading__title">{{ instruction }}</text>
				</view>
				<view v-if="canAct && room.phase === 'witch' && revealed" class="witch-controls">
					<text class="ww-muted">
						{{
							room.me.victim
								? '今晚 ' + room.me.victim + '号被狼人选中'
								: '今晚无人需要救助'
						}}
					</text>
					<view class="ww-tabs">
						<button
							:class="{ on: potion === 'save' }"
							:disabled="!canSave"
							@click="selectPotion('save')"
						>
							解药{{ room.me.antidote ? '×1' : '已用' }}
						</button>
						<button
							:class="{ on: potion === 'poison' }"
							:disabled="!room.me.poison"
							@click="selectPotion('poison')"
						>
							毒药{{ room.me.poison ? '×1' : '已用' }}
						</button>
					</view>
				</view>
				<view v-if="room.me.skipAt" class="skip-pending">
					<text
						>{{ mySpeech ? '结束发言' : '跳过本轮' }} · {{ skipSeconds }} 秒后生效</text
					>
					<k-button type="outline" size="md" :disabled="busy" @click="act('cancelSkip')"
						>取消跳过</k-button
					>
				</view>
				<view v-else-if="room.me.submitted" class="action-received">
					<k-icon name="check" :size="20" color="green" />
					<text>
						{{ room.phase === 'vote' ? '投票已提交' : '行动已提交' }}，等待本阶段结束
					</text>
				</view>
				<view v-else-if="canAct && (!night || revealed)" class="ww-bottom">
					<text class="ww-note">
						{{
							target
								? '已选择 ' + target + '号 ' + selectedName
								: room.phase === 'witch' && potion === 'save'
									? '准备使用解药'
									: '点击上方玩家选择目标'
						}}
					</text>
					<k-button
						block
						:disabled="busy || !mayConfirm"
						:label="confirmLabel"
						@click="submit(false)"
					/>
					<k-button
						block
						type="outline"
						:disabled="busy"
						:label="room.phase === 'vote' ? '弃票' : room.phase === 'hunter' ? '放弃开枪' : '本次跳过'"
						@click="submit(true)"
					/>
				</view>
				<text v-if="room.phase === 'vote'" class="ww-note"
					>{{ room.votesSubmitted || 0 }}/{{ livingCount }} 人已投票 ·
					全员提交后公布结果</text
				>
				<template v-if="!night">
					<view v-if="mySpeech" class="speech-controls">
						<k-button
							v-if="room.allowExtension"
							type="outline"
							:disabled="busy || room.speechExtended || !!room.me.skipAt"
							@click="act('extendSpeech')"
							>{{ room.speechExtended ? '本轮已加时' : '+30秒' }}</k-button
						>
						<k-button
							v-if="!room.me.skipAt"
							block
							class="finish-speech"
							type="outline"
							:disabled="busy || secondsLeft <= 3"
							@click="act('prepareSkip')"
						>
							我说完了，下一位
						</k-button>
					</view>
					<ww-chat :active="pageActive" :recorded-voice="room.playMode !== 'face_to_face'" :key="room.me?.userId"
						v-if="room.phase !== 'starting'"
						:room="room"
						:busy="busy"
						@send="send"
						@refresh="refresh"
					/>
				</template>
				<text v-if="!room.me.alive && !room.me.canShoot" class="ww-note">
					你已出局，可以继续观看。身份将在结算时揭晓。
				</text>
				<view class="game-log">
					<view class="ww-heading" hover-class="k-press" @click="showLog = !showLog">
						<text class="ww-heading__title">对局记录</text>
						<k-icon
							:name="showLog ? 'chevron-up' : 'chevron-down'"
							:size="18"
							:color="night ? 'white' : 'muted'"
						/>
					</view>
					<template v-if="showLog">
						<text
							v-for="(event, index) in room.events"
							:key="index"
							class="game-log__event"
						>
							{{ event }}
						</text>
					</template>
				</view>
			</template>
			<view v-else-if="room" class="ww-state">
				<text>请先加入房间后查看对局</text>
				<k-button block @click="back">返回大厅</k-button>
			</view>
		</view>
	</view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { onLoad, onHide } from '@dcloudio/uni-app'
import WwSprite from './components/ww-sprite.vue'
import WwRoleArt from './components/ww-role-art.vue'
import WwChat from './components/ww-chat.vue'
import WwTable from './components/ww-table.vue'
import { roleOf, roomCode, routeFor } from './api.js'
import { useRoom } from './use-room.js'
import WwSound from './components/ww-sound.vue'
import { nightProgress, clockText } from './night-progress.js'
import { useGameCues } from './use-game-cues.js'
const code = ref('')
const revealed = ref(false)
const target = ref(0)
const potion = ref('poison')
const showLog = ref(false)
let moving = false
const { room, error, loading, busy, now, refresh, act, stop, pageActive } = useRoom(code, (data) => {
	if (data.me && ['waiting', 'finished'].includes(data.phase) && !moving) {
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
onHide(() => {
	revealed.value = false
})
watch(
	() => room.value?.phaseToken,
	() => {
		target.value = 0
		potion.value = 'poison'
	}
)
const night = computed(() => ['guard', 'wolves', 'seer', 'witch'].includes(room.value?.phase))
const nightInfo = computed(() => nightProgress(room.value, now.value))
const role = computed(() => roleOf(room.value?.me?.role))
const seated = computed(() => room.value?.players.filter((p) => p.seat > 0) || [])
const selectableSeats = computed(() => seated.value.filter(selectable).map((p) => p.seat))
const livingCount = computed(() => seated.value.filter((p) => p.alive).length)
const inspections = computed(() => Object.entries(room.value?.me?.inspections || {}))
const mySpeech = computed(
	() =>
		room.value?.phase === 'discussion' &&
		room.value.me?.alive &&
		room.value.me.seat === room.value.speaker
)
const canAct = computed(() => {
	const r = room.value
	if (r?.phase === 'hunter') return !!r.me?.canShoot && !r.me.submitted
	if (!r?.me?.alive || r.me.submitted) return false
	return (
		r.phase === 'vote' ||
		{ guard: 'guard', wolves: 'wolf', seer: 'seer', witch: 'witch' }[r.phase] === r.me.role
	)
})
const canSave = computed(
	() =>
		room.value?.me?.antidote &&
		room.value.me.victim > 0 &&
		(room.value.me.victim !== room.value.me.seat || room.value.day === 1)
)
const phaseLabel = computed(() =>
	room.value?.phase === 'starting'
		? '准备开局'
		: room.value?.phase === 'hunter' ? '猎人开枪'
		: night.value
			? nightInfo.value.label
			: room.value?.phase === 'discussion'
				? '白天讨论'
				: '放逐投票'
)
const tableLabel = computed(() =>
	room.value?.phase === 'discussion' ? room.value.speaker + '号发言中' : night.value ? '整夜剩余' : phaseLabel.value
)
const secondsLeft = computed(() =>
	Math.max(0, Math.ceil(((room.value?.deadline || 0) - now.value) / 1000))
)
const { cuesEnabled } = useGameCues(room, secondsLeft)
const skipSeconds = computed(() =>
	Math.max(0, Math.ceil(((room.value?.me?.skipAt || 0) - now.value) / 1000))
)
const countdown = computed(() => {
	const seconds = nightInfo.value ? nightInfo.value.total : secondsLeft.value
	return (
		String(Math.floor(seconds / 60)).padStart(2, '0') +
		':' +
		String(seconds % 60).padStart(2, '0')
	)
})
const selectedName = computed(() => seated.value.find((p) => p.seat === target.value)?.name || '')
const instruction = computed(() => {
	const r = room.value
	if (r?.phase === 'starting') return (r.playerCount || 6) + '位好友已就位'
	if (r?.phase === 'hunter') return r.me.canShoot ? '选择开枪目标，或放弃开枪' : '等待' + r.pendingHunter + '号猎人行动'
	if (!r?.me?.alive) return '静静观察，等待结果'
	if (r.phase === 'discussion')
		return mySpeech.value ? '轮到你发言了' : '请听 ' + r.speaker + '号玩家发言'
	if (r.phase === 'vote') return '投票放逐一名玩家'
	if (!canAct.value) return r.me.submitted ? '等待天亮' : '天黑请闭眼，等待行动'
	if (!revealed.value) return '先查看身份，再进行行动'
	return {
		guard: '请选择今晚守护的玩家，可以守护自己',
		wolves: '与同伴选择今晚的目标',
		seer: '请选择一名玩家查验',
		witch: '请选择药水或跳过本次'
	}[r.phase]
})
const mayConfirm = computed(
	() =>
		(!night.value || revealed.value) &&
		(room.value?.phase === 'witch' && potion.value === 'save'
			? canSave.value
			: target.value > 0)
)
const confirmLabel = computed(
	() =>
		({
			guard: '确认守护',
			hunter: '确认开枪',
			wolves: '确认选择',
			seer: '确认查验',
			witch: potion.value === 'save' ? '确认使用解药' : '确认使用毒药',
			vote: '确认投票'
		})[room.value?.phase] || '确认'
)
async function selectTarget(number) {
  if (busy.value) return
  const previous = target.value, token = room.value.phaseToken
  target.value = number
  if (room.value.phase === 'wolves' && !await act('aim', { target: number, phaseToken: token }) && room.value?.phaseToken === token) target.value = previous
}
function selectPotion(value) {
	potion.value = value
	target.value = 0
}
function selectable(person) {
	const r = room.value
	if (
		!canAct.value ||
		!person.alive ||
		(person.userId === r.me.userId && r.phase !== 'guard') ||
		(night.value && !revealed.value)
	)
		return false
	if (r.phase === 'wolves') return !r.me.wolves.includes(person.seat)
	if (r.phase === 'guard') return person.seat !== r.me.lastGuard
	if (r.phase === 'witch') return potion.value === 'poison' && r.me.poison
	return true
}
function submit(skip) {
	const data = { target: skip ? 0 : target.value, phaseToken: room.value.phaseToken }
	if (room.value.phase === 'witch') data.potion = skip ? 'skip' : potion.value
	if (skip && (night.value || room.value.phase === 'hunter')) {
		act('prepareSkip', { phaseToken: data.phaseToken })
		return
	}
	if (skip)
		uni.showModal({
			title: room.value.phase === 'vote' ? '确认弃票' : '跳过本次行动',
			content: '提交后本阶段不能更改。',
			success: (r) => {
				if (
					r.confirm &&
					data.phaseToken === room.value?.phaseToken &&
					secondsLeft.value > 0
				)
					act('act', data)
			}
		})
	else act('act', data)
}
const send = (text) => act('message', { text })
function back() {
	moving = true
	stop()
	uni.redirectTo({ url: '/pages/werewolf/index' })
}
</script>
<style lang="scss">
@import './werewolf.scss';
.wolf-choices { border: 1px solid #9e8051; padding: 14px; border-radius: 12px; }
.wolf-choices__title { display:block; font-weight:700; margin-bottom:6px; }
</style>
<style scoped>
.night-progress{padding:12px 0;display:flex;flex-direction:column;gap:7px;font-size:12px;line-height:1.6;color:#efe4c9}
.night-progress__steps{display:flex;gap:6px}.night-progress__steps text{flex:1;text-align:center;padding:6px 2px;border:1px solid #749183;border-radius:8px;opacity:.6}.night-progress__steps .current{background:#e7d6a8;color:#244b3c;opacity:1;font-weight:600}.night-progress__steps .done{opacity:.85}
.game-phase {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 10px 14px;
	border-radius: 999px;
	background: var(--k-green-soft);
	color: var(--k-green);
	font-size: 14px;
}
.game-cues {
	margin: 4px 0 0 auto;
	font-size: 12px;
}
.game-timer {
	font-size: 18px;
	font-weight: 600;
	font-variant-numeric: tabular-nums;
}
.identity {
	position: relative;
	display: flex;
	align-items: center;
	height: 205px;
	padding: 12px;
	margin: 20px 0 12px;
	border-radius: 16px;
	background: var(--k-green-soft);
	text-align: left;
	line-height: 1.4;
	color: var(--k-ink);
	overflow: hidden;
}
.identity::after {
	border: 0;
}
.identity__art {
	width: 50%;
	height: 235px;
	flex-shrink: 0;
	margin-left: -10px;
}
.identity__copy {
	flex: 1;
	min-width: 0;
}
.identity__title {
	display: block;
	font-size: 23px;
	font-weight: 600;
}
.identity__team {
	display: inline-block;
	margin: 10px 0;
	padding: 4px 12px;
	border-radius: 999px;
	background: rgba(155, 170, 100, 0.28);
	font-size: 14px;
}
.identity__private {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	margin-top: 8px;
	opacity: 0.75;
}
.identity--hidden {
	height: 140px;
	justify-content: center;
	gap: 18px;
	border: 1px solid var(--k-green-soft);
}
.identity--hidden .identity__title {
	font-size: 20px;
}
.identity--small {
	height: 88px;
}
.identity--small .identity__art {
	width: 80px;
	height: 108px;
	margin-right: 14px;
}
.identity--small .identity__title {
	font-size: 18px;
}
.identity--small .identity__team {
	margin: 4px 0 0;
	font-size: 12px;
	padding: 2px 8px;
}
.private-note {
	font-size: 13px;
	padding: 8px 12px;
	border-radius: 8px;
	background: rgba(155, 170, 100, 0.16);
	line-height: 1.6;
}
.action-received {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: 20px 0;
	font-size: 14px;
}
.finish-speech {
	flex: 1;
}
.speech-controls {
	display: flex;
	gap: 10px;
	align-items: center;
	margin: 16px 0;
}
.skip-pending {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 14px 0;
	font-size: 14px;
}
.game-log__event {
	display: block;
	padding: 8px 0;
	font-size: 14px;
	line-height: 1.7;
	border-bottom: 1px solid var(--k-line);
}
.game-night {
	background: #193d34;
	color: #f8eedb;
}
.game-night .game-phase {
	background: rgba(224, 231, 219, 0.12);
	color: #f5dca6;
}
.game-night .identity {
	background: rgba(224, 231, 219, 0.08);
	color: #fff1c8;
	border: 1px solid rgba(224, 231, 219, 0.22);
}
.game-night .ww-note,
.game-night .ww-muted {
	color: #d7d6bc;
}
.game-night .game-cues {
	color: #f5dca6;
}
.game-night .game-log__event {
	border-color: #486353;
}
.wolf-choices { border: 1px solid #9e8051; padding: 14px; border-radius: 12px; }
.wolf-choices__title { display:block; font-weight:700; margin-bottom:6px; }
</style>
