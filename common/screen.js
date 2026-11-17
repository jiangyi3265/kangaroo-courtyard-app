import { recruitmentEnabled, recruitmentPage } from './features.js'
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

/**
 * 每个页面对应一张设计总览图（4 屏）。通过 ?s=1..4 直接打开某一屏，页面内交互也可切换。
 * const s = useScreen(4)   // s.value 为当前屏号
 */
/**
 * 小程序的 onLoad 收到的是没解码的 query（?title=%E5…），H5 由 uni-h5 解码过：
 * 报名页标题显示 %E5…、城市页拿编码值再请求一次所以数据全是 0、人才库标签的逗号变成 %2C（2026-09-28 复核发现）。
 * 这里统一在 useScreen 里解码一次；H5 不再解（再解一次会把原本就含 % 的值弄坏）。解不开的保持原值。
 */
export function decodeQuery(q) {
  // #ifdef H5
  return q || {}
  // #endif
  // #ifndef H5
  const out = {}
  for (const k in (q || {})) {
    try { out[k] = decodeURIComponent(q[k]) } catch (e) { out[k] = q[k] }
  }
  return out
  // #endif
}

export function useScreen(max = 4, extra = {}) {
  const s = ref(1)
  const query = ref({})
  onLoad((q0) => {
    const q = decodeQuery(q0)
    query.value = q || {}
    const n = Number(q?.s || 1)
    s.value = n >= 1 && n <= max ? n : 1
    if (typeof extra.onLoad === 'function') extra.onLoad(q || {})
  })
  return s
}

// 小程序页面栈最多 10 层：来回在岗位详情 / 同行队伍之间跳会不断入栈，满了之后 navigateTo 静默失败、点了没有任何反应。
// 失败时退一步用 redirectTo（替换当前页）保证用户能到达目标页
const reportNavigationFailure = (err) => {
  // 连点触发的取消不打扰用户；其余失败必须给出反馈，不能看起来像按钮失效。
  if (/cancel|locked/i.test(String(err?.errMsg || ''))) return
  uni.showToast({ title: '页面未能打开，请重试；仍失败请更新小程序', icon: 'none' })
}
export const go = (url) => {
  if (!recruitmentEnabled.value && recruitmentPage(url)) { uni.showToast({title: '求职招聘服务暂未开放',icon: 'none'}); return }
  return uni.navigateTo({
  url,
  fail: (err) => {
    // 只在页面栈满（errMsg 带 limit / exceed）时退一步用 redirectTo；H5 上连点造成的 locked / cancel 不是这种情况，
    // 不能用旧地址替换掉当前页
    if (/limit|exceed/i.test(String((err && err.errMsg) || ''))) uni.redirectTo({ url, fail: reportNavigationFailure })
    else reportNavigationFailure(err)
  }
})
}
export const replace = (url) => uni.redirectTo({ url })
export const relaunch = (url) => uni.reLaunch({ url })
export const back = () => {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.reLaunch({ url: '/pages/home/index' })
}
export const toast = (title, icon = 'none') => uni.showToast({ title, icon })
