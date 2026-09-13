<template>
  <view class="k-page staff">
    <!-- 1 门店工作台 -->
    <view v-if="s === 1">
      <k-topbar :nav-height="92">
        <template #left>
          <view class="hello">
            <image class="hello__avatar" src="/static/media/staff-avatar-abu.jpg" mode="aspectFill" />
            <view class="k-col k-gap6">
              <text class="hello__name">你好，阿布</text>
              <text class="hello__role">角色：门店管家</text>
            </view>
          </view>
        </template>
        <template #right>
          <view class="switch-btn" @click="go(R.staffBusiness + '?s=2')"><text>切换门店</text></view>
        </template>
      </k-topbar>
      <view class="k-body k-pad-tab">
        <view class="store" @click="go(R.staffBusiness + '?s=2')">
          <k-icon name="house" :size="20" color="ink" :stroke="1.6" />
          <text class="store__name k-flex1">西湖边 · 温馨一居室</text>
          <k-icon name="chevron-down" :size="18" color="ink" :stroke="1.8" />
        </view>

        <view class="k-between sec">
          <text class="sec__title">今日概览</text>
          <text class="k-small k-muted">09/05 周四</text>
        </view>
        <view class="k-grid-3 stats">
          <view v-for="it in overview" :key="it.label" class="stat" @click="s = 3">
            <text class="stat__label">{{ it.label }}</text>
            <text class="stat__value">{{ it.value }}</text>
            <view class="k-row k-gap4"><text class="k-meta">较昨日</text><text class="stat__delta">↑{{ it.delta }}</text></view>
          </view>
        </view>

        <view class="k-between sec"><text class="sec__title">优先处理</text></view>
        <k-card :pad="0">
          <view v-for="(it, i) in priority" :key="it.title" class="prio" :class="{ line: i < priority.length - 1 }" @click="s = 4">
            <view class="k-circle prio__icon" :class="it.cls"><k-icon :name="it.icon" :size="22" :color="it.iconColor" :stroke="it.stroke || 2" :fill="it.fill" /></view>
            <view class="k-flex1 k-col k-gap4">
              <view class="k-row k-gap4"><text class="prio__num">{{ it.num }}</text><text class="prio__title">{{ it.title }}</text></view>
              <text class="k-meta">{{ it.sub }}</text>
            </view>
            <view class="go-btn"><text>去处理</text></view>
          </view>
        </k-card>

        <view class="k-between sec"><text class="sec__title">快捷入口</text></view>
        <view class="k-grid-4 quick">
          <view v-for="q in quick" :key="q.label" class="quick__item" @click="q.to()">
            <view class="quick__icon">
              <k-icon :name="q.icon" :size="30" :color="q.color" :stroke="1.5" />
              <text v-if="q.badge" class="quick__badge">{{ q.badge }}</text>
            </view>
            <text class="quick__label">{{ q.label }}</text>
          </view>
        </view>
      </view>
      <view class="tab-dot" />
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 2 全部待办 -->
    <view v-else-if="s === 2">
      <k-topbar title="全部待办" back @back="s = 1" />
      <view class="k-body k-pad-tab">
        <view class="k-row k-gap10">
          <view class="search k-flex1">
            <k-icon name="search" :size="18" color="muted" :stroke="1.8" />
            <input v-model="keyword" placeholder="搜索任务、报名编号、订单号" placeholder-class="k-placeholder" />
          </view>
          <view class="filter-btn" @click="toast('筛选')"><k-icon name="filter" :size="16" color="ink" :stroke="1.8" /><text>筛选</text></view>
        </view>
        <scroll-view scroll-x class="tabs-scroll" :show-scrollbar="false">
          <view class="tabs">
            <view v-for="t in todoTabs" :key="t" class="tabs__item" :class="{ active: todoTab === t }" @click="todoTab = t"><text>{{ t }}</text></view>
          </view>
        </scroll-view>

        <view v-for="g in todoGroups" :key="g.title" class="group">
          <text class="group__title" :class="{ 'k-red': g.overdue }">{{ g.title }}</text>
          <k-card :pad="0">
            <view v-for="(t, i) in g.items" :key="t.title + i" class="todo" :class="{ line: i < g.items.length - 1 }" @click="s = 4">
              <view class="k-circle todo__icon" :class="t.cls"><k-icon :name="t.icon" :size="22" :color="t.iconColor" :stroke="t.stroke || 2" :fill="t.fill" /></view>
              <view class="k-flex1 k-col k-gap3">
                <text class="todo__title">{{ t.title }}</text>
                <text class="k-meta">{{ t.sub }}</text>
                <view class="todo__row"><text class="k-meta">截止</text><text class="todo__due">{{ t.due }}</text><text v-if="t.over" class="todo__due">{{ t.over }}</text></view>
              </view>
              <k-chip :tone="t.chipTone">{{ t.chip }}</k-chip>
              <k-icon name="chevron-right" :size="18" color="light" :stroke="1.8" />
            </view>
          </k-card>
        </view>
      </view>
      <view class="tab-dot" />
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 3 今日经营数据 -->
    <view v-else-if="s === 3">
      <k-topbar title="今日经营数据" back @back="s = 1" />
      <view class="k-body k-pad-tab">
        <view class="k-between">
          <view class="date-box"><text>09/05 周四</text><k-icon name="calendar" :size="18" color="ink" :stroke="1.6" /></view>
          <view class="source"><text>数据来源：PMS+小程序+收银</text></view>
        </view>
        <view v-for="m in metrics" :key="m.label" class="metric" @click="go(R.dashboard)">
          <view class="metric__icon" :style="{ background: m.color }"><k-icon :name="m.icon" :size="26" color="white" :stroke="m.fill ? 0.8 : 2.2" :fill="m.fill" /></view>
          <view class="metric__body">
            <text class="metric__label">{{ m.label }}</text>
            <view class="k-row k-gap12">
              <text class="metric__value">{{ m.value }}</text>
              <view class="k-row k-gap4"><text class="k-meta">较昨日</text><text class="stat__delta">↑{{ m.delta }}</text></view>
            </view>
          </view>
          <view class="spark">
            <view v-for="(seg, i) in sparkSegs(m.points)" :key="'l' + i" class="spark__seg" :style="{ left: seg.x + 'px', top: seg.y + 'px', width: seg.len + 'px', transform: 'rotate(' + seg.deg + 'deg)', background: m.color }" />
            <view v-for="(p, i) in sparkPts(m.points)" :key="'p' + i" class="spark__dot" :style="{ left: (p.x - 3.5) + 'px', top: (p.y - 3.5) + 'px', borderColor: m.color, background: i === 0 ? m.color : 'var(--k-paper)' }" />
          </view>
        </view>
        <text class="k-meta foot">数据统计截止今日 23:59，次日 08:00 后更新昨日数据</text>
      </view>
      <view class="tab-dot" />
      <k-tabbar mode="staff" active="work" />
    </view>

    <!-- 4 任务详情 -->
    <view v-else>
      <k-topbar title="任务详情" back @back="s = 2" />
      <view class="k-body k-pad-tab">
        <view class="task-head">
          <view class="k-row-start k-gap12">
            <view class="k-circle k-circle--red task-head__icon"><k-icon name="clock" :size="26" color="white" :stroke="2.2" /></view>
            <view class="k-flex1 k-col k-gap6">
              <view class="k-between">
                <text class="task-head__title">报名超时处理</text>
                <view class="overdue-chip"><text>逾期</text></view>
              </view>
              <text class="k-small k-muted">报名编号 K0826 · 小宇</text>
              <view class="k-row k-gap8"><text class="k-small k-muted">截止时间</text><text class="k-small k-red">09-05 08:30（超时 2.5 小时）</text></view>
            </view>
          </view>
        </view>

        <k-card :pad="0" class="k-mt12">
          <view class="blk k-between">
            <text class="blk__title">责任人</text>
            <view class="k-row k-gap8">
              <image class="owner__avatar" src="/static/media/staff-avatar-abu-m.jpg" mode="aspectFill" />
              <text class="k-text">阿布（门店管家）</text>
              <view class="go-btn go-btn--sm" @click="toast('转派')"><text>转派</text></view>
            </view>
          </view>
          <view class="blk">
            <text class="blk__title">关联信息</text>
            <view v-for="r in related" :key="r.label" class="rel" @click="r.to()">
              <text class="rel__label">{{ r.label }}</text>
              <text class="rel__value k-flex1">{{ r.value }}</text>
              <k-icon name="chevron-right" :size="18" color="ink" :stroke="1.6" />
            </view>
          </view>
          <view class="blk">
            <text class="blk__title">任务描述</text>
            <text class="k-text desc">报名已超时，请尽快联系小宇确认面试安排。</text>
          </view>
          <view class="blk">
            <view class="rel"><text class="rel__label">截止时间</text><text class="rel__value">2024-09-05 08:30</text></view>
            <view class="rel"><text class="rel__label">创建时间</text><text class="rel__value">2024-09-05 06:00</text></view>
          </view>
          <view class="blk">
            <text class="blk__title">操作日志</text>
            <view class="logs">
              <view v-for="(l, i) in logs" :key="l.time" class="log">
                <view class="log__rail"><view class="log__dot" /><view v-if="i < logs.length - 1" class="log__line" /></view>
                <text class="log__time" :class="{ 'k-red': l.red }">{{ l.time }}</text>
                <text class="log__text" :class="{ 'k-red': l.red }">{{ l.text }}</text>
              </view>
            </view>
          </view>
          <view class="blk blk--last k-between">
            <view class="k-col k-gap6"><text class="blk__title">备注</text><text class="k-small k-muted">暂无备注</text></view>
            <text class="k-link add-note" @click="toast('添加备注')">添加备注</text>
          </view>
        </k-card>
        <k-button block class="k-mt12" @click="go(R.staffApplications + '?s=2')">开始处理</k-button>
      </view>
      <view class="tab-dot" />
      <k-tabbar mode="staff" active="work" />
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const keyword = ref('')
const todoTab = ref('全部(8)')
const todoTabs = ['全部(8)', '报名(4)', '订单(2)', '保险(1)', '活动(1)', '调度(0)']

