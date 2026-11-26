<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="linkPanel ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点。「成果链接」面板开着时锁住后面的页面滚动（面板自己超高时要能滚，不能用 catchtouchmove 拦）；
       只在小程序里加：H5 的 page-meta 关面板时清不掉这条样式，顶栏会从此不吸顶（同找搭子筛选、岗位列表的做法），H5 见 lockPageScroll -->
  <!-- #endif -->
  <view class="k-page deliver" :class="$userSurface">
    <k-topbar title="任务交付" back />
    <k-subscribe scenes="online_task" label="订阅任务进展提醒" />

    <view class="k-body k-pad-bottom">
      <!-- 交付步骤条：报名 → 已接单 → 素材已发 → 已交付 → 验收通过 → 结算（服务端按现有状态和素材发送时间推出来） -->
      <view v-if="flowSteps.length" class="flow">
        <view class="flow__steps">
          <view v-for="(stepItem, stepIndex) in flowSteps" :key="stepItem.key" class="flow__step" :class="'is-' + stepItem.state">
            <view class="flow__track">
              <view v-if="stepIndex > 0" class="flow__line flow__line--l" />
              <view v-if="stepIndex < flowSteps.length - 1" class="flow__line flow__line--r" />
              <view class="flow__dot"><k-icon v-if="stepItem.state === 'done'" name="check" :size="12" color="white" /><text v-else>{{ stepItem.state === 'skipped' ? '–' : stepIndex + 1 }}</text></view>
            </view>
            <text class="flow__label">{{ stepItem.label }}</text>
            <text class="flow__time">{{ stepItem.time || '　' }}</text>
          </view>
        </view>
        <text v-if="a.flow.tip" class="flow__tip">{{ a.flow.tip }}</text>
      </view>

      <k-card :pad="16" class="k-mt12">
        <view class="k-between">
          <text class="task-title">{{ a.title || '加载中…' }}</text>
          <k-chip tone="ochre"><text>{{ a.taskType || '线上任务' }}</text></k-chip>
        </view>
        <view class="stats k-mt12">
          <view><text class="k-meta">{{ a.rewardMode==='per_item' && !a.settlement ? '最高报酬' : '佣金' }}</text><text class="stats__value k-red">{{ a.commission || '—' }}</text></view>
          <view><text class="k-meta">截止时间</text><text class="stats__value">{{ a.deadline || '未设置' }}</text></view>
          <view><text class="k-meta">当前状态</text><text class="stats__value">{{ a.stateLabel || '—' }}</text></view>
        </view>
        <view v-if="countdown" class="countdown k-mt8" :class="{ 'countdown--urgent': countdownUrgent }"><k-icon name="clock" :size="14" :color="countdownUrgent ? 'alert' : 'muted'" /><text>{{ countdown }}</text></view>
        <view class="k-divider k-mt12" />
        <view class="row k-mt12"><text class="row__label">交付物</text><text class="row__value">{{ a.deliverables || '—' }}</text></view>
        <view class="row k-mt8"><text class="row__label">验收标准</text><text class="row__value">{{ a.criteria || '以任务说明为准' }}</text></view>
        <text v-if="a.rewardText" class="reward-note k-mt8 block">{{ a.rewardText }}</text>
        <view v-if="a.announcement" class="notice k-mt12"><k-icon name="info" :size="14" color="muted" /><text>{{ a.announcement || '' }}</text></view>
        <!-- 线上任务须知（后台「小程序公告」里固定标识 online-guide 那一条）：接单、交成果、验收、结算的完整说明 -->
        <view class="guide-link k-mt10" hover-class="k-press" @click="openOnlineGuide"><k-icon name="book-open" :size="16" color="red" /><text class="guide-link__title">线上任务须知</text><text class="guide-link__sub">从接单到结算怎么走</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
        <view v-if="a.appId" class="contact-link"><k-button class="k-mt12" type="outline" block icon="message-circle" @click="go(R.chat + '?appId=' + a.appId)">{{ a.contactSpecialist ? '联系袋鼠工作人员' : '联系当地主理人' }}</k-button></view>
      </k-card>
      <!-- 门店素材：门店接单后发给你的文字和图片（可以多次补发）。没发时提示先私信沟通；不等素材也能提交成果 -->
      <k-card v-if="showMaterials" :pad="16" class="k-mt12">
        <view class="k-between"><text class="section-title">门店素材</text><text v-if="materials.length" class="k-meta">共 {{ materials.length }} 次</text></view>
        <view v-if="!materials.length && !a.material" class="material-empty k-mt10"><k-icon name="message-circle" :size="16" color="muted" /><text>门店还没发素材，可以先私信{{ a.contactSpecialist ? '袋鼠工作人员' : '当地主理人' }}沟通</text></view>
        <view v-if="a.material" class="material k-mt10" @click="copyMaterial"><view class="k-between"><text class="material__head">任务参考素材 · {{ a.materialName || '参考素材' }}</text><text class="k-link">复制链接</text></view></view>
        <view v-for="(materialItem, materialIndex) in materials" :key="materialItem.materialId" class="material k-mt10">
          <view class="k-between"><text class="material__head">{{ materialIndex === 0 ? '素材' : '补充素材 ' + materialIndex }} · {{ materialItem.time }}</text><text v-if="materialItem.content" class="k-link" @click="copyText(materialItem.content)">复制文字</text></view>
          <!-- 文字最多 1 万字（V41）：超过 300 字先显示一段，点「展开全部」看全文 -->
          <text v-if="materialItem.content" class="material__text k-mt8">{{ openTexts['m' + materialItem.materialId] ? materialItem.content : fold(materialItem.content) }}</text>
          <text v-if="(materialItem.content || '').length > 300" class="k-link block k-mt8" @click="toggleText('m' + materialItem.materialId)">{{ openTexts['m' + materialItem.materialId] ? '收起' : '展开全部' }}</text>
          <view v-if="materialItem.images.length" class="photos k-mt8"><image v-for="(materialImg, imgIndex) in materialItem.images" :key="materialImg" :src="abs(materialImg)" mode="aspectFill" @click="preview(materialItem.images, imgIndex)" /></view>
          <!-- 门店随素材发来的文件（V41）：文档在小程序里打开；压缩包发到微信聊天 / 保存到电脑；都能复制下载链接 -->
          <view v-for="matFile in materialItem.files || []" :key="matFile.fileId" class="mfile k-mt8">
            <view class="mfile__head"><k-icon :name="matFile.kind === 'archive' ? 'archive' : 'file-text'" :size="18" color="muted" /><text class="mfile__name">{{ matFile.name }}</text><text class="k-meta">{{ matFile.sizeLabel }}</text></view>
            <text v-if="fileBusy[matFile.fileId]" class="k-meta block k-mt8">{{ fileBusy[matFile.fileId] }}</text>
            <view class="mfile__acts k-mt8"><text v-for="actName in fileActs(matFile)" :key="actName" class="mfile__act" @click="onFileAct(matFile, actName)">{{ actName }}</text></view>
          </view>
          <text class="material__from k-mt8">{{ materialItem.sentBy }} 发送{{ materialItem.images.length ? ' · 点图片可放大查看' : '' }}</text>
        </view>
        <text v-if="hasArchive" class="material__tip k-mt10">小程序里打不开压缩包：可以发到微信「文件传输助手」，在电脑上下载解压；或复制下载链接，用手机或电脑的浏览器下载。只打开门店发来的文件。</text>
      </k-card>
      <k-card v-if="a.settlement" :pad="16" class="k-mt12">
        <view class="k-between"><text class="section-title">结算单</text><k-chip :tone="a.settlement.status === 'confirmed' ? 'green' : 'ochre'"><text>{{ a.settlement.statusLabel }}</text></k-chip></view>
        <view class="row k-mt10"><text class="row__label">结算单号</text><text class="row__value">{{ a.settlement.settleNo }}</text></view>
        <view class="row k-mt8"><text class="row__label">结算金额</text><text class="row__value k-red">{{ a.settlement.amount }}</text></view>
        <text v-if="a.settlement.qualifiedCount" class="k-meta k-mt8 block">{{ a.settlement.qualifiedCount }} 条合格 × ¥{{ (a.settlement.unitRewardFen/100).toFixed(2) }} = {{ a.settlement.amount }}</text>
        <view v-if="a.settlement.method" class="row k-mt8"><text class="row__label">付款方式</text><text class="row__value">{{ a.settlement.method }}{{ a.settlement.ref ? ' · ' + a.settlement.ref : '' }}</text></view>
        <view v-if="a.settlement.registeredTime" class="row k-mt8"><text class="row__label">登记时间</text><text class="row__value">{{ a.settlement.registeredTime }}</text></view>
        <view v-if="a.settlement.voucher" class="row k-mt8" @click="previewVoucher"><text class="row__label">付款凭证</text><text class="row__value k-link">点击查看</text></view>
        <text v-if="a.settlement.dispute" class="k-meta k-mt10 block">{{ a.settlement.status === 'disputed' ? '待核实争议：' : '原争议记录：' }}{{ a.settlement.dispute }}</text>
        <text v-if="a.settlement.status === 'disputed'" class="k-meta k-mt10 block">平台和主理人会核实处理，结果会发到消息里；如果其实已经到账，可以直接点「确认已到账」结束申诉。</text>
        <text v-if="a.settlement.correctionCount && a.settlement.status === 'payout_registered'" class="k-alert k-mt10 block">主理人已更正付款凭证，原结算金额不变。请查看新凭证，核对实际到账后再次确认；尚未到账仍可申诉。</text>
        <text class="k-meta k-mt10 block">发布方按约定方式直接付款，无需到店，平台不经手资金；核对到账后请确认收款，没收到可以申诉，平台会介入核实。</text>
      </k-card>

      <online-recipient v-if="a.recipient" :app-id="appId" :value="a.recipient" @saved="saveRecipient"/>
      <text class="section-title k-mt16 block">我的提交</text>
      <!-- 平台处理过这一轮的介入申请后（escalateAgain），要再等几天门店仍没验收才能再请，之前处理完立刻又能点 -->
      <text v-if="a.escalateFrom && !a.canEscalate && !a.escalated" class="k-meta k-mt8 block">{{ a.escalateAgain ? '平台已处理你的介入申请，结果见消息' : '成果已交给门店验收' }}；到 {{ a.escalateFrom }} 门店还没验收的话，可以{{ a.escalateAgain ? '再次' : '' }}请平台介入。</text>
      <view v-if="!(a.submissions || []).length" class="empty"><text>{{ a.working ? '还没有提交成果' : '门店审核通过后才能提交成果' }}</text></view>
      <k-card v-for="x in a.submissions || []" :key="x.round" :pad="14" class="k-mt10">
        <view class="k-between"><text class="round">第 {{ x.round }} 轮 · {{ x.time }}</text><k-chip :tone="x.status === 'accepted' ? 'green' : (x.status === 'returned' ? 'red' : 'ochre')"><text>{{ x.statusLabel }}</text></k-chip></view>
        <!-- 成果链接（V47 起可以是整段分享口令）：全文原样显示，其中的网址标红、点了复制；口令要连文字一起复制时点「复制全文」。
             2026-10-17 主人反馈：一轮最多交 3 个（发了几篇帖子就几个），一个一个显示；不止一个时标上「链接 1 / 2 / 3」，各自复制 -->
        <view v-for="(lk, lkIndex) in linksOf(x)" :key="lkIndex" class="link-item k-mt8">
          <text v-if="linksOf(x).length > 1" class="link__label">链接 {{ lkIndex + 1 }}</text>
          <view class="link"><text v-if="linkParts(lk).before">{{ linkParts(lk).before }}</text><text v-if="linkParts(lk).url" class="link__url" @click="copyLink(lk)">{{ linkParts(lk).url }}</text><text v-if="linkParts(lk).after">{{ linkParts(lk).after }}</text></view>
          <view class="link-acts k-mt8"><text v-if="linkParts(lk).url" class="k-link" @click="copyLink(lk)">复制链接</text><text v-if="linkParts(lk).url !== lk" class="k-link" @click="copyAll(lk)">复制全文</text></view>
        </view>
        <view v-if="x.images.length" class="photos k-mt8"><image v-for="(img, i) in x.images" :key="img" :src="abs(img)" mode="aspectFill" @click="preview(x.images, i)" /></view>
        <text v-if="x.note" class="note k-mt8">{{ x.note }}</text>
        <!-- 退回原因（V41：最多 5000 字，保留换行，长的先折叠）和门店附的截图 -->
        <view v-if="x.comment || (x.reviewImages || []).length" class="review k-mt8" :class="{ 'review--returned': x.status === 'returned' }">
          <view class="k-between"><text class="review__label">{{ x.status === 'returned' ? '退回原因' : '验收评语' }}</text><text v-if="x.comment" class="k-link" @click="copyReason(x.comment)">{{ x.status === 'returned' ? '复制原因' : '复制' }}</text></view>
          <!-- 门店只发了截图、没写字时说一声，免得以为原因没加载出来（门店那边写的是「（只附了截图）」） -->
          <text v-if="x.comment" class="review__text k-mt8">{{ openTexts['r' + x.round] ? x.comment : fold(x.comment) }}</text>
          <text v-else class="k-meta block k-mt8">（门店只附了截图，见下方）</text>
          <text v-if="(x.comment || '').length > 300" class="k-link block k-mt8" @click="toggleText('r' + x.round)">{{ openTexts['r' + x.round] ? '收起' : '展开全文' }}</text>
          <view v-if="(x.reviewImages || []).length" class="photos k-mt8"><image v-for="(shotImg, shotIndex) in x.reviewImages" :key="shotImg" :src="abs(shotImg)" mode="aspectFill" @click="preview(x.reviewImages, shotIndex)" /></view>
          <text v-if="(x.reviewImages || []).length" class="material__from k-mt8">门店附的截图 · 点图片放大查看</text>
        </view>
      </k-card>
    </view>

    <k-bottom flat pad="12px 16px">
      <!-- 申诉中也能确认已到账（canConfirm）；成果交了几天门店还没验收，可以请平台介入（canEscalate） -->
      <template v-if="a.settlement && (a.settlement.canDispute || a.settlement.canConfirm)">
        <view v-if="a.settlement.canDispute" class="k-flex1"><k-button type="secondary" block icon="scale" :disabled="busy" label="纠纷调解" @click="dispute" /></view>
        <view v-if="a.settlement.canConfirm" class="k-flex1"><k-button block :disabled="busy" :label="a.settlement.status === 'disputed' ? '确认已到账' : '确认收款'" @click="confirmPaid" /></view>
      </template>
      <template v-else-if="a.canEscalate || a.escalated">
        <view class="k-flex1"><k-button type="secondary" block icon="scale" :disabled="busy || a.escalated" :label="a.escalated ? '调解处理中' : '纠纷调解'" @click="escalate" /></view>
        <view class="k-flex1"><k-button block disabled label="等待门店验收" /></view>
      </template>
      <view v-else class="k-flex1"><k-button block :disabled="!a.canSubmit || busy" :label="busy ? '提交中…' : a.recipient?.canEdit ? (a.recipient.submitted ? '等待门店付款' : '请在上方填写收款信息') : submitText" @click="submit" /></view>
    </k-bottom>

    <!-- 提交成果第一步「成果链接或分享口令」（2026-10-17 主人反馈：有人一次发了不止一篇帖子，两篇就分两栏、三篇分三栏，每栏选填）。
         原来是系统输入框，只有一栏。textarea 在 position: fixed 的面板里要 :fixed="true"（小程序），:maxlength="-1" 不限字数（粘贴长口令不会被悄悄截断），点「下一步」时再按 500 字拦 -->
    <view v-if="linkPanel" class="k-mask" @click="closeLinks(null)" @touchmove.stop.prevent />
    <view v-if="linkPanel" class="k-sheet lsheet">
      <view class="k-sheet__handle" />
      <text class="lsheet__title">成果链接或分享口令（选填）</text>
      <text class="lsheet__hint">可填写成果合集链接，或分栏填写；只交图片的可留空。合集内请逐条编号，便于验收。</text>
      <view v-if="a.rewardMode==='per_item'" class="lsheet__box">
        <text class="lsheet__label">本次交付条数（最多 {{ a.itemsPerPerson }} 条）</text>
        <view class="delivery-count-field"><input type="number" v-model="submittedCount" maxlength="3" :placeholder="'请输入 1–' + a.itemsPerPerson + ' 的整数'" aria-label="本次交付条数" :cursor-spacing="24" confirm-type="done" /><text>条</text></view>
        <text class="lsheet__hint">接单人报酬按验收合格条数 × ¥{{ (Number(a.unitRewardFen)/100).toFixed(2) }} 结算，链接个数不等于成果条数。</text>
      </view>
      <view v-for="(boxLabel, boxIndex) in LINK_LABELS" :key="boxIndex" class="lsheet__box">
        <view class="k-between"><text class="lsheet__label">{{ boxLabel }}</text><text v-if="oneLine(linkBoxes[boxIndex])" class="lsheet__count" :class="{ 'is-over': oneLine(linkBoxes[boxIndex]).length > LINK_MAX }">{{ oneLine(linkBoxes[boxIndex]).length }}/{{ LINK_MAX }}</text></view>
        <textarea :value="linkInitial[boxIndex]" @input="editLink(boxIndex, $event)" @blur="editLink(boxIndex, $event)" class="lsheet__input" :maxlength="-1" auto-height :fixed="true" :cursor-spacing="24" :placeholder="boxIndex === 0 ? LINK_HINT : '还有一篇就贴在这里'" placeholder-class="k-placeholder" />
      </view>
      <view class="lsheet__foot">
        <view class="lsheet__cancel" hover-class="k-press" @click="closeLinks(null)"><text>取消</text></view>
        <view class="k-flex1"><k-button block label="下一步" @click="nextLinks" /></view>
      </view>
    </view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 线上任务交付（接单人）：门店审核通过报名即接单；截止前提交成果（链接 / 图片 / 说明，可多轮），门店验收通过后生成结算单，
