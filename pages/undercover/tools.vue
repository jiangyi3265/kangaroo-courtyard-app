<template><view class="uc-page tools" :class="$userSurface"><k-topbar title="聚会小工具" back :fab="false"/><view class="uc-body">
  <text class="uc-muted">朋友围坐，随时开玩</text><view class="tool-tabs"><button v-for="item in tabs" :key="item.key" :class="{on:tab===item.key}" @click="tab=item.key">{{item.label}}</button></view>
  <template v-if="tab==='cards'"><view class="tool-kind"><button :class="{on:kind==='truth'}" @click="changeKind('truth')">真心话</button><button :class="{on:kind==='dare'}" @click="changeKind('dare')">大冒险</button></view><view class="party-card"><view class="party-card__icon"><k-icon :name="kind==='truth'?'heart':'sparkles'" color="green" :size="40"/></view><text class="party-card__type">{{kind==='truth'?'真心话':'大冒险'}}</text><text class="party-card__text">{{(card||'抽一张卡，让聊天有个新开头。').slice(0,-3)}}<text class="party-card__tail">{{(card||'抽一张卡，让聊天有个新开头。').slice(-3)}}</text></text><text class="uc-muted">{{seen[kind].length}} / 20 · 本轮不重复</text></view><k-button block @click="draw">{{card?'再抽一张':'抽一张'}}</k-button><text class="tools-note">不想回答或完成可以直接跳过，尊重每个人的选择。</text></template>
  <template v-if="tab==='dice'"><view class="party-card party-card--dice"><view class="party-card__icon"><k-icon name="dice-5" color="green" :size="40"/></view><text class="party-card__type">好友同步骰子</text><text class="party-card__text">朋友各用自己的手机，建房、邀请、轮流摇骰，结果一起看。</text></view><k-button block @click="go('/pages/party/index')">进入好友桌游</k-button></template>
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
/* 11-18 第三轮（按评审）：一级「真心话大冒险 / 骰子 / 倒计时」改成下划线页签，二级「真心话 / 大冒险」改成分段控件，
   倒计时的时长改成 32 高小胶囊——一屏只剩「抽一张 / 开始计时」一个实心按钮。豆绿仍是这个小工具的气氛色（主人待定）。 */
