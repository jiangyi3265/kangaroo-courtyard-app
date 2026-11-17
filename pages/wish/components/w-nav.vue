<template><view class="wn"><view class="wn-item" @click="go(R.home)"><k-icon name="house" :size="22" color="#102c46"/><text>首页</text></view><view v-if="wishEnabled" class="wn-item" :class="{on:active==='square'}" @click="open('index')"><k-icon name="compass" :size="22" :color="active==='square'?'#3166f5':'#102c46'"/><text>广场</text></view><view v-if="wishEnabled" class="wn-item wn-publish" @click="go(R.wishPublish)"><view class="wn-plus"><k-icon name="plus" :size="30" color="#102c46"/></view><text>发布</text></view><view class="wn-item" @click="go(R.messages)"><k-icon name="message-circle" :size="22" color="#102c46"/><text>消息</text></view><view class="wn-item" :class="{on:active==='mine'}" @click="open('mine')"><k-icon name="user" :size="22" :color="active==='mine'?'#3166f5':'#102c46'"/><text>{{ wishEnabled ? '我的心愿' : '历史订单' }}</text></view></view></template>
<script setup>
import { wishEnabled } from '@/common/features.js'
import R from '@/common/routes.js'
import { go, replace } from '@/common/screen.js'
const props=defineProps({active:String})
function open(page){if((page==='mine'&&props.active==='mine')||(page==='index'&&props.active==='square'))return;replace('/pages/wish/'+page)}
</script>
<style scoped>
.wn{position:fixed;bottom:0;left:0;right:0;z-index:40;display:flex;align-items:center;justify-content:space-around;padding:9px 10px calc(10px + env(safe-area-inset-bottom));background:#fffffff2;backdrop-filter:blur(12px);border-top:1px solid #e7edf5;color:#102c46}.wn-item{display:flex;align-items:center;flex-direction:column;gap:4px;min-width:54px;font-size:10px;font-weight:600}.wn-item.on{color:#3166f5}.wn-publish{margin-top:-20px}.wn-plus{width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:#e7f58a;border:4px solid white;border-radius:50%;box-shadow:0 4px 14px #aec84235}.wn-publish text{margin-top:-2px}@media(min-width:700px){.wn{max-width:430px;margin:auto;box-sizing:border-box}}
</style>