// 门店线下付款并登记凭证后由你确认收款；没收到款可以申诉，平台介入核实（申诉中钱到了也能直接确认）。
// 截止前后被退回的，退回后至少还有 48 小时重新提交；成果交了 3 天门店还没验收，可以请平台介入。平台不经手佣金、不做任何自动转账。
// ---------------------------------------------------------------------------
import { ref, computed, watch, onUnmounted } from 'vue'
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { back, go, toast } from '@/common/screen.js'
import { apiMyOnline, apiOnlineSubmit, apiOnlineConfirm } from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { prompt, confirm, alert, copy, errText } from '@/common/ui.js'
import OnlineRecipient from './components/online-recipient.vue'
import R from '@/common/routes.js'
import { absUrl, uploadTo, chooseImages, downloadDoc } from '@/common/upload.js'
import { get, post } from '@/common/request.js'
// 门店素材里的附件（V41）：jobs 分包本地模块，不进主包
import { foldText as fold, workerFilePath, fileEnv, fileActions, downloadLocal, shareLocal, saveLocal, LINK_MAX, firstUrl, splitLink, splitLinks, oneLine } from './material-files.js'

const appId = ref(0)
const a = ref({ submissions: [] })
let ready = false
let loadRevision = 0, disposed = false
function applyAssignment(value) {
  ++loadRevision
  if (!disposed && value) a.value = value
}
function saveRecipient(value) {
  applyAssignment({ ...a.value, recipient: value })
}
onUnload(() => { disposed = true; ready = false; ++loadRevision })
onLoad(async (q) => {
  appId.value = Number(q?.appId) || 0
  if (!appId.value) {
    toast('请从订单或消息进入')
    return setTimeout(() => { if (!disposed) back() }, 600)
  }
  try {
    await ensureSession()
    if (!disposed) await load()
  } catch (error) {
    if (!disposed) toast(errText(error, '请重新登录后查看任务'))
  } finally {
    ready = !disposed
  }
})
onShow(() => { if (ready) load() })
async function load() {
  const revision = ++loadRevision
  try {
    const value = (await apiMyOnline(appId.value)).data
    // A refresh started before a successful write must not restore stale task or payment data.
    if (!disposed && revision === loadRevision && value) a.value = value
  } catch (e) {
    if (!disposed && revision === loadRevision) toast(errText(e, '任务加载失败'))
  }
}
const abs = absUrl
const openOnlineGuide = () => go(R.notice + '?key=online-guide')
const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onUnmounted(() => clearInterval(timer))
// 截止前后被退回的，服务端给了重新提交期限（resubmitUntilTs，退回后至少 48 小时），倒计时改按它算
const countdown = computed(() => {
  const until = a.value.resubmitUntilTs || a.value.deadlineTs
  if (!until) return ''
  const ms = until - now.value
  if (ms <= 0) return a.value.resubmitUntilTs ? '重新提交的期限已过' : '已过截止时间'
  const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000)
  return `${a.value.resubmitUntilTs ? '重新提交还剩' : '距离截止还有'} ${d} 天 ${h} 小时 ${m} 分`
})
// 纯展示（返修 3）：最后 24 小时倒计时才用提醒红，其余是灰字
const countdownUrgent = computed(() => { const until = a.value.resubmitUntilTs || a.value.deadlineTs; return !!until && until - now.value < 86400000 })
const submitText = computed(() => {
  if (a.value.canSubmit) return (a.value.submissions || []).length ? '重新提交成果' : '提交成果'
  if (a.value.settlement) return a.value.settlement.statusLabel
  if (['withdrawn', 'terminated', 'review_rejected'].includes(a.value.appStatus)) return '报名已结束 · 成果留存'
  if (a.value.workerActive === false) return '账号不可用 · 仅供查看'
  const last = (a.value.submissions || [])[0]
  if (last && last.status === 'submitted') return '已提交，等待门店验收'
  // 到期自动关闭的（taskClosed，服务端给）：按钮也写清楚任务关了，状态和提示同样由服务端改成「任务已截止关闭」
  if (a.value.working && a.value.taskClosed) return '任务已截止关闭'
  return a.value.working ? (a.value.resubmitUntilTs ? '重新提交的期限已过' : '已过截止时间') : '等待门店审核报名'
})
// 步骤条与门店素材（V37）：之前交付页看不出走到了哪一步，也看不到门店单独发来的素材。
// 步骤由服务端按报名状态、素材发送时间、成果轮次和结算单推出来（KgOnlineMaterialService.flow），这里只负责画
const flowSteps = computed(() => (a.value.flow && a.value.flow.steps) || [])
const materials = computed(() => a.value.materials || [])
// 已接单（或已经收到过素材 / 有任务参考素材）才显示素材卡片；还在等审核的报名不显示
const showMaterials = computed(() => materials.value.length > 0 || !!a.value.material || !!a.value.working)
const copyText = (t) => copy(t, '素材文字已复制')
const copyReason = (t) => copy(t, '退回原因已复制')
const copyMaterial = () => copy(absUrl(a.value.material), '素材链接已复制')
// 长文字（素材最多 1 万字、退回原因最多 5000 字）先显示前 300 字，点了再展开
const openTexts = ref({})
const toggleText = (k) => { openTexts.value = { ...openTexts.value, [k]: !openTexts.value[k] } }

