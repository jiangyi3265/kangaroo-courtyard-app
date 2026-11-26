<template><view class="governance gov-mc"><k-topbar title="商家合作复核" back/>
    <k-subscribe class="gov-sub" scenes="governance_case" label="订阅合作处理提醒" /><view class="gov-body">
<text v-if="error" class="gov-error">{{error}}</text><text v-if="feedback" class="gov-success">{{feedback}}</text>
<template v-if="!id"><view class="gov-head"><text class="gov-title">合作通知与申诉</text><button class="gov-refresh" @click="load"><k-icon name="refresh-cw" :size="14" color="muted"/><text>刷新记录</text></button></view><text class="gov-muted">查看所管理门店的复核通知、申诉期限和处理记录。</text><view v-if="!loading&&!rows.length" class="gov-empty-box"><view class="gov-empty-art"><k-icon name="store" :size="28" color="red"/></view><text class="gov-empty-title">暂无合作复核通知</text><text class="gov-empty">收到复核通知后会显示在这里，可在申诉期内提交申诉</text></view><view v-for="c in rows" :key="c.caseId" class="gov-item mc-case" hover-class="k-press-s" @click="open(c.caseId)"><view class="gov-row"><text class="gov-item-title">{{c.storeName}}</text><text class="gov-badge" :class="'mc-'+c.status">{{states[c.status]}}</text></view><text class="gov-copy">{{types[c.violation]}}</text><view class="mc-foot"><k-icon name="clock" :size="12" color="muted"/><text class="gov-time">申诉截止 {{c.appealDeadline}}<text class="mc-tz">（北京时间）</text></text></view><k-icon class="mc-arrow" name="chevron-right" :size="12" color="muted"/></view><view v-if="total>20" class="gov-actions"><button :disabled="page===1" @click="page--;load()">上一页</button><button :disabled="page*20>=total" @click="page++;load()">下一页</button></view></template>
<template v-else-if="detail"><view class="mc-hero"><view class="gov-row mc-hero__head"><text class="gov-title">{{detail.storeName}}</text><text class="gov-badge" :class="'mc-'+detail.status">{{states[detail.status]}}</text></view><text class="gov-copy">{{types[detail.violation]}}</text></view><view class="gov-section"><text class="gov-heading">事实与依据</text><text class="gov-copy">{{detail.facts}}</text><text class="form-label">核验依据</text><text class="gov-copy">{{detail.basis}}</text><text class="gov-time">申诉截止 {{detail.appealDeadline}}（北京时间）</text></view>
<view v-if="detail.status==='notified'" class="gov-section"><text class="gov-heading">提交申诉</text><text class="gov-muted">在申诉期限内说明需要重新核实的事实，至少10字。</text><textarea v-model="note" maxlength="2000" placeholder="填写事实、证据线索和申诉理由"/><button class="primary" :disabled="busy||note.trim().length<10" @click="appeal">{{busy?'提交中…':'提交申诉'}}</button></view>
<view v-if="detail.appeal" class="gov-section"><text class="gov-heading">已提交的申诉</text><text class="gov-copy">{{detail.appeal}}</text></view><view v-if="detail.response" class="gov-section"><text class="gov-heading">总部复核结果</text><text class="gov-copy">{{detail.response}}</text><text v-if="detail.endsAt" class="gov-time">限制期限至 {{detail.endsAt}}（北京时间）</text><text v-if="detail.feeState==='awaiting_settlement_basis'" class="gov-muted">50%服务费分成处理待财务核对结算依据，当前尚未扣款。</text></view>
<view v-if="detail.settlement" class="gov-section"><text class="gov-heading">{{detail.settlement.feeMonth}} 服务费分成结算</text><text class="gov-copy">应分成：{{money(detail.settlement.grossFen)}}
处罚扣除：{{money(detail.settlement.deductionFen)}}
扣除后应付：{{money(detail.settlement.netFen)}}</text><text class="gov-muted">{{detail.settlement.status==='paid'?'已登记付款':detail.settlement.status==='approved'?'已复核，待付款':'待财务核对'}}</text></view><view class="gov-section"><text class="gov-heading">处理记录</text><view class="gov-timeline"><view v-for="(log,i) in detail.logs" :key="i" class="gov-item"><text class="gov-copy">{{log.note}}</text><text class="gov-time">{{log.createTime}}</text></view></view></view><view class="gov-actions mc-actions"><button @click="load"><k-icon name="refresh-cw" :size="14" color="red"/><text>刷新进度</text></button><button @click="id=0;load()"><k-icon name="list" :size="14" color="red"/><text>返回列表</text></button></view></template>
</view></view></template>
<script setup>
import {ref} from 'vue';import {onLoad,onShow} from '@dcloudio/uni-app';import {governanceGet as get,governancePost as post} from '@/common/governance.js'
const states={notified:'申诉期内',appealed:'待总部复核',cancelled:'已撤销',suspended:'暂停合作',blacklisted:'已解除合作',expired:'已恢复合作',expired_review:'期限结束，待核实恢复'},types={positive_fraud:'组织刷好评',competitor_attack:'恶意攻击同行',collusion:'与用户串通刷评'}
const money=n=>n==null?'待财务录入':'¥'+(Number(n)/100).toFixed(2)
const id=ref(0),page=ref(1),total=ref(0),rows=ref([]),detail=ref(null),error=ref(''),feedback=ref(''),note=ref(''),busy=ref(false),loading=ref(false)
async function load(){error.value='';loading.value=true;try{const r=(await get(id.value?'merchant-cases/'+id.value:'merchant-cases',{pageNum:page.value})).data;if(id.value)detail.value=r;else{rows.value=r.rows;total.value=r.total}}catch(e){error.value=e.message||'加载失败'}finally{loading.value=false}}
function open(n){uni.navigateTo({url:'/pages/governance/merchant-cases?id='+n})}
async function appeal(){if(busy.value)return;busy.value=true;error.value='';try{await post('merchant-cases/'+id.value+'/appeal',{note:note.value});feedback.value='申诉已提交，总部复核后会更新结果';note.value='';await load()}catch(e){error.value=e.message||'提交失败，内容已保留'}finally{busy.value=false}}
onLoad(q=>id.value=Number(q.id)||0);onShow(load)
</script><style lang="scss">@import './governance.scss';
/* 2026-11-18 第三轮逐页精修：标题右边一个灰色「刷新记录」小字钮；空的时候是图标 + 说明的空状态；
   每条通知卡：门店名 15/600 + 状态小标签（申诉期内用提醒红），违规类型 13 号，底下发丝线隔开「截止时间 + 小箭头」；
   详情页头部是一张白卡（状态标签、门店名、违规类型），底部「刷新进度 / 返回列表」两个等宽次按钮。 */
