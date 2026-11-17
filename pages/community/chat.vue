<template>
<k-feature-gate feature="private-chat" :bypass="!blockedPrivate && conv.type !== 'private' && s !== 4">
<k-feature-gate feature="group-chat" :bypass="!blockedGroup && s !== 2 && s !== 3">
<k-community-gate :bypass="s !== 4">
  <view class="k-page chat-page" :class="{ 'is-conversation': s === 1 || s === 2 }" :style="s === 1 || s === 2 ? { paddingBottom: keyboardHeight + 'px', '--chat-cap': capsuleGap + 'px' } : {}">
    <!-- 1 私信聊天 -->
    <template v-if="s === 1">
      <!-- 「···」（举报 / 安全提醒 / 私信拉黑）放在顶栏右边（2026-10-16 内测反馈：放输入栏左下角太占地方）；小程序里 k-topbar 会让它躲到微信胶囊左边 -->
      <k-topbar :title="topTitle" back><template #right><view v-if="conv.convId" class="chat-more" hover-class="k-press" aria-label="会话操作：举报、安全提醒" @click="conversationActions"><k-icon name="ellipsis" :size="24" color="ink" /></view></template></k-topbar>
      <view v-if="conv.type === 'store' && (conv.otherMeta || conv.receptionNotice)" class="conversation-meta"><text v-if="conv.otherMeta">{{ conv.otherMeta }}</text><text v-if="conv.receptionNotice" class="conversation-meta__notice">{{ conv.receptionNotice }}</text></view>
      <scroll-view class="conversation-scroll" scroll-y :scroll-into-view="scrollTarget" :scroll-with-animation="false">
      <view class="private-body">
        <text v-if="conv.archived" class="composer-error">此历史会话只供查阅，请从对应报名或线上任务重新进入沟通。</text><button v-if="conv.archived && conv.recontactApps?.length" class="recontact" @click="recontact">选择任务，重新联系</button>
        <text v-if="sourceText && conv.type === 'private'" class="source">{{ sourceText }}</text>
        <view v-if="conv.type === 'private'" class="person-card"><view class="person-top" @click="openOther"><image class="person-avatar" :src="otherAvatar" mode="aspectFill" /><view class="person-copy"><view class="k-row k-gap8"><text class="person-name">{{ otherName }}</text><text v-if="other.phoneVerified" class="verified">手机已验证</text></view><text class="person-meta">{{ conv.otherMeta || '' }}</text></view><text class="person-link">主页 ›</text></view><view class="person-line" /><view class="overlap"><view><k-icon name="map-pin" :size="24" color="ink" /><view><text>共同城市</text><text>{{ conv.overlapCity || '—' }}</text></view></view><view><k-icon name="calendar-check" :size="24" color="ink" /><view><text>重叠天数</text><text>{{ conv.overlapText || '暂无公开行程重叠' }}</text></view></view></view></view>
        <template v-if="conv.type === 'private'"><text class="quick-title">快捷开场问题</text><view class="quick-list"><view v-for="q in questions" :key="q" @click="send(q)"><text>{{ q }}</text></view></view></template>
        <text v-if="messagesReady && !messages.length && !messageError" class="conversation-empty">还没有消息，直接在下方输入，开始沟通吧。</text>
        <text v-if="firstTime" class="time">{{ firstTime }}</text>
        <view v-for="x in messages" :key="x.msgId" :id="'chat-message-' + x.msgId" class="message-row" :class="{ 'is-mine': x.mine }"><image class="msg-avatar" :src="x.avatar" mode="aspectFill" /><view class="message-copy"><text v-if="senderLabel(x)" class="message-sender">{{ senderLabel(x) }}</text><button v-if="x.type === 'image'" class="message-image" :style="imageFrameStyle(x)" :aria-label="'查看图片消息'" @click="previewImageMessage(x)"><image v-if="mediaUrls[x.msgId]" :src="mediaUrls[x.msgId]" mode="aspectFit"/><text v-else>{{ mediaErrors[x.msgId] || '点击加载图片' }}</text></button><view v-else-if="x.type === 'file' && x.file" class="file-card" :aria-label="'文件 ' + x.file.name" @click="openFileMessage(x)"><view class="file-card__icon"><k-icon :name="x.file.kind === 'archive' ? 'archive' : 'file-text'" :size="26" color="ochre" /></view><view class="file-card__copy"><text class="file-card__name">{{ x.file.name }}</text><text class="file-card__meta">{{ fileBusy[x.msgId] || fileMeta(x.file) }}</text></view></view><view v-else-if="sharedOf(x.content)" class="shared-post" @click="openShared(x.content)"><text class="shared-post__tag">分享了一条动态</text><text class="shared-post__title">{{ displayWording(sharedOf(x.content).title) }}</text><text class="shared-post__go">点开查看 ›</text></view><k-display-text v-else class="message-bubble" :value="x.content || ''" :preserve="[x.name, conv.peerName, experience.account?.nickname]" /><text v-if="x.hiddenForOther" class="message-hint">对方同意交换后才能看到你的联系方式</text></view></view>
        <view id="conversation-end" class="conversation-end" />
      </view>
      </scroll-view>
      <view v-if="messageError" class="conversation-error"><text>{{ messageError }}</text><button @click="loadMessages(false)">重新加载</button></view>
      <view class="message-composer" :class="{ 'keyboard-open': keyboardHeight > 0 }">
        <view v-if="showContactBar" class="contact-bar"><k-icon name="shield-check" :size="16" color="green" /><text class="contact-bar__text">{{ contactText }}</text><button class="contact-bar__btn" :class="{ 'is-primary': contactPrimary }" :disabled="contactBusy" @click="toggleContact">{{ contactBtn }}</button></view>
        <text v-if="sendError || unavailableReason" class="composer-error">{{ sendError || unavailableReason }}</text>
        <view class="composer-row">
          <!-- 私信和门店沟通统一使用加号入口；门店可选发图片或文件，私信可选图片。 -->
          <button class="composer-photo" :aria-label="conv.type === 'store' ? '发送图片或文件' : '选择聊天图片'" :disabled="!!unavailableReason || sending || imageSending || fileSending" @click="chooseAttachment"><k-icon name="plus" :size="26" :stroke="2.2" color="muted" /></button>
          <!-- 小程序的 textarea 画在页面最上层，会盖住看图浮层、待发图片条上的按钮；所以只在打字时放真输入框，平时用同样大小的 view 显示 -->
          <view class="composer-field"><textarea v-if="editingDraft" :value="draft" @input="syncDraft" class="composer-input" aria-label="消息内容" :style="{ height: inputHeight + 'px' }" :maxlength="CHAT_TEXT_MAX" :disabled="!!unavailableReason" :adjust-position="false" :hold-keyboard="true" :confirm-hold="true" :show-confirm-bar="false" :disable-default-padding="true" confirm-type="send" placeholder="输入消息…" placeholder-class="placeholder" :focus="true" auto-focus @blur="draftBlurred" @confirm="sendDraft" @keyboardheightchange="keyboardChanged" @linechange="inputLinesChanged" /><view v-else class="composer-input chat-area-idle" aria-label="消息内容" :style="{ height: inputHeight + 'px' }" @click="startDraftEditing"><text :class="{ 'k-placeholder': !draft }">{{ draft || '输入消息…' }}</text></view></view>
          <button class="composer-tool" :aria-label="emojiOpen ? '收起表情' : '选择表情'" :aria-expanded="emojiOpen" :disabled="!!unavailableReason || sending || imageSending || fileSending" @click="toggleEmoji"><k-icon :name="emojiOpen ? 'x' : 'smile'" :size="27" color="ink" /></button>
          <button class="composer-send" :disabled="!canSend" :loading="sending" @click="sendDraft">{{ sending ? '发送中' : '发送' }}</button>
        </view>
        <view v-if="emojiOpen" class="emoji-grid" aria-label="聊天表情"><button v-for="emoji in emojis" :key="emoji" :aria-label="'添加表情 ' + emoji" @click="addEmoji(emoji)">{{ emoji }}</button></view>
      </view>
    </template>

    <!-- 2 群聊 -->
    <template v-else-if="s === 2">
      <k-topbar :title="groupTitle" back />
      <scroll-view class="conversation-scroll" scroll-y :scroll-into-view="scrollTarget" :scroll-with-animation="false" @scroll="groupScrolled" @touchstart="groupTouchStarted" @touchend="groupTouchEnded" @touchcancel="groupTouchEnded" @wheel="groupWheeled"><view class="group-body">
        <view v-if="showAnn" class="announcement"><text class="announcement-title">置顶公告</text><text>{{ annFirst }}</text><view class="announcement-last"><text @click="openAnn">{{ annRest }}</text><k-icon name="x" :size="20" color="muted" @click="showAnn = false" /></view></view>
        <view class="group-tools"><view v-for="tool in groupTools" :key="tool.label" @click="tool.click()"><k-icon :name="tool.icon" :size="28" color="ink" /><text>{{ tool.label }}</text></view></view>
        <text class="group-section">群内活动</text>
        <view class="group-activity" @click="openActivity"><view class="group-activity-copy"><text class="activity-kind">{{ act.kind }}</text><text class="group-activity-title">{{ act.title }}</text><view class="group-meta"><k-icon name="map-pin" :size="15" color="muted" /><text>{{ act.time }}</text></view><view class="group-meta"><k-icon name="map-pin" :size="15" color="muted" /><text>{{ act.place }}</text><text class="signed">◉ {{ act.signed || 0 }}人已报名</text></view></view><image :src="groupCover" mode="aspectFill" /></view>
        <view v-for="x in messages" :key="x.msgId" class="group-message"><view class="msg-head"><image :src="x.avatar" mode="aspectFill" @click="openSender(x)" /><text>{{ x.mine ? '我' : x.name }}</text><text>{{ x.time }}</text></view><button v-if="x.type === 'image'" class="message-image group-image" :style="imageFrameStyle(x)" aria-label="查看图片消息" @click="previewImageMessage(x)"><image v-if="mediaUrls[x.msgId]" :src="mediaUrls[x.msgId]" mode="aspectFit"/><text v-else>{{ mediaErrors[x.msgId] || '点击加载图片' }}</text></button><view v-else-if="sharedOf(x.content)" class="shared-post" @click="openShared(x.content)"><text class="shared-post__tag">分享了一条动态</text><text class="shared-post__title">{{ displayWording(sharedOf(x.content).title) }}</text><text class="shared-post__go">点开查看 ›</text></view><k-display-text v-else class="group-bubble" :value="x.content || ''" :preserve="[x.name, experience.account?.nickname]" /><view v-if="false" class="like"><text>👍</text></view></view>
        <view v-if="locationMsg" class="group-message"><view class="msg-head"><image src="/static/media/community-avatar-shanye.jpg" mode="aspectFill" /><text>山野来信</text><text>11:35</text></view><view class="location-card"><view><text class="location-share">◉ 分享位置</text><text class="location-title">陶溪川文创街区</text><text class="location-address">景德镇市昌江区陶溪川</text></view><image src="/static/media/chat-map.jpg" mode="aspectFill" /></view></view>
        <view class="safety group-safety"><text>安全提醒：请勿发布或索要私人联系方式、住宿地址等敏感信息\n谨防诈骗，如遇不适，请举报管理员。</text></view>
      </view>
      <view id="group-end" class="conversation-end" /></scroll-view>
      <view v-if="messageError" class="conversation-error"><text>{{ messageError }}</text><button @click="loadMessages(false)">重新加载</button></view>
      <button v-if="groupHasNew" class="group-new" @click="scrollToLatest({ force: true })">有新消息 · 回到底部</button>
      <view class="message-composer"><view class="composer-row"><button class="composer-photo" aria-label="添加聊天内容" :disabled="!!unavailableReason || sending || imageSending" @click="groupAttachments"><k-icon name="plus" :size="26" :stroke="2.2" color="muted" /></button><!-- 之前这里有个画成按钮的「语音」图标，点了没有任何反应（本期没有语音消息），已去掉 --><view class="chat-input"><input :value="draft" @input="syncDraft" :maxlength="CHAT_TEXT_MAX" confirm-type="send" placeholder="发消息…" placeholder-class="placeholder" @blur="draftBlurred" @focus="focusGroupDraft" @keyboardheightchange="keyboardChanged" :adjust-position="false" @confirm="sendGroup" /></view><button class="composer-tool" :aria-label="emojiOpen ? '收起表情' : '选择表情'" :aria-expanded="emojiOpen" :disabled="!!unavailableReason || sending || imageSending || fileSending" @click="toggleEmoji"><k-icon :name="emojiOpen ? 'x' : 'smile'" :size="27" color="ink" /></button><button v-if="draft.trim()" class="composer-send" :disabled="!canSend" @click="sendGroup">发送</button></view><view v-if="emojiOpen" class="emoji-grid" aria-label="聊天表情"><button v-for="emoji in emojis" :key="emoji" :aria-label="'添加表情 ' + emoji" @click="addEmoji(emoji)">{{ emoji }}</button></view></view>
    </template>

    <!-- 3 群详情 -->
    <template v-else-if="s === 3">
      <k-topbar title="群详情" back custom-back @back="s = 2" />
      <view class="detail-body">
        <view class="group-info" @click="openActivity"><image :src="groupCover" mode="aspectFill" /><view class="group-info-copy"><view class="k-row k-gap8"><text class="group-name">{{ conv.title }}</text><text class="verified">活动群</text></view><text>群号：{{ detail.groupNo }}</text><text>{{ detail.memberCount || 0 }}位成员 · 创建于 {{ detail.createdText }}</text></view><k-icon name="chevron-right" :size="22" color="ink" /></view>
        <view class="qr-card" @click="previewQr"><view><text class="card-title">活动小程序码</text><text>{{ codeMessage(detail.qrInfo) }}</text><text>{{ detail.qrInfo?.state === 'ready' ? '扫码查看活动，报名确认后加入群聊' : '点击重试' }}</text></view><image v-if="detail.qrInfo?.state === 'ready'" :src="detail.qrInfo.image" mode="aspectFit" /><k-icon name="chevron-right" :size="20" color="ink" /></view>
        <view class="members-head"><text>成员（{{ detail.memberCount || 0 }}）</text><view @click="allMembers"><text>全部成员</text><k-icon name="chevron-right" :size="18" color="ink" /></view></view><view class="members"><view v-for="m in members" :key="m.userId"><view class="member-avatar"><image :src="m.avatar" mode="aspectFill" /><text v-if="m.admin">✓</text></view><text>{{ m.name }}</text></view></view>
        <view class="setting-section"><view class="setting-head"><text>群公告</text><view @click="editAnn"><text>{{ detail.myRole === 'owner' ? '查看 / 修改' : '查看全部' }}</text><k-icon name="chevron-right" :size="18" color="ink" /></view></view><text class="announcement-copy">{{ conv.announcement }}</text></view>
        <k-subscribe scenes="community" label="订阅未读群消息提醒" />
        <view class="setting-section toggles"><view><text>消息免打扰</text><view class="switch" :class="{ on: mute }" @click="toggleFlag('muted')"><view /></view></view><view><text>置顶聊天</text><view class="switch" :class="{ on: pinned }" @click="toggleFlag('pinned')"><view /></view></view></view>
        <view class="common-row" @click="go(R.activityMine)"><text>查看共同活动</text><view><text>{{ detail.commonCount || 0 }}个</text><k-icon name="chevron-right" :size="19" color="ink" /></view></view>
        <k-button type="outline" size="lg" block class="danger" @click="leaveGroup">退出群聊</k-button><text class="report-group" @click="reportConv">举报该群</text>
        <view class="k-home-indicator" />
      </view>
    </template>

    <!-- 4 发布行程找搭子 -->
    <template v-else>
      <k-topbar title="发布行程找搭子" back />
      <view class="publish-trip">
        <view class="trip-banner"><view><text>公开发布行程，寻找同行伙伴</text><text>仅展示必要信息，保护你的隐私</text></view><image src="/static/media/chat-kangaroo.jpg" mode="aspectFit" /></view>
        <view class="step-title"><text>1</text><text>选择日期区间</text></view><view class="date-card"><view @click="pickStart"><text>开始日期</text><text>{{ startLabel }}</text></view><text class="arrow">→</text><view @click="pickEnd"><text>结束日期</text><text>{{ endLabel }}</text></view><text>共{{ days }}天</text></view>
        <view class="step-title"><text>2</text><text>选择主要活动</text><text class="step-note">（可多选）</text></view><view class="activity-grid"><view v-for="a in tripActivities" :key="a" :class="{ active: selectedActivities.includes(a) }" @click="toggleActivity(a)"><text>{{ a }}</text><view v-if="selectedActivities.includes(a)" class="picked"><text>✓</text></view></view></view>
        <view class="step-title"><text>3</text><text>隐私设置</text></view><view class="privacy-card"><view><view><text>隐藏精确住宿信息</text><text>仅展示所在区域，不显示具体地址</text></view><view class="switch on" @click="privacyTip"><view /></view></view><view><view><text>隐藏交通出行信息</text><text>不展示交通方式与具体班次/车次</text></view><view class="switch on" @click="privacyTip"><view /></view></view></view>
        <view class="step-title"><text>4</text><text>预览社区卡片</text></view><view class="trip-preview"><image src="/static/media/cover-empty.png" mode="aspectFill" /><view class="trip-preview-copy"><view class="k-between"><text class="trip-preview-title">{{ previewTitle }}</text><text class="public">公开</text></view><view class="preview-tags"><text v-for="t in selectedActivities.slice(0, 3)" :key="t">{{ t }}</text></view><text>{{ previewDays }}</text><view class="k-between"><text @click="pickCity">◉ {{ plan.city }}（点此换城市）</text><text>查看详情 ＞</text></view></view></view>
        <k-button size="lg" block @click="publishPlan">发布到找搭子</k-button><text class="agreement" @click="showRules">发布即代表同意《社区公约》与《隐私政策》</text><view class="k-home-indicator" />
      </view>
      <k-date-picker v-if="dateOpen" :title="dateOpen === 'start' ? '选择开始日期' : '选择结束日期'" :value="dateOpen === 'start' ? plan.start : plan.end" :min-date="dateOpen === 'start' ? todayCn() : plan.start" :max-date="shiftDate(dateOpen === 'start' ? todayCn() : plan.start, 59)" @cancel="dateOpen = ''" @confirm="confirmPlanDate" />
    </template>
    <view v-if="imageDraft && s <= 2" class="image-draft">
      <image :src="imageDraft.path" mode="aspectFit" />
      <view><text>{{ imageSending ? '图片发送中…' : imageSendError || '图片待发送' }}</text><text class="k-meta">JPG / PNG，不超过20MB</text></view>
      <button :disabled="imageSending" @click="discardImage">取消</button>
      <!-- 选完图直接发（2026-10-16 内测反馈），这里平时只显示「发送中」；发失败才出「重试」 -->
      <button v-if="!imageSending" :disabled="!!unavailableReason" @click="sendImageDraft">{{ imageSendError ? '重试' : '发送' }}</button>
    </view>
    <view v-if="fileDraft && s === 1" class="image-draft file-draft">
      <view class="file-card__icon"><k-icon :name="fileDraft.kind === 'archive' ? 'archive' : 'file-text'" :size="28" color="ochre" /></view>
      <view><text class="file-draft__name">{{ fileDraft.name }}</text><text :class="fileSendError && !fileSending ? 'file-draft__error' : 'k-meta'">{{ fileSending ? '正在发送 ' + fileProgress + '%' + STAY_HINT : fileSendError || fileDraft.sizeLabel + ' · 待发送' }}</text></view>
      <button :disabled="fileSending" @click="discardFile">取消</button>
      <button v-if="!fileRefused && !fileSending" :disabled="!!unavailableReason" @click="sendFileDraft">{{ fileSendError ? '重试' : '发送' }}</button>
    </view>
    <view v-if="imagePreview" class="image-preview" role="dialog" aria-label="图片预览" @touchmove.stop.prevent>
      <image :src="imagePreview.url" mode="aspectFit" />
      <text v-if="imageSaveError" class="composer-error">{{ imageSaveError }}</text>
      <view class="image-preview-actions"><button @click="closeImagePreview">关闭</button><button class="image-preview-save" :disabled="imageSaving" @click="saveImageMessage">{{ imageSaving ? '保存中…' : '保存图片' }}</button></view>
    </view>
  </view>