// ---------------- 门店素材里的附件（V41） ----------------
// PDF / Office 文档在小程序里直接打开（右上角「…」能转发、保存）；压缩包小程序打不开：手机上发到微信聊天（如文件传输助手，再到电脑上解压），
// 电脑版微信保存到电脑；都能复制下载链接（3 天内有效，用浏览器下载）。网页版直接下载
const env = fileEnv()
const fileActs = (f) => fileActions(f, env)
const hasArchive = computed(() => materials.value.some((m) => (m.files || []).some((f) => f.kind === 'archive')))
// 正在下载的附件：fileId → 显示的进度
const fileBusy = ref({})
const setFileBusy = (id, text) => { fileBusy.value = { ...fileBusy.value, [id]: text } }
// 已经下载到本机、但转发没成功的：再点一次直接转发（转发要在点击里调用）
const prepared = {}
async function shareFile(f, path) {
  let local = prepared[f.fileId]
  delete prepared[f.fileId]
  if (!local) {
    // 先标成下载中：第一次进度回调之前再点一次，会对同一个本地文件发起第二次下载
    setFileBusy(f.fileId, '正在下载…')
    local = await downloadLocal(path, f, (pct) => setFileBusy(f.fileId, '正在下载 ' + pct + '%，请不要离开小程序'))
  }
  setFileBusy(f.fileId, '')
  try {
    await shareLocal(local, f)
  } catch (e) {
    prepared[f.fileId] = local
    throw new Error('文件已经下载好了，请再点一次「发到微信聊天」')
  }
}
async function onFileAct(f, act) {
  if (fileBusy.value[f.fileId]) return
  const path = workerFilePath(appId.value, f.fileId)
  try {
    if (act === '复制下载链接') {
      const r = (await get(path + '/link')).data
      await copy(absUrl(r.url), '下载链接已复制')
      await alert('复制下载链接', '链接 3 天内有效（到 ' + String(r.expireAt || '').slice(5) + '），拿到链接的人都能下载。请粘贴到手机或电脑的浏览器里下载，不要在微信里打开（微信内置浏览器常常不让下载）。')
      return
    }
    if (act === '发到微信聊天') return await shareFile(f, path)
    setFileBusy(f.fileId, '正在下载…')
    if (act === '保存到电脑') await saveLocal(await downloadLocal(path, f, (pct) => setFileBusy(f.fileId, '正在下载 ' + pct + '%')))
    else await downloadDoc(path, f.ext, f.name)
  } catch (e) {
    toast(errText(e, '文件打开失败，请重试'))
  } finally {
    setFileBusy(f.fileId, '')
  }
}
const preview = (list, i) => uni.previewImage({ urls: list.map(absUrl), current: absUrl(list[i]) })
const previewVoucher = () => uni.previewImage({ urls: [absUrl(a.value.settlement.voucher)] })
// 成果链接可能是「网址 + 分享口令」一整段（V47）：「复制链接」只复制其中的网址（没有网址就复制全文），「复制全文」连口令一起复制
const linkParts = splitLink
const copyLink = (l) => (firstUrl(l) ? copy(firstUrl(l), '链接已复制') : copy(l, '已复制全文'))
const copyAll = (l) => copy(l, '已复制全文，打开对应 App 即可识别口令')
// 2026-10-17 起一轮最多 3 个链接或口令：服务端给拆好的 links；老后端只有 link（几个用换行隔开），自己拆
const linksOf = (x) => (Array.isArray(x.links) ? x.links : splitLinks(x.link))

