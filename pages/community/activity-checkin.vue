<template>
  <view class="k-page ck-page" :class="$userSurface">
    <k-topbar title="签到二维码" back />
    <view class="ck-body">
      <text v-if="title" class="ck-title">{{ title }}</text>
      <view v-if="loading" class="ck-card ck-card--center"><text class="ck-muted">正在生成签到码…</text></view>
      <view v-else-if="loadError" class="ck-card ck-card--center ck-card--err">
        <view class="ck-err-icon"><k-icon name="alert-circle" :size="28" color="red" /></view>
        <text class="ck-warn">{{ loadError }}</text>
        <k-button class="ck-mt" type="secondary" size="sm" label="重新生成" @click="load" />
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
          <text v-if="info.plainQr" class="ck-lead">请参与者打开袋鼠全球青年小程序：\n我的活动 → 报名凭证 →「现场签到」→ 扫码签到</text>
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
    await load()
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
  if (!info.value.plainQr) return info.value.pin
    ? '二维码暂时无法显示，请在报名凭证的「现场签到」中输入下方活动签到码。'
    : '签到码暂时无法显示，请重新生成。'
  if (c.state === 'mock') return '本地联调环境不生成微信小程序码，先用下面的普通二维码和签到码。'
  return `${c.message || '微信小程序码暂时没生成出来'}。先用下面这张二维码签到：`
})
const pinDigits = computed(() => String(info.value.pin || '').split(''))

async function load() {
  if (!/^[1-9][0-9]{0,18}$/.test(id.value)) { loading.value = false; loadError.value = '活动编号不对，请返回重新进入'; return }
  loading.value = true
  loadError.value = ''
  try {
    await ensureSession()
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

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底、白卡圆角 12、不描边。这一页是举给别人扫的，二维码和 6 位签到码的大小不动，
   说明文字收小一档。功能和文字不变：放大二维码、重新生成、再试一次微信小程序码、活动签到码、三条说明都在。 */
.k-page.ck-page {
  --k-bg: var(--k-page); --k-paper2: var(--k-fill); /* 本组暖米填充，只在根上定义一次 */
  background: var(--k-page);
  :deep(.k-topbar) { background: var(--k-page); }
  :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
  .ck-body { padding: 8px 12px calc(32px + var(--k-safe-bottom)); gap: 8px; }
  .ck-title { padding: 0 2px; font-family: var(--k-sans); font-size: 17px; }
  .ck-card { padding: 16px 12px; border: 0; border-radius: 12px; } .ck-card :deep(.k-button) { border-radius: 22px; box-shadow: none; }
  .ck-lead { font-size: 15px; }
  .ck-muted { font-size: 12px; }
  .ck-warn { font-size: 14px; }
  .ck-note { background: var(--k-ochre-soft); font-size: 13px; }
  .ck-sub-title { font-family: var(--k-sans); font-size: 15px; }
  .ck-pin__d { border: 0; background: var(--k-paper2); font-family: var(--k-sans); }
  .ck-tips { padding: 12px; border-radius: 12px; background: rgba(58, 50, 43, .04); font-size: 12px; }
}
</style>

<style scoped lang="scss">
/* 11-18 第三轮精修：出错和全组空状态一个样子（56 浅红方块 + 32 线性图标、14 / 500 一句话、32 高次按钮）；页边距 12、标题 17 / 700 */
.k-page.ck-page {
  .ck-card--center { gap: 8px; }
  .ck-err-icon { width: 56px; height: 56px; margin-top: 16px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-alert-soft); }
  .ck-warn { font-size: 14px; font-weight: 500; color: var(--k-ink); }
  .ck-err-icon + .ck-warn + .ck-mt { margin-bottom: 16px; }
  .ck-card :deep(.k-button.is-secondary), .ck-card :deep(.k-button.is-outline) { height: 32px; min-height: 32px; padding: 0 16px; border-radius: 16px; font-size: 12px; font-weight: 500; }
  .ck-pin__d { font-variant-numeric: tabular-nums; }
}
</style>

<style scoped lang="scss">
/* 11-18 返修第 5 轮：出错卡离顶栏 12，和参与须知、发布结果页一致 */
.k-page.ck-page {
  .ck-body { padding-top: 12px; }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 6 轮：出错卡上下留白一样（32） */
.k-page.ck-page {
  .ck-card--center { padding-top: 32px; padding-bottom: 32px; }
}
</style>
<style scoped lang="scss">
/* 11-18 夜 第四轮精修：整页只剩出错时不套白卡，直接放在页面底色上、下移到约屏高 1/4；浅棕方块 + 暖棕图标、14/500 一句话、32 高次按钮 */
.k-page.ck-page {
  .ck-card--err { margin-top: 84px; padding: 0 16px; background: transparent; box-shadow: none; }
  .ck-card--err .ck-err-icon { margin-top: 0; background: var(--k-red-soft); }
  .ck-card--err .ck-warn { margin-top: 12px; font-size: 14px; font-weight: 500; line-height: 22px; color: var(--k-ink); text-align: center; }
  .ck-card--err .ck-err-icon + .ck-warn + .ck-mt { margin: 16px 0 0; }
}
</style>
<style scoped lang="scss">
/* 11-19 第四轮返修：出错块去掉卡片自带的 8 间距（和 margin 叠成 20 / 24），图标到字 12、字到按钮 16，和须知、个人主页一样 */
.k-page.ck-page { .ck-card--err { gap: 0; } }
</style>
