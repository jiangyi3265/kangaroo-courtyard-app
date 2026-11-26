<template><view class="wish-page wcr-page" :class="$userSurface"><k-topbar title="资质与收款资料" back :fab="false"/><view class="w-body"><view class="wc-heading"><view class="wc-heading__icon"><k-icon name="badge-check" :size="22" color="red"/></view><text class="w-title">{{ '一份凭证，\n多一份信任。' }}</text><text class="w-caption">资料仅本人及平台审核人员可见，不公开展示。</text></view><view class="w-card"><text class="w-heading">选择资料类型</text><view class="w-pills w-section wcr-types"><view v-for="t in types" :key="t.key" class="w-pill" :class="{on:type===t.key}" @click="type=t.key;file=''">{{t.label}}</view></view><text class="w-caption">{{tip}}</text><view v-if="type==='permit'" class="w-field"><text class="w-field__label">许可城市</text><input v-model="city" placeholder="与心愿帮忙地一致" maxlength="80"/></view><view v-if="type!=='payout'" class="wc-dates"><view class="w-field"><text class="w-field__label">证件生效日期</text><picker class="w-grow" mode="date" :value="validFrom" @change="validFrom=$event.detail.value"><view class="wc-date" :class="{'wc-date--empty':!validFrom}">{{validFrom||'选择证件生效日期'}}<k-icon name="chevron-right" :size="12" color="muted"/></view></picker></view><view class="w-field"><text class="w-field__label">有效期止</text><picker class="w-grow" mode="date" :value="validUntil" @change="validUntil=$event.detail.value"><view class="wc-date" :class="{'wc-date--empty':!validUntil}">{{validUntil||'选择证件有效期止'}}<k-icon name="chevron-right" :size="12" color="muted"/></view></picker></view></view><view v-if="type==='permit'" class="w-field"><text class="w-field__label">许可范围</text><view class="w-pills"><view v-for="s in scopes" :key="s.key" class="w-pill" :class="{on:permitType===s.key}" @click="permitType=s.key">{{s.label}}</view></view></view><view class="wc-upload" @click="pick"><k-icon :name="file?'file-check':'upload'" :size="24" color="red"/><text>{{file?'文件已选择，点击更换':'上传清晰、完整的资料'}}</text><text>{{file?'提交后等待平台审核':'JPG / PNG ≤20MB，PDF ≤10MB'}}</text></view><view class="w-tip"><k-icon name="lock-keyhole" :size="14" color="muted"/><text>{{type==='payout'?'请上传本人收款账户资料，包含开户人、银行名称及账号。请勿上传密码、验证码或卡片背面':type==='permit'?'许可必须适用于心愿所在城市，审核通过后才能承接对应地区的烟酒':'食品类提供健康证或食品经营许可证任一项即可。证件需真实有效，审核通过后才能承接相'}}<text class="wcr-nw">{{type==='payout'?'安全码。':type==='permit'?'类心愿。':'应心愿。'}}</text></text></view><button class="w-primary w-section" :disabled="busy||!file" @click="submit">{{busy?'提交中…':'提交审核'}}</button></view><view class="w-between w-section wc-records-head"><text class="w-heading">我的提交记录</text><button class="w-link" @click="load">刷新</button></view><view v-if="error" class="w-tip">{{error}}</view><view v-for="r in rows" :key="r.credentialId" class="w-card wc-record"><view class="w-between"><text>{{types.find(t=>t.key===r.type)?.label||r.type}}</text><text class="w-tag" :class="{'w-tag--lime':stateLabel(r)==='已通过','w-tag--alert':['未通过','证件已过期'].includes(stateLabel(r))}">{{stateLabel(r)}}</text></view><text class="w-caption">{{r.city||'平台审核'}} · {{String(r.createTime).slice(0,10)}}</text><text v-if="r.type!=='payout'" class="w-caption">有效期 {{r.validFrom||'待补充核实'}} 至 {{r.validUntil||'待补充核实'}}</text><text v-if="r.type==='permit'" class="w-caption">许可范围 {{({2:'烟草',4:'酒类',6:'烟草及酒类'})[r.permitScope]||'待补充核实'}}</text><text v-if="r.note" class="w-caption">审核说明：{{r.note}}</text><button class="w-link w-arrow" @click="view(r)">查看已提交文件<k-icon name="chevron-right" :size="12" color="muted"/></button></view><view v-if="!rows.length&&!error" class="w-state"><view class="w-state__art"><k-icon name="file-text" :size="28" color="red"/></view><text class="w-muted">还没有提交记录</text></view></view></view></template>
<script setup>
import { computed,ref } from 'vue'
import { onLoad,onShow } from '@dcloudio/uni-app'
import { wishCredentials } from '@/common/wish-api.js'
import { chooseDoc,uploadTo,absUrl,openFile } from '@/common/upload.js'
import { toast } from '@/common/screen.js'
import { sheet } from '@/common/ui.js'
const types=[{key:'health',label:'健康证'},{key:'food',label:'食品经营许可证'},{key:'permit',label:'当地特殊许可'},{key:'payout',label:'收款资料'}]
const type=ref('health'),city=ref(''),file=ref(''),busy=ref(false),rows=ref([]),error=ref('')
const validFrom=ref(''),validUntil=ref(''),permitType=ref('')
const scopes=[{key:'tobacco',label:'烟草'},{key:'alcohol',label:'酒类'},{key:'both',label:'烟草及酒类'}]
const tip=computed(()=>({health:'食品类服务者提供有效健康证。',food:'食品类服务者提供有效食品经营许可证。',permit:'烟草、酒类默认不开放，特殊许可须单独核实当地条件。',payout:'有偿心愿完成后，用于平台核实并向服务者打款。'}[type.value]))
function stateLabel(r){if(r.status==='approved'&&r.type!=='payout'){const today=new Date(Date.now()+8*60*60*1000).toISOString().slice(0,10);if(!r.validFrom||!r.validUntil)return '需补充有效期';if(r.validUntil<today)return '证件已过期';if(r.validFrom>today)return '尚未生效'}return {pending:'审核中',approved:'已通过',rejected:'未通过'}[r.status]||r.status}
onLoad(q=>{if(types.some(t=>t.key===q.type))type.value=q.type});onShow(load)
async function load(){try{rows.value=(await wishCredentials()).data;error.value=''}catch(e){rows.value=[];error.value=e.message||'资料加载失败'}}
async function pick(){if(busy.value)return;try{const n=await sheet(['从相册选择','拍照','选择文件']);if(n<0)return;const p=await chooseDoc(['album','camera','file'][n]);if(p)file.value=p}catch(e){toast(e.message||'无法选择文件')}}
async function submit(){if(busy.value||!file.value)return;if(type.value==='permit'&&city.value.trim().length<2){toast('请填写许可适用城市');return}if(type.value!=='payout'&&(!validFrom.value||!validUntil.value||validUntil.value<validFrom.value)){toast('请填写证件上的完整有效期');return}if(type.value==='permit'&&!permitType.value){toast('请选择许可证实际涵盖范围');return}busy.value=true;try{await uploadTo('/app/wishes/credentials',file.value,{type:type.value,city:city.value.trim(),validFrom:validFrom.value,validUntil:validUntil.value,permitType:permitType.value});file.value='';toast('资料已提交审核');await load()}catch(e){toast(e.message||'上传失败，请重试')}finally{busy.value=false}}
async function view(r){try{if(/\.pdf(?:\?|&|$)/i.test(r.url))await openFile(r.url,true);else uni.previewImage({urls:[absUrl(r.url)]})}catch(e){toast(e.message||'文件预览失败，请刷新后重试')}}
</script>
<style lang="scss">@import './wish.scss';
/* 2026-11-17 改版「小而精」：资质页 —— 标题旁的图标放进 46 的浅暖色方块；上传框是浅灰底虚线、12 圆角；日期框 44 高、字 14；提交记录是白底细卡。文字和入口原样保留。 */
.wc-heading{padding:4px 0 14px;position:relative}.wc-heading__icon{position:absolute;right:4px;top:6px;display:flex;align-items:center;justify-content:center;width:46px;height:46px;background:linear-gradient(145deg,#FCF4E8,#F4E4CC);border-radius:16px}.wc-heading .w-caption{margin-top:8px}.wc-upload{background:var(--k-page);border:1px dashed var(--k-line2);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;padding:20px 10px;margin:12px 0;color:var(--k-ink);font-size:13px;font-weight:600}.wc-upload text+text{font-size:11px;color:var(--k-muted);font-weight:400}.wc-record{font-size:14px;font-weight:600;padding-bottom:4px}.wc-record .w-caption{font-weight:400}.wc-record .w-link{font-weight:400;text-align:left}.wc-dates{display:grid;grid-template-columns:88px minmax(0,1fr);gap:10px 8px;padding:10px 0}.wc-dates .w-field__label{width:auto;white-space:nowrap}.wc-dates picker{flex:1;min-width:0;width:auto}.wc-dates .w-input{font-size:14px;white-space:nowrap;display:flex;align-items:center;padding:0 12px;height:44px}
/* 11-18 第二轮精修（只动样子；这是填写页，字号和输入框都没改小）：
   1) 标题旁的图标块和全站入口图标一样：44、圆角 12，图标 22
   2) 「选择资料类型」在卡里，字重跟卡内小标题一样 600，字号保持 15 不缩
   3) 「我的提交记录」区块标题上 16 下 8；右边「刷新」和全站区块右侧链接一样 12 号灰字（点按区不变）
   4) 「查看已提交文件」的文字箭头换成 12 号灰色图标；没有记录时是白卡空状态（在 wish.scss 统一） */
.wc-heading__icon{width:44px;height:44px;border-radius:12px}
.wc-heading+.w-card>.w-heading{font-size:15px;line-height:22px}
.wc-records-head{margin:16px 0 8px}
.wc-records-head .w-link{margin:-7px 0;color:var(--k-muted)!important;font-weight:400}
.wc-record .w-arrow{justify-content:flex-start}
/* 11-18 第三轮逐页精修：证件日期从「左粗标签 + 右边 44 高带框输入框」的后台表单样子，改成两条列表行：左边标签、右边日期（没选时浅灰）+ 12 号小箭头，行间发丝线；
   没有提交记录时是图标 + 一句话的空状态；提示框换成全站暖色提示（浅棕底、二级墨字、暖棕图标）。 */
.wc-dates{display:block;margin-top:4px;padding:0}
.wc-dates .w-field{min-height:52px}
.wc-dates .w-field__label{flex-shrink:0;font-weight:400;color:var(--k-ink)}
.wc-date{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-height:40px;font-size:14px;color:var(--k-ink);font-variant-numeric:tabular-nums}
.wc-date--empty{color:var(--k-light)}
.wc-records-head{margin:24px 0 8px}
.wc-record{padding:14px 16px}
/* 11-18 第三轮返修：资料类型四颗胶囊原来折成两行、最后一颗「收款资料」单独掉到第二行 —— 改成 2×2 等宽格子，36 高、圆角 18 */
.wcr-page .wcr-types{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.wcr-page .wcr-types .w-pill{height:36px;padding:0 8px;border-radius:18px;line-height:36px;text-align:center;font-size:13px}
/* 11-18 第三轮返修（评审第 2 轮）：
   1) 「未通过 / 证件已过期」用提醒红浅底标签，一眼看出有问题；
   2) 提交记录卡内边距 16（底部 6 + 文字链自带 10）；
   3) 没有记录时标题 14/500 二级墨，图标和标题间距 12；标题旁图标方块纯色浅棕。 */
.wcr-page .wc-record{padding:16px 16px 6px}
.wcr-page .w-state{gap:12px}
.wcr-page .w-state>.w-muted{font-size:14px;font-weight:500;line-height:20px;color:var(--k-ink2)}
.wcr-page .wc-heading__icon{background:var(--k-red-soft)}
/* 2026-11-18 第四轮精修（按微信实拍评审）
   1) 标题区和规则页同一结构：英文小标题以外的大标题 + 右侧 44 浅棕方块；
   2) 资料类型按全端筛选页选项格：浅灰底不描边、圆角，选中浅棕底 + 深棕字 + 浅棕细线；2×2 等宽；
   2) 一张卡里只留上传虚线框做焦点：提示框去掉浅棕底，改成一行 12 号灰字 + 14 号锁（按词组折行，不把「证件」拆开）；提交按钮上面一条发丝线，卡底 20；
   3) 没有提交记录：56 浅棕方块 + 28 号图标，「还没有提交记录」14/500 标题样式，上下 32。 */
.wcr-page .wcr-types .w-pill{height:32px;border-radius:16px;background:var(--k-fill);color:var(--k-ink2);font-size:13px;line-height:32px;box-shadow:none}
.wcr-page .wcr-types .w-pill.on{background:var(--k-red-soft);color:var(--k-red-deep);font-weight:500;box-shadow:inset 0 0 0 1px var(--k-red-line)}
.wcr-page .w-card>.w-tip{align-items:flex-start;gap:6px;padding:0;background:transparent;color:var(--k-muted);font-size:12px;line-height:1.6}
.wcr-nw{white-space:nowrap}
.wcr-page .w-card>.w-tip>.k-icon{width:14px!important;height:14px!important;margin-top:3px;flex:0 0 14px}
.wcr-page .w-card>.w-primary{margin-top:12px}
.wcr-page .w-card>.w-tip{position:relative;padding-bottom:16px}
.wcr-page .w-card>.w-tip::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 100%}
.wcr-page .wc-heading+.w-card{padding-bottom:20px}
.wcr-page .w-state{padding:32px 16px;gap:0}
.wcr-page .w-state>.w-muted{margin-top:12px}
/* 2026-11-19 第五轮（按微信实拍复核）：资料类型四个选项：没选中的白底 + 细描边、二级墨字，选中的浅棕底 + 暖棕细边 + 深棕 600 字（原来没选中的灰实底比选中的还深）；卡里只剩上传框一块底色。 */
.wcr-page .wcr-types .w-pill{background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-line2);color:var(--k-ink2);font-weight:400}
.wcr-page .wcr-types .w-pill.on{background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-weight:600}
</style>
