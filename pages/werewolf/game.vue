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
							:size="18"
							:color="night ? 'white' : 'green'"
						/>
						<text class="game-phase__label">{{ phaseLabel }}</text>
					</view>
					<text class="game-phase__room">房间 {{ code }}</text>
				</view>
				<view v-if="nightInfo" class="night-progress">
					<view class="night-progress__steps"><text v-for="(step,index) in nightInfo.stages" :key="step.key" :class="{current:index === nightInfo.index,done:index < nightInfo.index}">{{ index + 1 }} {{ step.label }}</text></view>
					<text>第{{ room.day }}夜 · {{ nightInfo.index + 1 }}/{{ nightInfo.stages.length }}环节 · 本环节{{ clockText(secondsLeft) }}</text>
					<text>整夜剩余 {{ clockText(nightInfo.total) }}，完成所有环节后天亮</text>
				</view>
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
				<view class="game-toggles">
					<button class="game-cues ww-link" @click="cuesEnabled = !cuesEnabled">
						<k-icon :name="cuesEnabled ? 'bell' : 'bell-off'" :size="14" :color="night ? 'white' : 'green'" />
						<text>提示音{{ cuesEnabled ? '已开' : '已关' }}</text>
					</button>
					<ww-sound :active="pageActive" :dark="night" />
				</view>
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
						<view class="identity__lock"><k-icon name="lock" :size="22" :color="night ? 'white' : 'green'" /></view>
						<view class="identity__copy">
							<text class="identity__title">查看我的身份</text>
							<text class="identity__private">请避开其他玩家的视线</text>
						</view>
						<view class="identity__chevron"><k-icon name="chevron-right" :size="16" :color="night ? 'white' : 'muted'" /></view>
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
				<view v-if="revealed && inspections.length" class="private-note inspect-note">
					<k-icon name="eye" :size="14" :color="night ? 'white' : 'green'" />
					<view v-for="check in inspections" :key="check[0]" class="inspect-item">
						<text>{{ check[0] }}号 · </text><text class="inspect-tag" :class="check[1] === '狼人' ? 'inspect-tag--wolf' : 'inspect-tag--good'">{{ check[1] }}</text><text>　</text>
					</view>
				</view>
				<view v-if="revealed && room.me.role === 'guard'" class="private-note">上一晚守护：{{ room.me.lastGuard ? room.me.lastGuard + '号，本晚不能连续守护' : '未守护任何人' }}</view>
				<text v-if="room.playMode === 'face_to_face'" class="ww-note">面对面模式 · 夜晚各自在手机操作，白天按座位顺序交流</text>
				<view class="ww-heading" :class="{ 'ww-heading--hint': night && !revealed }">
					<k-icon v-if="night && !revealed" name="info" :size="14" color="white" />
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
					<k-icon name="check" :size="18" :color="night ? 'white' : 'green'" />
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
						<view class="ww-row game-log__title"><k-icon name="list" :size="16" :color="night ? 'white' : 'green'" /><text class="ww-heading__title">对局记录</text></view>
						<k-icon
							:name="showLog ? 'chevron-up' : 'chevron-down'"
							:size="16"
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
</style>
<style scoped>
/* 11-18 第三轮：白天浅底、夜晚深绿保留；阶段条 40 高胶囊；提示音和背景音乐两个 28 高小开关并排；
   身份卡、私密提示、对局记录都是 12 圆角的卡，夜里换成半透明 */
