<template>
  <view class="k-page service-work">
    <k-topbar :title="activeTab === 'business' ? '我的业务' : '商家服务工作台'" />
    <view class="k-body k-pad-tab">
      <view class="req-store" hover-class="k-press-s" @click="switchStore"><view class="req-store__copy"><text class="req-store__eyebrow">商家服务人</text><text class="req-store__name">{{ identity.name }}</text><text class="identity-scope">{{ serviceCity ? serviceCity + ' · ' : '' }}商家申请统一处理</text><text class="identity-scope">在这里接收和处理本城商家申请，无需逐店切换身份</text></view><k-icon v-if="staffIdentities.length > 1" name="chevron-down" :size="20" /></view>
      <!-- 主人 2026-11-03：任务能发给全体员工、按岗位发，这个岗位也会收到管理员任务 -->
      <k-task-entry />
      <!-- 主人 2026-11-03：和小院主理人工作台一个样子——上面「优先处理」，下面「快捷入口」一个项目一个按钮，有待办的右上角红色数字 -->
      <view v-if="error" class="sw-error" hover-class="k-press" @click="load"><text>{{ error }}</text><text>点击重试</text></view>
      <template v-if="board.priority.length">
        <view class="req-heading"><text>优先处理</text></view>
        <view class="sw-card">
          <view v-for="(it, i) in board.priority" :key="it.key + it.title" class="sw-prio" :class="{ line: i < board.priority.length - 1 }" hover-class="k-press" @click="open(it.key)">
            <view class="k-circle sw-prio__icon" :class="'k-circle--' + it.tone"><k-icon :name="it.icon" :size="22" color="white" :stroke="2" /></view>
            <view class="sw-prio__copy"><view class="sw-prio__row"><text class="sw-prio__num">{{ it.num }}</text><text class="sw-prio__title">{{ it.title }}</text></view><text class="sw-prio__sub">{{ it.sub }}</text></view>
            <view class="sw-go"><text>去处理</text></view>
          </view>
        </view>
      </template>
      <view v-else-if="loaded && !error" class="sw-calm"><k-icon name="circle-check" :size="18" color="green" /><text>现在没有要马上处理的事</text></view>
      <view class="req-heading"><text>快捷入口</text></view>
      <view class="sw-quick">
        <view v-for="q in board.quick" :key="q.key" class="sw-quick__item" hover-class="k-press-s" @click="open(q.key)">
          <view class="sw-quick__icon"><k-icon :name="q.icon" :size="30" :color="q.color" :stroke="1.5" /><text v-if="q.badge" class="sw-quick__badge">{{ q.badge }}</text></view>
          <text class="sw-quick__label">{{ q.label }}</text>
        </view>
      </view>
    </view>
    <k-tabbar mode="staff" :active="activeTab" />
  </view>
</template>

<script setup>
// 商家服务人的工作台（pages/staff/index 与 business 显式引入）。放在 staff 分包里，不走全局 easycom，不占主包
// 主人 2026-11-03：原来三个大数字 + 混在一起的待接手列表 + 一段说明（说明里的「任务页」主人找不到）全去掉，改成和小院主理人一样的「优先处理」+「快捷入口」：
//   线上任务管理（就是说明里的「任务页」：接单、验收、付款登记）、线上任务需求、代运营、抖音卖房、待审核活动、招募概况，一个一格，有待办的格子右上角出红色数字。
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { get } from '@/common/request.js'
import { experience, currentStaffStore, staffIdentities, staffIdentityLabel, staffGrantKey, selectStaffStore, ensureSession, getSessionRevision, refreshAccount, staffStoreUrl } from '@/common/experience.js'
import { go, toast } from '@/common/screen.js'
import { pickPaged, errText } from '@/common/ui.js'
import R from '@/common/routes.js'
import KTaskEntry from './k-task-entry.vue'
import { workIdentity } from '../work-identity.js'
import { SERVICE_API, SERVICE_PAGE, SERVICE_ACTIVITIES_API, SERVICE_ACTIVITIES_PAGE, ONLINE_DAILY_API, ONLINE_DAILY_PAGE, REQUEST_KINDS, MANAGE_TABS, canManageRow, taskTodos, serviceWorkbench } from '../request-view.js'

