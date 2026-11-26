<template>
<k-community-gate :bypass="s === 1 || s === 4">
  <view class="k-page mine-page" :class="$userSurface">
    <!-- 1 我的活动 -->
    <template v-if="s === 1">
      <!-- 之前这一屏没有返回键（页面是从「我的」/ 群详情跳进来的），只能靠系统手势退出；
           「发起活动」也只在「我发起的」为空时弹一次，发起过一场之后就再也找不到入口
           10-16 跟进：顶栏原来写品牌名「袋鼠小院」，页里又有一行大字「我的活动」，同一页说了两遍名字；
           现在顶栏直接写页名（和「我的行程」一样），页里只留右边的「发起活动」入口 -->
      <k-topbar title="我的活动" back />
      <view class="mine-body k-pad-tab">
        <view class="mine-head"><view v-if="communityEnabled" class="create-link" hover-class="k-press" @click="startCreate"><k-icon name="plus" :size="14" color="red" /><text>创办活动</text></view></view>
        <view class="k-tabs mine-tabs"><view v-for="tab in mineTabs" :key="tab" class="k-tabs__item" :class="{ active: mineTab === tab }" hover-class="k-press" @click="setTab(tab)"><text>{{ tab }}</text></view></view>
        <view v-for="item in mineActivities" :key="item.activityId + '-' + (item.signupId || 0)" class="mine-card" :class="{ 'mine-card--ended': item.ended }" hover-class="k-press-s" @click="openItem(item)">
          <view class="mine-main"><view class="mine-photo"><image :src="item.img" mode="aspectFill" /><text class="state-chip" :class="`state-chip--${item.stateTone}`">{{ item.state }}</text></view><view class="mine-copy"><view class="k-between"><text class="mine-title">{{ item.title }}</text><text class="kind-chip">{{ item.kind }}</text></view><view class="meta"><k-icon name="clock" :size="16" color="muted" /><text>{{ item.time }}</text></view><view class="meta"><k-icon name="map-pin" :size="16" color="muted" /><text>{{ item.place }}</text></view><view class="attend" :class="{ 'attend--deadline': item.fav }"><view v-if="item.avatars.length" class="avatar-stack"><image v-for="(a,i) in item.avatars" :key="i" class="tiny-avatar" :src="a" mode="aspectFill" /></view><text>{{ item.attend }}</text></view></view></view>
          <!-- 包一层只为挡住按压效果往上传：按下面的小按钮时，整张卡不再跟着缩一下（press-stop 不画任何样式） -->
          <view class="mine-actions-hit" hover-class="press-stop" hover-stop-propagation>
          <!-- 收藏的活动：只有「取消收藏」「查看详情」（没报名，没有群聊可进） -->
          <view v-if="item.fav" class="mine-actions" @click.stop><k-button type="outline" size="sm" icon="heart" @click.stop="unfavorite(item)">取消收藏</k-button><k-button type="outline" size="sm" label="查看详情" @click.stop="review(item)" /></view>
          <view v-else class="mine-actions" @click.stop><k-button v-if="item.canHide" type="outline" size="sm" @click.stop="hideRecord(item)">移除记录</k-button><k-button v-else-if="groupChatEnabled" type="outline" size="sm" icon="messages-square" @click.stop="openGroup(item)">群聊</k-button><k-button v-if="item.cancel" type="secondary" size="sm" :label="item.cancel" @click.stop="cancelItem(item)" /><k-button v-else type="outline" size="sm" :label="item.manage ? '管理活动' : '查看回顾'" @click.stop="item.manage ? openManage(item.activityId) : review(item)" /></view>
          </view>
        </view>
        <view v-if="mineError" class="empty-tip"><text>{{ mineError }}</text><k-button type="outline" size="sm" @click="loadMine()">重新读取活动</k-button></view>
        <text v-else-if="!mineLoaded" class="empty-tip">正在读取活动…</text>
        <!-- 之前「已报名」「已完成」没有记录时只有一片空白 -->
        <view v-if="mineLoaded && !mineActivities.length" class="empty-tip"><view class="empty-ico"><k-icon :name="mineTab === '收藏' ? 'heart' : 'calendar'" :size="32" color="red" /></view><text>{{ EMPTY[mineTab] }}</text><text class="empty-sub">报名、收藏和创办的活动都会出现在这里</text></view>
      </view>
      <k-tabbar active="community" />
    </template>

    <!-- 2 发起活动 -->
    <template v-else-if="s === 2">
      <k-topbar :title="editId ? '修改活动' : '创办活动'" back custom-back @back="leaveForm" />
      <view class="form-body k-pad-tab">
        <view v-if="!editId" class="form-group paste-card">
          <text class="form-label">粘贴活动文案</text>
          <textarea v-model="activityText" maxlength="2000" placeholder="例如：海岛徒步，12月6日09:00到12:00，在码头集合，限12人，每人30元" />
          <button :disabled="!activityText.trim()" @click="fillActivityText">识别并填入</button>
        </view>
        <text v-if="contentOnly" class="edit-note">活动已开始或已有成员签到，可编辑标题、封面、介绍和安全说明。</text>
        <text v-else-if="hasSignups" class="edit-note">修改时间或地点后，会通知已报名和候补成员；原报名、费用和名额保留。</text>
        <!-- 11-18 返修：字段合成三张卡（基本信息 / 时间地点 / 人数费用和介绍），卡内字段之间发丝线 -->
        <view class="form-group">
        <view class="form-block"><text class="form-label required">活动标题</text><view class="form-input activity-title-input"><textarea v-model="activityTitle" maxlength="30" :auto-height="false" placeholder="输入活动标题（不超过30字）" placeholder-class="placeholder" /><text>{{ activityTitle.length }}/30</text></view></view>
        <view class="form-block"><text class="form-label required">活动封面</text><view class="cover-row" :class="{ 'cover-row--selected': !!cover }"><view class="cover-upload" @click="pickCover"><k-icon name="camera" :size="24" color="muted" /><text>上传封面图</text><text class="cover-tip">横图、竖图都可以</text></view><view v-if="cover" class="cover-preview"><image :src="coverImg" mode="aspectFit" /><view class="cover-close" @click="removeCover"><k-icon name="x" :size="16" color="white" /></view></view></view></view>
        </view>
        <template v-if="!contentOnly">
        <view class="form-group">
        <view class="activity-schedule">
          <text class="schedule-tip">日期用日历选择，时间直接填写（24小时制，北京时间）。支持今天及跨天活动，新集合时间至少提前1小时。</text>
          <view v-for="field in scheduleFields" :key="field.date" class="schedule-field">
            <text class="schedule-label">{{ field.label }}</text>
            <view class="schedule-inputs"><view class="schedule-date" hover-class="k-press" @click="pickScheduleDate(field)"><text>{{ schedule[field.date] || '开始前' }}</text><k-icon name="calendar" :size="18" color="muted" /></view><input v-model="schedule[field.time]" class="schedule-clock" :aria-label="field.label + '时刻'" type="text" maxlength="5" placeholder="09:30" :cursor-spacing="28" @blur="normalizeTime(field.time)" /></view>
          </view>
          <text v-if="scheduleError" class="schedule-error">{{ scheduleError }}</text>
        </view>
        <!-- 之前不能选城市，悄悄取首页的定位 / 兴趣城市：在社区看大理、首页定位在杭州时，发起的活动会建成杭州的 -->
        <view class="form-block"><text class="form-label required">活动城市</text><view class="form-input" @click="pickCity"><text>{{ city }}</text><k-icon name="chevron-right" :size="16" color="muted" /></view></view>
        <!-- 2026-11-03 主人：集合地点和地图位置合成一行。点了打开微信地图选点，地点名称、地址、地图位置一次填好（报名的人在活动详情点「集合」能导航）；
             选好后再点可以只改名称文字、重新选点或清掉地图位置。网页版没有地图，直接填文字 -->
        <view class="form-block"><text class="form-label required">集合地点</text><view class="form-input" @click="pickPlace"><text>{{ place || '点击在地图上选集合地点' }}</text><k-icon name="map-pin" :size="20" :color="meet ? 'red' : 'muted'" /></view><text v-if="meet" class="field-tip">已标地图位置，报名的人可以导航过去</text></view>
        </view>
        </template>
        <view class="form-group">
        <template v-if="!contentOnly">
        <template v-if="!hasSignups"><view class="number-fee"><view class="number-side"><text class="form-label required">预计人数</text><view class="stepper"><view @click="people = Math.max(2, people - 1)"><k-icon name="minus" :size="18" color="ink" /></view><text>{{ people }}</text><view @click="people = Math.min(50, people + 1)"><k-icon name="plus" :size="18" color="ink" /></view></view><text class="field-tip">建议 5-50 人</text></view><view class="fee-side"><text class="form-label">费用（元/人）</text><view class="fee-seg"><view v-for="k in FEE_KINDS" :key="k[0]" class="fee-seg__item" :class="{ on: feeKind === k[0] }" hover-class="k-press" @click="feeKind = k[0]"><text>{{ k[1] }}</text></view></view><text class="field-tip">{{ feeTip }}</text></view></view>
        <!-- 2026-11-03 主人：「免费，aa，输入价格」。平台不替个人收钱：收费 = 标个价，报名的人到场付给发起人；AA = 现场平摊，可写个预估人均 -->
        <view v-if="feeKind === 'paid'" class="form-block"><view class="form-input"><input v-model="fee" type="digit" maxlength="8" placeholder="每人费用（必填），例如 50" placeholder-class="placeholder" /><text>元/人</text></view><text class="field-tip">{{ OFFLINE_NOTE }}</text></view>
        <view v-if="feeKind === 'aa'" class="form-block"><view class="form-input"><input v-model="aaFee" type="digit" maxlength="8" placeholder="预估人均（选填），例如 80" placeholder-class="placeholder" /><text>元/人</text></view></view>
        </template>
        <text v-else class="edit-note">名额 {{ people }} 人 · {{ feeText }}（保留原约定）</text>
        </template>
        <view class="form-block"><text class="form-label">活动介绍</text><view class="form-input safety"><textarea v-model="intro" maxlength="2000" placeholder="活动安排、路线、需要携带的物品" /></view></view>
        <view class="form-block"><text class="form-label">安全说明 <text class="optional">（可选）</text></text><view class="form-input safety"><textarea v-model="safety" maxlength="200" placeholder="如有风险提示、装备要求等，请详细说明…" placeholder-class="placeholder" /><text>{{ safety.length }}/200</text></view></view>
        </view>
        <view class="form-submit"><k-button size="lg" block @click="toConfirm">{{ editId ? '下一步：确认修改' : '下一步：发布确认' }}</k-button></view>
      </view>
      <k-tabbar active="community" />
    </template>

    <!-- 3 发布确认 -->
    <template v-else-if="s === 3">
      <k-topbar :title="editId ? '确认修改' : '发布确认'" back custom-back @back="s = 2" />
      <view class="confirm-body k-pad-tab">
        <view class="confirm-card"><text class="confirm-title">活动预览</text><view class="confirm-cover-box" :class="{ 'confirm-cover-box--empty': !cover }"><image class="confirm-cover" :class="{ 'confirm-cover--empty': !cover }" :src="coverImg" mode="aspectFit" /></view><view class="confirm-copy"><text class="confirm-name">{{ activityTitle }}</text><view class="meta big"><k-icon name="clock" :size="16" color="muted" /><text>{{ schedule.date }} {{ schedule.time }} — {{ schedule.endDate }} {{ schedule.endTime }}</text></view><view class="meta big"><k-icon name="map-pin" :size="16" color="muted" /><text>{{ city }} · 集合：{{ place }}</text></view><view class="confirm-info"><k-icon name="users" :size="16" color="muted" /><text>名额 {{ people }} 人</text><text>费用：{{ feeText }}</text></view><text class="confirm-subtitle">活动介绍</text><view class="confirm-desc-row" :class="{ 'confirm-desc-row--todo': !intro }" hover-class="k-press" @click="editIntro"><text class="confirm-desc">{{ intro || '点击填写活动介绍（路线、节奏、需要带什么）' }}</text><k-icon name="chevron-right" :size="14" color="muted" /></view></view></view>
        <view class="option-card"><text class="card-title">同步来源</text><view v-if="!editId" class="check-row" @click="syncCommunity = !syncCommunity"><view class="checkbox" :class="{ checked: syncCommunity }"><k-icon v-if="syncCommunity" name="check" :size="16" color="white" /></view><text>同步到社区「活动」频道</text></view><view class="check-row" @click="syncWechat = !syncWechat"><view class="checkbox" :class="{ checked: syncWechat }"><k-icon v-if="syncWechat" name="check" :size="16" color="white" /></view><text>分享到微信群（群内通知）</text></view></view>
        <view class="option-card notice-card"><text class="card-title">参与须知</text><text class="notice-text">请打开全文，从顶部读到末尾后确认。</text><view class="check-row" hover-class="k-press" @click="readActivityNotice"><view class="checkbox" :class="{ checked: agreed }"><k-icon v-if="agreed" name="check" :size="16" color="white" /></view><text>{{ agreed ? '已阅读并同意《活动参与须知》' : '阅读完整《活动参与须知》' }}</text></view></view>
        <view class="option-card verify-card"><text class="card-title">手机号校验</text><view class="verify-row" @click="tapVerify"><text>手机号</text><view><text>{{ phoneText }}</text><text class="verified" :class="{ 'verified--todo': !status.phoneVerified }">{{ status.phoneVerified ? '已验证' : '去验证' }}</text><k-icon v-if="!status.phoneVerified" name="chevron-right" :size="16" color="muted" /></view></view><view class="verify-row"><text>发起人</text><view><text>{{ nickname }}</text><text class="verified verified--plain">公开昵称</text><view v-if="!status.phoneVerified" class="verify-gap"></view></view></view></view>
        <text v-if="editId && hasSignups && !contentOnly" class="edit-note">保存后，时间或地点变更会通过站内通知和活动群告知成员。</text><view class="confirm-submit"><k-button size="lg" block :label="editId ? '保存修改' : '确认发布'" :disabled="!agreed" @click="publish" /></view>
      </view>
      <k-tabbar active="community" />
    </template>

    <!-- 4 活动管理 -->
    <template v-else>
      <k-topbar title="活动管理" back custom-back @back="leaveManage" />
      <view class="manage-body k-pad-tab">
        <!-- 之前「未通过审核」只显示状态和「修改后重新提交」，服务端给了驳回原因却不展示，用户不知道该改什么 -->
        <view v-if="m.status === 'rejected' && m.auditReason" class="reject-reason"><k-icon name="info" :size="16" color="alert" /><text>未通过原因：{{ m.auditReason }}</text></view>
        <view class="manage-hero" :class="{ 'manage-hero--blank': !m.title }"><view class="manage-status-row"><text>当前状态</text><text class="running" :class="{ 'is-empty': !statusLabel }">{{ statusLabel }}</text></view><image :src="(m.img ? absUrl(m.img) : '') || '/static/media/cover-empty.png'" mode="aspectFill" /><view class="manage-copy"><view class="k-row k-gap6"><text class="manage-title">{{ m.title }}</text><text class="kind-chip">{{ m.kind }}</text></view><text class="manage-when">{{ m.timeText }}</text><text :class="{ 'is-empty': !m.city && !m.place }">{{ m.city ? m.city + ' · ' : '' }}集合：{{ m.place }}</text></view></view>
        <!-- 11-18 返修：顶部「群聊 / 联系成员 / 签到二维码 / 分享活动」和活动操作并成一个宫格，同一种 40 浅棕方块 + 22 暖棕图标 -->
        <view class="manage-operations">
          <text class="operations-title">活动操作</text>
          <view class="operations-grid"><view v-for="tool in manageTools.filter(x => x.label !== '群聊' || groupChatEnabled)" :key="tool.label" class="op-cell" hover-class="k-press" @click="tool.click()"><view class="op-ico"><k-icon :name="tool.icon" :size="22" color="red" /></view><text>{{ tool.label }}</text></view><template v-if="manageActions.length"><view v-for="op in manageActions" :key="op.key" class="op-cell" :class="{ 'op-cell--danger': OP_DANGER.includes(op.key), 'is-disabled': actionBusy }" :disabled="actionBusy" hover-class="k-press" aria-role="button" @click="runManageAction(op.key)"><view class="op-ico"><k-icon :name="OP_ICON[op.key] || 'circle'" :size="22" :color="OP_DANGER.includes(op.key) ? 'alert' : 'red'" /></view><text>{{ op.label }}</text></view></template></view>
          <template v-if="manageActions.length"><text v-if="['open', 'paused', 'closed'].includes(m.status)" class="operations-tip">结束报名仅停止接收新成员；活动开始后才能结束活动。</text></template>
        </view>
        <view class="stats"><view><text>报名人数</text><text class="stat-num">{{ m.count || 0 }}<text>/{{ m.capacity || 0 }}</text></text></view><view><text>已确认</text><text class="stat-num green">{{ (m.confirmed || []).length }}<text>人</text></text></view><view><text>候补中</text><text class="stat-num ochre">{{ (m.waiting || []).length }}<text>人</text></text></view><view><text>浏览量</text><text class="stat-num">{{ m.views || 0 }}</text></view></view>
        <text class="members-title">报名成员</text>
        <view class="members-layout"><view class="member-groups"><view class="group-head"><text>已确认（{{ (m.confirmed || []).length }}）</text><view class="group-head__link" hover-class="k-press" @click="broadcast"><text>批量联系</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><view v-for="x in confirmedShow" :key="x.signupId" class="member-row"><image :src="x.avatar" mode="aspectFill" /><view><text class="member-name">{{ x.name }}</text><text>{{ x.phone }}</text></view><text v-if="x.tag" class="member-tag" :class="{ leader: x.tag === '领队' }">{{ x.tag }}</text><view v-if="privateChatEnabled" class="member-act" hover-class="k-press" aria-role="button" aria-label="私信" @click="chatWith(x)"><k-icon name="message-circle" :size="18" color="ink" /></view><view class="member-act" hover-class="k-press" aria-role="button" aria-label="打电话" @click="callMember(x)"><k-icon name="phone" :size="18" color="ink" /></view></view><view v-if="moreCount" class="expand-more" hover-class="k-press" @click="showAll"><text>展开更多（{{ moreCount }}）</text><k-icon name="chevron-right" :size="12" color="muted" /></view><view class="group-head wait"><text>候补中（{{ (m.waiting || []).length }}）</text><view class="group-head__link" hover-class="k-press" @click="showWaiting"><text>按照报名顺序</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><view v-for="x in waitingShow" :key="x.signupId" class="member-row"><image :src="x.avatar" mode="aspectFill" /><view><text class="member-name">{{ x.name }}</text><text>{{ x.phone }}</text></view><text class="member-tag">{{ x.tag }}</text><view v-if="privateChatEnabled" class="member-act" hover-class="k-press" aria-role="button" aria-label="私信" @click="chatWith(x)"><k-icon name="message-circle" :size="18" color="ink" /></view></view></view><view class="chart"><text class="chart-title">报名趋势</text><text class="chart-sub">近7天报名人数</text><view class="chart-area"><text v-if="!chartPoints.length" class="chart-empty">还没有报名数据</text><view class="chart-plot"><view v-for="(g,i) in chartSegs" :key="'g' + i" class="chart-seg" :style="g"></view><view v-for="(p,i) in chartPoints" :key="i" class="point" :style="{ left: p.x + '%', bottom: p.y + 'px' }"><text>{{ p.n }}</text></view></view></view><view class="chart-axis"><text :style="{ left: axisX[0] + '%' }">{{ axis[0] }}</text><text :style="{ left: axisX[1] + '%' }">{{ axis[1] }}</text><text :style="{ left: axisX[2] + '%' }">{{ axis[2] }}</text><text :style="{ left: axisX[3] + '%' }">{{ axis[3] }}</text></view></view></view>
      </view>
      <k-tabbar active="community" />
    </template>
    <k-date-picker v-if="calendarField" :title="`选择${calendarField.label}日期`" :value="schedule[calendarField.date]" :min-date="calendarMin" @cancel="calendarField = null" @confirm="confirmDate" />
  </view>

