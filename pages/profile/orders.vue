<template>
  <view class="k-page orders">
    <k-topbar :title="titles[s - 1]" back @back="onBack">
      <view v-if="s === 1" class="k-tabs">
        <view v-for="t in orderTabs" :key="t" class="k-tabs__item" :class="{ active: orderTab === t }" @click="orderTab = t"><text>{{ t }}</text></view>
      </view>
      <view v-else-if="s === 2" class="k-tabs">
        <view v-for="t in reviewTabs" :key="t" class="k-tabs__item" :class="{ active: reviewTab === t }" @click="reviewTab = t"><text>{{ t }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 全部订单 -->
    <view v-if="s === 1" class="list k-pad-tab">
      <view v-for="o in filteredOrders" :key="o.title" class="oc">
        <view class="oc__head">
          <view class="oc__ic" :style="{ borderColor: o.iconHex }"><k-icon :name="o.icon" :size="13" :color="o.iconHex" :stroke="1.8" /></view>
          <text class="oc__type">{{ o.type }}</text>
          <text class="oc__dot">·</text>
          <text class="oc__status" :class="'is-' + o.tone">{{ o.status }}</text>
        </view>
        <view class="oc__body">
          <view class="oc__left">
            <image class="oc__img" :src="`/static/media/${o.img}.jpg`" mode="aspectFill" />
            <text v-if="o.deposit" class="oc__deposit">{{ o.deposit }}</text>
          </view>
          <view class="oc__right">
            <text class="oc__title">{{ o.title }}</text>
            <view class="oc__meta"><k-icon name="map-pin" :size="12" color="light" :stroke="1.7" /><text>{{ o.loc }}</text></view>
            <view class="oc__meta oc__meta--row">
              <view class="k-row k-gap4"><k-icon name="calendar-days" :size="12" color="light" :stroke="1.7" /><text>{{ o.date }}</text></view>
              <text v-if="o.signed" class="oc__signed">{{ o.signed }}</text>
              <text v-else class="oc__price">{{ o.price }}<text v-if="o.unit" class="oc__unit">{{ o.unit }}</text></text>
            </view>
            <view class="oc__btns">
              <view v-for="b in o.btns" :key="b.label" class="oc__btn" :class="'is-' + b.type" @click="onOrderBtn(b.label, o)"><text>{{ b.label }}</text></view>
            </view>
          </view>
        </view>
      </view>
      <view v-if="!filteredOrders.length" class="k-center k-mt24"><text class="k-meta">暂无{{ orderTab }}订单</text></view>
    </view>

    <!-- 2 评价管理 -->
    <view v-else-if="s === 2" class="k-pad-tab">
      <view class="tip"><text>{{ reviewTip }}</text></view>
      <view class="k-body">
        <view v-for="r in reviewList" :key="r.title" class="rc">
          <image class="rc__img" :src="`/static/media/${r.img}.jpg`" mode="aspectFill" />
          <view class="k-flex1">
            <view class="k-row k-gap4">
              <text class="rc__name" :class="{ 'rc__name--lg': !r.sub }">{{ r.name }}</text>
              <text v-if="r.sub" class="rc__sub">· {{ r.sub }}</text>
            </view>
            <text class="rc__title">{{ r.title }}</text>
            <text class="rc__time">{{ r.time }}</text>
            <text class="rc__deadline" :class="{ 'rc__deadline--green': reviewTab !== '待评价' }">{{ r.deadline }}</text>
          </view>
          <view v-if="reviewTab === '待评价'" class="rc__btn" @click="go(R.review + '?s=1')"><text>去评价</text></view>
          <k-chip v-else :tone="reviewTab === '已精选' ? 'ochre' : 'green'">{{ reviewTab }}</k-chip>
        </view>
        <view class="k-divider k-mt8" />
        <text class="sec-title">评价权益</text>
        <view class="rights">
          <view class="rights__row rights__row--line">
            <view class="k-circle k-circle--soft-ochre rights__ic"><k-icon name="medal" :size="22" color="ochre" :stroke="1.6" /></view>
            <view class="k-flex1">
              <text class="rights__title">精选奖励</text>
              <text class="rights__desc">优质评价有机会被精选\n获得 <text class="k-red k-bold">20-100</text> 成长值</text>
            </view>
          </view>
          <view class="rights__row">
            <view class="k-circle k-circle--soft-green rights__ic"><k-icon name="heart" :size="22" color="green" :stroke="1.6" fill /></view>
            <view class="k-flex1">
              <text class="rights__title">帮助他人</text>
              <text class="rights__desc">真实评价帮助更多小伙伴\n发现好工作好体验</text>
            </view>
          </view>
        </view>
        <text class="foot-note">评价发布后，24 小时内审核，精选内容将展示在相关页面</text>
      </view>
    </view>

    <!-- 3 我的提醒 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="k-between rem-head">
        <text class="k-small k-muted">开启提醒，不错过心仪机会</text>
        <text class="k-small" @click="toast('编辑提醒')">编辑</text>
      </view>
      <view class="rem-card">
        <view v-for="(r, i) in reminders" :key="r.title" class="rem" :class="{ 'rem--line': i < reminders.length - 1 }">
          <view class="rem__ic"><k-icon :name="r.icon" :size="26" :color="r.color" :stroke="1.5" /></view>
          <view class="k-flex1"><text class="rem__title">{{ r.title }}</text><text class="rem__desc">{{ r.desc }}</text></view>
          <text class="rem__freq">{{ r.freq }}</text>
          <view class="k-switch" :class="{ on: r.on }" @click="r.on = !r.on" />
        </view>
      </view>
      <text class="rem-label">已暂停的提醒</text>
      <view class="rem-card">
        <view v-for="(r, i) in paused" :key="r.title" class="rem" :class="{ 'rem--line': i < paused.length - 1 }">
          <view class="rem__ic"><k-icon :name="r.icon" :size="26" color="ink" :stroke="1.5" /></view>
          <view class="k-flex1"><text class="rem__title">{{ r.title }}</text><text class="rem__desc">{{ r.desc }}</text></view>
          <text class="rem__freq">已暂停</text>
          <view class="rem__open" @click="toast(`已开启${r.title}`)"><text>开启</text></view>
        </view>
      </view>
      <text class="foot-note">你可以根据需要调整提醒频率或暂停接收</text>
    </view>

    <!-- 4 旅行体验官攻略申请 -->
    <view v-else class="k-pad-tab">
      <image class="hero" src="/static/media/orders-hero.jpg" mode="aspectFill" />
      <view class="k-body">
        <view class="perks">
          <view v-for="(p, i) in perks" :key="p.title" class="perk" :class="{ 'perk--line': i < perks.length - 1 }">
            <view class="k-circle k-circle--soft-green perk__ic"><k-icon :name="p.icon" :size="16" :color="p.color" :stroke="1.6" /></view>
            <view class="k-col"><text class="perk__title">{{ p.title }}</text><text class="perk__desc">{{ p.desc }}</text></view>
          </view>
        </view>
        <view class="k-between k-mt16">
          <text class="sec-title sec-title--flat">已有攻略城市</text>
          <view class="k-row k-gap2" @click="toast('12 个城市攻略')"><text class="k-small k-muted">12 个城市攻略</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
        </view>
        <view class="cities">
          <view v-for="c in cities" :key="c" class="city" @click="toast(c + '攻略')"><text>{{ c }}</text></view>
          <text class="k-small city__all" @click="toast('查看全部')">查看全部</text>
        </view>
        <view class="k-divider k-mt12" />
        <text class="sec-title">申请条件</text>
        <view class="k-col k-gap10 k-mt4">
          <view v-for="c in conditions" :key="c" class="k-row k-gap8"><k-icon name="circle-check" :size="18" color="green" :stroke="1.6" /><text class="k-small">{{ c }}</text></view>
        </view>
        <view class="k-divider k-mt16" />
        <text class="sec-title">申请信息</text>
        <view class="form">
          <text class="form__label">选择城市（可多选）</text>
          <view class="k-row k-gap8 k-mt8">
            <view class="k-input k-flex1 k-between" @click="toast('选择城市')"><text class="k-placeholder">请选择城市</text><k-icon name="chevron-down" :size="16" color="muted" /></view>
            <k-button type="secondary" size="md" @click="toast('已开启')">开启</k-button>
          </view>
        </view>
        <view class="k-mt12">
          <text class="form__label">创作计划</text>
          <view class="k-input plan k-mt8">
            <textarea v-model="plan" placeholder="请选择计划内容类型与更新频率" placeholder-class="k-placeholder" :maxlength="200" />
            <text class="plan__counter">{{ plan.length }}/200</text>
          </view>
        </view>
        <view class="k-mt12">
          <text class="form__label">代表作品（选填）</text>
          <view class="k-row k-gap8 k-mt8">
            <view class="k-input k-flex1"><input v-model="work" placeholder="添加作品链接或截图" placeholder-class="k-placeholder" /></view>
            <view class="k-input add" @click="toast('添加作品')"><k-icon name="plus" :size="18" color="ink" :stroke="1.8" /></view>
          </view>
        </view>
        <k-button block class="k-mt20" @click="submit">提交申请</k-button>
        <text class="foot-note foot-note--tight">提交后 3 个工作日内审核，结果将通过消息通知</text>
      </view>
    </view>

    <k-tabbar :active="s === 1 ? 'profile' : ''" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['全部订单', '评价管理', '我的提醒', '旅行体验官攻略申请']
const onBack = () => back()

// s1
const orderTabs = ['全部', '待付款', '进行中', '已完成', '退款']
const orderTab = ref('全部')
const orders = [
  { type: '义工', status: '已完成', tone: 'green', icon: 'house', iconHex: '#C99043', img: 'orders-cafe', title: '古城咖啡馆驻店伙伴', loc: '大理 · 古城', date: '08.20 – 08.30（10天）', price: '¥0', btns: [{ label: '订单详情', type: 'outline' }, { label: '去评价', type: 'primary' }] },
  { type: '兼职', status: '进行中', tone: 'indigo', icon: 'circle-dot', iconHex: '#40576B', img: 'orders-pottery', title: '周末手作体验老师', loc: '杭州 · 西湖区', date: '09.01 – 10.15（周末）', price: '¥120', unit: '/天', btns: [{ label: '联系雇主', type: 'outline' }, { label: '订单详情', type: 'outline' }] },
  { type: '全职', status: '待付款', tone: 'ochre', icon: 'store', iconHex: '#C99043', img: 'orders-room-cd', title: '民宿管家（包吃住）', loc: '成都 · 宽窄巷子', date: '入职 09.10', price: '¥4,500', unit: '/月', deposit: '待支付定金 ¥500', btns: [{ label: '去支付', type: 'primary' }] },
  { type: '住宿', status: '已完成', tone: 'green', icon: 'bed', iconHex: '#4F7A66', img: 'orders-room-hz', title: '西湖边 · 温馨一居室', loc: '杭州 · 西湖区', date: '08.25 – 08.28（3晚）', price: '¥280', unit: '/晚', btns: [{ label: '再次预订', type: 'outline' }, { label: '去评价', type: 'primary' }] },
  { type: '活动', status: '进行中', tone: 'indigo', icon: 'tent', iconHex: '#6B635C', img: 'orders-market', title: '手作市集志愿者', loc: '苏州 · 平江路', date: '09.07（周六）10:00–18:00', signed: '已签到', btns: [{ label: '联系主办方', type: 'outline' }, { label: '订单详情', type: 'outline' }] },
  { type: '二消', status: '已完成', tone: 'green', icon: 'shopping-bag', iconHex: '#6B635C', img: 'orders-coffee', title: '咖啡体验课', loc: '北京 · 南锣鼓巷', date: '08.18 14:00', price: '¥128', btns: [{ label: '订单详情', type: 'outline' }, { label: '去评价', type: 'primary' }] }
]
const filteredOrders = computed(() => orderTab.value === '全部' ? orders : orders.filter(o => o.status === orderTab.value))
const onOrderBtn = (label, o) => {
  if (label === '去评价') return go(R.review + '?s=1')
  if (label === '去支付') return go(R.stayPay)
  if (label === '再次预订') return go(R.stayBooking)
  if (label === '联系雇主' || label === '联系主办方') return go(R.chat)
  if (o.type === '住宿') return go(R.stayOrder)
  if (o.type === '活动') return go(R.activityMine)
  if (o.type === '二消') return go(R.stayShop)
  return go(R.jobProgress)
}

// s2
const reviewTabs = ['待评价', '已发布', '已精选']
const reviewTab = ref('待评价')
const pending = [
  { img: 'orders-avatar-xiaoyu', name: '小宇', sub: '25岁 · 昆明', title: '古城咖啡馆驻店伙伴', time: '体验时间：08.20 – 08.30', deadline: '09.10 23:59 前可评价' },
  { img: 'orders-avatar-aning', name: '阿宁', sub: '23岁 · 大理', title: '花艺学徒（兼职）', time: '体验时间：09.01 – 09.15', deadline: '09.16 23:59 前可评价' },
  { img: 'orders-room-thumb', name: '西湖边 · 温馨一居室', title: '住宿体验', time: '入住时间：08.25 – 08.28', deadline: '09.05 23:59 前可评价' }
]
const published = [
  { img: 'orders-market', name: '手作市集志愿者', title: '活动体验', time: '参与时间：08.10（周六）', deadline: '08.11 发布 · 审核通过' },
  { img: 'orders-coffee', name: '咖啡体验课', title: '二消体验', time: '体验时间：08.18 14:00', deadline: '08.19 发布 · 审核通过' }
]
const featured = [
  { img: 'orders-pottery', name: '周末手作体验老师', title: '兼职体验', time: '体验时间：07.06 – 07.28', deadline: '已精选 · 获得 60 成长值' }
]
const reviewList = computed(() => ({ 待评价: pending, 已发布: published, 已精选: featured })[reviewTab.value])
const reviewTip = computed(() => ({ 待评价: '及时评价，帮助更多小伙伴找到好体验', 已发布: '已发布的评价审核通过后将展示在相关页面', 已精选: '精选评价将获得成长值奖励' })[reviewTab.value])

// s3
const reminders = ref([
  { icon: 'house', color: 'ochre', title: '缺人提醒', desc: '我关注的岗位有新缺人', freq: '实时', on: true },
  { icon: 'briefcase', color: 'indigo', title: '新岗位', desc: '有新的岗位发布', freq: '每天 08:00', on: true },
  { icon: 'calendar-check', color: 'ochre', title: '新活动', desc: '有新的活动发布', freq: '每天 09:00', on: true },
  { icon: 'user-round', color: 'ink', title: '面试提醒', desc: '面试前 24 小时提醒', freq: '提前 24 小时', on: true },
  { icon: 'map-pin', color: 'green', title: '到店提醒', desc: '雇主确认到店时间', freq: '当天 09:00', on: true },
  { icon: 'clipboard-list', color: 'ochre', title: '订单状态', desc: '订单变更、完成等通知', freq: '实时', on: true }
])
const paused = [
  { icon: 'bell', title: '系统通知', desc: '平台重要通知' },
  { icon: 'shopping-bag', title: '优惠活动', desc: '平台优惠与福利' }
]

// s4
const perks = [
  { icon: 'map', color: 'green', title: '免费攻略', desc: '全国城市攻略随心用' },
  { icon: 'bed', color: 'green', title: '低价住宿', desc: '淡季民宿专享低价' },
  { icon: 'award', color: 'ochre', title: '成长激励', desc: '优质内容获奖励' }
]
const cities = ['大理', '丽江', '成都', '杭州', '苏州']
const conditions = ['热爱旅行与生活，乐于分享真实体验', '内容原创，图文/视频均可，风格真实友好', '遵守平台规则，持续产出优质攻略', '近 30 天无违规记录']
const plan = ref('')
const work = ref('')
const submit = () => { toast('申请已提交'); go(R.messages) }
</script>

<style scoped lang="scss">
.sec-title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; margin: 14px 0 10px; }
.sec-title--flat { margin: 0; }
.foot-note { display: block; text-align: center; font-size: 12px; color: var(--k-muted); margin-top: 20px; }
.foot-note--tight { margin-top: 12px; }

