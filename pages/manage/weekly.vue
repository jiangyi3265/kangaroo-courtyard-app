<template>
  <view class="k-page weekly">
    <k-topbar :title="titles[s - 1]" back @back="onBack">
      <view v-if="s === 1" class="tabs">
        <view v-for="t in tabs" :key="t" class="tabs__item" :class="{ active: tab === t }" @click="tab = t"><text>{{ t }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 周报列表 -->
    <view v-if="s === 1" class="k-body k-pad-tab list-body">
      <view class="filter">
        <view class="pill"><text>全部门店</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
        <view class="k-row k-gap4" @click="toast('切换周')"><text class="filter__week">2026年 第35周（8.25-8.31）</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
      </view>

      <view v-for="r in reports" :key="r.name" class="report" @click="s = r.status === 'draft' ? 3 : 2">
        <view class="report__head">
          <image class="report__img" :src="r.img" mode="aspectFill" />
          <view class="k-flex1">
            <text class="report__name">{{ r.name }}</text>
            <text class="report__meta">第35周　8.25-8.31</text>
            <view class="k-row k-gap6 report__time"><k-icon name="clock" :size="13" color="muted" /><text>{{ r.time }}更新</text></view>
          </view>
          <view class="report__right">
            <view class="stag" :class="'stag--' + r.status"><text>{{ r.statusText }}</text></view>
            <k-icon name="chevron-right" :size="16" color="muted" />
          </view>
        </view>
        <view class="stat4 stat4--boxed">
          <view v-for="(c, i) in r.cols" :key="c.label" class="stat4__cell">
            <text class="stat4__label">{{ c.label }}</text>
            <text class="stat4__value" :class="{ 'k-red': i === 0 }">{{ c.value }}</text>
          </view>
        </view>
      </view>

      <view class="alert" @click="toast('查看异常')">
        <view class="k-flex1">
          <text class="alert__title">发现 2 项异常</text>
          <view class="alert__row"><view class="alert__dot" /><text class="alert__name">西湖边 · 温馨一居室</text><text class="alert__desc">入住率较上周下降 12%</text></view>
          <view class="alert__row"><view class="alert__dot" /><text class="alert__name">花艺咖啡（兼职）</text><text class="alert__desc">好评率较上周下降 6%</text></view>
        </view>
        <k-icon name="chevron-right" :size="16" color="muted" />
      </view>
      <k-button block size="md" class="k-mt12" @click="s = 3">新建周报</k-button>
    </view>

    <!-- 2 系统自动汇总 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab summary-body">
      <view class="notice">
        <view class="k-row k-gap6"><text class="notice__text">系统已自动汇总以下数据</text><k-icon name="circle-help" :size="14" color="muted" /></view>
        <text class="k-meta">数据范围：8.25-8.31</text>
      </view>

      <view class="sec"><text class="sec__title">本周完成工作</text><text class="sec__hint">（系统识别）</text></view>
      <view class="works">
        <view v-for="w in works" :key="w.label" class="works__item">
          <k-icon :name="w.icon" :size="30" color="ink" :stroke="1.5" />
          <text class="works__label">{{ w.label }}</text>
          <text class="works__value">{{ w.value }}</text>
        </view>
      </view>

      <view class="sec">
        <view class="k-row"><text class="sec__title">门店经营数据</text><text class="sec__hint">（系统统计）</text></view>
        <view class="select"><text>西湖边 · 温馨一居室</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
      </view>
      <view class="stat4 stat4--card">
        <view v-for="c in bizCols" :key="c.label" class="stat4__cell">
          <text class="stat4__label">{{ c.label }}</text>
          <text class="stat4__value stat4__value--lg" :class="c.tone">{{ c.value }}</text>
          <text class="stat4__delta">较上周 <text :class="c.deltaTone">{{ c.delta }}</text></text>
        </view>
      </view>

      <view class="chart-card">
        <view class="k-between">
          <view class="k-row"><text class="sec__title">营收趋势</text><text class="sec__hint">（元）</text></view>
        </view>
        <view class="legend">
          <view class="legend__item"><view class="legend__line legend__line--red" /><text>本周</text></view>
          <view class="legend__item"><view class="legend__line legend__line--dash" /><text>上周</text></view>
        </view>
        <view class="chart">
          <view class="chart__y"><text v-for="y in yLabels" :key="y" class="chart__ylabel">{{ y }}</text></view>
          <view class="chart__plot">
            <view v-for="n in 5" :key="n" class="chart__grid" :style="{ top: ((n - 1) * 25) + '%' }" />
            <view v-for="(sg, i) in lastSegs" :key="'l' + i" class="seg seg--dash" :style="segStyle(sg)" />
            <view v-for="(sg, i) in thisSegs" :key="'t' + i" class="seg seg--red" :style="segStyle(sg)" />
            <view v-for="(p, i) in lastPts" :key="'lp' + i" class="dot dot--blue" :style="{ left: p.x + 'px', top: p.y + 'px' }" />
            <view v-for="(p, i) in thisPts" :key="'tp' + i" class="dot dot--red" :style="{ left: p.x + 'px', top: p.y + 'px' }" />
          </view>
        </view>
        <view class="chart__x"><text v-for="d in days" :key="d" class="chart__xlabel">{{ d }}</text></view>
      </view>

      <view class="sec"><text class="sec__title">报名与订单</text><text class="sec__hint">（系统统计）</text></view>
      <view class="k-grid-4 orders">
        <view v-for="o in orderCols" :key="o.label" class="orders__item">
          <text class="stat4__label">{{ o.label }}</text>
          <text class="stat4__value stat4__value--lg" :class="o.tone">{{ o.value }}</text>
          <text class="stat4__delta">较上周 <text :class="o.deltaTone">{{ o.delta }}</text></text>
        </view>
      </view>
      <k-button block class="k-mt16" @click="s = 3">补充本周信息</k-button>
    </view>

    <!-- 3 编辑周报 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab edit">
      <view class="saving"><k-icon name="circle-check" :size="13" color="green" /><text>自动保存中</text></view>
      <view class="store"><text class="store__name">西湖边 · 温馨一居室</text><text class="store__week">第35周（8.25-8.31）</text></view>

      <text class="sec__title sec__title--sm">员工补充说明</text>
      <view class="area">
        <textarea class="area__ta" :value="note" maxlength="300" placeholder="请补充本周工作说明" placeholder-class="k-placeholder" @input="e => note = e.detail.value" />
        <text class="area__count">{{ note.length }}/300</text>
      </view>

      <view class="k-between k-mt14"><view class="k-row"><text class="sec__title sec__title--sm">费用支出</text><text class="sec__hint">（元）</text></view><text class="total">合计：<text class="total__num">¥{{ total }}</text></text></view>
      <view class="card">
        <view v-for="(f, i) in fees" :key="f.name" class="fee">
          <text class="fee__name">{{ f.name }}</text>
          <text class="fee__amt">¥{{ f.amt }}</text>
          <view class="fee__x" @click="fees.splice(i, 1)"><k-icon name="x" :size="14" color="ink" /></view>
        </view>
        <view class="add-dash" @click="toast('添加费用')"><k-icon name="plus" :size="14" color="ink" /><text>添加费用</text></view>
      </view>

      <text class="sec__title sec__title--sm k-mt14">风险与问题</text>
      <view class="area">
        <textarea class="area__ta" :value="risk" maxlength="200" placeholder="请填写风险与问题" placeholder-class="k-placeholder" @input="e => risk = e.detail.value" />
        <text class="area__count">{{ risk.length }}/200</text>
      </view>

      <text class="sec__title sec__title--sm k-mt14">待协同事项</text>
      <view class="card">
        <view v-for="(c, i) in coop" :key="c.text" class="coop">
          <view class="k-check coop__check" :class="{ checked: c.done }" @click="c.done = !c.done"><k-icon v-if="c.done" name="check" :size="12" color="white" :stroke="3" /></view>
          <text class="coop__text">{{ c.text }}</text>
          <view class="coop__tag" :class="{ 'coop__tag--ochre': c.tone === 'ochre' }"><text>{{ c.dept }}</text></view>
          <view class="fee__x" @click="coop.splice(i, 1)"><k-icon name="x" :size="14" color="ink" /></view>
        </view>
        <view class="add-dash" @click="toast('添加待协同事项')"><k-icon name="plus" :size="14" color="ink" /><text>添加待协同事项</text></view>
      </view>

      <view class="k-row k-mt14"><text class="sec__title sec__title--sm">凭证图片</text><text class="sec__hint">（最多9张）</text></view>
      <view class="proofs">
        <image v-for="n in 5" :key="n" class="proofs__img" :src="`/static/media/weekly-proof-${n}.jpg`" mode="aspectFill" />
        <view class="proofs__add" @click="toast('添加图片')"><k-icon name="plus" :size="18" color="ink" /><text>添加</text></view>
      </view>

      <view class="btns k-mt14">
        <k-button type="secondary" size="md" class="k-flex1" @click="toast('已保存草稿')">保存草稿</k-button>
        <k-button size="md" class="btns__main" @click="s = 4">下一步：预览提交</k-button>
      </view>
    </view>

    <!-- 4 预览周报 -->
    <view v-else class="k-body k-pad-tab preview">
      <text class="lock">提交后不可修改</text>
      <view class="store"><text class="store__name">西湖边 · 温馨一居室</text><text class="store__week">第35周（8.25-8.31）</text></view>

      <view class="sec sec--tight"><text class="sec__title">一、本周完成工作</text><text class="sec__hint">（系统统计）</text></view>
      <view class="works">
        <view v-for="w in works" :key="w.label" class="works__item">
          <k-icon :name="w.icon" :size="30" color="ink" :stroke="1.5" />
          <text class="works__label">{{ w.label }}</text>
          <text class="works__value">{{ w.value }}</text>
        </view>
      </view>

      <view class="sec sec--tight"><text class="sec__title">二、经营数据总览</text></view>
      <view class="stat4 stat4--card">
        <view v-for="(c, i) in bizCols" :key="c.label" class="stat4__cell">
          <text class="stat4__label">{{ c.label }}</text>
          <text class="stat4__value stat4__value--lg" :class="{ 'k-red': i === 0 }">{{ c.value }}</text>
        </view>
      </view>

      <view class="sec sec--tight"><text class="sec__title">三、营收趋势</text><text class="sec__hint">（元）</text></view>
      <view class="legend">
        <view class="legend__item"><view class="legend__line legend__line--red" /><text>本周</text></view>
        <view class="legend__item"><view class="legend__line legend__line--dash" /><text>上周</text></view>
      </view>
      <view class="chart">
        <view class="chart__y"><text v-for="y in yLabels" :key="y" class="chart__ylabel">{{ y }}</text></view>
        <view class="chart__plot">
          <view v-for="n in 5" :key="n" class="chart__grid" :style="{ top: ((n - 1) * 25) + '%' }" />
          <view v-for="(sg, i) in lastSegs" :key="'l' + i" class="seg seg--dash" :style="segStyle(sg)" />
          <view v-for="(sg, i) in thisSegs" :key="'t' + i" class="seg seg--red" :style="segStyle(sg)" />
          <view v-for="(p, i) in lastPts" :key="'lp' + i" class="dot dot--blue" :style="{ left: p.x + 'px', top: p.y + 'px' }" />
          <view v-for="(p, i) in thisPts" :key="'tp' + i" class="dot dot--red" :style="{ left: p.x + 'px', top: p.y + 'px' }" />
        </view>
      </view>
      <view class="chart__x"><text v-for="d in days" :key="d" class="chart__xlabel">{{ d }}</text></view>

      <view class="sec sec--tight"><text class="sec__title">四、费用支出</text><text class="total">合计：<text class="total__num">¥{{ total }}</text></text></view>
      <view class="table">
        <view class="table__row table__row--head"><text class="table__c1">项目</text><text class="table__c2">金额(元)</text><text class="table__c3">说明</text></view>
        <view v-for="f in fees" :key="f.name" class="table__row"><text class="table__c1">{{ f.name }}</text><text class="table__c2">{{ f.amt }}</text><text class="table__c3">{{ f.desc }}</text></view>
      </view>

      <view class="sec sec--tight"><text class="sec__title">五、风险与问题</text></view>
      <view class="risk"><text>{{ risk }}</text></view>

      <view class="btns k-mt14">
        <view class="confirm" @click="confirmed = !confirmed">
          <view class="confirm__box" :class="{ on: confirmed }"><k-icon v-if="confirmed" name="check" :size="12" color="white" :stroke="3" /></view>
          <text>我已确认周报内容真实准确</text>
        </view>
        <k-button size="md" class="btns__main" @click="submit">确认提交</k-button>
      </view>
    </view>

    <k-tabbar mode="staff" active="business" />
  </view>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useScreen, back, toast } from '@/common/screen.js'

