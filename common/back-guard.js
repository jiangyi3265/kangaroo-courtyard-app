// ---------------------------------------------------------------------------
// 系统返回（安卓返回键 / 侧滑返回）拦截：页内分屏的页面（找搭子、帖子详情、找机会…）里，
// 顶栏的返回箭头只是切回上一屏，但系统返回会直接离开整个页面；页面又是从底栏进来的（页面栈只有这一页）时，
// 就直接退出了小程序。
//
// 做法：带 custom-back 的 k-topbar 在小程序里挂一个看不见的 page-container。它显示着的时候，
// 系统返回只会关掉它而不会离开页面，k-topbar 收到后按顶栏返回箭头的同一个处理走（切回上一屏 / 离开本页），
// 然后再把它挂回去，下一次系统返回照样拦得住。
//
// 一个页面同一时刻只能有一个 page-container 显示：这里按页面记一个栈，只让最后挂上的那个顶栏生效。
// page-container 显示时调 navigateBack 会被它吞掉（只关掉容器、页面不动），所以 navigateBack 前统一先把当前页的拦截撤掉。
// ---------------------------------------------------------------------------

const stacks = {}

const currentPageId = () => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1]
  return page && typeof page.getPageId === 'function' ? String(page.getPageId()) : ''
}

const pageAlive = (pageId) => getCurrentPages().some(p => p && typeof p.getPageId === 'function' && String(p.getPageId()) === pageId)

/** 按页面重新决定谁生效：只有栈顶的显示，其余的撤掉 */
export function arm(pageId) {
  const list = stacks[pageId]
  if (!list) return
  // 为 navigateBack 卸掉的容器（parked，见 releaseCurrent）还在本页：先放回页面、这一轮不显示，下一轮再显示，
  // 保证新容器的 show 是从 false 变成 true，基础库才会重新开始拦截
  if (list.some(g => g.parked && g.parked.value)) {
    list.forEach(g => { if (g.parked) g.parked.value = false })
    return armSoon(pageId)
  }
  list.forEach((g, i) => { g.armed.value = i === list.length - 1 && g.enabled() })
}

const timers = {}
export function armSoon(pageId, delay = 80) {
  // 先撤再挂：show 必须从 false 变成 true 才会重新显示；同一页面只留最后一次
  if (timers[pageId]) clearTimeout(timers[pageId])
  timers[pageId] = setTimeout(() => {
    delete timers[pageId]
    // 这一页已经退掉时不再挂
    if (pageAlive(pageId)) arm(pageId)
  }, delay)
}

export function addGuard(pageId, guard) {
  if (!pageId) return
  const list = stacks[pageId] || (stacks[pageId] = [])
  list.forEach(g => { g.armed.value = false })
  list.push(guard)
  armSoon(pageId)
}

export function removeGuard(pageId, guard) {
  const list = stacks[pageId]
  if (!list) return
  const i = list.indexOf(guard)
  if (i >= 0) list.splice(i, 1)
  guard.armed.value = false
  if (list.length) armSoon(pageId)
  else delete stacks[pageId]
}

/** 撤掉当前页所有拦截；返回 true 表示刚才确实有拦截在显示 */
export function releaseCurrent() {
  const list = stacks[currentPageId()]
  if (!list) return false
  let had = false
  // 显示着的直接卸掉（parked），不只是把 show 改成 false：基础库收起 page-container 时会 window.scrollTo 回它挂上时的位置，
  // 滑到下面点返回会先闪回顶部；卸掉时它只停止拦截、不动滚动。parked 和 armed 在同一次 setData 里一起变
  list.forEach(g => { if (g.armed.value) { had = true; if (g.parked) g.parked.value = true } g.armed.value = false })
  return had
}

let installed = false
let passing = false
/** App 启动时装一次：navigateBack 之前先撤掉当前页的拦截，等它真的收起来再返回 */
export function installBackGuard() {
  if (installed) return
  installed = true
  uni.addInterceptor('navigateBack', {
    invoke(args) {
      if (passing) { passing = false; return args }
      const pageId = currentPageId()
      if (!releaseCurrent()) return args
      setTimeout(() => {
        passing = true
        uni.navigateBack(args)
        // 返回没成功（比如已经是第一页）时，把拦截挂回去
        armSoon(pageId, 600)
      }, 80)
      return false
    }
  })
}
