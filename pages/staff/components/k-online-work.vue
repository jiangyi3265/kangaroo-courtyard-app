<template>
  <view class="k-page online-work">
    <k-topbar title="线上任务工作台" />
    <view class="k-body k-pad-tab">
      <button class="store" @click="switchStore"><view><text class="k-meta">线上任务专员</text><text class="store-name">{{ identity.name }}</text><text v-if="identity.scope" class="k-meta">{{ identity.scope }}</text></view><k-icon v-if="staffIdentities.length > 1" name="chevron-down" :size="20" /></button>
      <!-- 主人 2026-11-03：任务能发给全体员工、按岗位发，这个岗位也会收到管理员任务 -->
      <k-task-entry />
      <view class="actions">
        <button @click="openApplications('submitted')"><k-icon name="clipboard-check" :size="25" color="red" /><text>审核报名</text><text class="k-meta">{{ pending == null ? '查看待审核' : pending + ' 份待审核' }}</text></button>
        <button @click="go(R.messages)"><k-icon name="message-circle" :size="25" color="green" /><text>回复消息</text><text class="k-meta">线上任务沟通</text></button>
        <!-- 2026-10 起专员可以发布本店线上任务：先交平台审核，服务端同时通知本店负责付款的人 -->
        <button v-if="recruitmentEnabled" @click="go(R.staffOnline + '?s=1')"><k-icon name="square-plus" :size="25" color="ochre" /><text>发布任务</text><text class="k-meta">提交平台审核</text></button>
      </view>
      <view class="heading"><text>任务与成果</text><button class="link" @click="load">刷新</button></view>
      <view class="filters"><button :class="{active: waitingOnly}" @click="waitingOnly=true">待验收 {{ waiting }}</button><button :class="{active: !waitingOnly}" @click="waitingOnly=false">全部任务 {{ tasks.length }}</button></view>
      <view v-if="loading" class="state">正在读取线上任务…</view>
      <view v-else-if="error" class="state"><text>{{ error }}</text><button class="link" @click="load">重新加载</button></view>
      <view v-else-if="!visibleTasks.length" class="state">{{ waitingOnly ? '当前没有待验收的成果' : '当前门店暂无线上任务' }}</view>
      <button v-for="task in visibleTasks" :key="task.jobId" class="task" @click="openTask(task)"><view><text class="task-title">{{ task.title }}</text><text class="k-meta">{{ task.statusLabel }} · {{ task.applied || 0 }} 人报名</text></view><view class="task-side"><text :class="Number(task.waiting) ? 'k-alert' : 'k-meta'">{{ Number(task.waiting) ? task.waiting + ' 份待验收' : '查看任务' }}</text><k-icon name="chevron-right" :size="18" /></view></button>
      <text v-if="recruitmentEnabled" class="note">发布的任务经平台审核后上线；验收通过后按结算流程处理。</text>
    </view>
    <k-tabbar mode="staff" active="work" />
  </view>
</template>
<script setup>
import { recruitmentEnabled } from '@/common/features.js'
// 线上任务专员的工作台（pages/staff/index 与 business 显式引入）。放在 staff 分包里，不走全局 easycom，不占主包
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { experience, currentStaffStore, staffIdentities, staffIdentityLabel, selectStaffStore, ensureSession, getSessionRevision } from '@/common/experience.js'
import { apiOnlineTasks, apiStaffApplications } from '@/common/api.js'
import { go, toast } from '@/common/screen.js'
import { pickPaged } from '@/common/ui.js'
import R from '@/common/routes.js'
import KTaskEntry from './k-task-entry.vue'
import { workIdentity } from '../work-identity.js'
const identity = computed(() => workIdentity(experience.account, currentStaffStore.value))
const tasks = ref([]), pending = ref(null), loading = ref(false), error = ref(''), waitingOnly = ref(true)
let seq = 0
const waiting = computed(() => tasks.value.reduce((n, t) => n + Number(t.waiting || 0), 0))
const visibleTasks = computed(() => tasks.value.filter(t => !waitingOnly.value || Number(t.waiting) > 0))
async function load() {
  const id = ++seq
  await ensureSession()
  const store = currentStaffStore.value?.storeId, session = getSessionRevision()
  const current = () => id === seq && store === currentStaffStore.value?.storeId && session === getSessionRevision()
  if (!store) return
  loading.value = true; error.value = ''; tasks.value = []; pending.value = null
  try {
    const [jobs, applications] = await Promise.all([apiOnlineTasks(store), apiStaffApplications({storeId: store, jobType: 'online', status: 'submitted', pageSize: 1})])
    if (!current()) return
    tasks.value = jobs.data || []; pending.value = applications.total || 0
  } catch (e) { if (current()) error.value = e?.message || '加载失败，请重试' }
  finally { if (current()) loading.value = false }
}
async function switchStore() {
  if (staffIdentities.value.length < 2) return toast('当前只有一个工作身份')
  const choices = staffIdentities.value.slice()
  const i = await pickPaged(choices.map(staffIdentityLabel), '选择工作身份')
  if (i < 0) return
  await selectStaffStore(choices[i])
  uni.reLaunch({url: R.staff})
}
const openApplications = () => go(R.staffApplications + '?jobType=online&status=submitted&storeId=' + currentStaffStore.value.storeId)
// 2026-11-03 主人：简化 —— 点任务卡直接进那条任务的详情，接单人一人一行列在详情里、点行进交付页；进去不再弹接单人列表
const openTask = (task) => go(R.staffOnline + '?jobId=' + task.jobId)
watch(() => currentStaffStore.value?.storeId, load)
onMounted(load)
onShow(load)
onBeforeUnmount(() => { seq++ })
</script>
<style scoped>
.online-work button{margin:0;font-size:15px;line-height:1.5;color:var(--k-ink);background:var(--k-paper);text-align:left}
.online-work button::after{border:none}.store{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--k-line);border-radius:12px;padding:16px;gap:12px}.store>view{display:flex;flex-direction:column;gap:8px;min-width:0}.store-name{font-size:19px;font-weight:700}.actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0 24px}.actions button{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-height:124px;padding:16px 12px;border:1px solid var(--k-line);border-radius:12px}.heading{display:flex;justify-content:space-between;align-items:center;font-size:19px;font-weight:700}.online-work .link{padding:10px 8px;background:transparent;color:var(--k-red);font-size:14px}.filters{display:flex;gap:10px;margin:12px 0}.filters button{padding:9px 14px;border:1px solid var(--k-line);border-radius:22px;font-size:14px}.filters .active{color:var(--k-red);border-color:var(--k-red)}.task{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:90px;padding:16px 12px;border-bottom:1px solid var(--k-line)}.task>view:first-child{display:flex;flex-direction:column;gap:8px;min-width:0}.task-title{font-weight:600;overflow-wrap:anywhere}.task-side{display:flex;align-items:center;gap:4px;flex-shrink:0;font-size:13px}.state{min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--k-muted);font-size:14px}.note{display:block;color:var(--k-muted);font-size:12px;line-height:1.7;margin-top:20px}.k-meta{line-height:1.6}
/* 三张卡片的副标题只占一行：窄屏（320 起）原先会把最后一个字挤到第二行，这里收窄间距和内边距、字小一号 */
.actions .k-meta{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:359px){.actions{gap:8px}.actions button{padding:16px 8px}.actions .k-meta{font-size:11px}}
</style>
