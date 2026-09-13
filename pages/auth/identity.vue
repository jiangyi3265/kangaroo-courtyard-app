<template>
  <view class="k-page">
    <k-topbar title="员工入口" back @back="back" />
    <view class="k-body identity">
      <k-icon name="briefcase-business" :size="42" color="green" />
      <text class="k-title">{{ hasStaffAccess ? '进入员工工作台' : '员工授权登录' }}</text>
      <text class="copy">员工由管理员授权。登录后自动识别所属团队与权限，直接进入工作台。</text>
      <template v-if="hasStaffAccess">
        <view v-for="grant in activeGrants" :key="grant.id" class="grant"><text>{{ grant.storeName || '已授权团队' }}</text><k-chip tone="green">{{ grant.roleName || '员工' }}</k-chip></view>
        <k-button block @click="enterStaff">进入员工工作台</k-button>
      </template>
      <template v-else>
        <text class="status">{{ experience.account ? '当前账号暂无员工授权，请联系管理员绑定后重新登录。' : '请使用管理员已授权的微信账号登录。' }}</text>
        <k-button block @click="go(R.login + '?entry=staff')">员工登录</k-button>
      </template>
      <k-button type="outline" block @click="enterUser">进入用户首页</k-button>
    </view>
  </view>
</template>
<script setup>
import { computed } from 'vue'
import { experience, hasStaffAccess, switchMode } from '@/common/experience.js'
import { back, go, relaunch } from '@/common/screen.js'
import R from '@/common/routes.js'
const activeGrants = computed(() => experience.account?.staffGrants?.filter(g => g.active === true) || [])
const enterStaff = () => relaunch(switchMode('staff'))
const enterUser = () => relaunch(switchMode('user'))
</script>
<style scoped lang="scss">
.identity { display:flex; flex-direction:column; gap:20px; padding-top:36px; }.copy,.status { font-size:14px; line-height:1.8; color:var(--k-muted); }.status { padding:16px; background:var(--k-paper2); border-radius:8px; }.grant { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:16px 0; border-bottom:1px solid var(--k-line); }
</style>
