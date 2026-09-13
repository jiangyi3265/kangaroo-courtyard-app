<template>
  <view class="k-page progress">
    <k-topbar title="审核进度" back />
    <view class="steps"><k-steps :steps="stepNames" :current="current" /></view>

    <!-- 1 报名已提交 -->
    <view v-if="s === 1" class="k-body k-pad-bottom">
      <k-card :pad="16">
        <view class="hero">
          <image class="hero__img hero__img--1" src="/static/media/progress-submitted.jpg" mode="aspectFit" />
          <text class="hero__title">报名已提交</text>
          <text class="hero__desc k-pre">感谢你的信任，我们已收到你的报名信息，\n正在为你安排主理人审核。</text>
        </view>
        <view class="k-divider k-mt16" />
        <view class="row"><view class="row__label"><k-icon name="file-clock" :size="18" color="ink" :stroke="1.5" /><text>提交时间</text></view><text class="row__value">2025年9月5日 09:41</text></view>
        <view class="row"><view class="row__label"><k-icon name="clock" :size="18" color="ink" :stroke="1.5" /><text>预计审核时长</text></view><text class="row__value">约 4 小时内</text></view>
        <view class="row"><view class="row__label"><k-icon name="file-text" :size="18" color="ink" :stroke="1.5" /><text>当前状态</text></view><view class="status"><text>等待商家审核</text></view></view>
        <view class="tip k-mt8"><text class="tip__title">温馨提示</text><text class="tip__text k-pre">主理人通常会在 4 小时内完成审核，\n请保持电话畅通，方便沟通后续安排。</text></view>
      </k-card>
      <k-bottom flat><view class="k-flex1"><k-button type="outline" block @click="go(R.jobApply)">修改报名信息</k-button></view><view class="k-flex1"><k-button block @click="withdraw">撤回报名</k-button></view></k-bottom>
    </view>

    <!-- 2 审核通过 -->
    <view v-else-if="s === 2" class="k-body k-pad-bottom">
      <view class="hero hero--plain">
        <image class="hero__img hero__img--2" src="/static/media/progress-stamp.jpg" mode="aspectFit" />
        <text class="hero__title">审核通过</text>
        <text class="hero__desc">恭喜你！主理人已通过你的报名申请。</text>
      </view>
      <view class="tips k-mt16">
        <view v-for="t in passTips" :key="t.text" class="tips__row"><view class="k-circle k-circle--outline tips__icon"><k-icon :name="t.icon" :size="17" color="ink" :stroke="1.5" /></view><text class="tips__text k-pre">{{ t.text }}</text></view>
      </view>
      <k-bottom flat><k-button block @click="s = 4">请选择视频面试时间</k-button></k-bottom>
    </view>

    <!-- 3 审核未通过 -->
    <view v-else-if="s === 3" class="k-body k-pad-safe">
      <view class="hero hero--plain">
        <image class="hero__img hero__img--3" src="/static/media/progress-rejected.jpg" mode="aspectFit" />
        <text class="hero__title">审核未通过</text>
        <text class="hero__desc">很抱歉，本次报名未通过主理人审核。</text>
      </view>
      <k-card class="k-mt12 reason" :pad="14">
        <text class="reason__label">未通过原因</text>
        <text class="reason__title">到岗日期不匹配</text>
        <text class="reason__text">主理人希望你能更早到岗，与你当前可到岗时间不一致。</text>
      </k-card>
      <text class="k-title k-mt16 block">你可以</text>
      <view class="k-col k-gap8 k-mt8">
        <view v-for="a in actions" :key="a.text" class="action" @click="a.fn"><k-icon :name="a.icon" :size="20" color="ink" :stroke="1.5" /><text>{{ a.text }}</text></view>
      </view>
      <text class="cheer">别灰心，合适的相遇需要一点时间，期待你下次的加入～</text>
      <view class="k-home-indicator" />
    </view>

    <!-- 4 选择面试时间 -->
    <view v-else class="k-body k-pad-bottom">
      <text class="pick__title">请选择视频面试时间</text>
      <text class="pick__sub">主理人已为你提供以下可选时段</text>
      <view class="k-col k-gap12 k-mt12">
        <view v-for="(o, i) in options" :key="i" class="opt" :class="{ on: picked === i }" @click="picked = i">
          <view class="k-radio" :class="{ checked: picked === i }" />
          <view class="k-flex1">
            <view class="k-row-start k-gap12">
              <k-icon name="calendar-days" :size="22" color="ink" :stroke="1.5" />
              <view class="k-col k-gap2"><text class="opt__date">{{ o.date }}</text><text class="opt__date">{{ o.time }}（北京时间）</text></view>
            </view>
            <view class="k-row k-gap24 opt__meta"><view class="k-row k-gap4"><k-icon name="clock" :size="14" color="muted" /><text>预计 20 分钟</text></view><view class="k-row k-gap4"><k-icon name="video" :size="14" color="muted" /><text>视频面试</text></view></view>
          </view>
        </view>
      </view>
      <view class="tip tip--card k-mt16"><text class="tip__title">温馨提示</text><text class="tip__text">请在 24 小时内完成选择，逾期将释放面试名额。</text></view>
      <k-bottom flat><k-button type="outline" icon="message-circle" class="contact" @click="go(R.chat)">联系主理人</k-button><view class="k-flex1"><k-button block @click="confirmTime">确认面试时间</k-button></view></k-bottom>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useScreen, go, replace, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const stepNames = ['提交报名', '商家审核', '视频面试', '能力评估', '录用沟通', '入职成功']
