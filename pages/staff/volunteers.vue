<template>
  <view class="k-page volunteer-daily">
    <k-topbar title="当地换工概况" back />
    <view class="k-body k-pad-tab vd-body">
      <view class="vd-heading"><view><text class="vd-city">{{ data.city || '当地' }} · 换工招募</text><text class="vd-meta">{{ data.date || '' }} · 本城市全部合作门店</text></view><view class="vd-refresh" hover-class="k-press" @click="load">{{ loading ? '更新中…' : '刷新' }}</view></view>
      <view v-if="error" class="vd-empty"><text>{{ error }}</text><k-button label="重新加载" size="md" type="outline" @click="load" /></view>
      <template v-else-if="loaded">
        <view class="vd-stats">
          <view v-for="t in tabs" :key="t.key" class="vd-stat" :class="{ active: tab === t.key }" hover-class="k-press" @click="selectTab(t.key)"><text>{{ t.label }}</text><text class="vd-number">{{ data[t.key] || 0 }}<text class="vd-unit">人</text></text></view>
        </view>
        <view v-if="data.reminding && !focusAppId" class="vd-reminder" hover-class="k-press" @click="selectTab('leaving')"><k-icon name="bell" :size="16" color="red" /><text>{{ data.reminding }} 位换工将在 5 天内结束合约，请提前沟通续约或离开。</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
        <view v-if="focusAppId" class="vd-section"><text>这条提醒对应的换工</text><text class="vd-meta" hover-class="k-press" @click="selectTab('leaving')">查看本周全部 ›</text></view>
        <view v-else class="vd-section"><text>{{ currentTab.label }} · 按店查看</text><text class="vd-meta">{{ visibleShops.length }} 家门店</text></view>
        <view v-for="shop in visibleShops" :key="shop.storeId" class="vd-shop">
          <view class="vd-shop-head"><text class="vd-shop-name">{{ shop.name }}</text><text class="vd-count">{{ tab === 'shortfall' ? '缺 ' + shop.shortfall + ' 人' : rows(shop).length + ' 人' }}</text></view>
          <template v-if="tab === 'shortfall'"><view v-for="job in shop.jobs" :key="job.jobId" class="vd-job"><text>{{ job.title }}</text><text class="vd-meta">还招 {{ job.shortfall }} 人</text></view></template>
          <template v-else><view v-for="person in rows(shop)" :key="person.appId" class="vd-person">
            <view class="vd-person-top"><text class="vd-person-name">{{ person.name }}</text><text class="vd-status" :class="{ soon: person.needsContact }">{{ tab === 'arriving' ? (person.status === 'onboarded' ? '已到岗' : '今日待到达') : (person.daysLeft === 0 ? '今天到期' : person.daysLeft + ' 天后到期') }}</text></view>
            <text class="vd-meta">{{ person.jobTitle }}</text><text class="vd-date">{{ tab === 'arriving' ? '预计到达：' + person.arrivalDate : '合约结束：' + person.endDate }}</text>
            <view v-if="person.canManage" class="vd-link" hover-class="k-press" @click="openApplication(person)">查看报名与联系方式 <k-icon name="chevron-right" :size="12" color="#8A5E36" /></view>
            <text v-else-if="focusAppId" class="vd-meta">当前身份可查看到期信息，报名与联系方式仅对有权限的门店人员开放。</text>
          </view></template>
        </view>
        <view v-if="!visibleShops.length" class="vd-empty"><k-icon :name="tab === 'shortfall' ? 'users' : 'calendar-days'" :size="36" color="muted" /><text>{{ emptyText }}</text></view>
        <text v-if="data.missingTerm" class="vd-warning">{{ data.missingTerm }} 位已录用换工的合约期限待补充，暂未计入离开统计。</text>
        <view class="vd-note"><text>统计与提醒说明</text><text>{{ data.note }}</text><text>在岗换工需要延期时，门店可在「报名详情」申请续期。换工本人确认后，名单和后续提醒按新到期日更新。</text></view>
      </template>
      <view v-else class="vd-empty"><text>正在读取当地换工情况…</text></view>
    </view>
    <k-tabbar mode="staff" active="business" />
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload, onPullDownRefresh } from '@dcloudio/uni-app'
import { get } from '@/common/request.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, getMessageScopeKey, selectStaffStore } from '@/common/experience.js'
import { go } from '@/common/screen.js'
import { errText } from '@/common/ui.js'
import R from '@/common/routes.js'
const data = ref({}), loaded = ref(false), loading = ref(false), error = ref(''), tab = ref('shortfall')
const tabs = [{ key: 'shortfall', label: '招募缺口' }, { key: 'arriving', label: '今日到达' }, { key: 'leaving', label: '一周内离开' }]
const currentTab = computed(() => tabs.find(t => t.key === tab.value))
const focusAppId = ref('')
const rows = shop => {
  const people = shop[tab.value === 'arriving' ? 'arrivals' : 'departures'] || []
  return focusAppId.value ? people.filter(p => String(p.appId) === focusAppId.value) : people
}
const visibleShops = computed(() => (data.value.shops || []).filter(s => tab.value === 'shortfall' ? s.shortfall > 0 : rows(s).length))
const emptyText = computed(() => {
  if (focusAppId.value) return '这条提醒对应的记录已不在当前到期名单中'
  return { shortfall: '当前城市暂无招聘中的换工缺口', arriving: '今天暂无预计到达的换工', leaving: '未来一周暂无合约到期的换工' }[tab.value]
})
let seq = 0, booted = false, shown = false, visible = true, openedFocus = false, entryStore = ''
function selectTab(key) {
  focusAppId.value = ''
  tab.value = key
}
async function load() {
  const request = ++seq
  loading.value = true; error.value = ''; loaded.value = false; data.value = {}
  try {
    if (!booted) {
      await ensureSession()
      if (request !== seq) return
      if (entryStore && String(currentStaffStoreId()) !== entryStore) await selectStaffStore(entryStore)
      if (request !== seq) return
      booted = true
    }
    const store = currentStaffStoreId(), scope = getMessageScopeKey()
    if (!hasStaffAccess.value || !store) throw new Error('当前账号没有有效员工授权')
    if (focusAppId.value && entryStore && String(store) !== entryStore) throw new Error('当前身份已切换，请重新打开提醒')
    const result = (await get('/app/staff/daily/volunteers', { storeId: store })).data || {}
    if (request !== seq || store !== currentStaffStoreId() || scope !== getMessageScopeKey()) return
    data.value = result; loaded.value = true
    if (visible && focusAppId.value && !openedFocus && visibleShops.value.length) {
      const person = rows(visibleShops.value[0])[0]
      if (person.canManage) {
        openedFocus = true
        openApplication(person)
      }
    }
  } catch (e) { if (request === seq) error.value = errText(e, '换工概况加载失败') }
  finally { if (request === seq) loading.value = false }
}
function openApplication(p) {
  const store = p.detailStoreId || p.publisherStoreId
  if (p.canManage && store) go(R.staffApplications + '?appId=' + p.appId + '&storeId=' + store)
}
onLoad(q => {
  if (tabs.some(t => t.key === q?.tab)) tab.value = q.tab
  if (/^[1-9]\d*$/.test(q?.focusAppId || '')) {
    focusAppId.value = String(q.focusAppId)
    tab.value = 'leaving'
  }
  entryStore = String(q?.storeId || '')
  return load()
})
watch(getMessageScopeKey, () => { if (booted) load() })
onShow(() => { visible = true; if (shown && booted) load(); shown = true })
onHide(() => { visible = false })
onUnload(() => { seq++; booted = false })
onPullDownRefresh(() => load().finally(() => uni.stopPullDownRefresh()))
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边），三项数字加粗做大小对比，人数和状态用统一的小标签；内容和入口不变。共用写法在 ./work-lite.scss */
@import './work-lite.scss';
.volunteer-daily { @include lite-page; }
.vd-body { padding-top: 10px; }
.vd-heading,.vd-shop-head,.vd-person-top,.vd-section { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.vd-city { display:block; font-family:var(--k-sans); font-size:17px; font-weight:700; line-height:24px; margin-bottom:2px; }
.vd-meta { display:block; color:var(--k-muted); font-size:12px; font-weight:400; line-height:1.6; }
.vd-refresh { flex-shrink:0; padding:12px 0 12px 12px; font-size:12px; color:var(--k-red-deep); }
.vd-stats { display:flex; margin-top:10px; border:0; border-radius:12px; background:var(--k-paper); overflow:hidden; }
/* 数据格（11-18）：数字在上 18 / 700 等宽，说明 11 在下，间距 2（用 order 调顺序，模板不动）；选中只留浅棕底和暖棕字，不再画底边（左下角会碰上白卡圆角缺一块） */
.vd-stat { flex:1; min-width:0; padding:12px 2px 9px; display:flex; flex-direction:column; align-items:center; gap:2px; text-align:center; font-size:11px; color:var(--k-muted); border-bottom:2px solid transparent; }
.vd-stat.active { background:var(--k-red-soft); border-bottom-color:transparent; color:var(--k-red-deep); }
.vd-number { order:-1; display:block; margin-top:0; font-size:18px; font-weight:700; line-height:1.25; color:var(--k-ink); font-variant-numeric:tabular-nums; }
.vd-stat.active .vd-number { color:inherit; }
.vd-unit { font-size:11px; font-weight:400; margin-left:3px; }
.vd-reminder { display:flex; align-items:flex-start; gap:8px; background:var(--k-red-soft); border-radius:12px; padding:10px 12px; margin-top:8px; color:var(--k-red-deep); font-size:12px; line-height:1.7; }
.vd-reminder>text { flex:1; }
.vd-section { margin:16px 0 8px; font-family:var(--k-sans); font-size:16px; font-weight:700; line-height:22px; color:var(--k-ink); }
.vd-shop { border:0; border-radius:12px; background:var(--k-paper); margin-bottom:8px; padding:12px; }
.vd-shop-head { align-items:flex-start; padding-bottom:10px; }
.vd-shop-name { font-size:14px; font-weight:600; line-height:20px; flex:1; min-width:0; overflow-wrap:anywhere; }
.vd-count { flex-shrink:0; height:17px; padding:0 5px; border-radius:4px; background:var(--k-red-soft); color:var(--k-red-deep); font-size:10px; font-weight:500; line-height:17px; }
.vd-job { position:relative; padding:8px 0 0; margin-top:8px; font-size:13px; line-height:1.6; }
.vd-person { position:relative; padding:10px 0 2px; margin-top:6px; }
/* 11-18 第二轮精修：分隔换成发丝线 */
.vd-job::before, .vd-person::before { content:""; position:absolute; left:0; right:0; top:0; height:1px; background:var(--k-line); transform:scaleY(.5); transform-origin:0 0; }
.vd-person-top { margin-bottom:2px; }
.vd-person-name { font-size:14px; font-weight:600; }
.vd-status { flex-shrink:0; height:17px; padding:0 5px; border-radius:4px; background:var(--k-green-soft); color:var(--k-green); font-size:10px; font-weight:500; line-height:17px; }
.vd-status.soon { background:var(--k-ochre-soft); color:var(--k-ochre-deep); }
.vd-date { display:block; font-size:12px; line-height:1.6; margin-top:2px; color:var(--k-ink2); }
.vd-link { display:flex; align-items:center; padding-top:8px; min-height:30px; font-size:12px; color:var(--k-red-deep); }
.vd-note { margin-top:16px; font-size:11px; color:var(--k-muted); line-height:1.8; }
.vd-note>text { display:block; margin-bottom:4px; }
.vd-note>text:first-child { font-weight:600; color:var(--k-ink2); }
.vd-warning { display:block; margin-top:12px; font-size:12px; line-height:1.7; color:var(--k-ochre-deep); }
/* 空状态 / 读取中（11-18）：白卡里居中，14 / 500 二级墨，上下留白 28；「重新加载」是 32 高的次按钮小胶囊 */
.vd-empty { margin-top:10px; padding:28px 16px; border-radius:12px; background:var(--k-paper); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; font-size:14px; font-weight:500; line-height:1.6; color:var(--k-ink2); text-align:center; }
.vd-section + .vd-empty { margin-top:0; }
.vd-empty :deep(.k-button.is-md) { height:32px; padding:0 14px; font-size:13px; border-color:var(--k-red-line); color:var(--k-red-deep); }
</style>
