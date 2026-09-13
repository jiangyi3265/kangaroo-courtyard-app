<template>
  <view class="k-page act">
    <k-topbar :title="titles[s - 1]" back @back="onBack" />

    <!-- 1 活动列表 -->
    <view v-if="s === 1" class="pad-both">
      <view class="k-body search-row">
        <view class="search"><k-icon name="search" :size="16" color="light" :stroke="1.8" /><input v-model="kw" placeholder="搜索活动名称、地点、发起人" placeholder-class="k-placeholder" /></view>
        <view class="filter-btn" @click="toast('筛选')"><k-icon name="filter" :size="15" color="ink" :stroke="1.7" /><text>筛选</text></view>
      </view>
      <view class="tabs">
        <view v-for="t in listTabs" :key="t" class="tabs__item" :class="{ active: tab === t }" @click="tab = t"><text>{{ t }}</text></view>
      </view>
      <view class="pills">
        <view v-for="p in ['全部来源', '全部状态', '时间排序']" :key="p" class="pill" @click="toast(p)"><text>{{ p }}</text><k-icon name="chevron-down" :size="13" color="ink" :stroke="1.8" /></view>
      </view>
      <view class="list">
        <view v-for="(a, i) in activities" :key="i" class="item" @click="s = 4">
          <image class="item__img" :src="a.img" mode="aspectFill" />
          <view class="k-flex1">
            <view class="k-row k-gap8"><view class="tag" :class="`tag--${a.tone}`"><text>{{ a.status }}</text></view><text class="item__title k-ellipsis">{{ a.title }}</text></view>
            <view class="item__meta"><text>来 源：{{ a.source }}</text><view class="vline" /><text>发起人：{{ a.owner }}</text></view>
            <view class="item__line"><k-icon name="user-round" :size="14" color="muted" :stroke="1.6" /><text>报名 {{ a.count }}</text><text class="item__price">¥{{ a.price }}/人</text></view>
            <view class="item__line"><k-icon name="calendar" :size="14" color="muted" :stroke="1.6" /><text>{{ a.time }}</text></view>
            <view class="item__line k-between"><view class="k-row k-gap6"><k-icon name="map-pin" :size="14" color="muted" :stroke="1.6" /><text>{{ a.place }}</text></view><view class="audit" :class="`audit--${a.auditTone}`"><text>{{ a.audit }}</text></view></view>
          </view>
        </view>
      </view>
      <view class="act-bar"><k-button block icon="plus" @click="s = 2">创建活动</k-button></view>
      <k-tabbar mode="staff" active="work" /><view class="tab-dot" />
    </view>

    <!-- 2 创建活动 -->
    <view v-else-if="s === 2" class="k-body pad-both create-body">
      <text class="sec">活动类型</text>
      <view class="types">
        <view v-for="t in types" :key="t" class="type" :class="{ on: type === t }" @click="type = t"><text>{{ t }}</text></view>
      </view>
      <view class="k-divider k-mt16" />
      <text class="sec k-mt16">活动封面</text>
      <view class="k-row k-gap10 k-mt10">
        <image class="cover" src="/static/media/activities-cover.jpg" mode="aspectFill" />
        <view class="upload" @click="toast('上传图片')"><k-icon name="camera" :size="26" color="ink" :stroke="1.5" /><text class="upload__t">上传图片</text><text class="upload__s">建议尺寸 750*422</text></view>
      </view>
      <text class="sec k-mt20">活动标题</text>
      <view class="k-input k-mt10"><input v-model="title" placeholder="请输入活动标题" placeholder-class="k-placeholder" /><text class="counter">12/30</text></view>
      <text class="sec k-mt20">时间与地点</text>
      <view class="form k-mt10">
        <view class="form__row"><text class="form__label">开始时间</text><text class="form__value">2024-09-15 周日 14:00</text></view>
        <view class="form__row"><text class="form__label">结束时间</text><text class="form__value">2024-09-15 周日 17:00</text></view>
        <view class="form__hr" />
        <view class="form__row" @click="toast('选择地点')"><text class="form__label">活动地点</text><text class="form__value">西湖边 · 温馨一居室</text><k-icon name="chevron-right" :size="16" color="muted" /></view>
      </view>
      <text class="sec k-mt20">人数与费用</text>
      <view class="form k-mt10">
        <view class="form__row"><text class="form__label">招募人数</text><view class="num"><input v-model="people" type="number" /></view><text class="k-small k-muted">人（最多 50）</text></view>
        <view class="form__row"><text class="form__label">费用设置</text><view class="num num--fee"><text>¥</text><input v-model="fee" type="number" /></view><text class="k-small k-muted">元/人</text></view>
      </view>
      <view class="act-bar act-bar--two"><k-button type="outline" class="btn-draft" @click="toast('已保存草稿')">保存草稿</k-button><k-button class="k-flex1" @click="s = 3">下一步</k-button></view>
      <k-tabbar mode="staff" active="work" /><view class="tab-dot" />
    </view>

    <!-- 3 报名数据 -->
    <view v-else-if="s === 3" class="k-body pad-both data-body">
      <view class="k-between k-gap10">
        <view class="select" @click="toast('切换活动')"><text>西湖边 · 手作陶艺体验课</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="1.8" /></view>
        <view class="select select--date" @click="toast('选择日期')"><text>09-01 至 09-15</text><k-icon name="calendar" :size="15" color="ink" :stroke="1.6" /></view>
      </view>
      <view class="stats k-mt12">
        <view v-for="st in stats" :key="st.label" class="stat"><text class="stat__label">{{ st.label }}</text><text class="stat__num">{{ st.value }}</text><view class="k-row k-gap2"><text class="k-meta">较昨日</text><k-icon name="arrow-up" :size="11" color="green" :stroke="2.4" /><text class="stat__delta">{{ st.delta }}</text></view></view>
      </view>
      <view class="k-divider k-mt14" />
      <text class="sec k-mt12">渠道来源</text>
      <view class="k-row k-gap16 k-mt10">
        <view class="donut"><view class="donut__hole" /></view>
        <view class="k-flex1 legend">
          <view v-for="c in channels" :key="c.name" class="legend__row"><view class="legend__dot" :style="{ background: c.color }" /><text class="legend__name">{{ c.name }}</text><text class="legend__pct">{{ c.pct }}</text><text class="legend__num">{{ c.num }}</text></view>
        </view>
      </view>
      <text class="sec k-mt16">报名趋势</text>
      <view class="k-between k-mt6"><text class="k-meta">单位：人</text><view class="k-row k-gap14"><view class="k-row k-gap5"><view class="legend__dot" style="background:#4E8FC4" /><text class="k-small k-muted">浏览量</text></view><view class="k-row k-gap5"><view class="legend__dot" style="background:#4F7A66" /><text class="k-small k-muted">报名数</text></view></view></view>
      <view class="chart">
        <view class="chart__y"><text v-for="v in [80, 60, 40, 20, 0]" :key="v">{{ v }}</text></view>
        <view class="chart__plot">
          <view v-for="g in 5" :key="g" class="chart__grid" :style="{ top: ((g - 1) * 25) + '%' }" />
          <view class="chart__axis" />
          <view v-for="(seg, i) in viewSegs" :key="'v' + i" class="seg seg--blue" :style="seg" />
          <view v-for="(seg, i) in signSegs" :key="'g' + i" class="seg seg--green" :style="seg" />
          <view v-for="(p, i) in viewPts" :key="'vp' + i" class="pt pt--blue" :style="p" />
          <view v-for="(p, i) in signPts" :key="'gp' + i" class="pt pt--green" :style="p" />
        </view>
      </view>
      <view class="chart__x"><text v-for="d in ['09-01', '09-05', '09-09', '09-13', '09-15']" :key="d">{{ d }}</text></view>
      <view class="k-row k-gap10 k-mt16 sums">
        <view class="sum sum--pair">
          <view class="sum__cell"><text class="sum__label">已确认</text><view class="k-row k-gap6 k-baseline"><text class="sum__num">24</text><text class="k-small">人</text></view><text class="k-small k-muted k-mt6">占比 85.7%</text></view>
          <view class="sum__cell sum__cell--line"><text class="sum__label">候补中</text><view class="k-row k-gap6 k-baseline"><text class="sum__num">4</text><text class="k-small">人</text></view><text class="k-small k-muted k-mt6">占比 14.3%</text></view>
        </view>
        <view class="sum"><view class="sum__cell"><text class="sum__label">已取消</text><view class="k-row k-gap6 k-baseline"><text class="sum__num">2</text><text class="k-small">人</text></view><text class="k-small k-muted k-mt6">占比 6.7%</text></view></view>
      </view>
      <view class="act-bar act-bar--two"><k-button type="outline" icon="images" class="btn-export" @click="toast('已导出名单')">导出名单</k-button><k-button class="k-flex1" @click="toast('已群发提醒')">群发提醒</k-button></view>
      <k-tabbar mode="staff" active="work" /><view class="tab-dot" />
    </view>

    <!-- 4 活动详情 -->
    <view v-else class="k-body k-pad-bottom">
      <view class="k-row-start k-gap12">
        <image class="d-cover" src="/static/media/activities-detail-cover.jpg" mode="aspectFill" />
        <view class="k-flex1">
          <view class="tag tag--green"><text>进行中</text></view>
          <text class="d-title">西湖边 · 手作陶艺体验课</text>
          <view class="d-line"><k-icon name="calendar" :size="15" color="ink" :stroke="1.6" /><text>09-15 周日 14:00–17:00</text></view>
          <view class="d-line"><k-icon name="map-pin" :size="15" color="ink" :stroke="1.6" /><text>西湖边 · 温馨一居室</text></view>
          <view class="d-line"><k-icon name="map-pin" :size="15" color="ink" :stroke="1.6" /><text>发起人：阿布（小院管家）</text></view>
        </view>
      </view>
      <view class="d-stats k-mt14">
        <view v-for="(st, i) in dStats" :key="st.label" class="d-stat" :class="{ line: i > 0 }"><text class="d-stat__label">{{ st.label }}</text><view class="k-row k-baseline"><text class="d-stat__num">{{ st.value }}</text><text v-if="st.sub" class="d-stat__sub">{{ st.sub }}</text></view></view>
      </view>
      <view class="grid k-mt12">
        <view v-for="(g, i) in actions" :key="g.title" class="grid__cell" :class="{ 'grid__cell--r': i % 4 !== 3, 'grid__cell--b': i < 4 }" @click="onAction(g)">
          <k-icon :name="g.icon" :size="30" color="ink" :stroke="1.4" />
          <text class="grid__title">{{ g.title }}</text>
          <text class="grid__sub">{{ g.sub }}</text>
        </view>
      </view>
      <view class="weather k-mt12">
        <k-icon name="sun" :size="20" color="ink" :stroke="1.5" />
        <text class="weather__text k-flex1">天气预警：09-15 周日有中雨，\n气温 20～24°C</text>
        <view class="weather__btn" @click="toast('异常天气处理')"><text>异常天气处理</text></view>
      </view>
      <view class="tips k-mt12">
        <text class="tips__title">温馨提示</text>
        <text class="tips__text">如遇突发情况，可快速发起通知或取消流程，保障成员安全。</text>
        <view class="k-between k-mt12" @click="toast('取消活动流程')"><text class="tips__link">取消活动流程</text><k-icon name="chevron-right" :size="16" color="ink" :stroke="1.6" /></view>
      </view>
      <k-bottom flat><k-button type="outline" class="btn-pause" @click="toast('已暂停报名')">暂停报名</k-button><k-button class="k-flex1" @click="toast('活动已结束')">结束活动</k-button></k-bottom>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['活动管理', '创建活动', '报名数据', '活动详情']