const current = computed(() => ({ 1: 1, 2: 2, 3: 2, 4: 3 })[s.value] || 1)
const passTips = [
  { icon: 'alarm-clock', text: '请在 24 小时内选择视频面试时间，\n超时将释放名额。' },
  { icon: 'timer', text: '面试将通过微信视频进行，预计 20 分钟。' },
  { icon: 'calendar-check', text: '如需调整，可联系主理人协商新的时间。' }
]
const actions = [
  { icon: 'calendar-days', text: '修改时间重新提交', fn: () => go(`${R.jobApply}?s=2`) },
  { icon: 'search', text: '查看相似机会', fn: () => go(R.jobsList) },
  { icon: 'message-circle', text: '联系主理人', fn: () => go(R.chat) }
]
const options = [
  { date: '2025年9月6日（周六）', time: '10:00 - 10:20' },
  { date: '2025年9月6日（周六）', time: '14:00 - 14:20' },
  { date: '2025年9月7日（周日）', time: '19:00 - 19:20' }
]
const picked = ref(-1)
const withdraw = () => { uni.showModal({ title: '撤回报名', content: '撤回后需重新提交报名，确定撤回吗？', confirmColor: '#A94734', success: (r) => { if (r.confirm) { toast('已撤回报名'); s.value = 3 } } }) }
const confirmTime = () => { if (picked.value < 0) return toast('请选择一个面试时段'); replace(R.jobInterview) }
</script>

<style scoped lang="scss">
.steps { padding: 12px 8px 6px; }
.k-gap2 { gap: 2px; } .k-gap24 { gap: 24px; }
.block { display: block; }
.hero { display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 10px; }
.hero--plain { padding-top: 22px; }
.hero__img--1 { width: 132px; height: 104px; }
.hero__img--2 { width: 156px; height: 158px; }
.hero__img--3 { width: 136px; height: 112px; }
.hero__title { margin-top: 14px; font-family: var(--k-serif); font-weight: 700; font-size: 26px; line-height: 1.3; }
.hero__desc { margin-top: 10px; font-size: 14px; line-height: 1.6; color: var(--k-muted); }
.row { display: flex; align-items: center; justify-content: space-between; height: 44px; font-size: 14px; }
.row__label { display: flex; align-items: center; gap: 10px; color: var(--k-ink); }
.row__value { color: var(--k-ink); }
.status { height: 26px; padding: 0 12px; border-radius: 6px; background: var(--k-green-soft); border: 1px solid #C9DACC; color: var(--k-green); font-size: 13px; display: flex; align-items: center; }
.tip { padding: 12px; border-radius: 10px; background: var(--k-paper2); border: 1px solid var(--k-line); }
.tip--card { background: var(--k-paper); }
.tip__title { font-size: 14px; font-weight: 600; }
.tip__text { display: block; margin-top: 6px; font-size: 14px; line-height: 1.7; color: var(--k-muted); }
.tips { padding: 14px; border-radius: 12px; background: var(--k-paper2); border: 1px solid var(--k-line); display: flex; flex-direction: column; gap: 14px; }
.tips__row { display: flex; align-items: flex-start; gap: 14px; }
.tips__icon { width: 34px; height: 34px; border-color: var(--k-line2); background: var(--k-paper); }
.tips__text { font-size: 14px; line-height: 1.7; padding-top: 3px; }
.reason__label { font-size: 14px; font-weight: 600; }
.reason__title { display: block; margin-top: 8px; font-family: var(--k-serif); font-weight: 700; font-size: 18px; color: var(--k-red); }
.reason__text { display: block; margin-top: 6px; font-size: 14px; line-height: 1.65; color: var(--k-muted); }
.action { height: 48px; padding: 0 16px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; gap: 14px; font-size: 15px; }
.cheer { display: block; margin-top: 20px; text-align: center; font-size: 13px; color: var(--k-muted); }
.pick__title { display: block; margin-top: 12px; font-family: var(--k-serif); font-weight: 700; font-size: 20px; }
.pick__sub { display: block; margin-top: 8px; font-size: 14px; color: var(--k-muted); }
.opt { display: flex; align-items: center; gap: 14px; padding: 16px 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.opt.on { border-color: var(--k-red); }
.opt__date { font-size: 16px; line-height: 1.35; }
.opt__meta { margin-top: 8px; padding-left: 34px; font-size: 13px; color: var(--k-muted); }
.contact { width: 140px; flex: 0 0 auto; }
</style>