</k-community-gate>
</k-feature-gate>
</k-feature-gate>
</template>

<script setup>
import { groupChatEnabled, privateChatEnabled, refreshFeatures } from '@/common/features.js'
import { selectCity } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 私信群聊接入情况：
//   s=1 私信 / 联系门店：apiChatOpen（帖子 / 找搭子 / 同行匹配 / 报名进度进入）+ 轮询消息（3 秒，页面隐藏即停）；
//       底部直接输入并发送；私信：互相关注不限条数，否则对方回复前只能先发 1 条（之前是 3 条）；
//       对方的「谁可以私信我」不允许时不能输入、显示原因；点对方头像进 TA 的个人主页；可举报、拉黑；
//       帖子「分享到私信」发来的消息显示成帖子卡片，点开进帖子详情
//       2026-10-16（V46）：每条最多 2000 字（之前 500）、图片最多 10MB（之前 5MB）；门店会话里还能发文件（压缩包、PDF、Office，10MB 内），
//       对方点文件卡片打开 / 转发 / 保存 / 复制下载链接（文件相关的放在同目录 chat-files.js，跟着分包走）
//   s=2 活动群：成员 = 发起人 + 已确认报名的人；群内活动卡片、群公告、发消息
//   s=3 群详情：成员、群公告（群主可改）、消息免打扰 / 置顶、共同活动、退出、举报
//   s=4 发布行程找搭子：公开行程（城市 / 日期 / 主要活动）；精确住宿与交通默认隐藏且不可公开
// 新消息同时写进消息中心「会话 / 群聊」，同一会话未读期间合并为一条。
// ---------------------------------------------------------------------------
import { ref, computed, nextTick, watch, getCurrentInstance } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { useScreen, go, back, replace, toast } from '@/common/screen.js'
import {
  apiChatOpen, apiChat, apiChatMessages, apiChatSend, apiChatDetail, apiChatFlag, apiChatAnnounce, apiChatLeave, apiChatContact,
  apiReport, apiBlock, apiPublishPlan, apiCommunityRules
} from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { getToken } from '@/common/request.js'
import { mediaScope, privateImage, savePrivateImage, sendPrivateImage } from '@/common/chat-media.js'
import { sheet, prompt, confirm, alert, copy, shiftDate, todayCn } from '@/common/ui.js'
import { gated, fail, currentCity } from '@/common/community.js'
import { parseSharedPost } from '@/common/post-share.js'
import { absUrl, downloadDoc } from '@/common/upload.js'
import { FILE_PICK_LABEL, STAY_HINT, extOf, sizeLabel, fileProblem, pickChatFile, uploadChatFile, filePath, fileLink, fileEnv, fileActions, downloadLocal, shareLocal, saveLocal } from './chat-files.js'
import R from '@/common/routes.js'
import { displayWording } from '@/common/display-wording.js'
import { codeMessage, previewActivityCode } from '@/common/activity-code.js'

