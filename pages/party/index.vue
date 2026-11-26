<template>
<view class="party-page" :class="$userSurface"><k-topbar :title="room ? (room.mode==='dice'?'好友骰子':'袋鼠大富翁') : '好友桌游'" back :fab="false" />
 <view v-if="!code" class="party-body">
  <view class="party-hero"><view class="party-hero__art"><k-icon name="dice-5" art="party-dice" :size="28" color="white" /></view><text class="eyebrow">KANGAROO GAME NIGHT</text><text class="heading">{{ '围一桌，\n一起去远方。' }}</text><text>各用自己的手机，好友建房同步开玩</text></view>
  <view class="join-entry">
   <text class="title">加入好友房间</text>
   <text class="join-hint">输入或粘贴好友发来的6位房间号</text>
   <view class="join-row">
    <input v-model="joinCode" type="number" maxlength="6" placeholder="输入6位房间号" :adjust-position="true" :cursor-spacing="24" confirm-type="go" :confirm-hold="false" :disabled="joining" @confirm="join" @input="joinError=''" />
    <button class="paste-room-code" :disabled="pasting||joining" @click="pasteCode">{{pasting?'粘贴中…':'粘贴房号'}}</button>
   </view>
   <text v-if="joinError" class="join-error" role="alert">{{joinError}}</text>
   <k-button block :disabled="joining||pasting" @click="join">{{joining?'正在打开…':'加入房间'}}</k-button>
  </view>
  <view class="game-grid">
  <view class="game-choice"><view class="game-choice__icon"><k-icon name="map" art="party-board" :size="24" color="red" /></view><view class="game-choice__copy"><text class="title">袋鼠大富翁</text><text>2–6人 · 掷骰、购地、收租，成为旅行大赢家</text></view><k-button block :disabled="creating" @click="create('monopoly')">创建大富翁房间</k-button></view>
  <view class="game-choice"><view class="game-choice__icon"><k-icon name="dice-5" art="party-dice" :size="24" color="red" /></view><view class="game-choice__copy"><text class="title">好友骰子</text><text>2–8人 · 1–6颗骰子，大家同时看到结果</text></view><k-button block type="outline" :disabled="creating" @click="create('dice')">创建骰子房间</k-button></view>
  </view>
  <k-button v-if="current" block type="green" @click="go(api.path(current.code))">继续房间 {{current.code}}</k-button>
 </view>
 <view v-else class="party-body">
  <view class="room-banner"><view><text class="title">房间 {{code}}</text><text>{{room?.phase==='waiting'?'等待朋友入座，加入即准备':room?.phase==='finished'?'本局已结束':'每回合45秒 · 断线可重新进入'}}</text></view><button class="small" @click="copyCode">复制房号</button></view>
  <view v-if="!room" class="room-loading">
   <text class="note">{{loading?'正在同步房间…':error||localError||'房间暂时未能加载，请重新同步'}}</text>
   <k-button v-if="!loading" block :disabled="loading" @click="retryRoom">重新同步</k-button>
   <k-button v-if="!loading && !experience.account" block type="outline" @click="login">登录后加入房间</k-button>
   <button class="small" @click="lobby">返回桌游大厅</button>
  </view>
  <template v-if="room && room.phase!=='closed'">
   <view v-if="!room.me && room.phase==='playing'" class="note"><text>本局已开始，暂不能加入。你可以观看本局，或返回大厅加入其他房间。</text><button class="small" @click="lobby">返回桌游大厅</button></view>
   <view v-if="room.phase==='waiting'" class="ready-panel">
    <text class="title">{{room.me ? (room.me.host?'等待好友准备':'你已准备，等待房主开始') : '你还未加入房间'}}</text>
    <text class="ready-count">已准备 {{room.players.length}} / {{room.mode==='dice'?8:6}} 人</text>
    <template v-if="!room.me">
     <text class="note">{{experience.account?'点下方按钮入座，房主才能看到你并开始游戏。':'先登录再加入，登录后会回到这个房间并为你入座。'}}</text>
     <k-button block :disabled="busy" :label="busy?'正在加入…':experience.account?'加入并准备':'登录并加入房间'" @click="joinSeat" />
    </template>
    <template v-else-if="room.me?.host">
     <text class="note">{{room.players.length<2?'还差1位好友。请好友打开邀请后点击“加入并准备”。':'好友已准备，可以开始游戏。'}}</text>
     <k-button block :disabled="busy||room.players.length<2" label="开始游戏" @click="act('start')" />
    </template>
    <text v-if="seatError" class="join-error" role="alert">{{seatError}}</text>
    <view v-if="previousRoom && previousRoom.code!==code" class="previous-room"><text>你还在房间 {{previousRoom.code}}，请先退出原房间再来加入。</text><button class="small" @click="go(api.path(previousRoom.code))">前往原房间</button></view>
   </view>
   <ww-sound v-if="room.mode==='monopoly' && room.me" :active="pageActive" :track="boardMusic" preference-key="kangaroo:party:music" />
   <ww-chat v-if="voiceRoom" :key="voiceRoom.code + voiceRoom.me.userId" :active="pageActive" :room="voiceRoom" recorded-voice voice-only game="party" @refresh="refresh" />
   <view class="people"><view v-for="p in room.players" :key="p.seat" class="person" :class="{current:room.phase==='playing'&&room.currentSeat===p.seat,out:p.out}"><view class="seat">{{p.seat}}</view><text>{{p.name}}{{room.me?.seat===p.seat?'（我）':''}}</text><text>{{p.out?'已离场':room.mode==='dice'?p.score+' 点':p.money+' 金币'}}</text></view></view>
   <template v-if="room.phase==='waiting'">
    <text class="note">邀请好友后，各自在手机上进入房间。至少2人即可开始。</text><button class="invite" open-type="share" @click="shareHint">邀请好友</button>
    <view v-if="room.mode==='dice' && room.me?.host" class="dice-options"><text>每次摇几颗？</text><button v-for="n in 6" :key="n" :class="{selected:room.diceCount===n}" :disabled="busy" @click="act('settings',{diceCount:n})">{{n}}</button></view>
   </template>
   <view v-if="room.mode==='monopoly' && room.phase!=='waiting'" class="board"><view v-for="t in room.board" :key="t.index" class="tile" :class="{owned:t.ownerSeat}" :style="tileStyle(t.index)"><text>{{t.name}}</text><text>{{t.ownerSeat?t.ownerSeat+'号地产':t.price?'金币 '+t.price:'旅途驿站'}}</text><view class="pawns"><text v-for="p in room.players.filter(x=>!x.out&&x.position===t.index)" :key="p.seat">{{p.seat}}</text></view></view><view class="board-center"><text>袋鼠旅行棋</text><text>第 {{room.round}} 轮</text><text>经过起点 +200</text><text>租金为地价的20%</text></view></view>
   <view v-if="room.phase==='playing'" class="turn-panel"><text class="title">{{room.currentSeat}}号 · {{room.players[room.currentSeat-1]?.name}} 的回合</text><text class="countdown">{{seconds}}秒</text><view class="dice"><view v-for="(d,i) in room.dice" :key="i" :aria-label="d+'点'"><k-icon name="dice-5" :art="Number(d) === 5 ? 'dice-5' : 'die-' + d" :size="44" /></view><text v-if="!room.dice.length">等待掷骰</text></view><k-button v-if="room.canRoll" block :disabled="busy" @click="act('roll')">{{busy?'正在掷骰…':'摇骰子'}}</k-button><k-button v-if="room.canBuy" block :disabled="busy" type="green" @click="act('buy')">购买当前地产</k-button><k-button v-if="room.canEnd" block :disabled="busy" type="outline" @click="act('end')">结束回合 / 跳过购买</k-button><text v-if="!room.canRoll&&!room.canEnd" class="note">{{room.me?.out?'你已离场，可观看本局结果':'等待其他玩家，结果自动同步'}}</text></view>
   <view v-if="room.phase==='finished'" class="result"><text class="title">本局结算</text><view v-for="(p,i) in ranking" :key="p.seat" class="rank"><text>{{i+1}}. {{p.name}}</text><text>{{room.mode==='dice'?p.score+'点':p.assets+'金币'}}{{p.out?' · 已离场':''}}</text></view><k-button v-if="room.me?.host" block @click="act('replay')" :disabled="busy">再来一局</k-button></view>
   <view class="rules"><text class="title">玩法说明</text><text>{{room.mode==='dice'?'依次掷骰，累计点数公开同步。房主可结束并查看排名。':'初始1500金币；空地产可购买，经过别人的地产支付20%租金。金币不足付租或费用时破产，地产回到公共库存。最后存活者获胜；最多80轮后按剩余金币与地产总值排名。'}}每回合45秒，超时自动结束。只使用游戏金币，无充值、提现或现金交易。</text></view>
   <view v-if="room.events.length" class="logs"><text class="title">本局记录</text><text v-for="(e,i) in room.events.slice(-25).reverse()" :key="i">{{e}}</text></view>
   <button v-if="room.me?.host && room.phase==='playing'" class="small" :disabled="busy" @click="endGame">结束本局并结算</button>
   <button v-if="room.me" class="exit" :disabled="busy" @click="leave">退出房间</button>
  </template>
  <view v-else-if="room" class="note">房间已解散<button @click="lobby">返回桌游大厅</button></view>
 </view><view v-if="(room||!code)&&(error||localError)" class="error">{{error||localError}}<button v-if="code" @click="retryRoom">重新同步</button></view>
