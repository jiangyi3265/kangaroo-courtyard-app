<template>
  <view class="k-topbar" :class="{ 'is-dark': dark, 'is-fixed': fixed }" :style="{ background: bg }">
    <view class="k-statusbar" :style="{ height: statusHeight + 'px' }">
      <!-- #ifdef H5 -->
      <text class="k-statusbar__time">9:41</text>
      <view class="k-statusbar__notch" />
      <view class="k-statusbar__icons">
        <view class="k-sig"><view v-for="n in 4" :key="n" class="k-sig__bar" :style="{ height: (4 + n * 2) + 'px' }" /></view>
        <k-icon name="wifi" :size="16" :color="dark ? 'white' : 'ink'" :stroke="2.6" />
        <view class="k-bat"><view class="k-bat__fill" /></view>
      </view>
      <!-- #endif -->
    </view>
    <view class="k-navbar" :style="{ height: navHeight + 'px' }">
      <view class="k-navbar__left">
        <view v-if="back" class="k-navbar__back" @click="goBack">
          <k-icon name="chevron-left" :size="26" :color="dark ? 'white' : 'ink'" :stroke="1.8" @click.stop="goBack" />
        </view>
        <slot name="left" />
      </view>
      <text v-if="title" class="k-navbar__title">{{ title }}</text>
      <view class="k-navbar__right" :style="capsuleGap ? ('min-width:0;margin-right:' + (capsuleGap - 2) + 'px') : ''">
        <slot name="right">
          <!-- #ifdef H5 -->
          <view class="k-capsule">
            <view class="k-capsule__dots"><view class="k-capsule__dot" /><view class="k-capsule__dot" /><view class="k-capsule__dot" /></view>
            <view class="k-capsule__line" />
            <view class="k-capsule__ring"><view class="k-capsule__core" /></view>
          </view>
          <!-- #endif -->
        </slot>
      </view>
    </view>
    <slot />
    <!-- 新消息提示条（common/news-toast.js）：在前台时查到未读变多，在顶栏下面露 3 秒，点了去看那条消息 -->
    <view v-if="newsTip.text" class="k-news" hover-class="k-press" @click="openNewsTip"><k-icon name="bell" :size="15" color="white" :stroke="2" /><text class="k-news__text">{{ newsTip.text }}</text><k-icon name="chevron-right" :size="14" color="white" /></view>
    <!-- #ifdef MP-WEIXIN -->
    <!-- 看不见的返回拦截（见 common/back-guard.js）：页内分屏时系统返回 / 侧滑也按顶栏返回箭头处理，不会直接退出小程序 -->
    <page-container v-if="customBack && back && !parked" :show="armed" :overlay="false" :duration="0" position="bottom" :z-index="-1" custom-style="position:fixed;left:0;bottom:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;" @beforeleave="onSystemBack" />
    <!-- #endif -->
    <!-- 人工客服小钮（common/support-fab.js）：贴屏幕右边、不跟着滑；用户身份和合作商家出，员工不出。小程序直接打开微信客服会话，网页版去客服中心 -->
    <!-- #ifdef MP-WEIXIN -->
    <button v-if="fabOn" class="k-fab" :style="fabStyle" open-type="contact" :session-from="fabFrom" hover-class="k-press-s" aria-label="联系人工客服"><k-icon name="headset" :size="14" color="red" /><text class="k-fab__text">客</text><text class="k-fab__text">服</text></button>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <view v-if="fabOn" class="k-fab" :style="fabStyle" hover-class="k-press-s" aria-label="联系人工客服" @click="openSupport"><k-icon name="headset" :size="14" color="red" /><text class="k-fab__text">客</text><text class="k-fab__text">服</text></view>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { addGuard, removeGuard, armSoon } from '@/common/back-guard.js'
import { newsTip, openNewsTip } from '@/common/news-toast.js'
import { experience, session, currentStaffStore } from '@/common/experience.js'
import { fabVisible, fabSessionFrom } from '@/common/support-fab.js'
// #ifndef MP-WEIXIN
import { go } from '@/common/screen.js'
// #endif

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

const props = defineProps({
  title: { type: String, default: '' },
  back: { type: Boolean, default: false },
  dark: { type: Boolean, default: false },       // 深色背景（视频/照片页）
  bg: { type: String, default: '' },             // 自定义背景，默认继承页面背景
  fixed: { type: Boolean, default: false },      // 绝对悬浮（用于沉浸式头图）
  navHeight: { type: Number, default: 44 },
  customBack: { type: Boolean, default: false },  // 页面自己处理返回（页内切屏 / 步骤回退）：小程序里读不到 @back 是否绑了，必须显式声明
  fab: { type: Boolean, default: true }           // 人工客服小钮；填写屏字段从屏幕边开始、钮浮着会压字，传 false，钮改放底部操作条（pages/staff/components/fc-kefu.vue）
})
const emit = defineEmits(['back'])
const instance = getCurrentInstance()