</k-community-gate>
</template>

<script setup>
import { parseActivityText, activityTextPreview } from '@/common/activity-text.js'
import { groupChatEnabled, privateChatEnabled } from '@/common/features.js'
import { communityEnabled } from "@/common/features.js"
// ---------------------------------------------------------------------------
// 我的活动 / 发起活动（用户端）接入情况：
//   s=1 我的活动：已报名 / 已完成 / 我发起的（apiMyActivities）
//   s=2 发起活动：「用户自发」活动，费用三选一（免费 / AA制 / 收费）。平台不替个人收钱：AA 现场平摊，收费到场付给发起人；在线收费只有小院活动（员工端发起）
//   s=3 发布确认：同意《活动参与须知》、手机号需已验证；本期没有实名认证，不出现"已实名"
//   s=4 活动管理（发起人）：报名 / 候补 / 浏览、成员（手机号只在活动前后 24 小时内可查看并留痕）、群聊、
//       群发通知、签到码签到与签到二维码、暂停 / 结束报名、结束 / 取消活动
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onShareAppMessage, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import {
  apiMyActivities, apiCreateActivity, apiActivitySyncCommunity, apiEditActivity, apiManageActivity, apiManageAction, apiManagePhone, apiChatOpen,
  apiCommunityConsent, apiCommunityStatus, apiActivityFavorite, apiSignupHide
} from '@/common/api.js'
import { get } from '@/common/request.js'
import { ensureSession, experience } from '@/common/experience.js'
import { sheet, prompt, confirm, alert, shiftDate, todayCn } from '@/common/ui.js'
import { readCommunityConsent, gated, fail, currentCity, communityCity, shareTip } from '@/common/community.js'
import { selectCity } from '@/common/city-picker.js'
import { uploadTo, chooseImage, absUrl } from '@/common/upload.js'
import R from '@/common/routes.js'
import { normalizeClock } from '@/common/manual-time.js'
import { activitySchedule, checkActivitySchedule } from './activity-schedule.js'
import { feeError, feeBody, feeKindOf, yuanText, OFFLINE_NOTE } from '@/common/activity-form.js'

