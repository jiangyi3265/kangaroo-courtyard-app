<template>
<k-feature-gate feature="wish">
  <view class="wish-page">
    <view class="wish-hero">
      <image class="wish-hero__photo" src="./static/wish-hero.jpg" mode="aspectFill"/>
      <view class="wish-hero__shade"/>
      <k-topbar dark bg="transparent" back custom-back title="心愿互助" :fab="false" @back="leaveSquare" />
      <view class="wish-hero__body"><text class="wish-hero__eyebrow">A LITTLE HELP, A BIG WORLD</text><text class="wish-hero__title">心愿互助</text><text class="wish-hero__copy">你的远方小事，有人顺手帮忙。</text><view class="wish-search"><view class="wish-search__input"><k-icon name="search" :size="17" color="#718095"/><input v-model="keyword" placeholder="搜索心愿" confirm-type="search" maxlength="40" @confirm="reload"/><button v-if="keyword" class="wish-search__clear" @click="keyword='';reload()">×</button></view><button class="wish-search__publish" @click="go(R.wishPublish)"><k-icon name="plus" :size="18" color="#102c46"/>发布心愿</button></view></view>
    </view>
    <view class="wish-discover">
      <view class="wish-filterbar"><view class="wish-filterbar__tabs"><view v-for="t in tabs" :key="t.key" :class="{on:filters.mode===t.key}" @click="filters.mode=t.key;reload()">{{ t.label }}</view></view><view class="w-row" @click="openFilter"><k-icon name="sliders-horizontal" :size="17" color="#102c46"/><text>筛选</text><text v-if="filterCount" class="wish-count">{{ filterCount }}</text></view></view>
      <view v-if="filters.city||filters.category" class="wish-active"><text>{{ [filters.city,filters.category?categoryText(filters.category):''].filter(Boolean).join(' · ') }}</text><button @click="filters.city='';filters.category='';reload()">清除</button></view>
      <view class="wish-discover__body">
        <view class="wish-ruleline" @click="go(route('rules'))"><k-icon name="shield-check" :size="15" color="#3166f5"/><text>跨城互助 · 费用透明 · 品类审核</text><k-icon name="chevron-right" :size="14" color="#6e8297"/></view>
        <w-card v-for="item in rows" :key="item.wishId" :item="item"/>
        <view v-if="error" class="w-state"><text>{{ error }}</text><button class="w-secondary" @click="reload">重新加载</button></view>
        <view v-else-if="loading" class="w-state"><text class="w-muted">正在寻找远方的心愿…</text></view>
        <view v-else-if="!rows.length" class="wish-empty"><view class="wish-empty__art"><view class="wish-empty__stamp"><k-icon name="send" :size="37" color="#102c46"/></view><text class="wish-empty__spark">✦</text></view><text class="w-heading">{{ filterCount || keyword ? '这里的心愿，还在路上' : '第一份心愿，从你开始' }}</text><text class="wish-empty__copy">一张异地的明信片，一件当地的手作。<br/>把小小期待交给远方的朋友。</text><button class="w-primary" @click="go(R.wishPublish)">写下我的心愿<k-icon name="arrow-up-right" :size="19" color="#e7f58a"/></button></view>
        <button v-else-if="hasMore" class="w-link" @click="load(false)">查看更多心愿</button><view v-else class="wish-end">每一份小小心愿，都值得被看见</view>
      </view>
    </view><w-nav active="square"/>
  </view>
</k-feature-gate>
</template>
<script setup>
import { communityEnabled } from "@/common/features.js"
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow, onUnload, onReachBottom, onPullDownRefresh, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { wishList } from '@/common/wish-api.js'
import { go } from '@/common/screen.js'
import R from '@/common/routes.js'
import { categoryText,route } from './wish.js'
import WCard from './components/w-card.vue'
import WNav from './components/w-nav.vue'
function leaveSquare(){ const pages=getCurrentPages(); if(pages.length>1)uni.navigateBack();else uni.reLaunch({url:communityEnabled.value?R.community:R.home}) }
const keyword=ref(''),rows=ref([]),loading=ref(false),error=ref(''),hasMore=ref(false)
const filters=reactive({city:'',category:'',mode:'',min:'',max:'',sort:'latest'})
const tabs=[{key:'',label:'发现'},{key:'paid',label:'有偿'},{key:'free',label:'免费'}]
const filterCount=computed(()=>['city','category','min','max'].filter(k=>filters[k]).length)
let page=1,revision=0
async function load(reset=true){const rev=reset?++revision:revision;if(!reset&&loading.value)return;loading.value=true;error.value='';if(reset){page=1;rows.value=[]}try{const data=(await wishList({...filters,keyword:keyword.value.trim(),pageNum:page})).data;if(rev!==revision)return;rows.value=reset?data.rows:[...rows.value,...data.rows];hasMore.value=data.hasMore;page++}catch(e){if(rev===revision)error.value=e.message||'心愿加载失败'}finally{if(rev===revision)loading.value=false;uni.stopPullDownRefresh()}}
const reload=()=>load(true)
function openFilter(){go(route('filter')+'?value='+encodeURIComponent(JSON.stringify(filters)))}
function receive(value){Object.assign(filters,value)}
onLoad(()=>uni.$on('wish:filter',receive));onUnload(()=>uni.$off('wish:filter',receive));onShow(reload);onPullDownRefresh(reload);onReachBottom(()=>{if(hasMore.value)load(false)})