const kw = ref('')
const tab = ref('全部 (32)')
const listTabs = ['全部 (32)', '报名中 (12)', '进行中 (6)', '已结束 (14)']
const activities = [
  { img: '/static/media/activities-act-1.jpg', status: '报名中', tone: 'green', title: '西湖边 · 手作陶艺体验', source: '小院', owner: '阿布', count: '28/30', price: 128, time: '09-15 周日 14:00–17:00', place: '西湖边 · 温馨一居室', audit: '已审核', auditTone: 'green' },
  { img: '/static/media/activities-act-2.jpg', status: '进行中', tone: 'ochre', title: '咖啡师基础入门课', source: '商家', owner: '小宇', count: '18/20', price: 198, time: '09-05 周四 10:00–12:30', place: '咖啡师兼职', audit: '已审核', auditTone: 'green' },
  { img: '/static/media/activities-act-3.jpg', status: '已结束', tone: 'gray', title: '中秋手作月饼礼盒', source: '用户自发', owner: '陈瑶', count: '16/16', price: 88, time: '09-02 周一 15:00–17:30', place: '西湖边 · 温馨一居室', audit: '已结束', auditTone: 'gray' },
  { img: '/static/media/activities-act-4.jpg', status: '报名中', tone: 'green', title: '植物拓染帆布包DIY', source: '小院', owner: '阿布', count: '12/15', price: 98, time: '09-20 周五 14:00–16:30', place: '西湖边 · 温馨一居室', audit: '待审核', auditTone: 'ochre' }
]
const types = ['手作课程', '生活体验', '小型聚会', '户外活动', '讲座沙龙', '其他']
const type = ref('手作课程')
const title = ref('西湖边 · 手作陶艺体验课')
const people = ref('30')
const fee = ref('128')
const stats = [
  { label: '浏览量', value: '568', delta: '12%' },
  { label: '报名数', value: '28', delta: '17%' },
  { label: '转化率', value: '4.93%', delta: '0.8%' }
]
const channels = [
  { name: '小院首页', pct: '42%', num: 238, color: '#4E8FC4' },
  { name: '微信群', pct: '25%', num: 142, color: '#5F6B6A' },
  { name: '好友分享', pct: '18%', num: 102, color: '#8B8F6A' },
  { name: '公众号', pct: '10%', num: 56, color: '#4F7A66' },
  { name: '其他', pct: '5%', num: 28, color: '#8FB5D6' }
]
const W = 296, H = 112
const views = [17, 33, 42, 32, 52, 45, 66, 58, 75, 48, 54]
const signs = [7, 15, 21, 12, 27, 19, 31, 26, 47, 23, 31]
const toXY = (arr) => arr.map((v, i) => [i * (W / (arr.length - 1)), H - (v / 80) * H])
const segsOf = (arr) => {
  const pts = toXY(arr); const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
    const len = Math.hypot(x1 - x0, y1 - y0); const ang = Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI
    out.push({ left: x0 + 'px', top: y0 + 'px', width: len + 'px', transform: `rotate(${ang}deg)` })
  }
  return out
}
const ptsOf = (arr) => toXY(arr).map(([x, y]) => ({ left: (x - 3) + 'px', top: (y - 3) + 'px' }))
const viewSegs = computed(() => segsOf(views))
const signSegs = computed(() => segsOf(signs))
const viewPts = computed(() => ptsOf(views))
const signPts = computed(() => ptsOf(signs))
const dStats = [
  { label: '报名', value: '28', sub: '/30' },
  { label: '已签到', value: '18' },
  { label: '候补', value: '4' },
  { label: '评价', value: '16' }
]
const actions = [
  { icon: 'message-circle', title: '活动群聊', sub: '进入群聊', to: R.chat },
  { icon: 'user-cog', title: '成员管理', sub: '查看成员' },
  { icon: 'scan-qr-code', title: '签到管理', sub: '二维码签到' },
  { icon: 'volume-2', title: '现场通知', sub: '发送通知' },
  { icon: 'message-square-text', title: '评价收集', sub: '回收评价', to: R.staffReviews },
  { icon: 'images', title: '相册管理', sub: '上传照片' },
  { icon: 'chart-pie', title: '数据看板', sub: '活动数据', screen: 3 },
  { icon: 'settings', title: '更多设置', sub: '编辑设置', screen: 2 }
]
const onAction = (g) => { if (g.to) return go(g.to); if (g.screen) { s.value = g.screen; return } toast(g.title) }
const onBack = () => { if (s.value > 1) s.value = 1; else uni.navigateBack() }
</script>

