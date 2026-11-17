<template>
  <view class="k-page honor">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack" />

    <view v-if="s === 1" class="k-body k-pad-tab wall-page">
      <view class="person"><image :src="avatar" mode="aspectFill" /><view class="k-flex1"><text class="person__name">{{ hw.nickname || '我' }}</text><text class="person__days">{{ daysText }}</text></view><k-chip tone="ochre" outline icon="star"><text>荣誉记录</text></k-chip></view>
      <!-- 之前荣誉墙没有去往经营成长 / 生日礼物 / 委屈奖申报的入口：从业务中心、钱包进来只能看荣誉墙，经营成长谁都打不开 -->
      <view class="links"><view v-for="l in links" :key="l.s" class="links__item" @click="s = l.s"><text>{{ l.label }}</text><k-icon name="chevron-right" :size="14" color="ink" /></view></view>
      <view class="k-between section-line"><text class="section-title">我的荣誉</text><text class="section-count">已获得 {{ hw.count || 0 }} 项</text></view>
      <view class="honor-list">
        <view v-for="h in awarded" :key="h.name + h.date" class="honor-card"><image :src="h.badge" mode="aspectFit" /><view class="k-flex1"><text class="honor-card__title">{{ h.name }}</text><text class="honor-card__line">获得日期　{{ h.date }}</text><text class="honor-card__line k-pre">评选依据　{{ h.basis }}</text></view><k-chip tone="green"><text>已获得</text></k-chip></view>
        <view v-if="false" class="honor-card"><image src="/static/media/honor-badge-2.jpg" mode="aspectFit" /><view class="k-flex1"><text class="honor-card__title">活动大师</text><text class="honor-card__line">获得日期　2026年07月15日</text><text class="honor-card__line k-pre">评选依据　成功策划并执行3场活动、