const s = useScreen(4)
const titles = ['代运营周报', '周报 · 自动汇总', '编辑周报', '预览周报']
const tabs = ['按周查看', '按门店查看']
const tab = ref('按周查看')
const onBack = () => { if (s.value > 1) s.value -= 1; else back() }

const reports = [
  { name: '西湖边 · 温馨一居室', img: '/static/media/weekly-room-1.jpg', time: '2026-09-01 10:30', status: 'done', statusText: '已提交',
    cols: [{ label: '总营收(元)', value: '¥5,780' }, { label: '订单(笔)', value: '24' }, { label: '入住率', value: '78%' }, { label: '好评率', value: '96%' }] },
  { name: '花艺咖啡（兼职）', img: '/static/media/weekly-room-2.jpg', time: '2026-09-01 09:15', status: 'wait', statusText: '待确认',
    cols: [{ label: '总营收(元)', value: '¥2,860' }, { label: '订单(笔)', value: '18' }, { label: '报名(人)', value: '32' }, { label: '好评率', value: '94%' }] },
  { name: '民宿前台接待', img: '/static/media/weekly-room-3.jpg', time: '2026-08-31 18:20', status: 'draft', statusText: '草稿',
    cols: [{ label: '总营收(元)', value: '¥0' }, { label: '订单(笔)', value: '0' }, { label: '报名(人)', value: '0' }, { label: '好评率', value: '—' }] }
]
const works = [
  { icon: 'house', label: '房源管理', value: '5 项' },
  { icon: 'briefcase-business', label: '岗位管理', value: '3 项' },
  { icon: 'flower', label: '活动管理', value: '2 场' },
  { icon: 'file-badge', label: '内容发布', value: '8 条' }
]
const bizCols = [
  { label: '总营收(元)', value: '¥5,780', tone: 'k-red', delta: '+8.6%', deltaTone: 'k-red' },
  { label: '订单(笔)', value: '24', tone: '', delta: '+20%', deltaTone: 'k-red' },
  { label: '入住率', value: '78%', tone: '', delta: '-2%', deltaTone: 'k-red' },
  { label: '好评率', value: '96%', tone: 'k-green', delta: '+2%', deltaTone: 'k-red' }
]
const orderCols = [
  { label: '报名人数', value: '32', tone: '', delta: '+14%', deltaTone: 'k-red' },
  { label: '订单数', value: '24', tone: '', delta: '+20%', deltaTone: 'k-red' },
  { label: '支付金额(元)', value: '¥5,780', tone: 'k-red', delta: '+8.6%', deltaTone: 'k-red' },
  { label: '客单价(元)', value: '¥241', tone: '', delta: '-9%', deltaTone: 'k-green' }
]

