<template>
  <view class="lightbox">
    <view class="find-top"><button @click="$emit('close')">‹ 返回</button><text>{{ index + 1 }} / {{ items.length }}</text></view>
    <view class="object" :key="String(index)+'-'+(item.id || item.kind)" @touchstart="startSwipe" @touchend="endSwipe">
      <view v-if="item.kind==='coupon'" class="voucher"><text>小院住宿体验券</text><text class="amount">满 200 减 30</text><text>设计体验 · 不能抵扣订单</text></view>
      <view v-else-if="flipped" class="reverse"><text>寄自 {{ item.city }}</text><text>路过这里的时候，想把眼前的风景也寄给你。</text><text>—— {{ pet.name }}</text></view>
      <button v-else class="art-button" aria-label="放大查看这件收获" @click="zoom"><image class="find-art" :src="picture" mode="aspectFit" /><text>放大查看</text></button>
      <text class="find-name">{{ item.title }}</text><text class="find-sub">{{ item.city }} · {{ category[item.kind] }}{{ item.rare ? ' · 稀有' : '' }}</text>
    </view>
    <view class="find-controls">
      <button v-if="item.kind==='postcard'" @click="flipped=!flipped">翻面</button>
      <button v-if="['photo','postcard'].includes(item.kind)" @click="$emit('poster',item)">我也去了 · 做海报</button>
      <template v-if="item.kind==='specialty' && !item.redeemed"><button v-if="pet.wishKind==='specialty' && !pet.wishDone" @click="$emit('use','wish',item)">实现愿望</button><button @click="$emit('use','redeem',item)">换 5 积分</button></template>
      <text v-if="item.kind==='specialty' && item.redeemed">这份特产已使用</text>
      <template v-if="['job','stay','activity'].includes(item.kind)"><button @click="$emit('open-link',item)">查看{{ category[item.kind] }}</button><button @click="$emit('use','lead',item)">核对完成奖励</button></template>
      <button v-if="items.length>1" @click="$emit('step',(index+1)%items.length)">下一件 ›</button>
    </view>
  </view>
</template>
<script setup>
import { computed,ref,watch } from 'vue'
import { asset,category,pictures } from './catalog.js'
import { absUrl } from '@/common/upload.js'
const props=defineProps({ items:Array,index:Number,pet:Object })
const emit=defineEmits(['close','step','poster','use','open-link'])
const item=computed(()=>props.items[props.index])
const flipped=ref(false)
watch(item,()=>{flipped.value=false})
const picture=computed(()=>item.value.photo && ['photo','postcard','job','stay','activity'].includes(item.value.kind) ? absUrl(item.value.photo) : asset(pictures[item.value.kind]||'postcard'))
let start=null,ignoreTapUntil=0
function startSwipe(e){start=e.touches?.length===1?e.touches[0]:null}
function endSwipe(e){
  const end=e.changedTouches?.[0]
  if(!start || !end)return
  const dx=end.clientX-start.clientX,dy=end.clientY-start.clientY
  start=null
  if(Math.abs(dx)<44 || Math.abs(dx)<Math.abs(dy)*1.4 || props.items.length<2)return
  ignoreTapUntil=Date.now()+450
  emit('step',(props.index+(dx<0?1:-1)+props.items.length)%props.items.length)
}
function zoom(){
  if(Date.now()<ignoreTapUntil)return
  uni.previewImage({urls:[picture.value],current:picture.value})
}
</script>
<style scoped>
.lightbox .art-button{margin:0;padding:0;background:transparent;color:#fff5df;width:100%;display:flex;align-items:center;flex-direction:column;gap:4px}.art-button text{font-size:12px}
.lightbox{position:absolute;inset:0;z-index:8;background:rgba(39,28,21,.9);color:#fff4dd;display:flex;flex-direction:column;padding:calc(var(--status-bar-height, 24px) + 32px) 20px calc(28px + env(safe-area-inset-bottom));box-sizing:border-box}
.find-top,.find-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.find-top{justify-content:space-between}.object{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;animation:reveal .32s ease-out}.find-art{width:100%;height:48vh}.find-name,.amount{font-size:25px;font-weight:700}.find-sub{font-size:13px;opacity:.8}.voucher,.reverse{display:flex;flex-direction:column;gap:22px;padding:32px;background:#fff2d3;color:#583e23;border:2px dashed #be914e;transform:rotate(-3deg)}.amount{font-size:34px;color:#385c39}.find-controls{justify-content:center}.lightbox button{margin:0;border:0;border-radius:24px;padding:9px 15px;background:#fff4de;color:#503b2a;font-size:14px;line-height:1.4}.lightbox button::after{border:0}@keyframes reveal{from{opacity:.3;transform:scale(.53)}to{opacity:1;transform:scale(1)}}
</style>
