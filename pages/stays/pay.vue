<template>
  <view class="k-page pay">
    <k-topbar :title="titles[s - 1]" back @back="onBack" />

    <!-- 1 入住人信息 -->
    <view v-if="s === 1" class="k-body k-pad-bottom">
      <k-card :pad="14">
        <view class="k-row-start room">
          <image class="room__img" src="/static/media/pay-room.jpg" mode="aspectFill" />
          <view class="k-flex1">
            <view class="k-row k-gap8"><text class="room__name">大理喜洲小院</text><k-chip tone="green">安心住</k-chip></view>
            <text class="room__type">庭院多人间</text>
            <text class="room__desc">1张床位 · 公共卫浴 · 可做饭</text>
            <view class="k-row room__price"><text class="k-price">¥98</text><text class="k-meta">/晚起</text></view>
          </view>
        </view>
      </k-card>

      <k-card class="k-mt12" pad="14px 14px 12px">
        <text class="card-title">入住信息</text>
        <view class="kv"><text class="kv__label">入住日期</text><view class="k-row k-gap6"><text class="kv__value">9月5日</text><text class="kv__sub">周五</text></view></view>
        <view class="kv"><text class="kv__label">离店日期</text><view class="k-row k-gap6"><text class="kv__value">9月12日</text><text class="kv__sub">周五</text><text class="kv__sub kv__nights">共7晚</text></view></view>
        <view class="kv"><text class="kv__label">入住人数</text><text class="kv__value">1人</text></view>
        <view class="dash" />
        <view v-for="row in guestRows" :key="row.label" class="kv" @click="toast('编辑' + row.label)">
          <text class="kv__label">{{ row.label }}</text>
          <view class="k-row k-gap10"><text class="kv__value">{{ row.value }}</text><k-icon name="pen-line" :size="16" color="muted" :stroke="1.6" /></view>
        </view>
        <view class="dash" />
        <view class="kv"><text class="kv__label">特殊需求（选填）</text></view>
        <view class="kv kv--input">
          <input v-model="remark" class="kv__input" placeholder="如：安静房间、晚到店等" placeholder-class="k-placeholder" />
          <k-icon name="pen-line" :size="16" color="muted" :stroke="1.6" />
        </view>
      </k-card>

      <view class="note">
        <view class="ic-shield"><k-icon name="shield" :size="18" color="green" fill :stroke="0.5" /><k-icon class="ic-shield__check" name="check" :size="9" color="white" :stroke="3.2" /></view>
        <text class="note__text">我们将严格保护您的个人信息，仅用于本次预订联系及入住服务</text>
      </view>

      <k-bottom><k-button block @click="s = 2">确认并下一步</k-button></k-bottom>
    </view>

    <!-- 2 确认订单 -->
    <view v-else-if="s === 2" class="k-body k-pad-bottom">
      <k-card pad="14px 14px 12px">
        <text class="card-title">房费明细</text>
        <view class="fee"><text>房费（¥98/晚 × 7晚）</text><text>¥686</text></view>
        <view class="fee fee--group"><text>加购活动</text></view>
        <view class="fee"><text>老山徒步体验（1人）</text><text>¥68</text></view>
        <view class="fee"><text>平台服务费</text><text>¥0</text></view>
        <view class="dash dash--wide" />
        <view class="fee fee--total"><text class="card-title">合计</text><text class="fee__total">¥754</text></view>
      </k-card>

      <k-card class="k-mt12" pad="14px 14px 12px">
        <text class="card-title">优惠与活动</text>
        <view class="fee"><text>安心商家专享券</text><text class="fee__off">- ¥20</text></view>
        <view class="dash dash--wide" />
        <view class="fee fee--sum"><text>共优惠 <text class="fee__off">¥20</text></text></view>
      </k-card>

      <k-card class="k-mt12" tone="green" :pad="14">
        <text class="policy__title">入住前7天可免费退</text>
        <text class="policy__copy">9月5日 18:00前可免费取消，之后取消将扣除首晚房费。如遇不可抗力，可凭证明申请免费退订。</text>
        <view class="k-row k-gap6 k-mt8">
          <view class="ic-shield"><k-icon name="shield" :size="18" color="green" fill :stroke="0.5" /><k-icon class="ic-shield__check" name="check" :size="9" color="white" :stroke="3.2" /></view>
          <text class="policy__tag">安心商家</text>
        </view>
      </k-card>

      <view class="agree" @click="agreed = !agreed">
        <view class="k-check" :class="{ checked: agreed }"><k-icon v-if="agreed" name="check" :size="12" color="white" :stroke="3" /></view>
        <text class="agree__text">我已阅读并同意《预订须知》</text>
      </view>

      <k-bottom pad="12px 16px 10px">
        <view class="k-flex1 paybar">
          <text class="k-meta">待支付金额</text>
          <text class="paybar__amount">¥754</text>
        </view>
        <k-button class="paybar__btn" @click="toPay">去支付</k-button>
      </k-bottom>
    </view>

    <!-- 3 微信支付 -->
    <view v-else-if="s === 3" class="k-body">
      <k-card pad="18px 14px 16px">
        <text class="card-title card-title--lg">订单金额</text>
        <text class="amount">¥754</text>
        <text class="amount__name">大理喜洲小院 · 庭院多人间</text>
        <text class="amount__date">9月5日 周五 - 9月12日 周五（共7晚）</text>
        <view class="k-divider amount__hr" />
        <text class="card-title card-title--lg">支付方式</text>
        <view class="method">
          <k-icon name="wechat" :size="26" color="green" fill :stroke="0.5" />
          <text class="method__name">微信支付</text>
          <k-icon name="chevron-right" :size="16" color="muted" />
        </view>
      </k-card>

      <k-card class="k-mt12" pad="18px 14px 16px">
        <text class="card-title card-title--lg">支付倒计时</text>
        <text class="countdown">{{ clock }}</text>
        <text class="countdown__tip">请在15分钟内完成支付，超时将自动取消订单</text>
      </k-card>

      <k-card class="k-mt12" :pad="14">
        <view class="k-row-start k-gap10">
          <k-icon name="shield-check" :size="26" color="green" :stroke="1.5" />
          <view class="k-col">
            <text class="k-subtitle">安全支付保障中</text>
            <text class="safe__line">本次支付由微信提供安全保障</text>
            <text class="safe__line">支持指纹 / 密码验证</text>
          </view>
        </view>
      </k-card>

      <k-button block class="k-mt16" @click="s = 4">微信支付 ¥754</k-button>
      <view class="k-home-indicator" />
    </view>

    <!-- 4 支付结果 -->
    <view v-else class="k-body k-pad-safe">
      <k-card pad="16px 14px 4px">
        <view class="k-center-box"><image class="stamp" src="/static/media/pay-stamp.jpg" mode="aspectFit" /></view>
        <text class="success__title">支付成功，订单已同步</text>
        <text class="success__sub">感谢您的预订，期待您的到来！</text>
        <view class="k-divider k-mt16" />
        <view class="info">
          <text class="info__label">订单号</text>
          <text class="info__value info__value--center">DD20250905A1B2C3</text>
          <view class="copy" @click="toast('已复制订单号')"><text>复制</text></view>
        </view>
        <view class="info"><text class="info__label">支付金额</text><text class="info__value">¥754</text></view>
        <view class="info info--last"><text class="info__label">支付时间</text><text class="info__value">2025年9月1日 14:32</text></view>
      </k-card>

      <k-card class="k-mt12" pad="14px 14px 12px">
        <text class="card-title">已同步到门店“订单来了”</text>
        <view class="k-between synced">
          <text class="synced__store">大理喜洲小院</text>
          <view class="k-row k-gap4">
            <view class="k-circle k-circle--green synced__ok"><k-icon name="check" :size="10" color="white" :stroke="3.2" /></view>
            <text class="synced__state">已同步</text>
          </view>
        </view>
      </k-card>

      <k-card class="k-mt12" pad="14px 14px 14px">
        <text class="next__title">接下来您可以</text>
        <view class="k-grid-3 k-mt10">
          <view v-for="a in nextActions" :key="a.label" class="next" @click="a.go()">
            <k-icon :name="a.icon" :size="30" color="ink" :stroke="1.5" />
            <text class="next__label">{{ a.label }}</text>
          </view>
        </view>
      </k-card>

      <k-card class="k-mt12" tone="flax" pad="12px 14px">
        <view class="k-between k-gap12">
          <view class="k-col k-flex1">
            <text class="retry__line">如未同步，请检查网络后重试</text>
            <text class="retry__sub">不会重复扣款，请放心</text>
          </view>
          <k-button type="outline" size="sm" @click="toast('已重新同步')">重试同步</k-button>
        </view>
      </k-card>
      <view class="k-home-indicator" />
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['入住人信息', '确认订单', '微信支付', '支付结果']
const remark = ref('')
const agreed = ref(false)
const guestRows = [
  { label: '入住人', value: '包小鼠' },
  { label: '手机号', value: '138*****5678' },
  { label: '到店时间', value: '9月5日 15:00前' }
]
const nextActions = [
  { icon: 'wechat', label: '加入门店群', go: () => go(`${R.stayOrder}?s=1`) },
  { icon: 'file-text', label: '查看行程', go: () => go(`${R.stayOrder}?s=2`) },
  { icon: 'book-text', label: '查看订单', go: () => go(R.stayOrder) }
]

