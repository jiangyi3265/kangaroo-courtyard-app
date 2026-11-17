<template><view class="role-art"><ww-sprite :index="role.sprite"/><view v-if="role.icon" class="role-art__symbol"><k-icon :name="role.icon" :size="24" color="white"/></view></view></template>
<script setup>
import WwSprite from './ww-sprite.vue'
defineProps({role:{type:Object,required:true}})
</script>
<style scoped>
.role-art{position:relative;width:100%;height:100%}.role-art__symbol{position:absolute;right:8%;bottom:12%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#315647;border:2px solid #e9d9b7}
</style>
