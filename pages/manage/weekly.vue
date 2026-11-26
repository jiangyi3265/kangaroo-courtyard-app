<template>
  <view class="k-page weekly">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack">
      <view v-if="s === 1" class="tabs">
        <view v-for="t in tabs" :key="t" class="tabs__item" :class="{ active: tab === t }" @click="tab = t"><text>{{ t }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 周报列表 -->
    <view v-if="s === 1" class="k-body k-pad-tab list-body">
      <view class="filter">
        <view class="pill" @click="pickStore"><text>{{ storeFilterName }}</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
        <view class="k-row k-gap4" @click="pickWeek"><text class="filter__week">{{ wl.weekLabel || '' }}</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
      </view>

      <view v-for="r in reports" :key="r.storeId + '-' + r.weekStart" class="report" @click="openCard(r)">
        <view class="report__head">
          <image class="report__img" :src="r.img" mode="aspectFill" />
          <view class="k-flex1">
            <text class="report__name">{{ r.name }}</text>
            <text class="report__meta">{{ r.weekText }}</text>
            <view class="k-row k-gap6 report__time"><k-icon name="clock" :size="13" color="muted" /><text>{{ r.time }}{{ r.reportId ? '更新' : '' }}</text></view>
          </view>
          <view class="report__right">
            <view class="stag" :class="'stag--' + r.tone"><text>{{ r.statusText }}</text></view>
            <k-icon name="chevron-right" :size="16" color="muted" />
          </view>
        </view>
        <view class="stat4 stat4--boxed">
          <view v-for="(c, i) in r.cols" :key="c.label" class="stat4__cell">
            <text class="stat4__label">{{ c.label }}</text>
            <text class="stat4__value" :class="{ 'k-red': i === 0 }">{{ c.value }}</text>
          </view>
        </view>
        <!-- 招募周报按门店：有换工主理人授权的店才有钱数 -->
        <view v-if="r.shop" class="report__money">
          <template v-if="r.money"><text>本周收入 {{ r.money.income }}</text><text>本周支出 {{ r.money.expense }}</text></template>
          <text v-else class="k-muted">收支：你没有这家店的权限</text>
        </view>
      </view>
      <text v-if="wl.shopMode && !reports.length" class="preview-empty">本城还没有换工店家</text>

      <view v-if="anomalies.length" class="alert" @click="openAnomaly">
        <view class="k-flex1">
          <text class="alert__title">发现 {{ anomalies.length }} 项异常</text>
          <view v-for="(a, ai) in anomalies" :key="ai" class="alert__row"><view class="alert__dot" /><text class="alert__name">{{ a.name }}</text><text class="alert__desc">{{ a.desc }}</text></view>
          <view v-if="false" class="alert__row"><view class="alert__dot" /><text class="alert__name">花艺咖啡（兼职）</text><text class="alert__desc">好评率较上周下降 6%</text></view>
        </view>
        <k-icon name="chevron-right" :size="16" color="muted" />
      </view>
      <k-button block size="md" class="k-mt12" @click="newReport" label="新建周报" />
    </view>

    <!-- 2 系统自动汇总 -->
    <view v-else-if="s === 2" class="k-body k-pad-tab summary-body">
      <view class="notice">
        <view class="k-row k-gap6"><text class="notice__text">系统已自动汇总以下数据</text><k-icon name="circle-help" :size="14" color="muted" @click="explain" /></view>
        <text class="k-meta">数据范围：{{ snap.range }}</text>
      </view>

      <view class="sec"><text class="sec__title">{{ isRecruit ? '本周招募情况' : '本周完成工作' }}</text><text class="sec__hint">{{ isRecruit ? '（系统统计）' : '（系统识别）' }}</text></view>
      <view class="works">
        <view v-for="w in works" :key="w.label" class="works__item">
          <k-icon :name="w.icon" :size="30" color="ink" :stroke="1.5" />
          <text class="works__label">{{ w.label }}</text>
          <text class="works__value">{{ w.value }}</text>
        </view>
      </view>

      <view class="sec">
        <view class="k-row"><text class="sec__title">{{ isRecruit ? '招募与收支' : '门店经营数据' }}</text><text class="sec__hint">（系统统计）</text></view>
        <view class="select" @click="pickSummaryStore"><text>{{ rep.storeName || snap.storeName }}</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
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
          <view class="k-row"><text class="sec__title">{{ isRecruit ? '收入趋势' : '营收趋势' }}</text><text class="sec__hint">（元）</text></view>
        </view>
        <view class="legend">
          <view class="legend__item"><view class="legend__line legend__line--red" /><text>本周</text></view>
          <view class="legend__item"><view class="legend__line legend__line--dash" /><text>上周</text></view>
        </view>
        <view class="chart">
          <view class="chart__y"><text v-for="y in yLabels" :key="y" class="chart__ylabel">{{ y }}</text></view>
          <view class="chart__plot" :style="{ width: PW + 'px' }">
            <view v-for="n in 5" :key="n" class="chart__grid" :style="{ top: ((n - 1) * 25) + '%' }" />
            <view v-for="(sg, i) in lastSegs" :key="'l' + i" class="seg seg--dash" :style="segStyle(sg)" />
            <view v-for="(sg, i) in thisSegs" :key="'t' + i" class="seg seg--red" :style="segStyle(sg)" />
            <view v-for="(p, i) in lastPts" :key="'lp' + i" class="dot dot--blue" :style="{ left: p.x + 'px', top: p.y + 'px' }" />
            <view v-for="(p, i) in thisPts" :key="'tp' + i" class="dot dot--red" :style="{ left: p.x + 'px', top: p.y + 'px' }" />
          </view>
        </view>
        <view class="chart__x" :style="{ width: (PW + 28) + 'px' }"><text v-for="(d, i) in days" :key="i" class="chart__xlabel">{{ d }}</text></view>
      </view>

      <template v-if="isRecruit">
        <view class="sec"><text class="sec__title">各换工店家情况</text><text class="sec__hint">（系统统计）</text></view>
        <view v-for="sp in shops" :key="sp.storeId" class="shop">
          <text class="shop__name">{{ sp.name }}</text>
          <view class="shop__nums"><text>招募 {{ sp.recruited || 0 }}</text><text>到岗 {{ sp.onboarded || 0 }}</text><text>缺口 {{ sp.shortfall || 0 }}</text><text>一周内离开 {{ sp.leaving || 0 }}</text></view>
          <text class="shop__money">{{ sp.canSeeMoney ? '收入 ' + sp.income + ' · 支出 ' + sp.expense : '收支：你没有这家店的权限' }}</text>
        </view>
        <text v-if="!shops.length" class="preview-empty">本城还没有换工店家</text>
      </template>
      <template v-else>
      <view class="sec"><text class="sec__title">报名与订单</text><text class="sec__hint">（系统统计）</text></view>
      <view class="k-grid-4 orders">
        <view v-for="o in orderCols" :key="o.label" class="orders__item">
          <text class="stat4__label">{{ o.label }}</text>
          <text class="stat4__value stat4__value--lg" :class="o.tone">{{ o.value }}</text>
          <text class="stat4__delta">较上周 <text :class="o.deltaTone">{{ o.delta }}</text></text>
        </view>
      </view>
      </template>
      <k-button block class="k-mt16" :style="showMore" @click="openFromSummary" label="补充本周信息" />
    </view>

    <!-- 3 编辑周报 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab edit">
      <view class="saving"><k-icon name="circle-check" :size="13" color="green" /><text>{{ saveHint }}</text></view>
      <view class="store"><text class="store__name">{{ rep.storeName }}</text><text class="store__week">{{ rep.weekText }}</text></view>
      <!-- 点「周报被退回」消息进来落在编辑页：之前退回原因只在预览页顶部，改的时候看不到要改什么 -->
      <text v-if="rep.status === 'returned'" class="returned">已被退回：{{ rep.returnReason || '—' }}</text>

      <text class="sec__title sec__title--sm">员工补充说明</text>
      <!-- 小程序里 textarea 盖在页面最上层，压在底部导航下面时点导航会点进输入框：只在编辑时才放真输入框，平时用一样大的 view 显示文字 -->
      <view class="area">
        <textarea v-if="editingNote" class="area__ta" :value="note" :disabled="readOnly" maxlength="300" placeholder="请补充本周工作说明" placeholder-class="k-placeholder" :focus="true" auto-focus @input="e => note = e.detail.value" @blur="e => { note = e.detail.value; editingNote = false }" />
        <view v-else class="area__ta weekly-area-idle" @click="!readOnly && (editingNote = true)"><text :class="{ 'k-placeholder': !note }">{{ note || '请补充本周工作说明' }}</text></view>
        <text class="area__count">{{ note.length }}/300</text>
      </view>

      <template v-if="showFees">
      <view class="k-between k-mt14"><view class="k-row"><text class="sec__title sec__title--sm">费用支出</text><text class="sec__hint">（元）</text></view><text class="total">合计：<text class="total__num">¥{{ total }}</text></text></view>
      <view class="card">
        <view v-for="(f, i) in fees" :key="i" class="fee">
          <text class="fee__name">{{ f.name }}</text>
          <text class="fee__amt">¥{{ f.amt }}</text>
          <view v-if="!readOnly" class="fee__x" @click="fees.splice(i, 1)"><k-icon name="x" :size="14" color="ink" /></view>
        </view>
        <view v-if="!readOnly && !isRecruit" class="add-dash" @click="addFee"><k-icon name="plus" :size="14" color="ink" /><text>添加费用</text></view>
      </view>
      </template>

      <text class="sec__title sec__title--sm k-mt14">风险与问题</text>
      <view class="area">
        <textarea v-if="editingRisk" class="area__ta" :value="risk" :disabled="readOnly" maxlength="200" placeholder="请填写风险与问题" placeholder-class="k-placeholder" :focus="true" auto-focus @input="e => risk = e.detail.value" @blur="e => { risk = e.detail.value; editingRisk = false }" />
        <view v-else class="area__ta weekly-area-idle" @click="!readOnly && (editingRisk = true)"><text :class="{ 'k-placeholder': !risk }">{{ risk || '请填写风险与问题' }}</text></view>
        <text class="area__count">{{ risk.length }}/200</text>
      </view>

      <text class="sec__title sec__title--sm k-mt14">待协同事项</text>
      <view class="card">
        <view v-for="(c, i) in coop" :key="i" class="coop">
          <view class="k-check coop__check" :class="{ checked: c.done }" @click="toggleCoop(c)"><k-icon v-if="c.done" name="check" :size="12" color="white" :stroke="3" /></view>
          <text class="coop__text">{{ c.text }}</text>
          <view class="coop__tag" :class="{ 'coop__tag--ochre': c.tone === 'ochre' }"><text>{{ c.dept }}</text></view>
          <view v-if="!readOnly" class="fee__x" @click="coop.splice(i, 1)"><k-icon name="x" :size="14" color="ink" /></view>
        </view>
        <view v-if="!readOnly" class="add-dash" @click="addCoop"><k-icon name="plus" :size="14" color="ink" /><text>添加待协同事项</text></view>
      </view>

      <view class="k-row k-mt14"><text class="sec__title sec__title--sm">凭证图片</text><text class="sec__hint">（最多9张）</text></view>
      <view class="proofs">
        <image v-for="(p, pi) in proofs" :key="p" class="proofs__img" :src="absUrl(p)" mode="aspectFill" @click="previewProof(pi)" @longpress="removeProof(pi)" />
        <view v-if="proofs.length < 9 && !readOnly" class="proofs__add" @click="addProof"><k-icon name="plus" :size="18" color="ink" /><text>添加</text></view>
      </view>

      <view class="btns k-mt14">
        <k-button type="secondary" size="md" class="k-flex1" :disabled="readOnly" @click="saveDraft(true)" label="保存草稿" />
        <k-button size="md" class="btns__main" @click="toPreview" label="下一步：预览提交" />
      </view>
    </view>

    <!-- 4 预览周报 -->
    <view v-else class="k-body k-pad-tab preview">
      <text class="lock">{{ lockText }}</text>
      <view class="store"><text class="store__name">{{ rep.storeName }}</text><text class="store__week">{{ rep.weekText }}</text></view>

      <view class="sec sec--tight"><text class="sec__title">{{ secNo('works') }}{{ isRecruit ? '本周招募情况' : '本周完成工作' }}</text><text class="sec__hint">（系统统计）</text></view>
      <view class="works">
        <view v-for="w in works" :key="w.label" class="works__item">
          <k-icon :name="w.icon" :size="30" color="ink" :stroke="1.5" />
          <text class="works__label">{{ w.label }}</text>
          <text class="works__value">{{ w.value }}</text>
        </view>
      </view>

      <view class="sec sec--tight"><text class="sec__title">{{ secNo('biz') }}{{ isRecruit ? '招募与收支总览' : '经营数据总览' }}</text></view>
      <view class="stat4 stat4--card">
        <view v-for="(c, i) in bizCols" :key="c.label" class="stat4__cell">
          <text class="stat4__label">{{ c.label }}</text>
          <text class="stat4__value stat4__value--lg" :class="{ 'k-red': i === 0 }">{{ c.value }}</text>
        </view>
      </view>

      <view class="sec sec--tight"><text class="sec__title">{{ secNo('trend') }}{{ isRecruit ? '收入趋势' : '营收趋势' }}</text><text class="sec__hint">（元）</text></view>
      <!-- 2026-11-17 改版：预览里的折线图也放进白卡（只加了这一层包裹，图本身没动） -->
      <view class="chart-card chart-card--preview">
      <view class="legend">
        <view class="legend__item"><view class="legend__line legend__line--red" /><text>本周</text></view>
        <view class="legend__item"><view class="legend__line legend__line--dash" /><text>上周</text></view>
      </view>
      <view class="chart">
        <view class="chart__y"><text v-for="y in yLabels" :key="y" class="chart__ylabel">{{ y }}</text></view>
        <view class="chart__plot" :style="{ width: PW + 'px' }">
          <view v-for="n in 5" :key="n" class="chart__grid" :style="{ top: ((n - 1) * 25) + '%' }" />
          <view v-for="(sg, i) in lastSegs" :key="'l' + i" class="seg seg--dash" :style="segStyle(sg)" />
          <view v-for="(sg, i) in thisSegs" :key="'t' + i" class="seg seg--red" :style="segStyle(sg)" />
          <view v-for="(p, i) in lastPts" :key="'lp' + i" class="dot dot--blue" :style="{ left: p.x + 'px', top: p.y + 'px' }" />
          <view v-for="(p, i) in thisPts" :key="'tp' + i" class="dot dot--red" :style="{ left: p.x + 'px', top: p.y + 'px' }" />
        </view>
      </view>
      <view class="chart__x" :style="{ width: (PW + 28) + 'px' }"><text v-for="(d, i) in days" :key="i" class="chart__xlabel">{{ d }}</text></view>
      </view>

      <template v-if="isRecruit">
        <view class="sec sec--tight"><text class="sec__title">{{ secNo('shops') }}各换工店家情况</text></view>
        <view v-for="sp in shops" :key="sp.storeId" class="shop">
          <text class="shop__name">{{ sp.name }}</text>
          <view class="shop__nums"><text>招募 {{ sp.recruited || 0 }}</text><text>到岗 {{ sp.onboarded || 0 }}</text><text>缺口 {{ sp.shortfall || 0 }}</text><text>一周内离开 {{ sp.leaving || 0 }}</text></view>
          <text class="shop__money">{{ sp.canSeeMoney ? '收入 ' + sp.income + ' · 支出 ' + sp.expense : '收支：你没有这家店的权限' }}</text>
        </view>
        <view v-if="!shops.length" class="risk"><text>（本城还没有换工店家）</text></view>
      </template>

      <template v-if="showFees">
      <view class="sec sec--tight"><text class="sec__title">{{ secNo('fees') }}费用支出</text><text class="total">合计：<text class="total__num">¥{{ total }}</text></text></view>
      <view class="table">
        <view class="table__row table__row--head"><text class="table__c1">项目</text><text class="table__c2">金额(元)</text><text class="table__c3">说明</text></view>
        <view v-for="(f, fi) in fees" :key="fi" class="table__row"><text class="table__c1">{{ f.name }}</text><text class="table__c2">{{ f.amt }}</text><text class="table__c3">{{ f.desc }}</text></view>
      </view>
      </template>

      <view class="sec sec--tight"><text class="sec__title">{{ secNo('risk') }}风险与问题</text></view>
      <view class="risk"><text>{{ risk || '（未填写）' }}</text></view>

      <!-- 之前预览里没有这三段：提交人确认的不是完整周报，其他主理人 / 管家从「周报已提交」消息打开也看不到 -->
      <view class="sec sec--tight"><text class="sec__title">{{ secNo('note') }}员工补充说明</text></view>
      <view class="risk"><text class="k-pre">{{ note || '（未填写）' }}</text></view>

      <view class="sec sec--tight"><text class="sec__title">{{ secNo('coop') }}待协同事项</text></view>
      <view class="card">
        <view v-for="(c, ci) in coop" :key="ci" class="coop">
          <view class="k-check coop__check" :class="{ checked: c.done }"><k-icon v-if="c.done" name="check" :size="12" color="white" :stroke="3" /></view>
          <text class="coop__text">{{ c.text }}</text>
          <view class="coop__tag" :class="{ 'coop__tag--ochre': c.tone === 'ochre' }"><text>{{ c.dept }}</text></view>
        </view>
        <text v-if="!coop.length" class="preview-empty">（没有待协同事项）</text>
      </view>

      <view class="sec sec--tight"><text class="sec__title">{{ secNo('proofs') }}凭证图片</text></view>
      <view v-if="proofs.length" class="proofs">
        <image v-for="(p, pi) in proofs" :key="p" class="proofs__img" :src="absUrl(p)" mode="aspectFill" @click="previewProof(pi)" />
      </view>
      <view v-else class="risk"><text>（没有凭证图片）</text></view>

      <view v-if="rep.status !== 'submitted'" class="btns k-mt14">
        <view class="confirm" @click="confirmed = !confirmed">
          <view class="confirm__box" :class="{ on: confirmed }"><k-icon v-if="confirmed" name="check" :size="12" color="white" :stroke="3" /></view>
          <text>我已确认周报内容真实准确</text>
        </view>
        <k-button size="md" class="btns__main" @click="submit" label="确认提交" />
      </view>
    </view>

    <k-tabbar mode="staff" active="business" />
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 代运营周报接入情况（主理人 / 管家）：
//   s=1 周报列表：按周（我的每家门店一张卡）/ 按门店（最近 6 周）；异常 = 本周较上周营收降 ≥20% 或入住率、好评率降 ≥5 个百分点
//   s=2 系统自动汇总：房源 / 岗位操作次数、举办活动、同步 Vlog；营收、订单、入住率、好评率与 7 天营收趋势，全部按真实订单与评价统计
//   s=3 编辑周报：补充说明、费用、风险、待协同、凭证图片，停顿 1.5 秒自动保存（带版本号，别处改过会提示刷新）
//   s=4 预览提交：提交时冻结系统汇总，之后不可修改（后台可退回）
// 换工主理人（当前门店角色 manager）看到的是「换工招募情况周报」，服务端 reportType=recruit、标题也由服务端给：
//   全城一份，本周招募、到岗、本周收入、本周支出；按门店 = 本城每家换工店家一张卡；有授权的店才有钱数
// ---------------------------------------------------------------------------
import { ref, reactive, computed, watch } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiWeekly, apiWeeklyOpen, apiWeeklyDetail, apiWeeklySummary, apiWeeklySave, apiWeeklySubmit } from '@/common/api.js'
import { ensureSession, staffStoreUrl } from '@/common/experience.js'
import { sheet, prompt, alert, confirm, pickPaged, errText, fmtNum } from '@/common/ui.js'
import { absUrl, uploadTo, chooseImages } from '@/common/upload.js'
import R from '@/common/routes.js'
import { setReportAs } from '@/common/request.js'
import { onShow as onPageShow, onUnload as onPageUnload } from '@dcloudio/uni-app'
// 城市负责人的招募日报、招募周报（?as=recruit）：这一页的请求都带上，离开时清掉
let reportAs = ''
onPageShow(() => setReportAs(reportAs))
onPageUnload(() => setReportAs(''))

