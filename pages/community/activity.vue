<template>
  <view class="k-page activity-page" :class="$userSurface">
    <view v-if="landingError" class="scan-status" role="alert">{{ landingError }}</view>
    <!-- 1 活动列表 -->
    <template v-if="s === 1">
      <k-topbar title="活动" back bg="var(--k-paper)">
        <template #left><view class="city-select" hover-class="k-press" @click="pickCity"><k-icon name="chevron-down" :size="14" color="ink" /><text>{{ city }}</text><k-icon name="chevron-down" :size="14" color="ink" /></view></template>
        <view class="search" hover-class="k-press" @click="askSearch"><k-icon name="search" :size="18" color="light" /><text class="search__text">{{ searchText }}</text><view class="search__btn"><text>搜索</text></view></view>
        <view class="k-tabs activity-tabs"><view v-for="tab in tabs" :key="tab" class="k-tabs__item" :class="{ active: activeTab === tab }" hover-class="k-press" @click="setTab(tab)"><text>{{ tab }}</text></view></view>
      </k-topbar>
    <k-subscribe scenes="activity" label="订阅活动提醒" />
      <view class="list-body k-pad-tab">
        <!-- 之前「为你推荐」这一屏没有任何入口（没有按钮、也没有页面带 ?view=recommend 进来）；现在列表顶部加一行入口 -->
        <view class="remind-row" hover-class="k-press" @click="openRecommend"><k-icon name="sparkles" :size="16" color="red" /><text>为你推荐</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
        <view class="remind-row"><k-icon name="calendar-plus" :size="16" color="red" /><text>有新活动提醒我</text><view class="switch" :class="{ on: remind }" :aria-disabled="!listLoaded || remindBusy" @click="toggleRemind"><view class="switch__knob" /></view></view>
        <view v-if="listError" class="empty-tip"><text>{{ listError }}</text><k-button type="outline" size="sm" @click="loadList">重新读取活动</k-button></view>
        <text v-else-if="!listLoaded && !landingError" class="empty-tip">正在读取活动…</text>
        <view v-for="group in activityGroups" :key="group.date" class="date-group">
          <text class="date-title">{{ group.date }}</text>
          <view v-for="item in group.items" :key="item.activityId" class="activity-item" hover-class="k-press-s" @click="open(item)">
            <!-- 10-16 反馈：卡片上直接收藏（右上角的心），收藏的活动在「我的活动 → 收藏」里看报名截止时间 -->
            <view class="activity-item__photo"><image class="activity-item__img" :src="item.img" mode="aspectFill" /><view class="fav-hit" hover-class="press-stop" hover-stop-propagation><view class="fav-dot" hover-class="k-press" @click.stop="toggleFav(item)"><k-icon name="heart" :size="16" :color="item.favorited ? 'red' : 'ink'" :fill="!!item.favorited" /></view></view></view>
            <view class="activity-item__copy"><text class="activity-item__title">{{ item.title }}</text><view class="meta"><k-icon name="clock" :size="14" color="muted" /><text>{{ item.time }}</text></view><view class="meta"><k-icon name="map-pin" :size="14" color="muted" /><text>集合：{{ item.place }}</text></view><view v-if="item.deadlineLine" class="meta meta--deadline"><k-icon name="calendar-clock" :size="14" color="muted" /><text>{{ item.deadlineLine }}</text></view><view class="item-status"><text class="kind" :class="`kind--${item.tone}`">{{ item.kind }}</text><text class="quota" :class="{ few: item.few && !item.full, full: item.full }">{{ item.full ? '已满可候补' : (item.few ? '名额紧张' : '名额充足') }}</text></view><view class="signup"><view class="avatar-stack"><image v-for="(a, i) in item.avatars" :key="i" class="small-avatar" :src="a" mode="aspectFill" /></view><text>{{ item.count }}人已报名</text></view></view>
          </view>
        </view>
        <!-- 之前没有活动时只有一片空白 -->
        <view v-if="listLoaded && !activityGroups.length" class="empty-tip"><view class="empty-ico"><k-icon name="calendar" :size="32" color="red" /></view><text class="empty-tip__title">{{ keyword ? '没有搜到相关活动，' : '这里暂时没有活动，' }}</text><text class="empty-tip__sub">{{ keyword ? '换个关键词试试' : '换个城市或页签看看' }}</text></view>
      </view>
      <k-tabbar active="community" />
    </template>

    <!-- 2 AI推荐区 -->
    <template v-else-if="s === 2">
      <k-topbar title="为你推荐" back custom-back @back="leaveRecommend" />
      <view class="ai-body k-pad-tab">
        <view class="ai-banner"><view><text class="ai-banner__title">为你推荐个性活动</text><text class="ai-banner__sub">根据你的收藏、报名与行程推荐</text></view><view class="ai-banner__ico"><k-icon name="sparkles" :size="24" color="red" /></view></view>
        <text class="ai-section-title">个性推荐</text>
        <view v-if="recLoaded && !recommended.length" class="empty-tip"><view class="empty-ico"><k-icon name="sparkles" :size="32" color="red" /></view><text class="empty-tip__title">暂时没有为你推荐的活动，</text><text class="empty-tip__sub">收藏或报名几场后推荐会更准</text></view>
        <view v-for="item in recommended" :key="item.activityId" class="rec-card" hover-class="k-press-s" @click="open(item)">
          <view class="rec-photo"><image class="rec-img" :src="item.img" mode="aspectFill" /><text class="reason-chip" :class="`reason-chip--${item.tone}`">{{ item.reason }}</text></view>
          <view class="rec-copy"><text class="rec-title">{{ item.title }}</text><text class="rec-reason">推荐理由：{{ item.desc }}</text><view class="meta"><k-icon name="map-pin" :size="14" color="muted" /><text>{{ item.distance }}</text><text class="quota rec-quota" :class="{ full: item.full }">{{ item.full ? '已满可候补' : (item.few ? '名额较少' : '名额充足') }}</text></view><view class="meta"><k-icon name="clock" :size="14" color="muted" /><text>{{ item.time }}</text></view><view class="signup"><view class="avatar-stack"><image v-for="(a, i) in item.avatars" :key="i" class="small-avatar" :src="a" mode="aspectFill" /></view><text>{{ item.count }}人已报名</text></view></view>
        </view>
        <view class="more-head"><text>更多活动</text><view class="filters"><view v-for="(filterText, filterIdx) in filters" :key="filterIdx" class="filter" hover-class="k-press" @click="pickFilter(filterIdx)"><text>{{ filterText }}</text><k-icon name="chevron-down" :size="14" color="muted" /></view></view></view>
        <view v-for="item in moreActivities" :key="item.activityId" class="more-item" hover-class="k-press-s" @click="open(item)"><image class="more-img" :src="item.img" mode="aspectFill" /><view class="more-copy"><view class="k-between"><text class="more-title">{{ item.title }}</text><text class="kind kind--business">{{ item.kind }}</text></view><view class="meta"><k-icon name="clock" :size="14" color="muted" /><text>{{ item.time }}</text></view><view class="meta"><k-icon name="map-pin" :size="14" color="muted" /><text>集合：{{ item.place }}</text></view><view class="signup"><view class="avatar-stack"><image v-for="(a, i) in item.avatars" :key="i" class="small-avatar" :src="a" mode="aspectFill" /></view><text>{{ item.count }}人已报名</text><text class="distance">{{ item.distance }}</text></view></view></view>
        <view v-if="recLoaded && !moreActivities.length" class="empty-tip"><view class="empty-ico"><k-icon name="search" :size="32" color="red" /></view><text>没有符合筛选条件的活动</text></view>
      </view>
      <k-tabbar active="community" />
    </template>

    <!-- 3 活动详情 -->
    <template v-else-if="s === 3">
      <k-topbar :title="detail.productKind==='travel'?'旅游产品详情':'活动详情'" back custom-back @back="leaveDetail" />
      <view class="detail-body k-pad-bottom" :class="{ 'detail-body--loading': !detail.activityId }">
        <!-- 11-18 返修：活动还没取到时显示骨架，不再露出「集合：」「名额 0/0」空字段 -->
        <view v-if="!detail.activityId" class="dskel dskel--v7"><view class="dskel__img" /><view class="dskel__card"><view class="dskel__line dskel__line--title" /><view class="dskel__line dskel__line--title2" /><view class="dskel__line dskel__line--price" /><view class="dskel__sep" /><view v-for="n in 3" :key="n" class="dskel__info"><view class="dskel__dot" /><view class="dskel__line" :class="{ 'dskel__line--short': n === 3 }" /></view><view class="dskel__sep" /><view class="dskel__line dskel__line--name" /><view class="dskel__line" /><view class="dskel__line" /><view class="dskel__line dskel__line--short" /></view></view>
        <view v-if="memberActivityVouchers.length && !detail.mySignupId" class="member-free" style="padding:14px;background:#f4e9d8;border-radius:14px;margin:12px 0"><text>此活动可使用会员免费活动权益</text><button class="member-free__btn" style="font-size:14px;margin-top:8px" @click="memberActivityId=memberActivityId?null:memberActivityVouchers[0].walletId">{{ memberActivityId?'已选择免费参加 · 点击取消':'选择免费活动权益' }}</button></view>
        <view v-if="pendingCheckin || checkinMessage" class="scan-status">
          <text>{{ checkinMessage || '请登录后完成活动签到' }}</text>
          <k-button v-if="pendingCheckin" size="sm" :label="experience.account ? '重试签到' : '登录并继续签到'" @click="resumeCheckin" />
        </view>
        <!-- 封面是员工上传的 /profile/upload/… 相对路径：小程序会当成包里的文件去找（空白），要和列表卡片一样先补全成服务器地址 -->
        <!-- 2026-10-16 主人反馈：大图之前是 166px 高、按比例裁满，竖一点的照片人头被裁掉。现在 4:3 的框里整张显示（aspectFit），两边空出来的地方垫同一张图的模糊放大版 -->
        <view class="detail-hero-box" :class="{ 'detail-hero-box--ph': !detail.img, 'detail-hero-box--short': !!detail.activityId && !detail.img }"><image class="detail-hero-bg" :src="detail.img ? absUrl(detail.img) : '/static/media/cover-empty.png'" mode="aspectFill" /><image class="detail-hero" :src="detail.img ? absUrl(detail.img) : '/static/media/cover-empty.png'" mode="aspectFit" /></view>
        <view class="detail-summary"><view class="detail-title-row"><text class="detail-kind">{{ detail.kind }}</text><text class="detail-title">{{ detail.title }}</text></view><text class="detail-slogan">{{ detail.slogan || detail.category || '' }}</text><view class="price-row"><view><text class="price">{{ priceMain }}</text><text v-if="priceSub" class="per">{{ priceSub }}</text></view><view v-if="detail.insured" class="insurance"><k-icon name="shield-check" :size="12" color="green" /><text>含户外保险</text></view></view><text v-if="feeNote" class="fee-note">{{ feeNote }}</text></view>
        <view class="detail-info"><view class="detail-line"><k-icon name="clock" :size="18" color="muted" /><text>{{ detail.timeText }}</text></view><view class="detail-line detail-line--tap" hover-class="k-press" @click="openPlace(detail)"><k-icon name="map-pin" :size="18" color="muted" /><text class="detail-line__text">集合：{{ detail.place }}</text><text class="place-tag">{{ placeTag(detail) }}</text></view><view class="detail-line"><k-icon name="footprints" :size="18" color="muted" /><text>{{ detail.intensity || ('名额 ' + (detail.count || 0) + '/' + (detail.capacity || 0) + ' · 报名截止 ' + (detail.deadlineText || '')) }}</text></view></view>
        <view class="detail-section host-section"><text class="detail-section__title">主办方</text><view class="host"><image class="host-logo" :src="hostLogo" mode="aspectFit" /><view class="host-copy"><view class="host-name-row"><text class="host-name">{{ detail.host.name }}</text><text class="host-chip">{{ (detail.host.chips || [])[0] }}</text><text v-if="(detail.host.chips || []).length > 1" class="host-chip">{{ detail.host.chips[1] }}</text></view><text class="host-meta">{{ hostMeta }}</text></view><k-button type="outline" size="xs" :disabled="!detail.host.userId && !detail.host.storeId" @click="showHost">{{ detail.host.userId || detail.host.storeId ? '查看主页' : '暂无主页' }}</k-button></view></view>
        <!-- 活动介绍（主办方可写 1000 字，保留换行）：先显示 3 行，「展开」在页面里直接展开全文和安全说明（原先弹窗显示，长介绍要在小框里滚） -->
        <view class="detail-section intro" :class="{ 'intro--plain': !introFolds }"><text class="detail-section__title">活动介绍</text><text class="detail-text" :class="{ 'detail-text--open': introOpen }">{{ detail.intro || '主办方暂未填写活动介绍' }}</text><text v-if="introOpen && detail.safetyNote" class="detail-text detail-text--open detail-safety">安全说明：{{ detail.safetyNote }}</text><view v-if="introFolds" class="expand" @click="introOpen = !introOpen"><text>{{ introOpen ? '收起' : '展开' }}</text><k-icon :name="introOpen ? 'chevron-up' : 'chevron-down'" :size="16" color="muted" /></view></view>
        <view class="detail-section fee"><text class="detail-section__title">费用与保障</text><view class="fee-row"><text class="fee-label">{{ detail.feeKind === 'aa' ? 'AA 说明' : '费用包含' }}</text><text>{{ feeIncludes }}</text></view><view class="fee-row"><text class="fee-label">保障说明</text><text>{{ detail.insuranceDesc }}</text></view></view>
      </view>
      <k-bottom pad="10px 16px"><view class="bottom-side" :class="{ 'is-loading': !detail.activityId }" hover-class="k-press" @click="favorite"><k-icon name="heart" :size="24" :color="detail.favorited ? 'red' : 'ink'" /><text>{{ detail.favorited ? '已收藏' : '收藏' }}</text></view><view class="bottom-main" :class="{ 'bottom-main--off': !detail.mySignupId && !detail.isOwner && detail.phase !== 'open', 'is-loading': !detail.activityId }"><k-button size="lg" block @click="signup"><text class="signup-label">{{ signupLabel }}</text><text class="signup-price">{{ detail.priceText }}</text></k-button></view><!-- 之前点「分享」只弹一句「请点击右上角…」；现在小程序里一点就打开微信转发面板 --><!-- #ifdef MP-WEIXIN --><button v-if="communityEnabled" class="bottom-side share-btn" :class="{ 'is-loading': !detail.activityId }" open-type="share"><k-icon name="share-2" :size="24" color="ink" /><text>分享</text></button><!-- #endif --><!-- #ifndef MP-WEIXIN --><view v-if="communityEnabled" class="bottom-side" :class="{ 'is-loading': !detail.activityId }" hover-class="k-press" @click="openShare"><k-icon name="share-2" :size="24" color="ink" /><text>分享</text></view><!-- #endif --></k-bottom>
    </template>

    <!-- 4 报名成功 -->
    <template v-else>
      <k-topbar :title="ticketTitle" back custom-back @back="openDetail(ticket.activityId)" />
      <k-order-mediation order-type="activity" :order-id="ticket.signupId" />
      <view class="success-body k-pad-tab">
        <view class="success-head" :class="'success-head--' + (ticket.status || 'none')"><view class="success-ico"><k-icon :name="ticket.status === 'confirmed' ? 'check' : ticket.status === 'waitlist' ? 'hourglass' : ticket.status === 'pending_payment' ? 'wallet' : 'ticket'" :size="28" :color="ticket.status === 'confirmed' ? 'green' : 'red'" /></view><view><text class="success-title">{{ ticketTitle }}</text><text class="success-sub">{{ ticketSub }}</text></view><image v-if="ticket.status === 'confirmed'" class="success-stamp" src="/static/media/activity-stamp.jpg" mode="aspectFit" /></view>
        <view class="ticket" :class="{ 'ticket--blank': ticketBlank }"><view class="ticket-top"><image class="ticket-img" :src="ticket.img ? absUrl(ticket.img) : '/static/media/cover-empty.png'" mode="aspectFill" /><view class="ticket-copy"><text class="detail-kind">{{ ticket.kind }}</text><text class="ticket-title">{{ ticket.title }}</text><view class="detail-line"><k-icon name="clock" :size="16" color="muted" /><text>{{ ticket.timeText }}</text></view><view class="detail-line detail-line--tap" hover-class="k-press" @click="openPlace(ticket)"><k-icon name="map-pin" :size="16" color="muted" /><text class="detail-line__text">集合：{{ ticket.place }}</text><text class="place-tag">{{ placeTag(ticket) }}</text></view></view></view><view class="ticket-dash" /><view class="ticket-data"><view v-for="row in ticketRows" :key="row.label" class="ticket-data__row"><text>{{ row.label }}</text><text :class="{ 'is-blank': row.value === '—' }">{{ row.value }}</text></view></view>
          <!-- 11-18 返修：现场签到放进凭证卡底部，「去签到」是 44 高主按钮（整块仍然点了就去签到） -->
          <view v-if="ticket.status === 'confirmed' && !ticket.checkedIn" class="reminder" hover-class="k-press" @click="selfCheckin"><k-icon name="scan-qr-code" :size="20" color="ink2" /><view><text class="reminder-title">现场签到</text><text class="reminder-sub">{{ ticket.checkinWindowText || '活动开始前2小时至结束期间可签到' }}</text><text class="reminder-sub">扫领队出示的二维码，或输入 6 位活动签到码</text></view><text class="reminder-link">去签到</text></view>
        </view>
        <view v-if="ticketLive" class="reminder"><k-icon name="bell" :size="20" color="ink2" /><view><text class="reminder-title">集合提醒</text><text class="reminder-sub">{{ ticket.remindLabel }}</text></view><text class="reminder-link" @click="changeRemind">修改提醒</text></view>
        <!-- 2026-11-03 主人：签到二维码生成失败的兜底。报名已确认、还没签到：现场扫领队出示的码（微信小程序码、普通二维码都认），或输入领队给的 6 位活动签到码 -->
        <view class="action-grid"><view v-for="action in successActions" :key="action.title" class="success-action" hover-class="k-press" @click="action.click"><view class="success-action__ico"><k-icon :name="action.icon" :size="20" color="ink2" /></view><view><text class="action-title">{{ action.title }}</text><text class="action-sub">{{ action.sub }}</text></view><k-icon class="success-action__go" name="chevron-right" :size="12" color="muted" /></view></view>
      </view>
      <k-tabbar active="community" />
    </template>
    <view v-if="shareOpen && communityEnabled" class="activity-share-mask" @click="shareOpen = false">
      <view class="activity-share-panel" role="dialog" aria-label="分享活动" @click.stop>
        <view class="activity-share-head"><text>分享活动</text><button class="activity-share-close" aria-label="关闭分享" @click="shareOpen = false"><k-icon name="x" :size="22" /></button></view>
        <text class="activity-share-summary">{{ shareData.title }}</text>
        <!-- #ifdef MP-WEIXIN -->
        <button class="activity-share-row" open-type="share"><k-icon name="message-circle" :size="24" color="green" /><view><text>微信好友 / 群</text><text class="activity-share-note">直接发送活动卡片</text></view><k-icon name="chevron-right" :size="18" /></button>
        <!-- #endif -->
        <!-- #ifdef H5 -->
        <button v-if="systemShareAvailable" class="activity-share-row" @click="shareToSystem"><k-icon name="share-2" :size="24" color="red" /><view><text>选择软件分享</text><text class="activity-share-note">使用手机的分享菜单</text></view><k-icon name="chevron-right" :size="18" /></button>
        <!-- #endif -->
        <button class="activity-share-row" @click="copyActivityLink"><k-icon name="link" :size="24" color="red" /><view><text>复制活动链接</text><text class="activity-share-note">粘贴到微信、QQ 等软件</text></view><k-icon name="chevron-right" :size="18" /></button>
        <button class="activity-share-row" :disabled="posterBusy" @click="saveActivityPoster"><k-icon name="image" :size="24" color="red" /><view><text>{{ posterBusy ? '正在生成海报…' : '保存活动海报' }}</text><text class="activity-share-note">保存后可发到朋友圈或其他软件</text></view><k-icon name="chevron-right" :size="18" /></button>
        <text class="activity-share-privacy">仅分享公开活动信息，报名人、手机号和订单信息不会出现在分享内容中。</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { rememberDestination } from '@/common/camp-history.js'
