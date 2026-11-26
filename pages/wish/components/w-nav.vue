<template>
  <view class="wn">
    <view class="wn-item" hover-class="k-press" @click="go(R.home)"><k-icon name="house" art="nav-home" :size="26" color="muted" /><text>首页</text></view>
    <view v-if="wishEnabled" class="wn-item" :class="{ on: active === 'square' }" hover-class="k-press" @click="open('index')"><k-icon name="compass" art="wish-square" :size="26" :color="active === 'square' ? 'red' : 'muted'" /><text>广场</text></view>
    <view v-if="wishEnabled" class="wn-item wn-publish" hover-class="k-press" @click="go(R.wishPublish)"><view class="wn-plus"><k-icon name="pen-line" art="nav-publish" :size="26" /><text>发布</text></view></view>
    <view class="wn-item" hover-class="k-press" @click="go(R.messages)"><k-icon name="message-circle" art="nav-messages" :size="26" color="muted" /><text>消息</text></view>
    <view class="wn-item" :class="{ on: active === 'mine' }" hover-class="k-press" @click="open('mine')"><k-icon name="user" art="wish-mine" :size="26" :color="active === 'mine' ? 'red' : 'muted'" /><text>{{ wishEnabled ? '我的心愿' : '历史订单' }}</text></view>
  </view>
</template>
<script setup>
import { wishEnabled } from '@/common/features.js'
import R from '@/common/routes.js'
import { go, replace } from '@/common/screen.js'
const props=defineProps({active:String})
function open(page){if((page==='mine'&&props.active==='mine')||(page==='index'&&props.active==='square'))return;replace('/pages/wish/'+page)}
</script>
<style scoped>
/* 2026-11-17 改版「小而精」：和全站底栏一个样子 —— 50 高、图标 22、字 10，没选中的变浅，选中是暖棕；「发布」是凸起的暖棕圆钮（46，凸出 16）。五个入口都在。
   2026-11-18 第三轮修真毛病：全站是 border-box，原来写死 50 高又把底部安全区（全面屏约 34）算在这 50 里，放图标的只剩十几像素，「发布」圆钮被压成扁椭圆 ——
   改成和主底栏 k-tabbar 一样：图标那一行固定 50 高，安全区另外加在下面；圆钮不许被压缩，保证 46×46 正圆。 */
.wn{position:fixed;bottom:0;left:0;right:0;z-index:40;display:flex;align-items:stretch;height:calc(50px + var(--k-safe-bottom, env(safe-area-inset-bottom)));padding:0 6px var(--k-safe-bottom, env(safe-area-inset-bottom));background:var(--k-paper);box-shadow:0 -.5px 0 rgba(58,50,43,.08),0 -6px 18px rgba(58,50,43,.05);color:var(--k-muted)}.wn-item{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3px;font-size:10px;line-height:1}.wn-item.on{color:var(--k-red);font-weight:600}.wn-publish{justify-content:flex-start}.wn-plus{flex-shrink:0;width:46px;height:46px;box-sizing:border-box;margin-top:-16px;display:flex;align-items:center;justify-content:center;flex-direction:column;background:var(--k-red-soft);border:3px solid var(--k-paper);border-radius:50%;box-shadow:inset 0 0 0 1px rgba(154,107,63,.28),0 3px 9px rgba(138,90,48,.20)}@media(min-width:700px){.wn{max-width:430px;margin:auto}}
.wn-plus{color:#604125;font-size:10px;font-weight:600;line-height:11px}
</style>
