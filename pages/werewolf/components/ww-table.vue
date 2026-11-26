<template>
	<view class="ww-table" :class="{ 'ww-table--night': night, 'ww-table--large': playerCount > 6 }" :style="playerCount > 6 ? {height: (Math.ceil(playerCount / 2) * 118 + 28) + 'px'} : {}">
		<image class="ww-table__background" :src="courtyard" mode="aspectFill" />
		<view class="ww-table__floor" />
		<view class="ww-table__wood"><ww-sprite v-if="playerCount <= 6" :index="11" /></view>
		<view v-if="centerLabel" class="ww-table__center" :class="{ 'ww-table__center--solo': !countdown }">
			<text>{{ centerLabel }}</text>
			<text
				v-if="countdown"
				class="ww-table__timer"
				:class="{ 'ww-table__timer--urgent': urgent }"
				>{{ countdown }}</text
			>
		</view>
		<button
			v-for="seat in seats"
			:key="seat.number"
			class="ww-seat"
			:style="seatStyle(seat.number)"
			:class="[
				'ww-seat--' + seat.number,
				{
					'ww-seat--mine': seat.player?.userId === meId,
					'ww-seat--empty': !seat.player,
					'ww-seat--selected': selected === seat.number,
					'ww-seat--speaker': speaker === seat.number && phase === 'discussion',
					'ww-seat--out':
						seat.player &&
						!seat.player.alive &&
						phase !== 'waiting' &&
						phase !== 'finished'
				}
			]"
			:aria-label="
				seat.player
					? seat.number + '号位，' + seat.player.name
					: seat.number + '号位，点击入座'
			"
			hover-class="k-press"
			:disabled="disabled || (phase !== 'waiting' && !selectableSeats.includes(seat.number))"
			@click="$emit('seat', seat)"
		>
			<view class="ww-seat__chair">
				<ww-sprite
					:index="seat.player ? 4 + seat.player.avatar : 10"
					:flip="playerCount > 6 ? seat.number > Math.ceil(playerCount / 2) : [2, 3, 6].includes(seat.number)"
				/>
			</view>
			<view v-if="!seat.player" class="ww-seat__plus">
				<k-icon name="plus" :size="18" color="green" />
			</view>
			<view v-if="seat.player?.userId === meId" class="ww-seat__me">我</view>
			<view v-if="selected === seat.number" class="ww-seat__selected"><k-icon name="check" :size="14" color="white" /></view>
			<text v-if="seat.player && !seat.player.alive && phase !== 'waiting'" class="ww-out-stamp">OUT</text>
			<view class="ww-seat__label">
				<text class="ww-seat__name">
					{{ seat.number }} {{ seat.player ? seat.player.name : '号位' }}
				</text>
				<view
					class="ww-seat__state"
					:class="'ww-seat__state--' + stateTone(seat.player)"
				>
					<k-icon
						v-if="phase === 'waiting' && seat.player?.ready && seat.player.online && seat.player.userId !== hostId"
						name="check"
						:size="12"
						color="green"
					/>
					<text>{{ stateLabel(seat.player) }}</text>
				</view>
				<text v-if="phase === 'waiting' && seat.player" class="ww-seat__voice">{{
					voiceState(seat.player)
				}}</text>
			</view>
		</button>
	</view>
