<template>
  <view class="k-page login">
    <k-topbar :title="titles[s - 1]" :back="s > 1" @back="s = Math.max(1, s - 1)" />

    <!-- 1 欢迎登录 -->
    <view v-if="s === 1">
      <image class="hero" src="/static/media/login-hero.jpg" mode="aspectFill" />
      <view class="welcome">
        <text v-if="employeeEntry" class="k-small k-muted">员工登录后直接进入工作台，无需填写旅行偏好。</text>
        <k-button block icon="wechat" icon-fill @click="startLogin">{{ employeeEntry ? '员工微信登录' : '微信一键登录' }}</k-button>
        <view class="btn-browse" @click="skip"><text>先逛逛</text></view>
        <k-button type="ghost" block @click="employeeEntry = !employeeEntry">{{ employeeEntry ? '返回用户登录' : '员工入口' }}</k-button>
        <text v-if="loginError" class="k-small k-muted">{{ loginError }}</text>
        <view class="agree" @click="agreed = !agreed">
          <view class="k-check" :class="{ checked: agreed }"><k-icon v-if="agreed" name="check" :size="12" color="white" :stroke="3" /></view>
          <text class="agree__text">我已阅读并同意</text>
          <text class="agree__link">《用户协议》</text><text class="agree__link">《隐私政策》</text>
        </view>
      </view>
    </view>

    <!-- 2 微信授权确认 -->
    <view v-else-if="s === 2" class="k-body k-pad-bottom">
      <view class="account">
        <image class="account__avatar" src="/static/media/avatar-1.jpg" mode="aspectFill" />
        <view class="k-col k-gap4"><text class="account__name">小院手作人</text><text class="k-small k-muted">微信昵称头像授权</text></view>
      </view>
      <k-card class="k-mt12" :pad="14">
        <text class="k-title">将获取以下信息</text>
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
            <text class="k-small k-muted k-mt8 notice">我们将严格遵守<text class="k-green">《隐私政策》</text>，仅在你使用袋鼠小院相关服务时使用上述信息，不会向第三方提供或用于其他用途。</text>
            <view class="k-row k-gap2 k-mt8" @click="s = 3"><text class="k-link k-link--green">查看完整隐私政策</text><k-icon name="chevron-right" :size="13" color="green" /></view>
          </view>
        </view>
      </k-card>
      <view class="k-col k-gap10 k-mt16">
        <k-button block @click="s = 4">允许并继续</k-button>
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
      <view class="k-center-box k-gap2 k-mt20" @click="toast('隐私政策全文')"><text class="k-link k-link--green">查看完整隐私政策</text><k-icon name="chevron-right" :size="13" color="green" /></view>
      <k-button block class="k-mt16" @click="s = 4">同意并继续</k-button>
      <view class="k-home-indicator" />
    </view>

    <!-- 4 手机号绑定 -->
    <view v-else class="k-body k-pad-bottom">
      <k-card :pad="12">
        <view class="k-row-start k-gap10">
          <k-icon name="shield-check" :size="20" color="green" :stroke="1.6" fill />
          <text class="k-small k-muted k-flex1">为了保障你的账号安全，报名活动、私信沟通、发布内容等操作需要绑定手机号。</text>
        </view>
      </k-card>
      <view class="k-row k-gap4 k-mt24"><text class="k-title">快捷授权</text><text class="k-small k-muted">（推荐）</text></view>
      <view class="quick" :class="{ on: quick }" @click="quick = true">
        <view class="k-circle k-circle--green quick__wx"><k-icon name="wechat" :size="24" color="white" :stroke="0.5" fill /></view>
        <view class="k-flex1"><text class="k-subtitle">授权微信手机号</text><text class="k-text k-mt4 quick__num">186 **** 8888</text></view>
        <view class="k-circle k-circle--green quick__ok"><k-icon name="check" :size="14" color="white" :stroke="3" /></view>
      </view>
      <view class="or"><view class="or__line" /><text class="k-small k-muted">或</text><view class="or__line" /></view>
      <text class="k-title">其他手机号</text>
      <view class="k-row k-gap8 k-mt10">
        <view class="k-input code"><text>+86</text><k-icon name="chevron-down" :size="14" color="ink" /></view>
        <view class="k-input k-flex1"><input v-model="phone" type="number" placeholder="请输入手机号" placeholder-class="k-placeholder" /></view>
      </view>
      <text class="k-small k-muted k-mt16 sent">验证码已发送至 186 **** 8888</text>
      <view class="k-input k-mt8"><input v-model="code" type="number" placeholder="请输入验证码" placeholder-class="k-placeholder" /><view class="resend"><text>58s 后重发</text></view></view>
      <view class="agree agree--left k-mt12" @click="agreed2 = !agreed2">
        <view class="k-circle agree__circle" :class="{ on: agreed2 }"><k-icon name="check" :size="11" color="white" :stroke="3" /></view>
        <text class="agree__text">我已阅读并同意</text>
        <text class="agree__link">《用户协议》</text><text class="agree__link">《隐私政策》</text>
      </view>
      <k-bottom flat><k-button block @click="finish">确认绑定</k-button></k-bottom>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { useScreen, relaunch, toast } from '@/common/screen.js'
