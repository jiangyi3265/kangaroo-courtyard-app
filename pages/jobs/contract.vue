<template>
  <view class="k-page contract-page">
    <k-topbar :title="s === 4 && !groupChatEnabled ? '到店准备' : titles[s - 1]" back custom-back @back="onBack" />
    <departure-notice v-if="application?.jobType === 'volunteer'" ref="departureNotice" :app-id="appId" />
    <k-order-mediation v-if="s !== 5" order-type="application" :order-id="appId" />
    <view class="contract-flow"><job-flow-steps :current="flowCurrent" :arrival-enabled="canOpenArrival" compact @arrival="openArrival" /></view>

    <view v-if="s === 1" class="read-body">
      <view class="read-progress"><text>阅读进度</text><view><view :style="readStyle" /></view><text>{{ readPct }}%</text></view>
      <!-- 2026-11-03 主人：「不要弹窗确认的，往下滑到底就百分百了」：条款全文直接铺开，不用逐条点开弹窗；进度条跟着往下滑走 -->
      <view class="terms card"><view v-for="item in terms" :key="item.title"><view class="term-icon"><k-icon :name="item.icon" :size="25" color="ink" /></view><view><text>{{ item.title }}</text><text>{{ item.desc }}</text></view></view></view>
      <view class="read-done"><k-icon name="shield-check" :size="22" color="green" :fill="true" /><text>{{ c.sign ? '责任书已签署，可继续订票与到店准备' : readPct >= 100 ? '已读完全部条款，可以签署' : '往下滑读完全部条款即可签署' }}</text></view><k-button block :disabled="!c.sign && readPct < 100" :type="c.sign || readPct >= 100 ? 'primary' : 'secondary'" :label="c.sign ? '下一步：订票与到店信息' : '已阅读，去签署'" @click="toSign" />
    </view>

    <tripartite-sign v-else-if="s === 2 && c.tripartite" :app-id="appId" :doc="c.tripartite" :before-sign="confirmDeparture" @refresh="load" @next="continueArrival" />
    <view v-else-if="s === 2" class="sign-body">
      <text class="screen-title">请确认信息并签署</text>
      <!-- 2026-11-03 主人：简化 —— 姓名、证件后四位直接在卡片里填（原来各弹一个系统输入框，改名还要再弹一次）；已签署的只读 -->
      <view class="identity card"><view><text>姓名</text><input v-if="!c.sign" v-model="name" class="identity__input" maxlength="16" placeholder="与报名时填写的姓名一致" placeholder-class="k-placeholder" @blur="trimName" /><text v-else>{{ name }}</text></view><view><text>证件类型</text><text>身份证</text></view><view><text>证件后四位</text><input v-if="!c.sign" v-model="idLast4" class="identity__input" maxlength="4" placeholder="选填，仅用于核对" placeholder-class="k-placeholder" @blur="trimLast4" /><text v-else>{{ c.sign.idLast4 || '未填' }}</text></view></view>
      <text class="field-title">签署姓名 <text>（确认后作为签署记录）</text></text><view class="signature"><text :class="{ 'signature--empty': !name }">{{ name || '请在上面填写姓名' }}</text></view>
      <view class="sign-date"><text>签署日期</text><text>{{ signDate }}</text></view><view class="agree" @click="readPct >= 100 && (agreed = !agreed)"><view><k-icon v-if="agreed || c.sign" name="check" :size="18" color="white" /></view><text>本人已仔细阅读并理解《责任书》全部条款，