const overview = [
  { label: '入住率', value: '78%', delta: '6%' },
  { label: '营收(元)', value: '4,860', delta: '12%' },
  { label: '新增报名', value: '12', delta: '2' }
]
const priority = [
  { icon: 'clock', cls: 'k-circle--red', iconColor: 'white', fill: false, stroke: 2.2, num: '2', title: '份报名已超时 4 小时', sub: '报名编号 K0826、K0918' },
  { icon: 'video', cls: 'k-circle--ochre', iconColor: 'white', fill: true, stroke: 0.8, num: '3', title: '场面试即将开始', sub: '最早 10:30 开始' },
  { icon: 'shield-check', cls: 'k-circle--soft-ochre', iconColor: 'ochre', fill: false, stroke: 1.8, num: '1', title: '份保险待购买', sub: '报名编号 K0830' }
]
const quick = [
  { icon: 'file-text', color: 'ink', label: '全部待办', badge: '8', to: () => { s.value = 2 } },
  { icon: 'file-pen', color: 'ochre', label: '报名管理', to: () => go(R.staffApplications) },
  { icon: 'clipboard-list', color: 'ink', label: '订单管理', to: () => go(R.staffInsurance) },
  { icon: 'shield-check', color: 'ochre', label: '保险管理', to: () => go(R.staffInterviews + '?s=4') }
]
const todoGroups = computed(() => [
  { title: '逾期（2）', overdue: true, items: [
    { icon: 'clock', cls: 'k-circle--red', iconColor: 'white', fill: false, stroke: 2.2, title: '报名超时处理', sub: '报名编号 K0826 · 小宇', due: '09-05 08:30', over: '超时 2.5 小时', chip: '报名', chipTone: 'ochre' },
    { icon: 'shield-check', cls: 'k-circle--soft-ochre', iconColor: 'ochre', fill: false, stroke: 1.8, title: '保险待购买', sub: '报名编号 K0830 · 阿宁', due: '09-04 18:00', over: '超时 20 小时', chip: '保险', chipTone: 'blue' }
  ] },
  { title: '今天到期（3）', items: [
    { icon: 'video', cls: 'k-circle--ochre', iconColor: 'white', fill: true, stroke: 0.8, title: '面试即将开始', sub: '小宇 · 15:00 视频面试', due: '09-05 15:00', chip: '报名', chipTone: 'ochre' },
    { icon: 'video', cls: 'k-circle--ochre', iconColor: 'white', fill: true, stroke: 0.8, title: '面试即将开始', sub: '阿宇 · 16:30 到店面试', due: '09-05 16:30', chip: '报名', chipTone: 'ochre' },
    { icon: 'clipboard-list', cls: 'k-circle--indigo', iconColor: 'white', fill: false, stroke: 2, title: '保险待购买', sub: '报名编号 K0832 · 花花', due: '09-05 18:00', chip: '保险', chipTone: 'blue' }
  ] },
  { title: '明天到期（2）', items: [
    { icon: 'calendar-check', cls: 'k-circle--green', iconColor: 'white', fill: false, stroke: 2, title: '活动报名确认', sub: '陶艺体验课 · 09-06 14:00', due: '09-05 12:00', chip: '活动', chipTone: 'green' },
    { icon: 'shopping-bag', cls: 'k-circle--ochre', iconColor: 'white', fill: false, stroke: 2, title: '订单确认', sub: '订单号 OR20240905 · 西湖边一居室', due: '09-05 10:00', chip: '订单', chipTone: 'ochre' }
  ] }
])
const metrics = [
  { icon: 'house', color: '#4F7A66', label: '入住率', value: '78%', delta: '6%', points: [0.35, 0.55, 0.45, 0.6, 0.4, 0.8, 0.95] },
  { icon: 'circle-dollar-sign', color: '#C99043', label: '营收(元)', value: '4,860', delta: '12%', points: [0.2, 0.6, 0.45, 0.65, 0.8, 0.95, 0.75] },
  { icon: 'file-text', color: '#40576B', label: '订单量', value: '28', delta: '8%', points: [0.25, 0.65, 0.4, 0.7, 0.55, 0.75, 0.95] },
  { icon: 'shopping-bag', color: '#8B7BB5', label: '二消收入(元)', value: '1,280', delta: '15%', points: [0.3, 0.6, 0.4, 0.65, 0.55, 0.8, 0.95] },
  { icon: 'star', fill: true, color: '#4F7A66', label: '好评率', value: '98%', delta: '2%', points: [0.25, 0.7, 0.45, 0.75, 0.6, 0.85, 0.95] },
  { icon: 'users-round', color: '#D2692E', label: '活动报名(人)', value: '32', delta: '14%', points: [0.2, 0.65, 0.45, 0.7, 0.5, 0.9, 0.7] }
]
const SW = 82, SH = 36
const sparkPts = (pts) => pts.map((v, i) => ({ x: 4 + (i * (SW - 8)) / (pts.length - 1), y: 4 + (1 - v) * (SH - 8) }))
const sparkSegs = (pts) => {
  const p = sparkPts(pts)
  return p.slice(0, -1).map((a, i) => {
    const b = p[i + 1]
    const dx = b.x - a.x, dy = b.y - a.y
    return { x: a.x, y: a.y, len: Math.sqrt(dx * dx + dy * dy), deg: (Math.atan2(dy, dx) * 180) / Math.PI }
  })
}
const related = [
  { label: '门店', value: '西湖边 · 温馨一居室', to: () => go(R.staffRooms) },
  { label: '岗位', value: '咖啡师兼职', to: () => go(R.staffJobs) },
  { label: '报名人', value: '小宇 · 25岁 · 昆明', to: () => go(R.staffApplications + '?s=2') }
]
const logs = [
  { time: '09-05 06:00', text: '系统创建任务' },
  { time: '09-05 06:01', text: '阿布 认领任务' },
  { time: '09-05 08:30', text: '任务逾期提醒（超时 2.5 小时）', red: true }
]
</script>