const sameStore = (a, b) => a != null && a !== '' && b != null && String(a) === String(b)
let booting = true
const s = useScreen(4, {
  onLoad: async (q) => {
    reportAs = q?.as === 'recruit' ? 'recruit' : ''
    setReportAs(reportAs)
    await ensureSession()
    if (Number(q?.reportId)) {
      await openReport(Number(q.reportId))
      // 消息里的周报打不开（已无该店权限、周报不存在）时停在第 1 屏：之前列表从没加载，只剩一个空页面
      if (s.value === 1) await loadList()
    } else {
      // 从业务中心进来会带上员工端当前门店：列表、汇总和新写的周报都落在这家门店上
      if (q?.storeId) await scopeToStore(q.storeId)
      else await loadList()
      if (s.value === 2 || s.value === 4) await loadSummary(storeFilter.value, null)
      if (s.value === 3) await newReport()
    }
    booting = false
  }
})
const titles = computed(() => [wl.value.title || '代运营周报', '周报 · 自动汇总', '编辑周报', '预览周报'])
const tabs = ['按周查看', '按门店查看']
const tab = ref('按周查看')
const onBack = () => {
  // 已提交的周报只能看预览：从预览返回直接回列表，不再落到编辑页（以前会进到一个能打字、却不会保存的编辑页）
  if (s.value === 4 && rep.status === 'submitted') s.value = 1
  else if (s.value > 1) {
    // 离开编辑页时还有没存的改动就立刻存一次，不等 1.5 秒的自动保存（之后在汇总页换门店会把当前周报换掉）
    if (s.value === 3 && dirty) saveDraft(false)
    s.value -= 1
  }
  else back()
}
watch(tab, () => loadList())
watch(s, (v) => { if (!booting && v === 1) loadList() })

