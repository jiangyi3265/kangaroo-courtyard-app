<template>
  <view class="k-page filter-page">
    <template v-if="s === 1">
      <k-topbar title="筛选条件" back @back="back"><template #right><text class="reset" @click="reset">重置</text></template></k-topbar>
      <view class="filter-body k-pad-bottom">
        <view class="filter-card"><view class="filter-head"><view class="k-row k-gap10"><k-icon name="map-pin" :size="21" color="ink" /><text>城市</text></view><view class="k-row k-gap4"><text class="filter-head__meta">已选 2 个</text><k-icon name="chevron-right" :size="17" color="muted" /></view></view><view class="option-row"><view v-for="(item,i) in cityOptions" :key="item" class="option" :class="{ on: i < 2 }"><text>{{ item }}</text><view v-if="i < 2" class="option__check"><k-icon name="check" :size="10" color="white" :stroke="3" /></view><k-icon v-if="i === 4" name="chevron-down" :size="12" color="muted" /></view></view></view>
        <view class="filter-card filter-line"><view class="filter-head"><view class="k-row k-gap10"><k-icon name="calendar-days" :size="21" color="ink" /><text>可到岗日期</text></view><view class="k-row k-gap6"><text>2025-09-10 及以后</text><k-icon name="chevron-right" :size="17" color="muted" /></view></view></view>
        <view v-for="group in filterGroups" :key="group.title" class="filter-card filter-options"><view class="filter-head"><view class="k-row k-gap10"><k-icon :name="group.icon" :size="21" color="ink" /><text>{{ group.title }}</text></view><view v-if="group.meta || group.arrow" class="k-row k-gap4"><text v-if="group.meta" class="filter-head__meta">{{ group.meta }}</text><k-icon v-if="group.arrow" name="chevron-right" :size="17" color="muted" /></view></view><view class="option-row"><view v-for="(item,i) in group.options" :key="item" class="option" :class="{ on: isSelected(group.selected, i) }"><text>{{ item }}</text><view v-if="isSelected(group.selected, i)" class="option__check"><k-icon name="check" :size="10" color="white" :stroke="3" /></view></view></view></view>
        <view class="switch-row"><view class="k-row k-gap10"><k-icon name="shield-check" :size="21" color="green" /><text>安心商家</text></view><view class="k-switch on" /></view>
        <view class="switch-row"><view class="k-row k-gap10"><k-icon name="shield" :size="21" color="ink" /><text>含保险</text></view><view class="k-switch on" /></view>
      </view>
      <k-bottom><k-button block @click="s = 3">查看 18 个机会</k-button></k-bottom>
    </template>

    <template v-else-if="s === 2">
      <k-topbar title="新机会订阅" back @back="s = 1" />
      <view class="subscribe-body k-pad-safe">
        <view v-for="group in subscriptionGroups" :key="group.title" class="subscribe-card"><view class="filter-head"><view class="k-row k-gap8"><k-icon :name="group.icon" :size="21" color="ink" /><text>{{ group.title }}</text><text class="subscribe-card__hint">（可多选）</text></view><view class="k-row k-gap4"><text class="filter-head__meta">已选 {{ group.items.length }} 个</text><k-icon name="chevron-right" :size="17" color="muted" /></view></view><view class="selected-row"><view v-for="item in group.items" :key="item" class="selected-chip"><text>{{ item }}</text><k-icon name="x" :size="13" color="muted" /></view><view class="selected-chip"><k-icon name="plus" :size="14" color="muted" /><text>{{ group.add }}</text></view></view></view>
        <view class="subscribe-line"><view class="k-row k-gap10"><k-icon name="calendar-days" :size="21" color="ink" /><text>可到岗日期</text></view><view class="k-row k-gap6"><text>2025-09-10 及以后</text><k-icon name="chevron-right" :size="17" color="muted" /></view></view>
        <view class="match-slider"><view class="k-row k-gap10"><k-icon name="heart" :size="21" color="ink" /><text>最低匹配度</text></view><view class="slider"><view class="slider__active" /><view class="slider__knob"><text>80%</text></view><view v-for="n in [60,70,80,90,95]" :key="n" class="slider__mark"><view /><text>{{ n }}%</text></view></view></view>
        <view class="message-switch"><view class="k-row k-gap10"><k-icon name="bell" :size="21" color="ink" /><view><text class="message-switch__title">微信订阅消息</text><text class="message-switch__sub">开启后，将通过微信服务通知推送新机会</text></view></view><view class="k-switch on" /></view>
        <view class="frequency"><view class="k-row k-gap10"><k-icon name="list-checks" :size="21" color="ink" /><text>推送频率</text></view><view class="frequency__choices"><view class="frequency__item"><view class="k-radio checked" /><view><text>即时推送</text><text>有新机会立即通知你</text></view></view><view class="frequency__item"><view class="k-radio" /><view><text>每日汇总</text><text>每天上午 9:00 汇总推送</text></view></view></view></view>
        <k-button block class="save-button" @click="toast('提醒已保存')">保存提醒</k-button><view class="manage-note"><k-icon name="lock-keyhole" :size="15" color="muted" /><text>可随时在「我的-订阅」中管理</text></view><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else-if="s === 3">
      <k-topbar title="手作老师（兼职）· 大理等 2 城" back @back="s = 1" />
      <view class="result-body k-pad-safe">
        <view class="chosen"><view v-for="item in ['大理 ×','丽江 ×','可到岗 9-10 以后 ×','手作老师 ×','4-6小时 ×']" :key="item"><text>{{ item }}</text></view><view><k-icon name="filter" :size="14" color="ink" /><text>筛选</text></view></view>
        <text class="result-count">共 18 个机会</text>
        <view v-for="job in jobs" :key="job.title" class="job-card" @click="go(R.jobDetail)"><image class="job-card__image" :src="job.image" mode="aspectFill" /><view class="job-card__copy"><view class="k-between"><text class="job-card__title">{{ job.title }}</text><k-chip tone="green"><text>{{ job.match }}%匹配</text></k-chip></view><view class="job-card__tags"><k-chip v-for="tag in job.tags" :key="tag"><text>{{ tag }}</text></k-chip></view><view class="job-card__meta"><k-icon name="store" :size="13" color="muted" /><text>{{ job.place }}</text></view><view class="job-card__meta"><k-icon name="map-pin" :size="13" color="muted" /><text>{{ job.date }}</text></view><view class="job-card__bottom"><view class="k-row k-gap4"><k-icon name="shield-check" :size="14" color="ochre" /><text>安心商家 · 含保险</text></view><view class="job-card__price"><text class="k-price">{{ job.price }}</text><text>元/天</text></view></view></view><k-icon class="job-card__star" name="star" :size="20" color="muted" /></view>
        <view class="skeleton"><view class="skeleton__image" /><view class="skeleton__lines"><view class="skeleton__line is-long" /><view class="skeleton__line is-short" /><view class="skeleton__line" /><view class="skeleton__line is-mid" /></view></view>
        <view class="loading"><view class="loading__spinner" /><text>正在加载更多...</text></view><view class="k-home-indicator" />
      </view>
    </template>

    <template v-else>
      <k-topbar title="手作老师（兼职）· 大理等 2 城" back @back="s = 1" />
      <view class="empty-body k-pad-safe">
        <view class="chosen"><view v-for="item in ['大理 ×','丽江 ×','可到岗 9-10 以后 ×','手作老师 ×','4-6小时 ×']" :key="item"><text>{{ item }}</text></view><view><k-icon name="filter" :size="14" color="ink" /><text>筛选</text></view></view>
        <image class="empty-image" src="/static/media/jobs-empty.png" mode="aspectFit" />
        <text class="empty-title">没有符合条件的机会</text><text class="empty-desc">当前筛选条件过于严格，或时间与部分机会冲突</text>
        <view class="conflict"><text class="conflict__title">条件冲突</text><text>· 可到岗日期：2025-09-10 及以后</text><text>· 停留时长：1 个月以上</text></view>
        <view class="suggestions"><text class="conflict__title">放宽建议（共 3 条）</text><view v-for="item in ['放宽可到岗日期至 2025-09-01 及以后','放宽停留时长至 2 周以上','放宽每天工时至 4-8 小时']" :key="item" class="suggestion"><text>{{ item }}</text><k-button type="outline" size="xs">调整</k-button></view></view>
        <k-button block class="adjust" @click="s = 1">调整筛选</k-button><k-button type="outline" block icon="bell" class="subscribe-btn" @click="s = 2">订阅新机会</k-button><view class="service"><k-icon name="headphones" :size="18" color="ink" /><text>联系袋鼠小院（工作日 9:00-18:00）</text></view><view class="k-home-indicator" />
      </view>
    </template>
  </view>
