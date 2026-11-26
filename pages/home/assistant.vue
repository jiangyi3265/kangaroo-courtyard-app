<template>
  <!-- 10-16 内测反馈 2.0：首页 / 我的 / 订单三种情境的问答浮层下线，问答统一去聊天式客服页（pages/notice/support，订单情境保留退款试算）；
       这里只留人工工单页：客服回复的消息（/pages/home/assistant?ticket=工单号）点进来看回复、评价、继续追问。旧链接 ?ctx=… 转到客服页 -->
  <view class="k-page assistant-page" :class="$userSurface">
    <k-topbar title="人工客服工单" back custom-back @back="backFromTicket" />
    <view v-if="!ticket" class="k-body k-pad-safe" role="status">
      <text>{{ ticketError || '正在读取工单…' }}</text>
      <k-button v-if="ticketError" type="outline" label="重新加载" @click="openTicket(requestedTicket)" />
    </view>
    <view v-else class="k-body handling k-pad-safe"><view class="transfer"><view class="info-circle"><k-icon name="headset" :size="20" color="red" /></view><view><text>{{ ticket ? '已提交人工客服' : '转人工客服' }}</text><text>下方可查看问题、客服回复和处理进度。</text><text>工作日 9:00–18:00 处理，回复发到消息中心</text></view></view><view class="problem-card"><text class="section-title">问题摘要</text><text>{{ problemText }}</text></view><view class="related"><view class="related-title"><text>关联信息（已选择）</text><text v-if="!ticket" @click="addSupplement">修改</text></view><view v-if="relatedOrder"><k-icon name="square-check" :size="16" color="red" /><text>{{ relatedOrder }}</text></view><view v-if="supplement && !ticket"><k-icon name="square-check" :size="16" color="red" /><text>补充：{{ supplement }}</text></view><view class="privacy"><text>授权人工客服查看以上信息</text><view hover-class="k-press" @click="agreed = !agreed"><k-icon :name="agreed ? 'square-check' : 'square'" :size="16" :color="agreed ? 'red' : 'muted'" /><text>同意客服查看以上关联信息用于处理本次问题</text></view></view></view><view class="human-card"><view class="human-title"><text class="section-title">{{ humanTitle }}</text></view><view class="human"><image src="/static/media/assistant-avatar-lu.jpg" mode="aspectFill" /><text>袋鼠全球青年客服</text><text>{{ ticket ? ticket.time : '' }}</text></view><view class="human-message"><text>{{ humanMsg }}</text></view><view class="rating"><text>本次服务是否满意？</text><view><view v-for="(face,index) in faces" :key="face.score" hover-class="k-press" @click="rate(face)"><k-icon :name="face.icon" :size="28" color="muted" /><text v-if="index===0">非常不满意</text><text v-if="index===4">非常满意</text></view></view></view></view><view class="human-input"><text @click="addSupplement">{{ supplement || (ticket ? '还有问题？点这里继续追问' : '请输入补充信息（可选）') }}</text><k-icon name="circle-plus" :size="20" color="muted" @click="addSupplement" /><view hover-class="k-press-s" @click="submitTicket"><k-icon name="send" :size="18" color="white" /></view></view></view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 人工工单页（主包，越小越好）：
//   ?ticket=工单号：客服回复的消息点进来，看问题摘要和客服回复，可以评价满意度、继续追问（追问另建一张工单，写明原工单号）；
//   不带 ticket（旧版的 ?ctx=home / profile / order&orderNo=）：转到聊天式客服页 pages/notice/support，带上情境和订单号。
// 助手是规则问答 + 常见问题，不是大模型。
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { back, toast, decodeQuery } from '@/common/screen.js'
import { apiSupportTicket, apiSupportTicketDetail, apiSupportRate } from '@/common/api.js'
import { submitSupportTicket } from '@/common/support-ticket-request.js'
import { experience, ensureSession } from '@/common/experience.js'
import { prompt, errText } from '@/common/ui.js'
import R from '@/common/routes.js'

onLoad((q0) => {
  const q = decodeQuery(q0) || {}
  if (/^[1-9][0-9]*$/.test(String(q.ticket || ''))) return openTicket(String(q.ticket))
  const ctx = ['home', 'profile', 'order'].includes(q.ctx) ? q.ctx : 'profile'
  uni.redirectTo({ url: R.support + '?ctx=' + ctx + (q.orderNo ? '&orderNo=' + encodeURIComponent(q.orderNo) : '') })
})

