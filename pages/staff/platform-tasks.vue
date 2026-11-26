<template>
  <view class="k-page platform-tasks">
    <k-topbar :title="taskId ? '管理员任务详情' : '管理员任务'" back custom-back @back="leaveDetail" />
    <k-subscribe scenes="work_task" label="订阅任务提醒" />
    <view class="k-body task-body">
      <template v-if="!taskId">
        <text class="intro">管理员派发给你的任务。先点「接收」，有问题可以直接回复提问、申请延期或说明做不了；做完提交图片和说明，审核通过才算完成。</text>
        <view class="tabs"><button v-for="tab in tabs" :key="tab.key" :class="{active:status===tab.key}" @click="changeTab(tab.key)">{{ tab.label }}</button></view>
        <view v-if="error" class="state"><text>{{ error }}</text><button @click="loadList(false)">重新加载</button></view>
        <view v-else-if="loading&&!rows.length" class="state">正在读取任务…</view>
        <view v-else-if="!rows.length" class="state">{{ status==='todo' ? '暂时没有待办任务' : '暂无这一状态的任务' }}</view>
        <button v-for="row in rows" :key="row.taskId" class="task-row" @click="openTask(row.taskId)"><view class="row-heading"><text class="task-title">{{ row.title }}</text><text class="status" :class="row.status">{{ label(row) }}</text></view><text class="meta">{{ row.storeName }}{{ row.roleLabel ? ' · ' + row.roleLabel : '' }}</text><view class="row-heading"><text class="meta">{{ row.dueDate ? '截止 '+row.dueDate : '未设置截止日期' }}{{ row.requestedDueDate ? '（已申请延到 '+row.requestedDueDate+'）' : '' }}</text><view class="task-link"><text>{{ nextStep(row.status) }}</text><k-icon name="chevron-right" :size="12" color="#8A5E36" /></view></view></button>
        <button v-if="hasMore" class="more" :disabled="loading" @click="loadList(true)">{{ loading ? '正在读取…' : '加载更多' }}</button>
      </template>
      <template v-else>
        <view v-if="error" class="state"><text>{{ error }}</text><button @click="loadDetail">重新加载</button></view>
        <view v-else-if="loading&&!task" class="state">正在读取任务…</view>
        <template v-if="task">
          <view class="task-panel"><view class="row-heading"><text class="task-title">{{ task.title }}</text><text class="status" :class="task.status">{{ label(task) }}</text></view><text class="meta">{{ task.storeName }} · 派发人：{{ task.createBy }}</text><text class="meta">{{ task.dueDate ? '截止 '+task.dueDate : '未设置截止日期' }}</text><text v-if="task.requestedDueDate" class="meta warn">已申请延到 {{ task.requestedDueDate }}，等管理员回复</text><text class="section-title">任务要求</text><text class="pre">{{ task.description }}</text></view>
          <view v-if="task.status==='rejected'" class="rejection"><text class="section-title">本次提交被驳回</text><text class="pre">{{ task.submissions[0]?.reviewNote }}</text><text class="meta">请按审核意见修改下方内容，再次提交。</text></view>
          <view v-if="task.canAccept" class="task-panel accept"><text class="meta">接收后管理员能看到你在做；做不了或时间不够，可以在下面直接说明。</text><button class="submit" :disabled="acting" @click="act('accept')">{{ acting ? '正在提交…' : '接收任务' }}</button></view>
          <view v-if="canSubmit" class="task-panel">
            <text class="section-title">完成反馈</text><text class="field-label">完成说明 <text class="required">*</text></text>
            <textarea v-model="content" :disabled="submitting" :maxlength="3000" placeholder="请说明完成了什么、处理结果，以及需要管理员了解的情况" class="feedback" :auto-height="true"/>
            <text class="counter">{{ content.length }}/3000</text><text class="field-label">完成图片 <text class="required">*</text></text><text class="meta">上传1至9张图片，单张不超过20MB（JPG / PNG）。</text>
            <view class="images"><view v-for="(img,i) in images" :key="img.fileId" class="image-item"><image :src="absUrl(img.url)" mode="aspectFill" @click="preview(images,i)"/><button :disabled="uploading||submitting" class="remove" @click="images.splice(i,1)" aria-label="移除图片">×</button></view><button v-if="images.length<9" class="add-image" :disabled="uploading||submitting" @click="addImages(images)">{{ uploading ? '上传中…' : '＋ 添加图片' }}</button></view>
            <button class="submit" :disabled="uploading||submitting||!content.trim()||!images.length" @click="submit">{{ submitting ? '正在提交…' : task.status==='rejected' ? '修改完成，重新提交' : '提交管理员审核' }}</button>
          </view>
          <view v-else-if="!task.canAccept" class="result-note">{{ resultNote }}</view>
          <!-- 主人 2026-11-03：「需要有个流转过程，不能只单向发送」——回复提问、申请延期、说明做不了，管理员在后台能看到并回复 -->
          <view v-if="actions.length" class="act-buttons"><button v-for="a in actions" :key="a.key" :class="{active:actKey===a.key}" :disabled="acting" @click="toggleAct(a.key)">{{ a.label }}</button></view>
          <view v-if="actKey" class="task-panel act-form">
            <text class="section-title">{{ form.title }}</text>
            <picker v-if="form.date" mode="date" :start="today" :value="actDue" @change="onDue"><view class="date-field"><text>{{ actDue || '选择希望延到的日期' }}</text><k-icon name="chevron-right" :size="12" color="muted" /></view></picker>
            <textarea v-model="actText" :disabled="acting" :maxlength="1000" :placeholder="form.placeholder" class="feedback small" :auto-height="true"/>
            <text class="counter">{{ actText.length }}/1000</text>
            <view v-if="form.images" class="images"><view v-for="(img,i) in actImages" :key="img.fileId" class="image-item"><image :src="absUrl(img.url)" mode="aspectFill" @click="preview(actImages,i)"/><button :disabled="uploading||acting" class="remove" @click="actImages.splice(i,1)" aria-label="移除图片">×</button></view><button v-if="actImages.length<9" class="add-image" :disabled="uploading||acting" @click="addImages(actImages)">{{ uploading ? '上传中…' : '＋ 图片（可选）' }}</button></view>
            <button class="submit" :disabled="acting||uploading" @click="act(actKey)">{{ acting ? '正在提交…' : '发送' }}</button>
          </view>
          <view v-if="task.events?.length" class="task-panel"><text class="section-title">处理记录</text>
            <view v-for="e in task.events" :key="e.eventId" class="event" :class="e.actorType"><text class="event-head">{{ eventLine(e) }}</text><text class="meta">{{ e.createTime }}</text><text v-if="e.content" class="pre">{{ e.content }}</text><view v-if="e.images?.length" class="images"><image v-for="(img,n) in e.images" :key="img.fileId" :src="absUrl(img.url)" mode="aspectFill" @click="preview(e.images,n)"/></view></view>
          </view>
        </template>
      </template>
    </view>
  </view>
