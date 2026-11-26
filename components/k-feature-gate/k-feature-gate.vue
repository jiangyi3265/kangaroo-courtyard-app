<template>
  <slot v-if="bypass || enabled" />
  <view v-else class="k-page feature-closed" :class="{ 'user-surface': userIcons }"><k-topbar :title="title" back :fab="false"/><view class="feature-closed__body"><k-icon name="leaf" :size="42" color="green"/><text class="feature-closed__title">{{ title }}暂未开放</text><text class="feature-closed__note">{{ feature === 'recruitment' ? '已有报名的记录、履约和售后仍可处理。' : feature === 'stay-booking' ? '已有住宿订单仍可查看、取消和申请退款。' : feature === 'wish' ? '已有心愿订单仍可查看、交付和处理退款。' : '业务沟通和客服仍可使用，报名和订单不受影响。' }}</text><k-button v-if="feature === 'wish'" label="查看历史心愿订单" block type="outline" @click="orders"/><k-button v-if="feature === 'stay-booking'" label="查看历史住宿订单" block type="outline" @click="stayOrders"/><k-button label="返回首页" block @click="home"/></view></view>
</template>
<script setup>
import { useUserIcons } from '@/common/user-icons/scope.js'
import { computed, onMounted, watch } from 'vue'
import { featureState, refreshFeatures } from '@/common/features.js'
const userIcons = useUserIcons()
const props=defineProps({ feature:{type:String,required:true}, bypass:{type:Boolean,default:false} })
const enabled=computed(()=>props.feature==='recruitment'?featureState.recruitmentEnabled:props.feature==='stay-booking'?featureState.stayBookingEnabled:props.feature==='wish'?featureState.wishEnabled:props.feature==='private-chat'?featureState.privateChatEnabled:featureState.groupChatEnabled)
const title=computed(()=>props.feature==='recruitment'?'求职招聘服务':props.feature==='stay-booking'?'旅居住宿预订':props.feature==='wish'?'心愿互助':props.feature==='private-chat'?'用户私信与交友互动':'群聊与入群功能')
const stayOrders=()=>uni.redirectTo({url:'/pages/profile/orders?cat=stay'})
const home=()=>uni.reLaunch({url:'/pages/home/index'})
const orders=()=>uni.redirectTo({url:'/pages/wish/mine'})
function sharing(){
  // #ifdef MP-WEIXIN
  if(!enabled.value)uni.hideShareMenu({menus:['shareAppMessage','shareTimeline'],fail(){}})
  // #endif
}
onMounted(()=>{sharing();refreshFeatures()});watch(enabled,sharing)
</script>
<style scoped>
.feature-closed__body{padding:90px 26px 40px;display:flex;flex-direction:column;align-items:center;gap:20px;text-align:center}.feature-closed__title{font-size:20px;font-weight:600}.feature-closed__note{font-size:14px;line-height:1.8;color:var(--k-muted)}
</style>
