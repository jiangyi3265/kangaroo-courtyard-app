<template>
<k-feature-gate feature="wish">
  <view class="wish-page" :class="$userSurface">
    <view class="wish-hero">
      <image class="wish-hero__photo" src="./static/wish-hero.jpg" mode="aspectFill"/>
      <view class="wish-hero__shade"/>
      <k-topbar dark bg="transparent" back custom-back title="心愿互助" :fab="false" @back="leaveSquare" />
      <view class="wish-hero__body"><text class="wish-hero__eyebrow">A LITTLE HELP, A BIG WORLD</text><text class="wish-hero__title">心愿互助</text><text class="wish-hero__copy">你的远方小事，有人顺手帮忙。</text><view class="wish-search"><view class="wish-search__input"><k-icon name="search" :size="16" color="muted"/><input v-model="keyword" placeholder="搜索心愿" confirm-type="search" maxlength="40" @confirm="reload"/><button v-if="keyword" class="wish-search__clear" @click="keyword='';reload()"><k-icon name="x" :size="14" color="muted"/></button></view><button class="wish-search__publish" @click="go(R.wishPublish)"><k-icon name="plus" :size="14" color="white"/>发布心愿</button></view></view>
    </view>
    <view class="wish-discover">
      <view class="wish-filterbar"><view class="wish-filterbar__tabs"><view v-for="t in tabs" :key="t.key" :class="{on:filters.mode===t.key}" @click="filters.mode=t.key;reload()">{{ t.label }}</view></view><view class="w-row" @click="openFilter"><k-icon name="sliders-horizontal" :size="14" color="ink2"/><text>筛选</text><text v-if="filterCount" class="wish-count">{{ filterCount }}</text></view></view>
      <view v-if="filters.city||filters.category" class="wish-active"><text>{{ [filters.city,filters.category?categoryText(filters.category):''].filter(Boolean).join(' · ') }}</text><button @click="filters.city='';filters.category='';reload()">清除</button></view>
      <view class="wish-discover__body">
        <view class="wish-ruleline" @click="go(route('rules'))"><k-icon name="shield-check" :size="12" color="muted"/><text>跨城互助 · 费用透明 · 品类审核</text><k-icon name="chevron-right" :size="12" color="muted"/></view>
        <view class="wish-grid"><w-card v-for="item in rows" :key="item.wishId" :item="item"/></view>
        <view v-if="error" class="w-state"><text>{{ error }}</text><button class="w-secondary" @click="reload">重新加载</button></view>
        <view v-else-if="loading" class="w-state"><text class="w-muted">正在寻找远方的心愿…</text></view>
        <view v-else-if="!rows.length" class="wish-empty"><view class="wish-empty__art"><view class="wish-empty__stamp"><k-icon name="send" :size="28" color="red"/></view><k-icon class="wish-empty__spark" name="sparkles" :size="14" color="light"/></view><text class="w-heading">{{ filterCount || keyword ? '这里的心愿，还在路上' : '第一份心愿，从你开始' }}</text><text class="wish-empty__copy">{{ '一张异地的明信片，一件当地的手作。\n把小小期待交给远方的朋友。' }}</text><button class="w-primary" @click="go(R.wishPublish)">写下我的心愿<k-icon name="arrow-up-right" :size="14" color="red"/></button></view>
        <button v-else-if="hasMore" class="w-link" @click="load(false)">查看更多心愿</button><view v-else class="wish-end">每一份小小心愿，都值得被看见</view>
      </view>
    </view><w-nav active="square"/>
  </view>