/* 折线图（纯 view 绘制） */
const days = ['8.25', '8.26', '8.27', '8.28', '8.29', '8.30', '8.31']
const yLabels = ['2,000', '1,500', '1,000', '500', '0']
const thisWeek = [650, 1100, 980, 1380, 1020, 1680, 1480]
const lastWeek = [450, 930, 820, 1080, 1420, 1100, 1140]
const PW = 270, PH = 140
const toPts = (arr) => arr.map((v, i) => ({ x: i * (PW / 6), y: PH - (v / 2000) * PH }))
const toSegs = (pts) => pts.slice(0, -1).map((p, i) => {
  const q = pts[i + 1]; const dx = q.x - p.x, dy = q.y - p.y
  return { x: p.x, y: p.y, len: Math.sqrt(dx * dx + dy * dy), ang: Math.atan2(dy, dx) * 180 / Math.PI }
})
const thisPts = toPts(thisWeek), lastPts = toPts(lastWeek)
const thisSegs = toSegs(thisPts), lastSegs = toSegs(lastPts)
const segStyle = (sg) => ({ left: sg.x + 'px', top: sg.y + 'px', width: sg.len + 'px', transform: `rotate(${sg.ang}deg)` })

/* 编辑 */
const note = ref('本周优化了房源详情页图片与描述，调整价格策略，周末入住率提升明显。')
const risk = ref('周一至周二有短暂降雨，影响了部分客源；周边施工导致噪音投诉 1 起。')
const fees = reactive([
  { name: '平台推广', amt: 260, desc: '抖音推广投放' },
  { name: '物料采购', amt: 180, desc: '清洁用品采购' },
  { name: '清洁维护', amt: 180, desc: '保洁工具更换' }
])
const total = computed(() => fees.reduce((a, f) => a + f.amt, 0))
const coop = reactive([
  { text: '请运营支持优化活动页面文案', dept: '产品运营', tone: 'ochre', done: false },
  { text: '请工程支持检查空调噪音问题', dept: '工程部', tone: 'neutral', done: false }
])
const confirmed = ref(true)
const submit = () => { if (!confirmed.value) return toast('请先确认周报内容'); toast('周报已提交'); s.value = 1 }
</script>