// 落地屏：从通知 / 详情页直接打开「活动管理」或「发起活动」的，返回离开本页；从「我的活动」列表点进去的，返回回到列表
let landing = 1
const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    // 登录态恢复后再取一次默认城市（社区城市按账号记在本机）
    city.value = defaultCity()
    if (Number(q?.id)) {
      landing = 4
      if (await openManage(Number(q.id))) return
      // 之前打不开（不是发起人 / 已删除）就停在一片空白的第一屏；现在退回「我的活动」列表
      landing = 1; s.value = 1; return loadMine()
    }
    if (q?.view === 'create') { landing = 2; s.value = 2; return }
    // 「我的 → 我的收藏 → 收藏的活动」带 ?tab=fav 进来，直接停在「收藏」页签
    const tabName = Object.keys(TAB).find(k => TAB[k] === q?.tab)
    if (tabName) mineTab.value = tabName
    landing = s.value
    if (s.value === 1) loadMine()
  }
})
// 之前「发布确认」页点「去验证」验完手机号回来，页面还拿着旧的「未验证」状态，再点发布又被要求验证；现在回到这一屏重新查一次
let mineVisible = true, returned = false
onShow(() => {
  mineVisible = true
  if (s.value === 3) loadStatus()
  else if (returned && s.value === 1) loadMine(false)
  returned = false
})
const hideMine = () => { mineVisible = false; returned = true; loadSeq++ }
onHide(hideMine)
onUnload(hideMine)
const DEFAULT_IMG = '/static/media/cover-empty.png'

// ---------------- s=1 ----------------
// 10-16：加「收藏」页签（收藏的活动 + 报名截止时间，已结束的排后面、标灰）
const mineTabs = ['已报名', '已完成', '我发起的', '收藏']
const TAB = { 已报名: 'joined', 已完成: 'done', 我发起的: 'mine', 收藏: 'fav' }
const EMPTY = { 已报名: '还没有报名活动，去社区「活动」看看', 已完成: '还没有已完成的活动', 我发起的: '还没有发起过活动，点右上角「发起活动」',
  收藏: '还没有收藏活动，在活动列表点封面右上角的心就能收藏' }
const mineTab = ref('已报名')
const rows = ref([])
const mineLoaded = ref(false)
const mineError = ref('')
let loadSeq = 0
async function loadMine(offerCreate = true) {
  if (!mineVisible || s.value !== 1) return
  const seq = ++loadSeq, tab = mineTab.value, owner = experience.account?.id
  const current = () => seq === loadSeq && s.value === 1 && owner === experience.account?.id
  rows.value = []
  mineLoaded.value = false
  mineError.value = ''
  try {
    const data = tab === '收藏' ? (await get('/app/activities/favorites')).data : (await apiMyActivities(TAB[tab])).data
    // 快速切页签时，先发的请求后回来不能盖掉当前页签
    if (!current()) return
    rows.value = (data || []).map(x => (tab === '收藏' ? { ...x, fav: true, attend: x.deadlineNote || '' } : x))
    mineLoaded.value = true
    if (offerCreate && communityEnabled.value && tab === '我发起的' && !rows.value.length
        && (await confirm('创办活动', '你还没有发起过活动，现在发起一个同城活动？')) && current()) s.value = 2
  } catch (e) {
    if (current()) mineError.value = e?.message || '活动记录加载失败'
  }
}
const setTab = (t) => { mineTab.value = t; loadMine() }
const mineActivities = computed(() => rows.value.map(x => ({
  ...x, img: x.img ? absUrl(x.img) : DEFAULT_IMG, time: x.timeText, avatars: (x.avatars || []).slice(0, 4).map(absUrl),
  cancel: x.cancel || null
})))
const openItem = (item) => (item.manage ? openManage(item.activityId) : (item.fav ? review(item) : go(R.activity + '?signupId=' + item.signupId)))
async function unfavorite(item) {
  try {
    const res = (await gated(() => apiActivityFavorite(item.activityId))).data
    // 收藏是开关：这里点的都是已收藏的，回来是 false 就从列表拿掉
    if (!res.favorited) rows.value = rows.value.filter(x => x.activityId !== item.activityId)
    toast(res.favorited ? '已收藏' : '已取消收藏')
  } catch (e) {
    fail(e, '操作失败')
  }
}
async function openGroup(item) {
  if (!item.convId) return toast(item.manage ? '活动通过审核后自动建群' : '报名确认后才能进活动群')
  try {
    const res = (await apiChatOpen({ type: 'activity', activityId: item.activityId })).data
    go(R.chat + '?convId=' + res.convId)
  } catch (e) {
    fail(e, '暂时无法进群')
  }
}
const cancelItem = (item) => go(R.activity + '?signupId=' + item.signupId)
let hidingRecord = false
async function hideRecord(item) {
  const owner = experience.account?.id
  if (hidingRecord || !owner || !item.canHide) return
  hidingRecord = true
  try {
    if (!(await confirm('移除这条记录', '从个人列表移除已取消或已退款的报名，后台记录仍会保留。确认移除？')) || experience.account?.id !== owner) return
    const res = await apiSignupHide(item.signupId)
    if (experience.account?.id !== owner) return
    rows.value = rows.value.filter(x => x.signupId !== item.signupId)
    toast(res.msg || '已移除记录')
  } catch (e) { fail(e, '移除失败，请重试') }
  finally { hidingRecord = false }
}
const review = (item) => go(R.activity + '?id=' + item.activityId)
// 从「修改活动」切回新建时清掉回填的旧活动内容；新建途中退回列表再进来，已填的草稿保留
function startCreate() {
  if (!communityEnabled.value) return toast("社区内容功能暂未开放")
  activityText.value = ''
  if (editId.value) {
    editId.value = null; activityTitle.value = ''; cover.value = ''; schedule.value = activitySchedule({}, shiftDate(todayCn(), 3))
    place.value = ''; people.value = 10; feeKind.value = 'free'; fee.value = ''; aaFee.value = ''; safety.value = ''; intro.value = ''
    meet.value = null; hadMeet = false
    city.value = defaultCity()
  }
  s.value = 2
}

// ---------------- s=2 发起 ----------------
const editId = ref(null)
const hasSignups = computed(() => !!editId.value && (m.value.hasSignups === true || Number(m.value.count || 0) > 0 || (m.value.waiting || []).length > 0))
const contentOnly = computed(() => !!editId.value && (m.value.arrangementEditable === false || (hasSignups.value && m.value.arrangementEditable !== true)))
const activityText = ref('')
async function fillActivityText() {
  if (editId.value || s.value !== 2) return
  const owner = experience.account?.id
  const source = activityText.value
  const {values, schedule: dates} = parseActivityText(source, todayCn())
  const refs = {title:activityTitle,city,place,people,feeKind,fee,aaFee,intro,safety}
  const limits = {title:30,place:100,safety:200,intro:2000}
  for (const [key, max] of Object.entries(limits)) {
    if (values[key]) values[key] = values[key].slice(0, max)
  }
  const current = schedule.value
  if (dates.date && !dates.endDate && (current.endDate === current.date || current.endDate < dates.date)) dates.endDate = dates.date
  const preview = activityTextPreview(values, dates)
  if (!preview) return toast('暂未识别到字段，可写上活动名称、时间或地点再试')
  if (!(await confirm('将以下内容填入表单？', preview))) return
  if (editId.value || s.value !== 2 || !mineVisible || owner !== experience.account?.id || source !== activityText.value) return
  if (values.place && values.place !== place.value || values.city && values.city !== city.value) meet.value = null
  for (const [k,v] of Object.entries(values)) refs[k].value = v
  Object.assign(schedule.value, dates)
  toast('已填入，可以继续修改')
}
const activityTitle = ref('')
const cover = ref('')
const coverImg = computed(() => (cover.value ? absUrl(cover.value) : DEFAULT_IMG))
async function pickCover() {
  const path = await chooseImage()
  if (!path) return
  try {
    cover.value = (await uploadTo('/app/upload/image', path)).data.url
  } catch (e) {
    fail(e, '封面上传失败')
  }
}
const removeCover = () => { cover.value = '' }
const schedule = ref(activitySchedule({}, shiftDate(todayCn(), 3)))
const scheduleFields = [
  { label: '集合时间', date: 'date', time: 'time' },
  { label: '结束时间', date: 'endDate', time: 'endTime' },
  { label: '报名截止', date: 'deadlineDate', time: 'deadlineTime' }
]
const calendarField = ref(null), calendarMin = ref(todayCn())
function pickScheduleDate(field) { uni.hideKeyboard(); calendarMin.value = todayCn(); calendarField.value = field }
function confirmDate(value) { schedule.value[calendarField.value.date] = value; calendarField.value = null }
function normalizeTime(key) { const value = normalizeClock(schedule.value[key]); if (value) schedule.value[key] = value }
function checkedSchedule() { return checkActivitySchedule(schedule.value, editId.value ? m.value : {}) }
const scheduleError = computed(() => contentOnly.value ? '' : checkedSchedule().error || '')
// 默认用社区里正在看的城市（选的是「全部城市」时退回首页城市）
const defaultCity = () => { const c = communityCity(); return c && c !== '全部城市' ? c : currentCity() }
const city = ref(defaultCity())
async function pickCity() {
  const v = await selectCity({ value: city.value })
  if (v) city.value = v
}
const place = ref('')
async function editPlaceText() {
  const v = await prompt('集合地点', { value: place.value, placeholder: '选公共场所，例如：喜洲古镇四方街' })
  if (v !== null) place.value = v.trim().slice(0, 100)
}
// 集合地点 = 地图选点（2026-11-03 合成一行）：没填过直接打开地图；填过的先问重新选点、只改名称文字，还是清掉地图位置
async function pickPlace() {
  let map = false
  // #ifndef H5
  map = true
  // #endif
  if (!map) return editPlaceText()
  if (place.value) {
    const i = await sheet(['在地图上重新选', '只改地点名称', ...(meet.value ? ['清除地图位置'] : [])])
    if (i === 1) return editPlaceText()
    if (i === 2) { meet.value = null; return toast('已清除地图位置') }
    if (i !== 0) return
  }
  return pickMeetPoint()
}
// 集合点地图位置（选填，V49 meetLat / meetLng）：小程序里用微信地图选点；没填集合地点时顺手把选中的地名填进去。
// hadMeet = 修改的这场活动原来标过点：清除后保存要把 null 带上，服务端才会清掉（没带这两个键 = 不改）
const meet = ref(null)
let hadMeet = false
const validPoint = (lat, lng) => {
  if (lat == null || lng == null || String(lat).trim() === '' || String(lng).trim() === '') return null
  const latitude = Number(lat), longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null
  return { latitude, longitude }
}
// 地图选点：地点名称 + 地址一起填进「集合地点」，坐标存成集合点；地图打不开、没给位置权限时可以先直接写文字
async function pickMeetPoint() {
  try {
    const r = await new Promise((resolve, reject) => uni.chooseLocation({ ...(meet.value || {}), success: resolve, fail: reject }))
    const p = validPoint(r.latitude, r.longitude)
    if (!p) return alert('没有选到有效位置', '请重新在地图上搜索、确认集合点。')
    meet.value = p
    const name = String(r.name || '').trim(), addr = String(r.address || '').trim()
    const text = name && addr && !addr.includes(name) ? `${name}（${addr}）` : (name || addr)
    if (text) place.value = text.slice(0, 100)
    toast('已选好集合地点')
  } catch (error) {
    const msg = String(error?.errMsg || '')
    if (/cancel/i.test(msg)) return
    const denied = /auth deny|auth denied|authorize|permission/i.test(msg)
    if (await confirm(denied ? '需要位置授权' : '地图暂时无法打开', (denied ? '也可以去设置里允许使用位置信息再选。' : '') + '现在先直接写集合地点？报名的人会复制地点去搜索。')) return editPlaceText()
    if (denied) uni.openSetting({ fail: () => {} })
  }
}
const people = ref(10)
// 费用三选一（2026-11-03 主人：「免费，aa，输入价格」）。平台不替个人代收钱：「收费」只是标价，报名不付款，到场付给发起人
// 按钮顺序和员工端一样：免费 / 收费 / AA制（2026-11-03 主人）
const FEE_KINDS = [['free', '免费'], ['paid', '收费'], ['aa', 'AA制']]
const feeKind = ref('free')
const fee = ref('')
const aaFee = ref('')
const feeTip = computed(() => ({ free: '大家免费参加', aa: '现场平摊，平台不经手', paid: '到场付给你，平台不代收' })[feeKind.value])
const feeText = computed(() => (feeKind.value === 'paid' ? `¥${fee.value}/人（到场付给发起人）`
  : (feeKind.value === 'aa' ? (Number(aaFee.value) > 0 ? `AA制，约 ¥${aaFee.value}/人` : 'AA制（现场平摊）') : '免费')))
