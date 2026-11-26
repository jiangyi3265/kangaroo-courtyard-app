<template>
  <view class="k-page finance-page">
    <k-topbar title="活动财务" back />
    <view class="k-body k-pad-tab">
      <view class="finance-switch"><view v-for="t in TABS" :key="t.key" :class="{ active: tab === t.key }" hover-class="k-press" @click="setTab(t.key)"><text>{{ t.key === 'refunds' && refunds.total.value > 0 ? t.label + '（' + refunds.total.value + '）' : t.label }}</text></view></view>
      <view v-if="storeFilter" class="finance-scope"><text>只看消息里的这家门店</text><text class="finance-scope__link" @click="clearStore">看全部门店</text></view>
      <text class="req-foot finance-note">{{ cityLeadFull ? '本城全部门店。' : '只含你有授权的门店，其他门店由平台在后台处理。' }}旅居和服务订单的退款在平台后台。</text>

      <template v-if="tab === 'refunds'">
        <view v-if="refunds.error.value" class="req-state"><text>{{ refunds.error.value }}</text><k-button label="重新加载" size="md" type="outline" @click="refunds.reload" /></view>
        <template v-else>
          <view v-for="row in refunds.rows.value" :key="row.signupId" class="finance-card">
            <view class="finance-card__head"><text class="finance-card__title">{{ row.activityTitle }}</text><text class="finance-card__money">¥{{ row.refundYuan }}</text></view>
            <text class="finance-card__meta">{{ placeText(row) }}</text>
            <text class="finance-card__meta">报名人：{{ row.name }} {{ row.phone }}</text>
            <text v-if="row.cancelReason" class="finance-card__meta">退款原因：{{ row.cancelReason }}</text>
            <text class="finance-card__meta">申请时间：{{ timeText(row.cancelTime) }}{{ row.startTime ? ' · 活动开始：' + timeText(row.startTime) : '' }}</text>
            <text v-if="row.mine" class="finance-card__mine">这是你自己的报名，请让平台处理</text>
            <view v-else class="finance-card__acts"><k-button label="驳回" size="sm" type="outline" @click="rejectRefund(row)" /><k-button label="同意退款" size="sm" @click="approveRefund(row)" /></view>
          </view>
          <view v-if="refunds.hasMore.value" class="req-more" hover-class="k-press" @click="refunds.more"><text>{{ refunds.loading.value ? '正在加载…' : '加载更多' }}</text></view>
          <view v-if="!refunds.rows.value.length" class="req-state"><text>{{ refunds.loading.value || !refunds.loaded.value ? '正在读取…' : '现在没有待审批的活动退款' }}</text></view>
        </template>
      </template>

      <template v-else>
        <view v-if="activities.error.value" class="req-state"><text>{{ activities.error.value }}</text><k-button label="重新加载" size="md" type="outline" @click="activities.reload" /></view>
        <template v-else>
          <view v-for="act in activities.rows.value" :key="act.activityId" class="finance-card">
            <view class="finance-card__head"><text class="finance-card__title">{{ act.title }}</text><text class="finance-card__money">{{ Number(act.feeFen) > 0 ? '¥' + act.feeYuan : '免费' }}</text></view>
            <text class="finance-card__meta">{{ placeText(act) }}</text>
            <text class="finance-card__meta">开始时间：{{ timeText(act.startTime) }} · 已报名 {{ Number(act.signed) || 0 }} 人</text>
            <view class="finance-card__acts"><k-button label="取消活动" size="sm" type="outline" @click="cancelActivity(act)" /></view>
          </view>
          <view v-if="activities.hasMore.value" class="req-more" hover-class="k-press" @click="activities.more"><text>{{ activities.loading.value ? '正在加载…' : '加载更多' }}</text></view>
          <view v-if="!activities.rows.value.length" class="req-state"><text>{{ activities.loading.value || !activities.loaded.value ? '正在读取…' : '现在没有收费或已有报名的待开始活动' }}</text></view>
        </template>
        <text class="req-foot">免费且没人报名的活动不在这里，由换工主理人、小院主理人在活动管理里取消。</text>
      </template>
    </view>
    <k-tabbar mode="staff" active="work" />
  </view>
</template>