</k-feature-gate>
</template>
<script setup>
import { communityEnabled } from "@/common/features.js"
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow, onUnload, onReachBottom, onPullDownRefresh, onShareAppMessage, onShareTimeline, onPageScroll } from '@dcloudio/uni-app'
import { wishList } from '@/common/wish-api.js'
import { go } from '@/common/screen.js'
import R from '@/common/routes.js'
import { categoryText,route } from './wish.js'
import WCard from './components/w-card.vue'
import WNav from './components/w-nav.vue'
function leaveSquare(){ const pages=getCurrentPages(); if(pages.length>1)uni.navigateBack();else uni.reLaunch({url:communityEnabled.value?R.community:R.home}) }
const keyword=ref(''),rows=ref([]),loading=ref(false),error=ref(''),hasMore=ref(false)
const filters=reactive({city:'',category:'',mode:'',min:'',max:'',sort:'latest'})
const tabs=[{key:'',label:'发现'},{key:'paid',label:'有偿'},{key:'free',label:'免费'}]
const filterCount=computed(()=>['city','category','min','max'].filter(k=>filters[k]).length)
let page=1,revision=0
async function load(reset=true){const rev=reset?++revision:revision;if(!reset&&loading.value)return;loading.value=true;error.value='';if(reset){page=1;rows.value=[]}try{const data=(await wishList({...filters,keyword:keyword.value.trim(),pageNum:page})).data;if(rev!==revision)return;rows.value=reset?data.rows:[...rows.value,...data.rows];hasMore.value=data.hasMore;page++}catch(e){if(rev===revision)error.value=e.message||'心愿加载失败'}finally{if(rev===revision)loading.value=false;uni.stopPullDownRefresh()}}
const reload=()=>load(true)
function openFilter(){go(route('filter')+'?value='+encodeURIComponent(JSON.stringify(filters)))}
function receive(value){Object.assign(filters,value)}
onLoad(()=>uni.$on('wish:filter',receive));onUnload(()=>uni.$off('wish:filter',receive));onShow(reload);onPullDownRefresh(reload);onReachBottom(()=>{if(hasMore.value)load(false)})

