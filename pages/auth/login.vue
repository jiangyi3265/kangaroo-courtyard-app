<template>
  <view class="k-page login">
    <k-topbar :title="titles[s - 1]" :back="s > 1 || canBack" custom-back @back="onBack" />
    <view v-if="legalError" class="legal-error"><text>{{ legalError }}</text><text class="k-link" @click="loadLegal">重新加载协议</text></view>

    <!-- 1 欢迎登录 -->
    <view v-if="s === 1">
      <image class="hero" src="/static/media/login-hero.jpg" mode="aspectFill" />
      <view class="welcome">
        <text v-if="employeeEntry" class="k-small k-muted">员工登录后直接进入工作台，无需填写旅行偏好。</text>
        <!-- #ifdef MP-WEIXIN -->
        <k-button block :disabled="submitting || !legalRead || !agreed" :label="submitting ? '正在登录…' : '快捷登录'" @click="startAccountLogin" />
        <text class="login-note">登录无需授权手机号；报名等需要联系方式时再绑定。</text>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <k-button block :disabled="submitting || !legalRead || !agreed" :label="devLoginAvailable ? (employeeEntry ? '员工联调登录' : '本地联调登录') : '请在小程序中登录'" @click="startWebLogin" />
        <!-- #endif -->
        <view class="btn-browse" @click="skip"><text>先逛逛</text></view>
        <!-- 2026-10-19 主人：「把员工端入口去掉，我给他权限之后，他的手机才会有员工端」—— 欢迎页（小程序启动页）人人都看得到，这里不再摆「员工入口」。
             被授权的员工照常点上面的一键登录：登录后有生效授权就直接进工作台（completeEntry），「我的」里也会出现「员工工作台」卡片。
             只有从员工页链接进来（?entry=staff，管理员发的工作台链接 / 旧书签）时才保留这个按钮：免绑手机号直接用员工授权登录 -->
        <k-button v-if="employeeEntry" type="ghost" block :disabled="submitting || !legalRead || !agreed" :label="submitting ? '正在进入…' : '员工入口'" @click="startStaffLogin" />
        <text v-if="loginError" class="k-small k-muted">{{ loginError }}</text>
        <text v-if="loginError && memberNo" class="k-small k-muted" @click="copyMemberNo">会员编号：{{ memberNo }}（点按复制，发给管理员）</text>
        <view class="agree" @click="toggleAgreement()">
          <view class="k-check" :class="{ checked: agreed }"><k-icon v-if="agreed" name="check" :size="12" color="white" :stroke="3" /></view>
          <text class="agree__text">我已阅读并同意</text>
          <text class="agree__link" @click.stop="openLegal('terms')">《用户协议》{{ readVersions.terms ? '✓' : '' }}</text><text class="agree__link" @click.stop="openLegal('privacy')">《隐私政策》{{ readVersions.privacy ? '✓' : '' }}</text>
        </view>
        <text v-if="!legalRead" class="login-note">请分别打开两份协议，阅读至末尾后再勾选同意。</text>
      </view>
    </view>

    <!-- 2 登录信息确认 -->
    <view v-else-if="s === 2" class="k-body k-pad-bottom">
      <view class="account">
        <image class="account__avatar" :src="accountAvatar" mode="aspectFill" />
        <view class="k-col k-gap4"><text class="account__name">{{ accountName }}</text><text class="k-small k-muted">{{ accountHint }}</text></view>
      </view>
      <k-card class="k-mt12" :pad="14">
        <text class="k-title">本次登录涉及的信息</text>
        <view class="k-col k-gap8 k-mt12">
          <view v-for="item in authItems" :key="item.label" class="auth-row">
            <k-icon :name="item.icon" :size="18" color="ink" :stroke="1.7" />
            <text class="auth-row__label">{{ item.label }}</text>
            <text class="k-small k-muted">{{ item.value }}</text>
          </view>
        </view>
      </k-card>
      <k-card class="k-mt12" :pad="14">
        <view class="k-row-start k-gap12">
          <k-icon name="shield-check" :size="34" color="green" :stroke="1.4" fill />
          <view class="k-flex1">
            <text class="k-title">安心与隐私说明</text>
            <text class="k-small k-muted k-mt8 notice">我们将严格遵守<text class="k-green">《隐私政策》</text>，仅按政策说明的目的和范围使用信息；报名或下单所需信息会提供给你选择的服务方。</text>
            <view class="k-row k-gap2 k-mt8" @click="openLegal('privacy')"><text class="k-link k-link--green">查看完整隐私政策</text><k-icon name="chevron-right" :size="13" color="green" /></view>
          </view>
        </view>
      </k-card>
      <view class="k-col k-gap10 k-mt16">
        <k-button block @click="s = 4">下一步</k-button>
        <view class="btn-browse" @click="s = 1"><text>暂不授权</text></view>
      </view>
      <view class="k-home-indicator" />
    </view>

    <!-- 3 隐私保护说明 -->
    <view v-else-if="s === 3" class="k-body k-pad-bottom">
      <k-card :pad="0">
        <view v-for="(item, i) in privacyItems" :key="item.title" class="privacy" :class="{ 'has-line': i < privacyItems.length - 1 }">
          <view class="k-circle k-circle--outline privacy__icon"><k-icon :name="item.icon" :size="18" color="ink" :stroke="1.5" /></view>
          <view class="k-flex1"><text class="k-subtitle">{{ item.title }}</text><text class="k-small k-muted k-mt4 privacy__copy">{{ item.copy }}</text></view>
        </view>
      </k-card>
      <view class="k-center-box k-gap2 k-mt20" @click="openLegal('privacy')"><text class="k-link k-link--green">查看完整隐私政策</text><k-icon name="chevron-right" :size="13" color="green" /></view>
      <k-button block class="k-mt16" @click="s = 4">下一步</k-button>
      <view class="k-home-indicator" />
    </view>

    <form v-else-if="s===5" class="profile-setup k-body" @submit="saveProfileAndEnter">
      <text class="profile-setup__title">让朋友认出你</text><text class="profile-setup__note">点击选择微信头像，点击昵称输入框使用微信昵称。保存后会用于评论和个人主页，也可稍后完善。</text>
      <!-- #ifdef MP-WEIXIN -->
      <button class="profile-avatar" open-type="chooseAvatar" :disabled="profileBusy" @chooseavatar="chooseProfileAvatar"><image :src="absUrl(profileAvatar)||'/static/media/profile-avatar.jpg'" mode="aspectFill"/><text>{{profileBusy?'上传中…':'选择微信头像'}}</text></button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <button class="profile-avatar" :disabled="profileBusy" @click="chooseWebAvatar"><image :src="absUrl(profileAvatar)||'/static/media/profile-avatar.jpg'" mode="aspectFill"/><text>选择头像</text></button>
      <!-- #endif -->
      <view class="profile-nickname"><text>昵称</text><input type="nickname" name="nickname" :value="profileNickname" maxlength="16" placeholder="点击使用微信昵称或自行填写" @input="profileNickname=$event.detail.value" @blur="profileNickname=$event.detail.value" /></view>
      <text v-if="profileError" class="profile-error">{{profileError}}</text>
      <button class="profile-save" form-type="submit" :disabled="profileBusy||submitting">{{submitting?'保存中…':'保存并进入'}}</button><button class="profile-skip" :disabled="profileBusy||submitting" @click="completeEntry">稍后完善，先进入</button>
    </form>

    <!-- 4 手机号绑定 -->
    <view v-else class="k-body k-pad-bottom">
      <k-card :pad="12">
        <view class="k-row-start k-gap10">
          <k-icon name="shield-check" :size="20" color="green" :stroke="1.6" fill />
          <text class="k-small k-muted k-flex1">授权手机号后完成绑定，用于报名和面试联系。取消授权也可以继续浏览。</text>
        </view>
      </k-card>
      <view class="k-row k-gap4 k-mt24"><text class="k-title">选择要绑定的手机号</text></view>
      <!-- #ifdef MP-WEIXIN -->
      <button class="quick" :disabled="submitting || !legalRead || !agreed2" :open-type="agreed2 && legalRead ? 'getPhoneNumber' : ''" @click="checkAgreement" @getphonenumber="onPhoneAuth">
        <view class="k-circle k-circle--green quick__phone"><k-icon name="phone" :size="24" color="white" :stroke="1.7" /></view>
        <view class="k-flex1"><text class="k-subtitle">{{ submitting ? '正在绑定…' : '使用微信手机号' }}</text><text class="k-text k-mt4 quick__num">在微信授权弹窗中确认号码</text></view>
      </button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view class="quick" @click="onQuickAuth">
        <view class="k-circle k-circle--green quick__phone"><k-icon name="phone" :size="24" color="white" :stroke="1.7" /></view>
        <view class="k-flex1"><text class="k-subtitle">请在小程序内授权</text><text class="k-text k-mt4 quick__num">网页端不支持手机号快捷授权</text></view>
      </view>
      <!-- #endif -->
      <view class="other-phone">
        <text class="other-phone__title">想用其他手机号？</text>
        <text class="other-phone__help">在微信授权弹窗中点「使用其他号码」或「添加其他号码」，选择或添加你本人的手机号，再确认授权。</text>
        <!-- #ifdef MP-WEIXIN -->
        <button class="other-phone__button" :disabled="submitting || !legalRead || !agreed2" :open-type="agreed2 && legalRead ? 'getPhoneNumber' : ''" @click="checkAgreement" @getphonenumber="onPhoneAuth">选择其他手机号</button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button class="other-phone__button" @click="onQuickAuth">在微信小程序中选择其他手机号</button>
        <!-- #endif -->
      </view>
      <text v-if="loginError" class="k-small k-muted k-mt16 sent">{{ loginError }}</text>
      <view class="agree agree--left k-mt12" @click="toggleAgreement(true)">
        <view class="k-circle agree__circle" :class="{ on: agreed2 }"><k-icon name="check" :size="11" color="white" :stroke="3" /></view>
        <text class="agree__text">我已阅读并同意</text>
        <text class="agree__link" @click.stop="openLegal('terms')">《用户协议》{{ readVersions.terms ? '✓' : '' }}</text><text class="agree__link" @click.stop="openLegal('privacy')">《隐私政策》</text>
      </view>
      <!-- 文案走 label：放在 k-bottom 插槽里再套一层默认插槽，小程序里动态文字可能丢 -->
      <k-bottom flat><k-button type="outline" block :disabled="submitting" :label="bindOnly ? (merchantReturn ? '暂不更换，返回申请' : '暂不更换，返回设置') : '暂不授权，先逛逛'" @click="skip" /></k-bottom>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import { useScreen, relaunch, toast, go, back } from '@/common/screen.js'
