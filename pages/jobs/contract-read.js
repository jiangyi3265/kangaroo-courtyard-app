// 责任书阅读进度（2026-11-03 主人：「不要弹窗确认的，往下滑到底就百分百了」）。
// 只在 jobs 分包里用（pages/jobs/contract.vue），不进主包；不引用 @/ 下的模块，node --test 直接测（scripts/contract-read-20261103.test.mjs）。
//
// 条款全文平铺在页面上；进度 = 条款列表已经滑进屏幕的比例（按列表的上边和高度、屏幕可视高度算），列表最底下进了屏幕就是 100%。
// 差几像素（取整、安全区）也算到底，免得滑到底了还卡在 99%。

/** 到底的容差（px） */
export const BOTTOM_SLACK = 6

/**
 * rect：条款列表的 boundingClientRect（top 相对可视区顶边，height 列表高度）；viewport：可视区高度（windowHeight）。
 * 返回 0–100 的整数；量不到（没有高度、参数不对）返回 -1，由页面决定怎么兜底。
 */
export function readPercent(rect, viewport) {
  const top = Number(rect && rect.top)
  const height = Number(rect && rect.height)
  const vh = Number(viewport)
  if (!Number.isFinite(top) || !(height > 0) || !(vh > 0)) return -1
  const seen = vh - top // 列表从上边起已经露出来的高度
  if (seen >= height - BOTTOM_SLACK) return 100
  if (seen <= 0) return 0
  return Math.min(99, Math.max(0, Math.floor((seen / height) * 100)))
}

/** 进度只增不减：往回翻看不会把已读的退回去 */
export const nextRead = (prev, measured) => (measured > prev ? measured : prev)
