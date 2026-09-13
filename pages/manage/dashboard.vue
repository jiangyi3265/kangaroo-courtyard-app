<template>
  <view class="k-page dash">
    <k-topbar :title="titles[s - 1]" back @back="onBack">
      <view v-if="s === 1" class="ptabs">
        <view v-for="t in periods" :key="t" class="ptabs__item" :class="{ active: period === t }" @click="period = t"><text>{{ t }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 核心指标 -->
    <view v-if="s === 1" class="k-body k-pad-tab">
      <view class="k-between">
        <view class="k-row k-gap6"><text class="k-title">核心指标</text><k-icon name="info" :size="16" color="ink" :stroke="1.5" /></view>
        <text class="k-meta">与上周期对比</text>
      </view>
      <view class="k-between k-mt4">
        <text class="k-meta">8月23日 - 8月29日</text>
        <text class="k-tiny">与8月16日 - 8月22日对比</text>
      </view>
      <view class="k-grid-2 k-mt14">
        <view v-for="m in metrics" :key="m.label" class="metric">
          <text class="k-small k-muted">{{ m.label }}</text>
          <text class="metric__value num" :style="{ color: m.color }">{{ m.value }}</text>
          <view class="k-row k-gap2 metric__delta"><k-icon name="arrow-up" :size="15" color="green" :stroke="2" /><text>{{ m.delta }}</text></view>
          <view class="spark" :style="{ width: '144px', height: '36px' }">
            <view v-for="(p, i) in m.chart.pts" :key="'a' + i" class="spark__area" :style="{ left: p[0] + 'px', top: p[1] + 'px', width: m.chart.step + 'px', height: (36 - p[1]) + 'px', background: m.soft }" />
            <view v-for="(g, i) in m.chart.segs" :key="'s' + i" class="spark__seg" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)', background: m.line }" />
          </view>
        </view>
      </view>
      <view class="metric metric--wide k-mt10">
        <view class="k-col">
          <text class="k-small k-muted">好评率</text>
          <text class="metric__value num">96%</text>
          <view class="k-row k-gap2 metric__delta"><k-icon name="arrow-up" :size="15" color="green" :stroke="2" /><text>2.8%</text></view>
        </view>
        <view class="spark" :style="{ width: '190px', height: '48px' }">
          <view v-for="(p, i) in wide.pts" :key="'a' + i" class="spark__area" :style="{ left: p[0] + 'px', top: p[1] + 'px', width: wide.step + 'px', height: (48 - p[1]) + 'px', background: '#E7EFE7' }" />
          <view v-for="(g, i) in wide.segs" :key="'s' + i" class="spark__seg" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)', background: '#4F7A66' }" />
        </view>
      </view>
      <text class="k-tiny k-mt14 note">指标说明：* 以上数据为所选时间段内所有门店汇总</text>
    </view>

    <!-- 2 业务趋势 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab">
      <view class="k-row k-gap10">
        <view class="select k-flex1" @click="toast('选择门店')"><text>全部门店</text><k-icon name="chevron-down" :size="16" color="ink" :stroke="1.7" /></view>
        <view class="select k-flex1" @click="toast('选择城市')"><text>全部城市</text><k-icon name="chevron-down" :size="16" color="ink" :stroke="1.7" /></view>
        <view class="select select--icon" @click="toast('选择日期')"><k-icon name="calendar" :size="20" color="ink" :stroke="1.6" /></view>
      </view>
      <view class="k-between k-mt10">
        <text class="k-small k-muted">同期对比：7月24日 - 8月22日</text>
        <view class="select select--sm" @click="toast('选择周期')"><text>近30天</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="1.7" /></view>
      </view>
      <k-card class="k-mt10" :pad="14">
        <view class="k-row k-gap4"><text class="k-subtitle">业务趋势</text><text class="k-meta">（近30天）</text></view>
        <view class="legend k-mt8">
          <view class="legend__item"><view class="legend__bar" /><text>订单数（单）</text></view>
          <view class="legend__item"><view class="legend__line" style="background:#D9902E" /><text>入住数（间夜）</text></view>
        </view>
        <view class="legend k-mt6">
          <view class="legend__item"><view class="legend__line" style="background:#4F7A66" /><text>报名数（人）</text></view>
          <view class="legend__item"><view class="legend__dash" /><text>活动参与（人次）</text></view>
        </view>
        <view class="chart k-mt12">
          <view class="chart__axis chart__axis--l"><text v-for="v in leftAxis" :key="v">{{ v }}</text></view>
          <view class="chart__plot">
            <view v-for="n in 6" :key="n" class="chart__grid" :style="{ top: ((n - 1) * 30) + 'px' }" />
            <view v-for="(b, i) in bars" :key="'b' + i" class="chart__bar" :style="{ left: (i * barStep + 1) + 'px', height: (b / 1000 * 150) + 'px' }" />
            <view v-for="(g, i) in orangeLine.segs" :key="'o' + i" class="chart__seg" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)', background: '#E39A2E', height: '2.5px' }" />
            <view v-for="(g, i) in greenLine.segs" :key="'g' + i" class="chart__seg" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)', background: '#4F7A66', height: '2px' }" />
            <view v-for="(g, i) in dashLine.segs" :key="'d' + i" class="chart__dash" :style="{ left: g.x + 'px', top: g.y + 'px', width: g.len + 'px', transform: 'rotate(' + g.ang + 'deg)' }" />
            <view class="chart__flat" />
          </view>
          <view class="chart__axis chart__axis--r"><text v-for="v in rightAxis" :key="v">{{ v }}</text></view>
        </view>
        <view class="chart__x"><text v-for="d in xLabels" :key="d">{{ d }}</text></view>
      </k-card>
      <text class="k-small k-muted k-mt16 block">近30天合计</text>
      <view class="totals k-mt8">
        <view v-for="(t, i) in totals" :key="t.label" class="totals__cell" :class="{ line: i < totals.length - 1 }">
          <text class="k-tiny">{{ t.label }}</text>
          <text class="totals__value num">{{ t.value }}</text>
          <view class="k-row k-gap2 totals__delta"><k-icon name="arrow-up" :size="13" color="green" :stroke="2" /><text>{{ t.delta }}</text></view>
        </view>
      </view>
      <k-card class="k-mt14" :pad="14">
        <text class="k-subtitle">趋势洞察</text>
        <view class="k-col k-gap6 k-mt8">
          <text v-for="t in insights" :key="t" class="k-small bullet">• {{ t }}</text>
        </view>
      </k-card>
    </view>

    <!-- 3 门店排名 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab">
      <view class="rtabs">
        <view v-for="t in rankTabs" :key="t" class="rtabs__item" :class="{ active: rankTab === t }" @click="rankTab = t"><text>{{ t }}</text></view>
      </view>
      <view class="k-between k-mt12">
        <text class="k-small k-muted">近30天（7.31-8.29）</text>
        <view class="k-row k-gap6" @click="toast('筛选')"><text class="k-small">筛选</text><k-icon name="filter" :size="16" color="ink" :stroke="1.6" /></view>
      </view>
      <k-card class="k-mt10" :pad="0">
        <view v-for="(r, i) in ranks" :key="r.name" class="rank" :class="{ line: i < ranks.length - 1 }" @click="go(R.daily)">
          <view class="rank__no">
            <image v-if="i < 3" class="rank__crown" :src="'/static/media/dash-crown-' + (i + 1) + '.jpg'" mode="aspectFit" />
            <text v-else class="rank__num num">{{ i + 1 }}</text>
          </view>
          <image class="rank__thumb" :src="'/static/media/dash-store-' + (i + 1) + '.jpg'" mode="aspectFill" />
          <view class="k-flex1 k-col">
            <text class="k-subtitle">{{ r.name }}</text>
            <text class="k-meta k-mt2">{{ r.area }}</text>
          </view>
          <view class="k-col rank__right">
            <text class="rank__amount">¥ {{ r.amount }}</text>
            <view class="k-row k-gap2 k-mt2"><k-icon :name="r.down ? 'arrow-down' : 'arrow-up'" :size="13" :color="r.down ? 'red' : 'green'" :stroke="2" /><text class="rank__chg" :class="r.down ? 'k-red' : 'k-green'">{{ r.change }}</text></view>
          </view>
          <k-icon name="chevron-right" :size="16" color="muted" :stroke="1.6" />
        </view>
      </k-card>
      <text class="k-tiny k-mt16 note">* 名次变化对比上一周期（7.1-7.30）</text>
    </view>

    <!-- 4 评价统计 -->
    <view v-else class="k-body k-pad-tab review-body">
      <view class="k-row k-gap10">
        <view class="select k-flex1" @click="toast('选择周期')"><text>近30天（7.31-8.29）</text><k-icon name="chevron-down" :size="16" color="ink" :stroke="1.7" /></view>
        <view class="select k-flex1" @click="toast('选择门店')"><text>全部门店</text><k-icon name="chevron-down" :size="16" color="ink" :stroke="1.7" /></view>
      </view>
      <k-card class="k-mt12" :pad="10">
        <view class="k-row-start k-gap12">
          <view class="score">
            <text class="k-subtitle">评分分布</text>
            <text class="score__big num">4.8</text>
            <view class="k-row k-gap2 k-mt2">
              <k-icon v-for="n in 4" :key="n" name="star" :size="16" color="#D9A441" :stroke="1" fill />
              <k-icon name="star-half" :size="16" color="#D9A441" :stroke="1" fill />
            </view>
            <text class="k-meta k-mt8">共 2,860 条评价</text>
          </view>
          <view class="k-flex1 k-col k-gap10 dist">
            <view v-for="d in dist" :key="d.star" class="k-row k-gap8">
              <text class="k-small dist__label">{{ d.star }}星</text>
              <view class="k-bar k-flex1 dist__bar"><view class="k-bar__fill" :style="{ width: d.pct + '%', background: d.color }" /></view>
              <text class="k-meta dist__num">{{ d.num }}</text>
            </view>
          </view>
        </view>
      </k-card>
      <view class="k-grid-2 k-mt10">
        <k-card :pad="10">
          <text class="k-subtitle">好评关键词 TOP5</text>
          <view class="k-col k-gap8 k-mt10 word-list">
            <view v-for="k in goodWords" :key="k[0]" class="k-between"><text class="k-small">{{ k[0] }}</text><text class="k-small">{{ k[1] }}</text></view>
          </view>
        </k-card>
        <k-card :pad="10">
          <text class="k-subtitle">低分原因 TOP5</text>
          <view class="k-col k-gap8 k-mt10 word-list">
            <view v-for="k in badWords" :key="k[0]" class="k-between"><text class="k-small">{{ k[0] }}</text><text class="k-small">{{ k[1] }}</text></view>
          </view>
        </k-card>
      </view>
      <view class="k-grid-3 k-mt10">
        <view v-for="t in kpis" :key="t.label" class="kpi">
          <text class="k-small k-muted">{{ t.label }}</text>
          <text class="kpi__value num">{{ t.value }}</text>
          <view class="k-row k-gap2 kpi__delta"><k-icon name="arrow-up" :size="13" color="green" :stroke="2" /><text>{{ t.delta }}</text></view>
        </view>
      </view>
      <view class="k-grid-2 k-mt10">
        <k-card :pad="10">
          <text class="k-subtitle">AI 评价摘要</text>
          <text class="k-meta k-mt6 block">整体评价积极，用户对服务热度、环境氛围和体验感受认可度高；主要改进点集中在隔音和位置便利性。</text>
          <view class="obtn k-mt10" @click="go(R.staffReviews)"><text>查看详情</text></view>
        </k-card>
        <k-card :pad="10">
          <text class="k-subtitle">改进建议</text>
          <view class="k-col k-gap4 k-mt6">
            <text v-for="t in advice" :key="t" class="k-meta">• {{ t }}</text>
          </view>
          <view class="obtn k-mt10" @click="toast('已生成改进计划')"><text>生成改进计划</text></view>
        </k-card>
      </view>
    </view>

    <k-tabbar mode="staff" active="business" />
    <view class="msg-dot" />
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import R from '@/common/routes.js'

