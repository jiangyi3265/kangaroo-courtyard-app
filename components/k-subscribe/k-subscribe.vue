<template>
  <view class="subscribe-entry"><button hover-class="k-press" @click="open"><k-icon name="bell" :size="16" color="red"/><text>{{ manage ? label : '订阅本端微信提醒' }}</text><k-icon name="chevron-right" :size="12" color="muted"/></button></view>
</template>
<script setup>
import { visitSubscriptions } from '@/common/visit-subscriptions.js'
const props=defineProps({ manage:Boolean,scenes:{type:String,default:''},label:{type:String,default:'订阅微信提醒'} })
const open = () => {
  // #ifdef MP-WEIXIN
  if (!props.manage && visitSubscriptions.ask(true)) return
  // #endif
  uni.navigateTo({url:'/pages/profile/subscriptions'})
}
</script>
<style scoped>
.subscribe-entry{padding:8px 12px 0}.subscribe-entry button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;line-height:1.5;font-size:12px;color:var(--k-red-deep);background:var(--k-paper);border-radius:12px}.subscribe-entry button::after{border:0}
</style>
