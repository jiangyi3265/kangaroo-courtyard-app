<template>
  <view class="slot-editor" :class="{'slot-editor--offer':appId}">
    <text v-if="appId" class="k-title">{{ choosing ? '选择面试时段' : '提交候选面试时段' }}</text>
    <text v-if="appId" class="slot-note">{{ choosing ? '请选择义工或主理人提供的时段。确认后双方可在面试详情查看入会方式。' : '可添加多个方便的北京时间，由商家选择。创建腾讯会议后，点「复制邀请」，粘贴到下方即可。' }}</text>
    <text v-else class="slot-note">{{ canEdit ? '设置本门店通用时段，审核通过的候选人即可预约，还在等时段的会收到提醒。时间均为北京时间。' : '本门店的面试时段（北京时间）。新增或关闭时段需由本店换工主理人或小院主理人操作。' }}</text>
    <view v-if="canEdit && !choosing" class="slot-field"><text>日期</text><button class="slot-date" @click="dateOpen=true">{{ date || '选择日期' }}<k-icon name="calendar-days" :size="19" color="red"/></button></view>
    <view v-if="canEdit && !choosing" class="slot-field"><text>开始时间</text><input v-model="start" class="slot-clock" maxlength="5" placeholder="如 09:30 或 0930" @blur="start=normalizeClock(start)||start"/></view>
    <view v-if="canEdit && !choosing" class="slot-field"><text>结束时间</text><input v-model="end" class="slot-clock" maxlength="5" placeholder="如 09:30 或 0930" @blur="end=normalizeClock(end)||end"/></view>
    <view v-if="canEdit && !choosing" class="slot-field"><text>本场最多预约人数</text><input v-model="capacity" type="number" maxlength="2" placeholder="1–99 人" /></view>
    <text v-if="canEdit && !choosing">腾讯会议（可选，候选人可一键进入）</text>
    <!-- 2026-11-03 主人：在腾讯会议点「复制邀请」，整段粘到这一栏，自动认出会议号 / 密码 / 链接填到下面，并写明认出了什么；
         只粘链接、只填会议号也行。仍是单行 input（不用原生 textarea，免得盖住底部导航），粘进来的多行会连成一行，解析照样认得 -->
    <view v-if="canEdit && !choosing" class="slot-paste"><text>粘贴腾讯会议邀请</text><input v-model="paste" maxlength="2000" placeholder="在腾讯会议点「复制邀请」，整段粘贴到这里" @input="onPaste" @blur="onPaste(null,true)" /><text v-if="pasteMsg" :class="pasteOk ? 'paste-ok' : 'paste-bad'">{{ pasteMsg }}</text></view>
    <!-- 下面各栏可以手改；保存成 formatTencentMeeting 的固定写法，后端照旧存一段文字 -->
    <view v-if="canEdit && !choosing" class="slot-field"><text>会议号</text><input v-model="code" maxlength="500" placeholder="9–12 位数字" @blur="fill" /></view>
    <view v-if="canEdit && !choosing" class="slot-field"><text>密码</text><input v-model="pwd" maxlength="40" placeholder="选填，没有密码就空着" @blur="fill" /></view>
    <view v-if="canEdit && !choosing" class="slot-field"><text>入会链接</text><input v-model="link" maxlength="300" placeholder="选填，meeting.tencent.com 开头" @blur="fill" /></view>
    <view v-if="canEdit && !choosing" class="slot-field"><text>备注</text><input v-model="note" maxlength="200" placeholder="选填，如：请提前 5 分钟入会" /></view>
    <k-button v-if="canEdit && !choosing" block :disabled="busy || !(storeId || appId)" :label="busy ? '正在保存…' : appId ? '提交时段给商家' : '新增可预约时段'" @click="save" />
    <text class="k-title">{{ appId ? '已提交的时段' : '近期时段' }}</text>
    <k-button v-if="appId" size="sm" type="outline" label="刷新时段" :disabled="busy || loading" @click="load" />
    <text v-if="loading">正在读取时段…</text>
    <view v-else-if="error"><text>{{ error }}</text><k-button type="outline" @click="load">重试</k-button></view>
    <text v-else-if="!rows.length" class="slot-note">{{ appId ? '暂无候选时段。' : canEdit ? '暂无时段，在上方添加后候选人即可选择。' : '暂无时段。' }}</text>
    <view v-for="row in rows" :key="row.slotId" class="slot-row"><view><text>{{ row.startTime }} 至 {{ row.endTime }}</text><text>{{ appId ? (row.authorRole === 'candidate' ? '义工提交' : '主理人提交') : labels[row.status] || row.status }} · {{ appId ? '最多 ' + (row.capacity || 1) + ' 人' : '已约 ' + (row.bookedCount || 0) + '/' + (row.capacity || 1) + ' 人' }}</text><view v-if="choosing && row.capacity > 1" class="slot-field"><text>本场人数上限</text><input v-model="row.bookingCapacity" type="number" maxlength="2" :placeholder="String(row.capacity)" /></view><text v-if="row.meetingInfo" class="slot-meet">{{ rowMeeting(row.meetingInfo) }}</text></view><k-button v-if="choosing" size="sm" label="选这个时间" :disabled="busy" @click="confirmOffer(row)" /><k-button v-else-if="appId && Number(row.canRemove) === 1" size="sm" type="outline" label="撤回" :disabled="busy" @click="close(row)" /><k-button v-else-if="!appId && canEdit && (row.status === 'open' || Number(row.canClose) === 1)" size="sm" type="outline" :disabled="busy" @click="close(row)">关闭</k-button></view>
    <k-date-picker v-if="dateOpen" title="选择面试日期" :value="date" :min-date="todayCn()" @cancel="dateOpen=false" @confirm="date=$event;dateOpen=false"/>
  </view>
