<template>
  <view class="slot-editor">
    <text class="slot-note">{{ canEdit ? '设置本门店通用时段，审核通过的候选人即可预约，还在等时段的会收到提醒。时间均为北京时间。' : '本门店的面试时段（北京时间）。新增或关闭时段需由本店换工主理人或小院主理人操作。' }}</text>
    <view v-if="canEdit" class="slot-field"><text>日期</text><button class="slot-date" @click="dateOpen=true">{{ date || '选择日期' }}<k-icon name="calendar-days" :size="19" color="red"/></button></view>
    <view v-if="canEdit" class="slot-field"><text>开始时间</text><input v-model="start" class="slot-clock" maxlength="5" placeholder="如 09:30 或 0930" @blur="start=normalizeClock(start)||start"/></view>
    <view v-if="canEdit" class="slot-field"><text>结束时间</text><input v-model="end" class="slot-clock" maxlength="5" placeholder="如 09:30 或 0930" @blur="end=normalizeClock(end)||end"/></view>
    <text v-if="canEdit">腾讯会议（可选，候选人可一键进入）</text>
    <!-- 2026-11-03 主人：在腾讯会议点「复制邀请」，整段粘到这一栏，自动认出会议号 / 密码 / 链接填到下面，并写明认出了什么；
         只粘链接、只填会议号也行。仍是单行 input（不用原生 textarea，免得盖住底部导航），粘进来的多行会连成一行，解析照样认得 -->
    <view v-if="canEdit" class="slot-paste"><text>粘贴腾讯会议邀请</text><input v-model="paste" maxlength="2000" placeholder="在腾讯会议点「复制邀请」，整段粘贴到这里" @input="onPaste" @blur="onPaste(null,true)" /><text v-if="pasteMsg" :class="pasteOk ? 'paste-ok' : 'paste-bad'">{{ pasteMsg }}</text></view>
    <!-- 下面各栏可以手改；保存成 formatTencentMeeting 的固定写法，后端照旧存一段文字 -->
    <view v-if="canEdit" class="slot-field"><text>会议号</text><input v-model="code" maxlength="500" placeholder="9–12 位数字" @blur="fill" /></view>
    <view v-if="canEdit" class="slot-field"><text>密码</text><input v-model="pwd" maxlength="40" placeholder="选填，没有密码就空着" @blur="fill" /></view>
    <view v-if="canEdit" class="slot-field"><text>入会链接</text><input v-model="link" maxlength="300" placeholder="选填，meeting.tencent.com 开头" @blur="fill" /></view>
    <view v-if="canEdit" class="slot-field"><text>备注</text><input v-model="note" maxlength="200" placeholder="选填，如：请提前 5 分钟入会" /></view>
    <k-button v-if="canEdit" block :disabled="busy || !storeId" :label="busy ? '正在保存…' : '新增可预约时段'" @click="save" />
    <text class="k-title">近期时段</text>
    <text v-if="loading">正在读取时段…</text>
    <view v-else-if="error"><text>{{ error }}</text><k-button type="outline" @click="load">重试</k-button></view>
    <text v-else-if="!rows.length" class="slot-note">{{ canEdit ? '暂无时段，在上方添加后候选人即可选择。' : '暂无时段。' }}</text>
    <view v-for="row in rows" :key="row.slotId" class="slot-row"><view><text>{{ row.startTime }} 至 {{ row.endTime }}</text><text>{{ labels[row.status] || row.status }}</text><text v-if="row.meetingInfo" class="slot-meet">{{ rowMeeting(row.meetingInfo) }}</text></view><k-button v-if="canEdit && row.status === 'open'" size="sm" type="outline" :disabled="busy" @click="close(row)">关闭</k-button></view>
    <k-date-picker v-if="dateOpen" title="选择面试日期" :value="date" :min-date="todayCn()" @cancel="dateOpen=false" @confirm="date=$event;dateOpen=false"/>
  </view>
