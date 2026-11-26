<template><view class="wish-page" :class="$userSurface"><k-topbar title="互助规则" back :fab="false"/><k-agreement-reader content-key="wish-rules-20261116" height="65vh" @read="readComplete = $event" @remaining="remaining = $event"><view class="w-body"><view class="wr-hero"><text class="w-eyebrow">KINDNESS, WITH BOUNDARIES</text><text class="w-title">{{ '有温度的互助，\n有边界的善意。' }}</text><view class="wr-shield"><k-icon name="shield-check" :size="22" color="red"/></view><text class="w-caption">发布前看一看，让彼此的期待更安心。</text></view><view class="w-card"><view class="w-between"><text class="w-heading">01 / 费用怎么计算</text><text class="wr-note">透明计费</text></view><text class="w-copy wr-copy">有偿心愿：发布者填写成本价，展示价为成本价加 1%；发布者支付展示价。完成后按展示价收取 5% 手续费，剩余金额结算给服务者。金额四舍五<text class="wr-nw">入到分。</text></text><view class="wr-example"><view><text>成本</text><text>¥100.00</text></view><k-icon name="chevron-right" :size="12" color="light"/><view><text>展示价</text><text>¥101.00</text></view><k-icon name="chevron-right" :size="12" color="light"/><view><text>服务者结算</text><text>¥95.95</text></view></view><view class="wr-free"><k-icon name="heart" :size="16" color="green"/><text>免费互助：发布、完成均不收费。</text></view></view>
  <view class="w-card"><view class="w-between"><text class="w-heading">02 / 不开放的品类</text><text class="wr-closed">禁止发布</text></view><view v-for="r in prohibited" :key="r.title" class="wr-rule"><view class="wr-rule__icon"><k-icon :name="ruleIcons[r.title]||r.icon" :size="18" color="alert"/></view><view><text class="wr-rule__title">{{r.title}}</text><text class="wr-rule__copy">{{r.copy}}</text></view></view></view>
  <view class="w-card"><text class="w-heading">03 / 需单独审核</text><view class="wr-rule"><view class="wr-rule__icon wr-rule__icon--warm"><k-icon name="utensils" :size="18" color="red"/></view><view><text class="wr-rule__title">食品类</text><text class="wr-rule__copy">服务者须提供在接单与交付时有效的健康证或食品经营许可证，经平台核实后才能接单。实际内容涉及食品时，选择其他类目同<text class="wr-nw">样适用。</text></text></view></view><view class="wr-rule"><view class="wr-rule__icon wr-rule__icon--warm"><k-icon name="shield-check" :size="18" color="red"/></view><view><text class="wr-rule__title">烟草、酒类</text><text class="wr-rule__copy">默认不开放。须提交当地许可证件、适用城市、烟草或酒类范围及有效期，由平台单独核实。服务者须持对应城市与范围的有<text class="wr-nw">效许可。</text></text></view></view><button class="w-secondary w-arrow" @click="go(route('credential'))">前往资质认证<k-icon name="chevron-right" :size="12" color="muted"/></button></view>
  <view class="w-card"><text class="w-heading">04 / 完成与争议</text><text class="w-copy wr-copy">发布内容经平台核实实际品类后进入广场。文字筛查无法识别全部语义，图片需要人工核对。免费心愿同样适用品类和资质要求，沟通或交付中增加受限商品须重<text class="wr-nw">新核实。</text></text><text class="w-copy wr-copy wr-para">每份心愿由一位朋友承接。接单后，发布者在“我的心愿 → 我发布的”、接单者在“我的心愿 → 我帮助的”查看同一订单，订单沟通仅双方可见，平台可在处理纠纷<text class="wr-nw">时核实。</text></text><text class="w-copy wr-copy wr-para">接单前请确认城市、数量、交付方式与日期，运费等成本应提前约定并计入金额。服务者提交真实交付凭证，由发布者核实后确<text class="wr-nw">认完成。</text></text><text class="w-copy wr-copy wr-para">尚未接单时发布者可取消，已支付金额全额原路退回。接单后如有争议，双方可申请平台介入，处理期间暂<text class="wr-nw">停结算。</text></text><text class="w-copy wr-copy wr-para">有偿订单完成后，平台审核服务者的收款资料并安排打款。页面显示“待打款”时不代表到账；打款后可查看凭证号。请勿脱离平台另<text class="wr-nw">行转账。</text></text></view></view></k-agreement-reader><view class="w-bottom wr-bottom"><text class="wr-progress">{{remaining>0?`还需阅读 ${remaining} 秒`:(readComplete?'已完成阅读，可以返回':'请继续阅读至规则末尾')}}</text><button class="w-primary" :disabled="!canConfirm" @click="finishRead">{{canConfirm?'已读完，返回':'阅读后确认'}}</button></view></view></template>
