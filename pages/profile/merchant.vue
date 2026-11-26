<template>
  <k-feature-gate feature="recruitment">
  <view class="k-page merchant" :class="$userSurface">
    <k-topbar title="成为商家" back />
    <view class="k-body k-pad-safe">
      <!-- 顶部暖色卡：袋鼠贴纸 + 一句话（2026-10-18 主人：「更多服务里增加成为商家」） -->
      <view class="hero">
        <view class="hero__copy">
          <text class="hero__eyebrow">袋鼠全球青年 · 商家招募</text>
          <view class="hero__title"><text class="hero__line">把你的小店，</text><text class="hero__line">带给爱旅行的年轻人</text></view>
          <text class="hero__sub">民宿、酒店、咖啡餐饮、酒吧都可以申请入驻，招换工、兼职、全职或发线上任务</text>
        </view>
        <image class="hero__kg" src="/pages/profile/static/merchant-courtyard.png" mode="aspectFit" />
      </view>

      <!-- 11-18 第三轮返修（第 3 轮）：申请进度紧跟头图（回来看进度的人第一眼就看到），不再排在四张合作介绍后面。
           审核中和已联系的申请只显示进度，通过后可进商家端，退回后可重新申请。 -->
      <view v-if="latest" class="status">
        <view class="status__head">
          <view class="status__dot" :class="['is-' + latest.status, { 'is-nogrant': latest.status === 'settled' && !merchantGrant }]" />
          <text class="status__title">{{ latest.storeName }}</text>
          <text class="status__tag">{{ latest.storeTypeLabel }}</text>
        </view>
        <text class="status__text">{{ latest.statusText }}</text>
        <text class="status__meta">{{ statusMeta }}</text>
      </view>
      <!-- 合作介绍：只写平台真有的做法，不写数字和承诺；具体合作方式入驻沟通时再谈 -->
      <text class="sec">和袋鼠合作</text>
      <view class="perks">
        <view v-for="perkItem in PERKS" :key="perkItem.title" class="perk">
          <view class="perk__icon"><k-icon :name="perkItem.icon" :size="22" color="red" /></view>
          <text class="perk__title">{{ perkItem.title }}</text>
          <text class="perk__text">{{ perkItem.text }}</text>
        </view>
      </view>

      <!-- 11-18 返修（第 2 轮）：订阅提醒条从页面最上面挪到这里（申请进度下面、表单前面），不再抢头图的焦点；组件和显示条件不变 -->
      <k-subscribe scenes="account" label="订阅入驻审核提醒" />
      <k-button v-if="loaded && merchantGrant" block class="enter" :disabled="entering" :label="entering ? '正在进入…' : '进入商家端'" @click="enterMerchant()" />

      <view v-if="loaded && !merchantGrant && !waiting" class="form">
        <text class="form__title">{{ latest ? '再提交一份申请' : '入驻申请' }}</text>
        <text class="form__tip">提交资料后由平台审核，通过后开通商家身份并通知你。</text>
        <view class="draft-tools">
          <text class="draft-note" :class="{ 'draft-note--error': draftError }" role="status">{{ draftError || draftNotice || '填写内容自动保存在本机，返回本页可继续。' }}</text>
          <view class="draft-actions"><button :disabled="submitting" @click="saveDraft(true)">保存草稿</button><button :disabled="submitting" @click="discardDraft">清空草稿</button></view>
        </view>
        <k-field v-model="form.contactName" row label="联系人" required placeholder="怎么称呼你" :maxlength="32" />
        <view class="verify">
          <view class="verify__text">
            <text>门店联系电话</text>
            <text class="verify__number">{{ verifiedPhone ? verifiedPhone + '　已验证' : '尚未验证' }}</text>
            <text class="verify__hint">{{ verifiedPhone ? '提交申请时会使用这个号码。' : '用微信验证本人手机号后，可继续提交申请。' }}</text>
          </view>
          <!-- #ifdef MP-WEIXIN -->
          <view v-if="phoneConsentVersions && !alreadyConsented" class="verify__legal">
            <text>请阅读</text>
            <text v-for="item in phoneDocs" :key="item.key" class="k-link" @click="openPhoneDoc(item.key)">《{{ item.title }}》{{ phoneReads[item.key] ? '✓' : '' }}</text>
          </view>
          <button v-if="phoneConsentFailed" class="verify__go" @click="loadPhoneConsent">重新加载协议</button>
          <button v-else class="verify__go" :disabled="submitting || phoneBusy" :open-type="canAuthorizePhone ? 'getPhoneNumber' : ''" @click="explainPhoneConsent" @getphonenumber="verifyMerchantPhone">{{ phoneBusy ? '正在验证…' : alreadyConsented ? (verifiedPhone ? '更换手机号' : '微信验证手机号') : (verifiedPhone ? '同意协议并更换手机号' : '同意协议并验证手机号') }}</button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <text class="verify__hint">请在微信小程序内验证或更换手机号。</text>
          <!-- #endif -->
          <text v-if="phoneError" class="verify__error" role="alert">{{ phoneError }}</text>
        </view>
        <view class="pick pick--row">
          <view class="pick__label"><text>城市</text><text class="req">*</text></view>
          <view class="pick__box" hover-class="k-press" @click="pickCity"><text :class="{ 'k-placeholder': !form.city }">{{ form.city || '店在哪个城市' }}</text><k-icon name="chevron-right" :size="16" color="muted" /></view>
        </view>
        <view class="pick pick--row">
          <view class="pick__label"><text>店铺类型</text><text class="req">*</text></view>
          <view class="pills" :class="storeTypes.length === 5 ? 'pills--5' : 'pills--3'">
            <view v-for="typeItem in storeTypes" :key="typeItem.value" class="pill" :class="{ on: form.storeType === typeItem.value }" hover-class="k-press" @click="form.storeType = typeItem.value"><text>{{ typeItem.label }}</text></view>
          </view>
        </view>
        <k-field v-model="form.storeName" row label="店铺名称" required placeholder="例如：喜洲·云边小院" :maxlength="64" />
        <k-field v-model="form.intro" label="简单介绍" hint="（选填）" type="textarea" counter placeholder="店在哪、有几间房 / 几个座位、店里的氛围，想找什么样的人" :maxlength="500" />
        <k-button block class="submit" :disabled="submitting || phoneBusy" :label="submitting ? '提交中…' : '提交审核'" @click="submit" />
        <text class="foot">提交即表示同意平台审核这些资料，并用你验证过的手机号联系你。审核通过前不会开通商家身份。</text>
      </view>
      <view v-else-if="!loaded" class="state"><text class="k-meta">{{ loadError || '正在读取…' }}</text><k-button v-if="loadError" type="ghost" size="sm" label="重新加载" @click="load" /></view>
    </view>
  </view>
  </k-feature-gate>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 成为商家（2026-10-18，V56；2026-10-30 主人：去掉「想招的人」，填完即通过，V63）：袋鼠合作介绍 + 入驻申请表。