let statusHeight = 44
// #ifndef H5
try { statusHeight = uni.getSystemInfoSync().statusBarHeight || 20 } catch (e) { statusHeight = 20 }
// #endif
// 小程序右上角是微信自己的胶囊按钮（··· / ◎）：右侧插槽（重置 / 切城市 / 切门店…）要整个让到它左边，
// 不然被盖住、点到的是胶囊。插槽空着时让出的宽度和原来的 min-width 差不多，其它顶栏排版不变
let capsuleGap = 0
// #ifdef MP-WEIXIN
try {
  const r = uni.getMenuButtonBoundingClientRect()
  const w = uni.getSystemInfoSync().windowWidth
  capsuleGap = r && r.left > 0 && r.left < w ? w - r.left : 97
} catch (e) { capsuleGap = 97 }
// #endif

// 返回区和里面的箭头图标都绑了 goBack：小程序里点在箭头上，图标转发的 click 和冒泡到返回区的原生 tap 会各触发一次，
// 退两页（页内分屏的页面则是先退一屏、再直接离开本页）。短时间内的第二次调用直接忽略
let lastBackAt = 0
const goBack = () => {
  const now = Date.now()
  if (now - lastBackAt < 500) return
  lastBackAt = now
  if (props.customBack || instance?.vnode?.props?.onBack) { emit('back'); return }
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.reLaunch({ url: '/pages/home/index' })
}

// 系统返回拦截：只在带 custom-back（页面自己处理返回）的顶栏上挂，见 common/back-guard.js
const armed = ref(false)
// navigateBack 前撤拦截时把隐形容器整个卸掉（back-guard.js releaseCurrent），不是只把 show 改成 false：
// 基础库收起 page-container 时会把页面滚回它挂上那一刻的位置，滑到下面再点返回，页面会先闪回顶部
const parked = ref(false)
let pageId = ''
let alive = false
let lastSystemBackAt = 0
// 没有返回箭头的顶栏（底栏页首屏）不拦：否则系统返回既不退出也不切屏，用户被困在这一页
const guard = { armed, parked, enabled: () => alive && props.customBack && props.back }
// #ifdef MP-WEIXIN
onMounted(() => {
  alive = true
  try { pageId = String(instance?.proxy?.$scope?.getPageId?.() || '') } catch (e) { pageId = '' }
  if (props.customBack) addGuard(pageId, guard)
})
// 返回箭头随屏切换显示 / 隐藏（如登录页）：跟着重新决定拦不拦
watch(() => props.back, () => { if (alive && props.customBack) armSoon(pageId) })
onBeforeUnmount(() => {
  alive = false
  removeGuard(pageId, guard)
})
// #endif
const onSystemBack = () => {
  // 自己撤下拦截时（切屏 / 正要 navigateBack）也会触发这个事件，那时 armed 已经是 false，不算用户按了返回
  if (!armed.value) return
  armed.value = false
  const now = Date.now()
  if (now - lastSystemBackAt < 300) return
  lastSystemBackAt = now
  emit('back')
  // 返回处理只是弹了个确认框、还留在这一屏时，把拦截挂回去；切了屏的话新顶栏自己会挂上
  armSoon(pageId, 350)
}

// 人工客服小钮：哪一页、什么身份出，规则在 common/support-fab.js
const pageRoute = ref('')
onMounted(() => {
  try {
    const pages = getCurrentPages()
    pageRoute.value = (pages[pages.length - 1] && pages[pages.length - 1].route) || ''
  } catch (e) { pageRoute.value = '' }
})
const fabOn = computed(() => props.fab && fabVisible({
  route: pageRoute.value, restored: session.restored, mode: experience.mode, roleCode: currentStaffStore.value && currentStaffStore.value.roleCode, dark: props.dark
}))
const fabFrom = computed(() => fabSessionFrom(experience.account && experience.account.id))
// 小钮的高度：页面内容是从状态栏往下排的，所以从状态栏往下量，各种手机上不滑动时压到的东西都差不多（逐页量过，forms-batch/fab-overlap.json，这两带多是留白和卡片边）。
// 窗口不到 640 高的小屏要让开页面最后的提交按钮，放高一点；再矮也不碰底部操作条（最高到底部 142）
let fabStyle = ''
try {
  const windowHeight = uni.getSystemInfoSync().windowHeight
  fabStyle = 'top:' + Math.min(statusHeight + (windowHeight >= 640 ? 396 : 268), windowHeight - 210) + 'px'
} catch (e) { fabStyle = '' }
// #ifndef MP-WEIXIN
const openSupport = () => go('/pages/notice/support')
// #endif
</script>