.tools{min-height:100vh;background:var(--k-page);color:var(--k-ink)}
.uc-page.tools :deep(.k-topbar){background:var(--k-page)}
.uc-page.tools :deep(.k-navbar__title){font-family:var(--k-sans);font-size:17px;font-weight:700}
.tools .uc-body{padding:0 16px calc(32px + env(safe-area-inset-bottom))}
/* 返修第 2 轮：副标题左对齐到页边距，不多出一条居中线 */
.tools .uc-body>.uc-muted{display:block;margin:6px 0 0;text-align:left;color:var(--k-muted);font-size:12px;line-height:1.6}
.uc-muted{display:block;color:var(--k-muted);font-size:12px;line-height:1.6}
/* 下划线页签 */
.tool-tabs{display:flex;gap:24px;height:40px;margin:4px 0 0;border-bottom:1px solid var(--k-line)}
.tool-tabs button{position:relative;flex:none;height:40px;padding:0;margin:0;line-height:40px;font-size:14px;color:var(--k-muted);background:transparent;border-radius:0}
.tool-tabs button::after{border:0}
.tool-tabs .on{color:var(--k-ink);font-weight:600}
.tool-tabs .on::before{content:'';position:absolute;left:50%;bottom:0;width:16px;height:3px;margin-left:-8px;border-radius:2px;background:var(--k-green)}
/* 分段控件 */
.tool-kind{display:flex;padding:2px;margin:12px 0 0;background:var(--k-fill);border-radius:18px}
.tool-kind button{flex:1;height:32px;padding:0;margin:0;line-height:32px;font-size:13px;color:var(--k-ink2);background:transparent;border-radius:16px}
.tool-kind button::after{border:0}
.tool-kind .on{background:var(--k-paper);color:var(--k-ink);font-weight:600;box-shadow:var(--uc-lift)}
/* 卡片 */
.party-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:240px;margin:12px 0 16px;padding:32px 24px;box-sizing:border-box;border-radius:12px;background:var(--k-paper);text-align:center}
.party-card__icon{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-bottom:4px;border-radius:16px;background:var(--k-green-soft)}
.party-card__type{font-size:11px;font-weight:500;letter-spacing:2px;color:var(--k-green)}
.party-card__text{display:block;font-size:18px;line-height:1.6;font-weight:600;color:var(--k-ink)}
.party-card .uc-muted{margin-top:4px;font-variant-numeric:tabular-nums}
.party-card :deep(.k-button){width:auto;height:44px;margin-top:16px;padding:0 24px;border-radius:22px;font-size:15px}
/* 骰子卡（返修第 2 轮）：左右排的入口卡——左 56 方块 + 骰子图标，右标题 16/600 + 说明 13，36 高按钮在右下 */
/* 返修第 3 轮：骰子卡和真心话卡同一版式——居中 56 图标块 + 15/600 标题 + 13 号说明，卡外通栏 44 主按钮；卡高和真心话卡一样 */
.party-card--dice{margin-top:12px;min-height:288px}
.party-card--dice .party-card__type{display:block;font-size:15px;font-weight:600;letter-spacing:0;line-height:1.4;color:var(--k-ink)}
.party-card--dice .party-card__text{max-width:216px;margin:0 auto;font-size:13px;font-weight:400;line-height:1.6;color:var(--k-ink2)}
@media (max-width: 360px){.party-card{padding:32px 20px}.party-card__text{font-size:16px}}
.tools .uc-body :deep(.k-button){box-shadow:none}
.tools .uc-body>:deep(.k-button){height:44px;border-radius:22px;font-size:15px}
.tools-note{display:block;margin-top:12px;text-align:center;color:var(--k-muted);font-size:12px;line-height:1.6}
/* 倒计时 */
.tools .uc-section-title{display:block;margin:20px 0 0;font-size:15px;line-height:1.5;font-weight:600}
/* 返修第 2 轮：时长四个选项改成和「真心话 / 大冒险」同款分段控件 */
.tool-options{display:flex;gap:0;margin:12px 0;padding:2px;background:var(--k-fill);border-radius:18px}
.tool-options button{flex:1 1 0;min-width:0;box-sizing:border-box;height:32px;padding:0;margin:0;line-height:32px;font-size:13px;color:var(--k-ink2);background:transparent;border-radius:16px}
.tool-options button::after{border:0}
.tool-options .on{background:var(--k-paper);color:var(--k-ink);font-weight:600;box-shadow:var(--uc-lift)}
.custom-time{display:flex;align-items:center;gap:12px;height:44px;padding:0 4px 0 16px;border-radius:12px;background:var(--k-paper);font-size:14px;color:var(--k-ink2)}
.custom-time input{flex:1;min-width:0;height:44px;padding:0 12px;text-align:right;font-size:15px;background:transparent;border:0;box-sizing:border-box;font-variant-numeric:tabular-nums}
.timer-digits{display:block;margin:40px 0 8px;text-align:center;font-size:64px;line-height:1.1;font-weight:700;letter-spacing:2px;color:var(--k-green);font-variant-numeric:tabular-nums}
.timer-state{display:block;text-align:center;font-size:13px;color:var(--k-muted)}
.tool-timer-actions{display:flex;gap:8px;margin:32px 0 0}
/* 返修第 2 轮：两颗按钮严格等宽（左右内边距都归零） */
.tool-timer-actions :deep(.k-button),.tool-timer-actions .uc-secondary{flex:1 1 0;min-width:0;width:auto;height:44px;padding-left:0;padding-right:0;border-radius:22px;font-size:15px}
.uc-secondary{display:flex;align-items:center;justify-content:center;padding:0 24px;margin:0;line-height:44px;font-weight:600;background:var(--k-paper);color:var(--k-ink2);border:1px solid var(--k-line2);box-sizing:border-box}
.uc-secondary::after{border:0}
/* 返修第 5 轮：真心话 / 骰子卡做成「牌」的比例（最矮 320，两张同高），题目 20 号；骰子说明 15/1.6；
   副标题离页签和下面控件都是 12；倒计时数字上下多留 16，成为这一屏的视觉中心 */