//   GET /app/merchant/apply 读我最近一份申请（latest 为 null = 没交过）和店铺类型选项；POST 同一个地址提交。
//   approved = true：门店和合作商家授权已开通，刷新账号后直接进商家端。
//   approved = false：合作商家授权被撤销过或门店被停用，落「待联系」等后台处理，这时只显示进度。
//   后台「袋鼠小院 → 商家入驻申请」照旧能看能跟进。
// ---------------------------------------------------------------------------
import { ref, reactive, computed, watch } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { toast } from '@/common/screen.js'
import { apiLegal, apiMeAuthorizations, apiMerchantApply, apiSubmitMerchantApply } from '@/common/api.js'
import { bindWechatPhone } from '@/common/phone-binding.js'
import { loadLegalVersions } from '@/common/legal-state.js'
import { post } from '@/common/request.js'
import { ensureSession, experience, refreshAccount, setStaffStore, staffStores, switchMode } from '@/common/experience.js'
import { alert, confirm, errText } from '@/common/ui.js'
import { emptyMerchantForm, readMerchantDraft, saveMerchantDraft, removeMerchantDraft } from './merchant-draft.js'
import { selectCity } from '@/common/city-picker.js'
import R from '@/common/routes.js'

const PERKS = [
  { icon: 'handshake', title: '直营或合作', text: '直营、合作两种方式，按门店情况沟通' },
  { icon: 'shield-check', title: '平台核验', text: '实地探访或线上采访，通过后展示核验标识' },
  { icon: 'heart-handshake', title: '岗位可含保险', text: '换工、员工保险按具体岗位配置' },
  { icon: 'users', title: '找到合适的人', text: '展示岗位与房源，在手机上处理报名' }
]
// 服务端没回选项时用这一份（和后端 KgMerchantApplyService 同一套）
const STORE_TYPES = [{ value: 'homestay', label: '民宿' }, { value: 'hotel', label: '酒店' }, { value: 'cafe', label: '咖啡餐饮' }, { value: 'bar', label: '酒吧' }, { value: 'other', label: '其他' }]

