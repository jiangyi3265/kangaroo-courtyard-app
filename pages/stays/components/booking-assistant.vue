<template>
  <!-- #ifdef MP-WEIXIN -->
  <button class="booking-assistant" open-type="contact" :session-from="'stay-booking|' + stay.stayId" show-message-card :send-message-title="stay.stayName" :send-message-path="'/pages/stays/detail?stayId=' + stay.stayId" :send-message-img="absUrl(stay.cover)" @error="contactError">联系订房助手</button>
  <!-- #endif -->
  <!-- #ifndef MP-WEIXIN -->
  <button class="booking-assistant" @click="go(R.support + '?ctx=profile')">联系订房助手</button>
  <!-- #endif -->
</template>
<script setup>
import { absUrl } from '@/common/upload.js'
import { go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
defineProps({ stay: { type: Object, required: true } })
const contactError = () => toast('客服会话暂未打开，请稍后重试')
</script>
<style scoped>
.booking-assistant { width:100%; margin:0; padding:0 18px; min-height:46px; line-height:46px; border-radius:24px; background:#8a5e36; color:#fcf9f3; font-size:16px; font-weight:600; }
.booking-assistant::after { border:0; }
</style>
