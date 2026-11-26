<template>
  <slot v-if="bypass || communityEnabled" />
  <view v-else class="k-page community-closed" :class="{ 'user-surface': userIcons }">
    <k-topbar title="社区" back />
    <view class="community-closed__body"><k-icon name="leaf" :size="46" color="green" /><text class="community-closed__title">社区内容功能暂未开放</text><text class="community-closed__note">你可以先浏览岗位、旅居和门店服务。</text><k-button label="返回首页" block @click="home" /></view>
  </view>
</template>
<script setup>
import { useUserIcons } from '@/common/user-icons/scope.js'
import { onMounted, watch } from 'vue'
import { communityEnabled, communityPage, refreshFeatures } from '@/common/features.js'
const userIcons = useUserIcons()
defineProps({ bypass: { type: Boolean, default: false } })
const home = () => uni.reLaunch({ url: '/pages/home/index' })
function hideSharing() {
  if (!communityEnabled.value && communityPage(getCurrentPages().pop()?.route)) {
    // #ifdef MP-WEIXIN
    uni.hideShareMenu({ menus: ['shareAppMessage','shareTimeline'], fail() {} })
    // #endif
  }
}
onMounted(() => { hideSharing(); refreshFeatures() })
watch(communityEnabled, hideSharing)
</script>
<style scoped>
.community-closed__body { padding: 100px 28px 40px; display: flex; flex-direction: column; align-items: center; gap: 20px; text-align: center; }
.community-closed__title { font-size: 20px; font-weight: 600; }
.community-closed__note { color: var(--k-muted); font-size: 14px; line-height: 1.7; margin-bottom: 12px; }
</style>
