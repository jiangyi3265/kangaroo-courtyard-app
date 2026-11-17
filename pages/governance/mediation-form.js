// 与服务端 context.formRules 对齐；旧服务器未返回规则时沿用现有限制。
export const DEFAULT_MEDIATION_RULES = Object.freeze({
  narrativeMin: 50, narrativeMax: 10000, claimsMin: 2, claimsMax: 2000, amountMaxFen: 100000000
})

export function mediationRules(value) {
  const rules = { ...DEFAULT_MEDIATION_RULES }
  for (const key of Object.keys(rules)) {
    if (Number.isSafeInteger(value?.[key]) && value[key] > 0) rules[key] = value[key]
  }
  for (const prefix of ['narrative', 'claims']) {
    if (rules[prefix + 'Min'] > rules[prefix + 'Max']) {
      rules[prefix + 'Min'] = DEFAULT_MEDIATION_RULES[prefix + 'Min']
      rules[prefix + 'Max'] = DEFAULT_MEDIATION_RULES[prefix + 'Max']
    }
  }
  return rules
}

export const mediationTextCount = value => String(value || '').trim().length
export const combinedClaims = (tags, text) => [...tags, String(text || '').trim()].filter(Boolean).join('；')
export const mediationAmountRange = rules => '0～' + (rules.amountMaxFen / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + ' 元'

export function mediationFormErrors({ draft, selectedOrder, claims, files, categories, rules, uploading, now = Date.now() }) {
  const errors = []
  const add = (field, message) => errors.push({ field, message })
  if (!selectedOrder?.orderType || !Number.isSafeInteger(Number(selectedOrder?.orderId)) || Number(selectedOrder?.orderId) <= 0) add('order', '请选择关联订单。')
  if (!draft.category || !categories.includes(draft.category)) add('category', '请选择纠纷类型。')
  const dateTime = String(draft.date || '') + 'T' + String(draft.time || '') + ':00+08:00'
  const incidentAt = Date.parse(dateTime)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+08:00$/.test(dateTime) || !Number.isFinite(incidentAt)) add('incident', '请选择有效的发生日期和时间（北京时间）。')
  else if (incidentAt > now + 5 * 60 * 1000) add('incident', '发生时间不能晚于当前时间，请检查日期和时间（北京时间）。')
  const narrativeCount = mediationTextCount(draft.narrative)
  if (narrativeCount < rules.narrativeMin) add('narrative', `事件经过至少 ${rules.narrativeMin} 字，当前 ${narrativeCount} 字，还需 ${rules.narrativeMin - narrativeCount} 字。`)
  else if (narrativeCount > rules.narrativeMax) add('narrative', `事件经过最多 ${rules.narrativeMax} 字，当前 ${narrativeCount} 字，请删减后提交。`)
  const claimsCount = mediationTextCount(combinedClaims(claims, draft.claims))
  if (claimsCount < rules.claimsMin) add('claims', `请选择诉求，或填写至少 ${rules.claimsMin} 字的诉求。`)
  else if (claimsCount > rules.claimsMax) add('claims', `你的诉求最多 ${rules.claimsMax} 字（含已选诉求），当前 ${claimsCount} 字，请删减后提交。`)
  if (uploading) add('evidence', '证据正在上传，请等待上传完成后再提交。')
  else if (!files.length) add('evidence', '请上传至少 1 项证据材料（图片、视频、录音或文件）。')
  else if (files.length > 9 || files.some(file => !file.fileId)) add('evidence', '证据须为 1～9 项且全部上传成功，请检查附件。')
  const amount = String(draft.amount || '').trim()
  if (amount && !/^\d+(\.\d{1,2})?$/.test(amount)) add('amount', `涉及金额须在 ${mediationAmountRange(rules)}之间，最多保留两位小数；不涉及可留空。`)
  else if (amount && (!Number.isFinite(Number(amount)) || Number(amount) > rules.amountMaxFen / 100)) add('amount', `涉及金额超出范围，请填写 ${mediationAmountRange(rules)}之间的金额。`)
  if (!/^[+0-9 -]{7,24}$/.test(String(draft.phone || '').trim())) add('phone', '请填写有效联系电话，7～24 位，可包含数字、+、空格或短横线。')
  return errors
}
