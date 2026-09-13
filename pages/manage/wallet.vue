<template>
  <view class="k-page wallet">
    <k-topbar :title="titles[s - 1]" back @back="onBack" />

    <view v-if="s === 1" class="k-body k-pad-tab wallet-page">
      <view class="owner-card"><image src="/static/media/staff-avatar-abu-m.jpg" mode="aspectFill" /><view><view class="owner-line"><text class="owner-name">小院主理人</text><k-chip tone="ochre" icon="star"><text>主理人认证</text></k-chip></view><text class="owner-days">加入袋鼠小院第 286 天</text></view></view>
      <view class="balance-card"><text class="card-label">可提现余额（元）</text><view class="k-between"><text class="balance">¥ 3,286.00</text><k-button size="sm" @click="s = 3">提现</k-button></view><text class="account">微信账户：Kangaroo***@wechat.com</text></view>
      <view class="income-grid"><view class="income-card"><text class="card-label">本月收益（8月1日-8月29日）</text><text class="income-card__num">¥ 5,780.00</text><text class="income-card__meta">较上月 <text class="k-green">+12.5%</text></text></view><view class="income-card"><text class="card-label">待结算收益</text><text class="income-card__num">¥ 1,280.00</text><text class="income-card__meta">结算日 2026-09-05</text></view></view>
      <text class="section-title">收益来源占比 <text class="k-meta">（本月）</text></text>
      <view class="source-grid"><view v-for="item in sources" :key="item.label" class="source-card" @click="s = 2"><k-icon :name="item.icon" :size="35" :color="item.color" /><text class="source-card__label">{{ item.label }}</text><text class="source-card__amount" :style="{color:item.hex}">{{ item.amount }}</text><text>{{ item.pct }}</text></view></view>
      <text class="section-title recent-title">最近一笔收益</text>
      <view class="recent"><k-icon name="coffee" :size="36" color="green" /><view class="k-flex1"><text class="recent__name">二消收入 - 手作体验课</text><text class="recent__place">西湖边 · 温馨一居室</text></view><view class="recent__right"><text>¥ 98.00</text><text>08-29　已到账</text></view></view>
    </view>

    <view v-else-if="s === 2" class="k-pad-tab detail-page">
      <view class="detail-filter"><view class="filter-box"><text>全部类型</text><k-icon name="chevron-down" :size="15" color="ink" /></view><view class="filter-box filter-box--date"><text>2026-08-01 ～ 2026-08-29</text><k-icon name="calendar-days" :size="17" color="ink" /></view><view class="square"><k-icon name="search" :size="20" color="ink" /></view><view class="square square--text"><text>导出</text></view></view>
      <view class="earn-table"><view class="earn-head"><text>订单信息</text><text>收入类型</text><text>订单金额</text><text>分佣率</text><text>到账金额 / 状态</text></view><view v-for="row in earnings" :key="row.id" class="earn-row"><view><text>订单号 {{ row.id }}</text><text>{{ row.time }}</text><text>{{ row.place }}</text></view><text :class="row.tone">{{ row.type }}</text><text>{{ row.order }}</text><text>{{ row.rate }}</text><view class="earn-row__received"><text>{{ row.received }}</text><text>已到账</text></view></view></view>
    </view>

    <view v-else-if="s === 3" class="k-body k-pad-tab withdraw-page">
      <view class="withdraw-balance"><view><text>可提现余额</text><text class="withdraw-balance__num">¥ 3,286.00</text></view><text class="k-red">全部提现</text></view>
      <view class="withdraw-amount"><view class="k-between"><text>提现金额</text><text>全部提现</text></view><text class="withdraw-amount__num">¥ 3,286.00</text><text class="k-meta">可提现余额 ¥ 3,286.00</text></view>
      <view class="plain-row"><text>到账微信账户</text><view class="k-row k-gap8"><k-icon name="wechat" :size="23" color="green" /><text>Kangaroo***@wechat.com</text><k-icon name="chevron-right" :size="18" color="muted" /></view></view>
      <view class="fee-card"><view class="k-between"><text>手续费</text><text>¥ 0.00</text></view><view class="fee-card__line" /><text class="k-meta">当前免手续费提现</text></view>
      <view class="plain-row"><text>预计到账时间</text><view class="k-row k-gap6"><text>2026-08-29（今天）18:00 前到账</text><k-icon name="info" :size="15" color="muted" /></view></view>
      <view class="code-card"><text class="code-card__title">短信验证码</text><view class="code-line"><view class="code-input"><text>请输入短信验证码</text></view><k-button size="md" type="secondary" @click="toast('验证码已发送')">获取验证码</k-button></view><text class="k-meta">验证码将发送至 138****8888</text></view>
      <view class="safe"><k-icon name="shield-check" :size="17" color="green" /><text>资金安全保障中，我们将严格保护您的账户信息</text></view>
      <k-button block size="md" class="confirm" @click="toast('提现申请已提交')">确认提现</k-button>
    </view>

    <view v-else class="k-body k-pad-tab rules-page">
      <text class="section-title">分佣规则总览</text>
      <view class="rule-list"><view v-for="rule in rules" :key="rule.title" class="rule"><view class="rule__icon"><k-icon :name="rule.icon" :size="31" :color="rule.color" /></view><view class="k-flex1"><text class="rule__title">{{ rule.title }}</text><text class="rule__desc">{{ rule.desc }}</text></view><view class="rule__rate"><text>提成</text><text>{{ rule.rate }}</text></view></view></view>
      <text class="section-title rule-section">营业额提成阶梯规则</text>
      <view class="tier-table"><view class="tier-row tier-row--head"><text>月度营业额（元）</text><text>提成比例</text></view><view v-for="tier in tiers" :key="tier[0]" class="tier-row"><text>{{ tier[0] }}</text><text>{{ tier[1] }}</text></view></view>
      <text class="section-title rule-section">案例计算</text>
      <view class="case"><text>举例：本月营业额 ¥ 28,600，二消收入 ¥ 3,200，代运营引流收入 ¥ 1,000</text><text>• 营业额提成：¥ 28,600 × 2% ＝ ¥ 572.00</text><text>• 二消收入提成：¥ 3,200 × 5% ＝ ¥ 160.00</text><text>• 代运营引流提成：¥ 1,000 × 2% ＝ ¥ 20.00</text><text class="case__total">本月预计收益：¥ 752.00</text></view>
      <view class="tips"><view v-for="tip in tips" :key="tip.title" class="tip"><k-icon :name="tip.icon" :size="25" color="ink" /><text class="tip__title">{{ tip.title }}</text><view class="tip__line" /><text class="tip__desc">{{ tip.desc }}</text></view></view>
    </view>

    <k-tabbar mode="staff" active="business" /><view class="msg-dot" />
  </view>
