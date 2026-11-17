<template>
<view class="party-page"><k-topbar :title="room ? (room.mode==='dice'?'好友骰子':'袋鼠大富翁') : '好友桌游'" back :fab="false" />
 <view v-if="!code" class="party-body">
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
  <view class="party-hero"><text class="eyebrow">KANGAROO GAME NIGHT</text><text class="heading">围一桌，
一起去远方。</text><text>各用自己的手机，好友建房同步开玩</text></view>
  <view class="game-choice"><text class="title">袋鼠大富翁</text><text>2–6人 · 掷骰、购地、收租，成为旅行大赢家</text><k-button block :disabled="creating" @click="create('monopoly')">创建大富翁房间</k-button></view>
  <view class="game-choice"><text class="title">好友骰子</text><text>2–8人 · 1–6颗骰子，大家同时看到结果</text><k-button block type="outline" :disabled="creating" @click="create('dice')">创建骰子房间</k-button></view>
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
    <template v-else-if="room.me.host">
     <text class="note">{{room.players.length<2?'还差1位好友。请好友打开邀请后点击“加入并准备”。':'好友已准备，可以开始游戏。'}}</text>
     <k-button block :disabled="busy||room.players.length<2" label="开始游戏" @click="act('start')" />
    </template>
    <text v-if="seatError" class="join-error" role="alert">{{seatError}}</text>
    <view v-if="previousRoom && previousRoom.code!==code" class="previous-room"><text>你还在房间 {{previousRoom.code}}，请先退出原房间再来加入。</text><button class="small" @click="go(api.path(previousRoom.code))">前往原房间</button></view>
   </view>
   <view class="people"><view v-for="p in room.players" :key="p.seat" class="person" :class="{current:room.phase==='playing'&&room.currentSeat===p.seat,out:p.out}"><view class="seat">{{p.seat}}</view><text>{{p.name}}{{room.me?.seat===p.seat?'（我）':''}}</text><text>{{p.out?'已离场':room.mode==='dice'?p.score+' 点':p.money+' 金币'}}</text></view></view>
   <template v-if="room.phase==='waiting'">
    <text class="note">邀请好友后，各自在手机上进入房间。至少2人即可开始。</text><button class="invite" open-type="share" @click="shareHint">邀请好友</button>
    <view v-if="room.mode==='dice' && room.me?.host" class="dice-options"><text>每次摇几颗？</text><button v-for="n in 6" :key="n" :class="{selected:room.diceCount===n}" :disabled="busy" @click="act('settings',{diceCount:n})">{{n}}</button></view>
   </template>
   <view v-if="room.mode==='monopoly' && room.phase!=='waiting'" class="board"><view v-for="t in room.board" :key="t.index" class="tile" :class="{owned:t.ownerSeat}" :style="tileStyle(t.index)"><text>{{t.name}}</text><text>{{t.ownerSeat?t.ownerSeat+'号地产':t.price?'金币 '+t.price:'旅途驿站'}}</text><view class="pawns"><text v-for="p in room.players.filter(x=>!x.out&&x.position===t.index)" :key="p.seat">{{p.seat}}</text></view></view><view class="board-center"><text>袋鼠旅行棋</text><text>第 {{room.round}} 轮</text><text>经过起点 +200</text><text>租金为地价的20%</text></view></view>
   <view v-if="room.phase==='playing'" class="turn-panel"><text class="title">{{room.currentSeat}}号 · {{room.players[room.currentSeat-1]?.name}} 的回合</text><text class="countdown">{{seconds}}秒</text><view class="dice"><text v-for="(d,i) in room.dice" :key="i">{{['','⚀','⚁','⚂','⚃','⚄','⚅'][d]}}</text><text v-if="!room.dice.length">等待掷骰</text></view><k-button v-if="room.canRoll" block :disabled="busy" @click="act('roll')">{{busy?'正在掷骰…':'摇骰子'}}</k-button><k-button v-if="room.canBuy" block :disabled="busy" type="green" @click="act('buy')">购买当前地产</k-button><k-button v-if="room.canEnd" block :disabled="busy" type="outline" @click="act('end')">结束回合 / 跳过购买</k-button><text v-if="!room.canRoll&&!room.canEnd" class="note">{{room.me?.out?'你已离场，可观看本局结果':'等待其他玩家，结果自动同步'}}</text></view>
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
.party-page{min-height:100vh;background:var(--k-bg);color:var(--k-ink)}.party-body{padding:18px 14px calc(32px + var(--k-safe-bottom))}.party-hero{background:#173f33;color:#fff9e9;border-radius:24px;padding:28px 22px;margin-bottom:20px}.party-hero text{display:block;line-height:1.7}.eyebrow{font-size:10px;letter-spacing:2px;opacity:.7}.heading{font-size:32px;font-weight:700;white-space:pre-line;margin:14px 0}.game-choice,.rules,.result,.logs{padding:20px;background:var(--k-paper);border:1px solid var(--k-line);border-radius:20px;margin:16px 0}.game-choice>text,.logs>text,.rules>text{display:block;line-height:1.8;margin-bottom:12px}.title{font-size:18px;font-weight:700}.join-row{display:flex;gap:8px;margin:20px 0}.join-row input{height:52px;box-sizing:border-box;min-width:0;flex:1;background:white;border:1px solid var(--k-line);border-radius:16px;padding:14px}.room-banner{display:flex;justify-content:space-between;align-items:center;background:#173f33;color:white;padding:20px 16px;border-radius:22px;gap:8px}.room-banner text{display:block;line-height:1.8}.room-banner text+text{font-size:12px}.small{font-size:12px;line-height:1.5;padding:10px 12px;margin:8px 0;border-radius:16px;background:#efe7d8;color:#674425;flex-shrink:0}.people{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:20px 0}.person{padding:12px 5px;border:1px solid var(--k-line);border-radius:18px;text-align:center;background:var(--k-paper)}.person text{display:block;font-size:12px;line-height:1.6;overflow-wrap:anywhere}.person.current{border:2px solid #467644;background:#edf3e7}.person.out{opacity:.5}.seat{width:34px;height:34px;line-height:34px;margin:0 auto 6px;border-radius:50%;background:#b47d40;color:white;font-weight:700}.note{display:block;font-size:13px;line-height:1.8;color:var(--k-muted);margin:14px 0}.invite{background:#b47d40;color:white;border-radius:22px;margin:14px 0}.dice-options{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:15px 0}.dice-options button{margin:0;font-size:15px}.selected{background:#376443;color:white}.board{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:repeat(6,minmax(64px,auto));gap:3px;padding:5px;background:#dcd0b6;border-radius:18px;margin:16px -6px}.tile{border-radius:7px;background:#fff9ee;padding:5px 2px;text-align:center;font-size:10px;line-height:1.5;min-width:0}.tile>text{display:block}.tile>text+text{font-size:9px;color:#816743}.tile.owned{background:#e4efd7}.pawns{display:flex;flex-wrap:wrap;gap:2px;justify-content:center}.pawns text{background:#a55c34;color:white;border-radius:50%;width:15px;height:15px;line-height:15px}.board-center{grid-row:2/6;grid-column:2/6;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:14px;color:#335740;background:#eee7d8;font-size:12px;border-radius:20px}.board-center text:first-child{font-size:22px;font-weight:700}.turn-panel{text-align:center;padding:20px;background:#fffdf6;border-radius:20px;border:1px solid var(--k-line)}.turn-panel>.title{display:block;font-size:16px}.countdown{font-size:22px;color:#94703a;line-height:2}.dice{display:flex;justify-content:center;flex-wrap:wrap;font-size:46px;color:#965a2d;min-height:66px;align-items:center}.turn-panel :deep(button){margin-top:10px}.rules{font-size:13px;color:var(--k-muted)}.logs>text{font-size:12px;margin:5px 0}.logs>.title{font-size:16px}.rank{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--k-line);font-size:14px}.exit{margin:20px 0;color:#9a4c31;border:1px solid #dec9b4;background:#fbf3e7;border-radius:20px}.error{margin:16px;padding:18px;border-radius:14px;background:#fff0e7;color:#9b4128}
</style>