const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    if(pageVisible)chatScope.show()
    if (q?.view === 'trip-publish') { s.value = 4; return }
    openQuery={...q};await openConversation(openQuery)
  }
})
const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
const chatPage = getCurrentInstance()?.proxy
const conv = ref({})
const msgs = ref([])
const draft = ref('')
const emojiOpen = ref(false)
const sending = ref(false)
const sendError = ref('')
const messageError = ref('')
const messagesReady = ref(false)
const keyboardHeight = ref(0)
const inputHeight = ref(26)
const editingDraft = ref(false)
const scrollTarget = ref('')
const groupHasNew = ref(false)
let groupAtBottom = true
let groupViewport = 0
let scrollSequence = 0
let groupMeasureSequence = 0
let groupTouchActive = false
const unavailableReason = computed(() => !conv.value.convId ? '正在连接会话…'
  : conv.value.blocked ? '存在拉黑关系，无法发送消息'
    : conv.value.dmRefusal ? conv.value.dmRefusal
    : conv.value.archived ? '历史沟通已归档，请从任务重新进入'
      : conv.value.status !== 'active' ? '会话已关闭，无法发送消息' : '')
// 每条最多 2000 字（KgChatService.TEXT_MAX，2026-10-16 起；之前 500）
const CHAT_TEXT_MAX = 2000
const canSend = computed(() => !sending.value && !imageSending.value && !fileSending.value && !unavailableReason.value && !!draft.value.trim() && draft.value.trim().length <= CHAT_TEXT_MAX)
// 私信交换联系方式（2026-10-11 起）：之前私信里手机号、微信号直接就能发给对方；现在双方都点「交换联系方式」之前，
// 对方发来的联系方式显示成「已隐藏」（服务端遮挡），这里显示当前状态和对应按钮
const contactBusy = ref(false)
const contactState = computed(() => conv.value.contact || {})
const showContactBar = computed(() => conv.value.type === 'private' && !!conv.value.contact && !contactState.value.open && !conv.value.blocked && !conv.value.archived && conv.value.status === 'active')
const contactText = computed(() => contactState.value.theirs ? '对方想和你交换联系方式，同意后双方都能看到手机号 / 微信号'
  : contactState.value.mine ? '已发出交换请求，对方同意后才能看到彼此的联系方式' : '为防骚扰，手机号 / 微信号要双方同意交换后才显示')
const contactBtn = computed(() => contactState.value.theirs && !contactState.value.mine ? '同意' : contactState.value.mine ? '撤回' : '交换联系方式')
const contactPrimary = computed(() => !contactState.value.mine)
async function toggleContact() {
  if (contactBusy.value || !conv.value.convId) return
  const agree = !contactState.value.mine
  const scope = chatScope.capture()
  contactBusy.value = true
  try {
    const res = await apiChatContact(conv.value.convId, agree)
    if (!chatScope.current(scope)) return
    const wasOpen = !!contactState.value.open
    conv.value.contact = res.data
    toast(res.msg || (agree ? '已发出交换请求' : '已撤回交换请求'))
    // 双方都同意了：重新拉一遍消息，之前遮住的手机号 / 微信号显示出来
    if (!wasOpen && res.data && res.data.open) await loadMessages(true)
  } catch (e) {
    if (chatScope.current(scope)) toast(e.message || '操作失败，请重试')
  } finally {
    contactBusy.value = false
  }
}
const mediaUrls = ref({})
const mediaErrors = ref({})
const imageDraft = ref(null)
const imageSending = ref(false)
const imageSendError = ref('')
const imagePreview = ref(null)
const imageSaving = ref(false)
const imageSaveError = ref('')
// 待发的文件（V46，只有门店会话）：{path, name, size, sizeLabel, kind, file, clientMessageId, convId}
const fileDraft = ref(null)
const fileSending = ref(false)
const fileSendError = ref('')
// 服务端明确拒收（格式对不上 422 / 太大 413）：再发也一样，不显示「重试」，只留「取消」
const fileRefused = computed(() => !!fileSendError.value && !fileSending.value && !!fileDraft.value && [413, 422].includes(fileDraft.value.refusedCode))
const fileProgress = ref(0)
const mediaResources = new Map()
const mediaLoading = new Map()
const mediaVersions = new Map()
let previewSequence=0
async function recontact(){
  const scope=chatScope.capture(),choices=[...(conv.value.recontactApps||[])]
  if(!choices.length||!chatScope.current(scope))return
  const i=await sheet(choices.map(a=>(a.jobType==='online'?'线上任务 · ':'线下报名 · ')+a.title))
  if(i<0||!choices[i]||!chatScope.current(scope))return
  try{const res=await apiChatOpen({type:'store',appId:choices[i].appId});if(!chatScope.current(scope))return;conv.value=res.data;await loadMessages(true)}
  catch(e){if(chatScope.current(scope))toast(e.message||'重新联系失败')}
}
let opened = false
let openQuery=null
let choosing=0
// 选完还没回到前台（安卓上选图结果常常比 onShow 先到）：记下要发的是图片还是文件，onShow 时再发
let sendAfterShow=''
const blockedPrivate = ref(false)
watch(privateChatEnabled, enabled => {
  if(!enabled && (conv.value.type==='private' || s.value===4)) { blockedPrivate.value=true; clearPrivateState() }
  else if(enabled && blockedPrivate.value) { blockedPrivate.value=false; if(openQuery && s.value!==4) openConversation(openQuery) }
})
function handleClosedChat(e) {
  if(Number(e?.code)!==423)return false
  if(/私信/.test(e.message||'')) blockedPrivate.value=true
  else if(/群/.test(e.message||'')) blockedGroup.value=true
  else return false
  clearPrivateState();return true
}
const blockedGroup = ref(false)
watch(groupChatEnabled, enabled => {
  if(!enabled && (s.value===2 || s.value===3 || conv.value.type==='group')) { blockedGroup.value=true; clearPrivateState() }
  else if(enabled && blockedGroup.value) { blockedGroup.value=false; if(openQuery) openConversation(openQuery) }
})
async function openConversation(q) {
    await refreshFeatures()
    if (!groupChatEnabled.value && (q?.activityId || q?.s==='2' || q?.s==='3')) { blockedGroup.value=true; return }
    if (!privateChatEnabled.value && !Number(q?.convId) && !Number(q?.appId) && !Number(q?.activityId) && (q?.userId || q?.postId || q?.planId)) { blockedPrivate.value=true; return }
    const scope=chatScope.capture()
    if(!chatScope.current(scope))return
    try {
      let res = null
      if (Number(q?.convId)) res = await apiChat(Number(q.convId))
      else if (Number(q?.appId)) res = await apiChatOpen({ type: 'store', appId: Number(q.appId) })
      else if (Number(q?.activityId)) res = await apiChatOpen({ type: 'activity', activityId: Number(q.activityId) })
      else if (Number(q?.postId)) res = await gated(() => apiChatOpen({ type: 'private', postId: Number(q.postId) }))
      else if (Number(q?.planId)) res = await gated(() => apiChatOpen({ type: 'private', planId: Number(q.planId) }))
      else if (Number(q?.userId)) res = await gated(() => apiChatOpen({ type: 'private', userId: Number(q.userId), source: q.source }))
      if (!chatScope.current(scope)) return
      if (!res) {
        toast('从消息中心选择一个会话')
        return setTimeout(() => go(R.messages), 500)
      }
      if (!chatScope.current(scope)) return
      conv.value = res.data
      opened = true
      s.value = conv.value.type === 'group' ? (q?.view === 'detail' ? 3 : 2) : 1
      if (s.value === 3) loadDetail()
      loadMessages(true)
    } catch (e) {
      if(!chatScope.current(scope))return
      if(handleClosedChat(e))return
      fail(e, '会话打开失败')
      setTimeout(back, 1500)
    }
}
const readChatScope = () => ({token:getToken(),accountId:experience.account?.id,convId:conv.value.convId,
  grants:JSON.stringify([experience.mode,experience.staffStoreId,experience.account?.staffGrants || []])})