.game-phase {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
	height: 40px;
	padding: 0 16px;
	border-radius: 20px;
	background: var(--k-green-soft);
	color: var(--k-green);
	font-size: 14px;
}
.game-phase .ww-row {
	gap: 6px;
}
.game-phase__label {
	font-weight: 600;
}
.game-phase__room {
	font-size: 12px;
	font-variant-numeric: tabular-nums;
	opacity: 0.85;
}
/* 返修第 4 轮：开关行挪到木桌下面、身份卡上面（右对齐），顶部只留阶段条 */
.game-toggles {
	display: flex;
	justify-content: flex-end;
	align-items: center;
	gap: 8px;
	margin: 12px 0;
	color: var(--k-green);
}
/* 返修第 3 轮：两颗小开关按字宽、右对齐到阶段条右边那条线 */
.game-cues,
.game-toggles :deep(.ww-sound__button) {
	justify-content: center;
}
.game-cues {
	display: flex;
	align-items: center;
	gap: 4px;
	height: 28px;
	min-height: 28px;
	margin: 0;
	padding: 0 10px;
	box-sizing: border-box;
	border: 0;
	border-radius: 14px;
	font-size: 12px;
	line-height: 28px;
	color: var(--k-ink2);
	background: var(--k-paper);
}
.game-cues::after {
	border: 0;
}
.game-night .game-cues {
	color: var(--ww-cream);
	background: var(--ww-night-tint);
}
/* 返修第 1 轮：选目标的提示紧跟在标题下当副标题（间距 4），提示到按钮 16；两颗按钮都是全圆 */
.ww-heading + .ww-bottom {
	margin-top: -8px;
	padding-top: 0;
}
.ww-bottom > .ww-note:first-child {
	margin: 0 0 8px;
	text-align: left;
}
.ww-bottom :deep(.k-button) {
	border-radius: 999px;
}
/* 夜里没翻身份：这句只是提示，不当标题用；返修第 2 轮贴在身份卡下方 8，12 号 + info 图标 */
.ww-heading.ww-heading--hint {
	justify-content: flex-start;
	gap: 4px;
	margin: 8px 0 0;
	opacity: 0.72;
}
.identity + .ww-heading--hint {
	margin-top: -4px;
}
.ww-heading--hint .ww-heading__title {
	font-size: 12px;
	font-weight: 400;
	line-height: 1.6;
}
/* 查验结果：前面一个眼睛图标 */
.private-note.inspect-note {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 4px;
	min-height: 40px;
	padding: 8px 12px;
	box-sizing: border-box;
}
.night-progress{padding:0 0 12px;display:flex;flex-direction:column;gap:0;font-size:12px;line-height:1.5;color:var(--ww-gold);font-variant-numeric:tabular-nums}
/* 返修第 2 轮：两行说明收成一组，第二行降成 11 号淡字，木桌中央的大字才是焦点 */
.night-progress > text:last-child{font-size:11px;opacity:.7}
.night-progress__steps{display:flex;gap:8px;margin-bottom:8px}.night-progress__steps text{flex:1;height:28px;line-height:26px;box-sizing:border-box;text-align:center;padding:0 2px;border:1px solid var(--ww-night-line);border-radius:14px;opacity:.6;font-size:12px}.night-progress__steps .current{background:var(--ww-gold);border-color:var(--ww-gold);color:var(--ww-deep);opacity:1;font-weight:600}.night-progress__steps .done{opacity:.85}
.game-timer {
	font-size: 18px;
	font-weight: 600;
	font-variant-numeric: tabular-nums;
}
.identity {
	position: relative;
	display: flex;
	align-items: center;
	gap: 12px;
	width: 100%;
	height: 88px;
	padding: 0 16px;
	margin: 16px 0 12px;
	border-radius: 12px;
	background: var(--k-paper);
	text-align: left;
	line-height: 1.4;
	color: var(--k-ink);
	overflow: hidden;
	box-sizing: border-box;
}
.identity::after {
	border: 0;
}
.identity__lock {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 44px;
	height: 44px;
	border-radius: 50%;
	background: var(--k-green-soft);
}
/* 返修第 2 轮：插图 56×77 在 88 高的卡里上下居中，不再被卡边裁掉脚 */
.identity__art {
	flex-shrink: 0;
	align-self: center;
	width: 56px;
	height: 77px;
	margin: 0;
}
.identity__chevron {
	display: flex;
	flex-shrink: 0;
}
.game-night .identity__chevron {
	opacity: 0.6;
}
.identity__copy {
	flex: 1;
	min-width: 0;
}
.identity__title {
	display: block;
	font-size: 17px;
	font-weight: 600;
	line-height: 1.4;
}
.identity__team {
	display: inline-flex;
	align-items: center;
	height: 20px;
	margin: 4px 0 0;
	padding: 0 8px;
	border-radius: 10px;
	background: var(--k-green-soft);
	color: var(--k-green);
	font-size: 11px;
	font-weight: 500;
}
.identity__private {
	display: flex;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	margin-top: 4px;
	color: var(--k-muted);
}
.identity--hidden .identity__title {
	font-size: 16px;
}
.private-note {
	margin-bottom: 8px;
	font-size: 13px;
	padding: 10px 12px;
	border-radius: 12px;
	background: var(--k-green-soft);
	color: var(--k-ink);
	line-height: 1.6;
}
.private-note.wolf-choices {
	border: 0;
	padding: 12px;
}
.wolf-choices__title {
	display: block;
	font-size: 14px;
	font-weight: 600;
	margin-bottom: 4px;
}
.private-note.wolf-choices .ww-note {
	text-align: left;
	margin: 0 0 4px;
}
.ww-heading {
	margin: 20px 0 12px;
}
.witch-controls .ww-tabs {
	margin: 8px 0 0;
}
.action-received {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	padding: 16px 0;
	font-size: 14px;
}
.finish-speech {
	flex: 1;
}
.speech-controls {
	display: flex;
	gap: 8px;
	align-items: center;
	margin: 16px 0 0;
}
.skip-pending {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	padding: 12px 16px;
	margin-top: 8px;
	border-radius: 12px;
	background: var(--k-paper);
	font-size: 14px;
}
.game-log {
	margin-top: 16px;
	padding: 0 16px;
	border-radius: 12px;
	background: var(--k-paper);
}
.game-log .ww-heading {
	min-height: 48px;
	margin: 0;
}
.game-log .ww-heading__title {
	font-size: 15px;
	font-weight: 600;
}
/* 返修第 2 轮：卡头统一「16 图标 + 6 间距 + 15/600 标题」（同发言记录、对局回顾） */
.game-log__title {
	gap: 6px;
}
.game-log__event {
	display: block;
	padding: 10px 0;
	font-size: 13px;
	line-height: 1.6;
	color: var(--k-ink2);
	border-top: 1px solid var(--k-line);
}
.game-night {
	background: var(--ww-night);
	color: var(--ww-night-ink);
}
.game-night .game-phase {
	background: var(--ww-night-tint);
	color: var(--ww-night-sand);
}
.game-night .game-toggles {
	color: var(--ww-night-sand);
}
.game-night .identity,
.game-night .skip-pending,
.game-night .game-log {
	background: var(--ww-night-fill);
	color: var(--ww-night-gold);
}
.game-night .identity__lock {
	background: var(--ww-night-tint);
}
.game-night .identity__private {
	color: var(--ww-night-mist);
}
.game-night .identity__team {
	background: var(--ww-night-tint);
	color: var(--ww-night-gold);
}
.game-night .private-note {
	background: var(--ww-night-fill);
	color: var(--ww-night-ink);
}
.game-night .ww-heading__title {
	color: var(--ww-night-gold);
}
.game-night .ww-note,
.game-night .ww-muted {
	color: var(--ww-night-mist);
}
.game-night .game-log__event {
	color: var(--ww-night-mist);
	border-color: var(--ww-night-line);
}
.game-night .ww-tabs {
	background: var(--ww-night-tint);
}
.game-night .ww-tabs button {
	color: var(--ww-night-ink);
}
.game-night .ww-tabs button.on {
	background: var(--ww-gold);
	color: var(--ww-deep);
	box-shadow: none;
}
/* 返修第 3 轮：夜里主操作是实心金底深绿字，不能点时同样式 40% 透明；「本次跳过」降成 40 高的无框浅金字，主次一眼分开 */
.game-night .ww-bottom :deep(.k-button.is-primary) {
	background: var(--ww-gold) !important;
	color: var(--ww-deep) !important;
	box-shadow: none;
}
.game-night .ww-bottom :deep(.k-button.is-disabled.is-primary) {
	opacity: 0.4;
}
.game-night .ww-bottom :deep(.k-button.is-outline) {
	height: 40px;
	font-size: 14px;
	font-weight: 500;
	background: transparent !important;
	border-color: transparent !important;
	color: var(--ww-night-gold) !important;
	opacity: 0.85;
}
/* 查验结果：阵营小标签（狼人提醒红浅底、好人绿浅底，同规则页） */
.inspect-item {
	display: inline-flex;
	align-items: center;
}
.inspect-tag {
	display: inline-flex;
	align-items: center;
	height: 20px;
	padding: 0 8px;
	border-radius: 10px;
	font-size: 12px;
	font-weight: 600;
}
.inspect-tag--wolf {
	background: var(--k-alert-soft);
	color: var(--k-alert);
}
.inspect-tag--good {
	background: var(--k-green-soft);
	color: var(--k-green);
}
/* 返修第 4 轮：夜里查验结果的阵营标签换夜间配色（狼人浅红透明底、好人金色透明底），不再像白天贴纸 */
.game-night .inspect-tag--wolf {
	background: var(--ww-night-alert);
	color: var(--ww-night-ink);
}
.game-night .inspect-tag--good {
	background: var(--ww-night-goldbg);
	color: var(--ww-night-gold);
}
/* 返修第 5 轮：身份卡里的角章缩到 24、向右下外移，不再压住插图；夜里阶段条到环节胶囊 8 */
.identity__art :deep(.role-art__symbol) {
	right: -6px;
	bottom: -2px;
	width: 24px;
	height: 24px;
}
.game-phase + .night-progress {
	margin-top: -4px;
}
</style>
