<template>
  <!-- AI袋鼠底部弹层（10-16 主人拍板：点「AI袋鼠」在当前页底部弹出来聊，不跳页）。
       遮罩点一下、右上角 × 、按住顶栏往下拖都能收起；回答里的按钮 / 卡片点了先收起再跳过去。
       页面滚动：小程序靠宿主页最上面的 page-meta（弹层里的对话区是 scroll-view，不能用 catchtouchmove 拦），网页版这里自己锁 body -->
  <view v-if="show" class="k-ai" role="dialog" aria-modal="true" aria-label="AI袋鼠">
    <view class="k-ai__mask" @click="close" @touchmove.stop.prevent="noop" />
    <view class="k-ai__sheet" :style="dragY ? 'transform: translateY(' + dragY + 'px)' : ''">
      <view class="k-ai__head" @touchstart="dragStart" @touchmove.stop.prevent="dragMove" @touchend="dragEnd" @touchcancel="dragEnd">
        <view class="k-ai__grip" />
        <image class="k-ai__logo" :src="botLogo" mode="aspectFit" />
        <text class="k-ai__title">AI袋鼠</text>
        <!-- 转人工沿用当前问题和订单。 -->
        <view class="k-ai__human" aria-role="button" hover-class="k-press" @click="toHuman"><k-icon name="headset" :size="15" color="red" :stroke="1.8" /><text>转人工</text></view>
        <view class="k-ai__x" hover-class="k-press" aria-role="button" aria-label="关闭" @click="close"><k-icon name="x" :size="20" color="muted" :stroke="2" /></view>
      </view>
      <!-- 快捷问题：先放按你正在办的事预测的，再放这个入口的高频问题 -->
      <scroll-view scroll-x class="k-ai__chips" :show-scrollbar="false"><view class="k-ai__chiprow"><view v-for="chipText in chips" :key="chipText" class="k-ai__chip" hover-class="k-press" @click="ask(chipText)"><text>{{ chipText }}</text></view></view></scroll-view>
      <scroll-view scroll-y class="k-ai__body" :scroll-top="scrollTop" :scroll-into-view="intoView" :scroll-with-animation="true">
        <view class="k-ai__list">
          <!-- 聊天记录（2026-11-03 主人：「历史聊天记录，永久保存，不能删除」）：最近 30 条在开场白上面，点这一行再往前翻；没有删除 / 清空 -->
          <view v-if="older" class="k-ai__more" hover-class="k-press" @click="more"><text>{{ loadingOlder ? '正在加载…' : '查看更早的聊天记录' }}</text></view>
          <!-- 订单情境：这张订单摆在最上面，问「取消要扣多少？」按它的退订政策试算 -->
          <view v-if="order" class="k-ai__order"><view class="k-ai__grow"><text class="k-ai__otitle">{{ orderTitle }}</text><text class="k-ai__meta">{{ orderDates }}</text></view><text class="k-ai__ostatus">{{ order.statusLabel }}</text></view>
          <view v-for="msgItem in msgs" :id="'kam-' + msgItem.key" :key="msgItem.key" class="k-ai__msg" :class="'k-ai__msg--' + msgItem.from">
            <!-- 灰色小字：「以上是之前的聊天记录」、游客的「登录后聊天记录会保存」（点了去登录） -->
            <text v-if="msgItem.from === 'tip'" class="k-ai__tip" :class="{ 'is-link': msgItem.url }" @click="msgItem.url && openLink(msgItem)">{{ msgItem.text }}</text>
            <image v-if="msgItem.from === 'bot'" class="k-ai__ava" :src="botLogo" mode="aspectFit" />
            <view v-if="msgItem.from !== 'tip'" class="k-ai__bubble">
              <text class="k-ai__text">{{ msgItem.text }}</text>
          <!-- #ifdef MP-WEIXIN -->
          <button v-if="msgItem.humanContact" class="k-ai__human" open-type="contact" :session-from="contactFrom">微信客服会话</button>
          <!-- #endif -->
              <view v-if="msgItem.refund" class="k-ai__refund"><text v-for="lineText in msgItem.refund" :key="lineText">{{ lineText }}</text></view>
              <view v-for="(cardItem, cardIndex) in msgItem.cards" :key="'c' + cardIndex" class="k-ai__card" hover-class="k-press" @click="openCard(cardItem)"><image v-if="cardItem.image" class="k-ai__cimg" :src="cardItem.image" mode="aspectFill" /><view class="k-ai__grow"><text class="k-ai__ctitle">{{ cardItem.title }}</text><text v-if="cardItem.status" class="k-ai__cstatus">{{ cardItem.status }}</text><text v-if="cardItem.meta" class="k-ai__meta">{{ cardItem.meta }}</text></view><k-icon v-if="cardItem.url" name="chevron-right" :size="14" color="muted" /></view>
              <view v-for="faqItem in msgItem.faqs" :key="faqItem.faqId" class="k-ai__faq" hover-class="k-press" @click="openFaq(faqItem)"><text class="k-ai__grow">{{ faqItem.question }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view>
              <view v-if="msgItem.links && msgItem.links.length" class="k-ai__links"><view v-for="linkItem in msgItem.links" :key="linkItem.label" class="k-ai__link" hover-class="k-press" @click="openLink(linkItem)"><text>{{ linkItem.label }}</text></view></view>
              <text v-if="msgItem.source" class="k-ai__src">信息来源：{{ msgItem.source }}</text>
            </view>
          </view>
          <view v-if="asking" class="k-ai__msg k-ai__msg--bot"><image class="k-ai__ava" :src="botLogo" mode="aspectFit" /><view class="k-ai__bubble"><text class="k-ai__text k-ai__typing">正在查…</text></view></view>
        </view>
      </scroll-view>
      <!-- 输入框：小程序弹键盘时把页面顶上去（adjust-position），光标离键盘留 20px -->
      <view class="k-ai__foot" @touchmove.stop.prevent="noop">
        <view class="k-ai__input"><input v-model="input" confirm-type="send" :maxlength="200" :adjust-position="true" :cursor-spacing="20" placeholder="输入你的问题" placeholder-class="k-placeholder" aria-label="输入你的问题" @confirm="send" /></view>
        <view class="k-ai__send" :class="{ 'is-off': !input.trim() }" hover-class="k-press-s" aria-role="button" aria-label="发送" @click="send"><k-icon name="send" :size="18" color="white" :stroke="2" /></view>
      </view>
    </view>
  </view>
</template>

<script setup>
// 用法：<k-ai-sheet :show="aiOpen" ctx="profile" @close="aiOpen = false" />；订单页再传 :order-no，退款试算照常出来。
// 同一页里收起再打开，对话接着上次的；换了情境或订单才重新开场。问答逻辑在 common/support-chat.js（整页客服也用它）
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import { go } from '@/common/screen.js'
import { useSupportChat } from '@/common/support-chat.js'
import { experience } from '@/common/experience.js'
import { useUserIcons } from '@/common/user-icons/scope.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const userIcons = useUserIcons()
const botLogo = computed(() => userIcons.value ? '/static/user-icons/mine-ai.png' : '/static/media/brand-kangaroo.png')
const props = defineProps({
  show: { type: Boolean, default: false },
  ctx: { type: String, default: 'profile' },
  orderNo: { type: String, default: '' }
})
// close 的参数：'nav' = 点了回答里的按钮 / 卡片要跳页（宿主页别再自己返回）
const emit = defineEmits(['close'])
const noop = () => {}

// 对话区滚到最下面：scroll-top 每次换一个更大的数才会再滚
const scrollTop = ref(0)
let bump = 0
// 11-18 微信核对：开着滚动动画时，动画中途再改 scroll-top 会被吞掉，开场几条接连回来时停在半路 → 最后一次 350ms 后再补滚一次
let tailTimer = 0
const scrollDown = () => nextTick(() => {
  scrollTop.value = 100000 + (++bump)
  clearTimeout(tailTimer)
  tailTimer = setTimeout(() => { scrollTop.value = 100000 + (++bump) }, 350)
})
const open = (url) => { emit('close', 'nav'); go(url) }
const { chips, msgs, input, asking, order, contactFrom, orderTitle, orderDates, start, ask, send, openFaq, openLink, toHuman, older, loadingOlder, loadOlder } = useSupportChat({ open, scroll: scrollDown })
// 往前翻一页：插到上面以后用 scroll-into-view 定位回原来最上面那一条，定位完清掉（不然下次 scroll-top 滚到底会被它压住）
const intoView = ref('')
async function more() {
  const anchor = await loadOlder()
  if (!anchor) return
  nextTick(() => { intoView.value = 'kam-' + anchor; setTimeout(() => { intoView.value = '' }, 400) })
}
const openCard = (cardItem) => { if (cardItem.url) open(cardItem.url) }
const close = () => emit('close')

// 按住顶栏往下拖：跟着手走，拖过 80px 松手就收起
const dragY = ref(0)
let y0 = -1
const dragStart = (e) => { y0 = e.touches && e.touches[0] ? e.touches[0].clientY : -1 }
const dragMove = (e) => { if (y0 >= 0 && e.touches && e.touches[0]) dragY.value = Math.max(0, e.touches[0].clientY - y0) }
const dragEnd = () => { const far = dragY.value > 80; y0 = -1; dragY.value = 0; if (far) close() }

// 网页版锁页面滚动（同岗位列表的 lockPageScroll）：只锁 body、不碰 html，关掉时原样还原
let restoreScroll = null
function lockPageScroll(on) {
  // #ifdef H5
  if (typeof document === 'undefined') return
  if (on && !restoreScroll) {
    const body = document.body
    const before = body.style.overflow
    body.style.overflow = 'hidden'
    restoreScroll = () => { body.style.overflow = before }
  } else if (!on && restoreScroll) {
    restoreScroll()
    restoreScroll = null
  }
  // #endif
}

let startedKey = ''
watch(() => props.show, (on) => {
  lockPageScroll(on)
  if (on) scrollDown()
}, { immediate: true })
watch(() => props.show && JSON.stringify([props.ctx, props.orderNo, experience.account?.id, experience.mode]), (key) => {
  if (!key || key === startedKey) return
  startedKey = key
  start(props.ctx, props.orderNo)
}, { immediate: true })
onUnmounted(() => lockPageScroll(false))
onUnmounted(() => clearTimeout(tailTimer))
</script>

<style scoped lang="scss">
.k-ai { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 900; }
.k-ai__mask { position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: rgba(36, 27, 23, .48); }
.k-ai__sheet { position: absolute; left: 0; right: 0; bottom: 0; height: 75vh; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: var(--k-bg); box-shadow: 0 -8px 28px rgba(58, 50, 43, .16); overflow: hidden; animation: k-ai-up .22s ease-out; }
@keyframes k-ai-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
.k-ai__head { position: relative; flex: 0 0 auto; height: 52px; padding: 6px 8px 0 16px; box-sizing: border-box; display: flex; align-items: center; gap: 8px; background: var(--k-paper); }
.k-ai__grip { position: absolute; left: 50%; top: 6px; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: var(--k-line2); }
.k-ai__logo { width: 26px; height: 28px; flex: 0 0 auto; }
.k-ai__title { flex: 1; min-width: 0; font-size: 17px; font-weight: 700; color: var(--k-ink); white-space: nowrap; }
/* 转人工：描边小胶囊（小程序里是 button，要去掉自带的边框和内边距） */
.k-ai__human { width: auto; height: 30px; margin: 0; padding: 0 10px; display: flex; align-items: center; gap: 4px; border: 1px solid var(--k-red); border-radius: 15px; background: var(--k-paper); color: var(--k-red); font-size: 13px; line-height: 28px; white-space: nowrap; }
.k-ai__human::after { border: 0; }
.k-ai__x { width: 40px; height: 40px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
.k-ai__chips { flex: 0 0 auto; width: 100%; white-space: nowrap; background: var(--k-paper); border-bottom: 1px solid var(--k-line); }
.k-ai__chiprow { display: inline-flex; gap: 8px; padding: 4px 16px 10px; }
.k-ai__chip { flex: 0 0 auto; height: 30px; padding: 0 12px; border-radius: 15px; background: var(--k-paper2); color: var(--k-ink); font-size: 13px; line-height: 30px; }
.k-ai__body { flex: 1; height: 0; min-height: 0; }
/* #ifdef H5 */
.k-ai__body :deep(.uni-scroll-view) { overscroll-behavior: contain; }
/* #endif */
.k-ai__list { padding: 12px 14px 8px; }
.k-ai__grow { flex: 1; min-width: 0; }
.k-ai__order { margin-bottom: 12px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; border-radius: 16px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.k-ai__otitle { display: block; font-size: 14px; font-weight: 700; color: var(--k-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.k-ai__ostatus { flex: 0 0 auto; color: var(--k-green); font-size: 12px; font-weight: 600; }
.k-ai__meta { display: block; margin-top: 3px; color: var(--k-muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.k-ai__msg { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
.k-ai__msg--me { justify-content: flex-end; }
.k-ai__ava { width: 30px; height: 32px; flex: 0 0 auto; }
.k-ai__bubble { min-width: 0; max-width: 82%; padding: 10px 12px; border-radius: 4px 14px 14px 14px; background: var(--k-paper); box-shadow: var(--k-sh1); }
.k-ai__msg--me .k-ai__bubble { border-radius: 14px 4px 14px 14px; background: var(--k-red); box-shadow: none; }
.k-ai__text { display: block; font-size: 14px; line-height: 1.65; color: var(--k-ink); white-space: pre-wrap; overflow-wrap: anywhere; }
.k-ai__msg--me .k-ai__text { color: #fff; }
.k-ai__typing { color: var(--k-muted); }
.k-ai__refund { margin-top: 8px; padding: 8px 10px; border-radius: 10px; background: var(--k-paper2); display: flex; flex-direction: column; gap: 4px; font-size: 13px; line-height: 1.5; }
.k-ai__refund text:last-child { font-weight: 700; color: var(--k-red-deep); }
.k-ai__card { margin-top: 8px; padding: 8px; display: flex; align-items: center; gap: 8px; border: 1px solid var(--k-line); border-radius: 10px; }
.k-ai__cimg { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 8px; background: var(--k-paper2); }
.k-ai__ctitle { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.k-ai__cstatus { display: block; margin-top: 3px; color: var(--k-green); font-size: 12px; font-weight: 600; }
.k-ai__faq { min-height: 40px; display: flex; align-items: center; gap: 6px; border-top: 1px solid var(--k-line); font-size: 14px; color: var(--k-ink); }
.k-ai__links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.k-ai__link { height: 30px; padding: 0 12px; border: 1px solid var(--k-red); border-radius: 15px; color: var(--k-red); font-size: 13px; line-height: 28px; white-space: nowrap; }
.k-ai__src { display: block; margin-top: 8px; color: var(--k-muted); font-size: 11px; }
.k-ai__more { margin-bottom: 12px; text-align: center; color: var(--k-muted); font-size: 13px; line-height: 32px; }
.k-ai__msg--tip { justify-content: center; }
.k-ai__tip { padding: 2px 10px; color: var(--k-muted); font-size: 12px; line-height: 1.6; text-align: center; }
.k-ai__tip.is-link { color: var(--k-red); }
.k-ai__foot { flex: 0 0 auto; display: flex; align-items: center; gap: 10px; padding: 8px 12px calc(8px + var(--k-safe-bottom)); border-top: 1px solid var(--k-line); background: var(--k-paper); }
.k-ai__input { flex: 1; min-width: 0; height: 40px; padding: 0 14px; display: flex; align-items: center; border: 1px solid var(--k-line2); border-radius: 20px; background: var(--k-bg); font-size: 14px; }
.k-ai__input input { width: 100%; height: 40px; font-size: 14px; }
.k-ai__send { width: 40px; height: 40px; flex: 0 0 auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--k-red); }
.k-ai__send.is-off { opacity: .45; }
</style>