</template>
<script setup>
import { ref, watch, nextTick } from 'vue'
import { apiStaffSlots, apiStaffAddSlot, apiStaffCloseSlot } from '@/common/api.js'
import { toast } from '@/common/screen.js'
import { todayCn,shiftDate } from '@/common/ui.js'
import { normalizeClock } from '@/common/manual-time.js'
import { formatTencentMeeting, tencentInputError, readCodeInput, readMeetingPaste, parseTencentMeeting, meetingSummary } from '@/common/meeting.js'
// canEdit：新增 / 关闭时段服务端要「岗位管理·编辑」（主理人、管家）。没有这项权限的角色只看时段列表，
// 不再显示必被拒绝的表单和「关闭」按钮；由页面按时段所属门店上的角色传入
const props=defineProps({storeId:{type:[Number,String],default:null},canEdit:{type:Boolean,default:true}})
const dateOpen=ref(false),date=ref(shiftDate(todayCn(),1))
const start=ref('10:00'),end=ref('10:30'),code=ref(''),pwd=ref(''),link=ref(''),note=ref(''),rows=ref([]),busy=ref(false),loading=ref(false),error=ref('')
// 会议号去掉空格 / 短横；会议号栏里粘的是整段邀请或链接时（主人 11-03 就是把链接粘进了会议号栏）拆出会议号、密码，链接挪到链接栏
const fill=()=>{const r=readCodeInput(code.value,pwd.value,link.value);code.value=r.code;pwd.value=r.pwd;link.value=r.link}
// 粘贴框：一次进来多个字（粘贴）或失焦时解析；认出就填到下面各栏（认出的项覆盖）、清空粘贴框、写明认出了什么。
// 逐个字打会议号时不在半路解析，免得打到第 9 位就被拿走
const paste=ref(''),pasteMsg=ref(''),pasteOk=ref(false)
let pasteLen=0
function onPaste(e,done){const t=e?e.detail.value:paste.value,grew=t.length-pasteLen>1;pasteLen=t.length;if(!done&&!grew)return;const r=readMeetingPaste(t,{code:code.value,pwd:pwd.value,link:link.value});if(r){code.value=r.code;pwd.value=r.pwd;link.value=r.link;pasteOk.value=true;pasteMsg.value='已认出：'+meetingSummary(r)+'。请核对下方各栏';pasteLen=0;nextTick(()=>{paste.value=''})}else if(done&&t.trim()){pasteOk.value=false;pasteMsg.value='没认出腾讯会议号或链接，请检查后重新粘贴，或在下方手动填写'}else if(done&&!pasteOk.value)pasteMsg.value=''}
// 时段列表里也写上存了什么会议，主人加完能核对
const rowMeeting=(t)=>{const p=parseTencentMeeting(t);return p?'腾讯会议：'+meetingSummary(p):t}
const labels={open:'可预约',booked:'已预约',closed:'已关闭'}
let revision=0
async function load(){const version=++revision;rows.value=[];error.value='';if(!props.storeId)return;loading.value=true;try{const res=await apiStaffSlots(props.storeId);if(version===revision)rows.value=res.data||[]}catch(e){if(version===revision)error.value=e?.message||'加载失败'}finally{if(version===revision)loading.value=false}}
watch(()=>props.storeId,load,{immediate:true})
// 会议号、密码、链接都不填时只存备注（或留空）；填了就得有有效的腾讯会议号或腾讯会议链接
async function save(){if(busy.value||!props.canEdit)return;const from=normalizeClock(start.value),to=normalizeClock(end.value);if(!date.value||!from||!to)return toast('请输入有效时间，例如09:30或0930');if(to<=from)return toast('结束时间必须晚于开始时间');start.value=from;end.value=to;fill();const err=code.value||pwd.value||link.value?tencentInputError(code.value,pwd.value,link.value):'';if(err)return toast(err);busy.value=true;try{await apiStaffAddSlot({storeId:props.storeId,startTime:date.value+' '+start.value+':00',endTime:date.value+' '+end.value+':00',meetingInfo:code.value||link.value?formatTencentMeeting(code.value,pwd.value,note.value,link.value):note.value.trim()});toast('时段已添加');await load()}catch(e){toast(e?.message||'保存失败')}finally{busy.value=false}}
async function close(row){if(busy.value||!props.canEdit)return;const r=await new Promise(resolve=>uni.showModal({title:'关闭时段',content:'关闭后候选人不能预约该时段，已预约时段不能在这里关闭。',success:resolve,fail:()=>resolve({confirm:false})}));if(!r.confirm)return;busy.value=true;try{await apiStaffCloseSlot(row.slotId,props.storeId);toast('已关闭');await load()}catch(e){toast(e?.message||'关闭失败');await load()}finally{busy.value=false}}
</script>
<style scoped>
.slot-editor{padding:16px 16px 96px;display:flex;flex-direction:column;gap:16px;font-size:14px;line-height:1.7}.slot-note{color:var(--k-muted)}.slot-field{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--k-line2);min-height:48px}.slot-field picker{flex:1;text-align:right;padding:12px 0}.slot-field input{flex:1;min-width:0;height:48px;text-align:right}.slot-row{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--k-line2);padding:12px 0}.slot-row>view{flex:1;display:flex;flex-direction:column;overflow-wrap:anywhere}.slot-meet{color:var(--k-muted);font-size:13px;white-space:pre-wrap}.slot-paste{display:flex;flex-direction:column;gap:6px}.slot-paste input{height:44px;padding:0 12px;border:1px solid var(--k-line2);border-radius:12px;background:var(--k-paper)}.paste-ok{color:var(--k-green);font-size:13px}.paste-bad{color:var(--k-alert);font-size:13px}
.slot-date{flex:1;display:flex;align-items:center;justify-content:flex-end;gap:8px;background:transparent;margin:0;padding:10px 0;font-size:15px;color:var(--k-ink);line-height:26px}.slot-date:after{border:0}.slot-clock{font-variant-numeric:tabular-nums}
</style>