<style scoped lang="scss">
.k-topbar { position: sticky; top: 0; z-index: 40; background: var(--k-bg); }
.k-topbar.is-fixed { position: absolute; left: 0; right: 0; top: 0; background: transparent; }
.k-news { position: absolute; left: 12px; right: 12px; top: 100%; margin-top: 4px; height: 38px; padding: 0 12px; display: flex; align-items: center; gap: 8px; border-radius: 19px; background: var(--k-ink); box-shadow: 0 4px 14px rgba(58, 50, 43, .2); }
.k-news__text { flex: 1; min-width: 0; color: #fff; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 人工客服小钮：竖排的侧边小标签，贴屏幕右边。宽 28 只盖卡片边和留白；字 13px，年纪大的人也看得清。
   高度见脚本 fabStyle（逐页量过，那两带压到的输入框和按钮最少，也高过所有固定底栏）；这里的 55% 是取不到屏幕信息时用的 */
/* 11-18 第三轮：宽 28→24。页面内容离屏幕右边是 24（页边 12 + 卡片内边距 12），原来 28 宽会压住每行最右边 4px（订单详情「实付 ¥736」看着像「¥73」）；收到 24 正好贴着内容外沿，谁也不压 */
/* 11-18 第四轮：再收到 20 宽、图标 14、不传粗细。新版页面卡片外沿离屏幕右边只有 16，24 宽还会压住两列卡右列和列表行末尾的箭头约 8px；20 宽只碰卡片外沿 4px，碰不到卡内文字 */
.k-fab { position: fixed; right: 0; left: auto; top: 55%; width: 20px; height: 60px; margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 10px 0 0 10px; background: rgba(255, 255, 255, .97); box-shadow: -2px 2px 8px rgba(120, 84, 48, .18), inset 0 0 0 .5px rgba(160, 120, 80, .25); color: var(--k-red-deep); }
.k-fab::after { border: 0; }
.k-fab__text { display: block; font-size: 12px; line-height: 14px; font-weight: 500; }
.k-statusbar { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 0 22px 0 30px; }
/* #ifdef H5 */
/* 网页版画的假状态栏、假胶囊（模板里也只有网页版才有）：小程序用不到，不打进主包 */
.k-statusbar__time { font-size: 15px; font-weight: 600; letter-spacing: .2px; }
.k-statusbar__notch { position: absolute; left: 50%; top: 11px; width: 120px; height: 34px; margin-left: -60px; border-radius: 20px; background: #000; }
.k-statusbar__icons { display: flex; align-items: center; gap: 6px; }
.k-sig { display: flex; align-items: flex-end; gap: 1.5px; height: 12px; }
.k-sig__bar { width: 3px; border-radius: 1px; background: var(--k-ink); }
.k-bat { width: 26px; height: 12px; border: 1.5px solid rgba(36,27,23,.5); border-radius: 4px; padding: 1.5px; position: relative; }
.k-bat::after { content: ""; position: absolute; right: -4px; top: 3px; width: 2px; height: 4px; border-radius: 1px; background: rgba(36,27,23,.5); }
.k-bat__fill { width: 100%; height: 100%; border-radius: 2px; background: var(--k-ink); }
.is-dark .k-statusbar__time { color: #fff; }
.is-dark .k-sig__bar, .is-dark .k-bat__fill { background: #fff; }
.is-dark .k-bat { border-color: rgba(255,255,255,.6); }
/* #endif */

.k-navbar { position: relative; display: flex; align-items: center; padding: 0 8px 0 8px; }
.k-navbar__left { display: flex; align-items: center; min-width: 0; flex: 1; }
.k-navbar__back { width: 40px; height: 44px; display: flex; align-items: center; justify-content: center; margin-left: -4px; }
/* 标题左右各让 102：微信胶囊左边离屏幕右边约 94–97，长标题单行省略、离胶囊还留 5–8，又不会把 375 宽上 10 个字的标题截掉 */
.k-navbar__title { position: absolute; left: 102px; right: 102px; top: 50%; transform: translateY(-50%); text-align: center; font-family: var(--k-serif); font-weight: 700; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.is-dark .k-navbar__title { color: #fff; }
/* 11-18 精修：320 宽的手机上标题只有约 116px，「推荐更合适的机会」这类 8 个字的标题被截成「…」；窄屏收到 15 号、两边各让出 96（仍躲开右上角微信胶囊） */
@media (max-width: 340px) { .k-navbar__title { left: 96px; right: 96px; font-size: 15px; } }
.k-navbar__right { display: flex; align-items: center; justify-content: flex-end; min-width: 94px; }
/* #ifdef H5 */
.k-capsule { width: 87px; height: 32px; border: 1px solid rgba(36,27,23,.14); border-radius: 16px; display: flex; align-items: center; justify-content: space-around; background: rgba(255,255,255,.55); }
.is-dark .k-capsule { background: rgba(0,0,0,.35); border-color: rgba(255,255,255,.25); }
.k-capsule__dots { display: flex; gap: 3px; }
.k-capsule__dot { width: 4px; height: 4px; border-radius: 50%; background: var(--k-ink); }
.is-dark .k-capsule__dot { background: #fff; }
.k-capsule__line { width: 1px; height: 18px; background: rgba(36,27,23,.14); }
.is-dark .k-capsule__line { background: rgba(255,255,255,.3); }
.k-capsule__ring { width: 16px; height: 16px; border: 2px solid var(--k-ink); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.is-dark .k-capsule__ring { border-color: #fff; }
.k-capsule__core { width: 6px; height: 6px; border-radius: 50%; background: var(--k-ink); }
.is-dark .k-capsule__core { background: #fff; }
/* #endif */
</style>