　　　　　参与度高、反馈优秀。</text></view><k-chip tone="green"><text>已获得</text></k-chip></view>
        <view v-for="pend in pending" :key="pend.name" class="honor-card honor-card--pending"><image :src="pend.badge" mode="aspectFit" /><view class="k-flex1"><text class="honor-card__title">{{ pend.name }}</text><text class="honor-card__line">解锁条件　{{ pend.rule }}</text><text class="honor-card__line">进度　　　<text class="k-red">{{ pend.progress }}</text></text><view class="progress"><view :style="{ width: pend.pct + '%' }" /></view></view><k-chip tone="ochre"><text>待解锁</text></k-chip></view>
      </view>
      <view class="more-honors"><k-icon name="info" :size="14" color="ochre" /><text>持续用心经营，更多荣誉等你解锁！</text><image src="/static/media/honor-stamp.jpg" mode="aspectFit" /></view>
    </view>

    <view v-else-if="s === 2" class="k-body k-pad-tab growth-page">
      <view class="growth-data"><view class="k-between"><text class="section-title">门店经营数据 <text class="k-meta">{{ g.range }}</text></text><view v-if="!cityLead" class="k-row k-gap4" @click="openTrend"><text class="k-meta">查看趋势</text><k-icon name="chevron-right" :size="15" color="ink" /></view></view><view class="growth-grid"><view v-for="m in metrics" :key="m.label" class="growth-metric"><text>{{ m.label }}</text><text>{{ m.value }}</text><text>较上月 <text class="k-green" :style="m.up ? '' : 'color: var(--k-alert)'">{{ m.delta }}</text></text></view></view></view>
      <text class="section-title growth-section">成长里程碑</text>
      <view class="timeline"><view v-for="(item,index) in milestones" :key="item.date + item.text" class="timeline__row"><view class="timeline__track"><view class="timeline__dot" :class="{active:index===0}"><k-icon v-if="index===0" name="star" :size="10" color="white" fill="white" /></view><view v-if="index<milestones.length-1" class="timeline__line" /></view><text class="timeline__date">{{ item.date }}</text><text>{{ item.text }}</text></view></view>
      <view class="growth-cards"><view class="growth-card"><text class="section-title">好评与建议</text><text class="growth-card__big">好评率 <text class="k-green">{{ g.goodRate }}</text></text><view class="star-row"><k-icon v-for="n in fullStars" :key="n" name="star" :size="26" color="ochre" fill="ochre" /><k-icon v-if="halfStar" name="star-half" :size="26" color="ochre" fill="ochre" /></view><k-button v-if="!cityLead" block size="sm" type="secondary" :label="reviewsBtn" @click="openReviews" /></view><view class="growth-card"><text class="section-title">活动贡献</text><text class="growth-card__big">参与活动 <text class="k-indigo">{{ g.activityPeople || 0 }}</text> 人次</text><text class="growth-card__big">活动订单 <text class="k-indigo">{{ g.activityOrders || 0 }}</text> 单</text><k-button v-if="!cityLead" block size="sm" type="secondary" :label="activitiesBtn" @click="openActivities" /></view></view>
      <view class="suggest"><text class="section-title">改进建议</text><text class="suggest__intro">{{ adviceIntro }}</text><view v-if="g.advice" class="suggest__item"><k-icon name="map-pin" :size="25" color="red" /><view><text>{{ g.advice }}</text><text>来自近 30 天评价里得分偏低的分项{{ cityLead ? '。' : '，可在数据看板生成改进任务。' }}</text></view></view><k-button v-if="!cityLead" block size="sm" type="secondary" @click="openAdvice" label="查看全部建议" /></view>
    </view>

    <view v-else-if="s === 3" class="k-body k-pad-tab gift-page">
      <view class="birthday"><view><text class="birthday__title">{{ b.title || '生日关怀计划' }}</text><text class="birthday__desc">感谢你用温柔与用心，让小院更美好</text><view class="birthday__date" @click="editBirthday"><text>{{ b.birthdayText || '设置生日' }}</text></view></view><image src="/static/media/honor-gift-hero.jpg" mode="aspectFit" /></view>
      <view class="benefits"><text class="section-title">生日权益卡</text><view class="benefit-grid"><view v-for="b in benefits" :key="b.label" class="benefit"><image :src="b.img" mode="aspectFit" /><text>{{ b.label }}</text></view></view><view class="benefits__line" /><text class="section-title">领取条件</text><view class="checks"><view v-for="c in conditions" :key="c.text" class="check-row"><view :style="c.ok ? '' : 'background: #C9C1B8'"><k-icon v-if="c.ok" name="check" :size="11" color="white" :stroke="3" /></view><text>{{ c.text }}</text></view></view></view>
      <text class="section-title gift-section">可选礼物</text>
      <view class="gift-grid"><view v-for="g in gifts" :key="g.giftId" class="gift" :style="giftStyle(g)" @click="pickGift(g)"><image :src="g.img" mode="aspectFit" /><view><text>{{ g.name }}</text><text>{{ g.desc }}</text></view></view></view>
      <view class="address"><view class="k-between"><text class="section-title">收货信息</text><text class="k-meta" @click="chooseAddress">{{ b.claim ? '' : '修改' }}</text></view><text>收货人　　{{ addrReceiver }}</text><text>手机号码　{{ addrPhone }}</text><text>收货地址　{{ addrText }}</text></view>
      <k-button block size="md" class="gift-submit" @click="claim" :label="claimText" />
    </view>

    <view v-else class="k-body k-pad-tab appeal-page">
      <view class="appeal-intro"><view><text>我们理解经营中的不易</text><text>你的经历会被认真倾听与保护</text></view><image src="/static/media/honor-heart.jpg" mode="aspectFit" /></view>
      <view class="appeal-field"><view class="appeal-label"><text>事件类型</text><text>*</text></view><view class="appeal-input" @click="pickType"><text>{{ form.type || '请选择事件类型' }}</text><k-icon name="chevron-right" :size="18" color="ink" /></view></view>
      <view class="appeal-field"><view class="appeal-label"><text>关联订单/评价</text></view><view class="appeal-input" @click="pickRelated"><text>{{ form.bizLabel || '请选择订单或评价（可选）' }}</text><k-icon name="chevron-right" :size="18" color="ink" /></view></view>
      <view class="appeal-field"><view class="appeal-label"><text>事情经过</text><text>*</text></view><view class="appeal-area" @click="editContent"><text>{{ contentPreview }}</text><text>{{ form.content.length }}/500</text></view></view>
      <view class="appeal-field"><view class="appeal-label"><text>凭证上传</text><text class="k-meta">（截图、照片等）</text></view><view class="appeal-upload" @click="addProofs"><k-icon name="plus" :size="23" color="ink" /><text>{{ proofs.length ? '已选 ' + proofs.length + ' 张' : '上传凭证' }}</text><text>最多6张</text></view></view>
      <view class="appeal-field"><view class="appeal-label"><text>希望获得的帮助</text><text>*</text></view><view class="appeal-area appeal-area--short" @click="pickHelp"><text>{{ form.help || '请选择或输入你的期望' }}</text><text>{{ form.help.length }}/200</text></view></view>
      <view class="protection"><view><k-icon name="shield-check" :size="23" color="ink" /><view><text>隐私保护</text><text>仅处理申报内容</text></view></view><view class="protection__line"/><view><k-icon name="clock" :size="23" color="ink" /><view><text>处理时效</text><text>3个工作日内反馈</text></view></view></view>
      <k-button block size="md" class="appeal-submit" @click="submitAppeal" label="提交申报" />
    </view>

    <k-tabbar :mode="tabMode" active="profile" />
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 荣誉与关怀接入情况：
//   s=1 荣誉墙：平台授予的荣誉 + 可量化的解锁进度（达标也不会自动授予，由平台评定）
//   s=2 经营成长：本月 4 项经营指标（较上月同期）、成长里程碑、好评与活动贡献、按评价分项得出的改进建议
//   s=3 生日礼物：条件逐条判定，每年一次；收货信息用微信收货地址，只写在本次领取单上
//   s=4 委屈奖申报：任何登录账号都可以提交，后台处理后结果发到消息中心
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { apiHonor, apiHonorGrowth, apiHonorBirthday, apiSetBirthday, apiClaimGift, apiAppealOptions, apiAppeal } from '@/common/api.js'
import { ensureSession, hasStaffAccess, staffStores, staffStoreUrl, cityLead as cityLeadRole, cityLeadFull } from '@/common/experience.js'
// 只读的老城市负责人没有看板和周报入口；全部权限的有
const cityLead = computed(() => cityLeadRole.value && !cityLeadFull.value)
import { sheet, prompt, alert, confirm, pickPaged, errText, askMonthDay } from '@/common/ui.js'
import { absUrl, uploadTo, chooseImages } from '@/common/upload.js'
import R from '@/common/routes.js'

