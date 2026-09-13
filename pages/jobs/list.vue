<template>
  <view class="k-page jobs">
    <k-topbar :title="cur.title" back />

    <view class="k-body k-pad-tab">
      <!-- 搜索 -->
      <view class="search">
        <k-icon name="search" :size="18" color="muted" :stroke="1.7" />
        <input v-model="keyword" class="search__input" :placeholder="cur.placeholder" placeholder-class="k-placeholder" />
        <view class="search__btn" @click="toast('搜索：' + (keyword || cur.placeholder))"><text>搜索</text></view>
      </view>

      <!-- 筛选胶囊 -->
      <view class="chips">
        <view v-for="c in cur.chips" :key="c.label" class="chip" @click="openFilter(c)">
          <k-icon v-if="c.icon" :name="c.icon" :size="15" color="ink" :stroke="1.7" />
          <text>{{ c.label }}</text>
          <k-icon name="chevron-down" :size="14" color="ink" :stroke="1.8" />
        </view>
      </view>

      <!-- 订阅提醒 -->
      <view class="sub">
        <k-icon name="bell" :size="20" color="ink" :stroke="1.6" />
        <text class="sub__text" @click="go(R.jobsFilter + '?s=2')">有新机会提醒我</text>
        <view class="sw" :class="{ on: notify }" @click="notify = !notify" />
      </view>

      <text class="count">{{ cur.count }}</text>

      <!-- 岗位卡片 -->
      <view v-for="job in cur.jobs" :key="job.title" class="card" @click="go(R.jobDetail)">
        <view class="card__left">
          <image class="card__img" :src="job.img" mode="aspectFill" :style="{ width: cur.img[0] + 'px', height: cur.img[1] + 'px' }" />
          <view v-if="s === 4" class="remote"><k-icon name="shield-check" :size="13" color="green" :stroke="2" /><text>远程</text></view>
        </view>
        <view class="k-flex1">
          <view class="k-between k-gap8">
            <text class="title k-ellipsis" :class="{ 'title--sm': s === 4 }">{{ job.title }}</text>
            <view v-if="job.match" class="match"><text>{{ job.match }}</text></view>
            <view v-else class="price"><text class="price__num">{{ job.price }}</text><text class="price__unit">{{ job.unit }}</text></view>
          </view>
          <view class="loc" :class="{ 'loc--tiny': s === 4 }">
            <k-icon :name="s === 4 ? 'store' : 'map-pin'" :size="s === 4 ? 12 : 13" color="muted" :stroke="1.7" />
            <text>{{ job.loc }}</text>
          </view>
          <view class="tags"><view v-for="t in job.tags" :key="t" class="tag"><text>{{ t }}</text></view></view>

          <!-- 义工换宿：时长/最短/食宿 -->
          <view v-if="s === 1" class="meta">
            <view class="meta__item"><k-icon name="history" :size="13" color="muted" :stroke="1.7" /><text>{{ job.hours }}</text></view>
            <view class="meta__item"><k-icon name="clock" :size="13" color="muted" :stroke="1.7" /><text>{{ job.min }}</text></view>
            <view class="meta__item"><k-icon name="circle-dot" :size="13" color="muted" :stroke="1.7" /><text>{{ job.board }}</text></view>
          </view>
          <!-- 兼职旅行：排班/包住 -->
          <template v-else-if="s === 2">
            <view class="meta"><view class="meta__item meta__item--lg"><k-icon name="clock" :size="14" color="muted" :stroke="1.7" /><text>{{ job.days }}</text><text class="meta__time">{{ job.time }}</text></view></view>
            <view class="meta k-mt4"><view class="meta__item meta__item--lg"><k-icon name="bed-single" :size="14" color="muted" :stroke="1.7" /><text>{{ job.stay }}</text></view></view>
          </template>
          <!-- 全职旅行：培训/试用期 -->
          <view v-else-if="s === 3" class="meta meta--text">
            <text>培训：{{ job.train }}</text><text>试用期：{{ job.probation }}</text>
          </view>
          <!-- 在线兼职：交付/工时 -->
          <view v-else class="meta meta--text">
            <view class="meta__item"><k-icon name="calendar-days" :size="13" color="muted" :stroke="1.7" /><text>交付日期：{{ job.deliver }}</text></view>
            <text>预计工时：{{ job.est }}</text>
          </view>

          <!-- 安心与权益 -->
          <view v-if="s === 1" class="safe">
            <view class="safe__chip"><k-icon name="shield-check" :size="13" color="green" :stroke="2" fill /><text>安心商家</text></view>
            <view class="safe__chip"><k-icon name="shield-check" :size="13" color="green" :stroke="2" /><text>含保险</text></view>
          </view>
          <view v-else-if="s === 3" class="tags k-mt8"><view v-for="b in job.benefits" :key="b" class="tag"><text>{{ b }}</text></view></view>
        </view>
      </view>
    </view>

    <k-tabbar active="home" />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const TYPES = ['volunteer', 'parttime', 'fulltime', 'online']
