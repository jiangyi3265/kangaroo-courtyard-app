<template>
	<view class="ww-page">
		<k-topbar title="玩法说明" back :fab="false" />
		<view class="ww-body">
			<text class="ww-title">6–12位朋友，一桌好戏</text>
			<view class="rule-roles">
				<view v-for="role in roles" :key="role.short" class="rule-role">
					<view class="rule-role__art"><ww-role-art :role="role" /></view>
					<view class="rule-role__copy">
						<view class="rule-role__head">
							<text class="ww-rule__title">
								{{ role.label }}
							</text>
							<text class="rule-role__team" :class="{ 'rule-role__team--wolf': role.team === '狼人阵营' }">{{ role.team }}</text>
						</view>
						<text class="ww-rule__copy">{{ role.description.slice(0, -5) }}<text class="rule-role__tail">{{ role.description.slice(-5) }}</text></text>
					</view>
				</view>
			</view>
			<view class="ww-rule">
				<view class="rule-start"><k-icon name="door-open" :size="16" color="green" /><text class="ww-rule__title">如何开局</text></view>
				<text class="ww-rule__copy">
					一键创建房间，房主可设置6至12人和线上、面对面模式。进入房间自动入座并准备，也可换座或暂停准备。修改设置保留准备状态，满员后房主开始，5秒倒计时后发放身份。每人默认发言90秒，可选择30、45、60、90或120秒。面对面模式每人仍需用自己的手机加入，身份仅本人可见，夜晚在手机操作，白天当面交流。
				</text>
			</view>
			<view class="ww-rule rule-lineups"><view class="rule-start"><k-icon name="users" :size="16" color="green" /><text class="ww-rule__title">人数与身份配置</text></view><view v-for="count in [6,7,8,9,10,11,12]" :key="count" class="ww-rule__copy rule-lineup"><text class="rule-lineup__count">{{ count }}人：</text><view class="rule-lineup__roles"><view class="rule-lineup__segs"><text v-for="(seg, segIdx) in lineupText(roleCountsFor(count)).split(' · ')" :key="segIdx" class="rule-lineup__seg">{{ seg }}</text></view></view></view></view>
			<view class="ww-rule rule-steps">
				<view v-for="rule in rules" :key="rule.title" class="rule-step">
					<text class="ww-rule__title">{{ rule.title }}</text>
					<text class="ww-rule__copy">{{ rule.copy.slice(0, -5) }}<text class="rule-role__tail">{{ rule.copy.slice(-5) }}</text></text>
				</view>
			</view>
			<k-button block round class="rules-back" @click="back">
				知道了，去组局
			</k-button>
		</view>
	</view>
</template>
<script setup>
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { ROLES, lineupText, roleCountsFor } from './api.js'
import WwSprite from './components/ww-sprite.vue'
import WwRoleArt from './components/ww-role-art.vue'
// 纯展示：身份顺序和大厅宫格一致（狼人、预言家、女巫、猎人、守卫、村民）
const roles = [ROLES.wolf, ROLES.seer, ROLES.witch, ROLES.hunter, ROLES.guard, ROLES.villager]
const rules = [
	{
		title: '夜晚行动',
		copy: '同一夜依次进行狼人、预言家、女巫行动，有守卫时守卫先行动，全部完成后天亮。页面显示当前环节和整夜剩余时间。每个环节默认30秒，可选择15、20、30、45或60秒。跳过有3秒取消时间，各环节按固定时长切换，避免通过行动时间泄露身份是否在场。确认行动后不能更改，超时视为跳过。'
	},
	{
		title: '白天发言与投票',
		copy: '天亮公布出局座位，存活玩家依次发言。房主允许时，每轮可加时30秒一次。结束发言有3秒取消时间。投票默认45秒，全体存活玩家提交后提前公布结果。平票无人出局，超时视为弃票。'
	},
	{
		title: '交流方式',
		copy: '线上模式按住录音、松开发送，上滑可取消，每条最多60秒；其他玩家点击语音条播放。等待好友和结算时自由交流，对局中仅当前发言者可发送，夜间不能发送。也可以打字。面对面模式直接当面交流，无需录音。'
	},
	{
		title: '胜负规则',
		copy: '所有狼人出局，好人获胜。存活狼人数达到或超过好人数，狼人获胜。猎人开枪先结算，再判断胜负。最多12天，达到上限平局。女巫每晚最多用一瓶药，仅第一夜可以自救。守卫与女巫同守同救狼刀目标时，该玩家仍出局；毒药无视守护。猎人被毒杀不能开枪。'
	},
	{
		title: '离线与回到房间',
		copy: '短暂离开后可从大厅继续房间，倒计时仍由服务端推进。等待开局时房主可以移出离线超过一分钟的玩家。房间闲置24小时后过期，战绩保留7天。'
	}
]
function back() {
	const pages = getCurrentPages()
	if (pages.length > 1) uni.navigateBack()
	else uni.redirectTo({ url: '/pages/werewolf/index' })
}

