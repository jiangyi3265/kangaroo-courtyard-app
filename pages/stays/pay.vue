<template>
  <k-feature-gate feature="stay-booking">
  <view class="k-page pay" :class="[$userSurface, 'pay--' + s]">
    <k-topbar :title="entryError ? '完善预订信息' : titles[s - 1]" back custom-back @back="onBack" />
    <view v-if="recoveredOrder && s >= 3" class="notice" role="status">
      <text class="notice__title">已找回上次提交的订单</text>
      <text class="notice__text">此次重试沿用原订单的入住信息和金额。{{ o.guestName ? '原入住人：' + o.guestName : '' }}{{ o.guestPhone ? '（手机尾号 ' + String(o.guestPhone).slice(-4) + '）' : '' }}</text>
    </view>

    <view v-if="entryError" class="entry-empty">
      <view class="entry-empty__icon"><k-icon name="house" :size="28" color="red" /></view>
      <text class="entry-empty__title">{{ entry.title }}</text>
      <text class="entry-empty__copy">{{ entry.message }}</text>
      <view class="entry-empty__action"><k-button block @click="recoverSelection">{{ entry.stayId ? '选择房型与日期' : '重新选择小院' }}</k-button></view>
    </view>

    <!-- 1 入住人信息 -->
    <view v-else-if="s === 1" class="k-body k-pad-bottom">
      <view v-if="quoteLoading || quoteError" class="quote-state" role="status">
        <text>{{ quoteLoading ? '正在查询所选人数的最新报价…' : quoteError }}</text>
        <button v-if="quoteError && (memberWalletIds.length||memberFloor)" @click="clearMember">清除会员权益，重新报价</button>
        <button v-if="quoteError && memberWalletIds.length" @click="clearMember">清除免费间夜，重新报价</button>
        <view v-if="quoteError && params.roomTypeId" class="quote-state__retry" role="button" @click="requote">重新查询报价</view>
      </view>
      <k-card :pad="14">
        <view class="k-row-start room">
          <image class="room__img" :src="absUrl(q.stay.cover) || '/static/media/cover-empty.png'" mode="aspectFill" />
          <view class="k-flex1">
            <view class="k-row k-gap8"><text class="room__name">{{ q.stay.stayName || '' }}</text><k-chip v-if="q.stay.safeCert" tone="green">安心住</k-chip></view>
            <text class="room__type">{{ q.stay.typeName || '' }}</text>
            <text class="room__desc">{{ q.stay.summary || '' }}</text>
            <view class="k-row room__price"><text class="k-price">¥{{ minNightText }}</text><text class="k-meta">/晚起</text></view>
          </view>
        </view>
      </k-card>

      <k-card v-if="q.onlinePaymentAvailable === false" class="k-mt12" pad="14px 14px 12px">
        <text class="card-title">本店暂未开通在线收款</text>
        <view class="member-choices">
          <text class="k-meta">{{ paymentBlocked ? '使用免费间夜抵清全款后可填写入住信息。' : '免费间夜已抵清本单房费。' }}</text>
          <button v-for="v in q.memberVouchers || []" :key="v.walletId" :class="{selected: memberWalletIds.includes(v.walletId)}" @click="chooseMember(v.walletId)">免费间夜 #{{ v.walletId }}</button>
          <button v-if="!experience.account" @click="go(R.login)">登录查看免费间夜</button>
          <text v-else-if="!q.memberVouchers?.length" class="k-meta">当前账号没有可用于此房型的免费间夜。</text>
          <button @click="requote">刷新收款状态</button>
        </view>
      </k-card>
      <k-card class="k-mt12" pad="14px 14px 12px">
        <text class="card-title">入住信息</text>
        <view class="stay-dates">
          <view class="stay-dates__day"><text class="stay-dates__label">入住日期</text><text class="stay-dates__date">{{ dayText(q.checkIn) }}</text><text class="stay-dates__week">{{ weekText(q.checkIn) }}</text></view>
          <text class="stay-dates__nights">共{{ nights }}晚</text>
          <view class="stay-dates__day"><text class="stay-dates__label">离店日期</text><text class="stay-dates__date">{{ dayText(q.checkOut) }}</text><text class="stay-dates__week">{{ weekText(q.checkOut) }}</text></view>
        </view>
        <!-- 2026-11-03 主人：简化 —— 人数用加减号（原来弹菜单选）；入住人姓名 / 手机号是页面里的输入框（记住上次的照旧自动带出，能改）；到店时间是按钮组。整屏不再弹任何系统输入框 / 菜单 -->
        <view class="kv"><text class="kv__label">入住人数</text><view class="stepper"><view class="stepper__btn" :class="{ off: guests <= 1 }" hover-class="k-press" @click="changeGuests(-1)"><k-icon name="minus" :size="18" color="ink" /></view><text class="stepper__num">{{ guests }}人</text><view class="stepper__btn" :class="{ off: guests >= guestMax }" hover-class="k-press" @click="changeGuests(1)"><k-icon name="plus" :size="18" color="ink" /></view></view></view>
        <view class="dash" />
        <template v-if="quoteReady && !paymentBlocked">
          <view class="kv kv--field"><text class="kv__label">入住人</text><input v-model="form.guestName" class="kv__field" maxlength="20" placeholder="与证件一致，前台办理入住用" placeholder-class="k-placeholder" @blur="rememberGuest" /></view>
          <view class="kv kv--field"><text class="kv__label">手机号</text><input v-model="form.guestPhone" class="kv__field" type="number" maxlength="11" placeholder="11 位手机号" placeholder-class="k-placeholder" @blur="rememberGuest" /></view>
          <view class="kv kv--col"><text class="kv__label">到店时间</text><view class="arrive-pills"><view v-for="opt in arriveOptions" :key="opt.value" class="arrive-pill" :class="{ on: form.arriveTime === opt.value }" hover-class="k-press-s" @click="form.arriveTime = opt.value"><text>{{ opt.label }}</text></view></view></view>
          <view class="dash" />
          <view class="kv"><text class="kv__label">特殊需求（选填）</text></view>
          <view class="kv kv--input">
            <input v-model="remark" class="kv__input" maxlength="200" placeholder="如：安静房间、晚到店等" placeholder-class="k-placeholder" />
            <k-icon name="pen-line" :size="16" color="muted" />
          </view>
        </template>
      </k-card>

      <view class="note">
        <view class="ic-shield"><k-icon name="shield-check" :size="16" color="green" /></view>
        <text class="note__text">我们将严格保护您的个人信息，仅用于本次预订联系及入住服务</text>
      </view>

      <k-bottom v-if="!paymentBlocked"><k-button block :disabled="!quoteReady || advancing" @click="next">{{ quoteLoading ? '正在查询报价' : (advancing ? '正在确认…' : '确认并下一步') }}</k-button></k-bottom>
    </view>

    <!-- 2 确认订单 -->
    <view v-else-if="s === 2" class="k-body k-pad-bottom">
      <view v-if="paymentBlocked" class="quote-state" role="status"><text>本店暂未开通在线收款。请重新选择免费间夜，直至应付为零。</text><button @click="requote">刷新收款状态</button></view>
      <view v-if="quoteLoading || quoteError" class="quote-state" role="status">
        <text>{{ quoteLoading ? '正在查询所选人数的最新报价…' : quoteError }}</text>
        <button v-if="quoteError && (memberWalletIds.length||memberFloor)" @click="clearMember">清除会员权益，重新报价</button>
        <view v-if="quoteError" class="quote-state__retry" role="button" @click="requote">重新查询报价</view>
      </view>
      <!-- 2026-10-18 主人：确认页加醒目一条「请带好身份证，小院现场登记」（实名登记由小院前台按当地规定现场办理，平台不收身份证） -->
      <view class="idcard">
        <view class="idcard__icon"><k-icon name="id-card" :size="24" color="red" /></view>
        <view class="idcard__copy"><text class="idcard__title">请带好身份证，小院现场登记</text><text class="idcard__sub">入住人本人身份证原件，到店后由小院前台按当地规定办理实名登记</text></view>
      </view>
      <k-card v-if="quoteReady" class="k-mt12" pad="14px 14px 12px">
        <text class="card-title">房费明细</text>
        <view class="fee"><text>房费（{{ nights }}晚）</text><text>¥{{ yuan(q.roomFen) }}</text></view>
        <view v-if="(q.addons || []).length" class="fee fee--group"><text>加购活动</text></view>
        <view v-for="a in (q.addons || [])" :key="a.activityId" class="fee"><text>{{ a.name }}（{{ a.qty }}人）</text><text>¥{{ yuan(a.amountFen) }}</text></view>
        <!-- 10-19 复查：平台服务费、共优惠是 0 时不写「¥0」那一行（没有的东西不显示） -->
        <view v-if="q.serviceFeeFen" class="fee"><text>平台服务费</text><text>¥{{ yuan(q.serviceFeeFen) }}</text></view>
        <view class="dash dash--wide" />
        <view class="fee fee--total"><text class="card-title">合计</text><text class="fee__total">¥{{ yuan(subtotal) }}</text></view>
        <view class="fee-split" />
        <text class="card-title card-title--sub">优惠与活动</text>
        <view v-if="q.memberFloorAvailable || q.memberVouchers?.length || memberWalletIds.length || memberFloor" class="member-choices">
          <text class="k-meta">会员底价与免费间夜二选一，不与其他折扣叠加</text>
          <button v-if="q.memberFloorAvailable" :class="{selected:memberFloor}" :disabled="quoteLoading" @click="chooseFloor">{{ memberFloor?'已选择':'使用' }}会员底价</button>
          <button v-for="v in q.memberVouchers||[]" :key="v.walletId" :class="{selected:memberWalletIds.includes(v.walletId)}" :disabled="quoteLoading" @click="chooseMember(v.walletId)"><k-icon v-if="memberWalletIds.includes(v.walletId)" name="check" :size="12" color="red" />{{ memberWalletIds.includes(v.walletId)?'已选':'选择' }}免费间夜 #{{ v.walletId }}</button>
          <button v-if="memberWalletIds.length||memberFloor" @click="clearMember">不使用会员权益</button>
        </view>
        <view class="fee"><text>{{ q.discountLabel || '暂无可用优惠' }}</text><text class="fee__off">{{ q.discountFen ? '- ¥' + yuan(q.discountFen) : '—' }}</text></view>
        <view v-if="q.discountFen" class="dash dash--wide" />
        <view v-if="q.discountFen" class="fee fee--sum"><text>共优惠 <text class="fee__off">¥{{ yuan(q.discountFen) }}</text></text></view>
      </k-card>

      <k-card class="k-mt12" tone="green" :pad="14">
        <text class="policy__title">{{ (q.policy || {}).title || '' }}</text>
        <text class="policy__copy">{{ (q.policy || {}).copy || '' }}</text>
        <view v-if="(q.stay || {}).safeCert" class="k-row k-gap6 k-mt8">
          <view class="ic-shield"><k-icon name="shield-check" :size="16" color="green" /></view>
          <text class="policy__tag">安心商家</text>
        </view>
      </k-card>

      <!-- 预订须知全文必须阅读到底，再主动勾选，才允许支付。 -->
      <view v-if="(q.agreement || {}).summary" class="notice">
        <text class="notice__title">{{ q.agreement.title || '预订须知' }}</text>
        <k-agreement-reader :content-key="q.agreement.version" :text="q.agreement.summary" :height="noticeHeight" @read="onNoticeRead" />
      </view>
      <view class="agree" @click="onAgreeTap">
        <view class="k-check" :class="{ checked: agreed }"><k-icon v-if="agreed" name="check" :size="12" color="white" /></view>
        <text class="agree__text">我已阅读并同意《{{ q.agreement.title || '预订须知' }}》</text>
      </view>

      <k-bottom pad="12px 16px 10px">
        <view class="k-flex1 paybar">
          <text class="k-meta">待支付金额</text>
          <text class="paybar__amount">¥{{ quoteReady ? yuan(q.payFen) : '--' }}</text>
        </view>
        <!-- k-button 是虚拟节点组件，宽度放在外层 view 上才稳定生效 -->
        <view class="paybar__btn"><k-button block :disabled="submitting || !quoteReady || paymentBlocked || !noticeRead || !agreed" :label="submitting ? '提交中…' : (quoteLoading ? '正在查询报价' : (q.payFen===0 && memberWalletIds.length ? '确认免费预订' : '去支付'))" @click="toPay" /></view>
      </k-bottom>
    </view>

    <!-- 3 微信支付 -->
    <view v-else-if="s === 3" class="k-body k-pad-safe">
      <k-card v-if="!order" :pad="18">
        <text class="card-title">{{ orderLoading ? '正在查询订单' : '订单暂未加载完成' }}</text>
        <text class="safe__line">订单号：{{ activeOrderNo || '—' }}</text>
        <text class="safe__line">{{ orderError || '订单已提交，请稍候。无需重新下单。' }}</text>
        <k-button block class="k-mt16" :disabled="orderLoading || refreshing" @click="syncStatus">{{ orderLoading || refreshing ? '查询中…' : '重新查询订单' }}</k-button>
      </k-card>
      <template v-else>
      <view v-if="orderError" class="notice">
        <text class="notice__title">订单状态暂未更新</text>
        <text class="notice__text">{{ orderError }}，请先查询状态，避免重复付款。</text>
      </view>
      <k-card pad="18px 14px 16px">
        <text class="card-title card-title--lg">订单金额</text>
        <text class="amount">¥{{ yuan(o.payFen || 0) }}</text>
        <text class="amount__name">{{ amountName }}</text>
        <text class="amount__date">{{ orderDates }}</text>
        <view class="k-divider amount__hr" />
        <text class="card-title card-title--lg">支付方式</text>
        <view class="method">
          <k-icon name="wechat" :size="22" color="green" fill />
          <text class="method__name">{{ channelLabel }}</text>
          <k-icon name="circle-check" :size="22" color="green" />
          <!-- 只有一种支付方式、点了也没有可选的：去掉像"可切换"的右箭头 -->
        </view>
      </k-card>

      <k-card class="k-mt12 countdown-card" pad="12px">
        <view class="countdown-row"><text class="card-title card-title--lg">支付倒计时</text><text class="countdown">{{ clock }}</text></view>
        <text class="countdown__tip">{{ paymentDeadlineText }}</text>
      </k-card>

      <k-card class="k-mt12" :pad="14">
        <view class="k-row-start k-gap10">
          <k-icon name="shield-check" :size="24" color="green" />
          <view class="k-col">
            <text class="k-subtitle">支付说明</text>
            <text class="safe__line">{{ paymentExplanation }}</text>
            <text class="safe__line">本页不会收集任何支付密码或银行卡信息</text>
          </view>
        </view>
      </k-card>

      <k-button block class="k-mt16" :disabled="paying || orderLoading || refreshing || cancelling" :label="paying ? '支付处理中…' : (orderLoading || refreshing ? '查询中…' : payBtnText)" @click="pay" />
      <k-button v-if="canCancel" block type="outline" class="k-mt12" :disabled="cancelling || paying || refreshing || orderLoading" :label="cancelling ? '取消中…' : '取消订单'" @click="cancelOrder" />
      <view class="k-home-indicator" />
      </template>
    </view>

    <!-- 4 支付结果 -->
    <view v-else class="k-body k-pad-safe">
      <k-card pad="16px 14px 4px">
        <view v-if="bookingActive" class="k-center-box"><view class="stamp result-mark"><k-icon name="circle-check" :size="40" color="green" /></view></view>
        <text class="success__title">{{ resultTitle }}</text>
        <text class="success__sub">{{ resultSub }}</text>
        <view class="k-divider k-mt16" />
        <view class="info info--copy">
          <text class="info__label">订单号</text>
          <view class="info__copyline"><text class="info__value info__value--center">{{ o.orderNo || '' }}</text>
          <view class="copy" @click="copyNo"><text>复制</text></view></view>
        </view>
        <view class="info"><text class="info__label">支付金额</text><text class="info__value">¥{{ yuan(o.payFen || 0) }}</text></view>
        <view class="info info--last"><text class="info__label">支付时间</text><text class="info__value">{{ paidTimeText }}</text></view>
      </k-card>

      <k-card v-if="bookingActive" class="k-mt12" pad="14px 14px 12px">
        <text class="card-title">已通知门店</text>
        <view class="k-between synced">
          <text class="synced__store">{{ oStay.storeName || oStay.stayName || '—' }}</text>
          <view class="k-row k-gap4">
            <view v-if="paid" class="k-circle k-circle--green synced__ok"><k-icon name="check" :size="12" color="white" /></view>
            <text class="synced__state">{{ paid ? '已通知' : '待通知' }}</text>
          </view>
        </view>
      </k-card>

      <k-card class="k-mt12" pad="14px 14px 14px">
        <text class="next__title">接下来您可以</text>
        <view class="k-grid-3 k-mt10">
          <view v-for="a in nextActions" :key="a.label" class="next" hover-class="k-press-s" @click="a.go()">
            <view class="next__ic"><k-icon :name="a.icon" :size="22" color="red" /></view>
            <text class="next__label">{{ a.label }}</text>
          </view>
        </view>
      </k-card>

      <k-card class="k-mt12 retry-card" pad="12px">
        <view class="k-between k-gap12">
          <view class="k-col k-flex1">
            <text class="retry__line">如未显示支付结果，可重新查询</text>
            <text class="retry__sub">不会重复扣款，请放心</text>
          </view>
          <k-button type="outline" size="sm" :disabled="refreshing || orderLoading" @click="syncStatus">{{ refreshing || orderLoading ? '查询中…' : '重新查询' }}</k-button>
        </view>
      </k-card>
      <view class="k-home-indicator" />
    </view>
  </view>