const s = useScreen(4, { onLoad: (q) => { const i = TYPES.indexOf(q?.type); if (i >= 0) s.value = i + 1 } })
const keyword = ref('')
const notify = ref(true)

const screens = [
  {
    title: '义工换宿', placeholder: '想去哪里，做什么？', count: '为你找到 38 个义工换宿岗位（AI 智能匹配）', img: [104, 136],
    chips: [{ icon: 'house', label: '大理' }, { icon: 'circle-check', label: '时间' }, { label: '类型' }, { label: '筛选', filter: true }],
    jobs: [
      { img: '/static/media/jobs-vol-1.jpg', title: '古城咖啡馆驻店伙伴', match: '96%匹配', loc: '大理古城 · 云南大理', tags: ['咖啡制作', '店铺运营', '接待顾客'], hours: '每日4-6小时', min: '最短2周', board: '包吃包住' },
      { img: '/static/media/jobs-vol-2.jpg', title: '双廊民宿前台助手', match: '95%匹配', loc: '双廊古镇 · 云南大理', tags: ['前台接待', '客房协助', '活动协助'], hours: '每日4-6小时', min: '最短2周', board: '包吃包住' },
      { img: '/static/media/jobs-vol-3.jpg', title: '洱海边花艺帮手', match: '93%匹配', loc: '喜洲古镇 · 云南大理', tags: ['花艺协助', '活动布置', '拍照记录'], hours: '每日4-6小时', min: '最短1周', board: '包吃包住' }
    ]
  },
  {
    title: '兼职旅行', placeholder: '想去哪儿兼职?', count: '为你找到 26 个兼职旅行岗位', img: [84, 110],
    chips: [{ icon: 'house', label: '大理' }, { icon: 'calendar-check', label: '日薪' }, { icon: 'id-card', label: '技能' }, { label: '包住' }],
    jobs: [
      { img: '/static/media/jobs-pt-1.jpg', title: '咖啡店周末兼职店员', price: '180', unit: '元/天', loc: '大理古城', tags: ['咖啡制作', '收银接待', '清洁整理'], days: '周六-周日', time: '10:00-18:00', stay: '可包住' },
      { img: '/static/media/jobs-pt-2.jpg', title: '旅拍摄影助理', price: '220', unit: '元/天', loc: '洱海生态廊道', tags: ['摄影助理', '道具整理', '客户引导'], days: '周五-周日', time: '08:00-17:00', stay: '可包住' },
      { img: '/static/media/jobs-pt-3.jpg', title: '手作体验店店员', price: '160', unit: '元/天', loc: '喜洲古镇', tags: ['手作教学', '客户接待', '材料整理'], days: '周末排班', time: '10:00-18:00', stay: '可包住' }
    ]
  },
  {
    title: '全职旅行', placeholder: '搜索全职岗位或地点', count: '为你找到 18 个全职旅行岗位', img: [70, 116],
    chips: [{ icon: 'house', label: '大理' }, { icon: 'calendar', label: '月薪' }, { icon: 'panels-top-left', label: '培训' }, { label: '更多' }],
    jobs: [
      { img: '/static/media/jobs-ft-1.jpg', title: '民宿运营店长', price: '6K-8K', unit: '/月', loc: '双廊古镇', tags: ['店铺运营', '团队管理', '客诉处理'], train: '运营管理培训', probation: '1-2个月', benefits: ['包住（单间）', '五险一金', '带薪年假'] },
      { img: '/static/media/jobs-ft-2.jpg', title: '咖啡品牌主理人', price: '7K-12K', unit: '/月', loc: '大理古城', tags: ['咖啡研发', '团队管理', '品牌策划'], train: '咖啡师认证培训', probation: '1-3个月', benefits: ['包住（单间）', '五险一金', '带薪年假'] },
      { img: '/static/media/jobs-ft-3.jpg', title: '内容策划专员', price: '5K-7K', unit: '/月', loc: '大理市区', tags: ['内容策划', '活动执行', '数据分析'], train: '内容策划培训', probation: '1个月', benefits: ['包住（可选）', '五险一金', '带薪年假'] }
    ]
  },
  {
    title: '在线兼职', placeholder: '搜索在线兼职岗位', count: '为你找到 32 个在线兼职岗位', img: [58, 106],
    chips: [{ icon: 'circle-check', label: '类型' }, { icon: 'hourglass', label: '佣金' }, { icon: 'circle-check', label: '交付日期' }, { label: '更多' }],
    jobs: [
      { img: '/static/media/jobs-ol-1.jpg', title: '小红书图文笔记撰写', price: '80-150', unit: '元/篇', loc: '兴乐媛', tags: ['文案撰写', '小红书', '生活方式'], deliver: '2天内', est: '2-3小时' },
      { img: '/static/media/jobs-ol-2.jpg', title: '短视频剪辑（旅行类）', price: '150-300', unit: '元/条', loc: '兴乐媛', tags: ['视频剪辑', '剪映', '旅行'], deliver: '3天内', est: '3-5小时' },
      { img: '/static/media/jobs-ol-3.jpg', title: '公众号文章排版', price: '60-100', unit: '元/篇', loc: '润美媛', tags: ['排版设计', '公众号', '图文编辑'], deliver: '1天内', est: '1-2小时' }
    ]
  }
]
const cur = computed(() => screens[s.value - 1])
const openFilter = (c) => { if (c.filter || c.label === '更多') go(R.jobsFilter + '?s=1'); else toast(c.label) }
</script>

