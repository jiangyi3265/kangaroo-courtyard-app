<template>
  <view class="k-page detail-page">
    <k-topbar title="岗位详情" back @back="back">
      <view class="detail-tabs"><view v-for="(item,i) in tabs" :key="item" class="detail-tab" :class="{ active: s === i + 1 }" @click="s = i + 1"><view class="detail-tab__num"><text>{{ i + 1 }}</text></view><text>{{ item }}</text><view v-if="i < 3" class="detail-tab__line" /></view></view>
    </k-topbar>

    <view v-if="s === 1" class="overview k-pad-bottom">
      <view class="hero"><image src="/static/media/jobs-cafe-hero.jpg" mode="aspectFill" /><text class="hero__count">1/8</text></view>
      <view class="overview-body">
        <view class="overview-title"><text>古城咖啡馆驻店伙伴</text><k-chip tone="green"><text>96%匹配</text></k-chip></view>
        <view class="overview-flags"><view class="safe"><k-icon name="shield-check" :size="16" color="green" /><text>安心商家 · 含保险</text></view><view class="favorite" @click="favorite = !favorite"><k-icon name="star" :size="23" :color="favorite ? 'ochre' : 'muted'" :fill="favorite" /><text>收藏</text></view></view>
        <view class="info-card"><view v-for="item in overviewInfo" :key="item.label" class="info-row"><k-icon :name="item.icon" :size="19" color="ink" /><text class="info-row__label">{{ item.label }}</text><text class="info-row__value">{{ item.value }}</text></view></view>
      </view>
    </view>

    <view v-else-if="s === 2" class="detail-body k-pad-bottom">
      <view v-for="group in infoGroups" :key="group.title" class="section-card"><text class="section-card__title">{{ group.title }}</text><view v-for="item in group.items" :key="item.label" class="section-row"><k-icon :name="item.icon" :size="18" color="ink" /><text class="section-row__label">{{ item.label }}</text><text class="section-row__value">{{ item.value }}</text></view></view>
      <view class="plain-card"><text class="plain-card__title">具体工作内容</text><text class="plain-card__list">· 咖啡制作与饮品出品，保证出品品质\n· 接待顾客、介绍产品、提升顾客体验\n· 保持店内卫生与器具整洁\n· 协助店内活动与社区交流</text></view>
      <view class="plain-card"><text class="plain-card__title">我们希望你</text><text class="plain-card__list">· 热爱咖啡与生活，愿意与人交流\n· 有责任心，能适应轮班与短期驻店\n· 有相关经验优先，无经验可培训</text></view>
    </view>

    <view v-else-if="s === 3" class="detail-body k-pad-bottom">
      <view class="rating-card"><view class="rating-head"><view><view class="k-row k-gap8"><text class="rating-head__title">AI 五维综合评分</text><k-icon name="info" :size="16" color="muted" /></view><text class="rating-head__sub">基于历史真实履约数据与评价计算</text></view><k-chip tone="green"><text>96%匹配</text></k-chip></view><view class="rating-total"><text class="rating-total__num">4.8</text><text class="rating-total__unit">分</text><text class="rating-total__stars">★★★★★</text><text class="rating-total__rate">好评率 94%</text></view><view class="rating-divider" /><view v-for="item in ratings" :key="item.label" class="rating-row"><view class="rating-row__icon" :class="{ blue: item.blue }"><k-icon :name="item.icon" :size="20" :color="item.blue ? 'indigo' : 'green'" /></view><text class="rating-row__label">{{ item.label }}</text><view class="rating-row__bar"><view :class="{ blue: item.blue }" :style="{ width: item.width }" /></view><text class="rating-row__score">{{ item.score }}</text></view></view>
      <view class="explain"><text class="plain-card__title">评分说明</text><text class="explain__text">评分基于近一年 126 位手作人真实履约数据计算而来，包括沟通反馈、住宿评分、工作强度反馈、成长反馈与位置便利度评价，数据每月更新。</text><view class="explain__link"><text>查看评分细则</text><k-icon name="chevron-right" :size="18" color="ink" /></view></view>
    </view>

    <view v-else class="detail-body reviews-body k-pad-bottom">
      <view class="summary"><view class="summary__head"><view class="k-row k-gap8"><view class="ai-mark"><text>AI</text></view><text class="summary__title">AI 评价摘要</text></view><k-chip tone="green"><text>好评率 94%</text></k-chip></view><text class="summary__sub">基于真实履约评价智能总结</text><k-chip tone="green" class="summary__chip"><text>优点</text></k-chip><text class="summary__copy">店主沟通及时友好，工作氛围轻松；包吃包住条件好，伙食丰富；位置便利，出行方便；工作内容有趣，能学到咖啡和运营知识。</text><k-chip tone="ochre" class="summary__chip"><text>注意事项</text></k-chip><text class="summary__copy">周末客流较多较忙，需要一定的体力和耐心；轮班排休，需提前沟通好时间；部分工作需要早起准备。</text></view>
      <view class="review-card"><view class="review-title"><text>真实评价摘录</text><view class="k-row"><text>全部 32 条</text><k-icon name="chevron-right" :size="17" color="muted" /></view></view><view v-for="item in reviews" :key="item.name" class="review"><image :src="item.avatar" mode="aspectFill" /><view class="review__main"><view class="review__head"><text class="review__name">{{ item.name }}</text><k-chip><text>驻店 {{ item.days }} 天</text></k-chip><text class="review__date">{{ item.date }}</text></view><text class="review__stars">★★★★★</text><text class="review__copy">{{ item.copy }}</text><k-chip :tone="item.tone" class="review__score"><text>{{ item.label }} {{ item.score }}</text></k-chip></view></view><view class="all-reviews" @click="go(R.review)"><text>查看全部评价（32）</text><k-icon name="chevron-right" :size="20" color="ink" /></view></view>
    </view>

    <k-bottom><k-button type="outline" icon="user-round" class="team-button" @click="go(R.jobTeam)">找人一起去</k-button><k-button class="apply-button" @click="go(R.jobApply)">立即报名</k-button></k-bottom>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useScreen, go, back } from '@/common/screen.js'
