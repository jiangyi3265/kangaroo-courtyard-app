<template>
  <!-- 10-16 内测反馈 2.0：首页 / 我的 / 订单三种情境的问答浮层下线，问答统一去聊天式客服页（pages/notice/support，订单情境保留退款试算）；
       这里只留人工工单页：客服回复的消息（/pages/home/assistant?ticket=工单号）点进来看回复、评价、继续追问。旧链接 ?ctx=… 转到客服页 -->
  <view class="k-page assistant-page">
    <k-topbar title="问题处理中" back custom-back @back="backFromTicket" />
    <view class="k-body handling k-pad-safe"><view class="transfer"><view class="info-circle"><k-icon name="info" :size="28" color="indigo" /></view><view><text>{{ ticket ? '已提交人工客服' : '转人工客服' }}</text><text>已为你生成问题摘要，确认后提交给人工客服。</text><text>工作日 9:00–18:00 处理，回复发到消息中心</text></view></view><view class="problem-card"><text class="section-title">问题摘要</text><text>{{ problemText }}</text></view><view class="related"><view class="related-title"><text>关联信息（已选择）</text><text v-if="!ticket" @click="addSupplement">修改</text></view><view v-if="relatedOrder"><k-icon name="square-check" :size="17" color="green" /><text>{{ relatedOrder }}</text></view><view v-if="supplement && !ticket"><k-icon name="square-check" :size="17" color="green" /><text>补充：{{ supplement }}</text></view><view class="privacy"><text>授权人工客服查看以上信息</text><view @click="agreed = !agreed"><k-icon :name="agreed ? 'square-check' : 'square'" :size="17" color="red" /><text>同意客服查看以上关联信息用于处理本次问题</text></view></view></view><text class="human-title">{{ humanTitle }}</text><view class="human-card"><view class="human"><image src="/static/media/assistant-avatar-lu.jpg" mode="aspectFill" /><text>袋鼠全球青年客服</text><text>{{ ticket ? ticket.time : '' }}</text></view><view class="human-message"><text>{{ humanMsg }}</text></view></view><view class="rating"><text>本次服务是否满意？</text><view><view v-for="(face,index) in faces" :key="face.score" @click="rate(face)"><k-icon :name="face.icon" :size="30" color="muted" /><text v-if="index===0">非常不满意</text><text v-if="index===4">非常满意</text></view></view></view><view class="human-input"><text @click="addSupplement">{{ supplement || (ticket ? '还有问题？点这里继续追问' : '请输入补充信息（可选）') }}</text><k-icon name="circle-plus" :size="27" color="ink" @click="addSupplement" /><view @click="submitTicket"><k-icon name="send" :size="22" color="white" /></view></view></view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 人工工单页（主包，越小越好）：
//   ?ticket=工单号：客服回复的消息点进来，看问题摘要和客服回复，可以评价满意度、继续追问（追问另建一张工单，写明原工单号）；
//   不带 ticket（旧版的 ?ctx=home / profile / order&orderNo=）：转到聊天式客服页 pages/notice/support，带上情境和订单号。
// 助手是规则问答 + 常见问题，不是大模型。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { back, toast, decodeQuery } from '@/common/screen.js'
import { apiSupportTicket, apiSupportTickets, apiSupportRate } from '@/common/api.js'
import { experience } from '@/common/experience.js'
import { prompt, errText } from '@/common/ui.js'
import R from '@/common/routes.js'

onLoad((q0) => {
  const q = decodeQuery(q0) || {}
  if (Number(q.ticket)) return openTicket(Number(q.ticket))
  const ctx = ['home', 'profile', 'order'].includes(q.ctx) ? q.ctx : 'profile'
  uni.redirectTo({ url: R.support + '?ctx=' + ctx + (q.orderNo ? '&orderNo=' + encodeURIComponent(q.orderNo) : '') })
})