const s = useScreen(4)
const titles = ['数据看板', '业务趋势', '门店排名', '评价统计']
const onBack = () => { if (s.value > 1) s.value = 1; else back() }

/** 折线：把数值转成可用 view 绘制的线段 */
function line(vals, w, h, min, max, pad = 2) {
  const lo = min ?? Math.min(...vals), hi = max ?? Math.max(...vals)
  const step = w / (vals.length - 1)
  const pts = vals.map((v, i) => [+(i * step).toFixed(2), +(pad + (h - pad * 2) * (1 - (v - lo) / (hi - lo || 1))).toFixed(2)])
  const segs = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]
    segs.push({ x: x1, y: y1, len: +(Math.hypot(x2 - x1, y2 - y1) + 1).toFixed(2), ang: +(Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI).toFixed(2) })
  }
  return { pts, segs, step: +(step + 0.5).toFixed(2) }
}

// s1
const periods = ['7天', '30天', '季度']
const period = ref('7天')
const metrics = [
  { label: '营业额（元）', value: '28,760', delta: '12.5%', color: '#A94734', line: '#A94734', soft: '#F5E6E1', chart: line([30, 22, 26, 38, 46, 42, 34, 40, 55, 62, 58, 50, 60, 70, 66, 60, 74, 92], 144, 36) },
  { label: '入住率', value: '78%', delta: '6.2%', color: '#241B17', line: '#D9A441', soft: '#F4E8D2', chart: line([26, 34, 42, 48, 44, 36, 40, 50, 58, 56, 50, 60, 68, 74, 70, 66, 78, 92], 144, 36) },
  { label: '报名转化率', value: '32%', delta: '4.1%', color: '#241B17', line: '#4F7A66', soft: '#E7EFE7', chart: line([28, 34, 38, 44, 40, 32, 36, 46, 52, 50, 44, 52, 62, 70, 66, 60, 76, 92], 144, 36) },
  { label: '二消收入（元）', value: '6,240', delta: '15.3%', color: '#40576B', line: '#40576B', soft: '#E7EDF1', chart: line([30, 40, 48, 40, 30, 36, 46, 56, 50, 44, 52, 62, 58, 52, 62, 72, 68, 80], 144, 36) }
]
const wide = line([22, 28, 34, 40, 38, 32, 36, 44, 50, 46, 42, 50, 58, 62, 56, 60, 70, 76, 72, 78, 88, 96], 190, 48)

