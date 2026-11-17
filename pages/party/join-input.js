import { partyCode } from '@/common/party-code.js'

// 只在用户点击“粘贴房号”时调用，不在进页或恢复页面时读取剪贴板。
export function readClipboardRoomCode(platform) {
  // 默认调用保留 uni.API 字面量，供 H5 编译器收集所需的 API 实现。
  const adapter = platform || { getClipboardData: options => uni.getClipboardData(options) }
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('暂时无法粘贴，请长按输入框粘贴或手动输入房号'))
    if (typeof adapter.getClipboardData !== 'function') return fail()
    try {
      adapter.getClipboardData({
        success(result) {
          const raw = typeof result?.data === 'string' ? result.data.trim() : ''
          if (!raw) return reject(new Error('剪贴板为空，请先复制好友发来的6位房间号'))
          const value = partyCode(raw)
          if (!value) return reject(new Error('请只复制6位房间号，再点粘贴房号'))
          resolve(value)
        },
        fail
      })
    } catch { fail() }
  })
}

export function hideRoomKeyboard(platform) {
  const adapter = platform || { hideKeyboard: options => uni.hideKeyboard(options) }
  return new Promise(resolve => {
    let timer
    const done = () => { clearTimeout(timer); resolve() }
    // 部分宿主不回调 hideKeyboard；不能因此把“加入”锁死。
    timer = setTimeout(done, 250)
    try {
      if (typeof adapter.hideKeyboard === 'function') adapter.hideKeyboard({ complete: done })
      else done()
    } catch { done() }
  })
}

export function openRoomPage(url, platform) {
  const adapter = platform || {
    navigateTo: options => uni.navigateTo(options),
    redirectTo: options => uni.redirectTo(options)
  }
  return new Promise((resolve, reject) => {
    try {
      adapter.navigateTo({ url, success: resolve, fail(error) {
        // 页面栈已满时替换当前大厅；其他错误允许留在原页重试。
        if (/limit|exceed/i.test(String(error?.errMsg || ''))) {
          try { adapter.redirectTo({ url, success: resolve, fail: reject }) } catch (e) { reject(e) }
        } else reject(error)
      } })
    } catch (e) { reject(e) }
  })
}
