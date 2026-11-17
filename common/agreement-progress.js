// 仅记录当前正文的可见阅读进度，不持久化、不代替用户主动同意。
export function advanceRead(state, top, height, total) {
  if (![top, height, total].every(Number.isFinite) || top < 0 || height <= 0 || total <= 0) return state
  const started = state.started || top <= 6
  const end = Math.min(total, top + height)
  return { started, done: started && end >= total - 6, percent: started ? Math.min(100, Math.floor(end / total * 100)) : 0 }
}
