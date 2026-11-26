<template>
  <view v-if="member && member.level > 0" class="member-mark" :class="{colored:member.level>=3,exclusive:member.exclusive}">
    <k-icon v-if="member.badge" :name="member.exclusive?'crown':'badge-check'" :size="12" color="red" />
    <text>{{ member.name }}</text>
  </view>
  <view v-if="member?.achievement" class="member-mark colored"><k-icon name="medal" :size="12" color="red"/><text>{{ member.achievement.name }}</text></view>
</template>
<script setup>
defineProps({member:{type:Object,default:null}})
</script>
<style scoped>
/* 2026-11-17 改版「小而精」：会员 / 勋章小标签按统一规格（高 17、圆角 4、字 10、不描边） */
.member-mark{display:inline-flex;align-items:center;gap:2px;flex-shrink:0;min-height:17px;padding:0 5px;border-radius:4px;background:#F5F1EB;color:var(--k-ink2);font-size:10px;font-weight:500;line-height:17px}
.colored{color:var(--k-red-deep);background:var(--k-red-soft)}.exclusive{color:#6c543c;background:linear-gradient(120deg,#f8e5bc,#fff7df)}
</style>