import { enterUserPreview, hasStaffAccess, switchMode, logout } from '@/common/experience.js'
import R from '@/common/routes.js'

const employeeEntry = ref(false)
const loginError = ref('')
const s = useScreen(4, { onLoad: q => { employeeEntry.value = q.entry === 'staff' } })
const titles = ['欢迎登录', '微信授权确认', '隐私保护说明', '手机号绑定']
const agreed = ref(false)
const agreed2 = ref(true)
const quick = ref(true)
const phone = ref('')
const code = ref('')
const authItems = [
  { icon: 'user-round', label: '头像', value: '你的微信头像' },
  { icon: 'id-card', label: '昵称', value: '你的微信昵称' },
  { icon: 'map-pin', label: '地区', value: '你的微信地区' },
  { icon: 'user', label: '性别', value: '你的微信性别' }
]
const privacyItems = [
  { icon: 'user-round', title: '使用目的', copy: '为你提供账号注册与登录、报名参与、私信沟通、发布内容等核心功能与服务。' },
  { icon: 'file-search', title: '信息范围', copy: '我们仅会收集你在授权或使用服务时提供的必要信息：头像、昵称、地区、性别、手机号等。' },
  { icon: 'file-clock', title: '保存期限', copy: '我们会在实现上述目的所需的最短时间内保存你的信息，或在你注销账号后删除/匿名化处理。' },
  { icon: 'file-text', title: '注销方式', copy: '你可以在「我的-设置-账号与安全」中申请注销账号，我们将在 7 个工作日内完成处理。' }
]
const startLogin = () => {
  if (!agreed.value) return toast('请先阅读并同意协议')
  loginError.value = ''
  if (hasStaffAccess.value) return relaunch(switchMode('staff'))
  if (employeeEntry.value) {
    loginError.value = '员工授权服务暂未接入，当前无法完成员工登录。'
    return
  }
  s.value = 2
}
const skip = () => { logout(); relaunch(R.home) }
const finish = () => {
  if (!agreed2.value) return toast('请先阅读并同意协议')
  if (hasStaffAccess.value) return relaunch(switchMode('staff'))
  if (employeeEntry.value) { s.value = 1; loginError.value = '员工授权服务暂未接入，当前无法完成员工登录。'; return }
  relaunch(enterUserPreview())
}
</script>

<style scoped lang="scss">
.hero { width: 100%; height: 364px; display: block; }
.welcome { padding: 24px 16px 0; display: flex; flex-direction: column; gap: 12px; }
.btn-browse { height: 48px; border: 1px solid rgba(169,71,52,.55); border-radius: 8px; background: var(--k-paper); display: flex; align-items: center; justify-content: center; font-family: var(--k-serif); font-weight: 700; font-size: 17px; color: var(--k-ink); }
.agree { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 12px; font-size: 13px; color: var(--k-muted); }
.agree--left { justify-content: flex-start; margin-top: 12px; }
.agree__text { margin-right: 2px; }
.agree__link { color: var(--k-green); }
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
.quick__wx { width: 40px; height: 40px; }
.quick__num { display: block; letter-spacing: .5px; }
.quick__ok { width: 24px; height: 24px; }
.or { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
.or__line { flex: 1; height: 1px; background: var(--k-line); }
.code { width: 70px; gap: 6px; justify-content: center; padding: 0; flex: 0 0 auto; }
.sent { display: block; }
.resend { height: 30px; padding: 0 10px; display: flex; align-items: center; border-radius: 6px; background: var(--k-paper2); color: var(--k-muted); font-size: 12px; }
</style>