</k-feature-gate>
</template>

<script setup>
import { stayBookingEnabled, refreshFeatures } from '@/common/features.js'
import { watch as watchStayGate } from 'vue'
import { groupChatEnabled } from '@/common/features.js'
// ---------------------------------------------------------------------------
// 订单确认与支付接入情况：
//   入口 ① 新单：?stayId&roomTypeId&checkIn&checkOut&guests(&promoId&vlogId)，从第 1 屏开始；
//        ② 已有订单：?orderNo=，待支付 → 第 3 屏，已支付 → 第 4 屏，已关闭 → 第 3 屏并如实说明
//   s=1 入住人：姓名 / 手机号是页面里的输入框，到店时间是按钮组，人数用加减号（2026-11-03 主人：简化，不再弹系统输入框 / 菜单）；
//       隐私说明原文保留（只给接待门店、只用于本单）
//   s=2 确认订单：价格、长住优惠、取消政策、预订须知全部来自服务端报价（apiStayQuote），下单时服务端再算一遍
//   s=3 支付：通道由服务端决定（common/pay-flow.js）；联调通道用系统弹窗、写明不扣款，不画任何仿微信界面；
//       倒计时按订单真实截止时间
//   s=4 结果：只有服务端确认"已支付"才显示支付成功；门店通知是真实写入的站内信
// ---------------------------------------------------------------------------
import { absUrl } from '@/common/upload.js'
import { ref, computed, onUnmounted, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiStayQuote, apiStayCreateOrder, apiStayOrder, apiStayCancelOrder, apiPayConfig, apiPayStatus } from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { errText, modal, copy, yuan, serverTs, pad2, todayCn } from '@/common/ui.js'
import { payFlow, channelLabel as labelOf } from '@/common/pay-flow.js'
import { apiStayEnrollActivity } from '@/common/api.js'
import { gated } from '@/common/community.js'
import { dayText, weekText, nightsBetween, stayState, saveStayState } from './stays-state.js'
import { stayPayEntry } from './stays-pay-entry.js'
import R from '@/common/routes.js'

