// ---------------------------------------------------------------------------
// AI袋鼠的问答逻辑（主包）：底部弹出的 AI袋鼠（components/k-ai-sheet）和整页客服（pages/notice/support）共用一份。
//   · 快捷问题：服务端 /app/support/quick 给，按你正在办的事预测的排前面，再接这个入口的高频问题；
//   · 回答来自 /app/support/ask：按问题意图查你本人的报名、订单、退款规则等真实数据，认不出意图时到常见问题里按关键词找，
//     都不是大模型生成；回答里带卡片和最多 3 个跳转按钮；
//   · 订单情境（ctx=order&orderNo=）：取这张订单，问「取消要扣多少？」时把退款试算画成一块；
//   · 转人工：小程序是微信自带的客服会话按钮（页面上放 open-type="contact"，这里只给 session-from），网页版提交人工工单。
//   · 聊天记录（2026-11-03 主人：「历史聊天记录，永久保存，不能删除」）：登录了，问答由服务端记进 kg_support_chat（V72），
//     打开时先取最近 30 条摆在开场白上面，「查看更早的聊天记录」往前翻；没有删除 / 清空。游客照旧不存，开场白下面提示「登录后聊天记录会保存」。
// open(url)：点卡片 / 按钮要去的页面，弹层先收起再跳；scroll()：来了新气泡滚到最下面。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { toast } from '@/common/screen.js'
import { apiSupportFaqs, apiSupportAsk, apiSupportQuick, apiSupportTicket, apiSupportContact, apiStayOrder, apiSupportHistory, apiSupportFaqRead } from '@/common/api.js'
import { experience, ensureSession } from '@/common/experience.js'
import { confirm, errText, yuan } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'

// 情境：我的 / 首页 / 订单 / 城市页和岗位页（city）。别的一律按「我的」
export const SUPPORT_CTX = ['home', 'profile', 'order', 'city']
const DEFAULT_CHIPS = {
  order: ['取消要扣多少？', '到店路线怎么走？', '能否提前入住？'],
  home: ['这周有什么活动？', '附近有什么兼职？', '附近换工'],
  profile: ['报名进度', '退款规则', '保险查询', '积分明细', '攻略申请']
}
// 直接写「转人工 / 人工客服 / 真人」的：网页版走工单，小程序提示点右上角（客服会话只能由用户点按钮打开）
const WANT_HUMAN = /转人工|找人工|人工客服|真人/