import { hasStaffAccess, switchMode, logout, resolveStaffEntry, ensureSession, experience, refreshAccount } from '@/common/experience.js'
import { apiPing, apiSaveMeProfile, apiLegal } from '@/common/api.js'
import { loadLegalVersions } from './legal-state.js'
import { post } from '@/common/request.js'
import { bindWechatPhone } from '@/common/phone-binding.js'
import { loginAccount } from '@/common/account-login.js'
import { absUrl,uploadTo,chooseImage } from '@/common/upload.js'
import R from '@/common/routes.js'
import { loginActivityReturn } from '@/common/activity-code.js'
import { partyLoginReturn } from '@/common/party-code.js'

const employeeEntry = ref(false)
const bindOnly = ref(false)
const merchantReturn = ref(false)
const profileEntry = ref(false)
const loginError = ref('')
const submitting = ref(false)
const legalReady = ref(false), legalLoading = ref(true), legalError = ref('')
const legalVersions = ref({}), readVersions = ref({})
const legalRead = computed(() => legalReady.value && ['terms', 'privacy'].every(key => readVersions.value[key] === legalVersions.value[key + 'Version']))
function openLegal(key) {
  uni.navigateTo({
    url: R.legal + '?key=' + key,
    events: { read: value => {
      if (value?.key === key && value.version === legalVersions.value[key + 'Version']) {
        readVersions.value = { ...readVersions.value, [key]: value.version }
      }
    } }
  })
}
function toggleAgreement(binding = false) {
  if (!requireLegal()) return
  if (binding) agreed2.value = !agreed2.value; else agreed.value = !agreed.value
}
async function loadLegal() {
  legalLoading.value = true; legalReady.value = false; legalError.value = ''
  agreed.value = false; agreed2.value = false; readVersions.value = {}
  try { legalVersions.value = await loadLegalVersions(apiLegal); legalReady.value = true }
  catch (e) { legalError.value = e?.message || '协议加载失败，请重试' }
  finally { legalLoading.value = false }
}
function requireLegal() {
  if (legalRead.value) return true
  if (legalReady.value) { toast('请分别打开用户协议和隐私政策，从顶部阅读至末尾'); return false }
  toast(legalLoading.value ? '正在加载协议，请稍候' : '请先重新加载协议，你也可以先逛逛')
  return false
}
const activityReturn = ref('')
let pageActive = true
onUnload(() => { pageActive = false })
// 之前：顶栏没声明 custom-back，小程序里返回一律退出登录页、H5 里却按屏号往回退（绑定手机号屏会退到「尚未登录」的授权确认屏）；
// 从订单确认等页面压进来的欢迎屏也没有返回键。现在两端一致：进页那一屏返回原页面，页内点进去的屏返回上一屏
const canBack = ref(false)
let landing = 1
const onBack = () => { if (s.value > landing) s.value -= 1; else back() }
const s = useScreen(5, { onLoad: q => {
  profileEntry.value = q.entry === 'profile'
  employeeEntry.value = q.entry === 'staff'; bindOnly.value = q.mode === 'bind-phone'
  merchantReturn.value = bindOnly.value && q.returnTo === 'merchant'
  try { activityReturn.value = partyLoginReturn(q) || loginActivityReturn(q) } catch (e) { loginError.value = e.message }
  landing = s.value
  canBack.value = getCurrentPages().length > 1
  if(s.value===5)ensureSession().then(()=>{if(!experience.account)s.value=1;else{profileNickname.value=experience.account.nickname==='小院同学'?'':experience.account.nickname||'';profileAvatar.value=experience.account.avatar||''}})
  if (s.value === 1 && !bindOnly.value && !employeeEntry.value) enterIfSignedIn()
} })
// 之前：登录页是小程序的启动页，本机令牌仍有效的老用户每次打开都停在这里，只能再授权一次手机号，
// 点「先逛逛」还会被退出登录。现在：令牌经服务端确认有效（ensureSession 会向服务端取账号）就按登录成功的去向直接进入
async function enterIfSignedIn() {
  await ensureSession()
  if (!pageActive || submitting.value || !experience.account) return
  completeEntry()
}
const titles = ['欢迎登录', '登录信息确认', '隐私保护说明', '手机号绑定','完善头像昵称']
const agreed = ref(false)
const agreed2 = ref(false)
const devLoginAvailable = ref(false)
const authItems = [
  {icon:'id-card',label:'登录凭证',value:'登录凭证，用于识别账号'},
  {icon:'user-round',label:'头像昵称',value:'绑定后由你选择填写，可跳过'}
]
// 旧授权说明深链接保留，但不伪装成当前微信个人资料。
// 原来写死的"小院手作人 + avatar-1.jpg"是设计稿示例，摆在"登录信息确认"标题下面，
// 会被当成"这就是你的微信账号"，所以昵称改成"尚未登录"。
//
// 头像则退到品牌默认图（袋鼠线稿，不是任何人）而不是置空：
// 置空会让这个固定尺寸的圆形头像位变成空洞，版式塌一块；
// 而一只袋鼠不会被误认成"你的微信头像"，不构成任何身份声明。
const accountAvatar = '/static/media/profile-avatar.jpg'
const accountName = '尚未登录'
const accountHint = '确认后完成登录，首次使用将创建袋鼠账号'
const privacyItems = [
  { icon: 'user-round', title: '使用目的', copy: '为你提供账号登录、岗位报名、旅居预订、消息沟通和售后服务。' },
  // 原文把"地区、性别"也列为收集项，后端没有这两个字段，属于对用户的过度告知，
  // 按真实采集范围改写：登录凭证、选填绑定的手机号、报名表单里填的姓名年龄等
  { icon: 'file-text', title: '信息范围', copy: '我们仅会收集你在使用服务时提供的必要信息：登录凭证、你绑定的手机号，以及报名时填写的姓名、年龄与联系方式等。' },
  { icon: 'file-clock', title: '保存期限', copy: '我们会在实现上述目的所需的最短时间内保存你的信息，或在你注销账号后删除/匿名化处理。' },
  { icon: 'file-text', title: '注销方式', copy: '可在「我的 → 账号与隐私设置 → 注销账号」自助注销：个人资料、简历与社区内容会被清除，交易与资金记录依法保留。' }
]
// 微信原生按钮取得手机号 code 后，只在服务端确认绑定时才进入业务页。
const checkAgreement = () => {
  if (!requireLegal()) return
  if (!(s.value === 1 ? agreed.value : agreed2.value)) toast('请先阅读并同意协议')
}
// 「暂无员工授权」时一并显示会员编号（账号 ID）：员工入口登录的新账号都叫「小院同学」、多半没绑手机号，管理员只能按编号找到他
const memberNo = ref('')
const copyMemberNo = () => uni.setClipboardData({ data: String(memberNo.value) })
// 记录用户本次可查阅的正文版本；发布内容变化后必须重新阅读。
const recordAgreement = async () => { if (experience.account && legalReady.value) await post('/app/me/consent/legal', legalVersions.value) }
const finishBinding = () => {
  if (merchantReturn.value) {
    const pages = getCurrentPages()
    if (pages.length > 1 && pages[pages.length - 2].route === 'pages/profile/merchant') return uni.navigateBack()
    return uni.redirectTo({ url: '/pages/profile/merchant' })
  }
  return relaunch(R.profile + '?s=4')
}
const completeEntry = () => {
  if (bindOnly.value) return finishBinding()
  if (activityReturn.value) return relaunch(activityReturn.value)
  if (profileEntry.value) return relaunch(R.profile)
  if (employeeEntry.value && !hasStaffAccess.value) {
    loginError.value = '当前账号暂无员工授权，请联系管理员绑定后重新登录。'
    memberNo.value = experience.account?.id || ''
    return
  }
  // 之前：从订单确认（填好入住人后提示「请先登录」）等页面压进来，登录后一律重启到首页，刚填的内容全丢。
  // 现在：登录页压在别的页面上时，普通用户登录后退回原页面接着操作；冷启动 / 退出登录后的登录页照旧进首页
  if (!hasStaffAccess.value && getCurrentPages().length > 1) return uni.navigateBack()
  relaunch(hasStaffAccess.value ? switchMode('staff') : R.home)
}
const profileNickname=ref(''),profileAvatar=ref(''),profileBusy=ref(false),profileError=ref('')
const offerProfile=()=>{
  const a=experience.account||{}
  if(bindOnly.value || (a.avatar && a.nickname && a.nickname!=='小院同学'))return completeEntry()
  profileNickname.value=a.nickname==='小院同学'?'':a.nickname||'';profileAvatar.value=a.avatar||'';s.value=5
}
async function chooseProfileAvatar(e){
  const file=e?.detail?.avatarUrl;if(!file||profileBusy.value)return
  const owner=experience.account?.id;profileBusy.value=true;profileError.value=''
  try{const r=await uploadTo('/app/upload/image',file);if(!pageActive||owner!==experience.account?.id)return;const url=r.data?.url||r.url||r.fileName||r.data?.fileName;if(!url)throw new Error('头像上传失败');profileAvatar.value=url}
  catch(e){profileError.value=e?.message||'头像上传失败，请重试'}finally{profileBusy.value=false}
}
async function chooseWebAvatar(){const file=await chooseImage();if(file)await chooseProfileAvatar({detail:{avatarUrl:file}})}
async function saveProfileAndEnter(event){
  if(event?.detail?.value?.nickname!==undefined)profileNickname.value=event.detail.value.nickname
  if(profileBusy.value||submitting.value)return
  const nickname=profileNickname.value.trim();if(!nickname||nickname.length>16){profileError.value='请填写1到16字昵称';return}
  const owner=experience.account?.id;submitting.value=true;profileError.value=''
  try{await apiSaveMeProfile({nickname,...(profileAvatar.value?{avatar:profileAvatar.value}:{})});if(!pageActive||owner!==experience.account?.id)return;await refreshAccount();completeEntry()}
  catch(e){profileError.value=e?.message||'资料保存失败，请重试'}finally{submitting.value=false}
}
// Explicit user login never invokes phone authorization. Failed requests are not retried automatically.
const startAccountLogin = async () => {
  if (submitting.value || !requireLegal()) return
  if (!agreed.value) return toast('请先阅读并同意协议')
  submitting.value = true; loginError.value = ''; memberNo.value = ''
  try {
    await loginAccount({ agreed: agreed.value, versions: legalVersions.value, isCurrent: () => pageActive })
    if (pageActive) offerProfile()
  } catch (error) {
    if (!pageActive) return
    loginError.value = error?.message || '登录失败，请重试'
    if (error?.code === 409) { agreed.value = false; await loadLegal() }
    toast(loginError.value)
  } finally { submitting.value = false }
}
const onPhoneAuth = async (event) => {
  if (submitting.value) return
  if (!requireLegal()) return
  submitting.value = true
  loginError.value = ''
  memberNo.value = ''
  const agreedNow = s.value === 1 ? agreed.value : agreed2.value
  try {
    await bindWechatPhone(event, { agreed: agreedNow, isCurrent: () => pageActive })
    await recordAgreement()
    if (!pageActive) return
    toast('手机号已绑定')
    offerProfile()
  } catch (error) {
    // 登录成功、手机号没绑上时账号也已经建好，勾过的协议照样记下
    if (agreedNow) await recordAgreement().catch(() => {})
    if (!pageActive) return
    loginError.value = error?.message || '手机号绑定失败，请重新授权'
    toast(loginError.value)
  } finally {
    submitting.value = false
  }
}
const skip = () => {
  if (submitting.value) return
  if (bindOnly.value) return finishBinding()
  logout()
  relaunch(activityReturn.value || R.home)
}
const onQuickAuth = () => toast('请在小程序内使用手机号快捷登录')
// 员工身份由微信账号及服务端授权确认，已有授权不必先走用户登录或再次绑定手机号。
const startStaffLogin = async () => {
  if (submitting.value) return
  if (!requireLegal()) return
  if (!agreed.value) return toast('请先阅读并同意协议')
  // #ifndef MP-WEIXIN
  if (!devLoginAvailable.value) return toast('请在小程序内使用员工登录')
  // #endif
  submitting.value = true
  loginError.value = ''
  memberNo.value = ''
  try {
    const route = await resolveStaffEntry({ authenticate: true, isCurrent: () => pageActive })
    await recordAgreement()
    if (!pageActive) return
    if (activityReturn.value) return relaunch(activityReturn.value)
    if (route === R.identity) {
      loginError.value = '当前账号暂无员工授权，请联系管理员授权后点击员工入口重试。'
      memberNo.value = experience.account?.id || ''
      return
    }
    relaunch(route)
  } catch (error) {
    if (pageActive) loginError.value = error?.message || '员工登录失败，请重试'
  } finally {
    submitting.value = false
  }
}
// 网页不能索取微信手机号。仅开发构建且本地服务明确开启 mock 时保留联调登录。
const startWebLogin = async () => {
  if (!requireLegal()) return
  if (!agreed.value) return toast('请先阅读并同意协议')
  if (!devLoginAvailable.value) return onQuickAuth()
  if (submitting.value) return
  submitting.value = true
  loginError.value = ''
  memberNo.value = ''
  try {
    await loginAccount({ agreed: agreed.value, versions: legalVersions.value, isCurrent: () => pageActive })
    if (!pageActive) return
    completeEntry()
  } catch (error) {
    if (!pageActive) return
    loginError.value = error?.message || '登录失败，请重试'
  } finally {
    submitting.value = false
  }
}
onMounted(async () => {
  loadLegal()
  // #ifdef H5
  if (import.meta.env.DEV) {
    try { devLoginAvailable.value = (await apiPing()).data?.wxMock === true } catch { /* 默认关闭 */ }
  }
  // #endif
})
</script>