const chatScope = mediaScope(readChatScope)
let pageVisible=true
chatScope.show()
function releaseImages() {
  closeImagePreview()
  for (const resource of mediaResources.values()) resource.release()
  mediaResources.clear(); mediaLoading.clear(); mediaUrls.value = {}; mediaErrors.value = {}
}
function clearPrivateState() {
  ++choosing;chatScope.invalidate(); releaseImages(); imageDraft.value=null;imageSending.value=false;imageSaving.value=false;imageSendError.value=''
  msgs.value=[];lastId=0;pendingSend=null;draft.value='';sending.value=false;messagesReady.value=false;resetChatScroll()
}
watch(() => JSON.stringify([experience.account?.id,experience.mode,experience.staffStoreId,experience.account?.staffGrants || [],getToken()]), () => {
  clearPrivateState();conv.value={};messageError.value='身份或授权已变化，请重新进入会话'
}, {flush:'sync'})
function closeImagePreview() { ++previewSequence;if(imagePreview.value)imagePreview.value.release();imagePreview.value=null;imageSaveError.value='' }
function imageLease(msgId) {
  const key=String(msgId)
  return {key,version:mediaVersions.get(key)||0,scope:chatScope.capture()}
}
function imageCurrent(lease) {
  return chatScope.current(lease.scope)&&(mediaVersions.get(lease.key)||0)===lease.version
    &&msgs.value.some(x=>String(x.msgId)===lease.key&&x.type==='image')
}
function invalidateImage(msgId) {
  const key=String(msgId)
  mediaVersions.set(key,(mediaVersions.get(key)||0)+1);mediaLoading.delete(key)
  mediaResources.get(key)?.release();mediaResources.delete(key)
  mediaResources.get('saved-'+key)?.release();mediaResources.delete('saved-'+key)
  const urls={...mediaUrls.value};delete urls[key];mediaUrls.value=urls
  if(String(imagePreview.value?.msgId)===key)closeImagePreview()
}
async function loadImage(x) {
  const lease=imageLease(x.msgId),key=lease.key,scope=lease.scope
  if(mediaUrls.value[key]||mediaLoading.has(key)||!imageCurrent(lease))return
  mediaLoading.set(key,lease)
  try {
    const resource=await privateImage(scope.convId,key,scope,chatScope.current)
    if(!imageCurrent(lease)){resource.release();return}
    mediaResources.set(key,resource);mediaUrls.value={...mediaUrls.value,[key]:resource.url}
  }catch(e){if(imageCurrent(lease))mediaErrors.value={...mediaErrors.value,[key]:e.message||'图片加载失败，点击重试'}}
  finally{if(mediaLoading.get(key)===lease)mediaLoading.delete(key)}
}
async function previewImageMessage(x) {
  const lease=imageLease(x.msgId),scope=lease.scope,sequence=++previewSequence;if(!imageCurrent(lease))return
  try {
    // A fresh authorized download is required even if a thumbnail is cached.
    const resource=await privateImage(scope.convId,x.msgId,scope,chatScope.current)
    if(!imageCurrent(lease)||sequence!==previewSequence){resource.release();return}
    closeImagePreview();imagePreview.value={...resource,msgId:x.msgId,scope}
  }catch(e){if(imageCurrent(lease)&&sequence===previewSequence)toast(e.message||'图片打开失败，请重试')}
}
async function saveImageMessage() {
  const preview=imagePreview.value,scope=chatScope.capture()
  if(!preview||imageSaving.value||!chatScope.current(scope))return
  imageSaving.value=true;imageSaveError.value='';let resource
  try {
    resource=await privateImage(scope.convId,preview.msgId,scope,chatScope.current)
    if(!chatScope.current(scope)||imagePreview.value!==preview)return
    const saved=await savePrivateImage(resource)
    if(chatScope.current(scope)){const key="saved-"+preview.msgId;mediaResources.get(key)?.release();mediaResources.set(key,resource);resource=null}
    if(chatScope.current(scope))toast(saved==='download-started'?'已发起下载':'图片已保存')
  }catch(e){if(chatScope.current(scope))imageSaveError.value=e.message||'图片保存失败'}
  finally{if(resource)resource.release();if(chatScope.current(scope))imageSaving.value=false}
}
function discardImage(){if(!imageSending.value){imageDraft.value=null;imageSendError.value=''}}
// 选图片 / 选文件（2026-10-16 内测反馈：拍照或选图后点发送，图片没发出去）：
// 手机上一打开相册、相机或聊天记录，本页先 onHide（作用域作废），选完回来时结果和 onShow 谁先到各机型不一样。
// 之前选完要求「页面此刻可见」，结果先到就被悄悄丢掉。现在选完只核对身份：登录、账号、会话、授权（readChatScope 现读），
// 不看页面是否可见；身份变了弹提示，不再一声不响。核对通过就直接发（和微信一样，相册里已经能预览、勾「原图」），
// 页面还在后台就等 onShow 再发；发失败留着待发条，点「重试」用同一个消息标识再发，不会发两条
const PICK_STALE='会话已变化，刚选的没有发出，请重新选择'
function sameIdentity(scope){
  const now=readChatScope()
  return !!now.token&&!!now.accountId&&scope.token===now.token&&String(scope.accountId)===String(now.accountId)
    &&String(scope.convId)===String(now.convId)&&scope.grants===now.grants
}
function sendPicked(kind){
  if(!pageVisible){sendAfterShow=kind;return}
  return kind==='image'?sendImageDraft():sendFileDraft()
}
async function chooseChatImage() {
  const scope=chatScope.capture();if(!chatScope.current(scope)||unavailableReason.value||sending.value||imageSending.value)return
  const ticket=++choosing
  // 默认发压缩图，相册里可以勾「原图」（之前只给原图，大照片动辄好几 MB）
  const result=await new Promise(resolve=>uni.chooseImage({count:1,sizeType:['original','compressed'],sourceType:['album','camera'],success:resolve,fail:()=>resolve(null)}))
  if(!result)return
  if(!sameIdentity(scope))return toast(PICK_STALE)
  // 又点了一次选图（新的那次说了算）
  if(ticket!==choosing)return
  const file=result.tempFiles?.[0];if(file?.size>20*1024*1024)return toast('请选择不超过20MB的图片')
  imageDraft.value={path:result.tempFilePaths[0],clientMessageId:newMessageId(),convId:scope.convId};imageSendError.value=''
  return sendPicked('image')
}
async function sendImageDraft() {
  const attempt=imageDraft.value,scope=chatScope.capture()
  if(!attempt||imageSending.value||sending.value||unavailableReason.value||!chatScope.current(scope)||String(attempt.convId)!==String(scope.convId))return
  imageSending.value=true;imageSendError.value=''
  try {
    await sendPrivateImage(scope.convId,attempt.path,attempt.clientMessageId,scope,chatScope.current)
    if(!chatScope.current(scope)||imageDraft.value!==attempt)return
    imageDraft.value=null;await loadMessages(false);if(chatScope.current(scope))scrollToLatest({ force:true })
  }catch(e){if(chatScope.current(scope)&&imageDraft.value===attempt)imageSendError.value=e.message||'发送失败，点击重试'}
  finally{if(chatScope.current(scope))imageSending.value=false}
}

let lastId = 0
let timer = null
let pendingSend = null
let sendSequence = 0
const newMessageId = () => 'm' + Date.now().toString(36) + '_' + (++sendSequence).toString(36) + '_'
  + Math.random().toString(36).slice(2).padEnd(13, '0') + Math.random().toString(36).slice(2).padEnd(13, '0')
// A failed logical send retains its ID. Editing the draft invalidates it even if
// the user later changes the text back; successful identical messages are new sends.
watch(draft, value => {
  if (pendingSend && String(value || '').trim() !== pendingSend.content) pendingSend = null
}, { flush: 'sync' })
// 发送途中换了会话 / 切到后台（onHide）：旧请求回来时作用域已过期，不会再去放开「发送中」，这里一并放开，否则发送键一直灰着
// （切后台时没发完的那条留着同一个 clientMessageId，回来再点一次服务端认出是同一条，不会重复）
watch(() => conv.value.convId, () => { emojiOpen.value=false; resetChatScroll(); messagesReady.value=false; ++choosing;chatScope.renew();releaseImages();imageDraft.value=null;imageSending.value=false;fileDraft.value=null;fileSending.value=false;fileSendError.value='';sending.value=false;pendingSend=null;msgs.value=[];lastId=0 }, { flush: 'sync' })
// 按消息元数据提前预留图片区域；加载完成不改变消息高度，也不再次抢滚动位置。
function imageFrameStyle(x) {
  const width = Number(x.imageWidth), height = Number(x.imageHeight)
  return { height: (width > 0 && height > 0 && Number.isFinite(height / width)
    ? Math.max(96, Math.min(320, Math.round(180 * height / width))) : 180) + 'px' }
}
function resetChatScroll() {
  ++scrollSequence; ++groupMeasureSequence
  scrollTarget.value = ''; groupTouchActive = false; groupAtBottom = true; groupViewport = 0; groupHasNew.value = false
}
function measureGroupPosition() {
  if (s.value !== 2 || !pageVisible) return
  const sequence = ++groupMeasureSequence, scope = chatScope.capture()
  let query = uni.createSelectorQuery()
  if (chatPage) query = query.in(chatPage)
  query.select('.conversation-scroll').boundingClientRect()
  query.select('.group-body').boundingClientRect()
  query.select('.conversation-scroll').scrollOffset()
  query.exec(rects => {
    if (sequence !== groupMeasureSequence || !chatScope.current(scope) || s.value !== 2) return
    const [viewport, body, offset] = rects || []
    if (!viewport?.height || !body || typeof offset?.scrollTop !== 'number') return
    groupViewport = viewport.height
    groupAtBottom = !groupTouchActive && body.height - offset.scrollTop - groupViewport <= 32
    if (groupAtBottom) groupHasNew.value = false
  })
}
function groupScrolled(e) {
  ++groupMeasureSequence
  if (groupViewport > 0) {
    groupAtBottom = !groupTouchActive && e.detail.scrollHeight - e.detail.scrollTop - groupViewport <= 32
    if (groupAtBottom) groupHasNew.value = false
  } else measureGroupPosition()
}
function groupTouchStarted() {
  groupTouchActive = true
  ++scrollSequence; ++groupMeasureSequence
  groupAtBottom = false
  scrollTarget.value = ''
}
function groupTouchEnded() { groupTouchActive = false; measureGroupPosition() }
function groupWheeled() { groupTouchStarted(); groupTouchActive = false }
async function scrollToLatest({ force = false } = {}) {
  if (s.value !== 1 && s.value !== 2) return
  if (s.value === 2 && !force && !groupAtBottom) return
  const sequence = ++scrollSequence, scope = chatScope.capture()
  scrollTarget.value = ''
  await nextTick()
  if (sequence !== scrollSequence || !chatScope.current(scope) || (s.value !== 1 && s.value !== 2)) return
  groupAtBottom = true; groupHasNew.value = false
  scrollTarget.value = s.value === 2 ? 'group-end' : 'conversation-end'
  if (s.value === 2) { await nextTick(); measureGroupPosition() }
}
function keyboardChanged(e) {
  const height = Math.max(0, Number(e.detail?.height) || 0)
  if (height === keyboardHeight.value) return
  keyboardHeight.value = height
  ++groupMeasureSequence; groupViewport = 0
  scrollToLatest()
}
function inputLinesChanged(e) {
  const height = Math.max(26, Math.min(112, Number(e.detail?.height) || 26))
  if (height === inputHeight.value) return
  inputHeight.value = height
  scrollToLatest()
}
function syncDraft(e) {
  if (typeof e?.detail?.value === 'string') draft.value = e.detail.value
}
function startDraftEditing() {
  if (!unavailableReason.value) { emojiOpen.value = false; editingDraft.value = true }
}
// 真输入框一收起就卸掉，它的「键盘高度归零」事件可能收不到，这里手动归零，免得输入栏悬在半空
function endDraftEditing() {
  if (keyboardHeight.value) { ++groupMeasureSequence; groupViewport = 0 }
  editingDraft.value = false
  keyboardHeight.value = 0
}
function draftBlurred(e) {
  if (!emojiOpen.value) syncDraft(e)
  endDraftEditing()
}
// 打字时点图片不会自动失焦（hold-keyboard）；看图浮层一打开就收起真输入框，免得它压在「关闭 / 保存图片」上
// （放在 watch 里而不是 previewImageMessage 里：scripts/chat.test.mjs 单独抽出那个函数跑，里面没有 endDraftEditing）
watch(imagePreview, value => { if (value) endDraftEditing() })
async function loadMessages(reset) {
  if (!conv.value.convId) return
  const scope=chatScope.capture()
  if(!chatScope.current(scope))return
  try {
    const res = (await apiChatMessages(conv.value.convId, reset ? 0 : lastId)).data
    if(!chatScope.current(scope))return
    // 轮询和发送后的拉取可能同时返回；按真实消息编号合并，迟到的初始请求也不能覆盖刚收到的消息。
    const existing = reset ? msgs.value.filter(m => Number(m.msgId) > Number(res.lastId || 0)) : msgs.value
    const merged = new Map(existing.map(m => [Number(m.msgId), m]))
    const previousLast = lastId
    const initial = !messagesReady.value
    for (const m of res.rows) merged.set(Number(m.msgId), m)
    msgs.value = Array.from(merged.values()).sort((a, b) => Number(a.msgId) - Number(b.msgId))
    lastId = Math.max(lastId, res.lastId || 0)
    messagesReady.value = true
    messageError.value = ''
    for(const x of res.rows){
      if(x.type==='image')loadImage(x)
      else invalidateImage(x.msgId)
    }
    if (res.contact) {
      const wasOpen = !!conv.value.contact?.open
      conv.value.contact = res.contact
      // 对方刚同意交换联系方式：重新拉一遍，之前遮住的手机号 / 微信号显示出来
      if (!wasOpen && res.contact.open && !reset) loadMessages(true)
    }
    if (reset || lastId > previousLast) {
      if (s.value === 1) scrollToLatest()
      else if (s.value === 2) { if (initial || groupAtBottom) scrollToLatest({ force: initial }); else if (lastId > previousLast) groupHasNew.value = true }
    }
  } catch (e) {
    if(!chatScope.current(scope))return
    if(handleClosedChat(e))return
    if([401,403,404,409].includes(Number(e.code))){clearPrivateState();conv.value={}}
    messageError.value = e.message || '消息加载失败，请重试'
  }
}
const startPolling = () => { stopPolling(); timer = setInterval(() => { if (s.value <= 2) loadMessages(false) }, 3000) }
const stopPolling = () => { if (timer) clearInterval(timer); timer = null }
onShow(async () => {
  pageVisible=true
  chatScope.show()
  // 选图 / 选文件的结果比 onShow 先到：回到前台这里再发
  const picked=sendAfterShow;sendAfterShow=''
  if(picked==='image'&&imageDraft.value)sendImageDraft()
  else if(picked==='file'&&fileDraft.value)sendFileDraft()
  if(!opened && openQuery){await openConversation(openQuery)}
  if(opened && conv.value.convId){
    const scope=chatScope.capture()
    try {const fresh=(await apiChat(scope.convId)).data;if(!chatScope.current(scope))return;conv.value=fresh;await loadMessages(s.value !== 2 || !messagesReady.value);if(chatScope.current(scope))for (const message of msgs.value) if(message.type==='image')loadImage(message)}
    catch(e){if(chatScope.current(scope)){if(handleClosedChat(e))return;clearPrivateState();conv.value={};messageError.value=e.message||'会话不可用'}}
  }
  startPolling()
})
// 切到后台（打开相册、相机、从微信聊天记录选文件都会触发这里）：待发的图片、文件都留着（之前图片在这里被清掉，选完图就没了）；
// 没发完的上传会被微信打断，回来点「重试」再发，同一个消息标识服务端认得出，不会发两条
const SEND_CUT='发送被打断了，点「重试」再发一次'
onHide(() => { pageVisible=false;stopPolling(); ++scrollSequence; ++groupMeasureSequence; scrollTarget.value=''; groupTouchActive=false; groupViewport=0; keyboardHeight.value=0;editingDraft.value=false;chatScope.invalidate();releaseImages()
  if(imageSending.value){imageSending.value=false;imageSendError.value=SEND_CUT}
  if(fileSending.value){fileSending.value=false;fileSendError.value=SEND_CUT}
  imageSaving.value=false;sending.value=false })