// s2
const leftAxis = ['1,000', '800', '600', '400', '200', '0']
const rightAxis = ['500', '400', '300', '200', '100', '0']
const xLabels = ['7/24', '7/31', '8/7', '8/14', '8/21']
const bars = [720, 400, 540, 340, 700, 620, 520, 950, 760, 480, 500, 560, 440, 820, 680, 540, 830, 740, 470, 600, 780, 600, 860, 730, 640, 560, 700, 820, 700, 760]
const plotW = 262
const barStep = plotW / 30
const orangeLine = line([175, 178, 200, 210, 185, 170, 190, 205, 210, 200, 180, 170, 175, 200, 220, 210, 215, 205, 220, 235, 240, 235, 245, 240, 255, 275, 305], plotW - 4, 150, 0, 500, 1)
const greenLine = line([70, 75, 80, 85, 95, 105, 115, 118, 100, 82, 76, 72, 76, 82, 88, 92, 100, 112, 92, 86, 80, 84, 92, 96, 108, 122, 150], plotW - 4, 150, 0, 500, 1)
const dashLine = line([280, 258, 222, 232, 272, 302, 338, 312, 322, 292, 282, 320, 332, 342, 372, 382, 362, 392, 402, 352, 382, 362, 342, 372, 342, 322, 302], plotW - 4, 150, 0, 500, 1)
const totals = [
  { label: '订单数（单）', value: '12,860', delta: '14.7%' },
  { label: '入住数（间夜）', value: '9,840', delta: '10.3%' },
  { label: '报名数（人）', value: '3,420', delta: '18.6%' },
  { label: '活动参与（人次）', value: '2,560', delta: '20.8%' }
]
const insights = ['8月18日订单数达到峰值 920 单', '活动参与度持续上升，较上周期增长 20.8%', '报名数在周末表现更佳，建议加强周末活动投放']

