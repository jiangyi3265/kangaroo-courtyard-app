<template>
  <view class="k-page trip">
    <!-- 1 我的行程列表（自动生成） -->
    <template v-if="s === 1">
      <k-topbar>
        <template #left>
          <view class="brand"><text class="brand__name">袋鼠小院</text><view class="brand__city"><k-icon name="map-pin" :size="16" color="ink" :stroke="1.8" fill /><text>昆明</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="2" /></view></view>
        </template>
        <view class="tabs">
          <view v-for="t in tabs" :key="t" class="tabs__item" :class="{ active: tab === t }" @click="tab = t"><text>{{ t }}</text></view>
        </view>
      </k-topbar>
      <view class="hint k-between">
        <view class="k-row k-gap4"><k-icon name="refresh-cw" :size="12" color="ochre" :stroke="2" /><text class="k-tiny">行程由你的报名与报名记录自动生成</text></view>
        <view class="k-row" @click="toast('筛选')"><text class="k-small">筛选</text><k-icon name="chevron-right" :size="14" color="ink" /></view>
      </view>
      <view class="k-body k-pad-tab list">
        <view v-for="g in groups" :key="g.city" class="group">
          <view class="group__head"><text class="group__title">{{ g.city }} · {{ g.range }}</text><text class="k-meta">{{ g.total }}</text></view>
          <view v-for="it in g.items" :key="it.title" class="item" @click="s = 2">
            <view class="item__tag" :class="'is-' + it.tone"><text>{{ it.tag }}</text></view>
            <view class="k-flex1"><text class="item__title">{{ it.title }}</text><text class="item__date">{{ it.date }}</text></view>
            <view class="item__status" :class="'is-' + it.stone"><text>{{ it.status }}</text></view>
          </view>
        </view>
      </view>
      <k-tabbar active="trip" />
    </template>

    <!-- 2 行程详情 -->
    <template v-else-if="s === 2">
      <k-topbar title="行程详情" back @back="s = 1" />
      <view class="k-body k-pad-safe">
        <view class="head">
          <view class="k-row k-gap10">
            <view class="head__tag"><text>义工</text></view>
            <text class="head__title k-flex1">换宿义工 · 咖啡小院</text>
            <view class="item__status is-green"><text>已确认</text></view>
          </view>
          <view class="k-row k-gap4 k-mt10"><k-icon name="map-pin" :size="15" color="muted" :stroke="1.8" /><text class="k-small k-muted">大理古城</text></view>
          <view class="head__line" />
          <view class="k-row k-gap12"><text class="k-small">9月5日（周五）—9月12日（周五）</text><text class="k-meta">共8天7晚</text></view>
        </view>

        <view class="tl">
          <view v-for="(d, i) in timeline" :key="d.date" class="tl__row" :class="{ last: i === timeline.length - 1 }">
            <view class="tl__left">
              <view class="tl__dot" /><view v-if="i < timeline.length - 1" class="tl__line" />
              <text class="tl__date">{{ d.date }}</text><text class="tl__week">{{ d.week }}</text>
              <text v-if="d.extra" class="tl__date tl__extra">{{ d.extra }}</text>
            </view>
            <view class="tl__right">
              <view class="tl__dot tl__dot--r" /><view v-if="i < timeline.length - 1" class="tl__line" />
              <text v-for="(l, j) in d.lines" :key="j" class="tl__text" :class="{ today: l === '今天' }">{{ l }}</text>
            </view>
          </view>
        </view>

        <view class="info">
          <view v-for="(r, i) in infoRows" :key="r.label" class="info__row" :class="{ 'has-line': i < infoRows.length - 1 }">
            <text class="info__label">{{ r.label }}</text>
            <view class="k-flex1 k-col k-gap6"><text v-for="(l, j) in r.lines" :key="j" class="k-small k-muted"><k-icon v-if="l.pin" name="map-pin" :size="13" color="muted" :stroke="1.8" />{{ l.t || l }}</text></view>
            <k-button type="secondary" size="sm" @click="r.go()">{{ r.btn }}</k-button>
          </view>
        </view>

        <view class="acts">
          <view v-for="a in acts" :key="a.label" class="acts__item" @click="a.go()"><k-icon :name="a.icon" :size="30" color="ink" :stroke="1.4" /><text>{{ a.label }}</text></view>
        </view>
        <view class="k-home-indicator" />
      </view>
    </template>

    <!-- 3 同行候选 -->
    <template v-else-if="s === 3">
      <k-topbar title="同行候选" back @back="s = 2">
        <template #right><view class="city-cap"><text>大理</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="2" /><view class="city-cap__ring"><view class="city-cap__core" /></view></view></template>
      </k-topbar>
      <view class="k-body match">
        <view class="match__head">
          <view class="k-between"><text class="match__title">与你行程重叠≥2天 的同行（12人）</text><view class="filter-pill" @click="toast('筛选')"><text class="k-small">筛选</text><k-icon name="chevron-right" :size="14" color="ink" /></view></view>
          <view class="k-row k-gap6 k-mt6"><k-icon name="shield-check" :size="16" color="green" :stroke="1.8" /><text class="k-small k-muted">已为你隐藏隐私信息，放心交流</text></view>
          <view v-for="p in people" :key="p.name" class="person" @click="openPerson(p)">
            <image class="person__avatar" :src="p.avatar" mode="aspectFill" />
            <view class="k-flex1">
              <view class="k-between"><text class="person__name">{{ p.name }}</text><text class="person__days">{{ p.days }}天重叠</text></view>
              <view class="k-row k-gap10 k-mt4"><text class="k-small k-muted">{{ p.meta }}</text><k-chip tone="green" icon="shield-check" icon-fill>实名已验证</k-chip></view>
              <view class="k-mt6"><k-chip tone="green" icon="shield-check" icon-fill>行程已验证</k-chip></view>
              <view class="person__hobby"><text class="k-small k-muted">共同兴趣</text><text class="k-small">{{ p.hobby }}</text></view>
            </view>
          </view>
        </view>
      </view>
      <view class="privacy-bar privacy-bar--fixed">
        <view class="privacy-bar__icon"><k-icon name="lock" :size="14" color="green" :stroke="1.8" /></view>
        <text class="k-small k-muted">隐私保护：不展示手机号、微信号等隐私信息</text>
        <view class="k-home-indicator" />
      </view>
    </template>

    <!-- 4 同行个人页 -->
    <template v-else>
      <k-topbar title="同行个人页" back @back="s = 3" />
      <view class="k-body k-pad-safe">
        <view class="profile">
          <view class="profile__top">
            <image class="profile__avatar" src="/static/media/trip-avatar-1-lg.jpg" mode="aspectFill" />
            <view class="k-flex1 k-col k-gap8">
              <text class="profile__name">小满同学</text>
              <text class="k-small k-muted">22岁 · 女 · 北京</text>
              <view class="k-row k-gap8"><k-chip tone="green" icon="shield-check" icon-fill>实名已验证</k-chip><k-chip tone="green" icon="shield-check" icon-fill>行程已验证</k-chip></view>
            </view>
          </view>
          <text class="profile__overlap">与您行程重叠8天（9.5—9.12）</text>
          <view class="profile__sec"><text class="profile__h">公开简介</text><text class="k-small k-muted k-pre profile__bio">喜欢慢节奏的旅行与生活，热爱摄影和徒步，\n目前在探索咖啡与手作的世界。</text></view>
          <view class="profile__sec"><text class="profile__h">技能</text><view class="k-row k-gap10 k-mt10"><view v-for="sk in skills" :key="sk" class="skill"><text>{{ sk }}</text></view></view></view>
          <view class="profile__sec"><text class="profile__h">旅行偏好</text>
            <view class="prefs"><view v-for="p in prefs" :key="p.label" class="prefs__item"><view class="prefs__circle"><k-icon :name="p.icon" :size="22" color="ink" :stroke="1.5" /></view><text class="k-small">{{ p.label }}</text></view></view>
          </view>
          <view class="profile__sec no-line"><view class="k-row k-gap4"><text class="profile__h">共同日期</text><text class="k-small k-muted">（重叠8天）</text></view>
            <view class="dates">
              <view v-for="(d, i) in dates" :key="d.d" class="dates__item"><text class="dates__d">{{ d.d }}</text><view class="dates__track"><view v-if="i > 0" class="dates__line dates__line--l" /><view v-if="i < dates.length - 1" class="dates__line dates__line--r" /><view class="dates__dot" /></view><text class="k-meta">{{ d.w }}</text></view>
            </view>
          </view>
          <view class="notice"><k-icon name="shield-check" :size="16" color="green" :stroke="1.8" /><text class="k-small k-muted">将向对方发起私信，介绍你们自己与行程计划</text></view>
          <k-button block class="k-mt10" @click="meet">认识一下</k-button>
          <view class="k-center-box k-mt10" @click="toast('分享行程名片')"><text class="k-small">分享我的行程名片</text></view>
          <view class="privacy-bar privacy-bar--inline">
            <view class="privacy-bar__icon"><k-icon name="lock" :size="14" color="green" :stroke="1.8" /></view>
            <text class="k-small k-muted">隐私保护：不展示手机号、微信号等隐私信息</text>
          </view>
        </view>
        <view class="k-home-indicator" />
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const tabs = ['全部', '义工', '兼职', '全职', '住宿', '活动']
const tab = ref('全部')
const groups = [
  { city: '大理', range: '9月5日—9月12日', total: '共8天7晚', items: [
    { tag: '义工', tone: 'ochre', title: '换宿义工 · 咖啡小院', date: '9.5—9.9（5天）', status: '已确认', stone: 'green' },
    { tag: '活动', tone: 'blue', title: '苍山日出徒步', date: '9.7（周日）05:30', status: '已报名', stone: 'green' },
    { tag: '住宿', tone: 'ochre', title: '大理古城 · 咖啡小院', date: '9.5—9.12（7晚）', status: '已支付', stone: 'green' }
  ] },
  { city: '丽江', range: '9月13日—9月18日', total: '共6天5晚', items: [
    { tag: '兼职', tone: 'ochre', title: '古城咖啡拉花体验', date: '9.13—9.18（6天）', status: '待面试', stone: 'ochre' },
    { tag: '住宿', tone: 'ochre', title: '束河古镇 · 青禾客栈', date: '9.13—9.18（5晚）', status: '已支付', stone: 'green' }
  ] },
  { city: '成都', range: '9月19日—9月25日', total: '共7天6晚', items: [
    { tag: '全职', tone: 'ochre', title: '手作老师（兼职）', date: '9.19—9.25（7天）', status: '待面试', stone: 'ochre' },
    { tag: '活动', tone: 'blue', title: '周末茶地音乐会', date: '9.21（周日）16:30', status: '已报名', stone: 'green' }
  ] }
]
const timeline = [
  { date: '9.5', week: '周五', lines: ['今天', '14:00　入住办理', '15:30　岗位培训与工作安排'] },
  { date: '9.6', week: '周六', extra: '9.9 周二', lines: ['日常工作', '咖啡制作 / 接待 / 协助店务 等'] },
  { date: '9.7', week: '周日', lines: ['05:30　苍山日出徒步（已报名）'] },
  { date: '9.10', week: '周三', lines: ['自由时间'] },
  { date: '9.12', week: '周五', lines: ['离店结算'] }
]
const infoRows = [
  { label: '住宿信息', lines: ['大理古城 · 咖啡小院', { pin: true, t: '大理古城人民路88号' }], btn: '联系商家', go: () => go(R.chat + '?s=1') },
  { label: '岗位信息', lines: ['换宿义工', '咖啡制作 / 接待 / 协助店务', '工作时长：5 小时 / 天'], btn: '查看详情', go: () => go(R.jobDetail) },
  { label: '活动安排', lines: ['苍山日出徒步', '9月7日（周日）05:30 集合'], btn: '查看详情', go: () => go(R.activity) }
]
const acts = [
  { icon: 'pencil', label: '编辑行程', go: () => toast('编辑行程') },
  { icon: 'bot', label: '编辑到店信息', go: () => go(R.jobContract) },
  { icon: 'headset', label: '联系商家', go: () => go(R.chat + '?s=1') },
  { icon: 'users', label: '加入当地群', go: () => go(R.chat + '?s=2') }
]
const people = [
  { name: '小满同学', days: 8, meta: '22岁 · 女 · 北京', hobby: '摄影 / 徒步 / 咖啡', avatar: '/static/media/trip-avatar-1.jpg' },
  { name: '阿布在大理', days: 6, meta: '24岁 · 男 · 广州', hobby: '音乐 / 骑行 / 手作', avatar: '/static/media/trip-avatar-2.jpg' },
  { name: '鹿屿', days: 7, meta: '23岁 · 女 · 成都', hobby: '读书 / 市集 / 慢生活', avatar: '/static/media/trip-avatar-3.jpg' },
  { name: '山野来信', days: 4, meta: '26岁 · 男 · 杭州', hobby: '露营 / 摄影 / 电影', avatar: '/static/media/trip-avatar-4.jpg' },
  { name: '云朵不说话', days: 3, meta: '25岁 · 女 · 上海', hobby: '手作 / 咖啡 / 市集', avatar: '/static/media/chat-member-5.jpg' }
]
const skills = ['咖啡制作', '拉花', '手冲', '基础烘焙']
const prefs = [
  { icon: 'footprints', label: '喜欢徒步' }, { icon: 'camera', label: '喜欢拍照' }, { icon: 'cooking-pot', label: '慢节奏' }, { icon: 'leaf', label: '深度体验' }
]
const dates = [
  { d: '9.5', w: '周五' }, { d: '9.6', w: '周六' }, { d: '9.7', w: '周日' }, { d: '9.8', w: '周一' }, { d: '9.9', w: '周二' }, { d: '9.10', w: '周三' }, { d: '9.11', w: '周四' }, { d: '9.12', w: '周五' }
]
const openPerson = () => { s.value = 4 }
const meet = () => go(R.chat + '?s=1')
</script>