const pageShareMessage = () => publicShare('/pages/wish/index', {}, '心愿互助 · 让远方的小事有人帮忙')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>
<style lang="scss">@import './wish.scss';
.wish-hero{position:relative;background:#102c46;color:white;overflow:hidden}.wish-hero__photo,.wish-hero__shade{position:absolute;width:100%;height:100%;inset:0}.wish-hero__shade{background:linear-gradient(90deg,#102c46ed 0%,#102c4650 100%)}.wish-brand{font-size:15px;font-weight:750;display:flex;align-items:center;gap:12px}.wish-brand text{font-size:11px;font-weight:400;padding-left:12px;border-left:1px solid #ffffff70}.wish-hero__body{position:relative;padding:12px 20px 34px}.wish-hero__eyebrow{font-size:9px;letter-spacing:2.1px;color:#b8d6f0}.wish-hero__title{display:block;font-size:39px;font-weight:850;letter-spacing:2px;line-height:1.4;margin:4px 0}.wish-hero__copy{font-size:13px;color:#dce9f5}.wish-search{display:flex;gap:8px;margin-top:23px}.wish-search__input{display:flex;align-items:center;gap:8px;flex:1;min-width:0;background:white;border-radius:30px;padding:0 13px;color:#102c46}.wish-search__input input{min-width:0;flex:1;font-size:12px;height:41px}.wish-search__publish{display:flex;align-items:center;justify-content:center;gap:5px;border-radius:24px;background:#e7f58a;color:#102c46;font-size:12px!important;font-weight:750;padding:11px 13px!important;flex-shrink:0}.wish-search__clear{background:transparent;padding:0;font-size:23px!important;color:#718095}.wish-discover{position:relative;margin-top:-15px;border-radius:22px 22px 0 0;background:#f5f7fa;overflow:hidden}.wish-filterbar{background:white;padding:19px 20px 15px;display:flex;justify-content:space-between;align-items:center;font-size:12px}.wish-filterbar__tabs{display:flex;gap:25px;font-size:16px;font-weight:700;color:#7c8998}.wish-filterbar__tabs>view{position:relative}.wish-filterbar__tabs .on{color:#102c46}.wish-filterbar__tabs .on:after{content:"";position:absolute;left:2px;right:2px;height:5px;bottom:-8px;background:#e7f58a;border-radius:3px}.wish-count{background:#3166f5;color:white;border-radius:50%;font-size:9px;padding:0 4px}.wish-active{padding:12px 20px;display:flex;justify-content:space-between;color:#3166f5;font-size:12px;background:#edf2ff}.wish-active button{background:transparent;font-size:11px;color:#718095;padding:0}.wish-discover__body{padding:12px 16px}.wish-ruleline{display:flex;align-items:center;gap:7px;font-size:10px;color:#73869d;padding:0 3px 14px}.wish-ruleline text{flex:1}.wish-empty{text-align:center;background:white;border:1px solid #e6ebf3;border-radius:22px;padding:24px 23px 28px;display:flex;flex-direction:column;align-items:center;gap:12px}.wish-empty__art{position:relative;height:104px;display:flex;align-items:center;justify-content:center;width:130px}.wish-empty__stamp{background:#e7f58a;border-radius:24px;width:83px;height:75px;display:flex;align-items:center;justify-content:center;transform:rotate(-10deg);box-shadow:12px 10px 0 #eaf0ff}.wish-empty__spark{position:absolute;right:5px;top:8px;color:#3166f5;font-size:30px}.wish-empty__copy{font-size:12px;line-height:1.9;color:#718095}.wish-empty .w-primary{width:100%;box-sizing:border-box;margin-top:9px;font-size:13px}.wish-end{padding:20px;text-align:center;font-size:10px;letter-spacing:1px;color:#8b98a8}
</style>
