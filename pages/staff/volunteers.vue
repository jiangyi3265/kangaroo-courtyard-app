<template>
  <view class="k-page volunteer-daily">
    <k-topbar title="当地换工概况" back />
    <view class="k-body k-pad-tab vd-body">
      <view class="vd-heading"><view><text class="vd-city">{{ data.city || '当地' }} · 换工招募</text><text class="vd-meta">{{ data.date || '' }} · 本城市全部合作门店</text></view><view class="vd-refresh" hover-class="k-press" @click="load">{{ loading ? '更新中…' : '刷新' }}</view></view>
      <view v-if="error" class="vd-empty"><text>{{ error }}</text><k-button label="重新加载" size="md" type="outline" @click="load" /></view>
      <template v-else-if="loaded">
        <view class="vd-stats">
          <view v-for="t in tabs" :key="t.key" class="vd-stat" :class="{ active: tab === t.key }" hover-class="k-press" @click="tab = t.key"><text>{{ t.label }}</text><text class="vd-number">{{ data[t.key] || 0 }}<text class="vd-unit">人</text></text></view>
        </view>
        <view v-if="data.reminding" class="vd-reminder"><k-icon name="bell" :size="19" color="red" /><text>{{ data.reminding }} 位换工将在 5 天内结束合约，请提前沟通续约或离开。</text></view>
        <view class="vd-section"><text>{{ currentTab.label }} · 按店查看</text><text class="vd-meta">{{ visibleShops.length }} 家门店</text></view>
        <view v-for="shop in visibleShops" :key="shop.storeId" class="vd-shop">
          <view class="vd-shop-head"><text class="vd-shop-name">{{ shop.name }}</text><text class="vd-count">{{ tab === 'shortfall' ? '缺 ' + shop.shortfall + ' 人' : rows(shop).length + ' 人' }}</text></view>
          <template v-if="tab === 'shortfall'"><view v-for="job in shop.jobs" :key="job.jobId" class="vd-job"><text>{{ job.title }}</text><text class="vd-meta">还招 {{ job.shortfall }} 人</text></view></template>
          <template v-else><view v-for="person in rows(shop)" :key="person.appId" class="vd-person">
            <view class="vd-person-top"><text class="vd-person-name">{{ person.name }}</text><text class="vd-status" :class="{ soon: person.needsContact }">{{ tab === 'arriving' ? (person.status === 'onboarded' ? '已到岗' : '今日待到达') : (person.daysLeft === 0 ? '今天到期' : person.daysLeft + ' 天后到期') }}</text></view>
            <text class="vd-meta">{{ person.jobTitle }}</text><text class="vd-date">{{ tab === 'arriving' ? '预计到达：' + person.arrivalDate : '合约结束：' + person.endDate }}</text>
            <view v-if="person.canManage" class="vd-link" hover-class="k-press" @click="openApplication(person)">查看报名与联系方式 <k-icon name="chevron-right" :size="14" color="red" /></view>
          </view></template>
        </view>
        <view v-if="!visibleShops.length" class="vd-empty"><k-icon :name="tab === 'shortfall' ? 'users' : 'calendar-days'" :size="32" color="muted" /><text>{{ emptyText }}</text></view>
        <text v-if="data.missingTerm" class="vd-warning">{{ data.missingTerm }} 位已录用换工的合约期限待补充，暂未计入离开统计。</text>
        <view class="vd-note"><text>统计与提醒说明</text><text>{{ data.note }}</text><text>提醒可在员工端「消息」查看。续约沟通不会自动修改已签合约，期限确认更新后，统计和后续提醒按新期限计算。</text></view>
      </template>
      <view v-else class="vd-empty"><text>正在读取当地换工情况…</text></view>
    </view>
    <k-tabbar mode="staff" active="business" />
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { onLoad, onShow, onUnload, onPullDownRefresh } from '@dcloudio/uni-app'
import { get } from '@/common/request.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, getSessionRevision, selectStaffStore } from '@/common/experience.js'
import { go } from '@/common/screen.js'
import { errText } from '@/common/ui.js'
import R from '@/common/routes.js'
const data = ref({}), loaded = ref(false), loading = ref(false), error = ref(''), tab = ref('shortfall')
const tabs = [{ key: 'shortfall', label: '招募缺口' }, { key: 'arriving', label: '今日到达' }, { key: 'leaving', label: '一周内离开' }]
const currentTab = computed(() => tabs.find(t => t.key === tab.value))
const rows = shop => shop[tab.value === 'arriving' ? 'arrivals' : 'departures'] || []
const visibleShops = computed(() => (data.value.shops || []).filter(s => tab.value === 'shortfall' ? s.shortfall > 0 : rows(s).length))
const emptyText = computed(() => tab.value === 'shortfall' ? '当前城市暂无招聘中的换工缺口' : tab.value === 'arriving' ? '今天暂无预计到达的换工' : '未来一周暂无合约到期的换工')
let seq = 0, booted = false, shown = false
async function load() {
  if (!booted) return
  const request = ++seq, store = currentStaffStoreId(), session = getSessionRevision()
  loading.value = true; error.value = ''; loaded.value = false; data.value = {}
  try {
    if (!hasStaffAccess.value || !store) throw new Error('当前账号没有有效员工授权')
    const result = (await get('/app/staff/daily/volunteers', { storeId: store })).data || {}
    if (request !== seq || store !== currentStaffStoreId() || session !== getSessionRevision()) return
    data.value = result; loaded.value = true
  } catch (e) { if (request === seq) error.value = errText(e, '换工概况加载失败') }
  finally { if (request === seq) loading.value = false }
}
function openApplication(p) { go(R.staffApplications + '?appId=' + p.appId + '&storeId=' + p.publisherStoreId) }
onLoad(async q => {
  try {
    if (['shortfall', 'arriving', 'leaving'].includes(q?.tab)) tab.value = q.tab
    await ensureSession()
    if (q?.storeId && String(q.storeId) !== String(currentStaffStoreId())) await selectStaffStore(q.storeId)
    booted = true; load()
  } catch (e) { error.value = errText(e, '身份校验失败') }
})
watch(() => currentStaffStoreId(), () => { if (booted) load() })
onShow(() => { if (shown && booted) load(); shown = true })
onUnload(() => { seq++; booted = false })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))
</script>