import { groupChatEnabled } from '@/common/features.js'
import { communityEnabled } from '@/common/features.js'
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { selectCity } from '@/common/city-picker.js'
// ---------------------------------------------------------------------------
// 活动（用户端）接入情况：
//   s=1 活动列表：apiActivities（来源页签 / 城市 / 关键词）；「有新活动提醒我」= 订阅该城市新活动
//   s=2 为你推荐：apiActivityRecommend（按收藏 / 报名过的类目、时间冲突、同城热门的规则推荐，不是 AI）
//   s=3 活动详情：真实主办方、费用、保障（只有平台确实投保的活动才显示"含保险"）；报名 → 免费直接确认 /
//       小院活动在线支付（联调为模拟通道）/ 满员进候补
//   s=4 报名凭证：状态、签到码、集合提醒、活动群、取消报名（在线支付的开始前 24 小时以上可申请退款，人工审核）
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onShareAppMessage, onShareTimeline, onShow, onHide } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import {
  apiMemberWallet, apiActivities, apiActivityRecommend, apiActivity, apiActivitySignup, apiActivityFavorite, apiActivitySubscribe,
  apiSignup, apiSignupCancel, apiSignupRemind, apiChatOpen, apiActivityCheckinPin
} from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { sheet, prompt, confirm, alert, copy } from '@/common/ui.js'
import { gated, fail, saveCommunityCity } from '@/common/community.js'
import { payFlow } from '@/common/pay-flow.js'
import { absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { feeNoteOf } from '@/common/activity-form.js'
import { activitySharePayload } from '@/common/activity-share.js'
import { savePosterImage } from '@/common/poster.js'
import { API_BASE } from '@/common/config.js'
import { activityLanding, activityLoginQuery, parseActivityScene } from '@/common/activity-code.js'

const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    let landing
    try { landing = activityLanding(q) } catch (e) { landingError.value = e.message; return }
    channel.value = ['home', 'group', 'share', 'community', 'official'].includes(q?.channel || q?.from) ? (q.channel || q.from) : 'other'
    if (landing) {
      channel.value = ['group', 'official'].includes(landing.channel) ? landing.channel : channel.value
      if (landing.checkin) pendingCheckin.value = landing
      return openDetail(landing.id, landing.checkin)
    }
    if (Number(q?.signupId)) return openTicket(Number(q.signupId))
    // 登录态恢复后再定一次起步城市（社区城市按账号记在本机）；首页带 ?city= 进来按带来的城市看
    city.value = queryCity(q) || startCity()
    if (q?.view === 'recommend' || s.value === 2) { s.value = 2; recLanding = true; return loadRecommend() }
    loadList()
  }
})
const channel = ref('other')
const landingError = ref('')
const pendingCheckin = ref(null)
const checkinMessage = ref('')
const checkinBusy = ref(false)
// 之前详情 / 推荐屏的返回键直接退出整个页面，从列表点进详情再返回就回不到列表；
// 现在记下详情是从哪一屏列表打开的，返回回到那一屏；直接从链接落到详情 / 推荐的，返回仍离开本页
let fromList = 0
let recLanding = false
async function resumeCheckin() {
  const target = pendingCheckin.value
  if (!target || checkinBusy.value) return
  if (!experience.account) return go(R.login + activityLoginQuery(target))
  await openDetail(target.id, target.checkin)
}
const DEFAULT_IMG = '/static/media/cover-empty.png'
const img = (p) => (p ? absUrl(p) : DEFAULT_IMG)
const avatarsOf = (list) => (list || []).map(absUrl)

// ---------------- s=1 列表 ----------------
// 之前活动页每次都从兴趣城市第一位（首页放的是定位城市）起步，和社区里选的城市对不上；
// 现在和社区信息流 / 找搭子共用记在本机的「社区城市」，这里选了（包括「全部城市」）社区也跟着变。
// 10-16 反馈：社区里从没选过城市时跟首页城市走（首页是「全部城市」就看全部），不再落到写死的「大理」。
// 键名和 common/community.js 的 communityCityKey 一致（kangaroo:<账号|guest>:community-city），那边改了这里要跟着改
const savedCommunityCity = () => {
  try {
    const v = uni.getStorageSync(`kangaroo:${experience.account?.id || 'guest'}:community-city`)
    return typeof v === 'string' && v.trim() ? v : ''
  } catch (e) { return '' }
}
const homeCity = () => (!experience.allCities && experience.cities && experience.cities[0]) || '全部城市'
const startCity = () => savedCommunityCity() || homeCity()
const queryCity = (q) => {
  let v = String((q && q.city) || '').trim()
  try { v = decodeURIComponent(v) } catch (e) { /* 已是解码后的城市名 */ }
  return v.slice(0, 32)
}
const city = ref(startCity())
async function pickCity() {
  const value = await selectCity({ value: city.value === '全部城市' ? '' : city.value, allowAll: true })
  if (value === null) return
  city.value = value || '全部城市'
  saveCommunityCity(city.value)
  s.value === 2 ? loadRecommend() : loadList()
}
const tabs = computed(() => ['全部', '小院活动', '商家活动', ...(communityEnabled.value ? ['用户自发'] : [])])
const SRC = { 小院活动: 'yard', 商家活动: 'merchant', 用户自发: 'user' }
const activeTab = ref('全部')
const setTab = (t) => { activeTab.value = t; loadList() }
const keyword = ref('')
const searchText = computed(() => keyword.value || '想去哪儿，想做什么？')
async function askSearch() {
  const v = await prompt('搜索活动', { value: keyword.value, placeholder: '活动名 / 集合地点' })
  if (v !== null) keyword.value = v
}
const list = ref({ groups: [], subscribed: false })
const listLoaded = ref(false)
const listError = ref('')
const remindBusy = ref(false)
let listSequence = 0, remindRevision = 0
const remind = computed(() => !!list.value.subscribed)
async function loadList() {
  const sequence = ++listSequence, revision = remindRevision
  listLoaded.value = false
  listError.value = ''
  list.value = { groups: [], subscribed: false }
  try {
    const { data } = await apiActivities({ source: SRC[activeTab.value], city: city.value })
    if (sequence !== listSequence) return
    list.value = { groups: data?.groups || [], subscribed: revision === remindRevision ? !!data?.subscribed : remind.value }
    listLoaded.value = true
  } catch (e) {
    if (sequence === listSequence) listError.value = e?.message || '活动加载失败'
  }
}
async function toggleRemind() {
  if (!listLoaded.value || remindBusy.value) return
  // 新活动提醒按城市订阅：选的是「全部城市」时先让用户挑一个具体城市（关闭提醒不受影响）
  if (city.value === '全部城市' && !remind.value) return toast('先在左上角选一个城市，再开启新活动提醒')
  const targetCity = city.value, owner = experience.account?.id, enabled = !remind.value
  const current = () => city.value === targetCity && experience.account?.id === owner
  remindBusy.value = true
  try {
    const res = (await gated(() => {
      if (!current()) throw Object.assign(new Error(), {silent:true})
      return apiActivitySubscribe(targetCity, enabled)
    })).data
    if (!current()) return
    remindRevision++
    list.value.subscribed = res.subscribed
    toast(res.message)
  } catch (e) {
    if (current()) fail(e, '设置失败')
  } finally { remindBusy.value = false }
}
const kw = (x) => !keyword.value || (x.title + x.place).includes(keyword.value)
// 报名中且设了截止时间才多一行「截止 10月30日 18:00」（没设截止 = 开始前都能报，不占一行；320 宽一行放得下，不写「报名截止」四个字）
const deadlineLine = (x) => (x.phase === 'open' && x.deadlineText && x.deadlineText !== '开始前' ? '截止 ' + x.deadlineText : '')
const activityGroups = computed(() => (list.value.groups || []).map(g => ({
  date: g.date, items: g.items.filter(kw).map(x => ({ ...x, img: img(x.img), avatars: avatarsOf(x.avatars), deadlineLine: deadlineLine(x) }))
})).filter(g => g.items.length))
// 卡片上的收藏心：改列表里那一条（卡片是 computed 出来的副本），连点时等上一次回来
let faving = false
async function toggleFav(item) {
  if (faving) return
  faving = true
  try {
    const res = (await gated(() => apiActivityFavorite(item.activityId))).data
    for (const g of list.value.groups || []) for (const x of g.items || []) if (x.activityId === item.activityId) x.favorited = res.favorited
    if (detail.value.activityId === item.activityId) detail.value.favorited = res.favorited
    toast(res.favorited ? '已收藏，可在「我的活动 → 收藏」查看' : '已取消收藏')
  } catch (e) {
    fail(e, '操作失败')
  } finally {
    faving = false
  }
}

