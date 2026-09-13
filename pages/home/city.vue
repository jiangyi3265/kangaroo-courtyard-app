<template>
  <view class="k-page city-page">
    <template v-if="s === 1">
      <k-topbar><template #left><view class="city-name" @click="s = 2"><text>大理</text><k-icon name="chevron-down" :size="16" color="ink" /></view></template></k-topbar>
      <view class="city-home k-pad-tab">
        <view class="weather-card">
          <view class="weather-card__visual"><image class="weather-card__image" src="/static/media/city-weather.jpg" mode="aspectFill" /><view class="weather-card__info"><view class="k-row"><text class="weather-card__degree">20°</text><text class="weather-card__weather">多云</text></view><text class="weather-card__meta">12°~24° | 空气优</text></view></view>
          <view class="weather-card__copy"><text class="weather-card__week">本周氛围</text><text class="weather-card__slogan">慢下来，\n遇见在地生活</text><view class="weather-card__score"><k-icon name="shield-check" :size="15" color="white" :stroke="2" /><text>安心指数 92%</text></view></view>
        </view>
        <view class="stats"><view v-for="item in stats" :key="item.label" class="stat"><text class="stat__num">{{ item.num }}</text><text class="stat__label">{{ item.label }}</text></view></view>
        <view v-for="item in citySections" :key="item.title" class="city-section">
          <view class="city-section__head"><text>{{ item.title }}</text><view class="k-row" @click="go(item.route)"><text>更多</text><k-icon name="chevron-right" :size="15" color="muted" /></view></view>
          <view class="city-banner" @click="go(item.route)"><view class="city-banner__copy"><text class="city-banner__title">{{ item.main }}</text><text class="city-banner__sub">{{ item.sub }}</text></view><image class="city-banner__image" :src="item.image" mode="aspectFill" /></view>
        </view>
        <text class="group-label">当前城市群</text>
        <view class="city-group" @click="go(R.community)"><view><text class="city-group__title">滇西生活圈</text><text class="city-group__sub">大理 · 丽江 · 腾冲 · 香格里拉</text></view><k-icon name="chevron-right" :size="22" color="ink" /></view>
      </view>
      <view class="bot-fab" @click="s = 3"><image src="/static/media/city-bot.jpg" mode="aspectFit" /></view>
      <k-tabbar active="home" />
    </template>

    <template v-else-if="s === 2">
      <k-topbar title="切换城市" back @back="s = 1" />
      <view class="switch-body k-pad-bottom">
        <view class="city-search"><k-icon name="search" :size="20" color="light" /><input v-model="keyword" placeholder="搜索城市 / 拼音首字母" placeholder-class="k-placeholder" /></view>
        <text class="switch-title">当前定位</text>
        <view class="current-city"><k-icon name="map-pin" :size="21" color="red" fill /><text class="current-city__name">大理市 · 云南省</text><k-chip tone="green"><text>当前城市</text></k-chip><k-icon name="locate-fixed" :size="20" color="ink" /></view>
        <view class="switch-head"><text>最近访问</text><k-icon name="trash-2" :size="17" color="muted" /></view>
        <view class="city-chips"><view v-for="name in recentCities" :key="name" class="city-chip"><text>{{ name }}</text></view></view>
        <text class="switch-title hot-title">热门城市</text>
        <view class="city-chips city-chips--five"><view v-for="name in hotCities" :key="name" class="city-chip"><text>{{ name }}</text></view></view>
        <text class="switch-title alpha-title">按字母查找</text>
        <view v-for="group in alphaCities" :key="group.letter" class="alpha-group"><text class="alpha-group__letter">{{ group.letter }}</text><text v-for="name in group.items" :key="name" class="alpha-group__city">{{ name }}</text></view>
        <text class="alphabet">#\nA\nC\nD\nE\nF\nG\nH\nJ\nK\nL\nM\nN\nQ\nR\nS\nT\nX\nY\nZ</text>
      </view>
      <view class="locate-failed"><view class="k-row k-gap8"><k-icon name="map-pin-off" :size="18" color="muted" /><text>定位失败，无法获取当前位置</text></view><text class="locate-failed__retry" @click="toast('正在重新定位')">重试定位</text><view class="k-home-indicator" /></view>
    </template>

    <template v-else-if="s === 3">
      <k-topbar title="智能客服" back @back="s = 1" />
      <view class="chat-body">
        <view class="assistant-head"><view class="assistant-head__avatar"><image src="/static/media/city-bot.jpg" mode="aspectFit" /></view><view><text class="assistant-head__name">袋鼠小助手</text><text class="assistant-head__meta">24 小时为你服务</text></view></view>
        <view class="bubble bubble--me"><text>我的报名进度如何?</text></view>
        <view class="bubble bubble--bot"><text>根据你的账号信息，以下是你的报名进度：</text><view class="application"><image class="application__image" src="/static/media/city-chat-room.jpg" mode="aspectFill" /><view class="application__copy"><text class="application__title">大理 · 双廊海景民宿\n前台接待（兼职）</text><text class="application__status">报名审核中</text></view><view class="application__line" /><text class="application__meta">报名时间：2025-05-18 10:32\n预计审核：1–2 个工作日</text></view><view class="source"><k-icon name="circle-check" :size="15" color="green" /><text>数据来源：袋鼠小院报名系统</text><k-icon name="link" :size="14" color="indigo" /></view></view>
        <view class="quick-actions"><view v-for="item in ['报名进度','退款规则','保险保障','联系商家']" :key="item"><text>{{ item }}</text></view></view>
        <view class="bubble bubble--me bubble--question"><text>如果行程有变可以退款吗?</text></view>
        <view class="bubble bubble--bot refund"><text>可以的。若因行程变更需要退款，请在订单开始前至少 48 小时申请，平台将按以下规则处理：</text><text class="refund__rules">· 距开始 ≥ 48 小时：可全额退款\n· 距开始 24–48 小时：退款 50%\n· 距开始 ＜ 24 小时：不支持退款</text><view class="application__line" /><view class="source"><text>来源：袋鼠小院《退款规则》</text><k-icon name="link" :size="14" color="indigo" /></view></view>
        <view class="feedback"><k-icon name="thumbs-up" :size="18" color="muted" /><k-icon name="thumbs-down" :size="18" color="muted" /><view class="human" @click="toast('正在转接人工客服')"><text>转人工客服</text></view></view>
      </view>
      <view class="chat-input"><view class="chat-input__box"><k-icon name="power" :size="18" color="muted" /><input placeholder="输入你的问题..." placeholder-class="k-placeholder" /><k-icon name="smile" :size="21" color="ink" /><k-icon name="circle-plus" :size="23" color="ink" /></view><view class="k-home-indicator" /></view>
    </template>

    <template v-else>
      <k-topbar title="推荐更合适的机会" back @back="s = 1" />
      <view class="empty-body k-pad-safe">
        <image class="empty-image" src="/static/media/city-empty.jpg" mode="aspectFit" />
        <text class="empty-title">暂时没找到完全合适的</text>
        <text class="empty-desc">与你的部分条件存在冲突，我们为你推荐\n放宽条件，找到更多可能</text>
        <view class="conflict-card"><text class="conflict-card__title">与你的条件冲突</text><text>日期：06.01–06.15 期间机会较少</text><text>预算：≤ 1500 元 / 月 可选较少</text><text>距离：希望在 大理市 内 选择较少</text></view>
        <view class="relax-card"><text class="conflict-card__title">建议放宽条件（可多选）</text><view v-for="(item,i) in relaxItems" :key="item.label" class="relax-row"><k-icon :name="item.icon" :size="19" color="ink" /><text class="relax-row__label">{{ item.label }}</text><text class="relax-row__value">{{ item.value }}</text><k-icon v-if="i === 0" name="chevron-right" :size="15" color="light" /><view class="k-switch" :class="{ on: item.on }" @click="item.on = !item.on" /></view></view>
        <view class="empty-actions"><view class="subscribe" @click="toast('已订阅新机会')"><text class="subscribe__title">订阅新机会</text><text>上新及时通知你</text></view><view class="contact" @click="s = 3"><text class="subscribe__title">联系客服</text><text>人工协助更高效</text></view></view>
        <view class="bot-fab bot-fab--empty" @click="s = 3"><image src="/static/media/city-bot.jpg" mode="aspectFit" /></view><view class="k-home-indicator" />
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
const s = useScreen(4)
const keyword = ref('')
const stats = [{ num: 126, label: '在招机会' }, { num: 38, label: '本周上新' }, { num: 18, label: '可报名活动' }]
const citySections = [
  { title: '住哪里', main: '把大理，过成日常', sub: '精选旅居地 · 长住更安心', image: '/static/media/city-stay.jpg', route: R.staysList },
  { title: '做什么', main: '手作工作 · 与在地共创', sub: '158 个手作岗位在线', image: '/static/media/city-work.jpg', route: R.jobsList },
  { title: '去活动', main: '市集 / 沙龙 / 工作坊', sub: '本周 24 场活动', image: '/static/media/city-event.jpg', route: R.activity }
]
const recentCities = ['大理','丽江','成都','杭州']
const hotCities = ['大理','丽江','成都','杭州','广州','深圳','重庆','西安','厦门','苏州']
const alphaCities = [{ letter: 'A', items: ['阿坝州','安吉','安阳'] }, { letter: 'B', items: ['北京','保山','北海'] }]
const relaxItems = reactive([
  { label: '放宽日期范围', value: '± 7 天', icon: 'calendar-days', on: true },
  { label: '提高预算上限', value: '≤ 2000 元 / 月', icon: 'badge-dollar-sign', on: false },
  { label: '扩大距离范围', value: '30 公里内', icon: 'map-pin', on: false }
])
</script>

