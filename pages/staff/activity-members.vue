<template>
  <view class="k-page mb-page">
    <k-topbar :title="groupChatEnabled ? '成员与群聊' : '成员管理'" back />
    <view class="mb-body">
      <text v-if="d.title" class="mb-title">{{ d.title }}</text>
      <text class="mb-sum">已确认 {{ confirmed.length }} 人 · 候补 {{ waiting.length }} 人 · 已签到 {{ d.checkedIn || 0 }} 人</text>
      <!-- 主人：活动群聊和成员管理合到一起，进群放最上面、做大 -->
      <k-button v-if="groupChatEnabled" class="mb-group" block size="lg" icon="message-circle" label="进入活动群聊" @click="openGroup" />
      <view v-if="refunds.length" class="mb-refund" hover-class="k-press" @click="refundFlow">
        <k-icon name="wallet" :size="18" color="ochre" :stroke="1.6" />
        <text class="k-flex1">{{ canPay ? `退款待审批 ${refunds.length} 笔，点这里处理` : `退款待审批 ${refunds.length} 笔（需要活动支付权限）` }}</text>
        <k-icon name="chevron-right" :size="12" color="muted" />
      </view>
      <view v-if="loaded && !confirmed.length && !waiting.length" class="mb-empty"><text>还没有人报名</text></view>
      <view v-for="sec in sections" :key="sec.name" class="mb-sec">
        <text class="mb-sec__title">{{ sec.name }}（{{ sec.list.length }}）</text>
        <view v-for="x in sec.list" :key="x.signupId" class="mb-row">
          <image v-if="x.avatar" class="mb-avatar" :src="absUrl(x.avatar)" mode="aspectFill" />
          <view v-else class="mb-avatar mb-avatar--txt"><text>{{ (x.name || '友').slice(0, 1) }}</text></view>
          <view class="k-flex1 mb-row__copy">
            <view class="k-row k-gap8"><text class="mb-name k-ellipsis">{{ x.name || '未填姓名' }}</text><text class="mb-tag" :class="{ 'mb-tag--ok': x.checkedIn }">{{ x.tag }}</text></view>
            <text class="mb-phone">{{ x.phone }}</text>
            <k-order-mediation v-if="merchantStaff && x.checkedIn" merchant order-type="activity" :order-id="x.signupId" />
          </view>
          <view v-if="privateChatEnabled" class="mb-btn" hover-class="k-press-s" @click="message(x)"><text>私信</text></view>
          <view class="mb-btn" hover-class="k-press-s" @click="call(x)"><text>电话</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { privateChatEnabled } from '@/common/features.js'
import { groupChatEnabled } from '@/common/features.js'
// ---------------------------------------------------------------------------
// 2026-11-03 主人：活动详情里「活动群聊」「成员管理」两格合到一起，叫「成员与群聊」。
// 原来「成员管理」是一个弹出的名单菜单，点人再弹「私信 / 查看电话」；现在单独一页：最上面一个大按钮进活动群，
// 下面是退款待审批（有的话）和成员名单，每个人后面直接是「私信」「电话」两个按钮。规则一条没改：
//   私信走社区公约（gated）；电话只在活动前后 24 小时内能看、每次留痕；退款审批只认有资金权限的角色。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, go, toast } from '@/common/screen.js'
import { apiStaffActivity, apiStaffActivityPhone, apiStaffActivityRefund, apiChatOpen } from '@/common/api.js'
import { ensureSession, merchantStaff } from '@/common/experience.js'
import { errText, sheet, pickPaged, prompt, confirm, alert } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import { gated } from '@/common/community.js'
import { staffCan } from '@/common/staff-perms.js'
import R from '@/common/routes.js'

const fail = (e, dft) => toast(errText(e, dft))
const id = ref(0)
const d = ref({})
const loaded = ref(false)
let ready = false

useScreen(1, {
  onLoad: async (q) => {
    id.value = Number(q?.id) || 0
    await ensureSession()
    await load()
    ready = true
  }
})
// 从私信 / 群聊回来刷新一下（可能有人签到、退款被别人处理了）
onShow(() => { if (ready) load() })

async function load() {
  if (!id.value) return toast('活动编号不对，请返回重新进入')
  try {
    d.value = (await apiStaffActivity(id.value)).data || {}
  } catch (e) {
    fail(e, '活动不存在或没有权限')
  } finally {
    loaded.value = true
  }
}

const confirmed = computed(() => d.value.confirmed || [])
const waiting = computed(() => d.value.waiting || [])
const refunds = computed(() => d.value.refunds || [])
const canPay = computed(() => (d.value.canPay != null ? !!d.value.canPay : staffCan('activities', 'pay')))
const sections = computed(() => [{ name: '已确认', list: confirmed.value }, { name: '候补', list: waiting.value }].filter(x => x.list.length))

let busy = false
const once = async (fn) => {
  if (busy) return
  busy = true
  try { return await fn() } finally { busy = false }
}

async function openGroup() {
  try {
    const res = (await apiChatOpen({ type: 'activity', activityId: id.value })).data
    go(R.chat + '?convId=' + res.convId)
  } catch (e) {
    fail(e, '活动通过审核后才有活动群（且需要你是创建人）')
  }
}

