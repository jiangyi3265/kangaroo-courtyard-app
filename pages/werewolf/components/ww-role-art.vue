<template><view class="role-art" :class="{ 'role-art--bust': bust }"><ww-sprite :index="role.sprite" :flip="role.short === '守卫'" :bust="bust"/><view v-if="role.icon" class="role-art__symbol"><k-icon :name="role.icon" :size="16" color="white"/></view><view v-if="!role.icon && symbols[role.sprite]" class="role-art__symbol"><k-icon :name="symbols[role.sprite]" :size="16" color="white"/></view></view></template>
<script setup>
import WwSprite from './ww-sprite.vue'
defineProps({role:{type:Object,required:true},bust:Boolean})
// 返修第 3 轮（纯展示）：六个身份都有角标，一套做法——狼人 moon、预言家 eye、女巫 wand-sparkles、村民 users（猎人/守卫用 role.icon）
const symbols = ['moon', 'eye', 'wand-sparkles', 'users']
</script>
<style scoped>
.role-art{position:relative;width:100%;height:100%}.role-art__symbol{position:absolute;right:8%;bottom:12%;width:28px;height:28px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--k-green);border:1.5px solid var(--k-paper)}

/* 11-18 第四轮：bust = 半身像。插图按原比例（宽:高 = 3:4）铺满宽度、顶对齐，下半身由外框裁掉；
   角章改为贴外框右下角（外框要 position:relative + overflow:hidden + 定高） */
.role-art--bust{position:static;height:auto}
/* 11-19：插图高度由 ww-sprite 的 bust 开关定（父组件样式进不了子组件，微信里不生效） */
</style>
