<template><view class="uc-page tools"><k-topbar title="聚会小工具" back :fab="false"/><view class="uc-body">
  <text class="uc-muted">朋友围坐，随时开玩</text><view class="tool-tabs"><button v-for="item in tabs" :key="item.key" :class="{on:tab===item.key}" @click="tab=item.key">{{item.label}}</button></view>
  <template v-if="tab==='cards'"><view class="tool-kind"><button :class="{on:kind==='truth'}" @click="changeKind('truth')">真心话</button><button :class="{on:kind==='dare'}" @click="changeKind('dare')">大冒险</button></view><view class="party-card"><k-icon :name="kind==='truth'?'heart':'sparkles'" color="green" :size="30"/><text class="party-card__type">{{kind==='truth'?'真心话':'大冒险'}}</text><text class="party-card__text">{{card||'抽一张卡，让聊天有个新开头。'}}</text><text class="uc-muted">{{seen[kind].length}} / 20 · 本轮不重复</text></view><k-button block @click="draw">{{card?'再抽一张':'抽一张'}}</k-button><text class="tools-note">不想回答或完成可以直接跳过，尊重每个人的选择。</text></template>
  <template v-if="tab==='dice'"><view class="party-card"><text class="party-card__type">好友同步骰子</text><text class="party-card__text">朋友各用自己的手机，建房、邀请、轮流摇骰，结果一起看。</text><k-button block @click="go('/pages/party/index')">进入好友桌游</k-button></view></template>
  <template v-if="tab==='timer'"><text class="uc-section-title">给这一轮留点时间</text><view class="tool-options"><button v-for="n in [30,60,120,180]" :key="n" :disabled="running" :class="{on:seconds===n}" @click="chooseTime(n)">{{n<60?n+'秒':n/60+'分'}}</button></view><view class="custom-time"><text>自定义秒数</text><input v-model="custom" type="number" maxlength="4" :disabled="running" placeholder="1–3600" @blur="applyTime"/></view><text class="timer-digits" aria-live="polite">{{Math.floor(left/60).toString().padStart(2,'0')}}:{{(left%60).toString().padStart(2,'0')}}</text><text class="timer-state">{{finished?'时间到！':running?'计时中，切屏后仍按实际时间计算':paused?'已暂停':'准备好就开始'}}</text><view class="tool-timer-actions"><k-button block @click="running?pause():start()">{{running?'暂停':paused?'继续':'开始计时'}}</k-button><button class="uc-secondary" @click="reset">重置</button></view></template>
</view></view></template>
<script setup>
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import {ref} from 'vue'
import { onShow, onHide, onUnload, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import {drawCard,rollDice,remainingSeconds} from './party-tools.js'
import {go,toast} from '@/common/screen.js'
const tabs=[{key:'cards',label:'真心话大冒险'},{key:'dice',label:'骰子'},{key:'timer',label:'倒计时'}]
const tab=ref('cards'),kind=ref('truth'),card=ref(''),seen=ref({truth:[],dare:[]}),count=ref(1),dice=ref([]),seconds=ref(60),custom=ref('60'),left=ref(60),running=ref(false),paused=ref(false),finished=ref(false)
let deadline=0,timer
function changeKind(value){kind.value=value;card.value=''}
function draw(){const r=drawCard(kind.value,seen.value[kind.value]);seen.value[kind.value]=r.seen;card.value=r.text}
function roll(){dice.value=rollDice(count.value);uni.vibrateShort?.({fail(){}})}
function chooseTime(n){seconds.value=n;custom.value=String(n);reset()}
function applyTime(){if(running.value)return;const n=Number(custom.value);if(!Number.isInteger(n)||n<1||n>3600){custom.value=String(seconds.value);toast('请输入1到3600的整数秒数');return}seconds.value=n;reset()}
function tick(){if(!running.value)return;left.value=remainingSeconds(deadline);if(!left.value){running.value=false;paused.value=false;finished.value=true;uni.vibrateLong?.({fail(){}});toast('时间到！')}}
function start(){if(!paused.value){applyTime();left.value=seconds.value}deadline=Date.now()+left.value*1000;running.value=true;paused.value=false;finished.value=false}
function pause(){tick();if(!running.value)return;running.value=false;paused.value=true}
function reset(){running.value=false;paused.value=false;finished.value=false;left.value=seconds.value}
onShow(()=>{tick();clearInterval(timer);timer=setInterval(tick,250)});onHide(()=>clearInterval(timer));onUnload(()=>clearInterval(timer))
const pageShareMessage = ()=>({title:'聚会小工具，朋友一起随时开玩',path:'/pages/undercover/tools'})

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>
<style scoped>
.tools{min-height:100vh;background:var(--k-bg);color:var(--k-ink)}.uc-body{padding:20px}.uc-muted,.tools-note{display:block;color:var(--k-muted);font-size:13px;line-height:1.7}.tool-tabs,.tool-kind,.tool-options,.tool-timer-actions{display:flex;gap:8px;margin:20px 0}.tool-tabs button,.tool-kind button,.tool-options button{flex:1;font-size:13px;line-height:22px;padding:11px 3px;margin:0;background:var(--k-paper2);color:var(--k-ink);border-radius:12px}.tool-tabs button:after,.tool-kind button:after,.tool-options button:after{border:0}.tool-tabs .on,.tool-kind .on,.tool-options .on{background:var(--k-green);color:white}.tool-tabs button:first-child{flex:1.6}.party-card{background:var(--k-paper);border:1px solid var(--k-line);border-radius:24px;padding:28px 24px;margin:24px 0;min-height:230px;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;text-align:center}.party-card__type{font-size:12px;letter-spacing:3px;color:var(--k-green)}.party-card__text{font-size:23px;line-height:1.6;font-weight:600;display:block}.tools-note{margin-top:20px;text-align:center}.dice-board{min-height:210px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;background:var(--k-paper);border-radius:24px;margin:28px 0 12px;padding:10px}.die{font-size:76px;line-height:1.2;color:var(--k-red)}.dice-total{display:block;text-align:center;margin:0 0 24px;font-size:18px;font-weight:600}.custom-time{display:flex;align-items:center;gap:16px;font-size:14px}.custom-time input{flex:1;min-width:0;background:var(--k-paper);border:1px solid var(--k-line);border-radius:12px;padding:10px 12px;height:48px;box-sizing:border-box}.timer-digits{display:block;text-align:center;font-size:68px;font-variant-numeric:tabular-nums;font-weight:650;letter-spacing:3px;margin:60px 0 15px;color:var(--k-green)}.timer-state{display:block;text-align:center;font-size:13px;color:var(--k-muted)}.tool-timer-actions :deep(.k-button),.tool-timer-actions .uc-secondary{flex:1}.uc-secondary{padding:10px 24px;line-height:26px;margin:0;font-size:16px;background:var(--k-paper2);color:var(--k-ink);border-radius:24px}
</style>