<script setup>
import { ref, computed, getCurrentInstance } from 'vue'
import { AGREEMENT_READ_SECONDS } from '@/common/agreement-progress.js'
const readComplete=ref(false),remaining=ref(AGREEMENT_READ_SECONDS),instance=getCurrentInstance()
const canConfirm=computed(()=>readComplete.value&&remaining.value===0)
function finishRead(){if(!canConfirm.value)return;instance.proxy.getOpenerEventChannel?.().emit('read',true);back()}
import { go,back } from '@/common/screen.js'
import { route } from './wish.js'
// 2026-11-19 纯展示：「活体动物」显示动物图标（原常量里是爱心，像「喜欢」），常量本身不动
const ruleIcons={'活体动物':'bird'}
const prohibited=[{icon:'pill',title:'药品、医疗器械、保健品',copy:'相关商品的购买、转让与代购均不开放。'},{icon:'heart',title:'活体动物',copy:'不支持购买、运输或其他活体交易。'},{icon:'triangle-alert',title:'违禁品、危险品',copy:'禁止违法商品、危险物品及其相关服务。'},{icon:'shield-alert',title:'涉及人身安全的服务',copy:'代驾、高空作业等高风险服务不开放。'},{icon:'landmark',title:'金融、证件代办、法律服务',copy:'借贷、投资、证件代理、法律咨询等不开放。'}]
</script>
<style lang="scss">@import './wish.scss';
/* 2026-11-17 改版「小而精」：规则页 —— 白卡 12 圆角，图标放进 36 的圆角方块（禁止类是浅红底，需审核类是浅暖色），算例和免费提示收成小块。规则文案、算例金额一个字没动。 */
.wr-hero{position:relative;padding:4px 0 14px}.wr-hero .w-title{font-size:20px}.wr-shield{position:absolute;right:2px;top:14px;display:flex;align-items:center;justify-content:center;width:46px;height:46px;background:linear-gradient(145deg,#FCF4E8,#F4E4CC);border-radius:16px}.wr-hero .w-caption{margin-top:10px}.wr-copy{display:block;margin-top:8px;font-size:12px;color:var(--k-ink2)}.wr-example{display:flex;justify-content:space-between;align-items:center;gap:6px;background:var(--k-page);border-radius:8px;padding:10px;margin-top:10px;color:var(--k-light);font-size:12px}.wr-example>view{display:flex;flex-direction:column;gap:2px;font-size:10px;color:var(--k-muted)}.wr-example>view text+text{font-size:14px;font-weight:700;color:var(--k-ink);font-variant-numeric:tabular-nums}.wr-free{display:flex;align-items:center;gap:6px;background:var(--k-green-soft);padding:8px 10px;border-radius:8px;margin-top:8px;color:var(--k-green);font-size:12px}.wr-closed{display:inline-flex;align-items:center;height:17px;color:var(--k-alert);background:var(--k-alert-soft);border-radius:4px;padding:0 5px;font-size:10px;font-weight:500;white-space:nowrap}.wr-rule{display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--k-line);align-items:flex-start}.wr-rule:last-child{border-bottom:0;padding-bottom:0}.wr-rule__icon{display:flex;align-items:center;justify-content:center;flex:0 0 36px;width:36px;height:36px;background:var(--k-alert-soft);border-radius:10px}.wr-rule__icon--warm{background:linear-gradient(145deg,#FCF4E8,#F4E4CC)}.wr-rule>view:last-child{flex:1;min-width:0}.wr-rule__title{font-size:13px;font-weight:600;display:block;color:var(--k-ink)}.wr-rule__copy{font-size:12px;line-height:1.7;color:var(--k-muted);display:block;margin-top:2px}.wr-rule+.w-secondary{margin-top:12px}.wr-bottom{flex-direction:column;gap:6px}.wr-bottom .w-primary{width:100%}.wr-progress{font-size:12px;color:var(--k-muted)}.wish-page .ar{padding:0 12px}.wish-page .ar .w-body{padding:0}
/* 11-18 第二轮精修（只动样子，规则文案和算例金额没动）：
   1) 标题旁的盾牌图标块和全站入口图标一样：44、圆角 12，图标 22
   2) 规则条目之间的线改发丝线，最后一条照旧不画
   3) 算例里步骤之间、「前往资质认证」后面的文字箭头换成 12 号图标（算例里用浅灰，按钮里用灰色） */
.wr-shield{width:44px;height:44px;border-radius:12px}
.wr-rule{position:relative;border-bottom:0}
.wr-rule::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 100%}
.wr-rule:last-child::after{display:none}
.wr-example>.k-icon{flex:0 0 auto}
</style>
<style scoped>
/* 2026-11-18 评审修正：阅读区不再套一个带灰色细描边的大框（框里套白卡、白卡里再套灰块，一层套一层）—— 去掉描边、圆角和内边距，白卡直接放在页面底色上，和页边距对齐；
   滚动条不显示；底部盖一段 24 高、从透明渐到页面底色的渐隐（不挡手指），提示下面还有内容（最后留 24 的空，滑到底时最后一张卡不被渐隐盖住）。
   阅读区在公共组件 k-agreement-reader 里，组件文件和阅读进度的判断都没动，这里只从本页用 :deep 盖它的样子（单独一个 scoped 样式块，小程序和网页版都生效） */
.wish-page :deep(.ar-scroll){border:0;border-radius:0;background:transparent}
.wish-page :deep(.ar){position:relative}
.wish-page :deep(.ar)::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:24px;background:linear-gradient(rgba(247,245,242,0),var(--k-page));pointer-events:none}
.wish-page :deep(.ar-retry){position:relative;z-index:1}
.wish-page :deep(.ar-scroll ::-webkit-scrollbar){display:none;width:0;height:0;color:transparent}
.wish-page :deep(.ar-body){padding:0 0 24px}
/* 11-18 第三轮逐页精修：顶上「请从顶部向下阅读…」原来是一行 15 号暖棕字浮在灰底上、抢了大标题 —— 收成一枚提示小胶囊：28 高、浅棕底、12/500 深棕字，下面留 12 再接标题 */
/* 11-18 第三轮返修（评审第 1 轮）：顶上阅读提示改成一条通栏提示条（36 高、圆角 8、文字居中），左右和下面的白卡对齐；320 宽 11 号保持一行 */
/* 11-18 第三轮返修（评审第 2 轮）：
   1) 标题旁盾牌方块、需审核条目的图标方块改纯色浅棕（去掉渐变高光）；
   2) 阅读区原来固定 65vh，下面和底部操作条之间空着一截 —— 改成「屏幕高 − 顶栏和提示条 − 底部操作条 − 12」，渐隐贴住操作条（只盖高度，阅读进度的判断照旧按实际量到的高度算） */
