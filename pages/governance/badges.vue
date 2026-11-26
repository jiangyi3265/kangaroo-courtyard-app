<template>
  <view class="governance gov-badges" :class="$userSurface">
    <k-topbar title="我的徽章" back/>
    <view class="gov-body">
      <text class="gov-title">我的成长与荣誉</text>
      <view class="level-card">
        <view class="level-strip"><LevelIcon :level="data.member?.level||0" :size="52"/><view><text class="gov-item-title">{{ data.member?.levelName||'会员等级' }}</text><text class="gov-muted">等级随成长积分更新，兑换不扣成长值</text></view></view>
        <view class="gov-actions level-links"><button @click="go('/pages/profile/member-wallet')"><k-icon name="wallet" :size="14" color="red"/><text>会员权益与积分</text><k-icon name="chevron-right" :size="12" color="muted"/></button><button @click="load"><k-icon name="refresh-cw" :size="14" color="muted"/><text>刷新记录</text></button></view>
      </view>
      <text v-if="error" class="gov-error">{{ error }}</text>
      <view class="gov-tabs badge-seg"><button :class="{active:tab==='earned'}" @click="tab='earned'">已获得 {{ earned.length }}</button><button :class="{active:tab==='all'}" @click="tab='all'">如何获得徽章</button></view>
      <text v-if="loading" class="gov-empty">正在读取徽章…</text>
      <template v-else-if="tab==='earned'">
        <view v-if="!earned.length" class="badge-empty"><view class="gov-empty-art"><k-icon name="award" :size="28" color="red"/></view><text class="badge-empty__title">还没有徽章</text><text class="gov-empty">暂未获得成就徽章。可先查看每枚徽章的参与方式和达标条件。</text><button class="primary" @click="tab='all'">查看获取方式与条件</button></view>
        <view class="badge-list honor-list"><view v-for="a in earned" :key="a.awardId" class="honor"><view class="medal medal--got" :class="[a.tone,{'medal--worn':a.worn==='1'}]"><k-icon :name="icon(a)" :size="20" color="red"/><view v-if="a.worn==='1'" class="medal__worn"><k-icon name="check" :size="12" color="white"/></view></view><view class="honor-copy"><text class="gov-item-title">{{ a.name }}</text><text class="gov-muted">{{ a.sourceNote }}</text><text class="gov-time">{{ a.awardedAt?.slice(0,10) }} 获得{{ a.worn==='1'?' · 已佩戴':'' }}</text><view class="gov-actions"><button :disabled="busy" @click="display(a,true,a.worn!=='1')">{{ a.worn==='1'?'取消佩戴':'佩戴' }}</button><button :disabled="busy" @click="display(a,a.visible!=='1',false)">{{ a.visible==='1'?'设为私密':'公开展示' }}</button></view></view></view></view>
      </template>
      <template v-else>
        <view class="badge-help"><text class="badge-help__lead">每枚徽章都有对应条件。</text><text>先按<text class="badge-nw">“参与方式”</text>完成记录，再查看<text class="badge-nw">“达标条件”</text>和个人进度；需要平台核验或评选的，以核验结果为准。</text></view>
        <view class="badge-categories"><button v-for="c in categories" :key="c" :class="{active:category===c}" @click="category=c">{{ c }}</button></view>
        <text v-if="!definitions.length" class="gov-empty">暂未加载到徽章规则，请点击“刷新记录”重试。</text>
        <view class="badge-list"><view v-for="d in definitions" :key="d.code" class="badge-rule" :class="{'badge-rule--off':!earned.some(a=>a.name===d.name)}">
          <view class="medal" :class="{'medal--got':earned.some(a=>a.name===d.name)}"><k-icon :name="icon(d)" :size="20" :color="earned.some(a=>a.name===d.name)?'red':'muted'"/></view>
          <view class="rule-copy">
          <view class="gov-row rule-title"><text class="gov-item-title">{{ d.name }}</text><text v-if="d.category" class="rule-cat">{{ d.category }}</text><text v-if="d.enabled==='0'" class="gov-badge">暂未开放</text><text v-else-if="earned.some(a=>a.name===d.name)" class="gov-badge rule-got">已获得</text></view>
          <view class="rule-line rule-line--goal" :class="{'rule-short':(d.ruleText||'').length<=24,'rule-long':(d.ruleText||'').length>40}"><text class="rule-label">达标条件</text><text class="gov-copy">{{ (d.ruleText || '具体条件待平台补充').slice(0,-3) }}<text class="badge-nw">{{ (d.ruleText || '具体条件待平台补充').slice(-3) }}</text></text></view>
          <view class="rule-line rule-line--how"><text class="rule-label">参与方式</text><text class="gov-copy">{{ badgeGuide(d).text.slice(0,-3) }}<text class="badge-nw">{{ badgeGuide(d).text.slice(-3) }}</text></text></view>
          <view v-if="data.progress?.[d.code]" class="badge-progress">
            <text class="progress-status">{{ badgeProgressStatus(data.progress[d.code]) }}</text>
            <text v-for="line in badgeProgressLines(d.code, data.progress[d.code])" :key="line" class="progress-line">{{ line }}</text>
            <text v-for="message in data.progress[d.code].missingData || []" :key="message" class="progress-note">{{ message }}</text>
          </view>
          <view v-if="d.enabled!=='0' && badgeGuide(d).actions.length" class="gov-actions" :class="{'rule-links--stack':badgeGuide(d).actions.length>2}"><button v-for="a in badgeGuide(d).actions" :key="a.to" @click="go(a.to)"><text>{{ a.label }}</text><k-icon name="chevron-right" :size="12" color="red"/></button></view>
          </view>
        </view></view>
      </template>
      <view id="badge-feedback" class="gov-section"><view class="gov-row feedback-head"><k-icon name="notebook-pen" :size="16" color="red"/><text class="gov-heading">意见箱</text></view><text class="gov-muted">写下真实体验与具体建议，经核验的反馈计入“袋鼠<text class="badge-nw">记录官”记录。</text></text><textarea v-model="suggestion" maxlength="2000" placeholder="至少20字，说清具体问题与建议"/><button class="primary" :disabled="busy||suggestion.trim().length<20" @click="submitFeedback">提交建议</button><text v-if="feedbacks.length" class="feedback-history">我的反馈</text><view v-for="f in feedbacks" :key="f.feedbackId" class="gov-item"><text class="gov-copy">{{ f.content }}</text><text class="gov-muted">{{ {pending:'待核验',valid:'有效反馈',invalid:'未计入有效反馈'}[f.status] }} · {{ f.reviewNote||'' }}</text></view></view>
    </view>
  </view>