</template>

<script setup>
import { useScreen, back, toast } from '@/common/screen.js'
const s = useScreen(4)
const titles = ['主理人钱包', '收益明细', '提现', '分佣规则']
const onBack = () => { if (s.value > 1) s.value = 1; else back() }
const sources = [{ label:'二消收入', amount:'¥ 2,460', pct:'42%', icon:'coffee', color:'green', hex:'#4F856C' },{ label:'营业收入', amount:'¥ 2,320', pct:'40%', icon:'house', color:'indigo', hex:'#3F5F82' },{ label:'代运营引流', amount:'¥ 1,000', pct:'18%', icon:'users-round', color:'ochre', hex:'#A46A1E' }]
const earnings = [
  {id:'20260829001',time:'08-29 14:30',place:'西湖边 · 温馨一居室',type:'二消收入',tone:'k-green',order:'¥ 350.00',rate:'5%',received:'¥ 17.50'},
  {id:'20260828005',time:'08-28 18:45',place:'海边小院 · 一房室',type:'营业收入',tone:'k-indigo',order:'¥ 1,280.00',rate:'2%',received:'¥ 25.60'},
  {id:'20260828003',time:'08-28 15:20',place:'花艺咖啡（兼职）',type:'二消收入',tone:'k-green',order:'¥ 198.00',rate:'5%',received:'¥ 9.90'},
  {id:'20260827002',time:'08-27 20:10',place:'西湖边 · 温馨一居室',type:'代运营引流',tone:'k-ochre',order:'¥ 280.00',rate:'2%',received:'¥ 5.60'},
  {id:'20260826004',time:'08-26 11:05',place:'山谷小院 · 两房室',type:'营业收入',tone:'k-indigo',order:'¥ 880.00',rate:'1%',received:'¥ 8.80'},
  {id:'20260825001',time:'08-25 16:40',place:'海边小院 · 一房室',type:'二消收入',tone:'k-green',order:'¥ 430.00',rate:'5%',received:'¥ 21.50'},
  {id:'20260824002',time:'08-24 09:20',place:'西湖边 · 温馨一居室',type:'营业收入',tone:'k-indigo',order:'¥ 2,680.00',rate:'3%',received:'¥ 80.40'},
  {id:'20260823006',time:'08-23 17:30',place:'',type:'代运营引流',tone:'k-ochre',order:'¥ 320.00',rate:'2%',received:'¥ 6.40'}
]
const rules = [{title:'二消收入提成',desc:'主理人组织的手作体验、课程、活动等二次消费',rate:'5%',icon:'coffee',color:'green'},{title:'营业额提成',desc:'通过袋鼠小院平台产生的房源订单营业额',rate:'1%-3%',icon:'house',color:'indigo'},{title:'代运营引流提成',desc:'通过代运营服务带来的有效订单营业额',rate:'2%',icon:'users-round',color:'ochre'}]
const tiers = [['0 - 10,000','1%'],['10,001 - 30,000','2%'],['30,001 及以上','3%']]
const tips = [{title:'结算周期',desc:'每月5日结算上月收益，节假日顺延',icon:'receipt-text'},{title:'退款反冲',desc:'退订/退款将反向扣除对应收益',icon:'refresh-cw'},{title:'如有疑问',desc:'联系专属客服 400-123-4567',icon:'headphones'}]
</script>

