<template>
  <view class="k-page member-wallet">
    <k-topbar title="我的会员权益" back />
    <k-subscribe scenes="member,governance_case" label="订阅权益处理提醒" />
    <view class="wallet-body">
      <button class="outline" @click="go('/pages/profile/benefits')">查看等级权益与合作店优惠</button>
      <button class="outline" @click="go('/pages/profile/point-mall')">积分商城 · 商品兑换与记录</button>
      <view class="wallet-hero"><text class="eyebrow">{{ wallet.year || '本年度' }} · 旅途里的小礼物</text><view class="balance"><text>{{ wallet.balance ?? '—' }}</text><text class="muted">可用积分</text></view><text class="muted">已用或占用免费间夜 {{ wallet.usedNights || 0 }}/20 晚</text><button class="primary" :disabled="busy||loading" @click="act('claim',{})">领取本年度等级权益</button><text class="hint">升级补足差额，重复领取不会多发。积分兑换不降低等级。</text></view>
      <view v-if="error" class="notice"><text>{{ error }}</text><button @click="load">重新加载</button></view>
      <view v-if="feedback" class="notice success">{{ feedback }}</view>
      <view class="tabs"><button v-for="t in tabs" :key="t.key" :class="{on:tab===t.key}" @click="tab=t.key">{{ t.text }}</button></view>
      <template v-if="tab==='wallet'">
        <view class="section-head"><text>可用权益</text><button @click="showHistory=!showHistory">{{ showHistory?'只看可用':'全部记录' }}</button></view>
        <text v-if="!shown.length&&!loading" class="empty">暂无{{showHistory?'':'可用'}}权益，达到等级后可领取，也可以使用积分兑换间夜。</text>
        <view v-for="item in shown" :key="item.walletId" class="voucher"><view class="voucher-top"><text class="voucher-name">{{ item.label }}<text v-if="item.amountFen"> ¥{{ (item.amountFen/100).toFixed(2) }}</text></text><text class="state">{{ state(item.status) }}</text></view><text class="muted">{{ source(item.source) }} · {{ String(item.expiresAt).slice(0,10) }} 前使用</text><view v-if="item.status==='available'" class="actions"><button v-if="item.benefitCode.startsWith('night') && stayBookingEnabled" class="outline" @click="go('/pages/stays/list')">选房使用</button><button v-else-if="item.benefitCode==='activity'" class="outline" @click="go('/pages/community/activity')">选择活动</button><button v-else-if="!item.benefitCode.startsWith('night')" class="outline" @click="startRequest(item)">申请使用</button><button v-if="item.source==='points'" :disabled="busy" @click="act('undo/'+item.walletId,{})">撤销兑换</button><button v-if="wallet.level>=5&&item.benefitCode.startsWith('night')&&item.source!=='gift'" :class="{on:giftIds.includes(item.walletId)}" @click="toggleGift(item.walletId)">{{ giftIds.includes(item.walletId)?'已选转赠':'选择转赠' }}</button></view></view>
        <view v-if="giftIds.length" class="panel"><text class="title">转赠 {{ giftIds.length }} 晚给亲友</text><text class="hint">每年仅可转赠一次，最多3晚。请先核对对方会员账号ID，提交后会转入对方账户。</text><input v-model="recipient" type="number" maxlength="18" placeholder="对方会员账号ID"/><button class="primary" :disabled="busy" @click="gift">确认转赠</button></view>
        <view v-if="wallet.level>=1" class="panel"><text class="title">会员服务</text><text class="hint">提交需求后由平台处理，结果在使用记录中查看。</text><view class="actions"><button class="outline" @click="startRequest({serviceType:'recommend',label:'优先推荐'})">申请优先推荐</button><button v-if="wallet.level>=4 && stayBookingEnabled" class="outline" @click="startRequest({serviceType:'booking',label:'优先预订'})">申请优先预订</button><button v-if="wallet.level>=5" class="outline" @click="startRequest(null)">联系专属服务</button></view></view>
      </template>
      <template v-if="tab==='exchange'">
        <text class="section-head">积分兑换免费间夜</text><view v-for="room in rooms" :key="room.code" class="exchange"><view><text class="title">{{ room.name }} · 1晚</text><text class="hint">{{ room.points }} 积分 / 晚</text></view><button class="outline" :disabled="busy||wallet.balance<room.points" @click="redeem(room)">兑换一晚</button></view><view class="notice">限本人入住，法定节假日不可用；等级赠送与积分兑换可以合并。每年免费入住总计最多20晚，当年12月31日到期。</view>
      </template>
      <template v-if="tab==='requests'">
        <text v-if="!wallet.requests?.length" class="empty">还没有使用申请</text><view v-for="r in wallet.requests||[]" :key="r.requestId" class="panel"><view class="voucher-top"><text class="title">申请 #{{ r.requestId }}</text><text class="state">{{ state(r.status) }}</text></view><text class="copy">{{ r.content }}</text><text v-if="r.reviewNote" class="notice">平台回复：{{ r.reviewNote }}</text><button v-if="r.status==='pending'" :disabled="busy" @click="act('cancel/'+r.requestId,{})">撤回申请</button></view>
      </template>
      <template v-if="tab==='community'">
        <view class="panel"><text class="title">我的社区置顶</text><text class="hint">本周已用 {{ pins.used||0 }}/{{ pins.quota||0 }} 次 · 每次2小时</text><text v-for="p in pins.active||[]" :key="p.postId" class="notice">帖子 #{{ p.postId }} 置顶至 {{ p.endsAt }}</text><view v-for="p in pins.posts||[]" :key="p.postId" class="post"><text>{{ p.title || p.content || '我的动态' }}</text><button :disabled="busy||pins.used>=pins.quota||!!pins.active?.length" class="outline" @click="pin(p.postId)">置顶</button></view><text v-if="!pins.posts?.length" class="hint">发布动态后可在这里使用置顶权益。</text></view>
      </template>
      <view v-for="c in cases" :key="c.caseId" class="panel"><text class="title">会员规则通知 · {{ state(c.status) }}</text><text class="copy">{{ c.facts }}</text><text class="hint">申诉截止：{{ c.appealDeadline }}</text><text v-if="c.response" class="notice">复核结果：{{ c.response }}</text><text v-if="c.appeal" class="hint">已提交申诉：{{ c.appeal }}</text><template v-if="c.status==='notified'"><textarea v-model="appeals[c.caseId]" maxlength="500" placeholder="如有异议，请填写申诉依据"/><button :disabled="busy" @click="act('appeal/'+c.caseId,{note:appeals[c.caseId]||''})">提交申诉</button></template></view>
      <view v-if="requesting" class="panel request-form"><text class="title">{{ requestItem?.label || '专属服务' }}</text><text class="hint">说明使用需求；邮寄实物请填写收件信息。补贴填写出游订单及收款说明，请勿填写密码或验证码。</text><textarea v-model="content" maxlength="1000" placeholder="填写使用说明（2至1000字）"/><view class="actions"><button :disabled="busy" @click="requesting=false">取消</button><button class="primary" :disabled="busy" @click="submitRequest">提交申请</button></view></view>
      <text v-if="loading" class="empty">正在读取会员权益…</text>
    </view>
  </view>