const pageShareMessage = () => publicShare('/pages/werewolf/rules', {}, '袋鼠狼人杀 · 玩法说明')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>
<style lang="scss">
@import './werewolf.scss';
</style>
<style scoped>
/* 11-18 第三轮：每一节是一张白卡；六个身份收进一张卡、行间发丝线，名字旁标阵营；人数配置做成两列小表 */
.ww-title {
	margin: 8px 0 4px;
}
.ww-rule__copy {
	display: block;
}
/* 返修第 1 轮：五节长规则并成一张卡，每节前一个序号圆（同谁是卧底规则页），节与节之间发丝线
   返修第 2 轮：和谁是卧底规则页同一套——白卡 12 圆角、内边距 16、卡间 12，小标题 16/600，底部实心主按钮 */
.ww-rule {
	margin-top: 12px;
}
.ww-rule__title {
	font-size: 16px;
	font-weight: 700;
	line-height: 1.4;
}
.ww-title + .ww-rule {
	margin-top: 16px;
}
/* 「如何开局」卡顶：40 浅绿方块 + 门图标，和标题横排 */
/* 返修第 4 轮：「如何开局」不再是 40 方块，16 号门图标直接放在标题左边（间距 6）；各卡标题都是 16/700、下面空 12 */
.rule-start {
	display: flex;
	align-items: center;
	gap: 6px;
	margin-bottom: 12px;
}
.rule-start .ww-rule__title {
	margin: 0;
}
.rule-steps {
	padding: 0 16px;
	counter-reset: ww-step;
}
/* 返修第 4 轮：序号圆只跟标题横排，正文和序号圆左边对齐（卡里只有一条文字起始线，320 宽少折行） */
.rule-step {
	position: relative;
	padding: 16px 0;
}
.rule-step .ww-rule__title {
	padding-left: 28px;
}
.rule-step .ww-rule__copy {
	margin-top: 4px;
}
.rule-step + .rule-step::before {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	height: 1px;
	background: var(--k-line);
	transform: scaleY(0.5);
}
/* 返修第 5 轮：序号用 CSS 计数画出来（模板循环还原成改前写法），颜色和门图标、阵营标签同一套游戏绿 */
.rule-step::after {
	counter-increment: ww-step;
	content: counter(ww-step);
	position: absolute;
	left: 0;
	top: 17px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: var(--k-green);
	color: var(--k-paper);
	font-size: 12px;
	font-weight: 600;
	line-height: 1;
	font-variant-numeric: tabular-nums;
}
.rule-step .ww-rule__title {
	line-height: 22px;
}
.rule-roles {
	margin-top: 12px;
	padding: 0 16px;
	border-radius: 12px;
	background: var(--k-paper);
}
.rule-role {
	position: relative;
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 0;
}
.rule-role + .rule-role::before {
	content: '';
	position: absolute;
	left: 76px;
	right: 0;
	top: 0;
	height: 1px;
	background: var(--k-line);
	transform: scaleY(0.5);
}
.rule-role__art {
	width: 64px;
	height: 88px;
	flex-shrink: 0;
}
.rule-role__copy {
	flex: 1;
	min-width: 0;
}
.rule-role__head {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 4px;
}
.rule-role__head .ww-rule__title {
	margin: 0;
}
.rule-role__team {
	display: inline-flex;
	align-items: center;
	height: 20px;
	padding: 0 6px;
	border-radius: 10px;
	background: var(--k-green-soft);
	color: var(--k-green);
	font-size: 11px;
	font-weight: 500;
}
.rule-role__team--wolf {
	background: var(--k-alert-soft);
	color: var(--k-alert);
}
.rule-role .ww-rule__copy {
	font-size: 13px;
	line-height: 1.6;
}
.rules-back {
	margin-top: 24px;
}
/* 返修第 3 轮：≤360 宽每行固定 3 个身份一折（狼人 / 预言家 / 女巫在第一行），7 行折法一样、行高一样 */
@media (max-width: 360px) {
	/* 返修第 4 轮：小屏身份插图 64→56，正文栏多 8px，「自救」不再掉一个字到下一行 */
	.rule-role__art {
		width: 56px;
		height: 77px;
	}
	.rule-role + .rule-role::before {
		left: 68px;
	}
}
/* ===== 11-18 第四轮（r6）===== */
/* 先看人，再看规则：标题下直接是六个身份（和大厅同顺序），插图 64→72；角章 24（图标 16 不变）；
   阵营只用 12/500 有色字（好人绿、狼人红），不再加底色胶囊 */