export function useSupportChat({ open = () => {}, scroll = () => {} } = {}) {
  const ctx = ref('profile')
  const orderNo = ref('')
  const chips = ref([])
  const msgs = ref([])
  const input = ref('')
  const asking = ref(false)
  const order = ref(null)
  // 聊天记录：older = 还有更早的；owner = 开场时登录的账号（换了账号页面要重新开场）
  const older = ref(false)
  const loadingOlder = ref(false)
  const owner = ref('')
  let oldestId = null
  let seq = 0
  let gen = 0 // 每次重新开场 +1：上一场还没回来的聊天记录不插进新的一场
  let lastQuestion = ''
  let ticketing = false

  const contactFrom = computed(() => String((experience.account && experience.account.id) || 'guest') + '|support-' + ctx.value)
  const city = computed(() => (!experience.allCities && experience.cities && experience.cities[0]) || '全部城市')
  // 每个气泡一个固定 key（历史的用 h+记录号）：往前翻插到最上面时不会整列重画，翻完还能定位回原来那一条
  const bubble = (m) => ({ key: 'n' + (++seq), cards: [], links: [], faqs: [], ...m })
  const say = (m) => { msgs.value.push(bubble(m)); scroll() }
  // 服务端的一条回答（实时的 /ask 和聊天记录同一个样子）→ 气泡：退款试算单独画一块，卡片最多 3 张、按钮最多 3 个
  const botBubble = (d, paid) => {
    const all = d.cards || []
    return {
      from: 'bot',
      text: d.text || '暂时问不到，稍后再试',
      refund: refundLines(all.find((c) => c.type === 'refund'), paid),
      cards: all.filter((c) => c.type !== 'refund').slice(0, 3).map((c) => ({ ...c, image: c.image ? absUrl(c.image) : '' })),
      links: (d.links || []).slice(0, 3),
      source: d.source || ''
    }
  }
  const fromHistory = (r) => ({ ...bubble(r.from === 'me' ? { from: 'me', text: r.text } : botBubble(r, 0)), key: 'h' + r.id })

  // 取一页聊天记录插到最上面；返回原来最上面那条的 key（往前翻时页面按它定位，不跳走）
  async function loadHistory(first) {
    if (loadingOlder.value) return ''
    loadingOlder.value = true
    const g = gen
    try {
      const d = (await apiSupportHistory(first ? null : oldestId)).data || {}
      if (g !== gen) return ''
      const rows = (d.list || []).map(fromHistory)
      const anchor = first ? '' : ((msgs.value[0] && msgs.value[0].key) || '')
      if (rows.length) {
        oldestId = d.list[0].id
        if (first) rows.push(bubble({ from: 'tip', text: '以上是之前的聊天记录' }))
        msgs.value.splice(0, 0, ...rows)
      }
      older.value = !!d.more
      if (first) scroll()
      return anchor
    } catch (e) {
      if (!first) toast(errText(e, '聊天记录加载失败'))
      return ''
    } finally {
      if (g === gen) loadingOlder.value = false
    }
  }
  const loadOlder = () => (older.value ? loadHistory(false) : Promise.resolve(''))

  // 打开一次对话：开场白、快捷问题、常见问题、客服热线、订单各取各的，哪个失败都不挡别的
  async function start(c, no) {
    ctx.value = SUPPORT_CTX.includes(c) ? c : 'profile'
    orderNo.value = no || ''
    msgs.value = []
    order.value = null
    older.value = false
    loadingOlder.value = false
    oldestId = null
    owner.value = ''
    const g0 = ++gen
    lastQuestion = ''
    chips.value = DEFAULT_CHIPS[ctx.value === 'city' ? 'home' : ctx.value]
    say({
      from: 'bot',
      text: ctx.value === 'order'
        ? '你好，我是AI袋鼠。这张订单的问题可以直接问我，点「取消要扣多少？」我按它的退订政策给你试算退款。'
        : '你好，我是AI袋鼠，可以问我报名进度、退款、保险、活动和岗位，也可以点下面的常见问题。答不上来的，点右上角「转人工」。'
    })
    await ensureSession()
    if (g0 !== gen) return // 等登录恢复的时候又重新开场了（换了情境 / 订单），这一场不再往下走
    owner.value = String((experience.account && experience.account.id) || '')
    if (owner.value) loadHistory(true)
    else say({ from: 'tip', text: '登录后聊天记录会保存，点这里登录', url: R.login })
    apiSupportQuick(ctx.value).then((r) => { const list = (r && r.data) || []; if (list.length) chips.value = list.slice(0, 8) }).catch(() => {})
    apiSupportFaqs().then((r) => {
      const faqs = ((r && r.data) || []).slice(0, 5)
      if (faqs.length) say({ from: 'bot', text: '猜你想问：', faqs })
    }).catch(() => {})
    apiSupportContact().then((r) => {
      const d = (r && r.data) || {}
      if (d.available && d.phone) say({ from: 'bot', text: `也可以打客服热线 ${d.phone}（${d.hours || '工作日 9:00–18:00'}）。`, links: [{ label: '拨打电话', phone: d.phone }] })
    }).catch(() => {})
    if (ctx.value === 'order' && orderNo.value) {
      apiStayOrder(orderNo.value).then((r) => { order.value = (r && r.data) || null }).catch(() => toast('订单加载失败'))
    }
  }

  const orderTitle = computed(() => { const o = order.value; return o ? `${(o.stay && o.stay.stayName) || ''}${o.stay && o.stay.typeName ? ' · ' + o.stay.typeName : ''}` : '' })
  const orderDates = computed(() => { const o = order.value; return o ? `${String(o.checkIn).slice(5)} 入住 · ${o.nights} 晚 · 实付 ¥${yuan(o.payFen)}` : '' })

  // 退款试算卡：按这张订单下单时的退订政策（接口 cards 里 type=refund 的那张）
  // paid：实付（分）。聊天记录里的旧试算传 0，不再拿当前订单去算比例
  function refundLines(c, paid) {
    if (!c) return null
    const pct = paid && c.refundFen != null ? Math.round((1 - c.refundFen / paid) * 100) : null
    return [
      `距入住：${c.hoursLeftText || '—'}`,
      c.allowed ? (pct == null ? '按退订政策扣除部分费用' : `按退订政策扣除约 ${pct}%`) : '当前不支持申请退款',
      `预计退款金额：¥${yuan(c.refundFen || 0)}`
    ]
  }

  async function ask(question) {
    const q = String(question || '').trim()
    if (!q || asking.value) return
    say({ from: 'me', text: q })
    lastQuestion = q
    if (WANT_HUMAN.test(q)) return humanHint()
    asking.value = true
    scroll()
    try {
      const d = (await apiSupportAsk({ question: q, context: ctx.value, city: city.value, orderNo: orderNo.value || undefined })).data || {}
      say(botBubble(d, Number((order.value && order.value.payFen) || 0)))
    } catch (e) {
      say({ from: 'bot', text: errText(e, '暂时问不到，稍后再试') })
    } finally {
      asking.value = false
    }
  }

  const send = () => {
    const q = input.value
    input.value = ''
    ask(q)
  }

  function openFaq(f) {
    say({ from: 'me', text: f.question })
    lastQuestion = f.question
    say({ from: 'bot', text: f.answer, source: '常见问题' })
    // 登录了把这一问一答也记进聊天记录（服务端按 faqId 取原文）；记失败不打扰，答案已经显示了
    if (experience.account) apiSupportFaqRead(f.faqId, ctx.value).catch(() => {})
  }

  function openLink(l) {
    if (l.phone) {
      uni.makePhoneCall({ phoneNumber: l.phone, fail: () => {} })
      return
    }
    if (l.url) open(l.url)
  }

  function humanHint() {
    // #ifdef MP-WEIXIN
    say({ from: 'bot', text: '点右上角「转人工」，直接进入微信里的人工客服对话，可以发文字和图片。' })
    // #endif
    // #ifndef MP-WEIXIN
    toHuman()
    // #endif
  }

  // 网页版转人工：把刚才问的（或输入框里写的）问题提交成工单，客服工作日回复到消息中心
  async function toHuman() {
    if (!experience.account) return toast('请先登录')
    const typed = input.value.trim()
    const q = typed || (WANT_HUMAN.test(lastQuestion) ? '' : lastQuestion)
    if (!q) {
      say({ from: 'bot', text: '先在下面写下你要咨询的问题，再点右上角「转人工」，我把它交给人工客服。' })
      return
    }
    if (ticketing || !(await confirm('转人工客服', `把问题「${q}」提交给人工客服？工作日 9:00–18:00 处理，回复会发到消息中心。`))) return
    ticketing = true
    try {
      const related = orderNo.value ? `订单：${orderNo.value}　${orderTitle.value}` : ''
      // 带上当前身份：员工身份下提交的，客服回复发回员工身份的消息中心
      const d = (await apiSupportTicket({ question: q, context: ctx.value, summary: orderNo.value ? `用户咨询订单 ${orderNo.value} 的问题：${q}` : `用户咨询：${q}`, related, mode: experience.mode })).data || {}
      if (typed) input.value = ''
      say({ from: 'bot', text: d.message || '已提交人工客服', links: d.ticketId ? [{ label: '查看工单', url: R.assistant + '?ticket=' + d.ticketId }] : [] })
    } catch (e) {
      say({ from: 'bot', text: errText(e, '提交失败，请稍后再试') })
    } finally {
      ticketing = false
    }
  }

  return { ctx, orderNo, chips, msgs, input, asking, order, contactFrom, orderTitle, orderDates, start, ask, send, openFaq, openLink, toHuman, older, loadingOlder, loadOlder, owner }
}
