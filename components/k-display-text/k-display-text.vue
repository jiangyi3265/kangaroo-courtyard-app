<template>
  <view>
    <text selectable>{{ original ? value : rendered }}</text>
    <text v-if="changed" class="wording-original" role="button" @click.stop="original = !original">{{ original ? '收起原文' : '称呼已更新 · 查看原文' }}</text>
  </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { displayWording } from '@/common/display-wording.js'
const props = defineProps({ value: { type: String, default: '' }, preserve: { type: Array, default: () => [] }, preserveQuotes: { type: Boolean, default: true } })
const original = ref(false)
const rendered = computed(() => displayWording(props.value, props.preserve, { preserveQuotes: props.preserveQuotes }))
const changed = computed(() => rendered.value !== props.value)
watch(() => props.value, () => { original.value = false })
</script>
<style scoped>
.wording-original { display: block; margin-top: 6px; padding: 3px 0; font-size: 11px; line-height: 18px; color: var(--k-muted, #7b746b); text-decoration: underline; }
</style>