let ready = false
const s = useScreen(4, {
  onLoad: async (q) => {
    if (q?.view === 'growth') s.value = 2
    if (q?.view === 'gift') s.value = 3
    if (q?.view === 'appeal') s.value = 4
    landing = s.value
    await ensureSession()
    ready = true
    loadScreen(s.value)
  }
})
const titles = ['荣誉墙', '经营成长', '生日礼物', '委屈奖申报']
// 进页时落在哪一屏：消息里的「申报已处理」、任务完成页的「申诉」直接打开申报屏，生日消息直接打开生日礼物。
// 之前返回一律先回荣誉墙——用户身份点申报结果消息进来，返回只看到「荣誉墙仅对门店员工开放」和一面空墙；
// 现在从荣誉墙点进去的屏返回荣誉墙，直接打开的屏返回上一页
let landing = 1
const onBack = () => { if (s.value !== landing) s.value = landing; else back() }
const links = [{ s: 2, label: '经营成长' }, { s: 3, label: '生日礼物' }, { s: 4, label: '委屈奖申报' }]
watch(s, (v) => { if (ready) loadScreen(v) })
function loadScreen(v) {
  if (v === 1) loadWall()
  if (v === 2) loadGrowth()
  if (v === 3) loadBirthday()
  if (v === 4) loadOptions()
}
const tabMode = computed(() => (hasStaffAccess.value ? 'staff' : 'user'))