defineProps({ activeTab: { type: String, default: 'work' } })
const counts = ref({}), first = ref({}), city = ref(''), loading = ref(false), loaded = ref(false), error = ref('')
const board = computed(() => serviceWorkbench(counts.value, first.value))
const identity = computed(() => workIdentity(experience.account, currentStaffStore.value))
const serviceCity = computed(() => currentStaffStore.value?.city || city.value)
let seq = 0
async function load() {
  const id = ++seq
  await ensureSession()
  const store = currentStaffStore.value?.storeId, session = getSessionRevision()
  const current = () => id === seq && store === currentStaffStore.value?.storeId && session === getSessionRevision()
  if (!store || currentStaffStore.value?.roleCode !== 'merchant_service') return
  loading.value = true
  error.value = ''
  const list = (params) => get(SERVICE_API, { storeId: store, ...params })
  try {
    const [kinds, audit, mine, daily] = await Promise.all([
      Promise.all(REQUEST_KINDS.map(k => list({ type: k.type, status: 'forwarded', pageSize: 1 }))),
      // 活动、线上任务的数读不出来只是不出红点，不连累上面三类需求
      get(SERVICE_ACTIVITIES_API, { storeId: store, status: 'pending', pageSize: 1 }).catch(() => null),
      Promise.all(MANAGE_TABS.map(t => list({ type: 'online_task', status: t.status, pageSize: 50 }))).catch(() => null),
      get(ONLINE_DAILY_API, { storeId: store }).catch(() => null)
    ])
    if (!current()) return
    const c = {}, f = {}
    REQUEST_KINDS.forEach((k, i) => { c[k.type] = Number(kinds[i].data?.total) || 0; f[k.type] = (kinds[i].data?.rows || [])[0] })
    c.audit = audit ? Number(audit.data?.total) || 0 : null
    f.audit = audit ? (audit.data?.rows || [])[0] : null
    // 他接手、已上架的线上任务里，待审核的报名和待验收的成果（按任务从线上任务概况里取）
    if (mine && daily) {
      const jobIds = mine.flatMap(r => r.data?.rows || []).filter(canManageRow).map(r => r.jobId)
      const todo = taskTodos(daily.data?.tasks, jobIds)
      c.toReview = todo.toReview
      c.toAccept = todo.toAccept
    }
    city.value = kinds[0].data?.city || ''
    counts.value = c
    first.value = f
    loaded.value = true
  } catch (e) {
    if (current()) { error.value = errText(e, '加载失败，请重试'); counts.value = {}; first.value = {} }
  } finally {
    if (current()) loading.value = false
  }
}
// 每个格子去哪：线上任务管理是商家需求页的「管理」屏；三类需求进商家需求页对应的项目（默认待接手）
function open(key) {
  if (key === 'manage') return go(SERVICE_PAGE + '?manage=1')
  if (key === 'audit') return go(staffStoreUrl(SERVICE_ACTIVITIES_PAGE))
  if (key === 'daily') return go(staffStoreUrl(ONLINE_DAILY_PAGE))
  go(SERVICE_PAGE + '?type=' + key + '&status=forwarded')
}
async function switchStore() {
  // 转发时系统会补新门店的授权，本机的门店清单可能是旧的：先核对一次，没网也不拦，用手上这份
  try { await refreshAccount() } catch (e) { /* 用本机的门店清单 */ }
  const choices = staffIdentities.value.slice()
  if (choices.length < 2) return toast('当前身份已统一处理本城商家申请')
  const i = await pickPaged(choices.map(staffIdentityLabel), '选择工作身份')
  if (i < 0) return
  await selectStaffStore(choices[i])
  uni.reLaunch({ url: R.staff })
}
watch(() => staffGrantKey(currentStaffStore.value), load)
onMounted(load)
onShow(load)
onBeforeUnmount(() => { seq++ })
</script>

<style scoped lang="scss">
@import '../request-pages.scss';
.identity-scope{display:block;margin-top:6px;font-size:12px;line-height:1.5;color:var(--k-muted);overflow-wrap:anywhere}
/* 和小院主理人工作台（pages/staff/index.vue 的 .prio / .go-btn / .quick）同一个样子；格子三列，六个正好两排，字比那边大一号，年纪大的店员也看得清 */
.sw-error { display: flex; justify-content: space-between; gap: 10px; margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 13px; line-height: 1.6; }
.sw-calm { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: var(--k-paper); font-size: 14px; color: var(--k-ink2); }
.sw-card { border-radius: 14px; background: var(--k-paper); box-shadow: 0 6px 20px rgba(58,50,43,.08); overflow: hidden; }
.sw-prio { display: flex; align-items: center; gap: 12px; padding: 12px; }
.sw-prio.line { border-bottom: 1px solid var(--k-line); }
.sw-prio__icon { width: 40px; height: 40px; }
.sw-prio__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.sw-prio__row { display: flex; align-items: baseline; gap: 4px; }
.sw-prio__num { font-size: 16px; font-weight: 700; color: var(--k-red); }
.sw-prio__title { font-size: 15px; font-weight: 600; color: var(--k-ink); }
.sw-prio__sub { font-size: 12px; color: var(--k-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.sw-go { flex: 0 0 auto; height: 32px; padding: 0 12px; border: 1px solid var(--k-ochre); border-radius: 6px; display: flex; align-items: center; color: #9A6A22; font-size: 13px; background: var(--k-paper); }
.sw-quick { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.sw-quick__item { height: 92px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; }
.sw-quick__icon { position: relative; width: 30px; height: 30px; }
.sw-quick__badge { position: absolute; top: -8px; right: -12px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--k-alert); color: #fff; font-size: 11px; line-height: 18px; text-align: center; font-weight: 600; }
.sw-quick__label { font-size: 14px; color: var(--k-ink); }
</style>