// ---------------- s=2 推荐 ----------------
const openRecommend = () => { recLanding = false; s.value = 2; loadRecommend() }
const leaveRecommend = () => (recLanding ? back() : (s.value = 1))
const rec = ref({ recommended: [], more: [] })
const recLoaded = ref(false)
async function loadRecommend() {
  try {
    rec.value = (await apiActivityRecommend(city.value)).data || rec.value
    recLoaded.value = true
  } catch (e) {
    fail(e, '推荐加载失败')
  }
}
const recommended = computed(() => (rec.value.recommended || []).map(x => ({ ...x, tone: x.reasonTone, time: x.timeText, img: img(x.img), avatars: avatarsOf(x.avatars) })))
const mf = ref({ date: '全部日期', type: '全部类型', sort: '默认排序' })
const filters = computed(() => [mf.value.date, mf.value.type, mf.value.sort])
async function pickFilter(i) {
  const opts = [['全部日期', '今天', '本周末', '一周内'], ['全部类型', '小院活动', '商家活动', ...(communityEnabled.value ? ['用户自发'] : [])], ['默认排序', '报名人数最多', '时间最近']][i]
  const j = await sheet(opts)
  if (j < 0) return
  mf.value[['date', 'type', 'sort'][i]] = opts[j]
}
const inDate = (x) => {
  const d = mf.value.date
  if (d === '全部日期') return true
  const m = String(x.dateText || '').match(/(\d+)月(\d+)日/)
  if (!m) return true
  const now = new Date()
  const t = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]))
  const diff = Math.round((t - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
  if (d === '今天') return diff === 0
  if (d === '一周内') return diff >= 0 && diff <= 7
  return [0, 6].includes(t.getDay()) && diff >= 0 && diff <= 7
}
const moreActivities = computed(() => {
  let rows = (rec.value.more || []).filter(inDate).filter(x => mf.value.type === '全部类型' || x.kind === mf.value.type)
  if (mf.value.sort === '报名人数最多') rows = [...rows].sort((a, b) => b.count - a.count)
  return rows.map(x => ({ ...x, time: x.timeText, img: img(x.img), avatars: avatarsOf(x.avatars) }))
})

// ---------------- s=3 详情 ----------------
const detail = ref({ host: { chips: [] } })
// 活动介绍展开了没有；记着是哪场活动展开的（签到、支付回来重新打开同一场时不收起）
const introOpen = ref(false)
let introFor = null
async function openDetail(id, checkin) {
  if (checkinBusy.value) return
  if (!checkin && pendingCheckin.value?.id !== String(id)) { pendingCheckin.value = null; checkinMessage.value = '' }
  checkinBusy.value = true
  try {
    detail.value = (await apiActivity(id, { channel: channel.value, checkin: experience.account ? checkin || undefined : undefined })).data
    memberActivityId.value=null;memberActivityVouchers.value=[]
    rememberDestination(experience.account?.id, detail.value?.city)
    if (detail.value.memberFree && detail.value.phase === 'open' && !detail.value.full && experience.account) {
      try {
        const { data } = await apiMemberWallet()
        memberActivityVouchers.value = (data.rows || []).filter(x => x.status === 'available' && x.benefitCode === 'activity')
      } catch {}
    }
    // 换了一场活动，介绍回到收起状态
    if (String(detail.value.activityId) !== String(introFor)) { introOpen.value = false; introFor = detail.value.activityId }
    s.value = 3
    if (checkin) {
      checkinMessage.value = detail.value.checkin || '请登录后完成活动签到'
      if (detail.value.checkin) pendingCheckin.value = null
    }
  } catch (e) {
    if (checkin) checkinMessage.value = e.message || '签到未完成，请重试'
    fail(e, '活动不存在或已下线')
  } finally { checkinBusy.value = false }
}
const open = (x) => { fromList = s.value; openDetail(x.activityId) }
const leaveDetail = () => (fromList ? (s.value = fromList) : back())
// 集合地点（10-16 反馈「点集合地点唤不起地图」）：小程序里活动发布时在地图上选过点（meetLat / meetLng）就打开微信地图，可以导航；
// 没选过点、或在网页版（没有地图 key，打开是一张空白图），就把「城市 + 集合地点」复制下来，去地图 App 里搜
let mapOk = true
// #ifdef H5
mapOk = false
// #endif
const meetPoint = (x) => {
  if (!x || x.meetLat == null || x.meetLng == null || String(x.meetLat).trim() === '' || String(x.meetLng).trim() === '') return null
  const latitude = Number(x.meetLat), longitude = Number(x.meetLng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null
  return { latitude, longitude }
}
const placeTag = (x) => (mapOk && meetPoint(x) ? '地图' : '复制')
const placeText = (x) => {
  const place = String((x && x.place) || '').trim()
  const c = String((x && x.city) || '').trim()
  return c && !place.includes(c) ? `${c} ${place}` : place
}
async function copyPlace(x, tip) {
  const text = placeText(x)
  if (!text) return toast('主办方还没填集合地点')
  if (!(await copy(text, tip))) toast('集合地点：' + text)
}
function openPlace(x) {
  const p = mapOk ? meetPoint(x) : null
  if (!p) return copyPlace(x, meetPoint(x) ? '集合地点已复制，可在地图 App 里搜索' : '主办方没标地图位置，集合地点已复制')
  uni.openLocation({ ...p, name: String(x.place || x.title || '集合地点'), address: placeText(x), scale: 16,
    fail: (error) => { if (!/cancel/i.test(String(error?.errMsg || ''))) copyPlace(x, '地图暂时打不开，集合地点已复制') }
  })
}
const hostLogo = computed(() => (detail.value.host && detail.value.host.logo ? absUrl(detail.value.host.logo) : '/static/media/activity-host-logo.jpg'))
const hostMeta = computed(() => `组织活动 ${(detail.value.host || {}).count || 0} 场`)
const showHost = () => {
  const host = detail.value.host || {}
  if (Number(host.userId) > 0) return go(R.userProfile + '?uid=' + host.userId)
  if (Number(host.storeId) > 0) return go(R.myFollows + '?storeId=' + host.storeId)
  toast('主办方主页暂不可用')
}
// 活动介绍先显示 3 行：估算超过 3 行或有安全说明时才给「展开」，展开后在页面里显示全文（保留换行）和安全说明。
// 按每行约 24 个字估算（窄屏一行也有 24 字左右），宁可多给一个「展开」，不能让第 4 行起的内容看不到
const introFolds = computed(() => {
  if (detail.value.safetyNote) return true
  const rows = String(detail.value.intro || '').split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 24)), 0)
  return rows > 3
})
// 费用三选一（2026-11-03 主人：免费 / 收费 / AA制）：服务端给 feeKind、priceText、feeModeLabel、aaFen（AA 的预估人均，分）。
// 收费：「¥88 /人 · 在线支付 | 到场支付 | 到场付给发起人」；AA：「约¥80 /人 · 现场AA」或「AA制 · 现场平摊，报名不用付钱」；免费：「免费」
const aaYuan = (d) => (Number(d.aaFen) > 0 ? String(Number(d.aaFen) / 100) : '')
const priceMain = computed(() => {
  const d = detail.value
  return d.feeKind === 'aa' ? (aaYuan(d) ? '约¥' + aaYuan(d) : 'AA制') : d.priceText
})
const priceSub = computed(() => {
  const d = detail.value
  if (d.feeKind === 'aa') return aaYuan(d) ? '/人 · 现场AA' : ' · 现场平摊，报名不用付钱'
  return d.feeFen ? '/人 · ' + d.feeModeLabel : ''
})
// 免责说明（2026-11-03 主人）：用户发起、到场付给发起人的收费活动，和所有 AA 活动，价格下面、报名确认框里各说一句平台不经手
const feeNote = computed(() => feeNoteOf(detail.value))
const feeIncludes = computed(() => detail.value.feeIncludes || (detail.value.feeKind === 'aa' ? '现场由参加的人平摊，以主办方说明为准'
  : (detail.value.feeFen ? '以主办方现场说明为准' : '免费活动')))
const signupLabel = computed(() => {
  const d = detail.value
  if (d.mySignupId) return d.myStatus === 'pending_payment' ? '去支付' : '查看报名'
  if (d.isOwner) return '管理活动'
  if (d.phase !== 'open') return d.phaseLabel || '暂不可报名'
  // AA制报名不付钱，按钮上说清楚「现场AA」（2026-11-03 主人）
  return d.full ? '候补报名' : (d.feeKind === 'aa' ? '报名（现场AA）' : '立即报名')
})
async function favorite() {
  try {
    const res = (await gated(() => apiActivityFavorite(detail.value.activityId))).data
    detail.value.favorited = res.favorited
    // 返回列表时卡片上的心跟着变
    for (const g of list.value.groups || []) for (const x of g.items || []) if (x.activityId === detail.value.activityId) x.favorited = res.favorited
    toast(res.favorited ? '已收藏，可在「我的活动 → 收藏」查看' : '已取消收藏')
  } catch (e) {
    fail(e, '操作失败')
  }
}
// 报名请求还没回来时再点「立即报名」，会再确认一次、再报一次名（再拉一次支付）
let signing = false
const memberActivityVouchers=ref([]),memberActivityId=ref(null)
// 门店活动由员工在工作台管理：之前一律跳「我的活动」，提示「门店活动请在员工工作台管理」后停在列表上
const manageActivity = (d) => go(d.source === 'user' ? R.activityMine + '?id=' + d.activityId : R.staffActivities + '?s=4&id=' + d.activityId)
async function signup() {
  const d = detail.value
  if (signing) return
  // 按钮文字先看「我有没有报名」（signupLabel）：门店员工自己也报了名时写的是「查看报名」，之前点了却进员工工作台、看不到自己的凭证。
  // 现在报了名的先问一句去哪儿，没报名的主办方照旧去管理活动
  if (d.mySignupId) {
    if (d.isOwner) {
      const i = await sheet([d.myStatus === 'pending_payment' ? '去支付我的报名' : '查看我的报名', '管理活动'])
      if (i < 0) return
      if (i === 1) return manageActivity(d)
    }
    if (d.myStatus === 'pending_payment') return payTicket(d.mySignupId)
    return openTicket(d.mySignupId)
  }
  if (d.isOwner) return manageActivity(d)
  if (d.phase !== 'open') return toast(d.phaseLabel || '暂不可报名')
  const tip = memberActivityId.value ? '使用1次会员免费活动权益报名，无需支付；签到后核销。' : d.full ? '名额已满，将为你排候补，有人退出时按顺序递补。'
    : (d.feeKind === 'aa' ? `AA制：费用现场由参加的人平摊${aaYuan(d) ? '，预估约 ¥' + aaYuan(d) + '/人' : ''}，报名不用付钱。`
      : (d.feeFen > 0 ? `报名费 ${d.priceText}/人（${d.feeModeLabel}${d.feeMode === 'online' || d.source === 'user' ? '' : '，平台不代收'}）。` : '免费活动。'))
  const note = feeNote.value ? '\n' + feeNote.value : ''
  signing = true
  try {
    if (!(await confirm(d.full ? '候补报名' : '确认报名', `${d.title}\n${d.timeText}\n集合：${d.place}\n${tip}${note}`))) return
    const res = (await gated(() => apiActivitySignup(d.activityId, channel.value,memberActivityId.value))).data
    toast(res.message)
    if (res.payNo) {
      // 之前支付拉起失败会落到下面的「报名失败」提示、停在详情页，其实名额已保留成待支付；现在提示支付没完成，并照常打开报名凭证（可在那里继续去支付）
      try { await payFlow(res.payNo) } catch (e) { fail(e, '支付未完成，可在报名凭证里继续支付') }
    }
    await openTicket(res.signupId)
  } catch (e) {
    fail(e, '报名失败')
  } finally {
    signing = false
  }
}