// ---------------- s=1 ----------------
const wl = ref({ cards: [], anomalies: [], stores: [], weeks: [] })
const storeFilter = ref(null)
const weekStart = ref('')
async function loadList() {
  try {
    const store = tab.value === '按门店查看' ? (storeFilter.value || (wl.value.stores[0] || {}).storeId) : storeFilter.value
    wl.value = (await apiWeekly({ mode: tab.value === '按门店查看' ? 'store' : 'week', storeId: store || undefined, weekStart: weekStart.value || undefined })).data || wl.value
  } catch (e) {
    toast(errText(e, '周报加载失败'))
  }
}
// 指定门店不在本人的主理 / 管家门店里时（例如在该店只是普通员工）退回全部门店，不显示一张空列表
async function scopeToStore(id) {
  storeFilter.value = id
  await loadList()
  const hit = (wl.value.stores || []).find(x => sameStore(x.storeId, id))
  storeFilter.value = hit ? hit.storeId : null
  if (!hit) await loadList()
}
const storeFilterName = computed(() => {
  const st = (wl.value.stores || []).find(x => sameStore(x.storeId, storeFilter.value))
  return st ? st.storeName : (tab.value === '按门店查看' ? ((wl.value.stores || [])[0] || {}).storeName || '门店' : '全部门店')
})
const reports = computed(() => (wl.value.cards || []).map(c => ({ ...c, img: c.cover ? absUrl(c.cover) : '/static/media/cover-empty.png', time: c.reportId ? c.time : '系统实时汇总' })))
const anomalies = computed(() => (wl.value.anomalies || []).slice(0, 3))
async function pickStore() {
  const list = wl.value.stores || []
  const opts = tab.value === '按门店查看' ? list.map(x => x.storeName) : ['全部门店', ...list.map(x => x.storeName)]
  const i = await pickPaged(opts, '选择门店')
  if (i < 0) return
  storeFilter.value = tab.value === '按门店查看' ? list[i].storeId : (i === 0 ? null : list[i - 1].storeId)
  loadList()
}
async function pickWeek() {
  const weeks = wl.value.weeks || []
  const i = await pickPaged(weeks.map(w => w.label), '选择周')
  if (i < 0) return
  weekStart.value = weeks[i].start
  // 招募周报按门店看的就是选中那一周，不用跳回按周
  if (tab.value !== '按周查看' && !wl.value.shopMode) tab.value = '按周查看'
  else loadList()
}
async function openCard(r) {
  if (r.reportId) return openReport(r.reportId)
  await loadSummary(r.storeId, r.weekStart)
  s.value = 2
}
const openAnomaly = () => go(staffStoreUrl(R.dashboard + '?view=trend', storeFilter.value))
async function newReport() {
  const list = wl.value.stores || []
  if (!list.length) return toast('仅门店换工主理人或小院主理人可以写周报')
  // 已选定门店（含业务中心带来的当前门店）就直接写这家，不再让人从全部门店里挑
  const scoped = list.find(x => sameStore(x.storeId, storeFilter.value))
  let st = scoped || list[0]
  if (!scoped && list.length > 1) {
    const i = await pickPaged(list.map(x => x.storeName), '选择门店')
    if (i < 0) return
    st = list[i]
  }
  try {
    applyReport((await apiWeeklyOpen({ storeId: st.storeId, weekStart: wl.value.weekStart })).data)
    s.value = rep.status === 'submitted' ? 4 : 3
  } catch (e) {
    toast(errText(e, '打开周报失败'))
  }
}

