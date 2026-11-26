<template>
  <view class="k-page ops-page">
    <k-topbar :title="overdueRoute ? '逾期纠纷' : '日报与月度任务'" back />
    <view v-if="overdueRoute" class="ops-body">
      <view v-if="error" class="error"><text>{{ error }}</text><button @click="openOverdueCases">重新打开</button></view>
      <text v-else class="empty">正在打开逾期纠纷…</text>
    </view>
    <template v-else>
    <k-subscribe scenes="ops_daily,ops_weekly,ops_monthly" label="订阅日报、周报与月度提醒" />
    <view class="ops-body">
      <view class="intro"><text class="eyebrow">把今天理清楚</text><text class="intro-title">工作有记录，进度看得见</text><text class="muted">北京时间 17:30预填 · 18:00定稿 · 18:30催报</text></view>
      <view class="tabs"><button v-for="t in tabs" :key="t.key" :class="{on: tab===t.key}" @click="setTab(t.key)">{{ t.label }}</button></view>
      <view v-if="error" class="error"><text>{{ error }}</text><button @click="reload">重新加载</button></view>
      <view v-if="busy && !report && !summary" class="empty">正在读取工作记录…</view>
      <template v-if="tab === 'today'">
        <picker v-if="access.scopes.length" :range="scopeLabels" :value="scopeIndex" @change="chooseScope"><view class="selector"><text>{{ scopeLabels[scopeIndex] }}</text><text>切换 ▾</text></view></picker>
        <view v-if="!access.scopes.length && loaded" class="empty">当前身份无需填报日报。城市负责人可在历史记录中查看授权范围内的日报。</view>
        <template v-if="report">
          <view class="paper report-head"><view class="between"><text class="section-title">{{ report.bizDate }} · {{ roleName(report.roleCode) }}</text><text class="status">{{ report.status === 'submitted' ? '已提交' : '草稿' }}</text></view><text class="muted">{{ report.cityName }} · {{ report.ownerName }}{{ report.auto?.standIn ? '（代岗）' : '' }}</text><text class="muted">{{ report.windowStart }} 至 {{ report.dataCutoff }}</text><text v-if="!report.finalData" class="notice">当前是预填数据，18:00后刷新即可核对全天数据并提交。</text><text v-if="report.auto?.lateSnapshot" class="notice">本次数据为截止后补生成，请核对库存及在岗等状态类数据。</text><button class="minor" :disabled="busy" @click="refreshReport">刷新数据</button></view>
          <view v-if="report.correctedAt" class="paper"><text class="notice">后台于 {{ report.correctedAt }} 修订本日报。{{ report.correctionReason }}</text><button class="minor" @click="showChanges">查看修改记录</button></view>
          <ops-progress :items="report.progress" />
          <view v-if="report.roleCode==='keeper' && report.auto?.weekActivityMissing>0" class="paper"><text class="notice">本周还需发布 {{ report.auto.weekActivityMissing }} 场活动，请在下方填写未来两天活动计划。</text></view>
          <view v-if="report.auto?.business?.length" class="paper"><text class="section-title">自动统计</text><view v-for="f in report.auto.business" :key="f.label" class="metric"><view class="between"><text>{{ f.label }}</text><text class="metric-value">{{ f.value == null ? '—' : f.value }} {{ f.unit }}</text></view><text class="source">{{ f.source }}</text></view></view>
          <view v-for="line in report.auto?.workforce || []" :key="line.type" class="paper"><text class="section-title">{{ line.title }}</text><view v-for="f in line.fields" :key="f.label" class="metric"><view class="between"><text>{{ f.label }}</text><text class="metric-value">{{ f.value == null ? '—' : f.value }} {{ f.unit }}</text></view><text class="source">{{ f.source }}</text></view></view>
          <template v-if="report.roleCode === 'keeper'">
            <view class="paper"><text class="section-title">线下收支</text><text class="muted">只记录本窗口内未在系统记账的收支，避免重复计算。</text><view class="field"><text>线下收入（元） *</text><input v-model="manual.offlineIncome" type="digit" :disabled="!editable" placeholder="没有收入请填0" @input="dirty=true" /></view>
              <view v-for="(entry,i) in manual.expenses" :key="i" class="expense"><view class="between"><text>支出 {{ i+1 }}</text><button v-if="editable" class="text-btn" @click="removeExpense(i)">删除</button></view><picker mode="date" :value="entry.date" :disabled="!editable" @change="entry.date=$event.detail.value;dirty=true"><view class="selector">{{ entry.date || '选择支出日期' }}</view></picker><input v-model="entry.item" :disabled="!editable" maxlength="100" placeholder="支出项目 *" @input="dirty=true" /><input v-model="entry.amount" type="digit" :disabled="!editable" placeholder="金额（元） *" @input="dirty=true" /><input v-model="entry.handler" :disabled="!editable" maxlength="64" placeholder="经手人 *" @input="dirty=true" /></view>
              <button v-if="editable && manual.expenses.length < 100" class="minor" @click="addExpense">＋ 添加一笔支出</button><view class="total"><text>线下支出合计 ¥{{ money(offlineExpense) }}</text><text>今日总营收 ¥{{ money(totalIncome) }}</text><text>今日总支出 ¥{{ money(totalExpense) }}</text></view>
            </view>
            <view class="paper"><view class="between"><text class="section-title">本周活动</text><text :class="{'warn':report.auto.weekActivityMissing>0}">{{ report.auto.weekActivityCount }} / 3 场</text></view><text v-if="report.auto.weekActivityMissing>0" class="notice">本周还需发布 {{ report.auto.weekActivityMissing }} 场活动</text><view v-for="a in report.auto.activities" :key="a.activityId" class="activity"><text>{{ a.title }}</text><text class="muted">{{ a.startTime }} · {{ a.signed }} 人报名 · {{ activityStatus(a.status) }}</text></view><text v-if="!report.auto.activities.length" class="muted">本周暂未发布活动</text></view>
          </template>
          <view class="paper"><text class="section-title">今日记录与明日计划</text><text class="muted">带 * 的项目提交时必填；没有问题请填写“无”。</text><view v-for="f in manualFields" :key="f.key" :id="'ops-field-'+f.key" class="field"><text>{{ f.label }}{{ f.required ? ' *' : '' }}</text><input v-if="f.type==='text' || f.type==='number'" v-model="manual[f.key]" :type="f.type==='number'?'digit':'text'" :disabled="!editable" :maxlength="f.max || 1000" :placeholder="f.placeholder || '请填写'" @input="dirty=true" /><textarea v-else v-model="manual[f.key]" :disabled="!editable" :maxlength="f.max || 1000" auto-height :placeholder="f.placeholder || '请填写'" @input="dirty=true" /></view></view>
          <view v-if="report.auto?.issues?.length" class="paper"><text class="section-title">本期异常记录</text><view v-for="issue in report.auto.issues" :key="issue.caseId" class="activity"><text>{{ issue.caseNo }} · {{ issue.category }}</text><text class="muted">{{ issue.closedAt ? '已闭环' : '待跟进' }} · {{ issue.createTime }}</text></view></view>
          <view v-if="severe.length" class="paper"><text class="section-title">补救计划</text><text class="notice">以下任务严重落后，填写可执行的补救计划后才能提交。</text><view v-for="p in severe" :key="p.targetId" class="field"><text>{{ p.label }} *</text><textarea v-model="manual.remedies[String(p.targetId)]" :disabled="!editable" maxlength="1000" auto-height placeholder="准备做什么、什么时候完成？" @input="dirty=true" /></view></view>
          <view class="paper"><text class="section-title">今日小结</text><text class="summary-text">{{ report.summaryText }}</text><text v-if="dirty" class="muted">保存后，小结会同步更新。</text></view>
          <view v-if="!editable" class="download-row"><button @click="download('daily',report.reportId,'pdf')">导出PDF</button><button @click="download('daily',report.reportId,'xlsx')">导出Excel</button></view>
        </template>
      </template>
      <template v-if="tab==='history' || tab==='monthly'">
        <picker mode="date" fields="month" :value="month" @change="changeMonth"><view class="selector"><text>{{ month }}</text><text>选择月份 ▾</text></view></picker>
        <template v-if="tab==='history'"><text class="section-title">我的日报</text><view v-for="r in history.mine" :key="r.reportId" class="history-row" hover-class="k-press" @click="openReport(r.reportId)"><view><text>{{ r.bizDate }} · {{ roleName(r.roleCode) }}{{ Number(r.standIn) ? '（代岗）' : '' }}</text><text class="muted">{{ r.cityName }}</text></view><view class="history-go"><text>{{ r.status==='submitted'?'已提交':'待提交' }}</text><k-icon name="chevron-right" :size="12" color="#8A5E36" /></view></view><view v-if="!history.mine.length" class="empty">本月暂无本人日报</view><template v-if="access.observerCities.length"><text class="section-title">授权范围内的日报</text><view v-for="r in history.observed" :key="r.reportId" class="history-row" hover-class="k-press" @click="openReport(r.reportId)"><view><text>{{ r.bizDate }} · {{ r.ownerName }}</text><text class="muted">{{ r.cityName }} · {{ roleName(r.roleCode) }}{{ Number(r.standIn) ? '（代岗）' : '' }}</text></view><view class="history-go"><text>{{ r.status==='submitted'?'已提交':'待提交' }}</text><k-icon name="chevron-right" :size="12" color="#8A5E36" /></view></view><view v-if="!history.observed.length" class="empty">本月暂无可查看的日报</view></template></template>
        <template v-else><view v-for="r in history.monthly" :key="r.summaryId" class="history-row" hover-class="k-press" @click="openSummary(r.summaryId)"><view><text>{{ r.cityName }} · {{ r.ownerName }}</text><text class="muted">{{ roleName(r.roleCode) }} · {{ r.monthKey }}</text></view><view class="history-go"><text>查看</text><k-icon name="chevron-right" :size="12" color="#8A5E36" /></view></view><view v-if="!history.monthly.length && !summary" class="empty">月度总结会在次月1日生成，生成后可在这里查看和导出。</view>
          <view v-if="summary" class="monthly-content"><view class="paper"><text class="section-title">{{ summary.monthKey }} 月度总结</text><text>{{ summary.cityName }} · {{ summary.ownerName }}</text><text class="muted">生成于 {{ summary.generatedAt }}</text><text class="muted">已提交 {{ summary.summary.submittedReports }} 份 · 尚未提交 {{ summary.summary.draftReports }} 份</text><text class="source">{{ summary.summary.note }}</text></view><view class="paper"><text class="section-title">关键业务与异常统计</text><view v-for="f in summary.summary.keyMetrics || []" :key="f.label" class="metric"><view class="between"><text>{{ f.label }}</text><text class="metric-value">{{ f.value == null ? '—' : f.value }} {{ f.unit }}</text></view></view></view><ops-progress :items="summary.summary.progress" /><view v-for="section in monthlySections" :key="section.key" class="paper"><text class="section-title">{{ section.title }}</text><text v-for="(line,i) in summary.summary[section.key]" :key="i" class="summary-text">{{ line }}</text><text v-if="!summary.summary[section.key]?.length" class="muted">暂无记录</text></view><view class="paper"><text class="section-title">本月行动记录</text><view v-for="a in summary.summary.actions" :key="a.reportId" class="activity"><text>{{ a.bizDate }} · {{ a.ownerName }}</text><text class="summary-text">{{ a.plan }}</text><text class="muted">问题：{{ a.issues || '无' }}</text></view><text v-if="!summary.summary.actions.length" class="muted">本月没有已提交的行动记录</text></view><view class="download-row"><button @click="download('monthly',summary.summaryId,'pdf')">导出PDF</button><button @click="download('monthly',summary.summaryId,'xlsx')">导出Excel</button></view></view>
        </template>
      </template>
    </view>
    <view v-if="tab==='today' && editable" class="savebar"><button class="minor" :disabled="saving || busy" @click="save(false)">{{ saving?'保存中…':'保存草稿' }}</button><button class="primary" :disabled="saving || busy || !report.canSubmit" @click="save(true)">{{ report.canSubmit?'核对并提交':'18:00后刷新提交' }}</button></view>
    </template>
  </view>