// ---------------- s=4 凭证 ----------------
const ticket = ref({})
let ticketRead = 0
let ticketActionBusy = false
async function openTicket(signupId) {
  const read = ++ticketRead
  try {
    const { data } = await apiSignup(signupId)
    if (read !== ticketRead) return
    ticket.value = data
    s.value = 4
  } catch (e) {
    if (read === ticketRead) fail(e, '报名记录不存在')
  }
}
async function payTicket(signupId) {
  if (ticketActionBusy) return
  ticketActionBusy = true
  try {
    const { data } = await apiSignup(signupId)
    if (data.payNo) await payFlow(data.payNo)
  } catch (e) {
    fail(e, '支付未完成，请稍后重试')
  } finally {
    try { await openTicket(signupId) } finally { ticketActionBusy = false }
  }
}
const TITLES = { confirmed: ['报名成功', '期待与你一起出发！'], waitlist: ['候补中', '有人退出时按顺序递补，递补成功会通知你'], pending_payment: ['待支付', '名额已为你保留，请在截止前完成支付'],
  refund_pending: ['退款审核中', '审核通过后原路退回'], refunding: ['退款中', '预计 1–5 个工作日到账'], refunded: ['已退款', '报名费已原路退回'],
  cancelled: ['已取消', '你已取消本次报名'], closed: ['已关闭', '超时未支付，报名已关闭'] }
const ticketTitle = computed(() => (TITLES[ticket.value.status] || ['报名详情'])[0])
// 还有效的报名（报名成功 / 候补 / 待支付）才显示集合提醒、活动群：取消、退款审核中、已退款的之前照样盖「报名成功」章、能改提醒（服务端只给报名成功的发）
const ticketBlank = computed(() => !ticket.value.title) // 纯展示：没取到报名数据时收起票据头部（空标签、空时间、「集合：」和复制）
const ticketLive = computed(() => ['confirmed', 'waitlist', 'pending_payment'].includes(ticket.value.status))
const ticketSub = computed(() => (TITLES[ticket.value.status] || ['', ''])[1] + (ticket.value.status === 'waitlist' && ticket.value.waitlistNo ? `（第 ${ticket.value.waitlistNo} 位）` : ''))
// 申请退款时服务端就记下了应退金额：之前退款还在审核 / 退款中就显示「已退」，用户以为钱已经回来了
const REFUND_WORD = { refund_pending: '退款审核中', refunding: '退款中', refunded: '已退' }
const refundNote = (t) => (t.refundFen && REFUND_WORD[t.status] ? `（${REFUND_WORD[t.status]} ¥${(t.refundFen / 100).toFixed(2)}）` : '')
const ticketRows = computed(() => {
  const t = ticket.value
  return [
    { label: '报名人', value: t.name || '—' },
    { label: '手机号', value: t.phoneMasked || '未验证' },
    { label: '报名单号', value: t.signupNo || '—' },
    { label: '报名时间', value: t.createTimeText || '—' },
    ...(t.checkinCode ? [{ label: '签到码', value: t.checkinCode + (t.checkedIn ? '（已签到）' : '') }] : []),
    ...(t.feeFen ? [{ label: '报名费', value: '¥' + (t.feeFen / 100).toFixed(2) + refundNote(t) }] : [])
  ]
})
// 2026-11-03 主人：签到二维码兜底 —— 报名凭证页「现场签到」。扫码认微信小程序码（path 里带 scene）和服务端画的普通二维码（文字里带同样的 c_… 串），
// 都走原来的扫码签到接口；扫不了就输入领队给的 6 位活动签到码（服务端限次数）。签到时间、只认已确认报名的规则都在服务端
const CHECKIN_SCENE = /c_[0-9a-z]{1,13}_[0-9a-f]{12}(?:[0-9a-f]{4})?(?![0-9a-z])/
async function selfCheckin() {
  const t = ticket.value
  const i = await sheet(['扫码签到', '输入活动签到码'])
  if (i < 0) return
  try {
    let msg
    if (i === 0) {
      const r = await new Promise((resolve, reject) => uni.scanCode({ scanType: ['qrCode', 'wxCode'], success: resolve, fail: reject }))
      const hit = CHECKIN_SCENE.exec(`${r.path || ''} ${r.result || ''}`)
      if (!hit) return alert('现场签到', '这不是袋鼠全球青年的活动签到码，请扫领队出示的签到二维码。')
      const q = parseActivityScene(hit[0])
      if (q.id !== String(t.activityId)) return alert('现场签到', '这是另一场活动的签到码，请核对后再扫。')
      msg = (await apiActivity(q.id, { channel: 'official', checkin: q.checkin })).data.checkin
    } else {
      const code = await prompt('输入活动签到码', { placeholder: '领队现场给的 6 位数字' })
      if (!code) return
      msg = (await apiActivityCheckinPin(t.activityId, String(code).trim())).msg
    }
    await alert('现场签到', msg || '签到未完成，请重试')
    openTicket(t.signupId)
  } catch (e) {
    if (/cancel/i.test(String(e?.errMsg || ''))) return
    fail(e, '签到未完成，请重试')
  }
}
async function changeRemind() {
  const opts = [['1d20', '活动前1天 20:00 提醒我'], ['2h', '活动前 2 小时提醒我'], ['off', '关闭集合提醒']]
  const i = await sheet(opts.map(x => x[1]))
  if (i < 0) return
  try {
    toast((await apiSignupRemind(ticket.value.signupId, opts[i][0])).msg)
    openTicket(ticket.value.signupId)
  } catch (e) {
    fail(e, '设置失败')
  }
}
async function joinGroup() {
  if (!ticket.value.convId) return toast(ticket.value.status === 'confirmed' ? '活动群还在创建中，稍后再试' : '报名确认后才能进活动群')
  try {
    const res = (await apiChatOpen({ type: 'activity', activityId: ticket.value.activityId })).data
    go(R.chat + '?convId=' + res.convId)
  } catch (e) {
    fail(e, '暂时无法进群')
  }
}
async function cancelTicket() {
  const t = ticket.value
  if (ticketActionBusy) return
  if (!t.canCancel) return toast('当前状态不能取消')
  ticketActionBusy = true
  try {
    const tip = t.feeFen && t.status === 'confirmed' ? (t.refundable ? '取消后报名费将在人工审核后原路退回。' : '活动开始前 24 小时内取消，报名费不退。') : ''
    if (!(await confirm('取消报名', `确认取消「${t.title}」的报名？${tip}`))) return
    const reason = await prompt('取消原因（选填）', { placeholder: '例如：行程变化' })
    if (reason === null) return
    toast((await apiSignupCancel(t.signupId, reason)).msg)
    await openTicket(t.signupId)
  } catch (e) {
    fail(e, '取消失败')
  } finally { ticketActionBusy = false }
}
const successActions = computed(() => [
  ticket.value.status === 'confirmed' && ticket.value.convId && groupChatEnabled.value ? { title: '加入活动群', sub: '与同伴交流、获取最新通知', icon: 'users-round', click: joinGroup }
    : { title: '查看活动详情', sub: '查看时间、地点和活动安排', icon: 'tent', click: () => openDetail(ticket.value.activityId) },
  { title: '查看我的行程', sub: '报名后自动出现在行程里', icon: 'calendar-days', click: () => go(R.trip) },
  ...(communityEnabled.value ? [{ title: '分享到微信等软件', sub: '微信转发 · 链接 · 活动海报', icon: 'share-2', click: openShare }] : []),
  ...(ticket.value.status === 'pending_payment' ? [{ title: '去支付', sub: '完成支付后报名生效', icon: 'wallet', click: () => payTicket(ticket.value.signupId) }] : []),
  ticket.value.canCancel ? { title: '取消报名', sub: ticket.value.status === 'pending_payment' ? '释放为你保留的名额' : '按活动须知处理退款', icon: 'circle-x', click: cancelTicket } : { title: '返回首页', sub: '发现更多活动', icon: 'house', click: () => go(R.home) }
])

const shareOpen = ref(false)
const posterBusy = ref(false)
const shareData = computed(() => activitySharePayload(s.value === 4 ? ticket.value : detail.value, API_BASE))
const systemShareAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
function openShare() {
  if (!communityEnabled.value) return
  if (!shareData.value.activityId) return toast('活动信息尚未加载，请稍后重试')
  shareOpen.value = true
}
async function copyActivityLink() {
  if (!communityEnabled.value) return
  try { if (!(await copy(shareData.value.url, '活动链接已复制，可粘贴到微信等软件'))) toast('复制失败，请重试') } catch (e) { fail(e, '复制失败，请重试') }
}
async function shareToSystem() {
  if (!communityEnabled.value) return
  // #ifdef H5
  try { await navigator.share({ title: shareData.value.title, url: shareData.value.url }) }
  catch (e) { if (e?.name !== 'AbortError') fail(e, '分享未完成，可复制活动链接') }
  // #endif
}
async function saveActivityPoster() {
  if (!communityEnabled.value) return
  if (posterBusy.value) return
  posterBusy.value = true
  try {
    const data = shareData.value
    await savePosterImage({ kind: 'activity', title: data.title, summary: data.summary, cover: img(data.imageUrl) })
    toast('海报已保存，可发送到微信或其他软件')
  } catch (e) { fail(e, '海报保存失败，请重试') }
  finally { posterBusy.value = false }
}
const pageShareMessage = () => {
  const data = shareData.value
  return { title: data.title, path: data.path, imageUrl: img(data.imageUrl) }
}


onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
let hiddenWithTicket = false
onHide(() => { hiddenWithTicket = s.value === 4 })
onShow(async () => {
  showPublicShareMenu()
  const signupId = ticket.value.signupId
  if (!hiddenWithTicket) return
  hiddenWithTicket = false
  if (s.value !== 4 || !signupId || ticketActionBusy) return
  const read = ++ticketRead
  try {
    const { data } = await apiSignup(signupId)
    if (read === ticketRead && s.value === 4 && ticket.value.signupId === signupId) ticket.value = data
  } catch (e) {
    if (read === ticketRead && s.value === 4) fail(e, '报名状态刷新失败')
  }
})
</script>