<style scoped lang="scss">
.section-title { display:block; font-family:var(--k-serif); font-size:17px; font-weight:700; }
.owner-card { height:77px; padding:0 12px; border:1px solid var(--k-line); border-radius:11px; background:var(--k-paper); display:flex; align-items:center; gap:13px; }.owner-card image { width:58px;height:58px;border-radius:50%; }.owner-line { display:flex;align-items:center;gap:10px; }.owner-name { font-family:var(--k-serif);font-size:18px;font-weight:700; }.owner-days { display:block;margin-top:8px;color:var(--k-muted);font-size:13px; }
.balance-card { margin-top:11px;padding:14px 15px;border:1px solid var(--k-line);border-radius:11px;background:var(--k-paper); }.card-label { display:block;font-family:var(--k-serif);font-size:15px;font-weight:700; }.balance { margin-top:10px;color:var(--k-red);font-family:Georgia,serif;font-size:32px; }.account { display:block;margin-top:10px;color:var(--k-muted);font-size:13px; }
.income-grid { display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px; }.income-card { height:82px;padding:12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper); }.income-card__num { display:block;margin-top:13px;color:var(--k-red);font-family:Georgia,serif;font-size:22px; }.income-card__meta { display:block;margin-top:8px;color:var(--k-muted);font-size:12px; }
.income-card .card-label { font-size:12px; white-space:nowrap; }
.wallet-page .section-title { margin-top:16px; }.source-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px; }.source-card { height:131px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;font-size:13px; }.source-card__label { font-family:var(--k-serif);font-size:15px;font-weight:700; }.source-card__amount { font-family:Georgia,serif;font-size:21px; }.recent-title { margin-top:14px!important; }.recent { height:61px;margin-top:7px;padding:0 12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:12px; }.recent__name { display:block;font-family:var(--k-serif);font-size:14px;font-weight:700; }.recent__place { display:block;margin-top:5px;color:var(--k-muted);font-size:11px; }.recent__right { text-align:right;color:var(--k-green); }.recent__right text { display:block;font-size:12px; }.recent__right text:first-child { font-family:Georgia,serif;font-size:18px; }

