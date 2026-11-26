<template>
<k-feature-gate feature="wish"><view class="wish-page wd-page" :class="$userSurface">
  <template v-if="wish"><view class="wd-hero" :class="{'wd-hero--noimg':!wish.images.length}"><swiper v-if="wish.images.length" class="wd-photos" @change="photoIndex=$event.detail.current"><swiper-item v-for="src in wish.images" :key="src"><image :src="absUrl(src)" mode="aspectFill" @click="preview(src)"/></swiper-item></swiper><view v-else class="wd-photos w-empty-cover"><view class="wd-noimg-art"><k-icon name="heart-handshake" :size="32" color="red"/></view></view><text v-if="wish.images.length>1" class="wd-count">{{photoIndex+1}}/{{wish.images.length}}</text><view class="wd-top"><k-topbar v-if="wish.images.length" back dark bg="transparent" :fab="false"/><k-topbar v-else back bg="transparent" :fab="false"/></view><text class="wd-location">{{wish.targetCity}} · {{categoryText(wish.category)}}</text></view>
    <view class="wd-main"><view class="w-between"><text class="w-tag" :class="{'w-tag--lime':wish.mode==='free'}">{{wish.mode==='free'?'免费互助':'有偿互助'}}</text><text class="w-muted">{{statusText(wish.status)}}</text></view><text class="w-title wd-title">{{wish.title}}</text><view class="w-row"><text class="w-price" :class="{'wd-price--free':wish.mode==='free'}">¥{{money(wish.amountFen)}}</text><text class="w-muted">{{wish.mode==='free'?'善意同行，全程不收费':'已含 1% 加价'}}</text></view><view class="w-rule"/><view class="w-row wd-author"><image v-if="wish.publisherAvatar" class="w-avatar" :src="absUrl(wish.publisherAvatar)"/><view v-else class="w-avatar w-avatar--fallback">{{wish.publisherName?.slice(0,1)||'愿'}}</view><text>{{wish.publisherName||'心愿发布者'}}</text><text class="w-muted">· {{wish.originCity}}</text></view><view class="w-route w-section"><view class="w-row"><k-icon name="map-pin" :size="14" color="ink2"/><text>{{wish.targetCity}}</text></view><k-icon name="arrow-right" :size="16" color="light"/><text>{{wish.originCity}}</text></view><text class="w-copy wd-copy">{{wish.description}}</text><view class="w-row wd-meta"><k-icon name="calendar-days" :size="12" color="muted"/><text>{{String(wish.deadline).slice(0,10)}} 前完成</text><text>· {{deliveryText(wish.delivery)}}</text></view><w-fees :value="wish" :free="wish.mode==='free'"/><view v-if="wish.requiredTypes?.some(t=>t!=='ordinary')" class="w-tip w-section"><k-icon name="shield-check" :size="16" color="red"/><view>实际内容涉及 {{(wish.requiredTypes||[]).filter(t=>t!=='ordinary').map(t=>({food:'食品',tobacco:'烟草',alcohol:'酒类'})[t]).join('、')||'受限品类'}}，服务者须持有效资质及对应城市许可。<text class="w-blue" @click="go(route('credential'))">前往提交资质</text><k-icon name="chevron-right" :size="12" color="muted"/></view></view><text v-if="wish.informationOnly" class="w-caption w-section">平台已核实为线上信息咨询，普通用户可参与，无需食品经<text class="wd-nw">营资质。</text></text><text v-else class="w-caption w-section">普通用户也可参与互助。资质仅按实际服务内容核验；如果只是问答却被要求食品资质，请联系平台复<text class="wd-nw">核分类。</text></text><view class="w-field" @click="go(route('rules'))"><k-icon name="shield-check" :size="16" color="ink2"/><text class="w-grow">互助规则与费用说明</text><k-icon name="chevron-right" :size="12" color="muted"/></view></view>
    <view class="w-bottom"><button v-if="wish.isOwner||wish.isHelper" class="w-primary" @click="go(route('order',id))">查看我的订单</button><button v-else class="w-primary w-primary--lime" :disabled="wish.status!=='open'" @click="acceptOpen=true"><k-icon name="heart-handshake" :size="16" color="white"/>我来帮忙</button></view>
    <view v-if="acceptOpen" class="w-mask" @click="acceptOpen=false"><view class="w-sheet" @click.stop><view class="w-between"><text class="w-heading">让这个心愿，向前一步</text><button class="w-link" @click="acceptOpen=false">关闭</button></view><text class="w-caption">接单后可在订单内与发布者沟通。请先确认城市、交付方式和时间。</text><view class="w-card w-section"><text class="w-heading">{{wish.title}}</text><text class="w-caption">{{wish.targetCity}} → {{wish.originCity}}</text><text class="w-caption">{{String(wish.deadline).slice(0,10)}} · {{deliveryText(wish.delivery)}}</text></view><w-fees :value="wish" :free="wish.mode==='free'"/><view class="w-check" @click="agreed=!agreed"><view class="w-check__box" :class="{on:agreed}"><k-icon v-if="agreed" name="check" :size="14" color="white"/></view><text>我已了解费用与交付要求，具备完成此心愿的能力。</text></view><button class="w-primary w-primary--lime" :disabled="busy||!agreed" @click="accept">{{busy?'正在确认…':'确认接单'}}</button></view></view>
  </template><template v-else><k-topbar title="心愿详情" back :fab="false" :fixed="!error"/><view class="w-state" :class="{'w-state--loading':!error}"><view v-if="!error" class="w-skel wd-skel"><view class="w-skel__photo"/><view class="wd-skel__sheet"><view class="w-skel__bar wd-skel__title"/><view class="w-skel__bar wd-skel__price"/><view class="w-skel__bar"/><view class="w-skel__bar"/><view class="w-skel__bar w-skel__bar--mid"/></view><view class="wd-skel__foot"><view/></view></view><text>{{error||'正在加载心愿…'}}</text><button v-if="error" class="w-secondary" @click="load">重试</button></view></template>