</view>
</template>
<script setup>
import {ref,computed,watch} from 'vue'
import {onLoad,onShow,onHide,onUnload,onShareAppMessage} from '@dcloudio/uni-app'
import {useGameRoom} from '@/common/use-game-room.js'
import {experience,ensureSession} from '@/common/experience.js'
import {go,toast} from '@/common/screen.js'
import {confirm,copy} from '@/common/ui.js'
import {publicShare,showPublicShareMenu} from '@/common/public-share.js'
import {partyCode} from '@/common/party-code.js'
import {readClipboardRoomCode,hideRoomKeyboard,openRoomPage} from './join-input.js'
import * as api from './api.js'
import WwChat from '../werewolf/components/ww-chat.vue'
import WwSound from '../werewolf/components/ww-sound.vue'
import boardMusic from './static/travel-board.mp3'
const code=ref(''),joinCode=ref(''),creating=ref(false),current=ref(null),localError=ref('')
const pasting=ref(false),joining=ref(false),joinError=ref('')
const joinOnArrival=ref(false),seatError=ref(''),previousRoom=ref(null)
let joinEpoch=0
function cancelJoinInput(){joinEpoch++;pasting.value=false;joining.value=false}
onHide(cancelJoinInput)
onUnload(cancelJoinInput)
let creationId=''
onLoad(q=>{code.value=partyCode(q?.code);joinOnArrival.value=q?.join==='1';if(q?.code&&!code.value)localError.value='房间号无效，请输入6位数字'})
const {room,error,loading,busy,now,act,refresh,stop,pageActive}=useGameRoom(code,api)
// 手动输入房号点“加入”代表入座意图；普通分享预览仍由用户主动选择加入。
// 仅消费一次意图，失败后显式重试，不随轮询/onShow 重复发起加入。
watch([joinOnArrival,()=>room.value?.version,()=>experience.account?.id,pageActive],()=>{
 if(!joinOnArrival.value||!pageActive.value||!room.value||!experience.account)return
 joinOnArrival.value=false
 if(room.value.phase==='waiting'&&!room.value.me)joinSeat()
})
const voiceRoom = computed(() => {
 const r = room.value
 if (!r?.voiceToken || !r.me?.canChat) return null
 return { code: r.code, phase: r.phase, phaseToken: r.voiceToken, serverTime: r.serverTime, messages: r.messages,
   me: { userId: r.me.userId, canSpeak: true } }
})
const seconds=computed(()=>Math.max(0,Math.ceil(((room.value?.deadline||0)-now.value)/1000)))
const ranking=computed(()=>[...(room.value?.players||[])].sort((a,b)=>Number(a.out)-Number(b.out)||(room.value.mode==='dice'?b.score-a.score:b.assets-a.assets)))
onShow(async()=>{showPublicShareMenu();if(!code.value){await ensureSession();if(experience.account)try{current.value=await api.mine()}catch(e){localError.value=e.message}}})
function login(){if(experience.account)return true;go('/pages/auth/login'+(code.value?'?partyCode='+code.value+'&partyJoin=1':''));return false}
function retryRoom(){localError.value='';return refresh()}
async function create(mode){if(creating.value||!login())return;creating.value=true;localError.value='';try{if(!creationId)creationId=api.requestId();const r=await api.create(mode,creationId);creationId='';go(api.path(r.code))}catch(e){localError.value=e.message;current.value=await api.mine().catch(()=>null)}finally{creating.value=false}}
async function pasteCode(){
 if(pasting.value||joining.value)return
 const generation=joinEpoch,original=joinCode.value
 pasting.value=true;joinError.value=''
 try{
  const value=await readClipboardRoomCode()
  if(generation===joinEpoch&&joinCode.value===original)joinCode.value=value
 }catch(e){if(generation===joinEpoch)joinError.value=e.message}
 finally{if(generation===joinEpoch)pasting.value=false}
}
async function join(){
 if(joining.value||pasting.value)return
 const value=partyCode(String(joinCode.value).trim())
 if(!value){joinError.value='请输入6位房间号';return}
 const generation=joinEpoch
 joining.value=true;joinError.value=''
 try{
  await hideRoomKeyboard()
  if(generation!==joinEpoch)return
  await openRoomPage(api.path(value)+'&join=1')
  // 导航成功后锁到 onHide，避免回调与页面切换之间再次确认造成重复入栈。
 }catch(e){if(generation===joinEpoch){joining.value=false;joinError.value='页面未能打开，请重试'}}
}
async function joinSeat(){
 if(busy.value||!login())return
 const generation=joinEpoch,accountId=experience.account?.id
 seatError.value='';previousRoom.value=null
 const result=await act('join')
 if(generation!==joinEpoch||experience.account?.id!==accountId)return
 if(!result){
  seatError.value=error.value||'加入失败，请重试'
  const prior=await api.mine().catch(()=>null)
  if(generation===joinEpoch&&experience.account?.id===accountId)previousRoom.value=prior
 }
}
const copyCode=()=>copy(code.value,'房间号已复制')
function shareHint(){/* #ifdef H5 */ toast('复制房间号发给朋友，即可在桌游大厅加入'); /* #endif */}
function lobby(){stop();uni.redirectTo({url:api.path()})}
async function leave(){if(!await confirm('退出房间',room.value.phase==='playing'?'退出后本局按离场处理，其他朋友可以继续。':'确认退出房间？'))return;const r=await act('leave');if(r)lobby()}
async function endGame(){if(await confirm('结束本局','结束后按当前累计结果结算，所有玩家都会看到结果。'))act('finish')}
function tileStyle(i){let row,col;if(i<6){row=1;col=i+1}else if(i<11){row=i-4;col=6}else if(i<16){row=6;col=16-i}else{row=21-i;col=1}return {gridRow:String(row),gridColumn:String(col)}}
onShareAppMessage(()=>publicShare('/pages/party/index',code.value?{code:code.value}:{},'来玩'+(room.value?.mode==='dice'?'好友骰子':'袋鼠大富翁')+(code.value?' · 房间'+code.value:'')))
</script>
<style scoped>
.ready-panel{margin:16px 0;padding:16px;border:1px solid var(--k-line);border-radius:18px;background:var(--k-paper)}.ready-panel>.title,.ready-count{display:block}.ready-count{margin-top:8px;color:var(--k-muted);font-size:14px}.ready-panel .join-error{margin:12px 0 0}.previous-room{margin-top:12px;font-size:13px;line-height:1.7;color:var(--k-muted)}
.join-entry{padding-bottom:20px;margin-bottom:20px;border-bottom:1px solid var(--k-line)}.join-entry>.title{display:block;font-size:20px}.join-hint{display:block;margin-top:6px;color:var(--k-muted);font-size:14px;line-height:1.6}.join-entry .join-row{margin:12px 0}.paste-room-code{flex-shrink:0;min-height:52px;margin:0;padding:0 12px;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1.4;border:1px solid var(--k-line);border-radius:16px;background:var(--k-paper);color:var(--k-ink)}.paste-room-code[disabled]{opacity:.6}.join-error{display:block;color:var(--k-danger,#9b4128);font-size:14px;line-height:1.6;margin:0 0 12px}
.party-page{min-height:100vh;background:var(--k-bg);color:var(--k-ink)}.party-body{padding:18px 14px calc(32px + var(--k-safe-bottom))}.party-hero{background:#173f33;color:#fff9e9;border-radius:24px;padding:28px 22px;margin-bottom:20px}.party-hero text{display:block;line-height:1.7}.eyebrow{font-size:11px;letter-spacing:2px;opacity:.7}.heading{font-size:32px;font-weight:700;white-space:pre-line;margin:14px 0}.game-choice,.rules,.result,.logs{padding:20px;background:var(--k-paper);border:1px solid var(--k-line);border-radius:20px;margin:16px 0}.game-choice>text,.logs>text,.rules>text{display:block;line-height:1.8;margin-bottom:12px}.title{font-size:18px;font-weight:700}.join-row{display:flex;gap:8px;margin:20px 0}.join-row input{height:52px;box-sizing:border-box;min-width:0;flex:1;background:white;border:1px solid var(--k-line);border-radius:16px;padding:14px}.room-banner{display:flex;justify-content:space-between;align-items:center;background:#173f33;color:white;padding:20px 16px;border-radius:22px;gap:8px}.room-banner text{display:block;line-height:1.8}.room-banner text+text{font-size:12px}.small{font-size:12px;line-height:1.5;padding:10px 12px;margin:8px 0;border-radius:16px;background:#efe7d8;color:#674425;flex-shrink:0}.people{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:20px 0}.person{padding:12px 5px;border:1px solid var(--k-line);border-radius:18px;text-align:center;background:var(--k-paper)}.person text{display:block;font-size:12px;line-height:1.6;overflow-wrap:anywhere}.person.current{border:2px solid #467644;background:#edf3e7}.person.out{opacity:.5}.seat{width:34px;height:34px;line-height:34px;margin:0 auto 6px;border-radius:50%;background:#b47d40;color:white;font-weight:700}.note{display:block;font-size:13px;line-height:1.8;color:var(--k-muted);margin:14px 0}.invite{background:#b47d40;color:white;border-radius:22px;margin:14px 0}.dice-options{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:15px 0}.dice-options button{margin:0;font-size:15px}.selected{background:#376443;color:white}.board{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:repeat(6,minmax(64px,auto));gap:3px;padding:5px;background:#dcd0b6;border-radius:18px;margin:16px -6px}.tile{border-radius:7px;background:#fff9ee;padding:5px 2px;text-align:center;font-size:10px;line-height:1.5;min-width:0}.tile>text{display:block}.tile>text+text{font-size:9px;color:#816743}.tile.owned{background:#e4efd7}.pawns{display:flex;flex-wrap:wrap;gap:2px;justify-content:center}.pawns text{background:#a55c34;color:white;border-radius:50%;width:15px;height:15px;line-height:15px}.board-center{grid-row:2/6;grid-column:2/6;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:14px;color:#335740;background:#eee7d8;font-size:12px;border-radius:20px}.board-center text:first-child{font-size:22px;font-weight:700}.turn-panel{text-align:center;padding:20px;background:#fffdf6;border-radius:20px;border:1px solid var(--k-line)}.turn-panel>.title{display:block;font-size:16px}.countdown{font-size:22px;color:#94703a;line-height:2}.dice{display:flex;justify-content:center;flex-wrap:wrap;font-size:46px;color:#965a2d;min-height:66px;align-items:center}.turn-panel :deep(button){margin-top:10px}.rules{font-size:13px;color:var(--k-muted)}.logs>text{font-size:12px;margin:5px 0}.logs>.title{font-size:16px}.rank{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--k-line);font-size:14px}.exit{margin:20px 0;color:#9a4c31;border:1px solid #dec9b4;background:#fbf3e7;border-radius:20px}.error{margin:16px;padding:18px;border-radius:14px;background:#fff0e7;color:#9b4128}
</style>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底上放白卡，不描边、不加阴影，圆角 12；深绿横幅和房间条收小一档，
   标题 15、说明 12、按钮是 44 高的胶囊。功能和文字不变：输入 / 粘贴房号、加入房间、创建大富翁 / 骰子房间、继续房间、复制房号、
   入座 / 开始、邀请好友、选骰子数、棋盘、掷骰 / 购买 / 结束回合、结算、玩法说明、本局记录、退出房间都在。
   上面的旧规则保留不动（房号输入框那条检查要用），这里用 .party-page 开头的规则盖过去。 */
.party-page {
  --k-bg: var(--k-page); --k-paper2: var(--k-fill); --party-art-bg: rgba(255, 255, 255, .12); /* 本组暖米填充、氛围卡骰子方块底，只在根上定义一次 */
  background: var(--k-page);
  :deep(.k-topbar) { background: var(--k-page); }
  :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
  :deep(.k-button) { height: 44px; border-radius: 22px; box-shadow: none; font-size: 15px; }
  /* 上一条的「去投影」和按钮自带的投影一样重、在小程序里没盖住：这里多写一层盖过去；两个「创建…房间」收到 40 高，轻一点 */
  .party-body :deep(.k-button) { box-shadow: none; }
  /* 第二轮精修：两个「创建…房间」都是次按钮（白底 + 棕色细边 + 深棕字），大厅里只留「加入房间」一个实心主按钮；40 高不变 */
  /* 选择器多带一层按钮类型：比按钮自带的「不可点主按钮 = 暖棕渐变白字（!important）」更具体，点了「创建」变成不可点时也不会闪回实心棕；不可点时整体淡到 .45 */
  .game-choice :deep(.k-button.is-primary), .game-choice :deep(.k-button.is-outline) { height: 40px; border: 1px solid var(--k-red-line) !important; border-radius: 20px; background: var(--k-paper) !important; color: var(--k-red-deep) !important; font-size: 14px; font-weight: 600; }
  .game-choice :deep(.k-button.is-disabled.is-primary), .game-choice :deep(.k-button.is-disabled.is-outline) { opacity: .45; }
  .party-body { padding: 8px 12px calc(32px + var(--k-safe-bottom)); }
  /* 区块标题 16 / 700、行高 22（全站同一档） */
  .title, .join-entry > .title, .turn-panel > .title, .logs > .title { font-size: 16px; line-height: 22px; font-weight: 700; }
  .note { margin: 10px 2px; font-size: 12px; line-height: 1.7; }
  .small { margin: 6px 0; padding: 10px 14px; border-radius: 18px; background: var(--k-paper2); color: var(--k-red-deep); font-size: 12px; line-height: 16px; }
  /* 「复制房号 / 返回桌游大厅 / 前往原房间 / 结束本局并结算 / 重新同步」这类小按钮：看上去是 28 高、圆角 14 的浅棕小胶囊（12 / 500 深棕字），
     外面一圈 4 的透明边把可点高度留在 36；宽度跟着字走，不再拉满一整行 */
  .small, .note > button, .error > button { display: flex; align-items: center; justify-content: center; width: fit-content; height: 36px; box-sizing: border-box; margin: 6px 0; padding: 0 12px; border: 4px solid transparent; border-radius: 18px; background: var(--k-red-soft) padding-box; color: var(--k-red-deep); font-size: 12px; font-weight: 500; line-height: 1; }
  /* 同一页这种小胶囊一律靠左、放在文字下一行；左边多出的 4 透明边往回收，让看得见的胶囊和上面文字的左边对齐 */
  .small { margin-left: -4px; }
  .note > button, .error > button { margin: 8px 0 0 -4px; }
  .room-loading > .small, .party-body > .small { margin: 8px 0 8px -4px; }
  .small::after, .invite::after, .exit::after, .paste-room-code::after, .dice-options button::after, .error button::after, .note button::after { border: 0; }
  /* 大厅 */
  .join-entry { margin-bottom: 8px; padding: 12px; border-bottom: 0; border-radius: 12px; background: var(--k-paper); }
  .join-hint { margin-top: 2px; font-size: 12px; }
  .join-entry .join-row { gap: 8px; margin: 10px 0; }
  .join-row input { height: 44px; padding: 0 12px; border: 0; border-radius: 12px; background: var(--k-paper2); font-size: 15px; }
  .paste-room-code { min-height: 44px; padding: 0 14px; border-color: var(--k-red-line); border-radius: 22px; color: var(--k-red-deep); font-size: 13px; }
  .join-error { margin: 0 2px 10px; font-size: 12px; }
  .party-hero { margin-bottom: 8px; padding: 16px; border-radius: 12px; }
  .party-hero text { line-height: 1.6; font-size: 12px; }
  .party-hero .eyebrow { font-size: 11px; letter-spacing: 1.5px; }
  .party-hero .heading { margin: 6px 0; font-size: 20px; line-height: 1.4; }
  .game-choice, .rules, .result, .logs { margin: 8px 0; padding: 12px; border: 0; border-radius: 12px; }
  .game-choice > text, .logs > text, .rules > text { margin-bottom: 8px; color: var(--k-muted); font-size: 12px; line-height: 1.7; }
  .game-choice > .title, .rules > .title, .logs > .title { margin-bottom: 2px; color: var(--k-ink); font-size: 16px; line-height: 22px; }
  /* 房间 */
  .room-banner { padding: 12px; border-radius: 12px; }
  .room-banner text { line-height: 1.6; }
  .room-banner text + text { font-size: 11px; opacity: .85; }
  .room-banner .small { margin: 0; background: rgba(255, 255, 255, .16) padding-box; color: #fff; }
  .ready-panel { margin: 8px 0; padding: 12px; border: 0; border-radius: 12px; }
  /* 房间没加载出来：和上面的准备区一样放进白卡；两颗按钮之间留 8，「登录后加入房间」是次按钮（白底 + 棕色细边 + 深棕字） */
  .room-loading { margin: 8px 0; padding: 2px 12px 8px; border-radius: 12px; background: var(--k-paper); }
  .room-loading :deep(.k-button) { margin-top: 8px; }
  .room-loading :deep(.k-button.is-outline) { border-color: var(--k-red-line) !important; color: var(--k-red-deep) !important; }
  .ready-count { margin-top: 4px; font-size: 12px; }
  .previous-room { font-size: 12px; }
  .people { gap: 8px; margin: 8px 0; }
  .person { padding: 10px 4px; border: 0; border-radius: 12px; }
  .person text { font-size: 11px; }
  .person.current { border: 0; background: var(--k-green-soft); box-shadow: inset 0 0 0 1.5px var(--k-green); }
  .seat { width: 30px; height: 30px; margin-bottom: 4px; background: linear-gradient(135deg, #B5814D, #8E5E33); font-size: 13px; line-height: 30px; }
  /* 「邀请好友」是次按钮：白底 + 棕色细边 + 深棕字（主按钮留给「开始游戏 / 加入并准备」）；42 行高 + 上下 1 的边 = 44 高 */
  .invite { margin: 10px 0; border: 1px solid var(--k-red-line); border-radius: 22px; background: var(--k-paper); color: var(--k-red-deep); font-size: 15px; font-weight: 600; line-height: 42px; }
  .dice-options { gap: 6px; margin: 10px 2px; font-size: 13px; }
  .dice-options button { width: 36px; min-width: 36px; padding: 0; border-radius: 18px; background: var(--k-paper); color: var(--k-ink2); font-size: 14px; line-height: 36px; }
  /* 选中的骰子数：浅棕底 + 深棕字（和全站选中的小胶囊一个样子） */
  .dice-options button.selected { background: var(--k-red-soft); color: var(--k-red-deep); font-weight: 600; }
  .board { margin: 8px 0; padding: 4px; border-radius: 12px; background: #EDE6DA; }
  .tile { border-radius: 6px; background: var(--k-paper); }
  .tile.owned { background: var(--k-green-soft); }
  /* 棋盘上零散的颜色收进全站色板：地价浅灰、棋子暖棕、中间说明二级墨 */
  .tile > text + text { color: var(--k-muted); }
  .pawns text { background: var(--k-red); }
  .board-center { gap: 10px; border-radius: 12px; background: var(--k-page); color: var(--k-ink2); }
  .board-center text:first-child { font-size: 18px; }
  .turn-panel { padding: 14px 12px; border: 0; border-radius: 12px; background: var(--k-paper); }
  .countdown { font-size: 18px; font-weight: 700; color: var(--k-red); font-variant-numeric: tabular-nums; }
  .dice { min-height: 56px; font-size: 40px; color: var(--k-red-deep); }
  /* 结算排名：行间一道发丝线，最后一行下面不画；分数等宽数字 */
  .rank { padding: 10px 0; border-bottom: 0; font-size: 13px; font-variant-numeric: tabular-nums; }
  .rank + .rank { box-shadow: inset 0 .5px 0 var(--k-line); }
  .exit { margin: 12px 0; border-color: var(--k-line2); border-radius: 22px; background: transparent; color: var(--k-alert); font-size: 14px; line-height: 42px; }
  .error { margin: 8px 12px; padding: 12px; border-radius: 12px; background: var(--k-alert-soft); color: var(--k-alert); font-size: 13px; }
  @media (max-width: 359px) {
    .board { margin: 8px -4px; }
    .party-hero .heading { font-size: 18px; }
  }
}
</style>

<style scoped lang="scss">
/* 11-18 第三轮精修：深绿横幅（主人定的游戏气氛，保留）挪到大厅最上面当页头；两个游戏改成横排小卡
   （左 44 浅棕方块 + 22 线性图标、中间标题 15 / 600 + 说明 12、右侧 32 高浅棕小按钮）；骰子点数画成骰子，不再用文字骰子符号。 */
.party-page {
  .party-body { padding-top: 8px; }
  .party-hero { position: relative; margin: 0 0 8px; padding: 16px 16px 14px; border-radius: 12px; overflow: hidden; }
  .party-hero .eyebrow { font-size: 11px; line-height: 14px; letter-spacing: 1.5px; opacity: .72; }
  .party-hero .heading { margin: 6px 0 4px; font-size: 20px; line-height: 28px; letter-spacing: .5px; }
  .party-hero text:last-child { font-size: 12px; line-height: 18px; opacity: .86; }
  .join-entry { padding: 16px 12px 12px; }
  .join-entry > .title { font-size: 16px; line-height: 22px; }
  .join-hint { margin-top: 2px; font-size: 12px; line-height: 18px; }
  .join-entry .join-row { margin: 12px 0 8px; }
  .paste-room-code { border: 0; background: var(--k-red-soft); font-weight: 500; }
  .game-choice { display: flex; align-items: center; gap: 12px; margin: 8px 0 0; padding: 14px 12px; }
  .game-choice__icon { flex: 0 0 44px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 14px; background: var(--k-red-soft); }
  .game-choice__copy { flex: 1 1 auto; min-width: 0; }
  .game-choice__copy > text { display: block; }
  .game-choice__copy > .title { margin: 0; font-size: 15px; line-height: 21px; font-weight: 600; color: var(--k-ink); }
  .game-choice__copy > text + text { margin-top: 2px; font-size: 12px; line-height: 17px; color: var(--k-muted); }
  .game-choice :deep(.k-button.is-primary), .game-choice :deep(.k-button.is-outline) { flex: 0 0 auto; width: auto; height: 32px; min-height: 32px; margin: 0; padding: 0 12px; border: 0 !important; border-radius: 16px; background: var(--k-red-soft) !important; color: var(--k-red-deep) !important; font-size: 12px; font-weight: 500; }
  .party-body > :deep(.k-button.is-green) { margin-top: 12px; }
  .dice { gap: 10px; min-height: 64px; }
  @media (max-width: 359px) {
    .game-choice { flex-wrap: wrap; row-gap: 10px; }
    .game-choice__copy { flex-basis: calc(100% - 56px); }
    .game-choice :deep(.k-button.is-primary), .game-choice :deep(.k-button.is-outline) { margin-left: 56px; }
  }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 1 轮：大厅三张卡左线统一（内边距 16），块与块之间 16；氛围卡收到约 84 高；
   「加入房间」48 高实心暖棕、圆角 12；两款游戏改成两列竖卡（44 方块 + 24 图标、16/600 标题、12 号说明、底部 36 高整宽按钮） */
.party-page {
  .party-body .party-hero { margin: 0 0 16px; padding: 14px 16px; }
  .party-body .party-hero .heading { margin: 4px 0 2px; font-size: 20px; line-height: 28px; }
  .party-body .join-entry { margin: 0 0 16px; padding: 16px; }
  .party-body .join-entry :deep(.k-button.is-primary) { height: 48px; min-height: 48px; border-radius: 12px; background: var(--k-red) !important; font-size: 16px; font-weight: 600; }
  .party-body .join-entry :deep(.k-button.is-primary.is-disabled) { opacity: .45; }
  .game-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .game-grid .game-choice { display: flex; flex-direction: column; align-items: stretch; gap: 0; margin: 0; padding: 16px; flex-wrap: nowrap; min-height: 160px; box-sizing: border-box; }
  .game-grid .game-choice__icon { flex: 0 0 auto; width: 44px; height: 44px; border-radius: 14px; }
  .game-grid .game-choice__copy { flex: 1 1 auto; flex-basis: auto; margin-top: 12px; }
  .game-grid .game-choice__copy > .title { font-size: 16px; line-height: 22px; font-weight: 600; }
  .game-grid .game-choice__copy > text + text { margin-top: 4px; font-size: 12px; line-height: 18px; }
  .game-grid .game-choice :deep(.k-button.is-primary), .game-grid .game-choice :deep(.k-button.is-outline) { width: 100%; height: 36px; min-height: 36px; margin: 12px 0 0; padding: 0 8px; border-radius: 18px; font-size: 13px; }
  .party-body > :deep(.k-button.is-green) { margin-top: 16px; }
  @media (max-width: 359px) {
    .game-grid { gap: 8px; }
    .game-grid .game-choice { padding: 12px; }
  }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 2 轮：形状成套（输入框 48、主按钮 48、次按钮 36，全部 12 圆角）；游戏说明按词换行；
   氛围卡右边一颗 40 号线性骰子（白色 40%）；区块之间 20（绿色气氛保留） */
.party-page {
  .party-body .party-hero { margin-bottom: 20px; padding-right: 72px; }
  .party-hero__art { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); opacity: .4; display: flex; }
  .party-body .join-entry { margin-bottom: 20px; }
  .join-entry .join-row { align-items: center; gap: 8px; }
  .join-entry .join-row input { height: 48px; min-height: 48px; border-radius: 12px; box-sizing: border-box; }
  .paste-room-code { flex: 0 0 auto; height: 36px; min-height: 36px; margin: 0; padding: 0 12px; border-radius: 12px; font-size: 13px; line-height: 36px; }
  .paste-room-code::after { border: 0; }
  .game-grid .game-choice :deep(.k-button.is-primary), .game-grid .game-choice :deep(.k-button.is-outline) { border-radius: 12px; }
  .game-grid .game-choice__copy > text + text { word-break: keep-all; overflow-wrap: break-word; }
  .party-body > :deep(.k-button.is-green) { margin-top: 20px; }
}
</style>
<style scoped lang="scss">
/* 11-18 第四轮：「粘贴房号」和输入框同高 48、圆角 12；氛围卡标题按逗号分两行；右边骰子放进 56 的半透明白色圆角方块（28 号图标），不再像占位图 */
.party-page {
  .paste-room-code { height: 48px; min-height: 48px; padding: 0 16px; border-radius: 12px; line-height: 48px; }
  .party-body .party-hero .heading { white-space: pre-line; }
  .party-hero__art { width: 56px; height: 56px; align-items: center; justify-content: center; border-radius: 16px; background: var(--party-art-bg); opacity: 1; }
  @media (max-width: 359px) {
    .party-body .party-hero .heading { font-size: 18px; line-height: 26px; }
  }
}
</style>
<style scoped lang="scss">
/* 11-18 夜 第四轮精修：保留墨绿头卡的游戏气氛，只把按钮和输入框统一成胶囊——
   房间号输入 44 高胶囊（--k-fill 底）；「粘贴房号」40 高白底描边次按钮；「加入房间」44 高主按钮；「创建××房间」32 高浅棕小胶囊 */
.party-page {
  .join-row { align-items: center; gap: 8px; }
  .join-row input { height: 44px; min-height: 44px; padding: 0 16px; border: 0; border-radius: 22px; background: var(--k-fill); font-size: 15px; }
  .paste-room-code { flex: none; height: 40px; min-height: 40px; margin: 0; padding: 0 16px; border: 1px solid var(--k-red-line); border-radius: 20px; background: var(--k-paper); color: var(--k-red-deep); font-size: 13px; font-weight: 500; line-height: 38px; }
  .paste-room-code::after { border: 0; }
  .join-entry :deep(.k-button) { height: 44px; min-height: 44px; margin-top: 12px; border-radius: 22px; background: var(--k-grad-brown); box-shadow: none; font-size: 15px; font-weight: 600; }
  .game-choice :deep(.k-button) { height: 32px; min-height: 32px; border: 0; border-radius: 16px; background: var(--k-red-soft); color: var(--k-red-deep); box-shadow: none; font-size: 12px; font-weight: 500; }
}
</style>
<style scoped lang="scss">
/* 11-18 夜 第四轮精修（补）：旧规则带 !important、选择器更深，这里用同样深度压回胶囊——加入房间 44 主按钮、创建房间 32 小胶囊 */
.party-page {
  .party-body .join-entry :deep(.k-button.is-primary) { height: 44px; min-height: 44px; border-radius: 22px; background: var(--k-grad-brown) !important; font-size: 15px; }
  .game-grid .game-choice :deep(.k-button.is-primary), .game-grid .game-choice :deep(.k-button.is-outline) { height: 32px; min-height: 32px; border-radius: 16px; font-size: 12px; font-weight: 500; }
}

.party-page.user-surface {
  .join-entry, .game-choice { border-radius: 12px; }
  .game-choice__icon { border-radius: 10px; }
  .join-row:focus-within { box-shadow: inset 0 0 0 1px var(--k-red-line); }
  .game-choice__copy { min-width: 0; }
  .room-banner { border-radius: 11px; }
}
</style>