const pageShareMessage = () => publicShare('/pages/wish/index', {}, '心愿互助 · 让远方的小事有人帮忙')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
// 11-19 第四轮（纯展示）：顶部是深色大图，状态栏和胶囊用白色（pages.json）；滑过大图后换回黑色，免得白字压在浅色内容上看不见
let barDark=false
const setBar=(dark)=>{if(dark===barDark)return;barDark=dark;try{uni.setNavigationBarColor({frontColor:dark?'#000000':'#ffffff',backgroundColor:dark?'#ffffff':'#000000',animation:{duration:0}})}catch(e){}}
onPageScroll(e=>setBar((e&&e.scrollTop)>180))
onShow(()=>{const d=barDark;barDark=!d;setBar(d)})
</script>
<style lang="scss">@import './wish.scss';
/* 2026-11-17 改版「小而精」：顶部照片完整露出，只用上下两道黑色渐变托住白字；搜索框 36 高；心愿改成两列小卡片；页签、筛选、提示行收成细行。入口和文字都在。 */
.wish-hero{position:relative;background:#2B2622;color:var(--k-paper);overflow:hidden}.wish-hero__photo,.wish-hero__shade{position:absolute;width:100%;height:100%;inset:0}.wish-hero__shade{background:linear-gradient(180deg,rgba(20,14,10,.45) 0%,rgba(20,14,10,.1) 38%,rgba(20,14,10,.64) 100%)}.wish-hero__body{position:relative;padding:6px 12px 24px}.wish-hero__eyebrow{font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,.8)}.wish-hero__title{display:block;font-size:22px;font-weight:700;letter-spacing:.5px;line-height:1.4;margin:2px 0 0}.wish-hero__copy{font-size:12px;color:rgba(255,255,255,.92)}
.wish-search{display:flex;gap:8px;margin-top:14px}.wish-search__input{display:flex;align-items:center;gap:6px;flex:1;min-width:0;height:36px;background:rgba(255,255,255,.96);border-radius:18px;padding:0 4px 0 12px;color:var(--k-ink)}.wish-search__input input{min-width:0;flex:1;font-size:13px;height:36px}.wish-search__publish{display:flex;align-items:center;justify-content:center;gap:3px;height:36px;border-radius:18px;background:linear-gradient(135deg,#B5814D,#8E5E33);color:var(--k-paper);font-size:12px!important;font-weight:600;padding:0 12px!important;flex-shrink:0}.wish-search__clear{display:flex;align-items:center;justify-content:center;flex:0 0 32px;width:32px;height:36px;background:transparent;padding:0}
.wish-discover{position:relative;margin-top:-12px;border-radius:12px 12px 0 0;background:var(--k-page);overflow:hidden}.wish-filterbar{background:var(--k-paper);padding:0 12px;display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--k-ink2)}.wish-filterbar>.w-row{height:44px;gap:4px}.wish-filterbar__tabs{display:flex;gap:12px;margin-left:-4px;font-size:15px;font-weight:500;color:var(--k-muted)}.wish-filterbar__tabs>view{position:relative;height:44px;padding:0 4px;line-height:44px}.wish-filterbar__tabs .on{color:var(--k-ink);font-weight:700}.wish-filterbar__tabs .on:after{content:"";position:absolute;left:50%;width:18px;margin-left:-9px;height:3px;bottom:5px;background:var(--k-red);border-radius:2px}.wish-count{min-width:14px;height:14px;box-sizing:border-box;background:var(--k-red);color:var(--k-paper);border-radius:7px;font-size:10px;line-height:14px;text-align:center;padding:0 3px}.wish-active{padding:4px 12px;display:flex;justify-content:space-between;align-items:center;color:var(--k-red-deep);font-size:12px;background:var(--k-red-soft)}.wish-active button{background:transparent;font-size:12px;color:var(--k-muted);padding:0 0 0 12px;height:28px;line-height:28px}
.wish-discover__body{padding:8px 12px}.wish-ruleline{display:flex;align-items:center;gap:5px;min-height:36px;box-sizing:border-box;font-size:11px;color:var(--k-muted);padding:2px 2px 8px}.wish-ruleline text{flex:1}.wish-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:start}.wish-discover__body>.w-link{display:block;margin:4px auto 0}
.wish-empty{text-align:center;background:var(--k-paper);border:0;border-radius:12px;padding:20px 16px;display:flex;flex-direction:column;align-items:center;gap:8px}.wish-empty__art{position:relative;height:64px;display:flex;align-items:center;justify-content:center;width:100px}.wish-empty__stamp{background:linear-gradient(145deg,#FCF4E8,#F4E4CC);border-radius:16px;width:56px;height:56px;display:flex;align-items:center;justify-content:center}.wish-empty__spark{position:absolute;right:8px;top:0;color:var(--k-ochre);font-size:16px}.wish-empty__copy{font-size:12px;line-height:1.8;color:var(--k-muted)}.wish-empty .w-primary{width:100%;box-sizing:border-box;margin-top:8px}.wish-end{padding:16px;text-align:center;font-size:11px;letter-spacing:.5px;color:var(--k-light)}

/* 11-18 第二轮精修（只动样子，配色不动）
   1) 页签和全站下划线页签一样：14 号，未选 400 灰、选中 600 深色，16×3 的短条，一行 40 高（右边「筛选」也是 40）
   2) 没有心愿时：白卡里居中，印章方块 40、圆角 12，✦ 调淡调小；标题 14/500，说明 12 灰字行高 1.6；
      「写下我的心愿」换成 32 高的白底细边小胶囊（宽度随字，上下各 6 的透明边，点按高度仍是 44）——顶上已有「发布心愿」，一屏只留一个实心重点 */
.wish-filterbar>.w-row{height:40px}
.wish-filterbar__tabs{font-size:14px;font-weight:400}
.wish-filterbar__tabs>view{height:40px;line-height:40px}
.wish-filterbar__tabs .on{font-weight:600}
.wish-filterbar__tabs .on:after{width:16px;margin-left:-8px;bottom:4px}
.wish-empty{padding:28px 12px}
.wish-empty__art{width:72px;height:44px}
.wish-empty__stamp{width:40px;height:40px;border-radius:12px}
.wish-empty__spark{right:4px;color:var(--k-light);font-size:10px}
.wish-empty .w-heading{font-size:14px;font-weight:500;line-height:20px;color:var(--k-ink2)}
.wish-empty__copy{line-height:1.6}
.wish-empty .w-primary{width:auto;gap:2px;height:44px;min-height:44px;margin-top:0;padding:0 16px;border:6px solid transparent;border-radius:22px;background:var(--k-paper) padding-box!important;box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep)!important;font-size:13px!important;font-weight:500;line-height:32px}
/* 11-18 第三轮逐页精修：空状态的「✦」字符换成 14 号线性图标；印章方块和全站空状态一样 56、圆角 16、图标 28；说明最宽 260，两行长度接近，不会剩一个字挂在第二行 */
.wish-empty__art{width:88px;height:60px}
.wish-empty__stamp{width:56px;height:56px;border-radius:16px;background:var(--k-red-soft)}
.wish-empty__spark{position:absolute;right:6px;top:2px}
.wish-empty__copy{max-width:260px}
/* 11-18 第三轮返修（评审第 2 轮）：
   1) 头图眉题 11/500、大标题 20/700（按字号档位）；「筛选」的图标 14 号配 12 号字；
   2) 没有心愿时：去掉白卡，空状态直接放在页面底色上，在剩下的高度里居中。 */
.wish-hero__eyebrow{font-size:11px;font-weight:500;letter-spacing:1.2px}
.wish-hero__title{font-size:20px;letter-spacing:0;line-height:1.4}
.wish-empty{justify-content:center;min-height:46vh;box-sizing:border-box;background:transparent;padding:32px 16px}
/* 2026-11-18 第四轮精修（按微信实拍评审）
   1) 头图里的「发布心愿」降成白色半透明玻璃钮（白 18% 底 + 半像素白边、白字），底栏凸起的发布钮成为一屏唯一的暖棕实心；
   2) 页签条、发丝线、规则条连成一块白：规则条贴在页签下面（中间不再露灰底），盾牌图标改灰，箭头对齐右边距；
   3) 没有心愿时按全端空状态放进白卡（上面还有页签和规则条），内边距 32/16。 */
.wish-page .wish-search__publish{height:36px;padding:0 14px!important;gap:4px;border-radius:18px;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 .5px rgba(255,255,255,.35);color:var(--k-paper);font-size:13px!important;font-weight:500;line-height:36px}
.wish-discover__body{padding:0 12px 12px}
.wish-discover__body>.wish-ruleline{position:relative;gap:6px;min-height:36px;margin:0 -12px 8px;padding:0 12px;background:var(--k-paper);font-size:11px;color:var(--k-muted)}
.wish-discover__body>.wish-ruleline::before{content:"";position:absolute;left:12px;right:12px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.wish-empty{min-height:0;margin-top:4px;padding:32px 16px;border-radius:12px;background:var(--k-paper);gap:0}
.wish-empty .w-heading{margin-top:12px}
.wish-empty__copy{margin-top:4px}
.wish-empty .w-primary{margin-top:10px}
/* 2026-11-19 第四轮返修（按复评）：两列卡同一行等高（价格行贴卡底对齐，不再一高一低像缺一块）；空状态离规则行 24；
   照片上的「发布心愿」玻璃钮底色加深一档（暗烟色 32%），照片亮处白字也看得清。 */
.wish-page .wish-grid{align-items:stretch}
.wish-page .wish-empty{margin-top:24px}
.wish-page .wish-search__publish{background:rgba(24,18,14,.32)}
/* 2026-11-19 第五轮（按微信实拍复核）：
   1) 头图副文案 13 号、白字 .95，离大标题 4，在亮云处也看得清；
   2) 没有心愿时空状态卡撑到约半屏、内容垂直居中，第一屏不再上半挤、下半空。 */
.wish-page .wish-hero__copy{margin-top:4px;font-size:13px;color:rgba(255,255,255,.95)}
.wish-page .wish-empty{min-height:44vh;justify-content:center}
</style>
