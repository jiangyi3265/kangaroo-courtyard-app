<template><view class="wc" :class="{'wc--mine':mine}" hover-class="k-press-s" @click="go(route(item.isOwner||item.isHelper?'order':'detail',item.wishId))"><view class="wc-media"><view v-if="item.images?.length" class="wc-media__ph"><k-icon name="image" :size="mine?20:24" color="light"/></view><image v-if="item.images?.length" :src="absUrl(item.images[0])" mode="aspectFill"/><view v-else class="wc-placeholder"><k-icon :name="categoryIcon" :size="mine?20:28" color="red"/><text>{{ categoryText(item.category) }}</text></view><text v-if="!mine" class="wc-city">{{ item.targetCity }}</text></view><view class="wc-body"><view class="wc-title">{{ item.title }}</view><view class="wc-foot"><view><view v-if="mine" class="wc-where"><text v-if="mine" class="wc-status">{{ statusText(item.status) }}</text><k-icon name="map-pin" :size="12" color="muted"/><text>{{ item.targetCity }}</text></view><view class="wc-person"><image v-if="item.publisherAvatar" :src="absUrl(item.publisherAvatar)"/><text>{{ item.publisherName || '心愿发布者' }}</text></view><text class="wc-origin">{{ item.originCity }} · {{ categoryText(item.category) }}</text></view><view class="wc-price"><text v-if="item.mode==='free'" class="wc-free">免费</text><text v-else>¥{{ money(item.amountFen) }}</text><text class="wc-price-note">{{ item.mode==='free'?'让善意发生':'已含 1% 加价' }}</text></view></view></view></view></template>
<script setup>
import { computed } from 'vue'
import { absUrl } from '@/common/upload.js'
import { go } from '@/common/screen.js'
import { route,money,categories,categoryText,statusText } from '../wish.js'
const props=defineProps({item:Object,mine:Boolean})
const categoryIcon=computed(()=>categories.find(x=>x.key===props.item.category)?.icon||'heart')
</script>
<style scoped>
/* 2026-11-17 改版「小而精」：广场里是两列小卡片（照片在上、标题两行、发布人、出发地、价格），「我的心愿」里是左图右文的细行、状态标签放右上角。
   照片完整露出，城市角标是白色小胶囊；卡片 12 圆角、不描边不加阴影。文字和点击去向不变。 */
