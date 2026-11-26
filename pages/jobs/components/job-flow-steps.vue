<template>
  <!-- 报名 7 步进度（2026-10-18 主人：报名页、进度页同一套，见 ../apply-flow.js）：
       已完成的暖棕实心带对勾，当前这一步深棕、外面一圈浅晕，没到的白底细框；每步名字分两行写（一行挤不下 7 个「约定视频时间」）。
       current：1 起；8 = 全部完成；0 = 已结束（整条不亮） -->
  <view class="jfs">
    <view v-for="(lines, i) in stepLines" :key="i" class="jfs__item" :class="[stateOf(i + 1), { 'jfs__item--link': (arrivalEnabled && i === 6) || (endEnabled && i === 7) }]" @click="selectStep(i + 1)">
      <view class="jfs__track">
        <view v-if="i > 0" class="jfs__line jfs__line--l" />
        <view v-if="i < stepLines.length - 1" class="jfs__line jfs__line--r" />
        <view class="jfs__dot">
          <k-icon v-if="stateOf(i + 1) === 'done'" name="check" :size="12" color="white" />
          <text v-else class="jfs__num">{{ i + 1 }}</text>
        </view>
      </view>
      <text class="jfs__label">{{ lines[0] }}</text>
      <text class="jfs__label">{{ lines[1] }}</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { FLOW_LINES } from '../apply-flow.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  current: { type: Number, default: 1 },
  compact: { type: Boolean, default: false },
  endEnabled: { type: Boolean, default: false },
  arrivalEnabled: { type: Boolean, default: false }
})
const emit = defineEmits(['arrival', 'end'])
const selectStep = n => { if (n === 7 && props.arrivalEnabled) emit('arrival'); if (n === 8 && props.endEnabled) emit('end') }
// 候场页使用短名称，七步在小屏仍完整横排；其他报名页面沿用原名称。
const stepLines = computed(() => props.compact ? FLOW_LINES.map((lines, i) => i === 2 ? ['视频', '面试'] : i === 3 ? ['签署', '协议'] : lines) : FLOW_LINES)
const stateOf = (n) => (props.current <= 0 ? 'todo' : n < props.current ? 'done' : n === props.current ? 'current' : 'todo')
</script>

<style scoped lang="scss">
.jfs { display: flex; width: 100%; }
.jfs__item { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
.jfs__track { position: relative; width: 100%; height: 24px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
.jfs__line { position: absolute; top: 50%; height: 2px; margin-top: -1px; border-radius: 1px; background: #E8DFD3; }
.jfs__line--l { left: 0; right: 50%; margin-right: 9px; }
.jfs__line--r { left: 50%; right: 0; margin-left: 9px; }
.jfs__dot { position: relative; z-index: 1; width: 18px; height: 18px; border-radius: 50%; box-sizing: border-box; border: 1.5px solid #DDD3C6; background: var(--k-paper); display: flex; align-items: center; justify-content: center; }
.jfs__num { font-size: 10px; font-weight: 600; line-height: 1; color: var(--k-light); }
.jfs__label { max-width: 100%; font-size: 11px; line-height: 14px; color: #8A7A69; white-space: nowrap; text-align: center; }
/* 11-18 返修：可点的「到店确认」不用网页式下划线，改成深棕 600 字 + 字下方 12×2 的暖棕短条（返修 2：名字分两行写，只在第二行下面画一条，第一行下面那条会压在「确认」上） */
.jfs__item--link .jfs__label { position: relative; color: var(--k-red-deep); font-weight: 600; text-decoration: none; }
.jfs__item--link .jfs__label:last-child::after { content: ''; position: absolute; left: 50%; bottom: -4px; width: 12px; height: 2px; margin-left: -6px; border-radius: 1px; background: var(--k-red); }
/* 返修 3：可点的「到店确认」只用暖棕 500 字，不画下划短横、不加粗——只有当前步是深棕 700，免得像有两个当前步 */
.jfs__item--link .jfs__label { color: var(--k-red); font-weight: 500; }
.jfs__item--link .jfs__label:last-child::after { display: none; }
/* 已完成：主色实心 + 白对勾，连线也染成主色 */
.done .jfs__dot { border-color: var(--k-red); background: var(--k-red); }
.done .jfs__line, .current .jfs__line--l { background: linear-gradient(90deg, #C9A57E, var(--k-red)); }
.done .jfs__label { color: var(--k-ink2); }
/* 当前：深棕实心 + 外圈浅晕，名字加粗 */
.current .jfs__dot { width: 22px; height: 22px; border: 0; background: linear-gradient(135deg, #B9824E 0%, var(--k-red-deep) 100%); box-shadow: 0 0 0 4px rgba(154, 107, 63, .16); }
.current .jfs__num { color: #fff; font-size: 11px; }
.current .jfs__label { color: var(--k-red-deep); font-weight: 700; }
/* 11-18 返修 5：320 宽也保持 11 号（不低于字号下限）；字距收一点，第 3、4 步的名字各往外让 4px，「视频时间」「安全协议」之间看得出空隙 */
@media (max-width: 359px) {
  .jfs__label { font-size: 11px; line-height: 14px; letter-spacing: -.5px; }
  .jfs__item:nth-child(3) .jfs__label { transform: translateX(-4px); }
  .jfs__item:nth-child(4) .jfs__label { transform: translateX(4px); }
}
/* 11-19 第五轮（微信实拍复评）：步骤条退成「辅助信息」——没到的步骤名 10 号浅灰、已完成的 10 号灰，只有当前步 11/600 深棕；
   圆点到名字约 4（轨道 22 + 下距 3），整条约 52 高，下面的岗位卡 / 主卡做首屏主角。各页不再单独改步骤名字号 */
.jfs__track { height: 22px; margin-bottom: 3px; }
.jfs__label { font-size: 10px; line-height: 14px; font-weight: 400; color: var(--k-light); }
.done .jfs__label { color: var(--k-muted); }
.jfs__item--link .jfs__label { color: var(--k-red); font-weight: 500; }
.current .jfs__label { font-size: 11px; font-weight: 600; color: var(--k-red-deep); }
@media (max-width: 359px) {
  .jfs__label { font-size: 10px; letter-spacing: -.3px; }
  .current .jfs__label { font-size: 11px; letter-spacing: -.5px; }
}
</style>