let params = {}
const s = useScreen(4, { onLoad: (query) => { params = query || {}; init() } })
const titles = ['入住人信息', '确认订单', '订单支付', '支付结果']
const entry = ref(null)
const entryError = computed(() => !!entry.value && !entry.value.valid)
const q = ref({ stay: {}, policy: {}, agreement: {}, addons: [], roomFen: 0, addonFen: 0, serviceFeeFen: 0, discountFen: 0, payFen: 0 })
const order = ref(null)
const activeOrderNo = ref('')
const recoveredOrder = ref(false)
const orderLoading = ref(false)
const orderError = ref('')
const refreshing = ref(false)
const payMode = ref('')
const guests = ref(1)
const form = ref({ guestName: '', guestPhone: '', arriveTime: '' })
const remark = ref('')
const agreed = ref(false), noticeRead = ref(false)
function onNoticeRead(value) { noticeRead.value = value; if (!value) agreed.value = false }
const quoteLoading = ref(true)
const quoteError = ref('')
const advancing = ref(false)
let quoteSequence = 0
const quotedKey = ref('')
const memberWalletIds=ref([]),memberFloor=ref(false)
async function chooseMember(id){memberFloor.value=false;memberWalletIds.value=memberWalletIds.value.includes(id)?memberWalletIds.value.filter(x=>x!==id):memberWalletIds.value.concat(id);await requote()}
async function chooseFloor(){memberWalletIds.value=[];memberFloor.value=!memberFloor.value;await requote()}
async function clearMember(){memberWalletIds.value=[];memberFloor.value=false;await requote()}
const paymentBlocked = computed(() => q.value.onlinePaymentAvailable === false &&
  !(q.value.payFen === 0 && q.value.memberMode === 'nights' && memberWalletIds.value.length > 0))
const quoteParams = () => ({
  roomTypeId: Number(params.roomTypeId), checkIn: params.checkIn, checkOut: params.checkOut, guests: guests.value,
  promoId: params.promoId ? Number(params.promoId) : undefined, memberWalletIds:memberWalletIds.value,memberFloor:memberFloor.value
})
const quoteReady = computed(() => !entryError.value && !quoteLoading.value && !quoteError.value && quotedKey.value === JSON.stringify(quoteParams()) && !!q.value.bookable)
const idemKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
// 之前每次从选日期返回再进来，入住人姓名、电话都要重填；现在填好时（以及下单成功后）按账号记在本机，下次自动带出（可以改）
const guestKey = () => `kangaroo:${experience.account?.id || 'guest'}:stay-guest`
function restoreGuest() {
  try {
    const g = uni.getStorageSync(guestKey()) || {}
    if (!form.value.guestName && g.guestName) form.value.guestName = String(g.guestName).slice(0, 20)
    if (!form.value.guestPhone && /^1[3-9]\d{9}$/.test(g.guestPhone || '')) form.value.guestPhone = g.guestPhone
  } catch (e) { /* 读不到本机记录就照常手填 */ }
}
function rememberGuest() {
  try { uni.setStorageSync(guestKey(), { guestName: form.value.guestName, guestPhone: form.value.guestPhone }) } catch (e) { /* 存不下只影响下次是否自动带出 */ }
}

async function init() {
  if(!(await refreshFeatures()).stayBookingEnabled) return
  params.orderNo = String(params.orderNo || '').trim()
  if (!params.orderNo) {
    s.value = 1
    entry.value = stayPayEntry(params, todayCn())
    if (entryError.value) { quoteLoading.value = false; return }
    guests.value = entry.value.guests
  }
  ensureSession().then(restoreGuest).catch(restoreGuest)
  if (params.orderNo) {
    activeOrderNo.value = params.orderNo
    s.value = 3
  }
  try { payMode.value = ((await apiPayConfig()).data || {}).mode || '' } catch (e) { /* 未取得通道时不冒充联调环境 */ }
  if (params.orderNo) {
    return refreshOrderStatus(true)
  }
  await requote()
}
function recoverSelection() {
  const target = stayPayEntry(params, todayCn())
  if (target.datesValid) { stayState.checkIn = target.checkIn; stayState.checkOut = target.checkOut }
  if (target.guestsValid) stayState.guests = target.guests
  saveStayState()
  const url = target.stayId ? R.stayBooking + '?stayId=' + target.stayId + (target.roomTypeId ? '&roomTypeId=' + target.roomTypeId : '') : R.staysList
  uni.redirectTo({ url })
}
async function requote() {
  entry.value = stayPayEntry({ ...params, guests: guests.value }, todayCn())
  if (entryError.value) { quoteSequence++; quotedKey.value = ''; quoteLoading.value = false; return false }
  const sequence = ++quoteSequence, request = quoteParams(), key = JSON.stringify(request)
  const current = () => sequence === quoteSequence && key === JSON.stringify(quoteParams())
  // 只保留门店说明；金额、可订状态与须知都必须由本次报价重新确认。
  q.value = { stay: q.value.stay || {}, checkIn: params.checkIn, checkOut: params.checkOut, policy: {}, agreement: {}, addons: [] }
  quotedKey.value = ''; quoteLoading.value = true; quoteError.value = ''; agreed.value = false; noticeRead.value = false
  try {
    const d = (await apiStayQuote(request)).data
    if (!current()) return false
    if (!d) throw new Error('未取得最新报价，请重新查询')
    // 报价缺 stay / policy 时模板读 q.stay.xx 会整屏渲染出错，补成空对象
    q.value = { ...d, stay: d.stay || {}, policy: d.policy || {}, agreement: d.agreement || {}, addons: d.addons || [] }
    quotedKey.value = key
    if (!d.bookable) quoteError.value = d.reason || '所选日期或人数暂不可订，请返回调整'
    return !!d.bookable
  } catch (e) {
    if (current()) quoteError.value = errText(e, '报价加载失败，请重试')
    return false
  } finally { if (sequence === quoteSequence) quoteLoading.value = false }
}

// ---------------- s=1 入住人 ----------------
const nights = computed(() => q.value.nights || nightsBetween(q.value.checkIn, q.value.checkOut))
const minNight = computed(() => ((q.value.nightly || []).reduce((m, n) => Math.min(m, n.priceFen), Infinity)))
const minNightText = computed(() => (quoteReady.value && Number.isFinite(minNight.value) ? yuan(minNight.value) : '--'))
// 2026-11-03 主人：简化 —— 原来入住人、手机号各弹一个系统输入框、到店时间弹菜单、人数弹菜单（最多 4 个弹窗）；
// 现在全在页面上：两个输入框、到店时间按钮组、人数加减号，一个弹窗都没有。记住上次的姓名 / 手机号照旧自动带出，离开输入框时记一次
// 到店时间按钮组：第一个是「入住当天 15:00 前」（= 不特别说明，存空串），后面按小院入住时间每 2 小时一档
const arriveOptions = computed(() => {
  const checkin = (q.value.stay || {}).checkinTime || '15:00'
  const start = Number(checkin.slice(0, 2))
  const out = [{ value: '', label: `${checkin} 前` }]
  for (let h = start; h <= 23 && out.length < 5; h += 2) out.push({ value: `${pad2(h)}:00后`, label: `${pad2(h)}:00 后` })
  return out
})
// 人数上限：按房型可住人数（床位房按床位数，最多 6）
const guestMax = computed(() => {
  const cap = Math.max(1, Math.min(6, Number((q.value.stay || {}).capacity) || 1)) * ((q.value.stay || {}).unitLabel === '床位' ? 6 : 1)
  return Math.min(6, cap)
})
function changeGuests(delta) {
  const n = guests.value + delta
  if (n < 1 || n > guestMax.value) return
  guests.value = n
  requote()
}
async function next() {
  if (paymentBlocked.value) return toast('本店暂未开通在线收款')
  if (advancing.value) return
  if (!quoteReady.value) return toast(quoteError.value || '请等待最新报价')
  form.value.guestName = String(form.value.guestName || '').trim()
  form.value.guestPhone = String(form.value.guestPhone || '').trim()
  if (!form.value.guestName) return toast('请填写入住人')
  if (form.value.guestName.length > 20) return toast('姓名为 1–20 字')
  if (!form.value.guestPhone) return toast('请填写联系电话')
  if (!/^1[3-9]\d{9}$/.test(form.value.guestPhone)) return toast('请填写正确的手机号')
  rememberGuest()
  const key = JSON.stringify(quoteParams())
  advancing.value = true
  try {
    await ensureSession()
    if (!experience.account) { toast('请先登录'); return go(R.login) }
    if (key !== JSON.stringify(quoteParams())) return
    if (!await requote() || !quoteReady.value || paymentBlocked.value || key !== quotedKey.value) return
    s.value = 2
    // 小屏填写到表单底部后，确认页从身份证提示开始展示。
    await nextTick()
    uni.pageScrollTo({ scrollTop: 0, duration: 0 })
  } finally { advancing.value = false }
}

