<template>
  <view class="lv" :class="['lv--' + idx, { 'lv--off': off }]" :style="boxStyle" :aria-label="'会员等级 ' + (idx + 1)">
    <view class="lv__crop" :style="cropStyle"><image class="lv__emblem" src="/pages/profile/static/member-travel-atlas.png" :style="spriteStyle" mode="scaleToFill" /></view>
    <text v-if="px >= 40" class="lv__rank" :style="rankStyle">{{ rank }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  level: { type: [Number, String], default: 0 },
  size: { type: [Number, String], default: 44 },
  off: { type: Boolean, default: false }
})
const idx = computed(() => Math.min(5, Math.max(0, Math.trunc(Number(props.level) || 0))))
const px = computed(() => Math.min(160, Math.max(16, Number(props.size) || 44)))
// The generated atlas's second row begins at y=490; use its actual bounds to avoid adjacent ears bleeding into a badge.
const cropStyle = computed(() => ({ height: px.value * (idx.value < 3 ? 490 / 512 : 1) + 'px' }))
const spriteStyle = computed(() => ({ width: px.value * 3 + 'px', height: px.value * 2 + 'px', left: -(idx.value % 3) * px.value + 'px', top: idx.value < 3 ? '0px' : -490 / 512 * px.value + 'px' }))
const rank = computed(() => String(idx.value + 1).padStart(2, '0'))
const boxStyle = computed(() => ({ width: px.value + 'px', height: px.value + 'px' }))
const rankStyle = computed(() => ({ fontSize: Math.max(9, Math.round(px.value * .14)) + 'px' }))
</script>

<style scoped>
.lv { position: relative; flex: 0 0 auto; box-sizing: border-box; }
.lv__crop { position: relative; overflow: hidden; width: 100%; height: 100%; }
.lv__emblem { position: absolute; display: block; width: 300%; height: 200%; max-width: none; }
.lv--off .lv__crop { filter: grayscale(1); opacity: .48; }
.lv__rank { position: absolute; right: -2px; bottom: 0; min-width: 1.7em; padding: .15em .3em; border: 1px solid #D8C7B1; border-radius: 6px; box-sizing: border-box; text-align: center; background: #FCF9F3; color: #795331; font-family: var(--k-sans); font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; }
.lv--off .lv__rank { color: #7A746D; border-color: #D6D0C7; }
</style>