<style scoped lang="scss">
.tab-dot { position: fixed; left: 252px; bottom: calc(var(--k-safe-bottom) + 43px); width: 7px; height: 7px; border-radius: 50%; background: var(--k-red); z-index: 51; }
.hello { display: flex; align-items: center; gap: 14px; padding-left: 8px; }
.hello__avatar { width: 52px; height: 52px; border-radius: 50%; flex: 0 0 auto; }
.hello__name { font-family: var(--k-serif); font-weight: 700; font-size: 20px; line-height: 1.2; }
.hello__role { font-size: 13px; color: var(--k-muted); }
.switch-btn { height: 30px; padding: 0 12px; border: 1px solid var(--k-ochre); border-radius: 999px; display: flex; align-items: center; color: var(--k-ochre); font-size: 13px; margin-right: 8px; }
.store { margin-top: 2px; height: 42px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; gap: 10px; }
.store__name { font-size: 15px; }
.sec { margin: 18px 0 10px; }
.sec__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.stat { height: 100px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
.stat__label { font-size: 13px; color: var(--k-muted); }
.stat__value { font-size: 26px; font-weight: 700; line-height: 1.1; }
.stat__delta { font-size: 12px; color: var(--k-green); font-weight: 600; }
.prio { display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
.prio.line { border-bottom: 1px solid var(--k-line); }
.prio__icon { width: 40px; height: 40px; }
.prio__num { font-size: 15px; font-weight: 700; color: var(--k-red); }
.prio__title { font-size: 15px; font-weight: 600; }
.go-btn { height: 30px; padding: 0 12px; border: 1px solid var(--k-ochre); border-radius: 6px; display: flex; align-items: center; color: #9A6A22; font-size: 13px; background: var(--k-paper); flex: 0 0 auto; }
.go-btn--sm { height: 28px; }
.quick { gap: 12px; }
.quick__item { height: 86px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.quick__icon { position: relative; width: 30px; height: 30px; }
.quick__badge { position: absolute; top: -8px; right: -10px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--k-red); color: #fff; font-size: 11px; line-height: 18px; text-align: center; font-weight: 600; }
.quick__label { font-size: 13px; }

.search { height: 38px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; }
.search input { flex: 1; min-width: 0; height: 38px; font-size: 14px; }
.filter-btn { height: 38px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; gap: 6px; font-size: 14px; flex: 0 0 auto; }
.tabs-scroll { margin: 10px -16px 0; width: 390px; white-space: nowrap; }
.tabs { display: flex; justify-content: space-between; padding: 0 14px; border-bottom: 1px solid var(--k-line); width: 390px; }
.tabs__item { position: relative; padding: 9px 2px 10px; font-size: 13.5px; color: var(--k-ink); flex: 0 0 auto; }
.tabs__item.active { color: var(--k-red); font-weight: 600; }
.tabs__item.active::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--k-red); border-radius: 2px; }
.group { margin-top: 10px; }
.group__title { display: block; font-size: 14px; color: var(--k-ink); margin-bottom: 6px; }
.todo { display: flex; align-items: center; gap: 12px; padding: 7px 10px 7px 12px; }
.todo.line { border-bottom: 1px solid var(--k-line); }
.todo__icon { width: 40px; height: 40px; }
.todo__row { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.todo__title { font-family: var(--k-serif); font-weight: 700; font-size: 15px; line-height: 1.3; }
.todo__due { font-size: 12px; color: var(--k-red); font-weight: 600; }
.k-gap3 { gap: 3px; }

.date-box { height: 40px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; gap: 22px; font-size: 15px; font-weight: 600; }
.source { height: 30px; padding: 0 10px; border-radius: 6px; background: var(--k-paper2); display: flex; align-items: center; font-size: 11px; color: var(--k-muted); }
.metric { margin-top: 12px; height: 84px; padding: 0 14px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; align-items: center; gap: 12px; }
.metric__icon { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.metric__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.metric__label { font-size: 14px; }
.metric__value { font-size: 28px; font-weight: 700; line-height: 1.1; }
.spark { position: relative; width: 82px; height: 36px; flex: 0 0 auto; }
.spark__seg { position: absolute; height: 1.5px; transform-origin: 0 50%; }
.spark__dot { position: absolute; width: 7px; height: 7px; border-radius: 50%; border: 1.5px solid; }
.foot { display: block; text-align: center; margin-top: 14px; }

.task-head { padding: 12px 14px; border: 1px solid #E3CFA6; border-radius: 12px; background: var(--k-paper); }
.task-head__icon { width: 46px; height: 46px; }
.task-head__title { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.overdue-chip { height: 24px; padding: 0 8px; border: 1px solid var(--k-red); border-radius: 5px; display: flex; align-items: center; color: var(--k-red); font-size: 12px; }
.blk { padding: 10px 14px; border-bottom: 1px solid var(--k-line); }
.blk--last { border-bottom: 0; }
.blk__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.owner__avatar { width: 30px; height: 30px; border-radius: 50%; }
.rel { display: flex; align-items: center; height: 27px; font-size: 14px; }
.rel__label { width: 100px; color: var(--k-muted); flex: 0 0 auto; }
.rel__value { color: var(--k-ink); }
.desc { display: block; margin-top: 2px; }
.logs { margin-top: 8px; }
.log { display: flex; align-items: flex-start; min-height: 23px; font-size: 13px; }
.log__rail { width: 8px; margin-right: 14px; display: flex; flex-direction: column; align-items: center; flex: 0 0 auto; align-self: stretch; }
.log__dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; border: 1px solid #D5B98F; background: var(--k-paper); flex: 0 0 auto; }
.log__line { width: 1px; flex: 1; background: #D5B98F; }
.log__time { width: 96px; flex: 0 0 auto; color: var(--k-muted); }
.log__text { color: var(--k-muted); }
.add-note { color: var(--k-indigo); font-size: 14px; }
</style>