.gov-mc .gov-head .gov-title{margin-top:12px}
.governance .mc-case{padding:16px}.mc-case .gov-item-title{font-size:15px;line-height:22px}.mc-case>.gov-copy{margin-top:2px}
.mc-foot{position:relative;display:flex;align-items:center;gap:4px;margin-top:10px;padding-top:10px}.mc-foot::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}.mc-foot .gov-time{flex:1;margin:0;font-variant-numeric:tabular-nums}
.governance .mc-notified,.governance .mc-suspended,.governance .mc-blacklisted{background:var(--k-alert-soft);color:var(--k-alert)}
.governance .mc-cancelled,.governance .mc-expired{background:var(--k-green-soft);color:var(--k-green)}
.mc-hero{margin-top:12px;padding:16px;border-radius:12px;background:var(--k-paper)}.mc-hero .gov-title{margin:8px 0 2px}
.gov-mc .gov-section textarea{margin-top:12px;background:var(--k-page);border:0;border-radius:8px}
.gov-mc .gov-section>button.primary{width:100%;height:44px;margin-top:12px;padding:0;border-radius:22px;line-height:44px}
.governance .mc-actions{display:flex;flex-wrap:nowrap;gap:8px;margin:16px 0 0}
.governance .mc-actions button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;height:44px;margin:0;padding:0;border-radius:22px;font-size:14px;font-weight:500;line-height:44px}
/* 2026-11-18 第三轮返修（评审第 1 轮）：标题说明和第一张通知卡之间空 16（原来只隔 2）；空状态加 14/500 标题 + 12 号说明；
   详情头卡门店名 18/700 和状态标签同一行（标签靠右），违规类型 13 号二级墨色；处理记录用时间轴。 */
.gov-mc .gov-body>.gov-head+.gov-muted{display:block;margin:4px 0 16px}
.governance .mc-hero__head{align-items:flex-start;gap:12px}
.governance .mc-hero .mc-hero__head .gov-title{flex:1;min-width:0;margin:0;font-size:18px;line-height:26px}
.governance .mc-hero__head .gov-badge{margin-top:3px}
.governance .mc-hero>.gov-copy{margin-top:4px;font-size:13px;color:var(--k-ink2)}
/* 11-18 第三轮返修（评审第 3 轮）：空状态说明最宽 168，两行差不多长、不拆词 */
.governance .gov-empty-box>.gov-empty,.governance .gov-body>.gov-empty-box>.gov-empty{max-width:168px}
/* 2026-11-18 第三轮返修（评审第 4 轮）：通知卡右侧小箭头挪到卡片右边垂直居中（原来只挂在底部那行）；「（北京时间）」退成 11 号浅灰。 */
.governance .gov-body>.gov-item.mc-case{padding-right:36px}
.mc-arrow{position:absolute;right:16px;top:50%;margin-top:-6px}
.mc-tz{font-size:11px;color:var(--k-light)}
/* 2026-11-18 第四轮精修（按微信实拍评审））
   1) 列表为空时整页只剩这一个空状态：不套白卡，直接放在页面底色上，离标题约 64（看起来是有意的留白，不再像一张孤零零的白卡）；
   2) 标题行右侧「刷新记录」右边缘对齐卡片右线（图标 14、间距 4）。 */
.gov-mc .gov-body>.gov-head>.gov-refresh{margin-right:0;padding-right:0;gap:4px}
/* 2026-11-19 第四轮返修（按复评）：右侧小箭头不再单独垂直居中 —— 放在卡底「申诉截止」那一行的右端，和右上状态标签右边对齐在同一条线（卡右内边距 16）。 */
.governance .gov-body>.gov-item.mc-case{padding-right:16px}
.mc-case>.mc-arrow{top:auto;bottom:19px;right:16px;margin-top:0}
.mc-case>.mc-foot{padding-right:20px}
/* 2026-11-19 第五轮（按微信实拍复核）：
   1) 空状态回到和纠纷调解、大众评审一样的白卡（共用样式：白底、内边距 32/16、圆角 12），离上面说明 16；
   2) 标题行「刷新记录」和顶上「订阅合作处理提醒」同为 12 号字。 */
.gov-mc .gov-body>.gov-muted+.gov-empty-box{margin-top:16px}
.gov-mc .gov-head>.gov-refresh{font-size:12px}
</style>
