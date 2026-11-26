<template>
  <view class="k-page service-activities">
    <template v-if="s === 1">
      <k-topbar :title="asKeeper ? '审核本店活动' : '待审核活动'" back />
      <view class="k-body k-pad-tab">
        <view class="req-head"><view class="req-head__copy"><text class="req-head__title">{{ asKeeper ? '本店待审核活动' : (list.city.value ? list.city.value + ' · ' : '') + '待审核活动' }}</text><text class="req-head__sub">{{ asKeeper ? '本店提交的活动由你先审：通过后公开给用户报名；驳回要写原因，改完可以再提交。你自己提交的活动交给平台审。' : '本城合作商家提交的活动。通过后公开给用户报名；驳回要写原因，商家改完可以再提交。' }}</text></view></view>
        <view v-if="entryError || list.error.value" class="req-state"><text>{{ entryError || list.error.value }}</text><k-button label="重新加载" size="md" type="outline" @click="retryEntry" /></view>
        <template v-else>
          <view v-for="a in list.rows.value" :key="a.activityId" class="act" hover-class="k-press-s" @click="openDetail(a)">
            <image class="act__cover" :src="coverOf(a)" mode="aspectFill" />
            <view class="act__copy">
              <text class="act__title">{{ a.title }}</text>
              <text class="act__meta">{{ mdhm(a.startTime) }} · {{ a.priceText }}</text>
              <text class="act__meta">{{ a.storeName }} · {{ a.creator }}</text>
              <text class="act__meta">提交于 {{ mdhm(a.submitTime) }}</text>
            </view>
            <k-icon name="chevron-right" :size="12" color="muted" />
          </view>
          <view v-if="list.hasMore.value" class="req-more" hover-class="k-press" @click="list.more"><text>{{ list.loading.value ? '正在加载…' : '加载更多' }}</text></view>
          <view v-if="!list.rows.value.length" class="req-state"><text>{{ list.loading.value || !list.loaded.value ? '正在读取…' : '现在没有待审核的活动' }}</text></view>
        </template>
      </view>
      <k-tabbar mode="staff" :active="merchantService ? 'business' : 'work'" />
    </template>

    <template v-else>
      <k-topbar title="活动详情" back custom-back @back="s = 1" />
      <view class="k-body" :class="current ? 'req-pad-bar' : 'k-pad-tab'">
        <view v-if="!current" class="req-state"><text>正在读取…</text></view>
        <template v-else>
          <image class="detail__cover" :src="coverOf(current)" mode="aspectFill" />
          <view class="detail__head"><text class="detail__title">{{ current.title }}</text><k-chip tone="ochre"><text>{{ current.statusLabel || '待审核' }}</text></k-chip></view>
          <view class="detail__facts"><view v-for="f in facts" :key="f.label" class="fact"><text class="fact__label">{{ f.label }}</text><text class="fact__value">{{ f.value }}</text></view></view>
          <view v-if="current.intro" class="req-note"><view class="req-note__head"><text>活动介绍</text></view><text class="detail__text">{{ current.intro }}</text></view>
          <view v-if="current.safetyNote" class="req-note"><view class="req-note__head"><text>安全说明</text></view><text class="detail__text">{{ current.safetyNote }}</text></view>
          <view v-if="current.needsPlatform" class="req-hint"><text>这场活动由平台最终决定。你可以驳回让商家修改，或等待平台审核。</text></view>
          <view class="req-hint"><text>平台后台也能审这场活动，谁先处理算谁。</text></view>
        </template>
      </view>
      <view v-if="current" class="req-bar">
        <view class="req-bar__btn"><k-button block size="lg" type="secondary" :disabled="working" label="驳回" @click="audit(false)" /></view>
        <view v-if="!current.needsPlatform" class="req-bar__btn"><k-button block size="lg" :disabled="working" :label="working ? '处理中…' : '通过'" @click="audit(true)" /></view>
      </view>
    </template>
  </view>
</template>

