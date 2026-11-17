<template>
  <view v-if="noticePopup.show && noticePopup.notice" class="k-notice-popup" role="dialog" aria-modal="true">
    <view class="k-notice-popup__mask" @touchmove.stop.prevent="noop" />
    <view class="k-notice-popup__card">
      <view class="k-notice-popup__head" @touchmove.stop.prevent="noop">
        <view class="k-notice-popup__badge"><k-icon name="bell-ring" :size="17" color="white" :stroke="2" /></view>
        <text class="k-notice-popup__title">{{ noticePopup.notice.title }}</text>
      </view>
      <scroll-view scroll-y class="k-notice-popup__body"><text class="k-notice-popup__text">{{ noticePopup.notice.content }}</text></scroll-view>
      <text class="k-notice-popup__tip" @touchmove.stop.prevent="noop">以后可以在「消息 → 系统通知」里再看</text>
      <view class="k-notice-popup__foot" @touchmove.stop.prevent="noop"><k-button block label="我知道了" @click="dismissNoticePopup" /></view>
    </view>
  </view>
</template>

<script setup>
// 进小程序时的公告弹窗：内容来自后台「小程序公告」，状态与「看过」的记录在 common/notice.js。
// 首页、岗位列表页各放一个；本次启动只会弹一次，点「我知道了」记下看过的版本。
import { noticePopup, dismissNoticePopup } from '@/common/notice.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

// 遮罩和卡片上不会滚的部分（标题、提示、按钮区）拦住滑动，弹窗开着时背后的页面不跟着滚。
// 正文 scroll-view 和包着它的卡片不能拦（拦了正文自己也滑不动）：那一块靠宿主页 page-meta 锁住页面滚动
const noop = () => {}
</script>

<style scoped lang="scss">
.k-notice-popup { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 999; display: flex; align-items: center; justify-content: center; padding: 0 26px; box-sizing: border-box; }
.k-notice-popup__mask { position: absolute; left: 0; right: 0; top: 0; bottom: 0; background: rgba(36, 27, 23, .48); }
.k-notice-popup__card { position: relative; width: 100%; max-width: 360px; padding: 18px 16px 14px; border-radius: 16px; background: var(--k-paper); box-sizing: border-box; display: flex; flex-direction: column; }
.k-notice-popup__head { display: flex; align-items: center; gap: 9px; }
.k-notice-popup__badge { width: 30px; height: 30px; border-radius: 50%; background: var(--k-red); display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.k-notice-popup__title { flex: 1; min-width: 0; font-family: var(--k-serif); font-size: 18px; font-weight: 700; line-height: 1.4; color: var(--k-ink); }
.k-notice-popup__body { max-height: 52vh; margin-top: 12px; }
.k-notice-popup__text { display: block; font-size: 15px; line-height: 1.8; color: var(--k-ink); white-space: pre-wrap; word-break: break-all; }
.k-notice-popup__tip { display: block; margin-top: 10px; font-size: 12px; color: var(--k-muted); }
.k-notice-popup__foot { margin-top: 12px; }
</style>
