<template><view class="wish-page wm-page" :class="$userSurface"><k-topbar :title="wishEnabled ? '我的心愿' : '历史心愿订单'" back :fab="false"/><view class="w-body"><view class="wm-banner"><text class="w-eyebrow">MY LITTLE CONNECTIONS</text><text class="w-title">{{ '每一次帮忙，\n都有回响。' }}</text><view class="wm-banner__art"><k-icon name="heart-handshake" :size="22" color="red"/></view><view class="wm-links"><view class="wm-link"><text @click="go(route('credential'))">我的资质与收款资料</text><k-icon name="chevron-right" :size="12" color="muted"/></view></view></view><view class="w-tabs wm-tabs"><view class="w-tabs__item" :class="{on:role==='publisher'}" @click="setRole('publisher')">我发布的</view><view class="w-tabs__item" :class="{on:role==='helper'}" @click="setRole('helper')">我帮助的</view></view><text class="w-caption wm-explain">一份心愿由一位朋友承接。发布者在<text class="wm-nw">“我发布的”</text>、接单者在<text class="wm-nw">“我帮助的”</text>查看同一订单。</text><scroll-view scroll-x class="wm-filters"><view class="wm-filterrow"><view v-for="s in statuses" :key="s.key" class="w-pill" :class="{on:status===s.key}" @click="status=s.key;load(true)">{{s.label}}</view></view></scroll-view><w-card v-for="item in rows" :key="item.wishId" :item="item" mine/><view v-if="error" class="w-state"><text>{{error}}</text><button class="w-secondary" @click="load(true)">重新加载</button></view><view v-else-if="loading" class="w-state"><text class="w-muted">正在加载…</text></view><view v-else-if="!rows.length" class="w-state"><view class="w-state__art"><k-icon name="heart" :size="28" color="red"/></view><text class="w-heading">还没有这类心愿</text><text v-if="wishEnabled" class="w-muted">发起一个期待，或回应一份善意。</text><button v-if="wishEnabled" class="w-primary" @click="go(role==='publisher'?route('publish'):route('index'))">{{role==='publisher'?'发布心愿':'去帮个忙'}}</button></view><button v-else-if="hasMore" class="w-link" @click="load(false)">加载更多</button></view><w-nav active="mine"/></view></template>
<script setup>
import { wishEnabled } from '@/common/features.js'
import { ref } from 'vue'
import { onLoad,onShow,onReachBottom,onPullDownRefresh } from '@dcloudio/uni-app'
import { wishList } from '@/common/wish-api.js'
import { go } from '@/common/screen.js'
import { route } from './wish.js'
import WCard from './components/w-card.vue'
import WNav from './components/w-nav.vue'
const role=ref('publisher'),status=ref(''),rows=ref([]),error=ref(''),loading=ref(false),hasMore=ref(false)
const statuses=[{key:'',label:'全部'},{key:'pending_payment',label:'待支付'},{key:'reviewing',label:'审核中'},{key:'open',label:'待接单'},{key:'accepted',label:'进行中'},{key:'submitted',label:'待确认'},{key:'completed',label:'已完成'},{key:'disputed',label:'有争议'},{key:'refunding',label:'退款中'},{key:'cancelled',label:'已取消'}]
let page=1,version=0
async function load(reset=true){if(!reset&&loading.value)return;const rev=reset?++version:version;loading.value=true;error.value='';if(reset){page=1;rows.value=[]}try{const d=(await wishList({role:role.value,status:status.value,pageNum:page})).data;if(rev!==version)return;rows.value=reset?d.rows:[...rows.value,...d.rows];hasMore.value=d.hasMore;page++}catch(e){if(rev===version)error.value=e.message||'加载失败'}finally{if(rev===version)loading.value=false;uni.stopPullDownRefresh()}}
function setRole(value){role.value=value;status.value='';load(true)}
onLoad(q=>{role.value=q.role==='helper'?'helper':'publisher'});onShow(()=>load(true));onPullDownRefresh(()=>load(true));onReachBottom(()=>{if(hasMore.value)load(false)})
</script>
<style lang="scss">@import './wish.scss';
/* 2026-11-17 改版「小而精」：顶部横幅换成浅暖色小卡（标题 17），资质入口行 40 高；页签、状态胶囊收小；订单是左图右文的细行。 */
.wm-banner{position:relative;background:linear-gradient(120deg,#FFF8EE,#F6E9D6);color:var(--k-ink);padding:14px 12px 0;border-radius:12px;overflow:hidden}.wm-banner>.k-icon{position:absolute;right:14px;top:14px;opacity:.32}.wm-banner .w-eyebrow{color:var(--k-red-deep)}.wm-banner .w-title{font-size:17px;line-height:1.45}.wm-links{margin-top:10px;border-top:1px solid rgba(154,107,63,.14);color:var(--k-red-deep);font-size:12px}.wm-links text{display:block;height:40px;line-height:40px}.wm-filters{width:100%;margin-bottom:7px;white-space:nowrap}.wm-filterrow{display:inline-flex;gap:6px;padding:3px 0}.wm-filterrow .w-pill{font-size:12px}
.wm-explain{display:block;margin:0 0 7px;line-height:1.65}
/* 11-18 第二轮精修（只动样子）：
   1) 「我的资质与收款资料」的文字箭头换成 12 号灰色图标，放在这一行右端；整行仍然点文字进入（图标不接点按，点到图标也算点文字）；上面的分隔线改发丝线
   2) 状态胶囊横滑条两边各伸出 12 贴到屏幕边，滑到最后一颗右边也留 12，不再贴边被切；间距收到 8 */
.wm-links{position:relative;border-top:0}
.wm-links::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:rgba(154,107,63,.14);transform:scaleY(.5);transform-origin:0 0}
.wm-link{display:flex;align-items:center}
.wm-link>text{flex:1;min-width:0;padding-right:16px}
.wm-link>.k-icon{flex:0 0 auto;margin-left:-16px;margin-right:4px;pointer-events:none}
.wm-filters{width:calc(100% + 24px);margin:0 -12px 8px}
.wm-filterrow{flex-wrap:nowrap;padding:4px 12px}
.wm-explain{margin-bottom:8px}
/* 11-18 第三轮返修（评审第 1 轮）：页签下的说明改 12 号（原来 13 号两行，在引号中间断开） */
.wm-page .wm-explain{font-size:12px;line-height:1.6}
/* 11-18 第三轮返修（评审第 2 轮）：顶部横幅内边距 16（原来 14/12），右上图标同样离边 16 */
.wm-page .wm-banner{padding:16px 16px 0}
.wm-page .wm-banner>.k-icon{right:16px;top:16px}
/* 2026-11-18 第三轮返修（评审第 4 轮）：没有心愿时和广场一样直接放在页面底上（不再套白卡），上下留白 40。 */
.wm-page .w-state{background:transparent;padding:40px 16px}
/* 2026-11-18 第三轮返修（评审第 5 轮）：
   1) 说明里带引号的「我发布的」「我帮助的」各自不断行（字不变）；
   2) 状态胶囊横滑条左边 12、右边 40 渐隐，滑不到头的那颗胶囊淡出，不再被屏幕边硬切在字中间；末尾多留 16。 */
.wm-nw{white-space:nowrap}
.wm-page .wm-filters{-webkit-mask-image:linear-gradient(90deg,transparent 0,black 12px,black calc(100% - 40px),transparent);mask-image:linear-gradient(90deg,transparent 0,black 12px,black calc(100% - 40px),transparent)}
.wm-page .wm-filterrow{padding-right:28px}
/* 2026-11-18 第四轮精修（按微信实拍评审）
   1) 头卡右上图标和营地、手册一个做法：44 白圆 + 22 号暖棕线性图标（不再是半透明的大线框）；
   2) 「我发布的 / 我帮助的」做成分段控件（32 高、浅灰外框、选中白块），紧接状态胶囊横滑条，说明 12 号灰字放到胶囊下面；
      间距固定：头卡到分段 24，分段到胶囊 12，胶囊到说明 8，说明到列表 / 空状态 16；
   3) 没有心愿时按全端空状态放进白卡（上面有分段和筛选），「发布心愿 / 去帮个忙」是 32 高的次按钮。 */
.wm-page .wm-banner__art{position:absolute;right:16px;top:16px;display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:var(--k-paper)}
.wm-page .wm-banner .w-title{padding-right:56px}
.wm-page .w-body{display:flex;flex-direction:column}
.wm-page .wm-tabs{order:-3;display:flex;gap:0;height:32px;margin:24px 0 0;padding:2px;box-sizing:border-box;border-radius:16px;background:var(--k-fill)}
.wm-page .wm-tabs::after{display:none}
.wm-page .wm-tabs>.w-tabs__item{flex:1;height:28px;padding:0;border-radius:14px;font-size:13px;line-height:28px;text-align:center;color:var(--k-muted)}
.wm-page .wm-tabs>.w-tabs__item.on{background:var(--k-paper);color:var(--k-ink);font-weight:600}
.wm-page .wm-tabs>.w-tabs__item.on:after{display:none}
.wm-page .wm-filters{order:-2;margin-top:8px;margin-bottom:0}
.wm-page .wm-explain{margin:4px 0 16px;color:var(--k-muted)}
.wm-page .wm-banner{order:-4}
.wm-page .wm-filterrow .w-pill{height:28px;line-height:28px;border-radius:14px}
.wm-page .w-state{margin:0;padding:32px 16px;gap:0;background:var(--k-paper);border-radius:12px}
.wm-page .w-state>.w-heading{margin-top:12px}
.wm-page .w-state>.w-muted{margin-top:4px}
.wm-page .w-state>.w-primary{margin-top:10px}
/* 2026-11-19 第四轮返修（按复评）：状态横滑胶囊没选中时透明底 + 发丝描边（不再白底），这一屏底色只剩分段控件和卡内状态标签 */
.wm-page .wm-filterrow .w-pill:not(.on){background:transparent;box-shadow:inset 0 0 0 1px var(--k-line)}
/* 2026-11-19 第五轮（按微信实拍复核）：说明放回分段控件正下方（分段 → 说明 8 → 状态胶囊 12 → 列表 / 空状态 12），说明讲的是两个页签，不再夹在筛选和结果中间。 */
.wm-page .wm-explain{order:-2;margin:8px 0 0}
.wm-page .wm-filters{order:-1;width:100%;min-width:0;margin:12px 0;mask-image:linear-gradient(90deg,black calc(100% - 20px),transparent);-webkit-mask-image:linear-gradient(90deg,black calc(100% - 20px),transparent)}
.wm-page .wm-filterrow{padding-left:2px}
</style>