</view></k-feature-gate>
</template>
<script setup>
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { ref } from 'vue'
import { onLoad, onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { wishDetail,wishAccept } from '@/common/wish-api.js'
import { absUrl } from '@/common/upload.js'
import { go,replace,toast } from '@/common/screen.js'
import { route,money,categoryText,deliveryText,statusText } from './wish.js'
import WFees from './components/w-fees.vue'
const id=ref(0),wish=ref(null),error=ref(''),acceptOpen=ref(false),agreed=ref(false),busy=ref(false)
// 11-18 返修（纯展示）：头图多张时右下角显示「第几张 / 共几张」
const photoIndex=ref(0)
async function load(){if(!id.value)return;try{error.value='';wish.value=(await wishDetail(id.value)).data}catch(e){wish.value=null;error.value=e.message||'无法加载心愿'}}
async function accept(){if(busy.value||!agreed.value)return;busy.value=true;try{await wishAccept(id.value);replace(route('order',id.value))}catch(e){toast(e.message||'接单失败');await load()}finally{busy.value=false}}
function preview(src){uni.previewImage({current:absUrl(src),urls:wish.value.images.map(absUrl)})}
onLoad(q=>{id.value=Number(q.id)});onShow(load);const pageShareMessage = ()=>({title:wish.value?.title||'心愿互助',path:route('detail',id.value)})

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>
<style lang="scss">@import './wish.scss';
/* 2026-11-17 改版「小而精」：封面照片完整露出，城市 / 分类用白色小胶囊；正文区 12 圆角、标题和价格收小一档。金额、费用明细、规则入口、接单弹层都在。 */
.wd-hero{position:relative;height:300px;background:#2B2622}.wd-photos{width:100%;height:100%}.wd-photos image{width:100%;height:100%}.wd-top{position:absolute;top:0;left:0;right:0;background:linear-gradient(rgba(20,14,10,.45),transparent);color:var(--k-paper)}.wd-location{position:absolute;bottom:24px;left:12px;height:20px;line-height:20px;background:rgba(255,255,255,.94);color:var(--k-ink);border-radius:10px;padding:0 8px;font-size:11px;font-weight:500}.wd-main{position:relative;margin-top:-12px;background:var(--k-paper);border-radius:12px 12px 0 0;padding:14px 12px 10px}.wd-title{margin:10px 0 6px;font-size:18px;line-height:1.45}.wd-copy{display:block;margin:14px 0}.wd-meta{font-size:11px;color:var(--k-muted);margin-bottom:14px;gap:5px}
/* 11-18 第二轮精修（只动样子）：正文区的间距收进 4/8/12/16 的节奏 —— 段与段之间 12，日期那行到费用明细这种大段之间 16；
   「前往提交资质」的文字箭头换成 12 号灰色图标，跟在字后面 */
.wd-main{padding:16px 12px 12px}
.wd-title{margin:8px 0 4px}
.wd-copy{margin:12px 0}
.wd-meta{margin-bottom:16px}
.wd-main .w-section{margin-top:12px}
.wd-main .w-tip>view>.k-icon{display:inline-block;margin-left:2px;vertical-align:middle}
/* 11-18 返修：箭头原来在可点的字外面，点到箭头没反应。字右边留 14 的内边距（可点范围盖住箭头），箭头往回缩 12、不接点按，点到箭头也算点「前往提交资质」（和「我的心愿」那条链接同一写法） */
.wd-main .w-tip>view>.w-blue{padding-right:14px}
.wd-main .w-tip>view>.w-blue+.k-icon{margin-left:-12px;pointer-events:none}
/* 11-18 第三轮返修（评审第 1 轮）：
   1) 头图多张时，原来的指示点被往上压的白色内容板盖住、选中色还是荧光黄绿 —— 换成头图右下角（内容板上方 12）的「1/2」小胶囊：11 号白字、半透明黑底；
   2) 白色内容板一直铺到底部操作条，下面不再露出一截米色；
   3) 「我来帮忙」的图标换成 16 号「握手爱心」放在字前面（原来的右上箭头一般表示跳到外部链接）；
   4) 发布者行「名字 · 城市」点号两边间距一样。 */
.wd-count{position:absolute;right:12px;bottom:24px;z-index:2;height:20px;padding:0 8px;border-radius:10px;background:rgba(20,14,10,.5);color:var(--k-paper);font-size:11px;font-weight:500;line-height:20px;font-variant-numeric:tabular-nums}
.wd-page .wd-main{min-height:calc(100vh - 288px);box-sizing:border-box}
.wd-page{padding-bottom:0}
.wd-page .wd-main{padding-bottom:calc(88px + env(safe-area-inset-bottom))}
.wd-author>.w-muted{margin-left:-4px}
/* 11-18 第三轮返修（评审第 2 轮）：
   1) 心愿说明正文 14 号、行高 1.6；
   2) 免费心愿顶部的「¥0.00」和费用卡一样用成功绿；
   3) 没有照片时：头图占位改纯色浅棕 + 40 号暖棕图标，高度收到 220；顶栏换深色图标（浅底上白箭头看不见），去掉顶部的黑色渐变。 */
.wd-page .wd-copy{font-size:14px;line-height:1.6;color:var(--k-ink2)}
.wd-page .wd-price--free{color:var(--k-green)}
.wd-page .wd-hero--noimg{height:220px;background:var(--k-red-soft)}
.wd-page .wd-hero--noimg .w-empty-cover{background:var(--k-red-soft)}
.wd-page .wd-hero--noimg .wd-top{background:none;color:var(--k-ink)}
.wd-page .wd-hero--noimg+.wd-main{min-height:calc(100vh - 208px)}
/* 2026-11-18 第三轮返修（评审第 4 轮）：路线条「出发城市 → 目的城市」左对齐、间距 8，读起来是一条路线；没图时图标放进 64 的半透明白圆（32 号），在顶栏以下那块区域里居中。 */
.wd-page .w-route{justify-content:flex-start;gap:8px}
.wd-page .wd-hero--noimg .w-empty-cover{box-sizing:border-box;padding:88px 0 12px}
.wd-noimg-art{display:flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.7)}
/* 2026-11-18 第四轮精修（按微信实拍评审）
   1) 加载骨架照着真实版式画：通栏浅色图位（不留边、不圆角）+ 16 圆角的白色浮层（标题条、价格条、三行正文条）+ 底部 44 高的按钮占位，「正在加载心愿…」12 号灰字放在浮层里，加载完不跳；
   2) 路线条去掉灰底，改成上下两条发丝线中间 44 高的一行，整屏只留费用卡一处带底色。 */
.wd-page .w-state--loading{margin:0;padding:0;border-radius:0;background:var(--k-paper);min-height:calc(100vh - 44px)}
.wd-skel{gap:0}
.wd-skel>.w-skel__photo{padding-top:0;height:212px;border-radius:0;background:var(--k-fill)}
.wd-skel__sheet{position:relative;margin-top:-16px;padding:20px 16px 0;border-radius:16px 16px 0 0;background:var(--k-paper);display:flex;flex-direction:column;gap:12px}
.wd-skel__sheet>.w-skel__bar{background:var(--k-fill)}
.wd-skel__sheet>.wd-skel__title{width:60%;height:20px;border-radius:6px}
.wd-skel__sheet>.wd-skel__price{width:40%;height:24px;margin-bottom:8px;border-radius:6px}
.wd-skel__foot{position:fixed;left:0;right:0;bottom:0;padding:8px 12px calc(8px + env(safe-area-inset-bottom));background:var(--k-paper)}
.wd-skel__foot>view{height:44px;border-radius:22px;background:var(--k-fill)}
.wd-page .w-state--loading>text{margin:16px 16px 0;font-size:12px;text-align:left}
.wd-page .wd-main .w-route{position:relative;min-height:44px;padding:0;border-radius:0;background:transparent}
.wd-page .wd-main .w-route::before,.wd-page .wd-main .w-route::after{content:"";position:absolute;left:0;right:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.wd-page .wd-main .w-route::before{top:0;transform-origin:0 0}
.wd-page .wd-main .w-route::after{bottom:0;transform-origin:0 100%}
/* 2026-11-19 第四轮返修（按复评）：
   1) 费用卡下面的长说明（两行以上）普通折行排满（不再 balance 把「如果」拆开、第一行右边空一截），末尾 4 个字不断行防单字成行（字不变）；
   2) 没图时头图里的图标块往下、城市胶囊离浮层 20，重心不再偏上；
   3) 加载骨架和真实页面一样：顶栏悬浮在图位上（不占位），图位从屏幕顶开始 300 高，浮层盖住图位底 16 —— 加载完照片区不再上下跳。 */
.wd-page .wd-main>.w-caption{text-wrap:pretty}
.wd-nw{white-space:nowrap}
.wd-page .wd-hero--noimg .w-empty-cover{padding:96px 0 28px}
.wd-page .w-state--loading{position:relative;min-height:100vh}
.wd-skel>.w-skel__photo{height:300px}
/* 2026-11-19 第五轮（按微信实拍复核）：加载骨架里「正在加载心愿…」在浮层里水平居中、离上面骨架线 24，不再像一行掉出来的正文。 */
.wd-page .w-state--loading>text{margin:24px 16px 0;text-align:center}
</style>
