<template>
  <view class="k-page">
    <k-topbar title="员工入口" back custom-back @back="back" />
    <view class="k-body identity">
      <k-icon name="briefcase-business" :size="42" color="green" />
      <text class="k-title">{{ checking ? '正在确认员工权限…' : (hasStaffAccess ? '进入员工工作台' : '员工授权登录') }}</text>
      <text class="copy">员工由管理员授权。登录后自动识别所属团队与权限，直接进入工作台。</text>
      <template v-if="hasStaffAccess">
        <view v-for="grant in staffIdentities" :key="staffGrantKey(grant)" class="grant"><text>{{ grant.scopeKind === 'service-city' ? grant.city + ' · 商家申请统一处理' : (grant.storeName || (grant.city ? grant.city + (grant.roleCode === 'merchant' ? ' · 待绑定门店' : ' · 城市授权') : '已授权团队')) }}</text><k-chip tone="green">{{ grant.roleName || '员工' }}</k-chip></view>
        <k-button block :disabled="checking" @click="enterStaff">进入员工工作台</k-button>
      </template>
      <template v-else>
        <text class="status">{{ entryError || (checking ? '正在读取最新授权，请稍候。' : (experience.account ? '当前账号暂无员工授权，请联系管理员授权后刷新。' : '请使用管理员已授权的账号登录。')) }}</text>
        <!-- 管理员授权要找到这个账号：员工入口登录的新账号都叫「小院同学」、多半没绑手机号，只能靠会员编号（账号 ID） -->
        <text v-if="experience.account" class="copy" @click="copyMemberNo">会员编号：{{ experience.account.id }}（点按复制，发给管理员）</text>
        <k-button block :disabled="checking" :label="experience.account ? '刷新员工权限' : '员工登录'" @click="enterStaff" />
      </template>
      <k-button type="outline" block @click="enterUser">进入用户首页</k-button>
    </view>
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { experience, hasStaffAccess, switchMode, resolveStaffEntry, refreshAccount, staffGrantKey, staffIdentities } from '@/common/experience.js'
import { back, relaunch, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
const checking = ref(false)
const entryError = ref('')
let pageActive = true
// ?choose=1：员工从「我的」专门来选身份（含切回用户身份）。这时只刷新授权、等用户自己点，
// 不能像其他入口那样一确认有授权就直接进工作台，否则「进入用户首页」永远点不到。
let choosing = false
onLoad((q) => { choosing = q?.choose === '1' })
onUnload(() => { pageActive = false })
const enterStaff = async () => {
  if (checking.value) return
  checking.value = true
  entryError.value = ''
  try {
    const route = await resolveStaffEntry({ isCurrent: () => pageActive })
    if (pageActive && route !== R.identity) relaunch(route)
  } catch (error) {
    if (pageActive) {
      entryError.value = error?.message || '员工权限读取失败，请重试'
      toast(entryError.value)
    }
  } finally {
    checking.value = false
  }
}
// 只把最新授权读回来展示，不切换身份、不跳转
const refreshGrants = async () => {
  if (checking.value) return
  checking.value = true
  entryError.value = ''
  try {
    await refreshAccount()
  } catch (error) {
    if (pageActive) {
      entryError.value = error?.message || '员工权限读取失败，请重试'
      toast(entryError.value)
    }
  } finally {
    checking.value = false
  }
}
const copyMemberNo = () => uni.setClipboardData({ data: String(experience.account?.id || '') })
const enterUser = () => {
  pageActive = false
  relaunch(switchMode('user'))
}
onShow(() => (choosing ? refreshGrants() : enterStaff()))
</script>
<style scoped lang="scss">
.identity { display:flex; flex-direction:column; gap:20px; padding-top:36px; }.copy,.status { font-size:14px; line-height:1.8; color:var(--k-muted); }.status { padding:16px; background:var(--k-paper2); border-radius:8px; }.grant { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:16px 0; border-bottom:1px solid var(--k-line); }
</style>
