// 采购报销（R12，V66，2026-10-31 主人拍板）小程序这边的纯逻辑：pages/staff/reimburse.vue 和工作台入口共用。放 staff 分包，不进主包，不引 @/，node --test 直接跑。
// 规则以服务端 KgReimburseService 为准，这里只先挡常见漏填，说法和服务端一样；状态文字、按钮能不能点（canEdit、canWithdraw）都听服务端的。
// 金额全程是字符串（"128.50"）：服务端按 BigDecimal 算，这里不转数字、不做加减。
// 文件名不能叫 reimburse.js：和页面同名会被打到包根目录、算进主包（见 merchant-app-20261030.test.mjs）。

export const REIMBURSE_PAGE = '/pages/staff/reimburse' // 服务端通知的 route 写死了这个路径（KgReimburseService.route），不能改
export const REIMBURSE_API = '/app/staff/reimbursements'
export const RULE_NOTE = '没提交进表的不报销'
export const MAX_RECEIPTS = 9
export const ITEM_MAX = 60
export const REMARK_MAX = 200
export const QUANTITY_MAX = 999999
export const MIN_DATE = '2000-01-01'

const clean = (v) => String(v == null ? '' : v).trim()
const charCount = (s) => Array.from(s).length // 和服务端一样按字算：一个表情算一个字

// ---------------------------------------------------------------- 地址：一页三用，靠地址区分（页面栈自带返回，不用页内切屏）

const withStore = (url, storeId) => (storeId == null || storeId === '' ? url : url + (url.includes('?') ? '&' : '?') + 'storeId=' + encodeURIComponent(storeId))
export const listUrl = (storeId) => withStore(REIMBURSE_PAGE, storeId)
export const createUrl = (storeId) => withStore(REIMBURSE_PAGE + '?create=1', storeId)
export const detailUrl = (id, storeId) => withStore(REIMBURSE_PAGE + '?id=' + encodeURIComponent(id), storeId)
export const editUrl = (id, storeId) => withStore(REIMBURSE_PAGE + '?id=' + encodeURIComponent(id) + '&edit=1', storeId)

/** ?id= 详情（通知点开就是它）；?id=&edit=1 驳回后修改；?create=1 新增；什么都不带是列表。编号不转数字，不丢精度 */
export function pageOf(query) {
  const q = query || {}
  const id = /^[1-9]\d{0,18}$/.test(String(q.id == null ? '' : q.id)) ? String(q.id) : null
  if (id) return { mode: q.edit ? 'form' : 'detail', id }
  return { mode: q.create ? 'form' : 'list', id: null }
}

// ---------------------------------------------------------------- 工作台入口

/** 这家店要不要放入口。只有小院主理人才调（别的角色会被拦截器 403）；读不到就当不放，不打扰工作台 */
export async function reimburseVisible(get, storeId) {
  try {
    const data = (await get(REIMBURSE_API + '/access', { storeId })).data || {}
    return data.visible === true
  } catch (e) {
    return false
  }
}

// ---------------------------------------------------------------- 状态

export const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'paid', label: '已打款' }
]

/** 页签上的条数：「全部」是四个状态加起来（条数不是钱，可以加） */
export function tabsOf(counts) {
  const c = counts || {}
  const n = (key) => Number(c[key]) || 0
  return STATUS_TABS.map(tab => ({ ...tab, count: tab.value ? n(tab.value) : STATUS_TABS.reduce((sum, one) => sum + (one.value ? n(one.value) : 0), 0) }))
}

/** 四个状态四种颜色，字也写着，不只靠颜色：待审 赭黄、通过 靛蓝（还没到账）、驳回 提醒红、打款 豆绿 */
export const statusTone = (status) => ({ pending: 'wait', approved: 'pass', rejected: 'back', paid: 'paid' })[status] || 'wait'

/** 详情顶上那一句：现在到哪一步、接下来等谁 */
export function statusHint(row) {
  const r = row || {}
  if (r.status === 'approved') return '已通过，等平台打款'
  if (r.status === 'paid') return '平台已标记打款，请留意收款'
  if (r.status === 'rejected') return r.canEdit ? '改好后可以再交一次' : '平台已驳回'
  return '已提交，等平台审核'
}

/** 列表上那一句「谁交的」：同店别的小院主理人交的也在表里，自己的不写 */
export const submitterText = (row) => (row && !row.isMine && row.submitterName ? row.submitterName + ' 提交' : '')

// ---------------------------------------------------------------- 日期

/** '2026-10-30' → '2026年10月30日'；不认识的原样返回 */
export function cnDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : String(value || '')
}

