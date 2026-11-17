<template>
  <view v-if="urgency" class="job-urgency" :class="['job-urgency--' + urgency.level, { 'job-urgency--detail': expanded }]" :aria-label="urgency.label">
    <view class="job-urgency__label"><k-icon name="flag" :size="expanded ? 19 : 13" :color="['', '#47633D', '#875813', '#9B3528', '#FFF7EE'][urgency.level]" fill /><text>{{ urgency.label }}</text></view>
    <text v-if="expanded && urgency.deadlineText" class="job-urgency__deadline">{{ urgency.deadlineText }} 截止（北京时间）</text>
  </view>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { jobUrgency } from '@/common/job-urgency.js'
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({ job: Object, expanded: Boolean })
const now = ref(Date.now())
const urgency = computed(() => jobUrgency(props.job, now.value))
let timer
function refresh() {
  clearTimeout(timer)
  now.value = Date.now()
  const end = urgency.value?.deadline
  if (end != null) timer = setTimeout(refresh, Math.min(2147483647, Math.max(1, end - now.value)))
}
watch(() => [props.job?.status, props.job?.urgentLevel, props.job?.urgentDeadline], refresh, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>
<style scoped>
.job-urgency{display:inline-flex;align-items:center;max-width:100%;box-sizing:border-box;padding:4px 8px;border-radius:6px;background:#FBE9E3;color:#9B3528;font-size:12px;font-weight:700;line-height:1.5}
.job-urgency__label{display:flex;align-items:center;gap:5px;flex-shrink:0}
.job-urgency--1{background:#EAF0E5;color:#47633D}.job-urgency--2{background:#FFF0D8;color:#875813}.job-urgency--4{background:#A12D27;color:#FFF7EE}
.job-urgency--detail{display:flex;flex-wrap:wrap;gap:7px 16px;padding:14px 16px;border-radius:0;font-size:17px}
.job-urgency__deadline{font-size:12px;font-weight:400;line-height:1.6}
</style>
