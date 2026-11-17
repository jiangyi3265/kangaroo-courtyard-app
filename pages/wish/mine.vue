<template><view class="wish-page"><k-topbar :title="wishEnabled ? '我的心愿' : '历史心愿订单'" back :fab="false"/><view class="w-body"><view class="wm-banner"><text class="w-eyebrow">MY LITTLE CONNECTIONS</text><text class="w-title">每一次帮忙，<br/>都有回响。</text><k-icon name="heart-handshake" :size="62" color="#e7f58a"/><view class="wm-links"><text @click="go(route('credential'))">我的资质与收款资料 →</text></view></view><view class="w-tabs w-section"><view class="w-tabs__item" :class="{on:role==='publisher'}" @click="setRole('publisher')">我发布的</view><view class="w-tabs__item" :class="{on:role==='helper'}" @click="setRole('helper')">我帮助的</view></view><text class="w-caption wm-explain">一份心愿由一位朋友承接。发布者在“我发布的”、接单者在“我帮助的”查看同一订单。</text><scroll-view scroll-x class="wm-filters"><view class="wm-filterrow"><view v-for="s in statuses" :key="s.key" class="w-pill" :class="{on:status===s.key}" @click="status=s.key;load(true)">{{s.label}}</view></view></scroll-view><w-card v-for="item in rows" :key="item.wishId" :item="item" mine/><view v-if="error" class="w-state"><text>{{error}}</text><button class="w-secondary" @click="load(true)">重新加载</button></view><view v-else-if="loading" class="w-state"><text class="w-muted">正在加载…</text></view><view v-else-if="!rows.length" class="w-state"><view class="w-state__art"><k-icon name="heart" :size="33" color="#102c46"/></view><text class="w-heading">还没有这类心愿</text><text v-if="wishEnabled" class="w-muted">发起一个期待，或回应一份善意。</text><button v-if="wishEnabled" class="w-primary" @click="go(role==='publisher'?route('publish'):route('index'))">{{role==='publisher'?'发布心愿':'去帮个忙'}}</button></view><button v-else-if="hasMore" class="w-link" @click="load(false)">加载更多</button></view><w-nav active="mine"/></view></template>
<script setup>
import { wishEnabled } from '@/common/features.js'
import { ref } from 'vue'
import { onLoad,onShow,onReachBottom,onPullDownRefresh } from '@dcloudio/uni-app'
import { wishList } from '@/common/wish-api.js'
import { go } from '@/common/screen.js'
import { route } from './wish.js'
import WCard from './components/w-card.vue'
import WNav from './components/w-nav.vue'
const role=ref('publisher'),status=ref(''),rows=ref([]),error=ref(''),loading=ref(false),hasMore=ref(false)
const statuses=[{key:'',label:'全部'},{key:'pending_payment',label:'待支付'},{key:'reviewing',label:'审核中'},{key:'open',label:'待接单'},{key:'accepted',label:'进行中'},{key:'submitted',label:'待确认'},{key:'completed',label:'已完成'},{key:'disputed',label:'有争议'},{key:'refunding',label:'退款中'},{key:'cancelled',label:'已取消'}]
let page=1,version=0
async function load(reset=true){if(!reset&&loading.value)return;const rev=reset?++version:version;loading.value=true;error.value='';if(reset){page=1;rows.value=[]}try{const d=(await wishList({role:role.value,status:status.value,pageNum:page})).data;if(rev!==version)return;rows.value=reset?d.rows:[...rows.value,...d.rows];hasMore.value=d.hasMore;page++}catch(e){if(rev===version)error.value=e.message||'加载失败'}finally{if(rev===version)loading.value=false;uni.stopPullDownRefresh()}}
function setRole(value){role.value=value;status.value='';load(true)}
onLoad(q=>{role.value=q.role==='helper'?'helper':'publisher'});onShow(()=>load(true));onPullDownRefresh(()=>load(true));onReachBottom(()=>{if(hasMore.value)load(false)})
</script>
<style lang="scss">@import './wish.scss';.wm-banner{position:relative;background:#102c46;color:white;padding:24px;border-radius:23px;overflow:hidden}.wm-banner>.k-icon{position:absolute;right:25px;top:40px;transform:rotate(-12deg)}.wm-banner .w-eyebrow{color:#9dbad4;font-size:9px}.wm-links{margin-top:24px;border-top:1px solid #ffffff26;padding-top:15px;color:#e7f58a;font-size:11px}.wm-filters{width:100%;margin-bottom:20px;white-space:nowrap}.wm-filterrow{display:inline-flex;gap:8px;padding-bottom:4px}.wm-filterrow .w-pill{font-size:12px}
.wm-explain{display:block;margin:12px 0 16px;line-height:1.8}
</style>