自愿遵守并承担相应责任。</text></view><k-button block :disabled="signing || (!c.sign && (readPct < 100 || !agreed))" :label="c.sign ? '下一步：订票与到店信息' : signing ? '签署中…' : '确认签署'" @click="doSign" /><view class="legal"><k-icon name="lock-keyhole" :size="18" color="muted" /><text>平台记录签署时间与条款摘要作为确认留痕，不替代依法签订的劳动 / 劳务合同</text></view>
    </view>

    <view v-else-if="s === 3" class="arrival-body">
      <text class="screen-title departure-title">订票与出发准备</text>
      <safety-share v-if="appId" compact :app-id="appId" :status="c.status" @ready="onTrip" />
      <text class="field-title departure-arrival">订好票后，填写到店信息</text>
      <!-- 2026-11-03 主人：简化 —— 到达日期点开月历、到达时间是时间滚轮（原样）；交通方式改成按钮组、车次 / 航班改成输入框（原来一个弹菜单、一个弹系统输入框） -->
      <view class="arrival card"><view class="arrival-row" @click="editArrival(arrival[0])"><k-icon :name="arrival[0].icon" :size="24" color="ink" /><text>{{ arrival[0].label }}</text><text>{{ arrival[0].value }}</text><k-icon name="chevron-right" :size="22" color="ink" /></view><picker mode="time" :value="arr.arriveTime || '14:00'" @change="arr.arriveTime = $event.detail.value"><view class="arrival-row"><k-icon :name="arrival[1].icon" :size="24" color="ink" /><text>{{ arrival[1].label }}</text><text>{{ arrival[1].value }}</text><k-icon name="chevron-right" :size="22" color="ink" /></view></picker><view class="arrival-row arrival-row--pills"><k-icon :name="arrival[2].icon" :size="24" color="ink" /><text>{{ arrival[2].label }}</text><view class="arrival-pills"><view v-for="t in TRANSPORTS" :key="t" class="arrival-pill" :class="{ on: arr.transport === t }" hover-class="k-press-s" @click="arr.transport = t"><text>{{ t }}</text></view></view></view><view class="arrival-row arrival-row--input"><k-icon :name="arrival[3].icon" :size="24" color="ink" /><text>{{ arrival[3].label }}</text><input v-model="arr.transportNo" class="arrival-input" maxlength="32" placeholder="选填，例如 G1234" placeholder-class="k-placeholder" /></view></view>
      <text class="field-title">票据截图 <text>（车票 / 机票 / 大巴票）</text></text><view class="tickets"><image v-for="(t, ti) in tickets" :key="t" :src="t" mode="aspectFill" @click="previewTicket(ti)" /><view @click="addTicket"><k-icon name="plus" :size="38" color="ink" /><text>{{ tickets.length ? '上传更多' : '上传票据' }}</text></view></view>
      <!-- 2026-11-03 主人：简化 —— 备注直接在卡片里写（原来弹系统输入框） -->
      <view class="note card"><text>备注（选填）</text><input v-model="arr.note" class="note__input" maxlength="200" placeholder="如有其他信息，请在此说明，例如：行李较多" placeholder-class="k-placeholder" /></view><k-button block :disabled="savingArrival" :label="savingArrival ? '保存中…' : '保存并通知门店'" @click="saveArrival" /><text class="arrival-tip">保存后门店会收到你的到店信息</text>
    </view>

    <view v-else-if="s === 4" class="finish-body">
      <travel-id-card :status="c.status" :job-type="application?.jobType || ''" />
      <view class="insurance" :class="{ 'insurance--active': ins && ins.policyIssued }"><image src="/static/media/contract-shield.jpg" mode="aspectFit" /><view><text>{{ insTitle }}</text><text>{{ insSub }}</text></view><image src="/static/media/contract-leaves.jpg" mode="aspectFill" /></view>
      <view class="policy card"><text class="screen-title">保单信息</text><view v-for="item in policy" :key="item.label"><text>{{ item.label }}</text><text>{{ item.value }}</text></view><view class="policy-link" @click="showPolicy"><text>查看完整保障详情</text><k-icon name="chevron-right" :size="21" color="ink" /></view></view>
      <view class="contact card"><text class="screen-title">商家联系方式</text><view><image src="/static/media/cover-empty.png" mode="aspectFill" /><view @click="openMap"><text>{{ storeLine }}</text><text>{{ storePhone || '门店电话待登记' }}</text><view><k-icon name="clock-3" :size="16" color="muted" /><text>{{ c.address ? (c.latitude ? mapTip : '工作地点：') + c.address : '门店还没有登记地址，可在消息里联系门店' }}</text></view></view><view class="call" @click="call"><k-icon name="phone" :size="25" color="ink" /></view></view></view>
      <region-group-card v-if="appId && groupChatEnabled" :app-id="appId" />
      <view class="trip-card card local-activities" @click="openLocalActivities"><view><text>当地活动</text><text>看看岗位所在地区的活动，约伙伴一起参加</text></view><k-icon name="chevron-right" :size="22" color="ink" /></view><k-button block label="下一步：到店确认" @click="openArrival" />
    </view>
    <view v-else-if="s === 5" class="arrival-confirm-body">
      <view class="arrival-status card" :class="{ 'arrival-status--done': arrived }"><k-icon :name="arrived ? 'circle-check' : 'clock-3'" :size="32" :color="arrived ? 'green' : 'red'" /><view><text>{{ arrivalEnded ? '本次报名已结束' : arrived ? '已完成到店确认' : '等待门店确认到店' }}</text><text>{{ arrivalEnded ? '到店流程已停止，如有异议可联系门店或申请调解' : arrived ? '门店已确认你的到店状态，报名进度已同步' : '到店后请联系门店核对，门店确认后这里会同步更新' }}</text></view></view>
      <view class="arrival-summary card"><text class="screen-title">本次到店信息</text><text class="arrival-job">{{ displayWording(c.jobTitle || application?.jobTitle, [c.storeName]) || '岗位信息待加载' }}</text><view><text>接待门店</text><text>{{ c.storeName || '待登记' }}</text></view><view><text>预计到店</text><text>{{ [c.arrival?.arriveDate, c.arrival?.arriveTime].filter(Boolean).join(' ') || '尚未填写' }}</text></view><view v-if="arrived"><text>确认时间</text><text>{{ confirmedArrivalTime || '以门店记录为准' }}</text></view></view>
      <view class="arrival-actions"><k-button v-if="!arrived && !arrivalEnded" block icon="message-circle" label="联系门店确认到店" @click="contactStore" /><k-button block type="secondary" :disabled="refreshingArrival" :label="refreshingArrival ? '正在更新…' : '刷新确认状态'" @click="refreshArrival" /></view>
      <view class="arrival-dispute card"><text class="screen-title">到店遇到问题？</text><text>如无法确认到店，或接待、岗位安排与约定不符，可关联本次报名申请纠纷调解。</text><departure-notice v-if="application?.jobType === 'volunteer'" ref="departureNotice" :app-id="appId" />
    <k-order-mediation order-type="application" :order-id="appId" /></view>
      <text class="arrival-insurance-note">到店确认与投保分别记录，保障状态以保险公司保单为准。</text>
      <k-button block type="outline" label="查看我的行程" @click="go(R.trip)" />
    </view>
    <k-date-picker v-if="arrivalCalendar" title="选择到达日期" :value="arr.arriveDate" :min-date="todayCn()" :max-date="shiftDate(todayCn(), 59)" @cancel="arrivalCalendar=false" @confirm="confirmArrivalDate" />
  </view>