// ---------------- 周报数据 ----------------
const rep = reactive({ reportId: 0, storeId: 0, storeName: '', weekStart: '', weekText: '', status: '', version: 0, returnReason: '', submittedBy: '', submittedTime: '', reportType: '' })
const snap = ref({ works: [], bizCols: [], orderCols: [], days: [], thisWeek: [], lastWeek: [] })
const note = ref('')
const risk = ref('')
// 正在打字的那个输入框：只有它渲染成真 textarea，其余时候是 view（防止盖住底部导航）
const editingNote = ref(false)
const editingRisk = ref(false)
// 离开编辑页时输入框可能来不及触发 blur：回来时别自动弹出键盘
watch(s, () => { editingNote.value = false; editingRisk.value = false })
const fees = reactive([])
const coop = reactive([])
const proofs = ref([])
let applying = false
function applyReport(d) {
  applying = true
  Object.assign(rep, { reportId: d.reportId, storeId: d.storeId, storeName: d.storeName, weekStart: d.weekStart, weekText: d.weekText, status: d.status,
    version: d.version, returnReason: d.returnReason || '', submittedBy: d.submittedBy || '', submittedTime: d.submittedTime || '', reportType: d.reportType || 'ops' })
  snap.value = { ...d.snapshot, storeName: d.storeName }
  note.value = d.note || ''
  risk.value = d.risk || ''
  fees.splice(0, fees.length, ...(d.fees || []).map(f => ({ name: f.name, amt: f.amountFen / 100, desc: f.remark || '', amountFen: f.amountFen })))
  coop.splice(0, coop.length, ...(d.coops || []).map(c => ({ text: c.text, dept: c.dept, done: !!c.done, tone: c.dept === '产品运营' ? 'ochre' : 'neutral' })))
  proofs.value = [...(d.proofs || [])]
  // 已提交的周报在编辑页是只读的，提示照实写，不再显示一个"已保存 xx:xx"让人以为改动会被保存
  saveHint.value = d.status === 'submitted' ? '已提交，不能再修改' : (d.updated ? `已保存 ${d.updated}` : '已保存')
  dirty = false
  setTimeout(() => { applying = false }, 0)
}
async function openReport(id) {
  try {
    applyReport((await apiWeeklyDetail(id)).data)
    s.value = rep.status === 'submitted' ? 4 : 3
  } catch (e) {
    toast(errText(e, '周报不存在'))
    s.value = 1
  }
}
async function loadSummary(storeId, week) {
  try {
    const d = (await apiWeeklySummary({ storeId: storeId || undefined, weekStart: week || undefined })).data
    snap.value = d
    Object.assign(rep, { reportId: 0, storeId: d.storeId, storeName: d.storeName, weekStart: d.weekStart, reportType: d.reportType || 'ops' })
  } catch (e) {
    toast(errText(e, '汇总加载失败'))
  }
}
// 汇总页的门店框：在本人能写周报的门店（列表页门店筛选用的同一份 wl.stores）之间切换，周次保持不变
async function pickSummaryStore() {
  // 从消息直接打开周报时列表还没加载过，门店清单是空的：之前这里会误报「仅门店主理人或管家可以写周报」
  if (!(wl.value.stores || []).length) await loadList()
  const list = wl.value.stores || []
  if (list.length < 2) return toast(list.length ? '你只有这一家门店可以写周报' : '仅门店换工主理人或小院主理人可以写周报')
  const i = await pickPaged(list.map(x => x.storeName), '选择门店')
  if (i < 0 || sameStore(list[i].storeId, rep.storeId)) return
  await loadSummary(list[i].storeId, rep.weekStart || null)
}
async function openFromSummary() {
  try {
    applyReport((await apiWeeklyOpen({ storeId: rep.storeId, weekStart: rep.weekStart })).data)
    s.value = rep.status === 'submitted' ? 4 : 3
  } catch (e) {
    toast(errText(e, '打开周报失败'))
  }
}
const explain = () => alert('汇总口径', isRecruit.value ? (snap.value.note || '') : (snap.value.note || '') + '\n房源管理 = 本周房源 / 房型的新建、编辑、提交次数；岗位管理 = 本周新建、发布、关闭的岗位数；活动管理 = 本周开始的活动场次；内容发布 = 本周同步的 Vlog 条数。')

