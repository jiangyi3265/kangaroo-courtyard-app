<template>
 <view class="k-page" :class="$userSurface"><k-topbar title="消息提醒" back/><view class="k-body landing">
  <text v-if="loading" class="loading">正在核对消息权限…</text>
  <view v-else-if="message" class="msg-card"><text class="title">{{message.title}}</text><text class="body">{{message.content}}</text><k-button v-if="message.route" block :disabled="opening" @click="open">查看并处理</k-button></view>
  <view v-else class="msg-state">
    <view class="msg-state__ico"><k-icon name="link-2" :size="32" color="red" /></view>
    <text class="body">{{experience.account ? (error || '暂时无法读取这条提醒') : '请登录后查看收到的提醒'}}</text>
    <k-button v-if="!experience.account" @click="login">去登录</k-button>
    <template v-else>
      <k-button block @click="load">重新读取</k-button>
      <template v-if="mode==='staff' && staffIdentities.length"><text class="body">可选择你已有的工作身份重新核对：</text><k-button v-for="grant in staffIdentities" :key="staffGrantKey(grant)" type="secondary" block @click="choose(grant)">{{staffIdentityLabel(grant)}}</k-button></template>
    </template>
  </view>
  <k-subscribe label="订阅后续微信提醒"/>
 </view></view>
</template>
<script setup>
import {ref,watch,onUnmounted} from 'vue'
import {onLoad,onShow,onHide} from '@dcloudio/uni-app'
import {apiSubscriptionMessage,apiMarkRead} from '@/common/api.js'
import {experience,ensureSession,refreshAccount,switchMode,setStaffStore,staffStores,staffIdentities,staffIdentityLabel,staffGrantKey,getSessionRevision,getMessageScopeKey} from '@/common/experience.js'
import {staffIdentityForMessageScope} from '@/common/staff-identities.js'
import {go} from '@/common/screen.js'
const loading=ref(false),opening=ref(false),message=ref(null),error=ref(''),mode=ref('user')
let id='',sequence=0,initialScope='',requestScope=null
onLoad(q=>{id=String(q?.id||'');mode.value=q?.mode==='staff'?'staff':'user';initialScope=String(q?.scope||'')})
const load=async()=>{
 const n=++sequence
 requestScope=null
 loading.value=true
 opening.value=false
 message.value=null
 error.value=''
 try{
  await ensureSession();const session=getSessionRevision()
  if(!experience.account||n!==sequence)return
  if(!/^\d+$/.test(id))throw new Error('消息链接不完整')
  if(initialScope&&mode.value==='staff'){
   // 通知可能来自刚交接的城市，先获取最新授权，避免旧快照把有效身份误判为失效。
   await refreshAccount()
   if(n!==sequence||session!==getSessionRevision())return
   const grant=staffIdentityForMessageScope(staffStores.value,initialScope)
   if(!grant)throw new Error('该提醒对应的工作身份已失效，请重新选择')
   setStaffStore(grant)
   initialScope=''
  }
  if(experience.mode!==mode.value)switchMode(mode.value)
  requestScope=getMessageScopeKey()
  const r=await apiSubscriptionMessage(id,mode.value)
  if(n===sequence&&session===getSessionRevision()&&requestScope===getMessageScopeKey())message.value=r.data
 }catch(e){if(n===sequence)error.value=e?.message||'当前身份无法查看这条消息'}
 finally{if(n===sequence)loading.value=false}
}
const invalidate = () => {
 sequence++
 requestScope=null
 loading.value=false
 opening.value=false
 message.value=null
 error.value=''
}
watch(getMessageScopeKey, scope => {
 if(requestScope!==null&&requestScope!==scope) {
  invalidate()
  error.value='当前身份已变化，请重新读取提醒'
 }
}, {flush:'sync'})
onHide(invalidate)
onUnmounted(invalidate)
onShow(load)
const choose=grant=>{initialScope='';setStaffStore(grant);load()}
const login=()=>uni.navigateTo({url:'/pages/auth/login'})
const open=async()=>{
 const route=message.value?.route, n=sequence
 if(!route||opening.value||requestScope!==getMessageScopeKey())return
 opening.value=true
 try {
  await apiMarkRead(id)
  if(n===sequence&&requestScope===getMessageScopeKey())go(route)
 } catch(e) {
  if(n===sequence)uni.showToast({title:e?.message||'暂时无法打开',icon:'none'})
 } finally {
  if(n===sequence)opening.value=false
 }
}
</script>
<style scoped>.landing{padding:22px 18px}.title{display:block;font-size:22px;font-weight:600}.body{display:block;white-space:pre-wrap;line-height:1.8;margin:20px 0}.landing :deep(.k-button){margin:10px 0}
/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底，消息正文放进一张白卡（12 圆角），标题收到 17。功能和文字不变 */
.k-page{--k-bg:var(--k-page);--k-radius:12px;background:var(--k-page)}
.k-page :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.landing{padding:12px}
.title{padding:4px 2px 0;font-size:17px;font-weight:700;line-height:1.45}
.body{margin:10px 0;padding:12px;border-radius:12px;background:var(--k-paper);font-size:14px;line-height:1.75}
.landing :deep(.k-button.is-lg){height:44px;font-size:15px;box-shadow:none}
.landing :deep(.k-button){border-radius:999px}
.landing :deep(.k-button.is-secondary){color:var(--k-red-deep)}
/* 2026-11-18 评审修正：「订阅后续微信提醒」那条自带左右 12 的留白，放在本页已有 12 页边距的正文里就比上面的白卡窄一圈；这里去掉，两张卡左右对齐、上下相隔 8 */
.landing :deep(.subscribe-entry){padding:0}
.body{margin-bottom:8px}
/* 11-18 第二轮精修（只动样子；不可点的按钮交给公共组件整体变淡 .45）
   1) 有消息：标题和正文放进同一张白卡（标题 16 / 600 在卡里），「查看并处理」在卡底 */