// s3
const rankTabs = ['营业额榜', '入住率榜', '好评榜', '岗位履约榜']
const rankTab = ref('营业额榜')
const ranks = [
  { name: '西湖边 · 温馨一居室', area: '杭州 · 西湖区', amount: '28,760', change: '2' },
  { name: '花艺咖屋（兼职）', area: '苏州 · 姑苏区', amount: '24,580', change: '1' },
  { name: '海边的风（全职）', area: '厦门 · 思明区', amount: '22,340', change: '5' },
  { name: '山谷木屋 · 治愈系', area: '莫干山 · 德清县', amount: '18,760', change: '1', down: true },
  { name: '民宿前台接待', area: '大理 · 古城区', amount: '16,420', change: '0' },
  { name: '安心木院 · 美好生活', area: '成都 · 武侯区', amount: '15,380', change: '2', down: true },
  { name: '手作老师（兼职）', area: '上海 · 闵行区', amount: '14,280', change: '1' },
  { name: '茶香小院（兼职）', area: '杭州 · 余杭区', amount: '12,860', change: '3' }
]

// s4
const dist = [
  { star: 5, pct: 67, num: '1,928 (67%)', color: '#4F7A66' },
  { star: 4, pct: 24, num: '702 (24%)', color: '#D9A441' },
  { star: 3, pct: 8, num: '172 (6%)', color: '#E39A2E' },
  { star: 2, pct: 3, num: '38 (1%)', color: '#A94734' },
  { star: 1, pct: 2, num: '20 (1%)', color: '#A94734' }
]
const goodWords = [['服务热情', 892], ['环境舒适', 756], ['体验很棒', 689], ['干净整洁', 542], ['氛围治愈', 438]]
const badWords = [['隔音一般', 68], ['位置偏远', 52], ['设施陈旧', 48], ['早餐一般', 36], ['性价比低', 28]]
const kpis = [
  { label: '好评率', value: '96%', delta: '2.8%' },
  { label: '回复率', value: '98%', delta: '3.6%' },
  { label: '精选数量', value: '286', delta: '18' }
]
const advice = ['优化房间隔音措施', '增加周边交通指引', '升级老旧设施设备']
</script>