const isRecruit = computed(() => rep.reportType === 'recruit')
const shops = computed(() => snap.value.shops || [])
// 招募周报的支出来自日报，不用再填费用；老版本小程序在招募周报里填过的费用还要显示
const showFees = computed(() => !isRecruit.value || fees.length > 0)
const secNo = (key) => {
  const keys = ['works', 'biz', 'trend', ...(isRecruit.value ? ['shops'] : []), ...(showFees.value ? ['fees'] : []), 'risk', 'note', 'coop', 'proofs']
  return ['一', '二', '三', '四', '五', '六', '七', '八', '九'][keys.indexOf(key)] + '、'
}
const TONE = ['k-red', '', '', 'k-green']
const works = computed(() => snap.value.works || [])
// 「较上周」按变化值定颜色（和数据看板、日报一致）：涨绿、跌提醒红，持平 / — / 0 用灰色。之前涨用主色（现在是暖棕）、跌用绿色，正好反了。
// 服务端的 up 是 cur >= prev（持平也算涨），只在「新增」这种没有正负号的值上参考它
const deltaTone = (v, up, cost) => {
  const t = String(v == null ? '' : v).trim()
  if (!t || t === '—' || t === '持平' || /^[+-]?0+(\.0+)?%?$/.test(t)) return 'k-muted'
  const rising = !t.startsWith('-') && (t.startsWith('+') || up !== false)
  return rising !== !!cost ? 'k-green' : 'k-alert'
}
// 支出花得多是坏消息：涨用提醒红，少了用绿色（和日报一致）
const bizCols = computed(() => (snap.value.bizCols || []).map((c, i) => ({ ...c, tone: TONE[i] || '', deltaTone: deltaTone(c.delta, c.up, /支出/.test(c.label)), delta: c.delta || '—' })))
const orderCols = computed(() => (snap.value.orderCols || []).map((c, i) => ({ ...c, tone: i === 2 ? 'k-red' : '', deltaTone: deltaTone(c.delta, c.up), delta: c.delta || '—' })))

/* 折线图（纯 view 绘制）：金额按元画，Y 轴按最大值取整 */
const days = computed(() => ((snap.value.days || []).length ? snap.value.days : ['—', '—', '—', '—', '—', '—', '—']))
const thisWeek = computed(() => (snap.value.thisWeek || []).map(v => v / 100))
const lastWeek = computed(() => (snap.value.lastWeek || []).map(v => v / 100))
const yMax = computed(() => {
  const m = Math.max(0, ...thisWeek.value, ...lastWeek.value)
  if (m <= 0) return 400
  const step = Math.pow(10, Math.floor(Math.log10(m)))
  return Math.ceil(m / step) * step
})
// 千分位走 fmtNum（见 common/ui.js：安卓微信可能缺 ICU，系统本地化格式会丢逗号）
const yLabels = computed(() => [1, 0.75, 0.5, 0.25, 0].map(r => fmtNum(Math.round(yMax.value * r))))
// 图表宽按屏宽算（390 宽正好是设计稿的 270）：之前写死 270、日期标签却铺满整行，屏越宽点越对不上「一…日」，窄屏还会撑出卡片
let winW = 390
try { winW = uni.getSystemInfoSync().windowWidth || 390 } catch (e) { winW = 390 }
const PW = Math.max(180, Math.min(480, winW - 120)), PH = 140
const toPts = (arr) => arr.map((v, i) => ({ x: i * (PW / 6), y: PH - (v / yMax.value) * PH }))
const toSegs = (pts) => pts.slice(0, -1).map((p, i) => {
  const q = pts[i + 1]; const dx = q.x - p.x, dy = q.y - p.y
  return { x: p.x, y: p.y, len: Math.sqrt(dx * dx + dy * dy), ang: Math.atan2(dy, dx) * 180 / Math.PI }
})
const thisPts = computed(() => toPts(thisWeek.value))
const lastPts = computed(() => toPts(lastWeek.value))
const thisSegs = computed(() => toSegs(thisPts.value))
const lastSegs = computed(() => toSegs(lastPts.value))
const segStyle = (sg) => ({ left: sg.x + 'px', top: sg.y + 'px', width: sg.len + 'px', transform: `rotate(${sg.ang}deg)` })
const showMore = computed(() => (rep.storeId ? 'display: flex' : ''))

/* 编辑：停顿 1.5 秒自动保存 */
// 按分累加再换算成元（直接加元的小数会攒出 0.1 + 0.2 这类浮点误差），固定两位小数 + 千分位
const total = computed(() => fmtNum(fees.reduce((a, f) => a + (f.amountFen != null ? Math.round(Number(f.amountFen) || 0) : Math.round(Number(f.amt || 0) * 100)), 0) / 100, 2))
const saveHint = ref('已保存')
// 已提交（status = submitted）的周报后端不再接受保存：编辑页的输入框、增删按钮全部只读
const readOnly = computed(() => rep.status === 'submitted')
let timer = null
let pending = null   // 正在进行的那次保存（Promise<boolean>），同一时间只发一个保存请求
let dirty = false    // 上次保存发出之后还有没有新的改动
function schedule() {
  if (applying || !rep.reportId || rep.status === 'submitted') return
  dirty = true
  saveHint.value = '有改动，稍后自动保存…'
  clearTimeout(timer)
  timer = setTimeout(() => saveDraft(false), 1500)
}
watch([note, risk, proofs], schedule, { deep: true })
watch(fees, schedule, { deep: true })
watch(coop, schedule, { deep: true })
async function saveDraft(manual) {
  if (!rep.reportId) return true
  if (rep.status === 'submitted') {
    if (manual) toast('周报已提交，不能再修改')
    return true
  }
  if (pending) {
    // 自动保存还在途中：等它落地。以前这里直接返回 false，「下一步：预览提交」「确认提交」点了没有任何反应
    const ok = await pending
    if (pending) return saveDraft(manual)   // 等待期间别的调用已经发起了新的保存，跟着它走
    if (ok && !dirty) {
      if (manual) toast('已保存草稿')
      return true
    }
  }
  const p = doSave(manual).finally(() => { if (pending === p) pending = null })
  pending = p
  return p
}
async function doSave(manual) {
  clearTimeout(timer)
  dirty = false
  saveHint.value = '保存中…'
  try {
    const d = (await apiWeeklySave(rep.reportId, { version: rep.version, note: note.value, risk: risk.value, proofs: proofs.value,
      fees: fees.map(f => ({ name: f.name, amountFen: f.amountFen || Math.round(Number(f.amt) * 100), remark: f.desc })),
      coops: coop.map(c => ({ text: c.text, dept: c.dept, done: c.done })) })).data
    rep.version = d.version
    // 保存途中又有改动时，下一次自动保存已经排上了，提示不能说成"已保存"
    saveHint.value = dirty ? '有改动，稍后自动保存…' : `已保存 ${d.updated || ''}`
    if (manual) toast('已保存草稿')
    return true
  } catch (e) {
    dirty = true
    saveHint.value = '保存失败，点「保存草稿」重试'
    toast(errText(e, '保存失败'))
    return false
  }
}
const toggleCoop = (c) => { if (!readOnly.value) c.done = !c.done }
const FEE_TYPES = ['平台推广', '物料采购', '清洁维护', '维修保养', '人工费用', '其他费用']
async function addFee() {
  if (readOnly.value) return
  const i = await sheet(FEE_TYPES)
  if (i < 0) return
  const v = await prompt('金额（元）', { placeholder: '0.01–1000000' })
  if (!v) return
  if (!/^\d+(\.\d{1,2})?$/.test(v.trim()) || Number(v) <= 0 || Number(v) > 1000000) return toast('请输入正确的金额')
  const desc = await prompt('说明（选填）', { placeholder: '例如：抖音推广投放' })
  if (desc === null) return
  fees.push({ name: FEE_TYPES[i], amt: Number(v), desc: desc.trim().slice(0, 120), amountFen: Math.round(Number(v) * 100) })
}
const DEPTS = ['产品运营', '工程部', '市场推广', '财务', '其他']
async function addCoop() {
  if (readOnly.value) return
  const text = await prompt('待协同事项（64 字以内）', { placeholder: '例如：请工程检查空调噪音' })
  if (!text || !text.trim()) return
  const i = await sheet(DEPTS)
  if (i < 0) return
  coop.push({ text: text.trim().slice(0, 64), dept: DEPTS[i], done: false, tone: DEPTS[i] === '产品运营' ? 'ochre' : 'neutral' })
}
async function addProof() {
  if (readOnly.value) return
  if (proofs.value.length >= 9) return toast('最多 9 张')
  const paths = await chooseImages(9 - proofs.value.length)
  for (const p of paths) {
    try {
      proofs.value.push((await uploadTo('/app/upload/image', p)).data.url)
    } catch (e) {
      toast(errText(e, '上传失败'))
    }
  }
}
const previewProof = (i) => uni.previewImage({ urls: proofs.value.map(absUrl), current: absUrl(proofs.value[i]) })
async function removeProof(i) {
  if (readOnly.value) return
  if (await confirm('删除凭证', '删除这张凭证图片？')) proofs.value.splice(i, 1)
}
async function toPreview() {
  // 自动保存还在途中时 saveDraft 会等它落地再继续；等待期间人已经离开编辑页（返回、换了周报）就不再跳预览
  const id = rep.reportId
  if (pending) saveHint.value = '保存中…保存完就进入预览'
  if (await saveDraft(false) && s.value === 3 && rep.reportId === id) s.value = 4
}

