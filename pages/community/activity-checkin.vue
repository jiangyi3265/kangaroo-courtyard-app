<template>
  <view class="k-page ck-page">
    <k-topbar title="签到二维码" back />
    <view class="ck-body">
      <text v-if="title" class="ck-title">{{ title }}</text>
      <view v-if="loading" class="ck-card ck-card--center"><text class="ck-muted">正在生成签到码…</text></view>
      <view v-else-if="loadError" class="ck-card ck-card--center">
        <text class="ck-warn">{{ loadError }}</text>
        <k-button class="ck-mt" type="secondary" size="md" label="重新生成" @click="load" />
      </view>
      <template v-else>
        <!-- 微信小程序码生成成功：参与者用微信「扫一扫」直接打开活动页完成签到 -->
        <view v-if="wxReady" class="ck-card ck-card--center">
          <image class="ck-qr" :src="info.code.image" mode="aspectFit" @click="zoom(info.code.image)" />
          <text class="ck-lead">请参与者用微信「扫一扫」扫码签到</text>
          <text class="ck-muted">{{ envTip }}</text>
        </view>
        <!-- 微信那边没生成出来：换普通二维码，参与者在小程序报名凭证页「现场签到 → 扫码签到」里扫；组织者不会卡住 -->
        <view v-else class="ck-card ck-card--center">
          <view class="ck-note"><text>{{ wxFailText }}</text></view>
          <image v-if="info.plainQr" class="ck-qr" :src="info.plainQr" mode="aspectFit" @click="zoom(info.plainQr)" />
          <text class="ck-lead">请参与者打开袋鼠全球青年小程序：\n我的活动 → 报名凭证 →「现场签到」→ 扫码签到</text>
          <k-button class="ck-mt" type="outline" size="md" label="再试一次微信小程序码" @click="load" />
        </view>
        <!-- 6 位活动签到码：扫不了码的（手机摄像头坏了、在后排看不清）直接输入 -->
        <view v-if="info.pin" class="ck-card">
          <text class="ck-sub-title">活动签到码</text>
          <view class="ck-pin"><text v-for="(n, i) in pinDigits" :key="i" class="ck-pin__d">{{ n }}</text></view>
          <text class="ck-muted">扫不了码的人，在报名凭证页点「现场签到 → 输入活动签到码」，输入上面 6 位数字也能签到。</text>
        </view>
        <view class="ck-tips">
          <text>· 签到时间：活动开始前 2 小时起，到活动结束为止。</text>
          <text>· 只有报名已确认的人能签到；点二维码可以放大，也可以长按保存。</text>
          <text>· 参与者自己报名凭证上的「签到码」是给你核对用的：在活动详情「签到管理 → 输入参与者签到码」里输入。</text>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 2026-11-03 主人：「出示二维码失效，生成失败」。原来点「出示签到二维码」只弹一句「微信小程序码生成失败，请稍后重试 可稍后再次点击重试」，
// 组织者现场什么也给不出来。现在单独一页：
//   1. 微信小程序码按当前小程序版本（正式版 / 体验版 / 开发版）生成，扫出来打开的是同一个版本；
//   2. 微信那边还是生成不出来，就显示服务端画的普通二维码（参与者在小程序报名凭证页里扫），说明原因；
//   3. 不管哪种，都给一个 6 位「活动签到码」，扫不了码的人自己输入。
// 门店活动（员工 / 商家，mode=staff）和用户发起的活动（发起人，mode=user）共用这一页，接口不同、授权各走各的。
// 放在 community 分包：普通发起人进来不用下载员工分包。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { useScreen } from '@/common/screen.js'
import { apiStaffActivityCheckinCode, apiActivityCheckinCode } from '@/common/api.js'
import { ensureSession } from '@/common/experience.js'
import { errText } from '@/common/ui.js'
import { previewActivityCode } from '@/common/activity-code.js'

const id = ref('')
const mode = ref('staff')
const title = ref('')
const loading = ref(true)
const loadError = ref('')
const info = ref({ code: {}, pin: '', plainQr: '' })

useScreen(1, {
  onLoad: async (q) => {
    id.value = String(q?.id || '')
    mode.value = q?.mode === 'user' ? 'user' : 'staff'
    title.value = q?.title || ''
    await ensureSession()
    load()
  }
})

// 当前小程序版本：体验版里生成体验版的码，扫开的才是体验版（拿不到就交给服务端按配置）
function envVersion() {
  try { return (uni.getAccountInfoSync().miniProgram || {}).envVersion || '' } catch (e) { return '' }
}

const PNG = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/
const wxReady = computed(() => info.value.code?.state === 'ready' && PNG.test(info.value.code.image || ''))
const envTip = computed(() => ({
  trial: '这是体验版的码：只有在公众平台加了体验成员的微信能扫开。',
  develop: '这是开发版的码：只有开发者微信能扫开。'
})[info.value.code?.envVersion] || '点二维码可以放大，也可以长按保存发到群里。')
const wxFailText = computed(() => {
  const c = info.value.code || {}
  if (c.state === 'mock') return '本地联调环境不生成微信小程序码，先用下面的普通二维码和签到码。'
  return `${c.message || '微信小程序码暂时没生成出来'}。先用下面这张二维码签到：`
})
const pinDigits = computed(() => String(info.value.pin || '').split(''))

async function load() {
  if (!/^[1-9][0-9]{0,18}$/.test(id.value)) { loading.value = false; loadError.value = '活动编号不对，请返回重新进入'; return }
  loading.value = true
  loadError.value = ''
  try {
    const api = mode.value === 'user' ? apiActivityCheckinCode : apiStaffActivityCheckinCode
    info.value = (await api(id.value, envVersion() || undefined)).data || {}
  } catch (e) {
    loadError.value = errText(e, '签到码没取到，请检查网络后重试')
  } finally {
    loading.value = false
  }
}

async function zoom(image) {
  try { await previewActivityCode({ state: 'ready', image }, id.value) } catch (e) { uni.showToast({ title: e.message || '打开失败', icon: 'none' }) }
}
</script>

<style scoped lang="scss">
.ck-body { padding: 12px 16px calc(32px + var(--k-safe-bottom)); display: flex; flex-direction: column; gap: 12px; }
.ck-title { font-family: var(--k-serif); font-weight: 700; font-size: 20px; line-height: 1.4; }
.ck-card { padding: 18px 16px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); display: flex; flex-direction: column; gap: 10px; }
.ck-card--center { align-items: center; text-align: center; }
.ck-qr { width: 260px; height: 260px; border-radius: 8px; background: #fff; }
.ck-lead { font-size: 17px; font-weight: 600; line-height: 1.6; white-space: pre-line; }
.ck-muted { font-size: 14px; color: var(--k-muted); line-height: 1.6; }
.ck-warn { font-size: 16px; color: var(--k-alert); line-height: 1.6; }
.ck-note { align-self: stretch; padding: 10px 12px; border-radius: 8px; background: var(--k-paper2); font-size: 15px; color: var(--k-ochre-deep); line-height: 1.6; text-align: left; }
.ck-mt { margin-top: 4px; }
.ck-sub-title { font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.ck-pin { display: flex; justify-content: center; gap: 8px; padding: 4px 0; }
.ck-pin__d { width: 42px; height: 54px; line-height: 54px; text-align: center; border-radius: 8px; border: 1px solid var(--k-line2); background: var(--k-bg); font-family: var(--k-serif); font-weight: 700; font-size: 30px; color: var(--k-ink); }
.ck-tips { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 10px; background: var(--k-paper2); font-size: 14px; color: var(--k-muted); line-height: 1.6; }
</style>