.landing :deep(.k-button){margin:8px 0}
.msg-card{margin-bottom:8px;padding:12px;border-radius:12px;background:var(--k-paper)}
.msg-card .title{padding:0;font-size:16px;font-weight:600}
.msg-card .body{margin:8px 0 12px;padding:0;border-radius:0;background:transparent}
.msg-card :deep(.k-button){margin:0}
/* 2) 没有消息 / 未登录 / 出错：白卡里居中的空状态，说明 14 / 500 二级墨；「去登录」是 32 高的次按钮小胶囊；选工作身份的按钮仍是整行次按钮 */
.msg-state{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:8px;padding:28px 12px;border-radius:12px;background:var(--k-paper);text-align:center}
.msg-state .body{margin:0;padding:0;border-radius:0;background:transparent;font-size:14px;font-weight:500;line-height:1.6;color:var(--k-ink2)}
.msg-state :deep(.k-button){margin:0}
/*    「去登录」原来 48 高：看着 32，上下各 6 的透明边，点按高度仍是 44 */
.msg-state :deep(.k-button.is-primary){height:44px;padding:0 16px;border:6px solid transparent;border-radius:22px;background:var(--k-paper) padding-box;box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-size:13px;font-weight:500}
/* 11-18 第三轮：页边距 16；消息卡标题 16 / 600、正文 14 二级墨行高 1.7；没有消息 / 链接不完整 / 未登录：白卡居中，56 浅棕方块 + 32 号线性图标，说明 14 / 500；读取中居中小字 */
.landing{padding:12px 16px}
.msg-card{padding:16px 12px 12px}
.msg-card .body{color:var(--k-ink2);line-height:1.7}
.msg-state{gap:0;padding:32px 16px 28px}
.msg-state__ico{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-bottom:12px;border-radius:16px;background:var(--k-red-soft)}
.msg-state :deep(.k-button){margin-top:12px}
.loading{display:block;padding:40px 0;text-align:center;font-size:12px;color:var(--k-muted)}
/* 11-18 返修（第 2 轮）：消息卡头轻脚重 —— 标题到正文 8、正文 14 / 400 二级墨行高 1.6；「查看并处理」40 高实心暖棕（不用渐变），离正文 16 */
.msg-card .title + .body{margin:8px 0 0;padding:0;background:transparent;font-size:14px;font-weight:400;line-height:1.6;color:var(--k-ink2)}
.msg-card :deep(.k-button.is-lg){height:40px;margin:16px 0 0;background:var(--k-red);font-size:14px;font-weight:600}
/* 11-18 第三轮返修（第 3 轮）：「查看并处理」和本组钱包、邀请、成为商家的主按钮同一种 —— 44 高暖棕渐变胶囊、白字 15 / 600 */
.msg-card :deep(.k-button.is-lg){height:44px;border-radius:22px;background:var(--k-grad-brown);font-size:15px}
.msg-card,.msg-state{margin-bottom:20px}
/* 11-18 第三轮返修（第 4 轮）：正文最后一行别只剩两三个字（text-wrap: pretty，小程序不认时照旧） */
.msg-card .body{text-wrap:pretty}
/* 11-18 第三轮返修（第 5 轮）：「链接不完整」这类只有一句话的状态卡上下 24，下半截不再空着 */
.msg-state{padding:24px 16px}
/* 11-18 第四轮（全端统一）：「链接不完整」等整页状态不套卡，直接放在浅灰底上、离顶栏约 96；下面的订阅入口做成一行 12 号暖棕文字链接跟在状态块下面 */
.msg-state{margin-top:84px;margin-bottom:16px;padding:0 16px;border-radius:0;background:transparent}
.landing :deep(.subscribe-entry button){min-height:32px;background:transparent}
/* 11-19 微信实拍返修：整页状态离顶栏 88（和团队报表、积分商城统一）；下面的「订阅后续微信提醒 ›」和出错句隔 32、中间一道 64 宽居中发丝线，读着不再像这条错误的处理按钮 */
.msg-state{position:relative;margin-top:88px;margin-bottom:32px}
.msg-state::after{content:"";position:absolute;left:50%;bottom:-16px;width:64px;height:1px;margin-left:-32px;background:var(--k-line2);transform:scaleY(.5)}
</style>
