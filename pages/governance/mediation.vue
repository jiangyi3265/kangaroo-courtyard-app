<template>
<view class="governance"><k-topbar :title="caseId?'调解进度':creating?'申请调解':'纠纷调解'" back/>
    <k-subscribe scenes="mediation" label="订阅调解进展提醒" /><view class="gov-body">
  <text v-if="error" class="gov-error">{{ error }}</text><text v-if="feedback" class="gov-success">{{ feedback }}</text>
  <template v-if="!caseId&&!creating">
    <text class="gov-title">{{mode==='support'?'换工调解跟进':'调解进度与记录'}}</text><text class="gov-muted">{{mode==='support'?'这里只显示授权门店的报名调解。店家补充材料后可接单跟进；本人参与的申请请切换「我的调解」。处理结果由城市负责人或平台发布。':'已提交的申请都在这里，也可从「我的 → 纠纷调解 → 我的调解」再次进入。'}}</text>
    <view class="gov-tabs"><button :class="{active:mode==='user'}" @click="switchMode('user')">我的调解</button><button v-if="context.canSupport" :class="{active:mode==='support'}" @click="switchMode('support')">换工跟进</button><button v-if="context.canCity" :class="{active:mode==='city'}" @click="switchMode('city')">本城待办</button></view>
    <view class="gov-actions"><button class="primary" @click="startCreate">申请调解</button><button @click="go('/pages/governance/jury')">大众评审</button><button @click="load">刷新</button><button @click="go('/pages/governance/merchant-cases')">合作复核通知</button><button @click="go('/pages/messages/reminders')">消息提醒</button></view>
    <picker :range="stateOptions" range-key="label" @change="state=stateOptions[$event.detail.value].value;page=1;loadList()"><view class="gov-select">{{ stateOptions.find(s=>s.value===state)?.label }} ▾</view></picker>
    <text v-if="loading" class="gov-empty">正在读取工单…</text><text v-else-if="!list.length&&!error" class="gov-empty">{{state?'当前状态下暂无工单，可切换「全部状态」查看。':mode==='user'?'你还没有调解记录。提交申请后，处理进度和结果会显示在这里。':mode==='support'?'主理人授权门店暂无调解工单。本人参与的申请可切换「我的调解」查看。':'当前授权范围内暂无调解工单。'}}</text>
    <view v-for="c in list" :key="c.caseId" class="gov-item" @click="go('/pages/governance/mediation?id='+c.caseId+'&mode='+mode)"><view class="gov-row"><text class="gov-item-title">{{ c.category }}</text><text class="gov-badge" :class="{'gov-urgent':c.urgent==='1'}">{{ c.urgent==='1'?'紧急 · ':'' }}{{ states[c.status] }}</text></view><text class="gov-copy">{{ c.storeName }} · {{ c.city }}</text><text class="gov-time">{{ c.caseNo }} · {{ c.createTime }}</text><text class="gov-link">查看进度与处理记录 ›</text></view>
    <view v-if="total>30" class="gov-actions"><button :disabled="page===1" @click="page--;loadList()">上一页</button><text class="gov-muted">第{{page}}页</text><button :disabled="page*30>=total" @click="page++;loadList()">下一页</button></view>
  </template>
  <template v-else-if="creating">
    <text class="gov-title">提交事件材料</text>
    <view v-if="context.canMerchant" class="gov-tabs"><button :class="{active:orderRole==='user'}" @click="orderRole='user';loadOrders()">我的订单</button><button :class="{active:orderRole==='merchant'}" @click="orderRole='merchant';loadOrders()">本店订单</button></view>
    <text id="field-order" class="form-label">关联订单 *</text><picker :range="orders" range-key="display" @change="selectedOrder=orders[$event.detail.value]"><view class="gov-select">{{ selectedOrder?.display||'请选择订单' }}</view></picker><text v-if="fieldErrors.order" class="form-error">{{fieldErrors.order}}</text>
    <text v-if="!orders.length" class="gov-muted">没有可新申请调解的订单。换工报名签约后即可申请；旅居需已入住，活动需已签到。已有调解请在「我的调解」查看。</text>
    <text v-if="settledCount" class="gov-muted">另有 {{settledCount}} 笔订单的调解已结案，不能再次发起。</text>
    <view v-if="orderTotal>20" class="gov-actions"><button :disabled="orderPage===1" @click="orderPage--;loadOrders(false)">前20条</button><button :disabled="orderPage*20>=orderTotal" @click="orderPage++;loadOrders(false)">后20条</button></view>
    <text id="field-category" class="form-label">纠纷类型 *</text><picker :range="context.categories||[]" @change="draft.category=context.categories[$event.detail.value]"><view class="gov-select">{{ draft.category||'请选择' }}</view></picker><text v-if="fieldErrors.category" class="form-error">{{fieldErrors.category}}</text>
    <text id="field-incident" class="form-label">发生时间（北京时间）*</text><view class="gov-row"><picker mode="date" :value="draft.date" @change="draft.date=$event.detail.value"><view class="gov-select">{{draft.date}}</view></picker><picker mode="time" :value="draft.time" @change="draft.time=$event.detail.value"><view class="gov-select">{{draft.time}}</view></picker></view><text v-if="fieldErrors.incident" class="form-error">{{fieldErrors.incident}}</text>
    <text id="field-narrative" class="form-label">事件经过 * <text class="gov-muted">{{formRules.narrativeMin}}～{{formRules.narrativeMax}} 字</text></text><textarea v-model="draft.narrative" :maxlength="formRules.narrativeMax" placeholder="写清时间、地点和经过，便于负责人核实"/>
    <view class="form-meta"><text>{{narrativeCount<formRules.narrativeMin?'还需 '+(formRules.narrativeMin-narrativeCount)+' 字':'已达到最低字数'}}</text><text>{{narrativeCount}} / {{formRules.narrativeMax}} 字</text></view><text v-if="fieldErrors.narrative" class="form-error">{{fieldErrors.narrative}}</text>
    <text id="field-claims" class="form-label">你的诉求 * <text class="gov-muted">{{formRules.claimsMin}}～{{formRules.claimsMax}} 字（含已选诉求）</text></text><view class="gov-actions"><button v-for="claim in claimOptions" :key="claim" :class="{active:claims.includes(claim)}" @click="toggleClaim(claim)">{{ claim }}</button></view><textarea v-model="draft.claims" :maxlength="formRules.claimsMax" placeholder="选择上方诉求，也可补充希望的解决方式"/>
    <view class="form-meta" :class="{'form-meta--invalid':claimsCount>formRules.claimsMax}"><text>已选诉求与补充内容合计</text><text>{{claimsCount}} / {{formRules.claimsMax}} 字</text></view><text v-if="fieldErrors.claims" class="form-error">{{fieldErrors.claims}}</text>
    <text id="field-evidence" class="form-label">证据材料 * <text class="gov-muted">至少 1 项</text></text><EvidenceUpload :key="'evidence-'+uploadKey" v-model="files" @busy="uploading=$event"/><text v-if="fieldErrors.evidence" class="form-error">{{fieldErrors.evidence}}</text>
    <view class="gov-check"><switch :checked="draft.safety" color="#a86d39" @change="draft.safety=$event.detail.value"/><text>涉及人身安全，需紧急介入</text></view>
    <text id="field-amount" class="form-label">涉及金额（元，选填）</text><input v-model="draft.amount" type="digit" maxlength="20" :placeholder="amountRange+'，不涉及可留空'"/><text class="form-meta">金额范围：{{amountRange}}，最多保留两位小数。</text><text v-if="fieldErrors.amount" class="form-error">{{fieldErrors.amount}}</text>
    <text id="field-phone" class="form-label">联系电话 *</text><input v-model="draft.phone" type="text" maxlength="24" placeholder="仅供处理人员联系"/><text v-if="fieldErrors.phone" class="form-error">{{fieldErrors.phone}}</text>
    <view class="gov-actions"><button class="primary" :disabled="busy" @click="submit">{{busy?'提交中…':uploading?'证据上传中…':'提交调解'}}</button><button :disabled="busy" @click="creating=false">返回列表</button></view>
  </template>
  <template v-else-if="detail">
    <view class="gov-progress"><view class="gov-row"><text class="gov-heading">当前进度</text><button @click="backToCases">{{mode==='support'?'返回换工跟进':mode==='city'?'返回本城待办':'我的调解'}}</button></view><text class="gov-progress__state">{{detailState}}</text><text class="gov-copy">{{progressHint}}</text><template v-if="latestLog"><text class="gov-time">最新记录 · {{latestLog.createTime}}</text><text class="gov-copy">{{logNote(latestLog)}}</text></template><text v-if="isParty" class="gov-time">下次可从「我的 → 纠纷调解 → 我的调解」查看，也可在原订单中点击「查看调解进度」。</text><text v-if="detail.viewerRole==='support'" class="gov-time">店家补充材料后，换工主理人可接单跟进并核实情况，最终处理结果由城市负责人或平台发布。</text></view>
    <view class="gov-row"><text class="gov-badge" :class="{'gov-urgent':detail.urgent==='1'}">{{detail.urgent==='1'?'紧急 · ':''}}{{detailState}}</text><button @click="load">刷新</button><button @click="go('/pages/messages/reminders')">消息提醒</button></view><text class="gov-title">{{detail.category}}</text><text class="gov-time">{{detail.caseNo}}</text><text class="gov-muted">订单 {{detail.orderNo}} · {{detail.city}}</text>
    <view class="gov-section"><text class="gov-heading">事件与诉求</text><text class="gov-copy">{{detail.narrative}}</text><view class="gov-separator"/><text class="gov-copy">{{detail.claims}}</text><text class="gov-time">发生于 {{detail.incidentAt}}</text><text v-if="isCity||detail.viewerRole==='hq'" class="gov-time">联系 {{detail.phone}}</text><EvidenceView :files="detail.evidence||[]"/></view>
    <view v-if="detail.viewerRole==='support'&&detail.supportMine&&(detail.merchantResponses||[]).length" class="gov-section">
      <text class="gov-heading">店家补充材料</text><text class="gov-muted">以下是店家提交给接单主理人的说明与证据，请核实后记录协助意见。</text>
      <view v-for="(response,index) in detail.merchantResponses" :key="index" class="gov-item">
        <text class="gov-time">{{response.createTime}}</text><text v-if="response.note" class="gov-copy">{{response.note}}</text><EvidenceView :files="response.evidence||[]"/>
      </view>
    </view>
    <view v-if="detail.jury" class="gov-section"><text class="gov-heading">大众评审</text><text class="gov-copy">{{detail.jury.status==='open'?'评议中，截止 '+detail.jury.deadline:'评审已结束，由城市负责人作最终裁决'}}</text><text v-if="detail.jury.resultJson" class="gov-copy">{{jurySummary(detail.jury.resultJson)}}</text>
      <template v-if="isCity&&detail.jury.status==='closed'">
        <text class="form-label">评审理由</text>
        <view v-for="opinion in adoptionVotes" :key="opinion.voteId" class="gov-item">
          <text class="gov-badge">{{juryChoices.find(choice=>choice.value===opinion.choice)?.label}}</text>
          <text class="gov-copy">{{opinion.reason||'本次投票未附加理由'}}</text>
          <picker v-if="canRecordAdoption" :range="adoptionOptions" range-key="label" :value="adoptionIndex(opinion.voteId)" @change="adoptionValues[opinion.voteId]=adoptionOptions[$event.detail.value].value">
            <view class="gov-select">{{adoptionOptions[adoptionIndex(opinion.voteId)].label}}</view>
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
    <view v-if="detail.decision" class="gov-section"><text class="gov-heading">裁决结果</text><text class="gov-copy">{{detail.decision}}</text><text class="form-label">依据</text><text class="gov-copy">{{detail.basis}}</text><text class="form-label">处理措施</text><text class="gov-copy">{{detail.measures}}</text><text class="gov-time">执行时限 {{detail.executeDeadline}}</text><text class="gov-copy">信用 / 处罚影响：{{detail.creditImpact}}</text><text v-if="detail.juryReason" class="gov-copy">评审意见{{detail.juryAdopted==='1'?'已采纳':'未采纳'}}：{{detail.juryReason}}</text></view>
    <view v-if="detail.hqResult" class="gov-section"><text class="gov-heading">总部终局复核</text><text class="gov-copy">{{detail.hqResult}}</text></view>
    <view v-if="isParty&&detail.status==='confirmation'&&!myConfirmation" class="gov-section"><text class="gov-heading">请确认处理结果</text><text class="gov-muted">接受后等待另一方确认；不接受将进入总部复核。</text><textarea v-model="appeal" maxlength="5000" placeholder="不接受时请填写至少10字的申诉理由"/><view class="gov-actions"><button class="primary" :disabled="busy" @click="act('confirm',{accept:true})">接受裁决</button><button :disabled="busy||appeal.trim().length<10" @click="act('confirm',{accept:false,note:appeal})">不接受，申请复核</button></view></view>
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
      <view v-if="['accepted','verifying','ready'].includes(detail.status)" class="gov-section"><text class="gov-heading">核实记录</text><template v-for="f in verifyFields" :key="f.key"><text class="form-label">{{f.label}} *</text><textarea v-model="verification[f.key]" maxlength="5000" :placeholder="f.placeholder"/></template><button class="primary" :disabled="busy" @click="act('verify',verification)">保存核实记录</button></view>
      <view v-if="detail.status==='ready'" class="gov-section"><text class="gov-heading">选择处理方式</text><view class="gov-tabs"><button :class="{active:path==='direct'}" @click="path='direct'">直接裁决</button><button v-if="canJury" :class="{active:path==='jury'}" @click="path='jury'">大众评审</button></view>
        <template v-if="path==='jury'&&canJury"><text class="gov-muted">只发送经你核验的匿名副本。原始证据不会展示给评审员。</text><text class="form-label">匿名事件经过 *</text><textarea v-model="jury.anonymousNarrative" maxlength="10000" placeholder="至少50字，去除姓名、电话、店名及其他身份线索"/><text class="form-label">匿名双方诉求 *</text><textarea v-model="jury.anonymousClaims" maxlength="2000"/><EvidenceUpload :key="'jury-'+uploadKey" v-model="juryFiles" redacted @busy="uploading=$event"/><view class="gov-check"><switch :checked="jury.redactionConfirmed" color="#a86d39" @change="jury.redactionConfirmed=$event.detail.value"/><text>已检查文本、图片、音视频与文件，身份信息均已脱敏</text></view><view class="gov-check"><switch :checked="jury.corePriority" color="#a86d39" @change="jury.corePriority=$event.detail.value"/><text>复杂纠纷，优先邀请核心评审员</text></view><button class="primary" :disabled="busy||uploading||!jury.redactionConfirmed" @click="act('jury',{...jury,fileIds:juryFiles.map(f=>f.fileId)})">随机邀请评审员</button></template>
        <template v-else><template v-for="f in decisionFields" :key="f.key"><text class="form-label">{{f.label}} *</text><textarea v-model="decision[f.key]" maxlength="5000"/></template><text class="form-label">执行时限（北京时间）*</text><view class="gov-row"><picker mode="date" :value="decisionDate" @change="decisionDate=$event.detail.value"><view class="gov-select">{{decisionDate}}</view></picker><picker mode="time" :value="decisionTime" @change="decisionTime=$event.detail.value"><view class="gov-select">{{decisionTime}}</view></picker></view><template v-if="detail.jury"><view class="gov-check"><switch :checked="decision.juryAdopted" color="#a86d39" @change="decision.juryAdopted=$event.detail.value"/><text>采纳大众评审意见</text></view><textarea v-model="decision.juryReason" placeholder="填写采纳或不采纳的依据，至少5字"/></template><text class="gov-muted">裁决发布后双方确认。退款与处罚需按实际执行结果登记。</text><button class="primary" :disabled="busy" @click="submitDecision">发布裁决</button></template>
      </view>
      <view v-if="['confirmation','appealed','closed'].includes(detail.status)" class="gov-section"><text class="gov-heading">登记实际执行情况</text><textarea v-model="execution" maxlength="5000" placeholder="记录退款单号、补发凭证编号或沟通结果，不填尚未执行的结果"/><button :disabled="busy||execution.length<10" @click="act('execution',{note:execution})">记录执行结果</button></view>
    </template>
    <view v-if="detail.status!=='closed'&&detail.canContribute!==false&&detail.viewerRole!=='support'&&!detail.canMerchantRespond" class="gov-section"><text class="gov-heading">补充材料</text><EvidenceUpload :key="'evidence-'+uploadKey" v-model="files" @busy="uploading=$event"/><button :disabled="busy||uploading||!files.length" @click="act('evidence',{fileIds:files.map(f=>f.fileId)})">提交补充证据</button><template v-if="['accepted','verifying','ready','appealed'].includes(detail.status)"><text class="form-label">补充陈述</text><textarea v-model="statement" maxlength="5000" placeholder="至少10字，处理人员可见"/><button :disabled="busy||statement.length<10" @click="act('statement',{note:statement})">提交陈述</button></template></view>
    <view v-if="detail.canAssist&&detail.status!=='closed'" class="gov-section">
      <text class="gov-heading">参与调解</text><text class="gov-copy">记录你已核实的事实、沟通情况或协助建议。</text><text class="gov-muted">意见及原始附件仅你与有权限的处理人员可见；双方可看到你已提交协助材料。最终处理结果由城市负责人或平台发布。</text>
      <text class="form-label">协助意见 * <text class="gov-muted">10～5000 字</text></text><textarea v-model="assistNote" maxlength="5000" placeholder="写明核实情况、沟通对象和协助建议"/><view class="form-meta"><text>请区分已核实事实与个人建议</text><text>{{mediationTextCount(assistNote)}} / 5000 字</text></view>
      <text class="form-label">协助材料（选填）</text><EvidenceUpload :key="'assist-'+uploadKey" v-model="assistFiles" @busy="uploading=$event"/><button class="primary" :disabled="busy" @click="submitAssistance">{{busy?'提交中…':'提交协助意见'}}</button>
    </view>
    <view class="gov-section"><text class="gov-heading">处理记录</text><view v-for="l in detail.log" :key="l.logId" class="gov-item"><text class="gov-copy">{{logNote(l)}}</text><text class="gov-time">{{l.createTime}}</text></view></view>
  </template>
  <text v-else class="gov-empty">{{loading?'正在加载…':'未能读取工单，请重试'}}</text>
