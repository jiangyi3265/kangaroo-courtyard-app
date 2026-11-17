<template>
  <view v-if="member && member.level > 0" class="member-mark" :class="{colored:member.level>=3,exclusive:member.exclusive}">
    <k-icon v-if="member.badge" :name="member.exclusive?'crown':'badge-check'" :size="13" color="red" />
    <text>{{ member.name }}</text>
  </view>
  <view v-if="member?.achievement" class="member-mark colored"><k-icon name="medal" :size="12" color="red"/><text>{{ member.achievement.name }}</text></view>
</template>
<script setup>
defineProps({member:{type:Object,default:null}})
</script>
<style scoped>
.member-mark{display:inline-flex;align-items:center;gap:3px;flex-shrink:0;font-size:10px;line-height:1.6;color:#7b7468;border:1px solid #e1d9cd;border-radius:6px;padding:1px 5px}
.colored{color:#916437;background:#f8eddd;border-color:#ecd7ba}.exclusive{color:#6c543c;background:linear-gradient(120deg,#f8e5bc,#fff7df);border-color:#d8b573}
</style>
