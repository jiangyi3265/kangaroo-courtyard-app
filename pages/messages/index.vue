<template>
  <view class="k-page messages-page">
    <template v-if="s !== 4">
      <k-topbar title="袋鼠小院">
        <view class="msg-tabs"><view v-for="tab in tabs" :key="tab.name" class="msg-tab" :class="{ active: activeTab === tab.name }" @click="activeTab = tab.name"><text>{{ tab.name }}</text><text v-if="tab.badge" class="badge">{{ tab.badge }}</text></view></view>
      </k-topbar>
      <view class="all-body k-pad-tab">
        <view v-if="!filteredMessages.length" class="empty-messages">
          <k-icon name="message-circle" :size="46" color="muted" />
          <text class="k-title">{{ emptyTitle }}</text><text class="empty-copy">{{ emptyCopy }}</text>
          <k-button type="outline" @click="relaunch(experience.mode === 'staff' ? R.staff : R.home)">{{ experience.mode === 'staff' ? '返回工作台' : '去首页看看' }}</k-button>
        </view>
        <view v-for="item in filteredMessages" :key="item.id" class="notice-item" @click="openMessage(item)">
          <view class="notice-icon notice-icon--blue"><k-icon :name="item.icon || 'message-circle'" :size="24" color="white" /></view>
          <view class="notice-copy"><text class="notice-title">{{ item.title }}</text><text>{{ item.desc }}</text></view>
          <view class="notice-side"><text>{{ item.time }}</text><text v-if="!item.read" class="red-dot" /></view>
        </view>
        <view class="service-link" @click="s = 4"><view class="service-icon"><k-icon name="headset" :size="29" color="ink" /></view><view><text>联系袋鼠小院客服</text><text>常见问题 · 在线咨询 · 转人工</text></view><k-icon name="chevron-right" :size="21" color="ink" /></view>
      </view>
      <k-tabbar active="messages" :mode="experience.mode" />
    </template>

    <!-- 4 客服中心 -->
    <template v-else>
      <k-topbar title="袋鼠小院客服" back @back="s = 1" />
      <view class="support-body">
        <view class="faq-card"><view class="faq-head"><text>常见问题</text><view><text>更多</text><k-icon name="chevron-right" :size="18" color="muted" /></view></view><view class="faq-grid"><view v-for="f in faqs" :key="f.label"><view><k-icon :name="f.icon" :size="29" color="ink" /></view><text>{{ f.label }}</text></view></view></view>
        <view class="assistant-card"><text class="support-title">AI 小袋鼠助手</text><view class="assistant-row"><image src="/static/media/cs-kangaroo.jpg" mode="aspectFit" /><text>您好，我是小袋鼠助手，\n可以帮您解答常见问题</text></view><view class="assistant-questions"><view v-for="q in aiQuestions" :key="q" @click="toast(q)"><text>{{ q }}</text></view><k-button type="outline" size="sm">换一批</k-button></view></view>
        <view class="online-card"><text class="support-title">在线客服</text><view class="online-row"><view class="service-icon large"><k-icon name="headset" :size="32" color="ink" /></view><view><text>工作时间 09:00 – 21:00（每日）</text><text>当前咨询人数较少，请描述您的问题</text></view></view><k-button size="lg" block>转人工客服</k-button></view>
        <view class="phone-card"><text class="support-title">联系电话</text><view class="phone-row"><view class="service-icon large"><k-icon name="phone" :size="31" color="ink" /></view><view><text>400-888-6655</text><text>工作时间 09:00 – 21:00（每日）</text></view><k-button type="outline" size="sm">拨打电话</k-button></view></view>
        <view class="support-foot"><k-icon name="rabbit" :size="26" color="muted" /><text>服务由袋鼠小院提供</text></view><view class="k-home-indicator" />
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useScreen, toast, go, relaunch } from '@/common/screen.js'
import { experience, visibleMessages, markMessageRead } from '@/common/experience.js'
import R from '@/common/routes.js'
const activeTab = ref('全部')
const s = useScreen(4, { onLoad: q => { activeTab.value = q.s === '2' ? '系统' : q.s === '3' ? '订单' : '全部' } })
const tabs = computed(() => ['全部', '系统', '订单', '私信', '群聊'].map(name => ({
  name, badge: visibleMessages.value.filter(m => !m.read && (name === '全部' || m.category === name)).length
})))
const filteredMessages = computed(() => visibleMessages.value.filter(m => activeTab.value === '全部' || m.category === activeTab.value))
const emptyTitle = computed(() => activeTab.value === '全部' ? '暂无消息' : `暂无${activeTab.value}消息`)
const emptyCopy = computed(() => ({
  '全部': '有新的通知或会话时，会在这里提醒你。报名、面试、签约等消息仅在你参与后产生。',
  '系统': '与你有关的系统通知会显示在这里。',
  '订单': '报名或预订后，相关订单通知会显示在这里。',
  '私信': '收到私信后，可以在这里查看和回复。',
  '群聊': '加入群聊后，群消息会显示在这里。'
}[activeTab.value]))
const openMessage = item => { markMessageRead(item.id); if (item.url?.startsWith('/pages/')) go(item.url) }
const faqs=[{label:'报名审核',icon:'search'},{label:'面试流程',icon:'search'},{label:'签约与责任书',icon:'file-badge'},{label:'保险说明',icon:'shield-check'},{label:'到店与交通',icon:'bus'},{label:'费用与退款',icon:'wallet-cards'}]
const aiQuestions=['报名后多久会有面试通知？','责任书怎么签署？','保险什么时候生效？']
</script>