<style scoped lang="scss">
.city-page { font-family: var(--k-serif); }
.city-name { padding-left: 8px; display: flex; align-items: center; gap: 5px; font-size: 20px; font-weight: 700; }
.city-home { padding: 4px 16px 108px; }
.weather-card { height: 122px; display: flex; overflow: hidden; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.weather-card__visual { position: relative; width: 55%; height: 100%; overflow: hidden; }
.weather-card__image { width: 100%; height: 100%; }
.weather-card__info { position: absolute; inset: 12px 10px; }
.weather-card__degree { font-family: Georgia,serif; font-size: 34px; line-height: 1; }
.weather-card__weather { margin-left: 12px; font-size: 14px; font-weight: 700; }
.weather-card__meta { display: block; margin-top: 8px; font-size: 12px; }
.weather-card__copy { flex: 1; padding: 14px 12px; }
.weather-card__week { display: block; font-size: 12px; font-weight: 700; }
.weather-card__slogan { display: block; margin-top: 7px; font-size: 17px; line-height: 1.45; white-space: pre-line; }
.weather-card__score { height: 24px; margin-top: 8px; padding: 0 8px; border-radius: 12px; background: var(--k-green); color: #fff; display: inline-flex; align-items: center; gap: 3px; font-size: 11px; }
.stats { height: 64px; margin-top: 10px; display: flex; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.stat { position: relative; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.stat + .stat::before { content: ''; position: absolute; left: 0; height: 36px; width: 1px; background: var(--k-line); }
.stat__num { font-family: Georgia,serif; font-size: 22px; line-height: 1.1; }
.stat__label { margin-top: 4px; font-size: 11px; font-weight: 700; }
.city-section { margin-top: 12px; }
.city-section__head { height: 26px; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; }
.city-section__head .k-row { color: var(--k-muted); font-size: 11px; font-weight: 400; }
.city-banner { height: 74px; overflow: hidden; display: flex; align-items: stretch; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); }
.city-banner__copy { flex: 1; padding: 11px 12px; }
.city-banner__title { display: block; font-size: 15px; font-weight: 700; }
.city-banner__sub { display: block; margin-top: 7px; color: var(--k-muted); font-size: 11px; }
.city-banner__image { width: 44%; height: 74px; }
.group-label { display: block; margin-top: 12px; font-size: 15px; font-weight: 700; }
.city-group { height: 58px; margin-top: 6px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; }
.city-group__title { display: block; font-size: 14px; font-weight: 700; }
.city-group__sub { display: block; margin-top: 3px; color: var(--k-muted); font-size: 10px; }
.bot-fab { position: fixed; z-index: 60; right: 24px; bottom: 96px; width: 60px; height: 60px; border-radius: 50%; border: 3px solid #91A1AE; background: var(--k-indigo); display: flex; align-items: center; justify-content: center; box-shadow: 0 5px 14px rgba(36,27,23,.18); }
.bot-fab image { width: 38px; height: 38px; border-radius: 50%; }
.switch-body { position: relative; padding: 10px 16px 90px; }
.city-search { height: 42px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 22px; background: var(--k-paper); display: flex; align-items: center; gap: 9px; }
.city-search input { flex: 1; height: 40px; font-size: 14px; }
.switch-title { display: block; margin-top: 22px; font-size: 15px; font-weight: 700; }
.current-city { height: 52px; margin-top: 8px; padding: 0 14px; display: flex; align-items: center; gap: 10px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.current-city__name { flex: 1; font-size: 16px; font-weight: 700; }
.switch-head { margin-top: 20px; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; }
.city-chips { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; margin-top: 8px; }
.city-chips--five { grid-template-columns: repeat(5,minmax(0,1fr)); }
.city-chip { height: 30px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 14px; }
.hot-title { margin-top: 22px; }
.alpha-title { margin-top: 22px; }
.alpha-group__letter { display: block; height: 34px; padding-top: 10px; border-bottom: 1px solid var(--k-line); font-size: 14px; }
.alpha-group__city { display: block; height: 38px; padding: 10px 8px 0; font-size: 14px; }
.alphabet { position: absolute; right: 5px; top: 330px; color: var(--k-muted); font-size: 8px; line-height: 1.25; white-space: pre-line; text-align: center; }
.locate-failed { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; height: calc(58px + var(--k-safe-bottom)); padding: 0 18px var(--k-safe-bottom); border-top: 1px solid var(--k-line); background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; color: var(--k-muted); font-size: 12px; }
.locate-failed__retry { color: var(--k-red); font-weight: 700; }
.chat-body { padding: 12px 16px 92px; }
.assistant-head { display: flex; align-items: center; gap: 10px; }
.assistant-head__avatar { width: 48px; height: 48px; border-radius: 50% 50% 50% 8px; border: 1px solid var(--k-line); background: var(--k-paper); display: flex; align-items: center; justify-content: center; }
.assistant-head__avatar image { width: 36px; height: 36px; }
.assistant-head__name { display: block; font-size: 15px; font-weight: 700; }
.assistant-head__meta { display: block; color: var(--k-muted); font-size: 12px; }
.bubble { margin-top: 14px; padding: 12px; border-radius: 12px; font-size: 14px; line-height: 1.55; }
.bubble--me { max-width: 260px; margin-left: auto; background: #ECEDEF; border-bottom-right-radius: 2px; }
.bubble--bot { width: 292px; background: var(--k-paper); border: 1px solid var(--k-line); border-bottom-left-radius: 2px; }
.application { margin-top: 8px; padding: 8px; border: 1px solid var(--k-line); border-radius: 8px; display: flex; flex-wrap: wrap; gap: 9px; }
.application__image { width: 70px; height: 64px; border-radius: 6px; }
.application__copy { flex: 1; }
.application__title { display: block; font-size: 13px; font-weight: 700; white-space: pre-line; }
.application__status { display: block; margin-top: 5px; color: var(--k-ochre); font-size: 12px; font-weight: 700; }
.application__line { width: 100%; height: 1px; background: var(--k-line); }
.application__meta { font-size: 11px; line-height: 1.7; white-space: pre-line; }
.source { display: flex; align-items: center; gap: 5px; margin-top: 8px; color: var(--k-muted); font-size: 10px; }
.quick-actions { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; margin-top: 14px; }
.quick-actions view { height: 34px; border: 1px solid var(--k-line); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 11px; white-space: nowrap; }
.bubble--question { margin-top: 16px; }
.refund { width: 310px; }
.refund__rules { display: block; margin-top: 8px; line-height: 1.75; white-space: pre-line; }
.feedback { display: flex; align-items: center; gap: 16px; margin-top: 10px; }
.human { margin-left: auto; height: 34px; padding: 0 14px; border: 1px solid var(--k-line); border-radius: 9px; color: var(--k-red); display: flex; align-items: center; }
.chat-input { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; padding: 10px 14px calc(10px + var(--k-safe-bottom)); border-top: 1px solid var(--k-line); background: var(--k-paper); }
.chat-input__box { height: 42px; padding: 0 10px; border: 1px solid var(--k-line); border-radius: 22px; display: flex; align-items: center; gap: 8px; }
.chat-input__box input { flex: 1; height: 40px; }
.empty-body { position: relative; min-height: calc(100vh - 88px); padding: 18px 18px 34px; text-align: center; }
.empty-image { width: 126px; height: 126px; margin: 0 auto; }
.empty-title { display: block; margin-top: 4px; font-size: 20px; font-weight: 700; }
.empty-desc { display: block; margin-top: 8px; color: var(--k-muted); font-size: 13px; line-height: 1.7; white-space: pre-line; }
.conflict-card, .relax-card { margin-top: 14px; padding: 14px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); text-align: left; display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
.conflict-card__title { font-size: 15px; font-weight: 700; }
.relax-card { gap: 0; }
.relax-row { min-height: 44px; display: flex; align-items: center; gap: 10px; }
.relax-row__label { flex: 1; font-size: 13px; }
.relax-row__value { color: var(--k-muted); font-size: 13px; }
.empty-actions { display: grid; grid-template-columns: .95fr 1.05fr; gap: 10px; margin-top: 20px; }
.subscribe, .contact { height: 64px; border: 1px solid var(--k-red); border-radius: 10px; color: var(--k-red); display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; }
.contact { background: var(--k-red); color: #fff; }
.subscribe__title { display: block; font-size: 16px; font-weight: 700; }
.bot-fab--empty { right: 24px; bottom: 18px; }
</style>
