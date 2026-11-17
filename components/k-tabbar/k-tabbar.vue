<template>
  <view class="k-tabbar" :class="{ 'k-tabbar--travel': theme === 'travel', 'k-tabbar--journal': theme === 'journal' }">
    <view class="k-tabbar__row">
      <view v-for="item in items" :key="item.key" class="k-tabbar__item" :class="{ active: on === item.key, publish: item.key === 'publish' }" hover-class="k-press" @click="open(item)">
        <view v-if="item.key === 'publish'" class="k-tabbar__publish"><k-icon v-if="theme === 'journal'" name="plus" :size="26" color="white" :stroke="2.5" /><text>发布</text></view>
        <view v-else class="k-tabbar__icon">
          <k-icon :name="item.icon" :size="24" :color="theme === 'travel' ? (on === item.key ? '#0088E8' : '#172642') : (on === item.key ? 'red' : 'ink')" :stroke="1.6" :fill="on === item.key && item.fillable" />
          <text v-if="item.badge" class="k-tabbar__badge">{{ item.badge > 99 ? '99+' : item.badge }}</text>
        </view>
        <text v-if="item.key !== 'publish'" class="k-tabbar__label">{{ item.label }}</text>
      </view>
    </view>
    <view class="k-tabbar__safe" />
    <view class="k-home-indicator" />
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { communityEnabled } from '@/common/features.js'
import { unreadCount, onlineStaff, merchantService, threeTabStaff, currentStaffStore } from '@/common/experience.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

const props = defineProps({
  active: { type: String, default: 'home' },
  mode: { type: String, default: 'user' },     // user | staff
  theme: { type: String, default: '' },       // travel：岗位旅行主题；journal：日常 / 评价页的橙色发布按钮
  badge: { type: [Number, String], default: '' } // 消息角标（空则不显示）
})
const userItems = computed(() => [
  { key: 'home', label: '首页', icon: 'house', url: '/pages/home/index', fillable: true },
  ...(communityEnabled.value ? [
    { key: 'community', label: '攒局', icon: 'smile', url: '/pages/community/index' },
    { key: 'publish', label: '发布', icon: 'plus', url: '/pages/community/publish' }
  ] : []),
  { key: 'messages', label: '消息', icon: 'message-circle', url: '/pages/messages/index', badge: unreadCount.value },
  { key: 'profile', label: '我的', icon: 'user-round', url: '/pages/profile/index', fillable: true }
])
const staffItems = computed(() => [
  { key: 'work', label: threeTabStaff.value ? '首页' : '工作台', icon: 'house', url: '/pages/staff/index', fillable: true },
  ...(threeTabStaff.value ? [] : [{ key: 'business', label: onlineStaff.value ? '报名' : '业务', icon: 'briefcase-business', url: onlineStaff.value ? '/pages/staff/applications?jobType=online' : '/pages/staff/business' }]),
  ...(threeTabStaff.value || merchantService.value ? [] : [{ key: 'publish', label: '发布', icon: 'plus', url: onlineStaff.value ? '/pages/staff/online-jobs?s=1' : '/pages/staff/jobs?s=2&kind=volunteer' }]),
  { key: 'messages', label: '消息', icon: 'message-circle', url: '/pages/messages/index', badge: unreadCount.value },
  { key: 'profile', label: '我的', icon: 'user-round', url: '/pages/profile/index' }
])
// 没有「业务」格的身份：各页传 active="business" 时亮「首页」
const on = computed(() => props.mode === 'staff' && threeTabStaff.value && props.active === 'business' ? 'work' : props.active)
const items = computed(() => props.mode === 'staff' ? staffItems.value : userItems.value)
const open = (item) => {
  if (props.mode === 'staff' && item.key === 'publish' && !currentStaffStore.value?.storeId) {
    return uni.showToast({ title: '城市筹备中，开通门店后可发布', icon: 'none' })
  }
  const current = getCurrentPages().pop()
  if (item.key === 'publish') return `/${current?.route}` === item.url ? undefined : uni.navigateTo({ url: item.url })
  // 之前同一路由直接 return：在工作台的「全部待办 / 经营数据 / 任务详情」这类页内屏点底栏「工作台」没有任何反应。
  // 同一路由也 reLaunch，回到这个底栏页的首屏
  uni.reLaunch({ url: item.url })
}
</script>

<style scoped lang="scss">
/* 顶边不画硬线，用一道发丝阴影和内容分开 */
.k-tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--k-paper); box-shadow: 0 -.5px 0 rgba(58,50,43,.08), 0 -6px 18px rgba(58,50,43,.05); }
.k-tabbar__row { height: 56px; display: flex; align-items: stretch; padding: 0 6px; }
.k-tabbar__safe { height: var(--k-safe-bottom); }
.k-tabbar__item { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--k-ink2); font-size: 11px; line-height: 1; }
.k-tabbar__item.active { color: var(--k-red); font-weight: 600; }
.k-tabbar__icon { position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; }
/* 未读角标用提醒红，外圈一道纸白，压在图标上也分得清 */
.k-tabbar__badge { position: absolute; top: -5px; left: 16px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px; color: #fff; background: var(--k-alert); font-size: 10px; line-height: 16px; text-align: center; font-weight: 600; box-shadow: 0 0 0 1.5px var(--k-paper); }
/* 发布（10-16 主人定）：暖棕圆钮，「发布」写在圆里，一圈白边 + 柔和阴影，往上凸出底栏 20px，下面不再写字。
   这一格从顶上排（不居中），圆钮上沿 = 底栏上沿 - 20px；页面底部留白见 theme.scss 的 .k-pad-tab（92px），拉到底时圆钮不压内容 */
.k-tabbar__item.publish { justify-content: flex-start; }
.k-tabbar__publish { width: 64px; height: 64px; margin-top: -20px; border: 4px solid var(--k-paper); border-radius: 50%; background: var(--k-grad-brown); box-shadow: 0 5px 15px rgba(154,107,63,.24); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 500; }
.k-tabbar--travel .k-tabbar__item { color: #172642; }
.k-tabbar--travel .k-tabbar__item.active { color: #0063AC; }
.k-tabbar--travel .k-tabbar__publish { background: linear-gradient(145deg, #FF943C, #FF6D25); box-shadow: 0 4px 12px rgba(255,120,39,.18); font-weight: 600; }
.k-tabbar--journal .k-tabbar__publish { background: linear-gradient(145deg, #FFB052, #F28A28); flex-direction: column; gap: 1px; font-size: 12px; line-height: 16px; box-shadow: 0 4px 12px rgba(234,140,45,.2); }
</style>