<style scoped lang="scss">
.pad-both { padding-bottom: calc(150px + var(--k-safe-bottom)); }
.act-bar { position: fixed; left: 0; right: 0; bottom: calc(56px + var(--k-safe-bottom)); z-index: 49; padding: 10px 16px 12px; background: var(--k-bg); display: flex; gap: 12px; }
.tab-dot { position: fixed; z-index: 51; left: 252px; bottom: calc(var(--k-safe-bottom) + 46px); width: 8px; height: 8px; border-radius: 50%; background: var(--k-red); }
.sec { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.k-mt6 { margin-top: 6px; } .k-mt10 { margin-top: 10px; } .k-mt14 { margin-top: 14px; }
.k-gap2 { gap: 2px; } .k-gap5 { gap: 5px; } .k-gap14 { gap: 14px; }
.k-baseline { align-items: baseline; }

/* s1 */
.search-row { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; }
.search { flex: 1; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); }
.search input { flex: 1; min-width: 0; font-size: 13px; height: 34px; }
.filter-btn { display: flex; align-items: center; gap: 5px; height: 36px; padding: 0 14px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); font-size: 14px; }
.tabs { display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid var(--k-line); }
.tabs__item { position: relative; flex: 1; text-align: center; padding: 10px 0; font-size: 14px; color: var(--k-ink); }
.tabs__item.active { color: var(--k-red); font-weight: 600; }
.tabs__item.active::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 46px; height: 2px; margin-left: -23px; background: var(--k-red); border-radius: 2px; }
.pills { display: flex; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--k-line); }
.pill { display: flex; align-items: center; gap: 4px; height: 30px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); font-size: 13px; }
.list { padding: 0 16px; }
.item { display: flex; gap: 12px; padding: 14px 0 12px; border-bottom: 1px solid var(--k-line); }
.item__img { width: 56px; height: 82px; border-radius: 8px; flex: 0 0 auto; }
.tag { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 4px; color: #fff; font-size: 11px; font-weight: 600; flex: 0 0 auto; }
.tag--green { background: var(--k-green); }
.tag--ochre { background: #B8792A; }
.tag--gray { background: #8C8378; }
.item__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; flex: 1; min-width: 0; }
.item__meta { display: flex; align-items: center; gap: 10px; margin-top: 5px; font-size: 12px; color: var(--k-muted); letter-spacing: .5px; }
.vline { width: 1px; height: 12px; background: var(--k-line2); }
.item__line { display: flex; align-items: center; gap: 6px; margin-top: 5px; font-size: 13px; color: var(--k-ink); }
.item__price { margin-left: 16px; }
.audit { height: 20px; padding: 0 8px; display: flex; align-items: center; border-radius: 4px; font-size: 11px; border: 1px solid; }
.audit--green { color: var(--k-green); border-color: #B9CFC0; background: var(--k-paper); }
.audit--ochre { color: var(--k-ochre); border-color: #E3CFA6; background: var(--k-paper); }
.audit--gray { color: var(--k-muted); border-color: var(--k-line2); background: var(--k-paper); }

/* s2 */
.types { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 10px; margin-top: 10px; }
.type { height: 28px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--k-line2); border-radius: 6px; background: var(--k-paper); font-size: 14px; }
.type.on { border-color: var(--k-red); color: var(--k-red); font-weight: 600; }
.cover { width: 132px; height: 92px; border-radius: 8px; flex: 0 0 auto; }
.upload { width: 98px; height: 92px; border: 1px dashed var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; }
.upload__t { font-size: 12px; color: var(--k-muted); margin-top: 2px; }
.upload__s { font-size: 10px; color: var(--k-light); }
.counter { font-size: 12px; color: var(--k-light); }
.form { border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); padding: 6px 14px; }
.form__row { display: flex; align-items: center; min-height: 40px; gap: 10px; }
.form__label { width: 72px; flex: 0 0 auto; font-size: 13px; color: var(--k-muted); }
.form__value { flex: 1; min-width: 0; font-size: 14px; }
.form__hr { height: 1px; background: var(--k-line); margin: 2px 0; }
.num { width: 62px; display: flex; align-items: center; gap: 6px; border-bottom: 1px solid var(--k-line2); flex: 0 0 auto; }
.num input { flex: 1; min-width: 0; height: 30px; font-size: 15px; font-weight: 500; }
.num--fee { width: 74px; }
.btn-draft { width: 118px; }

/* s3 */
.select { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); font-size: 13px; }
.select--date { flex: 0 0 auto; }
.stats { display: flex; gap: 10px; }
.stat { flex: 1; min-width: 0; padding: 12px 10px 10px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; flex-direction: column; gap: 6px; }
.stat__label { font-size: 13px; font-weight: 500; }
.stat__num { font-family: var(--k-serif); font-weight: 700; font-size: 22px; line-height: 1.1; }
.stat__delta { font-size: 12px; color: var(--k-green); }
.donut { width: 90px; height: 90px; border-radius: 50%; flex: 0 0 auto; background: conic-gradient(#4E8FC4 0 42%, #73B3DA 42% 67%, #9ED0E4 67% 85%, #B9B9B9 85% 95%, #DADADA 95% 100%); display: flex; align-items: center; justify-content: center; }
.donut__hole { width: 54px; height: 54px; border-radius: 50%; background: var(--k-bg); }
.legend { padding-left: 8px; display: flex; flex-direction: column; gap: 3px; }
.legend__row { display: flex; align-items: center; gap: 8px; font-size: 13px; height: 18px; }
.legend__dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
.legend__name { width: 76px; }
.legend__pct { width: 40px; text-align: center; }
.legend__num { flex: 1; text-align: right; }
.chart { display: flex; gap: 8px; margin-top: 12px; height: 112px; }
.chart__y { width: 20px; display: flex; flex-direction: column; justify-content: space-between; text-align: right; font-size: 12px; color: var(--k-muted); line-height: 1; margin-top: -6px; margin-bottom: -6px; }
.chart__plot { position: relative; flex: 1; width: 296px; height: 112px; }
.chart__grid { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--k-line2); }
.chart__axis { position: absolute; left: 0; top: 0; bottom: 0; width: 1px; background: var(--k-line2); }
.seg { position: absolute; height: 2px; transform-origin: 0 50%; border-radius: 1px; }
.seg--blue { background: #4E8FC4; }
.seg--green { background: #4F7A66; }
.pt { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: var(--k-bg); border: 1.5px solid; }
.pt--blue { border-color: #4E8FC4; }
.pt--green { border-color: #4F7A66; }
.chart__x { display: flex; justify-content: space-between; padding-left: 20px; margin-top: 8px; font-size: 12px; color: var(--k-muted); }
.sums { align-items: stretch; }
.sum { flex: 1; min-width: 0; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); display: flex; }
.sum--pair { flex: 2; }
.sum__cell { flex: 1; min-width: 0; padding: 14px 16px; display: flex; flex-direction: column; }
.sum__cell--line { border-left: 1px solid var(--k-line); }
.sum__label { font-family: var(--k-serif); font-weight: 700; font-size: 14px; margin-bottom: 6px; }
.sum__num { font-family: var(--k-serif); font-weight: 700; font-size: 24px; line-height: 1; }
.btn-export { flex: 0 0 auto; }

/* s4 */
.d-cover { width: 92px; height: 108px; border-radius: 8px; flex: 0 0 auto; }
.d-title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 18px; margin-top: 8px; }
.d-line { display: flex; align-items: center; gap: 6px; margin-top: 7px; font-size: 14px; }
.d-stats { display: flex; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.d-stat { flex: 1; min-width: 0; height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
.d-stat.line { border-left: 1px solid var(--k-line); }
.d-stat__label { font-size: 13px; color: var(--k-muted); }
.d-stat__num { font-family: var(--k-serif); font-weight: 700; font-size: 20px; line-height: 1.1; }
.d-stat__sub { font-size: 12px; color: var(--k-muted); margin-left: 1px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); overflow: hidden; }
.grid__cell { height: 92px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.grid__cell--r { border-right: 1px solid var(--k-line); }
.grid__cell--b { border-bottom: 1px solid var(--k-line); }
.grid__title { font-family: var(--k-serif); font-weight: 700; font-size: 14px; margin-top: 4px; }
.grid__sub { font-size: 11px; color: var(--k-muted); }
.weather { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.weather__text { font-size: 14px; line-height: 1.6; white-space: pre-line; }
.weather__btn { height: 26px; padding: 0 8px; display: flex; align-items: center; border: 1px solid var(--k-ochre); border-radius: 6px; color: #A5701F; font-size: 12px; flex: 0 0 auto; }
.tips { padding: 14px; border-radius: 10px; background: var(--k-paper2); }
.tips__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 14px; }
.tips__text { display: block; margin-top: 8px; font-size: 13px; color: var(--k-muted); line-height: 1.6; }
.tips__link { font-family: var(--k-serif); font-weight: 700; font-size: 14px; color: var(--k-red); }
.btn-pause { width: 134px; }
.create-body .k-mt20{margin-top:12px}.create-body .k-mt16{margin-top:10px}.create-body .cover{height:80px}.create-body .upload{height:80px}.create-body .form__row{min-height:36px}.create-body .act-bar{padding-top:8px;padding-bottom:8px}.data-body .stat{padding:8px}.data-body .donut{width:78px;height:78px}.data-body .donut__hole{width:47px;height:47px}.data-body .chart{height:90px;margin-top:8px}.data-body .chart__plot{height:90px}.data-body .chart__x{margin-top:5px}.data-body .k-mt16{margin-top:9px}.data-body .sum__cell{padding:9px 12px}.data-body .act-bar{padding-top:8px;padding-bottom:8px}
.create-body .form__row{min-height:32px}
</style>
