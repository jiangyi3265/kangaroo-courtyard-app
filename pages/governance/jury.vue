<template><view class="governance gov-jury" :class="$userSurface"><k-topbar :title="roundId?'匿名评审':'大众评审'" back/>
    <k-subscribe class="gov-sub" scenes="mediation_jury" label="订阅评审提醒" /><view class="gov-body"><text v-if="error" class="gov-error">{{error}}</text><text v-if="feedback" class="gov-success">{{feedback}}</text><template v-if="!roundId"><text class="gov-title">用认真倾听，帮助解决分歧</text><text class="gov-muted">独立评议，保护双方隐私。完成有效评审奖励5积分，优质评审额外奖励10积分。</text><view class="gov-row jury-will__head"><text class="gov-heading">我的参与意愿</text><text v-if="context.juror?.coreMember" class="gov-badge">核心评审员</text></view><view class="gov-section jury-will" :class="{'jury-will--core':context.juror?.coreMember}"><text v-if="!context.juror?.coreMember&&context.juror?.coreEligible" class="gov-muted">已符合核心评审条件，开启参与意愿后可进入核心评审池。</text><view class="gov-tabs jury-kinds" :class="{ 'jury-kinds--single': !context.canMerchant }"><button :class="{active:kind==='user'}" @click="kind='user'">用户评审员</button><button v-if="context.canMerchant" :class="{active:kind==='merchant'}" @click="kind='merchant'">店家评审员</button></view><picker v-if="kind==='merchant'" :range="context.merchantStores||[]" range-key="storeName" @change="store=context.merchantStores[$event.detail.value]"><view class="gov-select jury-store">{{store?.storeName||'选择合作门店'}}<k-icon name="chevron-down" :size="12" color="muted"/></view></picker><view class="gov-check jury-switch"><switch :checked="willing" :color="SWITCH_GREEN" @change="willing=$event.detail.value"/><text>愿意接收匿名评审邀请</text></view><button class="primary" :disabled="busy" @click="save">保存参与意愿</button><view class="jury-notes"><view class="jury-elig" :class="{'jury-elig--ok':context.juror?.eligible}"><k-icon v-if="context.juror?.eligible" name="circle-check" :size="14" color="green"/><text class="gov-time">{{context.juror?.eligible?'已满足基础条件，系统会按利益回避规则随机邀请':'达到资格条件后才会收到邀请，保存意愿不会直接获得评审资格'}}</text></view><text class="gov-muted">用户需信用分≥90、无违规且完成至少3次换工/兼职/<text class="jury-nw">住宿；</text>店家需合作满3个月、评分≥4.5且无未闭<text class="jury-nw">环投诉。</text></text></view></view><text class="gov-heading">我的评审邀请</text><view v-if="!rounds.length" class="gov-empty-box"><view class="gov-empty-art"><k-icon name="inbox" :size="28" color="red"/></view><text class="gov-empty">暂时没有评审邀请</text></view><view v-for="r in rounds" :key="r.roundId" class="gov-item jury-round" hover-class="k-press-s" @click="go('/pages/governance/jury?id='+r.roundId)"><view class="gov-row"><text class="gov-item-title">{{r.category}}</text><text class="gov-badge" :class="{'jury-open':!r.choice&&r.status==='open'}">{{r.choice?'已投票':r.status==='open'?'待评议':'已结束'}}</text></view><view class="jury-round__meta"><k-icon name="clock" :size="12" color="muted"/><text class="gov-time">截止 {{r.deadline}}</text></view><text v-if="r.quality==='1'" class="gov-muted">优质评审奖励已记入积分</text></view><view class="gov-actions jury-more"><button @click="go('/pages/governance/badges')"><k-icon name="award" :size="18" color="red"/><text>查看徽章与积分</text><k-icon name="chevron-right" :size="12" color="muted"/></button></view></template><template v-else-if="detail"><text class="gov-title">{{detail.category}}</text><text class="gov-muted jury-intro">请勿尝试辨认、联系当事人或转发材料。评审员彼此匿名。</text><view class="gov-section"><text class="gov-heading">事件经过</text><text class="gov-copy">{{detail.anonymousNarrative}}</text><text class="form-label">双方诉求</text><text class="gov-copy">{{detail.anonymousClaims}}</text><EvidenceView :files="detail.evidence||[]" anonymous/></view><view v-if="!detail.choice&&detail.status==='open'" class="gov-section jury-judge"><text class="gov-heading">你的独立判断</text><view class="gov-actions jury-choices"><button v-for="c in choices" :key="c.value" :class="{active:choice===c.value}" @click="choice=c.value"><k-icon v-if="choice===c.value" name="check" :size="14" color="red"/><text>{{c.label}}</text></button></view><textarea v-model="reason" maxlength="1000" placeholder="选填，简要说明判断依据，最多1000字"/><text class="gov-muted">提交后不能重复投票。请勿在理由中写入个人联系方式。</text><button class="primary" :disabled="busy||!choice||reason.trim().length>1000" @click="vote">提交评审意见</button></view><template v-else><text class="gov-heading">{{detail.choice?'你已提交评审':'评审已截止'}}</text><text class="gov-copy">{{choices.find(c=>c.value===detail.choice)?.label}}</text><text class="gov-copy">{{detail.reason}}</text></template></template></view></view></template>
