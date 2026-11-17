// 填写页两个共用的小动作（2026-10-31，R7）：创建活动、新增房源、线上任务发布用，写法和 jobs.vue 的 scrollToField、lockPageScroll 相同。放 staff 分包，不进主包。
const fieldGap = () => { try { return (uni.getSystemInfoSync().statusBarHeight || 20) + 44 + 12 } catch (e) { return 72 } }

/** 提交报错时滚到这个字段（selector 如 '#af-title'），停在吸顶顶栏下面；定位不到就算了，红字和提示照样有 */
export function scrollToField(selector) {
  if (typeof uni === 'undefined' || !uni.pageScrollTo) return
  // #ifdef H5
  // 网页版的 pageScrollTo 不认 offsetTop，按 selector 滚会把字段停到吸顶顶栏（44 + 44）后面，报错的输入框看不见：自己量
  const el = typeof document !== 'undefined' && document.querySelector && document.querySelector(selector)
  if (el) { uni.pageScrollTo({ scrollTop: Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - 100), duration: 200 }); return }
  // #endif
  try { uni.pageScrollTo({ selector, duration: 200, offsetTop: -fieldGap() }) } catch (e) { /* 定位不到就算了 */ }
}

// 底部弹层开着时锁住网页版的页面滚动。小程序靠页面顶上的 page-meta；H5 的 page-meta 关掉后清不掉样式，只能锁 body
let restoreScroll = null
export function lockPageScroll(on) {
  // #ifdef H5
  if (typeof document === 'undefined') return
  if (on && !restoreScroll) {
    const body = document.body
    const before = body.style.overflow
    body.style.overflow = 'hidden'
    restoreScroll = () => { body.style.overflow = before }
  } else if (!on && restoreScroll) {
    restoreScroll()
    restoreScroll = null
  }
  // #endif
}