const safety = ref('')
const intro = ref('')
// 之前表单页的返回键直接退出整个页面（修改到一半的活动、列表都丢了）；现在修改中回到活动管理，新建回到列表
const leaveForm = () => {
  if (editId.value && m.value.activityId === editId.value) { s.value = 4; return }
  if (landing === 2) return back()
  s.value = 1
}
function toConfirm() {
  if (!activityTitle.value.trim()) return toast('请填写活动标题')
  if (!cover.value) return toast('请上传活动封面')
  if (contentOnly.value) { s.value = 3; loadStatus(); return }
  if (!place.value) return toast('请填写集合地点')
  const feeErr = feeError(feeKind.value, fee.value, aaFee.value)
  if (feeErr) return toast(feeErr)
  if (people.value < 2 || people.value > 50) return toast('人数为 2–50 人')
  const scheduleResult = checkedSchedule()
  if (scheduleResult.error) return toast(scheduleResult.error)
  s.value = 3
  loadStatus()
}

// ---------------- s=3 发布确认 ----------------
const activityNotice = "• 请遵守集合时间，迟到可能无法等候；\n• 户外活动存在一定风险，请评估自身身体状况；\n• 听从领队安排，不擅自离队，注意环保。"
const syncCommunity = ref(true)
const syncWechat = ref(false)
const agreed = ref(false)
async function readActivityNotice() { agreed.value = await readCommunityConsent('activity') }
const status = ref({})
async function loadStatus() {
  try { status.value = (await apiCommunityStatus()).data || {} } catch (e) { /* 以发布时服务端校验为准 */ }
}
const phoneText = computed(() => {
  const p = String(experience.account?.phone || '')
  return p ? p.replace(/^(\d{3})\d{4}(\d{4})$/, '$1 **** $2') : '未绑定'
})
const nickname = computed(() => experience.account?.nickname || '我')
async function editIntro() {
  const v = await prompt('活动介绍', { value: intro.value, placeholder: '路线、节奏、需要带什么（2000 字内）' })
  if (v !== null) intro.value = v.slice(0, 2000)
}
const goVerify = () => go(R.publish + '?need=phone')
const tapVerify = () => { if (!status.value.phoneVerified) goVerify() }
// 发布 / 保存请求没回来前再点一次，会建出两场一样的活动
let publishing = false
async function publish() {
  if (publishing) return
  if (!agreed.value) return toast('请先阅读并同意《活动参与须知》')
  if (!status.value.phoneVerified) await loadStatus()
  if (!status.value.phoneVerified) {
    if (await confirm('需要验证手机号', '发起活动需要先验证手机号（不会展示给其他用户），现在去验证？')) goVerify()
    return
  }
  if (!contentOnly.value) { const checked = checkedSchedule(); if (checked.error) { s.value = 2; return toast(checked.error) } }
  let payload = {
    title: activityTitle.value.trim(), cover: cover.value, ...checkedSchedule(), place: place.value,
    capacity: people.value, intro: intro.value, safetyNote: safety.value, category: editId.value ? (m.value.category || '其他') : '其他', city: city.value,
    ...feeBody(feeKind.value, fee.value, aaFee.value, '')
  }
  // 地图位置：选了点就带上；修改时原来有点、现在清除了，带上一对 null 让服务端清掉；都没有就不带（服务端保持不变）
  if (meet.value || hadMeet) Object.assign(payload, { meetLat: meet.value ? meet.value.latitude : null, meetLng: meet.value ? meet.value.longitude : null })
  if (editId.value) {
    payload.editToken = m.value.editToken
    // 此表单不编辑费用说明，省略该字段以保留原说明。
    delete payload.feeIncludes
    if (hasSignups.value) {
      const { capacity, category, feeKind, feeYuan, aaYuan, feeIncludes, ...details } = payload
      payload = { ...details, detailsOnly: true }
    }
    if (contentOnly.value) payload = { contentOnly: true, editToken: m.value.editToken, title: activityTitle.value.trim(), cover: cover.value, intro: intro.value, safetyNote: safety.value }
  }
  publishing = true
  try {
    // 已在完整须知页面阅读并确认；服务端仍校验最新版本。
    if (editId.value) {
      toast((await gated(() => apiEditActivity(editId.value, payload))).msg)
      return openManage(editId.value)
    }
    const res = (await gated(() => apiCreateActivity(payload))).data
    toast(res.status === 'open' ? '已发布，开始报名' : '已提交审核，通过后开始报名')
    // 之前「同步到社区」勾不勾都一样；现在勾上时，活动建好后再发一条关联它的找搭子动态（同意社区规则的弹窗由 gated 处理）
    if (syncCommunity.value) {
      try { const r = await gated(() => apiActivitySyncCommunity(res.activityId)); toast(r.msg || '已同步到社区') }
      catch (e) { if (!e?.silent) await alert('活动已发起', '同步到社区没有完成：' + (e?.message || '请稍后在社区发布页手动发一条')) }
    }
    if (syncWechat.value) setTimeout(shareTip, 800)
    await openManage(res.activityId)
  } catch (e) {
    fail(e, '发布失败')
  } finally {
    publishing = false
  }
}