</view></view>
</template>
<script setup>
import {ref,computed,watch} from 'vue'
import {onLoad,onShow,onHide,onUnload} from '@dcloudio/uni-app'
import {getMessageScopeKey} from '@/common/experience.js'
import {governanceGet as get,governancePost as post,mediationStates as states,juryChoices} from '@/common/governance.js'
import {mediationRules,mediationTextCount,combinedClaims,mediationAmountRange,mediationFormErrors} from './mediation-form.js'
import EvidenceUpload from './components/evidence-upload.vue'
import EvidenceView from './components/evidence-view.vue'
const context=ref({}),caseId=ref(0),creating=ref(false),mode=ref('user'),state=ref(''),list=ref([]),total=ref(0),page=ref(1),detail=ref(null),orders=ref([]),orderTotal=ref(0),orderPage=ref(1),orderRole=ref('user'),selectedOrder=ref(null),files=ref([]),juryFiles=ref([]),error=ref(''),feedback=ref(''),busy=ref(false),uploading=ref(false),loading=ref(false),appeal=ref(''),statement=ref(''),execution=ref(''),path=ref('direct')
const beijingDate=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10)
const draft=ref({date:beijingDate(),time:new Date(Date.now()+8*3600000).toISOString().slice(11,16),category:'',narrative:'',claims:'',safety:false,amount:'',phone:''}),claims=ref([]),claimOptions=['补发工资','更换住宿','终止合作','道歉','退款','平台处罚','其他']
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
const isCity=computed(()=>detail.value?.viewerRole==='city'),isHandler=computed(()=>isCity.value&&detail.value?.canHandle),isParty=computed(()=>['user','merchant'].includes(detail.value?.viewerRole)),myConfirmation=computed(()=>detail.value?.viewerRole==='user'?detail.value?.userConfirm:detail.value?.merchantConfirm),canJury=computed(()=>!detail.value?.jury&&detail.value?.urgent!=='1'&&['食宿不符','工作内容不符','工作超时','评价真实性争议'].includes(detail.value?.category))
let requestKey='med_'+Date.now()+'_'+Math.random().toString(36).slice(2),targetOrder=null,assistAttempt=null,merchantAttempt=null
const go=url=>uni.navigateTo({url})
const latestLog=computed(()=>{const logs=detail.value?.log;return Array.isArray(logs)&&logs.length?logs[logs.length-1]:null})
const detailState=computed(()=>detail.value?.status==='pending'&&detail.value?.supportClaimed?'已接单跟进':states[detail.value?.status]||'处理中')
const progressHint=computed(()=>({pending:detail.value?.supportClaimed?(detail.value?.supportMine?'你已接单跟进，请核实材料并提交协助意见。':'换工主理人已接单跟进。')+'城市负责人待接单，最终由城市负责人或平台独立裁决。':detail.value?.merchantMaterialsReady?'店家已补充材料，等待处理人员跟进。':'申请已提交，请店家补充材料；城市负责人或平台可及时介入。',accepted:'城市负责人已接单，正在了解情况。',verifying:'正在核实双方陈述和证据。',ready:'核实记录已完成，等待发布处理方案。',jury:'正在征集大众评审意见，请等待后续处理。',confirmation:'裁决已发布，请阅读结果并确认是否接受。',appealed:'总部正在复核，结果发布后会同步到这里。',closed:'调解已结束，处理记录与结果保留在本页。'}[detail.value?.status]||'处理有新进展时会更新在这里。'))
function backToCases(){uni.redirectTo({url:'/pages/governance/mediation'+(mode.value==='user'?'':'?mode='+mode.value)})}
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
  draft.value={date:beijingDate(),time:'12:00',category:'',narrative:'',claims:'',safety:false,amount:'',phone:''};claims.value=[]
  verification.value={userStatement:'',merchantStatement:'',evidenceList:'',finding:''};decision.value={decision:'',basis:'',measures:'',creditImpact:'无影响',juryAdopted:false,juryReason:''}
  jury.value={anonymousNarrative:'',anonymousClaims:'',redactionConfirmed:false,corePriority:false};adoptionValues.value={};adoptionNote.value=''
  error.value='';feedback.value='';uploading.value=false;assistAttempt=merchantAttempt=null;validationAttempted.value=false
  requestKey='med_'+Date.now()+'_'+Math.random().toString(36).slice(2)
}
async function loadList(){
  const scope=viewScope(),request=++listRequest
  loading.value=true;error.value='';list.value=[];total.value=0
  try{
    if(mode.value==='support'&&context.value.canSupport===false){error.value='当前账号没有可跟进的换工主理人门店授权。本人参与的申请请切换「我的调解」，门店授权问题请联系平台核对。';return}
    if(mode.value==='city'&&context.value.canCity===false){error.value='当前账号没有本城调解处理权限。本人参与的申请请切换「我的调解」。';return}
    const r=(await get('cases',{mode:mode.value,status:state.value,pageNum:page.value})).data
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
    const ctx=(await get('context')).data;if(!current())return
    context.value=ctx;if(!draft.value.phone)draft.value.phone=ctx.phone||''
    if(caseId.value){
      const data=(await get('cases/'+caseId.value)).data;if(!current())return
      detail.value=data;setAdoptionValues();if(data.verification){try{verification.value=JSON.parse(data.verification)}catch(_){}}
    }else if(!creating.value)await loadList()
  }catch(e){if(current())error.value=e.message||'加载失败'}finally{if(current())loading.value=false}
}
function switchMode(m){mode.value=m;page.value=1;loadList()}
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
    const r=await post('cases',{requestKey,orderType:selectedOrder.value.orderType,orderId:selectedOrder.value.orderId,category:draft.value.category,narrative:draft.value.narrative.trim(),claims:c,incidentAt:draft.value.date+' '+draft.value.time+':00',safety:draft.value.safety,amountFen:Math.round(Number(draft.value.amount||0)*100),phone:draft.value.phone.trim(),fileIds:files.value.map(f=>f.fileId)})
    if(!currentScope(scope))return
    busy.value=false;caseId.value=Number(r.data);creating.value=false;files.value=[];feedback.value='已提交，可在「我的 → 纠纷调解 → 我的调解」查看'
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
function jurySummary(raw){const r=readJuryResult(raw);if(!r)return '评审结果待核对';return juryChoices.map(x=>x.label+' '+(r[x.value]||0)+'票').join(' · ')}
function logNote(l){if(l.action==='verify'){try{const r=JSON.parse(l.note);return verifyFields.map(f=>f.label+'：'+r[f.key]).join('\n')}catch(e){}}return l.note}
onLoad(q=>{caseId.value=Number(q.id)||0;mode.value=['city','support'].includes(q.mode)?q.mode:'user';if(q.submitted==='1'&&caseId.value)feedback.value='提交成功，可在「我的 → 纠纷调解 → 我的调解」持续查看处理结果。';if(q.orderType&&q.orderId){orderRole.value=q.orderRole==='merchant'?'merchant':'user';creating.value=true;targetOrder={type:q.orderType,id:q.orderId};loadOrders()}})
watch(getMessageScopeKey,()=>{clearIdentityView();if(pageActive)load()},{flush:'sync'})
onHide(()=>{pageActive=false;invalidateRequests()})
onUnload(()=>{pageActive=false;clearIdentityView()})
onShow(()=>{pageActive=true;load()})
</script>
<style lang="scss">@import './governance.scss';
.gov-progress{padding:16px;background:#edf1e3;border:1px solid #dce3cf;border-radius:15px;margin-bottom:18px}.gov-progress .gov-heading{margin:0}.gov-progress__state{display:block;font-size:21px;font-weight:600;color:#4d6b42;margin:12px 0 6px}.gov-progress .gov-time{color:#6f775f}.gov-item>.gov-link{display:block;margin-top:10px}.gov-progress .gov-row{align-items:center;flex-wrap:wrap}
.form-meta{display:flex;justify-content:space-between;gap:12px;margin-top:6px;font-size:12px;line-height:1.7;color:#8a8074;flex-wrap:wrap}.form-meta--invalid,.form-error{color:#ae4939}.form-error{display:block;font-size:12px;line-height:1.7;margin-top:6px}
</style>
