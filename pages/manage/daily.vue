<template>
  <view class="k-page daily">
    <k-topbar :title="titles[s - 1]" back @back="onBack" />

    <view v-if="s === 1" class="k-body k-pad-tab day-page">
      <view class="date-line"><view class="date-box" @click="toast('选择日期')"><text>2026年8月29日（周五）</text><k-icon name="calendar-days" :size="20" color="ink" /></view><view class="synced"><k-icon name="circle-check" :size="16" color="green" /><text>系统已同步</text></view></view>
      <view class="section-head"><text>系统数据（自动同步）</text><k-icon name="circle-help" :size="16" color="muted" /></view>
      <view class="metric-list">
        <view v-for="item in dailyItems" :key="item.name" class="metric" @click="item.manual ? s = 2 : toast(item.name)">
          <view class="metric__icon" :class="'metric__icon--' + item.tone"><k-icon :name="item.icon" :size="29" color="white" /></view>
          <view class="metric__main"><text class="metric__name">{{ item.name }} <text class="metric__source">（{{ item.source }}）</text></text><text class="metric__detail">{{ item.detail }}</text></view>
          <view class="metric__right"><text class="metric__amount">{{ item.amount }}</text><text class="metric__delta">较昨日 <text :class="item.up ? 'k-red' : 'k-green'">{{ item.delta }} {{ item.up ? '↑' : '↓' }}</text></text></view>
        </view>
      </view>
      <view class="profit"><text class="profit__label">今日净利润</text><view class="k-between"><text class="profit__amount">¥4,220</text><text class="profit__delta">较昨日 <text>+9.3% ↑</text></text></view></view>
      <view class="data-note"><k-icon name="info" :size="15" color="muted" /><text>数据说明：系统数据自动同步，手动数据需人工录入</text></view>
    </view>

    <view v-else-if="s === 2" class="k-body k-pad-tab add-page">
      <view class="type-tabs"><view class="type-tabs__item active"><text>收入</text></view><view class="type-tabs__item"><text>支出</text></view></view>
      <view class="field-group"><view class="field-label"><text>分类</text><text class="required">*</text></view><view class="field"><text class="placeholder">请选择分类</text><k-icon name="chevron-right" :size="18" color="ink" /></view></view>
      <view class="field-group"><view class="field-label"><text>金额（元）</text><text class="required">*</text></view><view class="field"><text class="placeholder">请输入金额</text><text class="field__suffix">0.00</text></view></view>
      <view class="field-group"><view class="field-label"><text>支付方式</text><text class="required">*</text></view><view class="pay-types"><view v-for="pay in pays" :key="pay" class="pay" :class="{ active: pay === '微信' }"><text>{{ pay }}</text></view></view></view>
      <view class="field-group"><view class="field-label"><text>说明</text></view><view class="field"><text class="placeholder">请输入说明（选填）</text><text class="field__counter">0/120</text></view></view>
      <view class="field-group"><view class="field-label"><text>凭证上传</text><text class="k-meta">（选填）</text></view><view class="upload" @click="toast('上传凭证')"><k-icon name="plus" :size="28" color="ink" /><text>上传凭证</text><text>最多5张</text></view></view>
      <view class="add-actions"><k-button size="md" class="k-flex1" @click="s = 3">保存</k-button><k-button size="md" type="secondary" class="k-flex1" @click="toast('已保存，请继续录入')">保存并继续</k-button></view>
    </view>

    <view v-else-if="s === 3" class="k-body k-pad-tab summary-page">
      <view class="date-box summary-date"><text>2026年8月29日（周五）</text><k-icon name="calendar-days" :size="20" color="ink" /></view>
      <view class="source-legend"><text>数据来源：</text><view class="legend-dot legend-dot--green" /><text>系统自动</text><view class="legend-dot legend-dot--ochre" /><text>手动录入</text></view>
      <view class="summary-cards"><view v-for="card in summaries" :key="card.label" class="summary-card"><text>{{ card.label }}</text><text class="summary-card__amount" :class="card.green ? 'k-green' : 'k-red'">{{ card.amount }}</text><text class="summary-card__delta">较昨日 <text>+{{ card.delta }} ↑</text></text></view></view>
      <view class="warning" @click="toast('查看异常详情')"><k-icon name="triangle-alert" :size="19" color="ochre" /><text>异常提示：二消收入环比下降超过 20%</text><k-icon name="chevron-right" :size="19" color="ink" /></view>
      <text class="table-title">明细列表</text>
      <view class="filter-tabs"><view class="filter-tabs__item active"><text>全部</text></view><view class="filter-tabs__item"><text>收入</text></view><view class="filter-tabs__item"><text>支出</text></view></view>
      <view class="details-table"><view class="details-row details-row--head"><text>项目 / 分类</text><text>金额（元）</text><text>来源</text><text>操作</text></view><view v-for="row in detailRows" :key="row.name" class="details-row"><text>{{ row.name }}</text><text>{{ row.amount }}</text><view class="source-cell"><view class="legend-dot" :class="row.system ? 'legend-dot--green' : 'legend-dot--ochre'" /><text>{{ row.system ? '系统' : '手动' }}</text></view><k-icon name="eye" :size="18" color="ink" /></view></view>
      <view class="summary-actions"><k-button size="md" type="secondary" class="k-flex1" icon="plus" @click="s = 2">新增明细</k-button><k-button size="md" class="summary-actions__pdf" icon="file-down" @click="s = 4">导出PDF</k-button></view>
    </view>

    <view v-else class="k-body k-pad-tab export-page">
      <view class="paper">
        <view class="paper__brand"><view><text class="paper__title">每日经营报表</text><text class="paper__meta">门店名称：西湖边 · 温馨一居室</text><text class="paper__meta">报表日期：2026年8月29日（周五）</text><text class="paper__meta">数据来源：系统自动 + 手动录入</text></view><view class="paper__logo"><text>袋鼠小院</text><text>好工作 · 好生活</text><image src="/static/media/tasks-success-kangaroo.jpg" mode="aspectFit" /></view></view>
        <text class="paper__section">一、收入明细</text><view class="paper-table"><view class="paper-row paper-row--head"><text>项目</text><text>金额（元）</text><text>来源</text><text>备注</text></view><view v-for="r in incomeRows" :key="r[0]" class="paper-row"><text v-for="cell in r" :key="cell">{{ cell }}</text></view></view>
        <text class="paper__section">二、支出明细</text><view class="paper-table"><view class="paper-row paper-row--head"><text>项目</text><text>金额（元）</text><text>来源</text><text>操作</text></view><view v-for="r in expenseRows" :key="r[0]" class="paper-row"><text v-for="cell in r" :key="cell">{{ cell }}</text></view></view>
        <text class="paper__section">三、经营汇总</text><view class="paper-table paper-table--totals"><view class="paper-row paper-row--head"><text>总营收</text><text>总支出</text><text>净利润</text></view><view class="paper-row"><text>5,780</text><text>1,560</text><text class="k-green">4,220</text></view></view>
        <view class="signature"><text>主理人签名：</text><view class="signature__line" /><text>日期：</text><view class="signature__line signature__line--date" /></view><text class="paper__note">备注：本报表由袋鼠小院系统生成，仅供内部经营参考。</text>
      </view>
      <text class="recipient-title">发送给主理人</text>
      <view class="recipient"><image src="/static/media/staff-avatar-abu-m.jpg" mode="aspectFill" /><view class="k-flex1"><text class="recipient__name">小院主理人</text><text class="recipient__wechat">微信号：dai_shu_xiaoyuan</text></view><k-button size="sm" type="green" icon="message-circle" @click="toast('已发送给主理人')">发送</k-button></view>
      <k-button block size="md" class="download" @click="toast('PDF已下载')">下载PDF</k-button>
    </view>

    <k-tabbar mode="staff" active="business" />
  </view>
