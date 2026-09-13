<template>
  <view class="k-page activity-page">
    <!-- 1 活动列表 -->
    <template v-if="s === 1">
      <k-topbar title="活动" back>
        <template #left><view class="city-select"><k-icon name="chevron-down" :size="13" color="ink" /><text>大理</text><k-icon name="chevron-down" :size="13" color="ink" /></view></template>
        <view class="search"><k-icon name="search" :size="18" color="light" /><text class="search__text">想去哪儿，想做什么？</text><view class="search__btn"><text>搜索</text></view></view>
        <view class="k-tabs activity-tabs"><view v-for="tab in tabs" :key="tab" class="k-tabs__item" :class="{ active: activeTab === tab }" @click="activeTab = tab"><text>{{ tab }}</text></view></view>
      </k-topbar>
      <view class="list-body k-pad-tab">
        <view class="remind-row"><text>有新活动提醒我</text><view class="switch" :class="{ on: remind }" @click="remind = !remind"><view class="switch__knob" /></view></view>
        <view v-for="group in activityGroups" :key="group.date" class="date-group">
          <text class="date-title">{{ group.date }}</text>
          <view v-for="item in group.items" :key="item.title" class="activity-item" @click="s = 3">
            <image class="activity-item__img" :src="item.img" mode="aspectFill" />
            <view class="activity-item__copy"><text class="activity-item__title">{{ item.title }}</text><view class="meta"><k-icon name="clock" :size="14" color="muted" /><text>{{ item.time }}</text></view><view class="meta"><k-icon name="map-pin" :size="14" color="muted" /><text>集合：{{ item.place }}</text></view><view class="item-status"><text class="kind" :class="`kind--${item.tone}`">{{ item.kind }}</text><text class="quota" :class="{ few: item.few }">{{ item.few ? '名额仅多' : '名额充足' }}</text></view><view class="signup"><view class="avatar-stack"><image v-for="(a, i) in avatars5" :key="i" class="small-avatar" :src="a" mode="aspectFill" /></view><text>{{ item.count }}人已报名</text></view></view>
          </view>
        </view>
      </view>
      <k-tabbar active="community" />
    </template>

    <!-- 2 AI推荐区 -->
    <template v-else-if="s === 2">
      <k-topbar title="为你推荐" back />
      <view class="ai-body k-pad-tab">
        <view class="ai-banner"><view><text class="ai-banner__title">AI 为你推荐个性活动</text><text class="ai-banner__sub">基于你的兴趣、位置与行程智能推荐</text></view><image class="ai-banner__img" src="/static/media/activity-ai-banner.jpg" mode="aspectFit" /></view>
        <text class="ai-section-title">个性推荐</text>
        <view v-for="item in recommended" :key="item.title" class="rec-card" @click="s = 3">
          <view class="rec-photo"><image class="rec-img" :src="item.img" mode="aspectFill" /><text class="reason-chip" :class="`reason-chip--${item.tone}`">{{ item.reason }}</text></view>
          <view class="rec-copy"><text class="rec-title">{{ item.title }}</text><text class="rec-reason">推荐理由：{{ item.desc }}</text><view class="meta"><k-icon name="map-pin" :size="14" color="muted" /><text>距离 {{ item.distance }}</text><text class="quota rec-quota">{{ item.few ? '名额较少' : '名额充足' }}</text></view><view class="meta"><k-icon name="clock" :size="14" color="muted" /><text>{{ item.time }}</text></view><view class="signup"><view class="avatar-stack"><image v-for="(a, i) in avatars4" :key="i" class="small-avatar" :src="a" mode="aspectFill" /></view><text>{{ item.count }}人已报名</text></view></view>
        </view>
        <view class="more-head"><text>更多活动</text><view class="filters"><view v-for="f in filters" :key="f" class="filter"><text>{{ f }}</text><k-icon name="chevron-down" :size="13" color="muted" /></view></view></view>
        <view v-for="item in moreActivities" :key="item.title" class="more-item" @click="s = 3"><image class="more-img" :src="item.img" mode="aspectFill" /><view class="more-copy"><view class="k-between"><text class="more-title">{{ item.title }}</text><text class="kind kind--business">{{ item.kind }}</text></view><view class="meta"><k-icon name="clock" :size="14" color="muted" /><text>{{ item.time }}</text></view><view class="meta"><k-icon name="map-pin" :size="14" color="muted" /><text>集合：{{ item.place }}</text></view><view class="signup"><view class="avatar-stack"><image v-for="(a, i) in avatars4" :key="i" class="small-avatar" :src="a" mode="aspectFill" /></view><text>{{ item.count }}人已报名</text><text class="distance">距离 {{ item.distance }}</text></view></view></view>
      </view>
      <k-tabbar active="community" />
    </template>

    <!-- 3 活动详情 -->
    <template v-else-if="s === 3">
      <k-topbar title="活动详情" back />
      <view class="detail-body k-pad-bottom">
        <image class="detail-hero" src="/static/media/activity-hero.jpg" mode="aspectFill" />
        <view class="detail-summary"><view class="detail-title-row"><text class="detail-kind">小院活动</text><text class="detail-title">苍山日出徒步</text></view><text class="detail-slogan">迎接第一缕阳光，徒步登顶，遇见不一样的大理</text><view class="price-row"><view><text class="price">¥60</text><text class="per">/人</text></view><view class="insurance"><k-icon name="shield-check" :size="26" color="ochre" /><text>含户外保险</text></view></view></view>
        <view class="detail-info"><view class="detail-line"><k-icon name="clock" :size="18" color="ink" /><text>9月7日（周日）05:30–10:00</text></view><view class="detail-line"><k-icon name="map-pin" :size="18" color="ink" /><text>集合：喜洲古镇停车场</text></view><view class="detail-line"><k-icon name="footprints" :size="18" color="ink" /><text>徒步约 8km · 累计爬升 600m · 中等强度</text></view></view>
        <view class="detail-section host-section"><text class="detail-section__title">主办方</text><view class="host"><image class="host-logo" src="/static/media/activity-host-logo.jpg" mode="aspectFit" /><view class="host-copy"><view class="host-name-row"><text class="host-name">袋鼠小院</text><text class="host-chip">官方认证</text><text class="host-chip">优质组织</text></view><text class="host-meta">组织活动 128 场 ｜ 好评率 98%</text></view><k-button type="outline" size="xs">查看主页</k-button></view></view>
        <view class="detail-section intro"><text class="detail-section__title">活动介绍</text><text class="detail-text">清晨出发，一起徒步苍山，见证日出云海的壮美。\n路线轻徒步，适合大多数朋友，记得带上手机和保暖衣物～</text><view class="expand"><text>展开</text><k-icon name="chevron-down" :size="15" color="muted" /></view></view>
        <view class="detail-section fee"><text class="detail-section__title">费用与保障</text><view class="fee-row"><text class="fee-label">费用包含</text><text>领队服务、保险、能量补给、活动组织</text></view><view class="fee-row"><text class="fee-label">保障说明</text><text>含意外险（保额20万），安全保障</text></view></view>
      </view>
      <k-bottom pad="10px 16px"><view class="bottom-side"><k-icon name="heart" :size="26" color="ink" /><text>收藏</text></view><view class="bottom-main"><k-button size="lg" block @click="s = 4"><text class="signup-label">立即报名</text><text class="signup-price">¥60</text></k-button></view><view class="bottom-side"><k-icon name="share-2" :size="26" color="ink" /><text>分享</text></view></k-bottom>
    </template>

    <!-- 4 报名成功 -->
    <template v-else>
      <k-topbar title="报名成功" back @back="s = 3" />
      <view class="success-body k-pad-tab">
        <view class="success-head"><view><text class="success-title">报名成功</text><text class="success-sub">期待与你一起出发！</text></view><image class="success-stamp" src="/static/media/activity-stamp.jpg" mode="aspectFit" /></view>
        <view class="ticket"><view class="ticket-top"><image class="ticket-img" src="/static/media/activity-sunrise.jpg" mode="aspectFill" /><view class="ticket-copy"><text class="detail-kind">小院活动</text><text class="ticket-title">苍山日出徒步</text><view class="detail-line"><k-icon name="clock" :size="17" color="muted" /><text>9月7日（周日）05:30–10:00</text></view><view class="detail-line"><k-icon name="map-pin" :size="17" color="muted" /><text>集合：喜洲古镇停车场</text></view></view></view><view class="ticket-dash" /><view class="ticket-data"><view v-for="row in ticketRows" :key="row.label" class="ticket-data__row"><text>{{ row.label }}</text><text>{{ row.value }}</text></view></view></view>
        <view class="reminder"><k-icon name="bell" :size="23" color="ink" /><view><text class="reminder-title">集合提醒</text><text class="reminder-sub">活动前1天 20:00 提醒我</text></view><text class="reminder-link">修改提醒</text></view>
        <view class="action-grid"><view v-for="action in successActions" :key="action.title" class="success-action" @click="action.click"><k-icon :name="action.icon" :size="34" color="ink" :stroke="1.4" /><view><text class="action-title">{{ action.title }}</text><text class="action-sub">{{ action.sub }}</text></view></view></view>
      </view>
      <k-tabbar active="community" />
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
const s = useScreen(4)
const tabs = ['全部', '小院活动', '商家活动', '用户自发']
const activeTab = ref('全部')
const remind = ref(true)
const avatars5 = ['/static/media/community-avatar-abu.jpg', '/static/media/community-avatar-luyu.jpg', '/static/media/community-avatar-xiaoman.jpg', '/static/media/community-avatar-shanye.jpg', '/static/media/community-avatar-yunduo.jpg']
const avatars4 = avatars5.slice(0, 4)
const activityGroups = [{ date: '今天  9月5日 周五', items: [{ title: '苍山日出徒步', time: '05:30–10:00', place: '喜洲古镇', kind: '小院活动', tone: 'yard', count: 18, img: '/static/media/activity-sunrise.jpg' }, { title: '古城咖啡拉花体验', time: '14:00–16:00', place: '大理古城', kind: '商家活动', tone: 'business', count: 12, img: '/static/media/activity-coffee.jpg' }] }, { date: '明天  9月6日 周六', items: [{ title: '周末草地音乐会', time: '16:30–19:30', place: '洱海生态廊道', kind: '用户自发', tone: 'user', count: 26, few: true, img: '/static/media/activity-concert.jpg' }, { title: '手作陶艺体验', time: '10:00–12:00', place: '陶然光工作室', kind: '商家活动', tone: 'business', count: 10, img: '/static/media/activity-pottery.jpg' }] }]
const recommended = [{ title: '苍山日出徒步', reason: '最匹配', tone: 'green', desc: '你最近收藏了徒步路线', distance: '12km', time: '9月7日（周日）05:30', count: 18, img: '/static/media/activity-sunrise.jpg' }, { title: '周末草地音乐会', reason: '可能冲突', tone: 'orange', desc: '与「苍山日出徒步」时间冲突', distance: '5.2km', time: '9月7日（周日）16:30', count: 26, few: true, img: '/static/media/activity-concert.jpg' }, { title: '非遗扎染体验', reason: '明活动', tone: 'blue', desc: '你对手作视觉感兴趣', distance: '0.9km', time: '9月8日（周一）10:00', count: 8, img: '/static/media/activity-tiedye.jpg' }]
const filters = ['全部日期', '全部类型', '默认排序']
const moreActivities = [{ title: '大理白族扎染体验', kind: '商家活动', time: '9月8日（周一）10:00–12:00', place: '周城传统扎染工坊', count: 8, distance: '9.6km', img: '/static/media/activity-tiedye-2.jpg' }, { title: '洱海骑行一日游', kind: '小院活动', time: '9月8日（周一）09:30–17:00', place: '大理古城', count: 16, distance: '2.3km', img: '/static/media/activity-cycling.jpg' }]
const ticketRows = [{ label: '报名人', value: '小袋鼠' }, { label: '手机号', value: '138****5678' }, { label: '订单号', value: 'KD202509050941' }, { label: '报名时间', value: '2025-09-05 09:41:23' }]
const successActions = [{ title: '加入活动群', sub: '与同伴交流、获取最新通知', icon: 'users-round', click: () => toast('已加入活动群') }, { title: '添加到行程', sub: '加入我的行程安排', icon: 'calendar-days', click: () => go(R.trip) }, { title: '分享给朋友', sub: '一起参与精彩活动', icon: 'share-2', click: () => toast('分享') }, { title: '返回首页', sub: '发现更多活动', icon: 'house', click: () => go(R.home) }]
</script>