</template>

<script setup>
import { groupChatEnabled } from '@/common/features.js'
import { displayWording } from '@/common/display-wording.js'
// ---------------------------------------------------------------------------
// 签约到店接入情况（?appId= 必带）：
//   s=1 阅读：平台《岗位责任确认书》条款（服务端下发，带版本与全文摘要）
//   s=2 签署：姓名 + 证件后四位（选填，都是卡片里的输入框）+ 勾选确认 → 服务端记录签署时间、IP 与条款 SHA-256，并把报名推进到"已签署"；
//       这是平台内的确认留痕，不等同于第三方电子签名，也不替代依法签订的劳动 / 劳务合同
//   s=3 订票与到店：当地主理人、行程分享、日期 / 交通 / 票据；保存后通知门店，本屏不填身份证号
//   2026-11-03 主人：简化 —— 这两屏原来姓名、后四位、交通、车次、备注各弹一个系统输入框 / 菜单（5 个弹窗），现在都在页面里填，一个弹窗都没有
//   s=4 保险与完成：唯一的出行证件提交入口；保单信息取门店提交、平台登记的真实数据；没有投保就如实显示；门店电话录用后可见
// ---------------------------------------------------------------------------
import DepartureNotice from './components/departure-notice.vue'
const departureNotice = ref(null)
import { ref, computed, watch, onBeforeUnmount, getCurrentInstance, nextTick } from 'vue'
import { onPageScroll, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { useScreen, back, go, replace, toast } from '@/common/screen.js'
import { apiApplicationDetail, apiContract, apiContractSign, apiSaveArrival } from '@/common/api.js'
import { ensureSession } from '@/common/experience.js'
import { alert, confirm, shiftDate, todayCn, errText } from '@/common/ui.js'
import { uploadTo, chooseImage, absUrl } from '@/common/upload.js'
import { loadArrivalImages, releaseArrivalImages } from '@/common/arrival-media.js'
import R from '@/common/routes.js'
import { readPercent, nextRead } from './contract-read.js'
import TravelIdCard from './components/travel-id-card.vue'
import RegionGroupCard from './components/region-group-card.vue'
import SafetyShare from './components/safety-share.vue'
import { tripShareMessage, jobShareFallback } from './trip-share.js'
import JobFlowSteps from './components/job-flow-steps.vue'
import TripartiteSign from './components/tripartite-sign.vue'
import { flowStepOf } from './apply-flow.js'

const appId = ref(0)
const application = ref(null)
const trip = ref(null)
const onTrip = value => { trip.value = value }
onShareAppMessage(() => tripShareMessage(trip.value, jobShareFallback(application.value?.jobId, application.value?.jobTitle)))
const s = useScreen(5, {
  onLoad: async (q) => {
    const requestedScreen = s.value
    s.value = 1
    await ensureSession()
    appId.value = Number(q?.appId) || 0
    if (!appId.value) return toast('请从报名进度进入责任书与到店确认')
    try {
      application.value = (await apiApplicationDetail(appId.value)).data
      if (application.value?.jobType === 'online') {
        replace(R.jobProgress + '?appId=' + appId.value)
        return
      }
    } catch (e) {
      toast(errText(e, '读取报名失败'))
      return
    }
    await load()
    // 已到店的历史记录即使没有旧签署详情，仍可查看真实到店结果；未签署不能跳过签署。
    if (q?.view === 'terms' || (!c.value.sign && requestedScreen >= 3 && !(requestedScreen === 5 && arrived.value))) s.value = 1
    else s.value = c.value.sign && requestedScreen < 3 ? 3 : requestedScreen
    if (c.value.tripartite?.record && (!c.value.sign || q?.view === 'terms')) s.value = 2
    else if (!c.value.sign && requestedScreen === 2) s.value = 1
    landing = s.value
  }
})
// 阅读 → 签署 → 到店 → 保险是一条流程：之前左上角返回在任何一屏都直接离开本页，现在逐屏退回，退到进页时那一屏再离开
let landing = 0
const onBack = () => { if (landing && s.value > landing) s.value = c.value.sign && s.value === 3 && landing === 1 ? 1 : s.value - 1; else back() }
const titles = ['责任书阅读', '确认签署', '订票与到店信息', '保险与地区群', '到店确认']
watch(s, async () => { await nextTick(); if (typeof uni !== 'undefined' && uni.pageScrollTo) uni.pageScrollTo({ scrollTop: 0, duration: 0 }) })
const c = ref({ terms: [], arrival: {}, insurance: null, sign: null })
const flowCurrent = computed(() => flowStepOf(c.value.status))
const canOpenArrival = computed(() => ['onboarded', 'completed'].includes(c.value.status) || (!!c.value.sign && c.value.status === 'contract_signed'))
const arrived = computed(() => ['onboarded', 'completed'].includes(c.value.status))
const arrivalEnded = computed(() => ['withdrawn', 'terminated', 'review_rejected'].includes(c.value.status))
const confirmedArrivalTime = computed(() => c.value.onboardTime || application.value?.onboardTime || '')
const openArrival = () => { if (canOpenArrival.value) s.value = 5; else toast('请先完成责任书签署') }
const refreshingArrival = ref(false)
const refreshArrival = async () => {
  if (refreshingArrival.value || !appId.value) return
  refreshingArrival.value = true
  try { await load() } finally { refreshingArrival.value = false }
}
onShow(() => { if (landing && (s.value === 5 || (c.value.tripartite && s.value <= 2))) refreshArrival() })
const confirmDeparture = () => departureNotice.value?.confirm()
async function continueArrival() { await load(); if (c.value.sign) s.value = 3; else toast('等待店家确认完成后再继续') }
let contractLoadSeq = 0
async function load() {
  const seq = ++contractLoadSeq, loadingAppId = appId.value
  try {
    const data = (await apiContract(loadingAppId)).data
    if (seq !== contractLoadSeq || loadingAppId !== appId.value) return
    c.value = data
    name.value = (c.value.sign && c.value.sign.signerName) || c.value.signerDefault || ''
    Object.assign(arr.value, {
      arriveDate: c.value.arrival.arriveDate || '', arriveTime: c.value.arrival.arriveTime || '', transport: c.value.arrival.transport || '',
      transportNo: c.value.arrival.transportNo || '',
      tickets: String(c.value.arrival.tickets || '').split(',').filter(Boolean), note: c.value.arrival.note || ''
    })
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
}

// ---------------- s=1 阅读 ----------------
// 2026-11-03 主人：「不要弹窗确认的，往下滑到底就百分百了」。之前要逐条点开、在弹窗里看完才算读过；现在条款全文直接铺在页面上，
// 进度条跟着往下滑走（./contract-read.js），条款列表最底下进了屏幕就是 100%，「去签署」可点，不再弹任何确认框。
// 进度只增不减（往回翻看不退）。服务端从来不记逐条阅读，签署只核对条款摘要（hash），口径不变。
const terms = computed(() => c.value.terms || [])
const readMax = ref(0)
let readStarted = false
watch(() => c.value.hash || JSON.stringify(c.value.terms || []), () => { readMax.value = 0; readStarted = false; agreed.value = false }, { flush: 'sync' })
const readPct = computed(() => (terms.value.length ? readMax.value : 0))
const readStyle = computed(() => ({ width: readPct.value + '%' }))
const pageInst = getCurrentInstance()
// 量一次条款列表露出来多少；量不到（返回 -1，或这个环境没有 selectorQuery）时 resolve(-1)
function measureRead() {
  return new Promise((resolve) => {
    if (s.value !== 1 || !terms.value.length || typeof uni === 'undefined' || !uni.createSelectorQuery) return resolve(-1)
    try {
      const q = uni.createSelectorQuery()
      const scoped = pageInst && pageInst.proxy && q.in ? q.in(pageInst.proxy) : q
      scoped.select('.terms').boundingClientRect((rect) => {
        const info = (uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()) || {}
        if (rect && rect.top >= -6 && rect.top < info.windowHeight) readStarted = true
        const pct = rect ? (readStarted ? readPercent(rect, info.windowHeight) : 0) : -1
        if (pct >= 0) readMax.value = nextRead(readMax.value, pct)
        resolve(pct)
      }).exec()
    } catch (e) { resolve(-1) }
  })
}
// 滑动时最多 60ms 量一次（带尾巴：停下来那一下也会量到）
let readTimer = null
const scheduleRead = () => { if (!readTimer) readTimer = setTimeout(() => { readTimer = null; measureRead() }, 60) }
onPageScroll(scheduleRead)
// 进页、条款读回来、退回第 1 屏时先量一次：条款短、一屏放得下就直接 100%
watch(() => [s.value, terms.value.length], () => { setTimeout(measureRead, 80); setTimeout(measureRead, 400) })
onBeforeUnmount(() => { if (readTimer) clearTimeout(readTimer); readTimer = null })
async function toSign() {
  if (c.value.tripartite?.record) { s.value = 2; return }
  if (c.value.sign) { s.value = 3; return }
  if (readPct.value < 100) {
    // 提交前再核实布局；测量失败不放行，也不自动滚到末尾。
    const pct = await measureRead()
    if (pct < 0) return toast('阅读进度暂未取得，请稍后重新滑动正文')
  }
  if (readPct.value < 100) {
    return toast('请往下滑，读完全部条款后再签署')
  }
  // 之前报名已撤回 / 终止时也说"门店确认录用后才能签署"，像是还要等门店；按真实状态说明
  if (!c.value.canSign) return toast(['withdrawn', 'terminated', 'review_rejected'].includes(c.value.status) ? '这次报名不在进行中，不能再签署责任书' : '门店确认录用后才能签署')
  s.value = 2
}

// ---------------- s=2 签署 ----------------
const name = ref('')
const idLast4 = ref('')
const agreed = ref(false)
// 2026-11-03 主人：简化 —— 姓名、后四位在卡片里直接输入，离开输入框时整理一下（去空格、后四位大写）
const trimName = () => { name.value = String(name.value || '').trim().slice(0, 16) }
const trimLast4 = () => { idLast4.value = String(idLast4.value || '').trim().toUpperCase().slice(0, 4) }
const signDate = computed(() => (c.value.sign ? String(c.value.sign.signedTime).replace('T', ' ').slice(0, 16) : todayCn()))
// 签署 / 保存到店信息要等服务端返回：连点会提交两次，处理中先锁住按钮
const signing = ref(false)
const savingArrival = ref(false)
async function doSign() {
  if (c.value.sign) { s.value = 3; return }
  if (readPct.value < 100) { s.value = 1; return toast('请先从顶部读完全部条款') }
  trimName(); trimLast4()
  if (!name.value) return toast('请先在上面填写签署姓名')
  if (!agreed.value) return toast('请勾选已阅读并理解全部条款')
  if (signing.value) return
  signing.value = true
  try {
    if (application.value?.jobType === 'volunteer' && !await departureNotice.value?.confirm()) return
    c.value = (await apiContractSign(appId.value, { name: name.value, idLast4: idLast4.value, agree: true, hash: c.value.hash })).data
    toast('责任书已签署')
    s.value = 3
  } catch (e) {
    // 签署页打开期间责任书改过字（服务端摘要对不上，409）：之前只弹提示，页面还拿着旧摘要，怎么点都签不了，
    // 只能退出重进。现在重新拉一遍条款，阅读进度清零，退回第 1 屏重新往下读一遍；已填的签署姓名保留
    if (e && e.code === 409 && /内容已更新/.test(e.message || '')) {
      const typed = name.value
      await load()
      if (typed && !c.value.sign) name.value = typed
      readMax.value = 0
      agreed.value = false
      s.value = 1
      toast('责任书内容有更新，请重新往下读完后再签署')
      return
    }
    toast(errText(e, '签署失败'))
  } finally {
    signing.value = false
  }
}

// ---------------- s=3 到店信息 ----------------
const arr = ref({ arriveDate: '', arriveTime: '', transport: '', transportNo: '', tickets: [], note: '' })
const arrivalCalendar = ref(false)
function confirmArrivalDate(value) {
  arr.value.arriveDate = value
  arrivalCalendar.value = false
}
// 到店信息卡片四行的图标 / 标签 / 显示值；2026-11-03 主人：简化 —— 交通方式、车次改成按钮组和输入框后，只有日期、时间两行还点开选
const TRANSPORTS = ['火车', '飞机', '大巴', '自驾', '其他']
const arrival = computed(() => [
  { key: 'date', icon: 'calendar-days', label: '到达日期', value: arr.value.arriveDate || '请选择' },
  { key: 'time', icon: 'clock-3', label: '到达时间', value: arr.value.arriveTime || '请选择' },
  { key: 'transport', icon: 'train-front', label: '交通方式', value: arr.value.transport || '请选择' },
  { key: 'no', icon: 'map-pin', label: '车次 / 航班', value: arr.value.transportNo || '选填' }
])
async function editArrival(item) {
  // 只有到达日期还要点开（页面内月历）；时间是行内时间滚轮，交通 / 车次直接在卡片里选、填
  if (item && item.key === 'date') arrivalCalendar.value = true
}
const tickets = ref([])
let ticketSeq = 0
watch(() => [appId.value, arr.value.tickets.join(',')], async () => {
  const seq = ++ticketSeq
  releaseArrivalImages(tickets.value); tickets.value = []
  if (!appId.value || !arr.value.tickets.length) return
  try {
    const urls = await loadArrivalImages(appId.value, arr.value.tickets)
    if (seq !== ticketSeq) { releaseArrivalImages(urls); return }
    tickets.value = urls
  } catch (e) { if (seq === ticketSeq) toast(errText(e, '票据读取失败，请重新进入或上传')) }
})
onBeforeUnmount(() => { ticketSeq++; releaseArrivalImages(tickets.value) })
async function addTicket() {
  if (arr.value.tickets.length >= 6) return toast('最多 6 张')
  const path = await chooseImage()
  if (!path) return
  try {
    arr.value.tickets.push((await uploadTo(`/app/application/${appId.value}/arrival/ticket`, path)).data.url)
  } catch (e) {
    toast(errText(e, '上传失败'))
  }
}
const previewTicket = (i) => uni.previewImage({ urls: tickets.value, current: i })
async function saveArrival() {
  if (savingArrival.value) return
  // 和服务端同一口径（2026-11-09 验收）：签署责任书后才能填；到达日期不能早于今天（之前保存过的旧日期原样再存可以）
  if (!c.value.sign && !['contract_signed', 'onboarded', 'completed'].includes(c.value.status)) return toast('请先签署责任书，再填写到店信息')
  const savedDate = (c.value.arrival && c.value.arrival.arriveDate) || ''
  if (arr.value.arriveDate && arr.value.arriveDate < todayCn() && arr.value.arriveDate !== savedDate) return toast('到达日期不能早于今天，请重新选择')
  savingArrival.value = true
  try {
    // 车次、备注是页面里直接输入的：提交前去掉首尾空格、按长度截断（和原来弹窗里填的口径一样）
    arr.value.transportNo = String(arr.value.transportNo || '').trim().slice(0, 32)
    arr.value.note = String(arr.value.note || '').trim().slice(0, 200)
    if (application.value?.jobType === 'volunteer' && !await departureNotice.value?.confirm()) return
    const res = await apiSaveArrival(appId.value, { ...arr.value })
    c.value = res.data
    toast(res.msg || '已保存')
    s.value = 4
  } catch (e) {
    toast(errText(e, '保存失败'))
  } finally {
    savingArrival.value = false
  }
}

// ---------------- s=4 保险与完成 ----------------
const ins = computed(() => c.value.insurance)
// 提前续保：服务端给的是今天正在保障的那张保单，续保申请挂在 renewal 里。之前只给最近一条（续保申请），老保单还在保障期也显示成「待登记保单」
const renewal = computed(() => (ins.value && ins.value.renewal) || null)
const day10 = (v) => (v ? String(v).slice(0, 10) : '')
const renewalText = computed(() => {
  const r = renewal.value
  if (!r) return ''
  return r.coverageStatus === 'rejected' ? '申请未通过，门店会重新办理' : `${r.statusLabel || '待登记保单'} · ${day10(r.startDate).slice(5)} 起`
})
const insTitle = computed(() => (!ins.value ? '门店尚未提交投保' : (ins.value.statusLabel || '投保状态待确认')))
const insSub = computed(() => {
  if (!ins.value) return '可联系主理人在入职前办理，请勿将入职状态视为已投保'
  if (ins.value.policyIssued && renewal.value) return `当前保单保障到 ${day10(ins.value.endDate)}，续保情况见下方`
  return ins.value.policyIssued ? '按保单起止日期核对保障，下方信息以保险公司保单为准' : (ins.value.handleNote || '投保申请尚未出单，不代表已有保障')
})
const policy = computed(() => [
  { label: '保单号', value: (ins.value && ins.value.policyNo) || '—' },
  { label: ins.value && ins.value.policyIssued ? '保单起保日期' : '拟起保日期', value: (ins.value && ins.value.startDate) ? String(ins.value.startDate).slice(0, 10) : '—' },
  { label: '保障期限', value: (ins.value && ins.value.endDate) ? '至 ' + String(ins.value.endDate).slice(0, 10) : '—' },
  { label: '保障方案', value: (ins.value && ins.value.planName) || '—' },
  ...(renewal.value ? [{ label: '续保', value: renewalText.value }] : [])
])
const showPolicy = () => {
  const r = renewal.value
  const more = r ? `\n\n续保：${renewalText.value}${r.policyNo ? '\n续保保单号：' + r.policyNo : ''}${r.startDate ? '\n续保期限：' + day10(r.startDate) + ' 至 ' + day10(r.endDate) : ''}` : ''
  alert('保障详情', ins.value ? `方案：${ins.value.planName || '—'}\n保单号：${ins.value.policyNo || '待登记'}${more}\n以保险公司出具的保单为准。` : '门店确认录用后可为你申请投保，目前还没有投保记录；是否已投保以本页「保单信息」为准。')
}
const storePhone = computed(() => c.value.storePhone || '')
const storeLine = computed(() => [c.value.storeName, displayWording(c.value.jobTitle, [c.value.storeName])].filter(Boolean).join(' · ') || '门店信息待登记')
const openLocalActivities = () => {
  const city = String(c.value.activityCity || c.value.city || '').trim()
  if (!city) return toast('岗位地区暂未填写，暂时无法查看当地活动')
  go(R.activity + '?city=' + encodeURIComponent(city))
}
// 之前没登记电话 / 位置时让用户"在报名进度里联系门店"，但报名到了这一步，进度页会直接转到面试页，那里没有联系入口；
// 电话或地址待登记时仍可通过这条报名联系门店；地区换工群由独立组件读取城市配置。
const contactStore = () => go(R.chat + '?appId=' + appId.value)
const askContact = async (why) => { if (await confirm(why, '去消息里联系门店？')) contactStore() }
const call = () => (storePhone.value ? uni.makePhoneCall({ phoneNumber: storePhone.value }) : askContact('门店还没有登记联系电话'))
// 岗位地址不是门店地址、岗位又没在地图上选点时，服务端不给坐标（免得导航到门店）：卡片只写「工作地点：…」，不再写「点此打开地图」
// 网页版没有地图 key，uni.openLocation 打开是一张空白灰图：有坐标时点了改成复制地址，卡片上也写「点此复制地址」（小程序照旧打开地图）
let mapTip = '点此打开地图：'
// #ifdef H5
mapTip = '点此复制地址：'
// #endif
function openMap() {
  if (!c.value.latitude) return c.value.address ? toast('地址：' + c.value.address) : askContact('门店还没有登记位置')
  // #ifdef H5
  const address = c.value.address
  if (!address) return askContact('门店还没有登记位置')
  uni.setClipboardData({ data: address, showToast: false, success: () => toast('地址已复制'), fail: () => toast('地址：' + address) })
  // #endif
  // #ifndef H5
  uni.openLocation({ latitude: Number(c.value.latitude), longitude: Number(c.value.longitude), name: c.value.storeName, address: c.value.address || '' })
  // #endif
}
</script>

<style scoped lang="scss">
.contract-flow { margin:10px 16px 16px; padding:14px 6px; border:1px solid var(--k-line); border-radius:16px; background:var(--k-paper); }
.arrival-confirm-body { padding:0 16px 28px; }
.arrival-status { display:flex; gap:12px; align-items:flex-start; padding:18px 14px; background:var(--k-paper2); }
.arrival-status > view { display:flex; flex:1; min-width:0; flex-direction:column; gap:7px; }
.arrival-status > view > text:first-child { font-size:17px; font-weight:600; color:var(--k-red-deep); }
.arrival-status > view > text:last-child { font-size:13px; line-height:1.6; color:var(--k-ink2); }
.arrival-status--done { background:var(--k-green-soft); }
.arrival-status--done > view > text:first-child { color:var(--k-green); }
.arrival-summary { margin-top:14px; padding:16px; }
.arrival-job { display:block; margin:10px 0 16px; font-size:14px; line-height:1.6; color:var(--k-ink); }
.arrival-summary > view { display:flex; justify-content:space-between; gap:16px; padding:10px 0; border-top:1px solid var(--k-line); font-size:13px; line-height:1.5; }
.arrival-summary > view > text:first-child { flex:none; color:var(--k-muted); }
.arrival-summary > view > text:last-child { min-width:0; text-align:right; overflow-wrap:anywhere; }
.arrival-actions { display:flex; flex-direction:column; gap:10px; margin-top:16px; }
.arrival-dispute { margin-top:20px; padding:16px; }
.arrival-dispute > text:not(.screen-title) { display:block; margin-top:8px; color:var(--k-muted); font-size:13px; line-height:1.6; }
.arrival-insurance-note { display:block; margin:16px 2px; color:var(--k-muted); font-size:12px; line-height:1.6; }
.contract-page { padding-bottom: calc(18px + var(--k-safe-bottom)); font-family: var(--k-sans); }.flow { height: 50px; padding: 0 18px; display: flex; align-items: center; }.flow>view { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; color: var(--k-muted); font-size: 11px; white-space: nowrap; }.flow>view>view:first-child { position: relative; z-index: 2; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--k-line2); background: var(--k-bg); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }.flow>view.active { color: var(--k-red-deep); font-weight: 700; }.flow>view.active>view:first-child { color: white; background: var(--k-red); border-color: var(--k-red); }.flow>view>text { white-space: nowrap; flex-shrink: 0; }.flow>view:last-child { flex: 0 0 auto; }.flow__line { height: 1px; flex: 1; min-width: 10px; background: var(--k-line2); margin-right: 8px; }
/* 320 宽：四步平分时「保险与完成」放不下，挤出右边。最后一步按字数占宽（它没有连接线），340 以下再收小边距、间距和连接线；
   H5 的 uni-text 是 pre-line，文字自己加 nowrap 才不折行 */
@media (max-width: 340px) { .flow { padding: 0 12px; } .flow>view { gap: 4px; } .flow__line { min-width: 6px; margin-right: 4px; } }.card,.signature,.sign-date,.insurance { border: 1px solid var(--k-line); border-radius: 12px; background: rgba(253,251,247,.78); }
.read-body,.sign-body,.arrival-body,.finish-body { padding: 8px 16px 18px; }.read-progress { height: 42px; display: grid; grid-template-columns: 70px 1fr 40px; align-items: center; gap: 10px; font-size: 18px; font-weight: 700; }.read-progress>view { height: 5px; border-radius: 3px; background: var(--k-line); overflow: hidden; }.read-progress>view>view { width: 100%; height: 100%; background: var(--k-green); }.terms { padding: 0 12px; }.terms>view { min-height: 64px; padding: 10px 0; display: flex; align-items: center; border-bottom: 1px solid var(--k-line); }.terms>view:last-child { border-bottom: 0; }.term-icon { width: 39px; height: 39px; margin-right: 12px; border-radius: 10px; background: var(--k-paper2); display: flex; align-items: center; justify-content: center; }.terms>view>view:nth-child(2) { flex: 1; display: flex; flex-direction: column; }.terms>view>view:nth-child(2) text:first-child { font-size: 16px; font-weight: 700; }.terms>view>view:nth-child(2) text:last-child { color: var(--k-muted); font-size: 11px; }.read-done { height: 59px; display: flex; align-items: center; justify-content: center; gap: 9px; color: var(--k-muted); font-size: 14px; }
.screen-title { display: block; font-size: 18px; font-weight: 700; }.sign-body>.screen-title { margin: 10px 0 15px; }.identity { padding: 0 12px; }.identity>view { height: 54px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--k-line); font-size: 15px; }.identity>view:last-child { border-bottom: 0; }.identity>view text:last-child { color: var(--k-muted); }.field-title { display: block; margin: 16px 4px 8px; font-size: 16px; font-weight: 700; }.field-title>text { color: var(--k-muted); font-size: 12px; font-weight: 400; }.signature { position: relative; height: 126px; display: flex; align-items: center; justify-content: center; }.signature>text { font: 700 44px/1.2 var(--k-display-font); transform: rotate(-4deg); }.signature>view { position: absolute; right: 13px; bottom: 10px; display: flex; align-items: center; gap: 5px; font-size: 12px; }.sign-date { height: 44px; margin-top: 8px; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; font-size: 15px; }.agree { margin: 15px 4px 76px; display: flex; align-items: flex-start; gap: 10px; color: var(--k-muted); font-size: 13px; line-height: 1.8; }.agree>view { width: 23px; height: 23px; border-radius: 5px; background: var(--k-red); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }.legal { margin-top: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--k-muted); font-size: 12px; }
.arrival { padding: 0 12px; }.arrival-row { height: 47px; display: grid; grid-template-columns: 30px 90px 1fr 24px; align-items: center; border-bottom: 1px solid var(--k-line); font-size: 14px; }.arrival>.arrival-row:last-child { border-bottom: 0; }.arrival-row>text:nth-of-type(2) { text-align: right; color: var(--k-muted); }.tickets { display: grid; grid-template-columns: 1.7fr .9fr; gap: 14px; }.tickets>image { width: 100%; height: 110px; border-radius: 10px; }.tickets>view { height: 110px; border: 1px dashed var(--k-line2); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; font-size: 14px; }.note { height: 80px; margin: 13px 0 18px; padding: 12px; }.note text:first-child { display: block; font-size: 16px; font-weight: 700; }.note text:last-child { display: block; margin-top: 8px; padding: 8px; background: var(--k-paper2); color: var(--k-light); font-size: 12px; }.arrival-tip { display: block; margin-top: 13px; text-align: center; color: var(--k-muted); font-size: 12px; }
.finish-body { padding-top: 6px; }.insurance { position: relative; height: 69px; padding: 8px 14px; display: flex; align-items: center; overflow: hidden; background: var(--k-green-soft); }.insurance>image:first-child { width: 58px; height: 58px; z-index: 1; }.insurance>view { margin-left: 12px; z-index: 1; display: flex; flex-direction: column; }.insurance>view text:first-child { color: var(--k-green); font-size: 20px; font-weight: 700; }.insurance>view text:last-child { color: var(--k-muted); font-size: 12px; }.insurance>image:last-child { position: absolute; right: 0; top: 0; width: 140px; height: 69px; opacity: .7; }.policy { margin-top: 10px; padding: 10px 12px 0; }.policy>.screen-title { margin-bottom: 4px; }.policy>view:not(.policy-link) { min-height: 29px; display: grid; grid-template-columns: 78px 1fr; align-items: center; font-size: 13px; }.policy>view:not(.policy-link) text:first-child { font-weight: 700; }.policy>view:not(.policy-link) text:last-child { text-align: right; color: var(--k-muted); }.policy-link { height: 38px; margin-top: 5px; border-top: 1px solid var(--k-line); display: flex; align-items: center; justify-content: space-between; font-weight: 700; }.contact { margin-top: 10px; padding: 10px 12px; }.contact>.screen-title { margin-bottom: 7px; }.contact>view { display: flex; align-items: center; }.contact image { width: 45px; height: 45px; border-radius: 50%; margin-right: 9px; }.contact>view>view:nth-child(2) { flex: 1; min-width: 0; display: flex; flex-direction: column; }.contact>view>view:nth-child(2)>text:first-child { font-weight: 700; }.contact>view>view:nth-child(2)>text:nth-child(2) { color: var(--k-green); font-size: 17px; }.contact>view>view:nth-child(2)>view { display: flex; align-items: center; gap: 5px; color: var(--k-muted); font-size: 11px; }.call { width: 43px; height: 43px; margin-left: auto; border: 1px solid var(--k-line); border-radius: 10px; display: flex; align-items: center; justify-content: center; }.work-group,.trip-card { min-height: 64px; margin-top: 9px; padding: 9px 12px; display: flex; align-items: center; }.work-group>view,.trip-card>view { flex: 1; display: flex; flex-direction: column; }.work-group>view text:first-child,.trip-card>view text:first-child { font-size: 16px; font-weight: 700; }.work-group>view text:last-child,.trip-card>view text:last-child { color: var(--k-muted); font-size: 11px; }.work-group image { width: 50px; height: 50px; }.finish-body>.k-button { margin-top: 10px; }
.agree>text { white-space: pre-line; }
.read-progress { grid-template-columns: 88px 1fr 40px; }
/* 2026-11-03 主人：简化 —— 签署卡片里的输入框（右对齐，和原来显示值一个位置）、没填名字时签名框的浅字；
   到店信息卡：交通方式一行按钮（≥36px 高）、车次 / 备注是行内输入框 */
