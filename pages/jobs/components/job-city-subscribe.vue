<template>
  <view class="job-city-subscribe" :class="{ 'is-on': subscribed, 'is-disabled': busy || !ready || !cityName }" role="button" :aria-label="error ? '重新加载订阅状态' : subscribed ? '取消订阅当地岗位' : '订阅当地岗位'" :aria-pressed="subscribed" :aria-disabled="busy || !ready || !cityName" hover-class="k-press-s" @click="toggle">
    <k-icon :name="subscribed ? 'check' : 'bell'" :size="16" :color="subscribed ? 'ink2' : 'red'" />
    <text>{{ busy ? '处理中' : !ready ? '加载中' : error ? '重试' : subscribed ? '已订阅' : '订阅' }}</text>
  </view>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { apiJobSubs, apiAddJobSub, apiRemoveJobSub } from '@/common/api.js'
import { ensureSession, experience, getSessionRevision } from '@/common/experience.js'
import { go, toast } from '@/common/screen.js'
import { modal } from '@/common/ui.js'
import R from '@/common/routes.js'
import { coordinatorCity, localSubscriptionPayload, localSubscriptions, coveredBySubscription } from '../city-coordinator.js'
import { currentJobSubscription } from '../subscription-model.js'
defineOptions({ options: { virtualHost: true, styleIsolation: 'isolated' } })
const props = defineProps({ city: { type: String, default: '' } })
const cityName = computed(() => coordinatorCity(props.city))
const rows = ref([]), busy = ref(false), ready = ref(false), error = ref('')
const covered = (list, city) => localSubscriptions(list, city).length > 0 || coveredBySubscription(currentJobSubscription(list), city)
const subscribed = computed(() => covered(rows.value, cityName.value))
let request = 0, operation = 0
const scope = () => [cityName.value, experience.account?.id || '', getSessionRevision()].join('|')
async function refresh() {
  if (busy.value) return
  const id = ++request, current = scope()
  ready.value = false; error.value = ''
  if (!experience.account || !cityName.value) { rows.value = []; ready.value = true; return }
  try {
    const response = await apiJobSubs()
    if (id === request && current === scope()) rows.value = response.data || []
  } catch (_) {
    if (id === request && current === scope()) error.value = '订阅状态读取失败，点击重试'
  } finally { if (id === request && current === scope()) ready.value = true }
}
watch(scope, () => { ++operation; busy.value = false; rows.value = []; refresh() }, { immediate: true, flush: 'sync' })
onUnmounted(() => { ++request; ++operation })
defineExpose({ refresh })
async function toggle() {
  if (busy.value || !ready.value || !cityName.value) return
  if (error.value) return refresh()
  busy.value = true
  const wantSubscribe = !subscribed.value
  const id = ++operation, current = scope()
  const valid = () => id === operation && current === scope()
  ++request
  try {
    await ensureSession()
    if (!valid()) return
    if (!experience.account) {
      const result = await modal('请先登录', '登录后可订阅当地岗位上新提醒。', { confirmText: '去登录', cancelText: '再看看' })
      if (valid() && result.confirm) go(R.login)
      return
    }
    const response = await apiJobSubs()
    if (!valid()) return
    rows.value = response.data || []
    const active = localSubscriptions(rows.value, cityName.value)
    const mine = currentJobSubscription(rows.value)
    const has = covered(rows.value, cityName.value)
    if (!wantSubscribe && !active.length && has) {
      go(R.jobsFilter + '?s=2&cur=1')
    } else if (wantSubscribe && !has && mine) {
      // 已有订阅时把本城加进当前订阅，不再另外创建。
      go(R.jobsFilter + '?s=2&cur=1&addCity=' + encodeURIComponent(cityName.value))
    } else if (!wantSubscribe && active.length) {
      for (const item of active) {
        if (!valid()) return
        try { await apiRemoveJobSub(item.subId) } catch (e) { if (e?.code !== 404) throw e }
        if (!valid()) return
        rows.value = rows.value.filter(row => String(row.subId) !== String(item.subId))
      }
      toast('已取消当地岗位订阅')
    } else if (wantSubscribe && !has) {
      const payload = localSubscriptionPayload(cityName.value)
      const result = await apiAddJobSub(payload)
      if (!valid()) return
      if (!result.data?.subId) throw new Error('订阅结果未确认，请重试')
      rows.value = [...rows.value, { ...payload, subId: result.data.subId, status: '0' }]
      toast('已订阅，当地岗位上新会在消息中心提醒')
    } else toast(wantSubscribe ? '已订阅当地岗位' : '已取消当地岗位订阅')
  } catch (e) { if (valid()) toast(e?.message || '操作失败，请重试') }
  finally { if (valid()) busy.value = false }
}
</script>

<style scoped>
/* 2026-11-17 改版「小而精」：看上去是 28 高的浅棕小胶囊，外面一圈透明边把可点范围留在 44 高 */
.job-city-subscribe { display: flex; align-items: center; justify-content: center; gap: 3px; min-width: 80px; min-height: 44px; padding: 0 8px; box-sizing: border-box; border: 8px solid transparent; border-radius: 22px; background: var(--k-red-soft) padding-box; color: var(--k-red-deep); font-size: 12px; font-weight: 500; white-space: nowrap; }
.job-city-subscribe.is-on { border-color: transparent; background: #F5F1EB padding-box; color: var(--k-ink2); }
.job-city-subscribe.is-disabled { opacity: .6; }
</style>