.wr-shield,.wr-rule__icon--warm{background:var(--k-red-soft)}
.wish-page :deep(.ar-scroll){height:calc(100vh - 234px - env(safe-area-inset-bottom))!important}
/* 11-18 第三轮返修（评审第 3 轮）：「04 / 完成与争议」原文本来按空行分了五段，网页版把换行吃掉成一整面字墙 —— 保留原文换行（pre-line），段与段之间空一行；
   顶部阅读提示条改由公共组件统一（浅棕胶囊），本页原来盖它的三条样式删掉 */
.wr-para{margin-top:8px}
/* 2026-11-18 第三轮返修（评审第 5 轮）：窄屏（<360）顶部阅读提示 12 号、左右 10，一行放下，不再把「才能」拆到两行 */
@media (max-width:359px){.wish-page :deep(.ar-tip){padding-left:10px;padding-right:10px;font-size:12px}}
/* 2026-11-18 第四轮精修（按微信实拍评审）
   1) 每张规则卡只留一处有底色：01 卡里「透明计费」退成 11 号灰字（不要底），免费互助横幅改成卡里一行（上面一条发丝线，14 号绿勾 + 13 号深墨字），只留算例块一块浅灰；
   2) 02 卡禁止品类：图标方块 36、提醒红浅底再淡一半，「活体动物」换成动物图标（原来是爱心，像「喜欢」）；「禁止发布」也退成 11 号红字、不要底；
   3) 正文不在两三个字处断行（按标点和词组折行）。 */
