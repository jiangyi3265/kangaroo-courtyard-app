<template>
  <view class="subscribe-entry"><button hover-class="k-press" @click="open"><k-icon name="bell" :size="16" color="ochre"/><text>{{ label }}</text><text>›</text></button></view>
</template>
<script setup>
const props=defineProps({ scenes:{type:String,default:''},label:{type:String,default:'订阅微信提醒'} })
const open=()=>uni.navigateTo({url:'/pages/profile/subscriptions'+(props.scenes?'?scenes='+encodeURIComponent(props.scenes):'')})
</script>
<style scoped>
.subscribe-entry{padding:8px 16px}.subscribe-entry button{display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;line-height:1.5;font-size:13px;color:var(--k-ochre);background:var(--k-surface);border:1px solid var(--k-line2);border-radius:12px}.subscribe-entry button::after{border:0}
</style>