// ---------------- 提交成果第一步：成果链接面板（2026-10-17 主人反馈） ----------------
// 有人一次发了不止一篇帖子：「两个帖子分两栏提交两个地址，三个就分开提交三个」，每栏选填、每个 500 字内。
// 原来是系统输入框（只有一栏），换成底部面板里的三栏。没点「下一步」前填的字留着，取消了再点「提交成果」还在；提交成功才清空
const LINK_LABELS = ['帖子 1', '帖子 2（选填）', '帖子 3（选填）']
const LINK_HINT = '粘贴作品链接，或小红书、抖音复制的分享口令'
const linkPanel = ref(false)
const linkBoxes = ref(['', '', ''])
// 原生 textarea 编辑期间不把每次 input 回写 value，避免小程序 setData 重设中间光标。
const linkInitial = ref(['', '', ''])
function editLink(index, event) { if (typeof event.detail?.value === 'string') linkBoxes.value[index] = event.detail.value }
// 面板开着时 doSubmit 在等它：点「下一步」交回链接列表，取消（或点遮罩）交回 null。一定要交回，不然 busy 一直锁着、按钮再也点不了
let linkDone = null
function askLinks() {
  if (a.value.rewardMode==='per_item' && Number(a.value.itemsPerPerson)===1 && !submittedCount.value) submittedCount.value='1'
  if (linkDone) linkDone(null)
  linkInitial.value = [...linkBoxes.value]
  linkPanel.value = true
  return new Promise((resolve) => { linkDone = resolve })
}
function closeLinks(result) {
  linkPanel.value = false
  const done = linkDone
  linkDone = null
  if (done) done(result)
}
// 每栏收成一行（去首尾空白，中间的换行并成空格：几个链接存的时候用换行隔开），空栏不算；有一栏超过 500 字就停在面板上
function nextLinks() {
  if(a.value.rewardMode==='per_item' && (!/^[1-9][0-9]{0,2}$/.test(String(submittedCount.value)) || Number(submittedCount.value)>Number(a.value.itemsPerPerson)))return toast('请填写 1–'+a.value.itemsPerPerson+' 的整数条数')
  const list = linkBoxes.value.map(oneLine)
  for (let i = 0; i < list.length; i++) {
    if (list[i].length > LINK_MAX) return toast(`第 ${i + 1} 个链接或口令最多 ${LINK_MAX} 字，现在 ${list[i].length} 字`)
  }
  closeLinks(list.filter(Boolean))
}
// H5 锁页面滚动（同找搭子「筛选」的 lockPageScroll）：小程序靠顶上的 page-meta；H5 面板开着时给 body 写 overflow: hidden，关掉、离开本页时还原
let pageShown = true
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
watch(linkPanel, (open) => { if (pageShown) lockPageScroll(open) })
onShow(() => { pageShown = true; lockPageScroll(linkPanel.value) })
onHide(() => { pageShown = false; lockPageScroll(false) })
onUnload(() => { lockPageScroll(false); closeLinks(null) })
// 提交成果 / 确认收款 / 申诉：连点会弹两遍输入框、发两次请求，处理中先锁住底部按钮
const submittedCount=ref('')
const busy = ref(false)
watch(() => experience.account?.id, () => {
  ++loadRevision
  a.value = {submissions: []}
  closeLinks(null)
  linkBoxes.value = ['', '', '']
  linkInitial.value = ['', '', '']
  submittedCount.value = ''
  if (ready && !disposed) load()
}, {flush: 'sync'})
const withBusy = async (fn) => {
  if (busy.value) return
  busy.value = true
  const id = appId.value
  const user = experience.account?.id
  const current = () => !disposed && appId.value === id && experience.account?.id === user
  try { await fn(id, current) } finally { busy.value = false }
}
const submit = () => withBusy(doSubmit)
async function doSubmit(id, current) {
  if (!a.value.canSubmit) return
  // 粘贴什么就收什么：小红书、抖音复制出来的是「链接 + 口令」一整段，不再要求以 http(s):// 开头。
  // 2026-10-17 主人反馈：分三栏，最多 3 个（面板里每栏按 500 字拦过了），空栏去掉
  const links = await askLinks()
  if (links === null || !current()) return
  if(a.value.rewardMode==='per_item' && (!/^[1-9][0-9]{0,2}$/.test(String(submittedCount.value)) || Number(submittedCount.value)>Number(a.value.itemsPerPerson)))return toast('请填写 1–'+a.value.itemsPerPerson+' 的整数条数')
  const images = []
  if (await confirm('上传图片', '要上传成果截图或作品图片吗？（最多 9 张）')) {
    if (!current()) return
    try {
      const paths = await chooseImages(9)
      for (const path of paths) {
        if (!current()) return
        const url = (await uploadTo('/app/upload/image', path)).data?.url
        if (!url) throw new Error('未收到截图地址，请重新上传')
        images.push(url)
      }
    } catch (e) {
      if (current()) toast(errText(e, '截图上传失败，请重试'))
      return
    }
  }
  if (!current()) return
  if (!links.length && !images.length) return toast('请至少提交链接或图片')
  const note = await prompt('补充说明（选填，300 字内）', { placeholder: '例如：侧重空间布局与收纳技巧' })
  if (note === null || !current()) return
  try {
    // links 是新字段（服务端一个一个查、用换行连起来存）；link 是连好的一段，留给还没升级的服务端
    const response = await apiOnlineSubmit(id, {
      submittedCount: a.value.rewardMode === 'per_item' ? Number(submittedCount.value) : undefined,
      link: links.join('\n'), links, images, note: note.trim().slice(0, 300)
    })
    if (!current()) return
    applyAssignment(response.data)
    submittedCount.value=''
    linkBoxes.value = ['', '', '']; linkInitial.value = ['', '', '']
    toast('已提交，等待门店验收')
  } catch (e) {
    if (current()) toast(errText(e, '提交失败'))
  }
}
const confirmPaid = () => withBusy(doConfirmPaid)
async function doConfirmPaid(id, current) {
  if (!(await confirm('确认收款', `确认已收到 ${a.value.settlement.amount}？确认后结算完成。`))) return
  try {
    if (!current() || !a.value.settlement?.canConfirm) return
    const response = await apiOnlineConfirm(id, true)
    if (!current()) return
    applyAssignment(response.data)
    toast('已确认收款')
  } catch (e) {
    if (current()) toast(errText(e, '操作失败'))
  }
}
// 请平台介入：成果提交满 3 天门店还没验收也没退回时可用（服务端 canEscalate 判断）。走平台「申报处理」，门店同时收到提醒，处理结果发到消息里
const apiOnlineEscalate = (id, reason) => post('/app/online/assignments/' + id + '/escalate', { reason })
const escalate = () => withBusy(doEscalate)
async function doEscalate(id, current) {
  if (!a.value.canEscalate) return
  const r = await prompt('纠纷调解 · 验收问题', { placeholder: '说说情况，比如有没有私信联系过主理人（200 字内）' })
  if (!r || !r.trim()) return
  try {
    if (!current()) return
    const response = await apiOnlineEscalate(id, r.trim().slice(0, 200))
    if (!current()) return
    applyAssignment(response.data)
    toast('平台会尽快联系门店处理')
  } catch (e) {
    if (current()) toast(errText(e, '提交失败'))
  }
}
const dispute = () => withBusy(doDispute)
async function doDispute(id, current) {
  const r = await prompt('纠纷调解 · 收款问题', { placeholder: '说明未收到款的情况，平台会介入核实（200 字内）' })
  if (!r || !r.trim()) return
  try {
    if (!current()) return
    const response = await apiOnlineConfirm(id, false, r.trim().slice(0, 200))
    if (!current()) return
    applyAssignment(response.data)
    toast('已提交申诉，平台会尽快核实')
  } catch (e) {
    if (current()) toast(errText(e, '提交失败'))
  }
}
</script>

