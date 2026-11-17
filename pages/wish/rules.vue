<template><view class="wish-page"><k-topbar title="互助规则" back :fab="false"/><k-agreement-reader content-key="wish-rules-20261116" height="65vh" @read="readComplete = $event"><view class="w-body"><view class="wr-hero"><text class="w-eyebrow">KINDNESS, WITH BOUNDARIES</text><text class="w-title">有温度的互助，<br/>有边界的善意。</text><view class="wr-shield"><k-icon name="shield-check" :size="54" color="#102c46"/></view><text class="w-caption">发布前看一看，让彼此的期待更安心。</text></view><view class="w-card"><view class="w-between"><text class="w-heading">01 / 费用怎么计算</text><text class="w-tag">透明计费</text></view><text class="w-copy wr-copy">有偿心愿：发布者填写成本价，展示价为成本价加 1%；发布者支付展示价。完成后按展示价收取 5% 手续费，剩余金额结算给服务者。金额四舍五入到分。</text><view class="wr-example"><view><text>成本</text><text>¥100.00</text></view><text>→</text><view><text>展示价</text><text>¥101.00</text></view><text>→</text><view><text>服务者结算</text><text>¥95.95</text></view></view><view class="wr-free"><k-icon name="heart" :size="19" color="#40572d"/><text>免费互助：发布、完成均不收费。</text></view></view>
  <view class="w-card"><view class="w-between"><text class="w-heading">02 / 不开放的品类</text><text class="wr-closed">禁止发布</text></view><view v-for="r in prohibited" :key="r.title" class="wr-rule"><view class="wr-rule__icon"><k-icon :name="r.icon" :size="21" color="#a85c52"/></view><view><text class="wr-rule__title">{{r.title}}</text><text class="wr-rule__copy">{{r.copy}}</text></view></view></view>
  <view class="w-card"><text class="w-heading">03 / 需单独审核</text><view class="wr-rule"><k-icon name="utensils" :size="23" color="#3166f5"/><view><text class="wr-rule__title">食品类</text><text class="wr-rule__copy">服务者须提供在接单与交付时有效的健康证或食品经营许可证，经平台核实后才能接单。实际内容涉及食品时，选择其他类目同样适用。</text></view></view><view class="wr-rule"><k-icon name="shield-check" :size="23" color="#3166f5"/><view><text class="wr-rule__title">烟草、酒类</text><text class="wr-rule__copy">默认不开放。须提交当地许可证件、适用城市、烟草或酒类范围及有效期，由平台单独核实。服务者须持对应城市与范围的有效许可。</text></view></view><button class="w-secondary" @click="go(route('credential'))">前往资质认证 →</button></view>
  <view class="w-card"><text class="w-heading">04 / 完成与争议</text><text class="w-copy wr-copy">发布内容经平台核实实际品类后进入广场。文字筛查无法识别全部语义，图片需要人工核对。免费心愿同样适用品类和资质要求，沟通或交付中增加受限商品须重新核实。

每份心愿由一位朋友承接。接单后，发布者在“我的心愿 → 我发布的”、接单者在“我的心愿 → 我帮助的”查看同一订单，订单沟通仅双方可见，平台可在处理纠纷时核实。

接单前请确认城市、数量、交付方式与日期，运费等成本应提前约定并计入金额。服务者提交真实交付凭证，由发布者核实后确认完成。

尚未接单时发布者可取消，已支付金额全额原路退回。接单后如有争议，双方可申请平台介入，处理期间暂停结算。

有偿订单完成后，平台审核服务者的收款资料并安排打款。页面显示“待打款”时不代表到账；打款后可查看凭证号。请勿脱离平台另行转账。</text></view></view></k-agreement-reader><view class="w-bottom wr-bottom"><text class="wr-progress">{{remaining>0?`还需阅读 ${remaining} 秒`:(readComplete?'已完成阅读，可以返回':'请继续阅读至规则末尾')}}</text><button class="w-primary" :disabled="!canConfirm" @click="finishRead">{{canConfirm?'已读完，返回':'阅读后确认'}}<k-icon name="check" :size="21" color="#e7f58a"/></button></view></view></template>
<script setup>
import { ref, computed, getCurrentInstance } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
const readComplete=ref(false),remaining=ref(5),instance=getCurrentInstance()
const canConfirm=computed(()=>readComplete.value&&remaining.value===0)
let clock=null,elapsed=0,started=0
function tick(){remaining.value=Math.max(0,Math.ceil((5000-elapsed-(Date.now()-started))/1000));if(!remaining.value)pause()}
function pause(){if(!clock)return;elapsed+=Date.now()-started;clearInterval(clock);clock=null}
onShow(()=>{if(remaining.value&&!clock){started=Date.now();clock=setInterval(tick,200)}})
onHide(pause);onUnload(pause)
function finishRead(){if(!canConfirm.value)return;instance.proxy.getOpenerEventChannel?.().emit('read',true);back()}
import { go,back } from '@/common/screen.js'
import { route } from './wish.js'
const prohibited=[{icon:'pill',title:'药品、医疗器械、保健品',copy:'相关商品的购买、转让与代购均不开放。'},{icon:'heart',title:'活体动物',copy:'不支持购买、运输或其他活体交易。'},{icon:'triangle-alert',title:'违禁品、危险品',copy:'禁止违法商品、危险物品及其相关服务。'},{icon:'shield-alert',title:'涉及人身安全的服务',copy:'代驾、高空作业等高风险服务不开放。'},{icon:'landmark',title:'金融、证件代办、法律服务',copy:'借贷、投资、证件代理、法律咨询等不开放。'}]
</script>
<style lang="scss">@import './wish.scss';.wr-hero{position:relative;padding:10px 0 27px}.wr-hero .w-title{font-size:26px}.wr-shield{position:absolute;right:2px;top:28px;background:#e7f58a;border-radius:25px;padding:12px;transform:rotate(8deg)}.wr-hero .w-caption{margin-top:20px}.wr-copy{display:block;margin-top:17px;font-size:12px;color:#62758b}.wr-example{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#edf2fc;border-radius:12px;padding:15px 10px;margin-top:17px;color:#8d9bb0;font-size:12px}.wr-example>view{display:flex;flex-direction:column;gap:6px;font-size:10px;color:#718095}.wr-example>view text+text{font-size:15px;font-weight:750;color:#102c46}.wr-free{display:flex;align-items:center;gap:8px;background:#f0f5d9;padding:12px;border-radius:10px;margin-top:12px;color:#4f663d;font-size:11px}.wr-closed{color:#aa5a50;background:#fcf0ed;border-radius:6px;padding:4px 7px;font-size:10px}.wr-rule{display:flex;gap:13px;padding:19px 0;border-bottom:1px solid #edf0f5;align-items:flex-start}.wr-rule:last-child{border-bottom:0;padding-bottom:0}.wr-rule__icon{padding:8px;background:#fcf2ef;border-radius:11px}.wr-rule>view:last-child{flex:1;min-width:0}.wr-rule__title{font-size:13px;font-weight:750;display:block}.wr-rule__copy{font-size:11px;line-height:1.85;color:#7a8b9e;display:block;margin-top:5px}.wr-rule+.w-secondary{margin-top:17px}.wr-bottom{flex-direction:column;gap:8px}.wr-bottom .w-primary{width:100%}.wr-progress{font-size:12px;color:#61738a}
</style>