.tools .uc-body>.uc-muted{margin:12px 0 0}
.party-card{min-height:320px}
.party-card__text{font-size:20px;line-height:1.5}
.party-card--dice{min-height:320px}
.party-card--dice .party-card__text{max-width:240px;font-size:15px;line-height:1.6}
.timer-digits{margin:56px 0 24px}
@media (max-width: 360px){.party-card__text{font-size:18px}.party-card--dice .party-card__text{font-size:14px}}
/* ===== 11-18 第四轮（r6）=====
   副标题挪到页签上方当导语，页签直接接分段控件；那张牌吃满屏高（844 高的屏约 460），
   图标不加底 40 号，题目 22/600，计数贴卡底；「抽一张」和说明落在离底 32 + 安全区的拇指区 */
.tools{--uc-lift:0 1px 2px rgba(58, 50, 43, 0.08)}
.tools .uc-body>.uc-muted{margin:4px 0 4px}
.tool-tabs{margin:0}
.tool-kind{margin-top:12px}
.tool-kind button{font-size:14px}
.party-card{position:relative;min-height:calc(100vh - 384px);padding:32px 24px 56px;border-radius:16px}
.party-card__icon{width:auto;height:auto;margin-bottom:8px;background:transparent;border-radius:0}
.party-card__type{font-size:12px}
.party-card__text{font-size:22px;line-height:1.45}
.party-card .uc-muted{position:absolute;left:0;right:0;bottom:20px;margin:0}
.party-card--dice{min-height:calc(100vh - 306px);padding-bottom:32px}
.party-card--dice .party-card__type{font-size:22px;line-height:1.45}
@media (max-height:704px){.party-card,.party-card--dice{min-height:320px}}
@media (max-width:360px){.party-card__text{font-size:20px}.party-card--dice .party-card__type{font-size:20px}}
/* ===== 11-19 第四轮返修 =====
   副标题离顶栏 12、离页签 8；牌面题目 20 号、末 3 个字不折开（单字不成行）；牌里内容放在上 1/3（上下用两个弹性空白 1:2 分），计数仍贴卡底；
   骰子卡比真心话牌高出分段控件那 48，两个页签的主按钮在同一条线；倒计时数字上下按屏高留白，「开始计时」也落在同一条线 */
.tools .uc-body>.uc-muted{margin:12px 0 8px}
.party-card{justify-content:flex-start;min-height:calc(100vh - 396px);padding-top:24px}
.party-card::before,.party-card::after{content:'';flex:1 1 0}
.party-card::after{flex-grow:2}
.party-card__text{font-size:20px;line-height:1.5}
.party-card__tail{white-space:nowrap}
.party-card--dice{min-height:calc(100vh - 348px)}
.party-card--dice .party-card__type{font-size:20px}
.timer-digits{margin:calc((100vh - 580px) * 0.5) 0 24px}
.tool-timer-actions{margin-top:calc((100vh - 580px) * 0.5)}
@media (max-height:704px){.party-card,.party-card--dice{min-height:320px}.timer-digits{margin-top:56px}.tool-timer-actions{margin-top:32px}}
/* 320 宽 17 号：首屏题目 14 个字一行放得下（238 < 248），不再把「新开头」拆开 */
@media (max-width:360px){.party-card__text{font-size:17px}.party-card--dice .party-card__type{font-size:17px}}
/* ===== 11-19 微信复评 =====
   导语 13 号 ink2、上下各 12，像一句开场白而不是掉下来的面包屑；
   牌里内容不再挤在上 1/3：上下弹性留白 1:1.2，图标、类型、题目落在牌的中线略偏上，计数仍贴卡底；
   导语多出的 4–5，从三个页签的弹性高度里扣回来，主按钮仍在同一条线 */
.tools .uc-body>.uc-muted{margin:12px 0;font-size:13px;line-height:20px;color:var(--k-ink2)}
.party-card::after{flex-grow:1.2}
.party-card__type{font-size:13px}
.party-card{min-height:calc(100vh - 400px)}
.party-card--dice{min-height:calc(100vh - 352px)}
.timer-digits{margin-top:calc((100vh - 584px) * 0.5)}
.tool-timer-actions{margin-top:calc((100vh - 584px) * 0.5)}
@media (max-height:704px){.party-card,.party-card--dice{min-height:320px}.timer-digits{margin-top:56px}.tool-timer-actions{margin-top:32px}}
</style>