<style scoped lang="scss">
.delivery-count-field{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;min-height:48px;margin:8px 0;padding:0 12px;border:1px solid var(--k-red-line);border-radius:10px;background:var(--k-paper);color:var(--k-ink)}
.delivery-count-field:focus-within{border-color:var(--k-red-deep);box-shadow:0 0 0 1px var(--k-red-deep)}
.delivery-count-field input{flex:1;min-width:0;height:46px;font-size:15px}
.delivery-count-field>text{flex-shrink:0;font-size:14px;color:var(--k-muted)}
.deliver { font-family: var(--k-sans); }
.task-title { flex: 1; min-width: 0; font-size: 18px; font-weight: 700; color: var(--k-ink); }
.stats { display: flex; gap: 8px; }
.stats > view { flex: 1; display: flex; flex-direction: column; gap: 4px; padding: 8px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); }
.stats__value { font-size: 14px; font-weight: 700; color: var(--k-ink); }
.countdown { display: block; font-size: 12px; color: var(--k-alert); }
.row { display: flex; gap: 12px; font-size: 13px; }
.row__label { width: 64px; flex-shrink: 0; color: var(--k-muted); }
.row__value { flex: 1; min-width: 0; color: var(--k-ink); word-break: break-all; }
.notice { display: flex; gap: 6px; padding: 8px 10px; border-radius: 8px; background: #FBF4E8; font-size: 12px; line-height: 1.5; color: var(--k-ink); }
.section-title { font-size: 15px; font-weight: 700; color: var(--k-ink); }
.block { display: block; }
.round { font-size: 13px; font-weight: 700; color: var(--k-ink); }
.link { display: block; font-size: 12px; line-height: 1.6; color: #40576B; word-break: break-all; white-space: pre-wrap; }
/* 素材框、评语框是奶白底（--k-bg）：13px 的暖棕字只有 4.39:1，这一页的文字链和网址用深一档的 --k-red-deep */
.k-link { color: var(--k-red-deep); }
.link__url { color: var(--k-red-deep); text-decoration: underline; }
.link-acts { display: flex; gap: 16px; }
/* 一轮交了几个链接（2026-10-17）：每个一块，不止一个时上面一行小标签「链接 1 / 2 / 3」 */
.link-item { display: block; }
.link__label { display: block; margin-bottom: 2px; font-size: 11px; font-weight: 700; color: var(--k-muted); }
/* 提交成果第一步「成果链接」面板（2026-10-17）：三栏多行输入框，超高时在面板里滚（后面的页面锁住，见 page-meta / lockPageScroll） */
.lsheet { max-height: 85vh; overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box; font-family: var(--k-sans); }
.lsheet__title { display: block; font-size: 17px; font-weight: 700; color: var(--k-ink); }
.lsheet__hint { display: block; margin-top: 4px; font-size: 12px; line-height: 1.5; color: var(--k-muted); }
.lsheet__box { margin-top: 12px; }
.lsheet__label { font-size: 14px; font-weight: 600; color: var(--k-ink); }
.lsheet__count { font-size: 12px; color: var(--k-muted); }
.lsheet__count.is-over { color: var(--k-alert); font-weight: 700; }
.lsheet__input { display: block; box-sizing: border-box; width: 100%; min-height: 60px; margin-top: 6px; padding: 8px 10px; border: 1px solid var(--k-line2); border-radius: 10px; background: var(--k-paper); font-size: 14px; line-height: 1.5; color: var(--k-ink); word-break: break-all; }
.lsheet__foot { margin-top: 16px; display: flex; align-items: center; gap: 12px; }
.lsheet__cancel { flex: 0 0 auto; width: 96px; height: 44px; border: 1px solid var(--k-line2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 15px; color: var(--k-ink); }
.photos { display: flex; flex-wrap: wrap; gap: 6px; }
.photos image { width: 88px; height: 88px; border-radius: 6px; }
.note { display: block; font-size: 13px; line-height: 1.5; color: var(--k-ink); }
.comment { display: block; font-size: 12px; line-height: 1.5; color: var(--k-muted); }
.empty { margin-top: 10px; padding: 24px 0; text-align: center; font-size: 13px; color: var(--k-muted); border: 1px dashed var(--k-line); border-radius: 10px; }
/* 交付步骤条：done 完成（绿）/ current 当前（红）/ todo 未到 / skipped 没发素材就交付了（虚线）/ off 报名已结束 */
.flow { padding: 12px 6px 10px; border: 1px solid var(--k-line); border-radius: 12px; background: var(--k-paper); }
.flow__steps { display: flex; width: 100%; }
.flow__step { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; }
.flow__track { position: relative; width: 100%; height: 20px; display: flex; align-items: center; justify-content: center; }
.flow__line { position: absolute; top: 50%; height: 1px; background: var(--k-line2); }
.flow__line--l { left: 0; right: 50%; margin-right: 10px; }
.flow__line--r { left: 50%; right: 0; margin-left: 10px; }
.flow__dot { position: relative; z-index: 1; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--k-line2); background: var(--k-paper); box-sizing: border-box; display: flex; align-items: center; justify-content: center; font-family: var(--k-sans); font-size: 10px; color: var(--k-muted); }
.flow__label { max-width: 100%; font-size: 11px; line-height: 1.3; color: var(--k-muted); white-space: nowrap; }
.flow__time { font-family: var(--k-sans); font-size: 10px; line-height: 1.2; color: var(--k-muted); }
/* 还没到的步骤也是要看的内容，用 --k-muted（--k-light 只有 2.77:1）；报名已结束（off）才是浅灰禁用色 */
.flow__step.is-off .flow__label, .flow__step.is-off .flow__time { color: var(--k-light); }
.flow__step.is-done .flow__dot { border-color: var(--k-green); background: var(--k-green); }
.flow__step.is-done .flow__line, .flow__step.is-current .flow__line--l, .flow__step.is-skipped .flow__line { background: var(--k-green); }
.flow__step.is-done .flow__label, .flow__step.is-done .flow__time { color: var(--k-muted); }
.flow__step.is-current .flow__dot { border-color: var(--k-red); background: var(--k-red); color: #fff; }
.flow__step.is-current .flow__label { color: var(--k-red); font-weight: 700; }
.flow__step.is-current .flow__time { color: var(--k-red); }
.flow__step.is-skipped .flow__dot { border-style: dashed; color: var(--k-muted); }
.flow__step.is-skipped .flow__label { color: var(--k-muted); }
.flow__step.is-off .flow__dot { border-color: var(--k-line); color: var(--k-line2); }
.flow__tip { display: block; margin: 10px 6px 0; padding-top: 8px; border-top: 1px dashed var(--k-line); font-size: 12px; line-height: 1.6; color: var(--k-ink); }
.material { padding: 10px; border: 1px solid var(--k-line); border-radius: 10px; background: var(--k-bg); }
.material__head { font-size: 13px; font-weight: 700; color: var(--k-ink); }
.material__text { display: block; font-size: 13px; line-height: 1.7; color: var(--k-ink); white-space: pre-wrap; word-break: break-all; }
.material__from { display: block; font-size: 11px; color: var(--k-muted); }
.material-empty { display: flex; align-items: center; gap: 6px; padding: 12px 10px; border: 1px dashed var(--k-line); border-radius: 10px; font-size: 13px; color: var(--k-muted); }
/* 门店素材里的附件（V41）：图标 + 文件名 · 大小，下面一排操作 */
.mfile { padding: 8px 10px; border: 1px solid var(--k-line); border-radius: 8px; background: var(--k-paper); }
.mfile__head { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--k-ink); }
.mfile__name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mfile__acts { display: flex; flex-wrap: wrap; gap: 8px; }
.mfile__act { padding: 4px 10px; border: 1px solid var(--k-red-line); border-radius: 14px; font-size: 12px; color: var(--k-red); }
.material__tip { display: block; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
/* 退回原因 / 验收评语（V41）：正文色、保留换行；退回的用浅红底 */
.review { padding: 8px 10px; border-radius: 8px; background: var(--k-bg); }
.review--returned { background: #FBF0EC; }
.review__label { font-size: 12px; font-weight: 700; color: var(--k-ink); }
.review__text { display: block; font-size: 13px; line-height: 1.7; color: var(--k-ink); white-space: pre-wrap; word-break: break-all; }
/* 线上任务须知入口 */
.guide-link { min-height: 40px; padding: 0 10px; border: 1px solid var(--k-line); border-radius: 8px; display: flex; align-items: center; gap: 6px; }
.guide-link__title { font-size: 13px; font-weight: 700; color: var(--k-ink); }
.guide-link__sub { flex: 1; min-width: 0; font-size: 12px; color: var(--k-muted); }
@import "flow-premium.scss";
/* ==== r3jobsb 第三轮 start ==== */
/* 第三轮（11-18）：页边距 16、卡内 16；数据格三格等高、数字 14/600 等宽；「联系当地主理人」收成 40 高次按钮胶囊（flow-premium）；
   文件卡上的「下载 / 复制下载链接」是 28 高的次按钮小胶囊。 */
.deliver .k-body { padding-left: 16px; padding-right: 16px; }
.deliver :deep(.subscribe-entry) { padding-left: 16px; padding-right: 16px; }
.deliver :deep(.k-card) { padding: 16px !important; }
.deliver .flow { padding: 14px 4px 12px; }
.deliver .stats > view { border-radius: 8px; }
.deliver .stats__value { font-size: 14px; font-weight: 600; color: var(--k-ink); }
.deliver .notice { border-radius: 8px; }
.deliver .guide-link { border-radius: 8px; }
.deliver .mfile__act { height: 28px; padding: 0 12px; box-sizing: border-box; display: inline-flex; align-items: center; border: 1px solid var(--k-red-line); border-radius: 14px; font-size: 12px; font-weight: 500; line-height: 1; }
@media (max-width: 359px) {
  .deliver .k-body { padding-left: 12px; padding-right: 12px; }
  .deliver :deep(.subscribe-entry) { padding-left: 12px; padding-right: 12px; }
  .deliver :deep(.k-card) { padding: 12px !important; }
}
/* 返修 1：整条报名流程页边距统一 12（报名 / 审核进度 / 面试 / 签约 / 交付翻页时左右不再跳） */
.deliver .k-body { padding-left: 12px; padding-right: 12px; }
.deliver :deep(.subscribe-entry) { padding-left: 12px; padding-right: 12px; }
/* —— 返修 3 start（11-18 晚）—— */
/* 整条报名流程页边距 16、卡内 16 */
.deliver .k-body { padding-left: 16px; padding-right: 16px; }
.deliver :deep(.subscribe-entry) { padding-left: 16px; padding-right: 16px; }
/* 三格数据：报酬 + 状态一排、截止时间单独一整排；格内 12，数值 15/600 等宽不折行，格子同高 */
.deliver .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.deliver .stats > view { min-width: 0; padding: 12px; gap: 4px; border: 0; border-radius: 8px; background: var(--k-page); }
.deliver .stats > view:nth-child(2) { grid-column: 1 / -1; order: 3; }
.deliver .stats .k-meta { font-size: 12px; line-height: 18px; }
.deliver .stats__value { font-size: 15px; font-weight: 600; line-height: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
/* 倒计时：14 时钟 + 12 灰字，离上面 8；最后 24 小时才是提醒红 */
.deliver .countdown { display: flex; align-items: center; gap: 4px; font-size: 12px; line-height: 18px; color: var(--k-muted); font-variant-numeric: tabular-nums; }
.deliver .countdown--urgent { color: var(--k-alert); }
.deliver .reward-note { font-size: 12px; line-height: 18px; color: var(--k-muted); }
.deliver .notice { padding: 8px 12px; background: var(--k-red-soft); }
.deliver .guide-link { padding: 0 12px; border: 0; background: var(--k-page); }
/* 门店素材：只留一层白卡——素材之间发丝线隔开；文件一行：18 图标 + 名字 + 大小 + 右边 28 高小胶囊（放不下自动换到下一行） */
.deliver .material { padding: 0; border: 0; border-radius: 0; background: none; }
.deliver .material + .material { padding-top: 12px; background: linear-gradient(to bottom, var(--k-line) 50%, transparent 50%) no-repeat top / 100% 1px; }
.deliver .mfile { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 0 0; border: 0; border-radius: 0; background: linear-gradient(to bottom, var(--k-line) 50%, transparent 50%) no-repeat top / 100% 1px; }
.deliver .mfile__head { flex: 1 1 160px; min-width: 0; }
.deliver .mfile > .k-meta { flex-basis: 100%; margin-top: 0; }
.deliver .mfile__acts { margin-top: 0; flex: 0 0 auto; }
.deliver .material-empty { padding: 12px; border: 0; background: var(--k-page); }
/* —— 返修 3 end —— */
/* —— 返修 4 start（11-18 夜）—— */
/* 三项数据去掉灰底格子：一行三列（标签 12 灰 / 数值 15/600），列之间 1px 竖发丝线；320 宽截止时间另起一行 */
.deliver .stats { display: flex; flex-wrap: nowrap; align-items: stretch; gap: 0; }
.deliver .stats > view { position: relative; flex: 1 1 0; min-width: 0; padding: 0 12px; border-radius: 0; background: none; display: flex; flex-direction: column; gap: 2px; }
.deliver .stats > view:first-child { padding-left: 0; }
.deliver .stats > view:last-child { padding-right: 0; }
.deliver .stats > view:nth-child(2) { flex: 0 0 auto; order: 0; grid-column: auto; }
.deliver .stats > view + view::before { content: ''; position: absolute; left: 0; top: 2px; bottom: 2px; width: 1px; background: var(--k-line); transform: scaleX(.5); }
.deliver .countdown { margin-top: 12px; }
/* 「线上任务须知」不再是第二个灰框：做成卡片底部一行入口，上面一条发丝线，和提示块隔 12 */
.deliver .guide-link { min-height: 44px; margin-top: 12px; padding: 12px 0 0; box-sizing: border-box; border: 0; border-radius: 0; background: linear-gradient(to bottom, var(--k-line) 50%, transparent 50%) no-repeat top / 100% 1px; }
/* 门店素材：「素材 · 时间」降成 12 灰字；文件名整行写全，两颗小胶囊另起一行、和文件名左边对齐 */
.deliver .material__head { font-size: 12px; font-weight: 400; line-height: 18px; color: var(--k-muted); }
.deliver .mfile__head { flex: 1 1 100%; align-items: flex-start; }
.deliver .mfile__head :deep(.k-icon) { flex: 0 0 auto; }
.deliver .mfile__name { white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; line-height: 18px; }
.deliver .mfile__acts { flex: 1 1 100%; padding-left: 24px; }
@media (max-width: 359px) {
  .deliver .stats { flex-wrap: wrap; row-gap: 12px; }
  .deliver .stats > view:nth-child(2) { order: 3; flex: 0 0 100%; padding: 12px 0 0; }
  .deliver .stats > view:nth-child(2)::before { left: 0; right: 0; top: 0; bottom: auto; width: auto; height: 1px; transform: scaleY(.5); }
}
/* —— 返修 4 end —— */
/* —— 返修 5 start（11-18 深夜）—— */
/* 我的提交：「复制链接 / 复制全文」和「下载」同款 28 高描边小胶囊，看得出能点 */
.deliver .link-acts { gap: 8px; flex-wrap: wrap; }
.deliver .link-acts .k-link { height: 28px; padding: 0 12px; box-sizing: border-box; display: inline-flex; align-items: center; border: 1px solid var(--k-red-line); border-radius: 14px; font-size: 12px; font-weight: 500; line-height: 1; color: var(--k-red-deep); text-decoration: none; }
/* 门店素材卡底部的帮助说明：12 号、行高 1.6，上面发丝线隔开再留 8 */
.deliver .material__tip { position: relative; margin-top: 12px; padding-top: 8px; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.deliver .material__tip::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
/* 任务标题两行均分，最后一个字不单独成行 */
.deliver .task-title { text-wrap: balance; }
@media (max-width: 359px) {
  /* 320 宽：6 步进度条贴满卡宽、字距收一点，「已交付」「验收通过」之间看得出空隙 */
  .deliver .flow { padding-left: 0; padding-right: 0; }
  .deliver .flow__label { font-size: 11px; letter-spacing: -.5px; }
}
/* —— 返修 5 end —— */
/* ==== r3jobsb 第四轮 start（11-18 夜，以微信实拍为准）==== */
/* 订阅提醒不再单独占一张白卡：一行 13/500 暖棕文字 */
.deliver :deep(.subscribe-entry) { padding: 4px 16px 0; }
.deliver :deep(.subscribe-entry button) { min-height: 32px; height: 32px; padding: 0; border-radius: 0; background: transparent; font-size: 13px; font-weight: 500; line-height: 32px; }
/* 任务头卡：报酬 20/700 暖棕是唯一主角，其余两格墨色 */
.deliver .stats > view:first-child .stats__value { font-size: 20px; font-weight: 700; line-height: 28px; font-variant-numeric: tabular-nums; }
/* 卡里的提示不再是米色框：12 号灰字 + 14 号 info 图标 */
.deliver .notice { padding: 0; gap: 4px; align-items: flex-start; border-radius: 0; background: transparent; font-size: 12px; line-height: 1.6; color: var(--k-muted); }
/* 「联系当地主理人」：任务卡底部一行文字按钮，上面发丝线 */
.deliver .contact-link { position: relative; margin-top: 12px; }
.deliver .contact-link::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
.deliver .contact-link :deep(.k-button) { height: 40px; margin-top: 4px; border-color: transparent; background: transparent; font-size: 14px; font-weight: 500; color: var(--k-red-deep); }
/* ==== r3jobsb 第四轮 end ==== */
/* ==== r3jobsb 第四轮返修 start（11-19，复评遗留）==== */
/* 报酬格：退回 17/700，报酬格放宽（1.4 : 1），金额不再被省略号吃掉；真放不下时整段换行而不是截断 */
.deliver .stats > view:first-child { flex: 1.4 1 0; }
.deliver .stats > view:first-child .stats__value { font-size: 17px; line-height: 24px; white-space: normal; overflow: visible; text-overflow: clip; word-break: keep-all; overflow-wrap: anywhere; }
/* 11-19 核对：「当前状态」也放开换行（报酬格加宽后它变窄，「结算完成」等会被截） */
.deliver .stats > view:last-child .stats__value { white-space: normal; overflow: visible; text-overflow: clip; word-break: keep-all; overflow-wrap: anywhere; }
/* 交付物 / 验收标准：优先在逗号后折行，不把「张图」这类两三个字甩到下一行 */
.deliver .row__value { word-break: keep-all; overflow-wrap: anywhere; }
/* ==== r3jobsb 第四轮返修 end ==== */
/* ==== r3jobsb 第三轮 end ==== */
</style>