/* s1 */
.list { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.oc { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; padding: 9px 10px 10px; }
.oc__head { display: flex; align-items: center; gap: 6px; height: 22px; }
.oc__ic { width: 20px; height: 20px; border-radius: 50%; border: 1.3px solid; display: flex; align-items: center; justify-content: center; }
.oc__type { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.oc__dot { color: var(--k-light); font-size: 12px; }
.oc__status { font-size: 12px; font-weight: 500; }
.oc__status.is-green { color: var(--k-green); }
.oc__status.is-indigo { color: var(--k-indigo); }
.oc__status.is-ochre { color: #B07A2A; }
.oc__body { display: flex; gap: 10px; margin-top: 6px; }
.oc__left { width: 108px; flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; }
.oc__img { width: 108px; height: 72px; border-radius: 8px; }
.oc__deposit { margin-top: 6px; font-size: 13px; font-weight: 700; color: var(--k-red); white-space: nowrap; }
.oc__right { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.oc__title { font-family: var(--k-serif); font-weight: 700; font-size: 15px; line-height: 20px; }
.oc__meta { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--k-muted); line-height: 16px; margin-top: 2px; white-space: nowrap; }
.oc__meta--row { justify-content: space-between; }
.oc__price { font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 15px; color: var(--k-ink); }
.oc__unit { font-family: var(--k-sans); font-weight: 400; font-size: 11px; color: var(--k-muted); }
.oc__signed { font-size: 12px; font-weight: 500; color: var(--k-green); }
.oc__btns { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
.oc__btn { min-width: 72px; height: 26px; padding: 0 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; }
.oc__btn.is-outline { background: var(--k-paper); border: 1px solid var(--k-line2); color: var(--k-ink); }
.oc__btn.is-primary { background: var(--k-red); color: #FFF8F0; }

/* s2 */
.tip { padding: 8px 16px; background: var(--k-paper2); font-size: 12px; color: var(--k-muted); }
.rc { display: flex; align-items: center; gap: 12px; padding: 12px 10px 12px 10px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; margin-bottom: 10px; }
.rc__img { width: 44px; height: 44px; border-radius: 8px; flex: 0 0 auto; align-self: flex-start; }
.rc__name { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.rc__name--lg { font-size: 17px; }
.rc__sub { font-size: 12px; color: var(--k-muted); }
.rc__title { display: block; font-size: 13px; margin-top: 3px; }
.rc__time { display: block; font-size: 12px; color: var(--k-muted); margin-top: 3px; }
.rc__deadline { display: block; font-size: 13px; font-weight: 600; color: var(--k-red); margin-top: 3px; }
.rc__deadline--green { color: var(--k-green); }
.rc__btn { width: 78px; height: 34px; border-radius: 999px; border: 1.2px solid var(--k-red); color: var(--k-red); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex: 0 0 auto; }
.rights { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; }
.rights__row { display: flex; align-items: center; gap: 14px; padding: 14px 14px; }
.rights__row--line { border-bottom: 1px solid var(--k-line); }
.rights__ic { width: 40px; height: 40px; }
.rights__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.rights__desc { display: block; font-size: 12px; color: var(--k-muted); line-height: 1.6; margin-top: 3px; white-space: pre-line; }

/* s3 */
.rem-head { padding: 10px 0 12px; }
.rem-card { background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; }
.rem { display: flex; align-items: center; gap: 12px; padding: 12px 12px; }
.rem--line { border-bottom: 1px solid var(--k-line); }
.rem__ic { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.rem__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.rem__desc { display: block; font-size: 12px; color: var(--k-muted); margin-top: 2px; }
.rem__freq { font-size: 12px; color: var(--k-muted); margin-right: 4px; white-space: nowrap; }
.rem__open { width: 44px; height: 26px; border-radius: 6px; border: 1px solid var(--k-red); color: var(--k-red); display: flex; align-items: center; justify-content: center; font-size: 12px; }
.rem-label { display: block; font-size: 13px; color: var(--k-muted); margin: 16px 0 8px; }

/* s4 */
.hero { width: 100%; height: 118px; display: block; }
.perks { display: flex; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; padding: 10px 6px; }
.perk { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 0 4px; }
.perk--line { border-right: 1px solid var(--k-line); }
.perk__ic { width: 28px; height: 28px; }
.perk__title { font-family: var(--k-serif); font-weight: 700; font-size: 13px; white-space: nowrap; }
.perk__desc { font-size: 10px; color: var(--k-muted); white-space: nowrap; }
.cities { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.city { width: 54px; height: 34px; border-radius: 8px; background: var(--k-paper2); border: 1px solid var(--k-line); display: flex; align-items: center; justify-content: center; font-size: 14px; }
.city__all { margin-left: auto; }
.form { margin-top: 2px; }
.form__label { display: block; font-size: 13px; font-weight: 600; }
.plan { position: relative; align-items: flex-start; min-height: 74px; padding: 10px 12px 20px; }
.plan textarea { width: 100%; height: 40px; font-size: 14px; }
.plan__counter { position: absolute; right: 12px; bottom: 6px; font-size: 11px; color: var(--k-light); }
.add { width: 46px; justify-content: center; padding: 0; flex: 0 0 auto; }
</style>