.wr-note{font-size:11px;color:var(--k-muted)}
.wish-page .wr-closed{height:auto;padding:0;background:transparent;font-size:11px;line-height:16px}
.wish-page .wr-free{position:relative;margin-top:12px;padding:12px 0 0;border-radius:0;background:transparent;gap:6px;font-size:13px;color:var(--k-ink)}
.wish-page .wr-free::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.wish-page .wr-rule__icon:not(.wr-rule__icon--warm){position:relative;background:transparent}
.wish-page .wr-rule__icon:not(.wr-rule__icon--warm)::before{content:"";position:absolute;left:0;top:0;right:0;bottom:0;border-radius:10px;background:var(--k-alert-soft);opacity:.55}
.wish-page .wr-rule__icon>.k-icon{position:relative}
.wish-page .wr-rule__copy{text-wrap:pretty}
.wr-nw{white-space:nowrap}
.wish-page .wr-bottom .w-primary{gap:0}
/* 2026-11-18 第四轮精修：顶部阅读提示不再是浅棕胶囊抢在大标题上面 —— 退成一行 12 号灰字（不要底、左对齐），第一眼落到大标题。提示的字和完成后的变化由公共组件管，这里只改样子。 */
.wish-page :deep(.ar-tip){display:block;margin:0 0 8px;padding:0 0 8px;border-radius:0;background:transparent;box-shadow:inset 0 -1px 0 var(--k-line);color:var(--k-muted);font-size:12px;font-weight:400;line-height:18px}
/* 2026-11-19 第四轮返修（按复评）：规则正文不再只在标点处折行（keep-all 让右边参差像诗行）—— 普通折行排满一行，每段最后 4 个字不断行防单字成行（字不变）；顶部阅读提示下面加一条发丝线和阅读区分开。 */
/* 2026-11-19 第五轮（按微信实拍复核）：
   1) 01 卡算例不再是白卡里套一块灰底（卡中卡）：上下各一条发丝线、上下内边距 12，和下面「免费互助」一行同一种分隔；
   2) 02 卡禁止品类图标方块 36、圆角 8、暖灰底，图标仍是提醒红，只有「禁止发布」一处红字，一屏红点不再那么多。 */
.wish-page .wr-example{position:relative;margin-top:12px;padding:12px 0;border-radius:0;background:transparent}
.wish-page .wr-example::before,.wish-page .wr-example::after{content:"";position:absolute;left:0;right:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.wish-page .wr-example::before{top:0}
.wish-page .wr-example::after{bottom:0}
.wish-page .wr-example+.wr-free{margin-top:0}
.wish-page .wr-example+.wr-free::before{display:none}
.wish-page .wr-rule__icon:not(.wr-rule__icon--warm){width:36px;height:36px;flex:0 0 36px}
.wish-page .wr-rule__icon:not(.wr-rule__icon--warm)::before{border-radius:8px;background:var(--k-fill);opacity:1}
</style>