<script setup>
import {ref} from 'vue'
import {onLoad,onShow} from '@dcloudio/uni-app'
import {governanceGet as get,governancePost as post,juryChoices as choices} from '@/common/governance.js'
import EvidenceView from './components/evidence-view.vue'
import {SWITCH_GREEN} from './mediation-form.js'
const roundId=ref(0),detail=ref(null),rounds=ref([]),context=ref({}),kind=ref('user'),store=ref(null),willing=ref(false),error=ref(''),feedback=ref(''),busy=ref(false),choice=ref(''),reason=ref('')
const go=url=>uni.navigateTo({url})
async function load(){try{if(roundId.value)detail.value=(await get('jury/'+roundId.value)).data;else{context.value=(await get('context')).data;const j=context.value.juror;kind.value=j.kind;willing.value=j.willing==='1';store.value=context.value.merchantStores?.find(s=>s.storeId===j.storeId)||null;rounds.value=(await get('jury')).data}}catch(e){error.value=e.message}}
async function save(){busy.value=true;error.value='';try{await post('juror',{kind:kind.value,storeId:store.value?.storeId,willing:willing.value});feedback.value='参与意愿已保存';await load()}catch(e){error.value=e.message}finally{busy.value=false}}
async function vote(){busy.value=true;error.value='';try{await post('jury/'+roundId.value+'/vote',{choice:choice.value,reason:reason.value});feedback.value='评审已提交，有效评审积分已入账';await load()}catch(e){error.value=e.message}finally{busy.value=false}}
onLoad(q=>roundId.value=Number(q.id)||0);onShow(load)
</script><style lang="scss">@import './governance.scss';
/* 2026-11-18 第三轮逐页精修：参与意愿卡 —— 标题和「核心评审员」标签同一行；评审员类型是分段控件（只有一项时当成一行灰色说明字）；
   开关改成整行：左字右开关，上下发丝线；资格说明收成一段 12 号灰字；邀请列表每张卡 16 内边距、截止时间带小时钟；
   「查看徽章与积分」从页底孤零零的小胶囊，改成一整行入口（18 号图标 + 14 号字 + 小箭头）。 */
