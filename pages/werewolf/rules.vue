<template>
	<view class="ww-page">
		<k-topbar title="玩法说明" back :fab="false" />
		<view class="ww-body">
			<text class="ww-title">6–12位朋友，一桌好戏</text>
			<view class="ww-rule">
				<text class="ww-rule__title">如何开局</text>
				<text class="ww-rule__copy">
					一键创建房间，房主可设置6至12人和线上、面对面模式。进入房间自动入座并准备，也可换座或暂停准备。修改设置保留准备状态，满员后房主开始，5秒倒计时后发放身份。每人默认发言90秒，可选择30、45、60、90或120秒。面对面模式每人仍需用自己的手机加入，身份仅本人可见，夜晚在手机操作，白天当面交流。
				</text>
			</view>
			<view v-for="role in roles" :key="role.short" class="rule-role">
				<view class="rule-role__art"><ww-role-art :role="role" /></view>
				<view class="rule-role__copy">
					<text class="ww-rule__title">
						{{ role.label }}
					</text>
					<text class="ww-rule__copy">{{ role.description }}</text>
				</view>
			</view>
			<view class="ww-rule"><text class="ww-rule__title">人数与身份配置</text><view v-for="count in [6,7,8,9,10,11,12]" :key="count" class="ww-rule__copy">{{ count }}人：{{ lineupText(roleCountsFor(count)) }}</view></view>
			<view v-for="rule in rules" :key="rule.title" class="ww-rule">
				<text class="ww-rule__title">{{ rule.title }}</text>
				<text class="ww-rule__copy">{{ rule.copy }}</text>
			</view>
			<k-button block type="outline" class="rules-back" @click="back">
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
const roles = Object.values(ROLES)
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
.rule-role {
	display: flex;
	align-items: center;
	gap: 16px;
	padding: 14px 0;
	border-bottom: 1px solid var(--k-line);
}
.rule-role__art {
	width: 80px;
	height: 110px;
	flex-shrink: 0;
}
.rule-role__copy {
	flex: 1;
	min-width: 0;
}
.rules-back {
	margin-top: 24px;
}
</style>