/* 提交 */
const confirmed = ref(false)
const lockText = computed(() => {
  if (rep.status === 'submitted') return `已于 ${rep.submittedTime} 由 ${rep.submittedBy || '门店'} 提交，不可修改`
  if (rep.status === 'returned') return `已被退回：${rep.returnReason || '—'}，修改后可重新提交`
  return '提交后不可修改'
})
// 连点「确认提交」会发两次提交请求（第二次因版本号变了报错）
let submitting = false
async function submit() {
  if (!confirmed.value) return toast('请先确认周报内容')
  if (submitting) return
  submitting = true
  try {
    if (!(await saveDraft(false))) return
    applyReport((await apiWeeklySubmit(rep.reportId, { version: rep.version, confirmed: true })).data)
    confirmed.value = false
    toast('周报已提交')
    s.value = 1
  } catch (e) {
    toast(errText(e, '提交失败'))
  } finally {
    submitting = false
  }
}
</script>

<style scoped lang="scss">
/* 页签 */
.tabs { display: flex; border-bottom: 1px solid var(--k-line); }
.tabs__item { flex: 1; position: relative; text-align: center; padding: 10px 0 12px; font-size: 15px; color: var(--k-ink); }
.tabs__item.active { color: var(--k-red); font-weight: 600; }
.tabs__item.active::after { content: ""; position: absolute; left: 50%; bottom: 0; width: 50px; height: 2px; margin-left: -25px; background: var(--k-red); }