<style scoped lang="scss">
.empty-messages { display:flex; flex-direction:column; align-items:center; gap:20px; padding:64px 16px 48px; text-align:center; }.empty-copy { color:var(--k-muted); font-size:14px; line-height:1.8; max-width:30em; }

.messages-page{background:var(--k-bg)}.brand{padding-left:10px;font-family:var(--k-serif);font-size:21px;font-weight:700}.msg-tabs{height:44px;padding:0 16px;border-bottom:1px solid var(--k-line);display:flex;justify-content:space-between}.msg-tab{position:relative;min-width:47px;height:44px;display:flex;align-items:center;justify-content:center;font-family:var(--k-serif);font-size:15px;font-weight:700}.msg-tab.active::after{content:'';position:absolute;left:8px;right:8px;bottom:0;height:2px;background:var(--k-red)}.badge{position:absolute;right:0;top:1px;min-width:17px;height:17px;padding:0 3px;border-radius:9px;background:var(--k-red);color:#fff;font:10px/17px sans-serif;text-align:center}.all-body,.system-body,.order-body{padding:8px 16px 102px}.day-title,.system-title{display:block;margin:0 4px 6px;font-family:var(--k-serif);font-size:16px;font-weight:700}.yesterday{margin-top:9px}.notice-item{min-height:72px;height:auto;margin-bottom:7px;padding:0 10px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);display:flex;align-items:center;gap:10px}.notice-icon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.notice-icon--blue{background:#496981}.notice-icon--orange{background:#D7893C}.notice-icon--green{background:#4E8565}.notice-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px;color:var(--k-muted);font-size:14px;line-height:1.6}.notice-title{font-family:var(--k-serif);font-size:15px;font-weight:700;color:var(--k-ink)}.notice-side{align-self:stretch;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;gap:7px;color:var(--k-muted);font-size:11px}.red-dot{width:7px;height:7px;border-radius:50%;background:var(--k-red)}.num-badge{min-width:17px;height:17px;border-radius:9px;background:var(--k-red);color:#fff;text-align:center;font-size:10px;line-height:17px}.service-link{height:58px;margin-top:10px;padding:0 12px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);display:flex;align-items:center;gap:10px}.service-icon{width:42px;height:42px;border-radius:50%;background:var(--k-paper2);display:flex;align-items:center;justify-content:center}.service-link>view:nth-child(2){min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}.service-link>view:nth-child(2) text:first-child{font-family:var(--k-serif);font-size:15px;font-weight:700}.service-link>view:nth-child(2) text:last-child{color:var(--k-muted);font-size:11px}
.progress-card{padding:7px 10px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper)}.progress-row{min-height:56px;display:flex;align-items:flex-start;border-bottom:1px dashed var(--k-line);padding:5px 0}.progress-row:last-child{border:0}.progress-left{position:relative;width:38px}.progress-icon{width:31px;height:31px;border:1px solid var(--k-line2);border-radius:50%;display:flex;align-items:center;justify-content:center}.progress-line{position:absolute;left:11px;top:31px;color:var(--k-green);font-size:20px}.progress-index{width:20px;color:var(--k-green);font-size:14px;font-weight:700;padding-top:6px}.progress-index.current{color:var(--k-red)}.progress-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;color:var(--k-muted);font-size:11px}.progress-copy text:first-child{color:var(--k-ink);font-family:var(--k-serif);font-size:14px;font-weight:700}.progress-action{width:64px;display:flex;flex-direction:column;align-items:flex-end;gap:6px}.progress-state{padding:2px 6px;border-radius:4px;background:var(--k-green-soft);color:var(--k-green);font-size:10px}.progress-state.pending{background:var(--k-ochre-soft);color:#9B6A29}.more-title{margin-top:10px}.system-list{border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);overflow:hidden}.system-notice{height:58px;padding:0 10px;border-bottom:1px solid var(--k-line);display:flex;align-items:center;gap:9px}.system-notice:last-child{border:0}.system-side{display:flex;flex-direction:column;align-items:flex-end;gap:5px;color:var(--k-muted);font-size:10px}
.order-card{padding:12px 14px;margin-bottom:8px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;flex-direction:column;gap:8px;color:var(--k-muted);font-size:12px}.order-head,.order-pay{display:flex;align-items:center;justify-content:space-between}.order-head text:first-child{font-family:var(--k-serif);font-size:17px;font-weight:700;color:var(--k-ink)}.red{color:var(--k-red);font-weight:700}.green{color:var(--k-green);font-weight:700}.amount{font-size:14px;font-weight:700;color:var(--k-ink)}.order-dynamic-title{margin-top:10px}.order-dynamics{border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);overflow:hidden}.dynamic-row{height:62px;padding:0 10px;border-bottom:1px solid var(--k-line);display:flex;align-items:center;gap:9px}.dynamic-row:last-child{border:0}.dynamic-side{display:flex;flex-direction:column;align-items:flex-end;gap:6px;color:var(--k-muted);font-size:10px}
.support-body{padding:8px 16px 26px}.faq-card,.assistant-card,.online-card,.phone-card{padding:12px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);margin-bottom:10px}.faq-head{display:flex;align-items:center;justify-content:space-between}.faq-head>text,.support-title{font-family:var(--k-serif);font-size:17px;font-weight:700}.faq-head>view{display:flex;align-items:center;gap:4px;color:var(--k-muted);font-size:12px}.faq-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 6px;margin-top:12px}.faq-grid>view{display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center;font-size:11px}.faq-grid>view>view{width:46px;height:46px;border-radius:50%;background:var(--k-paper2);display:flex;align-items:center;justify-content:center}.assistant-row{display:flex;align-items:center;gap:9px;margin-top:9px}.assistant-row image{width:55px;height:55px;border-radius:50%}.assistant-row>text{padding:10px 13px;border:1px solid var(--k-line2);border-radius:9px;font-size:12px;line-height:1.6;white-space:pre-line}.assistant-questions{display:grid;grid-template-columns:1fr 90px;gap:6px;margin-top:8px}.assistant-questions>view{grid-column:1;height:27px;padding:0 10px;border:1px solid var(--k-line2);border-radius:7px;display:flex;align-items:center;font-size:11px}.assistant-questions>.k-button{grid-column:2;grid-row:3}.online-row,.phone-row{display:flex;align-items:center;gap:11px;margin:10px 0}.service-icon.large{width:48px;height:48px}.online-row>view:nth-child(2),.phone-row>view:nth-child(2){min-width:0;flex:1;display:flex;flex-direction:column;gap:6px;color:var(--k-muted);font-size:11px}.online-row>view:nth-child(2) text:first-child,.phone-row>view:nth-child(2) text:first-child{color:var(--k-ink);font-size:13px}.phone-card{padding-bottom:9px}.support-foot{display:flex;align-items:center;justify-content:center;gap:10px;color:var(--k-muted);font-size:12px;margin-top:15px}
.order-card{padding:9px 12px;gap:5px}.assistant-card{padding-top:9px;padding-bottom:9px}.online-card{padding:9px 11px}.online-row{margin:5px 0}.online-row .service-icon.large{width:42px;height:42px}.phone-card{padding-top:9px;padding-bottom:7px}.phone-row{margin:6px 0}
</style>