</template>
<script setup>
import { computed } from 'vue'
import WwSprite from './ww-sprite.vue'
import courtyard from '../static/courtyard.jpg'
import { roleOf } from '../api.js'
const props = defineProps({
	playerCount: { type: Number, default: 6 },
	playMode: { type: String, default: 'online' },
	players: { type: Array, default: () => [] },
	hostId: [Number, String],
	meId: [Number, String],
	disabled: Boolean,
	phase: { type: String, default: 'waiting' },
	speaker: Number,
	selected: Number,
	night: Boolean,
	centerLabel: String,
	countdown: String,
	urgent: Boolean,
	selectableSeats: { type: Array, default: () => [] }
})
defineEmits(['seat'])
const seats = computed(() =>
	Array.from({ length: props.playerCount }, (_, i) => ({
		number: i + 1,
		player: props.players.find((p) => p.seat === i + 1)
	}))
)
function state(player) {
	if (!player) return '点击入座'
	if (props.phase === 'finished') return roleOf(player.role).short
	if (props.phase !== 'waiting' && !player.alive) return '已出局'
	if (props.phase === 'discussion' && player.seat === props.speaker) return '正在发言'
	if (!player.online) return '暂时离线'
	if (props.phase !== 'waiting') return '在场'
	if (player.userId === props.hostId) return '房主 · 已准备'
	return player.ready ? '✓ 已准备' : '未准备'
}
// 返修第 5 轮（纯展示）：state() 保持原样；「✓」改由模板里的 k-icon check 显示，这里只把文字里的符号去掉
function stateLabel(player) {
	return state(player).replace('✓ ', '')
}
// 返修第 1 轮（纯展示）：状态字的颜色。等人时绿=已准备；对局中只有「正在发言」绿、「已出局」红，其余灰；结算按阵营（狼人红、好人绿）
function stateTone(player) {
	if (!player) return 'muted'
	if (props.phase === 'finished') return roleOf(player.role).team === '狼人阵营' ? 'wolf' : 'good'
	if (props.phase === 'waiting') return player.ready && player.online ? 'ready' : 'muted'
	if (!player.alive) return 'out'
	if (props.phase === 'discussion' && player.seat === props.speaker) return 'speaking'
	return 'muted'
}
function voiceState() {
	return props.playMode === 'face_to_face' ? '面对面交流' : '语音消息'
}
function seatStyle(number) {
  if (props.playerCount <= 6) return {}
  const rows = Math.ceil(props.playerCount / 2)
  const left = number <= rows
  const row = left ? number - 1 : props.playerCount - number
  return { left: left ? '17%' : '83%', top: (row * 118 + 72) + 'px' }
}
</script>
<style scoped>
.ww-table {
	position: relative;
	height: 400px;
	margin: 0 -16px;
	overflow: hidden;
}
.ww-table__background {
	position: absolute;
	width: 100%;
	height: 100%;
	left: 0;
	top: 0;
}
.ww-table__floor {
	position: absolute;
	inset: 0;
	background: linear-gradient(rgba(250, 246, 238, 0.44), rgba(250, 246, 238, 0.72));
}
.ww-table__wood {
	position: absolute;
	left: 50%;
	top: 46%;
	width: 190px;
	height: 225px;
	transform: translate(-50%, -50%);
	z-index: 2;
}
.ww-seat {
	position: absolute;
	width: 96px;
	height: 126px;
	padding: 0;
	margin: 0;
	overflow: visible;
	background: transparent;
	border: none;
	line-height: 1.3;
	transform: translate(-50%, -50%);
	z-index: 3;
}
.ww-seat::after {
	border: none;
}
.ww-seat[disabled] {
	background: transparent;
}
.ww-seat--1 {
	left: 29%;
	top: 19%;
}
.ww-seat--2 {
	left: 71%;
	top: 19%;
}
.ww-seat--3 {
	left: 86%;
	top: 47%;
}
.ww-seat--4 {
	left: 14%;
	top: 47%;
}
.ww-seat--5 {
	left: 30%;
	top: 78%;
	z-index: 4;
}
.ww-seat--6 {
	left: 70%;
	top: 78%;
	z-index: 4;
}
.ww-seat__chair {
	position: absolute;
	inset: 0 0 24px;
}
.ww-seat__label {
	position: absolute;
	left: 2px;
	right: 2px;
	bottom: 0;
	padding: 6px 6px;
	border-radius: 10px;
	background: rgba(255, 250, 240, 0.96);
	box-shadow: 0 2px 6px rgba(80, 55, 30, 0.12);
	color: var(--k-ink);
}
.ww-table__center {
	position: absolute;
	left: 50%;
	top: 43%;
	transform: translate(-50%, -50%);
	z-index: 3;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	font-size: 12px;
	letter-spacing: 1px;
	color: #fff1d4;
	text-shadow: 0 1px 4px #4c311b;
}
.ww-table__timer {
	font-size: 28px;
	letter-spacing: 0;
	font-weight: 700;
	font-variant-numeric: tabular-nums;
}
.ww-table__timer--urgent {
	color: #fff2df;
	background: #983f27;
	border-radius: 8px;
	padding: 2px 6px;
}
.ww-seat__voice {
	display: block;
	font-size: 11px;
	line-height: 1.4;
	color: var(--k-light);
	margin-top: 1px;
}
.ww-seat--selected .ww-seat__label {
	outline: 3px solid #ba603e;
	background: #fae6c9;
}
.ww-seat--speaker .ww-seat__label {
	outline: 3px solid #527c40;
	background: #edf2dc;
}
.ww-seat--out .ww-seat__chair {
	filter: grayscale(1);
	opacity: 0.4;
}
.ww-seat__selected {
	position: absolute;
	right: 8px;
	top: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	background: #ad5639;
	border: 2px solid var(--k-paper);
	border-radius: 50%;
	box-sizing: border-box;
}
.ww-seat__wave {
	position: absolute;
	left: 33px;
	top: 4px;
	display: flex;
	align-items: center;
	gap: 3px;
	height: 18px;
}
.ww-seat__wave view {
	width: 3px;
	height: 12px;
	background: #4f8039;
	border-radius: 3px;
	animation: voice-wave 0.6s ease-out infinite alternate;
}
.ww-seat__wave view:nth-child(2) {
	height: 18px;
	animation-delay: 0.2s;
}
.ww-seat__wave view:nth-child(3) {
	animation-delay: 0.4s;
}
.ww-table--night .ww-table__floor {
	background: rgba(16, 43, 37, 0.7);
}
@keyframes voice-wave {
	to {
		transform: scaleY(0.4);
	}
}
@media (prefers-reduced-motion: reduce) {
	.ww-seat__wave view {
		animation: none;
	}
}
.ww-seat__name {
	display: block;
	font-size: 12px;
	line-height: 1.4;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.ww-seat__state {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 2px;
	font-size: 11px;
	line-height: 1.4;
	margin-top: 1px;
	color: var(--k-muted);
	white-space: nowrap;
}
.ww-seat__state--ready {
	color: var(--k-green);
}
.ww-seat--mine .ww-seat__label {
	outline: 2px solid var(--k-ochre);
}
.ww-seat--mine.ww-seat--speaker .ww-seat__label {
	outline-color: #527c40;
}
.ww-seat__plus {
	position: absolute;
	top: 44px;
	left: 32px;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--k-bg);
	box-shadow: 0 2px 8px rgba(55, 70, 40, 0.16);
}
.ww-seat__me {
	position: absolute;
	top: 8px;
	right: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	box-sizing: border-box;
	color: var(--k-paper);
	background: var(--k-red);
	border: 2px solid var(--k-paper);
	border-radius: 50%;
	font-size: 11px;
	font-weight: 600;
	line-height: 1;
}
@media (max-width: 350px) {
	.ww-table {
		height: 350px;
	}
	.ww-seat {
		width: 80px;
		height: 120px;
	}
	.ww-seat__plus {
		left: 25px;
	}
	.ww-table__wood {
		width: 175px;
		height: 210px;
	}
}
.ww-out-stamp{position:absolute;top:40px;left:24px;color:var(--k-alert);border:2px solid var(--k-alert);background:#fff9;transform:rotate(-12deg);font-size:18px;font-weight:700;letter-spacing:1px;line-height:22px;padding:1px 6px;border-radius:4px;z-index:8;pointer-events:none}
</style>
<style scoped>
/* 返修第 3 轮：木桌减重——宽 140→112（≤360 宽 104，两侧名牌离桌边至少 8），去掉 3px 粗边改 1px 内高光，两端色差减半，.92 不透明；
   上下各收 17px，桌头桌尾对齐第一排和最后一排座位的中线 */
.ww-table--large .ww-table__wood{top:50%;width:112px;height:calc(100% - 120px);border-radius:56px;background:linear-gradient(90deg,var(--ww-wood),var(--ww-wood-mid) 50%,var(--ww-wood));opacity:1;box-shadow:var(--ww-wood-shadow);box-sizing:border-box}
.ww-table--large .ww-table__center{top:50%;max-width:104px;text-align:center}
@media (max-width: 360px){.ww-table--large .ww-table__wood{width:104px}.ww-table--large .ww-table__center{max-width:96px}}
.ww-table .ww-seat__state.ww-seat__state--muted{color:var(--k-muted)}
.ww-table .ww-seat__state.ww-seat__state--ready,.ww-table .ww-seat__state.ww-seat__state--good{color:var(--k-green)}
.ww-table .ww-seat__state.ww-seat__state--speaking{color:var(--k-green);font-weight:600}
.ww-table .ww-seat__state.ww-seat__state--out{color:var(--k-alert)}
.ww-table .ww-seat__state.ww-seat__state--wolf{color:var(--k-alert);font-weight:600}
.ww-table--large .ww-seat{width:92px;height:116px}
.ww-table--large .ww-seat__chair{bottom:34px}
/* 返修第 4 轮：木桌不再半透明（不透出月亮）；桌心只有一行字时（等人「袋鼠好友局」、结算「本局结束」）升到 15/600 奶油色 */
.ww-table__center--solo text{font-size:15px;font-weight:600;color:var(--ww-cream)}
</style>