</template>

<script setup>
import { useScreen, back, toast } from '@/common/screen.js'
const s = useScreen(4)
const titles = ['每日经营报表', '新增明细', '经营汇总', '导出报表']
const onBack = () => { if (s.value > 1) s.value -= 1; else back() }
const dailyItems = [
  { name: '订房收入', source: '系统', detail: '订单 12 笔', amount: '¥4,860', delta: '+8.2%', up: true, tone: 'green', icon: 'bed-double' },
  { name: '二消收入', source: '系统', detail: '订单 18 笔', amount: '¥620', delta: '-3.1%', up: false, tone: 'ochre', icon: 'coffee' },
  { name: '其他收入', source: '手动', detail: '2 笔明细', amount: '¥300', delta: '+12.5%', up: true, tone: 'green-dark', icon: 'wallet-cards', manual: true },
  { name: '采购支出', source: '手动', detail: '5 笔明细', amount: '¥780', delta: '+5.4%', up: true, tone: 'blue', icon: 'shopping-cart', manual: true },
  { name: '其他支出', source: '手动', detail: '3 笔明细', amount: '¥780', delta: '-2.0%', up: false, tone: 'blue', icon: 'file-clock', manual: true }
]
const pays = ['现金', '微信', '支付宝', '银行卡', '其他']
const summaries = [{ label: '总营收', amount: '¥5,780', delta: '9.3%', green: false }, { label: '总支出', amount: '¥1,560', delta: '4.1%', green: false }, { label: '净利润', amount: '¥4,220', delta: '12.7%', green: true }]
const detailRows = [
  { name: '订房收入', amount: '¥4,860', system: true }, { name: '二消收入', amount: '¥620', system: true }, { name: '其他收入', amount: '¥300', system: false }, { name: '采购支出', amount: '¥780', system: false }, { name: '其他支出', amount: '¥780', system: false }
]
const incomeRows = [['订房收入','4,860','系统','订单12笔'],['二消收入','620','系统','订单18笔'],['其他收入','300','手动','2笔明细'],['收入合计','5,780','','']]
const expenseRows = [['采购支出','780','手动','5笔明细'],['其他支出','780','手动','3笔明细'],['支出合计','1,560','','']]
</script>

