<template>
  <button class="k-button" :class="[`is-${type}`, `is-${size}`, { 'is-block': block, 'is-disabled': disabled, 'is-round': round }]" :hover-class="disabled ? 'none' : 'k-press-s'" :disabled="disabled" :open-type="openType || undefined" @click="onClick" @getphonenumber="(e) => emit('getphonenumber', e)">
    <k-icon v-if="icon" :name="icon" :size="iconSize" :color="iconColor" :stroke="iconFill ? 0.5 : ''" :fill="iconFill" />
    <text v-if="label" class="k-button__label">{{ label }}</text><view v-else class="k-button__label"><slot /></view>
  </button>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
// 默认插槽外层用 view 不用 text：微信 text 只渲染插槽文字的一份拷贝，父页面文案变了（如「查看 N 家」）按钮上不跟着变

const props = defineProps({
  label: { type: String, default: '' }, // 动态按钮文案直接传入，避免小程序多层默认插槽丢失文字
  type: { type: String, default: 'primary' },  // primary(暖棕) | secondary(白底+棕字棕框) | outline(白底+墨字灰框) | ghost(无框棕字) | green | indigo | ochre | dark | soft(浅灰底)
  size: { type: String, default: 'lg' },       // lg 48px | md 40px | sm 32px | xs 26px
  block: { type: Boolean, default: false },
  round: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  icon: { type: String, default: '' },
  iconFill: { type: Boolean, default: false },  // 实心图标（如 wechat）
  openType: { type: String, default: '' }       // 小程序开放能力透传（如 getPhoneNumber），H5 忽略
})
const emit = defineEmits(['click', 'getphonenumber'])
// 把原生事件带出去：父级写 @click.stop 时 Vue 会在调用前执行 event.stopPropagation()，事件缺失会抛 TypeError（H5）
const onClick = (e) => { if (!props.disabled) emit('click', e) }
const iconSize = computed(() => ({ lg: 18, md: 16, sm: 14, xs: 12 })[props.size] || 18)
const iconColor = computed(() => {
  // 11-18 起禁用也是原配色整体变淡（见样式 .is-disabled），图标跟着原配色走，不再单独变浅灰
  if (['primary', 'green', 'indigo', 'ochre', 'dark'].includes(props.type)) return 'white'
  if (['secondary', 'ghost'].includes(props.type)) return 'red'
  return 'ink'
})
</script>

<style scoped lang="scss">
.k-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid transparent; border-radius: var(--k-radius); font-weight: 600; white-space: nowrap; flex-shrink: 0; box-sizing: border-box; transition: opacity .18s, transform .18s; }
.k-button__label { white-space: nowrap; }
.is-lg { height: 48px; padding: 0 20px; font-size: 16px; }
.is-md { height: 40px; padding: 0 16px; font-size: 14px; }
.is-sm { height: 32px; padding: 0 12px; font-size: 13px; font-weight: 500; }
.is-xs { height: 26px; padding: 0 10px; font-size: 12px; font-weight: 500; }
.is-block { width: 100%; display: flex; }
.is-round { border-radius: 999px; }
.is-primary { color: #fff; background: var(--k-grad-brown); }
.is-primary.is-lg { border-radius: 999px; }
.is-secondary { color: var(--k-red); background: var(--k-paper); border-color: var(--k-red-line); }
.is-outline { color: var(--k-ink); background: var(--k-paper); border-color: var(--k-line2); }
.is-ghost { color: var(--k-red); background: transparent; }
.is-green { color: #fff; background: var(--k-green); }
.is-indigo { color: #fff; background: var(--k-indigo); }
.is-ochre { color: #fff; background: var(--k-ochre); }
.is-dark { color: #fff; background: var(--k-ink); }
.is-soft { color: var(--k-ink); background: var(--k-paper2); }
/* 不可点（11-18 精修词典）：原配色整体变淡 .45，不要冷灰底；按下效果走模板上的 hover-class。
   微信 button[disabled] 自带冷灰底灰字、比一个类名优先，第一轮各页又各写了一套暖灰底，所以颜色用 !important 统一盖回原配色（页面里那些禁用灰底规则可删） */
.k-button.is-disabled { opacity: .45; }
/* 实心按钮上常写着「已截止」「已报满」这类状态字，淡到 .6 就够看出不能点，白字也还读得清 */
.k-button.is-disabled.is-primary, .k-button.is-disabled.is-green { opacity: .6; }
.is-disabled.is-primary { color: #fff !important; background: var(--k-grad-brown) !important; }
.is-disabled.is-secondary { color: var(--k-red) !important; background: var(--k-paper) !important; border-color: var(--k-red-line) !important; }
.is-disabled.is-outline { color: var(--k-ink) !important; background: var(--k-paper) !important; border-color: var(--k-line2) !important; }
.is-disabled.is-ghost { color: var(--k-red) !important; background: transparent !important; }
.is-disabled.is-green { color: #fff !important; background: var(--k-green) !important; }
</style>
