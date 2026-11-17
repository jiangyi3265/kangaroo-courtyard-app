<template>
  <view class="k-page pending-work">
    <k-topbar title="员工工作台" />
    <view class="k-body k-pad-tab">
      <view class="scope-card">
        <view class="scope-title"><k-icon name="map-pin" :size="20" color="ochre" /><text>{{ grant?.city || '授权城市' }}</text><text class="scope-state">{{ merchant ? '待绑定门店' : '城市授权' }}</text></view>
        <text class="person">{{ experience.account?.nickname || '当前负责人' }}</text>
        <text class="role">{{ grant?.roleName || '员工' }}</text>
      </view>
      <view class="prepare-card">
        <view class="prepare-icon"><k-icon name="store" :size="32" color="ochre" /></view>
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
          <k-icon :name="String(staffGrantKey(item)) === String(staffGrantKey(grant)) ? 'check' : 'chevron-right'" :size="19" color="ochre" />
        </view>
      </view>
      <view class="personal-links"><view @click="go(R.messages)"><k-icon name="message-square" :size="21" color="ochre" /><text>查看消息</text></view><view @click="go(R.profile)"><k-icon name="user" :size="21" color="ochre" /><text>个人资料</text></view></view>
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
.pending-work{color:var(--k-ink)}.scope-card,.prepare-card,.scope-list{background:var(--k-paper);border:1px solid var(--k-line);border-radius:16px;margin-top:16px;padding:20px}.scope-title{display:flex;align-items:center;gap:8px;font-size:14px}.scope-state{margin-left:auto;padding:4px 9px;border-radius:20px;background:var(--k-red-soft);font-size:11px;color:var(--k-ochre-deep)}.person{display:block;font-size:22px;font-weight:700;margin-top:18px;overflow-wrap:anywhere}.role{display:block;color:var(--k-muted);font-size:13px;margin-top:6px}.prepare-icon{display:flex;align-items:center;justify-content:center;width:64px;height:64px;background:var(--k-red-soft);border-radius:20px;margin-bottom:18px}.prepare-title{display:block;font-size:18px;font-weight:700}.prepare-copy{display:block;font-size:14px;line-height:1.8;color:var(--k-muted);margin:12px 0 22px}.section-title{font-size:15px;font-weight:700}.scope-row{display:flex;align-items:center;gap:12px;padding:16px 0;border-bottom:1px solid var(--k-line2)}.scope-row:last-child{border-bottom:0;padding-bottom:0}.scope-row-copy{min-width:0;flex:1}.scope-row-copy text{display:block;font-size:14px;overflow-wrap:anywhere}.scope-row-copy text+text{color:var(--k-muted);font-size:12px;margin-top:5px}.personal-links{display:flex;gap:12px;margin:20px 0}.personal-links>view{display:flex;align-items:center;justify-content:center;gap:8px;flex:1;padding:14px 0;font-size:14px;border:1px solid var(--k-line);border-radius:12px}
</style>
