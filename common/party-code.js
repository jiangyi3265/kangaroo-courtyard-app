// 登录返回只接受公开房号，不接受任意页面或外部地址。
export function partyCode(value) {
  const code = String(value ?? '')
  return /^[1-9]\d{5}$/.test(code) ? code : ''
}
export function partyPath(code = '') {
  return '/pages/party/index' + (partyCode(code) ? '?code=' + partyCode(code) : '')
}
export function partyLoginReturn(query = {}) {
  if (query.partyCode == null) return ''
  const code = partyCode(query.partyCode)
  if (!code) throw new Error('房间号无效，请重新打开邀请')
  return partyPath(code) + (query.partyJoin === '1' ? '&join=1' : '')
}