<style scoped lang="scss">
.activity-page { background: var(--k-bg); }
.city-select { margin-left: -4px; display: flex; align-items: center; gap: 5px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.search { margin: 2px 14px 5px; height: 34px; padding-left: 10px; border: 1px solid var(--k-line2); border-radius: 17px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; }
.search__text { flex: 1; color: var(--k-light); font-size: 13px; }
.search__btn { height: 30px; padding: 0 14px; border-radius: 16px; background: var(--k-paper2); display: flex; align-items: center; font-family: var(--k-serif); font-size: 13px; font-weight: 700; }
.activity-tabs { padding: 0 12px; }
.activity-tabs .k-tabs__item { font-size: 14px; }
.list-body { padding: 0 14px 100px; }
.remind-row { height: 42px; border-bottom: 1px solid var(--k-line); display: flex; align-items: center; justify-content: space-between; font-family: var(--k-serif); font-size: 14px; font-weight: 700; }
.switch { width: 43px; height: 25px; padding: 2px; border-radius: 15px; background: #BDB8AF; box-sizing: border-box; }
.switch.on { background: var(--k-green); }
.switch__knob { width: 21px; height: 21px; border-radius: 50%; background: #fff; transition: transform .15s; }
.switch.on .switch__knob { transform: translateX(18px); }
.date-title { display: block; margin: 10px 0 7px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.activity-item { min-height: 104px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--k-line); display: flex; gap: 10px; }
.activity-item__img { width: 158px; height: 103px; border-radius: 8px; flex: 0 0 auto; }
.activity-item__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.activity-item__title, .rec-title, .more-title { font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.meta { min-width: 0; display: flex; align-items: center; gap: 5px; color: var(--k-muted); font-size: 11px; }
.meta text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-status { display: flex; align-items: center; justify-content: space-between; }
.kind { padding: 2px 6px; border-radius: 4px; font-size: 10px; }
.kind--yard { color: var(--k-green); background: var(--k-green-soft); }
.kind--business { color: #9A672E; background: var(--k-ochre-soft); }
.kind--user { color: #AD6A1D; background: #F5E7CE; }
.quota { padding: 2px 7px; border: 1px solid #AEC7B5; border-radius: 5px; color: var(--k-green); font-size: 10px; }
.quota.few { color: #AA752A; border-color: #D8BD91; }
.signup { margin-top: auto; display: flex; align-items: center; gap: 7px; color: var(--k-muted); font-size: 11px; }
.avatar-stack { display: flex; }
.small-avatar { width: 20px; height: 20px; border: 1.5px solid var(--k-paper); border-radius: 50%; margin-left: -5px; }
.small-avatar:first-child { margin-left: 0; }
.ai-body { padding: 10px 14px 100px; }
.ai-banner { height: 64px; padding: 8px 12px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; }
.ai-banner__title { display: block; font-family: var(--k-serif); font-size: 18px; font-weight: 700; }
.ai-banner__sub { display: block; margin-top: 5px; color: var(--k-muted); font-size: 11px; }
.ai-banner__img { width: 114px; height: 54px; }
.ai-section-title, .more-head > text { display: block; margin: 11px 0 7px; font-family: var(--k-serif); font-size: 17px; font-weight: 700; }
.rec-card { height: 104px; padding: 7px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; gap: 10px; box-sizing: border-box; }
.rec-card + .rec-card { margin-top: 7px; }
.rec-photo { position: relative; width: 112px; height: 90px; flex: 0 0 auto; }
.rec-img { width: 112px; height: 90px; border-radius: 7px; }
.reason-chip { position: absolute; top: 3px; left: 3px; padding: 2px 6px; border-radius: 4px; color: #fff; font-size: 10px; }
.reason-chip--green { background: var(--k-green); }.reason-chip--orange { background: #B7762D; }.reason-chip--blue { background: var(--k-indigo); }
.rec-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.rec-reason { color: var(--k-muted); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rec-quota { margin-left: auto; }
.more-head { display: flex; align-items: center; justify-content: space-between; }
.filters { display: flex; gap: 6px; }
.filter { height: 25px; padding: 0 8px; border: 1px solid var(--k-line2); border-radius: 7px; background: var(--k-paper); display: flex; align-items: center; gap: 4px; font-size: 10px; }
.more-item { min-height: 88px; padding: 7px 0; border-bottom: 1px solid var(--k-line); display: flex; gap: 10px; }
.more-img { width: 92px; height: 82px; border-radius: 7px; flex: 0 0 auto; }
.more-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.more-title { font-size: 15px; }
.distance { margin-left: auto; }
.detail-body { padding-bottom: 112px; }
.detail-hero { width: 100%; height: 166px; }
.detail-summary { height: 96px; padding: 11px 14px; border-bottom: 1px solid var(--k-line); box-sizing: border-box; }
.detail-title-row { display: flex; align-items: center; gap: 10px; }
.detail-kind { align-self: flex-start; padding: 3px 7px; border-radius: 4px; background: var(--k-green); color: #fff; font-size: 11px; }
.detail-title { font-family: var(--k-serif); font-size: 22px; font-weight: 700; }
.detail-slogan { display: block; margin-top: 7px; color: var(--k-muted); font-size: 12px; }
.price-row { display: flex; align-items: flex-end; justify-content: space-between; }
.price { color: var(--k-red); font-family: Georgia, serif; font-size: 22px; font-weight: 700; }.per { color: var(--k-muted); font-size: 12px; }
.insurance { width: 66px; height: 52px; margin-top: -31px; border: 1px solid #D2B17B; border-radius: 7px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: #98672E; font-size: 10px; }
.detail-info { height: 70px; padding: 7px 14px; border-bottom: 1px solid var(--k-line); box-sizing: border-box; display: flex; flex-direction: column; gap: 4px; }
.detail-line { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.detail-section { padding: 9px 14px; border-bottom: 1px solid var(--k-line); box-sizing: border-box; }
.detail-section__title { display: block; margin-bottom: 7px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.host-section { height: 78px; }
.host { display: flex; align-items: center; gap: 9px; }
.host-logo { width: 35px; height: 35px; border-radius: 50%; }
.host-copy { min-width: 0; flex: 1; }
.host-name-row { display: flex; align-items: center; gap: 6px; }.host-name { font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.host-chip { padding: 2px 5px; border: 1px solid #D6BD98; border-radius: 4px; color: #95672F; font-size: 9px; }
.host-meta { display: block; margin-top: 4px; color: var(--k-muted); font-size: 11px; }
.intro { height: 85px; position: relative; }.detail-text { display: block; color: var(--k-muted); font-size: 12px; line-height: 1.65; white-space: pre-line; }
.expand { position: absolute; right: 14px; bottom: 9px; display: flex; align-items: center; gap: 3px; color: var(--k-muted); font-size: 12px; }
.fee { height: 72px; }.fee-row { display: flex; gap: 12px; color: var(--k-muted); font-size: 11px; line-height: 1.7; }.fee-label { color: var(--k-ink); min-width: 54px; }
.bottom-side { width: 54px; flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 11px; }.bottom-main { min-width: 0; flex: 1; }.signup-label { font-size: 18px; }.signup-price { margin-left: 8px; font-size: 13px; }
.success-body { padding: 0 16px 100px; }
.success-head { height: 150px; padding: 25px 55px 10px; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; }
.success-title { display: block; color: var(--k-green); font-family: var(--k-serif); font-size: 22px; font-weight: 700; }.success-sub { display: block; margin-top: 8px; color: var(--k-muted); font-size: 13px; }
.success-stamp { width: 92px; height: 92px; transform: rotate(-8deg); }
.ticket { padding: 16px; border: 1px solid var(--k-line2); border-radius: 11px; background: var(--k-paper); }
.ticket-top { display: flex; gap: 14px; }.ticket-img { width: 96px; height: 96px; border-radius: 7px; flex: 0 0 auto; }.ticket-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 7px; }.ticket-title { font-family: var(--k-serif); font-size: 18px; font-weight: 700; }
.ticket-dash { margin: 12px -16px 9px; border-top: 1px dashed var(--k-line2); }
.ticket-data { display: flex; flex-direction: column; gap: 7px; }.ticket-data__row { display: flex; font-size: 13px; }.ticket-data__row text:first-child { width: 82px; color: var(--k-muted); }
.reminder { height: 49px; margin-top: 12px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; gap: 10px; }.reminder-title { display: block; font-family: var(--k-serif); font-size: 14px; font-weight: 700; }.reminder-sub { display: block; margin-top: 2px; color: var(--k-muted); font-size: 11px; }.reminder-link { margin-left: auto; color: var(--k-green); font-size: 12px; font-weight: 600; }
.action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }.success-action { height: 80px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; gap: 12px; }.action-title { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }.action-sub { display: block; margin-top: 5px; color: var(--k-muted); font-size: 10px; line-height: 1.4; }
</style>
