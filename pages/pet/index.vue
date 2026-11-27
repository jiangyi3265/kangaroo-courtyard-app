<template>
  <view class="pet-screen" :class="{'night':night}">
    <PetHabitat v-if="interactive" :key="background" :scene="background" :pet="pet" :taps="eggTaps" :playing="playing" :motion="motion" :pose="pose" :busy="busy" :due="due" :effect="effect" @knock="knock" @care="care" @activity="activity"/>
    <image v-else class="room" :src="asset(background)" mode="aspectFill" />
    <view class="shade"/>
    <view class="header"><button class="back" aria-label="返回" @click="back">‹</button><view><text class="eyebrow">旅行袋鼠</text><text class="heading">{{ heading }}</text></view></view>
    <template v-if="pet">
      <view v-if="background==='room' && pet.title" class="plaque">{{ pet.title }}</view>
      <image v-if="background==='room' && pet.looks?.room==='sea'" class="sea-view" :src="asset('postcard')" mode="aspectFill"/>
      <view v-if="scene==='tree' && effect" class="drops">﹒﹒﹒</view>
      <button v-if="showBag" class="bag-object" aria-label="打开旅行行囊" @click="unpack"><image :src="asset('bag')" mode="aspectFit"/></button>
      <view v-if="scene==='unpack' && pet.batch" class="floor-finds">
        <button v-for="(item,i) in pet.batch" :key="i" @click="openFind(pet.batch,i)"><image :src="asset(objects[item.kind] || 'book')" mode="aspectFit"/><text>{{ category[item.kind] }}</text></button>
      </view>
      <view class="dock" v-if="!panel && !viewItems.length && !posterItem">
        <text class="caption" v-if="caption">{{ caption }}</text>
        <view v-if="!pet.name" class="actions"><button v-if="eggTaps<3" @click="knock">{{ eggTaps ? '再敲一下' : '轻轻碰一碰' }}</button><template v-else><input class="name-input" v-model="name" maxlength="12" placeholder="给它起名 · 最多6个字" /><button :disabled="busy" @click="adopt">认领</button></template></view>
        <view v-else-if="playing" class="actions"><button @click="activity">陪它玩一下</button><button @click="stopPlay">结束互动</button></view>
        <view v-else-if="scene==='unpack'" class="actions"><button @click="action('collect')">收进收藏册</button></view>
        <view v-else-if="scene==='feed' || scene==='bath'" class="actions"><button :disabled="busy || effect" @click="care(scene)">{{ scene==='feed'?'喂一片苹果':'洗个泡泡澡' }} · 2 草</button><button @click="goHome">回客厅</button></view>
        <view v-else-if="scene==='visit' || scene==='tree'" class="actions"><button v-if="scene==='tree'" @click="action('water',{target:peerId})">给树浇水</button><button v-else @click="leaveNote">留句暗号 · 5 草</button><button @click="goHome">回小窝</button></view>
        <view v-else-if="!motion && !playing" class="actions">
          <button v-if="pet.batch" @click="scene='unpack'">查看行囊</button>
          <button v-else-if="pet.trip && due" @click="unpack">打开带回的行囊</button>
          <button v-else-if="pet.trip" @click="action('speed')">使用加速卡 · {{ pet.stock.speed || 0 }}</button>
          <button v-else @click="openPanel('pack')">准备出发</button>
          <button v-if="!pet.trip && !pet.batch" @click="openPanel('care')">照顾它</button>
          <button @click="openPanel('tools')">更多</button>
        </view>
        <view v-if="pet.name && scene==='home' && !motion && !playing" class="pet-nav"><button v-for="tab in placeTabs" :key="tab[0]" @click="openPanel(tab[0])">{{ tab[1] }}</button></view>
      </view>
      <PetDrawer v-if="panel" :key="panel" :panel="panel" :pet="pet" :album="album" :more="more" :loading-album="loadingAlbum" @close="panel=''" @panel="openPanel" @action="action" @scene="openScene" @play="play" @find="i=>openFind(album,i)" @more="fetchAlbum(true)" @visit="visit" @tree="openTree"/>
      <PetFind v-if="viewItems.length" :items="viewItems" :index="itemIndex" :pet="pet" @close="viewItems=[]" @step="i=>itemIndex=i" @poster="beginPoster" @use="useFind" @open-link="openLink"/>
      <view v-if="posterItem" class="poster">
        <view class="poster-head"><button @click="posterItem=null">‹ 返回</button><text>我也去了</text></view>
        <image v-if="posterUrl" class="preview" :src="posterUrl" mode="aspectFit" />
        <template v-else><image class="preview" :src="portrait || asset('postcard')" mode="aspectFit" />
          <view class="actions"><button @click="avatarPhoto">用微信头像</button><button @click="choosePhoto">选一张照片</button><button @click="cutout=!cutout">抠图 {{ cutout?'开':'关' }}</button></view>
          <text class="hint">纯色背景的人像抠图效果更好。</text></template>
        <view class="actions"><button v-if="!posterUrl" :disabled="!portrait || busy" @click="generate">生成海报</button><template v-else><button @click="posterUrl=''">重新制作</button><button @click="save">保存海报</button><button @click="preview">预览分享</button></template></view>
      </view>
    </template>
    <view v-else class="dock"><text class="caption">{{ error || '正在打开小窝…' }}</text><button v-if="error" @click="refresh">重新打开</button></view>
  </view>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {onShow,onHide,onUnload,onBackPress} from '@dcloudio/uni-app'