<script setup>
// 城市负责人的活动财务（角色切换后才开放，入口在 k-city-work）：活动退款审批、取消收费活动，只限服务端算出的门店（全部权限后是本城全部门店），权限都在服务端查。
// 消息「活动退款待审批」带 ?storeId= 进来，只看那一家；切换前打开，接口回 403，页面照实显示服务端的话。staff 分包，不占主包
import { ref } from 'vue'
import { onLoad, onShow, onUnload, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { get, post } from '@/common/request.js'
import { ensureSession, cityLeadFull } from '@/common/experience.js'
import { toast } from '@/common/screen.js'
import { confirm, prompt, errText } from '@/common/ui.js'
import { useRequestList } from './request-list.js'
import { CITY_FINANCE_API } from './request-view.js'

const TABS = [{ key: 'refunds', label: '退款审批' }, { key: 'activities', label: '取消活动' }]
const tab = ref('refunds'), storeFilter = ref('')
const scope = () => (storeFilter.value ? { storeId: storeFilter.value } : {})
const refunds = useRequestList(async (pageNum) => (await get(CITY_FINANCE_API + '/refunds', { ...scope(), pageNum, pageSize: 20 })).data)
const activities = useRequestList(async (pageNum) => (await get(CITY_FINANCE_API + '/activities', { ...scope(), pageNum, pageSize: 20 })).data)
const current = () => (tab.value === 'refunds' ? refunds : activities)

const timeText = (t) => String(t || '').slice(0, 16)
const placeText = (r) => [r.storeName, r.city].filter(Boolean).join(' · ')

let booted = false, shown = false, busy = false
onLoad(async (q) => {
  tab.value = q?.tab === 'activities' ? 'activities' : 'refunds'
  storeFilter.value = q?.storeId ? String(q.storeId) : ''
  await ensureSession()
  booted = true
  current().reload()
})
onShow(() => { if (shown && booted) current().reload(); shown = true })
onUnload(() => { refunds.cancel(); activities.cancel() })
onReachBottom(() => { current().more() })
onPullDownRefresh(async () => {
  await current().reload()
  uni.stopPullDownRefresh()
})
function setTab(key) {
  if (tab.value === key) return
  tab.value = key
  current().reload()
}
function clearStore() {
  storeFilter.value = ''
  current().reload()
}

/** 写操作共用：防连点；不管成败都重新取一次（别人可能先审了，服务端回 409 时列表要跟着变） */
async function run(list, action, fallback) {
  if (busy) return
  busy = true
  try {
    const res = await action()
    toast((typeof res.data === 'string' && res.data) || res.msg || '已处理')
  } catch (e) {
    toast(errText(e, fallback))
  } finally {
    busy = false
    list.reload()
  }
}
async function approveRefund(r) {
  if (busy || !(await confirm('同意退款', `同意把 ¥${r.refundYuan} 退给 ${r.name}（${r.activityTitle}）？同意后不能撤销。`))) return
  run(refunds, () => post(`${CITY_FINANCE_API}/refunds/${r.signupId}/approve`), '操作失败，请刷新后重试')
}
async function rejectRefund(r) {
  if (busy) return
  // 驳回 = 不退钱、恢复 TA 的报名并保留名额（2026-11-09 主人拍板），提示里说清楚
  const reason = await prompt('驳回原因（会发给报名人）', { placeholder: '驳回后 TA 的报名恢复、名额保留' })
  if (reason === null) return
  if (!reason) return toast('请写明驳回原因')
  run(refunds, () => post(`${CITY_FINANCE_API}/refunds/${r.signupId}/reject`, { reason }), '操作失败，请刷新后重试')
}
async function cancelActivity(a) {
  if (busy) return
  const reason = await prompt('取消原因（会发给报名人）', { placeholder: '请写明取消原因' })
  if (reason === null) return
  if (!reason) return toast('请写明取消原因')
  const signed = Number(a.signed) || 0
  const effect = signed > 0 ? `已报名的 ${signed} 人会收到通知，已交的费用批量退款。` : '现在还没有人报名。'
  if (!(await confirm('确认取消活动', `取消「${a.title}」？${effect}取消后不能恢复。`))) return
  run(activities, () => post(`${CITY_FINANCE_API}/activities/${a.activityId}/cancel`, { reason }), '取消失败，请刷新后重试')
}
</script>

<style scoped lang="scss">
@import './request-pages.scss';
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、去阴影），金额加粗做大小对比，按钮收成胶囊；「驳回 / 同意退款 / 取消活动」都在。共用写法在 ./work-lite.scss；.req-* 在 ./request-pages.scss */
@import './work-lite.scss';
.finance-page{@include lite-page}
/* 分段控件（11-18 第二轮精修，和「我的」钱包页一个样子）：外框 #F0EBE4、高 32、圆角 16、内边距 2；选中白块圆角 14、13 / 600 墨色，没选 13 / 400 二级墨。
   块看着 28 高，上下各多出一圈看不见的可点范围，可点高度仍有 40 */
.finance-switch{height:32px;margin-bottom:10px;padding:2px;box-sizing:border-box;border-radius:16px;background:#F0EBE4;display:grid;grid-template-columns:1fr 1fr}
.finance-switch>view{border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:400;color:var(--k-ink2)}
.finance-switch>view.active{background:var(--k-paper);color:var(--k-ink);font-weight:600;box-shadow:none}
.finance-switch>view{position:relative}.finance-switch>view::after{content:"";position:absolute;left:0;right:0;top:-4px;bottom:-4px}
.finance-scope{margin-bottom:8px;padding:10px 12px;border-radius:12px;background:var(--k-red-soft);display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;color:var(--k-red-deep)}
.finance-scope__link{flex-shrink:0;font-weight:600}
.finance-note{margin:0 0 10px}
.finance-card{margin-bottom:8px;padding:12px;border-radius:12px;background:var(--k-paper);box-shadow:none;display:flex;flex-direction:column;gap:3px}
.finance-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:3px}
.finance-card__title{min-width:0;flex:1;font-size:14px;font-weight:600;line-height:1.45;color:var(--k-ink);overflow-wrap:anywhere}
.finance-card__money{flex-shrink:0;font-size:18px;font-weight:700;line-height:1.2;color:var(--k-red);font-variant-numeric:tabular-nums}
.finance-card__meta{font-size:12px;line-height:1.6;color:var(--k-muted);overflow-wrap:anywhere}
.finance-card__mine{margin-top:4px;font-size:12px;line-height:1.55;color:var(--k-alert)}
.finance-card__acts{margin-top:8px;display:flex;justify-content:flex-end;gap:8px}
/* 「同意退款」每条都有一个：不用实心渐变，浅底暖棕字（一屏只留一个暖棕主操作） */
.finance-card__acts :deep(.k-button.is-primary){border-color:transparent;background:var(--k-red-soft);color:var(--k-red-deep)}
/* 「驳回」「取消活动」是公共的 outline（灰边墨字），和旁边浅棕的「同意退款」不像一家：按次按钮换成暖棕细边、暖棕字 */
.finance-card__acts :deep(.k-button.is-outline){border-color:var(--k-red-line);color:var(--k-red-deep)}
</style>