<style scoped lang="scss">
/* s1 */
.brand { display: flex; align-items: center; gap: 12px; padding-left: 8px; }
.brand__name { font-family: var(--k-serif); font-weight: 700; font-size: 21px; letter-spacing: 1px; }
.brand__city { display: flex; align-items: center; gap: 3px; font-size: 15px; }
.tabs { display: flex; align-items: center; justify-content: space-between; padding: 0 16px; height: 44px; border-bottom: 1px solid var(--k-line); }
.tabs__item { position: relative; height: 44px; display: flex; align-items: center; font-size: 15px; color: var(--k-ink); padding: 0 6px; }
.tabs__item.active { font-weight: 700; }
.tabs__item.active::after { content: ""; position: absolute; left: 6px; right: 6px; bottom: 0; height: 2px; background: var(--k-red); border-radius: 1px; }
.hint { height: 32px; padding: 0 16px; border-bottom: 1px solid var(--k-line); }
.list { padding-top: 8px; display: flex; flex-direction: column; gap: 10px; }
.group { border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); padding: 8px 8px 8px; }
.group__head { display: flex; align-items: baseline; gap: 12px; padding: 2px 2px 8px; }
.group__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.item { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 10px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-bg); margin-top: 8px; }
.item:first-of-type { margin-top: 0; }
.item__tag { width: 40px; height: 22px; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 13px; flex: 0 0 auto; }
.item__tag.is-ochre { background: var(--k-ochre-soft); color: #9A6A22; }
.item__tag.is-blue { background: var(--k-indigo-soft); color: var(--k-indigo); }
.item__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 16px; line-height: 1.3; }
.item__date { display: block; font-size: 13px; color: var(--k-muted); margin-top: 2px; line-height: 1.4; }
.item__status { height: 22px; padding: 0 8px; border-radius: 5px; display: flex; align-items: center; font-size: 13px; flex: 0 0 auto; }
.item__status.is-green { background: var(--k-green-soft); color: var(--k-green); }
.item__status.is-ochre { background: var(--k-ochre-soft); color: #9A6A22; }

/* s2 */
.head { background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 12px; padding: 12px 14px; }
.head__tag { height: 22px; padding: 0 8px; border-radius: 5px; background: var(--k-green-soft); color: var(--k-green); font-size: 13px; display: flex; align-items: center; }
.head__title { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.head__line { height: 1px; background: var(--k-line); margin: 12px 0 10px; }
.tl { padding: 16px 0 6px; }
.tl__row { display: flex; }
.tl__left { position: relative; width: 107px; flex: 0 0 auto; padding-left: 66px; padding-bottom: 14px; }
.tl__right { position: relative; flex: 1; min-width: 0; padding-left: 29px; padding-bottom: 14px; }
.tl__dot { position: absolute; left: 48px; top: 7px; width: 7px; height: 7px; border-radius: 50%; background: #9A6A22; }
.tl__dot--r { left: 12px; }
.tl__line { position: absolute; top: 15px; bottom: -6px; width: 1px; background: var(--k-line2); }
.tl__left .tl__line { left: 51px; }
.tl__right .tl__line { left: 15px; }
.tl__row.last .tl__left, .tl__row.last .tl__right { padding-bottom: 0; }
.tl__date { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; line-height: 1.4; }
.tl__week { display: block; font-size: 12px; color: var(--k-muted); margin-top: 1px; }
.tl__extra { font-size: 13px; margin-top: 3px; }
.tl__text { display: block; font-size: 14px; line-height: 1.4; margin-bottom: 4px; }
.tl__text.today { color: #9A6A22; }
.info { border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); padding: 0 10px; margin-top: 8px; }
.info__row { display: flex; align-items: center; gap: 12px; padding: 14px 0; }
.info__row.has-line { border-bottom: 1px solid var(--k-line); }
.info__label { width: 68px; flex: 0 0 auto; font-family: var(--k-serif); font-weight: 700; font-size: 16px; align-self: flex-start; white-space: nowrap; }
.acts { display: flex; justify-content: space-around; padding: 14px 8px 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); margin-top: 12px; }
.acts__item { display: flex; flex-direction: column; align-items: center; gap: 10px; font-size: 14px; }

/* s3 */
.city-cap { height: 32px; border: 1px solid rgba(36,27,23,.14); border-radius: 16px; background: rgba(255,255,255,.55); display: flex; align-items: center; gap: 4px; padding: 0 8px 0 10px; font-size: 14px; }
.city-cap__ring { width: 16px; height: 16px; border: 2px solid var(--k-ink); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-left: 6px; }
.city-cap__core { width: 6px; height: 6px; border-radius: 50%; background: var(--k-ink); }
.match { padding-top: 4px; padding-bottom: calc(60px + var(--k-safe-bottom)); }
.match__head { border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper2); padding: 12px 8px 8px; }
.match__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; padding-left: 4px; }
.filter-pill { height: 28px; padding: 0 6px 0 10px; border: 1px solid var(--k-line); border-radius: 6px; background: var(--k-paper); display: flex; align-items: center; }
.match__head .k-row.k-gap6 { padding-left: 4px; }
.person { display: flex; gap: 14px; padding: 12px 12px 14px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); margin-top: 10px; }
.person__avatar { width: 52px; height: 52px; border-radius: 50%; flex: 0 0 auto; margin-top: 2px; }
.person__name { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.person__days { color: #9A6A22; font-weight: 700; font-size: 15px; font-family: var(--k-sans); }
.person__hobby { display: flex; gap: 20px; margin-top: 12px; margin-left: -66px; }
.privacy-bar { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--k-paper2); border-top: 1px solid var(--k-line); }
.privacy-bar--fixed { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; padding-bottom: calc(14px + var(--k-safe-bottom)); }
.privacy-bar--inline { margin: 12px -14px -12px; border-radius: 0 0 12px 12px; padding: 12px 16px; }
.privacy-bar__icon { width: 24px; height: 24px; border-radius: 50%; border: 1.5px solid var(--k-green); display: flex; align-items: center; justify-content: center; }

/* s4 */
.profile { border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); padding: 12px 14px 12px; }
.profile__top { display: flex; align-items: center; gap: 18px; padding: 4px 0 0 0; }
.profile__avatar { width: 84px; height: 84px; border-radius: 50%; flex: 0 0 auto; }
.profile__name { font-family: var(--k-serif); font-weight: 700; font-size: 22px; }
.profile__overlap { display: block; text-align: center; font-size: 14px; margin-top: 10px; }
.profile__sec { padding: 12px 0; border-top: 1px solid var(--k-line); margin-top: 0; }
.profile__sec:first-of-type { margin-top: 12px; }
.profile__sec.no-line { padding-bottom: 8px; }
.profile__h { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.profile__bio { display: block; margin-top: 8px; line-height: 1.7; }
.skill { height: 30px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; font-size: 13px; white-space: nowrap; }
.prefs { display: flex; justify-content: space-between; padding: 10px 2px 0; }
.prefs__item { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.prefs__circle { width: 42px; height: 42px; border-radius: 50%; background: var(--k-paper2); border: 1px solid var(--k-line); display: flex; align-items: center; justify-content: center; }
.dates { display: flex; margin-top: 8px; }
.dates__item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.dates__d { font-size: 14px; }
.dates__track { position: relative; width: 100%; height: 12px; display: flex; align-items: center; justify-content: center; }
.dates__line { position: absolute; top: 50%; height: 1px; background: var(--k-line2); }
.dates__line--l { left: 0; right: 50%; }
.dates__line--r { left: 50%; right: 0; }
.dates__dot { position: relative; width: 9px; height: 9px; border-radius: 50%; background: #9A6A22; }
.notice { display: flex; align-items: center; gap: 10px; padding: 11px 14px; background: var(--k-paper2); border: 1px solid var(--k-line); border-radius: 10px; margin-top: 6px; }
.tl { padding-top: 9px; }
.tl__left, .tl__right { padding-bottom: 7px; }
.tl__text { line-height: 1.25; margin-bottom: 2px; }
.info__row { padding: 9px 0; }
.acts { margin-top: 8px; padding-top: 10px; padding-bottom: 9px; }
</style>
