<template>
  <view class="k-tabbar">
    <view class="k-tabbar__row">
      <view v-for="item in items" :key="item.key" class="k-tabbar__item" :class="{ active: active === item.key, publish: item.key === 'publish' }" @click="open(item)">
        <view v-if="item.key === 'publish'" class="k-tabbar__publish"><k-icon name="plus" :size="26" color="white" :stroke="2.2" /></view>
        <view v-else class="k-tabbar__icon">
          <k-icon :name="item.icon" :size="24" :color="active === item.key ? 'red' : 'ink'" :stroke="1.6" :fill="active === item.key && item.fillable" />
          <text v-if="item.badge" class="k-tabbar__badge">{{ item.badge }}</text>
        </view>
        <text class="k-tabbar__label">{{ item.label }}</text>
      </view>
    </view>
    <view class="k-tabbar__safe" />
    <view class="k-home-indicator" />
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { unreadCount } from '@/common/experience.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

const props = defineProps({
  active: { type: String, default: 'home' },
  mode: { type: String, default: 'user' },     // user | staff
  badge: { type: [Number, String], default: '' } // 消息角标（空则不显示）
})
const userItems = computed(() => [
  { key: 'home', label: '首页', icon: 'house', url: '/pages/home/index', fillable: true },
  { key: 'community', label: '社区', icon: 'compass', url: '/pages/community/index' },
  { key: 'publish', label: '发布', icon: 'plus', url: '/pages/community/publish' },
  { key: 'messages', label: '消息', icon: 'message-circle', url: '/pages/messages/index', badge: unreadCount.value },
  { key: 'profile', label: '我的', icon: 'user-round', url: '/pages/profile/index' }
])
const staffItems = computed(() => [
  { key: 'work', label: '工作台', icon: 'house', url: '/pages/staff/index', fillable: true },
  { key: 'business', label: '业务', icon: 'briefcase-business', url: '/pages/staff/business' },
  { key: 'messages', label: '消息', icon: 'message-circle', url: '/pages/messages/index', badge: unreadCount.value },
  { key: 'profile', label: '我的', icon: 'user-round', url: '/pages/profile/index' }
])
const items = computed(() => props.mode === 'staff' ? staffItems.value : userItems.value)
const open = (item) => {
  const current = getCurrentPages().pop()
  if (`/${current?.route}` === item.url) return
  if (item.key === 'publish') return uni.navigateTo({ url: item.url })
  uni.reLaunch({ url: item.url })
}
</script>

<style scoped lang="scss">
.k-tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: var(--k-paper); border-top: 1px solid var(--k-line); }
.k-tabbar__row { height: 56px; display: flex; align-items: stretch; padding: 0 6px; }
.k-tabbar__safe { height: var(--k-safe-bottom); }
.k-tabbar__item { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: var(--k-ink); font-size: 11px; line-height: 1; }
.k-tabbar__item.active { color: var(--k-red); }
.k-tabbar__icon { position: relative; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; }
.k-tabbar__badge { position: absolute; top: -7px; left: 16px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; color: #fff; background: var(--k-red); font-size: 10px; line-height: 17px; text-align: center; font-weight: 600; }
.k-tabbar__publish { width: 48px; height: 48px; margin-top: -22px; margin-bottom: 2px; border-radius: 50%; background: var(--k-red); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(169,71,52,.28); }
.k-tabbar__label { font-size: 11px; }
</style>
