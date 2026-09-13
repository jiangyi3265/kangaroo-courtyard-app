<template>
  <button class="k-button" :class="[`is-${type}`, `is-${size}`, { 'is-block': block, 'is-disabled': disabled, 'is-round': round }]" :disabled="disabled" @click="onClick">
    <k-icon v-if="icon" :name="icon" :size="iconSize" :color="iconColor" :stroke="iconFill ? 0.5 : 1.8" :fill="iconFill" />
    <text class="k-button__label"><slot /></text>
  </button>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

const props = defineProps({
  type: { type: String, default: 'primary' },  // primary | secondary(纸白+红字红框) | outline(纸白+墨字灰框) | ghost(无框红字) | green | indigo | ochre | dark | soft(浅灰底)
  size: { type: String, default: 'lg' },       // lg 48px | md 40px | sm 32px | xs 26px
  block: { type: Boolean, default: false },
  round: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  icon: { type: String, default: '' },
  iconFill: { type: Boolean, default: false }   // 实心图标（如 wechat）
})
const emit = defineEmits(['click'])
const onClick = () => { if (!props.disabled) emit('click') }
const iconSize = computed(() => ({ lg: 18, md: 16, sm: 14, xs: 12 })[props.size] || 18)
const iconColor = computed(() => {
  if (['primary', 'green', 'indigo', 'ochre', 'dark'].includes(props.type)) return 'white'
  if (['secondary', 'ghost'].includes(props.type)) return 'red'
  return 'ink'
})
</script>

<style scoped lang="scss">
.k-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid transparent; border-radius: 8px; font-weight: 600; white-space: nowrap; flex-shrink: 0; box-sizing: border-box; transition: opacity .18s, transform .18s; }
.k-button__label { white-space: nowrap; }
.is-lg { height: 48px; padding: 0 20px; font-size: 16px; }
.is-md { height: 40px; padding: 0 16px; font-size: 14px; }
.is-sm { height: 32px; padding: 0 12px; font-size: 13px; font-weight: 500; }
.is-xs { height: 26px; padding: 0 10px; font-size: 12px; font-weight: 500; border-radius: 6px; }
.is-block { width: 100%; display: flex; }
.is-round { border-radius: 999px; }
.is-primary { color: #FFF8F0; background: var(--k-red); }
.is-secondary { color: var(--k-red); background: var(--k-paper); border-color: rgba(169,71,52,.55); }
.is-outline { color: var(--k-ink); background: var(--k-paper); border-color: var(--k-line2); }
.is-ghost { color: var(--k-red); background: transparent; }
.is-green { color: #fff; background: var(--k-green); }
.is-indigo { color: #fff; background: var(--k-indigo); }
.is-ochre { color: #fff; background: var(--k-ochre); }
.is-dark { color: #fff; background: var(--k-ink); }
.is-soft { color: var(--k-ink); background: var(--k-paper2); }
.is-disabled { color: #fff; background: #C9C1B6; border-color: transparent; }
.k-button:active { transform: scale(.985); opacity: .92; }
</style>
