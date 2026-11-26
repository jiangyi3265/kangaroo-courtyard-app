<template><view class="wish-page wf-page" :class="$userSurface"><k-topbar title="筛选心愿" back :fab="false"/><view class="w-body"><text class="w-eyebrow">FIND YOUR LITTLE CONNECTION</text><text class="w-title">去哪里，帮个忙？</text><view class="wf-sheet"><view class="w-card w-section"><text class="w-heading">帮忙地</text><input v-model="form.city" class="w-input w-section" placeholder="输入城市，如广西阳朔" maxlength="80"/><text class="w-caption">留空则查看所有城市，可输入省、市或地区。</text></view><view class="w-card"><text class="w-heading">互助方式</text><view class="w-pills w-section"><view v-for="t in modes" :key="t.key" class="w-pill" :class="{on:form.mode===t.key}" @click="form.mode=t.key">{{t.label}}</view></view></view><view class="w-card"><text class="w-heading">心愿分类</text><view class="wf-grid"><view v-for="c in categories" :key="c.key" class="wf-category" :class="{on:form.category===c.key}" @click="form.category=form.category===c.key?'':c.key"><view class="wf-category__icon"><k-icon :name="c.icon" :size="22" color="red"/></view><view><text class="wf-category__title">{{c.label}}</text><view class="wf-category__hint"><view class="wf-hint"><text v-for="(s,i) in c.hint.split(' · ')" :key="i" class="wf-hint__seg">{{s}}</text></view></view></view></view></view></view><view class="w-card"><text class="w-heading">展示价格区间</text><view class="w-row w-section"><input v-model="form.min" type="digit" class="w-input" placeholder="最低金额"/><text>—</text><input v-model="form.max" type="digit" class="w-input" placeholder="最高金额"/></view><text class="w-caption">按已含 1% 加价的展示价筛选，单位：元。</text></view><view class="w-card"><text class="w-heading">排序方式</text><view class="w-pills w-section"><view v-for="s in sorts" :key="s.key" class="w-pill" :class="{on:form.sort===s.key}" @click="form.sort=s.key">{{s.label}}</view></view></view></view><view class="w-card wf-rules"><view class="w-field" hover-class="k-press" @click="go(route('rules'))"><k-icon name="info" :size="14" color="muted"/><text class="w-grow">查看品类规则</text><k-icon name="chevron-right" :size="12" color="muted"/></view></view></view><view class="w-bottom"><button class="w-secondary" @click="reset">重置</button><button class="w-primary" @click="apply">查看心愿</button></view></view></template>
<script setup>
import { reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { decodeQuery,go,back,toast } from '@/common/screen.js'
import { categories,route } from './wish.js'
const defaults={city:'',mode:'',category:'',min:'',max:'',sort:'latest'},form=reactive({...defaults})
const modes=[{key:'',label:'全部'},{key:'paid',label:'有偿'},{key:'free',label:'免费'}],sorts=[{key:'latest',label:'最新发布'},{key:'deadline',label:'即将到期'},{key:'price',label:'价格从低到高'}]
onLoad(q=>{let raw=decodeQuery(q).value||'{}';for(let n=0;n<3;n++){try{const saved=JSON.parse(raw);for(const key of Object.keys(defaults))if(typeof saved[key]==='string')form[key]=saved[key];break}catch(e){try{raw=decodeURIComponent(raw)}catch(e){break}}}})
function reset(){Object.assign(form,defaults)}
function apply(){if(['min','max'].some(k=>form[k]!==''&&(!/^\d+(\.\d{1,2})?$/.test(form[k])||Number(form[k])>101000))){toast('请输入有效的价格，最多两位小数');return}if(form.min!==''&&form.max!==''&&Number(form.min)>Number(form.max)){toast('最低金额不能高于最高金额');return}uni.$emit('wish:filter',{...form});back()}
</script>
<style lang="scss">@import './wish.scss';
/* 2026-11-17 改版「小而精」：筛选页 —— 分类格是白底 12 圆角的小卡，图标放进 36 的浅暖色方块，选中是浅棕底加细棕边。 */
.wf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.wf-category{display:flex;gap:8px;align-items:center;min-height:56px;box-sizing:border-box;background:var(--k-paper);border:0;border-radius:12px;padding:10px}.wf-category.on{background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line)}.wf-category__icon{display:flex;align-items:center;justify-content:center;flex:0 0 36px;width:36px;height:36px;border-radius:10px;background:linear-gradient(145deg,#FCF4E8,#F4E4CC)}.wf-category.on .wf-category__icon{background:var(--k-paper)}.wf-category__title{display:block;font-size:13px;font-weight:600;line-height:18px;color:var(--k-ink)}.wf-category__hint{display:block;font-size:10px;line-height:14px;color:var(--k-muted);margin-top:1px}.wf-category>view{min-width:0}
/* 11-18 第二轮精修：每个筛选区块都放进白卡（之前一半在卡里、一半在灰底上），卡里标题 14/600；
   分类格放在白卡里改用浅灰底，选中和筛选胶囊一样是浅棕底 + 深棕字（去掉细棕边）；「查看品类规则」单独一张一行高的白卡，箭头 12 灰 */
.wf-grid{margin-top:8px}
.w-card .wf-category{background:var(--k-page)}
.w-card .wf-category.on{background:var(--k-red-soft);box-shadow:none}
.wf-category.on .wf-category__title{color:var(--k-red-deep)}
.wf-rules{padding-top:0;padding-bottom:0}
/* 分类格放进白卡后变窄：说明优先在「·」两边的空格处换行（不再断成「地 / 方工艺」），实在放不下才逐字换；320 宽图标块从 36 收到 30、内边距 8 */
.wf-category__hint{word-break:keep-all;overflow-wrap:anywhere}
@media(max-width:359px){.wf-category{padding:8px;gap:6px}.wf-category__icon{flex-basis:30px;width:30px;height:30px}}
/* 11-18 返修：选中的浅棕底和没选的浅灰底几乎分不出，选中格再加一圈暖棕发丝描边（0.5px，画在 ::after 上，不占位置、不接点按） */
.w-card .wf-category{position:relative}
.w-card .wf-category.on::after{content:"";position:absolute;left:0;top:0;width:200%;height:200%;border:1px solid var(--k-red);border-radius:24px;transform:scale(.5);transform-origin:0 0;box-sizing:border-box;pointer-events:none}
/* 11-18 第三轮逐页精修：这是筛选页不是填写页 —— 输入框收成 40 高、圆角 8、浅灰底不描边，字 14；分类格选中靠浅棕底 + 一圈暖棕细线 */
.w-card>.w-input,.w-card .w-between>.w-input,.w-card .w-row>.w-input{height:40px;border:0;border-radius:8px;background:var(--k-page);font-size:14px}
/* 11-18 第三轮返修（评审第 1 轮）：
   1) 五个筛选区块卡与卡之间 12（原来 8，像一摞碎卡），页面底部多留 20；
   2) 分类格固定 56 高；副标题 11 号一行，放不下用省略号（原来 10 号、会折成三行，格子高矮不一）。 */
.wf-page .w-card{margin-bottom:12px}
.wf-page .w-body{padding-bottom:20px}
.wf-page .wf-category{height:56px;min-height:56px}
.wf-page .wf-category>view:last-child{flex:1;min-width:0}
.wf-page .wf-category__hint{font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;word-break:normal;overflow-wrap:normal}
.wf-page .wf-category__title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 11-18 第三轮返修（评审第 2 轮）：
   1) 分类六宫格两列等宽（minmax(0,1fr)），说明一行放不下就省略，不再把左列撑宽、320 宽右列被切；
   2) 分类图标方块纯色浅棕底（去掉渐变高光），选中时白底；320 宽方块 32、格子内边距 8。 */
