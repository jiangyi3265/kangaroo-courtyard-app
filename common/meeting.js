// 腾讯会议：认会议号、拼固定写法、一键拉起腾讯会议小程序。
// 后端仍只存一段 meetingInfo 文字（≤500 字）：员工端按 formatTencentMeeting 的固定写法保存，
// 旧的自由文字 / 粘贴进来的腾讯会议邀请也尽量认出会议号，所以后端不用改。
// 拉起方式按腾讯会议官方文档：https://meeting.tencent.com/support/topic/2125/index.html
const APP_ID = 'wx33fd6cdc62520063'
// 会议号 9–12 位：整串数字，或 3/4 位一组用空格、短横隔开（948 050 239、948-050-239）。
// 只认 3/4 位一组，免得把「2026-10-13 14:00」这类日期时间拼成一个号
const NUM = '(\\d{3,4}(?:[ -]\\d{3,4}){1,3}|\\d{9,12})(?!\\d)'
// 优先认「腾讯会议 / 会议号 / 会议ID / code=」后面紧跟的数字（不跨行，免得抓到下一行的电话）
const LABELED = new RegExp('(?:腾讯会议|会议|meeting|code)[ \\t]*(?:号码|号|id)?[ \\t]*[#:：=]?[ \\t]*' + NUM, 'gi')
const BARE = new RegExp('(^|\\D)' + NUM, 'g')
// 2026-11-03 主人：密码按 4–12 位字母或数字认（腾讯会议一般 4–6 位数字），和员工端校验一致
const PWD = /(?:会议|入会)?(?:密码|口令|pwd|passcode|password)[ \t]*[:：=]?[ \t]*([a-z0-9]{4,12})(?![a-z0-9])/i
// 2026-11-03 主人：腾讯会议链接（meeting.tencent.com/dm/…、/p/…，或 wemeet://）也算会议信息。
// 链接只认英文字符：邀请粘进单行输入框时各行会连在一起（…XHB#腾讯会议：…），在 # 或中文处断开
const LINK = /(?:https?:\/\/)?(?:[a-z0-9-]+\.)*meeting\.(?:tencent|qq)\.com\/[\w\-.~/?=&%+]*[\w=]|wemeet:\/\/[\w\-.~/?=&%+]*[\w=]/i
const ok = (c) => /^\d{9,12}$/.test(c)
// 中文输入法打出的全角数字、字母转半角，不然会议号、密码都认不出
const half = (v) => String(v || '').replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
const linkIn = (s) => { const m = LINK.exec(s); return m ? { hit: m[0], link: (/^[a-z]+:\/\//i.test(m[0]) ? '' : 'https://') + m[0] } : null }

export const cleanCode = (v) => half(v).replace(/[\s-]/g, '')
/** 密码框：去掉空格；粘进来的是「会议密码：145907」这类整句时只留密码 */
export const cleanPwd = (v) => { const s = half(v).trim(), p = PWD.exec(s); return p ? p[1] : s.replace(/\s/g, '') }
/** 链接框：从一段文字里取出腾讯会议链接（补上 https://），取不到就原样留着，保存时再提示 */
export const cleanLink = (v) => { const l = linkIn(half(v)); return l ? l.link : String(v || '').trim() }
// 显示用分组：9 位 3-3-3，10/11 位 3-4-3 / 3-4-4，12 位 3-3-3-3（每组都 ≥3 位，存回去还能认出来）
export const groupCode = (c) => (c.length > 11 ? c.replace(/(\d{3})(?=\d)/g, '$1 ') : c.replace(/^(\d{3})(\d{3,4})(\d{3,4})$/, '$1 $2 $3'))

/** 认出腾讯会议 → { code, pwd, note, link }，会议号和腾讯会议链接都没有时返回 null。
 *  只有链接时 code 为空串；note 是去掉会议号、密码、链接后剩下的文字 */
export function parseTencentMeeting(text) {
  let s = half(text)
  // 钉钉、飞书、Zoom 的会议号也是 9 位上下：旧文字写的是别的会议工具（没提腾讯）就不认，免得一键进到不存在的腾讯会议
  if (/zoom|钉钉|飞书|teams|webex/i.test(s) && !/腾讯|tencent/i.test(s)) return null
  // 链接里的随机串（/dm/fJ9g23xj5XHB）不当会议号认：先把链接拿出来
  const l = linkIn(s), link = l ? l.link : ''
  if (l) s = s.replace(l.hit, ' ')
  let m, hit = '', code = ''
  for (LABELED.lastIndex = 0; !code && (m = LABELED.exec(s));) if (ok(cleanCode(m[1]))) { hit = m[0]; code = cleanCode(m[1]) }
  // 没有会议号字样时才猜裸数字：跳过手机号、400/800 热线、像日期的数字，以及「电话 / 客服 / QQ / 订单」等字样后面的号码
  for (BARE.lastIndex = 0; !code && (m = BARE.exec(s));) {
    const c = cleanCode(m[2])
    if (ok(c) && !/^1\d{10}$|^[48]00\d{7}$|^(19|20)\d\d(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/.test(c)
      && !/电话|手机|联系|客服|热线|拨打|致电|tel|phone|qq|微信|订单|单号|工号|编号|账号|金额|[￥¥]/i.test(s.slice(Math.max(0, m.index - 8), m.index + 1))) { hit = m[2]; code = c }
  }
  // 个人会议室链接 /p/9480502391、wemeet://…meeting_code=… 里带着会议号，正文里没有时用它
  if (!code && link) code = (/\/p\/(\d{9,12})(?!\d)|meeting_?code=(\d{9,12})(?!\d)/i.exec(link) || []).slice(1).join('')
  if (!code && !link) return null
  const p = PWD.exec(s)
  // 旧数据常是整段粘贴的腾讯会议邀请：邀请语、腾讯会议入会链接、拨号入会、「复制该信息…」在小程序里没用，不当备注。
  // 只认邀请里的固定句子，员工自己写的备注（含别的链接）照常显示
  const note = s.replace(hit, '').replace(p ? p[0] : '', '').split('\n')
    .map((t) => t.replace(/[ \t]{2,}/g, ' ').replace(/^[\s#:：,，;；]+|[\s,，;；]+$/g, ''))
    .filter((t) => /[\da-z一-龥]/i.test(t) && !/邀请您参加腾讯会议|点击链接入会|复制该信息|一键拨号|根据您的位置拨号|meeting\.tencent\.com|^\+\d|^(?:腾讯会议|入会|会议)?链接[:：]?$/.test(t)).join('\n')
  return { code, pwd: p ? p[1] : '', note, link }
}

/** 固定写法：「腾讯会议号：948 050 239\n腾讯会议链接：https://…\n密码：6666\n备注」，没有的行省掉 */
export const formatTencentMeeting = (code, pwd, note, link) => {
  const c = cleanCode(code)
  return [c ? '腾讯会议号：' + groupCode(c) : '', link ? '腾讯会议链接：' + String(link).trim() : '', pwd ? '密码：' + String(pwd).trim() : '', String(note || '').trim()].filter(Boolean).join('\n')
}

/** 员工端看 / 提示用的一行：会议号 948 050 239，密码 6666，有入会链接 */
export const meetingSummary = (r) => [r.code ? '会议号 ' + groupCode(r.code) : '', r.pwd ? '密码 ' + r.pwd : '', r.link ? '有入会链接' : ''].filter(Boolean).join('，')

/** 员工端录入校验：会议号、腾讯会议链接至少填一个。返回要提示的话，空串表示通过 */
export function tencentInputError(code, pwd, link) {
  const c = cleanCode(code), l = String(link || '').trim()
  if (c && !ok(c)) return '腾讯会议号应为 9–12 位数字'
  if (!c && !l) return '请粘贴腾讯会议邀请或链接，或填写会议号（9–12 位数字）'
  if (l && !linkIn(l)) return '入会链接应为腾讯会议链接（meeting.tencent.com 开头）'
  const p = String(pwd || '').trim()
  return p && !/^[a-z0-9]{4,12}$/i.test(p) ? '会议密码应为 4–12 位字母或数字' : ''
}

/** 粘贴框 / 会议号框里的文字拆成会议号、密码、链接。认出的项覆盖原值（以粘贴的邀请为准），没认出的保留 cur 里的；
 *  整段都认不出返回 null */
export function readMeetingPaste(text, cur = {}) {
  const p = parseTencentMeeting(text)
  return p && { code: p.code || cleanCode(cur.code), pwd: p.pwd || cleanPwd(cur.pwd), link: p.link || cleanLink(cur.link) }
}

/** 会议号输入框失焦：去掉空格 / 短横；粘贴的是整段腾讯会议邀请或链接时拆出会议号、密码、链接（链接挪到链接栏）。
 *  2026-11-03 主人：邀请里有密码就用邀请里的（之前密码框填过就不换，旧的错密码会一直留着） */
export function readCodeInput(code, pwd, link) {
  const cur = { pwd, link }
  return (!/^[\d\s０-９-]*$/.test(code || '') && readMeetingPaste(code, cur)) || { code: cleanCode(code), pwd: cleanPwd(pwd), link: cleanLink(link) }
}

// 一键入会：微信里直接拉起腾讯会议小程序（首次要在腾讯会议里授权手机号）。
// 拉不起来（H5 没有这个能力，或用户取消以外的失败）就复制会议号和密码，提示去腾讯会议 App 加入
export function openTencentMeeting({ code, pwd, link, nickname } = {}) {
  const c = cleanCode(code)
  // 只有链接、没有会议号：腾讯会议小程序只认会议号，小程序里也打不开外部链接，只能复制链接，说清楚去哪打开
  if (!c) return link && uni.setClipboardData({ data: link, success: () => uni.showModal({ title: '入会链接已复制', content: '请打开手机浏览器，粘贴到地址栏打开；也可以打开腾讯会议 App 加入。', showCancel: false }) })
  const copy = () => uni.setClipboardData({
    data: formatTencentMeeting(c, pwd, '', link),
    success: () => uni.showToast({ title: '已复制会议号' + (pwd ? '和密码' : '') + '，请打开腾讯会议 App 加入', icon: 'none' })
  })
  // #ifdef MP-WEIXIN
  const q = { chn: 'DaishuYard', code: c, pwd, nm: nickname }
  // 昵称被截断成半个 emoji 时 encodeURIComponent 会抛错，按钮就点了没反应：编不了的参数直接不带
  const arg = (k) => { try { return k + '=' + encodeURIComponent(q[k]) } catch (e) { return '' } }
  return uni.navigateToMiniProgram({
    appId: APP_ID,
    path: 'pages/index/index?' + Object.keys(q).filter((k) => q[k]).map(arg).filter(Boolean).join('&'),
    envVersion: 'release',
    // 用户在微信的确认框里点了取消就算了，不再弹复制提示
    fail: (e) => { if (!/cancel/.test(e && e.errMsg)) copy() }
  })
  // #endif
  // #ifndef MP-WEIXIN
  copy()
  // #endif
}