const loaded = ref(false)
const loadError = ref('')
const latest = ref(null)
const storeTypes = ref(STORE_TYPES)
const form = reactive(emptyMerchantForm())
const draftNotice = ref(''), draftError = ref('')
const phoneBusy = ref(false), phoneError = ref('')
const phoneDocs = [{ key: 'terms', title: '用户协议' }, { key: 'privacy', title: '隐私政策' }]
const phoneConsentVersions = ref(null), phoneReads = ref({}), alreadyConsented = ref(false), phoneConsentFailed = ref(false)
let consentRequest = 0
let applicationRequest = 0
const verifiedPhone = computed(() => experience.account?.phoneVerified === true && /^1\d{2}\*{4}\d{4}$/.test(experience.account.phone) ? experience.account.phone : '')
const canAuthorizePhone = computed(() => !!phoneConsentVersions.value && phoneDocs.every(({ key }) => phoneReads.value[key] === phoneConsentVersions.value[key + 'Version']))
let draftOwner = null, draftReady = false, initialized = false, submitted = false, alive = true
function restoreDraft() {
  draftReady = false; submitted = false
  draftOwner = experience.account?.id || null
  draftNotice.value = ''; draftError.value = ''
  Object.assign(form, emptyMerchantForm())
  if (!draftOwner) return
  try {
    const saved = readMerchantDraft(draftOwner)
    if (saved) { Object.assign(form, saved); draftNotice.value = '已恢复本机草稿，可继续填写。' }
    else form.contactName = experience.account?.nickname || ''
  } catch { draftError.value = '草稿读取失败，请检查本机存储后重试。' }
  draftReady = true
}
function saveDraft(manual = false) {
  if (!draftReady || submitted || draftOwner !== experience.account?.id) {
    if (manual) toast('请先登录后保存申请')
    return false
  }
  try {
    const saved = saveMerchantDraft(draftOwner, form)
    draftError.value = ''
    draftNotice.value = saved ? '草稿已保存在本机，返回本页可继续。' : '还没有需要保存的内容。'
    if (manual) toast(saved ? '申请草稿已保存到本机' : '请先填写申请内容')
    return true
  } catch {
    draftError.value = '草稿未能保存，请留在本页，清理本机存储后重试。'
    if (manual) toast('草稿保存失败，请重试')
    return false
  }
}
async function discardDraft() {
  const owner = draftOwner
  if (!owner || !await confirm('清空草稿', '清空本机保存的入驻申请，重新填写？') || !alive || owner !== experience.account?.id) return
  try {
    removeMerchantDraft(owner)
    draftReady = false; Object.assign(form, emptyMerchantForm()); draftReady = true
    draftError.value = ''; draftNotice.value = '草稿已清空。'
  } catch { draftError.value = '草稿清空失败，请重试。' }
}
watch(form, () => saveDraft(), { deep: true, flush: 'sync' })
watch(() => experience.account?.id, () => {
  if (!initialized || !alive) return
  consentRequest++
  phoneConsentVersions.value = null; phoneReads.value = {}; alreadyConsented.value = false; phoneError.value = ''; phoneConsentFailed.value = false
  restoreDraft(); latest.value = null; loaded.value = false; waiting.value = false
  if (draftOwner) load()
}, { flush: 'sync' })
onHide(() => saveDraft())
onUnload(() => { saveDraft(); alive = false; draftReady = false })
const submitting = ref(false)
const entering = ref(false)
// 审核中或已联系时只显示进度。
const waiting = ref(false)
const merchantGrant = computed(() => staffStores.value.find(g => g.roleCode === 'merchant') || null)
async function loadPhoneConsent() {
  const owner = experience.account?.id
  const request = ++consentRequest
  const current = () => alive && owner === experience.account?.id && request === consentRequest
  phoneConsentVersions.value = null; phoneReads.value = {}; alreadyConsented.value = false
  phoneConsentFailed.value = false; phoneError.value = ''
  if (!owner) return
  try {
    const [versions, auth] = await Promise.all([loadLegalVersions(apiLegal), apiMeAuthorizations()])
    if (!current()) return
    const reads = {}
    for (const { key } of phoneDocs) {
      const version = versions[key + 'Version']
      if (auth.data?.consents?.some(c => c.doc === key && c.version === version)) reads[key] = version
    }
    phoneReads.value = reads
    alreadyConsented.value = phoneDocs.every(({ key }) => !!reads[key])
    phoneConsentVersions.value = versions
  } catch (e) {
    if (current()) { phoneConsentFailed.value = true; phoneError.value = errText(e, '协议加载失败，请重试') }
  }
}
function openPhoneDoc(key) {
  const versions = phoneConsentVersions.value
  const owner = experience.account?.id
  if (!versions || !owner) return
  uni.navigateTo({ url: R.legal + '?key=' + key, events: { read: doc => {
    if (!alive || owner !== experience.account?.id || versions !== phoneConsentVersions.value || doc?.key !== key) return
    if (doc.version === versions[key + 'Version']) {
      phoneReads.value = { ...phoneReads.value, [key]: doc.version }
    } else {
      loadPhoneConsent()
    }
  } } })
}
function explainPhoneConsent() {
  if (!canAuthorizePhone.value) toast(phoneConsentVersions.value ? '请打开两份协议，读完后返回验证' : '正在读取协议，请稍候')
}
async function verifyMerchantPhone(event) {
  if (submitting.value || phoneBusy.value || !canAuthorizePhone.value) return
  const owner = experience.account?.id
  const versions = phoneConsentVersions.value
  if (!owner || owner !== draftOwner) return
  const current = () => alive && owner === experience.account?.id && owner === draftOwner
  phoneBusy.value = true; phoneError.value = ''
  try {
    const account = await bindWechatPhone(event, { agreed: true, isCurrent: current, beforeVerify: async () => {
      try { await post('/app/me/consent/legal', versions) }
      catch (error) { if (current() && error?.code === 409) await loadPhoneConsent(); throw error }
    } })
    if (!current()) return
    if (account.phoneVerified !== true || !verifiedPhone.value) throw new Error('尚未确认手机号已验证，请重试')
    alreadyConsented.value = true
    toast('手机号已验证，可以继续填写')
  } catch (error) {
    if (current()) phoneError.value = errText(error, '验证失败，请再试一次')
  } finally { phoneBusy.value = false }
}

