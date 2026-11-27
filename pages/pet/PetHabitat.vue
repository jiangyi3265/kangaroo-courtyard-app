<template>
  <view class="habitat" @touchmove.stop.prevent="move" @touchend="end" @touchcancel="cancel" @mousemove="move" @mouseup="end" @mouseleave="cancelMouse">
    <view class="world" :style="worldStyle">
      <image class="scenery" :src="asset(scene)" mode="aspectFit" />
      <template v-if="pet">
        <button v-if="atHome && pet.name && !pet.trip && !pet.batch && !motion && !playing" class="floor" aria-label="点地毯让袋鼠过来" @click="callHere"/>
        <button v-if="atHome && !pet.name && taps<3" class="egg-target" aria-label="轻敲蛋壳" @click="knock">
          <view class="ground-shadow"/><image :key="taps" class="egg" :class="{'egg-knocked':taps>0}" :src="asset('shell')" mode="aspectFit"/>
          <view v-if="taps>0" class="crack" :class="{'crack-long':taps===2}"/>
        </button>
        <view v-if="visiblePet" class="pet-position" :class="positionClass" :style="actorStyle">
          <view v-if="!inBath" class="ground-shadow"/>
          <view class="body-window" :class="{'in-tub':inBath}">
            <view class="body-turn" :class="{flipped:faceLeft && !motion}">
              <view class="pet-body" :class="bodyClass">
                <image class="pet-image" :src="asset(sprite)" mode="aspectFit"/>
                <text v-if="pet.looks?.hat" class="wear hat">👒</text><text v-if="pet.looks?.scarf" class="wear scarf">🧣</text><text v-if="pet.looks?.flower" class="wear flower">🌷</text>
              </view>
            </view>
          </view>
          <button v-if="pet.name && !motion && !pet.trip && !pet.batch && playing!=='shake'" class="pet-gesture" :aria-label="inBath?'给袋鼠搓泡泡':'摸摸袋鼠'" @touchstart="begin('pet',$event)" @mousedown="mouseBegin('pet',$event)" @click="tapPet"/>
        </view>
        <view v-if="motion==='packing'" class="pack-prop"><image :src="asset('bag')" mode="aspectFit"/></view>
        <button v-if="scene==='feed'" class="snack" :class="{'snack-drag':dragging,'snack-offered':offering}" :style="snackStyle" aria-label="拿苹果片喂给袋鼠，消耗两棵幸运草" @touchstart="begin('snack',$event)" @mousedown="mouseBegin('snack',$event)" @click="tapSnack"><view class="apple-slice"/></button>
        <button v-if="playing==='shake'" class="tree-hit" aria-label="摇一摇窗边树枝" @click="shake"><text>☘</text></button>
        <view v-for="p in particles" :key="p.id" class="particle" :class="'particle-'+p.kind" :style="p.style"><text v-if="p.kind!=='bubble'">{{ p.kind==='leaf'?'☘':p.kind==='ring'?'':'♥' }}</text></view>
        <view v-if="pet.looks?.room==='stars' && atHome" class="starshine">✧　　　·　　　✦</view>
      </template>
    </view>
  </view>