.wf-page .wf-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.wf-page .wf-category__icon{background:var(--k-red-soft)}
.wf-page .wf-category.on .wf-category__icon{background:var(--k-paper)}
@media(max-width:359px){.wf-page .wf-category{padding:8px;gap:8px}.wf-page .wf-category__icon{flex-basis:32px;width:32px;height:32px}}
/* 11-18 第三轮返修（评审第 3 轮）：分类格说明允许两行（11/1.45），格子高度随内容、最小 64，320 宽也不再截成「…」 */
.wf-page .wf-category{height:auto;min-height:64px;align-items:center}
.wf-page .wf-category__hint{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;line-height:16px;word-break:keep-all;overflow-wrap:anywhere}
/* 2026-11-18 第三轮返修（评审第 4 轮）：分类说明按「 · 」拆成几段，段与段之间才折行，分隔点画在段前、折到行首时被裁掉，不会挂在行尾或行首；
   单段太长时两行等长（不出现第二行只剩一个字）；格子内容顶对齐，同一行两格标题在一条线上；图标方块 32。 */
.wf-page .wf-category{align-items:flex-start;padding:12px 10px}
.wf-page .wf-category__icon{flex:0 0 32px;width:32px;height:32px}
.wf-page .wf-category__hint{display:block;margin-top:2px;overflow:hidden;-webkit-line-clamp:unset;white-space:normal;word-break:normal;overflow-wrap:break-word}
.wf-hint{display:flex;flex-wrap:wrap;margin-left:-11px}
.wf-hint__seg{position:relative;flex:0 1 auto;min-width:0;padding-left:11px;text-wrap:balance}
.wf-hint__seg::before{content:'';position:absolute;left:4px;top:7px;width:3px;height:3px;border-radius:50%;background:var(--k-light)}
@media(max-width:359px){.wf-page .wf-category{padding:10px 8px}}
/* 2026-11-18 第三轮返修（评审第 5 轮）：说明段的字最宽 6 个半字（不算前面圆点的位置）、按普通方式折行（不再对半切），「服务者需通过资质审核」断在「通过」后面；其余段都不超过 6 个字，不受影响。 */
.wf-page .wf-hint__seg{box-sizing:content-box;max-width:6.5em;text-wrap:wrap}
/* 2026-11-18 第四轮精修（按微信实拍评审）
   1) 五个筛选区块合成一张通长白卡，区块之间发丝线（左右让 16），每块上下 20；区块标题 15/600，到内容 10；
   2) 选项按全端「筛选页选项格」：32 高、圆角 16、浅灰底不描边、13 号；选中浅棕底 + 深棕字 500 + 一圈浅棕线；
   3) 分类格去掉里面的浅棕方块（不再三层套），浅灰底 12 圆角，22 号暖棕线性图标直接放；分类名完整显示、放不下就折行（原来被省略号截掉）；
   4) 输入框放在白卡里用浅灰底；「查看品类规则」放到卡外做成一行文字链；底部「重置」96 宽、44 高。 */