async function message(x) {
  try {
    // 私信走社区规则：没同意过《社区公约》时先弹规则让员工同意再重试
    const res = (await gated(() => apiChatOpen({ type: 'private', userId: x.userId, source: 'activity' }))).data
    go(R.chat + '?convId=' + res.convId)
  } catch (e) {
    if (!e || !e.silent) fail(e, '暂时无法私信')
  }
}

async function call(x) {
  if (!d.value.phoneWindow) return toast('活动开始前 24 小时到结束后 24 小时内才能查看电话')
  if (!(await confirm('查看电话', `查看 ${x.name || '该成员'} 的完整手机号会留下记录，确认查看？`))) return
  try {
    const res = (await apiStaffActivityPhone(id.value, x.signupId)).data
    uni.makePhoneCall({ phoneNumber: res.phone, fail: () => alert(res.name, res.phone) })
  } catch (e) {
    fail(e, '无法查看电话')
  }
}

async function refundFlow() {
  if (!canPay.value) return toast('当前角色没有活动退款审批权限')
  const list = refunds.value
  const money = (r) => (Number(r.refundFen || 0) / 100).toFixed(2)
  const i = await pickPaged(list.map(r => [r.name, '¥' + money(r), r.cancelReason].filter(Boolean).join(' · ')), '退款申请')
  if (i < 0) return
  const r = list[i]
  // 驳回 = 不退钱、恢复报名并保留名额（2026-11-09）
  const j = await sheet([`同意退款 ¥${money(r)}`, '驳回退款（恢复报名）'])
  if (j < 0) return
  let reason
  if (j === 0) {
    // 退款是钱的操作：菜单点一下就退出去太容易误触，再确认一次
    if (!(await confirm('同意退款', `确认给 ${r.name || '该用户'} 退款 ¥${money(r)}？`))) return
  } else {
    reason = await prompt('驳回原因', { placeholder: '会通知给用户' })
    if (reason === null) return
    if (!reason) return toast('请填写驳回原因')
  }
  await once(async () => {
    try {
      toast((await apiStaffActivityRefund(id.value, r.signupId, j === 0 ? 'approve' : 'reject', reason)).msg)
      load()
    } catch (e) {
      fail(e, '操作失败')
    }
  })
}
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底；已确认 / 候补各是一张白卡（12 圆角、不描边），成员一人一行、中间一道细线；
   名字 14 / 600、电话 12，「私信」「电话」收成 28 高的细边胶囊；退款待审批是一条琥珀色浅底的提示条，不再描边 */
.mb-page { --k-bg: #F7F5F2; --k-sh1: none; background: #F7F5F2; }
.mb-page :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
.mb-body { padding: 8px 12px calc(32px + var(--k-safe-bottom)); }
.mb-title { display: block; font-family: var(--k-sans); font-weight: 700; font-size: 17px; line-height: 24px; }
.mb-sum { display: block; margin-top: 2px; font-size: 12px; color: var(--k-muted); }
.mb-group { margin-top: 12px; }
.mb-refund { display: flex; align-items: center; gap: 8px; min-height: 44px; margin-top: 8px; padding: 8px 12px; border-radius: 12px; background: var(--k-ochre-soft); font-size: 13px; line-height: 18px; color: var(--k-ochre-deep); }
/* 11-18 词典「空状态」：放进白卡，上下留白 28，14 / 500 / ink2 */
.mb-empty { margin-top: 8px; padding: 28px 12px; border-radius: 12px; background: var(--k-paper); text-align: center; font-size: 14px; font-weight: 500; color: var(--k-ink2); }
.mb-sec { margin-top: 8px; padding: 12px 12px 2px; border-radius: 12px; background: var(--k-paper); }
.mb-sec__title { display: block; font-family: var(--k-sans); font-weight: 700; font-size: 15px; line-height: 22px; }
/* 成员行之间是发丝线（1px 压成一半），紧挨标题的第一行不画 */
.mb-row { position: relative; display: flex; align-items: center; gap: 10px; min-height: 60px; padding: 10px 0; }
.mb-row::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.mb-sec__title + .mb-row::before { display: none; }
.mb-avatar { width: 40px; height: 40px; border-radius: 50%; flex: 0 0 auto; background: var(--k-paper2); }
.mb-avatar--txt { display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; color: var(--k-red-deep); }
.mb-row__copy { min-width: 0; }
.mb-name { font-size: 14px; font-weight: 600; line-height: 20px; min-width: 0; }
.mb-tag { flex: 0 0 auto; height: 17px; padding: 0 5px; border-radius: 4px; font-size: 10px; font-weight: 500; line-height: 17px; color: var(--k-ochre-deep); background: var(--k-ochre-soft); }
.mb-tag--ok { color: var(--k-green); background: var(--k-green-soft); }
.mb-phone { display: block; margin-top: 2px; font-size: 12px; color: var(--k-muted); }
.mb-btn { position: relative; flex: 0 0 auto; height: 28px; padding: 0 12px; display: flex; align-items: center; border: 1px solid var(--k-red-line); border-radius: 999px; background: var(--k-paper); font-size: 12px; font-weight: 500; color: var(--k-red-deep); }
/* 看着是 28 高的小胶囊，能点的范围上下各多出 8（共 44 高，原来是 36）：手指粗一点也点得准，两个按钮之间不重叠 */
.mb-btn::after { content: ''; position: absolute; left: -4px; right: -4px; top: -8px; bottom: -8px; }
</style>