import {get,post,getToken} from '@/common/request.js'
import {absUrl} from '@/common/upload.js'
import {experience} from '@/common/experience.js'
import {asset,category,placeTabs} from './catalog.js'
import {makePoster,savePoster} from './poster.js'
import PetHabitat from './PetHabitat.vue'
import PetDrawer from './PetDrawer.vue'
import PetFind from './PetFind.vue'

const endpoint='/app/travel-pet'
const pet=ref(null),error=ref(''),busy=ref(false),scene=ref('home'),panel=ref('')
const motion=ref(''),effect=ref(false),playing=ref(''),seconds=ref(0),pose=ref('idle')
const eggTaps=ref(0),name=ref(''),peerId=ref(0)
const viewItems=ref([]),itemIndex=ref(0),album=ref([]),more=ref(false),loadingAlbum=ref(false)
const posterItem=ref(null),posterUrl=ref(''),portrait=ref(''),cutout=ref(true)
const now=ref(Date.now()),clockOffset=ref(0)
const objects={grass:'clovers',postcard:'card',coupon:'envelope',specialty:'cake',photo:'photos',job:'book'}
let tick,activeMs=0,lastActivity=0,effectTimer,motionTimers=[],alive=true,accountToken='',epoch=0
const serverNow=computed(()=>now.value+clockOffset.value)
const due=computed(()=>!!pet.value?.trip && pet.value.trip.due<=serverNow.value)
const peer=computed(()=>pet.value?.peers?.find(p=>p.peer===peerId.value))
const background=computed(()=>{
  if(!pet.value)return 'room'
  if(!pet.value.name)return 'room'
  if(panel.value==='mail')return pet.value.met?'letter':'mailbox'
  if(['feed','bath','tree','visit'].includes(scene.value))return scene.value
  return 'room'
})
const heading=computed(()=>!pet.value?.name?'袋鼠小窝':scene.value==='tree'?'窗边友谊树':scene.value==='visit'?(peer.value?.nickname||'旅伴')+'的小窝':scene.value==='bath'?'洗个泡泡澡':scene.value==='feed'?'厨房里的零食':pet.value.name+'的小窝')
const night=computed(()=>motion.value==='arrive'||(!motion.value && (due.value||pet.value?.batch||pet.value?.looks?.room==='stars')))
const interactive=computed(()=>['room','feed','bath'].includes(background.value))
const showBag=computed(()=>!panel.value && scene.value==='home' && !motion.value && (due.value||!!pet.value?.batch))
const caption=computed(()=>{
  if(!pet.value?.name)return ['点点地毯上的蛋','蛋晃了一下，再轻敲两次','壳裂开了，再轻敲一次','它探出头啦，给它起个名字'][eggTaps.value]
  if(playing.value)return (playing.value==='touch'?'用手指来回摸摸它':'点窗边的树叶')+' · 还差 '+seconds.value+' 秒'
  if(motion.value)return motion.value==='leave'?'背好啦，出发！':motion.value==='arrive'?'回来啦！':'正在背上行囊'
  if(scene.value==='unpack')return '点地上的一件收获，放大看看'
  if(scene.value==='tree')return peer.value?.wateredAt && serverNow.value-peer.value.wateredAt>=7*86400000?'叶子耷拉下来了，浇点水吧':'和旅伴一起照顾这棵树'
  if(scene.value==='visit')return peer.value?.message || '它们交换了特产，还拍了一张合影'
  if(scene.value!=='home')return effect.value?(scene.value==='bath'?'泡泡冲干净了':'它开心地嚼着苹果片'):(scene.value==='bath'?'在袋鼠身上来回搓出泡泡 · 2 草':'把右边的苹果片拖给它 · 2 草')
  if(pet.value.trip){if(due.value)return '行囊放在地毯上了';const mins=Math.ceil((pet.value.trip.due-serverNow.value)/60000);return '在'+pet.value.trip.city+'探路 · '+Math.floor(mins/60)+'小时'+mins%60+'分后回家'}
  return pet.value.batch?'点开行囊看看':'点地毯叫它过来，摸摸它的头'
})
const toast=message=>uni.showToast({title:message,icon:'none'})
function setPet(data){pet.value=data;clockOffset.value=data.serverTime-Date.now();now.value=Date.now()}
async function refresh(){
  const seq=++epoch, token=getToken()
  if(accountToken!==token){pet.value=null;eggTaps.value=0;name.value='';goHome();viewItems.value=[];album.value=[];posterItem.value=null;accountToken=token}
  error.value=''
  try{const r=await get(endpoint);if(alive && seq===epoch && token===getToken()){setPet(r.data);if(due.value && !motion.value)animateReturn()}}
  catch(e){if(alive && seq===epoch){error.value=e.message||'小窝暂时打不开';pet.value=null}}
}
function clearMotion(){motionTimers.forEach(clearTimeout);motionTimers=[];motion.value='';pose.value='idle'}
function later(fn,ms){motionTimers.push(setTimeout(fn,ms))}
function animateReturn(){
  clearMotion();motion.value='arrive';pose.value='return'
  later(()=>{pose.value='reach'},2300);later(clearMotion,2960)
}
function animateDeparture(){
  clearMotion();panel.value='';scene.value='home';motion.value='packing';pose.value='reach'
  later(()=>{pose.value='pack'},460)
  later(()=>{motion.value='leave';pose.value='hop'},1180)
  later(clearMotion,3900)
}
watch(due,(done,was)=>{if(done&&!was&&pet.value?.trip&&!motion.value)animateReturn()})
async function action(type,args={}){
  if(busy.value||!pet.value)return false
  const token=getToken(),before=pet.value.grass
  busy.value=true
  try{
    const r=await post(endpoint+'/'+type,{...args,revision:pet.value.revision})
    if(!alive||getToken()!==token)return false
    setPet(r.data)
    if(type==='depart')animateDeparture()
    else if(type==='unpack'){clearMotion();scene.value='unpack';panel.value=''}
    else if(type==='collect')goHome()
    else if((['feed','bath'].includes(type) && scene.value===type)||(type==='water' && scene.value==='tree')){effect.value=true;clearTimeout(effectTimer);effectTimer=setTimeout(()=>effect.value=false,2300)}
    else if(!['visit','adopt','speed','openLead'].includes(type)){const gain=r.data.grass-before;toast(gain>0?'幸运草 +'+gain:'已完成')}
    return true
  }catch(e){toast(e.message||'操作失败');if(alive)await refresh();return false}
  finally{busy.value=false}
}
function knock(){
  if(eggTaps.value>=3)return
  eggTaps.value++
  // #ifdef MP-WEIXIN
  if(eggTaps.value===3)uni.vibrateShort({type:'light',fail(){}})
  // #endif
}
function care(kind){if(!busy.value && !effect.value && scene.value===kind)action(kind)}
async function adopt(){await action('adopt',{value:name.value.trim()})}
function unpack(){if(pet.value.batch){scene.value='unpack';return}action('unpack')}
function goHome(){stopPlay();scene.value='home';panel.value='';peerId.value=0;effect.value=false}
function openScene(s){if(pet.value.trip){toast('等袋鼠回家再照顾它');return}panel.value='';scene.value=s}
function openPanel(s){
  if(s==='home'){goHome();return}
  if(['care','pack'].includes(s) && (pet.value.trip||pet.value.batch)){toast('等袋鼠回家并收好行囊后再来');return}
  panel.value=s;if(s==='album')fetchAlbum(false)
}
async function fetchAlbum(append){
  if(loadingAlbum.value)return
  const token=getToken();loadingAlbum.value=true
  try{const r=await get(endpoint+'/album',{before:append?album.value[album.value.length-1]?.id:0});if(!alive||getToken()!==token)return
    album.value=append?album.value.concat(r.data):r.data;more.value=r.data.length===30
  }catch(e){toast(e.message)}finally{loadingAlbum.value=false}
}
function openFind(items,index){viewItems.value=items;itemIndex.value=index}
async function useFind(type,item){
  if(await action(type,{target:item.id})){viewItems.value=[];if(pet.value.batch && type!=='lead')pet.value.batch.forEach(f=>{if(f.id===item.id)f.redeemed=1});if(panel.value==='album')await fetchAlbum(false)}
}
async function openLink(item){
  const target={job:'/pages/jobs/detail?jobId=',stay:'/pages/stays/detail?stayId=',activity:'/pages/community/activity?id='}[item.kind]
  if(target&&item.targetId && await action('openLead',{target:item.id}))uni.navigateTo({url:target+item.targetId})
}
function stopPlay(){playing.value='';activeMs=0;lastActivity=0}
function play(kind){
  if(playing.value || busy.value)return
  if(pet.value.playDay && pet.value.playDay===pet.value.seenDay){toast('今天的互动奖励已领，可以继续摸摸它');panel.value='';return}
  panel.value='';scene.value='home';activeMs=0;lastActivity=0;seconds.value=10;playing.value=kind
}
function activity(){
  if(!playing.value || busy.value)return
  const time=Date.now()
  activeMs+=lastActivity ? Math.min(650,time-lastActivity) : 0
  lastActivity=time;seconds.value=Math.max(0,Math.ceil((10000-activeMs)/1000))
  if(seconds.value===0){const kind=playing.value;stopPlay();action(kind)}
}
async function visit(p){if(await action('visit',{target:p.peer})){peerId.value=p.peer;panel.value='';scene.value='visit'}}
function openTree(p){peerId.value=p.peer;panel.value='';scene.value='tree'}
function leaveNote(){const options=['来蹭饭啦','一起去散步','下次见'];uni.showActionSheet({itemList:options,success:r=>action('note',{target:peerId.value,value:options[r.tapIndex]})})}
function beginPoster(item){posterUrl.value='';portrait.value='';posterItem.value=item}
function avatarPhoto(){const url=absUrl(experience.account?.avatar);if(url)portrait.value=url;else toast('账号还没有头像，可以选一张照片')}
function choosePhoto(){uni.chooseImage({count:1,success:r=>{portrait.value=r.tempFilePaths[0]}})}
async function generate(){if(busy.value||!portrait.value)return;busy.value=true;try{posterUrl.value=await makePoster(posterItem.value,portrait.value,cutout.value,pet.value.name)}catch(e){toast(e.message)}finally{busy.value=false}}
async function save(){try{await savePoster(posterUrl.value);toast('海报已保存')}catch(e){toast(e.message)}}
function preview(){uni.previewImage({urls:[posterUrl.value]})}
function closeLayer(){if(playing.value){stopPlay();return true}if(posterItem.value){posterItem.value=null;return true}if(viewItems.value.length){viewItems.value=[];return true}if(panel.value||scene.value!=='home'){goHome();return true}return false}
function back(){if(!closeLayer())uni.navigateBack({fail:()=>uni.reLaunch({url:'/pages/profile/index'})})}
function stopTimers(){clearInterval(tick);stopPlay();clearTimeout(effectTimer);effect.value=false;clearMotion()}
onBackPress(e=>e.from!=='navigateBack' && closeLayer())
onShow(()=>{alive=true;clearInterval(tick);tick=setInterval(()=>now.value=Date.now(),1000);refresh()})
onHide(stopTimers)
onUnload(()=>{alive=false;++epoch;stopTimers()})
</script>
<style scoped src="./room.css"></style>