</template>
<script setup>
import { ref, watch, nextTick, computed, onBeforeUnmount } from 'vue'
import { apiStaffSlots, apiStaffAddSlot, apiStaffCloseSlot, apiInterviewOffers, apiAddInterviewOffer, apiChooseInterviewOffer, apiRemoveInterviewOffer } from '@/common/api.js'
import { toast } from '@/common/screen.js'
import { todayCn,shiftDate } from '@/common/ui.js'
import { normalizeClock } from '@/common/manual-time.js'
import { formatTencentMeeting, tencentInputError, readCodeInput, readMeetingPaste, parseTencentMeeting, meetingSummary } from '@/common/meeting.js'
// canEdit：新增 / 关闭时段服务端要「岗位管理·编辑」（主理人、管家）。没有这项权限的角色只看时段列表，
// 不再显示必被拒绝的表单和「关闭」按钮；由页面按时段所属门店上的角色传入
const emit = defineEmits(['chosen','count','stage-changed'])
const props=defineProps({appId:{type:[Number,String],default:null},offerRole:{type:String,default:''},storeId:{type:[Number,String],default:null},canEdit:{type:Boolean,default:true},refreshKey:{type:Number,default:0}})
const choosing = computed(() => props.offerRole === 'merchant')
const staff = computed(() => props.offerRole !== 'candidate')
let active = true
onBeforeUnmount(() => { active = false; revision++ })
const dateOpen=ref(false),date=ref(shiftDate(todayCn(),1))
const capacity=ref('1')
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
async function load() {
  const version = ++revision
  rows.value = []
  error.value = ''
  if (!props.storeId && !props.appId) return
  loading.value = true
  if (props.appId) emit('count', null)
  try {
    const res = props.appId ? await apiInterviewOffers(props.appId,staff.value) : await apiStaffSlots(props.storeId)
    if (version !== revision) return
    rows.value = res.data || []
    if (props.appId) emit('count', rows.value.length)
  } catch (e) {
    if (version !== revision) return
    if (props.appId && Number(e?.code) === 409) {
      emit('stage-changed')
      return
    }
    error.value = e?.message || '加载失败'
  } finally { if (version === revision) loading.value = false }
}
watch(() => [props.storeId,props.appId,props.offerRole,props.refreshKey],load,{immediate:true})