// ---------------- s=1 ----------------
const hw = ref({ awarded: [], pending: [], count: 0 })
async function loadWall() {
  if (!hasStaffAccess.value) return toast('荣誉墙仅对门店员工开放')
  try {
    hw.value = (await apiHonor()).data || hw.value
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
}
// 没有头像时用全站默认头像（袋鼠），之前用的是设计稿里「小院主理人」的照片，看起来像本人
const avatar = computed(() => (hw.value.avatar ? absUrl(hw.value.avatar) : '/static/media/profile-avatar.jpg'))
const daysText = computed(() => (hw.value.days ? `加入袋鼠全球青年第 ${hw.value.days} 天` : ''))
const awarded = computed(() => (hw.value.awarded || []).map(h => ({ ...h, badge: h.badge ? absUrl(h.badge) : '/static/media/honor-badge-1.jpg' })))
const pending = computed(() => (hw.value.pending || []).map(p => ({ ...p, badge: p.badge ? absUrl(p.badge) : '/static/media/honor-heart.jpg' })))

// ---------------- s=2 ----------------
const g = ref({ metrics: [], milestones: [] })
async function loadGrowth() {
  try {
    g.value = (await apiHonorGrowth()).data || g.value
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
}
const metrics = computed(() => g.value.metrics || [])
const milestones = computed(() => ((g.value.milestones || []).length ? g.value.milestones : [{ date: '—', text: '经营数据达到里程碑、获得荣誉后会记录在这里' }]))
const fullStars = computed(() => Math.floor(Number(g.value.goodStars || 0)))
const halfStar = computed(() => Number(g.value.goodStars || 0) - fullStars.value >= 0.5)
const adviceIntro = computed(() => (g.value.advice ? '根据近 30 天评价的分项得分，为你提供以下改进建议：' : '近 30 天没有得分偏低的评价分项，继续保持'))
const openTrend = () => go(R.dashboard + '?view=trend')
const openAdvice = () => go(R.dashboard + '?view=reviews')
// 好评率、活动人次是本人所有主理 / 管家门店的合计，而评价管理、活动管理只看员工端当前门店：
// 有多家门店时按钮照实写「当前门店」，并把这家门店显式带上，免得把一家店的明细当成合计的明细
const multiStore = computed(() => staffStores.value.length > 1)
const reviewsBtn = computed(() => (multiStore.value ? '查看当前门店评价' : '查看评价'))
const activitiesBtn = computed(() => (multiStore.value ? '查看当前门店活动' : '查看活动'))
const openReviews = () => go(staffStoreUrl(R.staffReviews))
const openActivities = () => go(staffStoreUrl(R.staffActivities))

// ---------------- s=3 生日 ----------------
const b = ref({ conditions: [], gifts: [] })
async function loadBirthday() {
  try {
    b.value = (await apiHonorBirthday()).data || b.value
    if (!picked.value && b.value.gifts && b.value.gifts.length) picked.value = b.value.gifts[0].giftId
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
}
const benefits = [
  { label: '专属生日礼物一份', img: '/static/media/honor-benefit-1.jpg' },
  { label: '生日当天任务积分双倍', img: '/static/media/honor-benefit-2.jpg' },
  { label: '生日当天祝福消息', img: '/static/media/honor-benefit-3.jpg' }
]
const conditions = computed(() => b.value.conditions || [])
const picked = ref(0)
const gifts = computed(() => (b.value.gifts || []).map(x => ({ ...x, img: x.image ? absUrl(x.image) : '/static/media/cover-empty.png', desc: `${x.subtitle || ''} · 余 ${x.stock}` })))
const pickGift = (x) => { if (!b.value.claim) picked.value = x.giftId }
const giftStyle = (x) => (picked.value === x.giftId && !b.value.claim ? 'border: 2px solid var(--k-red);' : '')
const addr = ref({ receiver: '', phone: '', address: '' })
const addrReceiver = computed(() => (b.value.claim ? b.value.claim.receiver : addr.value.receiver || '未填写'))
const addrPhone = computed(() => (b.value.claim ? b.value.claim.phone : addr.value.phone ? addr.value.phone.slice(0, 3) + ' **** ' + addr.value.phone.slice(-4) : '未填写'))
const addrText = computed(() => (b.value.claim ? b.value.claim.address : addr.value.address || '点右上角「修改」选择微信收货地址'))
function chooseAddress() {
  if (b.value.claim) return toast('今年已经领取过了')
  if (typeof uni.chooseAddress !== 'function') return manualAddress()
  uni.chooseAddress({
    success: (r) => { addr.value = { receiver: r.userName, phone: r.telNumber, address: [r.provinceName, r.cityName, r.countyName, r.detailInfo].filter(Boolean).join(' ') } },
    fail: () => manualAddress()
  })
}
async function manualAddress() {
  const receiver = await prompt('收货人', { value: addr.value.receiver })
  if (!receiver) return
  const phone = await prompt('手机号码', { value: addr.value.phone, placeholder: '11 位手机号' })
  if (!phone) return
  if (!/^1\d{10}$/.test(phone)) return toast('请填写 11 位手机号')
  const address = await prompt('收货地址', { value: addr.value.address, placeholder: '省 市 区 详细地址' })
  if (!address) return
  addr.value = { receiver, phone, address }
}
// 生日 / 领取 / 申报都是写请求：连点会重复提交
let busy = false
async function editBirthday() {
  // 之前要按 MM-dd 手动输入，现在用月 / 日滚轮选；「不设置」清空生日
  const mmdd = await askMonthDay('你的生日', { value: b.value.birthday || '', emptyText: '不设置' })
  if (mmdd === null) return
  if (busy) return
  busy = true
  try {
    const res = await apiSetBirthday(mmdd)
    toast((res.data && res.data.message) || '已保存')
    loadBirthday()
  } catch (e) {
    toast(errText(e, '保存失败'))
  } finally {
    busy = false
  }
}
const claimText = computed(() => (b.value.claim ? b.value.claim.statusText : b.value.canClaim ? '领取生日礼物' : '暂不满足领取条件'))
async function claim() {
  if (b.value.claim) return toast(b.value.claim.statusText)
  if (!b.value.canClaim) {
    const miss = conditions.value.filter(c => !c.ok).map(c => '· ' + c.text).join('\n')
    return alert('暂不满足领取条件', miss || '请稍后再试')
  }
  if (!picked.value) return toast('请选择一份礼物')
  if (!addr.value.receiver || !addr.value.phone || !addr.value.address) return chooseAddress()
  const gift = gifts.value.find(x => x.giftId === picked.value)
  if (!(await confirm('领取生日礼物', `领取「${gift ? gift.name : '礼物'}」，寄到 ${addr.value.address}？`)) || busy) return
  busy = true
  try {
    const res = await apiClaimGift({ giftId: picked.value, ...addr.value })
    toast((res.data && res.data.message) || '已领取')
    loadBirthday()
  } catch (e) {
    toast(errText(e, '领取失败'))
  } finally {
    busy = false
  }
}

// ---------------- s=4 申报 ----------------
const opts = ref({ types: [], helps: [], options: [] })
async function loadOptions() {
  try {
    opts.value = (await apiAppealOptions()).data || opts.value
  } catch (e) {
    toast(errText(e, '加载失败'))
  }
}
const form = ref({ type: '', bizType: '', bizId: null, bizLabel: '', content: '', help: '' })
const proofs = ref([])
const contentPreview = computed(() => (form.value.content ? (form.value.content.length > 40 ? form.value.content.slice(0, 40) + '…' : form.value.content) : '请详细描述事情经过（不少于20字）'))
async function pickType() {
  const list = opts.value.types.length ? opts.value.types : ['差评申诉', '客人无理投诉', '平台规则争议', '任务验收争议', '其他']
  const i = await sheet(list)
  if (i >= 0) form.value.type = list[i]
}
async function pickRelated() {
  const list = opts.value.options || []
  if (!list.length) return toast('没有可关联的订单、评价或任务')
  const i = await pickPaged(['不关联', ...list.map(o => o.label)], '关联订单')
  if (i < 0) return
  if (i === 0) Object.assign(form.value, { bizType: '', bizId: null, bizLabel: '' })
  else Object.assign(form.value, { bizType: list[i - 1].bizType, bizId: list[i - 1].bizId, bizLabel: list[i - 1].label })
}
async function editContent() {
  const v = await prompt('事情经过（20–500 字）', { value: form.value.content, placeholder: '时间、地点、经过、你的感受' })
  if (v !== null) form.value.content = v.trim().slice(0, 500)
}
async function pickHelp() {
  const list = [...(opts.value.helps || []), '自定义…']
  const i = await sheet(list)
  if (i < 0) return
  if (i === list.length - 1) {
    const v = await prompt('希望获得的帮助', { value: form.value.help })
    if (v !== null) form.value.help = v.trim().slice(0, 200)
  } else {
    form.value.help = list[i]
  }
}
async function addProofs() {
  if (proofs.value.length >= 6) return toast('最多 6 张')
  const paths = await chooseImages(6 - proofs.value.length)
  for (const p of paths) {
    try {
      proofs.value.push((await uploadTo('/app/upload/image', p)).data.url)
    } catch (e) {
      toast(errText(e, '上传失败'))
    }
  }
}
async function submitAppeal() {
  const f = form.value
  if (!f.type) return toast('请选择事件类型')
  if (f.content.length < 20) return toast('事情经过不少于 20 字')
  if (!f.help) return toast('请选择希望获得的帮助')
  if (busy) return
  busy = true
  try {
    const res = await apiAppeal({ type: f.type, bizType: f.bizType, bizId: f.bizId, bizLabel: f.bizLabel, content: f.content, help: f.help, proofs: proofs.value })
    toast((res.data && res.data.message) || '申报已提交')
    form.value = { type: '', bizType: '', bizId: null, bizLabel: '', content: '', help: '' }
    proofs.value = []
  } catch (e) {
    toast(errText(e, '提交失败'))
  } finally {
    busy = false
  }
}
</script>

<style scoped lang="scss">
.section-title{font-family:var(--k-serif);font-size:17px;font-weight:700}.person{height:75px;padding:0 12px;border:1px solid var(--k-line);border-radius:11px;background:var(--k-paper);display:flex;align-items:center;gap:12px}.person image{width:57px;height:57px;border-radius:50%}.person__name{display:block;font-family:var(--k-serif);font-size:18px;font-weight:700}.person__days{display:block;margin-top:8px;color:var(--k-muted);font-size:13px}.section-line{margin:15px 2px 9px}.section-count{font-family:var(--k-sans);font-size:15px}.honor-list{display:flex;flex-direction:column;gap:10px}.honor-card{position:relative;min-height:113px;padding:10px 11px;border:1px solid var(--k-line);border-radius:11px;background:var(--k-paper);display:flex;align-items:center;gap:13px}.honor-card>image{width:115px;height:92px}.honor-card__title{display:block;padding-right:62px;font-family:var(--k-serif);font-size:18px;font-weight:700}.honor-card__line{display:block;margin-top:10px;color:var(--k-muted);font-size:11px;line-height:1.45}.honor-card>.k-chip{position:absolute;right:11px;top:13px}.honor-card--pending{min-height:119px}.progress{height:6px;margin-top:9px;border-radius:4px;background:#E6E0D6;overflow:hidden}.progress view{width:72%;height:100%;background:#CC8C2E}.more-honors{position:relative;height:50px;margin-top:11px;padding:0 10px;display:flex;align-items:center;gap:5px;color:#9A6A22;font-size:12px}.more-honors image{position:absolute;right:50px;width:62px;height:62px;opacity:.5}
.growth-data{padding:12px;border:1px solid var(--k-line);border-radius:11px;background:var(--k-paper)}.growth-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.growth-metric{height:78px;border:1px solid var(--k-line);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:11px}.growth-metric{padding:0 2px;text-align:center}.growth-metric>text:nth-child(2){max-width:100%;font-family:var(--k-sans);font-size:17px;overflow-wrap:anywhere}.growth-section{display:block;margin-top:14px}.timeline{margin-top:9px}.timeline__row{height:31px;display:grid;grid-template-columns:23px 70px 1fr;align-items:center;font-size:13px}.timeline__track{position:relative;height:31px;display:flex;justify-content:center}.timeline__dot{z-index:1;width:8px;height:8px;margin-top:11px;border-radius:50%;background:#777}.timeline__dot.active{width:14px;height:14px;margin-top:8px;background:#BE7B23;display:flex;align-items:center;justify-content:center}.timeline__line{position:absolute;top:18px;bottom:-13px;width:1px;background:var(--k-line2)}.growth-cards{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.growth-card{min-height:134px;padding:11px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper)}.growth-card__big{display:block;margin-top:10px;font-size:14px}.star-row{display:flex;margin:10px 0}.growth-card .k-button{margin-top:10px}.suggest{margin-top:10px;padding:11px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper)}.suggest__intro{display:block;margin-top:8px;color:var(--k-muted);font-size:11px}.suggest__item{margin:8px 0;padding:8px;border:1px solid var(--k-line);border-radius:8px;display:flex;align-items:center;gap:8px}.suggest__item text{display:block;font-size:11px}.suggest__item text:first-child{font-weight:700;margin-bottom:4px}
.birthday{height:106px;padding:0 14px;border:1px solid var(--k-line);border-radius:11px;background:linear-gradient(90deg,#FFF8EC,#F4E7D8);display:flex;align-items:center;justify-content:space-between}.birthday__title{display:block;color:#985C29;font-family:var(--k-serif);font-size:17px;font-weight:700}.birthday__desc{display:block;margin-top:9px;color:#9B7657;font-size:12px}.birthday__date{width:110px;height:25px;margin-top:13px;border:1px solid #D9BE99;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#9B7657;font-size:12px}.birthday image{width:115px;height:98px}.benefits{margin-top:10px;padding:13px;border:1px solid var(--k-line);border-radius:11px;background:var(--k-paper)}.benefit-grid{display:grid;grid-template-columns:repeat(3,1fr);margin-top:12px}.benefit{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;font-size:11px;border-left:1px solid var(--k-line)}.benefit:first-child{border-left:0}.benefit image{width:44px;height:44px}.benefits__line{margin:12px 0;border-top:1px solid var(--k-line)}.checks{margin-top:8px}.check-row{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px}.check-row>view{width:14px;height:14px;border-radius:4px;background:var(--k-green);display:flex;align-items:center;justify-content:center}.gift-section{display:block;margin-top:12px}.gift-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:7px}.gift{height:62px;padding:0 7px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);display:flex;align-items:center;gap:7px}.gift image{flex-shrink:0;width:42px;height:50px}.gift>view{min-width:0}.gift text{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--k-sans);font-size:13px}.gift text:last-child{margin-top:5px;color:var(--k-muted);font-family:var(--k-sans);font-size:11px}.address{margin-top:9px;padding:10px 12px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper)}.address>text{display:block;margin-top:6px;font-size:11px}.gift-submit{margin-top:9px}
.appeal-intro{height:70px;padding:0 12px 8px;border-bottom:1px solid var(--k-line);display:flex;align-items:center;justify-content:space-between}.appeal-intro text{display:block;font-family:var(--k-serif);font-size:14px;font-weight:700;margin-top:8px}.appeal-intro image{width:76px;height:55px}.appeal-field{margin-top:12px}.appeal-label{display:flex;align-items:center;font-family:var(--k-serif);font-size:15px;font-weight:700;margin-bottom:7px}.appeal-label>text+text{margin-left:5px;color:var(--k-red)}.appeal-input>text{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.appeal-input{height:36px;padding:0 10px;border:1px solid var(--k-line);border-radius:7px;background:var(--k-paper);display:flex;align-items:center;justify-content:space-between;color:var(--k-muted);font-size:12px}.appeal-area{min-height:67px;gap:6px;word-break:break-all;padding:10px;border:1px solid var(--k-line);border-radius:7px;background:var(--k-paper);display:flex;flex-direction:column;justify-content:space-between;color:var(--k-muted);font-size:12px}.appeal-area text:last-child{text-align:right}.appeal-area--short{min-height:52px}.appeal-upload{width:138px;height:58px;border:1px dashed var(--k-line2);border-radius:8px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px}.appeal-upload text:last-child{color:var(--k-muted);font-size:10px}.protection{height:49px;margin-top:11px;padding:0 11px;border:1px solid var(--k-line);border-radius:9px;background:var(--k-paper);display:flex;align-items:center}.protection>view{flex:1;display:flex;align-items:center;gap:8px}.protection text{display:block;font-size:12px}.protection text:last-child{margin-top:3px;color:var(--k-muted);font-size:10px}.protection__line{flex:0 0 auto!important;width:1px;height:30px;background:var(--k-line)}.appeal-submit{margin-top:9px}
.links{display:flex;gap:8px;margin-top:10px}.links__item{flex:1;height:34px;border:1px solid var(--k-line);border-radius:8px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;gap:2px;font-size:13px}
.growth-page .growth-card{height:134px;min-height:0;box-sizing:border-box;padding:10px}.growth-page .growth-card__big{margin-top:8px}.growth-page .star-row{margin:8px 0}.growth-page .growth-card .k-button{margin-top:7px}.growth-page .suggest{margin-top:9px;padding:9px}.growth-page .suggest__intro{margin-top:6px}.growth-page .suggest__item{margin:6px 0;padding:6px}.growth-page .suggest__item text:first-child{margin-bottom:3px}
</style>