<style scoped lang="scss">
.num { font-family: Georgia, "Times New Roman", var(--k-serif); font-weight: 700; }
.block { display: block; }
.note { display: block; }
.k-mt2 { margin-top: 2px; }
.k-mt6 { margin-top: 6px; }
.k-mt10 { margin-top: 10px; }
.k-mt14 { margin-top: 14px; }
.k-gap2 { gap: 2px; }
.msg-dot { position: fixed; z-index: 51; left: 254px; bottom: calc(var(--k-safe-bottom) + 47px); width: 7px; height: 7px; border-radius: 50%; background: var(--k-red); }

/* 页签 */
.ptabs { display: flex; border-bottom: 1px solid var(--k-line); }
.ptabs__item { flex: 1; text-align: center; padding: 10px 0 12px; font-size: 15px; color: var(--k-ink); position: relative; }
.ptabs__item.active { color: var(--k-red); }
.ptabs__item.active::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--k-red); }
.rtabs { display: flex; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); }
.rtabs__item { flex: 1; text-align: center; padding: 11px 0 12px; font-size: 15px; color: var(--k-ink); position: relative; }
.rtabs__item.active { color: var(--k-red); }
.rtabs__item.active::after { content: ""; position: absolute; left: 12px; right: 12px; bottom: 0; height: 2px; background: var(--k-red); }

/* 指标卡 */
.metric { padding: 14px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; }
.metric--wide { flex-direction: row; align-items: flex-end; justify-content: space-between; }
.metric__value { font-size: 32px; line-height: 1.1; margin-top: 6px; color: var(--k-ink); }
.metric__delta { margin-top: 6px; font-size: 14px; color: var(--k-green); }
.spark { position: relative; overflow: hidden; margin-top: 8px; }
.spark__area { position: absolute; }
.spark__seg { position: absolute; height: 2px; border-radius: 1px; transform-origin: 0 50%; }

/* 下拉 */
.select { height: 40px; padding: 0 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; font-size: 15px; gap: 6px; }
.select--icon { width: 48px; flex: 0 0 auto; justify-content: center; }
.select--sm { height: 32px; font-size: 14px; padding: 0 10px; }