async function save() {
  if (busy.value || !props.canEdit || choosing.value) return
  const from = normalizeClock(start.value), to = normalizeClock(end.value)
  if (!date.value || !from || !to) return toast('请输入有效时间，例如09:30或0930')
  if (to <= from) return toast('结束时间必须晚于开始时间')
  if (!/^[1-9]\d?$/.test(String(capacity.value))) return toast('每场可预约人数须为 1 至 99 的整数')
  start.value = from
  end.value = to
  fill()
  const invalid = (code.value || pwd.value || link.value) && tencentInputError(code.value,pwd.value,link.value)
  if (invalid) return toast(invalid)
  busy.value = true
  try {
    const data = {
      capacity: Number(capacity.value),
      startTime: date.value+' '+from+':00',
      endTime: date.value+' '+to+':00',
      meetingInfo: code.value || link.value ? formatTencentMeeting(code.value,pwd.value,note.value,link.value) : note.value.trim()
    }
    if (props.appId) await apiAddInterviewOffer(props.appId,staff.value,data)
    else await apiStaffAddSlot({...data,storeId:props.storeId})
    if (active) { toast('时段已添加'); await load() }
  } catch (e) { if (active) toast(e?.message || '保存失败') }
  finally { busy.value = false }
}

async function close(row) {
  if (busy.value || !props.canEdit) return
  busy.value = true
  try {
    const confirmed = await new Promise(resolve => uni.showModal({
      title: props.appId ? '撤回候选时段' : '关闭时段',
      content: props.appId ? '商家将不能选择这个时段。' : '关闭后不再接受新预约，已预约的面试照常进行。',
      success: r => resolve(r.confirm), fail: () => resolve(false)
    }))
    if (!active || !confirmed) return
    if (props.appId) await apiRemoveInterviewOffer(props.appId,staff.value,row.slotId)
    else await apiStaffCloseSlot(row.slotId,props.storeId)
    if (active) { toast(props.appId ? '已撤回' : '已关闭'); await load() }
  } catch (e) { if (active) { toast(e?.message || '关闭失败'); await load() } }
  finally { busy.value = false }
}

async function confirmOffer(row) {
  if (busy.value || !choosing.value) return
  const limit = row.bookingCapacity || row.capacity || 1
  if (!/^[1-9]\d?$/.test(String(limit)) || Number(limit) > (row.capacity || 1)) return toast('人数须在 1 至 ' + (row.capacity || 1) + ' 之间')
  busy.value = true
  try {
    const confirmed = await new Promise(resolve => uni.showModal({
      title: '确认面试时间', content: row.startTime + ' 至 ' + row.endTime + '（北京时间）',
      success: r => resolve(r.confirm), fail: () => resolve(false)
    }))
    if (!confirmed || !active) return
    await apiChooseInterviewOffer(props.appId,row.slotId,Number(limit))
    if (active) { toast('面试时间已确认'); emit('chosen') }
  } catch (e) { if (active) { toast(e?.message || '确认失败'); await load() } }
  finally { if (active) busy.value = false }
}
</script>
<style scoped>
.slot-editor{padding:16px 16px 96px;display:flex;flex-direction:column;gap:16px;font-size:14px;line-height:1.7}.slot-note{color:var(--k-muted)}.slot-field{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--k-line2);min-height:48px}.slot-field picker{flex:1;text-align:right;padding:12px 0}.slot-field input{flex:1;min-width:0;height:48px;text-align:right}.slot-row{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--k-line2);padding:12px 0}.slot-row>view{flex:1;display:flex;flex-direction:column;overflow-wrap:anywhere}.slot-meet{color:var(--k-muted);font-size:13px;white-space:pre-wrap}.slot-paste{display:flex;flex-direction:column;gap:6px}.slot-paste input{height:44px;padding:0 12px;border:1px solid var(--k-line2);border-radius:12px;background:var(--k-paper)}.paste-ok{color:var(--k-green);font-size:13px}.paste-bad{color:var(--k-alert);font-size:13px}
.slot-date{flex:1;display:flex;align-items:center;justify-content:flex-end;gap:8px;background:transparent;margin:0;padding:10px 0;font-size:15px;color:var(--k-ink);line-height:26px}.slot-date:after{border:0}.slot-clock{font-variant-numeric:tabular-nums}
.slot-editor--offer{padding:8px 0 20px;gap:10px}.slot-editor--offer .slot-row>view{min-width:0}
</style>
