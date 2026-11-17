<template>
  <view class="governance">
    <k-topbar title="我的徽章" back/>
    <view class="gov-body">
      <text class="gov-title">我的成长与荣誉</text>
      <view class="level-strip"><LevelIcon :level="data.member?.level||0" :size="64"/><view><text class="gov-item-title">{{ data.member?.levelName||'会员等级' }}</text><text class="gov-muted">等级随成长积分更新，兑换不扣成长值</text></view></view>
      <view class="gov-actions"><button @click="go('/pages/profile/member-wallet')">会员权益与积分</button><button @click="load">刷新记录</button></view>
      <text v-if="error" class="gov-error">{{ error }}</text>
      <view class="gov-tabs"><button :class="{active:tab==='earned'}" @click="tab='earned'">已获得 {{ earned.length }}</button><button :class="{active:tab==='all'}" @click="tab='all'">如何获得徽章</button></view>
      <text v-if="loading" class="gov-empty">正在读取徽章…</text>
      <template v-else-if="tab==='earned'">
        <view v-if="!earned.length" class="badge-empty"><text class="gov-empty">暂未获得成就徽章。可先查看每枚徽章的参与方式和达标条件。</text><button class="primary" @click="tab='all'">查看获取方式与条件</button></view>
        <view v-for="a in earned" :key="a.awardId" class="honor"><view class="medal" :class="a.tone"><k-icon :name="icon(a.category)" :size="28" color="red"/></view><view class="honor-copy"><text class="gov-item-title">{{ a.name }}</text><text class="gov-muted">{{ a.sourceNote }}</text><text class="gov-time">{{ a.awardedAt?.slice(0,10) }} 获得{{ a.worn==='1'?' · 已佩戴':'' }}</text><view class="gov-actions"><button :disabled="busy" @click="display(a,true,a.worn!=='1')">{{ a.worn==='1'?'取消佩戴':'佩戴' }}</button><button :disabled="busy" @click="display(a,a.visible!=='1',false)">{{ a.visible==='1'?'设为私密':'公开展示' }}</button></view></view></view>
      </template>
      <template v-else>
        <text class="badge-help">每枚徽章都有对应条件。先按“参与方式”完成记录，再查看“达标条件”和个人进度；需要平台核验或评选的，以核验结果为准。</text>
        <view class="badge-categories"><button v-for="c in categories" :key="c" :class="{active:category===c}" @click="category=c">{{ c }}</button></view>
        <text v-if="!definitions.length" class="gov-empty">暂未加载到徽章规则，请点击“刷新记录”重试。</text>
        <view v-for="d in definitions" :key="d.code" class="badge-rule">
          <view class="gov-row"><text class="gov-item-title">{{ d.name }}</text><text v-if="d.enabled==='0'" class="gov-badge">暂未开放</text></view>
          <text class="rule-label">参与方式</text><text class="gov-copy">{{ badgeGuide(d).text }}</text>
          <text class="rule-label">达标条件</text><text class="gov-copy">{{ d.ruleText || '具体条件待平台补充' }}</text>
          <view v-if="data.progress?.[d.code]" class="badge-progress">
            <text class="progress-status">{{ badgeProgressStatus(data.progress[d.code]) }}</text>
            <text v-for="line in badgeProgressLines(d.code, data.progress[d.code])" :key="line" class="progress-line">{{ line }}</text>
            <text v-for="message in data.progress[d.code].missingData || []" :key="message" class="progress-note">{{ message }}</text>
          </view>
          <view v-if="d.enabled!=='0' && badgeGuide(d).actions.length" class="gov-actions"><button v-for="a in badgeGuide(d).actions" :key="a.to" @click="go(a.to)">{{ a.label }}</button></view>
        </view>
      </template>
      <view id="badge-feedback" class="gov-section"><text class="gov-heading">意见箱</text><text class="gov-muted">写下真实体验与具体建议，经核验的反馈计入“袋鼠记录官”记录。</text><textarea v-model="suggestion" maxlength="2000" placeholder="至少20字，说清具体问题与建议"/><button class="primary" :disabled="busy||suggestion.trim().length<20" @click="submitFeedback">提交建议</button><view v-for="f in feedbacks" :key="f.feedbackId" class="gov-item"><text class="gov-copy">{{ f.content }}</text><text class="gov-muted">{{ {pending:'待核验',valid:'有效反馈',invalid:'未计入有效反馈'}[f.status] }} · {{ f.reviewNote||'' }}</text></view></view>
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
const icon=c=>({'评价贡献':'message-square','内容旅行':'compass','社区治理':'shield-check','校园城市':'graduation-cap'}[c]||'award')
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
<style lang="scss">@import './governance.scss';</style><style scoped>.level-strip{display:flex;gap:14px;align-items:center;padding:20px 0;border-bottom:1px solid #e4d7c2}.honor{display:flex;gap:16px;padding:24px 0;border-bottom:1px solid #e5dccd}.honor-copy{flex:1;min-width:0}.medal{width:62px;height:70px;display:flex;align-items:center;justify-content:center;background:#eddbb6;border:2px solid #d8b57c;border-radius:20px 20px 28px 28px;box-shadow:inset 0 0 0 4px #f8efdb;flex-shrink:0}.medal.green{background:#e1e9d4;border-color:#b5c7a3}.medal.blue{background:#dfe9ec;border-color:#b0c4cc}.medal.pink{background:#f2ddd6;border-color:#d9b9ae}</style>

<style scoped>.badge-progress{margin-top:12px;padding-top:12px;border-top:1px solid var(--k-line,#e5dccd)}.progress-status,.progress-line,.progress-note{display:block;font-size:12px;line-height:1.8}.progress-status{font-weight:600;color:var(--k-ink,#3a322b)}.progress-line{color:var(--k-muted,#6f6a65)}.progress-note{margin-top:6px;color:var(--k-alert,#c04437)}</style>

<style scoped>
.badge-help { display:block; font-size:14px; line-height:1.8; color:var(--k-muted); margin:18px 0; }
.badge-categories { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:18px; }
.badge-rule { background:var(--k-paper,#fffdf8); border:1px solid var(--k-line,#e5ded2); border-radius:14px; padding:18px; margin-bottom:14px; }
.rule-label { display:block; font-size:12px; font-weight:600; color:var(--k-muted); margin:14px 0 4px; }
.badge-rule .gov-actions { margin-bottom:0; }
.badge-empty { margin-bottom:24px; }
.badge-empty .gov-empty { padding:16px 0; }
.level-strip>view { flex:1; min-width:0; }
</style>