// 支付倒计时（设计稿 14:58 起，3 秒后开始走秒）
let left = 14 * 60 + 58
const clock = ref('14:58')
let timer = null
const fmt = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
const startTimer = setTimeout(() => {
  timer = setInterval(() => { if (left > 0) { left -= 1; clock.value = fmt(left) } }, 1000)
}, 3000)
onUnload(() => { clearTimeout(startTimer); if (timer) clearInterval(timer) })

const toPay = () => { if (!agreed.value) return toast('请先阅读并同意《预订须知》'); s.value = 3 }
const onBack = () => { if (s.value > 1 && s.value < 4) s.value -= 1; else back() }
</script>

<style scoped lang="scss">
.card-title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 24px; }
.card-title--lg { font-size: 18px; }
.dash { border-top: 1px dashed var(--k-line2); margin: 6px 0; }
.dash--wide { margin: 10px 0 8px; }
.ic-shield { position: relative; width: 18px; height: 18px; flex: 0 0 auto; }
.ic-shield__check { position: absolute; left: 4.5px; top: 4px; }

/* s1 */
.room { gap: 14px; }
.room__img { width: 80px; height: 99px; border-radius: 8px; flex: 0 0 auto; }
.room__name { font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 24px; }
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
.fee--group { height: 22px; margin-top: 4px; }
.fee--total { height: 30px; }
.fee--sum { height: 26px; }
.fee__total { color: var(--k-red); font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 24px; line-height: 1; }
.fee__off { color: var(--k-green); font-weight: 600; font-size: 16px; }
.policy__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 24px; color: var(--k-green); }
.policy__copy { display: block; margin-top: 6px; font-size: 13px; line-height: 23px; color: var(--k-muted); }
.policy__tag { font-size: 14px; font-weight: 700; color: #8A6A3A; }
.agree { display: flex; align-items: center; gap: 10px; margin: 16px 6px 0; }
.agree__text { font-size: 14px; }
.paybar { display: flex; flex-direction: column; gap: 4px; }
.paybar__amount { color: var(--k-red); font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 26px; line-height: 1; }
.paybar__btn { width: 156px; height: 52px; font-family: var(--k-serif); font-size: 18px; }

/* s3 */
.amount { display: block; margin-top: 10px; color: var(--k-red); font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 38px; line-height: 1; }
.amount__name { display: block; margin-top: 14px; font-size: 14px; line-height: 20px; }
.amount__date { display: block; margin-top: 6px; font-size: 13px; line-height: 18px; color: var(--k-muted); }
.amount__hr { margin: 16px 0 14px; }
.method { display: flex; align-items: center; gap: 10px; margin-top: 10px; height: 52px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.method__name { flex: 1; font-size: 15px; }
.countdown { display: block; margin-top: 10px; text-align: center; color: var(--k-red); font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 42px; line-height: 1; letter-spacing: 1px; }
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
.synced__store { font-size: 15px; }
.synced__ok { width: 16px; height: 16px; }
.synced__state { color: var(--k-green); font-size: 14px; }
.next__title { display: block; font-size: 15px; line-height: 21px; color: #5C534B; }
.next { height: 72px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.next__label { font-size: 13px; line-height: 1; }
.retry__line { font-size: 14px; line-height: 20px; }
.retry__sub { margin-top: 4px; font-size: 13px; line-height: 18px; color: var(--k-muted); }
</style>