</template>
<script setup>
import { ref, computed } from 'vue'
import { onLoad, onReady, onShow, onUnload } from '@dcloudio/uni-app'
import { get, post, put } from '@/common/request.js'
import { ensureSession, hasStaffAccess, currentStaffStore, selectStaffStore, getSessionRevision } from '@/common/experience.js'
import { downloadDoc } from '@/common/upload.js'
import { toast } from '@/common/screen.js'
import OpsProgress from './components/ops-progress.vue'
const api='/app/operations', tab=ref('today'), error=ref(''),busy=ref(false),saving=ref(false),loaded=ref(false),dirty=ref(false)
const access=ref({scopes:[],observerCities:[]}),scopeIndex=ref(0),report=ref(null),summary=ref(null),manual=ref({expenses:[],remedies:{}}),month=ref(''),history=ref({mine:[],observed:[],monthly:[]})
const tabs=[{key:'today',label:'今日填报'},{key:'monthly',label:'月度总结'},{key:'history',label:'历史记录'}]
const monthlySections=[{key:'strengths',title:'做得好的地方'},{key:'gaps',title:'还需改善'},{key:'suggestions',title:'下月建议'}]
let route={},version=0,session=null,prompted=''
const overdueRoute = ref('')
function openOverdueCases() {
  error.value = ''
  uni.redirectTo({ url: overdueRoute.value, fail: () => { error.value = '逾期纠纷未能打开，请重试。' } })
}
const roleName=r=>r==='keeper'?'小院主理人':'换工主理人'
const scopeLabels=computed(()=>access.value.scopes.map(s=>s.cityName+' · '+roleName(s.roleCode)+(s.standIn?'（代岗）':'')))
const editable=computed(()=>!!report.value?.editable)
const severe=computed(()=>(report.value?.progress || []).filter(p=>p.status==='severe'))
const defaultManualFields=computed(()=>report.value?.roleCode==='manager'?[{key:'tomorrowPlan',label:'明日规划',required:true,max:500},{key:'agreedShops',label:'约定店铺及事项',required:true},{key:'issues',label:'今日问题',required:true}]:[{key:'facilities',label:'设施故障',required:true},{key:'shortages',label:'物料缺货',required:true},{key:'yesterdayIssues',label:'昨日问题／特殊情况',required:true},{key:'tomorrowPlan',label:'明日工作重点',required:true,max:500},{key:'activityPlan',label:'未来两天活动计划',required:true},{key:'activityNote',label:'活动备注'}])
const manualFields=computed(()=>(report.value?.form?.fields || defaultManualFields.value).filter(f=>f.enabled!==false).map(f=>({...f,max:f.maxLength||f.max||1000})))
const fen=v=>Math.round((Number(v)||0)*100),money=v=>(Number(v||0)/100).toFixed(2)
const offlineExpense=computed(()=>manual.value.expenses.reduce((n,e)=>n+fen(e.amount),0))
const totalIncome=computed(()=>Number(report.value?.totals?.platformIncomeFen||0)+fen(manual.value.offlineIncome))
const totalExpense=computed(()=>Number(report.value?.totals?.platformExpenseFen||0)+offlineExpense.value)
const activityStatus=s=>({open:'报名中',paused:'已暂停',closed:'报名截止',ended:'已结束'}[s]||s)
const modal=opts=>new Promise((resolve,reject)=>uni.showModal({...opts,success:resolve,fail:reject}))
const message=e=>e?.message||e?.msg||'读取失败，请重试'
async function discard(){if(!dirty.value)return true;return (await modal({title:'有未保存的修改',content:'切换前请确认，未保存的内容将丢失。',confirmText:'继续切换'})).confirm}
function adopt(data){report.value=data;manual.value=JSON.parse(JSON.stringify({...data.manual,expenses:data.manual?.expenses||[],remedies:data.manual?.remedies||{}}));dirty.value=false;if(data.editable&&data.canSubmit&&severe.value.length&&prompted!==String(data.reportId)){prompted=String(data.reportId);uni.showModal({title:'月度进度需要关注',content:'有 '+severe.value.length+' 项任务严重落后，请在日报下方填写补救计划。',showCancel:false})}}
async function run(fn){const own=++version,started=getSessionRevision();busy.value=true;error.value='';try{const data=await fn();if(own!==version||started!==getSessionRevision())return null;return data?.data}catch(e){if(own===version)error.value=message(e);return null}finally{if(own===version)busy.value=false}}
async function openToday(){const s=access.value.scopes[scopeIndex.value];if(!s)return;const r=await run(()=>post(api+'/daily/open',{cityId:s.cityId,roleCode:s.roleCode,standIn:!!s.standIn,date:access.value.today}));if(r)adopt(r)}
async function reload(){if(dirty.value&&!(await discard()))return;try{
    await ensureSession()
    if (route.storeId && String(route.storeId) !== String(currentStaffStore.value?.storeId)) await selectStaffStore(route.storeId)
  }catch(e){error.value=message(e);return}if(!hasStaffAccess.value){error.value='当前账号没有员工授权';return;}const a=await run(()=>get(api+'/access'));if(!a)return;access.value=a;month.value=month.value||a.month;session=getSessionRevision();loaded.value=true;const selected=access.value.scopes.findIndex(s=>s.roleCode===(route.role||currentStaffStore.value?.roleCode)&&(route.standIn!=='1'||s.standIn)&&(!route.cityId||Number(route.cityId)===Number(s.cityId)));scopeIndex.value=selected<0?0:selected;if(route.reportId){await openReport(route.reportId);route={}}else if(route.summaryId){await openSummary(route.summaryId);route={}}else if(!a.scopes.length || (!route.role && a.scopes.every(item=>item.standIn && !item.responsible))){tab.value='history';await loadHistory()}else if(tab.value==='today')await openToday();else await loadHistory()}