onUnload(() => {pageVisible=false;stopPolling();clearPrivateState()})
const messages = computed(() => msgs.value.map(m => ({ ...m, avatar: m.avatar ? absUrl(m.avatar) : DEFAULT_AVATAR })))
const refreshConv = async () => { const scope=chatScope.capture();try { const fresh=(await apiChat(scope.convId)).data;if(chatScope.current(scope))conv.value=fresh } catch (e) { if(chatScope.current(scope)&&[401,403,404,409].includes(Number(e.code))){clearPrivateState();conv.value={};messageError.value=e.message} } }
async function send(text, { fromDraft = false } = {}) {
  const t = String(text || '').trim()
  if (!t || sending.value || imageSending.value) return
  const scope=chatScope.capture();if(!chatScope.current(scope))return
  if (unavailableReason.value) return toast(unavailableReason.value)
  if (t.length > CHAT_TEXT_MAX) return toast('消息最多 ' + CHAT_TEXT_MAX + ' 字')
  const submittedDraft = draft.value
  const convId = conv.value.convId
  if (!pendingSend || pendingSend.convId !== convId || pendingSend.content !== t) {
    pendingSend = { convId, content: t, clientMessageId: newMessageId() }
  }
  const attempt = pendingSend
  sending.value = true
  sendError.value = ''
  try {
    await apiChatSend(convId, t, attempt.clientMessageId)
    if(!chatScope.current(scope))return
    if (pendingSend === attempt) pendingSend = null
    // uni-h5 的 model 输入节流是 100ms。等已排队的输入回写完成，再清空已提交草稿，
    // 否则快速粘贴后立刻发送会把旧文字填回来；微信端没有这段额外等待。
    // #ifdef H5
    await new Promise(resolve => setTimeout(resolve, 150))
    // #endif
    // 快捷短语不能删掉草稿，慢请求完成后也不能清空用户刚输入的下一条。
    if(!chatScope.current(scope))return
    if (fromDraft && draft.value === submittedDraft) { draft.value = ''; inputHeight.value = 26 }
    await loadMessages(false)
    if(chatScope.current(scope)) scrollToLatest({ force:true })
    if (conv.value.type === 'private') refreshConv()
  } catch (e) {
    if(!chatScope.current(scope))return
    sendError.value = e.message || '发送失败，文字已保留，请重试'
    fail(e, '发送失败')
  } finally {
    if(chatScope.current(scope))sending.value = false
  }
}
const sendDraft = (e) => { syncDraft(e); return send(draft.value, { fromDraft: true }) }

// ---------------- s=1 私信 ----------------
// 点对方头像 / 卡片进 TA 的个人主页；分享来的帖子卡片点开进帖子详情（返回回到这里）
const openOther = () => { const uid = Number((conv.value.other || {}).userId); if (uid) go(R.userProfile + '?uid=' + uid) }
const openSender = (x) => { if (!x.mine && x.role === 'user' && Number(x.senderId)) go(R.userProfile + '?uid=' + Number(x.senderId)) }
// 消息上方的小标签：同事（门店接待席位）发的写「接待 · 昵称」，两边都显示；门店员工这一侧，对方发的也写「接单人 · 昵称」
// （线上任务）或「报名人 · 昵称」（线下报名），一眼分清谁是接单人、谁是同事（2026-10-15 主人反馈：以为是接单人都在的群聊）。报名人那一侧不变
// 发布这个线上任务的专员发的写「专员 · 昵称」（服务端给 seatLabel，2026-10-16）
// 2026-11-03 主人：统一叫法——报名人 / 接单人这一侧不出内部岗位名：seatLabel 是「专员 / 线上专员 / 城市负责人 / 商家服务人」的写「袋鼠工作人员」，
// 「换工主理人 / 小院主理人」写「当地主理人」；门店员工自己那一侧照旧看岗位名（函数里直接写，测试只抽这个函数）
function senderLabel(x) {
  if (x.mine) return ''
  if (x.role === 'store') {
    let seat = x.seatLabel || '接待'
    if (conv.value.myRole !== 'store') seat = seat.replace(/换工主理人|小院主理人/g, '当地主理人').replace(/线上任务专员|线上专员|城市负责人|商家服务人|专员/g, '袋鼠工作人员')
    return seat + ' · ' + x.name
  }
  if (x.role === 'user' && conv.value.type === 'store' && conv.value.myRole === 'store') return (conv.value.sourceLabel === '线上任务' ? '接单人' : '报名人') + ' · ' + x.name
  return ''
}
// ---------------- 文件（V46，只有门店会话） ----------------
// 发：加号 →「发文件」→ 小程序从微信聊天记录里选（网页版从本机选）→ 本机先查格式和大小 → 底部待发条「发送文件」（带进度，可重试，同一个消息标识不会发两条）。
// 看：点文件卡片 → PDF / Office 在小程序里「打开」，压缩包手机上「发到微信聊天」、电脑版微信「保存到电脑」，网页版「下载」；都能「复制下载链接」（3 天内有效）
const fileEnvNow = fileEnv()
const fileBusy = ref({})
const setFileBusy = (id, text) => { fileBusy.value = { ...fileBusy.value, [String(id)]: text } }
const fileMeta = (f) => (f.sizeLabel || '') + (f.openable ? ' · 点开查看' : ' · 点开保存')
// 已经下载到本机、但转发没成功的：再点一次直接转发（微信要求转发在点击里调用）
const preparedFiles = {}
async function chooseAttachment() {
  emojiOpen.value = false
  if (conv.value.type !== 'store') return chooseChatImage()
  if (imageDraft.value || fileDraft.value) return toast('请先发送或取消待发送的图片、文件')
  const i = await sheet(['发图片', FILE_PICK_LABEL])
  if (i === 0) chooseChatImage()
  else if (i === 1) chooseChatFile()
}
async function chooseChatFile() {
  const scope=chatScope.capture();if(!chatScope.current(scope)||unavailableReason.value||sending.value||imageSending.value||fileSending.value)return
  const ticket=++choosing
  let picked=null
  try{picked=await pickChatFile()}catch(e){if(sameIdentity(scope))toast(e.message||'没能打开文件选择，请重试');return}
  // 选文件同样会把页面切到后台再回来：和选图片一样只核对身份，不要求页面此刻可见；选完直接发
  if(!picked)return
  if(!sameIdentity(scope))return toast(PICK_STALE)
  if(ticket!==choosing)return
  const problem=fileProblem(picked);if(problem)return alert('这个文件不能发', '「' + picked.name + '」' + problem)
  const ext=extOf(picked.name)
  fileDraft.value={...picked,ext,kind:['zip','rar','7z'].includes(ext)?'archive':'doc',sizeLabel:sizeLabel(picked.size),clientMessageId:newMessageId(),convId:scope.convId};fileSendError.value='';fileProgress.value=0
  return sendPicked('file')
}
function discardFile(){if(!fileSending.value){fileDraft.value=null;fileSendError.value=''}}
async function sendFileDraft() {
  const attempt=fileDraft.value,scope=chatScope.capture()
  if(!attempt||fileSending.value||imageSending.value||sending.value||unavailableReason.value||!chatScope.current(scope)||String(attempt.convId)!==String(scope.convId)||scope.token!==getToken())return
  fileSending.value=true;fileSendError.value='';fileProgress.value=0
  try {
    await uploadChatFile(scope.convId,attempt,attempt.clientMessageId,scope.token,(p)=>{if(fileDraft.value===attempt)fileProgress.value=p})
    if(!chatScope.current(scope)||fileDraft.value!==attempt)return
    fileDraft.value=null;await loadMessages(false);if(chatScope.current(scope))scrollToLatest({ force:true })
  }catch(e){if(chatScope.current(scope)&&fileDraft.value===attempt){attempt.refusedCode=e.code;fileSendError.value=e.message||'发送失败，点「重试」再发一次'}}
  finally{if(chatScope.current(scope))fileSending.value=false}
}
async function shareChatFile(x, path) {
  const key = String(x.msgId)
  let local = preparedFiles[key]
  delete preparedFiles[key]
  if (!local) {
    // 先标成下载中：第一次进度回调之前再点一次，会对同一个本地文件发起第二次下载
    setFileBusy(key, '正在下载…')
    local = await downloadLocal(path, x.msgId, x.file, (pct) => setFileBusy(key, '正在下载 ' + pct + '%' + STAY_HINT))
  }
  setFileBusy(key, '')
  try {
    await shareLocal(local, x.file)
  } catch (e) {
    preparedFiles[key] = local
    throw new Error('文件已经下载好了，请再点一次文件，选「发到微信聊天」')
  }
}
async function openFileMessage(x) {
  const f = x.file, key = String(x.msgId), scope = chatScope.capture()
  if (!f || fileBusy.value[key] || !chatScope.current(scope)) return
  const acts = fileActions(f, fileEnvNow)
  const act = acts[await sheet(acts)]
  if (!act || !chatScope.current(scope)) return
  const path = filePath(scope.convId, x.msgId)
  try {
    if (act === '复制下载链接') {
      const r = (await fileLink(scope.convId, x.msgId)).data || {}
      if (!chatScope.current(scope)) return
      await copy(absUrl(r.url), '下载链接已复制')
      await alert('复制下载链接', '链接 3 天内有效（到 ' + String(r.expireAt || '').slice(5) + '），拿到链接的人都能下载，请不要转发给不相关的人。请粘贴到手机或电脑的浏览器里下载，不要在微信里打开（微信内置浏览器常常不让下载）。')
      return
    }
    if (act === '发到微信聊天') return await shareChatFile(x, path)
    setFileBusy(key, '正在下载…')
    if (act === '保存到电脑') await saveLocal(await downloadLocal(path, x.msgId, f, (pct) => setFileBusy(key, '正在下载 ' + pct + '%')))
    else await downloadDoc(path, f.ext, f.name)
  } catch (e) {
    if (chatScope.current(scope)) toast(e.message || '文件打开失败，请重试')
  } finally {
    setFileBusy(key, '')
  }
}
const sharedOf = (content) => parseSharedPost(content)
const openShared = (content) => { const hit = parseSharedPost(content); if (hit) go(R.community + '?postId=' + hit.postId + '&from=user') }
const questions = ['你最想体验的当地活动是？', '有推荐的必去小店吗？', '一起逛早市或市集？', '周末有空一起出发吗？', '其他想聊的话题？']
const topTitle = computed(() => (conv.value.type === 'store' ? conv.value.title || '联系商家' : '认识一下'))
// 小程序右上角微信胶囊占的宽度（算法同 k-topbar）：顶栏标题要让出「胶囊 + ···」，见样式 --chat-cap
let capsuleGap = 0
// #ifdef MP-WEIXIN
try {
  const r = uni.getMenuButtonBoundingClientRect(), w = uni.getSystemInfoSync().windowWidth
  capsuleGap = r && r.left > 0 && r.left < w ? w - r.left : 97
} catch (e) { capsuleGap = 97 }
// #endif
const sourceText = computed(() => (conv.value.sourceLabel ? `由「${conv.value.sourceLabel}」进入` : ''))
const other = computed(() => conv.value.other || {})
const otherAvatar = computed(() => (other.value.avatar ? absUrl(other.value.avatar) : DEFAULT_AVATAR))
const otherName = computed(() => (conv.value.type === 'store' ? conv.value.title : other.value.name) || '')
const firstTime = computed(() => (messages.value[0] ? messages.value[0].time : ''))
const safetyText = computed(() => '安全提示：请勿轻易泄露身份证、家庭住址、银行卡等敏感信息\n如遇骚扰或不适，请及时举报或拉黑。'
  + (conv.value.greetLeft >= 0 ? `\n对方回复前你还能发 ${conv.value.greetLeft} 条消息。` : ''))
