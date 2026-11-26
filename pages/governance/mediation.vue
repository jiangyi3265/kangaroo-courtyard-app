<template>
<view class="governance gov-med" :class="$userSurface"><k-topbar :title="caseId?'调解进度':creating?'申请调解':overdueFilter?'逾期纠纷':'纠纷调解'" back/>
    <k-subscribe class="gov-sub" scenes="mediation" label="订阅调解进展提醒" /><view class="gov-body">
  <text v-if="error" class="gov-error">{{ error }}</text><text v-if="feedback" class="gov-success">{{ feedback }}</text>
  <template v-if="!caseId&&!creating">
    <template v-if="overdueFilter">
      <text class="gov-title">{{ overdueFilter.dutyRole==='keeper'?'小院主理人代岗门店':overdueFilter.dutyRole==='manager'?'换工主理人代岗门店':'本城授权门店' }}</text><text class="gov-muted">显示发起已超过 7 天且仍未结案的纠纷。</text>
    </template>
    <template v-else>
    <text class="gov-title">{{mode==='support'?'换工调解跟进':'调解进度与记录'}}</text><text class="gov-muted" :class="{'med-intro':mode!=='support'}">{{mode==='support'?'这里只显示授权门店的报名调解。店家补充材料后可接单跟进；本人参与的申请请切换「我的调解」。处理结果由城市负责人或平台发布。':'已提交的申请都在这里，也可以从原报名或订单查看进度。'}}</text>
    <view class="gov-actions gov-bar"><button @click="go('/pages/governance/jury')"><view class="gov-bar__icon"><k-icon name="scale" :size="22" color="red" /></view><text>大众评审</text></button><button @click="go('/pages/governance/merchant-cases')"><view class="gov-bar__icon"><k-icon name="store" :size="22" color="red" /></view><text>合作复核通知</text></button><button @click="go('/pages/messages/reminders')"><view class="gov-bar__icon"><k-icon name="bell-ring" :size="22" color="red" /></view><text>消息提醒</text></button></view>
    <view class="gov-tabs gov-modes"><button :class="{active:mode==='user'}" @click="switchMode('user')">我的调解</button><button v-if="context.canSupport" :class="{active:mode==='support'}" @click="switchMode('support')">换工跟进</button><button v-if="context.canCity" :class="{active:mode==='city'}" @click="switchMode('city')">本城待办</button></view>
    </template>
    <view class="gov-filter"><text v-if="overdueFilter && !error && !loading" class="gov-muted">当前可跟进 {{ total }} 起</text><picker v-else-if="!overdueFilter" :range="stateOptions" range-key="label" @change="state=stateOptions[$event.detail.value].value;page=1;loadList()"><view class="gov-select gov-select--pill"><text>{{ stateOptions.find(s=>s.value===state)?.label }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></picker><button class="gov-refresh" @click="load"><k-icon name="refresh-cw" :size="14" color="muted" /><text>刷新</text></button></view>
    <text v-if="loading" class="gov-empty">正在读取工单…</text><view v-else-if="!list.length&&!error" class="gov-empty-box"><view class="gov-empty-art"><k-icon name="scale" :size="28" color="red" /></view><text v-if="overdueFilter" class="gov-empty-title">目前没有可跟进的逾期纠纷</text><template v-else><text v-if="state||mode!=='user'" class="gov-empty-title">{{state?'暂无这类工单':'暂无调解工单'}}</text><text v-else class="gov-empty-title">你还没有调解记录。</text><text class="gov-empty">{{state?'当前状态下暂无工单，可切换「全部状态」查看。':mode==='user'?'提交申请后，处理进度和结果会显示在这里。':mode==='support'?'主理人授权门店暂无调解工单。本人参与的申请可切换「我的调解」查看。':'当前授权范围内暂无调解工单。'}}</text></template></view>
    <view v-for="c in list" :key="c.caseId" class="gov-item gov-case" hover-class="k-press-s" @click="go('/pages/governance/mediation?id='+c.caseId+'&mode='+mode)"><view class="gov-row"><text class="gov-item-title">{{ c.category }}</text><text class="gov-badge" :class="{'gov-urgent':c.urgent==='1','gov-badge--closed':c.status==='closed'}">{{ c.urgent==='1'?'紧急 · ':'' }}{{ states[c.status] }}</text></view><text class="gov-copy">{{ c.storeName }} · {{ c.city }}</text><text class="gov-time">{{ c.caseNo }} · {{ c.createTime }}</text><view class="gov-link"><text>查看进度与处理记录</text><k-icon name="chevron-right" :size="12" color="red" /></view></view>
    <view v-if="total>30" class="gov-actions gov-pager"><button :disabled="page===1" @click="page--;loadList()">上一页</button><text class="gov-muted">第{{page}}页</text><button :disabled="page*30>=total" @click="page++;loadList()">下一页</button></view>
    <view v-if="!overdueFilter" class="gov-footbar"><view class="gov-footbar__inner"><button class="primary" @click="startCreate"><k-icon name="plus" :size="16" color="white" /><text>申请调解</text></button></view></view>
  </template>
  <template v-else-if="creating">
    <text class="gov-title">提交事件材料</text>
    <view class="gov-form"><text class="gov-form__title">订单与类型</text><view v-if="context.canMerchant" class="gov-tabs"><button :class="{active:orderRole==='user'}" @click="orderRole='user';loadOrders()">我的订单</button><button :class="{active:orderRole==='merchant'}" @click="orderRole='merchant';loadOrders()">本店订单</button></view>
    <text id="field-order" class="form-label">关联订单 <text class="form-req">*</text></text><picker :range="orders" range-key="display" @change="selectedOrder=orders[$event.detail.value]"><view class="gov-select"><text class="gov-select__text">{{ selectedOrder?.display||'请选择订单' }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></picker><text v-if="fieldErrors.order" class="form-error">{{fieldErrors.order}}</text>
    <text v-if="!orders.length" class="gov-muted">没有可新申请调解的订单。换工报名提交后本人即可申请；旅居需已入住，活动需已签到。已有调解请在「我的调解」查看。</text>
    <text v-if="settledCount" class="gov-muted">另有 {{settledCount}} 笔订单的调解已结案，不能再次发起。</text>
    <view v-if="orderTotal>20" class="gov-actions"><button :disabled="orderPage===1" @click="orderPage--;loadOrders(false)">前20条</button><button :disabled="orderPage*20>=orderTotal" @click="orderPage++;loadOrders(false)">后20条</button></view>
    <text id="field-category" class="form-label">纠纷类型 <text class="form-req">*</text></text><picker :range="context.categories||[]" @change="draft.category=context.categories[$event.detail.value]"><view class="gov-select"><text class="gov-select__text">{{ draft.category||'请选择' }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></picker><text v-if="fieldErrors.category" class="form-error">{{fieldErrors.category}}</text>
    <template v-if="selectedOrder?.volunteerApplicant"><view v-if="canRequestJury" class="gov-check"><switch :checked="draft.requestJury" :color="SWITCH_GREEN" @change="draft.requestJury=$event.detail.value"/><text>申请大众参与评审</text></view><text class="gov-muted">提交后城市负责人和平台可查看。适合大众评审的纠纷，经核实和匿名处理后邀请评审员参与。</text></template>
    <text id="field-incident" class="form-label">发生时间（北京时间）<text class="form-req">*</text></text><view class="gov-row"><picker mode="date" :value="draft.date" @change="draft.date=$event.detail.value"><view class="gov-select"><k-icon name="calendar" :size="16" color="muted" /><text class="gov-select__text">{{draft.date}}</text></view></picker><picker mode="time" :value="draft.time" @change="draft.time=$event.detail.value"><view class="gov-select"><k-icon name="clock" :size="16" color="muted" /><text class="gov-select__text">{{draft.time}}</text></view></picker></view><text v-if="fieldErrors.incident" class="form-error">{{fieldErrors.incident}}</text></view>
    <view class="gov-form"><text class="gov-form__title">经过与诉求</text>
    <text id="field-narrative" class="form-label">事件经过 <text class="form-req">*</text> <text class="gov-muted">{{formRules.narrativeMin}}～{{formRules.narrativeMax}} 字</text></text><textarea v-model="draft.narrative" :maxlength="formRules.narrativeMax" placeholder="写清时间、地点和经过，便于负责人核实"/>
    <view class="form-meta"><text>{{narrativeCount<formRules.narrativeMin?'还需 '+(formRules.narrativeMin-narrativeCount)+' 字':'已达到最低字数'}}</text><text>{{narrativeCount}} / {{formRules.narrativeMax}} 字</text></view><text v-if="fieldErrors.narrative" class="form-error">{{fieldErrors.narrative}}</text>
    <text id="field-claims" class="form-label">你的诉求 <text class="form-req">*</text> <text class="gov-muted">{{formRules.claimsMin}}～{{formRules.claimsMax}} 字（含已选诉求）</text></text><view class="gov-actions med-claims"><button v-for="claim in claimOptions" :key="claim" :class="{active:claims.includes(claim)}" @click="toggleClaim(claim)">{{ claim }}</button></view><textarea v-model="draft.claims" :maxlength="formRules.claimsMax" placeholder="选择上方诉求，也可补充希望的解决方式"/>
    <view class="form-meta" :class="{'form-meta--invalid':claimsCount>formRules.claimsMax}"><text>已选诉求与补充内容合计</text><text>{{claimsCount}} / {{formRules.claimsMax}} 字</text></view><text v-if="fieldErrors.claims" class="form-error">{{fieldErrors.claims}}</text></view>
    <view class="gov-form"><text class="gov-form__title">证据与联系</text>
    <text id="field-evidence" class="form-label">证据材料 <text class="form-req">*</text> <text class="gov-muted">至少 1 项</text></text><EvidenceUpload :key="'evidence-'+uploadKey" v-model="files" @busy="uploading=$event"/><text v-if="fieldErrors.evidence" class="form-error">{{fieldErrors.evidence}}</text>
    <view class="gov-check med-safety"><switch :checked="draft.safety" :color="SWITCH_GREEN" @change="draft.safety=$event.detail.value"/><text>涉及人身安全，需紧急介入</text></view>
    <text id="field-amount" class="form-label">涉及金额（元，选填）</text><input v-model="draft.amount" type="digit" maxlength="20" :placeholder="amountRange+'，不涉及可留空'"/><text class="form-meta">金额范围：{{amountRange}}，最多保留两位小数。</text><text v-if="fieldErrors.amount" class="form-error">{{fieldErrors.amount}}</text>
    <text id="field-phone" class="form-label">联系电话 <text class="form-req">*</text></text><input v-model="draft.phone" type="text" maxlength="24" placeholder="仅供处理人员联系"/><text v-if="fieldErrors.phone" class="form-error">{{fieldErrors.phone}}</text></view>
    <view class="gov-footbar"><view class="gov-footbar__inner med-submit"><button :disabled="busy" @click="creating=false">返回列表</button><button class="primary" :disabled="busy" @click="submit">{{busy?'提交中…':uploading?'证据上传中…':'提交调解'}}</button></view></view>
  </template>
  <template v-else-if="detail">
    <button class="med-back" @click="backToCases"><k-icon name="chevron-left" :size="12" color="muted" /><text>{{mode==='support'?'返回换工跟进':mode==='city'?'返回本城待办':'我的调解'}}</text></button>
    <view class="gov-case-head"><view class="gov-row"><text class="gov-badge" :class="{'gov-urgent':detail.urgent==='1'}">{{detail.urgent==='1'?'紧急 · ':''}}{{detailState}}</text><button @click="load"><k-icon name="refresh-cw" :size="14" color="muted" /><text>刷新</text></button><button @click="go('/pages/messages/reminders')"><k-icon name="bell-ring" :size="14" color="muted" /><text>消息提醒</text></button></view><text class="gov-title">{{detail.category}}</text><text class="gov-time">{{detail.caseNo}}</text><text class="gov-muted">订单 {{detail.orderNo}} · {{detail.city}}</text>
    <view class="gov-progress"><view class="gov-row med-progress-row"><text class="gov-heading">当前进度</text><text class="gov-progress__state">{{detailState}}</text></view><text class="gov-copy">{{progressHint}}</text><template v-if="latestLog"><text class="gov-time">最新记录 · {{latestLog.createTime}}</text><text class="gov-copy gov-progress__log">{{logNote(latestLog)}}</text></template><text v-if="detail.viewerRole==='support'" class="gov-time">店家补充材料后，换工主理人可接单跟进并核实情况，初审由城市负责人或总部处理。任一方申诉后，由总部复核。</text></view><text v-if="isParty" class="gov-time med-footnote">下次可在原报名或订单中点击「查看调解进度」。</text></view>
    <view class="gov-section"><text class="gov-heading">事件与诉求</text><text class="gov-copy">{{detail.narrative}}</text><view class="gov-separator"/><view class="med-claim"><k-icon name="flag" :size="14" color="red" /><text class="gov-copy">{{detail.claims}}</text></view><text class="gov-time">发生于 {{detail.incidentAt}}</text><text v-if="isCity||detail.viewerRole==='hq'" class="gov-time">联系 {{detail.phone}}</text><EvidenceView :files="detail.evidence||[]"/></view>
    <view v-if="detail.viewerRole==='support'&&detail.supportMine&&(detail.merchantResponses||[]).length" class="gov-section">
      <text class="gov-heading">店家补充材料</text><text class="gov-muted">以下是店家提交给接单主理人的说明与证据，请核实后记录协助意见。</text>
      <view v-for="(response,index) in detail.merchantResponses" :key="index" class="gov-item">
        <text class="gov-time">{{response.createTime}}</text><text v-if="response.note" class="gov-copy">{{response.note}}</text><EvidenceView :files="response.evidence||[]"/>
      </view>
    </view>
    <view v-if="detail.jury" class="gov-section"><text class="gov-heading">大众评审</text><text class="gov-copy">{{detail.jury.status==='open'?'评议中，截止 '+detail.jury.deadline:'评审已结束，由城市负责人作最终裁决'}}</text><view v-if="juryParts(detail.jury.resultJson).length" class="med-jurybar"><view v-for="x in juryParts(detail.jury.resultJson)" :key="x.value" class="med-jurybar__seg" :class="'med-jurybar__seg--'+x.value" :style="{flexGrow:x.n}"/></view><view v-if="detail.jury.resultJson" class="med-jurysum"><text v-for="(s,i) in jurySummary(detail.jury.resultJson).split(' · ')" :key="i" class="med-jurysum__item">{{s}}</text></view>
      <template v-if="isCity&&detail.jury.status==='closed'">
        <text class="form-label">评审理由</text>
        <view v-for="opinion in adoptionVotes" :key="opinion.voteId" class="gov-item">
          <text class="gov-badge">{{juryChoices.find(choice=>choice.value===opinion.choice)?.label}}</text>
          <text class="gov-copy">{{opinion.reason||'本次投票未附加理由'}}</text>
          <picker v-if="canRecordAdoption" :range="adoptionOptions" range-key="label" :value="adoptionIndex(opinion.voteId)" @change="adoptionValues[opinion.voteId]=adoptionOptions[$event.detail.value].value">
            <view class="gov-select"><text class="gov-select__text">{{adoptionOptions[adoptionIndex(opinion.voteId)].label}}</text><k-icon name="chevron-down" :size="12" color="muted" /></view>
          </picker>
          <text v-else class="gov-time">{{adoptionLabel(opinion.cityAdopted)}}</text>
        </view>
        <view v-for="(opinion,index) in adoptionVotes.length?[]:juryOpinions" :key="index" class="gov-item">
          <text class="gov-badge">{{juryChoices.find(choice=>choice.value===opinion.choice)?.label}}</text>
          <text class="gov-copy">{{opinion.reason}}</text>
        </view>
        <text v-if="!adoptionVotes.length&&!juryOpinions.length" class="gov-muted">本轮有效投票未附加理由</text>
        <template v-if="canRecordAdoption&&detail.status!=='ready'&&adoptionVotes.length">
          <textarea v-model="adoptionNote" maxlength="500" placeholder="填写本次采纳核定依据，至少5字"/>
          <button :disabled="busy||!adoptionReady||adoptionNote.trim().length<5" @click="act('adoption',{adoptedVoteIds:selectedAdoptionIds(),note:adoptionNote})">保存逐条采纳结果</button>
        </template>
      </template>
    </view>
    <view v-if="detail.decision" class="gov-section"><text class="gov-heading">裁决结果</text><text class="gov-copy">{{detail.decision}}</text><text class="form-label">依据</text><text class="gov-copy">{{detail.basis}}</text><text class="form-label">处理措施</text><text class="gov-copy">{{detail.measures}}</text><view class="med-kv"><text class="gov-time">执行时限 {{detail.executeDeadline}}</text><text class="gov-copy">信用 / 处罚影响：{{detail.creditImpact}}</text><text v-if="detail.juryReason" class="gov-copy">评审意见{{detail.juryAdopted==='1'?'已采纳':'未采纳'}}：{{detail.juryReason}}</text></view></view>
    <view v-if="detail.hqResult" class="gov-section"><text class="gov-heading">总部终局复核</text><text class="gov-copy">{{detail.hqResult}}</text></view>
    <view v-if="isParty&&detail.status==='confirmation'&&!myConfirmation" class="gov-section"><text class="gov-heading">请确认处理结果</text><text class="gov-muted">接受后等待另一方确认；不接受将进入总部复核。</text><textarea v-model="appeal" maxlength="5000" placeholder="不接受时请填写至少10字的申诉理由"/><view class="gov-actions med-confirm"><button :disabled="busy||appeal.trim().length<10" @click="act('confirm',{accept:false,note:appeal})">不接受，申请复核</button><button class="primary" :disabled="busy" @click="act('confirm',{accept:true})">接受裁决</button></view></view>
    <view v-if="detail.viewerRole==='merchant'||detail.viewerRole==='support'" class="gov-section">
      <text class="gov-heading">店家材料与跟进</text>
      <text class="gov-copy">{{detail.merchantMaterialsReady?'店家已补充材料':'等待店家补充材料'}}</text>
      <text v-if="detail.merchantMaterialsAt" class="gov-time">材料提交时间 {{detail.merchantMaterialsAt}}</text>
      <text v-if="detail.supportClaimed" class="gov-copy">{{detail.supportMine?'你已接单跟进':'换工主理人已接单跟进'}}</text>
      <text v-if="detail.supportAcceptedAt" class="gov-time">接单时间 {{detail.supportAcceptedAt}}</text>
      <template v-if="detail.viewerRole==='support'&&!detail.supportClaimed&&detail.status!=='closed'">
        <button v-if="detail.canSupportAccept" class="primary" :disabled="busy" @click="acceptSupport">{{busy?'正在接单…':'接单跟进'}}</button>
        <text v-else class="gov-muted">{{detail.merchantMaterialsReady?'当前无法接单，请刷新后核对处理权限。':'店家提交补充说明或证据后，可在这里接单跟进。'}}</text>
      </template>
    </view>
    <view v-if="detail.canMerchantRespond&&detail.status!=='closed'" class="gov-section">
      <text class="gov-heading">补充店家材料</text><text class="gov-muted">填写至少10字说明，或上传至少1项证据。材料将提供给接单的换工主理人及有权限的调解处理人员。提交后会通知授权门店的换工主理人跟进。</text>
      <text class="form-label">补充说明</text><textarea v-model="merchantNote" maxlength="5000" placeholder="说明事件经过、已沟通情况或希望核实的问题"/>
      <text class="form-label">证据材料（选填）</text><EvidenceUpload :key="'merchant-'+uploadKey" v-model="merchantFiles" @busy="uploading=$event"/>
      <button class="primary" :disabled="busy||uploading" @click="submitMerchantResponse">{{busy?'正在提交…':detail.merchantMaterialsReady?'补充并通知处理人':'提交材料并通知主理人'}}</button>
    </view>
    <view v-if="isCity&&detail.status==='pending'" class="gov-actions"><button class="primary" :disabled="busy" @click="act('accept',{})">接单并核实</button></view>
    <template v-if="isHandler">
      <view v-if="['accepted','verifying','ready'].includes(detail.status)" class="gov-section"><text class="gov-heading">核实记录</text><template v-for="f in verifyFields" :key="f.key"><text class="form-label">{{f.label}} <text class="form-req">*</text></text><textarea v-model="verification[f.key]" maxlength="5000" :placeholder="f.placeholder"/></template><button class="primary med-verify-save" :disabled="busy" @click="act('verify',verification)">保存核实记录</button></view>
      <view v-if="detail.status==='ready'" class="gov-section med-decide"><text class="gov-heading">选择处理方式</text><view class="gov-tabs"><button :class="{active:path==='direct'}" @click="path='direct'">直接裁决</button><button v-if="canJury" :class="{active:path==='jury'}" @click="path='jury'">大众评审</button></view>
        <template v-if="path==='jury'&&canJury"><text class="gov-muted">只发送经你核验的匿名副本。原始证据不会展示给评审员。</text><text class="form-label">匿名事件经过 <text class="form-req">*</text></text><textarea v-model="jury.anonymousNarrative" maxlength="10000" placeholder="至少50字，去除姓名、电话、店名及其他身份线索"/><text class="form-label">匿名双方诉求 <text class="form-req">*</text></text><textarea v-model="jury.anonymousClaims" maxlength="2000"/><EvidenceUpload :key="'jury-'+uploadKey" v-model="juryFiles" redacted @busy="uploading=$event"/><view class="gov-check"><switch :checked="jury.redactionConfirmed" :color="SWITCH_GREEN" @change="jury.redactionConfirmed=$event.detail.value"/><text>已检查文本、图片、音视频与文件，身份信息均已脱敏</text></view><view class="gov-check"><switch :checked="jury.corePriority" :color="SWITCH_GREEN" @change="jury.corePriority=$event.detail.value"/><text>复杂纠纷，优先邀请核心评审员</text></view><button class="primary" :disabled="busy||uploading||!jury.redactionConfirmed" @click="act('jury',{...jury,fileIds:juryFiles.map(f=>f.fileId)})">随机邀请评审员</button></template>
        <template v-else><template v-for="f in decisionFields" :key="f.key"><text class="form-label">{{f.label}} <text class="form-req">*</text></text><textarea v-model="decision[f.key]" maxlength="5000"/></template><text class="form-label">执行时限（北京时间）<text class="form-req">*</text></text><view class="gov-row"><picker mode="date" :value="decisionDate" @change="decisionDate=$event.detail.value"><view class="gov-select"><k-icon name="calendar" :size="16" color="muted" /><text class="gov-select__text">{{decisionDate}}</text></view></picker><picker mode="time" :value="decisionTime" @change="decisionTime=$event.detail.value"><view class="gov-select"><k-icon name="clock" :size="16" color="muted" /><text class="gov-select__text">{{decisionTime}}</text></view></picker></view><template v-if="detail.jury"><view class="gov-check"><switch :checked="decision.juryAdopted" :color="SWITCH_GREEN" @change="decision.juryAdopted=$event.detail.value"/><text>采纳大众评审意见</text></view><textarea v-model="decision.juryReason" placeholder="填写采纳或不采纳的依据，至少5字"/></template><text class="gov-muted">裁决发布后双方确认。退款与处罚需按实际执行结果登记。</text><button class="primary" :disabled="busy" @click="submitDecision">发布裁决</button></template>
      </view>
      <view v-if="['confirmation','appealed','closed'].includes(detail.status)" class="gov-section"><text class="gov-heading">登记实际执行情况</text><textarea v-model="execution" maxlength="5000" placeholder="记录退款单号、补发凭证编号或沟通结果，不填尚未执行的结果"/><button :disabled="busy||execution.length<10" @click="act('execution',{note:execution})">记录执行结果</button></view>
    </template>
    <view v-if="detail.status!=='closed'&&detail.canContribute!==false&&detail.viewerRole!=='support'&&!detail.canMerchantRespond" class="gov-section"><text class="gov-heading">补充材料</text><EvidenceUpload :key="'evidence-'+uploadKey" v-model="files" @busy="uploading=$event"/><button :disabled="busy||uploading||!files.length" @click="act('evidence',{fileIds:files.map(f=>f.fileId)})">提交补充证据</button><template v-if="['accepted','verifying','ready','appealed'].includes(detail.status)"><text class="form-label">补充陈述</text><textarea v-model="statement" maxlength="5000" placeholder="至少10字，处理人员可见"/><button :disabled="busy||statement.length<10" @click="act('statement',{note:statement})">提交陈述</button></template></view>
    <view v-if="detail.canAssist&&detail.status!=='closed'" class="gov-section">
      <text class="gov-heading">参与调解</text><text class="gov-copy">记录你已核实的事实、沟通情况或协助建议。</text><text class="gov-muted">意见及原始附件仅你与有权限的处理人员可见；双方可看到你已提交协助材料。初审由城市负责人或总部处理。任一方申诉后，由总部复核。</text>
      <text class="form-label">协助意见 <text class="form-req">*</text> <text class="gov-muted">10～5000 字</text></text><textarea v-model="assistNote" maxlength="5000" placeholder="写明核实情况、沟通对象和协助建议"/><view class="form-meta"><text>请区分已核实事实与个人建议</text><text>{{mediationTextCount(assistNote)}} / 5000 字</text></view>
      <text class="form-label">协助材料（选填）</text><EvidenceUpload :key="'assist-'+uploadKey" v-model="assistFiles" @busy="uploading=$event"/><button class="primary" :disabled="busy" @click="submitAssistance">{{busy?'提交中…':'提交协助意见'}}</button>
    </view>
    <view class="gov-section"><text class="gov-heading">处理记录</text><view class="gov-timeline"><view v-for="l in detail.log" :key="l.logId" class="gov-item"><text class="gov-copy">{{logNote(l)}}</text><text class="gov-time">{{l.createTime}}</text></view></view></view>
  </template>
  <text v-else class="gov-empty">{{loading?'正在加载…':'未能读取工单，请重试'}}</text>
</view></view>
</template>
<script setup>
import {ref,computed,watch} from 'vue'
import {onLoad,onShow,onHide,onUnload} from '@dcloudio/uni-app'
import {getMessageScopeKey,ensureSession,experience,currentStaffStore} from '@/common/experience.js'
import {governanceGet as get,governancePost as post,mediationStates as states,juryChoices} from '@/common/governance.js'
import {mediationRules,mediationTextCount,combinedClaims,mediationAmountRange,mediationFormErrors,SWITCH_GREEN} from './mediation-form.js'
import EvidenceUpload from './components/evidence-upload.vue'
import EvidenceView from './components/evidence-view.vue'
const context=ref({}),caseId=ref(0),creating=ref(false),mode=ref('user'),state=ref(''),list=ref([]),total=ref(0),page=ref(1),detail=ref(null),orders=ref([]),orderTotal=ref(0),orderPage=ref(1),orderRole=ref('user'),selectedOrder=ref(null),files=ref([]),juryFiles=ref([]),error=ref(''),feedback=ref(''),busy=ref(false),uploading=ref(false),loading=ref(false),appeal=ref(''),statement=ref(''),execution=ref(''),path=ref('direct')
const overdueFilter=ref(null)
function overdueScopeError(){
  if (!overdueFilter.value) return ''
  const {cityId,dutyRole}=overdueFilter.value
  if (mode.value!=='city' || !Number.isSafeInteger(cityId) || cityId<=0 || (dutyRole && !['keeper','manager'].includes(dutyRole)))
    return '这条提醒缺少有效的城市或代岗信息，请返回城市工作台查看本城纠纷调解。'
  const grant=currentStaffStore.value
  if (experience.mode!=='staff' || grant?.roleCode!=='city_lead' || (grant.cityId!=null && Number(grant.cityId)!==cityId))
    return '请切换到这条提醒对应城市的城市主理人身份，再打开提醒。'
  return ''
}
const beijingDate=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10)
const draft=ref({date:beijingDate(),time:new Date(Date.now()+8*3600000).toISOString().slice(11,16),category:'',narrative:'',claims:'',safety:false,requestJury:true,amount:'',phone:''}),claims=ref([]),claimOptions=['补发工资','更换住宿','终止合作','道歉','退款','平台处罚','其他']
const validationAttempted=ref(false),assistNote=ref(''),assistFiles=ref([]),merchantNote=ref(''),merchantFiles=ref([])
const uploadKey=computed(()=>getMessageScopeKey())
const formRules=computed(()=>mediationRules(context.value.formRules))
const narrativeCount=computed(()=>mediationTextCount(draft.value.narrative)),claimsCount=computed(()=>mediationTextCount(combinedClaims(claims.value,draft.value.claims)))
const amountRange=computed(()=>mediationAmountRange(formRules.value))
function formProblems(){return mediationFormErrors({draft:draft.value,selectedOrder:selectedOrder.value,claims:claims.value,files:files.value,categories:context.value.categories||[],rules:formRules.value,uploading:uploading.value})}
const fieldErrors=computed(()=>validationAttempted.value?Object.fromEntries(formProblems().map(e=>[e.field,e.message])):{})
function showProblem(title,message,field){uni.showModal({title,content:message,showCancel:false,confirmText:field?'去完善':'知道了',success:r=>{if(r.confirm&&field)uni.pageScrollTo({selector:'#field-'+field,duration:200})}})}
const stateOptions=[{value:'',label:'全部状态'},...Object.entries(states).map(([value,label])=>({value,label}))]
const verification=ref({userStatement:'',merchantStatement:'',evidenceList:'',finding:''}),verifyFields=[{key:'userStatement',label:'用户陈述',placeholder:'分别联系用户并记录，至少10字'},{key:'merchantStatement',label:'店家陈述',placeholder:'分别联系店家并记录，至少10字'},{key:'evidenceList',label:'已核实证据',placeholder:'核对了哪些材料'},{key:'finding',label:'初步判断',placeholder:'记录依据，至少10字'}]
const decision=ref({decision:'',basis:'',measures:'',creditImpact:'无影响',juryAdopted:false,juryReason:''}),decisionFields=[{key:'decision',label:'责任判定'},{key:'basis',label:'裁决依据'},{key:'measures',label:'处理措施'},{key:'creditImpact',label:'信用及处罚影响'}],decisionDate=ref(beijingDate()),decisionTime=ref('23:59')
const jury=ref({anonymousNarrative:'',anonymousClaims:'',redactionConfirmed:false,corePriority:false})
const adoptionValues=ref({}),adoptionNote=ref(''),settledCount=ref(0)
const adoptionOptions=[{value:'',label:'待核定'},{value:'0',label:'未采纳'},{value:'1',label:'已采纳'}]
const adoptionVotes=computed(()=>(detail.value?.votes||[]).filter(v=>v.choice&&v.valid==='1'))
const canRecordAdoption=computed(()=>isHandler.value&&detail.value?.jury?.status==='closed'&&['ready','confirmation','appealed','closed'].includes(detail.value?.status))
const adoptionReady=computed(()=>adoptionVotes.value.every(v=>['0','1'].includes(adoptionValues.value[v.voteId])))
const adoptionIndex=id=>Math.max(0,adoptionOptions.findIndex(option=>option.value===adoptionValues.value[id]))
const adoptionLabel=value=>adoptionOptions.find(option=>option.value===value)?.label||'待核定'
const selectedAdoptionIds=()=>adoptionVotes.value.filter(v=>adoptionValues.value[v.voteId]==='1').map(v=>v.voteId)
function setAdoptionValues(){adoptionValues.value=Object.fromEntries(adoptionVotes.value.map(v=>[v.voteId,['0','1'].includes(v.cityAdopted)?v.cityAdopted:'']));adoptionNote.value=''}
function submitDecision(){
  if(detail.value?.jury&&!adoptionReady.value){error.value='请逐条核定有效评审意见的采纳情况';return}
  const body={...decision.value,executeDeadline:decisionDate.value+' '+decisionTime.value+':00'}
  if(detail.value?.jury)body.adoptedVoteIds=selectedAdoptionIds()
  return act('decision',body)
}
const juryCategories=['食宿不符','工作内容不符','工作超时','评价真实性争议']
const canRequestJury=computed(()=>selectedOrder.value?.volunteerApplicant && !draft.value.safety && juryCategories.includes(draft.value.category))
const isCity=computed(()=>detail.value?.viewerRole==='city'),isHandler=computed(()=>isCity.value&&detail.value?.canHandle),isParty=computed(()=>['user','merchant'].includes(detail.value?.viewerRole)),myConfirmation=computed(()=>detail.value?.viewerRole==='user'?detail.value?.userConfirm:detail.value?.merchantConfirm),canJury=computed(()=>!detail.value?.jury&&detail.value?.urgent!=='1'&&juryCategories.includes(detail.value?.category))
let requestKey='med_'+Date.now()+'_'+Math.random().toString(36).slice(2),targetOrder=null,assistAttempt=null,merchantAttempt=null
const go=url=>uni.navigateTo({url})
const latestLog=computed(()=>{const logs=detail.value?.log;return Array.isArray(logs)&&logs.length?logs[logs.length-1]:null})
const detailState=computed(()=>detail.value?.status==='pending'&&detail.value?.supportClaimed?'已接单跟进':states[detail.value?.status]||'处理中')
const progressHint=computed(()=>({pending:detail.value?.supportClaimed?(detail.value?.supportMine?'你已接单跟进，请核实材料并提交协助意见。':'换工主理人已接单跟进。')+'城市负责人待接单，总部也可接手初审，核实后独立裁决。':detail.value?.merchantMaterialsReady?'店家已补充材料，等待城市负责人或总部接单核实。':'申请已提交，请店家补充材料。城市负责人可在员工端接单，总部也可在后台接手初审。',accepted:detail.value?.hqHandling?'总部已接手初审，正在核实双方材料。':'城市负责人已接单，正在了解情况。',verifying:'正在核实双方陈述和证据。',ready:'核实记录已完成，等待发布处理方案。',jury:'正在征集大众评审意见，请等待后续处理。',confirmation:'请双方在本页确认裁决。双方都接受即结案，任一方提出申诉则转总部复核。',appealed:'已进入总部复核。总部在后台提交终局结果后结案，你可以在本页查看结论。',closed:'调解已结束，处理记录与结果保留在本页。'}[detail.value?.status]||'处理有新进展时会更新在这里。'))
function backToCases(){
  const stack=typeof getCurrentPages==='function'?getCurrentPages():[]
  const previous=stack[stack.length-2]
  if(previous?.route==='pages/governance/mediation' && (previous.options?.overdue || previous.$page?.options?.overdue)==='1'){
    uni.navigateBack()
    return
  }
  uni.redirectTo({url:'/pages/governance/mediation'+(mode.value==='user'?'':'?mode='+mode.value)})
}
function openExistingCase(id){caseId.value=Number(id);creating.value=false;uni.redirectTo({url:'/pages/governance/mediation?id='+caseId.value})}

function toggleClaim(c){claims.value=claims.value.includes(c)?claims.value.filter(x=>x!==c):[...claims.value,c]}
let pageActive=true,viewEpoch=0,loadRequest=0,listRequest=0,orderRequest=0
const viewKey=()=>JSON.stringify([getMessageScopeKey(),caseId.value,mode.value,creating.value])
const viewScope=()=>({epoch:viewEpoch,key:viewKey()})
const currentScope=scope=>pageActive&&scope.epoch===viewEpoch&&scope.key===viewKey()
function invalidateRequests(){viewEpoch++;loadRequest++;listRequest++;orderRequest++;loading.value=false;busy.value=false}
function clearIdentityView(){
  invalidateRequests();context.value={};detail.value=null;list.value=[];total.value=0;orders.value=[];selectedOrder.value=null
  files.value=[];juryFiles.value=[];assistFiles.value=[];merchantFiles.value=[];merchantNote.value='';assistNote.value='';statement.value='';appeal.value='';execution.value=''
  draft.value={date:beijingDate(),time:'12:00',category:'',narrative:'',claims:'',safety:false,requestJury:true,amount:'',phone:''};claims.value=[]
  verification.value={userStatement:'',merchantStatement:'',evidenceList:'',finding:''};decision.value={decision:'',basis:'',measures:'',creditImpact:'无影响',juryAdopted:false,juryReason:''}
  jury.value={anonymousNarrative:'',anonymousClaims:'',redactionConfirmed:false,corePriority:false};adoptionValues.value={};adoptionNote.value=''
  error.value='';feedback.value='';uploading.value=false;assistAttempt=merchantAttempt=null;validationAttempted.value=false
  requestKey='med_'+Date.now()+'_'+Math.random().toString(36).slice(2)
}
async function loadList(){
  const scope=viewScope(),request=++listRequest
  loading.value=true;error.value='';list.value=[];total.value=0
  try{
    const scopeError=overdueScopeError()
    if(scopeError){error.value=scopeError;return}
    if(mode.value==='support'&&context.value.canSupport===false){error.value='当前账号没有可跟进的换工主理人门店授权。本人参与的申请请切换「我的调解」，门店授权问题请联系平台核对。';return}
    if(mode.value==='city'&&context.value.canCity===false){error.value=overdueFilter.value?'当前账号没有这条提醒所需的城市调解权限。':'当前账号没有本城调解处理权限。本人参与的申请请切换「我的调解」。';return}
    const r=(await get('cases',{mode:mode.value,status:state.value,pageNum:page.value,...overdueFilter.value})).data
    if(!currentScope(scope)||request!==listRequest)return
    list.value=r.rows;total.value=r.total
  }catch(e){if(currentScope(scope)&&request===listRequest)error.value=e.message}
  finally{if(currentScope(scope)&&request===listRequest)loading.value=false}
}
async function load(){
  const scope=viewScope(),request=++loadRequest
  const current=()=>currentScope(scope)&&request===loadRequest
  loading.value=true;error.value='';detail.value=null
  try{
    if(overdueFilter.value){
      list.value=[];total.value=0;page.value=1
      await ensureSession()
      if(!current())return
      const scopeError=overdueScopeError()
      if(scopeError){error.value=scopeError;return}
    }
    const ctx=(await get('context')).data;if(!current())return
    context.value=ctx;if(!draft.value.phone)draft.value.phone=ctx.phone||''
    if(caseId.value){
      const data=(await get('cases/'+caseId.value)).data;if(!current())return
      detail.value=data;setAdoptionValues();if(data.verification){try{verification.value=JSON.parse(data.verification)}catch(_){}}
    }else if(!creating.value)await loadList()
  }catch(e){if(current())error.value=e.message||'加载失败'}finally{if(current())loading.value=false}
}
function switchMode(m){if(overdueFilter.value)return;mode.value=m;page.value=1;loadList()}
// 调解已结案的订单（服务端 eligible=false 带 reason）：不能选，从订单页带进来的直接显示原因
async function loadOrders(reset=true){
  const scope=viewScope(),request=++orderRequest,current=()=>currentScope(scope)&&request===orderRequest
  if(reset)orderPage.value=1
  try{
    const r=(await get('orders',{role:orderRole.value,pageNum:orderPage.value})).data;if(!current())return
    orders.value=r.rows.filter(o=>o.eligible&&(!o.existingCaseId||o.existingCaseStatus==='closed')).map(o=>({...o,display:o.storeName+' · '+o.orderNo}));settledCount.value=r.rows.filter(o=>!o.eligible&&o.reason).length;orderTotal.value=r.total;selectedOrder.value=null
    if(targetOrder){const target=targetOrder;const r=(await get('order',target)).data;if(!current())return;targetOrder=null;if(r.existingCaseId){openExistingCase(r.existingCaseId);return}if(r.eligible===false)error.value=r.reason||'订单当前不可申请调解';else selectedOrder.value={...r,display:r.storeName+' · '+r.orderNo}}
  }catch(e){if(current())error.value=e.message}
}
async function startCreate(){creating.value=true;validationAttempted.value=false;files.value=[];await loadOrders()}
async function submit(){
  if(!pageActive||busy.value)return
  error.value='';validationAttempted.value=true
  const problems=formProblems()
  if(problems.length){
    const message=problems.slice(0,3).map((p,i)=>(i+1)+'. '+p.message).join('\n')+(problems.length>3?'\n另有 '+(problems.length-3)+' 项需要完善，已在页面标出。':'')
    showProblem('请完善后再提交',message,problems[0].field);return
  }
  const c=combinedClaims(claims.value,draft.value.claims),scope=viewScope()
  busy.value=true
  try{
    const r=await post('cases',{requestKey,orderType:selectedOrder.value.orderType,orderId:selectedOrder.value.orderId,category:draft.value.category,narrative:draft.value.narrative.trim(),claims:c,incidentAt:draft.value.date+' '+draft.value.time+':00',safety:draft.value.safety,requestJury:!!(canRequestJury.value && draft.value.requestJury),amountFen:Math.round(Number(draft.value.amount||0)*100),phone:draft.value.phone.trim(),fileIds:files.value.map(f=>f.fileId)})
    if(!currentScope(scope))return
    busy.value=false;caseId.value=Number(r.data);creating.value=false;files.value=[];feedback.value='已提交，可在原报名或订单中查看'
    uni.redirectTo({url:'/pages/governance/mediation?id='+caseId.value+'&submitted=1',fail:()=>load()})
  }catch(e){if(currentScope(scope)){error.value=e.message||'网络异常，请重试';showProblem('未能提交调解',error.value+'\n已填写内容和已上传证据仍保留。')}}finally{if(currentScope(scope))busy.value=false}
}
async function submitAssistance(){
  if(!pageActive||busy.value)return
  if(uploading.value){showProblem('请稍候','协助材料正在上传，请等待上传完成后再提交。');return}
  const count=mediationTextCount(assistNote.value)
  if(count<10||count>5000){showProblem('请完善协助意见','请填写 10～5000 字协助意见，当前 '+count+' 字。');return}
  const body={note:assistNote.value.trim(),fileIds:assistFiles.value.map(f=>f.fileId)}
  const payload=JSON.stringify({caseId:caseId.value,...body})
  if(assistAttempt?.payload!==payload)assistAttempt={payload,key:'assist_'+Date.now()+'_'+Math.random().toString(36).slice(2)}
  return act('assistance',{...body,requestKey:assistAttempt.key})
}
async function submitMerchantResponse(){
  if(busy.value||!detail.value?.canMerchantRespond||detail.value.status==='closed')return
  if(uploading.value){showProblem('请稍候','材料正在上传，请等待上传完成后再提交。');return}
  const note=merchantNote.value.trim(),count=mediationTextCount(note),fileIds=merchantFiles.value.map(f=>f.fileId)
  if(count>5000||(!fileIds.length&&count<10)){showProblem('请补充材料','请填写至少10字说明，或上传至少1项证据。');return}
  if(fileIds.length>9||fileIds.some(id=>!id)){showProblem('请检查附件','附件须全部上传成功，每次最多9项。');return}
  const body={note,fileIds},payload=JSON.stringify({caseId:caseId.value,...body})
  if(merchantAttempt?.payload!==payload)merchantAttempt={payload,key:'merchant_'+Date.now()+'_'+Math.random().toString(36).slice(2)}
  return act('merchantResponse',{...body,requestKey:merchantAttempt.key})
}
async function acceptSupport(){
  if(busy.value||!detail.value?.canSupportAccept||detail.value.status==='closed')return
  return act('supportAccept',{})
}
async function act(action,body){
  if(!pageActive||busy.value)return
  const scope=viewScope(),id=caseId.value
  busy.value=true;error.value='';feedback.value=''
  try{
    await post('cases/'+id+'/'+action,body);if(!currentScope(scope))return
    feedback.value=action==='merchantResponse'?'材料已提交，等待处理人员跟进':action==='supportAccept'?'已接单跟进，请核实材料并提交协助意见':'已保存，处理进度已更新'
    if(action==='evidence')files.value=[];if(action==='statement')statement.value=''
    if(action==='assistance'){assistNote.value='';assistFiles.value=[];assistAttempt=null}
    if(action==='merchantResponse'){merchantNote.value='';merchantFiles.value=[];merchantAttempt=null}
    await load()
  }catch(e){if(currentScope(scope)){error.value=e.message||'操作失败，请重试';showProblem('未能保存',error.value+'\n已填写内容仍保留。')}}
  finally{if(currentScope(scope))busy.value=false}
}
function readJuryResult(raw){
  try{
    const result=typeof raw==='string'?JSON.parse(raw):raw
    return result&&typeof result==='object'&&!Array.isArray(result)?result:null
  }catch(e){return null}
}
const juryOpinions=computed(()=>{
  const reasons=readJuryResult(detail.value?.jury?.resultJson)?.reasons
  return Array.isArray(reasons)?reasons.filter(opinion=>opinion&&juryChoices.some(choice=>choice.value===opinion.choice)&&typeof opinion.reason==='string'&&opinion.reason.trim()):[]
})
// 11-18 返修（纯展示）：评审结果比例条的四段（票数为 0 的段不画）
function juryParts(raw){const r=readJuryResult(raw);if(!r)return [];return juryChoices.map(x=>({value:x.value,n:Number(r[x.value])||0})).filter(x=>x.n>0)}
function jurySummary(raw){const r=readJuryResult(raw);if(!r)return '评审结果待核对';return juryChoices.map(x=>x.label+' '+(r[x.value]||0)+'票').join(' · ')}
function logNote(l){if(l.action==='verify'){try{const r=JSON.parse(l.note);return verifyFields.map(f=>f.label+'：'+r[f.key]).join('\n')}catch(e){}}return l.note}
onLoad(q=>{
  if(q.overdue==='1'){
    mode.value=q.mode
    overdueFilter.value={overdue:1,cityId:Number(q.cityId),...(q.dutyRole?{dutyRole:q.dutyRole}:{})}
    return
  }
  caseId.value=Number(q.id)||0;mode.value=['city','support'].includes(q.mode)?q.mode:'user';if(q.submitted==='1'&&caseId.value)feedback.value='提交成功，可在原报名或订单中持续查看处理结果。';if(q.orderType&&q.orderId){orderRole.value=q.orderRole==='merchant'?'merchant':'user';creating.value=true;targetOrder={type:q.orderType,id:q.orderId};loadOrders()}
})
watch(getMessageScopeKey,()=>{clearIdentityView();if(pageActive)load()},{flush:'sync'})
onHide(()=>{pageActive=false;invalidateRequests()})
onUnload(()=>{pageActive=false;clearIdentityView()})
onShow(()=>{pageActive=true;load()})
</script>
<style lang="scss">@import './governance.scss';
/* 2026-11-17 改版「小而精」：当前进度卡是白底加一层很浅的绿，12 圆角、不描边；填写项收进一张白卡，输入框仍是 44 高、字 14。 */
.gov-progress{padding:12px;background:var(--k-paper);border:0;border-radius:12px;margin-bottom:8px}.gov-progress .gov-heading{margin:0}.gov-progress__state{display:block;font-size:18px;font-weight:700;line-height:1.4;color:var(--k-ink);margin:6px 0 2px}.gov-progress .gov-time{color:var(--k-muted)}.gov-item>.gov-link{display:flex;align-items:center;gap:2px;margin-top:6px;line-height:18px}.gov-progress .gov-row{align-items:center;flex-wrap:wrap}.gov-body>.gov-row>.gov-badge:first-child{margin-right:auto}
.form-meta{display:flex;justify-content:space-between;gap:12px;margin-top:4px;font-size:11px;line-height:1.6;color:var(--k-muted);flex-wrap:wrap}.form-meta--invalid,.form-error{color:var(--k-alert)}.form-error{display:block;font-size:12px;line-height:1.6;margin-top:4px}
/* 2026-11-18 看图复查：列表页那一排操作钮原来挤成两行、第二行只剩一个 —— 收成 28 高的小胶囊排一行，放不下就横着滑（只有「申请调解」是实心）；
   「全部状态」从通栏大框改成筛选小胶囊（看上去 28 高，四周 4px 透明边撑着，可点范围 36），小三角换成向下的小图标。 */

/* 2026-11-18 第三轮逐页精修：列表页原来五个同款胶囊挤一行横滑、最后一个被切掉 —— 拆开按层级放：
   「申请调解」放进页面底部的白色操作条（44 高暖棕主按钮，一屏唯一的实心重点）；「大众评审 / 合作复核通知 / 消息提醒」是一张白卡里的三格入口（40 的浅棕方块 + 22 号线性图标 + 12 号字）；
   「刷新」退成筛选行右侧的灰色小字钮；页签只有「我的调解」一项时当小标题看，有两三项时是分段控件。 */
.governance .gov-bar{display:flex;flex-wrap:nowrap;gap:0;margin:16px 0 0;padding:14px 4px 12px;border-radius:12px;background:var(--k-paper)}
.governance .gov-bar button{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;height:auto;margin:0;padding:0 2px;border-radius:0;background:transparent;box-shadow:none;color:var(--k-ink2);font-size:12px;font-weight:400;line-height:16px;white-space:nowrap}
.governance .gov-bar__icon{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:var(--k-red-soft)}
.governance .gov-modes{display:flex;flex-wrap:nowrap;gap:0;height:36px;margin:20px 0 0;padding:2px;box-sizing:border-box;border-radius:18px;background:var(--k-fill)}
.governance .gov-modes button{flex:1;min-width:0;height:32px;margin:0;padding:0;border-radius:16px;background:transparent;box-shadow:none;color:var(--k-ink2);font-size:13px;font-weight:400;line-height:32px}
.governance .gov-modes button.active{background:var(--k-paper);color:var(--k-ink);font-weight:600;box-shadow:0 1px 2px rgba(58,50,43,.08)}
.governance .gov-modes button:only-child,.governance .gov-modes button.active:only-child{flex:1;height:36px;margin:-2px;padding:0;border-radius:0;background:var(--k-page);box-shadow:none;color:var(--k-ink);font-size:16px;font-weight:700;line-height:36px;text-align:left}
.governance .gov-filter{display:flex;align-items:center;justify-content:space-between;margin:12px 0 4px}
.governance .gov-filter .gov-select--pill{margin-left:-4px}
.governance .gov-case{padding:16px}
.governance .gov-case .gov-item-title{font-size:15px;line-height:22px}
.governance .gov-case .gov-copy{margin-top:2px}
.governance .gov-case>.gov-link{position:relative;margin-top:10px;padding-top:10px;justify-content:flex-end}
.governance .gov-case>.gov-link::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.governance .gov-pager{align-items:center;justify-content:center}
/* 11-18 第三轮：详情页的状态标签、刷新 / 消息提醒、纠纷类型、编号原来散在灰底上 —— 收进一张白卡：第一行标签靠左、两个小钮靠右，下面类型 18/700、编号和订单两行灰字 */
.governance .gov-case-head{margin-top:12px;padding:14px 16px 16px;border-radius:12px;background:var(--k-paper)}
.governance .gov-case-head>.gov-row{gap:8px}
.governance .gov-case-head>.gov-row>.gov-badge:first-child{margin-right:auto}
.governance .gov-case-head>.gov-row button{display:flex;align-items:center;gap:4px;height:28px;margin:0;padding:0 10px;border:0;border-radius:14px;background:var(--k-red-soft);box-shadow:none;color:var(--k-red-deep);font-size:12px;font-weight:500;line-height:28px}
.governance .gov-case-head>.gov-title{margin:10px 0 2px;font-size:18px}
.governance .gov-case-head>.gov-time{margin-top:0}
.governance .gov-case-head>.gov-muted{display:block}
.governance .gov-progress{padding:16px}
.governance .gov-select--pill{display:inline-flex;width:auto;min-height:36px;height:36px;margin-left:-4px;gap:4px;padding:0 8px 0 10px;border:4px solid transparent;border-radius:18px;background:var(--k-paper) padding-box;font-size:12px;color:var(--k-ink2)}
/* 2026-11-18 第二轮精修：进度卡改纯白底、状态字用深墨（绿色只留给真正的成功提示）；「查看进度与处理记录」的箭头换小图标；
   进度卡和标题行里的「我的调解 / 刷新 / 消息提醒」收成 28 高的小胶囊，四周 4px 透明边撑着可点范围 36，负边距抵掉，排版位置不变。 */
.governance .gov-progress .gov-row button,.governance .gov-body>.gov-row button{margin:-4px;padding:0 12px;border:4px solid transparent;border-radius:18px;background-clip:padding-box;font-size:12px;font-weight:500;line-height:28px}
/* 2026-11-18 第三轮返修（评审第 1 轮）：
   1) 详情头卡：标签行 → 纠纷类型 18/700 → 编号、订单灰字，下面发丝线隔开「当前进度」，状态降成 15/600、最新记录 12 号灰字 —— 首屏只有一个大字焦点；
   2) 「请确认处理结果」两个等宽 44 高按钮，左次右主，间距 12；
   3) 申请调解表单分成三组白块（订单与类型 / 经过与诉求 / 证据与联系），组标题 15/700、组间 12；「返回列表 / 提交调解」放进吸底白条；
   4) 卡内按钮两档：小胶囊（看上去 28、可点 36）和通栏 44；
   5) 大众评审结果加一条四段比例条（8 高、圆角 4），下面一行 12 号等宽数字；处理记录用时间轴。 */
.governance .gov-case-head{padding:16px}
.governance .gov-case-head>.gov-row{flex-wrap:wrap;row-gap:8px}
.governance .gov-case-head>.gov-row button{flex-shrink:0;margin:-4px;padding:0 8px;border:4px solid transparent;background-clip:padding-box;white-space:nowrap}
.governance .gov-case-head>.gov-row button+button{margin-left:4px}
/* 320 宽：标签和两颗小钮仍排一行（小钮字 11、左右内边距 6），确认区两个按钮字 13 */
@media (max-width:359px){.governance .gov-case-head>.gov-row{gap:6px}.governance .gov-case-head>.gov-row button{padding:0 6px;font-size:11px}.governance .med-confirm button{font-size:13px}}
.governance .gov-case-head>.gov-progress{position:relative;margin:16px 0 0;padding:16px 0 0;border-radius:0;background:transparent}
.governance .gov-case-head>.gov-progress::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.governance .gov-case-head .gov-progress .gov-heading{font-size:13px;font-weight:500;line-height:20px;color:var(--k-muted)}
.governance .gov-case-head .gov-progress__state{margin:4px 0 2px;font-size:15px;font-weight:600;line-height:22px}
.governance .gov-case-head .gov-progress>.gov-copy{font-size:13px;line-height:1.6}
.governance .gov-case-head .gov-progress>.gov-progress__log{font-size:12px;color:var(--k-muted)}
.governance .gov-case-head .gov-progress>.gov-time{margin-top:8px}
/* 头卡里三颗小钮（刷新 / 消息提醒 / 我的调解）同一种样子：浅棕底、无描边 */
.governance .gov-case-head .gov-progress .gov-row button{background:var(--k-red-soft);background-clip:padding-box;box-shadow:none;color:var(--k-red-deep)}
.governance .med-confirm{display:flex;flex-wrap:nowrap;gap:12px;margin:16px 0 0}
.governance .med-confirm button{flex:1;min-width:0;height:44px;margin:0;padding:0;border-radius:22px;font-size:14px;line-height:44px;white-space:nowrap}
.gov-med .gov-section>button:not(.primary){display:flex;align-items:center;justify-content:center;width:100%;height:44px;margin-top:12px;padding:0;border-radius:22px;font-size:14px;font-weight:500;line-height:44px}
.gov-med .gov-section textarea{margin-top:12px}
.gov-med .gov-form+.gov-form{margin-top:12px}
.gov-med .gov-form__title{display:block;font-size:15px;font-weight:700;line-height:22px;color:var(--k-ink)}
.gov-med .gov-form__title+.form-label,.gov-med .gov-form__title+.gov-tabs{margin-top:12px}
.gov-med .gov-form .gov-check.med-safety{margin:16px 0 4px}
.gov-med .med-submit{display:flex;gap:12px}
.gov-med .med-submit button{flex:0 0 auto;height:44px;margin:0;padding:0 20px;border-radius:22px;font-size:14px;line-height:44px}
.gov-med .med-submit button.primary{flex:1;width:auto}
.med-jurybar{display:flex;gap:2px;height:8px;margin:12px 0 8px;border-radius:4px;overflow:hidden;background:var(--k-fill)}
.med-jurybar__seg{flex:0 0 0;min-width:4px}
.med-jurybar__seg--user{background:var(--k-red)}
.med-jurybar__seg--merchant{background:var(--k-red-line)}
.med-jurybar__seg--both{background:var(--k-line2)}
.med-jurybar__seg--insufficient{background:var(--k-light)}
/* 2026-11-18 第三轮返修（评审第 2 轮）：
   1) 详情头卡里「刷新 / 消息提醒」退成灰色文字链（14 号图标 + 12 号字，无底色），卡里只剩「我的调解」一颗 28 高小胶囊；「当前进度」小标题 12 号；
   2) 「下次可从…查看」挪到头卡下面当 11 号脚注；
   3) 分段控件、评审比例条的底色用暖线色变量。 */
.governance .gov-case-head>.gov-row button{height:32px;margin:-2px 0;padding:0 2px;border:0;border-radius:0;background:transparent!important;background-clip:border-box;box-shadow:none;color:var(--k-muted);font-size:12px;font-weight:400;line-height:32px;gap:4px}
.governance .gov-case-head>.gov-row button+button{margin-left:12px}
.governance .gov-case-head .gov-progress .gov-heading{font-size:12px;line-height:20px}
.governance .med-footnote{display:block;margin:8px 4px 0;font-size:11px;line-height:1.6;color:var(--k-muted)}
.governance .gov-modes,.med-jurybar{background:var(--k-fill)}
/* 2026-11-18 第三轮返修（评审第 3 轮）：
   1) 选择框和输入框分开：订单 / 类型 / 采纳选择框右侧 12 号向下小箭头，日期框左边 16 号日历、时间框左边 16 号时钟（图标和字间距 6）；
   2) 「我的订单 / 本店订单」和诉求多选是同一套 32 高胶囊：没选中浅灰实底 + 二级墨字，选中浅棕底 + 一圈细棕线 + 深棕字；
   3) 「我的调解 / 返回本城待办」是返回，做成页面最上面一行轻量返回链接（12 号向左箭头 + 13 号灰字），不再像状态标签；
      状态只在头卡左上标签说一遍，「当前进度」那行的状态退成 12/600 二级墨小字跟在后面，进度说明 14 号当主要内容；
   4) 「下次可从…查看」收进头卡底部（发丝线隔开），不再悬在两张卡之间、也不会被客服钮压住；
   5) 评审票数改成 2×2 图例，每项前一个 8 的圆点（颜色和比例条一致）；诉求前一个 14 号小旗；
   6) 申请表单是填写页：选择框 / 输入框 48 高，底部「提交调解」实心棕、圆角 12、48 高；
   7) 城市负责人填写区：文本框 96 高，标签上距 16；320 宽「请确认处理结果」两颗按钮上下排；
   8) 只有「我的调解」一项时，小标题离下面筛选行 12（原来悬在中间）；空状态说明最宽 180，两行差不多长。 */
.gov-select{gap:6px}
.gov-select__text{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gov-select>.k-icon{flex:0 0 auto}
.gov-med .gov-form .gov-select,.gov-med .gov-form input{min-height:48px;height:48px}
.gov-med .gov-tabs button,.gov-med .gov-form .gov-tabs button,.gov-med .med-claims button{flex:0 0 auto;min-width:0;height:32px;margin:0;padding:0 14px;border:0;border-radius:16px;background:var(--k-fill);box-shadow:none;color:var(--k-ink2);font-size:13px;font-weight:400;line-height:32px}
.gov-med .gov-tabs button.active,.gov-med .gov-form .gov-tabs button.active,.gov-med .med-claims button.active{background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-weight:500}
.gov-med .med-claims{margin:8px 0 12px}
.governance .med-back{display:inline-flex;align-items:center;gap:4px;width:auto;height:32px;margin:4px 0 0 -4px;padding:0 4px;border:0;border-radius:0;background:transparent;box-shadow:none;color:var(--k-muted);font-size:13px;font-weight:400;line-height:32px}
.governance .med-back+.gov-case-head{margin-top:4px}
.governance .gov-case-head .med-progress-row{justify-content:flex-start;gap:6px}
.governance .gov-case-head .med-progress-row>.gov-progress__state{position:relative;margin:0;padding-left:12px;font-size:12px;font-weight:400;line-height:20px;color:var(--k-muted)}
.governance .gov-case-head .med-progress-row>.gov-progress__state::before{content:'';position:absolute;left:2px;top:9px;width:3px;height:3px;border-radius:50%;background:var(--k-light)}
.governance .gov-case-head .gov-progress>.gov-copy{margin-top:4px;font-size:14px;line-height:1.6;color:var(--k-ink)}
.governance .gov-case-head .gov-progress>.gov-progress__log{margin-top:0;font-size:12px;color:var(--k-muted)}
.governance .gov-case-head>.med-footnote{position:relative;margin:12px 0 0;padding-top:12px;font-size:12px;line-height:1.6;color:var(--k-muted)}
.governance .gov-case-head>.med-footnote::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.med-claim{display:flex;align-items:flex-start;gap:6px}
.med-claim>.k-icon{flex:0 0 auto;margin-top:4px}
.med-claim>.gov-copy{flex:1;min-width:0;color:var(--k-ink)}
.med-jurysum{display:flex;flex-wrap:wrap;row-gap:4px;column-gap:16px}
.med-jurysum__item{position:relative;flex:0 0 calc(50% - 8px);box-sizing:border-box;padding-left:14px;font-size:12px;line-height:1.6;color:var(--k-ink2);white-space:nowrap;font-variant-numeric:tabular-nums}
.med-jurysum__item::before{content:'';position:absolute;left:0;top:6px;width:8px;height:8px;border-radius:50%;background:var(--k-red)}
.med-jurysum__item:nth-child(2)::before{background:var(--k-red-line)}
.med-jurysum__item:nth-child(3)::before{background:var(--k-line2)}
.med-jurysum__item:nth-child(4)::before{background:var(--k-light)}
.med-jurysum__item:only-child{flex-basis:100%;padding-left:0}
.med-jurysum__item:only-child::before{display:none}
.gov-med .med-submit button{height:44px;border-radius:22px;line-height:44px}
.gov-med .gov-section textarea{height:96px}
.gov-med .gov-section .form-label{margin-top:16px}
.governance .gov-modes{height:auto}
.governance .gov-modes button:only-child,.governance .gov-modes button.active:only-child{height:24px;margin:-2px -2px -6px;line-height:24px}
.gov-med .gov-empty-box>.gov-empty,.gov-med .gov-body>.gov-empty-box>.gov-empty{max-width:180px}
@media (max-width:359px){.governance .med-confirm{flex-direction:column;gap:8px}.governance .med-confirm button{flex:0 0 44px;width:100%;font-size:14px}}
/* 2026-11-18 第三轮返修（评审第 4 轮）：
   1) 调解流程里的主按钮统一一套：申请表单「提交调解」、详情「请确认处理结果」两颗、处理人填写区（保存核实记录 / 发布裁决 / 随机邀请评审员）和卡里其他按钮一律 48 高、圆角 12，主按钮实心深棕（原来「提交调解」被公共规则压回 44 高全胶囊）；列表底部「申请调解」仍是 44 高胶囊；
   2) 分段控件三项等分，选中项白底；
   3) 裁决结果卡底部「执行时限 / 信用·处罚影响 / 评审意见」收成一组：上方发丝线、13/1.6、行间 6；
   4) 处理人填写区：卡与卡之间 20、字段名 14/600、卡里第一个字段上距 12，「信用及处罚影响」改成 48 高单行框。 */
.gov-med .med-submit button.primary{height:44px;border-radius:22px;line-height:44px}
.gov-med .gov-section>button,.gov-med .gov-section>button:not(.primary),.gov-med .gov-section button.primary,.gov-med .med-confirm button,.gov-med .gov-actions>button.primary{display:flex;align-items:center;justify-content:center;width:100%;height:44px;margin-top:12px;padding:0;border-radius:22px;font-size:15px;line-height:44px}
.gov-med .gov-section .med-confirm button{flex:1;width:auto;margin-top:0}
.gov-med .gov-section button.primary,.gov-med .med-confirm button.primary,.gov-med .gov-actions>button.primary{font-weight:600}
.gov-med .gov-modes button{flex:1;padding:0;background:transparent}
.gov-med .gov-modes button.active{background:var(--k-paper);box-shadow:0 1px 2px rgba(58,50,43,.08);color:var(--k-ink);font-weight:600}
.gov-med .med-kv{position:relative;margin-top:12px;padding-top:12px}
.gov-med .med-kv::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.gov-med .med-kv>text{display:block;margin:0;font-size:13px;line-height:1.6;color:var(--k-ink2)}
.gov-med .med-kv>text+text{margin-top:6px}
.gov-med .gov-body>.gov-section{margin-top:20px}
.gov-med .gov-section .form-label{font-size:14px;font-weight:600}
.gov-med .gov-section>.gov-heading+.form-label{margin-top:12px}
.gov-med .med-decide>textarea:nth-of-type(4){height:48px}
.gov-med .gov-section>.gov-muted{display:block}
@media (max-width:359px){.gov-med .gov-section .med-confirm button{flex:0 0 44px;width:100%}}
/* 2026-11-18 第三轮返修（评审第 5 轮）：
   1) 调解模块的主按钮统一成一种：和列表页「申请调解」、大众评审「保存参与意愿」一样是 44 高胶囊、同一渐变底（申请表单底部「返回列表 / 提交调解」、
      详情「接受 / 不接受」、处理人填写区「保存核实记录 / 发布裁决」）；
   2) 必填星号单独一层，提醒红；
   3) 「我的调解」空状态只留原说明（上一轮新加的标题「还没有调解记录」和说明第一句重复，去掉）。 */
.gov-med .form-req{color:var(--k-alert);font-weight:600}
/* 同轮：处理人「选择处理方式」两颗分段胶囊的字原来被公共规则多加的上内边距 6 压到下沿，改回上下居中 */
.gov-med .gov-section .gov-tabs button{padding-top:0;padding-bottom:0}
/* 2026-11-18 第四轮精修（按微信实拍评审））
   1) 标题区成一组：大标题 + 说明 + 三个入口方块（46 浅棕方块、圆角 12、22 号图标、12 号字），不再套白卡，直接放在页面底色上；下面「我的调解」上距 24，和标题区分成两层；
   2) 我的调解为空时和别的空状态一样有标题：原说明按句号拆成标题「你还没有调解记录。」+ 说明（字不变）；
   3) 申请表单里选好的关联订单、纠纷类型、日期完整显示，放不下就折成两行（原来被省略号截掉），选择框高度随内容、最小 48；
   4) 「涉及人身安全」开关打开是全站开关的绿色。 */
.gov-med .gov-bar{margin:20px 0 0;padding:0;border-radius:0;background:transparent}
.gov-med .gov-bar button{gap:6px;font-size:12px;color:var(--k-ink2)}
.gov-med .gov-bar__icon{width:46px;height:46px;border-radius:12px;background:var(--k-red-soft)}
.gov-med .gov-body>.gov-modes{margin-top:24px}
.gov-med .gov-empty-box>.gov-empty-title+.gov-empty{max-width:260px}
.gov-med .gov-select__text{white-space:normal;overflow:visible;text-overflow:clip;line-height:20px;overflow-wrap:anywhere}
.gov-med .gov-form .gov-select{height:auto;min-height:48px;padding-top:12px;padding-bottom:12px;box-sizing:border-box}
/* 2026-11-19 第四轮返修（按复评）：处理人填写区一张长卡里只留「发布裁决」一处实心暖棕 ——「保存核实记录」改次按钮（白底 + 浅棕描边、44 高、深棕字），字和点按不变。 */
.gov-med .gov-section>button.primary.med-verify-save{background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep)}
/* 2026-11-19 第五轮（按微信实拍复核）：
   1) 微信不认 text-wrap，页面说明把「调解」拆成两行 —— 我的调解页的说明只在标点和空格处折行（「我的调解」再次进入。」整体落到第二行），一段放不下时照常兜底换行；
   2) 三个入口方块下面留 20 + 一条发丝线，再接「我的调解」，入口不再飘在页面底上。 */
.gov-med .gov-body>.gov-muted.med-intro{word-break:keep-all;overflow-wrap:anywhere}
.gov-med .gov-bar{position:relative;padding-bottom:20px}
.gov-med .gov-bar::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--k-line2);transform:scaleY(.5)}
.gov-med .gov-body>.gov-modes{margin-top:20px}
</style>