.identity__input { flex: 1; min-width: 0; height: 44px; margin-left: 12px; text-align: right; font-size: 15px; color: var(--k-ink); }
.signature--empty { color: var(--k-light); font-size: 20px !important; transform: none !important; }
.arrival-row--pills, .arrival-row--input { grid-template-columns: 30px 90px 1fr; height: auto; min-height: 47px; }
.arrival-row--pills { padding: 8px 0; align-items: start; }
.arrival-row--pills>text { line-height: 44px; }
.arrival-pills { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.arrival-pill { min-height: 44px; padding: 0 12px; border: 1px solid transparent; border-radius: 18px; background: var(--k-paper2); color: var(--k-ink); font-size: 13px; display: flex; align-items: center; }
.arrival-pill.on { border-color: #E0A86E; background: #FCEBD7; color: #A0632E; font-weight: 700; }
.arrival-input { height: 44px; min-width: 0; text-align: right; font-size: 14px; color: var(--k-ink); }
.note { height: auto; min-height: 80px; }
.note__input { display: block; width: 100%; height: 44px; margin-top: 8px; padding: 0 8px; box-sizing: border-box; background: var(--k-paper2); border-radius: 8px; font-size: 14px; color: var(--k-ink); }
/* 2026-11-03 条款全文平铺（不再点开弹窗）：图标贴顶、正文换行，右边没有箭头了 */
.terms>view { align-items: flex-start; }.term-icon { flex: 0 0 auto; }
@import "flow-premium.scss";
@media (max-width: 360px) {
  .contract-page .flow > view,
  .contract-page .flow > view:last-child { flex: 1; flex-direction: column; gap: 6px; }
  .contract-page .flow__line { position: absolute; top: 11px; left: calc(50% + 15px); width: calc(100% - 30px); min-width: 0; margin: 0; }
}
</style>