</template>
<script setup>
import { badgeGuide } from './badge-guide.js'
import LevelIcon from './components/level-icon.vue'
import { badgeProgressLines, badgeProgressStatus } from './badge-progress.js'
import {ref,computed} from 'vue'
import {onShow} from '@dcloudio/uni-app'
import {governanceGet,governancePost} from '@/common/governance.js'
const suggestion=ref(''),feedbacks=ref([]);let feedbackKey='feedback_'+Date.now()+'_'+Math.random().toString(36).slice(2)
const data=ref({}),tab=ref('all'),error=ref(''),busy=ref(false),loading=ref(true)
let loadVersion=0
const earned=computed(()=>(data.value.awards||[]).filter(a=>a.status==='active'))
const category=ref('全部')
const categories=computed(()=>['全部',...new Set((data.value.definitions||[]).map(d=>d.category).filter(Boolean))])
const definitions=computed(()=>(data.value.definitions||[]).filter(d=>category.value==='全部'||d.category===category.value))
const go=url=>url==='#feedback'?uni.pageScrollTo({selector:'#badge-feedback',duration:200}):uni.navigateTo({url})
// 11-18 返修（纯展示）：每枚徽章一个图形 —— 先按徽章编号配，配不到再按分类兜底；已获得列表没带编号时按名称去规则里找
const badgeIcons={review_gold:'award',review_ace:'trophy',review_annual:'medal',recorder:'notebook-pen',referrer:'handshake',referrer_gold:'gem',city_builder:'building-2',juror:'scale',juror_gold:'shield-check',traveler:'mountain',creator:'camera',hot_author:'flame',campus:'graduation-cap',campus_council:'landmark',city_youth:'sprout',annual_person:'crown',annual_star:'sparkles',comfort:'heart',gentle:'flower-2',founder:'star'}
const categoryIcons={'评价贡献':'message-square-text','推荐共建':'handshake','内容旅行':'compass','社区治理':'scale','校园城市':'graduation-cap','特殊荣誉':'crown'}
const icon=x=>{const code=x?.code||x?.badgeCode||(data.value.definitions||[]).find(d=>d.name===x?.name)?.code;return badgeIcons[code]||categoryIcons[x?.category]||'award'}
async function load(){
  const version=++loadVersion
  loading.value=true
  error.value=''
  try{
    const [wall,feedback]=await Promise.all([governanceGet('badges'),governanceGet('feedback')])
    if(version!==loadVersion)return
    data.value=wall.data
    feedbacks.value=feedback.data
  }catch(e){if(version===loadVersion)error.value=e.message||'加载失败'}
  finally{if(version===loadVersion)loading.value=false}
}
async function display(a,visible,worn){if(busy.value)return;busy.value=true;++loadVersion;try{await governancePost('badges/'+a.awardId+'/display',{visible,worn});await load()}catch(e){error.value=e.message}finally{busy.value=false}}
async function submitFeedback(){busy.value=true;try{await governancePost('feedback',{content:suggestion.value,requestKey:feedbackKey});suggestion.value='';feedbackKey='feedback_'+Date.now()+'_'+Math.random().toString(36).slice(2);await load()}catch(e){error.value=e.message}finally{busy.value=false}}
onShow(load)
</script>
<style lang="scss">@import './governance.scss';</style><style scoped>
/* 2026-11-18 第三轮逐页精修：「我的徽章」原来像规章 —— 两排长得一样的胶囊分不清哪排是跳转、哪排是切换，每张卡一大段字、没有一枚徽章图形。
   现在：等级卡底下一条发丝线，「会员权益与积分 / 刷新记录」降成卡底两格文字链；「已获得 / 如何获得徽章」做成分段控件；分类一行横滑；
   每枚徽章左边一枚 48 的圆形奖章（浅棕底 + 一圈白边 + 一圈细棕线，里面 24 号线性图标），没获得的整枚变灰；参与方式 / 达标条件是 11 号小标签 + 13 号正文。 */