/* 趋势图 */
.legend { display: flex; gap: 16px; font-size: 13px; color: var(--k-ink); }
.legend__item { display: flex; align-items: center; gap: 6px; }
.legend__bar { width: 18px; height: 5px; border-radius: 3px; background: #3E5F86; }
.legend__line { width: 18px; height: 3px; border-radius: 2px; }
.legend__dash { width: 18px; height: 0; border-top: 2px dashed #3E5F86; }
.chart { display: flex; align-items: flex-start; height: 150px; }
.chart__axis { width: 34px; height: 150px; display: flex; flex-direction: column; justify-content: space-between; font-size: 12px; color: var(--k-muted); flex: 0 0 auto; }
.chart__axis--l { align-items: flex-end; padding-right: 6px; }
.chart__axis--l text, .chart__axis--r text { line-height: 1; margin-top: -6px; }
.chart__axis--l text:first-child, .chart__axis--r text:first-child { margin-top: -6px; }
.chart__axis--r { width: 30px; align-items: flex-start; padding-left: 6px; }
.chart__plot { position: relative; flex: 1; min-width: 0; height: 150px; border-left: 1px solid var(--k-line2); border-right: 1px solid var(--k-line2); }
.chart__grid { position: absolute; left: 0; right: 0; height: 1px; background: var(--k-line); }
.chart__bar { position: absolute; bottom: 0; width: 4.5px; background: #3E5F86; border-radius: 2px 2px 0 0; }
.chart__seg { position: absolute; transform-origin: 0 50%; border-radius: 2px; }
.chart__dash { position: absolute; height: 0; border-top: 1.5px dashed #3E5F86; transform-origin: 0 50%; }
.chart__flat { position: absolute; left: 0; right: 0; bottom: 9px; height: 0; border-top: 1.5px dashed #9FBFC2; }
.chart__x { display: flex; justify-content: space-between; padding: 8px 20px 0 34px; font-size: 13px; color: var(--k-muted); }
.totals { display: flex; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.totals__cell { flex: 1; min-width: 0; padding: 12px 4px; display: flex; flex-direction: column; align-items: center; }
.totals__cell.line { border-right: 1px solid var(--k-line); }
.totals__value { font-size: 22px; line-height: 1.2; margin-top: 6px; }
.totals__delta { margin-top: 6px; font-size: 13px; color: var(--k-green); }
.bullet { display: block; }

/* 排名 */
.rank { display: flex; align-items: center; gap: 10px; padding: 12px 14px 12px 8px; }
.rank.line { border-bottom: 1px solid var(--k-line); }
.rank__no { width: 30px; display: flex; justify-content: center; flex: 0 0 auto; }
.rank__crown { width: 30px; height: 32px; }
.rank__num { font-size: 22px; }
.rank__thumb { width: 38px; height: 38px; border-radius: 6px; flex: 0 0 auto; }
.rank__right { align-items: flex-end; flex: 0 0 auto; }
.rank__amount { font-size: 15px; font-weight: 600; }
.rank__chg { font-size: 14px; }

/* 评价统计 */
.score { width: 98px; display: flex; flex-direction: column; flex: 0 0 auto; }
.score__big { font-size: 44px; line-height: 1; margin-top: 10px; }
.dist { padding-top: 2px; }
.dist__label { width: 24px; flex: 0 0 auto; }
.dist__bar { height: 12px; border-radius: 6px; background: #EFEAE1; }
.dist__bar .k-bar__fill { border-radius: 6px; }
.dist__num { width: 68px; text-align: right; flex: 0 0 auto; }
.kpi { padding: 14px 8px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; }
.kpi__value { font-size: 28px; line-height: 1.2; margin-top: 4px; }
.kpi__delta { margin-top: 4px; font-size: 14px; color: var(--k-green); }
.obtn { height: 36px; border: 1px solid var(--k-red); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: var(--k-red); font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.review-body .dist { gap: 7px; }
.review-body .word-list { gap: 4px; margin-top: 7px; }
.review-body .kpi { padding-top: 8px; padding-bottom: 8px; }
.review-body .k-grid-2,
.review-body .k-grid-3 { margin-top: 8px; }
.review-body .obtn { height: 31px; margin-top: 6px; }
</style>
