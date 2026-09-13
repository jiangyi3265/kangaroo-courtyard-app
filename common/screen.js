import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

/**
 * 每个页面对应一张设计总览图（4 屏）。通过 ?s=1..4 直接打开某一屏，页面内交互也可切换。
 * const s = useScreen(4)   // s.value 为当前屏号
 */
export function useScreen(max = 4, extra = {}) {
  const s = ref(1)
  const query = ref({})
  onLoad((q) => {
    query.value = q || {}
    const n = Number(q?.s || 1)
    s.value = n >= 1 && n <= max ? n : 1
    if (typeof extra.onLoad === 'function') extra.onLoad(q || {})
  })
  return s
}

export const go = (url) => uni.navigateTo({ url })
export const replace = (url) => uni.redirectTo({ url })
export const relaunch = (url) => uni.reLaunch({ url })
export const back = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.reLaunch({ url: '/pages/home/index' })
}
export const toast = (title, icon = 'none') => uni.showToast({ title, icon })