import R from '@/common/routes.js'
const s = useScreen(4)
const favorite = ref(false)
const tabs = ['职位概览','工作与权益','AI 评分','评价摘要']
const overviewInfo = [
  { icon: 'map-pin', label: '工作地点', value: '大理古城 苍山路 88 号' },
  { icon: 'briefcase-business', label: '工作类型', value: '社区交流 / 咖啡制作 / 接待' },
  { icon: 'badge-dollar-sign', label: '薪资待遇', value: '120 元/天 · 月结' },
  { icon: 'calendar-days', label: '开始日期', value: '2025年9月5日 可入职' },
  { icon: 'clock-3', label: '最短时长', value: '14天起' },
  { icon: 'clock-3', label: '工作时长', value: '每天4小时（含休息）' },
  { icon: 'calendar-range', label: '排班方式', value: '轮班排休 · 具体见排班表' },
  { icon: 'house', label: '食宿安排', value: '包吃包住' },
  { icon: 'wallet-cards', label: '薪资结算', value: '月结 · 次月5日前发放' }
]
const workInfo = overviewInfo.slice(3,7)
const lifeInfo = [{ icon: 'house', label: '食宿安排', value: '包吃包住（独立宿舍 · Wi-Fi · 洗衣机）' }, { icon: 'shopping-bag', label: '生活用品', value: '床品、基础洗漱用品、公共用品齐全' }]
const salaryInfo = [{ icon: 'circle-dollar-sign', label: '薪资标准', value: '120元/天' }, { icon: 'briefcase-business', label: '结算方式', value: '月结 · 次月5日前发放' }, { icon: 'ticket-check', label: '其他说明', value: '无押金 · 无中介费 · 购买人身意外险' }]
const infoGroups = [{ title: '工作与时间安排', items: workInfo }, { title: '食宿与生活保障', items: lifeInfo }, { title: '薪资与结算', items: salaryInfo }]
const ratings = [
  { label: '沟通匹配', icon: 'message-square-text', score: '4.9', width: '92%' },
  { label: '住宿条件', icon: 'house', score: '4.7', width: '89%' },
  { label: '工作强度', icon: 'wrench', score: '4.6', width: '85%', blue: true },
  { label: '成长空间', icon: 'users-round', score: '4.8', width: '91%', blue: true },
  { label: '位置便利', icon: 'store', score: '4.9', width: '95%', blue: true }
]
const reviews = [
  { name: '小鹿不迷路', days: 21, date: '2025.07.28', avatar: '/static/media/avatar-1.jpg', copy: '店里氛围特别好，店主很照顾人，学到很多咖啡知识，还认识了很多朋友，强烈推荐！', tone: 'green', label: '沟通匹配', score: '5.0' },
  { name: '山风与海', days: 15, date: '2025.07.15', avatar: '/static/media/avatar-2.jpg', copy: '包吃包住超出预期，宿舍很干净，工作虽然忙但很充实，周末出去玩也很方便。', tone: 'green', label: '住宿条件', score: '4.7' },
  { name: '热爱生活的雨晴', days: 18, date: '2025.06.30', avatar: '/static/media/avatar-3.jpg', copy: '适合喜欢咖啡和交流的人，工作内容丰富，就是周末会比较忙，建议体力好一点哦～', tone: 'blue', label: '工作强度', score: '4.5' }
]
</script>