.ww-title + .rule-roles {
	margin-top: 16px;
}
.rule-role__art {
	width: 72px;
	height: 96px;
}
.rule-role + .rule-role::before {
	left: 84px;
}
.rule-role__art :deep(.role-art__symbol) {
	width: 24px;
	height: 24px;
	right: 0;
	bottom: 4%;
}
.rule-role__team {
	height: auto;
	padding: 0;
	border-radius: 0;
	background: transparent;
	font-size: 12px;
	line-height: 1.4;
}
.rule-role__team--wolf {
	background: transparent;
}
.rule-role .ww-rule__copy {
	font-size: 14px;
	line-height: 1.6;
}
/* 每段最后 5 个字连在一起（整词），末行不会只剩「结果。」「枪。」 */
.rule-role__tail {
	white-space: nowrap;
}
/* 如何开局挪到身份后面，行高 1.6 */
.rule-roles + .ww-rule .ww-rule__copy {
	line-height: 1.6;
}
/* 人数配置：干净的两列表——左列「6人：」12/600 等宽 40 宽，右列配置 12 号 ink2；一行一档、行高 36、发丝线分隔
   11-19 微信复评：标题和「如何开局」同一种做法（16 号绿色图标 + 16/700，间距 6）；
   折成两行时左列和第一行顶对齐；配置按身份分段、整段不折开，分隔点画在每段左边，折到行首那段的点被裁掉，
   行尾不会挂一个孤零零的「·」（字和顺序不变） */
.rule-lineups .rule-start {
	margin-bottom: 4px;
}
.rule-lineup {
	position: relative;
	display: flex;
	align-items: flex-start;
	gap: 4px;
	min-height: 36px;
	padding: 8px 0;
	box-sizing: border-box;
	font-size: 12px;
	line-height: 20px;
}
.rule-lineup + .rule-lineup::before {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	height: 1px;
	background: var(--k-line);
	transform: scaleY(0.5);
}
.rule-lineup__count {
	flex-shrink: 0;
	width: 40px;
	white-space: nowrap;
	font-size: 12px;
	line-height: 20px;
	font-weight: 600;
	color: var(--k-ink);
	font-variant-numeric: tabular-nums;
}
.rule-lineup__roles {
	flex: 1;
	min-width: 0;
	overflow: hidden;
	font-size: 12px;
	line-height: 20px;
	color: var(--k-ink2);
	font-variant-numeric: tabular-nums;
}
.rule-lineup__segs {
	display: flex;
	flex-wrap: wrap;
	margin-left: -14px;
}
.rule-lineup__seg {
	position: relative;
	padding-left: 14px;
	white-space: nowrap;
}
.rule-lineup__seg::before {
	content: '·';
	position: absolute;
	left: 0;
	top: 0;
	width: 14px;
	text-align: center;
	color: var(--k-muted);
}
@media (max-width: 360px) {
	.rule-role__art {
		width: 60px;
		height: 80px;
	}
	.rule-role + .rule-role::before {
		left: 72px;
	}
}
</style>