</template>
<script setup>
import { stayBookingEnabled } from '@/common/features.js'
import {ref,computed,nextTick} from 'vue'
import {onShow,onLoad} from '@dcloudio/uni-app'
import {apiMemberWallet,apiMemberAction,apiMemberPins,apiMemberCases} from '@/common/api.js'
import {go} from '@/common/screen.js'
const wallet=ref({rows:[],requests:[]}),pins=ref({}),cases=ref([]),appeals=ref({}),loading=ref(false),busy=ref(false),error=ref(''),feedback=ref(''),tab=ref('wallet'),showHistory=ref(false),requesting=ref(false),requestItem=ref(null),content=ref(''),giftIds=ref([]),recipient=ref('')
const tabs=[{key:'wallet',text:'我的权益'},{key:'exchange',text:'积分兑换'},{key:'requests',text:'使用记录'},{key:'community',text:'社区权益'}]
const rooms=[{code:'night4',name:'四人间',points:60},{code:'night2',name:'双人间',points:90},{code:'night1',name:'单人间',points:120}]
const shown=computed(()=>(wallet.value.rows||[]).filter(x=>showHistory.value||x.status==='available'))
const state=s=>({available:'可使用',reserved:'已占用',redeemed:'已核销',expired:'已到期',pending:'待处理',completed:'已履约',rejected:'已驳回',cancelled:'已撤销',notified:'申诉期内',appealed:'待复核',executed:'已执行'}[s]||s)
const source=s=>({level:'等级赠送',points:'积分兑换',gift:'亲友转赠'}[s]||s)
const key=()=>Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10)
// Retain a command key after a network error so retrying cannot issue twice.
const commands={};function commandKey(name){return commands[name]||(commands[name]=key())}
async function load(){if(loading.value)return;loading.value=true;error.value='';const result=await Promise.allSettled([apiMemberWallet(),apiMemberPins(),apiMemberCases()]);if(result[0].status==='fulfilled')wallet.value=result[0].value.data;else error.value=result[0].reason?.message||'会员权益读取失败';if(result[1].status==='fulfilled')pins.value=result[1].value.data;if(result[2].status==='fulfilled')cases.value=result[2].value.data||[];loading.value=false}
async function act(action,data){if(busy.value)return false;busy.value=true;error.value='';feedback.value='';try{await apiMemberAction(action,data);feedback.value='操作成功，权益记录已更新';await load();return true}catch(e){error.value=e.message||'提交失败，请重试';return false}finally{busy.value=false}}
async function redeem(r){const c='redeem_'+r.code;if(await act('redeem',{roomCode:r.code,nights:1,requestId:commandKey(c)}))delete commands[c]}
function toggleGift(id){if(giftIds.value.includes(id))giftIds.value=giftIds.value.filter(x=>x!==id);else if(giftIds.value.length<3)giftIds.value.push(id);else error.value='每年最多转赠3晚'}
async function gift(){if(!/^[1-9]\d*$/.test(recipient.value)){error.value='请填写对方会员账号ID';return}if(await act('gift',{recipientId:Number(recipient.value),walletIds:giftIds.value})){giftIds.value=[];recipient.value=''}}
async function startRequest(item){requestItem.value=item;content.value='';requesting.value=true;await nextTick();uni.pageScrollTo({selector:'.request-form',duration:200})}
async function submitRequest(){if(content.value.trim().length<2){error.value='请填写使用说明';return}const c='request_'+(requestItem.value?.walletId||requestItem.value?.serviceType||'support');if(await act('request',{walletId:requestItem.value?.walletId||null,serviceType:requestItem.value?.serviceType||'support',content:content.value,requestId:commandKey(c)})){delete commands[c];requesting.value=false;tab.value='requests'}}
async function pin(postId){const c='pin_'+postId;if(await act('pin',{postId,requestId:commandKey(c)}))delete commands[c]}
onLoad(q=>{if(tabs.some(t=>t.key===q.tab))tab.value=q.tab})
onShow(load)
</script>
<style scoped>
.wallet-body{padding:16px 16px calc(28px + env(safe-area-inset-bottom));color:#493c30}.wallet-hero{padding:22px;border-radius:20px;background:linear-gradient(130deg,#f5e7d1,#fffaf0);border:1px solid #ead7bb}.eyebrow{font-size:12px;color:#8c6742}.balance{display:flex;gap:12px;align-items:baseline;margin:12px 0}.balance>text:first-child{font-size:38px;font-weight:600}.muted{font-size:12px;color:#8b8174}.hint{display:block;font-size:12px;color:#897f73;line-height:1.65;margin:8px 0}.primary{background:#9a6a38!important;color:#fff!important;border-color:#9a6a38!important}.wallet-hero>.primary{margin:18px 0 8px}.tabs{display:flex;gap:4px;margin:22px 0 16px}.tabs button{flex:1;font-size:12px;padding:10px 1px;border:0}.tabs button.on{background:#f0dfc6;color:#80522e}.section-head{display:flex;align-items:center;justify-content:space-between;margin:20px 0 12px;font-size:17px;font-weight:600}.section-head button{font-size:12px;font-weight:400}.voucher,.panel,.exchange{padding:16px;background:#fffdf9;border:1px solid #e9e0d5;border-radius:16px;margin:12px 0}.voucher-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:9px}.voucher-name,.title{font-size:15px;font-weight:600;line-height:1.5}.state{font-size:11px;color:#987443;white-space:nowrap}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px}.actions button{margin:0}.outline{border:1px solid #bea17b!important;color:#885d31!important}.notice{padding:12px;margin:12px 0;display:block;background:#f5eee4;border-radius:12px;font-size:12px;line-height:1.8}.success{color:#4e7047}.empty{display:block;padding:24px 10px;text-align:center;font-size:13px;line-height:1.8;color:#8b8174}.exchange{display:flex;align-items:center;justify-content:space-between;gap:12px}.copy{display:block;margin:10px 0;font-size:14px;line-height:1.8;white-space:pre-wrap}.post{display:flex;gap:12px;align-items:center;border-top:1px solid #eee4d7;padding:14px 0}.post>text{flex:1;font-size:13px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}button{font-size:13px;line-height:1.5;padding:9px 12px;background:transparent;color:#87633d;border:1px solid transparent;border-radius:12px;margin:0}button::after{border:0}button[disabled]{opacity:.45}input,textarea{box-sizing:border-box;padding:12px;border:1px solid #e0d7c8;background:#fff;width:100%;border-radius:10px;font-size:14px;margin:12px 0}input{height:46px}textarea{height:128px}.on{color:#775125;background:#efdfc8}
</style>