<style scoped lang="scss">
/* 页签 */
.tabs { display: flex; border-bottom: 1px solid var(--k-line); }
.tabs__item { flex: 1; position: relative; text-align: center; padding: 10px 0 12px; font-size: 15px; color: var(--k-ink); }
.tabs__item.active { color: var(--k-red); font-weight: 600; }
.tabs__item.active::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 50px; height: 2px; margin-left: -25px; background: var(--k-red); }

/* 列表 */
.filter { display: flex; align-items: center; gap: 14px; margin: 2px 0 12px; }
.pill { height: 34px; padding: 0 12px 0 14px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; gap: 6px; font-size: 14px; }
.filter__week { font-size: 14px; color: var(--k-ink); }
.report { padding: 10px 8px 8px; margin-bottom: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.report__head { display: flex; align-items: flex-start; gap: 12px; }
.report__img { width: 60px; height: 60px; border-radius: 8px; flex: 0 0 auto; }
.report__name { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 1.3; }
.report__meta { display: block; margin-top: 5px; font-size: 13px; color: var(--k-muted); line-height: 1.3; }
.report__time { margin-top: 5px; font-size: 12px; color: var(--k-muted); }
.report__right { display: flex; align-items: center; gap: 6px; padding-top: 4px; }
.stag { height: 22px; padding: 0 8px; border-radius: 5px; display: flex; align-items: center; font-size: 12px; }
.stag--done { color: var(--k-green); background: var(--k-green-soft); }
.stag--wait { color: #9A6A22; background: var(--k-ochre-soft); }
.stag--draft { color: var(--k-indigo); background: var(--k-indigo-soft); }
.stat4 { display: flex; }
.stat4--boxed { margin-top: 10px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper2); padding: 8px 0; }
.stat4--card { border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); padding: 12px 0; }
.stat4__cell { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; border-left: 1px solid var(--k-line); }
.stat4__cell:first-child { border-left: 0; }
.stat4__label { font-size: 12px; color: var(--k-muted); line-height: 1.2; }
.stat4__value { font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 17px; line-height: 1.2; }
.stat4__value--lg { font-size: 20px; margin-top: 2px; }
.stat4__delta { font-size: 11px; color: var(--k-muted); line-height: 1.2; margin-top: 2px; }
.alert { display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.alert__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; color: var(--k-red); margin-bottom: 4px; }
.alert__row { display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 1.6; }
.alert__dot { width: 4px; height: 4px; border-radius: 50%; background: var(--k-ink); flex: 0 0 auto; }
.alert__name { color: var(--k-ink); }
.alert__desc { color: var(--k-muted); }