// 是不是我拉黑了对方（blocked 是双向的）；服务端没给 iBlocked 时退回 blocked
const iBlocked = computed(() => (conv.value.iBlocked != null ? !!conv.value.iBlocked : !!conv.value.blocked))
async function conversationActions() {
  const opts = ['举报该会话', '安全提醒', '订阅未读消息提醒']
  if (conv.value.type === 'private') opts.push(iBlocked.value ? '取消拉黑' : '拉黑')
  const i = await sheet(opts)
  if (i === 0) reportConv()
  else if (i === 1) alert('安全提醒', safetyText.value)
  else if (i === 2) go('/pages/profile/subscriptions?scenes=community')
  else if (i === 3) blockOther()
}
const REASONS = ['骚扰 / 辱骂', '诈骗 / 索要钱财', '色情低俗', '广告引流', '其他']
async function reportConv() {
  const i = await sheet(REASONS)
  if (i < 0) return
  try {
    toast((await apiReport('chat', conv.value.convId, REASONS[i])).msg)
  } catch (e) {
    fail(e, '举报失败')
  }
}
async function blockOther() {
  if (conv.value.type !== 'private') return toast('门店会话不能拉黑，如遇问题请举报')
  if (!(await confirm(iBlocked.value ? '取消拉黑' : '拉黑', iBlocked.value ? '取消后可以继续私信。' : '拉黑后双方不能再私信，互相看不到动态与评论。确认？'))) return
  try {
    const res = (await apiBlock(other.value.userId)).data
    toast(res.blocked ? '已拉黑' : '已取消拉黑')
    refreshConv()
  } catch (e) {
    fail(e, '操作失败')
  }
}

// ---------------- s=2 群聊 ----------------
const groupTitle = computed(() => `${conv.value.title || '活动群'}（${conv.value.memberCount || 0}）`)
const annText = computed(() => String(conv.value.announcement || ''))
const annCut = computed(() => { const i = annText.value.indexOf('！'); return i >= 0 ? i + 1 : Math.min(20, annText.value.length) })
const annFirst = computed(() => annText.value.slice(0, annCut.value) || '欢迎来到活动群')
const annRest = computed(() => annText.value.slice(annCut.value, annCut.value + 20) + '…展开')
const showAnn = ref(true)
const openAnn = () => alert('群公告', conv.value.announcement || '暂无公告')
const act = computed(() => conv.value.activity || {})
const openActivity = () => act.value.activityId && go(R.activity + '?id=' + act.value.activityId + '&channel=group')
const groupTools = [
  { label: '群公告', icon: 'volume-2', click: () => { s.value = 3; loadDetail() } },
  { label: '活动日历', icon: 'calendar-days', click: () => openActivity() },
  { label: '活动资料', icon: 'folder', click: () => openActivity() },
  { label: '位置', icon: 'map-pin', click: () => alert('集合地点', act.value.place || '以活动页为准') }
]
const locationMsg = null
const emojis = ['😀','😊','😂','🥳','🤔','🥰','😎','😭','👍','👏','🙏','❤️','🎉','🌻','☕','✅']
function focusGroupDraft() {
  if (emojiOpen.value) { ++groupMeasureSequence; groupViewport = 0 }
  emojiOpen.value = false
}
function addEmoji(emoji) {
  if (unavailableReason.value || sending.value || imageSending.value || fileSending.value) return
  if (draft.value.length + emoji.length > CHAT_TEXT_MAX) return toast('消息最多 ' + CHAT_TEXT_MAX + ' 字')
  draft.value += emoji
}
function toggleEmoji() {
  if (unavailableReason.value || sending.value || imageSending.value || fileSending.value) return
  const open = !emojiOpen.value
  emojiOpen.value = open
  ++groupMeasureSequence; groupViewport = 0
  endDraftEditing()
  uni.hideKeyboard()
  scrollToLatest()
}
watch(unavailableReason, value => { if (value) emojiOpen.value = false })
async function groupAttachments() {
  emojiOpen.value = false
  if (unavailableReason.value || sending.value || imageSending.value) return
  const i = await sheet(['发图片', '快捷短语', '查看群详情'])
  if (i === 0) chooseChatImage()
  else if (i === 1) quickPhrase()
  else if (i === 2) { s.value = 3; loadDetail() }
}
const sendGroup = sendDraft
async function quickPhrase() {
  const opts = ['我到集合点了', '稍晚几分钟，请等等我', '有人一起拼车吗？', '谢谢大家，今天很开心！']
  const i = await sheet(opts)
  if (i >= 0) send(opts[i])
}

// ---------------- s=3 群详情 ----------------
const detail = ref({ members: [] })
async function loadDetail() {
  try {
    detail.value = (await apiChatDetail(conv.value.convId)).data
    mute.value = !!detail.value.muted
    pinned.value = !!detail.value.pinned
  } catch (e) {
    fail(e, '群详情加载失败')
  }
}
const mute = ref(false)
const pinned = ref(false)
async function toggleFlag(flag) {
  const on = flag === 'muted' ? !mute.value : !pinned.value
  try {
    await apiChatFlag(conv.value.convId, flag, on)
    if (flag === 'muted') mute.value = on
    else pinned.value = on
  } catch (e) {
    fail(e, '设置失败')
  }
}
const groupCover = computed(() => (act.value.cover ? absUrl(act.value.cover) : '/static/media/cover-empty.png'))
const members = computed(() => (detail.value.members || []).slice(0, 10).map(m => ({ ...m, avatar: m.avatar ? absUrl(m.avatar) : DEFAULT_AVATAR })))
const allMembers = () => alert(`成员（${detail.value.memberCount || 0}）`, (detail.value.members || []).map(m => m.name + (m.admin ? '（群主）' : '')).join('、') || '暂无')
const previewQr = async () => {
  try {
    if (detail.value.qrInfo?.state !== 'ready') await loadDetail()
    if (detail.value.qrInfo?.state !== 'ready') return alert('活动小程序码', codeMessage(detail.value.qrInfo) + '\n可稍后再次点击重试。')
    await previewActivityCode(detail.value.qrInfo, conv.value.convId)
  } catch (e) { fail(e, '小程序码打开失败，请重试') }
}
async function editAnn() {
  if (detail.value.myRole !== 'owner') return openAnn()
  const i = await sheet(['查看群公告', '修改群公告'])
  if (i === 0) openAnn()
  if (i === 1) {
    const t = await prompt('修改群公告', { value: conv.value.announcement || '', placeholder: '500 字以内' })
    if (!t) return
    try {
      toast((await apiChatAnnounce(conv.value.convId, t)).msg)
      refreshConv()
    } catch (e) {
      fail(e, '修改失败')
    }
  }
}
async function leaveGroup() {
  if (!(await confirm('退出群聊', '退出后不再接收群消息（活动报名不受影响）。确认退出？'))) return
  try {
    toast((await apiChatLeave(conv.value.convId)).msg)
    setTimeout(back, 600)
  } catch (e) {
    fail(e, '退出失败')
  }
}

