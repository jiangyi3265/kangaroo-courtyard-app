<template>
  <view>
    <template v-for="(part, i) in parts" :key="i">
      <image v-if="part.sticker" class="inline-sticker" mode="aspectFit" :src="part.sticker.image" :aria-label="'袋鼠' + part.sticker.label" />
      <text v-else selectable>{{ part.text }}</text>
    </template>
    <text v-if="rendered !== value" class="wording-original" role="button" @click.stop="original = !original">{{ original ? '收起原文' : '称呼已更新 · 查看原文' }}</text>
  </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { displayWording } from '@/common/display-wording.js'
import { commentParts } from '../comment-stickers.js'
const props = defineProps({ value: { type: String, default: '' }, preserve: { type: Array, default: () => [] } })
const original = ref(false)
const rendered = computed(() => displayWording(props.value, props.preserve))
const parts = computed(() => commentParts(original.value ? props.value : rendered.value))
watch(() => props.value, () => { original.value = false })
</script>
<style scoped>
.inline-sticker { display: inline-block; width: 38px; height: 38px; vertical-align: middle; }
.wording-original { display: block; margin-top: 6px; padding: 3px 0; font-size: 11px; line-height: 18px; color: var(--k-muted); text-decoration: underline; }
</style>
