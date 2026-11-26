<template>
  <view class="k-page member-wallet" :class="$userSurface">
    <k-topbar title="我的会员权益" back />
    <!-- 11-18 第三轮：一进来先看到积分和「领取」（暖色主卡放第一位），下面是下划线页签和内容；
         「查看等级权益」「积分商城」两条入口合成一张带发丝线的卡、订阅提醒条，一起挪到页尾 -->
    <view class="wallet-body">
      <view class="wallet-hero"><text class="eyebrow">{{ wallet.year || '本年度' }} · 旅途里的小礼物</text><view class="balance"><text>{{ wallet.balance ?? '—' }}</text><text class="muted">可用积分</text></view><text class="muted">已用或占用免费间夜 {{ wallet.usedNights || 0 }}/20 晚</text><button class="primary" :disabled="busy||loading" @click="act('claim',{})">领取本年度等级权益</button><text class="hint">升级补足差额，重复领取不会多发。积分兑换不降低等级。</text></view>
      <view v-if="error" class="notice"><text>{{ error }}</text><button @click="load">重新加载</button></view>
      <view v-if="feedback" class="notice success">{{ feedback }}</view>
      <view class="tabs"><button v-for="t in tabs" :key="t.key" :class="{on:tab===t.key}" @click="tab=t.key">{{ t.text }}</button></view>
      <template v-if="tab==='wallet'">
        <view class="section-head"><text>可用权益</text><button class="section-head__more" @click="showHistory=!showHistory">{{ showHistory?'只看可用':'全部记录' }}<k-icon name="chevron-right" :size="12" color="muted" /></button></view>
        <view v-if="!shown.length&&!loading" class="empty empty--card"><view class="empty__ico"><k-icon name="ticket" :size="32" color="red" /></view><text class="empty__title">暂无{{showHistory?'':'可用'}}权益，</text><text>达到等级后可领取，也可以使用积分兑换间夜。</text></view>
        <view v-for="item in shown" :key="item.walletId" class="voucher"><view class="voucher-top"><text class="voucher-name">{{ item.label }}<text v-if="item.amountFen"> ¥{{ (item.amountFen/100).toFixed(2) }}</text></text><text class="state">{{ state(item.status) }}</text></view><text class="muted">{{ source(item.source) }} · {{ String(item.expiresAt).slice(0,10) }} 前使用</text><view v-if="item.status==='available'" class="actions"><button v-if="item.benefitCode.startsWith('night') && stayBookingEnabled" class="outline" @click="go('/pages/stays/list')">选房使用</button><button v-else-if="item.benefitCode==='activity'" class="outline" @click="go('/pages/community/activity')">选择活动</button><button v-else-if="!item.benefitCode.startsWith('night')" class="outline" @click="startRequest(item)">申请使用</button><button v-if="item.source==='points'" :disabled="busy" @click="act('undo/'+item.walletId,{})">撤销兑换</button><button v-if="wallet.level>=5&&item.benefitCode.startsWith('night')&&item.source!=='gift'" :class="{on:giftIds.includes(item.walletId)}" @click="toggleGift(item.walletId)">{{ giftIds.includes(item.walletId)?'已选转赠':'选择转赠' }}</button></view></view>
        <view v-if="giftIds.length" class="panel"><text class="title">转赠 {{ giftIds.length }} 晚给亲友</text><text class="hint">每年仅可转赠一次，最多3晚。请先核对对方会员账号ID，提交后会转入对方账户。</text><input v-model="recipient" type="number" maxlength="18" placeholder="对方会员账号ID"/><button class="primary" :disabled="busy" @click="gift">确认转赠</button></view>
        <view v-if="wallet.level>=1" class="panel"><text class="title">会员服务</text><text class="hint">提交需求后由平台处理，结果在使用记录中查看。</text><view class="actions actions--svc"><button class="outline" @click="startRequest({serviceType:'recommend',label:'优先推荐'})">申请优先推荐</button><button v-if="wallet.level>=4 && stayBookingEnabled" class="outline" @click="startRequest({serviceType:'booking',label:'优先预订'})">申请优先预订</button><button v-if="wallet.level>=5" class="outline" @click="startRequest(null)">联系专属服务</button></view></view>
      </template>
      <template v-if="tab==='exchange'">
        <text class="section-head">积分兑换免费间夜</text><view class="exchange-card"><view v-for="room in rooms" :key="room.code" class="exchange"><view><text class="title">{{ room.name }} · 1晚</text><text class="hint">{{ room.points }} 积分 / 晚</text></view><button class="outline" :disabled="busy||wallet.balance<room.points" @click="redeem(room)">兑换一晚</button></view></view><view class="notice">限本人入住，法定节假日不可用；等级赠送与积分兑换可以合并。每年免费入住总计最多20晚，当年12月31日到期。</view>
      </template>
      <template v-if="tab==='requests'">
        <view v-if="!wallet.requests?.length" class="empty empty--card"><view class="empty__ico"><k-icon name="clipboard-list" :size="32" color="red" /></view><text>还没有使用申请</text></view><view v-for="r in wallet.requests||[]" :key="r.requestId" class="panel"><view class="voucher-top"><text class="title">申请 #{{ r.requestId }}</text><text class="state">{{ state(r.status) }}</text></view><text class="copy">{{ r.content }}</text><text v-if="r.reviewNote" class="notice">平台回复：{{ r.reviewNote }}</text><button v-if="r.status==='pending'" :disabled="busy" @click="act('cancel/'+r.requestId,{})">撤回申请</button></view>
      </template>
      <template v-if="tab==='community'">
        <view class="panel"><text class="title">我的社区置顶</text><text class="hint">本周已用 {{ pins.used||0 }}/{{ pins.quota||0 }} 次 · 每次2小时</text><text v-for="p in pins.active||[]" :key="p.postId" class="notice">帖子 #{{ p.postId }} 置顶至 {{ p.endsAt }}</text><view v-for="p in pins.posts||[]" :key="p.postId" class="post"><text>{{ p.title || p.content || '我的动态' }}</text><button :disabled="busy||pins.used>=pins.quota||!!pins.active?.length" class="outline" @click="pin(p.postId)">置顶</button></view><text v-if="!pins.posts?.length" class="hint">发布动态后可在这里使用置顶权益。</text></view>
      </template>
      <view v-for="c in cases" :key="c.caseId" class="panel"><text class="title">会员规则通知 · {{ state(c.status) }}</text><text class="copy">{{ c.facts }}</text><text class="hint">申诉截止：{{ c.appealDeadline }}</text><text v-if="c.response" class="notice">复核结果：{{ c.response }}</text><text v-if="c.appeal" class="hint">已提交申诉：{{ c.appeal }}</text><template v-if="c.status==='notified'"><textarea v-model="appeals[c.caseId]" maxlength="500" placeholder="如有异议，请填写申诉依据"/><button :disabled="busy" @click="act('appeal/'+c.caseId,{note:appeals[c.caseId]||''})">提交申诉</button></template></view>
      <view v-if="requesting" class="panel request-form"><text class="title">{{ requestItem?.label || '专属服务' }}</text><text class="hint">说明使用需求；邮寄实物请填写收件信息。补贴填写出游订单及收款说明，请勿填写密码或验证码。</text><textarea v-model="content" maxlength="1000" placeholder="填写使用说明（2至1000字）"/><view class="actions"><button :disabled="busy" @click="requesting=false">取消</button><button class="primary" :disabled="busy" @click="submitRequest">提交申请</button></view></view>
      <text v-if="loading" class="empty">正在读取会员权益…</text>
      <view class="wallet-links">
        <button class="outline" @click="go('/pages/profile/benefits')"><text class="link-label">查看等级权益与合作店优惠</text><k-icon name="chevron-right" :size="12" color="muted" /></button>
        <button class="outline" @click="go('/pages/profile/point-mall')"><text class="link-label">积分商城</text><text class="link-hint">商品兑换与记录</text><k-icon name="chevron-right" :size="12" color="muted" /></button>
      </view>
      <k-subscribe scenes="member,governance_case" label="订阅权益处理提醒" />
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
.wallet-body{padding:16px 16px calc(28px + env(safe-area-inset-bottom));color:#493c30}.wallet-hero{padding:22px;border-radius:20px;background:linear-gradient(130deg,#f5e7d1,#fffaf0);border:1px solid #ead7bb}.eyebrow{font-size:12px;color:#8c6742}.balance{display:flex;gap:12px;align-items:baseline;margin:12px 0}.balance>text:first-child{font-size:38px;font-weight:600}.muted{font-size:12px;color:#8b8174}.hint{display:block;font-size:12px;color:#897f73;line-height:1.65;margin:8px 0}.primary{background:#9a6a38!important;color:var(--k-paper)!important;border-color:#9a6a38!important}.wallet-hero>.primary{margin:18px 0 8px}.tabs{display:flex;gap:4px;margin:22px 0 16px}.tabs button{flex:1;font-size:12px;padding:10px 1px;border:0}.tabs button.on{background:#f0dfc6;color:#80522e}.section-head{display:flex;align-items:center;justify-content:space-between;margin:20px 0 12px;font-size:17px;font-weight:600}.section-head button{font-size:12px;font-weight:400}.voucher,.panel,.exchange{padding:16px;background:#fffdf9;border:1px solid #e9e0d5;border-radius:16px;margin:12px 0}.voucher-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:9px}.voucher-name,.title{font-size:15px;font-weight:600;line-height:1.5}.state{font-size:11px;color:#987443;white-space:nowrap}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px}.actions button{margin:0}.outline{border:1px solid #bea17b!important;color:#885d31!important}.notice{padding:12px;margin:12px 0;display:block;background:#f5eee4;border-radius:12px;font-size:12px;line-height:1.8}.success{color:#4e7047}.empty{display:block;padding:24px 10px;text-align:center;font-size:13px;line-height:1.8;color:#8b8174}.exchange{display:flex;align-items:center;justify-content:space-between;gap:12px}.copy{display:block;margin:10px 0;font-size:14px;line-height:1.8;white-space:pre-wrap}.post{display:flex;gap:12px;align-items:center;border-top:1px solid #eee4d7;padding:14px 0}.post>text{flex:1;font-size:13px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}button{font-size:13px;line-height:1.5;padding:9px 12px;background:transparent;color:#87633d;border:1px solid transparent;border-radius:12px;margin:0}button::after{border:0}button[disabled]{opacity:.45}input,textarea{box-sizing:border-box;padding:12px;border:1px solid #e0d7c8;background:var(--k-paper);width:100%;border-radius:10px;font-size:14px;margin:12px 0}input{height:46px}textarea{height:128px}.on{color:#775125;background:#efdfc8}
/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底、白卡 12 圆角、不描边不加阴影；顶部两个入口做成白色细行，积分卡和首屏会员条同一组暖色；
   页签是灰底里的白色小块；按钮收成小胶囊（12 字、上下各留 9，点按高度保持 36）。功能和文字不变：领取权益、四个页签、选房 / 申请 / 撤销 / 转赠、兑换、置顶、申诉都在；输入框 44 高、字 14。 */
.member-wallet{--k-bg:var(--k-page);background:var(--k-page)}
.member-wallet :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.wallet-body{padding:8px 12px calc(28px + env(safe-area-inset-bottom));color:var(--k-ink)}
button{padding:9px 12px;border-radius:999px;font-size:12px;color:var(--k-red-deep)}
.outline{border:1px solid var(--k-red-line)!important;color:var(--k-red-deep)!important}
.primary{border-color:transparent!important;background:linear-gradient(135deg,#B5814D,#8E5E33)!important}
.on{color:var(--k-red-deep);background:var(--k-red-soft)}
.wallet-body>.outline{position:relative;display:flex;align-items:center;min-height:48px;margin-bottom:8px;padding:0 32px 0 12px;border:0!important;border-radius:12px;background:var(--k-paper);color:var(--k-ink)!important;font-size:14px;text-align:left}
.wallet-body>.outline::after{content:"";position:absolute;left:auto;right:14px;top:50%;width:7px;height:7px;margin-top:-4px;border:solid var(--k-light);border-width:1.5px 1.5px 0 0;border-radius:0;transform:rotate(45deg);transform-origin:center;box-sizing:border-box}
.wallet-hero{padding:14px 12px 10px;border:0;border-radius:12px;background:linear-gradient(105deg,#FAEBD0,#F0D8AC)}
.eyebrow{font-size:11px;color:#8A6A35}
.balance{gap:8px;margin:6px 0 2px}
.balance>text:first-child{font-size:28px;font-weight:700;line-height:1.2;color:#5E3D1F}
.wallet-hero .muted,.wallet-hero .hint{color:var(--k-red-deep)}
.wallet-hero>.primary{display:flex;align-items:center;justify-content:center;min-height:40px;margin:12px 0 6px;font-size:14px;font-weight:600}
.muted{color:var(--k-muted)}
.hint{margin:6px 0;font-size:11px;line-height:1.6;color:var(--k-muted)}
.notice{margin:8px 0;padding:10px 12px;background:#FFF8EE;line-height:1.7;color:var(--k-ink2)}
.success{color:var(--k-green)}
.tabs{margin:12px 0 8px;padding:3px;border-radius:10px;background:#EFEBE5}
.tabs button{padding:9px 1px;border-radius:8px;color:var(--k-ink2)}
.tabs button.on{background:var(--k-paper);color:var(--k-red-deep);font-weight:600}
.section-head{margin:14px 2px 8px;font-size:15px;font-weight:700}
.voucher,.panel,.exchange{margin:8px 0;padding:12px;border:0;border-radius:12px;background:var(--k-paper)}
.voucher-top{margin-bottom:4px}
.voucher-name,.title{font-size:14px}
.state{padding:0 6px;border-radius:4px;background:var(--k-ochre-soft);color:var(--k-ochre-deep);font-weight:500;line-height:18px}
.actions{margin-top:10px}
.copy{margin:6px 0;font-size:13px;line-height:1.7}
.post{padding:10px 0;border-top-color:var(--k-line)}
.empty{font-size:12px;color:var(--k-muted)}
input,textarea{margin:10px 0;border-color:var(--k-line2)}
input{height:44px}
/* 11-18 第二轮精修：
   顶部两条入口看起来合成一张卡（上圆下圆、中间发丝线左缩进 12），右边的箭头 6×6、灰色（约等于 12 号箭头）；
   页签是分段控件：var(--k-fill) 外框 32 高、白块 28 高，字 13（选中 600 墨色、没选 400 二级墨）；
   区块标题 16 / 700，右边「全部记录」12 灰字（按钮上下各缩回 7，点按区仍 36，不撑高标题行）；空状态放进白卡；状态小标签 17 高 10 字 */
.wallet-body>.outline:first-child{margin-bottom:0;border-radius:12px 12px 0 0}
.wallet-body>.outline+.outline{border-radius:0 0 12px 12px}
.wallet-body>.outline+.outline::before{content:"";position:absolute;left:12px;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.wallet-body>.outline::after{width:6px;height:6px;margin-top:-3px;border-color:var(--k-muted)}
.tabs{gap:0;padding:2px;border-radius:16px;background:var(--k-fill)}
.tabs button{height:28px;padding:0 1px;border-radius:14px;font-size:13px;font-weight:400;line-height:28px;color:var(--k-ink2)}
.tabs button.on{background:var(--k-paper);color:var(--k-ink);font-weight:600}
.section-head{margin:16px 2px 8px;font-size:16px;font-weight:700;line-height:22px}
.section-head button{margin:-7px -12px -7px 0;font-size:12px;font-weight:400;color:var(--k-muted)}
.empty{margin:8px 0;padding:28px 12px;border-radius:12px;background:var(--k-paper);line-height:1.6}
.state{padding:0 5px;font-size:10px;line-height:17px}
/* 11-18 第二轮返修：
   1) 四个页签白块看着仍 28 高，透明 ::after 上下各伸 4，点按高度回到 36（和第一轮一样）；微信 button 默认 overflow:hidden，要放开才点得到伸出去的部分
   2) 出错提示里的「重新加载」：原来是整行无框字，改成和其他页一样的 32 高次按钮小胶囊（白底细棕边深棕字），上下各 6 的透明边，点按高度 44；左边和出错文字对齐 */
.tabs button{position:relative;overflow:visible}
.tabs button::after{content:"";position:absolute;left:0;right:0;top:-4px;bottom:-4px;width:auto;height:auto;border:0;border-radius:0;transform:none}
.notice>button{display:flex;align-items:center;justify-content:center;width:fit-content;height:44px;margin:2px 0 -6px -6px;padding:0 16px;border:6px solid transparent;border-radius:22px;background:var(--k-paper) padding-box;box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-size:13px;font-weight:500;line-height:30px;box-sizing:border-box}
/* 11-18 第三轮（主人：页面不精致）：
   1) 页边距 16；暖色积分卡放第一位（数字 32 / 700 等宽、「领取」44 高主按钮），一屏的焦点就是它；
   2) 页签改成下划线式：字 14、行高 40，靠左排、间距 24，右边留出悬浮「客服」的位置；选中 600 墨色 + 16×3 暖棕短条；
   3) 区块标题 16 / 700；「全部记录 / 只看可用」是 12 号灰字小钮；
   4) 空状态：白卡居中，56 浅棕方块 + 32 号线性图标，说明 12 灰字；
   5) 页尾两条入口一张卡（左名字 14、右灰字 12 + 12 号箭头，行间发丝线），下面是订阅提醒条 */
.wallet-body{padding:12px 16px calc(28px + env(safe-area-inset-bottom))}
.wallet-hero{padding:16px 16px 12px}
.eyebrow{font-size:12px}
.balance{margin:8px 0 2px}
.balance>text:first-child{font-size:32px;line-height:40px;font-variant-numeric:tabular-nums}
.balance .muted{font-size:12px;color:var(--k-red-deep)}
.wallet-hero>.muted{font-size:12px}
.wallet-hero>.primary{min-height:44px;margin:14px 0 8px;border-radius:22px;font-size:15px}
.wallet-hero>.hint{margin:0}
.tabs{display:flex;gap:24px;height:40px;margin:12px 0 0;padding:0 56px 0 4px;border-radius:0;background:transparent}
.tabs button{flex:0 0 auto;height:40px;padding:0;border-radius:0;background:transparent;font-size:14px;line-height:40px;color:var(--k-muted)}
.tabs button.on{background:transparent;color:var(--k-ink);font-weight:600}
.tabs button.on::before{content:"";position:absolute;left:50%;bottom:2px;width:16px;height:3px;margin-left:-8px;border-radius:2px;background:var(--k-red)}
.tabs button::after{top:0;bottom:0}
.section-head{margin:12px 4px 8px}
.section-head button{padding:9px 12px;color:var(--k-muted)}
.voucher,.panel,.exchange{padding:14px 12px 12px}
.voucher-name,.title{font-size:15px;font-weight:600;line-height:21px}
.voucher .muted{font-size:12px}
.empty--card{display:flex;flex-direction:column;align-items:center;gap:0;padding:32px 16px 28px}
.empty__ico{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-bottom:12px;border-radius:16px;background:var(--k-red-soft)}
.empty--card>text{font-size:12px;line-height:1.6;color:var(--k-muted)}
.wallet-links{margin-top:20px;border-radius:12px;background:var(--k-paper);overflow:hidden}
.wallet-links>.outline{position:relative;display:flex;align-items:center;gap:12px;min-height:48px;margin:0;padding:0 12px;border:0!important;border-radius:0;background:transparent;color:var(--k-ink)!important;font-size:14px;text-align:left}
.wallet-links>.outline::after{display:none}
.wallet-links>.outline+.outline::before{content:"";position:absolute;left:12px;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.link-label{flex:1 0 auto;font-size:14px;line-height:20px;color:var(--k-ink)}
.link-hint{flex:0 1 auto;min-width:0;font-size:12px;color:var(--k-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wallet-body :deep(.subscribe-entry){margin-top:8px;padding:0}
@media (max-width:359px){.tabs{gap:16px;padding-right:40px}}
.empty--card>text{max-width:264px;text-align:center}
/* 11-18 第三轮返修：
   1) 页签、「可用权益」标题行左右都贴页边距 16（之前左边多 4、右边多 8）；
   2) 卡里的动作统一 32 高、13 / 500：主动作浅棕实心胶囊（--k-red-soft 底、深棕字），次动作（撤销兑换、选择转赠、撤回申请、提交申诉、取消）13 号灰字；
   3) 空状态 14 / 500 标题 + 12 号说明（最宽 240，断行落在逗号后面） */
.tabs{padding-left:0}
.section-head{margin-left:0;margin-right:0}
.section-head button{margin-right:0;padding-right:0}
.voucher .outline,.panel .outline,.exchange .outline{display:inline-flex;align-items:center;justify-content:center;height:32px;min-height:32px;padding:0 14px;border:0!important;border-radius:16px;background:var(--k-red-soft);color:var(--k-red-deep)!important;font-size:13px;font-weight:500;line-height:32px}
.voucher button:not(.outline):not(.primary),.panel button:not(.outline):not(.primary){height:32px;min-height:32px;padding:0 8px;background:transparent;color:var(--k-muted);font-size:13px;font-weight:400;line-height:32px}
.voucher button.on:not(.outline){color:var(--k-red-deep);font-weight:500}
.panel .primary,.voucher .primary{height:32px;min-height:32px;padding:0 16px;border-radius:16px;font-size:13px;font-weight:500;line-height:32px}
.voucher button::after,.panel button::after,.exchange button::after{border:0}
.empty--card>.empty__title{max-width:none;font-size:14px;font-weight:500;line-height:20px;color:var(--k-ink2)}
.empty--card>.empty__title+text{max-width:240px;margin-top:4px}
/* 11-18 返修（第 2 轮）：
   1) 空状态说明最宽 256：21 个字 12 号刚好一行（之前 240 放不下，第二行只剩「夜。」）；
   2) 顶部积分卡底下的说明最宽 16.5 个字：正好在第一句句号后换行，第二行是整句「积分兑换不降低等级。」，不再只剩「等级。」；
   3) 「全部记录 / 只看可用」后面加 12 号灰箭头（和会员信息页「更多记录 ›」同一种写法）；
   4) 「会员服务」的申请按钮三列等宽，320 宽也一行排下，不再 2 + 1 参差 */
.empty--card>.empty__title+text{max-width:256px}
.wallet-hero>.hint{max-width:16.5em}
.section-head .section-head__more{display:inline-flex;align-items:center;gap:2px}
.actions--svc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.panel .actions--svc .outline{min-width:0;padding:0 4px;white-space:nowrap}
@media (max-width:359px){.panel .actions--svc .outline{font-size:12px}}
/* 11-18 第三轮返修（第 3 轮）：
   1) 积分兑换：三种房型合成一张白卡，一行一种（56 高：左边名字 15 / 600 + 下面 12 号灰字积分，右边 28 高「兑换一晚」小胶囊），行间发丝线左右各缩 12；
   2) 各页签下的小标题统一 15 / 600、上 20 下 12（「可用权益」「积分兑换免费间夜」一个样），不再 16 / 700 压在页签下面像两层标题；
   3) 卡里单独一颗的「撤回申请」「提交申诉」靠左、32 高浅棕胶囊，和「选房使用」同一种；
   4) 页尾两条入口、订阅提醒条之间都是 20。 */
.section-head{margin:20px 0 12px;font-size:15px;font-weight:600;line-height:21px}
.exchange-card{border-radius:12px;background:var(--k-paper);overflow:hidden}
.exchange-card>.exchange{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;margin:0;padding:8px 12px;border-radius:0;background:transparent;box-sizing:border-box}
.exchange-card>.exchange+.exchange::before{content:"";position:absolute;left:12px;right:12px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.exchange-card .title{display:block;font-size:15px;font-weight:600;line-height:21px}
.exchange-card .hint{margin:0;font-size:12px;line-height:17px}
.exchange-card .exchange .outline{flex:0 0 auto;height:28px;min-height:28px;margin:0;padding:0 12px;border-radius:14px;font-size:12px;line-height:28px}
.exchange-card+.notice{margin-top:12px}
.panel>button:not(.outline):not(.primary){display:flex;align-items:center;width:fit-content;height:32px;min-height:32px;margin:10px 0 0;padding:0 14px;border-radius:16px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:13px;font-weight:500;line-height:32px}
.wallet-body :deep(.subscribe-entry){margin-top:20px}
/* 11-18 第三轮返修（第 4 轮）：四个页签内容区的第一块都离页签栏 20（「使用记录」「社区权益」没有小标题，第一张卡也是 20），切页签内容不再上下跳；
   状态标签 11 / 500、18 高；卡里的说明（如「会员服务」）12 号 */
.tabs+.panel,.tabs+.empty,.tabs+.voucher{margin-top:20px}
.state{height:18px;padding:0 6px;font-size:11px;font-weight:500;line-height:18px}
.panel .hint{font-size:12px}
/* 11-18 第三轮返修（第 5 轮）：链接卡行间发丝线右边也缩进 12（和左边一样）；使用记录卡最后一段「平台回复」不再多出 8 的下边距 */
.wallet-links>.outline+.outline::before{right:12px}
.panel>.notice:last-child{margin-bottom:0}
/* 11-18 第四轮（高级感）：页签下面的区块行「可用权益」降成 13 / 500 灰字（比页签轻，不再两层标题打架），「全部记录 ›」仍在右端；
   页尾订阅提醒不再是一整张白卡：做成一行 13 号暖棕文字链接，离上面的链接卡 16 */
.section-head{margin:16px 0 8px;font-size:13px;font-weight:500;line-height:18px;color:var(--k-muted)}
.wallet-body :deep(.subscribe-entry){padding:16px 0 0}
.wallet-body :deep(.subscribe-entry button){min-height:32px;background:transparent;font-size:13px}
/* 11-18 第四轮返修（少即是多）：
   · 状态「可使用 / 已占用…」去掉浅棕底，只留 12 / 500 文字，每张权益卡只剩一颗浅棕底主操作；
   · 「会员服务」三颗胶囊改成白卡里的三行列表（48 高，左边 14 墨色、右边 12 号灰箭头，行间发丝线左右各缩 12），320 宽也不再贴着客服竖条 */
.state{height:auto;padding:0;border-radius:0;background:transparent;color:var(--k-ochre-deep);font-size:12px;font-weight:500;line-height:20px}
.panel .actions--svc{display:flex;flex-direction:column;align-items:stretch;gap:0;margin:8px -12px -12px}
.panel .actions--svc .outline{position:relative;display:flex;align-items:center;justify-content:flex-start;width:100%;box-sizing:border-box;height:48px;min-height:48px;margin:0;padding:0 32px 0 12px;border:0!important;border-radius:0;background:transparent;color:var(--k-ink)!important;font-size:14px;font-weight:400;line-height:20px;text-align:left;white-space:normal}
.panel .actions--svc .outline::before{content:"";position:absolute;left:12px;right:12px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.panel .actions--svc .outline::after{content:"";position:absolute;left:auto;right:16px;top:50%;width:6px;height:6px;margin-top:-3px;border:solid var(--k-muted);border-width:1.5px 1.5px 0 0;border-radius:0;transform:rotate(45deg);transform-origin:center;box-sizing:border-box}
@media (max-width:359px){.panel .actions--svc .outline{font-size:14px}}
/* 11-19 微信实拍返修：
   · 「可用权益」下的空状态两段合成一句居中（字和标点不动）：14 / 500 二级墨、最宽 264；
   · 主卡底部提示离「领取」按钮 12、行高 1.6，卡片下内边距 16，不再挤在卡底；
   · 区块行「可用权益」13 / 600 二级墨（标题），右边「全部记录 ›」保持 12 灰。 */
.wallet-body .empty--card{display:block;text-align:center;word-break:keep-all;overflow-wrap:anywhere}
.wallet-body .empty--card>.empty__ico{margin:0 auto 12px}
.wallet-body .empty--card>text{display:inline;max-width:none;margin:0;font-size:14px;font-weight:500;line-height:1.6;color:var(--k-ink2)}
.wallet-hero>.primary{margin-bottom:0}
.wallet-hero>.hint{margin:12px 0 0;line-height:1.6}
.wallet-hero{padding-bottom:16px}
.section-head{font-weight:600;color:var(--k-ink2)}
.section-head>.section-head__more{font-weight:400;color:var(--k-muted)}
</style>