.level-card { margin-top:8px; border-radius:12px; background:var(--k-paper); }
.level-strip { display:flex; gap:12px; align-items:center; padding:16px 16px 14px; }
.level-strip>view:last-child { flex:1; min-width:0; }
.level-strip .gov-item-title { font-size:17px; font-weight:700; line-height:24px; }
.level-strip .gov-muted { display:block; margin-top:2px; }
.governance .level-links { position:relative; display:flex; gap:0; margin:0; flex-wrap:nowrap; }
.governance .level-links::before { content:''; position:absolute; left:16px; right:16px; top:0; height:1px; background:var(--k-line); transform:scaleY(.5); }
.governance .level-links button { position:relative; flex:1; min-width:0; display:flex; align-items:center; justify-content:center; gap:4px; height:44px; margin:0; padding:0 8px; border-radius:0; background:transparent; box-shadow:none; color:var(--k-ink2); font-size:13px; font-weight:500; line-height:20px; white-space:nowrap; }
.governance .level-links button+button::before { content:''; position:absolute; left:0; top:14px; bottom:14px; width:1px; background:var(--k-line); transform:scaleX(.5); }
/* 分段控件：外框 var(--k-fill)、32 高、圆角 16；选中块白底 13/600 深墨 */
.governance .gov-tabs.badge-seg { display:flex; flex-wrap:nowrap; gap:0; height:36px; margin:20px 0 12px; padding:2px; box-sizing:border-box; border-radius:18px; background:var(--k-fill); }
.governance .gov-tabs.badge-seg button { flex:1; min-width:0; height:32px; margin:0; padding:0; border:0; border-radius:16px; background:transparent; box-shadow:none; color:var(--k-ink2); font-size:13px; font-weight:400; line-height:32px; }
.governance .gov-tabs.badge-seg button.active { background:var(--k-paper); color:var(--k-ink); font-weight:600; box-shadow:0 1px 2px rgba(58,50,43,.08); }
.badge-help { display:block; margin:0 0 8px; font-size:12px; line-height:1.6; color:var(--k-muted); }
/* 分类：一行横滑，不再折成两行 */
.badge-categories { display:flex; flex-wrap:nowrap; gap:8px; margin:0 -16px 4px; padding:4px 16px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
.badge-categories::-webkit-scrollbar { display:none; }
.badge-categories::after { content:''; flex:0 0 4px; }
.governance .badge-categories button { flex:0 0 auto; height:28px; margin:0; padding:0 12px; border:0; border-radius:14px; background:var(--k-paper); box-shadow:none; color:var(--k-ink2); font-size:12px; font-weight:400; line-height:28px; white-space:nowrap; }
.governance .badge-categories button.active { background:var(--k-red-soft); color:var(--k-red-deep); font-weight:500; box-shadow:inset 0 0 0 1px var(--k-red-line); }
/* 圆形奖章 */
.medal { position:relative; flex:0 0 48px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:50%; background:var(--k-red-soft); box-shadow:inset 0 0 0 3px var(--k-paper), inset 0 0 0 4px var(--k-red-line); }
.medal.green,.medal.blue,.medal.pink { background:var(--k-red-soft); }
.badge-rule--off .medal { background:var(--k-fill); box-shadow:inset 0 0 0 3px var(--k-paper), inset 0 0 0 4px var(--k-line2); opacity:.7; }
.honor,.badge-rule { display:flex; align-items:flex-start; gap:12px; margin-top:8px; padding:16px; border-radius:12px; background:var(--k-paper); }
.honor-copy,.rule-copy { flex:1; min-width:0; }
.honor-copy>.gov-muted { display:block; margin-top:2px; }
.honor-copy .gov-time { margin-top:2px; }
.rule-copy>.gov-row { justify-content:flex-start; gap:6px; }
.rule-copy .gov-item-title,.honor-copy .gov-item-title { font-size:15px; line-height:22px; }
.rule-got { background:var(--k-green-soft); color:var(--k-green); }
.rule-cat { display:block; font-size:11px; line-height:16px; color:var(--k-muted); }
.rule-label { display:block; margin:10px 0 2px; font-size:11px; font-weight:500; line-height:16px; color:var(--k-muted); }
.rule-copy .gov-copy { font-size:13px; line-height:1.6; }
.badge-progress { position:relative; margin-top:10px; padding:8px 10px; border-radius:8px; background:var(--k-page); }
.progress-status,.progress-line,.progress-note { display:block; font-size:12px; line-height:1.6; }
.progress-status { font-weight:600; color:var(--k-ink); }
.progress-line { color:var(--k-muted); font-variant-numeric:tabular-nums; }
.progress-note { margin-top:4px; color:var(--k-alert); }
.governance .rule-copy .gov-actions,.governance .honor-copy .gov-actions { margin:12px 0 0; gap:8px; }
.governance .rule-copy .gov-actions button,.governance .honor-copy .gov-actions button { height:28px; padding:0 12px; border-radius:14px; background:var(--k-red-soft); box-shadow:none; color:var(--k-red-deep); font-size:12px; font-weight:500; line-height:28px; }
.badge-empty { display:flex; flex-direction:column; align-items:center; margin-top:8px; padding:28px 16px; border-radius:12px; background:var(--k-paper); }
.governance .badge-empty .gov-empty { max-width:260px; padding:12px 0 16px; font-size:12px; line-height:1.6; }
.governance .badge-empty button.primary { height:36px; padding:0 20px; border-radius:18px; font-size:13px; line-height:36px; }
.feedback-head { margin-bottom:4px; }
.feedback-head .gov-heading { margin:0; }
#badge-feedback { margin-top:20px; padding:16px; }
#badge-feedback textarea { margin-top:12px; background:var(--k-page); border:0; border-radius:8px; }
#badge-feedback>button.primary { width:100%; height:44px; margin-top:12px; padding:0; border-radius:22px; line-height:44px; }
/* 11-18 第三轮返修（评审第 1 轮）：
   1) 每枚徽章自己的图形（见脚本 badgeIcons）；
   2) 已获得 / 没获得一眼分开：已获得是浅赭黄底 + 1.5px 赭黄外圈 + 暖棕图标；没获得灰底、图标灰、整枚 .6 透明，徽章名降成二级墨色；
      已获得列表里正在佩戴的那枚，右下角一个 16 的绿底白勾；
   3) 规则卡版式：卡头一行「奖章 48 + 名称 15/600 + 分类 11 + 右侧标签」，参与方式 / 达标条件 / 进度 / 按钮放到卡头下方铺满整行（不再被奖章挤成窄条），卡头到正文 12；
   4) 卡与卡之间 12；空状态加 14/500 标题；意见箱历史反馈前加「我的反馈」小标题 + 发丝线；320 宽等级说明 11 号保持一行。 */
.governance .medal--got{background:var(--k-ochre-soft);box-shadow:inset 0 0 0 1.5px var(--k-ochre)}
.governance .badge-rule--off .medal{background:var(--k-fill);box-shadow:none;opacity:.6}
.governance .badge-rule--off .gov-item-title{color:var(--k-ink2)}
.medal__worn{position:absolute;right:-2px;bottom:-2px;display:flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--k-green);box-shadow:0 0 0 2px var(--k-paper)}
.badge-rule{display:block;margin-top:12px}
.honor{margin-top:12px}
.rule-head{display:flex;align-items:center;gap:12px}
.rule-head__copy{flex:1;min-width:0}
.rule-head__copy>.gov-row{justify-content:space-between;gap:8px}
.rule-head__copy .gov-item-title{font-size:15px;font-weight:600;line-height:22px}
.rule-head__copy .rule-cat{margin-top:2px}
.rule-copy{margin-top:12px}
.rule-copy>.rule-label:first-child{margin-top:0}
.badge-empty__title{display:block;margin-top:12px;font-size:14px;font-weight:500;line-height:20px;color:var(--k-ink2)}
.governance .badge-empty .gov-empty{padding:4px 0 16px}
.feedback-history{position:relative;display:block;margin-top:20px;padding-top:16px;font-size:13px;font-weight:600;line-height:20px;color:var(--k-ink)}
.feedback-history::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
.feedback-history+.gov-item{padding-top:8px}
@media (max-width:359px){.level-strip .gov-muted{font-size:11px}}
/* 2026-11-18 第三轮返修（评审第 2 轮）：
   1) 等级角标 11 号、18 高（原来 9 号）；
   2) 规则卡里「参与方式」退成 12 号灰字（次要），「达标条件」保持 13 号正文；两段之间 8，卡片矮一截；
   3) 分段控件、未获得奖章底色用暖线色变量（原来单写 var(--k-fill)）。 */