<style scoped lang="scss">
.search { height: 36px; border-radius: 999px; background: var(--k-paper); border: 1px solid var(--k-line2); display: flex; align-items: center; gap: 10px; padding: 0 5px 0 14px; }
.search__input { flex: 1; min-width: 0; height: 34px; font-size: 13px; }
.search__btn { height: 28px; padding: 0 12px; border-radius: 999px; background: var(--k-paper2); display: flex; align-items: center; font-size: 13px; color: var(--k-ink); flex: 0 0 auto; }
.chips { display: flex; justify-content: space-between; margin-top: 10px; }
.chip { flex: 0 0 auto; height: 29px; padding: 0 10px 0 11px; border-radius: 999px; border: 1px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--k-ink); white-space: nowrap; }
.sub { margin-top: 10px; height: 40px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); display: flex; align-items: center; gap: 12px; padding: 0 14px 0 14px; }
.sub__text { flex: 1; font-size: 15px; color: var(--k-ink); }
.sw { width: 42px; height: 24px; border-radius: 12px; background: var(--k-line2); position: relative; flex: 0 0 auto; }
.sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: left .18s; }
.sw.on { background: var(--k-red); }
.sw.on::after { left: 20px; }
.count { display: block; margin-top: 12px; font-size: 12px; color: var(--k-muted); }
.card { margin-top: 10px; display: flex; align-items: flex-start; gap: 12px; padding: 11px; border: 1px solid var(--k-line); border-radius: 14px; background: var(--k-paper); }
.card__left { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.card__img { border-radius: 8px; display: block; }
.remote { display: flex; align-items: center; gap: 3px; height: 22px; padding: 0 7px; border-radius: 5px; background: var(--k-green-soft); color: var(--k-green); font-size: 12px; }
.title { flex: 1; min-width: 0; font-family: var(--k-serif); font-weight: 700; font-size: 16px; line-height: 1.35; color: var(--k-ink); }
.title--sm { font-size: 15px; }
.match { height: 22px; padding: 0 7px; border-radius: 6px; background: var(--k-green-soft); color: var(--k-green); font-size: 12px; display: flex; align-items: center; flex: 0 0 auto; }
.price { display: flex; align-items: baseline; gap: 1px; flex: 0 0 auto; color: var(--k-red); }
.price__num { font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 18px; line-height: 1; }
.price__unit { font-size: 11px; font-weight: 500; }
.loc { display: flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 12px; color: var(--k-muted); }
.loc--tiny { font-size: 11px; color: var(--k-light); }
.tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
.tag { height: 22px; padding: 0 8px; border-radius: 6px; background: var(--k-paper2); border: 1px solid var(--k-line); color: #7A5A34; font-size: 11px; display: flex; align-items: center; white-space: nowrap; }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 8px; font-size: 11px; color: var(--k-muted); }
.meta--text { color: var(--k-muted); font-size: 12px; }
.meta__item { display: flex; align-items: center; gap: 4px; }
.meta__item--lg { font-size: 12px; }
.meta__time { margin-left: 8px; }
.safe { display: flex; gap: 8px; margin-top: 8px; }
.safe__chip { height: 22px; padding: 0 7px; border-radius: 6px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; display: flex; align-items: center; gap: 3px; }
</style>
