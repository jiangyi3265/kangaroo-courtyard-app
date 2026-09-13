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
          <k-icon name="chevron-left" :size="26" :color="dark ? 'white' : 'ink'" :stroke="1.8" />
        </view>
        <slot name="left" />
      </view>
      <text v-if="title" class="k-navbar__title">{{ title }}</text>
      <view class="k-navbar__right">
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
  </view>
</template>

<script setup>
import { getCurrentInstance } from 'vue'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

const props = defineProps({
  title: { type: String, default: '' },
  back: { type: Boolean, default: false },
  dark: { type: Boolean, default: false },       // 深色背景（视频/照片页）
  bg: { type: String, default: '' },             // 自定义背景，默认继承页面背景
  fixed: { type: Boolean, default: false },      // 绝对悬浮（用于沉浸式头图）
  navHeight: { type: Number, default: 44 }
})
const emit = defineEmits(['back'])
const instance = getCurrentInstance()

let statusHeight = 44
// #ifndef H5
try { statusHeight = uni.getSystemInfoSync().statusBarHeight || 20 } catch (e) { statusHeight = 20 }
// #endif

const goBack = () => {
  if (instance?.vnode?.props?.onBack) { emit('back'); return }
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.reLaunch({ url: '/pages/home/index' })
}
</script>

<style scoped lang="scss">
.k-topbar { position: sticky; top: 0; z-index: 40; background: var(--k-bg); }
.k-topbar.is-fixed { position: absolute; left: 0; right: 0; top: 0; background: transparent; }
.k-statusbar { position: relative; display: flex; align-items: center; justify-content: space-between; padding: 0 22px 0 30px; }
.k-statusbar__time { font-size: 15px; font-weight: 600; letter-spacing: .2px; }
.k-statusbar__notch { position: absolute; left: 50%; top: 11px; width: 120px; height: 34px; margin-left: -60px; border-radius: 20px; background: #000; }
.k-statusbar__icons { display: flex; align-items: center; gap: 6px; }
.k-sig { display: flex; align-items: flex-end; gap: 1.5px; height: 12px; }
.k-sig__bar { width: 3px; border-radius: 1px; background: var(--k-ink); }
.k-bat { width: 26px; height: 12px; border: 1.5px solid rgba(36,27,23,.5); border-radius: 4px; padding: 1.5px; position: relative; }
.k-bat::after { content: ""; position: absolute; right: -4px; top: 3px; width: 2px; height: 4px; border-radius: 1px; background: rgba(36,27,23,.5); }
.k-bat__fill { width: 100%; height: 100%; border-radius: 2px; background: var(--k-ink); }
.is-dark .k-statusbar__time, .is-dark .k-navbar__title { color: #fff; }
.is-dark .k-sig__bar, .is-dark .k-bat__fill { background: #fff; }
.is-dark .k-bat { border-color: rgba(255,255,255,.6); }

.k-navbar { position: relative; display: flex; align-items: center; padding: 0 8px 0 8px; }
.k-navbar__left { display: flex; align-items: center; min-width: 0; flex: 1; }
.k-navbar__back { width: 40px; height: 44px; display: flex; align-items: center; justify-content: center; margin-left: -4px; }
.k-navbar__title { position: absolute; left: 90px; right: 90px; top: 0; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-family: var(--k-serif); font-weight: 700; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.k-navbar__right { display: flex; align-items: center; justify-content: flex-end; min-width: 94px; }
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
</style>
