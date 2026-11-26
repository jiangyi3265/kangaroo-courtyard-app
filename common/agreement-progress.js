// 仅记录当前正文的可见阅读进度，不持久化、不代替用户主动同意。
export function advanceRead(state, top, height, total) {
  if (![top, height, total].every(Number.isFinite) || top < 0 || height <= 0 || total <= 0) return state
  const started = state.started || top <= 6
  const end = Math.min(total, top + height)
  return { started, done: started && end >= total - 6, percent: started ? Math.min(100, Math.floor(end / total * 100)) : 0 }
}

export const AGREEMENT_READ_SECONDS = 5

// 只累计正文处于可读状态的时间。离开页面时保留进度，换协议时重新计时。
export function readingClock(update) {
  let elapsed = 0, since = null, timeout = null
  function pause() {
    if (since !== null) elapsed += Math.max(0, Date.now() - since)
    since = null
    clearTimeout(timeout)
  }
  function tick() {
    const left = Math.max(0, AGREEMENT_READ_SECONDS - Math.floor((elapsed + Date.now() - since) / 1000))
    if (!left) pause()
    update(left)
    if (left && since !== null) timeout = setTimeout(tick, 250)
  }
  function start() {
    if (since !== null) return
    if (elapsed >= AGREEMENT_READ_SECONDS * 1000) { update(0); return }
    since = Date.now()
    tick()
  }
  function reset() { pause(); elapsed = 0; update(AGREEMENT_READ_SECONDS) }
  return { start, pause, reset }
}
