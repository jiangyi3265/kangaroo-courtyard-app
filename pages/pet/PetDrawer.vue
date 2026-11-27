<template>
  <view class="veil" @click.self="$emit('close')">
    <view class="drawer"><view class="drawer-head"><text>{{ labels[panel] || panel }}</text><button @click="$emit('close')">收起</button></view>
      <scroll-view scroll-y class="scroll">
        <template v-if="panel==='tools'">
          <view class="tiles"><button v-for="entry in sections" :key="entry[0]" @click="$emit('panel',entry[0])">{{ entry[1] }}</button></view>
        </template>
        <template v-if="panel==='shop' || panel==='dress'">
          <text class="lead">幸运草 {{ pet.grass }} 株</text>
          <view v-for="entry in panel==='shop'?supplies:wardrobe" :key="entry[0]" class="row">
            <image v-if="entry[0]==='camera'" class="shop-icon" :src="asset('camera')" mode="aspectFit"/>
            <view><text class="name">{{ entry[1] }}</text><text class="hint">{{ entry[3] }} · {{ entry[2] }} 株</text></view>
            <button v-if="panel==='dress' && pet.stock[entry[0]]" @click="action('wear',{value:entry[0]})">{{ Object.values(pet.looks || {}).includes(entry[0])?'卸下':'使用' }}</button>
            <button v-else @click="action('buy',{value:entry[0]})">买入{{ pet.stock[entry[0]]?' · 已有 '+pet.stock[entry[0]]:'' }}</button>
          </view>
        </template>
        <template v-if="panel==='pack'">
          <text class="lead">{{ pet.levelName }} · 已装 {{ packed.length }} / {{ pet.slots }} 件</text>
          <view v-for="entry in supplies.slice(0,4)" :key="entry[0]" class="row">
            <view><text class="name">{{ entry[1] }}</text><text class="hint">{{ entry[3] }} · 已有 {{ pet.stock[entry[0]] || 0 }}</text></view>
            <button @click="toggle(entry[0])">{{ packed.includes(entry[0])?'取出':'装入' }}</button>
          </view>
          <text class="hint">可以轻装出门。行囊用一次，旅程约 2、6、12 或 24 小时。</text>
          <button class="primary" @click="action('depart',{items:packed.slice()})">背上行囊，出发</button>
        </template>
        <template v-if="panel==='care'">
          <view class="tiles"><button @click="$emit('scene','feed')">去厨房喂零食</button><button @click="$emit('scene','bath')">去浴室洗澡</button>
          <button @click="$emit('play','touch')">摸摸头 · 10秒</button><button @click="$emit('play','shake')">摇摇树 · 10秒</button></view>
          <text class="hint">摸头和摇树每天选一次。摇树会掉落 2–5 株幸运草。</text>
        </template>
        <template v-if="panel==='grass'">
          <text class="lead">幸运草 {{ pet.grass }} 株</text>
          <view v-for="entry in grassActions" :key="entry[0]" class="row"><view><text class="name">{{ entry[1] }}</text><text class="hint">{{ entry[2] }}</text></view><button @click="action(entry[0])">领取</button></view>
          <view v-for="(line,i) in (pet.ledger||[])" :key="i" class="row"><text>{{ line.day }} · {{ line.label }}</text><text>{{ line.delta>0?'+':'' }}{{ line.delta }}</text></view>
        </template>
        <template v-if="panel==='growth'">
          <text class="lead">{{ pet.levelName }} · 行囊 {{ pet.slots }} 格</text>
          <view v-for="(row,i) in privileges" :key="row[0]" class="row"><image class="shop-icon" :src="asset('level-'+i)" mode="aspectFit"/><text>{{ row[0] }} · {{ row[1] }} 格</text><text class="hint">{{ row[2] }}</text></view>
        </template>
        <template v-if="panel==='diary'">
          <text class="lead">{{ pet.name }} · {{ pet.personality }}</text><text class="paragraph">{{ pet.diary || '今天是一起生活的第一天。' }}</text>
          <text class="paragraph">{{ pet.mood }} · 亲密度 {{ pet.bond || 0 }}</text>
          <text class="name">我的愿望</text><text class="paragraph">{{ pet.wishDone?'今天的愿望已经实现了。':wishes[pet.wishKind] }}</text>
          <button v-if="!pet.wishDone" @click="pet.wishKind==='specialty'?$emit('panel','album'):$emit('scene',pet.wishKind)">帮它实现</button>
          <text v-if="pet.stock.bouquet" class="paragraph">愿望纪念 · 压花书签</text>
        </template>
        <template v-if="panel==='titles'">
          <text class="lead">当前牌匾 · {{ pet.title || '尚未佩戴' }}</text>
          <view v-for="group in titleGroups" :key="group[0]" class="title-group"><text class="name">{{ group[0] }}</text><view class="tiles">
            <button v-for="label in group.slice(1)" :key="label" :disabled="!pet.titles.includes(label.split(' · ')[0])" @click="action('title',{value:label.split(' · ')[0]})">{{ label }}</button>
          </view></view>
          <button v-if="pet.title" @click="action('title',{value:''})">取下牌匾</button>
        </template>
        <template v-if="panel==='album'">
          <text v-if="!album.length" class="paragraph">{{ loadingAlbum?'正在翻开收藏册…':'收藏册还是空的。等它旅行回来，一起拆开行囊。' }}</text>
          <view v-for="(find,i) in album" :key="find.id" class="row" @click="$emit('find',i)"><view><text class="name">{{ find.title }}</text><text class="hint">{{ find.city }} · {{ category[find.kind] }}</text></view><text>放大 ›</text></view>
          <button v-if="more" @click="$emit('more')">再翻一页</button>
        </template>
        <template v-if="panel==='mail'">
          <view v-if="pet.met" class="letter"><text class="name">和 {{ pet.met.nickname }} 的偶遇明信片</text><text class="hint">送一份小礼物打招呼 · 2 株幸运草</text>
          <text v-if="pet.met.intro" class="hint">{{ pet.met.intro }}</text><view class="tiles"><button @click="social('greet',pet.met.userId,'鲜花')">送一朵花</button><button @click="social('greet',pet.met.userId,'糖果')">送一颗糖</button></view></view>
          <text v-if="!pet.met && !pet.peers.length" class="paragraph">邮筒里还没有信。带上社交喇叭出门，更容易遇见旅伴。</text>
          <view v-for="peer in pet.peers" :key="peer.peer" class="letter"><text class="name">{{ peer.nickname }}</text>
            <button v-if="communityEnabled" @click="seeProfile(peer.peer)">看看对方主页</button>
            <template v-if="peer.state==='pending'"><text class="hint">{{ peer.sender===pet.userId?'已送出，等待回信':'送来了一份'+peer.gift }}</text><view v-if="peer.sender!==pet.userId" class="tiles"><button @click="social('accept',peer.peer)">同意成为旅伴</button><button @click="social('decline',peer.peer)">婉拒</button></view></template>
            <template v-else><text class="hint">默契 {{ peer.affinity }}{{ peer.affinity>=2000?' · 灵魂共振':peer.affinity>=500?' · 默契搭档':'' }}</text>
            <text v-if="peer.message" class="paragraph">{{ peer.message }}</text><view class="tiles"><button @click="$emit('visit',peer)">去串门</button><button @click="$emit('tree',peer)">友谊树</button></view></template>
          </view>
        </template>
      </scroll-view>
    </view>
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { communityEnabled } from '@/common/features.js'
import { asset,supplies,wardrobe,privileges,titleGroups,category } from './catalog.js'
const props=defineProps({ panel:String,pet:Object,album:Array,more:Boolean,loadingAlbum:Boolean })
const emit=defineEmits(['close','action','panel','scene','play','find','more','visit','tree'])
const sections=[['care','照顾它'],['pack','整理行囊'],['dress','永久装扮'],['diary','心情日记'],['grass','幸运草账本'],['growth','等级特权'],['titles','称号收藏']]
const labels=Object.fromEntries([...sections,['tools','小窝生活'],['album','旅行收藏册'],['shop','行囊商店'],['mail','我的邮筒']])
const grassActions=[['harvest','小窝采摘','每日 1–3 株'],['checkin','今日签到','3 株'],['business','业务奖励','当天发布活动或报名换工后可领']]
const wishes={feed:'今天想吃一片脆脆的苹果。',bath:'想在泡泡里好好洗个澡。',specialty:'想尝尝旅行带回来的特产。'}
const packed=ref([])
function action(type,args={}){emit('action',type,args)}
function social(type,target,value){action(type,{target,value})}
function seeProfile(uid){uni.navigateTo({url:'/pages/community/user?uid='+uid})}
function toggle(key){
  if(packed.value.includes(key)){packed.value=packed.value.filter(k=>k!==key);return}
  if(!props.pet.stock[key])return uni.showToast({title:'先去行囊商店购买',icon:'none'})
  if(packed.value.length>=props.pet.slots)return uni.showToast({title:'行囊已经装满',icon:'none'})
  packed.value.push(key)
}
</script>
<style scoped>
.shop-icon{width:42px;height:42px;flex-shrink:0}
.veil{position:absolute;inset:0;z-index:5;background:rgba(35,27,18,.23);display:flex;align-items:flex-end}.drawer{box-sizing:border-box;width:100%;background:#fcf8ef;color:#473c2c;border-radius:24px 24px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -6px 40px #35271520}.drawer-head,.row,.tiles{display:flex;align-items:center;gap:10px}.drawer-head,.row{justify-content:space-between}.drawer-head{font-size:21px;font-weight:700;margin-bottom:12px}.scroll{max-height:60vh}.scroll text{display:block}.row,.letter{padding:13px 0;border-bottom:1px solid #e7dfcf}.tiles{flex-wrap:wrap;margin:10px 0}.lead,.name{font-weight:650}.lead{font-size:18px;margin:12px 0}.hint,.paragraph{font-size:13px;line-height:1.65;margin:4px 0 9px;color:#746553}.title-group{padding:8px 0}.drawer button{margin:0;padding:8px 13px;font-size:13px;line-height:1.5;color:#493d2b;background:#efe5d1;border-radius:16px}.drawer button:after{border:none}.drawer button[disabled]{opacity:.55}.drawer .primary{background:#ffd16b;margin-top:12px;width:100%}
</style>