/* 列表 */
.filter { display: flex; align-items: center; gap: 14px; margin: 2px 0 12px; }
.pill > text { max-width: 160px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.pill { height: 34px; padding: 0 12px 0 14px; border: 1px solid var(--k-line2); border-radius: 999px; background: var(--k-paper); display: flex; align-items: center; gap: 6px; font-size: 14px; }
.filter__week { font-size: 14px; color: var(--k-ink); }
.report { padding: 10px 8px 8px; margin-bottom: 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.report__head { display: flex; align-items: flex-start; gap: 12px; }
.report__img { width: 60px; height: 60px; border-radius: 8px; flex: 0 0 auto; }
.report__name { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 17px; line-height: 1.3; }
.report__meta { display: block; margin-top: 5px; font-size: 13px; color: var(--k-muted); line-height: 1.3; }
.report__time { margin-top: 5px; font-size: 12px; color: var(--k-muted); }
.report__right { display: flex; align-items: center; gap: 6px; padding-top: 4px; }
.report__money { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; padding: 0 4px; font-size: 13px; }
.shop { margin-bottom: 8px; padding: 10px 12px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.shop__name { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.shop__nums { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; font-size: 13px; }
.shop__money { display: block; margin-top: 6px; font-size: 12px; color: var(--k-muted); }
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
.stat4__value { font-family: var(--k-sans); font-weight: 700; font-size: 17px; line-height: 1.2; }
.stat4__value--lg { font-size: 20px; margin-top: 2px; }
.stat4__delta { font-size: 11px; color: var(--k-muted); line-height: 1.2; margin-top: 2px; }
.alert { display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 12px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.alert__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; color: var(--k-alert); margin-bottom: 4px; }
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
.chart__plot { position: relative; flex: 0 0 auto; height: 140px; margin-right: 8px; border-left: 1px solid var(--k-line); border-bottom: 1px solid var(--k-line); }
.chart__grid { position: absolute; left: 0; right: 0; height: 1px; background: var(--k-line); opacity: .6; }
.seg { position: absolute; height: 0; transform-origin: 0 0; }
.seg--red { border-top: 2px solid var(--k-red); }
.seg--dash { border-top: 2px dashed var(--k-indigo); }
.dot { position: absolute; width: 7px; height: 7px; border-radius: 50%; margin: -3.5px 0 0 -3.5px; border: 1.5px solid; background: var(--k-paper); }
.dot--red { border-color: var(--k-red); background: var(--k-red); }
.dot--blue { border-color: var(--k-indigo); }
/* 日期行和折线点共用一套横坐标：行宽 = PW + 一个标签宽（模板里绑），左边让出 Y 轴 34 + 间距 8 + 边框 1 再退半个标签 14，两端对齐后第 i 个字的中心正好在 i × PW/6 */
.chart__x { display: flex; justify-content: space-between; margin-left: 29px; padding-top: 6px; font-size: 11px; color: var(--k-muted); }
.chart__xlabel { flex: 0 0 auto; width: 28px; text-align: center; }
.orders { gap: 8px; }
.orders__item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 0; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }

/* 编辑 */
.saving { display: flex; align-items: center; justify-content: flex-end; gap: 4px; font-size: 12px; color: var(--k-green); margin: -8px 0 4px; }
.store { display: flex; align-items: center; gap: 14px; height: 38px; padding: 0 10px; border-bottom: 1px solid var(--k-line); margin-bottom: 10px; }
.store__name { font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.store__week { font-size: 12px; color: var(--k-muted); }
.returned { display: block; margin: -2px 0 6px; padding: 5px 8px; border-radius: 6px; background: var(--k-ochre-soft); color: #9A6A22; font-size: 12px; line-height: 1.5; }
.area { position: relative; margin-top: 8px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); padding: 10px 12px 24px; }
.area__ta { width: 100%; height: 44px; font-size: 14px; line-height: 1.6; color: var(--k-ink); }
/* 不在打字时显示的预览：和输入框一样大，长文字折行、超出部分截掉 */
.weekly-area-idle { display: block; overflow: hidden; white-space: pre-wrap; word-break: break-all; }
.area__count { position: absolute; right: 12px; bottom: 6px; font-size: 12px; color: var(--k-muted); }
.k-mt14 { margin-top: 14px; }
.total { font-size: 13px; color: var(--k-ink); }
.total__num { font-family: var(--k-sans); font-weight: 700; font-size: 15px; }
.card { margin-top: 8px; padding: 0 8px 8px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-paper); }
.fee { display: flex; align-items: center; height: 38px; padding: 0 2px; border-bottom: 1px solid var(--k-line); }
.fee__name { flex: 1; min-width: 0; font-size: 14px; }
.fee__amt { font-family: var(--k-sans); font-weight: 700; font-size: 16px; margin-right: 12px; }
.fee__x { flex-shrink: 0; width: 32px; height: 32px; margin-right: -6px; display: flex; align-items: center; justify-content: center; }
.add-dash { margin-top: 8px; height: 32px; border: 1px dashed var(--k-line2); border-radius: 6px; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; color: var(--k-ink); }
.coop { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 2px; border-bottom: 1px solid var(--k-line); }
.coop__check { flex-shrink: 0; width: 16px; height: 16px; border-radius: 3px; }
.coop__text { flex: 1; min-width: 0; font-size: 13px; word-break: break-all; }
.coop__tag { flex-shrink: 0; height: 22px; padding: 0 10px; border-radius: 5px; background: var(--k-paper2); display: flex; align-items: center; font-size: 12px; color: var(--k-muted); }
.coop__tag--ochre { color: #9A6A22; background: var(--k-ochre-soft); }
.proofs { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
.proofs__img { width: 48px; height: 48px; border-radius: 6px; flex: 0 0 auto; }
.proofs__add { width: 48px; height: 48px; border: 1px dashed var(--k-line2); border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; color: var(--k-ink); }
.btns { display: flex; align-items: center; gap: 10px; }
.btns__main { flex: 1.25; }

/* 预览 */
.lock { display: block; text-align: right; font-size: 12px; color: #9A6A22; margin: -8px 0 4px; }
.table { border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); overflow: hidden; }
.table__row { display: flex; align-items: center; height: 30px; padding: 0 10px; font-size: 13px; border-top: 1px solid var(--k-line); }
.table__row--head { border-top: 0; background: var(--k-paper2); color: var(--k-muted); font-size: 12px; }
.table__c1, .table__c3 { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.table__c1 { width: 32%; }
.table__c2 { width: 30%; text-align: center; }
.table__c3 { flex: 1; min-width: 0; text-align: center; }
.risk { padding: 8px 10px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); font-size: 12px; line-height: 1.6; }
.preview-empty { display: block; padding-top: 8px; font-size: 12px; color: var(--k-muted); }
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
.edit .coop { min-height: 32px; }
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

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底 + 白卡 12 圆角、不描边不加阴影；数字 15–20 / 700，标签 11–12 灰字，状态小标签 4 圆角。
   只改样子：页签、门店 / 周筛选、周报卡、异常提示、新建、系统汇总、折线图、编辑各项、预览、确认提交都在；「较上周」的颜色仍由脚本里的 deltaTone() 定。
   编辑周报是填写页，字不改小，只统一底色和圆角。下面每条都带 .weekly，盖住上面的旧值；上面四屏各自的紧凑间距没写到的照旧。 */
@import './manage-refine.scss';
.weekly .tabs { border-bottom: 0; }
.weekly .tabs__item { padding: 9px 0 11px; font-size: 14px; color: var(--k-ink2); }
.weekly .tabs__item.active { color: var(--k-red-deep); }
.weekly .tabs__item.active::after { bottom: 3px; width: 20px; height: 3px; margin-left: -10px; border-radius: 2px; }
/* 列表 */
.weekly .filter { gap: 12px; margin-top: 0; }
.weekly .pill { height: 30px; padding: 0 10px 0 12px; border: 0; font-size: 13px; }
.weekly .pill :deep(.k-icon), .weekly .filter :deep(.k-icon) { width: 12px !important; height: 12px !important; }
.weekly .filter__week { font-size: 13px; color: var(--k-ink2); }
.weekly .report { padding: 10px 12px; margin-bottom: 8px; border: 0; border-radius: 12px; }
.weekly .report__head { gap: 10px; }
.weekly .report__img { width: 52px; height: 52px; }
.weekly .report__name { font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 20px; }
.weekly .report__meta { margin-top: 2px; font-size: 12px; }
.weekly .report__time { gap: 4px; margin-top: 2px; font-size: 11px; }
.weekly .report__time :deep(.k-icon) { width: 11px !important; height: 11px !important; }
.weekly .report__right { gap: 2px; padding-top: 1px; }
.weekly .report__right :deep(.k-icon) { width: 12px !important; height: 12px !important; }
.weekly .report__money { margin-top: 8px; padding: 0 2px; font-size: 12px; color: var(--k-ink2); }
.weekly .stag { height: 17px; padding: 0 5px; border-radius: 4px; font-size: 10px; font-weight: 500; }
.weekly .stag--wait { color: var(--k-ochre-deep); }
.weekly .stat4--boxed { margin-top: 8px; padding: 6px 0; border: 0; border-radius: 8px; background: var(--k-bg); }
.weekly .stat4--card { border: 0; border-radius: 12px; }
.weekly .stat4__label { font-size: 11px; }
.weekly .stat4__value { font-size: 15px; line-height: 20px; }
.weekly .stat4__value--lg { margin-top: 0; font-size: 20px; line-height: 26px; }
.weekly .stat4__delta { text-align: center; }
@media (max-width: 340px) { .weekly .stat4__value--lg { font-size: 17px; } .weekly .stat4__delta { font-size: 10px; } }
.weekly .alert { padding: 10px 12px; border: 0; border-radius: 12px; }
.weekly .alert__title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.weekly .alert__dot { background: var(--k-alert); }
.weekly .alert :deep(.k-icon) { width: 12px !important; height: 12px !important; }
.weekly .shop { padding: 12px; border: 0; border-radius: 12px; }
.weekly .shop__name { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.weekly .shop__nums { font-size: 12px; color: var(--k-ink2); }
.weekly .shop__money { font-size: 11px; }
/* 汇总 */
.weekly .notice { flex-wrap: wrap; gap: 2px 8px; height: auto; min-height: 36px; padding: 7px 12px; border: 0; border-radius: 10px; background: #FFF8EE; }
.weekly .notice__text { font-size: 12px; color: var(--k-ochre-deep); }
.weekly .notice .k-meta { font-size: 11px; }
.weekly .sec__title { font-family: var(--k-sans); font-size: 15px; font-weight: 700; }
.weekly .sec__hint { font-size: 11px; }
.weekly .works__item { border: 0; border-radius: 12px; }
.weekly .works__item :deep(.k-icon) { width: 22px !important; height: 22px !important; }
.weekly .works__label { font-size: 11px; color: var(--k-muted); }
.weekly .preview .works__item { gap: 2px; padding: 8px 0; }
.weekly .preview .stat4--card { padding: 8px 0; }
.weekly .select { height: 28px; padding: 0 8px 0 10px; border: 0; border-radius: 14px; font-size: 12px; }
.weekly .select :deep(.k-icon) { width: 12px !important; height: 12px !important; }
.weekly .chart-card { border: 0; border-radius: 12px; }
.weekly .chart-card--preview { margin-top: 0; padding: 8px 10px 6px; }
.weekly .legend { font-size: 11px; }
.weekly .legend__line { width: 14px; }
.weekly .chart__ylabel { font-size: 10px; }
.weekly .orders__item { border: 0; border-radius: 12px; }
/* 编辑（填写页）：字号不动 */
.weekly .store { padding: 0 2px; border-bottom: 0; }
.weekly .store__name { font-family: var(--k-sans); font-size: 15px; font-weight: 700; }
.weekly .returned { padding: 6px 10px; border-radius: 8px; color: var(--k-ochre-deep); }
.weekly .area { border: 0; border-radius: 10px; }
.weekly .card { border: 0; border-radius: 12px; }
.weekly .add-dash { border-radius: 8px; }
.weekly .coop__check { border-radius: 4px; }
.weekly .coop__tag { height: 18px; padding: 0 6px; border-radius: 4px; background: #F5F1EB; color: var(--k-ink2); font-size: 11px; }
.weekly .coop__tag--ochre { background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
.weekly .proofs__img, .weekly .proofs__add { border-radius: 8px; }
.weekly .proofs__add { background: var(--k-paper); }
.weekly .btns { gap: 10px; }
/* 预览 */
.weekly .lock { color: var(--k-ochre-deep); }
.weekly .table { border: 0; border-radius: 10px; }
.weekly .table__row--head { background: transparent; font-size: 11px; }
.weekly .preview .table__row { height: 30px; }
.weekly .risk { padding: 10px 12px; border: 0; border-radius: 10px; color: var(--k-ink2); line-height: 18px; }
/* 2026-11-18 复查 */
/* 1) 门店胶囊、周选择、汇总页的门店下拉、问号看着小，手指能点的范围补到 36：上下各补一截透明的可点区；问号是图标自己在接点击，用透明内边距撑大（负外边距抵掉，位置和大小都不变） */
.weekly .pill, .weekly .select, .weekly .filter > .k-row { position: relative; }
.weekly .pill::after { content: ""; position: absolute; left: 0; right: 0; top: -3px; bottom: -3px; }
.weekly .select::after { content: ""; position: absolute; left: 0; right: 0; top: -4px; bottom: -4px; }
.weekly .filter > .k-row::after { content: ""; position: absolute; left: -6px; right: -8px; top: -9px; bottom: -9px; }
.weekly .notice :deep(.k-icon) { box-sizing: content-box; padding: 11px; margin: -11px; }
/* 编辑页的小勾选框（16）和「添加…」虚线条（27）原来就偏小，一并把能点的范围补大，样子不变 */
.weekly .edit .coop__check, .weekly .edit .add-dash { position: relative; }
.weekly .edit .coop__check::after { content: ""; position: absolute; left: -12px; right: -12px; top: -12px; bottom: -12px; }
.weekly .edit .add-dash::after { content: ""; position: absolute; left: 0; right: 0; top: -6px; bottom: -5px; }
/* 2) 编辑周报是填写页，字不改小：小字说明和部门小标签还原回 12；预览里的部门小标签和别处的小标签一个尺寸 */
.weekly .edit .sec__hint { font-size: 12px; }
.weekly .edit .coop__tag { height: 20px; font-size: 12px; }
.weekly .preview .coop__tag { height: 17px; padding: 0 5px; font-size: 10px; font-weight: 500; }
/* 3) 两个说明框原来只露一行半，第二行被拦腰截掉：改成整两行（打字时和平时一样高，不跳），再长用省略号收尾；字数挪到两行字下面，不压字 */
.weekly .edit .area { padding-bottom: 20px; }
.weekly .edit .area__ta { height: 42px; line-height: 21px; }
.weekly .weekly-area-idle > text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
/* 4) 底部按钮原来整体上提 9px，压在凭证图片的「添加」小方块上：取消上提，留出正常间距 */
.weekly .edit .btns, .weekly .preview .btns { transform: none; margin-top: 14px; }
/* 5) 白卡里最后一行下面不再拖一条线 */
.weekly .card > .coop:last-child, .weekly .card > .fee:last-child { border-bottom: 0; }
/* 6) 预览页「我已确认周报内容真实准确」只有一行字那么高：拉到和旁边按钮一样高，好点（字的位置不变）；
   这句话原来在常见屏宽上也被挤成「…内容真 / 实准确」两行：屏宽够（360 起）就让它完整占一行，旁边的按钮用剩下的宽度 */
.weekly .confirm { align-self: stretch; }
@media (min-width: 360px) { .weekly .preview .confirm { flex: 0 0 auto; white-space: nowrap; } .weekly .preview .btns__main { flex: 1; min-width: 0; } }
/* 2026-11-18 第二轮精修（精修词典：同一种东西全站一个样子；只改样子，页签、筛选、周报卡、异常、汇总、编辑、预览、提交都在） */
/* 1) 顶栏下的页签按词典：没选中 400 灰字，选中 600 墨色 + 16×3 的暖棕短条（页签行高不变） */
.weekly .tabs__item { color: var(--k-muted); }
.weekly .tabs__item.active { color: var(--k-ink); font-weight: 600; }
.weekly .tabs__item.active::after { width: 16px; margin-left: -8px; background: var(--k-red); }
/* 2) 区块标题统一 16 / 700；折线图卡片里的标题是卡内小标题 14 / 600（同看板的「业务趋势」）；编辑页（填写页）的字段组标题仍是 15 */
.weekly .sec__title { font-size: 16px; line-height: 22px; color: var(--k-ink); white-space: nowrap; }
.weekly .sec__title--sm { font-size: 15px; }
.weekly .chart-card .sec__title { font-size: 14px; font-weight: 600; line-height: 20px; }
/* 3) 区块标题行：「（系统识别）」这类说明一律紧跟在标题后面；只有门店下拉、合计靠右。
      320 宽放不下时说明整段掉到标题下面，店名保持一行、超长用省略号（之前标题、店名都被拆成两行挤在一起） */
.weekly .sec { justify-content: flex-start; }
.weekly .sec > .sec__hint { margin-left: 2px; }
.weekly .sec > .select, .weekly .sec > .total { margin-left: auto; }
.weekly .sec > .k-row { flex: 1 1 auto; min-width: 0; flex-wrap: wrap; margin-right: 8px; }
.weekly .select { flex: 0 1 auto; min-width: 0; max-width: 52%; }
.weekly .select > text { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 4) 数据格统一成「一张白卡 + 发丝竖线（上下各缩 12）」：本周完成工作、报名与订单原来是一格一张卡，经营数据是 1px 通栏竖线 */
.weekly .works, .weekly .orders { gap: 0; padding: 0; border-radius: 12px; background: var(--k-paper); }
.weekly .works__item, .weekly .orders__item { position: relative; border-radius: 0; background: transparent; }
.weekly .stat4__cell { position: relative; border-left: 0; }
.weekly .works__item + .works__item::before, .weekly .orders__item + .orders__item::before, .weekly .stat4__cell + .stat4__cell::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 1px; background: var(--k-line); transform: scaleX(.5); }
/* 周报卡里的灰底数据框矮一些，竖线上下只缩 4 */
.weekly .stat4--boxed .stat4__cell + .stat4__cell::before { top: 4px; bottom: 4px; }
/* 5) 异常提示：店名保持一行（超长省略），说明只在自己那一列里折行；小圆点对齐第一行 */
.weekly .alert__row { align-items: flex-start; }
.weekly .alert__dot { margin-top: 8px; }
.weekly .alert__name { flex-shrink: 0; max-width: 55%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.weekly .alert__desc { flex: 1; min-width: 0; }
/* 6) 编辑页（填写页，字号不动）：费用、待协同每行至少 44 高，卡片左右内边距 12 和说明框的字对齐，行间发丝线；「添加…」虚线条 36 高 */
.weekly .card { padding: 0 12px 8px; }
.weekly .fee { position: relative; padding: 0; border-bottom: 0; }
.weekly .coop { position: relative; padding: 4px 0; border-bottom: 0; }
.weekly .edit .fee { height: auto; min-height: 44px; }
.weekly .edit .coop { min-height: 44px; }
.weekly .card > .fee + .fee::before, .weekly .card > .coop + .coop::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.weekly .edit .add-dash { height: 36px; margin-top: 4px; }
/* 7) 「本城还没有换工店家」按空状态画：白卡里居中 */
.weekly .list-body > .preview-empty, .weekly .summary-body > .preview-empty { padding: 28px 12px; border-radius: 12px; background: var(--k-paper); text-align: center; font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
/* 8) 「补充本周信息」和页面主按钮一个尺寸（44 高、15 号字） */
.weekly .summary-body :deep(.k-button.is-lg) { height: 44px; font-size: 15px; }
/* 9) 预览：区块标题上下按词典留 16 / 8（之前 5 / 3，标题几乎贴在卡片上）；费用表行线改发丝线，左右和卡片内边距 12 对齐，金额等宽 */
.weekly .preview .sec--tight { margin: 16px 0 8px; }
.weekly .table__row { position: relative; padding: 0 12px; border-top: 0; }
.weekly .table__row + .table__row::before { content: ""; position: absolute; left: 12px; right: 12px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.weekly .table__c2 { font-variant-numeric: tabular-nums; }
</style>