</template>

<script setup>
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
const s = useScreen(4)
const cityOptions = ['大理','丽江','成都','杭州','厦门']
const filterGroups = [
  { icon: 'clock-3', title: '停留时长', options: ['不限','1周以上','2周以上','1个月以上','3个月以上'], selected: 3 },
  { icon: 'briefcase-business', title: '岗位类型', meta: '已选 3 个', options: ['手作老师','店员/助手','主理人助理','摄影师','其他'], selected: [0,1,2] },
  { icon: 'clock-3', title: '每天工时', options: ['不限','4小时以内','4-6小时','6-8小时','8小时以上'], selected: 2 },
  { icon: 'house', title: '食宿', options: ['不限','包食宿','包住宿','包三餐','包部分'], selected: 1 },
  { icon: 'badge-dollar-sign', title: '期望薪资（元/天）', arrow: true, options: ['不限','80以下','80-150','150-200','200以上'], selected: 2 }
]
const subscriptionGroups = [
  { icon: 'map-pin', title: '所在城市', items: ['大理','丽江'], add: '添加城市' },
  { icon: 'briefcase-business', title: '岗位类型', items: ['手作老师','店员/助手','主理人助理'], add: '添加类型' }
]
const jobs = [
  { title: '古城咖啡馆驻店伙伴', match: 96, tags: ['咖啡制作','社区交流','包吃包住'], place: '大理 · 大理古城', date: '9月5日 - 9月30日 | 共26天', price: 120, image: '/static/media/jobs-f-1.jpg' },
  { title: '洱海边咖啡师', match: 93, tags: ['咖啡制作','驻花','包吃包住'], place: '大理 · 才村码头', date: '每周 4-6 天 | 4-6小时/天', price: 100, image: '/static/media/jobs-f-2.jpg' },
  { title: '手工陶艺老师（兼职）', match: 92, tags: ['教学指导','体验课','工具提供'], place: '丽江 · 束河古镇', date: '9月8日 - 9月25日 | 共18天', price: 150, image: '/static/media/jobs-f-3.jpg' }
]
const reset = () => toast('已重置')
const isSelected = (selected, i) => Array.isArray(selected) ? selected.includes(i) : selected === i
</script>