/** '2026-10-31 10:05:00' → '2026年10月31日 10:05'；空的给 ''  */
export function cnTime(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value || ''))
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日 ${m[4]}:${m[5]}` : cnDate(value)
}

// ---------------------------------------------------------------- 表单

// 数量不预填 1：年纪大的人点进去接着打 2，容易变成 12
export const newForm = () => ({ itemName: '', quantity: '', amount: '', purchaseDate: '', receipts: [], remark: '' })

/** 驳回后修改：把这一笔带回表单。金额还是服务端给的字符串 */
export const formFromRow = (row) => ({
  itemName: row.itemName || '',
  quantity: row.quantity == null ? '' : String(row.quantity),
  amount: row.amount == null ? '' : String(row.amount),
  purchaseDate: row.purchaseDate || '',
  receipts: Array.isArray(row.receipts) ? [...row.receipts] : [],
  remark: row.remark || ''
})

// 和服务端 KgStayCommentService.visible 同一个意思：全是空格、零宽字符的不算写了字。漏掉的怪字符服务端还会挡
const hasVisibleText = (s) => /[^\s­͏؜ᅟᅠ឴឵᠋-᠎​-‏‪-‮⁠-⁯⠀ㅤ︀-️﻿ﾠ￹-￻]/.test(s)

export function itemProblem(raw) {
  const s = clean(raw)
  return !hasVisibleText(s) || charCount(s) > ITEM_MAX ? `请填写品名（1–${ITEM_MAX} 字）` : ''
}

export function quantityProblem(raw) {
  const s = clean(raw)
  if (!s) return '请填写数量'
  if (!/^\d{1,9}$/.test(s) || Number(s) < 1) return '数量要是正整数'
  return Number(s) > QUANTITY_MAX ? `数量不能超过 ${QUANTITY_MAX}` : ''
}

/** 大于 0，不超过 100000，最多两位小数。按字符串比，不转成浮点数 */
export function amountProblem(raw) {
  const s = clean(raw)
  if (!s) return '请填写金额'
  if (!/^\d+(\.\d+)?$/.test(s)) return '金额要是数字，最多两位小数'
  const [whole, part = ''] = s.split('.')
  if (part.length > 2) return '金额最多两位小数'
  const int = whole.replace(/^0+/, '')
  if (!int && !/[1-9]/.test(part)) return '金额要大于 0'
  if (int.length > 6 || (int.length === 6 && (int !== '100000' || /[1-9]/.test(part)))) return '金额不能超过 100000 元'
  return ''
}

export function dateProblem(value, today) {
  const s = clean(value)
  if (!s) return '请选择购买日期'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < MIN_DATE) return '购买日期不对，请重新选择'
  return s > today ? '购买日期不能晚于今天' : ''
}

export function receiptsProblem(list) {
  const n = Array.isArray(list) ? list.length : 0
  if (!n) return '请至少上传 1 张凭证照片'
  return n > MAX_RECEIPTS ? `凭证照片最多 ${MAX_RECEIPTS} 张` : ''
}

export const remarkProblem = (raw) => (charCount(clean(raw)) > REMARK_MAX ? `备注最多 ${REMARK_MAX} 字` : '')

// 页面从上到下的顺序：第一个错就滚到那里
export const FIELD_ORDER = ['itemName', 'quantity', 'amount', 'purchaseDate', 'receipts', 'remark']

/** 有错的字段 → 那一句话；都没错是空对象 */
export function formErrors(form, today) {
  const f = form || {}
  const all = {
    itemName: itemProblem(f.itemName),
    quantity: quantityProblem(f.quantity),
    amount: amountProblem(f.amount),
    purchaseDate: dateProblem(f.purchaseDate, today),
    receipts: receiptsProblem(f.receipts),
    remark: remarkProblem(f.remark)
  }
  const out = {}
  for (const key of FIELD_ORDER) if (all[key]) out[key] = all[key]
  return out
}

/** 提交的 body：金额、数量都传字符串，服务端照收 */
export const payloadOf = (form) => ({
  itemName: clean(form.itemName),
  quantity: clean(form.quantity),
  amount: clean(form.amount),
  purchaseDate: clean(form.purchaseDate),
  receipts: [...(form.receipts || [])],
  remark: clean(form.remark)
})

/** 连点两下、超时重试：服务端回 409「这一笔已经提交过了，不用再交」，其实已经进表了，当成功 */
export const alreadySubmitted = (e) => !!e && e.code === 409 && /已经提交过了/.test(String(e.message || ''))

/** 翻页时新记录把后面的行往下挤，下一页开头可能和上一页末尾重复：按编号去重 */
export function mergeRows(current, next) {
  const seen = new Set((current || []).map(row => String(row.reimburseId)))
  return (current || []).concat((next || []).filter(row => !seen.has(String(row.reimburseId))))
}