const agreed = ref(true)
const ticket = ref(null), requestedTicket = ref(''), ticketError = ref('')
const supplement = ref('')
const summary = computed(() => '用户咨询：需要人工协助')
const relatedOrder = computed(() => ticket.value?.related || '')
const backFromTicket = () => back()
let generation = 0, busy = false
let retry = null
function resetTicket() {
  generation++
  busy = false
  supplement.value = ''
  retry = null
  agreed.value = true
  ticket.value = null
}
watch([() => experience.account?.id, () => experience.mode], () => {
  if (!requestedTicket.value) return
  if (experience.account?.id) openTicket(requestedTicket.value)
  else { resetTicket(); ticketError.value = '登录后可以查看自己的工单' }
}, { flush: 'sync' })
onUnload(() => { requestedTicket.value = ''; resetTicket() })

const submitTicket = () => followUp(true)
const addSupplement = () => followUp(false)
async function followUp(send) {
  const t = ticket.value
  if (!t || busy) return
  if (!experience.account) return toast('登录后可以转人工客服')
  if (send && !agreed.value) return toast('请先同意授权客服查看关联信息')
  const current = generation, mode = experience.mode
  const prefix = `追问（工单 ${t.ticketId}）：`
  const max = 500 - prefix.length
  let question
  busy = true
  try {
    if (!send || !supplement.value.trim()) {
      const v = await prompt('继续追问', { value: supplement.value, placeholder: `写下你还想问客服的（${max} 字以内）` })
      if (current !== generation || v === null) return
      supplement.value = v.trim()
    }
    if (!send || !supplement.value) return
    if (!agreed.value) return toast('请先同意授权客服查看关联信息')
    if (supplement.value.length > max) return toast(`追问最多 ${max} 字，请删减一些`)
    question = prefix + supplement.value
    const res = (await submitSupportTicket(experience.account.id, {
      followUpTicketId: String(t.ticketId), question, mode,
      context: t.context || 'profile', summary: `追问工单 ${t.ticketId}：${t.summary || t.question}`, related: t.related || ''
    }, apiSupportTicket, retry?.question === question ? retry.id : undefined)).data
    if (current !== generation) return
    supplement.value = ''
    toast(res.message)
    await openTicket(res.ticketId)
  } catch (e) {
    if (current === generation) {
      if (e.ticketRequestId) retry = { question, id: e.ticketRequestId }
      toast(errText(e, '提交失败'))
    }
  } finally {
    if (current === generation) busy = false
  }
}
async function openTicket(id) {
  const key = String(id)
  resetTicket()
  const current = generation
  requestedTicket.value = key
  ticketError.value = ''
  try {
    await ensureSession()
    if (current !== generation) return
    if (!experience.account) throw new Error('登录后可以查看自己的工单')
    const res = await apiSupportTicketDetail(key)
    if (current !== generation) return
    if (String(res.data?.ticketId) !== key) throw new Error('未找到这份工单')
    ticket.value = res.data
  } catch (e) {
    if (current === generation) ticketError.value = errText(e, '工单加载失败')
  }
}
// 工单页之前只显示摘要：追问建的新工单摘要是「追问工单 N：原问题」，自己刚写的追问哪儿都看不到；摘要里没有本单原话时接在后面显示
const problemText = computed(() => { const t = ticket.value; if (!t) return summary.value; const m = t.summary || ''; return m && !m.includes(t.question) ? m + '\n' + t.question : m || t.question })
const humanTitle = computed(() => (ticket.value ? `工单${ticket.value.statusLabel}` : '提交后由人工客服处理'))
const humanMsg = computed(() => (ticket.value ? (ticket.value.reply || '已收到你的问题，工作日 9:00–18:00 处理，回复会发到消息中心。') : '确认下面的授权后提交，客服会在消息中心回复你。'))
// 下标 0 = 非常不满意（原来笑脸在第一个，和文字颠倒了）
const faces = [{ icon: 'frown', score: 1 }, { icon: 'frown', score: 2 }, { icon: 'meh', score: 3 }, { icon: 'smile', score: 4 }, { icon: 'laugh', score: 5 }]
async function rate(face) {
  if (!ticket.value) return toast('提交工单并收到回复后可以评价')
  if (!ticket.value.reply) return toast('客服回复后再评价吧')
  const current = generation
  try {
    const res = await apiSupportRate(ticket.value.ticketId, face.score)
    if (current === generation) toast(res.msg || '感谢评价')
  } catch (e) {
    if (current === generation) toast(errText(e, '评价失败'))
  }
}
</script>