/* 汇总 */
.notice { display: flex; align-items: center; justify-content: space-between; height: 38px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper2); }
.notice__text { font-size: 13px; color: #9A6A22; }
.sec { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 10px; }
.sec--tight { margin: 14px 0 8px; }
.sec__title { font-family: var(--k-serif); font-weight: 700; font-size: 16px; }
.sec__title--sm { display: block; font-size: 15px; }
.sec__hint { font-size: 12px; color: var(--k-muted); margin-left: 2px; }
.works { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.works__item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 0; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.works__label { font-size: 13px; }
.works__value { font-size: 15px; font-weight: 700; }
.select { height: 30px; padding: 0 10px; border: 1px solid var(--k-line2); border-radius: 6px; background: var(--k-paper); display: flex; align-items: center; gap: 6px; font-size: 13px; }
.chart-card { margin-top: 12px; padding: 12px 14px 8px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.legend { display: flex; justify-content: flex-end; gap: 14px; margin: 4px 6px 6px 0; font-size: 12px; color: var(--k-muted); }
.legend__item { display: flex; align-items: center; gap: 5px; }
.legend__line { width: 18px; height: 0; border-top: 2px solid var(--k-red); }
.legend__line--dash { border-top: 2px dashed var(--k-indigo); }
.chart { display: flex; align-items: stretch; gap: 8px; }
.chart__y { width: 34px; height: 140px; display: flex; flex-direction: column; justify-content: space-between; text-align: right; }
.chart__ylabel { font-size: 11px; color: var(--k-muted); line-height: 1; transform: translateY(-1px); }
.chart__plot { position: relative; width: 270px; height: 140px; margin-right: 8px; border-left: 1px solid var(--k-line); border-bottom: 1px solid var(--k-line); }
.chart__grid { position: absolute; left: 0; right: 0; height: 1px; background: var(--k-line); opacity: .6; }
.seg { position: absolute; height: 0; transform-origin: 0 0; }
.seg--red { border-top: 2px solid var(--k-red); }
.seg--dash { border-top: 2px dashed var(--k-indigo); }
.dot { position: absolute; width: 7px; height: 7px; border-radius: 50%; margin: -3.5px 0 0 -3.5px; border: 1.5px solid; background: var(--k-paper); }
.dot--red { border-color: var(--k-red); background: var(--k-red); }
.dot--blue { border-color: var(--k-indigo); }
.chart__x { display: flex; justify-content: space-between; padding: 6px 4px 0 34px; font-size: 11px; color: var(--k-muted); }
.chart__xlabel { width: 28px; text-align: center; }
.orders { gap: 8px; }
.orders__item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 0; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }

/* 编辑 */
.saving { display: flex; align-items: center; justify-content: flex-end; gap: 4px; font-size: 12px; color: var(--k-green); margin: -8px 0 4px; }
.store { display: flex; align-items: center; gap: 14px; height: 38px; padding: 0 10px; border-bottom: 1px solid var(--k-line); margin-bottom: 10px; }
.store__name { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.store__week { font-size: 12px; color: var(--k-muted); }
.area { position: relative; margin-top: 8px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); padding: 10px 12px 24px; }
.area__ta { width: 100%; height: 44px; font-size: 14px; line-height: 1.6; color: var(--k-ink); }
.area__count { position: absolute; right: 12px; bottom: 6px; font-size: 12px; color: var(--k-muted); }
.k-mt14 { margin-top: 14px; }
.total { font-size: 13px; color: var(--k-ink); }
.total__num { font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 15px; }
.card { margin-top: 8px; padding: 0 8px 8px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.fee { display: flex; align-items: center; height: 38px; padding: 0 2px; border-bottom: 1px solid var(--k-line); }
.fee__name { flex: 1; font-size: 14px; }
.fee__amt { font-family: Georgia, "Times New Roman", serif; font-weight: 700; font-size: 16px; margin-right: 12px; }
.fee__x { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
.add-dash { margin-top: 8px; height: 32px; border: 1px dashed var(--k-line2); border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; color: var(--k-ink); }
.coop { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 2px; border-bottom: 1px solid var(--k-line); }
.coop__check { width: 16px; height: 16px; border-radius: 3px; }
.coop__text { flex: 1; font-size: 13px; }
.coop__tag { height: 22px; padding: 0 10px; border-radius: 5px; background: var(--k-paper2); display: flex; align-items: center; font-size: 12px; color: var(--k-muted); }
.coop__tag--ochre { color: #9A6A22; background: var(--k-ochre-soft); }
.proofs { display: flex; gap: 7px; margin-top: 8px; }
.proofs__img { width: 48px; height: 48px; border-radius: 6px; flex: 0 0 auto; }
.proofs__add { width: 48px; height: 48px; border: 1px dashed var(--k-line2); border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; color: var(--k-ink); }
.btns { display: flex; align-items: center; gap: 10px; }
.btns__main { flex: 1.25; }

/* 预览 */
.lock { display: block; text-align: right; font-size: 12px; color: #9A6A22; margin: -8px 0 4px; }
.table { border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); overflow: hidden; }
.table__row { display: flex; align-items: center; height: 30px; padding: 0 10px; font-size: 13px; border-top: 1px solid var(--k-line); }
.table__row--head { border-top: 0; background: var(--k-paper2); color: var(--k-muted); font-size: 12px; }
.table__c1 { width: 32%; }
.table__c2 { width: 30%; text-align: center; }
.table__c3 { flex: 1; text-align: center; }
.risk { padding: 8px 10px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); font-size: 12px; line-height: 1.6; }
.confirm { flex: 1; display: flex; align-items: center; gap: 6px; font-size: 13px; }
.confirm__box { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.confirm__box.on { border-color: var(--k-red); background: var(--k-red); }

/* 390×844 首屏密度：四种状态分别贴合设计稿，不让内容被员工底栏遮挡 */
.list-body .filter { margin-bottom: 8px; }
.list-body .report { padding-top: 7px; padding-bottom: 6px; margin-bottom: 8px; }
.list-body .report__meta,
.list-body .report__time { margin-top: 2px; }
.list-body .stat4--boxed { margin-top: 6px; padding: 5px 0; }
.list-body .stat4__cell { gap: 3px; }
.list-body .alert { padding-top: 7px; padding-bottom: 7px; }
.list-body .k-mt12 { margin-top: 8px; }

.summary-body .sec { margin: 12px 0 8px; }
.summary-body .works__item { gap: 3px; padding: 7px 0; }
.summary-body .stat4--card { padding: 8px 0; }
.summary-body .stat4__cell,
.summary-body .orders__item { gap: 3px; }
.summary-body .chart-card { margin-top: 8px; padding: 8px 10px 4px; }
.summary-body .legend { margin-top: 0; margin-bottom: 2px; }
.summary-body .chart { height: 112px; overflow: hidden; }
.summary-body .chart__y,
.summary-body .chart__plot { transform: scaleY(.78); transform-origin: top; }
.summary-body .chart__x { padding-top: 2px; }
.summary-body .orders__item { padding: 8px 0; }
.summary-body .k-mt16 { display: none; }

.edit .saving { margin-bottom: 1px; }
.edit .store { height: 30px; margin-bottom: 7px; }
.edit .area { margin-top: 5px; padding: 6px 10px 16px; }
.edit .area__ta { height: 34px; line-height: 1.45; }
.edit .area__count { right: 9px; bottom: 3px; }
.edit .k-mt14 { margin-top: 8px; }
.edit .card { margin-top: 5px; padding-bottom: 5px; }
.edit .fee { height: 30px; }
.edit .coop { height: 32px; }
.edit .add-dash { height: 27px; margin-top: 5px; }
.edit .proofs { margin-top: 5px; }
.edit .proofs__img,
.edit .proofs__add { width: 45px; height: 45px; }
.edit .btns { transform: translateY(-9px); }

.preview .store { height: 30px; margin-bottom: 5px; }
.preview .sec--tight { margin: 5px 0 3px; }
.preview .works__item { gap: 1px; padding: 2px 0; }
.preview .stat4--card { padding: 4px 0; }
.preview .stat4__cell { gap: 3px; }
.preview .legend { margin: 0 4px 2px 0; }
.preview .chart { height: 100px; overflow: hidden; }
.preview .chart__y,
.preview .chart__plot { transform: scaleY(.7); transform-origin: top; }
.preview .chart__x { padding-top: 2px; }
.preview .table__row { height: 22px; }
.preview .risk { padding-top: 6px; padding-bottom: 6px; }
.preview .k-mt14 { margin-top: 8px; }
.preview .btns { transform: translateY(-9px); }
</style>
