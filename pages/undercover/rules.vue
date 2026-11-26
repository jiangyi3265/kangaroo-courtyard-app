<template>
  <view class="uc-page" :class="$userSurface">
    <k-topbar back title="谁是卧底 · 玩法" :fab="false" />
    <view class="uc-body uc-rules">
      <text class="uc-title">听出那一点不同</text>
      <view v-for="rule in rules" :key="rule.title" class="uc-rule">
        <text class="uc-section-title">{{ rule.title }}</text>
        <text v-for="(part, i) in paras(rule.copy)" :key="i" class="uc-copy"><text class="uc-rule__lead">{{ part.slice(0, cut(part, i)) }}</text>{{ part.slice(cut(part, i), -tail(part)) }}<text class="uc-rule__tail">{{ part.slice(-tail(part)) }}</text></text>
      </view>
      <k-button block @click="back">我知道了</k-button>
    </view>
  </view>
</template>
<script setup>
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { onShareAppMessage, onShareTimeline, onShow } from '@dcloudio/uni-app'
import { back } from '@/common/screen.js'
const rules = [
  { title: '凑齐朋友，一起准备', copy: '4～6人配1名卧底，7～10人配2名卧底。房主选择旅行、日常或混合词库，以及每人30、60或90秒的描述时间。成员或设置变化后，其他玩家需要重新准备。' },
  { title: '每人只知道自己的词', copy: '开局有10秒看词时间，随后仍可随时点开查看。平民拿到相同词语，卧底拿到另一个相近的词。所有人都要通过描述推测自己的身份，房主也一样。' },
  { title: '轮流描述，藏好词语', copy: '按页面提示轮流描述。可以提交一句文字，也可以面对面说完后点击“口头描述完成”。每人每轮提交一次，避免直接说出词语或谐音。超时自动进入下一位。' },
  { title: '投票找出卧底', copy: '每轮描述结束后，存活玩家有45秒投票。可投给其他存活玩家，也可弃票，超时视为弃票。提交后无法修改，全部提交或倒计时结束时统一揭晓。出局玩家可以继续观看。' },
  { title: '平票时，补充描述', copy: '最高票平票时，平票玩家各补充描述一次。所有存活玩家再投一次，只能选择平票玩家中的其他人，或弃票。再次平票或全员弃票，本轮无人出局。' },
  { title: '怎样获胜', copy: '全部卧底出局，平民获胜。存活卧底人数达到或超过平民人数，卧底获胜。达到12轮仍未分出胜负则平局。结算时揭晓双方词语和所有身份，房主可发起再来一局。' },
  { title: '暂时离开与回到房间', copy: '返回大厅或切到后台后，可从大厅继续房间，倒计时仍由服务端推进。等待开局时，房主可以移出离线超过一分钟的玩家。退出房间会转交房主，房间闲置24小时后过期。同一时间只能待在一个房间：要开新房间或加入别的房间，先退出正在等人的房间，或把正在进行的一局打完；已经打完的房间会自动退出。' }
]

// 纯展示（规则文字本身一个字不动）：超过 100 字的长段把最后一句另起一段；每节第一句做段首（400 墨色，只用颜色区分）；
// 每段最后 4 个字连在一起不折开，末行不会只剩「备。」这样的一两个字
const paras = (copy) => {
  const at = copy.length > 100 ? copy.lastIndexOf('。', copy.length - 2) + 1 : 0
  return at > 0 ? [copy.slice(0, at), copy.slice(at)] : [copy]
}
const cut = (part, i) => (i ? 0 : Math.min(part.indexOf('。') + 1, part.length - tail(part)))
// 纯展示：每段末尾不折开的整词（不在表里的按 4 个字）
const TAILS = ['重新准备。', '房主也一样。', '下一位。', '继续观看。', '无人出局。', '再来一局。', '后过期。', '动退出。']
const tail = (part) => (TAILS.find((t) => part.endsWith(t)) || '····').length

const pageShareMessage = () => publicShare('/pages/undercover/rules', {}, '谁是卧底 · 玩法说明')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>
<style lang="scss">
@import './undercover.scss';
</style>