<style scoped lang="scss">
.assistant-page{--k-bg:var(--k-page)}.section-title{font-size:15px;font-weight:600}
.handling{padding-top:12px;padding-left:16px;padding-right:16px}.transfer,.problem-card,.related,.human-card{border-radius:12px;background:var(--k-paper)}.transfer{padding:14px 12px;display:flex;align-items:flex-start;gap:12px}.info-circle{width:40px;height:40px;flex:0 0 auto;border-radius:12px;background:var(--k-red-soft);display:flex;align-items:center;justify-content:center}.transfer>view:last-child{flex:1;min-width:0}.transfer text{display:block;font-size:12px;line-height:1.6;color:var(--k-muted);margin-top:2px}.transfer text:first-child{margin-top:0;color:var(--k-ink);font-size:15px;font-weight:600;line-height:21px}.problem-card{margin-top:12px;padding:14px 12px}.problem-card>text:last-child{display:block;margin-top:6px;color:var(--k-ink2);font-size:14px;line-height:1.6;white-space:pre-line}.related{margin-top:12px;overflow:hidden}.related-title{height:44px;display:flex;align-items:center;padding:0 12px;font-size:15px;font-weight:600}.related-title text:nth-child(2){margin-left:auto;color:var(--k-red-deep);font-size:12px;font-weight:500}.related>view:not(.related-title):not(.privacy){min-height:32px;padding:0 12px;display:flex;align-items:center;gap:6px;color:var(--k-ink2);font-size:13px}.privacy{position:relative;margin-top:4px;padding:12px}.related-title+.privacy{margin-top:0;padding-top:0}.related-title+.privacy::before{display:none}.privacy::before,.rating::before{content:'';position:absolute;left:12px;right:12px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}.privacy>text{font-size:13px;font-weight:500;color:var(--k-ink2)}.privacy>view{display:flex;align-items:center;gap:6px;margin-top:4px;color:var(--k-muted);font-size:12px}.human-title{display:flex;align-items:center;gap:6px;margin-bottom:10px;line-height:21px}.human-card{margin-top:12px;padding:14px 12px}.human{display:flex;align-items:center;gap:8px}.human image{width:32px;height:32px;border-radius:50%}.human text{font-size:14px;font-weight:600}.human text:last-child{margin-left:auto;color:var(--k-muted);font-size:11px;font-weight:400}.human-message{margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--k-red-soft);color:var(--k-ink2);font-size:14px;line-height:1.6}.rating{position:relative;margin:12px -12px 0;padding:12px 12px 0;text-align:center;font-size:14px;font-weight:500}.rating>view{display:grid;grid-template-columns:repeat(5,1fr);margin-top:10px}.rating>view>view{display:flex;flex-direction:column;align-items:center;min-height:44px}.rating>view text{margin-top:4px;color:var(--k-muted);font-size:11px;font-weight:400;white-space:nowrap}.handling{padding-bottom:calc(76px + var(--k-safe-bottom))}.human-input{position:fixed;z-index:9;left:0;right:0;bottom:0;padding:8px 12px calc(8px + var(--k-safe-bottom));box-shadow:0 -.5px 0 var(--k-line);background:var(--k-paper);display:flex;align-items:center;gap:8px;color:var(--k-muted);font-size:14px}.human-input>text{flex:1;min-width:0;height:36px;padding:0 14px;border-radius:18px;background:var(--k-fill);line-height:36px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.human-input>view{width:36px;height:36px;border-radius:50%;background:var(--k-grad-brown);display:flex;align-items:center;justify-content:center}
@media (max-width:359px){.handling{padding-left:12px;padding-right:12px}.transfer{gap:8px;padding:14px 12px}.info-circle{width:32px;height:32px;border-radius:10px}.transfer text{font-size:11px}}
</style>