// ---------------- s=4 发布行程 ----------------
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const label = (ymd) => { const d = new Date(ymd + 'T00:00:00'); return `${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日 ${WEEK[d.getDay()]}` }
const plan = ref({ city: currentCity(), start: shiftDate(todayCn(), 1), end: shiftDate(todayCn(), 7) })
const days = computed(() => Math.round((new Date(plan.value.end) - new Date(plan.value.start)) / 86400000) + 1)
const startLabel = computed(() => label(plan.value.start))
const endLabel = computed(() => label(plan.value.end))
// 开始 / 结束日期：之前是 60 个日期分页翻（每页 5 个 +「下一页…」），现在用日历点选，范围不变
const dateOpen = ref('')
const pickStart = () => { dateOpen.value = 'start' }
const pickEnd = () => { dateOpen.value = 'end' }
function confirmPlanDate(v) {
  const which = dateOpen.value
  dateOpen.value = ''
  if (!v) return
  if (which === 'start') {
    plan.value.start = v
    if (plan.value.end < v || plan.value.end > shiftDate(v, 59)) plan.value.end = v
  } else plan.value.end = v
}
async function pickCity() {
  const value = await selectCity({ value: plan.value.city })
  if (value === null) return
  plan.value.city = value
}
const tripActivities = ['手作体验', '逛市集', '城市漫步', '户外徒步', '咖啡探店', '摄影创作', '美食探索', '其他']
const selectedActivities = ref(['手作体验'])
const toggleActivity = (a) => { const i = selectedActivities.value.indexOf(a); if (i >= 0) selectedActivities.value.splice(i, 1); else selectedActivities.value.push(a) }
const privacyTip = () => toast('为保护隐私，精确住址与交通信息始终不公开')
const previewTitle = computed(() => `${plan.value.city} · ${startLabel.value.slice(0, 6).replace(/^0/, '').replace('月0', '月')}—${endLabel.value.slice(0, 6).replace(/^0/, '').replace('月0', '月')}`)
const previewDays = computed(() => `◉ ${days.value}天行程 · 寻找同行伙伴`)
async function showRules() {
  try {
    const r = (await apiCommunityRules('community')).data
    alert(r.title, r.content)
  } catch (e) {
    fail(e, '加载失败')
  }
}
// 发布请求还没回来时再点一次，会再弹简介框、再发一条一样的行程
let publishing = false
async function publishPlan() {
  if (publishing) return
  if (!selectedActivities.value.length) return toast('至少选择一项主要活动')
  if (days.value > 91) return toast('最长 90 天')
  const intro = await prompt('公开简介（选填）', { placeholder: '例如：喜欢慢节奏，想找人一起逛市集' })
  if (intro === null || publishing) return
  publishing = true
  try {
    const res = (await gated(() => apiPublishPlan({ city: plan.value.city, startDate: plan.value.start, endDate: plan.value.end,
      activities: selectedActivities.value, intro, hideStay: true, hideTransport: true }))).data
    toast(res.message)
    // 之前用 navigateTo 叠一层：在同行候选页按返回又回到这张已经发过的表单，再点一次就重复发布；现在用发布结果页替换掉表单
    setTimeout(() => replace(R.trip + '?view=match'), 600)
  } catch (e) {
    publishing = false
    fail(e, '发布失败')
  }
}
</script>

<style scoped lang="scss">
.composer-photo{width:44px;height:48px;display:flex;align-items:center;justify-content:center;background:transparent;padding:0;flex-shrink:0}.composer-photo::after,.message-image::after,.image-preview button::after{border:0}
.message-image{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:180px;height:180px;margin:0;padding:0;background:var(--k-paper);border:1px solid var(--k-line);border-radius:8px;overflow:hidden;line-height:1.5;font-size:13px;color:var(--k-muted)}.message-image image{display:block;width:100%;height:100%}.message-image text{display:block;padding:16px}.group-image{margin-left:42px}
.image-draft{position:fixed;left:10px;right:10px;bottom:calc(72px + var(--k-safe-bottom));z-index:40;display:flex;gap:8px;align-items:center;padding:10px;background:var(--k-paper);border:1px solid var(--k-line2);border-radius:8px}.image-draft image{width:54px;height:54px;flex-shrink:0}.image-draft>view{flex:1;min-width:0;font-size:12px}.image-draft text{display:block}.image-draft button{margin:0;padding:0 10px;font-size:12px;line-height:44px;background:var(--k-paper2);color:var(--k-ink)}
.image-preview{position:fixed;inset:0;z-index:2000;box-sizing:border-box;background:var(--k-paper);display:flex;flex-direction:column;padding-top:calc(64px + env(safe-area-inset-top,0px))}.image-preview>image{display:block;flex:1;width:100%;height:0;min-height:0}.image-preview>.composer-error{flex-shrink:0;margin:0;padding:8px 16px}.image-preview-actions{flex-shrink:0;display:flex;gap:12px;padding:12px 16px calc(16px + var(--k-safe-bottom,0px));border-top:1px solid var(--k-line)}.image-preview-actions button{flex:1;margin:0;min-width:0;min-height:48px;padding:0 12px;line-height:48px;font-size:15px;border-radius:8px;color:var(--k-ink);background:var(--k-paper2)}.image-preview-actions .image-preview-save{color:var(--k-paper);background:var(--k-red)}.image-preview-actions button[disabled]{color:var(--k-muted);background:var(--k-line)}