<style scoped lang="scss">
.other-phone{margin-top:16px;padding:16px;border:1px solid var(--k-line2);border-radius:16px;background:var(--k-paper)}
.other-phone__title{display:block;font-size:16px;font-weight:600;color:var(--k-ink)}
.other-phone__help{display:block;margin:8px 0 14px;font-size:13px;line-height:1.8;color:var(--k-muted)}
.other-phone__button{margin:0;padding:12px;min-height:48px;border:1px solid var(--k-red-line);border-radius:12px;font-size:15px;line-height:1.6;color:var(--k-red-deep);background:var(--k-paper2)}
.other-phone__button::after{border:0}
.other-phone__button[disabled]{opacity:.5}
.login-note { font-size: 12px; line-height: 1.7; color: var(--k-muted); text-align: center; }
.legal-error { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; font-size: 13px; line-height: 1.7; color: var(--k-alert); }
.profile-setup{padding:28px 24px;display:flex;flex-direction:column;gap:22px}.profile-setup__title{font-size:25px;font-weight:650}.profile-setup__note{font-size:14px;line-height:1.8;color:var(--k-muted)}.profile-avatar{display:flex;flex-direction:column;align-items:center;gap:12px;background:transparent;font-size:14px;color:var(--k-red);padding:12px}.profile-avatar:after{border:0}.profile-avatar image{width:86px;height:86px;border-radius:50%}.profile-nickname{display:flex;align-items:center;gap:18px;background:var(--k-paper);padding:8px 16px;border-radius:14px}.profile-nickname input{flex:1;min-width:0;height:44px}.profile-error{color:var(--k-alert);font-size:13px}.profile-skip{background:transparent;font-size:14px;color:var(--k-muted);line-height:44px}.profile-skip:after{border:0}