.detail-filter { height:74px;padding:0 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--k-line); }.filter-box { height:34px;padding:0 10px;border:1px solid var(--k-line);border-radius:7px;display:flex;align-items:center;gap:6px;font-size:12px; }.filter-box--date { flex:1;justify-content:space-between; }.square { width:38px;height:34px;border:1px solid var(--k-line);border-radius:7px;display:flex;align-items:center;justify-content:center; }.square--text { font-size:12px; }.earn-table { border-top:1px solid var(--k-line); }.earn-head,.earn-row { display:grid;grid-template-columns:1.45fr .78fr .82fr .58fr 1.08fr; }.earn-head { height:40px;align-items:center;background:var(--k-paper2);font-size:11px;font-weight:700;text-align:center; }.earn-row { min-height:66px;border-top:1px solid var(--k-line);font-size:11px;align-items:center;text-align:center; }.earn-row > view:first-child { padding-left:11px;text-align:left; }.earn-row > view:first-child text { display:block;margin-top:4px; }.earn-row__received { color:var(--k-green); }.earn-row__received text { display:block;margin-top:4px;font-weight:700; }

.withdraw-balance,.withdraw-amount,.plain-row,.fee-card,.code-card { border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper); }.withdraw-balance { height:78px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;font-size:14px; }.withdraw-balance__num { display:block;margin-top:8px;color:var(--k-red);font-family:Georgia,serif;font-size:30px; }.withdraw-amount { margin-top:11px;padding:13px 14px;font-size:14px; }.withdraw-amount__num { display:block;margin:13px 0 8px;color:var(--k-red);font-family:Georgia,serif;font-size:30px; }.plain-row { height:48px;margin-top:11px;padding:0 14px;display:flex;align-items:center;justify-content:space-between;font-size:13px; }.fee-card { margin-top:11px;padding:14px;font-size:14px; }.fee-card__line { margin:10px 0;border-top:1px solid var(--k-line); }.code-card { margin-top:11px;padding:13px; }.code-card__title { display:block;font-family:var(--k-serif);font-size:15px;font-weight:700; }.code-line { display:flex;gap:10px;margin:11px 0 8px; }.code-input { flex:1;height:40px;padding:0 11px;border:1px solid var(--k-line);border-radius:7px;display:flex;align-items:center;color:var(--k-muted);font-size:12px; }.safe { display:flex;align-items:center;gap:7px;margin:12px 7px;color:var(--k-muted);font-size:11px; }.confirm { margin-top:8px; transform:translateY(-18px); }

.rule-list { display:flex;flex-direction:column;gap:9px;margin-top:8px; }.rule { height:62px;padding:0 12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:12px; }.rule__icon { width:42px;height:42px;border:1px solid var(--k-line);border-radius:50%;display:flex;align-items:center;justify-content:center; }.rule__title { display:block;font-family:var(--k-serif);font-size:15px;font-weight:700; }.rule__desc { display:block;margin-top:5px;color:var(--k-muted);font-size:10px; }.rule__rate { text-align:right; }.rule__rate text { display:block;color:var(--k-muted);font-size:11px; }.rule__rate text:last-child { margin-top:5px;color:var(--k-red);font-family:Georgia,serif;font-size:22px; }.rule-section { margin-top:15px; }.tier-table { margin-top:7px;border:1px solid var(--k-line);border-radius:9px;overflow:hidden; }.tier-row { height:29px;display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--k-line);text-align:center;align-items:center;font-size:13px; }.tier-row:first-child { border-top:0; }.tier-row text+text { border-left:1px solid var(--k-line); }.tier-row--head { background:var(--k-paper2);font-weight:700; }.tier-row:not(.tier-row--head) text:last-child { color:var(--k-red);font-family:Georgia,serif;font-size:16px;font-weight:700; }.case { margin-top:7px;padding:8px 10px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);display:flex;flex-direction:column;gap:5px;font-size:9px; }.case__total { color:var(--k-red);font-size:13px;font-weight:700; }.tips { display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:9px; }.tip { min-height:86px;padding:8px 9px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper); }.tip__title { margin-left:7px;font-family:var(--k-serif);font-size:14px;font-weight:700; }.tip__line { margin:6px 0;border-top:1px solid var(--k-line); }.tip__desc { color:var(--k-muted);font-size:10px;line-height:1.45; }
.msg-dot { position:fixed;z-index:51;left:254px;bottom:calc(var(--k-safe-bottom) + 47px);width:7px;height:7px;border-radius:50%;background:var(--k-red); }
</style>