.gov-badges :deep(.lv__rank){height:18px;padding:0 4px;font-size:11px!important;line-height:16px}
.rule-copy>.rule-label:first-child+.gov-copy{font-size:12px;line-height:1.6;color:var(--k-muted)}
.rule-copy>.rule-label{margin-top:8px}
.governance .gov-tabs.badge-seg{background:var(--k-fill)}
.governance .badge-rule--off .medal{background:var(--k-fill)}
/* 2026-11-18 第三轮返修（评审第 3 轮）：「如何获得」每张卡原来约 235 高、卡里两条左线 —— 改成左边奖章、右边一整列：
   第一行徽章名 15/600 + 分类 11 号灰字 + 右侧标签；第二行「达标条件」（11 号灰色小标签 + 13/500 深墨正文）；
   第三行「参与方式」退成 12 号灰字、最多 2 行；按钮改成 28 高浅棕小胶囊带 12 号箭头，上距 8。卡片内边距 14/16，每张卡约 140 高。
   分类横滑胶囊左右内边距 10、间距 6，390 宽第 6 个露出约 4 成，看得出能横滑；空状态说明最宽 180；正在佩戴的小勾改暖棕底（绿色只留给「已获得」标签）。 */
.badge-rule{display:flex;align-items:flex-start;gap:12px;padding:14px 16px}
.badge-rule>.rule-copy{flex:1;min-width:0;margin-top:0}
.rule-title{justify-content:flex-start;gap:6px;min-height:22px}
.rule-title>.gov-item-title{flex:0 1 auto;min-width:0;font-size:15px;font-weight:600;line-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rule-title>.rule-cat{flex:0 0 auto;margin:0;font-size:11px;line-height:22px;color:var(--k-muted)}
.rule-title>.gov-badge{margin-left:auto}
.rule-line{margin-top:4px;overflow:hidden}
.rule-line>.rule-label{display:inline;margin:0 6px 0 0;font-size:11px;font-weight:500;line-height:20px;color:var(--k-muted)}
.rule-line>.gov-copy{display:inline;white-space:normal}
.rule-line--goal>.gov-copy{font-size:13px;font-weight:500;line-height:20px;color:var(--k-ink)}
.rule-line--how{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;margin-top:2px}
.rule-line--how>.gov-copy,.rule-copy>.rule-line--how>.gov-copy{font-size:12px;font-weight:400;line-height:18px;color:var(--k-muted)}
.badge-rule .badge-progress{margin-top:8px}
.governance .rule-copy .gov-actions{margin:8px 0 0}
.governance .rule-copy .gov-actions button{display:flex;align-items:center;gap:2px;padding:0 8px 0 12px}
.badge-rule--off .medal{opacity:.6}
.governance .badge-categories button{padding:0 10px}
.badge-categories{gap:6px}
.governance .badge-empty .gov-empty{max-width:180px}
.medal__worn{background:var(--k-red)}
/* 2026-11-18 第三轮返修（评审第 4 轮）：
   1) 「参与方式」不再限 2 行（375 / 320 宽原来被截成「…」，规则看不全），整段显示；
   2) 「达标条件」「参与方式」小标签和正文分成两列，正文折行对齐正文起点（悬挂缩进）；
   3) 说明段里带引号的「参与方式」「达标条件」不拆开；
   4) 意见箱的装饰图标挪到标题左边（16 号、间距 6），不再像右侧按钮。 */
.rule-line,.rule-line--how{display:flex;align-items:flex-start;overflow:visible;-webkit-line-clamp:unset}
.rule-line>.rule-label{flex:0 0 auto;display:block}
.rule-line>.gov-copy,.rule-copy>.rule-line>.gov-copy{display:block;flex:1;min-width:0}
.rule-line--how>.rule-label{line-height:18px}
.badge-nw{white-space:nowrap}
.badge-help{text-wrap:pretty}
.governance .feedback-head{justify-content:flex-start;gap:6px}
/* 2026-11-18 第三轮返修（评审第 5 轮）：说明段第一句「每枚徽章都有对应条件。」单独一行（13/500 二级墨）当引子，后面的做法说明 12 号灰字只在标点处折行（「需 / 要」这类断法不再出现，一段放不下时照常折行），不再剩「为准。」两个字一行。 */
.badge-help__lead{display:block;margin-bottom:2px;font-size:13px;font-weight:500;color:var(--k-ink2)}
/* 2026-11-18 第四轮精修（按微信实拍评审））
   1) 规则从一摞厚卡改成一张白卡里的清单：每枚徽章一行（左 40 奖章、右边名称 15/600 + 分类 11 灰），行间发丝线从文字起点开始画；
   2) 徽章名完整显示（原来放不下被省略号吃掉）：名称、分类、状态标签一行放不下就整体换到第二行；
   3) 「达标条件」正文 13/400 深墨（原来 500 整段发黑），「参与方式」12 灰；两段正文最后 5 个字不拆开（字不变，只是末尾几个字包一层不断行），不再出现「条件。」「颁发」单挂一行；
   4) 卡底的浅棕胶囊换成没有底色的文字链（12/500 暖棕 + 12 号箭头，链与链间隔 16，放不下再折行，左边对齐正文）；
   5) 分类横滑条右端渐隐，和「我的心愿」状态条一样，看得出还能往右滑。 */
.badge-list{margin-top:8px;border-radius:12px;background:var(--k-paper);overflow:hidden}
.badge-list>.badge-rule{position:relative;margin:0;padding:16px;border-radius:0;background:transparent}
.badge-list>.badge-rule+.badge-rule::before{content:"";position:absolute;left:68px;right:16px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.badge-list .medal{flex:0 0 40px;width:40px;height:40px}
.rule-title{flex-wrap:wrap;row-gap:2px}
.rule-title>.gov-item-title{white-space:normal;overflow:visible;text-overflow:clip;word-break:keep-all;overflow-wrap:anywhere}
.rule-line--goal>.gov-copy{font-weight:400}
.governance .rule-copy .gov-actions{flex-wrap:wrap;gap:0 16px;margin:6px 0 -4px}
.governance .rule-copy .gov-actions button{height:28px;margin:0;padding:0;border-radius:0;background:transparent;color:var(--k-red-deep);font-size:12px;font-weight:500;line-height:28px}
.badge-categories{-webkit-mask-image:linear-gradient(90deg,black calc(100% - 24px),transparent);mask-image:linear-gradient(90deg,black calc(100% - 24px),transparent)}
/* 第四轮：空状态图标 28（全端空状态 56 方块 + 28 图标）；没有徽章时说明最宽 260，按句号分两行（不再把「达标」拆开）；「查看获取方式与条件」按全端空状态用 32 高的次按钮。 */
.gov-badges .badge-empty .gov-empty{max-width:260px}
.governance .badge-empty button.primary{height:32px;padding:0 16px;border-radius:16px;background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-size:13px;font-weight:500;line-height:32px}
/* 2026-11-19 第四轮返修（按复评）：「已获得」和「如何获得」同一种列表 —— 一张白卡里每枚徽章一行（左 40 奖章、右边名称 15/600 + 说明 12 灰 + 获得日期），
   行间发丝线从文字起点（68）开始；「取消佩戴 / 设为私密」改成没有底色的文字链（12/500 暖棕，链间 16），和「如何获得」的「查看订单与评价」一样。字、点按、显示条件都不变。 */
.badge-list.honor-list{margin-top:0}
.honor-list>.honor{position:relative;display:flex;margin:0;padding:16px;border-radius:0;background:transparent}
.honor-list>.honor+.honor::before{content:"";position:absolute;left:68px;right:16px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.honor-list .medal{flex:0 0 40px;width:40px;height:40px}
.governance .honor-list .honor-copy .gov-actions{flex-wrap:wrap;gap:0 16px;margin:6px 0 -4px}
.governance .honor-list .honor-copy .gov-actions button{height:28px;margin:0;padding:0;border-radius:0;background:transparent;box-shadow:none;color:var(--k-red-deep);font-size:12px;font-weight:500;line-height:28px}
.governance .honor-list .honor-copy .gov-actions button::after{border:0}
.badge-progress .progress-line{text-wrap:pretty}
/* 2026-11-19 第五轮（按微信实拍复核）：
   1) 微信不认 text-wrap，「需/要」「核/验」被拆开 —— 顶部说明、意见箱说明、一两行的达标条件只在标点处折行（字不变，太长时照常兜底换行）；
   2) 超过两三行的达标条件退一档：深灰正文色、行高 1.6，不再一大块压过徽章名；
   3) 分类筛选胶囊不再是白底块：透明底 + 细描边，选中浅棕底 + 暖棕细边（上面分段控件保留底色，一个区块只有一种底色控件）。 */
.gov-badges .badge-help>text+text,.gov-badges .feedback-head+.gov-muted,.gov-badges .rule-short>.gov-copy{word-break:keep-all;overflow-wrap:anywhere}
.gov-badges .rule-line--goal.rule-long>.gov-copy{color:var(--k-ink2);line-height:21px}
.governance .badge-categories button{background:transparent;box-shadow:inset 0 0 0 1px var(--k-line2)}
.governance .badge-categories button.active{background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line)}
/* 2026-11-19 第五轮补（按微信实拍复核）：有三个去处的徽章（如袋鼠记录官）一行放不下，不再「两个一行 + 一个掉到下一行」：三个链接竖着排，每行 32 高、左对齐。 */
.governance .rule-copy .gov-actions.rule-links--stack{flex-direction:column;align-items:flex-start;flex-wrap:nowrap;gap:0}
.governance .rule-copy .gov-actions.rule-links--stack button{height:32px;line-height:32px}
</style>