<style scoped lang="scss">
.vd-body { padding-top: 12px; }
.vd-heading,.vd-shop-head,.vd-person-top,.vd-section { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.vd-city { display:block; font-size:21px; font-weight:700; margin-bottom:5px; }
.vd-meta { display:block; color:var(--k-muted); font-size:12px; line-height:1.6; }
.vd-refresh { flex-shrink:0; padding:12px 0 12px 12px; font-size:14px; color:var(--k-red); }
.vd-stats { display:flex; margin-top:20px; border:1px solid var(--k-line); border-radius:14px; background:var(--k-paper); overflow:hidden; }
.vd-stat { flex:1; min-width:0; padding:16px 2px 12px; text-align:center; font-size:13px; color:var(--k-muted); border-bottom:3px solid transparent; }
.vd-stat.active { background:var(--k-red-soft); border-bottom-color:var(--k-red); color:var(--k-red-deep); }
.vd-number { display:block; margin-top:6px; font-size:28px; font-weight:700; line-height:1.3; }
.vd-unit { font-size:12px; font-weight:400; margin-left:4px; }
.vd-reminder { display:flex; align-items:flex-start; gap:8px; background:var(--k-red-soft); border-radius:10px; padding:12px; margin-top:14px; color:var(--k-red-deep); font-size:13px; line-height:1.7; }
.vd-reminder>text { flex:1; }
.vd-section { margin:24px 0 10px; font-size:16px; font-weight:600; }
.vd-shop { border:1px solid var(--k-line); border-radius:14px; background:var(--k-paper); margin-bottom:12px; padding:16px; }
.vd-shop-head { align-items:flex-start; padding-bottom:12px; }
.vd-shop-name { font-size:17px; font-weight:700; flex:1; min-width:0; overflow-wrap:anywhere; }
.vd-count { flex-shrink:0; font-size:13px; color:var(--k-red-deep); background:var(--k-red-soft); padding:3px 8px; border-radius:6px; }
.vd-job { border-top:1px solid var(--k-line2); padding:10px 0 0; margin-top:8px; font-size:14px; line-height:1.6; }
.vd-person { padding:14px 0 2px; border-top:1px solid var(--k-line2); margin-top:6px; }
.vd-person-top { margin-bottom:5px; }
.vd-person-name { font-size:16px; font-weight:600; }
.vd-status { font-size:12px; color:var(--k-green); }
.vd-status.soon { color:var(--k-red-deep); }
.vd-date { display:block; font-size:13px; line-height:1.6; margin-top:4px; }
.vd-link { display:flex; align-items:center; padding-top:12px; min-height:30px; font-size:13px; color:var(--k-red); }
.vd-note { margin-top:24px; font-size:12px; color:var(--k-muted); line-height:1.8; }
.vd-note>text { display:block; margin-bottom:6px; }
.vd-note>text:first-child { font-weight:600; color:var(--k-ink2); }
.vd-warning { display:block; margin-top:16px; font-size:13px; line-height:1.7; color:var(--k-red-deep); }
.vd-empty { min-height:170px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; font-size:14px; color:var(--k-muted); text-align:center; }
</style>