.jury-will__head{justify-content:flex-start;gap:8px;margin-bottom:4px}.jury-will__head .gov-heading{margin:0}
.governance .gov-section .gov-tabs.jury-kinds{display:flex;flex-wrap:nowrap;gap:0;height:36px;margin:12px 0 0;padding:2px;box-sizing:border-box;border-radius:18px;background:var(--k-fill)}
.governance .gov-section .gov-tabs.jury-kinds button{flex:1;min-width:0;height:32px;margin:0;padding:0;border-radius:16px;background:transparent;box-shadow:none;color:var(--k-ink2);font-size:13px;font-weight:400;line-height:32px}
.governance .gov-section .gov-tabs.jury-kinds button.active{background:var(--k-paper);color:var(--k-ink);font-weight:600;box-shadow:0 1px 2px rgba(58,50,43,.08)}
.governance .gov-section .gov-tabs.jury-kinds button:only-child,.governance .gov-section .gov-tabs.jury-kinds button.active:only-child{flex:1;height:36px;margin:-2px;padding:0;border-radius:0;background:var(--k-paper);box-shadow:none;color:var(--k-muted);font-size:12px;font-weight:400;line-height:36px;text-align:left}
.governance .jury-will picker{display:block;margin-top:12px}.governance .jury-store{justify-content:space-between}
.governance .jury-switch{position:relative;flex-direction:row-reverse;justify-content:space-between;min-height:52px;margin:12px 0 0;font-size:14px;color:var(--k-ink)}
.governance .jury-switch::before,.governance .jury-switch::after{content:'';position:absolute;left:0;right:0;height:1px;background:var(--k-line);transform:scaleY(.5)}.governance .jury-switch::before{top:0}.governance .jury-switch::after{bottom:0}
.governance .jury-switch switch,.governance .gov-check.jury-switch switch{transform:scale(.8);transform-origin:right center;margin:0 -2px 0 0}
.governance .jury-will>button.primary{width:100%;height:44px;margin-top:16px;padding:0;border-radius:22px;line-height:44px}
.jury-notes{margin-top:12px}.jury-notes>text{display:block;margin:0;font-size:12px;line-height:1.6;color:var(--k-muted)}.jury-notes>text+text{margin-top:4px}
.governance .jury-round{padding:16px}.jury-round .gov-item-title{font-size:15px;line-height:22px}.jury-round__meta{display:flex;align-items:center;gap:4px;margin-top:4px}.jury-round__meta .gov-time{margin:0}.jury-round>.gov-muted{display:block;margin-top:4px}
.governance .jury-open{background:var(--k-alert-soft);color:var(--k-alert)}
.governance .jury-more{margin:12px 0 0}
.governance .jury-more button{display:flex;align-items:center;gap:8px;width:100%;height:52px;margin:0;padding:0 16px;border-radius:12px;background:var(--k-paper);box-shadow:none;color:var(--k-ink);font-size:14px;font-weight:400;line-height:20px}
.governance .jury-more button>text{flex:1;text-align:left}
/* 匿名评审页：四个判断选项两两一行、等宽 40 高；理由框去掉描边放在白底上；提交按钮通栏 44 */
.gov-jury .gov-body>.gov-actions:not(.jury-more){display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0 0}
.gov-jury .gov-body>.gov-actions:not(.jury-more) button{height:40px;margin:0;padding:0;border-radius:20px;font-size:13px;line-height:40px}
.gov-jury .gov-body>textarea{margin-top:12px;border:0;border-radius:12px}
.gov-jury .gov-body>textarea+.gov-muted{display:block;margin-top:8px}
.gov-jury .gov-body>button.primary{width:100%;height:44px;margin-top:16px;padding:0;border-radius:22px;line-height:44px}
/* 2026-11-18 第三轮返修（评审第 1 轮）：
   1) 「你的独立判断」收进一张白卡：标题 16/700，四个选项 2×2、44 高、圆角 12 的方块（没选浅灰底，选中浅棕底 + 暖棕细边 + 14 号对勾），理由框浅灰底，提交按钮在卡底；
   2) 资格说明：满足条件时一行「绿色对勾 + 13/500 绿字」，条件说明另起一段 12 号灰字，间距 4；
   3) 开关颜色和主色一致（var(--k-red) 就是 --k-red，小程序 switch 只能填颜色值）；邀请卡内边距 16、卡间 12（共用规则）。 */
.gov-jury .jury-judge{margin-top:12px}
.governance .jury-judge .jury-choices{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 0}
.governance .jury-judge .jury-choices button{display:flex;align-items:center;justify-content:center;gap:4px;height:44px;margin:0;padding:0 8px;border-radius:12px;background:var(--k-bg);box-shadow:none;color:var(--k-ink2);font-size:14px;font-weight:400;line-height:20px}
.governance .jury-judge .jury-choices button.active{background:var(--k-red-soft);color:var(--k-red-deep);font-weight:600;box-shadow:inset 0 0 0 1px var(--k-red)}
.gov-jury .jury-judge textarea{margin-top:12px}
.gov-jury .jury-judge>.gov-muted{display:block;margin-top:8px}
.gov-jury .jury-judge>button.primary{width:100%;height:44px;margin-top:16px;padding:0;border-radius:22px;line-height:44px}
.jury-elig{display:flex;align-items:flex-start;gap:4px}
.jury-elig>.k-icon{margin-top:3px}
.jury-notes .jury-elig>text{display:block;flex:1;min-width:0;margin:0;font-size:12px;line-height:1.6;color:var(--k-muted)}
.jury-notes .jury-elig--ok>text{font-size:13px;font-weight:500;line-height:20px;color:var(--k-green)}
.jury-notes>.jury-elig+text{display:block;margin-top:4px}
/* 2026-11-18 第三轮返修（评审第 2 轮）：分段控件底色用暖线色变量 */
.governance .gov-section .gov-tabs.jury-kinds{background:var(--k-line)}
/* 2026-11-18 第三轮返修（评审第 4 轮）：「我的参与意愿」标题挪到卡外，和「我的评审邀请」同一种放法（16/700，标题到卡 10，区块间距 24）；匿名评审详情标题下的提示到第一张卡留 16。 */
.governance .gov-body>.jury-will__head{margin:24px 0 10px}
.governance .gov-body>.jury-will__head+.gov-section{margin-top:0}
.governance .gov-body>.gov-heading{margin-bottom:10px}
.governance .gov-body>.jury-intro+.gov-section{margin-top:16px}
/* 11-18 微信核对：只有「用户评审员」一种时，分段控件退成一枚身份小标签（24 高、浅棕底、12/500 深棕字），
   不再像一行空输入框；微信 button 自带的发丝边框也去掉 */