<style scoped lang="scss">
.detail-page { font-family: var(--k-serif); }
.detail-tabs { height: 44px; display: flex; align-items: center; padding: 0 14px; }
.detail-tab { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; color: var(--k-muted); font-size: 11px; white-space: nowrap; }
.detail-tab__num { width: 19px; height: 19px; border-radius: 50%; background: #B8AEA1; color: #fff; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; font-family: Georgia,serif; }
.detail-tab.active { color: var(--k-red); font-weight: 700; }
.detail-tab.active .detail-tab__num { background: var(--k-red); }
.detail-tab__line { flex: 1; height: 1px; margin-right: 6px; background: var(--k-line2); }
.hero { position: relative; height: 180px; }
.hero image { width: 100%; height: 180px; }
.hero__count { position: absolute; right: 14px; bottom: 10px; padding: 2px 7px; border-radius: 10px; color: #fff; background: rgba(0,0,0,.5); font-size: 11px; }
.overview-body { padding: 12px 16px 100px; }
.overview-title { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 21px; font-weight: 700; }
.overview-flags { margin-top: 10px; display: flex; align-items: center; justify-content: space-between; }
.safe { height: 26px; padding: 0 10px; border-radius: 7px; background: var(--k-green-soft); color: var(--k-green); display: flex; align-items: center; gap: 4px; font-size: 13px; }
.favorite { display: flex; align-items: center; gap: 5px; color: var(--k-muted); }
.info-card { margin-top: 12px; padding: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.info-row { min-height: 37px; display: flex; align-items: center; gap: 10px; }
.info-row__label { width: 72px; color: var(--k-muted); font-size: 13px; }
.info-row__value { flex: 1; font-size: 13px; }
.detail-body { padding: 8px 14px 100px; }
.section-card, .plain-card, .rating-card, .explain, .summary, .review-card { margin-bottom: 8px; padding: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.section-card__title, .plain-card__title { display: block; margin-bottom: 6px; font-size: 16px; font-weight: 700; }
.section-row { min-height: 29px; display: flex; align-items: center; gap: 7px; }
.section-row__label { width: 96px; color: var(--k-muted); font-size: 12px; }
.section-row__value { flex: 1; font-size: 12px; }
.plain-card__list { display: block; font-size: 12px; line-height: 1.55; white-space: pre-line; }
.rating-head { display: flex; align-items: flex-start; justify-content: space-between; }
.rating-head__title { font-size: 18px; font-weight: 700; }
.rating-head__sub { display: block; margin-top: 3px; color: var(--k-muted); font-size: 11px; }
.rating-total { margin-top: 18px; display: flex; align-items: baseline; }
.rating-total__num { color: var(--k-red); font-family: Georgia,serif; font-size: 48px; line-height: 1; }
.rating-total__unit { margin-left: 5px; }
.rating-total__stars { margin-left: 18px; color: var(--k-ochre); font-size: 20px; letter-spacing: 2px; }
.rating-total__rate { margin-left: auto; color: var(--k-muted); font-size: 13px; }
.rating-divider { height: 1px; margin: 16px 0 12px; background: var(--k-line); }
.rating-row { height: 49px; display: flex; align-items: center; gap: 10px; }
.rating-row__icon { width: 34px; height: 34px; border-radius: 9px; background: var(--k-green-soft); display: flex; align-items: center; justify-content: center; }
.rating-row__icon.blue { background: var(--k-indigo-soft); }
.rating-row__label { width: 70px; font-size: 14px; font-weight: 700; }
.rating-row__bar { flex: 1; height: 8px; border: 1px solid var(--k-line2); border-radius: 4px; overflow: hidden; }
.rating-row__bar view { height: 100%; border-radius: 4px; background: var(--k-green); }
.rating-row__bar view.blue { background: var(--k-indigo); }
.rating-row__score { width: 28px; font-family: Georgia,serif; font-size: 18px; }
.explain__text { display: block; color: var(--k-muted); font-size: 13px; line-height: 1.8; }
.explain__link { margin-top: 18px; display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
.summary__head { display: flex; align-items: center; justify-content: space-between; }
.ai-mark { width: 28px; height: 28px; border-radius: 50%; background: var(--k-indigo); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.summary__title { font-size: 18px; font-weight: 700; }
.summary__sub { display: block; margin-top: 2px; color: var(--k-muted); font-size: 11px; }
.summary__chip { margin-top: 11px; }
.summary__copy { display: block; margin-top: 7px; font-size: 13px; line-height: 1.75; }
.review-title { display: flex; align-items: center; justify-content: space-between; font-size: 17px; font-weight: 700; }
.review-title .k-row { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.review { padding: 12px 0; display: flex; gap: 10px; border-bottom: 1px solid var(--k-line); }
.review image { width: 36px; height: 36px; border-radius: 50%; }
.review__main { flex: 1; min-width: 0; }
.review__head { display: flex; align-items: center; gap: 6px; }
.review__name { font-size: 13px; font-weight: 700; }
.review__date { margin-left: auto; color: var(--k-muted); font-size: 10px; }
.review__stars { display: block; color: var(--k-ochre); font-size: 13px; letter-spacing: 1px; }
.review__copy { display: block; margin-top: 4px; font-size: 12px; line-height: 1.6; }
.review__score { margin-top: 5px; margin-left: auto; }
.all-reviews { height: 42px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; }
.reviews-body .summary { padding: 11px 12px; }
.reviews-body .summary__chip { margin-top: 7px; }
.reviews-body .summary__copy { margin-top: 4px; font-size: 11px; line-height: 1.55; }
.reviews-body .review-card { padding: 10px 12px; }
.reviews-body .review { padding: 8px 0; gap: 8px; }
.reviews-body .review image { width: 32px; height: 32px; }
.reviews-body .review__copy { margin-top: 2px; font-size: 10px; line-height: 1.45; }
.reviews-body .review__score { margin-top: 3px; }
.team-button { width: 43%; }
.apply-button { flex: 1; }
</style>