.hero { width: 100%; height: 364px; display: block; }
.welcome { padding: 24px 16px calc(16px + var(--k-safe-bottom)); display: flex; flex-direction: column; gap: 12px; }
.btn-browse { height: 48px; border: 1px solid var(--k-red-line); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-family: var(--k-serif); font-weight: 700; font-size: 17px; color: var(--k-ink); }
.agree { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; margin-top: 12px; font-size: 13px; color: var(--k-muted); }
.agree--left { justify-content: flex-start; margin-top: 12px; }
.agree__text { flex: 0 0 calc(100% - 32px); white-space: nowrap; }
.agree__link { color: var(--k-green); white-space: nowrap; }
.agree__circle { width: 18px; height: 18px; border: 1.5px solid var(--k-line2); background: var(--k-paper); }
.agree__circle.on { border-color: var(--k-green); background: var(--k-green); }
.account { display: flex; align-items: center; gap: 16px; padding: 12px 8px 4px; }
.account__avatar { width: 60px; height: 60px; border-radius: 50%; flex: 0 0 auto; }
.account__name { font-family: var(--k-serif); font-weight: 700; font-size: 20px; }
.auth-row { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); font-size: 14px; }
.auth-row__label { width: 62px; }
.notice { display: block; line-height: 1.7; }
.privacy { display: flex; align-items: flex-start; gap: 12px; padding: 18px 14px; }
.privacy.has-line { border-bottom: 1px solid var(--k-line); }
.privacy__icon { width: 34px; height: 34px; }
.privacy__copy { display: block; line-height: 1.7; }
.quick { margin-top: 10px; display: flex; align-items: center; gap: 12px; padding: 16px 14px; border: 1.5px solid var(--k-green); border-radius: 12px; background: var(--k-green-soft); }
.quick__phone { width: 40px; height: 40px; }
.quick__num { display: block; letter-spacing: .5px; }
.quick__ok { width: 24px; height: 24px; }
.or { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
.or__line { flex: 1; height: 1px; background: var(--k-line); }
.code { width: 70px; gap: 6px; justify-content: center; padding: 0; flex: 0 0 auto; }
.sent { display: block; }
.resend { height: 30px; padding: 0 10px; display: flex; align-items: center; border-radius: 6px; background: var(--k-paper2); color: var(--k-muted); font-size: 12px; }
</style>

<style scoped>.profile-save{width:100%;border-radius:24px;background:var(--k-red);color:var(--k-paper);font-size:16px;line-height:46px}.profile-save[disabled]{opacity:.5}</style>