<style scoped lang="scss">
.filter-page { font-family: var(--k-serif); }
.reset { padding: 10px 14px; font-size: 14px; }
.filter-body { padding: 8px 14px 110px; }
.filter-card { padding: 12px; margin-bottom: 10px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); }
.filter-head { min-height: 24px; display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; }
.filter-head__meta { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.option-row { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 8px; margin-top: 10px; }
.option { position: relative; height: 29px; border: 1px solid var(--k-line); border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 2px; font-size: 10px; white-space: nowrap; }
.option.on { border-color: var(--k-green); color: var(--k-green); box-shadow: inset 0 0 0 .5px var(--k-green); }
.option__check { width: 13px; height: 13px; border-radius: 50%; background: var(--k-green); display: flex; align-items: center; justify-content: center; }
.filter-line { padding: 14px 12px; }
.switch-row { height: 46px; margin-bottom: 8px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 700; }
.subscribe-body { position: relative; min-height: calc(100vh - 88px); padding: 8px 14px 34px; }
.subscribe-card, .subscribe-line, .match-slider, .message-switch, .frequency { padding: 14px; margin-bottom: 12px; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); }
.subscribe-card__hint { color: var(--k-muted); font-size: 12px; font-weight: 400; }
.selected-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.selected-chip { height: 31px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 8px; display: flex; align-items: center; gap: 8px; font-size: 12px; }
.subscribe-line { height: 55px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 700; }
.slider { position: relative; height: 58px; margin-top: 12px; }
.slider::before { content: ''; position: absolute; left: 0; right: 0; top: 16px; height: 4px; border-radius: 2px; background: var(--k-line); }
.slider__active { position: absolute; left: 0; width: 56%; top: 16px; height: 4px; background: var(--k-green); }
.slider__knob { position: absolute; left: 56%; top: 10px; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; border: 2px solid var(--k-green); background: var(--k-paper); }
.slider__knob text { position: absolute; left: 50%; bottom: 17px; transform: translateX(-50%); padding: 3px 6px; border-radius: 5px; color: #fff; background: var(--k-green); font-size: 11px; white-space: nowrap; }
.slider__mark { position: relative; z-index: 2; float: left; width: 20%; padding-top: 33px; color: var(--k-muted); font-size: 10px; }
.message-switch { display: flex; align-items: center; justify-content: space-between; }
.message-switch__title { display: block; font-size: 14px; font-weight: 700; }
.message-switch__sub { display: block; margin-top: 4px; color: var(--k-muted); font-size: 10px; }
.frequency__choices { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 20px; margin-top: 14px; }
.frequency__item { display: flex; align-items: flex-start; gap: 8px; }
.frequency__item text { display: block; font-size: 12px; }
.frequency__item text + text { margin-top: 5px; color: var(--k-muted); font-size: 10px; }
.save-button { margin-top: 18px; }
.manage-note { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--k-muted); font-size: 11px; }
.result-body { position: relative; min-height: calc(100vh - 88px); padding: 8px 14px 38px; }
.chosen { display: flex; gap: 6px; overflow: hidden; }
.chosen view { height: 31px; padding: 0 9px; border: 1px solid var(--k-line); border-radius: 7px; display: flex; align-items: center; gap: 3px; font-size: 10px; white-space: nowrap; flex: 0 0 auto; }
.result-count { display: block; margin: 16px 2px 10px; font-size: 13px; }
.job-card { position: relative; min-height: 132px; margin-bottom: 10px; display: flex; overflow: hidden; border: 1px solid var(--k-line); border-radius: 11px; background: var(--k-paper); }
.job-card__image { width: 92px; min-height: 132px; height: auto; flex: 0 0 auto; }
.job-card__copy { flex: 1; min-width: 0; padding: 11px 10px; }
.job-card__title { font-size: 14px; font-weight: 700; white-space: nowrap; }
.job-card__tags { display: flex; gap: 5px; margin-top: 7px; }
.job-card__meta { display: flex; align-items: center; gap: 5px; margin-top: 7px; color: var(--k-muted); font-size: 10px; }
.job-card__bottom { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 7px; color: var(--k-muted); font-size: 10px; }
.job-card__price { color: var(--k-red); }
.job-card__price .k-price { margin-right: 3px; }
.job-card__star { position: absolute; right: 10px; bottom: 10px; }
.skeleton { height: 120px; padding: 12px; display: flex; gap: 12px; border: 1px solid var(--k-line); border-radius: 11px; }
.skeleton__image { width: 84px; border-radius: 8px; background: var(--k-paper2); }
.skeleton__lines { flex: 1; padding-top: 4px; }
.skeleton__line { height: 12px; margin-bottom: 12px; border-radius: 6px; background: var(--k-paper2); width: 80%; }
.skeleton__line.is-long { width: 72%; } .skeleton__line.is-short { width: 36%; } .skeleton__line.is-mid { width: 60%; }
.loading { margin-top: 18px; display: flex; align-items: center; justify-content: center; gap: 10px; color: var(--k-muted); font-size: 12px; }
.loading__spinner { width: 20px; height: 20px; border: 3px dotted var(--k-red); border-radius: 50%; }
.empty-body { position: relative; min-height: calc(100vh - 88px); padding: 8px 14px 34px; }
.empty-image { width: 160px; height: 160px; margin: 48px auto 0; }
.empty-title { display: block; margin-top: 6px; text-align: center; font-size: 20px; font-weight: 700; }
.empty-desc { display: block; margin-top: 8px; text-align: center; color: var(--k-muted); font-size: 12px; }
.conflict, .suggestions { margin-top: 14px; padding: 14px; border: 1px solid var(--k-line); border-radius: 11px; display: flex; flex-direction: column; gap: 9px; font-size: 12px; }
.conflict__title { font-size: 15px; font-weight: 700; }
.suggestion { min-height: 32px; display: flex; align-items: center; justify-content: space-between; color: var(--k-muted); }
.adjust { margin-top: 14px; }
.subscribe-btn { margin-top: 10px; }
.service { height: 48px; margin-top: 10px; border: 1px solid var(--k-line); border-radius: 9px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; }
</style>