.governance .gov-section .gov-tabs.jury-kinds button::after{border:0}
.governance .gov-section .gov-tabs.jury-kinds.jury-kinds--single{display:flex;height:auto;margin:0 0 4px;padding:0;border-radius:0;background:transparent}
.governance .gov-section .gov-tabs.jury-kinds.jury-kinds--single button,.governance .gov-section .gov-tabs.jury-kinds.jury-kinds--single button.active{flex:none;width:auto;height:24px;margin:0;padding:0 10px;border-radius:12px;background:var(--k-red-soft);box-shadow:none;color:var(--k-red-deep);font-size:12px;font-weight:500;line-height:24px}
/* 2026-11-18 第四轮精修（按微信实拍评审））
   1) 「我的参与意愿」卡里开关行是第一行（主角），下面两段 12 号灰字说明，「保存参与意愿」放在卡底；
      只有一种身份时，「用户评审员」标签挪到卡外标题「我的参与意愿」后面（20 高、11 号，和核心评审员标签同一样式），卡里不再单独占一行；
   2) 资格说明按词组折行（「资格」「住宿」不再被拆开或单挂一行）；开关打开是全站开关的绿色。 */
.gov-jury .jury-will{position:relative;display:flex;flex-direction:column}
.gov-jury .jury-will>.jury-notes{order:1;margin-top:12px}
.gov-jury .jury-will>button.primary{order:2;margin-top:16px}
.gov-jury .jury-kinds--single+.jury-switch{margin-top:4px}
.gov-jury .jury-kinds--single+.jury-switch::before{display:none}
.governance .gov-section .gov-tabs.jury-kinds.jury-kinds--single{position:static;margin:0}
.governance .gov-section .gov-tabs.jury-kinds.jury-kinds--single button,.governance .gov-section .gov-tabs.jury-kinds.jury-kinds--single button.active{height:20px;padding:0 6px;border-radius:4px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:11px;font-weight:500;line-height:20px}
.jury-nw{white-space:nowrap}
/* 2026-11-19 第四轮返修（按复评）：
   1) 只有一种身份时「用户评审员」小标签回到卡内第一行（20 高、11/500 深棕、浅棕底），下面接开关行；不再用写死坐标挂到标题后面 ——
      核心评审员（标题行的「核心评审员」标签）和单身份同时出现时两枚标签各在各的位置，互不遮挡，标题字号变了也不会错位；
   2) 资格说明去掉 keep-all，普通折行排满一行；不断行片段缩短成「住宿；」「环投诉。」（原来 8 个字一整块，375 宽第一行右边空出约 90px）；
   3) 「你的独立判断」四个选项改白底 + 发丝描边，选中浅棕底 + 暖棕细边，卡里只留理由框一块浅底。 */
.governance .jury-judge .jury-choices button{background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-line)}
.governance .jury-judge .jury-choices button.active{background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red)}
/* 2026-11-19 第五轮（按微信实拍复核）：
   1) 微信不认 text-wrap:pretty，「……不会直接获得评审 / 资格」把「资格」单挂一行 —— 资格说明这一句只在逗号处折行（「达到资格条件后才会收到邀请，」/「保存意愿不会直接获得评审资格」），字不变；
   2) 「查看徽章与积分」不再单独套白卡：改成页面底上的列表行（48 高、上面一条发丝线），三块不再一样重。 */
.gov-jury .jury-notes .jury-elig>text{word-break:keep-all;overflow-wrap:anywhere}
.governance .jury-more{position:relative;margin:20px 0 0}
.governance .jury-more::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line2);transform:scaleY(.5)}
.governance .jury-more button{height:48px;padding:0;border-radius:0;background:transparent}
.governance .jury-more button::after{border:0}
/* 2026-11-19 第五轮补（按微信实拍复核）：只有一种身份、又不是核心评审员时，「用户评审员」小标签挂到卡外标题「我的参与意愿」后面（间距 8；标题行固定 24 高，标签 20 高居中，和核心评审员标签同一位置），
   卡里第一行直接是开关行；是核心评审员时标题后面已有「核心评审员」，小标签照旧留在卡内第一行，两枚标签不重叠。 */
.governance .gov-body>.jury-will__head{min-height:24px;align-items:center}
.governance .gov-body>.jury-will__head>.gov-heading{margin:0}
.governance .gov-section.jury-will:not(.jury-will--core)>.gov-tabs.jury-kinds.jury-kinds--single{position:absolute;left:104px;top:-32px}
.gov-jury .jury-will:not(.jury-will--core)>.jury-kinds--single+.jury-switch{margin-top:0}
</style>