.wf-sheet{margin-top:16px;border-radius:12px;background:var(--k-paper);overflow:hidden}
.wf-page .wf-sheet>.w-card{position:relative;margin:0;padding:20px 16px;border-radius:0;background:transparent}
.wf-page .wf-sheet>.w-card+.w-card::before{content:"";position:absolute;left:16px;right:16px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.wf-page .wf-sheet .w-heading{font-size:15px;font-weight:600;line-height:22px}
.wf-page .wf-sheet .w-heading+.w-section,.wf-page .wf-sheet .w-heading+.wf-grid{margin-top:10px}
.wf-page .w-card .w-pill{height:32px;padding:0 16px;border-radius:16px;background:var(--k-fill);font-size:13px;line-height:32px;color:var(--k-ink2);box-shadow:none}
.wf-page .w-card .w-pill.on{background:var(--k-red-soft);color:var(--k-red-deep);font-weight:500;box-shadow:inset 0 0 0 1px var(--k-red-line)}
.wf-page .w-card .w-pills{gap:8px}
.wf-page .wf-category{gap:10px;padding:12px;border-radius:12px;background:var(--k-fill)}
.wf-page .w-card .wf-category.on{background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line)}
.wf-page .w-card .wf-category.on::after{display:none}
.wf-page .wf-category__icon,.wf-page .wf-category.on .wf-category__icon{flex:0 0 22px;width:22px;height:22px;border-radius:0;background:transparent}
.wf-page .wf-category__title{white-space:normal;overflow:visible;font-size:14px;font-weight:600;line-height:20px;word-break:keep-all;overflow-wrap:anywhere}
.wf-page .wf-category__hint{margin-top:2px}
.wf-page .w-card .w-row>.w-input,.wf-page .w-card>.w-input{background:var(--k-fill)}
.wf-page .w-card .w-row>text{flex:0 0 auto;color:var(--k-light)}
.wf-page .w-card>.w-caption{margin-top:8px}
.wf-page .wf-rules{margin:8px 0 0;padding:0 4px;background:transparent}
.wf-page .wf-rules>.w-field{min-height:44px;gap:6px;font-size:13px;color:var(--k-ink2)}
.wf-page .wf-rules>.w-field::after{display:none}
.wf-page .w-bottom>.w-secondary{flex:0 0 96px;width:96px;padding:0;font-size:15px!important;font-weight:600}
@media(max-width:359px){.wf-page .wf-sheet>.w-card{padding:20px 12px}.wf-page .wf-sheet>.w-card+.w-card::before{left:12px;right:12px}.wf-page .wf-category{padding:12px 10px;gap:8px}}
/* 2026-11-19 第四轮返修（按复评）：卡外「查看品类规则」左右内边距 16，图标起点和箭头对齐卡内区块标题 / 输入框（28 / 362），整页左边只有两条线；
   帮忙地、价格区间输入框不要浅底块，改白底 + 一条发丝下划线，卡里的底色块只剩胶囊和分类格。 */
.wf-page .wf-rules{padding:0 16px}
.wf-page .w-card .w-row>.w-input,.wf-page .w-card>.w-input{padding-left:0;padding-right:0;border-radius:0;background:transparent;box-shadow:inset 0 -1px 0 var(--k-line)}
/* 2026-11-19 第五轮（按微信实拍复核）：互助方式 / 排序胶囊和六个分类格不再是灰实底（一张卡里底色块太多、选中的反而比没选中的浅）——
   没选中：白底 + 一圈细描边；选中：浅棕底 + 暖棕细边 + 深棕字（分类格 12 圆角、胶囊 16 圆角不变）。 */
.wf-page .w-card .w-pill{background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-line2)}
.wf-page .w-card .w-pill.on{background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line);font-weight:600}
.wf-page .wf-category{background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-line2)}
.wf-page .w-card .wf-category.on{background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line)}
</style>