// ---------------- s=4 活动管理 ----------------
const m = ref({ confirmed: [], waiting: [], refunds: [], trend: [] })
async function openManage(id) {
  try {
    m.value = (await apiManageActivity(id)).data
    s.value = 4
    return true
  } catch (e) {
    fail(e, '活动不存在或你不是发起人')
    return false
  }
}
const leaveManage = () => {
  if (landing === 4) return back()
  s.value = 1
  loadMine()
}
const reload = () => openManage(m.value.activityId)
const statusLabel = computed(() => m.value.phaseLabel || m.value.statusLabel || '')
const actionBusy = ref(false)
const manageActions = computed(() => {
  const st = m.value.status
  if (!m.value.activityId || ['cancelled', 'ended'].includes(st)) return []
  const ops = [{ key: 'edit', label: '编辑活动' }]
  if (st === 'open') ops.push({ key: 'pause', label: '暂停报名' })
  if (['paused', 'closed'].includes(st)) ops.push({ key: 'resume', label: '恢复报名' })
  if (['open', 'paused'].includes(st)) ops.push({ key: 'close', label: '结束报名' })
  if (['open', 'paused', 'closed'].includes(st)) ops.push({ key: 'checkin', label: '签到码签到' }, { key: 'end', label: '结束活动' })
  if (['pending', 'open', 'paused', 'closed'].includes(st)) ops.push({ key: 'cancel', label: '取消活动' })
  return ops
})
function runManageAction(action) {
  if (actionBusy.value || !manageActions.value.some(x => x.key === action)) return
  if (action === 'edit') return editActivity()
  if (action === 'checkin') return checkin()
  const tips = {
    pause: '暂停后将不再接受新报名，截止前可以恢复。确认暂停报名？',
    resume: '恢复接受报名？',
    close: '结束报名后不再接受新报名，已报名的不受影响。确认？',
    end: '确认活动已结束？结束后不能再恢复。',
    cancel: '取消后会通知所有报名的人。确认取消活动？'
  }
  return act(action, tips[action], action === 'cancel')
}
async function act(action, tip, needReason) {
  if (actionBusy.value) return
  actionBusy.value = true
  try {
    if (tip && !(await confirm('活动操作', tip))) return
    let reason
    if (needReason) {
      reason = await prompt('取消原因', { placeholder: '会通知所有报名的人' })
      if (!reason) return
    }
    toast((await apiManageAction(m.value.activityId, action, { reason })).msg)
    await reload()
  } catch (e) {
    fail(e, '操作失败')
  } finally {
    actionBusy.value = false
  }
}
function editActivity() {
  const a = m.value
  if (['cancelled', 'ended'].includes(a.status)) return toast('仅可修改尚未结束或取消的活动')
  agreed.value = false
  editId.value = a.activityId
  activityTitle.value = a.title
  schedule.value = activitySchedule(a, shiftDate(todayCn(), 3))
  place.value = a.place || ''
  meet.value = validPoint(a.meetLat, a.meetLng)
  hadMeet = !!meet.value
  city.value = a.city || city.value
  people.value = a.capacity || 10
  feeKind.value = feeKindOf(a)
  fee.value = yuanText(a.feeFen)
  aaFee.value = yuanText(a.aaFen)
  intro.value = a.intro || ''
  safety.value = a.safetyNote || ''
  // 封面、时长、报名截止也要回填：保存时 payload 总会带上这三项，不回填就会把封面清空、时长和截止重置成默认值
  cover.value = a.cover || a.img || ''
  s.value = 2
}
async function checkin() {
  const code = await prompt('签到', { placeholder: '输入参与者出示的 6 位签到码' })
  if (!code) return
  try {
    toast((await apiManageAction(m.value.activityId, 'checkin', { code })).msg)
    reload()
  } catch (e) {
    fail(e, '签到失败')
  }
}
async function broadcast() {
  const text = await prompt('群发通知', { placeholder: '例如：集合地点改到索道口东侧' })
  if (!text) return
  try {
    toast((await apiManageAction(m.value.activityId, 'broadcast', { text })).msg)
  } catch (e) {
    fail(e, '发送失败')
  }
}
// 2026-11-03 主人：「出示二维码失效，生成失败」。改成单独一页（和员工端同一页）：微信小程序码按当前版本生成，生成不出来就给普通二维码 + 6 位活动签到码
const showQr = () => go('/pages/community/activity-checkin?mode=user&id=' + m.value.activityId + '&title=' + encodeURIComponent(m.value.title || ''))
async function openGroupManage() {
  try {
    const res = (await apiChatOpen({ type: 'activity', activityId: m.value.activityId })).data
    go(R.chat + '?convId=' + res.convId)
  } catch (e) {
    fail(e, '活动通过审核后才有活动群')
  }
}
const manageTools = [
  { label: '群聊', icon: 'messages-square', click: () => openGroupManage() },
  { label: '联系成员', icon: 'user-round-plus', click: () => broadcast() },
  { label: '签到二维码', icon: 'qr-code', click: () => showQr() },
  { label: '分享活动', icon: 'share', click: () => shareTip() }
]
const av = (x) => (x.avatar ? absUrl(x.avatar) : '/static/media/profile-avatar.jpg')
const confirmedShow = computed(() => (m.value.confirmed || []).slice(0, 3).map(x => ({ ...x, avatar: av(x) })))
const waitingShow = computed(() => (m.value.waiting || []).slice(0, 3).map(x => ({ ...x, avatar: av(x) })))
const moreCount = computed(() => Math.max(0, (m.value.confirmed || []).length - 3))
const showAll = () => alert('已确认成员', (m.value.confirmed || []).map(x => `${x.name}（${x.tag}）`).join('\n') || '暂无')
// 之前「按照报名顺序 ＞」带箭头却点了没反应，候补超过 3 人时后面的人看不到
const showWaiting = () => alert('候补名单（按报名顺序）', (m.value.waiting || []).map(x => `${x.tag} · ${x.name}`).join('\n') || '暂无候补')
async function chatWith(x) {
  try {
    const res = (await gated(() => apiChatOpen({ type: 'private', userId: x.userId, source: 'activity' }))).data
    go(R.chat + '?convId=' + res.convId)
  } catch (e) {
    fail(e, '暂时无法私信')
  }
}
async function callMember(x) {
  if (!x.hasPhone) return toast('该成员还没有验证手机号')
  if (!m.value.phoneWindow) return toast('活动开始前 24 小时到结束后 24 小时内才能查看电话')
  if (!(await confirm('查看电话', `查看「${x.name}」的完整手机号会留痕，仅用于集合联络。继续？`))) return
  try {
    const res = (await apiManagePhone(m.value.activityId, x.signupId)).data
    uni.makePhoneCall({ phoneNumber: res.phone, fail: () => alert(res.name, res.phone) })
  } catch (e) {
    fail(e, '无法查看电话')
  }
}
// 11-18 返修（纯展示坐标，数值不变）：横坐标 i/(n-1) 铺满图区（图区左右各留 12），纵坐标 8 + 人数/最多×68 px（图区高 104，数字画在点上方不出框）；
//   点和点之间连一条 2px 暖棕折线：每段按屏宽算长度和角度（图区宽 = 屏宽 - 页边 24 - 卡内边距 24 - 图区内边距 24）
const chartPoints = computed(() => {
  const t = m.value.trend || []
  const max = Math.max(1, ...t.map(x => x.cumulative))
  const n = Math.max(1, t.length - 1)
  return t.map((x, i) => ({ x: t.length > 1 ? Math.round(i / n * 1000) / 10 : 50, y: Math.round(8 + (x.cumulative / max) * 68), n: x.cumulative }))
})
const plotW = (() => { try { return Math.max(120, ((uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()).windowWidth || 375) - 72) } catch (e) { return 303 } })()
const chartSegs = computed(() => chartPoints.value.slice(1).map((p, i) => {
  const a = chartPoints.value[i]
  const dx = (p.x - a.x) / 100 * plotW, dy = p.y - a.y
  return { left: a.x + '%', bottom: a.y + 'px', width: Math.round(Math.hypot(dx, dy) * 10) / 10 + 'px', transform: 'rotate(' + Math.round(-Math.atan2(dy, dx) * 1800 / Math.PI) / 10 + 'deg)' }
}))
const axisX = computed(() => { const n = Math.max(1, (m.value.trend || []).length - 1); return [0, 2, 4, 6].map(i => Math.min(100, Math.round(i / n * 1000) / 10)) })
// 活动操作的图标（纯展示）；「结束活动」「取消活动」在宫格里用提醒红（OP_DANGER 只决定颜色）
const OP_ICON = { edit: 'square-pen', pause: 'pause', resume: 'circle-play', close: 'ban', checkin: 'scan-line', end: 'flag', cancel: 'circle-x' }
const OP_DANGER = ['end', 'cancel']
const axis = computed(() => {
  const t = m.value.trend || []
  return [0, 2, 4, 6].map(i => (t[i] ? t[i].day : ''))
})

onShareAppMessage(() => (m.value.activityId ? { title: m.value.title, path: R.activity + '?id=' + m.value.activityId + '&channel=share' } : { title: '袋鼠全球青年 · 活动', path: R.activity }))
</script>