<style scoped lang="scss">
.scan-status { display: flex; flex-direction: column; gap: 10px; padding: 14px; margin: 10px 0; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper2); color: var(--k-ink); font-size: 14px; line-height: 1.6; }
.activity-page { background: var(--k-bg); }
.city-select { margin-left: -4px; display: flex; align-items: center; gap: 5px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.search { margin: 2px 14px 5px; height: 34px; padding-left: 10px; border: 1px solid var(--k-line2); border-radius: 17px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; }
.search__text { flex: 1; color: var(--k-light); font-size: 13px; }
.search__btn { height: 30px; padding: 0 14px; border-radius: 16px; background: var(--k-paper2); display: flex; align-items: center; font-family: var(--k-serif); font-size: 13px; font-weight: 700; }
.activity-tabs { padding: 0 12px; }
.activity-tabs .k-tabs__item { font-size: 14px; }
.list-body { padding: 0 14px 100px; }
.remind-row { height: 42px; border-bottom: 1px solid var(--k-line); display: flex; align-items: center; justify-content: space-between; font-family: var(--k-serif); font-size: 14px; font-weight: 700; }
.switch { width: 43px; height: 25px; padding: 2px; border-radius: 15px; background: #BDB8AF; box-sizing: border-box; }
.switch.on { background: var(--k-green); }
.switch__knob { width: 21px; height: 21px; border-radius: 50%; background: #fff; transition: transform .15s; }
.switch.on .switch__knob { transform: translateX(18px); }
.date-title { display: block; margin: 10px 0 7px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.activity-item { min-height: 104px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--k-line); display: flex; gap: 10px; }
.activity-item__img { width: 158px; height: 103px; border-radius: 8px; flex: 0 0 auto; }
.activity-item__photo { position: relative; width: 158px; height: 103px; flex: 0 0 auto; }
/* 收藏心：封面右上角的白底小圆，点击区 32px */
.fav-dot { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,.9); box-shadow: 0 1px 4px rgba(58,50,43,.18); display: flex; align-items: center; justify-content: center; }
.meta--deadline { color: var(--k-ink2); }
.detail-line--tap { min-height: 26px; }
.detail-line__text { min-width: 0; flex: 1; }
.place-tag { flex: 0 0 auto; padding: 1px 7px; border: 1px solid var(--k-line2); border-radius: 10px; color: var(--k-red); font-size: 11px; }
.activity-item__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.activity-item__title, .rec-title, .more-title { font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.meta { min-width: 0; display: flex; align-items: center; gap: 5px; color: var(--k-muted); font-size: 11px; }
.meta text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-status { display: flex; align-items: center; justify-content: space-between; }
.kind { padding: 2px 6px; border-radius: 4px; font-size: 11px; }
.kind--yard { color: var(--k-green); background: var(--k-green-soft); }
.kind--business { color: #9A672E; background: var(--k-ochre-soft); }
.kind--user { color: #AD6A1D; background: #F5E7CE; }
.quota { padding: 2px 7px; border: 1px solid #AEC7B5; border-radius: 5px; color: var(--k-green); font-size: 11px; }
.quota.few { color: var(--k-alert); border-color: rgba(192,68,55,.45); } /* 名额紧张用提醒红 */
.quota.full { color: var(--k-red-deep); background: var(--k-paper2); border-color: var(--k-line2); } /* 已满可候补：和首页一样奶油底深棕字，不用提醒红 */
.signup { margin-top: auto; display: flex; align-items: center; gap: 7px; color: var(--k-muted); font-size: 11px; }
.avatar-stack { display: flex; }
.small-avatar { width: 20px; height: 20px; border: 1.5px solid var(--k-paper); border-radius: 50%; margin-left: -5px; }
.small-avatar:first-child { margin-left: 0; }
.ai-body { padding: 10px 14px 100px; }
.ai-banner { height: 64px; padding: 8px 12px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; }
.ai-banner__title { display: block; font-family: var(--k-serif); font-size: 18px; font-weight: 700; }
.ai-banner__sub { display: block; margin-top: 5px; color: var(--k-muted); font-size: 11px; }
.ai-banner__img { width: 114px; height: 54px; }
.ai-section-title, .more-head > text { display: block; margin: 11px 0 7px; font-family: var(--k-serif); font-size: 17px; font-weight: 700; }
.rec-card { min-height: 104px; height: auto; padding: 7px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; gap: 10px; box-sizing: border-box; }
.rec-card + .rec-card { margin-top: 7px; }
.rec-photo { position: relative; width: 112px; height: 90px; flex: 0 0 auto; }
.rec-img { width: 112px; height: 90px; border-radius: 7px; }
.reason-chip { position: absolute; top: 3px; left: 3px; padding: 2px 6px; border-radius: 4px; color: #fff; font-size: 11px; }
.reason-chip--green { background: var(--k-green); }.reason-chip--orange { background: #B7762D; }.reason-chip--blue { background: var(--k-indigo); }
.rec-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
.rec-title { display: block; line-height:1.5; white-space:normal; overflow-wrap:anywhere; }
.empty-tip { padding: 28px 12px; text-align: center; color: var(--k-muted); font-size: 13px; }
.rec-reason { display:block; color: var(--k-muted); font-size:12px; line-height:1.5; white-space:normal; overflow-wrap:anywhere; }
.rec-quota { margin-left: auto; }
.more-head { display: flex; align-items: center; justify-content: space-between; }
.filters { display: flex; gap: 6px; }
.filter { height: 25px; padding: 0 8px; border: 1px solid var(--k-line2); border-radius: 7px; background: var(--k-paper); display: flex; align-items: center; gap: 4px; font-size: 11px; }
.more-item { min-height: 88px; padding: 7px 0; border-bottom: 1px solid var(--k-line); display: flex; gap: 10px; }
.more-img { width: 92px; height: 82px; border-radius: 7px; flex: 0 0 auto; }
.more-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 5px; }
.more-title { font-size: 15px; }
.distance { margin-left: auto; }
.detail-body { padding-bottom: 112px; padding-bottom: calc(100px + constant(safe-area-inset-bottom)); padding-bottom: calc(100px + env(safe-area-inset-bottom)); }
/* #ifdef H5 */
.detail-body { padding-bottom: 134px; } /* H5 预览里底部安全区固定画成 34px */
/* #endif */
.detail-hero-box { position: relative; width: 100%; height: 75vw; max-height: 360px; overflow: hidden; background: var(--k-paper); }
.detail-hero-bg { position: absolute; left: -20px; top: -20px; width: calc(100% + 40px); height: calc(100% + 40px); filter: blur(16px); opacity: .55; }
.detail-hero { position: relative; display: block; width: 100%; height: 100%; }
/* 下面几块之前是定高：标题、集合地点、介绍、费用说明一长就压到下一块上，改成最小高度 */
.detail-summary { min-height: 96px; padding: 11px 14px; border-bottom: 1px solid var(--k-line); box-sizing: border-box; }
/* 标签和标题第一行居中对齐（主人反馈：之前标签贴在顶上，比字高一截）：标题行高固定 30px，标签高 20px，往下错 5px；标题折行时标签仍跟第一行对齐 */
.detail-title-row { display: flex; align-items: flex-start; gap: 10px; }
.detail-kind { flex: 0 0 auto; margin-top: 5px; height: 20px; line-height: 20px; padding: 0 7px; border-radius: 4px; background: var(--k-green); color: #fff; font-size: 11px; }
.detail-title { min-width: 0; font-family: var(--k-serif); font-size: 22px; line-height: 30px; font-weight: 700; }
.detail-slogan { display: block; margin-top: 7px; color: var(--k-muted); font-size: 12px; }
.price-row { display: flex; align-items: flex-end; justify-content: space-between; }
.price { color: var(--k-red); font-family: var(--k-sans); font-size: 22px; font-weight: 700; }.per { color: var(--k-muted); font-size: 12px; }
.insurance { width: 66px; height: 52px; margin-top: -31px; border: 1px solid #D2B17B; border-radius: 7px; background: var(--k-paper); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: #98672E; font-size: 11px; }
.detail-info { min-height: 70px; padding: 7px 14px; border-bottom: 1px solid var(--k-line); box-sizing: border-box; display: flex; flex-direction: column; gap: 4px; }
.detail-line { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.detail-section { padding: 9px 14px; border-bottom: 1px solid var(--k-line); box-sizing: border-box; }
.detail-section__title { display: block; margin-bottom: 7px; font-family: var(--k-serif); font-size: 16px; font-weight: 700; }
.host-section { min-height: 78px; }
.host { display: flex; align-items: center; gap: 9px; }
.host-logo { width: 35px; height: 35px; border-radius: 50%; }
.host-copy { min-width: 0; flex: 1; }
.host-name-row { display: flex; align-items: center; gap: 6px; }.host-name { font-family: var(--k-serif); font-size: 15px; font-weight: 700; }
.host-chip { padding: 2px 5px; border: 1px solid #D6BD98; border-radius: 4px; color: #95672F; font-size: 11px; }
.host-meta { display: block; margin-top: 4px; color: var(--k-muted); font-size: 11px; }
.intro { min-height: 85px; position: relative; padding-bottom: 40px; }.detail-text { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; color: var(--k-ink2); font-size: 14px; line-height: 1.75; white-space: pre-line; }
/* 展开后整段显示（保留换行、长网址也能折行）；介绍短到不用折叠时不留「展开」按钮的位置 */
.detail-text--open { display: block; overflow: visible; -webkit-line-clamp: unset; overflow-wrap: anywhere; word-break: break-word; }.detail-safety { margin-top: 8px; }.intro--plain { min-height: 0; padding-bottom: 9px; }
.expand { position: absolute; right: 14px; bottom: 0; min-height:44px; display: flex; align-items: center; gap: 3px; color: var(--k-red-deep); font-size: 13px; }
.fee-note { display: block; margin-top: 6px; color: var(--k-ink2); font-size: 12px; line-height: 1.6; }
.fee { min-height: 72px; }.fee-row { display: flex; gap: 12px; color: var(--k-ink2); font-size: 14px; line-height: 1.7; }.fee-label { color: var(--k-ink); min-width: 60px; }
.share-btn { margin: 0; padding: 0; background: transparent; border: 0; border-radius: 0; line-height: inherit; color: inherit; }
.share-btn::after { border: 0; }
.bottom-side { width: 54px; flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 11px; }.bottom-main { min-width: 0; flex: 1; }.signup-label { font-size: 18px; }.signup-price { margin-left: 8px; font-size: 13px; }
.success-body { padding: 0 16px 100px; }
.success-head { height: 150px; padding: 25px 55px 10px; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; }
.success-title { display: block; color: var(--k-green); font-family: var(--k-serif); font-size: 22px; font-weight: 700; }.success-sub { display: block; margin-top: 8px; color: var(--k-muted); font-size: 13px; }
.success-stamp { width: 92px; height: 92px; transform: rotate(-8deg); }
.ticket { padding: 16px; border: 1px solid var(--k-line2); border-radius: 11px; background: var(--k-paper); }
.ticket-top { display: flex; gap: 14px; }.ticket-img { width: 96px; height: 96px; border-radius: 7px; flex: 0 0 auto; }.ticket-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 7px; }.ticket-title { font-family: var(--k-serif); font-size: 18px; font-weight: 700; }
.ticket-dash { margin: 12px -16px 9px; border-top: 1px dashed var(--k-line2); }
.ticket-data { display: flex; flex-direction: column; gap: 7px; }.ticket-data__row { display: flex; font-size: 13px; }.ticket-data__row text:first-child { width: 82px; color: var(--k-muted); }
.reminder { min-height: 64px; box-sizing:border-box; margin-top: 12px; padding: 12px 14px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; gap: 10px; }.reminder-title { display: block; font-family: var(--k-serif); font-size: 14px; font-weight: 700; }.reminder-sub { display: block; margin-top: 2px; color: var(--k-muted); font-size: 11px; }.reminder>view { flex:1; min-width:0; }.reminder-sub{line-height:1.6;overflow-wrap:anywhere}.reminder-link { flex:0 0 auto; white-space:nowrap; margin-left: auto; color: var(--k-green); font-size: 12px; font-weight: 600; }
.action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }.success-action { height: 80px; padding: 12px 14px; border: 1px solid var(--k-line2); border-radius: 9px; background: var(--k-paper); display: flex; align-items: center; gap: 12px; }.action-title { display: block; font-family: var(--k-serif); font-size: 15px; font-weight: 700; }.action-sub { display: block; margin-top: 5px; color: var(--k-muted); font-size: 11px; line-height: 1.4; }
.activity-page { --k-bg:#FAF7F0;--k-paper:#FFFEFC;background:linear-gradient(135deg,#FFF8EE,#F9F8F3);font-family:var(--k-sans); }
.activity-page .detail-summary { position:relative;margin:-14px 12px 0;border:0;border-radius:20px 20px 0 0;padding:18px 16px 14px;background:#FFFEFC;box-shadow:0 -2px 10px rgba(77,55,31,.025); }
.activity-page .detail-title { font-family:var(--k-sans);font-size:23px;line-height:1.4;color:#473325; }
.activity-page .detail-info { margin:0 12px 12px;padding:12px 16px;border:0;border-top:1px solid #F0E7D9;border-radius:0 0 20px 20px;background:#FFFEFC;box-shadow:0 5px 14px rgba(77,55,31,.05);gap:9px; }
.activity-page .detail-line { font-size:14px; }
.activity-page .detail-section { margin:12px;padding:15px 16px;border:0;border-radius:18px;background:#FFFEFC;box-shadow:0 4px 12px rgba(77,55,31,.05); }
.activity-page .detail-section__title { font-family:var(--k-sans);font-size:18px;line-height:1.5;color:#5B402B;margin-bottom:10px; }
.activity-page .host-logo { width:43px;height:43px; }
.activity-page .host-name { font-family:var(--k-sans);font-size:16px; }
.activity-page .host-meta { font-size:12px; }
.activity-page .intro { padding-bottom:42px; }
.activity-page .intro--plain { padding-bottom:15px; }
.activity-page .ticket { border:1px solid #E5D4B7;border-radius:20px;box-shadow:0 6px 16px rgba(77,55,31,.07);padding:18px;background:#FFFCF6; }
.activity-page .ticket-img { border-radius:13px; }
.activity-page .ticket-title,.activity-page .success-title { font-family:var(--k-sans); }
.activity-page .reminder,.activity-page .success-action { border-color:#E9DCCA;border-radius:15px;box-shadow:0 3px 9px rgba(77,55,31,.035); }
.activity-page .success-head { padding:20px 22px 12px;height:134px;gap:12px; }
.activity-page .success-head>view { min-width:0;flex:1; }
.activity-page .success-stamp { flex:0 0 auto;width:78px;height:78px; }
.activity-page .ticket-copy>.detail-kind { align-self:flex-start;border-radius:5px; }
.activity-page .ticket-copy .detail-line { align-items:flex-start;line-height:1.55; }
.activity-page .ticket-copy .detail-line :deep(.k-icon) { flex-shrink:0;margin-top:2px; }
.activity-page .activity-item,.activity-page .rec-card,.activity-page .more-item { border-radius:20px;background:#FFFEFC;box-shadow:0 5px 14px rgba(77,55,31,.055); }
.activity-page .activity-item__photo,.activity-page .rec-photo { border-radius:14px;overflow:hidden; }
@media(max-width:350px) {
 .bottom-main :deep(.k-button) { padding-left:8px;padding-right:8px; }
 .signup-label { font-size:16px;white-space:nowrap; }
 .signup-price { white-space:nowrap; }
 .activity-page .ticket { padding:14px; }
 .activity-page .ticket-top { gap:10px; }
 .activity-page .ticket-img { width:76px;height:90px; }
 .activity-page .ticket-title { font-size:16px; }
 .activity-page .ticket-copy .detail-line { font-size:13px;gap:5px; }
 .activity-page .success-head { padding:16px 15px 12px; }
 .activity-page .success-sub { font-size:12px; }
}
.action-grid{grid-template-columns:1fr!important}.success-action{min-height:76px;height:auto!important;padding:14px!important;box-sizing:border-box}.success-action>view{min-width:0;flex:1}.action-title,.action-sub{white-space:normal!important;overflow-wrap:anywhere}
</style>

<style scoped>
.activity-share-mask { position: fixed; inset: 0; z-index: 1600; background: rgba(43,35,27,.4); display: flex; align-items: flex-end; }
.activity-share-panel { box-sizing: border-box; width: 100%; max-height: 85vh; overflow-y: auto; padding: 20px 20px calc(20px + env(safe-area-inset-bottom)); background: var(--k-bg); border-radius: 22px 22px 0 0; }
.activity-share-head { display: flex; align-items: center; justify-content: space-between; font-size: 19px; font-weight: 700; }
.activity-share-close { padding: 8px; margin: 0; background: transparent; line-height: 1; }
.activity-share-close::after,.activity-share-row::after { border: 0; }
.activity-share-summary { display: block; color: var(--k-muted); font-size: 13px; line-height: 1.6; margin: 6px 0 15px; }
.activity-share-row { margin: 0; width: 100%; display: flex; align-items: center; gap: 14px; padding: 15px 0; border-radius: 0; background: transparent; border-bottom: 1px solid var(--k-line2); text-align: left; font-size: 15px; line-height: 1.5; color: var(--k-ink); }
.activity-share-row > view { flex: 1; min-width: 0; }
.activity-share-note { display: block; color: var(--k-muted); font-size: 12px; margin-top: 3px; }
.activity-share-privacy { display: block; margin-top: 16px; color: var(--k-muted); font-size: 11px; line-height: 1.6; }
.activity-page .success-action { height: auto; min-height: 88px; box-sizing: border-box; padding: 14px 12px; }
.activity-page .success-action > view { min-width: 0; flex: 1; }
.action-grid{grid-template-columns:1fr!important}.success-action{min-height:76px;height:auto!important;padding:14px!important;box-sizing:border-box}.success-action>view{min-width:0;flex:1}.action-title,.action-sub{white-space:normal!important;overflow-wrap:anywhere}
</style>

<style scoped>
.rec-copy .meta{flex-wrap:wrap;min-height:18px;height:auto;line-height:1.5}.rec-copy .meta>text{min-width:0;overflow-wrap:anywhere}.more-head{flex-wrap:wrap;gap:6px}.filters{flex-wrap:wrap}.ai-banner{height:auto;min-height:64px}.ai-banner>view{min-width:0;flex:1}.ai-banner__img{flex-shrink:0;width:86px}
</style>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」（主人按样张第三版拍板，参考小红书）：浅灰底上放白卡，不用阴影、不描边；卡片圆角 12、图片 8、标签 4；
   标题 14–17、正文 13、辅助 11。功能和文字一个不少：选城市、搜索、四个页签、订阅提醒、为你推荐、新活动提醒开关、卡片上的收藏心、
   名额状态、报名人数、详情里的地图导航 / 主办方主页 / 展开介绍 / 收藏 / 报名 / 分享、报名凭证上的提醒和签到都在。
   上面的旧规则保留不动，这里用 .k-page.activity-page 开头的规则盖过去。 */
.k-page.activity-page {
  --k-bg: var(--k-page); --k-paper2: var(--k-fill); /* 本组暖米填充，只在根上定义一次 */
  background: var(--k-page); font-family: var(--k-sans);
  :deep(.k-topbar) { background: var(--k-page); }
  :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
  .scan-status { margin: 8px 12px; padding: 10px 12px; border: 0; border-radius: 12px; background: #FFF8EE; font-size: 13px; }
  /* 空状态：白卡内居中，字 14 / 500 二级墨，上下留白 28 */
  .empty-tip { margin: 8px 0 0; padding: 28px 16px; border-radius: 12px; background: var(--k-paper); color: var(--k-ink2); font-size: 14px; font-weight: 500; line-height: 1.6; }

  /* ---------- 活动列表 ---------- */
  .city-select { position: relative; margin-left: 0; gap: 2px; font-family: var(--k-sans); font-size: 13px; font-weight: 500; color: var(--k-ink2); } .city-select::before { content: ''; position: absolute; left: 0; right: -8px; top: -10px; bottom: -10px; } /* 字小了，上下各多出 10 的透明可点范围 */
  .city-select > :deep(.k-icon:first-child) { display: none; }
  .city-select :deep(.k-icon) { width: 12px !important; height: 12px !important; opacity: .7; }
  .search { height: 36px; margin: 0 12px 4px; padding: 0 4px 0 12px; gap: 6px; border: 0; border-radius: 18px; background: var(--k-paper2); }
  .search > :deep(.k-icon) { width: 16px !important; height: 16px !important; }
  .search__text { color: var(--k-muted); font-size: 13px; }
  .search__btn { height: 28px; padding: 0 13px; border-radius: 14px; background: linear-gradient(135deg, #B5814D, #8E5E33); color: #fff; font-family: var(--k-sans); font-size: 12px; font-weight: 600; }
  .activity-tabs { padding: 0 12px; border-bottom: 0; background: transparent; }
  /* 下划线页签：未选 14 / 400 浅灰，选中 14 / 600 深墨 + 16×3 暖棕短条，行高 40 */
  .activity-tabs .k-tabs__item { height: 40px; padding: 0; display: flex; align-items: center; justify-content: center; box-sizing: border-box; color: var(--k-muted); font-size: 14px; font-weight: 400; }
  .activity-tabs .k-tabs__item.active { color: var(--k-ink); font-weight: 600; }
  .activity-tabs .k-tabs__item.active::after { bottom: 4px; width: 16px; height: 3px; margin-left: -8px; border-radius: 2px; background: var(--k-red); }
  :deep(.subscribe-entry) { padding: 8px 12px 0; }
  :deep(.subscribe-entry button) { min-height: 36px; border: 0; border-radius: 12px; background: var(--k-paper); color: var(--k-ochre-deep); font-size: 12px; }
  .list-body { padding: 8px 12px 100px; }
  /* 「为你推荐」「有新活动提醒我」两行并成一张白卡，中间一道细线 */
  .remind-row { height: 48px; padding: 0 12px; border-bottom: 0; background: var(--k-paper); font-family: var(--k-sans); font-size: 14px; font-weight: 400; color: var(--k-ink); }
  .remind-row:first-child { border-radius: 12px 12px 0 0; }
  .remind-row + .remind-row { border-radius: 0 0 12px 12px; box-shadow: inset 0 .5px 0 var(--k-line); }
  .switch { position: relative; width: 40px; height: 24px; background: #D9D4CC; } .switch::before { content: ''; position: absolute; left: -8px; right: -8px; top: -10px; bottom: -10px; }
  .switch.on { background: var(--k-green); }
  .switch__knob { width: 20px; height: 20px; }
  .switch.on .switch__knob { transform: translateX(16px); }
  .date-title { margin: 14px 2px 8px; font-family: var(--k-sans); font-size: 14px; line-height: 20px; font-weight: 700; }
  /* 活动卡：左边方图（圆角 8、右上角收藏心），右边标题两行 + 时间 / 集合 / 截止 + 两个小标签 + 报名人数 */
  .activity-item { min-height: 0; margin-bottom: 8px; padding: 12px; gap: 10px; border-bottom: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
  .activity-item__photo { width: 104px; height: 104px; border-radius: 8px; overflow: hidden; background: var(--k-paper2); }
  .activity-item__img { width: 104px; height: 104px; border-radius: 0; }
  .fav-dot { width: 28px; height: 28px; background: rgba(255, 255, 255, .94); box-shadow: none; }
  .fav-dot::before { content: ''; position: absolute; inset: -4px; }
  /* .fav-hit 是心外面包的一层（不画样式、不占位置）：按心时挡住按压效果往上传，整张卡不跟着缩 */
  .activity-item__copy { gap: 3px; }
  .activity-item__title, .rec-title, .more-title { font-family: var(--k-sans); font-size: 14px; line-height: 20px; font-weight: 600; }
  .activity-item__title { overflow-wrap: anywhere; } /* 标题不截断：原来就是完整换行显示的，长标题照样全部露出来 */
  .meta { gap: 4px; font-size: 11px; line-height: 16px; }
  .meta :deep(.k-icon) { width: 12px !important; height: 12px !important; }
  .meta--deadline { color: var(--k-muted); }
  .item-status { justify-content: flex-start; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
  .kind { height: 17px; padding: 0 5px; border-radius: 4px; font-size: 11px; font-weight: 500; line-height: 17px; white-space: nowrap; }
  .kind--business, .kind--user { background: var(--k-ochre-soft); color: var(--k-ochre-deep); }
  .quota { height: 17px; padding: 0 5px; border: 0; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; font-weight: 500; line-height: 17px; white-space: nowrap; }
  .quota.few { background: var(--k-alert-soft); color: var(--k-alert); }
  .quota.full { background: var(--k-paper2); color: var(--k-ink2); }
  .signup { gap: 6px; padding-top: 2px; font-size: 11px; line-height: 18px; } .signup .avatar-stack:empty { display: none; } /* 没有头像时去掉空壳，「0人已报名」和上面的标签左边对齐 */
  .small-avatar { width: 18px; height: 18px; }

  /* ---------- 为你推荐 ---------- */
  .ai-body { padding: 8px 12px 100px; }
  .ai-banner { padding: 10px 12px; border: 0; border-radius: 12px; background: var(--k-paper); }
  .ai-banner__title { font-family: var(--k-sans); font-size: 15px; font-weight: 700; }
  .ai-banner__sub { margin-top: 3px; }
  /* 右边的插画是带米黄纸底的 JPG：框按图片比例定（98×44），提亮到纸底变白，和白卡融在一起，不再像贴了一块方纸片 */
  .ai-banner__img { width: 98px; height: 44px; border-radius: 8px; filter: brightness(1.1) contrast(1.08); }
  .ai-section-title, .more-head > text { margin: 16px 2px 8px; font-family: var(--k-sans); font-size: 16px; line-height: 22px; font-weight: 700; color: var(--k-ink); }
  .rec-card { min-height: 0; padding: 12px; gap: 10px; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
  .rec-card + .rec-card { margin-top: 8px; }
  .rec-photo { width: 96px; height: 96px; border-radius: 8px; overflow: hidden; background: var(--k-paper2); }
  .rec-img { width: 96px; height: 96px; border-radius: 0; }
  .reason-chip { top: 4px; left: 4px; height: 17px; padding: 0 6px; border-radius: 9px; font-size: 11px; font-weight: 600; line-height: 17px; }
  .reason-chip--green { background: rgba(255, 255, 255, .94); color: var(--k-green); }
  .reason-chip--orange { background: rgba(255, 255, 255, .94); color: var(--k-ochre-deep); }
  .reason-chip--blue { background: rgba(255, 255, 255, .94); color: var(--k-indigo); }
  .rec-copy { gap: 3px; }
  .rec-reason { font-size: 11px; line-height: 16px; }
  .filters { gap: 6px; }
  /* 筛选胶囊：28 高、圆角 14、12 号字 */
  .filter { height: 28px; padding: 0 12px; gap: 2px; border: 0; border-radius: 14px; background: var(--k-paper); color: var(--k-ink2); font-size: 12px; }
  .filter :deep(.k-icon) { width: 12px !important; height: 12px !important; }
  .more-item { min-height: 0; margin-top: 8px; padding: 12px; gap: 10px; border-bottom: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
  .more-img { width: 84px; height: 84px; border-radius: 8px; background: var(--k-paper2); }
  .more-copy { gap: 3px; }

  /* ---------- 活动详情 ---------- */
  .detail-hero-box { background: var(--k-paper2); }
  /* 没有封面：占位图标收到 36 左右、颜色放浅，底色和占位图同色（不再是半屏一个粗大的图标）；确认这场活动没传封面后，封面区高度减半 */
  .detail-hero-box--ph { display: flex; align-items: center; justify-content: center; background: #F3EADF; }
  .detail-hero-box--ph .detail-hero-bg { opacity: 0; }
  .detail-hero-box--ph .detail-hero { width: 136px; height: 102px; opacity: .7; }
  .detail-hero-box--short { height: 37.5vw; max-height: 180px; }
  .detail-summary { min-height: 0; margin: -12px 12px 0; padding: 14px 12px 12px; border: 0; border-radius: 12px 12px 0 0; background: var(--k-paper); box-shadow: none; }
  .detail-title-row { gap: 6px; }
  .detail-kind { height: 17px; margin-top: 4px; padding: 0 5px; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; font-weight: 500; line-height: 17px; }
  .detail-title { font-family: var(--k-sans); font-size: 17px; line-height: 24px; font-weight: 700; color: var(--k-ink); }
  .detail-slogan { margin-top: 4px; font-size: 12px; line-height: 17px; }
  .price-row { align-items: center; margin-top: 6px; }
  /* 价格：18 / 700 暖棕、等宽数字；单位 11 浅灰 */
  .price { color: var(--k-red); font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .per { font-size: 11px; color: var(--k-muted); }
  /* 保险小标签：高 17、圆角 4、10 / 500 */
  .insurance { flex-direction: row; width: auto; height: 17px; margin-top: 0; padding: 0 5px; gap: 2px; border: 0; border-radius: 4px; background: var(--k-green-soft); color: var(--k-green); font-size: 11px; font-weight: 500; line-height: 17px; }
  .fee-note { margin-top: 6px; color: var(--k-muted); font-size: 11px; line-height: 17px; }
  .detail-info { min-height: 0; margin: 0 12px; padding: 10px 12px 12px; gap: 7px; border: 0; border-radius: 0 0 12px 12px; background: var(--k-paper); box-shadow: inset 0 .5px 0 var(--k-line); }
  .detail-line { gap: 6px; font-size: 13px; line-height: 19px; }
  .detail-line :deep(.k-icon) { width: 14px !important; height: 14px !important; }
  .place-tag { padding: 0 6px; border: 0; border-radius: 4px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 11px; line-height: 17px; }
  .detail-section { margin: 8px 12px 0; padding: 12px; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
  .detail-section__title { margin-bottom: 8px; font-family: var(--k-sans); font-size: 16px; line-height: 22px; font-weight: 700; color: var(--k-ink); }
  .host-section { min-height: 0; }
  .host { gap: 8px; }
  .host-logo { width: 36px; height: 36px; }
  .host-name { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
  .host-chip { padding: 0 5px; border: 0; border-radius: 4px; background: var(--k-ochre-soft); color: var(--k-ochre-deep); font-size: 11px; line-height: 17px; }
  .host-meta { margin-top: 2px; font-size: 11px; }
  .host :deep(.k-button) { border-radius: 13px; }
  .intro { min-height: 0; padding-bottom: 40px; }
  .intro--plain { padding-bottom: 12px; }
  .detail-text { font-size: 13px; line-height: 1.75; }
  .expand { right: 12px; font-size: 12px; }
  .fee { min-height: 0; }
  .fee-row { gap: 10px; font-size: 13px; line-height: 1.7; }
  .fee-label { min-width: 56px; color: var(--k-muted); }
  /* 底部操作条：收藏 / 分享图标 20、字 10；报名是 44 高的暖棕渐变胶囊 */
  :deep(.k-bottom) { border-top: 0; background: var(--k-paper); box-shadow: 0 -.5px 0 rgba(58, 50, 43, .1); }
  :deep(.k-bottom__inner) { padding: 8px 12px !important; }
  .bottom-side { width: 44px; min-height: 42px; justify-content: center; gap: 2px; color: var(--k-ink2); font-size: 11px; }
  .bottom-side :deep(.k-icon) { width: 20px !important; height: 20px !important; }
  .bottom-main :deep(.k-button) { height: 44px; border-radius: 22px; box-shadow: none; }
  /* 报不了名（已结束 / 已截止 / 暂不可报名）时：原来的暖棕渐变整体淡到 .45（全站「不可点按钮」同一个样子）；照样能点，点了还是提示原因 */
  .bottom-main--off :deep(.k-button) { opacity: .45; }
  .signup-label { font-size: 15px; font-weight: 600; }
  .signup-price { margin-left: 6px; font-size: 12px; font-weight: 400; }

  /* ---------- 报名凭证 ---------- */
  .success-body { padding: 0 12px 100px; }
  .success-head { height: auto; min-height: 0; padding: 14px 4px 12px; gap: 12px; }
  .success-title { color: var(--k-ink); font-family: var(--k-sans); font-size: 18px; line-height: 25px; } /* 这行也写「已取消 / 待支付 / 已关闭」，统一深色字，不再一律绿色 */
  .success-sub { margin-top: 4px; font-size: 12px; line-height: 18px; }
  .success-stamp { width: 64px; height: 64px; }
  .ticket { padding: 12px; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
  .ticket-top { gap: 10px; }
  .ticket-img { width: 80px; height: 80px; border-radius: 8px; background: var(--k-paper2); }
  .ticket-copy { gap: 4px; }
  .ticket-copy > .detail-kind { margin-top: 0; border-radius: 4px; }
  .ticket-title { font-family: var(--k-sans); font-size: 15px; line-height: 21px; font-weight: 700; }
  .ticket-copy .detail-line { gap: 5px; font-size: 12px; line-height: 18px; }
  .ticket-dash { margin: 12px -12px 10px; border-top-color: var(--k-line); }
  .ticket-data { gap: 6px; }
  .ticket-data__row { font-size: 13px; line-height: 19px; }
  .ticket-data__row text:first-child { width: 76px; }
  .reminder { min-height: 56px; margin-top: 8px; padding: 10px 12px; border: 0; border-radius: 12px; background: var(--k-paper); box-shadow: none; }
  .reminder-title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
  .reminder-link { color: var(--k-red-deep); font-weight: 500; }
  /* 报名后的几个操作并成一张白卡里的列表行，行间发丝线（最后一行不画） */
  .action-grid { gap: 0; margin-top: 8px; border-radius: 12px; background: var(--k-paper); overflow: hidden; }
  .success-action { position: relative; min-height: 56px; padding: 10px 12px !important; gap: 10px; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .success-action + .success-action::before { content: ""; position: absolute; top: 0; left: 12px; right: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; pointer-events: none; } /* 发丝线左边缩进 12，和列表行一个样子 */
  .action-title { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
  .action-sub { margin-top: 2px; font-size: 11px; }

  /* 会员免费权益：浅赭黄小卡 + 浅棕底小按钮（盖过模板里的内联样式和微信默认灰按钮）。
     按钮用块级 flex + 宽度跟着字走：不管选没选、屏幕宽窄，都固定在说明文字下一行、靠左，点一下不会跳行 */
  .member-free { margin: 8px 12px 0 !important; padding: 12px !important; border-radius: 12px !important; background: var(--k-ochre-soft) !important; color: var(--k-ink); font-size: 13px; line-height: 1.6; }
  .member-free__btn { display: flex; align-items: center; width: fit-content; max-width: 100%; height: 28px; line-height: 28px; margin: 8px 0 0 !important; padding: 0 12px; border: 0; border-radius: 14px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 12px !important; font-weight: 500; }
  .member-free__btn::after { border: 0; }

  /* ---------- 分享面板 ---------- */
  .activity-share-panel { padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); border-radius: 16px 16px 0 0; background: var(--k-paper); }
  .activity-share-head { font-size: 16px; font-weight: 700; }
  .activity-share-summary { margin: 4px 0 8px; font-size: 12px; }
  .activity-share-row { gap: 12px; padding: 12px 0; border-bottom-color: var(--k-line); font-size: 14px; }
  .activity-share-row > :deep(.k-icon) { width: 20px !important; height: 20px !important; }
  .activity-share-row > :deep(.k-icon:last-child) { width: 14px !important; height: 14px !important; opacity: .6; }
  .activity-share-note { margin-top: 1px; font-size: 11px; }

  @media (max-width: 359px) {
    .activity-item__photo, .activity-item__img { width: 88px; height: 88px; }
    .rec-photo, .rec-img { width: 84px; height: 84px; }
    .more-img { width: 76px; height: 76px; }
    .ticket-img { width: 72px; height: 72px; }
    .success-head { padding: 14px 4px 10px; }
  }
}
</style>

<style scoped lang="scss">
/* ==========================================================================
   11-18 第三轮精修：搜索钮退成浅棕小胶囊；「订阅活动提醒」并进下面的列表卡当第一行；空状态补图标；报名详情顶部收紧、虚线换发丝线。
   ========================================================================== */
.k-page.activity-page {
  .search__btn { height: 28px; padding: 0 12px; border-radius: 14px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
  /* 订阅提醒 + 为你推荐 + 有新活动提醒我：同一张白卡的三行，每行 48 高、左对齐、行间发丝线 */
  :deep(.subscribe-entry) { padding: 8px 12px 0; }
  :deep(.subscribe-entry button) { justify-content: flex-start; gap: 8px; height: 48px; min-height: 48px; margin: 0; padding: 0 12px; border-radius: 12px 12px 0 0; background: var(--k-paper); color: var(--k-ink); font-size: 14px; line-height: 48px; }
  :deep(.subscribe-entry button text) { flex: 1; text-align: left; }
  .list-body { padding-top: 0; }
  .remind-row:first-child { border-radius: 0; box-shadow: inset 0 .5px 0 var(--k-line); }
  .date-title { margin: 20px 4px 8px; }
  /* 空状态：白卡居中，56 浅棕方块 + 32 图标 + 一句话（14 / 500） */
  .empty-tip { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 8px 0 0; padding: 32px 16px; }
  .empty-ico { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }
  /* 为你推荐：区块标题 16 / 700，「更多活动」标题和右边三颗筛选钮在一条中线上 */
  .ai-section-title { margin: 20px 4px 8px; font-size: 16px; line-height: 22px; font-weight: 700; }
  .more-head { align-items: center; margin: 20px 0 8px; gap: 8px; }
  .more-head > text { margin: 0 0 0 4px; font-size: 16px; line-height: 22px; font-weight: 700; }
  /* 报名详情：顶上的大标题不再和顶栏一样大，收成 18 / 700 一行；票据中间的虚线换成发丝线 */
  .success-head { height: auto; padding: 12px 4px 12px; }
  .success-title { font-size: 18px; line-height: 26px; }
  .success-sub { margin-top: 2px; font-size: 12px; }
  .success-stamp { width: 64px; height: 64px; }
  .ticket-dash { margin: 12px 0 10px; height: 1px; border-top: 0; background: var(--k-line); transform: scaleY(.5); }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 1 轮：提醒卡三行都是 16 图标 + 文字（文字左线一致）；活动卡标题 15/600 最多两行、信息行 12 号配 14 图标、方图 96；
   日期组标题 16/700 对齐卡片外缘；「更多活动」卡和列表卡同一套（96 方图、类型标签在标题下面）；
   报名凭证里「修改提醒」「去签到」挪到说明下面，不再贴着屏幕右边 */
.k-page.activity-page {
  .remind-row { justify-content: flex-start; gap: 8px; }
  .remind-row > text { flex: 1; min-width: 0; }
  .date-title { margin: 20px 0 8px; font-size: 16px; line-height: 22px; font-weight: 700; }
  .activity-item__photo, .activity-item__img { width: 96px; height: 96px; }
  .activity-item__title, .more-title { font-size: 15px; line-height: 21px; font-weight: 600; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .activity-item__copy, .more-copy { gap: 4px; }
  .activity-item__copy .meta, .more-copy .meta { gap: 4px; font-size: 12px; line-height: 18px; }
  .more-item { gap: 12px; }
  .more-img { width: 96px; height: 96px; }
  .more-copy > .k-between { flex-direction: column; align-items: flex-start; gap: 4px; }
  .reminder { flex-wrap: wrap; column-gap: 12px; row-gap: 4px; }
  .reminder > view { flex: 1; min-width: 0; }
  .reminder-link { flex: 0 0 100%; box-sizing: border-box; margin-left: 0; padding-left: 32px; font-size: 13px; line-height: 20px; }
  @media (max-width: 359px) {
    .activity-item__photo, .activity-item__img, .more-img { width: 88px; height: 88px; }
  }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 2 轮：活动卡左图 96×128（3:4，和文字列一样高）；日期组标题 13/600 灰 + 暖棕小圆点；区块标题对齐卡片外沿；
   320 宽「更多活动」时间行可两行；详情类型标签统一浅棕底暖棕字、名额图标换 users、没取到时显示骨架；
   报名凭证：页头 56 方块图标 + 一句话（邮戳插画不再显示），凭证卡两侧半圆缺口做出票根感，现场签到在凭证卡底部、「去签到」44 高主按钮 */
.k-page.activity-page {
  .activity-item { align-items: flex-start; }
  .activity-item__photo, .activity-item__img { width: 96px; height: 128px; }
  .date-title { display: flex; align-items: center; gap: 6px; margin: 20px 0 8px; font-size: 13px; line-height: 20px; font-weight: 600; color: var(--k-muted); }
  .date-title::before { content: ""; flex: 0 0 auto; width: 6px; height: 6px; border-radius: 3px; background: var(--k-red); }
  .ai-section-title { margin-left: 0; margin-right: 0; padding-left: 0; }
  .more-head > text { margin-left: 0; padding-left: 0; }
  .detail-kind { background: var(--k-red-soft); color: var(--k-red-deep); }

  .dskel { margin: 8px 0 0; }
  .dskel__img { height: 200px; border-radius: 12px; background: var(--k-paper2); }
  .dskel__card { margin-top: 8px; padding: 16px 12px; border-radius: 12px; background: var(--k-paper); }
  .dskel__line { height: 14px; margin-top: 10px; border-radius: 7px; background: var(--k-paper2); }
  .dskel__line--title { width: 60%; height: 18px; margin-top: 0; border-radius: 9px; }
  .dskel__line--short { width: 72%; }
  .detail-body--loading > .detail-hero-box, .detail-body--loading > .detail-summary, .detail-body--loading > .detail-info, .detail-body--loading > .detail-section { display: none; }

  .success-head { display: flex; align-items: center; justify-content: flex-start; gap: 12px; padding: 16px 4px 16px; }
  .success-head > view:nth-child(2) { flex: 1; min-width: 0; }
  .success-ico { flex: 0 0 56px; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }
  .success-head--confirmed .success-ico { background: var(--k-green-soft); }
  .success-title { font-size: 13px; line-height: 20px; font-weight: 500; color: var(--k-muted); }
  .success-sub { margin-top: 2px; font-size: 18px; line-height: 26px; font-weight: 700; color: var(--k-ink); }
  .success-stamp { display: none; }
  .ticket { position: relative; }
  .ticket-dash { position: relative; overflow: visible; margin: 12px -12px 10px; height: 0; border-top: 1px dashed var(--k-line2); background: transparent; transform: none; }
  .ticket-dash::before, .ticket-dash::after { content: ""; position: absolute; top: -9px; width: 16px; height: 16px; border-radius: 8px; background: var(--k-bg); }
  .ticket-dash::before { left: -8px; }
  .ticket-dash::after { right: -8px; }
  .reminder > :deep(.k-icon) { align-self: flex-start; margin-top: 2px; }
  .ticket > .reminder { margin: 12px 0 0; padding: 12px 0 0; min-height: 0; border-radius: 0; background: transparent; box-shadow: inset 0 .5px 0 var(--k-line); }
  .ticket > .reminder .reminder-link { display: flex; align-items: center; justify-content: center; height: 44px; margin-top: 8px; padding-left: 0; border-radius: 12px; background: var(--k-red); color: var(--k-paper); font-size: 15px; font-weight: 600; line-height: 44px; }
  @media (max-width: 359px) {
    .activity-item__photo, .activity-item__img { width: 88px; height: 118px; }
    .more-copy .meta > text { white-space: normal; overflow: visible; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  }
}
</style>
<style scoped lang="scss">
/* 11-18 第四轮：活动卡左图固定 96 方图（320 宽 88）；标题在逗号处换行、最多两行；日期组标题 15/600 墨色；
   推荐 / 更多活动的时间行不折行；详情卡间距 12、卡内标题到内容 10；没取到报名数据时收起票据头部；「去签到」退成 40 高浅棕按钮 */
.k-page.activity-page {
  .activity-item__photo, .activity-item__img { width: 96px; height: 96px; }
  .activity-item__title, .more-title, .rec-title { word-break: keep-all; overflow-wrap: anywhere; }
  .date-title { font-size: 15px; line-height: 22px; font-weight: 600; color: var(--k-ink); }
  .rec-copy .meta, .more-copy .meta { flex-wrap: nowrap; }
  .rec-copy .meta > text, .more-copy .meta > text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rec-copy .meta > text:last-child, .more-copy .meta > text:last-child { flex: 0 0 auto; }
  .detail-section { margin-top: 12px; }
  .detail-section__title { display: block; margin-bottom: 10px; }
  .ticket--blank .ticket-top, .ticket--blank .ticket-dash { display: none; }
  .success-action { gap: 12px; }
  .fee-row > text:last-child { word-break: keep-all; overflow-wrap: anywhere; }
  .dskel { margin: 8px 12px 0; }
  .dskel::after { content: ''; display: block; height: 160px; margin-top: 12px; border-radius: 12px; background: var(--k-paper); }
  .ticket > .reminder .reminder-link { height: 40px; border-radius: 12px; background: var(--k-red-soft); color: var(--k-red-deep); line-height: 40px; }
  @media (max-width: 359px) {
    .activity-item__photo, .activity-item__img { width: 88px; height: 88px; }
    .activity-item__title { font-size: 14px; line-height: 20px; }
    .more-copy .meta > text { display: block; -webkit-line-clamp: unset; }
    .rec-copy .meta, .more-copy .meta { font-size: 11px; }
  }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 5 轮：骨架第三块放三条灰条；没取到报名数据时顶上那行「报名详情」做成 18 / 600 墨色标题；票据里没有值的「—」用浅灰 */
.k-page.activity-page {
  .dskel::after { height: 88px; background: linear-gradient(var(--k-paper2), var(--k-paper2)) 12px 16px / calc(100% - 24px) 12px no-repeat, linear-gradient(var(--k-paper2), var(--k-paper2)) 12px 38px / calc(90% - 24px) 12px no-repeat, linear-gradient(var(--k-paper2), var(--k-paper2)) 12px 60px / calc(60% - 24px) 12px no-repeat, var(--k-paper); }
  .success-head--none .success-title { font-size: 18px; line-height: 26px; font-weight: 600; color: var(--k-ink); }
  .ticket-data__row text.is-blank { color: var(--k-light); }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 6 轮：「为你推荐」顶部说明卡右边的手绘插画换成 44 浅棕方块 + 24 暖棕线性图标，和全组入口一种做法 */
.k-page.activity-page {
  .ai-banner { height: auto; min-height: 64px; }
  .ai-banner__ico { flex: 0 0 44px; width: 44px; height: 44px; border-radius: 14px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
}
</style>
<style scoped lang="scss">
/* 11-18 夜 第四轮精修（以微信实拍为准）：
   活动列表——顶栏连同搜索、页签一起白底，下沿发丝线；搜索提交改成「搜索」文字钮 + 竖线；空状态拆成标题 + 说明；
   为你推荐——说明卡去掉卡底，筛选胶囊另起一行；两个空状态紧凑一档；
   活动详情——骨架和真页面同结构、铺满，加载中底栏变淡不可点；
   报名详情——页首缩成 40 方块 + 17 号标题，动作行加方块图标和箭头，票卡不再整块收起 */
.k-page.activity-page {
  /* 列表页：白色吸顶区 */
  .search { background: var(--k-fill); }
  .activity-tabs { box-shadow: inset 0 -.5px 0 var(--k-line); }
  .search__btn { position: relative; height: 36px; padding: 0 8px 0 12px; border-radius: 0; background: transparent; color: var(--k-red); font-size: 13px; font-weight: 600; }
  .search__btn::before { content: ''; position: absolute; left: 0; top: 11px; bottom: 11px; width: 1px; transform: scaleX(.5); background: var(--k-line2); }
  .empty-tip { gap: 0; }
  .empty-tip .empty-ico { margin-bottom: 12px; }
  .empty-tip__title { font-size: 14px; font-weight: 500; line-height: 22px; color: var(--k-ink); }
  .empty-tip__sub { margin-top: 4px; max-width: 260px; font-size: 12px; font-weight: 400; line-height: 1.6; color: var(--k-muted); text-align: center; }

  /* 为你推荐 */
  .ai-banner { min-height: 0; padding: 4px 4px 0; background: transparent; }
  .ai-banner__ico { flex: 0 0 40px; width: 40px; height: 40px; border-radius: 10px; }
  .ai-banner__title { font-size: 17px; font-weight: 600; }
  .more-head { flex-wrap: wrap; row-gap: 8px; }
  .more-head > text { flex: 0 0 100%; }
  .more-head .filters { flex: 0 0 100%; justify-content: flex-start; gap: 8px; }
  .ai-body .empty-tip { padding: 24px 16px; }
  .ai-body .empty-tip .empty-ico { width: 40px; height: 40px; border-radius: 10px; margin-bottom: 8px; }

  /* 活动详情骨架 */
  .dskel--v7 { margin: 0; min-height: calc(100vh - 120px); background: var(--k-paper); }
  .dskel--v7::after { content: none; }
  .dskel--v7 .dskel__img { height: 75vw; border-radius: 0; background: var(--k-fill); }
  .dskel--v7 .dskel__card { margin: 0; padding: 16px 12px 24px; border-radius: 0; background: var(--k-paper); }
  .dskel--v7 .dskel__line { height: 12px; margin-top: 10px; border-radius: 6px; background: var(--k-fill); }
  .dskel--v7 .dskel__line--title { width: 82%; height: 20px; margin-top: 0; border-radius: 8px; }
  .dskel--v7 .dskel__line--title2 { width: 48%; height: 20px; margin-top: 8px; border-radius: 8px; }
  .dskel--v7 .dskel__line--price { width: 96px; height: 24px; margin-top: 16px; border-radius: 8px; }
  .dskel--v7 .dskel__line--short { width: 60%; }
  .dskel--v7 .dskel__line--name { width: 88px; height: 16px; margin-top: 0; }
  .dskel--v7 .dskel__info { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .dskel--v7 .dskel__info .dskel__line { flex: 1; margin-top: 0; }
  .dskel--v7 .dskel__info .dskel__line--short { flex: 0 0 60%; }
  .dskel--v7 .dskel__dot { flex: none; width: 18px; height: 18px; border-radius: 6px; background: var(--k-fill); }
  .dskel--v7 .dskel__sep { height: 1px; margin: 20px 0; transform: scaleY(.5); background: var(--k-line); }
  .bottom-side.is-loading, .bottom-main.is-loading { opacity: .4; pointer-events: none; }

  /* 报名详情 */
  .success-head--none .success-ico { flex-basis: 40px; width: 40px; height: 40px; border-radius: 10px; }
  .success-head--none .success-title { font-size: 17px; line-height: 24px; }
  .success-action { align-items: center; min-height: 60px; }
  .success-action__ico { flex: 0 0 32px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: var(--k-red-soft); }
  .success-action > view:nth-child(2) { flex: 1; min-width: 0; }
  .success-action .action-title { font-size: 15px; font-weight: 500; }
  .success-action + .success-action::before { left: 56px; }
  .ticket--blank .ticket-top { display: flex; }
  .ticket--blank .ticket-dash { display: block; }
  .ticket--blank .ticket-title { display: block; width: 64%; min-height: 18px; border-radius: 6px; background: var(--k-fill); }
}
.k-page.activity-page :deep(.k-topbar) { background: var(--k-page); }
</style>
<style scoped lang="scss">
/* 11-19 第四轮返修：报名详情没数据时，票头的标签、时间、集合地点都放骨架条（不再是小残块和空白），「复制」淡到 .4；
   页首「报名详情」降一档，不和顶栏抢；活动卡「名额充足 / 较少 / 紧张」改成无底小字，同一行只留类型标签一种底色 */
.k-page.activity-page {
  .ticket--blank .detail-kind { display: block; width: 40px; min-width: 40px; height: 16px; padding: 0; border-radius: 4px; background: var(--k-fill); }
  .ticket--blank .ticket-copy > .detail-line:not(.detail-line--tap) > text { display: block; width: 120px; height: 12px; margin-top: 4px; border-radius: 6px; background: var(--k-fill); }
  .ticket--blank .detail-line--tap .detail-line__text { flex: 0 0 auto; }
  .ticket--blank .detail-line--tap::after { content: ''; order: 1; flex: 0 1 100px; height: 12px; margin: 4px auto 0 4px; border-radius: 6px; background: var(--k-fill); }
  .ticket--blank .place-tag { order: 2; opacity: .4; }
  .success-head--none .success-title { font-size: 15px; font-weight: 600; line-height: 22px; }
  .quota, .quota.few, .quota.full { height: auto; padding: 0; border: 0; border-radius: 0; background: transparent; font-size: 12px; line-height: 17px; }
}
</style>
<style scoped lang="scss">
/* 11-19 微信实拍返修：空状态全组统一不套白卡（图标方块 + 两行同一档的字居中，放在内容区上部），标题和说明同一档 14/22/500 ink2，读起来是一句话；
   页签改成左对齐（左起 12、间距 24，和攒局首页一样）；为你推荐说明区左边对齐卡片线，右上图标不加底色；
   详情加载中主按钮做成骨架色（不写「暂不可报名」的意思）；报名详情页首对齐左线，动作行图标去掉浅棕方块、分隔线从 44 起 */
.k-page.activity-page {
  .empty-tip { margin: 24px 0 0; padding: 24px 16px; border-radius: 0; background: transparent; }
  .empty-tip__title, .empty-tip__sub { max-width: 280px; margin-top: 0; font-size: 14px; font-weight: 500; line-height: 22px; color: var(--k-ink2); }
  .ai-body .empty-tip { margin-top: 0; padding: 16px 16px 8px; }
  .activity-tabs { justify-content: flex-start; gap: 24px; padding: 0 12px; }
  .activity-tabs .k-tabs__item { flex: 0 0 auto; }
  .ai-banner { padding: 4px 0 0; }
  .ai-banner__ico { background: transparent; justify-content: flex-end; }
  .bottom-main.is-loading { opacity: 1; }
  .bottom-main.is-loading :deep(.k-button) { opacity: 1; background: var(--k-fill); color: var(--k-light); box-shadow: none; }
  .success-head { padding: 16px 0; }
  .success-action__ico { flex: 0 0 20px; width: 20px; height: 20px; border-radius: 0; background: transparent; }
  .success-action + .success-action::before { left: 44px; }
}

.activity-page.user-surface {
  .date-title { color: var(--k-red-deep); }
  .activity-item { border-radius: 12px; box-shadow: var(--k-sh1); }
  .activity-item__photo { overflow: hidden; border-radius: 9px; }
  .activity-item__copy, .rec-copy { min-width: 0; }
  .activity-item__title, .rec-title { line-height: 1.45; }
  .meta, .quota { font-variant-numeric: tabular-nums; }
}
</style>
