<template>
  <view class="k-page">
    <k-topbar title="员工入口" back custom-back @back="back" />
    <view class="k-body identity">
      <view class="badge"><k-icon name="briefcase-business" :size="28" color="red" /></view>
      <text class="k-title">{{ checking ? '正在确认员工权限…' : (hasStaffAccess ? '进入员工工作台' : '员工授权登录') }}</text>
      <view class="copy"><text>员工由管理员授权。</text><text>登录后自动识别所属团队与权限，直接进入工作台。</text></view>
      <template v-if="hasStaffAccess">
        <view v-for="grant in staffIdentities" :key="staffGrantKey(grant)" class="grant"><text>{{ grant.scopeKind === 'service-city' ? grant.city + ' · 商家申请统一处理' : (grant.storeName || (grant.city ? grant.city + (grant.roleCode === 'merchant' ? ' · 待绑定门店' : ' · 城市授权') : '已授权团队')) }}</text><k-chip tone="green">{{ grant.roleName || '员工' }}</k-chip></view>
      </template>
      <template v-else>
        <view class="status-card">
          <view class="status"><k-icon name="info" :size="16" color="muted" /><text>{{ entryError || (checking ? '正在读取最新授权，请稍候。' : (experience.account ? '当前账号暂无员工授权，请联系管理员授权后刷新。' : '请使用管理员已授权的账号登录。')) }}</text></view>
          <!-- 管理员授权要找到这个账号：员工入口登录的新账号都叫「小院同学」、多半没绑手机号，只能靠会员编号（账号 ID） -->
          <view v-if="experience.account" class="member" hover-class="k-press" @click="copyMemberNo"><view class="k-flex1"><text>会员编号：{{ experience.account.id }}</text><text class="member__tip">（点按复制，发给管理员）</text></view><k-icon name="copy" :size="14" color="red" /></view>
        </view>
      </template>
      <k-bottom flat pad="8px 16px"><view class="acts">
        <k-button type="secondary" @click="enterUser">进入用户首页</k-button>
        <k-button v-if="hasStaffAccess" block :disabled="checking" @click="enterStaff">进入员工工作台</k-button>
        <k-button v-else block :disabled="checking" :label="experience.account ? '刷新员工权限' : '员工登录'" @click="enterStaff" />
      </view></k-bottom>
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
.k-page{--k-bg:var(--k-page);display:flex;flex-direction:column}.identity{display:flex;flex-direction:column;gap:12px;padding:48px 16px calc(76px + var(--k-safe-bottom))}.k-page :deep(.k-bottom){box-shadow:0 -.5px 0 rgba(58,50,43,.1)}.badge{width:56px;height:56px;border-radius:16px;align-self:center;background:var(--k-red-soft);display:flex;align-items:center;justify-content:center;margin-bottom:4px}
.acts{flex:1;display:flex;gap:12px}.acts :deep(.k-button){height:44px;border-radius:22px;font-size:15px}.acts :deep(.is-secondary){flex:0 0 120px;padding:0;color:var(--k-red-deep)}.acts :deep(.is-primary){flex:1;width:auto}
.identity .k-title{text-align:center;font-size:22px;line-height:30px}.copy{margin-top:-4px;display:flex;flex-direction:column;align-items:center;font-size:13px;line-height:1.6;color:var(--k-muted);text-align:center}.status-card{margin:12px 0 0;border-radius:12px;background:var(--k-paper)}.status{display:flex;align-items:flex-start;gap:6px;padding:16px;font-size:13px;line-height:1.6;color:var(--k-ink2)}.status .k-icon{flex:none;margin-top:2px}.member__tip{display:block;text-indent:-.5em;font-size:12px;font-weight:400;color:var(--k-muted)}.member{position:relative;padding:12px 16px;display:flex;align-items:center;gap:8px;font-size:14px;line-height:1.5;font-weight:500;color:var(--k-red-deep)}.member::before{content:'';position:absolute;left:16px;right:16px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}.grant{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px;border-radius:12px;background:var(--k-paper);font-size:14px}.grant :deep(.k-chip){border-radius:4px;background:var(--k-red-soft);color:var(--k-red-deep)}
@media(max-width:359px){.copy,.status{font-size:12px}.acts :deep(.is-secondary){flex-basis:112px;font-size:14px}}
</style>