const agreed = ref(true)
const ticket = ref(null)
const supplement = ref('')
const summary = computed(() => '用户咨询：需要人工协助')
const relatedOrder = computed(() => '')
const backFromTicket = () => back()
// 提交中连点发送会建出两张一样的工单
let submitting = false
// 已有工单（含从「客服回复了你的问题」消息进来的）时，底部输入框是「继续追问」：追问作为一张新工单提交（写明原工单号），客服照常在后台回复
async function submitTicket() {
  if (!agreed.value) return toast('请先同意授权客服查看关联信息')
  if (!experience.account) return toast('登录后可以转人工客服')
  if (submitting) return
  if (ticket.value && !supplement.value) {
    await addSupplement()
    if (!supplement.value) return
  }
  const t = ticket.value
  const q = t ? `追问（工单 ${t.ticketId}）：${supplement.value}` : ['需要人工协助', supplement.value].filter(Boolean).join('；补充：')
  // 追问前面还要加「追问（工单 N）：」：之前写了不到 500 字也被后端拒成「问题为 1–500 字」，看不懂；提交前先说清能写多少，原话留在输入框里改
  if (t ? supplement.value.length > 480 : q.length > 500) return toast(t ? '追问最多 480 字，请删减一些' : '问题和补充合计最多 500 字，请删减一些')
  submitting = true
  try {
    // 带上当前身份：员工身份下提交的，客服回复发回员工身份的消息中心
    const res = (await apiSupportTicket({ question: q, context: 'profile', summary: t ? `追问工单 ${t.ticketId}：${t.summary || t.question}` : summary.value, related: relatedOrder.value, mode: experience.mode })).data
    supplement.value = ''
    toast(res.message)
    await openTicket(res.ticketId)
  } catch (e) {
    toast(errText(e, '提交失败'))
  } finally {
    submitting = false
  }
}
async function addSupplement() {
  const v = await prompt(ticket.value ? '继续追问' : '补充信息（可选）', { value: supplement.value, placeholder: ticket.value ? '写下你还想问客服的（480 字以内）' : '例如：希望退到原支付账户' })
  if (v !== null) supplement.value = v
}
async function openTicket(id) {
  try {
    const list = (await apiSupportTickets()).data || []
    ticket.value = list.find(t => t.ticketId === id) || null
  } catch (e) {
    toast(errText(e, '工单加载失败'))
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
  try {
    toast((await apiSupportRate(ticket.value.ticketId, face.score)).msg || '感谢评价')
  } catch (e) {
    toast(errText(e, '评价失败'))
  }
}
</script>

<style scoped lang="scss">
.section-title{font-family:var(--k-serif);font-size:15px;font-weight:700}
.handling{padding-top:10px;padding-left:20px;padding-right:20px}.transfer,.problem-card,.related,.human-card,.rating{border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper)}.transfer{min-height:78px;padding:12px;display:flex;gap:10px}.info-circle{width:35px;height:35px;border-radius:50%;background:var(--k-indigo-soft);display:flex;align-items:center;justify-content:center}.transfer>view:last-child{flex:1}.transfer text{display:block;font-size:11px;color:var(--k-muted);margin-top:5px}.transfer text:first-child{margin-top:0;color:var(--k-ink);font-family:var(--k-serif);font-size:14px;font-weight:700}.problem-card{min-height:72px;margin-top:10px;padding:11px}.problem-card>text:last-child{display:block;margin-top:8px;color:var(--k-muted);font-size:10px;line-height:1.5}.related{margin-top:10px;overflow:hidden}.related-title{height:37px;display:flex;align-items:center;padding:0 11px;font-family:var(--k-serif);font-size:14px;font-weight:700}.related-title text:last-child{margin-left:auto;color:var(--k-indigo);font-family:var(--k-sans);font-size:11px}.related>view:not(.related-title):not(.privacy){min-height:29px;padding:0 11px;display:flex;align-items:center;gap:8px;color:var(--k-muted);font-size:10px}.privacy{margin-top:4px;padding:8px 11px;border-top:1px solid var(--k-line)}.privacy>text{font-family:var(--k-serif);font-size:11px;font-weight:700}.privacy>view{display:flex;align-items:center;gap:8px;margin-top:7px;color:var(--k-muted);font-size:9px}.human-title{display:block;margin:13px 5px 7px;color:var(--k-green);font-family:var(--k-serif);font-weight:700;font-size:15px}.human-card{padding:9px}.human{display:flex;align-items:center;gap:8px}.human image{width:31px;height:31px;border-radius:50%}.human text{font-family:var(--k-serif);font-size:12px;font-weight:700}.human text:last-child{color:var(--k-muted);font-family:var(--k-sans);font-size:9px;font-weight:400}.human-message{min-height:36px;margin-top:7px;padding:8px 9px;border:1px solid var(--k-line);border-radius:8px;display:flex;align-items:center;font-size:10px}.rating{height:82px;margin-top:10px;padding:9px;text-align:center;font-family:var(--k-sans);font-size:12px}.rating>view{display:grid;grid-template-columns:repeat(5,1fr);margin-top:8px}.rating>view>view{display:flex;flex-direction:column;align-items:center}.rating>view text{margin-top:4px;color:var(--k-muted);font-family:var(--k-sans);font-size:8px;white-space:nowrap}.human-input{height:43px;margin-top:11px;padding-left:12px;border:1px solid var(--k-line);border-radius:23px;display:flex;align-items:center;gap:11px;color:var(--k-light);font-size:10px}.human-input>text{flex:1}.human-input>view{width:38px;height:38px;margin-right:2px;border-radius:50%;background:var(--k-red);display:flex;align-items:center;justify-content:center}
.k-green{color:var(--k-green)}.k-red{color:var(--k-red)}
</style>