.wc{position:relative;display:flex;flex-direction:column;border-radius:12px;background:var(--k-paper);overflow:hidden}
.wc-media{height:260rpx;position:relative;flex:0 0 auto;background:var(--k-paper2)}.wc-media>image{display:block;width:100%;height:100%}
.wc-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,var(--k-red-soft),var(--k-green-soft));color:var(--k-red-deep);font-size:12px;font-weight:500}
.wc-city,.wc-status{position:absolute;top:6px;max-width:70%;height:17px;box-sizing:border-box;padding:0 6px;border-radius:9px;background:rgba(255,255,255,.94);color:var(--k-ink);font-size:10px;font-weight:500;line-height:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wc-city{left:6px}.wc-status{right:6px;border-radius:4px;background:var(--k-red-soft);color:var(--k-red-deep)}
.wc-body{flex:1;min-width:0;padding:8px 10px 10px}
.wc-title{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-height:40px;margin-bottom:6px;font-size:14px;font-weight:600;line-height:20px;color:var(--k-ink);overflow-wrap:anywhere}
.wc-foot{display:flex;flex-direction:column;align-items:stretch;gap:4px}.wc-foot>view{min-width:0}
.wc-person{display:flex;align-items:center;gap:5px;min-width:0;font-size:11px;line-height:16px;color:var(--k-ink2)}.wc-person image{width:16px;height:16px;flex:0 0 auto;border-radius:50%}.wc-person text{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wc-origin{display:block;margin-top:1px;color:var(--k-muted);font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wc-price{display:flex;align-items:center;gap:5px;min-width:0;color:var(--k-red);font-size:15px;font-weight:700;line-height:20px;white-space:nowrap;font-variant-numeric:tabular-nums}
.wc-price-note{min-width:0;margin-top:0;color:var(--k-muted);font-size:10px;font-weight:400;overflow:hidden;text-overflow:ellipsis}
.wc-free{height:17px;padding:0 5px;border-radius:4px;background:var(--k-green-soft);color:var(--k-green);font-size:10px;font-weight:500;line-height:17px}
.wc--mine{flex-direction:row;align-items:flex-start;gap:10px;margin-bottom:8px;padding:10px}
.wc--mine .wc-media{position:static;flex:0 0 76px;width:76px;height:76px;border-radius:8px;overflow:hidden}
.wc--mine .wc-placeholder{font-size:10px;gap:3px}
.wc--mine .wc-city{left:14px;top:14px;max-width:68px}.wc--mine .wc-status{right:10px;top:10px;max-width:40%}
.wc--mine .wc-body{display:flex;flex-direction:column;justify-content:space-between;min-height:76px;padding:0}.wc--mine .wc-title{min-height:0;margin-bottom:4px;padding-right:66px;-webkit-line-clamp:2}
.wc--mine .wc-foot{flex-direction:row;align-items:flex-end;justify-content:space-between;gap:8px}.wc--mine .wc-foot>view:first-child{flex:1}
.wc--mine .wc-price{flex:0 0 auto;flex-direction:column;align-items:flex-end;gap:0}
/* 11-18 第三轮返修（评审第 1 轮）：
   1) 广场两列卡按自己的内容高度排：标题只有一行时不再空出一行（去掉标题最小高度）；
   2) 城市角标、价格注、「免费」标签 11 号，角标 20 高；
   3) 「我的心愿」细行：状态标签从右上角挪到价格那一行左边，标题占满整行，卡片内边距 12。 */
.wc-title{min-height:0}
.wc-city,.wc-status{height:20px;font-size:11px;line-height:20px;border-radius:10px}
.wc-price-note{font-size:11px}
.wc-free{height:20px;padding:0 6px;font-size:11px;line-height:20px}
.wc--mine{padding:12px;margin-bottom:12px}
.wc--mine .wc-title{padding-right:0}
.wc--mine .wc-price .wc-status{position:static;max-width:none;order:-1;margin-bottom:4px;border-radius:4px}
.wc--mine .wc-price{flex-direction:column}
/* 11-18 第三轮返修（评审第 2 轮）：
   1) 广场卡正文区内边距 10/12/12（原来左右 10，标题贴边）；
   2) 价格行宽度不够时，「已含 1% 加价」整段换到下一行，不再把最后一个「价」字拆下去；
   3) 「我的心愿」细行：标题占满整行；状态标签和城市一起放到标题下面第一行（标签 + 12 号定位图标 + 城市），城市不再压在缩略图上；
      缩略图 80×80；右边价格块和左边最后一行底部对齐。 */
.wc-body{padding:10px 12px 12px}
.wc-price{flex-wrap:wrap;row-gap:2px}
.wc-price-note{flex:0 0 auto;white-space:nowrap}
.wc--mine .wc-media{flex:0 0 80px;width:80px;height:80px}
.wc--mine .wc-body{min-height:80px}
.wc-where{display:flex;align-items:center;gap:4px;min-width:0;margin-bottom:4px;font-size:11px;line-height:20px;color:var(--k-ink2)}
.wc--mine .wc-where>.wc-status{position:static;flex:0 0 auto;max-width:none;margin-right:4px;border-radius:4px}
.wc-where>text{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wc--mine .wc-price{align-self:flex-end}
/* 11-18 第三轮返修（评审第 3 轮）：
   1) 「我的心愿」细行第一行（状态 + 目的地）伸到价格列下面（价格块贴底，两者上下不重叠），320 宽目的地不再被截成「广西…」；
   2) 广场两列卡「已含 1% 加价」固定单独一行，两列卡底对齐。 */
.wc--mine .wc-foot>view:first-child>.wc-where{margin-right:-104px}
.wc:not(.wc--mine) .wc-price-note{flex:0 0 100%}
/* 2026-11-18 第三轮返修（评审第 4 轮）：图片还没加载出来时图位是浅棕底 + 正中 24 号浅色图片图标，图片加载后盖住；标题折行避开第二行只剩一两个字。 */
.wc-media{background:var(--k-red-soft)}
.wc-media>image{position:relative}
.wc-media__ph{position:absolute;left:50%;top:50%;margin:-12px 0 0 -12px}
.wc-title{text-wrap:balance}
/* 2026-11-18 第三轮返修（评审第 5 轮）：上一轮的「.wc-media>image{position:relative}」也套到了占位图标上（图标本身是 image），
   图标留在文档流里把照片往下推了 12px、卡顶露出一条浅棕带。占位图标的规则提高一级（两个类名），永远绝对定位在图位正中、压在照片下面；
   「我的心愿」细行的图位也改成相对定位，占位图标 20 号同样居中（原来被藏起来，只剩一块空白浅棕方块）。 */
.wc-media>.wc-media__ph{position:absolute;left:50%;top:50%;margin:-12px 0 0 -12px}
.wc--mine .wc-media{position:relative}
.wc--mine .wc-media>.wc-media__ph{margin:-10px 0 0 -10px}
/* 2026-11-18 第四轮精修（按微信实拍评审）：占位图标外面包一层 view，规则只认这层 view —— 照片永远从图位顶边开始，图标压在照片下面、正中。 */
.wc-media>.wc-media__ph,.wc--mine .wc-media>.wc-media__ph{position:absolute;left:0;top:0;right:0;bottom:0;margin:0;display:flex;align-items:center;justify-content:center}
/* 同上：没有照片时的占位按全端无图占位：纯浅棕底（去掉浅棕到浅绿的渐变）+ 28 号线性图标 + 分类名。 */
.wc-placeholder{background:var(--k-red-soft)}
/* 2026-11-19 第四轮返修：广场两列卡等高 —— 卡片撑满格子，正文竖排，最后一块（发布人 / 出发地 / 价格）贴卡底 */
.wc:not(.wc--mine){height:100%;box-sizing:border-box}
.wc:not(.wc--mine) .wc-body{display:flex;flex-direction:column}
.wc:not(.wc--mine) .wc-foot{margin-top:auto}
</style>