async function chooseScope(e){if(!(await discard()))return;scopeIndex.value=Number(e.detail.value);report.value=null;await openToday()}
async function refreshReport(){if(!(await discard()))return;if(report.value?.editable&&report.value.bizDate===access.value.today)await openToday();else if(report.value)await openReport(report.value.reportId)}
async function openReport(id){if(!(await discard()))return;const r=await run(()=>get(api+'/daily/'+id));if(r){adopt(r);tab.value='today';const i=access.value.scopes.findIndex(s=>s.cityId===r.cityId&&s.roleCode===r.roleCode&&!!s.standIn===!!r.auto?.standIn);if(i>=0)scopeIndex.value=i;uni.pageScrollTo({scrollTop:0,duration:0})}}
async function loadHistory(){const r=await run(()=>get(api+'/history',{month:month.value}));if(r)history.value=r}
async function setTab(value){if(!(await discard()))return;dirty.value=false;tab.value=value;if(value==='today')await openToday();else await loadHistory()}
async function changeMonth(e){month.value=e.detail.value.slice(0,7);summary.value=null;await loadHistory()}
async function openSummary(id){const r=await run(()=>get(api+'/monthly/'+id));if(r){summary.value=r;month.value=r.monthKey;tab.value='monthly'}}
function addExpense(){manual.value.expenses.push({date:report.value.bizDate,item:'',amount:'',handler:''});dirty.value=true}
function removeExpense(i){manual.value.expenses.splice(i,1);dirty.value=true}
async function save(submit){if(saving.value||!editable.value)return;if(submit){const missing=manualFields.value.find(f=>f.required&&!String(manual.value[f.key]||'').trim());if(missing){uni.pageScrollTo({selector:'#ops-field-'+missing.key,offsetTop:-100,duration:250});return toast('请填写'+missing.label)}const noPlan=severe.value.find(p=>!String(manual.value.remedies[p.targetId]||'').trim());if(noPlan)return toast('请填写'+noPlan.label+'的补救计划');const answer=await modal({title:'确认提交日报',content:'请核对自动数据和手填内容。提交后本人不能修改；后台修订会保留修改记录。',confirmText:'确认提交'});if(!answer.confirm)return}const id=report.value.reportId,epoch=getSessionRevision();saving.value=true;error.value='';try{const r=await (submit?post:put)(api+'/daily/'+id+(submit?'/submit':'/draft'),{revision:report.value.revision,manual:manual.value});if(epoch!==getSessionRevision())return;adopt(r.data);toast(submit?'日报已提交':'草稿已保存')}catch(e){error.value=message(e);toast(error.value)}finally{saving.value=false}}
async function showChanges(){try{const r=await get(api+'/daily/'+report.value.reportId+'/changes');const rows=r.data||[];await modal({title:'日报修改记录',content:rows.length?rows.map(x=>x.createTime+' · '+x.operatorName+'\n'+x.reason).join('\n\n'):'暂无后台修改记录',showCancel:false})}catch(e){toast(message(e))}}
async function download(kind,id,type){try{await downloadDoc(api+'/export/'+kind+'/'+id+'?format='+type,type,'工作报表-'+id+'.'+type)}catch(e){toast(message(e))}}
onLoad(options=>{
  route = options || {}
  // 历史逾期通知只带城市和职责。真正的日报、月报另带记录编号。
  const standIn = route.standIn === '1' && ['keeper','manager'].includes(route.role)
  if (!route.reportId && !route.summaryId && /^[1-9]\d*$/.test(route.cityId || '') && (route.role === 'city_lead' || standIn)) {
    overdueRoute.value = '/pages/governance/mediation?mode=city&overdue=1&cityId=' + route.cityId + (standIn ? '&dutyRole=' + route.role : '')
  }
})
onReady(()=>{ if (overdueRoute.value) openOverdueCases() })
onShow(()=>{if(overdueRoute.value)return;if(!loaded.value||session!==getSessionRevision()){report.value=null;summary.value=null;dirty.value=false;reload()}})
onUnload(()=>{version++})
</script>
<style scoped>
.ops-page{min-height:100vh;background:var(--k-bg,#faf7ef);color:var(--k-ink,#302d25)}.ops-body{padding:10px 16px calc(110px + var(--k-safe-bottom,0px));max-width:740px;margin:auto}.intro{padding:14px 0 22px}.eyebrow{display:block;color:var(--k-red,#9c7139);font-size:12px;margin-bottom:7px}.intro-title{display:block;font-size:22px;font-weight:700;margin-bottom:8px}.muted{display:block;font-size:12px;line-height:1.7;color:var(--k-muted,#77736b)}.tabs{display:flex;gap:6px;margin-bottom:18px;background:#eee9de;border-radius:12px;padding:4px}.tabs button{flex:1;margin:0;padding:11px 2px;line-height:1.3;font-size:14px;color:#76674f;background:transparent;border:0;border-radius:9px}.tabs button.on{background:#fff;box-shadow:0 2px 5px #5d442317;color:#3d382f;font-weight:700}button:after{border:0}.paper{padding:17px;border:1px solid var(--k-line2,#e6dfd1);border-radius:17px;background:var(--k-paper,#fff);margin:12px 0}.section-title{display:block;font-size:18px;font-weight:700;line-height:1.5;margin-bottom:8px}.between{display:flex;align-items:center;justify-content:space-between;gap:12px}.between>.section-title{flex:1}.between>text:first-child{min-width:0}.status{font-size:12px;white-space:nowrap;background:#eef3e8;color:#4b643f;padding:4px 8px;border-radius:12px}.notice{display:block;border-radius:9px;background:#fff4df;color:#86602b;font-size:12px;padding:10px;line-height:1.7;margin:10px 0}.selector{display:flex;justify-content:space-between;gap:8px;align-items:center;border:1px solid #ddd3c4;border-radius:11px;background:#fffdf8;padding:13px 12px;font-size:14px;margin:10px 0;min-height:44px;box-sizing:border-box}.metric{padding:12px 0;border-bottom:1px solid #f0ebe2;font-size:14px}.metric:last-child{border:0}.metric-value{font-weight:700;flex-shrink:0;font-variant-numeric:tabular-nums}.source{display:block;font-size:11px;line-height:1.6;color:var(--k-muted,#77736b);margin-top:6px}.field{margin:18px 0}.field>text{display:block;font-size:14px;font-weight:600;margin-bottom:8px}input,textarea{box-sizing:border-box;width:100%;border:1px solid #dcd4c6;border-radius:9px;padding:12px;background:#fffefa;font-size:15px;color:#302d25}input{height:46px}textarea{min-height:90px;line-height:1.6}.expense{background:#f8f5ed;padding:12px;margin:12px 0;border-radius:12px}.expense input{margin-top:8px}.expense .between{font-size:14px;font-weight:600}.text-btn{margin:0;font-size:12px;background:transparent;color:#9e5035;line-height:36px;min-width:52px}.minor,.download-row button{font-size:14px;border:1px solid #c9b99e;background:#fffdf8;color:#795c34;border-radius:10px;padding:11px 15px;line-height:1.5;min-height:44px}.report-head .minor{margin:12px 0 0}.primary{background:#986831;color:white;border-radius:11px;font-size:15px;line-height:1.5;padding:12px}.primary[disabled]{background:#e5dfd3;color:#8a8172}.savebar{position:fixed;bottom:0;left:0;right:0;display:flex;gap:10px;padding:12px 16px calc(12px + var(--k-safe-bottom,0px));background:#faf7eff5;border-top:1px solid #e4dccd;z-index:30}.savebar .primary{flex:1}.savebar .minor{flex:0 0 auto}.total{display:flex;flex-direction:column;gap:10px;border-top:1px dashed #d7cdbd;padding-top:14px;margin-top:16px;font-size:14px;font-weight:650}.warn{color:#976318}.activity{border-bottom:1px solid #eee8df;padding:12px 0;font-size:14px}.activity:last-child{border:0}.summary-text{display:block;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.85;margin:8px 0}.history-row{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fff;border:1px solid #e7dfd1;border-radius:12px;padding:15px 12px;margin:10px 0;font-size:14px}.history-row>text{font-size:12px;white-space:nowrap;color:#88683d}.empty{padding:26px 14px;color:#777167;font-size:14px;line-height:1.8;text-align:center}.error{padding:16px;background:#fff0e9;border:1px solid #edcbbd;color:#98462b;border-radius:12px;margin:10px 0;font-size:14px}.error button{margin:10px 0 0;font-size:14px;background:#fff7f0;color:#98462b}.download-row{display:flex;gap:10px;margin:20px 0}.download-row button{flex:1}.report-head .between{align-items:flex-start}@media(max-width:350px){.ops-body{padding-left:12px;padding-right:12px}.paper{padding:14px}.intro-title{font-size:20px}.savebar{padding-left:12px;padding-right:12px}.savebar .minor{padding:11px}.metric{font-size:13px}}
/* 2026-11-17 改版「小而精」：这一页要填报，字号一律不动；只统一成浅灰底 + 白卡（12 圆角、不描边），颜色换成主题变量，按钮收成胶囊，「删除」用提醒红 */
.ops-page{--k-bg:#F7F5F2;background:#F7F5F2}
.ops-page :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.ops-page :deep(.subscribe-entry button){border:0;border-radius:12px;background:var(--k-paper);color:var(--k-ochre-deep)}
/* 订阅提醒条和下面的卡片左右对齐（这一页页边距是 16，窄屏 12） */
.ops-page :deep(.subscribe-entry){padding-left:16px;padding-right:16px}
@media(max-width:350px){.ops-page :deep(.subscribe-entry){padding-left:12px;padding-right:12px}}
.eyebrow{color:var(--k-red-deep)}
/* 11-18 第二轮精修：页签只改形状和颜色（字号、高度不动）——胶囊轨道 #F0EBE4，选中白块墨色 600 */
.tabs{background:#F0EBE4;border-radius:999px;padding:3px}.tabs button{color:var(--k-ink2);border-radius:999px}.tabs button.on{background:var(--k-paper);box-shadow:none;color:var(--k-ink);font-weight:600}
.paper{border:0;border-radius:12px;margin:8px 0;padding:16px}@media(max-width:350px){.paper{padding:14px}}
.status{padding:2px 8px;border-radius:4px;background:var(--k-green-soft);color:var(--k-green)}
.notice{border-radius:8px;background:var(--k-ochre-soft);color:var(--k-ochre-deep)}
.selector{border-color:var(--k-line2);border-radius:10px;background:var(--k-paper)}
.metric{border-bottom-color:var(--k-line)}
input,textarea{border-color:var(--k-line2);border-radius:10px;background:var(--k-paper);color:var(--k-ink)}
.expense{background:#F7F5F2;border-radius:10px}
.text-btn{color:var(--k-alert)}
.minor,.download-row button{border-color:var(--k-red-line);background:var(--k-paper);color:var(--k-red-deep);border-radius:999px}
.primary{background:linear-gradient(135deg,#B5814D,#8E5E33);border-radius:999px;font-weight:600}
/* 不可点：原配色整体变淡 .45，不用冷灰底；!important 盖住微信 button[disabled] 自带的灰色（写法同 k-button） */
.primary[disabled]{background:linear-gradient(135deg,#B5814D,#8E5E33)!important;color:#fff!important;opacity:.45}
.minor[disabled]{background:var(--k-paper)!important;color:var(--k-red-deep)!important;opacity:.45}
.savebar{background:var(--k-paper);border-top:0}
.savebar::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.total{border-top-color:var(--k-line2);font-weight:600}
.warn{color:var(--k-ochre-deep)}
.activity{border-bottom-color:var(--k-line)}
.history-row{border:0;border-radius:12px;margin:8px 0;background:var(--k-paper)}
.history-row>text{color:var(--k-red-deep)}
/* 「已提交 / 查看」后面的箭头换成 12 号线性图标，和字排一行 */
.history-go{flex-shrink:0;display:flex;align-items:center;gap:2px;font-size:12px;white-space:nowrap;color:var(--k-red-deep)}
.empty{color:var(--k-muted)}
.error{background:var(--k-alert-soft);border:0;color:var(--k-alert)}
.error button{background:var(--k-paper);color:var(--k-alert);border-radius:999px}
</style>