<script setup>
// 商家服务人审核商家活动（10-30 店员 Luna 的备忘录：商家服务人有审核通过权限）。
// 只给 merchant_service 和兼任的小院主理人（服务端 serviceCtx 把关，别的角色 403，页面显示那句话）。没有单独的详情接口，详情就是列表里这一条。
// 2026-11-03 主人「小院主理人，审核活动」：带 ?as=keeper 时是小院主理人审本店活动（城市负责人顶上时也走这里），接口换成 /app/staff/keeper/activities；
// 自己提交的不在列表里，内容检查要人工复核的（needsPlatform）只给驳回。
// 消息点进来带 ?storeId=&id=：id 打开那一条；门店不同时，商家服务人切过去（同 service.vue），兼任的不切，只按地址里的门店取数，免得工作台变成别的店。
import { ref, computed, watch } from 'vue'
import { onShow, onUnload, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { get, post } from '@/common/request.js'
import { useScreen, toast } from '@/common/screen.js'
import { ensureSession, hasStaffAccess, currentStaffStoreId, currentAlsoService, merchantService, selectStaffStore } from '@/common/experience.js'
import { errText, confirm, prompt, mdhm } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import { useRequestList } from './request-list.js'
import { SERVICE_ACTIVITIES_API, activityFacts, auditReasonError } from './request-view.js'
import { KEEPER_ACTIVITIES_API } from './task-flow-view.js'

// 城市服务身份汇总多家商家的活动，消息目标可能在后续分页。
const PAGE_SIZE = 50
let scopeStore = null
const storeId = () => scopeStore || currentStaffStoreId()
const asKeeper = ref(false)
const api = () => (asKeeper.value ? KEEPER_ACTIVITIES_API : SERVICE_ACTIVITIES_API)
const list = useRequestList(async (pageNum) => (await get(api(), { storeId: storeId(), status: 'pending', pageNum, pageSize: PAGE_SIZE })).data)
const coverOf = (a) => (a && a.cover ? absUrl(a.cover) : '') || '/static/media/cover-empty.png'

let booted = false, shown = false
let entryQuery = {}
const entryError = ref('')
const s = useScreen(2, { onLoad: boot })
const current = ref(null), working = ref(false)
const facts = computed(() => activityFacts(current.value))

async function boot(q) {
  entryQuery = q
  entryError.value = ''
  booted = false
  scopeStore = null
  asKeeper.value = q.as === 'keeper'
  try {
    await ensureSession()
    if (!hasStaffAccess.value) throw new Error('当前账号暂无员工授权')
    if (q.storeId && String(q.storeId) !== String(currentStaffStoreId())) {
      scopeStore = q.storeId
      if (!merchantService.value && !currentAlsoService.value) await selectStaffStore(q.storeId)
    }
  } catch (e) {
    scopeStore = null
    entryError.value = errText(e, '无法打开活动，请重试')
    s.value = 1
    return
  }
  booted = true
  await list.reload()
  const id = Number(q.id)
  let row = id ? list.rows.value.find(a => Number(a.activityId) === id) : null
  while (id && !row && list.hasMore.value && !list.error.value) {
    if (!(await list.more())) { s.value = 1; return }
    row = list.rows.value.find(a => Number(a.activityId) === id)
  }
  if (row) return openDetail(row)
  // 直接打开第 2 屏又没有这一条：回列表。消息点得晚，活动可能已经被别人审过了
  s.value = 1
  if (id && !list.error.value) toast('这场活动已经处理过了')
}
function retryEntry() {
  return boot(entryQuery)
}
onShow(() => {
  if (shown && booted && s.value === 1) list.reload()
  shown = true
})
onUnload(() => { list.cancel() })
onReachBottom(() => { if (s.value === 1) list.more() })
onPullDownRefresh(async () => {
  if (s.value === 1) await (booted ? list.reload() : retryEntry())
  uni.stopPullDownRefresh()
})
watch(s, (v, old) => { if (v === 1 && old !== 1 && booted) { current.value = null; list.reload() } })

function openDetail(a) {
  current.value = a
  s.value = 2
}
async function audit(pass) {
  const a = current.value
  if (!a || working.value) return
  let reason = ''
  if (pass) {
    if (!(await confirm('通过这场活动', '通过后活动就公开了，用户可以报名。确认通过？'))) return
  } else {
    const input = await prompt('驳回这场活动', { placeholder: '写清楚要改什么，商家会看到（必填）' })
    if (input === null) return
    const err = auditReasonError(input)
    if (err) return toast(err)
    reason = input
  }
  if (working.value) return
  working.value = true
  try {
    const res = await post(api() + '/' + a.activityId + '/audit?storeId=' + storeId(), pass ? { pass: true } : { pass: false, reason })
    toast(res.msg || (pass ? '已通过' : '已驳回'))
    s.value = 1
  } catch (e) {
    toast(errText(e, '操作失败'))
    // 被别人先处理了（409）、活动没了（404）、不归他审了（403）：这一条已经办不了，回列表拿最新的。网络问题留在这里可以再点
    if ([403, 404, 409].includes(e && e.code)) s.value = 1
  } finally {
    working.value = false
  }
}
</script>

<style scoped lang="scss">
@import './request-pages.scss';
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、去阴影），封面图 8 圆角，行标题 14、说明 12；「驳回 / 通过」都在。共用写法在 ./work-lite.scss；.req-* 在 ./request-pages.scss */
@import './work-lite.scss';
.service-activities{@include lite-page}
.act{display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:12px;border-radius:12px;background:var(--k-paper);box-shadow:none}
.act__cover{flex-shrink:0;width:72px;height:72px;border-radius:8px;background:#F5F1EB}
.act__copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.act__title{font-size:14px;font-weight:600;line-height:1.4;color:var(--k-ink);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.act__meta{font-size:12px;line-height:1.5;color:var(--k-muted);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.detail__cover{display:block;width:100%;height:180px;border-radius:12px;background:#F5F1EB}
.detail__head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-top:12px}
.detail__title{min-width:0;flex:1;font-family:var(--k-sans);font-size:17px;font-weight:700;line-height:1.4;color:var(--k-ink);overflow-wrap:anywhere}
.detail__facts{margin-top:10px;padding:2px 12px;border-radius:12px;background:var(--k-paper);box-shadow:none}
.fact{position:relative;display:flex;gap:12px;padding:10px 0;font-size:13px;line-height:1.5}
/* 11-18 第二轮精修：行间发丝线，最后一行没有线 */
.fact + .fact::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.fact__label{flex-shrink:0;width:66px;color:var(--k-muted)}
.fact__value{min-width:0;flex:1;color:var(--k-ink);overflow-wrap:anywhere}
.detail__text{display:block;font-size:13px;line-height:1.7;color:var(--k-ink2);white-space:pre-wrap;overflow-wrap:anywhere}
</style>
