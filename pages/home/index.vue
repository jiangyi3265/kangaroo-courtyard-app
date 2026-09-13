<template>
  <view class="k-page home-page">
    <template v-if="s === 1">
      <k-topbar><template #left><text class="brand">袋鼠小院</text></template></k-topbar>
      <view class="home-content k-pad-tab">
        <view class="location" @click="go(R.city)"><k-icon name="map-pin" :size="20" color="ink" :stroke="1.7" /><text>大理</text><k-icon name="chevron-down" :size="15" color="ink" /></view>
        <view class="search-box" @click="s = 2"><k-icon name="search" :size="20" color="light" :stroke="1.7" /><text class="search-box__placeholder">搜索岗位 / 房源 / 活动 / 技能</text><view class="search-box__action"><text>搜索</text></view></view>
        <view class="interest-entry" @click="go(R.onboarding)">
          <view><text class="interest-title">{{ experience.cities.length ? '我的兴趣城市' : '想去哪里？选一选兴趣城市' }}</text><text class="interest-copy">{{ experience.cities.length ? experience.cities.join(' · ') : '可选，先看看也没关系' }}</text></view>
          <k-icon name="chevron-right" :size="18" color="green" />
        </view>
        <view class="entry-grid">
          <view v-for="item in entries" :key="item.name" class="entry" @click="openEntry(item)"><view class="entry__icon" :class="`is-${item.tone}`"><k-icon :name="item.icon" :size="28" color="white" :stroke="1.8" /></view><text class="entry__name">{{ item.name }}</text></view>
        </view>
        <view class="section-head"><text class="section-head__title">近期活动</text><view class="section-head__more" @click="go(R.activity)"><text>更多</text><k-icon name="chevron-right" :size="15" color="muted" /></view></view>
        <view class="activity-row">
          <view v-for="item in activities" :key="item.title" class="activity-card" @click="go(R.activity)"><image class="activity-card__image" :src="item.image" mode="aspectFill" /><view class="activity-card__copy"><text class="activity-card__title">{{ item.title }}</text><text class="activity-card__meta">{{ item.date }}</text><text class="activity-card__meta">{{ item.place }}</text><view class="safe-chip"><k-icon name="shield-check" :size="12" color="green" :stroke="2" /><text>安心商家</text></view></view></view>
        </view>
        <view class="section-head recommend-head"><text class="section-head__title">为你推荐</text><view class="section-head__more" @click="go(R.jobsList)"><text>更多</text><k-icon name="chevron-right" :size="15" color="muted" /></view></view>
        <view class="recommend" @click="go(R.jobDetail)"><image class="recommend__image" src="/static/media/home-rec-1.jpg" mode="aspectFill" /><view class="recommend__copy"><text class="recommend__title">大理双廊 · 海景民宿前台</text><view class="recommend__chips"><view class="safe-chip"><k-icon name="shield-check" :size="12" color="green" :stroke="2" /><text>安心商家</text></view><k-chip><text>可住宿</text></k-chip><k-chip><text>可长期</text></k-chip></view><view class="recommend__price"><text class="k-price">120</text><text> 元/天 + 提成</text></view><text class="recommend__meta">05.20–06.20 · 1人</text></view><k-icon name="heart" :size="24" color="muted" :stroke="1.5" /></view>
      </view>
      <k-tabbar active="home" />
    </template>

    <template v-else-if="s === 2">
      <k-topbar title="AI智能搜索" back @back="s = 1" />
      <view class="ai-body k-pad-safe">
        <image class="ai-avatar" src="/static/media/home-ai-avatar.jpg" mode="aspectFill" />
        <text class="ai-title">你好，我是袋鼠小院AI助手</text>
        <text class="ai-intro">告诉我你的想法，\n我会帮你找到合适的工作、房源和活动。</text>
        <view class="idea-box"><textarea v-model="idea" class="idea-box__input" :maxlength="200" :auto-height="false" /><text class="idea-box__count">23/200</text></view>
        <view class="preference-head"><view class="k-row k-gap6"><text class="preference-head__title">偏好设置</text><text class="preference-head__hint">（可选）</text></view><text class="preference-head__clear" @click="clearPrefs">清空</text></view>
        <view class="pref-grid"><view v-for="item in preferences" :key="item.label" class="pref-card" @click="toast(item.label)"><k-icon :name="item.icon" :size="21" color="ink" :stroke="1.6" /><view class="pref-card__copy"><text class="pref-card__label">{{ item.label }}</text><text class="pref-card__value">{{ item.value }}</text></view><k-icon v-if="item.extra" :name="item.extra" :size="17" color="ink" :stroke="1.5" /></view></view>
        <k-button block icon="sparkles" class="match-button" @click="s = 3">开始匹配</k-button><text class="ai-note">由 AI 提供匹配建议，结果仅供参考</text><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else-if="s === 3">
      <k-topbar title="综合结果" back @back="s = 2"><view class="result-tabs"><view class="result-tab active"><text>岗位 8</text></view><view class="result-tab"><text>房源 3</text></view><view class="result-tab"><text>活动 1</text></view></view></k-topbar>
      <view class="result-body k-pad-safe">
        <view class="result-sort"><text>综合匹配度从高到低排序</text><view class="k-row k-gap6" @click="toast('筛选')"><text>筛选</text><k-icon name="list-filter" :size="17" color="ink" /></view></view>
        <view v-for="job in matchedJobs" :key="job.title" class="match-card" @click="s = 4"><image class="match-card__image" :src="job.image" mode="aspectFill" /><view class="match-card__main"><text class="match-card__title">{{ job.title }}</text><view class="match-card__tag"><view class="safe-chip"><k-icon name="shield-check" :size="12" color="green" :stroke="2" /><text>安心商家</text></view><text class="match-card__skill">/ {{ job.skill }}</text></view><view class="match-card__price"><text class="k-price">{{ job.price }}</text><text> 元/天</text></view><text class="match-card__date">05.25 – 06.01 · 每天 ≤4小时</text><view class="match-card__line" /><text class="match-card__reason">原因：{{ job.reason }}</text></view><view class="match-card__score"><text class="match-card__percent">{{ job.score }}<text class="match-card__percent-sign">%</text></text><text>AI匹配度</text></view></view>
        <text class="result-end">— 已显示全部岗位 —</text><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else>
      <k-topbar title="推荐理由" back @back="s = 3" />
      <view class="reason-body k-pad-safe">
        <view class="score-card"><view class="score-ring"><text class="score-ring__num">92<text class="score-ring__sign">%</text></text><text class="score-ring__label">匹配度</text></view><text class="score-card__text">基于你的需求和偏好，\n我们为你推荐了最合适的\n工作、房源和活动组合。</text></view>
        <text class="reason-title">匹配依据</text>
        <view class="reason-list"><view v-for="item in reasons" :key="item.label" class="reason-row"><view class="reason-row__icon"><k-icon :name="item.icon" :size="20" color="ink" :stroke="1.6" /></view><text class="reason-row__label">{{ item.label }}</text><text class="reason-row__desc">{{ item.desc }}</text><text class="reason-row__score">{{ item.score }}%</text></view></view>
        <view class="preference-head reason-pref-head"><view class="k-row k-gap6"><text class="preference-head__title">偏好设置</text><text class="preference-head__hint">（可编辑）</text></view><view class="k-row"><text class="preference-head__clear">编辑</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view>
        <view class="reason-prefs"><view v-for="item in preferences" :key="item.label" class="reason-pref"><text class="reason-pref__label">{{ item.label }}</text><text class="reason-pref__value">{{ item.value }}</text></view></view>
        <k-button block icon="sparkles" class="rematch-button" @click="s = 2">按新条件重新匹配</k-button><text class="ai-note reason-note">调整偏好后，我们将为你重新匹配更优结果</text><view class="k-home-indicator" />
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { experience, loadPreferences } from '@/common/experience.js'
import { useScreen, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
const s = useScreen(4)
onShow(loadPreferences)
const idea = ref('预算1000，想在大理住一周，\n还想做点兼职')
const entries = [
  { name: '换宿旅行', icon: 'house', tone: 'green', route: R.jobsList + '?type=volunteer' },
  { name: '兼职旅行', icon: 'briefcase-business', tone: 'red', route: R.jobsList + '?type=parttime' },
  { name: '全职驻店', icon: 'store', tone: 'indigo', route: R.jobsList + '?type=fulltime' },
  { name: '旅居订房', icon: 'key-round', tone: 'ochre', route: R.staysList }
]
const activities = [
  { title: '大理早市摊位招募', date: '05.22 周三 08:00', place: '大理古城', image: '/static/media/home-act-1.jpg' },
  { title: '手作皮具体验课', date: '05.24 周五 14:00', place: '双廊镇', image: '/static/media/home-act-2.jpg' },
  { title: '洱海净滩行动', date: '05.26 周日 09:30', place: '才村码头', image: '/static/media/home-act-3.jpg' }
]
const preferences = [
  { label: '入住时间', value: '5.25 - 6.1', icon: 'calendar-days', extra: 'rotate-ccw' },
  { label: '人数', value: '1 人', icon: 'user-round' },
  { label: '工作时长偏好', value: '每天 4 小时内', icon: 'clock-3' },
  { label: '技能标签（可选）', value: '手工 / 摄影 / 文案', icon: 'tags' }
]
const matchedJobs = [
  { title: '大理古城 · 手作店兼职', skill: '摄影', price: '120', score: 92, image: '/static/media/home-job-1.jpg', reason: '技能匹配度高，工作时间灵活，\n可提供住宿，距离合适。' },
  { title: '喜洲古镇 · 咖啡店兼职', skill: '服务', price: '100', score: 85, image: '/static/media/home-job-2.jpg', reason: '工作氛围好，时间匹配，\n需要咖啡制作经验。' },
  { title: '才村码头 · 民宿前台兼职', skill: '客服', price: '110', score: 78, image: '/static/media/home-job-3.jpg', reason: '可提供住宿，距离洱海近，\n工作内容匹配。' }
]
const reasons = [
  { label: '城市', icon: 'house', score: 92, desc: '你选择了大理，我们优先推荐\n大理及周边的优质商家。' },
  { label: '时间', icon: 'clock-3', score: 95, desc: '入住时间 5.25 - 6.1、工作时长\n每天 ≤4小时，匹配度高。' },
  { label: '技能', icon: 'wrench', score: 90, desc: '你擅长 手工 / 摄影 / 文案，\n与岗位需求高度匹配。' },
  { label: '预算', icon: 'badge-dollar-sign', score: 93, desc: '你的预算 1000元以内 / 周，\n推荐的房源和岗位均在预算内。' },
  { label: '生活偏好', icon: 'heart-handshake', score: 88, desc: '你希望 住宿舒适、离洱海近、\n有生活氛围，我们已为你筛选。' }
]
const openEntry = (item) => go(item.route)
const clearPrefs = () => toast('已清空偏好')
</script>

<style scoped lang="scss">
.interest-entry { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 0; border-bottom:1px solid var(--k-line); }.interest-entry>view { min-width:0; display:flex; flex-direction:column; gap:6px; }.interest-title { font-size:15px; font-weight:600; color:var(--k-green); }.interest-copy { font-size:14px; color:var(--k-muted); line-height:1.5; }
.home-page { font-family: var(--k-serif); }
.brand { padding-left: 8px; font-size: 22px; font-weight: 700; white-space: nowrap; }
.home-content { padding: 0 16px 118px; }
.location { height: 40px; display: flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 700; }
.search-box { height: 44px; border: 1px solid var(--k-line2); border-radius: 12px; background: var(--k-paper); display: flex; align-items: center; padding-left: 12px; overflow: hidden; }
.search-box__placeholder { flex: 1; margin-left: 8px; color: var(--k-light); font-size: 14px; }
.search-box__action { width: 66px; height: 100%; background: var(--k-paper2); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; }
.entry-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); margin-top: 22px; }
.entry { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.entry__icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35); }
.entry__icon.is-green { background: var(--k-green); } .entry__icon.is-red { background: var(--k-red); } .entry__icon.is-indigo { background: var(--k-indigo); } .entry__icon.is-ochre { background: var(--k-ochre); }
.entry__name { font-size: 13px; font-weight: 700; white-space: nowrap; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-top: 22px; margin-bottom: 10px; }
.section-head__title { font-size: 17px; font-weight: 700; }
.section-head__more { display: flex; align-items: center; color: var(--k-muted); font-size: 12px; }
.activity-row { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; }
.activity-card { overflow: hidden; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.activity-card__image { width: 100%; height: 82px; }
.activity-card__copy { padding: 8px 8px 7px; display: flex; flex-direction: column; gap: 3px; }
.activity-card__title { font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.activity-card__meta { color: var(--k-muted); font-size: 11px; white-space: nowrap; }
.safe-chip { align-self: flex-start; height: 20px; padding: 0 6px; border-radius: 5px; background: var(--k-green-soft); color: var(--k-green); display: inline-flex; align-items: center; gap: 2px; font-size: 10px; white-space: nowrap; flex: 0 0 auto; }
.recommend-head { margin-top: 20px; }
.recommend { height: 118px; display: flex; align-items: center; gap: 12px; padding-right: 12px; overflow: hidden; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.recommend__image { width: 135px; height: 118px; flex: 0 0 auto; }
.recommend__copy { flex: 1; min-width: 0; }
.recommend__title { display: block; font-size: 15px; font-weight: 700; white-space: nowrap; }
.recommend__chips { display: flex; align-items: center; gap: 5px; margin-top: 7px; }
.recommend__price { margin-top: 8px; font-size: 12px; }
.recommend__meta { display: block; margin-top: 5px; color: var(--k-muted); font-size: 12px; }
.ai-body { position: relative; min-height: calc(100vh - 88px); padding: 28px 18px 42px; }
.ai-avatar { width: 56px; height: 56px; border-radius: 50%; border: 1px solid var(--k-green); }
.ai-title { display: block; margin-top: 14px; font-size: 21px; font-weight: 700; }
.ai-intro { display: block; margin-top: 10px; font-size: 15px; line-height: 1.7; white-space: pre-line; }
.idea-box { position: relative; margin-top: 26px; height: 110px; border: 1px solid var(--k-line2); border-radius: 12px; background: var(--k-paper); padding: 14px; }
.idea-box__input { width: 100%; height: 72px; font-family: var(--k-serif); font-size: 16px; line-height: 1.6; }
.idea-box__count { position: absolute; right: 14px; bottom: 10px; color: var(--k-muted); font-size: 12px; }
.preference-head { margin-top: 32px; display: flex; align-items: center; justify-content: space-between; }
.preference-head__title { font-size: 15px; font-weight: 700; }
.preference-head__hint, .preference-head__clear { color: var(--k-muted); font-size: 12px; }
.pref-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 12px; }
.pref-card { height: 66px; padding: 0 11px; display: flex; align-items: center; gap: 9px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.pref-card__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.pref-card__label { color: var(--k-muted); font-size: 12px; white-space: nowrap; }
.pref-card__value { font-size: 14px; font-weight: 700; white-space: nowrap; }
.match-button { margin-top: 34px; }
.ai-note { display: block; margin-top: 16px; color: var(--k-muted); text-align: center; font-size: 12px; }
.result-tabs { height: 48px; display: flex; border-bottom: 1px solid var(--k-line); }
.result-tab { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; }
.result-tab.active { color: var(--k-red); }
.result-tab.active::after { content: ''; position: absolute; bottom: 0; left: 50%; width: 50px; height: 3px; border-radius: 2px; background: var(--k-red); transform: translateX(-50%); }
.result-body { position: relative; min-height: calc(100vh - 136px); padding: 14px 16px 36px; }
.result-sort { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; color: var(--k-muted); font-size: 12px; }
.match-card { position: relative; min-height: 150px; margin-bottom: 12px; display: flex; overflow: hidden; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.match-card__image { width: 92px; min-height: 150px; height: auto; flex: 0 0 auto; }
.match-card__main { flex: 1; min-width: 0; padding: 12px 10px; }
.match-card__title { display: block; padding-right: 56px; font-size: 15px; font-weight: 700; white-space: nowrap; }
.match-card__tag { margin-top: 5px; display: flex; align-items: center; gap: 6px; }
.match-card__skill { color: var(--k-muted); font-size: 11px; }
.match-card__price { margin-top: 7px; font-size: 12px; }
.match-card__date { display: block; margin-top: 5px; color: var(--k-muted); font-size: 11px; white-space: nowrap; }
.match-card__line { height: 1px; margin: 8px 0 6px; background: var(--k-line); }
.match-card__reason { display: block; color: var(--k-muted); font-size: 11px; line-height: 1.5; white-space: pre-line; }
.match-card__score { position: absolute; right: 10px; top: 31px; display: flex; flex-direction: column; align-items: flex-end; color: var(--k-muted); font-size: 10px; }
.match-card__percent { color: var(--k-green); font-family: Georgia,serif; font-size: 30px; line-height: 1; }
.match-card__percent-sign { font-size: 16px; }
.result-end { display: block; margin: 18px 0 6px; color: var(--k-light); text-align: center; font-size: 13px; }
.reason-body { position: relative; min-height: calc(100vh - 88px); padding: 10px 16px 34px; }
.score-card { height: 128px; padding: 16px; display: flex; align-items: center; gap: 20px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.score-ring { width: 92px; height: 92px; border-radius: 50%; border: 7px solid var(--k-green); box-shadow: inset 0 0 0 5px var(--k-paper), inset 0 0 0 6px var(--k-line); display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 0 auto; }
.score-ring__num { color: var(--k-green); font-family: Georgia,serif; font-size: 32px; line-height: 1; }
.score-ring__sign { font-size: 17px; }
.score-ring__label { margin-top: 6px; font-size: 12px; }
.score-card__text { font-size: 15px; line-height: 1.7; white-space: pre-line; }
.reason-title { display: block; margin: 14px 0 8px; font-size: 16px; font-weight: 700; }
.reason-list { padding: 0 10px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.reason-row { min-height: 64px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--k-line); }
.reason-row:last-child { border-bottom: 0; }
.reason-row__icon { width: 36px; height: 36px; border-radius: 50%; background: var(--k-green-soft); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.reason-row__label { width: 46px; font-size: 14px; font-weight: 700; flex: 0 0 auto; }
.reason-row__desc { flex: 1; min-width: 0; color: var(--k-muted); font-size: 11px; line-height: 1.55; white-space: pre-line; }
.reason-row__score { color: var(--k-green); font-family: Georgia,serif; font-size: 17px; }
.reason-pref-head { margin-top: 14px; }
.reason-prefs { display: grid; grid-template-columns: 1.05fr .62fr 1.2fr 1.3fr; gap: 6px; margin-top: 10px; }
.reason-pref { min-width: 0; min-height: 53px; padding: 8px; border: 1px solid var(--k-line); border-radius: 9px; background: var(--k-paper); }
.reason-pref__label { display: block; color: var(--k-muted); font-size: 9px; white-space: nowrap; }
.reason-pref__value { display: block; margin-top: 5px; font-size: 11px; font-weight: 700; white-space: nowrap; }
.rematch-button { margin-top: 16px; }
.reason-note { margin-top: 11px; }
</style>
