<template>
  <view class="k-page support-page">
    <k-topbar back>
      <template #left><text class="sp-title">AI袋鼠客服</text></template>
      <!-- 「转人工」一直在右上角：小程序里直接打开微信自带的客服会话（带用户编号和来源页），网页版提交人工工单 -->
      <template #right>
        <!-- #ifdef MP-WEIXIN -->
        <button class="sp-human" open-type="contact" :session-from="contactFrom"><k-icon name="headset" :size="16" color="red" :stroke="1.8" /><text>转人工</text></button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="sp-human" hover-class="k-press" @click="toHuman"><k-icon name="headset" :size="16" color="red" :stroke="1.8" /><text>转人工</text></view>
        <!-- #endif -->
      </template>
      <!-- 快捷问题：先放按你正在办的事预测的（报名进度 / 入住和退款 / 查看客服回复 / 怎么提交成果），再放这个入口的高频问题；跟着顶栏吸顶 -->
      <scroll-view scroll-x class="sp-chips" :show-scrollbar="false"><view class="sp-chips__row"><view v-for="q in chips" :key="q" class="sp-chip" hover-class="k-press" @click="ask(q)"><text>{{ q }}</text></view></view></scroll-view>
    </k-topbar>
    <view class="sp-body">
      <!-- 聊天记录（2026-11-03 主人：「历史聊天记录，永久保存，不能删除」）：最近 30 条摆在开场白上面，点这一行再往前翻 30 条；没有删除 / 清空 -->
      <view v-if="older" class="sp-more" hover-class="k-press" @click="more"><text>{{ loadingOlder ? '正在加载…' : '查看更早的聊天记录' }}</text></view>
      <!-- 从订单页进来：先把这张订单摆在上面，问「取消要扣多少？」就按它的退订政策试算 -->
      <view v-if="order" class="sp-order" hover-class="k-press" @click="go(R.stayOrder + '?orderNo=' + encodeURIComponent(orderNo))"><view class="k-flex1"><text class="sp-order__title">{{ orderTitle }}</text><text class="sp-order__meta">{{ orderDates }}</text></view><text class="sp-order__status">{{ order.statusLabel }}</text></view>
      <view v-for="m in msgs" :id="'spm-' + m.key" :key="m.key" class="sp-msg" :class="'sp-msg--' + m.from">
        <!-- 灰色小字：「以上是之前的聊天记录」分隔线、游客的「登录后聊天记录会保存」（点了去登录） -->
        <text v-if="m.from === 'tip'" class="sp-tip" :class="{ 'is-link': m.url }" @click="m.url && openLink(m)">{{ m.text }}</text>
        <image v-if="m.from === 'bot'" class="sp-avatar" src="/pages/notice/static/cs-kangaroo.jpg" mode="aspectFill" />
        <view v-if="m.from !== 'tip'" class="sp-bubble">
          <text class="sp-text">{{ m.text }}</text>
          <!-- 退款试算（订单情境）：距入住多久、按政策扣多少、预计退多少 -->
          <view v-if="m.refund" class="sp-refund"><text v-for="line in m.refund" :key="line">{{ line }}</text></view>
          <view v-for="(c, j) in m.cards" :key="'c' + j" class="sp-card" hover-class="k-press" @click="c.url && go(c.url)"><image v-if="c.image" class="sp-card__img" :src="c.image" mode="aspectFill" /><view class="k-flex1 sp-card__copy"><text class="sp-card__title">{{ c.title }}</text><text v-if="c.status" class="sp-card__status">{{ c.status }}</text><text v-if="c.meta" class="sp-card__meta">{{ c.meta }}</text></view><k-icon v-if="c.url" name="chevron-right" :size="14" color="muted" /></view>
          <!-- 猜你想问：后台维护的常见问题，点了直接看答案 -->
          <view v-for="f in m.faqs" :key="f.faqId" class="sp-faq" hover-class="k-press" @click="openFaq(f)"><text class="k-flex1">{{ f.question }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
          <view v-if="m.links && m.links.length" class="sp-links"><view v-for="l in m.links" :key="l.label" class="sp-link" hover-class="k-press" @click="openLink(l)"><text>{{ l.label }}</text></view></view>
          <text v-if="m.source" class="sp-source">信息来源：{{ m.source }}</text>
        </view>
      </view>
      <view v-if="asking" class="sp-msg sp-msg--bot"><image class="sp-avatar" src="/pages/notice/static/cs-kangaroo.jpg" mode="aspectFill" /><view class="sp-bubble"><text class="sp-text sp-typing">正在查…</text></view></view>
    </view>
    <k-bottom pad="8px 12px">
      <view class="sp-input"><input v-model="input" :always-embed="true" confirm-type="send" :maxlength="200" placeholder="输入你的问题" placeholder-class="k-placeholder" aria-label="输入你的问题" @confirm="send" /></view>
      <view class="k-circle sp-send" :class="{ 'is-off': !input.trim() }" hover-class="k-press-s" aria-role="button" aria-label="发送" @click="send"><k-icon name="send" :size="18" color="white" :stroke="2" /></view>
    </k-bottom>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// AI袋鼠客服整页（内测反馈 2.0 改成聊天样式，参考美团客服）：
//   · 顶栏下面一排快捷问题，中间是对话气泡（卡片 + 最多 3 个跳转按钮 + 猜你想问），底部输入框，右上角「转人工」一直都在；
//   · 问答逻辑和底部弹出的 AI袋鼠（components/k-ai-sheet）共用 common/support-chat.js，回答都不是大模型生成。
// 10-16 起各页的「AI袋鼠」都在本页底部弹出（我的、消息、城市页、订单页…），不再跳到这一页；
// 这一页留给深链接：老消息里的 ?s=4 客服中心、旧版 pages/home/assistant?ctx=…（带情境和订单号转过来）、网络断开页的「联系客服」。
// 左上角返回回到原来那一页。
// ---------------------------------------------------------------------------
import { nextTick } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { go, decodeQuery } from '@/common/screen.js'
import { useSupportChat } from '@/common/support-chat.js'
import R from '@/common/routes.js'
import { experience } from '@/common/experience.js'

const scrollDown = () => nextTick(() => uni.pageScrollTo({ scrollTop: 1e6, duration: 200, fail: () => {} }))
const { orderNo, chips, msgs, input, asking, order, contactFrom, orderTitle, orderDates, start, ask, send, openFaq, openLink, toHuman, older, loadingOlder, loadOlder, owner } = useSupportChat({ open: go, scroll: scrollDown })

let opened = null
onLoad((q0) => {
  const q = decodeQuery(q0) || {}
  start(q.ctx, q.orderNo)
  opened = q
})
// 游客点「登录后聊天记录会保存」去登录、回来时：换成登录后的账号重新开场，把聊天记录接上（只在账号变了时，平常切回来不重来）
let shown = false
onShow(() => {
  if (!shown) { shown = true; return } // 第一次显示紧跟着 onLoad，已经在开场了
  if (opened && owner.value !== String((experience.account && experience.account.id) || '')) start(opened.ctx, opened.orderNo)
})
// 往前翻一页：插到上面以后滚回原来最上面那一条，不让页面跳走（顶栏吸顶，留出它的高度）
async function more() {
  const anchor = await loadOlder()
  if (anchor) nextTick(() => uni.pageScrollTo({ selector: '#spm-' + anchor, offsetTop: -150, duration: 0, fail: () => {} }))
}
</script>

<style scoped lang="scss">
.support-page { background: var(--k-bg); }
.sp-title { margin-left: 2px; font-size: 17px; font-weight: 700; color: var(--k-ink); white-space: nowrap; }
/* 转人工：顶栏右上角的小描边胶囊（小程序里是 button，要去掉自带的边框和内边距） */
.sp-human { width: auto; height: 30px; margin: 0; padding: 0 10px; display: flex; align-items: center; gap: 4px; border: 1px solid var(--k-red); border-radius: 15px; background: var(--k-paper); color: var(--k-red); font-size: 13px; line-height: 28px; white-space: nowrap; }
.sp-human::after { border: 0; }
.sp-chips { width: 100%; white-space: nowrap; border-bottom: 1px solid var(--k-line); }
.sp-chips__row { display: inline-flex; gap: 8px; padding: 6px 16px 10px; }
.sp-chip { flex: 0 0 auto; height: 30px; padding: 0 12px; border-radius: 15px; background: var(--k-paper2); color: var(--k-ink); font-size: 13px; line-height: 30px; }
.sp-body { padding: 12px 14px calc(84px + var(--k-safe-bottom)); }
.sp-order { margin-bottom: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; border-radius: var(--k-radius); background: var(--k-paper); box-shadow: var(--k-sh1); }
.sp-order__title { display: block; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-order__meta { display: block; margin-top: 4px; color: var(--k-muted); font-size: 12px; }
.sp-order__status { flex: 0 0 auto; color: var(--k-green); font-size: 12px; font-weight: 600; }
.sp-msg { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
.sp-msg--me { justify-content: flex-end; }
.sp-avatar { width: 34px; height: 34px; flex: 0 0 auto; border-radius: 50%; background: var(--k-paper2); }
.sp-bubble { min-width: 0; max-width: 82%; padding: 10px 12px; border-radius: 4px 14px 14px 14px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.sp-msg--me .sp-bubble { border-radius: 14px 4px 14px 14px; background: var(--k-red); box-shadow: none; }
.sp-text { display: block; font-size: 14px; line-height: 1.65; color: var(--k-ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.sp-msg--me .sp-text { color: #fff; }
.sp-typing { color: var(--k-muted); }
.sp-refund { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: var(--k-paper2); display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.5; }
.sp-refund text:last-child { font-weight: 700; color: var(--k-red-deep); }
.sp-card { margin-top: 8px; padding: 8px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--k-line); border-radius: 10px; }
.sp-card__img { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 8px; background: var(--k-paper2); }
.sp-card__copy { min-width: 0; }
.sp-card__title { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-card__meta { display: block; margin-top: 3px; color: var(--k-muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 状态（报名审核中 / 已回复 / 价格）单独一行绿字：之前放在右边，「审核通过，待约面试」一长就把标题挤成省略号 */
.sp-card__status { display: block; margin-top: 3px; color: var(--k-green); font-size: 12px; font-weight: 600; }
.sp-faq { min-height: 40px; display: flex; align-items: center; gap: 6px; border-top: 1px solid var(--k-line); font-size: 14px; color: var(--k-ink); }
.sp-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.sp-link { height: 30px; padding: 0 12px; border: 1px solid var(--k-red); border-radius: 15px; color: var(--k-red); font-size: 13px; line-height: 28px; white-space: nowrap; }
.sp-source { display: block; margin-top: 8px; color: var(--k-muted); font-size: 11px; }
.sp-more { margin-bottom: 12px; text-align: center; color: var(--k-muted); font-size: 13px; line-height: 32px; }
.sp-msg--tip { justify-content: center; }
.sp-tip { padding: 2px 10px; color: var(--k-muted); font-size: 12px; line-height: 1.6; text-align: center; }
.sp-tip.is-link { color: var(--k-red); }
.sp-input { flex: 1; min-width: 0; height: 40px; padding: 0 14px; display: flex; align-items: center; border: 1px solid var(--k-line2); border-radius: 20px; background: var(--k-paper); font-size: 14px; }
.sp-input input { width: 100%; height: 40px; font-size: 14px; }
.sp-send { width: 40px; height: 40px; flex: 0 0 auto; background: var(--k-red); }
.sp-send.is-off { opacity: .45; }
</style>
