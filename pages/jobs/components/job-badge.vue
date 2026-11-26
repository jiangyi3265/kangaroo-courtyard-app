<template>
  <!-- 「经袋鼠实地拍摄并含保险」角标（2026-10-16）：门店已通过安心商家认证、并且岗位含保险才挂（由调用方判断，线上任务永远不挂）。
       card：岗位卡片封面左上角，两行写全（封面只有 100px 宽，一行放不下 11 个字，字号不小于 10px）；
       hero：详情页头图左上角，一行；chip：筛选面板里的选项、结果卡片里的小标签。
       2026-10-18 岗位详情改版：variant 选角标说哪一种——assured「经袋鼠实地拍摄并含保险」（默认，原来的用法不变）、
       onsite「经袋鼠实地探访」（实地探访但岗位不含保险）、online「经袋鼠线上采访」（线上视频采访的门店，赭黄底，和实地探访区分开） -->
  <!-- 2026-10-18 主人：角标「做得更精致」——白底圆章里的袋鼠贴纸 + 一圈细亮边 + 轻阴影；卡片上的那面小旗左下角多一块折角（藏到封面后面），不再是一整块粗色块。
       10-19 一比一还原参考图：底色从暖棕渐变改成浅杏色、字改深棕（参考图的角标都是浅底深字） -->
  <view class="jb" :class="['jb--' + size, { 'jb--online': variant === 'online' }]">
    <view v-if="size === 'card'" class="jb__fold" />
    <view v-if="size !== 'detail' && size !== 'ribbon'" class="jb__seal"><image class="jb__icon" src="/static/user-icons/roo-mark.png" mode="aspectFit" /></view>
    <view v-if="size === 'card' && variant === 'assured'" class="jb__lines"><text class="jb__text">经袋鼠实地拍摄</text><text class="jb__text">并含保险</text></view>
    <text v-else class="jb__text">{{ text }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  size: { type: String, default: 'card' }, // card | hero | detail | chip | ribbon
  variant: { type: String, default: 'assured' } // assured | onsite | online
})
const TEXT = { assured: '经袋鼠实地拍摄并含保险', onsite: '经袋鼠实地探访', online: '经袋鼠线上采访' }
const DETAIL_TEXT = { assured: '实地探访 · 含保险', onsite: '袋鼠实地探访', online: '袋鼠线上采访' }
const text = computed(() => (props.size === 'ribbon' && props.variant === 'assured' ? '袋鼠实拍 · 含保险' : '') || (props.size === 'detail' && DETAIL_TEXT[props.variant]) || TEXT[props.variant] || TEXT.assured)
</script>

<style scoped lang="scss">
/* 10-19 按参考图一比一还原：角标改成浅杏色底 + 深棕字（参考图「袋鼠实探访」「经袋鼠实地拍摄并含保险」都是浅色底深字），一圈白细边 + 轻阴影压在照片上；
   袋鼠贴纸放在白底圆章里。深棕字在浅杏底上对比度 ≥ 7:1 */
.jb { position: relative; display: inline-flex; align-items: center; box-sizing: border-box; white-space: nowrap; color: #5A3A22; background: linear-gradient(135deg, #FBEFE0 0%, #F4DEC2 100%); box-shadow: 0 2px 8px rgba(58, 38, 22, .22), inset 0 0 0 1px rgba(255, 255, 255, .75); }
.jb__seal { flex: 0 0 auto; border-radius: 50%; background: #FFFFFF; box-shadow: 0 0 0 1px rgba(201, 147, 95, .35); display: flex; align-items: center; justify-content: center; }
.jb__icon { flex: 0 0 auto; display: block; }
.jb__lines { display: flex; flex-direction: column; }
.jb__text { display: block; font-weight: 700; letter-spacing: .3px; white-space: nowrap; }
/* 卡片：贴着封面左上角的浅杏小旗，右边圆头；左下角一小块深色折角，像从封面后面绕过来 */
.jb--card { gap: 3px; padding: 3px 7px 3px 3px; border-radius: 0 10px 10px 0; }
.jb__fold { position: absolute; left: 0; bottom: -4px; width: 4px; height: 4px; background: #B88A5E; clip-path: polygon(0 0, 100% 0, 100% 100%); }
.jb--card .jb__seal { width: 17px; height: 17px; }
.jb--card .jb__icon { width: 12px; height: 13px; }
.jb--card .jb__text { font-size: 10px; line-height: 12px; }
/* 列表大图：45°斜带从封面左边跨到上边，文字随斜带旋转；父容器裁掉两端。 */
.jb--ribbon { position: absolute; left: -36px; top: 36px; width: 168px; height: 24px; padding: 0; justify-content: center; border-radius: 0; transform: rotate(-45deg); color: var(--k-ochre-deep); background: var(--k-ochre-soft); box-shadow: 0 1px 3px rgba(94,65,36,.12); }
.jb--ribbon .jb__text { font-size: 10px; line-height: 24px; letter-spacing: .2px; font-weight: 600; }
.jb--hero { gap: 5px; height: 26px; padding: 0 11px 0 3px; border-radius: 13px; }
.jb--hero .jb__seal { width: 20px; height: 20px; }
.jb--hero .jb__icon { width: 14px; height: 15px; }
.jb--hero .jb__text { font-size: 12px; line-height: 26px; }
.jb--detail { padding: 3px 8px; border-radius: 5px; background: #F4E5CF; box-shadow: 0 1px 3px rgba(58,38,22,.12); }
.jb--detail .jb__text { font-size: 11px; line-height: 18px; letter-spacing: 0; font-weight: 600; }
.jb--chip { gap: 3px; height: 22px; padding: 0 8px 0 3px; border-radius: 11px; box-shadow: inset 0 0 0 1px rgba(201, 147, 95, .55); }
.jb--chip .jb__seal { width: 16px; height: 16px; }
.jb--chip .jb__icon { width: 11px; height: 12px; }
.jb--chip .jb__text { font-size: 11px; line-height: 22px; }
/* 线上采访：浅赭黄底 + 赭黄深档字，和实地探访的浅杏区分开 */
.jb--online { color: var(--k-ochre-deep); background: linear-gradient(135deg, #FBF3DF 0%, #F1E2BE 100%); }
</style>