</template>
<script setup>
import {computed,getCurrentInstance,onMounted,onUnmounted,ref,watch,nextTick} from 'vue'
import {asset} from './catalog.js'
const props=defineProps({scene:String,pet:Object,taps:Number,playing:String,motion:String,pose:String,busy:Boolean,due:Boolean,effect:Boolean})
const emit=defineEmits(['knock','care','activity'])
const atHome=computed(()=>props.scene==='room'),inBath=computed(()=>props.scene==='bath')
const bounds=ref({left:0,top:0,width:375,height:750})
const instance=getCurrentInstance()
function measure(){
  const query=uni.createSelectorQuery().in(instance.proxy)
  query.select('.habitat').boundingClientRect(r=>{if(r?.width && r.height)bounds.value=r}).exec()
}
onMounted(()=>{
  nextTick(measure)
  // #ifdef H5
  window.addEventListener('resize',measure)
  // #endif
  // #ifdef MP-WEIXIN
  uni.onWindowResize(measure)
  // #endif
})
const geometry=computed(()=>{
  const b=bounds.value,ratio=props.scene==='feed'?842/1869:props.scene==='bath'?910/1728:911/1727
  const height=b.width/b.height>.8?b.height:Math.max(b.height,b.width/ratio)
  return {width:height*ratio,height,left:(b.width-height*ratio)/2,top:(b.height-height)/2}
})
const worldStyle=computed(()=>{const g=geometry.value;return {width:g.width+'px',height:g.height+'px',left:g.left+'px',top:g.top+'px'}})
const x=ref(39),y=ref(72),faceLeft=ref(false),reaction=ref(''),dragging=ref(false),offering=ref(false)
const apple=ref(null),particles=ref([])
let gesture=null,reactionTimer,offerTimer,particleTimers=[],serial=0,suppressClick=0,lastPulse=0,rubDistance=0,careLatched=false
const position=computed(()=>inBath.value?{x:50,y:63}:props.scene==='feed'?{x:45,y:71}:{x:x.value,y:y.value})
const actorStyle=computed(()=>({left:position.value.x+'%',top:position.value.y+'%'}))
const visiblePet=computed(()=>props.pet && (props.pet.name||props.taps>=3) && (!props.pet.trip||props.due||props.motion))
const positionClass=computed(()=>({'pet-leaving':props.motion==='leave','pet-arriving':props.motion==='arrive','new-pet':!props.pet?.name,'bath-pet':inBath.value}))
const sprite=computed(()=>{
  if(props.motion)return props.pose
  if(reaction.value==='walk')return 'hop'
  if(reaction.value==='chew')return 'reach'
  return 'level-'+(props.pet?.level||0)
})
const bodyClass=computed(()=>props.motion==='leave'||props.motion==='arrive'?'hop':reaction.value||'breathe')
const snackStyle=computed(()=>{
  const p=apple.value || {x:78,y:78}
  return {left:p.x+'%',top:p.y+'%'}
})
function point(evt){
  const t=evt.touches?.[0]||evt.changedTouches?.[0]||evt.detail||evt
  const cx=t.clientX??t.x??evt.clientX,cy=t.clientY??t.y??evt.clientY
  if(!Number.isFinite(cx)||!Number.isFinite(cy))return null
  const g=geometry.value,b=bounds.value
  return {x:(cx-b.left-g.left)*100/g.width,y:(cy-b.top-g.top)*100/g.height}
}
function react(value,ms){
  clearTimeout(reactionTimer);reaction.value=value;reactionTimer=setTimeout(()=>reaction.value='',ms)
}
function burst(kind,p){
  const id=++serial,offset=(id%3-1)*2
  particles.value=[...particles.value.slice(-8),{id,kind,style:{left:(p.x+offset)+'%',top:p.y+'%'}}]
  const timer=setTimeout(()=>{particles.value=particles.value.filter(v=>v.id!==id);particleTimers=particleTimers.filter(v=>v!==timer)},870)
  particleTimers.push(timer)
}
function knock(){burst('ring',{x:39,y:65});emit('knock')}
function callHere(e){
  const p=point(e);if(!p)return
  faceLeft.value=p.x<x.value;x.value=Math.max(18,Math.min(80,p.x));y.value=Math.max(62,Math.min(79,p.y))
  burst('ring',{x:x.value,y:y.value});react('walk',620)
}
function tapPet(){
  if(Date.now()<suppressClick)return
  if(inBath.value){rub({x:50,y:58},22);return}
  react('nuzzle',650);burst('heart',{x:position.value.x+6,y:position.value.y-10})
  if(props.playing==='touch')emit('activity')
}
function shake(){burst('leaf',{x:28,y:27});react('nuzzle',600);emit('activity')}
function begin(kind,e){
  if(props.busy||props.motion||careLatched||offering.value)return
  const p=point(e);if(!p)return
  gesture={kind,prev:p,origin:p,dist:0,mouse:e.type==='mousedown'}
  if(kind==='snack'){dragging.value=true;apple.value=p}
}
function mouseBegin(kind,e){if(Date.now()>=suppressClick)begin(kind,e)}
function rub(p,distance){
  if(props.busy||careLatched||props.effect)return
  rubDistance+=distance;burst('bubble',p);react('wash',430)
  if(rubDistance>=72){rubDistance=0;careLatched=true;emit('care','bath')}
}
function move(e){
  if(!gesture)return
  const p=point(e);if(!p)return
  const g=geometry.value,prev=gesture.prev,d=Math.hypot((p.x-prev.x)*g.width/100,(p.y-prev.y)*g.height/100)
  if(d<3)return
  gesture.dist+=d;gesture.prev=p
  if(gesture.kind==='snack'){apple.value=p;return}
  if(Math.abs(p.x-position.value.x)>15||Math.abs(p.y-(position.value.y-6))>10)return
  if(inBath.value){rub(p,d);return}
  if(Date.now()-lastPulse<150)return
  lastPulse=Date.now();react('nuzzle',550);burst('heart',p)
  if(props.playing==='touch')emit('activity')
}
function offer(){
  if(props.busy||careLatched||offering.value||props.effect)return
  careLatched=true;offering.value=true;apple.value={x:position.value.x+4,y:position.value.y-8};react('chew',700)
  clearTimeout(offerTimer);offerTimer=setTimeout(()=>{offering.value=false;apple.value=null;emit('care','feed')},350)
}
function tapSnack(){if(Date.now()>=suppressClick)offer()}
function end(e){
  if(!gesture)return
  const g=gesture,p=point(e)||g.prev;gesture=null;dragging.value=false
  if(g.kind==='snack'){
    suppressClick=Date.now()+450
    if(g.dist<8||(Math.abs(p.x-position.value.x)<14&&Math.abs(p.y-(position.value.y-6))<10))offer()
    else apple.value=null
  }else if(g.dist>6)suppressClick=Date.now()+450
}
function cancel(){gesture=null;dragging.value=false;if(!offering.value)apple.value=null}
function cancelMouse(){if(gesture?.mouse)cancel()}
watch(()=>props.busy,(busy)=>{if(!busy)careLatched=false})
watch(()=>props.effect,on=>{if(on){react(inBath.value?'wash':'chew',1000);burst(inBath.value?'bubble':'heart',{x:position.value.x+4,y:position.value.y-9})}})
watch(()=>props.motion,v=>{if(v){x.value=39;y.value=72}})
onUnmounted(()=>{
  // #ifdef H5
  window.removeEventListener('resize',measure)
  // #endif
  // #ifdef MP-WEIXIN
  uni.offWindowResize(measure)
  // #endif
  clearTimeout(reactionTimer);clearTimeout(offerTimer);particleTimers.forEach(clearTimeout)
})
</script>
<style scoped>
.habitat,.world,.scenery{position:absolute;inset:0}.habitat{overflow:hidden;touch-action:none;background:#896940;user-select:none}.world{right:auto;bottom:auto}.scenery{width:100%;height:100%;pointer-events:none}
.habitat button{background:transparent;margin:0;padding:0;border:0;line-height:1;overflow:visible}.habitat button::after{border:none}
.floor{position:absolute;left:9%;top:53%;width:83%;height:29%}.egg-target,.pet-position,.snack,.pack-prop{position:absolute;transform:translate(-50%,-100%)}.egg-target{left:39%;top:72%;width:15%;height:8%}
.egg{width:100%;height:100%;position:relative;animation:rock 3.6s ease-in-out infinite;transform-origin:52% 96%}.egg-knocked{animation:knock .52s ease-out,rock 3.6s .52s infinite}.crack{position:absolute;left:47%;top:34%;width:11%;height:17%;border-left:2px solid #845f39;border-bottom:2px solid #845f39;transform:skew(-21deg,23deg)}.crack-long{height:29%}
.ground-shadow{position:absolute;bottom:-2%;left:15%;width:70%;height:12%;border-radius:50%;background:radial-gradient(ellipse,#54352185,transparent 72%)}
.pet-position{width:21%;height:12%;transition:left .6s ease-out,top .6s ease-out;pointer-events:none}.pet-position.new-pet{animation:hatch-in .7s ease-out}.body-window,.body-turn,.pet-body,.pet-image{position:relative;width:100%;height:100%}.body-turn.flipped{transform:scaleX(-1)}.pet-body{transform-origin:50% 90%}.pet-gesture{position:absolute;inset:-8% -10%;width:120%;height:116%;pointer-events:auto}.in-tub{overflow:hidden;height:100%}.in-tub .body-turn{height:153%}
.wear{position:absolute;font-size:16px}.hat{top:4%;left:43%}.scarf{top:45%;left:43%}.flower{right:5%;bottom:20%}.snack{width:13%;height:6%;z-index:2;display:flex;align-items:center;justify-content:center;transition:top .18s,left .18s}.snack-drag{transition:none}.snack-offered{opacity:0;transition:top .3s,left .3s,opacity .35s}
.apple-slice{width:79%;height:48%;border-radius:6% 8% 85% 85%;border-bottom:5px solid #c4442d;background:radial-gradient(ellipse at 47% 10%,#b48549 0% 4%,transparent 5%),linear-gradient(#fff2ba,#f5cf8d);box-shadow:1px 4px 4px #63472855;transform:rotate(-20deg)}
.pack-prop{left:49%;top:73%;width:12%;height:6%;animation:lift-pack 1s ease both}.pack-prop image{width:100%;height:100%}.tree-hit{position:absolute;left:18%;top:23%;width:20%;height:10%;color:#4d7a3d;font-size:36px}.starshine{position:absolute;left:12%;top:20%;color:#fff4ab}
.particle{position:absolute;pointer-events:none;color:#ffb0a7;font-size:23px;text-shadow:0 1px 2px #974929;animation:rise .85s ease-out forwards}.particle-bubble,.particle-ring{width:19px;height:19px;border-radius:50%;border:1.5px solid #fff9e7;background:radial-gradient(circle at 32% 25%,white 6%,transparent 22%),#abddf460}.particle-ring{border-color:#ffedbc;background:transparent;animation:ring .65s ease-out forwards}.particle-leaf{color:#a9ce62}
.breathe{animation:breath 2.4s ease-in-out infinite}.nuzzle{animation:nuzzle .5s ease-in-out infinite}.walk,.hop{animation:hop .26s ease-in-out infinite}.chew{animation:chew .22s ease-in-out infinite}.wash{animation:wiggle .26s ease-in-out infinite}.pet-leaving{animation:depart 2.72s ease-in-out both}.pet-arriving{animation:arrive 2.3s ease-out both}
@keyframes rock{0%,72%,100%{transform:rotate(0)}79%{transform:rotate(3deg)}87%{transform:rotate(-2deg)}}@keyframes knock{20%{transform:rotate(-13deg)}48%{transform:rotate(10deg) translateY(-4%)}75%{transform:rotate(-5deg)}}
@keyframes hatch-in{0%{opacity:0;transform:translate(-50%,-100%) scale(.4)}70%{transform:translate(-50%,-114%) scale(1.08)}}@keyframes breath{50%{transform:scale(1.015,1.04)}}@keyframes nuzzle{50%{transform:rotate(-8deg) translateY(-4%)}}@keyframes hop{50%{transform:translateY(-18%) rotate(-4deg)}}@keyframes chew{50%{transform:rotate(3deg) scale(1.04,.96)}}@keyframes wiggle{50%{transform:rotate(-5deg)}}
@keyframes rise{to{opacity:0;transform:translate(8px,-45px) scale(.7)}}@keyframes ring{to{opacity:0;transform:scale(2.6)}}@keyframes lift-pack{75%,100%{opacity:0;transform:translate(-110%,-180%) rotate(18deg)}}
@keyframes depart{from{left:39%;top:72%}85%{opacity:1}to{left:77%;top:47%;transform:translate(-50%,-100%) scale(.45);opacity:0}}@keyframes arrive{from{left:77%;top:47%;transform:translate(-50%,-100%) scale(.45);opacity:0}20%{opacity:1}to{left:39%;top:72%}}
@media(prefers-reduced-motion:reduce){.egg,.pet-body,.particle,.pack-prop,.new-pet{animation-duration:.01s;animation-iteration-count:1}.pet-position,.snack{transition-duration:.01s}}
</style>