.chat-page{background:var(--k-bg)}.private-body{padding:10px 16px 120px}.source{display:block;color:var(--k-muted);font-size:13px;margin:0 0 8px 4px}.person-card{padding:10px 12px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper)}.person-top{display:flex;align-items:center;gap:12px}.person-avatar{width:56px;height:56px;border-radius:50%}.person-copy{display:flex;flex-direction:column;gap:7px}.person-name{font-family:var(--k-serif);font-size:18px;font-weight:700}.verified{padding:2px 6px;border:1px solid #8FB09B;border-radius:4px;color:var(--k-green);font-size:11px}.person-meta{color:var(--k-muted);font-size:13px}.person-line{height:1px;background:var(--k-line);margin:10px 0}.overlap{display:flex}.overlap>view{width:50%;display:flex;align-items:center;gap:9px}.overlap>view>view{display:flex;flex-direction:column;gap:4px;font-size:12px}.overlap>view>view text:last-child{font-weight:700}.quick-title{display:block;margin:16px 4px 8px;font-family:var(--k-serif);font-size:16px;font-weight:700}.quick-list{display:flex;flex-wrap:wrap;gap:8px}.quick-list view{height:29px;padding:0 10px;border:1px solid var(--k-line2);border-radius:15px;background:var(--k-paper);display:flex;align-items:center;font-size:12px}.time{display:block;text-align:center;margin:14px 0 7px;color:var(--k-light);font-size:12px}.message-row{display:flex;align-items:flex-start;gap:8px}.msg-avatar{width:38px;height:38px;border-radius:50%}.message-bubble{padding:9px 11px;border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper);font-size:13px;line-height:1.65;white-space:pre-line}.chat-photos{display:flex;gap:7px;margin:8px 0 0 46px}.chat-photos image{width:82px;height:82px;border-radius:7px}.safety{margin-top:37px;padding:11px 13px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper2);color:var(--k-muted);font-size:11px;line-height:1.7;white-space:pre-line}.private-action{width:72px;height:48px;border:1px solid var(--k-line2);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--k-muted);font-size:11px}.send-big{height:48px;min-width:0;flex:1;border-radius:8px;background:var(--k-red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700}

.chat-page.is-conversation{height:100vh;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden}
.is-conversation>.k-topbar{flex-shrink:0}
.conversation-meta{flex-shrink:0;padding:8px 16px;border-bottom:1px solid var(--k-line);color:var(--k-muted);font-size:12px;line-height:1.5;background:var(--k-paper2)}
/* 接待说明另起一行：之前紧跟在「… · 不限 / 大理」后面，读成「不限线上任务接待」 */
.conversation-meta__notice{display:block}
.conversation-scroll{flex:1;height:0;min-height:0;width:100%}
.is-conversation .private-body{padding:12px 16px 8px}
.conversation-empty{display:block;padding:28px 12px;text-align:center;color:var(--k-muted);font-size:14px;line-height:1.6}
.is-conversation .message-row{margin-top:12px;gap:10px}
.is-conversation .message-row.is-mine{flex-direction:row-reverse}
.is-conversation .msg-avatar{flex-shrink:0;width:38px;height:38px;border-radius:8px}
.message-copy{max-width:calc(100% - 76px);min-width:0}
.message-sender{display:block;margin-bottom:4px;color:var(--k-muted);font-size:12px}
.is-conversation .message-bubble{display:block;padding:10px 12px;border-radius:8px;font-size:15px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap}
.is-mine .message-bubble{background:var(--k-green-soft)}
.message-hint{display:block;margin-top:4px;color:var(--k-muted);font-size:11px;line-height:1.5}
.is-mine .message-hint{text-align:right}
.contact-bar{display:flex;align-items:center;gap:6px;margin:0 0 8px;padding:6px 8px 6px 10px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper)}
.contact-bar__text{flex:1;min-width:0;color:var(--k-muted);font-size:12px;line-height:1.5}
.contact-bar__btn{flex-shrink:0;margin:0;padding:0 10px;height:30px;line-height:30px;border:1px solid var(--k-line2);border-radius:15px;background:var(--k-paper);color:var(--k-ink);font-size:12px}
.contact-bar__btn::after{border:0}
.contact-bar__btn.is-primary{border-color:var(--k-green);background:var(--k-green);color:#fff}
.conversation-end{height:8px}
.message-composer{flex-shrink:0;padding:8px 10px calc(8px + var(--k-safe-bottom));border-top:1px solid var(--k-line);background:var(--k-paper2)}
.message-composer.keyboard-open{padding-bottom:8px}
.composer-row{display:flex;align-items:flex-end;gap:8px}
.composer-row button{margin:0;padding:0;border-radius:8px;font-size:15px;line-height:48px;flex-shrink:0}
.composer-row button::after,.conversation-error button::after{border:0}
/* 顶栏右边的「···」（之前在输入栏最左边，占了约 56px）；输入栏提供附件、输入框、表情和发送 */
.chat-more{width:40px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:8px}
/* 小程序里「···」挨着微信胶囊：标题右边让出胶囊 + 图标（约 50px）再加省略号，长门店名不会压到图标上；
   这样标题框左右不对称，居中会显得歪，改成紧跟返回箭头靠左。网页版没有真胶囊，照旧居中 */
/* #ifdef MP-WEIXIN */
.is-conversation :deep(.k-navbar__title){left:48px;right:calc(var(--chat-cap, 97px) + 50px);text-align:left}
/* #endif */
.composer-field{flex:1;min-width:0;padding:10px 12px;box-sizing:border-box;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper)}
.composer-input{width:100%;min-height:26px;max-height:112px;font-size:16px;line-height:26px;color:var(--k-ink)}.chat-area-idle{overflow:hidden;white-space:pre-wrap;word-break:break-all}
.composer-send{min-width:58px;height:48px;padding:0 10px!important;background:var(--k-red);color:var(--k-paper);font-weight:600}
.composer-send[disabled]{background:var(--k-line2);color:var(--k-muted)}
.composer-error{display:block;padding:0 4px 7px;color:var(--k-alert);font-size:12px;line-height:1.5}
.conversation-error{flex-shrink:0;padding:8px 16px;display:flex;align-items:center;gap:12px;color:var(--k-alert);background:var(--k-paper2);font-size:12px}
.conversation-error>text{flex:1;min-width:0}
.conversation-error button{margin:0;padding:0 8px;flex-shrink:0;background:var(--k-paper);color:var(--k-alert);font-size:12px;line-height:32px}
.group-body{padding:8px 14px 100px}.announcement{padding:10px 12px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper)}.announcement-title{display:block;font-family:var(--k-serif);font-size:15px;font-weight:700;margin-bottom:6px}.announcement>text{font-size:13px}.announcement-last{margin-top:5px;display:flex;align-items:center;justify-content:space-between;color:var(--k-muted);font-size:12px}.group-tools{height:74px;display:flex;border-bottom:1px solid var(--k-line)}.group-tools view{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;font-size:11px}.group-section{display:block;margin:12px 0 7px;font-family:var(--k-serif);font-size:16px;font-weight:700}.group-activity{padding:8px 9px;border:1px solid #9CB9A7;border-radius:12px;background:var(--k-paper);display:flex;gap:9px}.group-activity-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:7px}.activity-kind{align-self:flex-start;padding:2px 7px;border-radius:4px;background:var(--k-ochre);color:#fff;font-size:10px}.group-activity-title{font-family:var(--k-serif);font-size:15px;font-weight:700}.group-meta{display:flex;align-items:center;gap:5px;color:var(--k-muted);font-size:11px}.signed{margin-left:auto;color:var(--k-green)}.group-activity>image{width:83px;height:83px;border-radius:7px}.group-message{margin-top:14px}.msg-head{display:flex;align-items:center;gap:8px;color:var(--k-muted);font-size:11px}.msg-head image{width:34px;height:34px;border-radius:50%}.msg-head text:nth-child(2){color:var(--k-ink);font-size:12px}.msg-head text:last-child{margin-left:auto}.group-bubble{display:block;margin:-3px 0 0 42px;padding:8px 11px;border-radius:9px;background:var(--k-paper2);font-size:13px;line-height:1.55;white-space:pre-line;width:210px;max-width:calc(100% - 42px);overflow-wrap:anywhere;word-break:break-word}.like{margin:5px 0 0 52px}.like text{padding:3px 10px;border:1px solid var(--k-line2);border-radius:6px;font-size:12px}.location-card{width:220px;height:86px;margin:-2px 0 0 42px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);display:flex;overflow:hidden}.location-card>view{min-width:0;flex:1;padding:8px 10px;display:flex;flex-direction:column;gap:7px}.location-share{color:var(--k-green);font-size:12px}.location-title{font-size:13px;font-weight:700}.location-address{color:var(--k-muted);font-size:10px}.location-card image{width:72px;height:86px}.group-safety{margin-top:16px}.voice,.plus-round{width:38px;height:38px;border:1px solid var(--k-line2);border-radius:50%;display:flex;align-items:center;justify-content:center}.chat-input{height:38px;min-width:0;flex:1;padding:0 12px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper)}.chat-input input{width:100%;height:38px;font-size:13px}.placeholder{color:var(--k-light)}
.detail-body{padding:8px 16px calc(28px + var(--k-safe-bottom))}.group-info{padding:14px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:12px}.group-info>image{width:72px;height:72px;border-radius:50%}.group-info-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:7px;color:var(--k-muted);font-size:12px}.group-name{font-family:var(--k-serif);font-size:18px;font-weight:700;color:var(--k-ink)}.qr-card{min-height:70px;margin-top:10px;padding:12px 14px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;align-items:center}.qr-card>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:8px;color:var(--k-muted);font-size:12px}.card-title{font-family:var(--k-serif);font-size:16px;font-weight:700;color:var(--k-ink)}.qr-card image{width:58px;height:58px;margin-right:12px}.members-head,.setting-head,.common-row{display:flex;align-items:center;justify-content:space-between}.members-head{margin:14px 4px 8px;font-family:var(--k-serif);font-size:16px;font-weight:700}.members-head>view,.setting-head>view,.common-row>view{display:flex;align-items:center;gap:4px;color:var(--k-muted);font-size:12px}.members{display:flex;flex-wrap:wrap;row-gap:12px}.members>view{width:20%;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;text-align:center}.members>view>text{max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.member-avatar{position:relative}.member-avatar image{width:48px;height:48px;border-radius:50%}.member-avatar>text{position:absolute;right:0;bottom:0;width:14px;height:14px;border-radius:50%;background:var(--k-green);color:#fff;font-size:9px}.setting-section{margin:14px -16px 0;padding:13px 20px;border-top:1px solid var(--k-line);border-bottom:1px solid var(--k-line)}.setting-head>text{font-family:var(--k-serif);font-size:16px;font-weight:700}.announcement-copy{display:block;margin-top:9px;font-size:12px;line-height:1.7;white-space:pre-line}.toggles{margin-top:0}.toggles>view{height:40px;display:flex;align-items:center;justify-content:space-between;font-family:var(--k-serif);font-size:15px;font-weight:700}.switch{width:42px;height:24px;padding:2px;border-radius:14px;background:#C7C1B8;box-sizing:border-box}.switch.on{background:var(--k-green)}.switch view{width:20px;height:20px;border-radius:50%;background:#fff}.switch.on view{transform:translateX(18px)}.common-row{height:48px;margin:0 -16px;padding:0 20px;border-bottom:1px solid var(--k-line);font-family:var(--k-serif);font-size:15px;font-weight:700}.detail-body>.k-button{margin-top:12px}.detail-body>.k-button.danger{color:var(--k-alert);border-color:rgba(192,68,55,.45)}.report-group{display:block;text-align:center;margin-top:14px;color:var(--k-alert);font-family:var(--k-serif);font-size:15px;font-weight:700}
.publish-trip{padding:8px 16px calc(24px + var(--k-safe-bottom))}.trip-banner{height:74px;padding:9px 13px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;align-items:center}.trip-banner>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:9px;font-size:14px;font-weight:700}.trip-banner>view text:last-child{color:var(--k-muted);font-size:12px;font-weight:400}.trip-banner image{width:94px;height:70px}.step-title{display:flex;align-items:center;gap:9px;margin:12px 0 7px;font-family:var(--k-serif);font-size:16px;font-weight:700}.step-title>text:first-child{width:22px;height:22px;border-radius:50%;background:var(--k-red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px}.step-note{color:var(--k-muted);font-size:11px;font-weight:400}.date-card{height:56px;padding:0 12px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);display:flex;align-items:center;gap:14px}.date-card>view{display:flex;flex-direction:column;gap:5px}.date-card>view text:first-child{color:var(--k-muted);font-size:11px}.date-card>view text:last-child{font-size:14px;font-weight:700}.date-card>text:last-child{margin-left:auto;color:var(--k-muted);font-size:11px}.arrow{font-size:20px;color:var(--k-muted)}.activity-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.activity-grid>view{position:relative;height:31px;border:1px solid var(--k-line2);border-radius:7px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;font-size:12px}.activity-grid>view.active{border-color:var(--k-red);color:var(--k-red)}.privacy-card{padding:0 12px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper)}.privacy-card>view{height:54px;border-bottom:1px solid var(--k-line);display:flex;align-items:center;justify-content:space-between}.privacy-card>view:last-child{border:0}.privacy-card>view>view:first-child{display:flex;flex-direction:column;gap:5px}.privacy-card>view>view:first-child text:first-child{font-size:13px;font-weight:700}.privacy-card>view>view:first-child text:last-child{color:var(--k-muted);font-size:10px}.trip-preview{padding:8px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);display:flex;gap:10px}.trip-preview>image{width:82px;height:96px;border-radius:7px}.trip-preview-copy{min-width:0;flex:1;display:flex;flex-direction:column;justify-content:space-between;color:var(--k-muted);font-size:11px}.trip-preview-title{font-family:var(--k-serif);font-size:14px;font-weight:700;color:var(--k-ink)}.public{padding:2px 5px;border-radius:4px;background:var(--k-ochre-soft);color:#916326;font-size:9px}.preview-tags{display:flex;gap:5px}.preview-tags text{padding:2px 5px;border-radius:4px;background:var(--k-paper2);font-size:9px}.publish-trip>.k-button{margin-top:11px}.agreement{display:block;text-align:center;margin-top:10px;color:var(--k-muted);font-size:11px}
/* 发布行程找搭子 · 选中的活动标签：✓ 小圆点跟在文字右边（设计稿 24）。之前圆点绝对定位贴在格子右侧，四个字的标签在窄屏上最后一个字被压住
   （320 宽时「手作体验」的「验」几乎整个被盖住）。最窄 320 宽一格约 64px，四个字 48px + 间距 + 圆点放得下 */
.activity-grid>view{gap:2px}.activity-grid>view>text{white-space:nowrap}.picked{flex:0 0 auto;width:12px;height:12px;border-radius:50%;background:var(--k-red);color:#fff;font-size:8px;line-height:1;display:flex;align-items:center;justify-content:center}
/* 私信对方卡片：点进 TA 的个人主页；帖子分享卡片（「分享到私信」发来的） */
.person-copy{flex:1;min-width:0}.person-link{flex:0 0 auto;color:var(--k-muted);font-size:12px}
.shared-post{display:flex;flex-direction:column;gap:4px;max-width:240px;padding:10px 12px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper)}
.shared-post__tag{font-size:11px;color:var(--k-muted)}.shared-post__title{font-family:var(--k-serif);font-weight:700;font-size:15px;line-height:1.4;overflow-wrap:anywhere}.shared-post__go{font-size:12px;color:var(--k-red)}
.is-mine .shared-post{background:var(--k-green-soft)}
/* 文件消息卡片（V46）：图标 + 文件名（长名字折行）+ 大小和提示；点开选打开 / 转发 / 保存 / 复制链接 */
.file-card{display:flex;align-items:center;gap:10px;width:220px;max-width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper)}
.is-mine .file-card{background:var(--k-green-soft)}
.file-card__icon{flex-shrink:0;display:flex;align-items:center}
.file-card__copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.file-card__name{font-size:14px;line-height:1.45;color:var(--k-ink);overflow-wrap:anywhere;word-break:break-word}
.file-card__meta{font-size:12px;line-height:1.4;color:var(--k-muted)}
/* 待发文件条沿用待发图片条的样子；图标那一格不跟着撑开（.image-draft>view 默认 flex:1） */
.file-draft>.file-card__icon{flex:0 0 auto;width:40px;justify-content:center}
.file-draft__name{font-size:13px;color:var(--k-ink);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.file-draft__error{color:var(--k-alert)}
.is-conversation .group-body{padding:12px 16px 8px}.composer-tool{flex:0 0 40px;margin:0;padding:0;height:48px;display:flex;align-items:center;justify-content:center;background:transparent}.composer-tool::after{border:0}.emoji-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));padding-top:12px;gap:4px}.emoji-grid button{margin:0;padding:0;font-size:26px;line-height:48px;background:transparent}.emoji-grid button::after{border:0}.group-new{font-size:12px;line-height:36px;margin:0;background:var(--k-green-soft);color:var(--k-green)}
</style>
