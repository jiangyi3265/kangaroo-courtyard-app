// 出行证件（2026-11-03 主人：「订票以后让他提交这个身份证号」）。
// 录用后（门店确认录用 / 已签署 / 已入职）在签约到店最后一屏、面试页（报名进度）放一张卡片，提交前一直在；提交后变成一行「已提交 · 脱敏号码」，可以改。
// 存在服务端 kg_user_travel_id（V69），一人一份，以后的报名都用它；门店换工主理人 / 城市负责人导出到店名单时读它。
// 只在 jobs 分包里用（components/travel-id-card.vue），不进主包；不引用 @/ 下的模块，node --test 直接测（scripts/travel-id-20261103.test.mjs）。
// 这里的检查只是让人当场知道填错了，服务端（KgTravelIdService）按同一口径再查一遍。

/** 这些状态才问证件号：门店确认录用之后（订票、买保险都在这之后） */
export const TRAVEL_ID_STATUSES = ['store_confirmed', 'contract_signed', 'onboarded']

/** 要不要显示证件卡：到店岗位、已录用 */
export const shouldAskTravelId = (status, jobType) => jobType !== 'online' && TRAVEL_ID_STATUSES.indexOf(String(status || '')) >= 0

/** 去掉空格（人常按 6-8-4 分段输入），末位 x 统一大写 */
export const normalizeId = (raw) => String(raw == null ? '' : raw).replace(/\s+/g, '').toUpperCase()

/** 18 位身份证校验位（GB 11643），和服务端 KgAccountService.idChecksumOk 同一算法 */
export function idChecksumOk(id) {
  if (!/^\d{17}[0-9X]$/.test(id)) return false
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const check = '10X98765432'
  let sum = 0
  for (let i = 0; i < 17; i++) sum += Number(id[i]) * w[i]
  return check[sum % 11] === id[17]
}

/** 证件姓名：2–16 个汉字（少数民族姓名里的间隔号也算） */
export const validName = (name) => /^[一-龥·]{2,16}$/.test(String(name || '').trim())

/** 提交前检查：没问题返回 ''，否则返回要提示的一句话 */
export function checkTravelId(name, idNo) {
  if (!String(name || '').trim()) return '请填写证件上的姓名'
  if (!validName(name)) return '姓名请填身份证上的中文姓名'
  const id = normalizeId(idNo)
  if (!id) return '请填写身份证号'
  if (id.length !== 18) return '身份证号应为 18 位，现在是 ' + id.length + ' 位'
  if (!idChecksumOk(id)) return '身份证号好像填错了一位，请对着证件再核对一下'
  return ''
}