// ---------------- s=2 确认订单 ----------------
const subtotal = computed(() => q.value.roomFen + q.value.addonFen + q.value.serviceFeeFen)
// 须知已经摊在勾选框上面（2026-10-18；2026-11-03 主人：简化 —— 默认只露前几行，「展开全文」在页面里展开），点勾选框直接勾上 / 取消；
// 老接口没给须知正文时也不再弹窗（之前要弹一个「同意 / 关闭」），须知内容以服务端下单时校验的版本为准
// 须知必须完整展示并阅读至末尾。
async function onAgreeTap() {
  if (!noticeRead.value) return toast('请先从顶部读完预订须知')
  agreed.value = !agreed.value
}
// 下单 / 支付 / 取消都要等服务端返回：连点会重复提交（支付会拉起两次收银台），处理中先锁住按钮
const submitting = ref(false)
const paying = ref(false)
const cancelling = ref(false)
async function toPay() {
  if (paymentBlocked.value) return toast('本店暂未开通在线收款')
  if (!quoteReady.value) return toast(quoteError.value || '请等待最新报价')
  if (!noticeRead.value || !agreed.value) return toast(`请先阅读并同意《${q.value.agreement.title || '预订须知'}》`)
  if (submitting.value) return
  submitting.value = true
  try {
    // 下单已成功但详情加载失败时，只恢复这一单，不再创建订单。
    if (activeOrderNo.value) {
      s.value = 3
      await refreshOrderStatus(true)
      return
    }
    const res = await apiStayCreateOrder({
      roomTypeId: Number(params.roomTypeId), checkIn: q.value.checkIn, checkOut: q.value.checkOut, guests: guests.value,
      promoId: q.value.promoId || undefined, guestName: form.value.guestName, guestPhone: form.value.guestPhone,
      arriveTime: form.value.arriveTime, remark: remark.value, expectedPayFen: q.value.payFen,
      expectedPolicyKey: q.value.policy?.key || undefined,
      agreementVersion: (q.value.agreement || {}).version, idemKey, vlogId: params.vlogId ? Number(params.vlogId) : undefined,
      memberWalletIds:memberWalletIds.value,memberFloor:memberFloor.value,
      selectedActivityIds: String(params.acts || '').split(',').map(Number).filter(Boolean)
    })
    if (!res.data?.orderNo) throw new Error('未取得订单号，请到我的行程核对订单')
    recoveredOrder.value = res.data.recoveredOrder === true
    if (!recoveredOrder.value) rememberGuest()
    activeOrderNo.value = res.data.orderNo
    s.value = 3
    await loadOrder(activeOrderNo.value, true)
  } catch (e) {
    if (e && e.code === 409) {
      await requote()
      modal('预订信息已更新', errText(e, '价格、取消规则或预订须知已更新，请确认后重新提交'), { showCancel: false })
    } else {
      toast(errText(e, '下单失败'))
    }
  } finally {
    submitting.value = false
  }
}

// ---------------- s=3 支付 ----------------
const now = ref(Date.now())
let skew = 0
let timer = null
let loadSequence = 0
let refreshTask = null
let disposed = false
onUnmounted(() => { disposed = true; loadSequence++; if (timer) clearInterval(timer) })
// 微信收银台切回小程序时，重新从服务端同步。这里只查单，不会自动拉起支付。
onShow(() => {
  if (activeOrderNo.value) return refreshOrderStatus(true, true)
  if (s.value === 1 && q.value.onlinePaymentAvailable === false && !quoteLoading.value) return requote()
})
async function loadOrder(orderNo, routeByStatus, silent = false) {
  if (!orderNo || disposed) return false
  activeOrderNo.value = orderNo
  const sequence = ++loadSequence
  orderLoading.value = true
  try {
    const loaded = (await apiStayOrder(orderNo)).data
    if (sequence !== loadSequence || disposed) return false
    if (!loaded?.orderNo || !loaded.status) throw new Error('订单信息暂不可用')
    order.value = loaded
    orderError.value = ''
    skew = serverTs(loaded.serverTime) ? serverTs(loaded.serverTime) - Date.now() : 0
    now.value = Date.now()
    if (!timer) timer = setInterval(() => { now.value = Date.now() }, 1000)
    if (routeByStatus) s.value = loaded.status === 'pending_payment' || loaded.status === 'closed' ? 3 : 4
    return true
  } catch (e) {
    if (sequence !== loadSequence || disposed) return false
    orderError.value = errText(e, '订单加载失败')
    if (!silent) toast(orderError.value)
    return false
  } finally {
    if (sequence === loadSequence) orderLoading.value = false
  }
}
async function refreshOrderStatus(routeByStatus = false, silent = false) {
  if (!activeOrderNo.value || disposed) return false
  if (refreshTask) return refreshTask
  refreshing.value = true
  refreshTask = (async () => {
    if (!order.value && !(await loadOrder(activeOrderNo.value, routeByStatus, silent))) return false
    if (order.value?.payNo) {
      try {
        const status = (await apiPayStatus(order.value.payNo)).data || {}
        if (['wechat', 'mock'].includes(status.channel)) payMode.value = status.channel
      } catch (e) { /* 微信查单暂时失败，仍读取本地服务端订单，不能推断已支付 */ }
    }
    return loadOrder(activeOrderNo.value, routeByStatus, silent)
  })()
  try { return await refreshTask } finally { refreshTask = null; refreshing.value = false }
}
const o = computed(() => order.value || {})
const oStay = computed(() => o.value.stay || q.value.stay || {})
const leftSec = computed(() => {
  const end = serverTs(o.value.expireTime)
  return end ? Math.max(0, Math.floor((end - now.value - skew) / 1000)) : 0
})
const clock = computed(() => (o.value.status === 'pending_payment' && serverTs(o.value.expireTime) ? `${pad2(Math.floor(leftSec.value / 60))}:${pad2(leftSec.value % 60)}` : '--:--'))
const expired = computed(() => o.value.status === 'closed')
const timeElapsed = computed(() => o.value.status === 'pending_payment' && !!serverTs(o.value.expireTime) && leftSec.value === 0)
// 关单原因：用户自己取消（后端 close_reason = 用户取消）与超时关闭分开说，别把主动取消说成超时
const closedText = computed(() => (o.value.closeReason === '用户取消' ? '订单已取消' : '订单已关闭'))
const canCancel = computed(() => o.value.status === 'pending_payment')
const channelLabel = computed(() => labelOf(payMode.value))
// 11-18 返修：预订须知阅读框按正文估算高度，最多 240px（正文短时不留一大块空灰）；只改显示高度，「读到末尾才能勾选」的判断不变
const noticeHeight = computed(() => {
  const t = String((q.value.agreement || {}).summary || '')
  let w = 375
  try { w = (uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()).windowWidth || 375 } catch (e) { /* 取不到屏宽按 375 估 */ }
  const per = Math.max(8, Math.floor((w - 24 - 24 - 34) / 14))
  const lines = t.split('\n').reduce((n, row) => n + Math.max(1, Math.ceil(row.length / per)), 0)
  return Math.min(240, Math.ceil(lines * 24) + 24) + 'px'
})
const paymentDeadlineText = computed(() => expired.value ? closedText.value + '，如需预订请重新下单' : timeElapsed.value ? '付款时间已到，请查询订单最终状态；如已扣款请勿重复支付' : '请在倒计时结束前完成支付，订单状态以服务器为准')
const paymentExplanation = computed(() => payMode.value === 'wechat' ? '点击支付按钮后将拉起微信官方支付界面' : payMode.value === 'mock' ? '当前为联调模拟支付，不会真实扣款' : '支付方式由服务器确认后显示，真实微信支付需在微信小程序内完成')
const payBtnText = computed(() => expired.value || timeElapsed.value || orderError.value ? '查询订单状态' : `${payMode.value === 'wechat' ? '微信支付' : payMode.value === 'mock' ? '模拟支付' : '确认支付方式'} ¥${yuan(o.value.payFen || 0)}`)
const orderDates = computed(() => (o.value.checkIn ? `${dayText(o.value.checkIn)} ${weekText(o.value.checkIn)} - ${dayText(o.value.checkOut)} ${weekText(o.value.checkOut)}（共${o.value.nights || nightsBetween(o.value.checkIn, o.value.checkOut)}晚）` : ''))
// 房源名、房型缺一个时不留孤零零的「 · 」
const amountName = computed(() => [oStay.value.stayName, oStay.value.typeName].filter(Boolean).join(' · '))
async function pay() {
  if (!o.value.orderNo) return
  if (paying.value || refreshing.value || orderLoading.value || cancelling.value) return
  if (expired.value || timeElapsed.value || orderError.value) return syncStatus()
  if (o.value.status !== 'pending_payment') {
    s.value = 4
    return
  }
  paying.value = true
  let result
  let failure
  try {
    result = await payFlow(o.value.payNo)
  } catch (e) {
    failure = e
  } finally {
    // 回前台触发的查询可能早于支付回调；等待它结束后，再读一次最终状态。
    if (refreshTask) await refreshTask
    const loaded = await refreshOrderStatus(false, true)
    if (loaded && o.value.status !== 'pending_payment') {
      s.value = 4
      if (bookingActive.value) await signupPickedActivities()
    } else if (loaded && result?.status === 'cancel') {
      toast('已取消本次支付，可查询订单状态')
    } else if (loaded && !failure) {
      s.value = 4
    } else {
      toast(failure ? errText(failure, '支付结果暂未确认，请查询订单') : '支付结果暂未确认，请重新查询；如已扣款请勿重复支付')
    }
    paying.value = false
  }
}

// 待支付时用户主动取消：后端关单、关闭支付单、释放房量与早鸟名额；成功后按服务端状态刷新本屏
async function cancelOrder() {
  if (!canCancel.value || !o.value.orderNo || cancelling.value || paying.value || refreshing.value || orderLoading.value) return
  const orderNo = o.value.orderNo
  const accountId = experience.account?.id
  const current = () => !disposed && o.value.orderNo === orderNo && experience.account?.id === accountId
  cancelling.value = true
  try {
    const r = await modal('取消订单', '取消后房间会释放给其他人，如需入住请重新下单。确认取消？', { confirmText: '取消订单', cancelText: '再想想' })
    if (!r.confirm || !current() || !canCancel.value) return
    await apiStayCancelOrder(orderNo)
    if (current() && await loadOrder(orderNo, false) && current()) {
      toast(o.value.status === 'closed' ? '订单已取消' : '订单状态已变化，请查看')
    }
  } catch (e) {
    if (current()) {
      toast(errText(e, '取消失败'))
      await loadOrder(orderNo, false, true)
    }
  } finally {
    cancelling.value = false
  }
}