const statusMeta = computed(() => {
  const x = latest.value || {}
  return [x.city, x.createTime ? String(x.createTime).slice(0, 10) + ' 提交' : ''].filter(Boolean).join(' · ')
})

async function load() {
  const owner = experience.account?.id
  const request = ++applicationRequest
  const current = () => alive && owner === experience.account?.id && request === applicationRequest
  loadError.value = ''
  try {
    const d = (await apiMerchantApply()).data || {}
    if (!current()) return
    latest.value = d.latest || null
    const wasWaiting = waiting.value
    waiting.value = d.latest?.canResubmit != null
      ? !d.latest.canResubmit
      : (d.latest?.open ?? ['new', 'contacted'].includes(d.latest?.status))
    if (wasWaiting && !waiting.value) submitted = false
    if (Array.isArray(d.storeTypes) && d.storeTypes.length) storeTypes.value = d.storeTypes
    // 后台刚把申请改成「已入驻」并开通了商家身份，本机的账号还是旧的：先读一次账号，进商家端的按钮才出来，不再露出申请表
    if (d.latest && d.latest.merchantActive && !merchantGrant.value) await refreshAccount().catch(() => {})
    if (!current()) return
    loaded.value = true
    // #ifdef MP-WEIXIN
    if (!merchantGrant.value && !waiting.value && !phoneConsentVersions.value && !phoneConsentFailed.value) loadPhoneConsent()
    // #endif
  } catch (e) {
    if (current()) loadError.value = errText(e, '读取失败，请重试')
  }
}
onLoad(async () => {
  await ensureSession()
  if (!alive) return
  restoreDraft()
  initialized = true
  load()
})
onShow(() => {
  if (!initialized || !experience.account?.id) return
  refreshAccount().catch(() => {})
  if (loaded.value && !submitting.value) load()
})