<style scoped lang="scss">
.date-line { display: flex; align-items: center; justify-content: space-between; }
.date-box { width: 222px; height: 38px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.synced { display: flex; align-items: center; gap: 5px; color: var(--k-muted); font-size: 12px; }
.section-head { display: flex; align-items: center; gap: 5px; margin: 13px 0 8px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.metric-list { display: flex; flex-direction: column; gap: 8px; }
.metric { min-height: 69px; padding: 9px 11px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); display: flex; align-items: center; gap: 13px; }
.metric__icon { width: 47px; height: 47px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }
.metric__icon--green { background: #78A486; }.metric__icon--ochre { background: #CA8732; }.metric__icon--green-dark { background: var(--k-green); }.metric__icon--blue { background: var(--k-indigo); }
.metric__main { flex: 1; }
.metric__name { display: block; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }.metric__source { font-size: 12px; }.metric__detail { display: block; margin-top: 8px; color: var(--k-muted); font-size: 12px; }
.metric__right { text-align: right; }.metric__amount { display: block; color: var(--k-red); font-family: Georgia, serif; font-size: 24px; line-height: 1.1; }.metric__delta { display: block; margin-top: 8px; color: var(--k-muted); font-size: 12px; }
.profit { margin-top: 11px; padding: 11px 16px; border: 1px solid rgba(169,71,52,.5); border-radius: 10px; background: var(--k-paper); }.profit__label { display: block; font-family: var(--k-serif); font-size: 15px; }.profit__amount { margin-top: 6px; color: var(--k-red); font-family: Georgia, serif; font-size: 27px; }.profit__delta { color: var(--k-muted); font-size: 12px; }.profit__delta text { color: var(--k-red); font-weight: 700; }
.data-note { display: flex; align-items: center; gap: 5px; margin-top: 9px; color: var(--k-muted); font-size: 11px; }

.type-tabs { display: flex; height: 38px; border: 1px solid var(--k-line); border-radius: 9px; overflow: hidden; }.type-tabs__item { flex: 1; display: flex; align-items: center; justify-content: center; font-family: var(--k-serif); font-size: 16px; }.type-tabs__item.active { color: var(--k-red); border: 1px solid var(--k-red); border-radius: 9px; font-weight: 700; }
.field-group { margin-top: 20px; }.field-label { display: flex; align-items: center; margin-bottom: 8px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }.required { margin-left: 4px; color: var(--k-red); }.field { height: 40px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; }.placeholder { color: var(--k-muted); font-size: 13px; }.field__suffix,.field__counter { margin-left: auto; color: var(--k-muted); font-size: 16px; }.field__counter { font-size: 13px; }
.pay-types { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; }.pay { height: 34px; border: 1px solid var(--k-line); border-radius: 7px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 13px; }.pay.active { color: var(--k-red); border-color: var(--k-red); }
.upload { width: 68px; height: 76px; border: 1px dashed var(--k-line2); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--k-muted); font-size: 11px; }.add-actions { display: flex; gap: 14px; margin-top: 40px; }

.summary-date { width: 224px; }.source-legend { display: flex; align-items: center; gap: 7px; margin: 13px 0 10px; color: var(--k-muted); font-size: 12px; }.legend-dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }.legend-dot--green { background: var(--k-green); }.legend-dot--ochre { background: #D8871D; }
.summary-cards { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }.summary-card { height: 96px; padding: 13px 8px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); text-align: center; font-family: var(--k-serif); font-size: 15px; }.summary-card__amount { display: block; margin-top: 10px; font-family: Georgia, serif; font-size: 24px; }.summary-card__delta { display: block; margin-top: 10px; color: var(--k-muted); font-family: sans-serif; font-size: 11px; }.summary-card__delta text { color: var(--k-red); font-weight: 700; }
.warning { height: 38px; margin-top: 16px; padding: 0 11px; border: 1px solid rgba(197,132,41,.5); border-radius: 8px; background: var(--k-ochre-soft); display: flex; align-items: center; gap: 8px; color: #8D6226; font-size: 13px; }.warning text { flex: 1; }.table-title { display: block; margin-top: 16px; font-family: var(--k-serif); font-size: 17px; font-weight: 700; }
.filter-tabs { display: flex; gap: 8px; margin: 8px 0 10px; }.filter-tabs__item { width: 70px; height: 30px; border: 1px solid var(--k-line); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; }.filter-tabs__item.active { color: var(--k-red); border-color: var(--k-red); }
.details-table { border: 1px solid var(--k-line); border-radius: 8px; overflow: hidden; }.details-row { height: 35px; display: grid; grid-template-columns: 1.35fr 1fr .95fr .55fr; align-items: center; border-top: 1px solid var(--k-line); font-size: 12px; }.details-row:first-child { border-top: 0; }.details-row--head { background: var(--k-paper2); color: var(--k-muted); font-weight: 600; }.details-row > text,.details-row > view,.details-row > uni-view { padding-left: 10px; }.source-cell { display: flex; align-items: center; gap: 6px; }.summary-actions { display: flex; gap: 14px; margin-top: 16px; }.summary-actions__pdf { flex: 1.4; }

.paper { padding: 12px 18px 8px; border: 1px solid var(--k-line2); background: #fff; box-shadow: 0 2px 9px rgba(61,45,31,.08); }.paper__brand { display: flex; justify-content: space-between; }.paper__title { display: block; margin: 2px 0 7px; font-family: var(--k-serif); font-size: 23px; font-weight: 700; }.paper__meta { display: block; margin-top: 3px; font-size: 10px; }.paper__logo { position: relative; width: 100px; text-align: center; }.paper__logo text { display: block; font-family: var(--k-serif); font-size: 13px; }.paper__logo text:nth-child(2) { margin-top: 2px; font-family: sans-serif; font-size: 8px; }.paper__logo image { width: 66px; height: 36px; mix-blend-mode: multiply; }.paper__section { display: block; margin: 6px 0 3px; font-family: var(--k-serif); font-size: 12px; font-weight: 700; }
.paper-table { border: 1px solid #BFB8AD; }.paper-row { min-height: 19px; display: grid; grid-template-columns: 1.15fr 1.25fr .8fr 1.2fr; border-top: 1px solid #CBC4B9; font-size: 9px; }.paper-row:first-child { border-top: 0; }.paper-row text { display: flex; align-items: center; justify-content: center; border-left: 1px solid #CBC4B9; }.paper-row text:first-child { border-left: 0; }.paper-row--head { background: #F2EEE6; font-weight: 700; }.paper-table--totals .paper-row { grid-template-columns: repeat(3,1fr); }.paper-table--totals .paper-row:last-child { font-family: Georgia, serif; font-size: 12px; font-weight: 700; }
.signature { display: flex; align-items: flex-end; gap: 7px; margin-top: 9px; font-size: 9px; }.signature__line { width: 98px; border-bottom: 1px solid #777; }.signature__line--date { width: 70px; }.paper__note { display: block; margin-top: 6px; color: var(--k-muted); font-size: 8px; }
.recipient-title { display: block; margin-top: 9px; font-family: var(--k-serif); font-size: 17px; font-weight: 700; }.recipient { height: 50px; margin-top: 5px; padding: 0 10px; border: 1px solid var(--k-line); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; gap: 9px; }.recipient image { width: 34px; height: 34px; border-radius: 50%; }.recipient__name { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }.recipient__wechat { display: block; margin-top: 3px; color: var(--k-muted); font-size: 11px; }.download { margin-top: 6px; }
</style>