<style scoped lang="scss">
.manage-operations { margin-top:16px; padding:16px; border:1px solid var(--k-line2); border-radius:16px; background:var(--k-paper); }
.operations-title { display:block; font-size:17px; font-weight:700; margin-bottom:12px; }
.operations-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.operations-grid :deep(.k-button) { min-height:44px; }
.operations-tip { display:block; color:var(--k-muted); font-size:12px; line-height:1.6; margin-top:12px; }
.edit-note { display:block; font-size:14px; line-height:1.7; color:var(--k-muted); margin-bottom:20px; }
.mine-page { background: var(--k-bg); }.mine-body { padding: 10px 14px 100px; }.mine-head { display:flex; justify-content:flex-end; align-items:center; min-height:30px; margin:0 0 4px; }.mine-tabs { margin:0 -14px 12px;padding:0 20px; }.mine-card { padding:10px; margin-bottom:10px; border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper); }.mine-main{display:flex;gap:11px}.mine-photo{position:relative;width:154px;height:102px;flex:0 0 auto}.mine-photo image{width:154px;height:102px;border-radius:8px}.state-chip{position:absolute;left:7px;top:7px;padding:3px 7px;border-radius:4px;color:#fff;font-size:11px}.state-chip--green{background:var(--k-green)}.state-chip--ochre{background:#B27B2E}.state-chip--blue{background:var(--k-indigo)}.mine-copy{min-width:0;flex:1;display:flex;flex-direction:column;gap:7px}.mine-title{font-family:var(--k-serif);font-size:16px;font-weight:700}.kind-chip{padding:2px 5px;border:1px solid #D7C6AD;border-radius:4px;color:#936B39;font-size:11px}.meta{display:flex;align-items:center;gap:6px;color:var(--k-muted);font-size:12px}.attend{margin-top:auto;display:flex;align-items:center;gap:8px;color:var(--k-muted);font-size:11px}.avatar-stack{display:flex}.tiny-avatar{width:23px;height:23px;border:1.5px solid var(--k-paper);border-radius:50%;margin-left:-5px}.tiny-avatar:first-child{margin-left:0}.mine-actions{display:flex;justify-content:space-between;margin-top:9px;padding:0 1px}
.form-body{padding:7px 16px 102px}.form-block{margin-bottom:10px}.form-label{display:block;margin-bottom:6px;font-family:var(--k-serif);font-size:15px;font-weight:700}.required::before{content:'*';color:var(--k-red);margin-right:5px}.optional{color:var(--k-muted);font-size:12px;font-weight:400}.type-options{display:flex;gap:7px}.type-option{flex:1;height:31px;border:1px solid var(--k-line2);border-radius:7px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;font-size:13px}.type-option.active{border-color:var(--k-red);color:var(--k-red)}.form-input{height:36px;padding:0 10px;border:1px solid var(--k-line2);border-radius:7px;background:var(--k-paper);display:flex;align-items:center;justify-content:space-between;font-size:13px;color:var(--k-muted)}.form-input input{min-width:0;flex:1;height:34px;font-size:13px}.placeholder{color:var(--k-light)}.cover-row{display:flex;gap:12px;padding:7px;border:1px solid var(--k-line2);border-radius:8px;background:var(--k-paper)}.cover-upload,.cover-preview{width:50%;height:88px;box-sizing:border-box}.cover-upload{border:1px dashed var(--k-light);border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:13px}.cover-tip{color:var(--k-muted);font-size:11px}.cover-preview{position:relative}.cover-preview image{width:100%;height:88px;border-radius:7px}.cover-close{position:absolute;right:-5px;top:-6px;width:22px;height:22px;border-radius:50%;background:rgba(36,27,23,.75);display:flex;align-items:center;justify-content:center}.two-fields{display:flex;gap:8px}.two-fields .form-input{flex:1}.number-fee{display:flex;margin-bottom:10px}.number-side,.fee-side{width:50%}.number-side{padding-right:10px;border-right:1px solid var(--k-line)}.fee-side{padding-left:10px}.stepper{height:35px;border:1px solid var(--k-line2);border-radius:7px;background:var(--k-paper);display:flex;align-items:center}.stepper view{width:36px;height:35px;display:flex;align-items:center;justify-content:center}.stepper text{flex:1;text-align:center;border-left:1px solid var(--k-line);border-right:1px solid var(--k-line);font-size:17px}.field-tip{display:block;margin:5px 0 0 4px;color:var(--k-muted);font-size:11px}.safety{height:43px}
.confirm-body{padding:8px 16px 102px}.confirm-card,.option-card{padding:10px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);margin-bottom:9px}.confirm-title,.card-title{display:block;margin-bottom:6px;font-family:var(--k-serif);font-size:16px;font-weight:700}.confirm-cover{width:100%;height:80px;border-radius:7px}.confirm-copy{padding:7px 3px 1px}.confirm-name{display:block;font-family:var(--k-serif);font-size:17px;font-weight:700}.meta.big{margin-top:5px;font-size:12px}.confirm-info{display:flex;gap:30px;margin-top:7px;font-size:12px}.confirm-subtitle{display:block;margin-top:10px;font-family:var(--k-serif);font-size:14px;font-weight:700}.confirm-desc{display:block;margin-top:5px;color:var(--k-muted);font-size:11px;line-height:1.65;white-space:pre-line}.check-row{display:flex;align-items:center;gap:9px;margin-top:8px;font-size:13px}.checkbox{width:18px;height:18px;border:1.5px solid var(--k-light);border-radius:3px;display:flex;align-items:center;justify-content:center}.checkbox.checked{background:var(--k-green);border-color:var(--k-green)}.notice-card{padding-bottom:10px}.notice-text{display:block;color:var(--k-muted);font-size:11px;line-height:1.7;white-space:pre-line}.verify-row{height:37px;display:flex;align-items:center;justify-content:space-between}.verify-row>view{display:flex;align-items:center;gap:8px}.verified{padding:2px 6px;border-radius:4px;background:var(--k-green-soft);color:var(--k-green);font-size:11px}
.manage-body{padding:8px 14px 102px}.manage-hero{position:relative;padding:8px 10px 62px;border:1px solid var(--k-line2);border-radius:10px;background:var(--k-paper);display:flex;align-items:center;gap:10px}.manage-hero>image{width:50px;height:50px;border-radius:7px}.manage-copy{display:flex;flex-direction:column;gap:8px;color:var(--k-muted);font-size:11px}.manage-title{font-family:var(--k-serif);font-size:15px;font-weight:700;color:var(--k-ink)}.running{margin-left:auto;align-self:flex-start;color:var(--k-green);font-size:14px;font-weight:700}.manage-tools{position:absolute;left:0;right:0;bottom:0;height:56px;border-top:1px solid var(--k-line);display:flex}.manage-tools>view{flex:1;border-right:1px solid var(--k-line);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px}.manage-tools>view:last-child{border:0}.stats{height:60px;margin-top:10px;display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper)}.stats>view{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-right:1px solid var(--k-line);font-size:11px}.stats>view:last-child{border:0}.stat-num{font-size:19px;font-weight:700}.stat-num text{font-size:11px}.stat-num.green{color:var(--k-green)}.stat-num.ochre{color:#A56F27}.members-title{display:block;margin:13px 0 8px;font-family:var(--k-serif);font-size:17px;font-weight:700}.members-layout{display:flex;gap:9px;margin-bottom:12px}.member-groups{width:62%}.group-head{height:26px;display:flex;align-items:center;justify-content:space-between;font-size:11px}.group-head.wait{margin-top:6px}.member-row{height:50px;padding:0 6px;border:1px solid var(--k-line);border-bottom:0;background:var(--k-paper);display:flex;align-items:center;gap:6px}.member-row:first-of-type{border-radius:8px 8px 0 0}.member-row image{width:32px;height:32px;border-radius:50%}.member-row>view{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px;color:var(--k-muted);font-size:11px}.member-name{color:var(--k-ink);font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.member-tag{padding:2px 5px;border-radius:4px;background:var(--k-green-soft);color:var(--k-green);font-size:11px;white-space:nowrap}.member-tag.leader{background:var(--k-ochre-soft);color:#926226}.expand-more{height:26px;border:1px solid var(--k-line);border-radius:0 0 8px 8px;display:flex;align-items:center;justify-content:center;color:var(--k-muted);font-size:11px}.chart{width:38%;height:210px;margin-top:26px;padding:10px 8px;border:1px solid var(--k-line2);border-radius:9px;background:var(--k-paper);box-sizing:border-box}.chart-title{display:block;font-family:var(--k-serif);font-size:14px;font-weight:700}.chart-sub{display:block;margin-top:4px;color:var(--k-muted);font-size:11px}.chart-area{position:relative;height:130px;margin-top:3px;border-bottom:1px solid var(--k-line2);background:linear-gradient(90deg,transparent 24%,var(--k-line) 25%,transparent 26%,transparent 49%,var(--k-line) 50%,transparent 51%,transparent 74%,var(--k-line) 75%,transparent 76%)}.chart-line{position:absolute;left:8px;right:6px;bottom:14px;height:2px;background:var(--k-red);transform:rotate(-33deg);transform-origin:left center}.point{position:absolute;width:7px;height:7px;border:2px solid var(--k-red);border-radius:50%;background:var(--k-paper)}.point text{position:absolute;left:-4px;top:-17px;font-size:11px}.chart-axis{display:flex;justify-content:space-between;margin-top:5px;color:var(--k-muted);font-size:11px}
.member-groups{width:calc(62% - 5px);min-width:0}.chart{width:calc(38% - 5px);overflow:hidden}.member-row{height:44px}.member-row image{width:29px;height:29px}.chart{height:192px}.chart-area{height:113px}
.manage-copy{flex:1;min-width:0}.empty-tip{display:block;padding:32px 12px;text-align:center;color:var(--k-muted);font-size:13px}
.mine-card--ended{opacity:.6}.attend--deadline{color:var(--k-ink2);font-size:12px}
.meet-row{display:flex;align-items:center;gap:5px;min-height:28px;padding:0 2px;color:var(--k-red);font-size:12px}.meet-row__text{min-width:0;flex:1}.meet-row__clear{padding:4px 2px 4px 10px;color:var(--k-muted)}
.create-link{display:flex;align-items:center;gap:3px;color:var(--k-red);font-size:14px;font-weight:600}.reject-reason{display:flex;align-items:flex-start;gap:6px;margin-bottom:8px;padding:10px;border-radius:8px;background:var(--k-paper2);color:var(--k-alert);font-size:13px;line-height:1.6}.reject-reason text{flex:1;min-width:0;overflow-wrap:anywhere}
.form-body .form-block{margin-bottom:7px}.form-body .form-label{margin-bottom:4px}.form-body .form-input{height:33px}.form-body .form-input input{height:31px}.form-body .safety{height:37px}.form-body .number-fee{margin-bottom:7px}.form-body .field-tip{margin-top:3px}.form-submit{margin-top:-9px}.confirm-body{padding-top:7px}.confirm-body .confirm-card{padding:8px;margin-bottom:6px}.confirm-body .option-card{padding:6px 8px;margin-bottom:6px}.confirm-body .confirm-cover{height:62px}.confirm-body .confirm-copy{padding-top:3px}.confirm-body .confirm-subtitle{margin-top:4px}.confirm-body .confirm-desc{font-size:11px;line-height:1.35}.confirm-body .check-row{margin-top:5px}.confirm-body .notice-text{line-height:1.35}.confirm-body .verify-row{height:30px}.confirm-submit{margin-top:0}
@import './activity-refined.scss';
/* 费用三选一（2026-11-03）：和人数并排的三个按钮，选中暖棕底白字 */
.fee-seg{display:flex;gap:4px;min-height:48px}.fee-seg__item{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--k-line2);border-radius:12px;background:var(--k-paper);font-size:15px;color:var(--k-ink)}
.fee-seg__item.on{border-color:var(--k-red-deep);background:var(--k-red-deep);color:var(--k-paper);font-weight:600}
.paste-card{padding:14px}.paste-card textarea{width:100%;height:70px;margin:8px 0;padding:10px;box-sizing:border-box;border-radius:8px;background:var(--k-fill);font-size:14px}.paste-card button{margin:0 0 0 auto;width:max-content;padding:0 14px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:13px;line-height:32px}.paste-card button::after{border:0}
</style>

<style scoped>
.manage-body .manage-hero { display:grid; grid-template-columns:64px minmax(0,1fr); gap:12px; }
.manage-status-row { grid-column:1 / -1; display:flex; justify-content:space-between; align-items:center; gap:12px; font-size:13px; color:var(--k-muted); }
.manage-status-row .running { margin:0; white-space:nowrap; }
</style>

<style scoped>
.activity-schedule { margin:16px 0 24px; }
.schedule-tip { display:block; font-size:13px; line-height:1.65; color:var(--k-muted); margin-bottom:16px; }
.schedule-field + .schedule-field { margin-top:16px; }
.schedule-label { display:block; font-size:15px; font-weight:600; margin-bottom:8px; }
.schedule-inputs { display:flex; gap:10px; }
.schedule-date { flex:1; min-width:0; display:flex; align-items:center; justify-content:space-between; min-height:46px; padding:0 12px; border:1px solid var(--k-line2); border-radius:10px; font-size:15px; background:var(--k-paper); }
.schedule-clock { box-sizing:border-box; width:86px; height:48px; padding:0 8px; border:1px solid var(--k-line2); border-radius:10px; font-size:16px; text-align:center; background:var(--k-paper); }
.schedule-error { display:block; color:var(--k-alert); font-size:13px; line-height:1.6; margin-top:12px; }
</style>

<style scoped lang="scss">
/* ==========================================================================
   11-18 第三轮精修：比例和间距。「创办活动 / 发布确认」是填写页，字号不缩，只把字段收进白卡、输入框换成浅灰实底（不描边、不套框）。
   ========================================================================== */