async function pickCity() {
  const owner = experience.account?.id
  const v = await selectCity({ title: '店在哪个城市', value: form.city })
  if (v !== null && alive && owner === experience.account?.id) form.city = v
}
// 前端先挡一遍常见漏填（服务端照样每一项都校验）
function check() {
  if (!verifiedPhone.value) return '请先验证手机号'
  if (!form.contactName.trim()) return '请填写联系人'
  if (!form.city) return '请选择城市'
  if (!form.storeType) return '请选择店铺类型'
  if (!form.storeName.trim()) return '请填写店铺名称'
  return ''
}
// 进商家端：先把新授权读回来，当前门店切到开通的这家，再换成员工身份（商家端是员工身份下的三页）
async function enterMerchant(storeId = latest.value?.merchantActive ? latest.value.storeId : null) {
  if (entering.value) return
  const owner = experience.account?.id
  const current = () => alive && owner === experience.account?.id
  entering.value = true
  try {
    await refreshAccount()
    if (!current()) return
    const list = staffStores.value.filter(g => g.roleCode === 'merchant')
    const grant = storeId == null ? list[0] : list.find(g => String(g.storeId) === String(storeId))
    if (!grant) return toast('这家门店的商家身份还没生效，请稍后再试')
    setStaffStore(grant.storeId)
    uni.reLaunch({ url: switchMode('staff') })
  } catch (e) {
    if (current()) toast(errText(e, '进入商家端失败，请重试'))
  } finally {
    entering.value = false
  }
}
async function submit() {
  if (waiting.value || submitting.value || phoneBusy.value) return
  const bad = check()
  if (bad) return toast(bad)
  submitting.value = true
  const owner = experience.account?.id
  try {
    const { contactName, city, storeType, storeName, intro } = form
    const res = await apiSubmitMerchantApply({ contactName, city, storeType, storeName, intro, useVerifiedPhone: true, expectedPhoneMask: verifiedPhone.value })
    if (!alive || owner !== experience.account?.id) return
    applicationRequest++
    submitted = true
    try { removeMerchantDraft(owner) } catch { draftError.value = '申请已提交，本机旧草稿清理失败。' }
    const d = res.data || {}
    latest.value = d.latest || null
    if (d.approved) {
      await alert('已开通', d.message || '已通过，可以开始发布招募了')
      if (!alive || owner !== experience.account?.id) return
      await enterMerchant(d.storeId)
      return
    }
    waiting.value = true
    toast(d.message || '已提交')
    uni.pageScrollTo({ scrollTop: 0, duration: 200 })
  } catch (e) {
    if (!alive || owner !== experience.account?.id) return
    if (e?.code === 428 || e?.code === 409) {
      await refreshAccount().catch(() => {})
      if (!alive || owner !== experience.account?.id) return
      if (e.code === 409) await load()
      if (!alive || owner !== experience.account?.id) return
    }
    toast(errText(e, '提交失败，请重试'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
@import '../../styles/look.scss';
.merchant { font-size: 14px; line-height: 1.6; }
/* 顶部暖卡：和会员卡同一套奶茶色渐变，右边袋鼠贴纸 */
.hero { position: relative; display: flex; align-items: center; gap: 10px; margin-top: 4px; padding: 18px 14px 18px 16px; border-radius: 16px; overflow: hidden;
  background: linear-gradient(118deg, #FBF1E4 0%, #F5E2CB 52%, #EDD1B2 100%); box-shadow: 0 1px 3px rgba(122, 82, 48, .08), 0 8px 22px rgba(154, 107, 63, .16); }
.hero::after { content: ""; position: absolute; right: -30px; top: -40px; width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, .55) 0%, rgba(255, 255, 255, 0) 70%); }
.hero__copy { position: relative; z-index: 1; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.hero__eyebrow { font-size: 12px; font-weight: 600; color: #74502F; letter-spacing: 1px; }
.hero__title { font-size: 20px; font-weight: 700; line-height: 1.4; color: #5E3D1F; }
.hero__sub { font-size: 13px; line-height: 1.6; color: #74502F; }
.hero__kg { position: relative; z-index: 1; flex: 0 0 auto; width: 76px; height: 82px; }
.sec { display: block; margin: 20px 2px 10px; font-size: 17px; font-weight: 700; color: var(--k-ink); }
/* 合作介绍：两列白卡，图标圆底 + 标题 + 两三行说明，高度按内容对齐 */
.perks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.perk { display: flex; flex-direction: column; gap: 6px; padding: 14px 12px; border-radius: 16px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.perk__icon { width: 36px; height: 36px; border-radius: 50%; background: var(--k-ochre-soft, #F6EBDD); display: flex; align-items: center; justify-content: center; }
.perk__title { font-size: 15px; font-weight: 700; color: var(--k-ink); }
.perk__text { font-size: 12px; line-height: 1.6; color: var(--k-ink2); }
/* 进度卡：左边状态圆点（待联系赭黄、已联系蓝、已入驻绿、暂不合作灰） */
.status { margin-top: 16px; padding: 14px 16px; border-radius: 16px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.status__head { display: flex; align-items: center; gap: 8px; }
.status__dot { flex: 0 0 auto; width: 10px; height: 10px; border-radius: 50%; background: var(--k-ochre); box-shadow: 0 0 0 3px var(--k-ochre-soft, #F6EBDD); }
.status__dot.is-contacted { background: var(--k-indigo); box-shadow: 0 0 0 3px var(--k-indigo-soft); }
.status__dot.is-settled { background: var(--k-green); box-shadow: 0 0 0 3px var(--k-green-soft); }
.status__dot.is-rejected { background: var(--k-light); box-shadow: 0 0 0 3px var(--k-paper2); }
.status__title { flex: 1; min-width: 0; font-size: 16px; font-weight: 700; color: var(--k-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.status__tag { flex: 0 0 auto; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--k-paper2); font-size: 12px; line-height: 22px; color: var(--k-ink2); }
.status__text { display: block; margin-top: 8px; font-size: 15px; color: var(--k-ink); }
.status__meta { display: block; margin-top: 4px; font-size: 12px; color: var(--k-muted); }
/* 申请表：一张白卡，项与项之间 14px */
.form { display: flex; flex-direction: column; gap: 14px; margin-top: 16px; padding: 16px 14px 18px; border-radius: 16px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.form__title { font-size: 17px; font-weight: 700; color: var(--k-ink); }
.form__tip { margin-top: -10px; font-size: 12px; color: var(--k-muted); }
.req { margin-left: 2px; color: var(--k-red); }
.pick { display: flex; flex-direction: column; gap: 8px; }
/* 和 k-field 的标签同一个样子（13px、500），一张表里的标签一致 */
.pick__label { display: flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 500; color: var(--k-ink); }
.pick__hint { margin-left: 4px; font-size: 13px; font-weight: 400; color: var(--k-light); }
.pick__box { display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--k-line2); background: var(--k-paper); font-size: 15px; color: var(--k-ink); }
/* 胶囊：等宽格子排，每行对齐不留空位；选中暖棕描边 + 浅底。
   店铺类型 5 个（10-19 复查：之前 3 列、第二行空一格）：6 等分，第一行 3 个各占 2 格、第二行 2 个各占 3 格，两行都排满；服务端给的不是 5 个就排 3 列 */
.pills { display: grid; gap: 8px; }
.pills--5 { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.pills--5 .pill { grid-column: span 2; }
.pills--5 .pill:nth-child(n+4) { grid-column: span 3; }
.pills--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pill { display: flex; align-items: center; justify-content: center; gap: 3px; height: 36px; border-radius: 18px; background: var(--k-paper2); box-shadow: inset 0 0 0 1px var(--k-line); font-size: 14px; color: var(--k-ink2); white-space: nowrap; }
.pill.on { background: #F8EEE2; box-shadow: inset 0 0 0 1.5px var(--k-red); color: var(--k-red-deep, #8A5E36); font-weight: 600; }
.submit { margin-top: 4px; }
.draft-tools{padding:10px 0;border-bottom:1px solid var(--k-line)}
.draft-note{display:block;font-size:12px;color:var(--k-muted);line-height:1.7}
.draft-note--error{color:var(--k-alert)}
.draft-actions{display:flex;gap:12px;margin-top:8px}
.draft-actions button{margin:0;padding:8px 14px;min-height:40px;font-size:13px;line-height:1.6;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);color:var(--k-red-deep)}
.draft-actions button::after,.verify__go::after{border:0}
.verify__hint{display:block;margin-top:4px;font-size:12px;color:var(--k-muted)}
.verify__number{display:block;margin-top:4px;color:var(--k-ink);font-weight:600}
.verify__legal,.verify__error{width:100%;font-size:12px;line-height:1.6}
.verify__legal{display:flex;flex-wrap:wrap;gap:4px}.verify__error{color:var(--k-alert)}
.verify { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: #FBF1E4; }
.verify__text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.5; color: #74502F; }
.verify__go { flex: 0 0 auto; margin:0; padding:10px; min-height:44px; line-height:1.6; border:1px solid var(--k-red-line); border-radius:10px; background:var(--k-paper); font-size: 14px; font-weight: 600; color: var(--k-red-deep); }
.enter { margin-top: 14px; }
.foot { font-size: 12px; line-height: 1.6; color: var(--k-muted); text-align: center; }
.state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 0; }
@media (max-width: 359px) {
  .hero__title { font-size: 18px; }
  .hero__kg { width: 60px; height: 66px; }
  .pill { font-size: 13px; }
}
/* ---------------------------------------------------------------------------------------------------------------
   2026-10-19 一比一还原（全局视觉语言）：暖米渐变页面底、白卡圆角 20 + 柔阴影 + 细边、标题用标题字体（700 / 900）、主按钮暖棕渐变。只改样式
   --------------------------------------------------------------------------------------------------------------- */
.merchant { --k-bg: #{$look-bg-top}; background: $look-bg; }
.hero { border-radius: 24px; background: linear-gradient(125deg, #FDF4E8 0%, #F8E6CF 50%, #F1D5B4 100%); }
.hero__title { font-family: var(--k-display-font); font-size: 22px; font-weight: 900; letter-spacing: .5px; }
.perk, .status, .form { border-radius: 20px; border: $look-hairline; box-shadow: $look-shadow; }
.perk__icon { background: linear-gradient(145deg, #FDF0DF 0%, #F6DFC2 100%); }
.perk__title, .status__title, .form__title { font-family: var(--k-display-font); font-weight: 700; }
.form__title { font-size: 18px; }
@import './merchant-premium.scss';
</style>
