// ---------------------------------------------------------------------------
// 通用选择页（pages/system/picker）：长名单一屏列出可搜索、时刻 / 日期 / 月日用滚轮选。
// 之前：超过 6 项的菜单只能「每页 5 项 + 下一页…」一页页翻；时刻、经历日期、生日要按 HH:mm / yyyy-MM-dd / MM-dd 手动输入。
// 用法和城市选择（common/city-picker.js）一样：打开新页面选，选完返回原页面，结果按请求号交回给打开它的那一处。
// 页面栈满等原因打不开时返回 PICKER_UNAVAILABLE，由调用方退回旧的菜单 / 输入框，保证总能选。
// ---------------------------------------------------------------------------
// 不从 ui.js 引 pad2：ui.js 反过来要引本文件
const pad2 = (n) => (n < 10 ? '0' + n : '' + n)

export const PICKER_UNAVAILABLE = '__picker_unavailable__'
const requests = new Map()
let nextId = 0
let activeId = null

export const pickerRequest = (id) => requests.get(id)?.options || null

export function finishPicker(id, result) {
  const request = requests.get(id)
  if (!request) return
  requests.delete(id)
  if (activeId === id) activeId = null
  request.resolve(result)
}

function openPicker(options, cancelValue) {
  // 已经开着一个选择页（连点）：这次当作取消
  if (activeId) return Promise.resolve(cancelValue)
  return new Promise((resolve) => {
    const id = String(++nextId)
    activeId = id
    requests.set(id, { options: { ...options, cancelValue }, resolve })
    uni.navigateTo({
      url: '/pages/system/picker?request=' + id,
      fail: () => finishPicker(id, PICKER_UNAVAILABLE)
    })
  })
}

/** 一屏列表单选：返回下标，取消返回 -1 */
export const pickFromList = (items, { title = '请选择', value = -1 } = {}) =>
  openPicker({ mode: 'list', title, items: items.map(String), value }, -1)

/** 时刻：返回 'HH:mm'，取消返回 null；step 为分钟间隔 */
export const pickTime = ({ title = '选择时间', value = '', step = 5 } = {}) =>
  openPicker({ mode: 'time', title, value, step }, null)

/** 日期（年 / 月 / 日滚轮，可快速跨年）：返回 'yyyy-MM-dd'；emptyText 有值时可选「清空」类选项并返回 ''；取消返回 null */
export const pickYmd = ({ title = '选择日期', value = '', min = '', max = '', emptyText = '' } = {}) =>
  openPicker({ mode: 'date', title, value, min, max, emptyText }, null)

/** 月日（生日，不带年份）：返回 'MM-dd'；emptyText 同上；取消返回 null */
export const pickMonthDay = ({ title = '选择日期', value = '', emptyText = '' } = {}) =>
  openPicker({ mode: 'monthday', title, value, emptyText }, null)

// ---- 滚轮数据（选择页与测试共用） ----
export const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
export const range = (a, b, step = 1) => { const out = []; for (let i = a; i <= b; i += step) out.push(i); return out }
export const ymd = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`
/** 把日期夹在 [min, max] 里（都是 yyyy-MM-dd，空串表示不限） */
export const clampYmd = (v, min, max) => (min && v < min ? min : (max && v > max ? max : v))
/** 'HH:mm' 按步长就近取整，返回 [时, 分] */
export function snapTime(value, step) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''))
  if (!m) return [9, 0]
  let h = Math.min(23, +m[1]), mi = Math.round(+m[2] / step) * step
  if (mi >= 60) { mi = 60 - step }
  return [h, mi]
}