.k-page.mine-page {
  /* 我的活动：右上「创办活动」是 28 高浅棕小胶囊，和页签同一条白底 */
  .mine-body { padding: 0 12px 100px; }
  .mine-head { min-height: 0; margin: 0 -12px; padding: 8px 12px 0; }
  .create-link { height: 28px; padding: 0 12px; gap: 4px; border: 0; border-radius: 14px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 12px; font-weight: 500; }
  .create-link :deep(.k-icon) { width: 14px !important; height: 14px !important; }
  .mine-tabs { margin-bottom: 12px; }
  /* 「创办活动」小胶囊收进页签同一行的右端，省掉单独一行；页签改成靠左排，窄屏（<360）退回原来的上下两行 */
  .mine-body { position: relative; }
  .mine-head { position: absolute; top: 0; right: 12px; z-index: 2; height: 40px; margin: 0; padding: 0; background: transparent; }
  .mine-tabs { margin: 0 -12px 12px; padding: 0 4px; justify-content: flex-start; }
  .mine-tabs .k-tabs__item { flex: 0 0 auto; padding: 10px 12px; }
  @media (max-width: 359px) {
    .mine-head { position: static; height: auto; justify-content: flex-end; margin: 0 -12px; padding: 8px 12px 0; }
    .mine-tabs { padding: 0; justify-content: space-between; }
    .mine-tabs .k-tabs__item { flex: 1; padding: 10px 0; }
  }
  /* 空状态：56 的浅棕方块 + 32 线性图标 + 一句话 */
  .empty-tip { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 16px; color: var(--k-ink2); font-size: 14px; font-weight: 500; text-align: center; }
  .empty-ico { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 16px; background: var(--k-red-soft); }

  /* 创办活动：每个字段一张白卡（圆角 12、内边距 12），卡里的输入框浅灰实底、圆角 8、不描边 */
  .form-body { padding: 8px 12px 102px; }
  .form-body .edit-note { margin: 4px 4px 12px; }
  .form-body .form-block { margin-bottom: 8px; padding: 14px 12px 12px; border-radius: 12px; background: var(--k-paper); }
  .form-body .form-label { margin-bottom: 10px; line-height: 24px; }
  .form-body .form-input { border: 0; border-radius: 8px; background: var(--k-page); box-shadow: none; }
  .form-body .cover-row, .form-body .cover-row--selected { min-height: 0; padding: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .form-body .cover-row:not(.cover-row--selected) .cover-upload { flex: 1 1 100%; min-height: 112px; background: var(--k-page); }
  .form-body .cover-upload { min-height: 112px; border: 0; border-radius: 8px; background: var(--k-page); gap: 4px; }
  .form-body .activity-schedule { margin: 0 0 8px; padding: 14px 12px 12px; border-radius: 12px; background: var(--k-paper); }
  .form-body .schedule-tip { margin-bottom: 14px; }
  .form-body .schedule-field + .schedule-field { margin-top: 14px; }
  .form-body .schedule-inputs { gap: 8px; }
  .form-body .schedule-date, .form-body .schedule-clock { border: 0; border-radius: 8px; background: var(--k-page); }
  .form-body .number-fee { margin-bottom: 8px; padding: 14px 12px 12px; border-radius: 12px; background: var(--k-paper); }
  .form-body .fee-side { padding-left: 12px; }
  .form-body .stepper { border: 0; border-radius: 8px; background: var(--k-page); }
  .form-body .fee-seg__item { border-color: transparent; border-radius: 8px; background: var(--k-page); }
  .form-body .fee-seg__item.on { border-color: var(--k-red-line); background: var(--k-red-soft); }
  .form-body .form-submit { margin-top: 16px; }
  .form-body .form-submit :deep(.k-button), .confirm-body .confirm-submit :deep(.k-button) { min-height: 48px; height: 48px; border-radius: 24px; font-size: 16px; }

  /* 发布确认：三张卡的标题 16 / 700，卡与卡 8；预览卡里时间、地点、名额三行同一个样子（图标 16 + 14 号二级墨） */
  .confirm-body { padding: 8px 12px 102px; }
  .confirm-body .confirm-card, .confirm-body .option-card { margin-bottom: 8px; padding: 14px 12px 12px; }
  .confirm-body .confirm-title, .confirm-body .card-title { margin-bottom: 10px; font-size: 16px; line-height: 22px; font-weight: 700; color: var(--k-ink); }
  .confirm-body .confirm-cover { border-radius: 8px; }
  .confirm-body .confirm-copy { padding-top: 12px; }
  .confirm-body .confirm-name { font-size: 18px; line-height: 26px; }
  .confirm-body .meta.big, .confirm-body .confirm-info { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 14px; line-height: 20px; color: var(--k-ink2); }
  .confirm-body .meta.big :deep(.k-icon), .confirm-body .confirm-info :deep(.k-icon) { width: 16px !important; height: 16px !important; flex: 0 0 auto; }
  .confirm-body .confirm-info > text { font-size: 14px; color: var(--k-ink2); }
  .confirm-body .confirm-info > text + text { margin-left: 6px; }
  .confirm-body .confirm-subtitle { margin-top: 14px; font-size: 14px; font-weight: 600; color: var(--k-ink); }

  /* 活动管理：数据格单位（/10、人）统一 11 号浅灰；报名趋势改成标题在上、图撑满整行 */
  .manage-body .stat-num > text { margin-left: 1px; font-size: 11px; font-weight: 400; color: var(--k-muted); }
  .manage-body .chart { display: block; margin-top: 8px; padding: 14px 12px 12px; }
  .manage-body .chart .chart-title { display: block; font-size: 16px; line-height: 22px; font-weight: 700; color: var(--k-ink); }
  .manage-body .chart .chart-sub { display: block; margin-top: 2px; font-size: 12px; color: var(--k-muted); }
  .manage-body .chart .chart-area { position: relative; height: 104px; margin-top: 12px; background-color: var(--k-page); border-radius: 8px; }
  .manage-body .chart .chart-axis { display: flex; justify-content: space-between; margin-top: 6px; padding: 0 2px; font-size: 11px; color: var(--k-muted); font-variant-numeric: tabular-nums; }
}
</style>
<style scoped lang="scss">
/* ==========================================================================
   11-18 返修第 1 轮（按独立评审）：列表卡标题占满、空状态不套白卡、标题框两行、确认页 16:9 封面 + 设置合成一张卡、
   活动管理：操作改成图标宫格（结束 / 取消收到底部文字链）、私信电话 36 点击区、报名趋势铺满并连线
   ========================================================================== */
.k-page.mine-page {
  /* 我的活动：类型标签挪到标题下面，标题占满文字列、最多两行；信息行、人数行之间都是 4 */
  .mine-copy { gap: 4px; justify-content: flex-start; }
  .mine-copy > .k-between { flex-direction: column; align-items: flex-start; gap: 4px; }
  .mine-copy > .k-between .kind-chip { margin-top: 0; }
  .mine-copy .mine-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .mine-copy .attend { margin-top: 0; }
  /* 空状态：不套白卡，放在列表区约三分之一高处；56 方块 + 32 图标 + 14/500 标题 + 12 说明 */
  .empty-tip { margin: 80px 0 0; padding: 0 16px; border-radius: 0; background: transparent; gap: 0; }
  .empty-tip .empty-ico { margin-bottom: 12px; }
  .empty-tip .empty-sub { margin-top: 4px; font-size: 12px; font-weight: 400; line-height: 1.6; color: var(--k-muted); }

  /* 创办活动：标题限 30 字，框改成 64 高两行，字数放右下（填写页字号 16 不缩） */
  .form-body .activity-title-input { display: flex; align-items: flex-end; gap: 8px; height: auto; min-height: 64px; padding: 8px 12px; box-sizing: border-box; }
  .form-body .activity-title-input textarea { flex: 1; min-width: 0; height: 48px; padding: 0; font-size: 16px; line-height: 24px; }
  .form-body .activity-title-input > text:last-child { flex: 0 0 auto; line-height: 24px; font-size: 12px; color: var(--k-muted); }

  /* 发布确认：预览是焦点（16:9 封面）；同步来源 / 参与须知 / 手机号校验合成一张设置卡，项与项之间发丝线 */
  .confirm-body .confirm-card { margin-bottom: 12px; }
  .confirm-body .confirm-cover, .confirm-body .confirm-cover--empty { width: 100%; height: calc((100vw - 48px) * 9 / 16); }
  .confirm-body .option-card { position: relative; margin-bottom: 0; border-radius: 0; box-shadow: none; }
  .confirm-body .confirm-card + .option-card { border-radius: 12px 12px 0 0; }
  .confirm-body .option-card.verify-card { margin-bottom: 8px; border-radius: 0 0 12px 12px; }
  .confirm-body .option-card + .option-card::before { content: ''; position: absolute; left: 12px; right: 12px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
  .confirm-body .option-card .card-title { margin-bottom: 6px; font-size: 15px; line-height: 22px; }
  .verify-gap { flex: 0 0 16px; width: 16px; }

  /* 活动管理 · 顶部：时间单独一行，第二行城市 · 集合 */
  .manage-copy .manage-when { color: var(--k-ink2); }
  /* 活动操作：常用的做成 4 列图标宫格（40 浅棕方块 + 22 图标 + 12 字），结束 / 取消活动收到底部做 13 号文字链 */
  .manage-operations { padding: 12px; }
  .operations-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .op-cell { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 4px 0; color: var(--k-ink2); font-size: 12px; line-height: 16px; text-align: center; white-space: nowrap; }
  .op-ico { width: 40px; height: 40px; border-radius: 12px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
  .op-cell.is-disabled, .op-link.is-disabled { opacity: .45; }
  .operations-tip { margin-top: 12px; font-size: 12px; line-height: 1.6; }
  .operations-danger { position: relative; display: flex; align-items: center; gap: 24px; margin-top: 12px; padding-top: 12px; }
  .operations-danger::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
  .op-link { color: var(--k-ink2); font-size: 13px; line-height: 20px; }
  .op-link--alert { color: var(--k-alert); }
  /* 成员行：私信、电话各一个 36×36 点击区，图标 18；副标题单行省略 */
  .member-row { gap: 8px; }
  .member-row > view.member-act { flex: 0 0 36px; width: 36px; height: 36px; min-width: 0; flex-direction: row; align-items: center; justify-content: center; gap: 0; border-radius: 18px; }
  .member-row > view.member-act + view.member-act { margin-left: -4px; }
  .member-row > view:not(.member-act) > text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* 报名趋势：点从图区左边铺到右边（左右各留 12），数字在点上方 4，点之间 2px 暖棕折线；日期和点 0/2/4/6 同一横坐标 */
  .manage-body .chart .chart-area { height: 104px; background-image: none; background-color: var(--k-bg); }
  .chart-plot { position: absolute; left: 12px; right: 12px; top: 0; bottom: 0; }
  .chart-seg { position: absolute; height: 2px; margin-bottom: -1px; border-radius: 1px; background: var(--k-red); transform-origin: 0 50%; }
  .manage-body .chart .point { box-sizing: border-box; width: 8px; height: 8px; margin: 0; border: 2px solid var(--k-red); border-radius: 50%; background: var(--k-paper); transform: translate(-50%, 50%); }
  .manage-body .chart .point:last-child { background: var(--k-red); }
  .manage-body .chart .point > text { position: absolute; left: 50%; top: auto; bottom: 10px; transform: translateX(-50%); color: var(--k-ink2); font-size: 11px; line-height: 14px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .manage-body .chart .chart-axis { position: relative; display: block; height: 16px; margin: 6px 12px 0; padding: 0; }
  .manage-body .chart .chart-axis > text { position: absolute; top: 0; transform: translateX(-50%); line-height: 16px; white-space: nowrap; }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 2 轮：我的活动卡只留一颗描边主按钮、其余是 13 号文字按钮（发丝竖线隔开）；已结束只把字变灰、图上盖 30% 白；
   创办活动三张卡；320 宽费用分段单独一行；「去验证」暖棕文字、「公开昵称」灰底；活动管理一个宫格、卡片标题 16/600、区块标题对齐卡片外沿、趋势图空提示 */
.k-page.mine-page {
  .mine-actions { display: flex; align-items: center; justify-content: flex-end; gap: 0; }
  .mine-actions :deep(.k-button) { height: 32px; min-height: 32px; padding: 0 12px; border: 0; border-radius: 16px; background: transparent; box-shadow: none; color: var(--k-ink2); font-size: 13px; font-weight: 400; }
  .mine-actions :deep(.k-button + .k-button) { box-shadow: inset .5px 0 0 var(--k-line2); border-radius: 0; }
  .mine-actions :deep(.k-button:last-child) { margin-left: 8px; border: 1px solid var(--k-red-line); border-radius: 16px; box-shadow: none; color: var(--k-red-deep); font-weight: 500; }
  .mine-card--ended { opacity: 1; }
  .mine-card--ended .mine-title, .mine-card--ended .meta, .mine-card--ended .attend { color: var(--k-muted); }
  .mine-card--ended .mine-photo::after { content: ""; position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: var(--am-veil); pointer-events: none; }
  .mine-photo { position: relative; }

  .form-body .form-group { margin-bottom: 12px; padding: 0 12px; border-radius: 12px; background: var(--k-paper); }
  .form-body .form-group > .form-block, .form-body .form-group > .activity-schedule, .form-body .form-group > .number-fee { position: relative; margin: 0; padding: 16px 0; border-radius: 0; background: transparent; }
  .form-body .form-group > view + view::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
  .form-body .form-group > .edit-note { display: block; padding: 12px 0 0; margin: 0; }
  @media (max-width: 359px) {
    .form-body .number-fee { flex-direction: column; align-items: stretch; gap: 16px; }
    .form-body .number-side, .form-body .fee-side { width: 100%; padding-left: 0; }
    .form-body .fee-seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  }

  .confirm-body .verified--todo { padding: 0; background: transparent; color: var(--k-red); font-size: 13px; font-weight: 500; }
  .confirm-body .verified--plain { background: var(--k-paper2); color: var(--k-ink2); }

  .manage-body .manage-hero { padding-bottom: 12px; }
  .manage-operations { margin-top: 12px; padding: 16px 12px 12px; }
  .operations-grid { row-gap: 12px; }
  .operations-title, .manage-body .chart .chart-title { margin-bottom: 12px; font-family: var(--k-sans); font-size: 16px; line-height: 22px; font-weight: 600; color: var(--k-ink); }
  .manage-body .chart .chart-title { margin-bottom: 0; }
  .members-title { margin: 20px 0 10px; padding-left: 0; font-family: var(--k-sans); font-size: 16px; line-height: 22px; font-weight: 600; }
  .chart-empty { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; font-size: 12px; color: var(--k-muted); }
}
</style>
<style scoped lang="scss">
/* 11-18 第四轮：活动管理顶卡——「当前状态」右边的状态做成 11 号浅棕胶囊，时间 / 地点退成 13 号灰字；
   「报名成员」标题并进成员白卡顶部（和活动操作、报名趋势同一种放法）；候补标签浅棕；候补行私信按钮和上面的私信同一列 */
.k-page.mine-page {
  .manage-status-row .running { height: 20px; padding: 0 8px; border-radius: 10px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 11px; font-weight: 500; line-height: 20px; }
  .manage-copy .manage-when, .manage-copy > text { font-size: 13px; line-height: 20px; color: var(--k-muted); }
  .members-title { margin: 20px 0 0; padding: 16px 12px 4px; border-radius: 12px 12px 0 0; background: var(--k-paper); }
  .members-title + .members-layout .member-groups { border-radius: 0 0 12px 12px; }
  .group-head.wait ~ .member-row .member-tag { background: var(--k-red-soft); color: var(--k-red-deep); }
  .operations-tip { word-break: keep-all; overflow-wrap: anywhere; }
  .group-head.wait ~ .member-row > .member-act:last-child { margin-right: 32px; }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 5 轮：候补行没有电话钮，私信钮让出电话那一列（36 宽 + 4 间距），和上面已确认行的私信对在同一列；
   没数据时右上角的状态胶囊不显示空块 */
.k-page.mine-page {
  .group-head.wait ~ .member-row > .member-act:last-child { margin-right: 40px; }
  .manage-status-row .running.is-empty { display: none; }
}
</style>
<style scoped lang="scss">
/* 11-18 返修第 6 轮：活动操作照改前一个循环排出全部操作（结束 / 取消活动用提醒红的方块）；封面上传区改成白底虚线框，不像第二个输入框；
   没有集合地点和城市时不留孤零零的「集合：」 */
.k-page.mine-page {
  .op-cell--danger .op-ico { background: var(--k-alert-soft); }
  .op-cell--danger > text { color: var(--k-alert); }
  .form-body .cover-upload, .form-body .cover-row:not(.cover-row--selected) .cover-upload { min-height: 96px; border: 1px dashed var(--k-line2); background: var(--k-paper); }
  .manage-copy text.is-empty { display: none; }
}
</style>
<style scoped lang="scss">
/* 11-18 夜 第四轮精修（以微信实拍为准）：
   我的活动——「创办活动」退成和页签同一基线的暖棕文字钮（无底）；列表为空时空状态放进白卡；
   活动管理——没有数据时不再把状态和「集合：」藏起来，标题、时间、状态位置放骨架条；卡与卡间距统一 12；报名趋势空图去掉灰底 */
.k-page.mine-page {
  .create-link { height: 28px; padding: 0 0 0 8px; border: 0; border-radius: 0; background: transparent; color: var(--k-red); font-size: 13px; font-weight: 500; gap: 4px; }
  .mine-body .empty-tip { margin: 12px 0 0; padding: 32px 16px; border-radius: 12px; background: var(--k-paper); }
  .empty-tip > text:not(.empty-sub) { font-size: 14px; font-weight: 500; color: var(--k-ink); }
  .manage-status-row .running.is-empty { display: inline-block; width: 52px; height: 20px; border-radius: 10px; background: var(--k-fill); }
  .manage-copy text.is-empty { display: block; }
  .manage-hero--blank .manage-title { display: block; width: 140px; height: 16px; border-radius: 6px; background: var(--k-fill); }
  .manage-hero--blank .manage-when { display: block; width: 180px; height: 12px; margin-top: 8px; border-radius: 6px; background: var(--k-fill); }
  .manage-hero--blank .kind-chip { display: inline-block; width: 32px; height: 16px; padding: 0; border-radius: 4px; background: var(--k-fill); }
  .manage-body .manage-operations, .manage-body .stats, .manage-body .chart { margin-top: 12px; }
  .manage-body .members-title { margin-top: 12px; }
  .manage-body .chart .chart-area { background-color: transparent; }
}
</style>
<style scoped lang="scss">
/* 11-18 夜 第四轮精修（补）：发布确认没封面时，16:9 浅棕块里只放一个约 28 宽的小图标（不再是 66 的大图标像破图）；
   「点击填写活动介绍…」整行可点：暖棕字 + 右侧箭头 + 按压态 */
.k-page.mine-page {
  .confirm-cover-box--empty { display: flex; align-items: center; justify-content: center; width: 100%; height: calc((100vw - 48px) * 9 / 16); border-radius: 8px; background: var(--k-red-soft); }
  .confirm-body .confirm-cover-box--empty .confirm-cover--empty { width: 100px; height: 75px; border-radius: 0; background: transparent; }
  .confirm-desc-row { display: flex; align-items: flex-start; gap: 4px; }
  .confirm-desc-row .confirm-desc { flex: 1; min-width: 0; }
  .confirm-desc-row--todo .confirm-desc { color: var(--k-red); }
  .confirm-desc-row :deep(.k-icon) { margin-top: 3px; }
}
</style>
<style scoped lang="scss">
/* 11-19 第四轮返修：发布确认没封面时，外框和占位图底色融成一块（--k-line 底 + darken 混合，色差不到 2，看不出里面那块小矩形的边）；
   已结束的活动封面降饱和；「上传封面图」14/500 ink2、说明 12 号灰字；活动管理没数据时「集合：」后面接一条骨架条 */
.k-page.mine-page {
  .confirm-cover-box--empty { background: var(--k-line); }
  .confirm-body .confirm-cover-box--empty .confirm-cover--empty { mix-blend-mode: darken; }
  .mine-card--ended .mine-photo { filter: saturate(.4); }
  .mine-card--ended .mine-title { color: var(--k-ink2); }
  .form-body .cover-upload > text { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
  .form-body .cover-upload > .cover-tip { font-size: 12px; font-weight: 400; line-height: 18px; color: var(--k-muted); }
  .manage-hero--blank .manage-copy > text:last-child::after { content: ''; display: inline-block; width: 100px; height: 12px; margin-left: 4px; vertical-align: -1px; border-radius: 6px; background: var(--k-fill); }
}
</style>
<style scoped lang="scss">
/* 11-19 微信实拍返修：我的活动页签条和顶栏一体（页签条透明、下沿发丝线）；空状态不套白卡（全组统一）；
   创办活动——时间卡说明 12/18、下距 16，封面上传格去掉虚线框改浅底；发布确认——「活动介绍」待填字退成 ink2，只留箭头；
   活动管理——四格数字定高，带单位和不带单位的格子底线对齐 */
.k-page.mine-page {
  .mine-tabs { background: transparent; box-shadow: inset 0 -.5px 0 var(--k-line); }
  .mine-body .empty-tip { margin: 24px 0 0; padding: 24px 16px; border-radius: 0; background: transparent; }
  .form-body .schedule-tip { margin-bottom: 16px; font-size: 12px; line-height: 18px; }
  .form-body .cover-upload, .form-body .cover-row:not(.cover-row--selected) .cover-upload { min-height: 96px; border: 0; border-radius: 12px; background: var(--k-fill); }
  .confirm-desc-row--todo .confirm-desc { color: var(--k-ink2); }
  .manage-body .stat-num { height: 26px; line-height: 26px; }
  .manage-body .stats > view > text:first-child { line-height: 16px; }
}
</style>