// 预订页勾选的免费活动：住宿支付成功后逐个报名（住宿订单不代收活动费用；需要时先同意《活动参与须知》）
async function signupPickedActivities() {
  const ids = (o.value.selectedActivities || []).filter(a => a.status === 'pending').map(a => a.activityId)
  if (!ids.length) return
  const done = []
  for (const id of ids) {
    try {
      const res = await gated(() => apiStayEnrollActivity(o.value.orderNo, id))
      done.push(res.data.message)
    } catch (e) {
      if (!e || !e.silent) done.push(errText(e, '报名失败'))
      if (e && e.silent) break
    }
  }
  await loadOrder(o.value.orderNo, false)
  if (done.length) modal('活动报名结果', done.join('\n'), { showCancel: false, confirmText: '知道了' })
}

// ---------------- s=4 结果 ----------------
const PAID = ['confirmed', 'checked_in', 'completed', 'no_show', 'refund_pending', 'refunding', 'cancelled']
const paid = computed(() => PAID.includes(o.value.status))
const bookingActive = computed(() => ['confirmed', 'checked_in'].includes(o.value.status))
const resultCopy = computed(() => ({
  confirmed: ['支付成功，已通知门店', '请带好身份证，小院现场登记。'],
  checked_in: ['已办理入住', '祝您在小院度过愉快时光。'],
  completed: ['行程已完成', '感谢您的入住，欢迎分享这次的入住体验。'],
  no_show: ['订单已结束', '本次订单未办理入住，详情请查看订单。'],
  refund_pending: ['退款申请审核中', '请在订单详情查看退款进度，当前不能凭此页办理入住。'],
  refunding: ['退款处理中', '退款结果以订单详情和原支付账户到账记录为准。'],
  cancelled: ['订单已取消', '请在订单详情查看取消及退款记录。'],
  closed: [closedText.value, '请查看订单记录；如已扣款，请查询最新支付及退款状态。']
}[o.value.status] || ['支付结果确认中', '如已扣款请勿重复支付，可点下方重新查询']))
const resultTitle = computed(() => resultCopy.value[0])
const resultSub = computed(() => resultCopy.value[1])
const paidTimeText = computed(() => {
  const t = o.value.paidTime || ''
  return t ? `${t.slice(0, 4)}年${+t.slice(5, 7)}月${+t.slice(8, 10)}日 ${t.slice(11, 16)}` : '—'
})
const copyNo = () => copy(o.value.orderNo || '', '已复制订单号')
// 之前四个入口里没有核销码（「查看订单」和「查看行程」进的是同一屏），付完款找不到到店出示的码。
// 已支付时把「到店核销码」放第一个，换掉重复的「查看订单」
const nextActions = computed(() => [
  ...(['confirmed', 'checked_in'].includes(o.value.status) ? [{ icon: 'qr-code', label: '到店核销码', go: () => go(`${R.stayOrder}?orderNo=${o.value.orderNo}&view=verify`) }] : []),
  ...(bookingActive.value && (o.value.selectedActivities || []).length ? [{ icon: 'calendar', label: '查看附选活动', go: () => go(`${R.stayOrder}?orderNo=${o.value.orderNo}&view=trip`) }] : []),
  ...(bookingActive.value && groupChatEnabled.value ? [{ icon: 'wechat', label: '加入门店群', go: () => go(`${R.stayOrder}?orderNo=${o.value.orderNo}&view=group`) }] : []),
  { icon: 'file-text', label: '查看行程', go: () => go(`${R.stayOrder}?orderNo=${o.value.orderNo}&view=trip`) },
  ...(paid.value ? [] : [{ icon: 'book-text', label: '查看订单', go: () => go(`${R.stayOrder}?orderNo=${o.value.orderNo}`) }])
])
async function syncStatus() {
  if (!activeOrderNo.value || refreshing.value) return
  const loaded = await refreshOrderStatus(false)
  if (!loaded) return
  if (o.value.status !== 'pending_payment') s.value = 4
  toast(o.value.status === 'pending_payment' ? '订单仍待支付；如已扣款请稍后再查' : resultTitle.value)
}
// 已经生成订单后不回到填写屏，避免重复下单。
// 付完款再点返回，之前会退回预订页的「下一步：确认订单」，再点一次就又下了一张新单；现在已支付时跳过预订页，回到房源详情
const onBack = () => {
  if (!activeOrderNo.value && s.value > 1 && s.value < 4) { s.value -= 1; return }
  const pages = getCurrentPages()
  const prev = pages[pages.length - 2]
  if (paid.value && pages.length > 2 && prev && prev.route === 'pages/stays/booking') return uni.navigateBack({ delta: 2 })
  back()
}
watchStayGate(stayBookingEnabled, enabled => { if(enabled) init() })
</script>

<style scoped lang="scss">
.entry-empty { min-height: 310px; padding: 40px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; }
.entry-empty__icon { width: 64px; height: 64px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--k-red-soft); }
.entry-empty__title { font-size: 19px; font-weight: 600; line-height: 1.5; color: var(--k-ink); }
.entry-empty__copy { max-width: 280px; margin-top: 10px; font-size: 14px; line-height: 1.8; color: var(--k-muted); overflow-wrap: anywhere; }
.entry-empty__action { width: 100%; margin-top: 24px; }
.quote-state { margin-bottom: 12px; padding: 16px 12px; display: flex; flex-direction: column; align-items: center; gap: 10px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); color: var(--k-ink2); font-size: 14px; line-height: 1.6; text-align: center; overflow-wrap: anywhere; }
.quote-state__retry { display: flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 16px; border: 1px solid var(--k-red-line); border-radius: 20px; color: var(--k-red-deep); }
.card-title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 24px; }
.card-title--lg { font-size: 18px; }
.dash { border-top: 1px dashed var(--k-line2); margin: 6px 0; }
.dash--wide { margin: 10px 0 8px; }
.ic-shield { position: relative; width: 18px; height: 18px; flex: 0 0 auto; }
.ic-shield__check { position: absolute; left: 4.5px; top: 4px; }

/* s1 */
.room { gap: 14px; }
.room__img { width: 80px; height: 99px; border-radius: 8px; flex: 0 0 auto; }
.room__name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 24px; }
.room__type { display: block; margin-top: 6px; font-size: 14px; line-height: 20px; }
.room__desc { display: block; margin-top: 4px; font-size: 13px; line-height: 18px; color: var(--k-muted); }
.room__price { margin-top: 8px; gap: 1px; align-items: baseline; }
.kv { display: flex; align-items: center; justify-content: space-between; height: 37px; font-size: 15px; }
.kv__label { color: var(--k-ink); }
.kv__value { color: var(--k-ink); }
.kv__sub { font-size: 13px; color: var(--k-muted); }
.kv__nights { margin-left: 10px; }
.kv--input { margin-top: -6px; height: 34px; }
.kv__input { flex: 1; min-width: 0; height: 32px; font-size: 14px; }
.note { display: flex; align-items: center; gap: 6px; margin: 14px 2px 0; }
.note__text { font-size: 12px; line-height: 17px; color: var(--k-muted); }