</template>
<script setup>
import {ref,computed,onBeforeUnmount} from 'vue'
import {onLoad,onShow,onPullDownRefresh,onHide} from '@dcloudio/uni-app'
import {get,post,getToken} from '@/common/request.js'
import {experience,ensureSession,getSessionRevision} from '@/common/experience.js'
import {back,toast} from '@/common/screen.js'
import {chooseImages,uploadTo,absUrl} from '@/common/upload.js'
import {staffTaskTodoCount,checkStaffTaskReminder} from '@/common/staff-task-reminder.js'
import {TASK_API as base,TASK_LABELS,TASK_TABS as tabs,nextStep,taskActions,ACT_FORM,checkAct,eventLine} from './task-flow-view.js'
const taskId=ref(null),task=ref(null),status=ref('todo'),rows=ref([]),hasMore=ref(false),loading=ref(false),error=ref(''),content=ref(''),images=ref([]),uploading=ref(false),submitting=ref(false)
const actKey=ref(''),actText=ref(''),actImages=ref([]),actDue=ref(''),acting=ref(false)
let pageNum=1,sequence=0,landing=false,loadedScope='',timer
const session=()=>[experience.account?.id,getSessionRevision(),getToken()].join('|')
const pad=n=>String(n).padStart(2,'0'),now=new Date(),today=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`
const label=t=>t.statusLabel||TASK_LABELS[t.status]||t.status
// 先接收再做：待接收的只给「接收」按钮，接收后（或被驳回）才出完成表单
const canSubmit=computed(()=>!!task.value?.canSubmit&&task.value.status!=='pending')
const actions=computed(()=>taskActions(task.value))
const form=computed(()=>ACT_FORM[actKey.value]||{})
const resultNote=computed(()=>({submitted:'已提交，等待管理员审核。审核结果会同步到这里和员工消息中心。',approved:'审核已通过，任务已完成。',declined:'你说明了做不了，等管理员改派、调整或关闭。',closed:'任务已关闭。'})[task.value?.status]||'')
function onDue(e){actDue.value=e.detail.value}
function resetAct(){actKey.value='';actText.value='';actImages.value=[];actDue.value=''}
function leaveDetail(){if(uploading.value||submitting.value||acting.value)return toast('正在处理，请稍候');if(taskId.value&&!landing){sequence++;taskId.value=null;task.value=null;resetAct();loadList(false)}else back()}
function changeTab(key){status.value=key;loadList(false)}
function toggleAct(key){if(acting.value||uploading.value)return;if(actKey.value===key)return resetAct();resetAct();actKey.value=key}
async function loadList(more=false){const seq=++sequence,stamp=session();loading.value=true;error.value='';if(!more){pageNum=1;rows.value=[]}try{const r=await get(base,{status:status.value,pageNum:more?pageNum+1:1});if(seq!==sequence||stamp!==session())return;rows.value=more?[...rows.value,...r.data.rows]:r.data.rows;hasMore.value=r.data.hasMore;pageNum=r.data.pageNum}catch(e){if(seq===sequence)error.value=e.message||'任务读取失败'}finally{if(seq===sequence)loading.value=false}}
function fill(value,keepDraft){task.value=value;if(keepDraft)return;const last=value.submissions?.[0];content.value=value.status==='rejected'?(last?.content||''):'';images.value=value.status==='rejected'?[...(last?.images||[])]:[]}
async function loadDetail(keepDraft=false){if(!taskId.value||submitting.value||uploading.value||acting.value)return;const seq=++sequence,stamp=session(),id=taskId.value;loading.value=true;error.value='';try{const r=await get(base+'/'+id);if(seq!==sequence||stamp!==session())return;fill(r.data,keepDraft);loadedScope=stamp;post(base+'/acknowledge',[{taskId:id,noticeVersion:r.data.noticeVersion}]).catch(()=>{})}catch(e){if(seq===sequence){error.value=e.message||'任务读取失败';task.value=null}}finally{if(seq===sequence)loading.value=false}}
function openTask(id){taskId.value=id;task.value=null;resetAct();loadDetail()}
function preview(list,i){uni.previewImage({urls:list.map(v=>absUrl(v.url)),current:absUrl(list[i].url)})}
async function addImages(list){if(uploading.value||submitting.value||acting.value||!task.value)return;const stamp=session(),id=taskId.value;uploading.value=true;try{const paths=await chooseImages(9-list.length);for(const path of paths){if(stamp!==session()||id!==taskId.value)return;const r=await uploadTo(base+'/'+id+'/images',path);if(stamp===session()&&id===taskId.value)list.push(r.data)}}catch(e){toast(e.message||'图片上传失败，已上传的图片会保留')}finally{uploading.value=false}}
function acceptSubmission(value){fill(value);staffTaskTodoCount.value=Math.max(0,staffTaskTodoCount.value-1)}
const ACT_DONE={accept:'已接收，可以开始做了',reply:'已发送，管理员会在后台看到',extend_request:'已申请延期，等管理员回复',decline:'已说明，等管理员处理'}
async function act(action){
  if(acting.value||uploading.value||submitting.value||!task.value)return
  if(session()!==loadedScope)return toast('登录状态已变化，请重新打开任务')
  const body={version:task.value.version,action,content:actText.value.trim(),fileIds:actImages.value.map(v=>v.fileId),dueDate:actDue.value}
  if(action!=='accept'){const bad=checkAct(action,body,today);if(bad)return toast(bad)}else body.content=''
  if(action==='decline'){const ok=await new Promise(r=>uni.showModal({title:'确认做不了？',content:'提交后任务会停在「无法完成」，由管理员改派、调整或关闭。',confirmText:'确认提交',success:x=>r(x.confirm),fail:()=>r(false)}));if(!ok)return}
  const id=taskId.value,stamp=session(),current=()=>stamp===session()&&taskId.value===id
  acting.value=true
  let resync=false
  try{
    const r=await post(base+'/'+id+'/act',body)
    if(!current())return
    task.value=r.data;resetAct();toast(ACT_DONE[action]);checkStaffTaskReminder()
  }catch(e){
    if(!current())return
    toast(e.message||'提交失败，填写内容已保留')
    // 别的设备或管理员刚动过：同步最新状态，保留正在写的内容
    resync=e.code===409
  }finally{acting.value=false}
  if(resync&&current())loadDetail(true)
}
async function submit(){
  if(submitting.value||uploading.value||acting.value||!canSubmit.value)return
  if(session()!==loadedScope)return toast('登录状态已变化，请重新打开任务')
  if(!content.value.trim()||!images.value.length)return toast('请填写完成说明并上传图片')
  const id=taskId.value,stamp=session(),current=()=>stamp===session()&&taskId.value===id
  submitting.value=true
  try{
    const r=await post(base+'/'+id+'/submit',{version:task.value.version,content:content.value.trim(),fileIds:images.value.map(v=>v.fileId)})
    if(!current())return
    acceptSubmission(r.data);resetAct();toast('已提交，等待管理员审核')
  }catch(e){
    if(!current())return
    // 请求可能已经落库，只是响应丢失；先核对服务端，不能让用户反复提交。
    if(e.code===-1||e.code===409){
      try{
        const r=await get(base+'/'+id)
        if(!current())return
        if(['submitted','approved'].includes(r.data.status)){
          acceptSubmission(r.data)
          return toast(r.data.status==='approved'?'审核已通过，任务已完成':'已确认提交成功，等待管理员审核')
        }
        // 没有提交成功时保留草稿；另一个设备已重交并被驳回、或管理员改了截止日期时同步新版本。
        task.value=r.data
      }catch{/* 网络仍不可用时，保留所有填写内容供重试。 */}
    }
    if(current())toast(e.message||'提交失败，填写内容已保留')
  }finally{submitting.value=false}
}
onLoad(q=>{if(/^\d+$/.test(String(q.taskId||''))){taskId.value=Number(q.taskId);landing=true}})
onShow(async()=>{await ensureSession();if(session()!==loadedScope&&task.value){task.value=null;content.value='';images.value=[];resetAct()}if(taskId.value){if(!task.value)await loadDetail()}else await loadList(false);clearInterval(timer);timer=setInterval(()=>{if(['submitted','declined'].includes(task.value?.status)||task.value?.requestedDueDate)loadDetail(true)},30000)})
onPullDownRefresh(async()=>{try{if(taskId.value){if((canSubmit.value&&(content.value.trim()||images.value.length))||actText.value.trim()||actImages.value.length)return toast('填写内容已保留，可提交后刷新');await loadDetail()}else await loadList(false)}finally{uni.stopPullDownRefresh()}})
onHide(()=>clearInterval(timer));onBeforeUnmount(()=>{sequence++;clearInterval(timer)})
</script>
<style scoped lang="scss">
.task-body{padding:16px 14px 40px}.intro{display:block;color:var(--k-muted);font-size:14px;line-height:1.7;margin-bottom:18px}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.tabs button{margin:0;padding:6px 15px;border-radius:30px;font-size:14px;color:var(--k-ink);background:var(--k-paper)}.tabs button.active{background:var(--k-ochre);color:#fffaf2}.task-row,.task-panel{display:block;text-align:left;padding:18px 16px;border:1px solid var(--k-line);border-radius:14px;background:var(--k-paper);margin:0 0 14px;line-height:1.6}.row-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.task-title{font-size:18px;font-weight:700;flex:1;min-width:0;overflow-wrap:anywhere}.status{font-size:12px;padding:3px 8px;border-radius:6px;background:#f2ede4;color:#726451;white-space:nowrap;line-height:1.5}.status.rejected,.status.declined{background:#fcece5;color:#a64632}.status.submitted,.status.pending{background:#fff1d7;color:#916224}.status.approved{background:#e8f0e3;color:#456544}.meta{display:block;color:var(--k-muted);font-size:13px;line-height:1.7;margin-top:8px}.meta.warn{color:#916224}.task-link{font-size:13px;color:var(--k-ochre-deep);margin-top:8px;white-space:nowrap}.section-title{display:block;font-size:17px;font-weight:700;margin:16px 0 10px}.task-panel>.section-title:first-child{margin-top:0}.row-heading .section-title{margin:0}.pre{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.8}.rejection{background:#fcf0e8;border:1px solid #dfb5a5;padding:0 16px 16px;border-radius:12px;margin-bottom:14px;color:#984d36}.field-label{display:block;font-size:15px;margin:18px 0 8px}.required{color:#ac4635}.feedback{width:100%;box-sizing:border-box;min-height:130px;border:1px solid var(--k-line);border-radius:8px;background:#fffdf8;padding:12px;font-size:15px;line-height:1.7}.feedback.small{min-height:90px}.counter{display:block;text-align:right;font-size:12px;color:var(--k-muted);margin-top:6px}.images{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.images image,.image-item,.add-image{width:84px;height:84px;border-radius:8px}.image-item{position:relative}.remove{position:absolute;right:-5px;top:-5px;width:26px;height:26px;padding:0;border-radius:50%;font-size:20px;line-height:24px;background:#76573e;color:#fffaf2}.add-image{padding:0;display:flex;align-items:center;justify-content:center;background:#f1e9dc;border:1px dashed var(--k-ochre);font-size:12px;color:var(--k-ochre-deep);margin:0}.submit{margin:22px 0 0;border-radius:30px;background:var(--k-ochre);color:#fffaf2;font-size:16px;font-weight:700;padding:12px;line-height:1.5}.accept .submit{margin-top:14px}.submit[disabled]{background:#e7e1d9;color:#908477}.state{padding:40px 16px;text-align:center;color:var(--k-muted);line-height:1.8}.state button,.more{font-size:14px;margin-top:16px}.result-note{padding:16px;line-height:1.8;color:var(--k-muted)}.act-buttons{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}.act-buttons button{margin:0;padding:6px 15px;border-radius:30px;font-size:14px;color:var(--k-ink);background:var(--k-paper);border:1px solid var(--k-line)}.act-buttons button.active{background:var(--k-ochre);color:#fffaf2;border-color:var(--k-ochre)}.date-field{display:flex;justify-content:space-between;align-items:center;padding:12px;border:1px solid var(--k-line);border-radius:8px;background:#fffdf8;font-size:15px;margin-bottom:10px}.date-field .meta{margin:0}.event{padding:12px 0;border-top:1px solid var(--k-line)}.event:first-of-type{border-top:0;padding-top:0}.event-head{display:block;font-size:15px;font-weight:700}.event.admin .event-head{color:var(--k-ochre-deep)}button::after{border:0}
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边）；任务行标题 15、说明 12，状态换成统一的小标签（绿 = 通过、琥珀 = 待处理、红 = 驳回 / 做不了）；
   主按钮收成暖棕渐变胶囊。填写框（完成说明、提问）的字号不动。按钮、文字一个不少。 */
.platform-tasks{--k-bg:#F7F5F2;background:#F7F5F2}
.platform-tasks :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.platform-tasks :deep(.subscribe-entry){padding:4px 12px 0}
.platform-tasks :deep(.subscribe-entry button){min-height:36px;border:0;border-radius:12px;background:var(--k-paper);color:var(--k-ochre-deep);font-size:12px}
.task-body{padding:10px 12px 40px}
.intro{font-size:12px;line-height:1.7;margin:0 0 10px}
.tabs{gap:6px;margin-bottom:10px}
.tabs button{height:28px;padding:0 12px;border-radius:999px;font-size:12px;line-height:28px;color:var(--k-ink2)}
/* 11-18 第二轮精修：筛选胶囊选中不描边、字重 500（全站一个样子） */
.tabs button.active{background:var(--k-red-soft);color:var(--k-red-deep);font-weight:500;box-shadow:none}
.task-row,.task-panel{padding:12px;border:0;border-radius:12px;margin:0 0 8px}
.task-title{font-size:14px;font-weight:600;line-height:1.45}
.task-panel .task-title{font-size:17px;font-weight:700}
.status{height:17px;padding:0 5px;border-radius:4px;background:#F5F1EB;color:var(--k-ink2);font-size:10px;font-weight:500;line-height:17px}
.status.rejected,.status.declined{background:var(--k-alert-soft);color:var(--k-alert)}
.status.submitted,.status.pending{background:var(--k-ochre-soft);color:var(--k-ochre-deep)}
.status.approved{background:var(--k-green-soft);color:var(--k-green)}
.meta{font-size:12px;line-height:1.6;margin-top:4px}
.meta.warn{color:var(--k-ochre-deep)}
.task-link{font-size:12px;margin-top:4px;color:var(--k-red-deep)}
/* 「去接收」后面的箭头换成 12 号线性图标，和字排一行 */
.task-link{flex-shrink:0;display:flex;align-items:center;gap:2px}
.section-title{font-size:15px;font-weight:700;margin:14px 0 8px}
.pre{font-size:14px;line-height:1.75}
.rejection{background:var(--k-alert-soft);border:0;padding:0 12px 12px;border-radius:12px;margin-bottom:8px;color:var(--k-alert)}
.required{color:var(--k-alert)}
.feedback{border-color:var(--k-line2);border-radius:10px;background:var(--k-paper)}
.remove{background:rgba(58,50,43,.72);color:#fff}
.add-image{background:#F7F5F2;border:1px dashed var(--k-line2);color:var(--k-ink2)}
.submit{height:44px;margin:16px 0 0;padding:0;border-radius:999px;background:linear-gradient(135deg,#B5814D,#8E5E33);color:#fff;font-size:15px;font-weight:600;line-height:44px}
.accept .submit{margin-top:12px}
/* 不可点：原配色整体变淡 .45，不用冷灰底；!important 盖住微信 button[disabled] 自带的灰色（写法同 k-button） */
.submit[disabled]{background:linear-gradient(135deg,#B5814D,#8E5E33)!important;color:#fff!important;opacity:.45}
.state button,.more{font-size:13px;color:var(--k-red-deep)}
/* 空状态 / 读取中：白卡里居中，14 / 500 二级墨；「重新加载」是 32 高的次按钮小胶囊 */
.state{display:flex;flex-direction:column;align-items:center;gap:12px;margin:0 0 8px;padding:28px 16px;border-radius:12px;background:var(--k-paper);font-size:14px;font-weight:500;line-height:1.6;color:var(--k-ink2)}
.state button{height:32px;margin:0;padding:0 14px;border:1px solid var(--k-red-line);border-radius:999px;background:var(--k-paper);line-height:30px}
.result-note{padding:12px;font-size:13px}
.act-buttons{gap:6px;margin:0 0 8px}
.act-buttons button{height:30px;padding:0 12px;border:1px solid var(--k-red-line);border-radius:999px;font-size:13px;line-height:28px;color:var(--k-red-deep)}
.act-buttons button.active{background:var(--k-red-soft);color:var(--k-red-deep);border-color:var(--k-red);font-weight:600}
/* 页签和「回复 / 延期 / 做不了」这几个胶囊看着 28–30 高，上下各多出一圈看不见的可点范围，手指好点 */
.tabs button,.act-buttons button{position:relative;overflow:visible}
.tabs button::before,.act-buttons button::before{content:"";position:absolute;left:0;right:0;top:-4px;bottom:-4px}
.date-field{border-color:var(--k-line2);border-radius:10px;background:var(--k-paper)}
.event{position:relative;padding:10px 0;border-top:0}
.event + .event::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.event-head{font-size:14px;font-weight:600}
</style>
