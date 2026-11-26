<template>
  <view class="k-page pending-work">
    <k-topbar title="员工工作台" />
    <view class="k-body k-pad-tab">
      <view class="scope-card">
        <view class="scope-title"><k-icon name="map-pin" :size="16" color="ochre" /><text>{{ grant?.city || '授权城市' }}</text><text class="scope-state">{{ merchant ? '待绑定门店' : '城市授权' }}</text></view>
        <text class="person">{{ experience.account?.nickname || '当前负责人' }}</text>
        <text class="role">{{ grant?.roleName || '员工' }}</text>
      </view>
      <view class="prepare-card">
        <view class="prepare-icon"><k-icon name="store" :size="24" color="ochre" /></view>
        <text class="prepare-title">{{ merchant ? '门店绑定后即可开展业务' : '工作身份已开通' }}</text>
        <text class="prepare-copy">{{ merchant ? '请联系平台关联你的门店。绑定前可查看消息、完善个人资料。' : '本城还没有开通门店。门店开通后，刷新授权并选择可管理门店，即可按当前角色开展工作；平台派来的管理员任务现在就能处理。' }}</text>
        <k-button block :disabled="refreshing" :label="refreshing ? '正在刷新…' : '刷新授权'" @click="refresh" />
      </view>
      <!-- 本城还没有门店也能被派管理员任务（合作商家不算员工，不显示） -->
      <k-task-entry v-if="hasTasks" />
      <view v-if="staffIdentities.length > 1" class="scope-list">
        <text class="section-title">切换工作范围</text>
        <view v-for="item in staffIdentities" :key="staffGrantKey(item)" class="scope-row" hover-class="k-press" @click="choose(item)">
          <view class="scope-row-copy"><text>{{ staffIdentityLabel(item) }}</text><text>{{ item.roleName || '员工' }} · {{ item.storeId ? '门店已开通' : (item.roleCode === 'merchant' ? '待绑定门店' : '城市授权') }}</text></view>
          <k-icon :name="String(staffGrantKey(item)) === String(staffGrantKey(grant)) ? 'check' : 'chevron-right'" :size="14" color="red" />
        </view>
      </view>
      <view class="personal-links"><view hover-class="k-press-s" @click="go(R.messages)"><k-icon name="message-square" :size="18" color="ink2" /><text>查看消息</text></view><view hover-class="k-press-s" @click="go(R.profile)"><k-icon name="user" :size="18" color="ink2" /><text>个人资料</text></view></view>
    </view>
    <k-tabbar active="work" mode="staff" />
  </view>
</template>
<script setup>
import { computed, ref } from 'vue'
import { experience, currentStaffStore, staffIdentities, staffIdentityLabel, staffGrantKey, refreshAccount, selectStaffStore, hasStaffAccess } from '@/common/experience.js'
import { go, relaunch, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
import { hasStaffTaskRole } from '@/common/staff-task-reminder.js'
import KTaskEntry from './k-task-entry.vue'
const grant = currentStaffStore
const merchant = computed(() => grant.value?.roleCode === 'merchant')
const hasTasks = computed(() => hasStaffTaskRole(experience.account?.staffGrants))
const refreshing = ref(false)
async function refresh() {
  if (refreshing.value) return
  refreshing.value = true
  try { await refreshAccount(); if (!hasStaffAccess.value) relaunch(R.identity); else toast('授权已刷新') }
  catch (e) { toast(e?.message || '刷新失败，请重试') }
  finally { refreshing.value = false }
}
async function choose(item) {
  if (refreshing.value) return
  refreshing.value = true
  try { await refreshAccount(); await selectStaffStore(item); relaunch(R.staff) }
  catch (e) { toast(e?.message || '切换失败，请刷新授权') }
  finally { refreshing.value = false }
}
</script>
<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边），字号收一档；内容和按钮不变（共用写法在 ../work-lite.scss） */
@import '../work-lite.scss';
.pending-work{color:var(--k-ink);@include lite-page}
.scope-card,.prepare-card,.scope-list{background:var(--k-paper);border:0;border-radius:12px;margin-top:8px;padding:14px 12px}
.scope-card{margin-top:0}
.scope-title{display:flex;align-items:center;gap:6px;font-size:13px}
.scope-state{margin-left:auto;@include lite-tag;background:var(--k-ochre-soft);color:var(--k-ochre-deep)}
/* 11-18 第二轮精修：名字和其他工作台的身份卡统一 17 / 700 / 行高 24 */
.person{display:block;font-size:17px;font-weight:700;line-height:24px;margin-top:10px;overflow-wrap:anywhere}
.role{display:block;color:var(--k-muted);font-size:12px;margin-top:2px}
.prepare-icon{display:flex;align-items:center;justify-content:center;width:46px;height:46px;background:linear-gradient(145deg,#FCF4E8,#F4E4CC);border-radius:12px;margin-bottom:12px}
.prepare-title{display:block;font-size:16px;font-weight:700}
.prepare-copy{display:block;font-size:13px;line-height:1.7;color:var(--k-muted);margin:8px 0 16px}
.section-title{display:block;font-family:var(--k-sans);font-size:16px;font-weight:700;line-height:22px;color:var(--k-ink)}
.scope-row{position:relative;display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 0}
.scope-row:last-child{padding-bottom:0}
/* 行间发丝线（卡片本身有 12 内边距，线从内容左边起），最后一行没有线 */
.scope-row + .scope-row::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.scope-row-copy{min-width:0;flex:1}
.scope-row-copy text{display:block;font-size:14px;font-weight:600;overflow-wrap:anywhere}
.scope-row-copy text+text{color:var(--k-muted);font-size:12px;font-weight:400;margin-top:2px}
.personal-links{display:flex;gap:8px;margin:8px 0 12px}
.personal-links>view{display:flex;align-items:center;justify-content:center;gap:6px;flex:1;min-height:44px;font-size:13px;border:0;border-radius:12px;background:var(--k-paper)}
</style>