/* s2 */
.fee { display: flex; align-items: center; justify-content: space-between; height: 30px; font-size: 15px; }
/* 活动名 / 优惠名太长时省略，不换行压到下一行，也不把金额挤出卡片 */
.fee > text:first-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.fee > text:last-child { flex-shrink: 0; margin-left: 8px; }
.fee--group { height: 22px; margin-top: 4px; }
.fee--total { height: 30px; }
.fee--sum { height: 26px; }
.fee__total { color: var(--k-red); font-family: var(--k-sans); font-weight: 700; font-size: 24px; line-height: 1; }
.fee__off { color: var(--k-green); font-weight: 600; font-size: 16px; }
.policy__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 24px; color: var(--k-green); }
.policy__copy { display: block; margin-top: 6px; font-size: 13px; line-height: 23px; color: var(--k-muted); white-space: pre-line; }
/* 2026-10-18：身份证提醒（暖棕渐变底、白字，确认页最上面一眼能看到）+ 预订须知一条一行 */
.idcard { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; background: linear-gradient(120deg, var(--k-red-deep) 0%, #A8743F 100%); box-shadow: 0 6px 18px rgba(138, 94, 54, .22); }
.idcard__icon { width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, .18); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.idcard__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.idcard__title { color: var(--k-paper); font-size: 16px; font-weight: 700; letter-spacing: .5px; }
.idcard__sub { color: rgba(255, 255, 255, .86); font-size: 12px; line-height: 1.5; }
/* 10-19 复查：320 宽时标题一行放不下，「记」一个字掉到第二行；字收一号、去掉字距，一行放下 */
@media (max-width: 359px) { .idcard { gap: 10px; padding: 14px 12px; } .idcard__title { font-size: 15px; letter-spacing: 0; } }
.notice { margin-top: 12px; padding: 14px; border-radius: 16px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.notice__title { display: block; font-size: 15px; font-weight: 700; color: var(--k-ink); overflow-wrap: anywhere; }
.notice__text { display: block; margin-top: 8px; font-size: 13px; line-height: 1.8; color: var(--k-ink2); white-space: pre-line; overflow-wrap: anywhere; }
.policy__tag { font-size: 14px; font-weight: 700; color: #8A6A3A; }
.agree { display: flex; align-items: center; gap: 10px; margin: 16px 6px 0; }
.agree__text { font-size: 14px; min-width: 0; overflow-wrap: anywhere; }
.paybar { display: flex; flex-direction: column; gap: 4px; }
.paybar__amount { color: var(--k-red); font-family: var(--k-sans); font-weight: 700; font-size: 26px; line-height: 1; }
.paybar__btn { width: 156px; flex: 0 0 auto; }

/* s3 */
.amount { display: block; margin-top: 10px; color: var(--k-red); font-family: var(--k-sans); font-weight: 700; font-size: 38px; line-height: 1; }
.amount__name { display: block; margin-top: 14px; font-size: 14px; line-height: 20px; }
.amount__date { display: block; margin-top: 6px; font-size: 13px; line-height: 18px; color: var(--k-muted); }
.amount__hr { margin: 16px 0 14px; }
.method { display: flex; align-items: center; gap: 10px; margin-top: 10px; height: 52px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.method__name { flex: 1; font-size: 15px; }
.countdown { display: block; margin-top: 10px; text-align: center; color: var(--k-alert); font-family: var(--k-sans); font-weight: 700; font-size: 42px; line-height: 1; letter-spacing: 1px; }
.countdown__tip { display: block; margin-top: 10px; text-align: center; font-size: 12px; line-height: 17px; color: var(--k-muted); }
.safe__line { display: block; margin-top: 6px; font-size: 13px; line-height: 18px; color: var(--k-muted); }

/* s4 */
.stamp { width: 160px; height: 105px; }
.success__title { display: block; margin-top: 8px; text-align: center; font-family: var(--k-serif); font-weight: 700; font-size: 20px; line-height: 28px; }
.success__sub { display: block; margin-top: 6px; text-align: center; font-size: 13px; line-height: 18px; color: var(--k-muted); }
.info { display: flex; align-items: center; height: 34px; font-size: 15px; border-bottom: 1px solid rgba(228,220,207,.6); }
.info--last { border-bottom: 0; }
.info__label { width: 80px; color: var(--k-muted); flex: 0 0 auto; }
.info__value { flex: 1; min-width: 0; text-align: right; }
.info__value--center { text-align: center; }
.copy { margin-left: 12px; height: 26px; padding: 0 10px; border: 1px solid var(--k-line2); border-radius: 5px; background: var(--k-paper); font-size: 13px; display: flex; align-items: center; }
.synced { margin-top: 8px; height: 30px; }
.synced__store { flex: 1; min-width: 0; font-size: 15px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.synced__ok { width: 16px; height: 16px; }
.synced__state { color: var(--k-green); font-size: 14px; }
.next__title { display: block; font-size: 15px; line-height: 21px; color: #5C534B; }
.next { height: 72px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.next__label { font-size: 13px; line-height: 1; }
.retry__line { font-size: 14px; line-height: 20px; }
.retry__sub { margin-top: 4px; font-size: 13px; line-height: 18px; color: var(--k-muted); }
/* 支付视觉稿：横向入住日期、分组白卡、固定金额栏。业务状态与操作函数保持原样。 */
@import './stays-premium.scss';
.pay { @include stays-surface; background: linear-gradient(150deg,#F9F2EA,#FFFDFC 380px,#FAF5EF); }
.pay>.k-body { padding-top: 8px; }
.pay :deep(.k-card) { border: 1px solid rgba(184,156,124,.12); box-shadow: 0 3px 10px rgba(80,53,31,.07); }
.pay :deep(.k-button) { border-radius: 999px; }
.pay :deep(.k-bottom) { background: rgba(255,253,250,.98); border-top-color: #EDE2D6; }
.pay--1 :deep(.k-bottom .k-button) { background: linear-gradient(105deg,#B6814E,#7F4F2D); }
.pay--2 :deep(.k-bottom .k-button) { background: linear-gradient(110deg,#FFAF36,#FF811C); color: white; }
.pay--1 :deep(.k-bottom .k-button.is-disabled), .pay--2 :deep(.k-bottom .k-button.is-disabled) { background: var(--k-paper2); color: var(--k-light); box-shadow: none; }
.card-title { font-size: 19px; line-height: 1.4; color: #482C1C; }
.room { gap: 12px; align-items: center; }
.room__img { width: 117px; height: 100px; border-radius: 9px; }
.room__name { font-size: 18px; white-space: normal; line-height: 1.4; }
.room>.k-flex1>.k-row:first-child { flex-wrap: wrap; gap: 4px; }
.room__type { font-size: 15px; margin-top: 5px; color: #4F3424; font-weight: 600; }
.room__desc { font-size: 12px; line-height: 1.5; margin-top: 4px; }
.room__price { margin-top: 6px; }
.room__price .k-price { font-size: 27px; line-height: 1; color: #8C5327; }
.stay-dates { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); gap: 9px; align-items: center; margin: 12px 0 10px; }
.stay-dates__day { min-width: 0; padding: 9px 12px; border: 1px solid #E9E1D8; border-radius: 9px; display: flex; flex-direction: column; gap: 3px; background: #FFFEFC; }
.stay-dates__label,.stay-dates__week { font-size: 11px; color: #77685C; }
.stay-dates__date { font-size: 19px; font-weight: 700; color: #482C1C; white-space: nowrap; }
.stay-dates__nights { padding: 6px 9px; border-radius: 999px; background: #FFF0DC; color: #895328; font-size: 11px; }
.kv { height: auto; min-height: 42px; border-top: 1px solid #EDE5DD; font-size: 14px; gap: 12px; }
.kv__value { text-align: right; }
.kv>.k-row { min-width: 0; flex-shrink: 0; }
.kv__label { color: #4B3425; }
.kv--input { min-height: 40px; margin-top: 0; padding: 0 10px; border: 1px solid #E9E1D8; border-radius: 9px; background: var(--k-page); }
.kv__input { font-size: 13px; }
/* 2026-11-03 主人：简化 —— 入住人信息屏改成页面内填写：输入框一行、到店时间按钮组、人数加减号（按钮都 ≥32px 高、加减号 36px，老年人好点） */
.kv--field { gap: 10px; }
.kv__field { flex: 1; min-width: 0; height: 44px; padding: 0 10px; border: 1px solid #E9E1D8; border-radius: 9px; background: var(--k-page); font-size: 15px; text-align: left; }
.kv--col { flex-direction: column; align-items: stretch; gap: 8px; padding: 10px 0; }
.arrive-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.arrive-pill { min-height: 44px; padding: 0 14px; border: 1px solid transparent; border-radius: 18px; background: #F4F1EC; color: var(--k-ink); font-size: 14px; display: flex; align-items: center; }
.arrive-pill.on { border-color: #E0A86E; background: #FCEBD7; color: #A0632E; font-weight: 700; }
.stepper { display: flex; align-items: center; gap: 4px; }
.stepper__btn { width: 44px; height: 44px; border: 1px solid #E9E1D8; border-radius: 50%; background: #FFFEFC; display: flex; align-items: center; justify-content: center; }
.stepper__btn.off { opacity: .35; }
.stepper__num { min-width: 44px; text-align: center; font-size: 16px; font-weight: 700; color: #482C1C; }
.notice__text--clamp { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 4; overflow: hidden; }
.notice__toggle { display: flex; align-items: center; justify-content: center; gap: 2px; min-height: 44px; margin-top: 4px; color: var(--k-red); font-size: 14px; font-weight: 600; }
.dash { display: none; }
.dash--wide { display: block; border-top-style: solid; }
.note { margin: 10px 4px 0; }
.note__text { font-size: 11px; line-height: 1.6; }
.idcard { padding: 12px; gap: 10px; background: #FFF5E7; border: 1px solid #F4DFC5; border-radius: 13px; box-shadow: 0 3px 9px rgba(100,63,31,.06); }
.idcard__icon { width: 35px; height: 38px; background: transparent; border-radius: 0; }
.idcard__title { font-size: 15px; line-height: 1.5; color: #754726; letter-spacing: 0; }
.idcard__sub { font-size: 11px; color: #8A684E; line-height: 1.6; }
.fee { min-height: 35px; height: auto; font-size: 14px; }
.fee--total { padding-top: 4px; }
.fee__total { font-size: 28px; color: #8F5426; }
.pay :deep(.k-card.is-green) { background: #EEF5ED; border-color: #DFE9DD; }
.policy__title { color: #365D41; font-size: 17px; }
.policy__copy { font-size: 12px; line-height: 1.75; }
.policy__tag { font-size: 12px; color: #2F734A; }
.notice { border: 1px solid #EEE5DB; border-radius: 13px; box-shadow: 0 3px 9px rgba(80,53,31,.06); }
.notice__title { font-size: 18px; color: #482C1C; }
.notice__text { font-size: 13px; line-height: 1.8; }
.agree { margin: 13px 4px 0; font-size: 13px; }
.agree__text { font-size: 13px; }
.paybar__amount { font-size: 30px; color: #8F5426; }
.paybar__btn { width: 145px; }
.amount { color: #8C5327; font-size: 40px; }
.amount__name { font-size: 16px; color: #4B3425; }
.method { border-color: #DFEBDD; background: #F8FBF7; }
.countdown { font-size: 36px; letter-spacing: 3px; }
.result-mark { width: 72px; height: 72px; border-radius: 50%; background: #EDF6EA; display: flex; align-items: center; justify-content: center; }
.success__title { font-size: 22px; }
.success__sub { line-height: 1.6; }
.info { min-height: 40px; height: auto; font-size: 13px; }
.info__value--center { overflow-wrap: anywhere; font-size: 12px; }
.copy { padding: 0 8px; border-radius: 999px; font-size: 11px; }
.next { background: #FBF6EF; border-color: #EEE2D3; }
.next__label { font-size: 12px; }
@media(max-width:359px) {
 .room__img { width: 96px; height: 96px; } .room__name { font-size: 16px; } .room__type { font-size: 13px; }
 .stay-dates { gap: 5px; } .stay-dates__day { padding: 8px; } .stay-dates__date { font-size: 17px; } .stay-dates__nights { padding: 5px 6px; font-size: 10px; }
 .kv { font-size: 12px; } .kv>.k-row { gap: 5px; } .idcard { padding: 10px; gap: 7px; } .idcard__title { font-size: 13px; }
 .paybar__btn { width: 128px; } .paybar__amount { font-size: 27px; } .next__label { font-size: 11px; }
}

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底 + 纯白卡（12 圆角），卡片不加阴影、不描边；标题和金额的字收小一档，
   底部主按钮统一成 44 高的暖棕胶囊。输入框、人数加减号、到店时间按钮仍是 44 高、14–15 号字（年纪大的人好点）。
   只改样子：金额、时限、政策、须知这些文字和所有操作都没动。上面几轮的规则保留不动，这里统一用 .pay 开头的规则盖过去。 */
.pay { @include stays-fine; }
.pay>.k-body { padding-left: 12px; padding-right: 12px; }
.pay :deep(.k-card) { border: 0; border-radius: 12px !important; box-shadow: none; }
.pay :deep(.k-card.k-mt12) { margin-top: 8px; }
.pay :deep(.k-card.is-green) { border: 0; background: var(--k-paper); }
.pay :deep(.k-button.is-lg) { height: 44px; box-shadow: none; font-size: 15px; }
.pay :deep(.k-button.is-primary) { background: linear-gradient(135deg,#B5814D,#8E5E33); }
.pay :deep(.k-bottom) { background: var(--k-paper); border-top-color: var(--k-line); }
.pay :deep(.k-bottom__inner) { padding: 8px 12px !important; }
.pay--1 :deep(.k-bottom .k-button), .pay--2 :deep(.k-bottom .k-button) { background: linear-gradient(135deg,#B5814D,#8E5E33); color: var(--k-paper); }
.pay .entry-empty__icon { width: 56px; height: 56px; margin-bottom: 14px; }
.pay .entry-empty__title { font-size: 16px; font-weight: 600; }
.pay .entry-empty__copy { margin-top: 6px; font-size: 13px; line-height: 20px; }
.pay .quote-state { margin-bottom: 8px; padding: 12px; border: 0; border-radius: 12px; font-size: 13px; }
.pay .quote-state__retry { min-height: 36px; border-radius: 18px; font-size: 13px; }
.pay .card-title, .pay .card-title--lg { color: var(--k-ink); font-family: var(--k-sans); font-size: 15px; font-weight: 700; line-height: 21px; }
/* 入住人信息 */
.pay .room { gap: 10px; }
.pay .room__img { width: 88px; height: 88px; border-radius: 8px; }
.pay .room__name { font-family: var(--k-sans); font-size: 15px; font-weight: 600; line-height: 21px; }
.pay .room__type { margin-top: 3px; color: var(--k-ink2); font-size: 13px; font-weight: 500; line-height: 19px; }
.pay .room__desc { margin-top: 2px; font-size: 11px; line-height: 16px; }
.pay .room__price .k-price { color: var(--k-red-deep); font-size: 18px; line-height: 24px; }
.pay .stay-dates { gap: 8px; margin: 10px 0 8px; }
.pay .stay-dates__day { padding: 8px 10px; gap: 1px; border: 0; border-radius: 8px; background: var(--k-page); }
.pay .stay-dates__label, .pay .stay-dates__week { color: var(--k-muted); font-size: 11px; line-height: 16px; }
.pay .stay-dates__date { color: var(--k-ink); font-size: 16px; font-weight: 600; line-height: 22px; }
.pay .stay-dates__nights { padding: 2px 8px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 11px; line-height: 16px; }
.pay .kv { min-height: 44px; border-top-color: var(--k-line); }
/* 复查：姓名、手机号两个输入框上下贴在一起，加减号也顶着分隔线 —— 各留 6px 的空，输入框和按钮本身仍是 44 高 */
.pay .kv--field { padding: 6px 0; }
.pay .stepper { margin: 6px 0; }
.pay .kv__label { color: var(--k-ink2); }
.pay .kv__field { border-color: var(--k-line2); border-radius: 8px; background: var(--k-paper); }
.pay .kv--input { min-height: 44px; border-color: var(--k-line2); border-radius: 8px; background: var(--k-paper); }
.pay .kv__input { height: 42px; font-size: 14px; }
.pay .arrive-pill { border-radius: 22px; background: var(--k-fill); color: var(--k-ink2); }
.pay .arrive-pill.on { border-color: var(--k-red-line); background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
.pay .stepper__btn { border-color: var(--k-line2); background: var(--k-paper); }
.pay .stepper__num { color: var(--k-ink); font-size: 15px; font-weight: 600; }
/* 确认订单 */
.pay .idcard { padding: 10px 14px; border: 0; border-radius: 12px; background: #FFF8EE; box-shadow: none; }
.pay .idcard__icon { width: 28px; height: 28px; }

.pay .idcard__title { color: var(--k-ink); font-size: 14px; font-weight: 600; line-height: 20px; }
.pay .idcard__sub { color: var(--k-muted); font-size: 11px; line-height: 16px; }
.pay .fee { min-height: 32px; font-size: 13px; }
.pay .fee--sum>text { margin-left: 0; }
.pay .dash--wide { border-top-color: var(--k-line); }
.pay .fee__total { color: var(--k-red-deep); font-size: 20px; }
.pay .fee__off { color: var(--k-green); font-size: 14px; }
.pay .policy__title { color: var(--k-green); font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 20px; }
.pay .policy__copy { margin-top: 4px; font-size: 12px; line-height: 19px; }
.pay .policy__tag { color: var(--k-green); font-size: 12px; font-weight: 500; }
.pay .notice { margin-top: 8px; padding: 14px; border: 0; border-radius: 12px; box-shadow: none; }
.pay .notice__title { color: var(--k-ink); font-size: 15px; font-weight: 700; line-height: 21px; }
.pay .notice__text { margin-top: 6px; font-size: 12px; line-height: 19px; }
.pay .member-choices button, .pay .member-recover button { border-color: transparent; border-radius: 8px; background: var(--k-fill); color: var(--k-ink2); }
.pay .member-choices button.selected { border-color: var(--k-red-line); background: var(--k-red-soft); color: var(--k-red-deep); }
.pay .paybar { gap: 0; }
.pay .paybar__amount { color: var(--k-red-deep); font-size: 22px; line-height: 28px; }
.pay .paybar__btn { width: 132px; }
/* 支付 / 结果 */
.pay .amount { margin-top: 6px; color: var(--k-red-deep); font-size: 30px; }
.pay .amount__name { margin-top: 10px; color: var(--k-ink); font-size: 14px; }
.pay .amount__date { margin-top: 4px; font-size: 12px; }
.pay .amount__hr { margin: 12px 0; }
.pay .method { height: 48px; margin-top: 8px; border: 0; border-radius: 8px; background: var(--k-page); }

.pay .method__name { font-size: 14px; }
.pay .countdown { margin-top: 6px; font-size: 30px; letter-spacing: 2px; }
.pay .countdown__tip { margin-top: 6px; }
.pay .safe__line { margin-top: 4px; font-size: 12px; }
.pay .result-mark { width: 64px; height: 64px; }

.pay .success__title { font-family: var(--k-sans); font-size: 17px; font-weight: 700; line-height: 24px; }
.pay .success__sub { margin-top: 4px; font-size: 12px; }
.pay .info { border-bottom-color: var(--k-line); }
.pay .copy { height: 26px; padding: 0 10px; border-color: var(--k-red-line); border-radius: 13px; color: var(--k-red-deep); font-size: 11px; }
.pay .synced__store { font-size: 14px; }
.pay .synced__state { font-size: 13px; }
.pay .next__title { color: var(--k-ink2); font-size: 13px; }
.pay .next { height: 64px; gap: 6px; border: 0; border-radius: 8px; background: var(--k-page); }
.pay .retry__line { font-size: 13px; }
.pay .retry__sub { margin-top: 2px; font-size: 11px; }
/* 2026-11-18 第二轮精修：没选好房型 / 日期时的提示放进白卡（图标 36 暖灰、标题 14 / 500），按钮收成 32 高的次按钮小胶囊；
   退改政策卡改白底（绿色只留在标题字和小盾牌上）；卡内边距统一 12；金额、倒计时数字等宽，倒计时跳秒时不再左右抖；
   「取消订单」「重新查询」这类描边钮用暖棕细边 + 深棕字（和全站次按钮一致）。 */
.pay :deep(.k-card) { padding: 12px !important; }
.pay--4 :deep(.k-card:first-child) { padding-bottom: 4px !important; } /* 复查：支付结果卡最后一行「支付时间」行高 40、字下面本来就有空，模板写的底边距是 4，这里照旧，不然卡片下面多出一截空白 */
.pay .entry-empty { min-height: 0; margin: 8px 12px; padding: 28px 12px; border-radius: 12px; background: var(--k-paper); }
.pay .entry-empty__icon { width: 40px; height: 40px; margin-bottom: 8px; background: transparent; }
.pay .entry-empty__title { color: var(--k-ink2); font-size: 14px; font-weight: 500; line-height: 20px; }
.pay .entry-empty__copy { margin-top: 4px; font-size: 12px; line-height: 1.6; }
.pay .entry-empty__action { width: auto; margin-top: 12px; }
/* 复查：按钮看上去 32 高，四周 6px 透明边把可点范围撑回原来的 44（负边距抵掉，位置不变）；细棕边改由内阴影画 */
.pay .entry-empty__action :deep(.k-button.is-primary) { width: auto; height: 44px; margin: -6px 0; padding: 0 14px; border: 6px solid transparent; border-radius: 22px; background: var(--k-paper); background-clip: padding-box; box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
.pay .countdown, .pay .amount, .pay .paybar__amount, .pay .fee__total { font-variant-numeric: tabular-nums; }
.pay :deep(.k-button.is-outline) { border-color: var(--k-red-line); color: var(--k-red-deep); }
@media (max-width: 359px) {
  .pay .room__img { width: 80px; height: 80px; }
  .pay .stay-dates__date { font-size: 15px; }
  .pay .kv { font-size: 13px; }
  .pay .idcard__title { font-size: 13px; }
  .pay .paybar__btn { width: 120px; }
  .pay .paybar__amount { font-size: 20px; }
}
/* 2026-11-18 第三轮逐页精修：
   · 卡片标题统一 16 / 700；卡片内边距 16；卡与卡 12；
   · 「接下来您可以」三个入口：40 浅棕圆角方块 + 22 号暖棕线稿，下面 12 号字，不再是灰底大块；
   · 缺房源信息的空状态：图标放进 56 浅棕方块，说明限宽 248 居中，两行长度均衡（不再剩一个字）；会员券「已选」前的对勾换成图标。 */
.pay .card-title, .pay .card-title--lg { font-size: 16px; line-height: 22px; }
.pay .next__title { color: var(--k-ink); font-size: 16px; font-weight: 700; line-height: 22px; }
.pay .next { height: auto; padding: 12px 0 10px; gap: 8px; border: 0; border-radius: 12px; background: transparent; }
.pay .next__ic { width: 40px; height: 40px; border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.pay .next__label { color: var(--k-ink2); font-size: 12px; line-height: 16px; }
.pay .entry-empty__icon { width: 56px; height: 56px; margin-bottom: 10px; border-radius: 16px; background: var(--k-red-soft); }
.pay .entry-empty__copy { max-width: 248px; margin-left: auto; margin-right: auto; }
.pay .member-choices button { display: inline-flex; align-items: center; gap: 4px; }
.pay .amount { font-size: 28px; line-height: 36px; color: var(--k-red); }
.pay .amount__name { margin-top: 4px; }
/* 2026-11-18 第三轮返修（独立评审第 1 轮）：
   · 到店时间：三列网格，没选的白底 + 发丝框，选中浅棕底 + 细棕框（和筛选页的选项一个样）；
   · 隐私说明 / 安心商家前的盾牌换成线性 shield-check 16；
   · 确认订单：房费明细「合计」降成 15 / 600 墨色，全页只有底部「待支付」是暖棕大字；预订须知卡内边距 12、标题 16 / 700，阅读框去掉描边；
   · 订单支付：倒计时 24 / 700 提醒色、整卡左对齐，金额仍是唯一大字；
   · 支付结果：订单号右对齐贴着「复制」；底部「如未显示支付结果」改成白卡；缺房源空状态换成房子图标。 */
.pay .arrive-pills { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: 100%; }
.pay .arrive-pill { min-width: 0; min-height: 36px; padding: 0 4px; justify-content: center; border: 0; border-radius: 8px; background: var(--k-paper); box-shadow: inset 0 0 0 1px var(--k-line2); color: var(--k-ink2); font-size: 13px; font-weight: 400; white-space: nowrap; }
.pay .arrive-pill.on { background: var(--k-red-soft); box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-weight: 500; }
.pay .ic-shield { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; }
.pay .fee--total .card-title { color: var(--k-ink); font-size: 14px; font-weight: 500; }
.pay .fee__total { color: var(--k-ink); font-size: 15px; font-weight: 600; line-height: 22px; }
.pay .idcard { padding: 12px; }
.pay .notice { padding: 12px; }
.pay .notice__title { font-size: 16px; font-weight: 700; line-height: 22px; }
.pay .notice :deep(.ar-scroll) { border: 0; }
.pay .countdown-card .card-title { text-align: left; }
.pay .countdown { margin-top: 6px; color: var(--k-alert); font-size: 24px; font-weight: 700; line-height: 30px; letter-spacing: 0; text-align: left; }
.pay .countdown__tip { text-align: left; }
.pay .info__value--center { flex: 1 1 auto; margin-right: 8px; text-align: right; font-size: 14px; }
.pay .retry-card { background: var(--k-paper); }
/* 11-18 第三轮返修（独立评审第 2 轮）：
   · 订单支付：倒计时不再和金额抢焦点 —— 「支付倒计时」和时间排一行，时间 15 / 600 提醒色等宽，说明 12 灰；
   · 支付方式行白底发丝框，右边绿色勾表示已选；
   · 支付结果：订单号一行的「复制」挪到值下面右对齐（12 号文字链），三行的值右边对齐到同一条线；
   · 步进器圆钮和输入框同为 44；小屏房源卡设施一行省略。 */
.pay .countdown-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pay .countdown-row .card-title { margin: 0; color: var(--k-ink2); font-size: 14px; font-weight: 500; line-height: 20px; }
.pay .countdown-row .countdown { display: block; margin: 0; color: var(--k-alert); font-size: 15px; font-weight: 600; line-height: 20px; letter-spacing: 0; text-align: right; font-variant-numeric: tabular-nums; }
.pay .countdown-card .countdown__tip { margin-top: 4px; color: var(--k-muted); font-size: 12px; line-height: 18px; text-align: left; }
.pay .method { gap: 8px; padding: 0 12px; border: 1px solid var(--k-line); background: var(--k-paper); }
.pay .method__name { flex: 1; }
.pay .info--copy { flex-wrap: wrap; padding: 8px 0 6px; }
.pay .info--copy .info__value--center { flex: 1 1 auto; margin-right: 0; }
.pay .info--copy .copy { flex: 0 0 100%; height: 18px; margin: 2px 0 0; padding: 0; border: 0; border-radius: 0; background: transparent; justify-content: flex-end; color: var(--k-red-deep); font-size: 12px; line-height: 18px; }
.pay .stepper__btn { width: 44px; height: 44px; }
@media (max-width: 359px) { .pay .room__desc { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }
</style>

<style scoped>.member-choices{padding:12px 0;display:flex;flex-wrap:wrap;gap:8px}.member-choices>.k-meta{width:100%;font-size:12px}.member-choices button,.member-recover button{font-size:12px;line-height:1.5;padding:9px 12px;background:#f6eee2;color:#86603a;border-radius:10px;margin:0;border:1px solid #e4d4bd}.member-choices button.selected{border-color:#9c713c;background:#eee0c9}.member-choices button::after{border:0}.member-recover{padding:12px 16px}
/* 11-18 第四轮返修：房费明细和优惠合成一张「费用」卡（中间发丝线）；支付结果订单号和「复制」同一行；320 宽房源名不在词中间断开、倒计时说明一行放下；缺房源说明两行等长。 */
.pay .fee-split{height:1px;margin:12px 0;background:var(--k-line);transform:scaleY(.5)}
.pay .card-title--sub{display:block}
.pay .info--copy{flex-wrap:nowrap}
.pay .info__copyline{flex:1 1 auto;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:6px}
.pay .info--copy .info__copyline .info__value--center{flex:0 1 auto;min-width:0;margin:0}
.pay .info--copy .info__copyline .copy{flex:0 0 auto;width:auto;height:20px;margin:0;line-height:20px}
.pay .amount__name{word-break:keep-all;overflow-wrap:anywhere}
.pay .entry-empty__copy{max-width:230px}
@media (max-width:340px){.pay .countdown-card .countdown__tip{font-size:11px;line-height:16px}}
/* <<R6-BEGIN>> */
/* 11-18 第四轮：缺参数整页空态不套白卡，放在页面底上往下挪约四分之一屏；说明限宽 13em，在逗号后断行，两行长短平衡；按钮 32 高次按钮。 */
.pay .entry-empty { margin: 84px 0 0; padding: 0 16px; border-radius: 0; background: transparent; box-shadow: none; }
.pay .entry-empty__copy { max-width: 13em; }
.pay .entry-empty__action { margin-top: 16px; }
.pay .entry-empty__action :deep(.k-button.is-primary) { height: 32px; margin: 0; padding: 0 16px; border: 1px solid var(--k-red-line); border-radius: 16px; background: var(--k-paper); box-shadow: none; color: var(--k-red-deep); font-size: 13px; }
/* 11-19 独立复评返修：320 宽房型说明（「6人 · 公共卫浴 · 空调 · 独卫…」）改成完整换行，不再被省略号吃掉。 */
@media (max-width: 359px) {
  .pay .room__desc { white-space: normal; overflow: visible; text-overflow: clip; }
}
/* 11-19 微信实拍返修：缺参数页唯一出路做成主角 —— 「重新选择小院 / 选择房型与日期」40 高实心暖棕、左右 24、14/600；标题 16/600 墨色，说明 13 灰、行高 20。 */
.pay .entry-empty__title { color: var(--k-ink); font-size: 16px; font-weight: 600; line-height: 22px; }
.pay .entry-empty__copy { margin-top: 4px; color: var(--k-muted); font-size: 13px; line-height: 20px; }
.pay .entry-empty__action :deep(.k-button.is-primary) { height: 40px; min-height: 40px; padding: 0 24px; border: 0; border-radius: 20px; background: var(--k-grad-brown); box-shadow: none; color: var(--k-paper); font-size: 14px; font-weight: 600; }
/* <<R6-END>> */
</style>

<style scoped lang="scss">
.pay.user-surface {
  .stay-dates { border-radius: 10px; background-color: var(--k-red-soft); }
  .stay-dates__date, .fee__total, .paybar__amount { font-variant-numeric: tabular-nums; }
  .kv--field:focus-within, .kv--input:focus-within { box-shadow: inset 0 -1px var(--k-red-line); }
  .paybar__btn { min-height: 44px; border-radius: 11px; }
}
</style>
