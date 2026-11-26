<template>
  <view class="k-page invite" :class="$userSurface">
    <k-topbar title="我的邀请" back />
    <view class="k-body k-pad-safe">
      <view v-if="loading && !data" class="state k-muted"><text>正在读取你的邀请码…</text></view>
      <view v-else-if="error && !data" class="state"><text>{{ error }}</text><k-button type="ghost" @click="load">重新加载</k-button></view>
      <template v-else-if="data">
        <view class="card code-card">
          <text class="eyebrow">我的邀请码</text>
          <view class="code-row">
            <text class="code">{{ data.code }}</text>
            <k-button type="outline" size="sm" icon="copy" @click="copyCode">复制</k-button>
          </view>
          <k-button block icon="share-2" open-type="share" class="share-btn" @click="onShare">分享给朋友</k-button>
        </view>
        <!-- 11-18 第四轮：主卡只做「码」这一件事（邀请码 + 复制 + 分享）；奖励说明和规则挪到卡外，做成一段无底色的清单 -->
        <view class="terms">
          <text class="rule">{{ data.rule }}</text>
          <view class="notes"><text v-for="note in data.notes" :key="note" class="note">· {{ note }}</text></view>
        </view>

        <view class="card list-card">
          <view class="k-between list-head">
            <text class="k-title">我邀请的朋友</text>
            <text class="k-small k-muted">{{ summaryText }}</text>
          </view>
          <view v-if="!data.invitees.length" class="empty"><view class="empty__ico"><k-icon name="users-round" :size="32" color="red" /></view><text class="empty__title">还没有邀请到朋友。</text><text class="empty__text">点上面的「分享给朋友」，朋友从你分享的页面进来并登录后，就会显示在这里。</text></view>
          <view v-for="(friend, i) in data.invitees" :key="i" class="friend">
            <view class="friend__ava"><k-icon name="user-round" :size="18" color="red" /></view>
            <view class="friend__copy">
              <text class="friend__name">{{ friend.name }}</text>
              <text class="k-meta">{{ friend.joinDate ? friend.joinDate + ' 加入' : '已加入' }}</text>
            </view>
            <text class="friend__status" :class="{ done: friend.done }">{{ friend.statusText }}</text>
          </view>
        </view>

        <view v-if="data.canBind" class="card bind-card">
          <text class="k-title">是朋友邀请你来的？</text>
          <view class="bind-body">
            <text class="k-small k-muted bind-tip">注册 24 小时内、还没报名或下单时，可以填朋友的邀请码。{{ data.executionEnabled ? '你完成符合条件的换工、兼职或全职培训后，朋友会得到积分。' : '你完成第一次换工或线上任务后，朋友会得到积分。' }}</text>
            <k-button type="secondary" size="md" :disabled="binding" :label="binding ? '正在提交…' : '填写朋友的邀请码'" @click="bindCode" />
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow, onShareAppMessage } from '@dcloudio/uni-app'
import { apiMyInvite, apiBindInviter } from '@/common/api.js'
import { experience, ensureSession } from '@/common/experience.js'
import { relaunch, toast } from '@/common/screen.js'
import { copy, prompt } from '@/common/ui.js'
import R from '@/common/routes.js'

// 邀请码、分享路径、规则文案和邀请到的人都来自服务端（GET /app/me/invite）；奖励积分数是运营在后台「参数设置」里配的
const data = ref(null)
const loading = ref(false)
const error = ref('')
const binding = ref(false)
let request = 0

const load = async () => {
  const token = ++request
  loading.value = true
  error.value = ''
  try {
    const res = await apiMyInvite()
    if (token === request) data.value = res.data || null
  } catch (e) {
    if (token === request) error.value = (e && e.message) || '邀请信息读取失败，请重试'
  } finally {
    if (token === request) loading.value = false
  }
}

onShow(async () => {
  await ensureSession()
  if (!experience.account) return relaunch(R.login)
  load()
})

const summaryText = computed(() => {
  const d = data.value
  if (!d || !d.inviteCount) return ''
  return `邀请 ${d.inviteCount} 人 · 已完成 ${d.doneCount} 人 · 共得 ${d.earnedPoints} 分`
})

const copyCode = () => { if (data.value && data.value.code) copy(data.value.code, '邀请码已复制') }

// 小程序里这个按钮是 open-type="share"，点了直接弹出微信转发；H5 没有转发面板，改为复制一段邀请的话
const onShare = () => {
  // #ifdef H5
  const d = data.value
  if (d && d.code) copy(`${d.shareTitle}！打开「袋鼠全球青年」小程序，填我的邀请码 ${d.code}`, '邀请的话已复制，发给朋友吧')
  // #endif
}

// 转发出去的页面带 ?inviter=邀请码：朋友打开后 App.vue 记下邀请码，登录后自动绑定
onShareAppMessage(() => (data.value && data.value.code
  ? { title: data.value.shareTitle, path: data.value.sharePath }
  : { title: '袋鼠全球青年 · 换工', path: '/pages/home/index' }))

const bindCode = async () => {
  if (binding.value) return
  const code = await prompt('填写邀请码', { placeholder: '朋友给你的 6 位邀请码' })
  if (code === null) return
  if (!code) return toast('请填写邀请码')
  binding.value = true
  try {
    const res = await apiBindInviter(code)
    const d = (res && res.data) || {}
    toast(d.message || (d.bound ? '已记下邀请人' : '这个邀请码用不了'))
    if (d.bound) await load()
  } catch (e) {
    toast((e && e.message) || '提交失败，请重试')
  } finally {
    binding.value = false
  }
}
</script>

<style scoped lang="scss">
.card { margin-top: 12px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 14px; padding: 16px 14px; }
.state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 16px; text-align: center; font-size: 14px; line-height: 1.6; color: var(--k-muted); }
.code-card { display: flex; flex-direction: column; gap: 10px; }
.eyebrow { font-size: 13px; color: var(--k-muted); }
.code-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.code { font-family: var(--k-sans); font-size: 34px; font-weight: 700; letter-spacing: 6px; color: var(--k-red); line-height: 1.2; }
.rule { font-family: var(--k-serif); font-size: 17px; font-weight: 700; line-height: 1.6; color: var(--k-ink); }
.share-btn { margin-top: 4px; }
.notes { display: flex; flex-direction: column; gap: 4px; padding-top: 2px; }
.note { font-size: 13px; line-height: 1.6; color: var(--k-muted); }
.list-head { gap: 12px; flex-wrap: wrap; }
.empty { display: block; margin-top: 10px; font-size: 14px; line-height: 1.7; color: var(--k-muted); }
.friend { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--k-line); }
.friend:last-child { border-bottom: 0; }
.friend__copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.friend__name { font-size: 15px; font-weight: 600; color: var(--k-ink); overflow-wrap: anywhere; }
.friend__status { flex: 0 0 auto; font-size: 13px; color: var(--k-muted); }
.friend__status.done { color: var(--k-green); font-weight: 600; }
.bind-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
.bind-tip { line-height: 1.6; }

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底、白卡 12 圆角、不描边，邀请码和字收小一档。功能和文字不变：复制、分享给朋友、邀请到的朋友、填写朋友的邀请码都在 */
.invite { --k-bg: var(--k-page); --k-radius: 12px; background: var(--k-page); }
.invite :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
.invite .k-body { padding-top: 8px; padding-left: 12px; padding-right: 12px; }
.invite :deep(.k-button.is-lg) { height: 44px; font-size: 15px; box-shadow: none; }
.invite :deep(.k-button.is-secondary) { color: var(--k-red-deep); }
.invite :deep(.k-button) { border-radius: 999px; }
/* 不能点的按钮（正在提交）：11-18 第二轮起交给公共组件 —— 原配色整体 .45，不再盖成冷灰块 */
.invite .k-title { font-family: var(--k-sans); font-size: 15px; }
.card { margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; }
.card:first-child { margin-top: 0; }
.code-card { gap: 8px; }
.eyebrow { font-size: 12px; }
.code { font-size: 28px; letter-spacing: 4px; color: var(--k-red-deep); }
.rule { font-family: var(--k-sans); font-size: 14px; font-weight: 600; line-height: 1.55; }
.note { font-size: 12px; }
.list-head .k-small { font-size: 12px; }
.empty { font-size: 13px; line-height: 1.65; }
.friend { padding: 10px 0; }
.friend__copy { gap: 2px; }
.friend__name { font-size: 14px; }
.friend__status { font-size: 12px; }
.bind-tip { font-size: 12px; }
/* 2026-11-18 评审修正：三条说明换行后第二行和第一行的字对齐（悬挂缩进，圆点留在左边；之前第二行顶到最左边）；上面那段奖励说明字重从 600 降到 500，不那么压人 */
.note { padding-left: 1.1em; text-indent: -1.1em; }
.rule { font-weight: 500; }
/* 11-18 第二轮精修（只动样子） */
/* 1) 卡里的标题（我邀请的朋友、是朋友邀请你来的？）14 / 600 */
.invite .k-title { font-size: 14px; font-weight: 600; line-height: 20px; }
/* 2) 还没有邀请到朋友：卡里居中的一段灰字（12，行高 1.6），上下留白 28 */
.empty { margin-top: 0; padding: 28px 12px; font-size: 12px; line-height: 1.6; text-align: center; }
/* 3) 朋友之间的分隔线改成发丝线，最后一位下面不画 */
.friend { position: relative; border-bottom: 0; }
.friend + .friend::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); transform-origin: 0 0; }
/* 4) 读取中 / 出错：白卡里居中；出错原因 14 / 500 二级墨，「重新加载」是 32 高的次按钮小胶囊 */
.state { gap: 8px; padding: 28px 12px; border-radius: 12px; background: var(--k-paper); font-weight: 500; color: var(--k-ink2); }
.state.k-muted { font-size: 12px; font-weight: 400; color: var(--k-muted); }
/*    「重新加载」原来 48 高：看着 32，上下各 6 的透明边，点按高度仍是 44 */
.state :deep(.k-button) { height: 44px; padding: 0 16px; border: 6px solid transparent; border-radius: 22px; background: var(--k-paper) padding-box; box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-size: 13px; font-weight: 500; }
/* 11-18 第三轮：页边距 16；邀请码卡内边距 16、邀请码 28 / 700 等宽；下面的奖励说明不再整段加粗：13 / 400 二级墨、行高 1.6；
   「我邀请的朋友」每位一行（名字 14 / 500 + 加入日期 12 灰，右边状态 12 单行省略）；还没有朋友时卡里居中：56 浅棕方块 + 32 号图标 + 12 灰字 */
.invite .k-body { padding-left: 16px; padding-right: 16px; }
.code-card { padding: 16px; }
.code { font-weight: 700; font-variant-numeric: tabular-nums; }
.rule { font-size: 13px; font-weight: 400; line-height: 1.6; color: var(--k-ink2); }
.list-card, .bind-card { padding: 14px 12px 12px; }
.friend { gap: 12px; min-height: 56px; padding: 8px 0; }
.friend__copy { min-width: 0; }
.friend__name { font-weight: 500; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.friend__status { flex: 0 1 auto; min-width: 0; max-width: 50%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--k-muted); }
.friend__status.done { color: var(--k-green); }
.empty { display: flex; flex-direction: column; align-items: center; padding: 28px 8px 16px; }
.empty__ico { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin-bottom: 12px; border-radius: 16px; background: var(--k-red-soft); }
.empty > text { font-size: 12px; line-height: 1.6; color: var(--k-muted); }
.bind-tip { line-height: 1.6; }
/* 11-18 第三轮返修：三张卡内边距统一 12；奖励说明、小字按整句均衡断行（不在第二行只剩一个「分」「的」字）；
   「我邀请的朋友」每位前面一个 36 的浅棕圆底 + 18 号人像图标，名字 15 / 500 */
.code-card { padding: 12px; }
.list-card, .bind-card { padding: 12px; }
.rule, .note { text-wrap: balance; word-break: keep-all; }
.rule { max-width: 300px; }
.friend__ava { display: flex; align-items: center; justify-content: center; flex: 0 0 36px; width: 36px; height: 36px; border-radius: 50%; background: var(--k-red-soft); }
.friend { gap: 10px; }
.friend__copy { flex: 1; }
.friend__name { font-size: 15px; font-weight: 500; line-height: 21px; }
/* 11-18 返修（第 2 轮）：
   1) 空状态和草稿箱、商城一样「标题 + 说明」：「还没有邀请到朋友。」14 / 500 二级墨，下面 12 灰字最宽 264 居中；
   2) 好友行右边的状态 12 / 400 灰字、最宽 120，超出省略（之前 13 号顶到卡边，名字长时只隔 15）；已完成的保留原来的颜色 */
.empty > .empty__title { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.empty > .empty__text { max-width: 264px; margin-top: 4px; text-align: center; text-wrap: balance; }
.friend__status { flex: 0 1 auto; max-width: 120px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 12px; font-weight: 400; }
.friend__status:not(.done) { color: var(--k-muted); }
.friend__status.done { font-weight: 500; }
/* 11-18 第三轮返修（第 3 轮）：
   1) 三个区块之间 20，焦点「邀请码 + 分享」那张卡单独在最上面；
   2) 「我邀请的朋友」「是朋友邀请你来的？」两个标题挪到卡外（16 / 600，右边人数 12 灰字，下 12），卡里只留朋友列表 / 说明和按钮；
   3) 「复制」「填写朋友的邀请码」两颗描边按钮一个样：36 高、18 圆角、1px 浅棕边、白底深棕字 13 / 500。 */
.list-card, .bind-card { margin-top: 20px; padding: 0; background: transparent; }
.list-card > .list-head { min-height: 22px; margin-bottom: 12px; padding: 0 2px; }
.list-card > .list-head .k-title, .bind-card > .k-title { font-size: 16px; font-weight: 600; line-height: 22px; }
.bind-card > .k-title { display: block; margin-bottom: 12px; padding: 0 2px; }
.list-card > .friend { padding: 8px 12px; background: var(--k-paper); }
.list-card > .list-head + .friend { border-radius: 12px 12px 0 0; }
.list-card > .friend:last-child { border-radius: 0 0 12px 12px; }
.list-card > .list-head + .friend:last-child { border-radius: 12px; }
.list-card > .friend + .friend::before { left: 58px; right: 12px; }
.list-card > .empty { border-radius: 12px; background: var(--k-paper); padding-bottom: 28px; }
.bind-body { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.code-row :deep(.k-button), .bind-body :deep(.k-button) { height: 36px; min-height: 36px; padding: 0 16px; border: 1px solid var(--k-red-line); border-radius: 18px; background: var(--k-paper); color: var(--k-red-deep); font-size: 13px; font-weight: 500; box-shadow: none; }
/* 11-18 第三轮返修（第 4 轮）：两个区块一样的节奏 —— 上面 20、标题（16 / 700，贴页边 16）、12、卡；
   邀请码卡离顶栏 12，和本组其它页一样 */
.list-card > .list-head { margin-bottom: 12px; padding: 0; }
.list-card > .list-head .k-title, .bind-card > .k-title { font-weight: 700; }
.bind-card > .k-title { margin: 0 0 12px; padding: 0; }
.bind-card { gap: 0; }
.bind-card > .bind-body { margin-top: 0; }
.k-body.k-pad-safe { padding-top: 12px; }
/* 11-18 第三轮返修（第 5 轮）：分享按钮下的小字去掉 keep-all，整句均衡折两行，不再上长下短 */
.note { text-wrap: wrap; word-break: keep-all; overflow-wrap: anywhere; } /* 11-18 微信核对：均衡折行把说明压到卡宽六成、还断在词中间 —— 铺满卡宽，只在逗号、分号处换行 */
/* 320 宽：「朋友从你分享的页面进来并登录，就算你邀请的」差 1px 放不下一行，小字改 11 号整句一行，不在词中间折 */
@media (max-width: 359px) { .note { font-size: 11px; } }
/* 11-18 第四轮（高级感）：主卡只放「我的邀请码」+ 大号码 + 复制 + 通栏「分享给朋友」，阅读顺序是 码 → 按钮；
   卡下面 16 是一段无底色清单：三行奖励 13 二级墨，再下面三条规则 12 灰；复制钮 32 高小胶囊 */
.code-card .share-btn { margin-top: 16px; }
.terms { margin-top: 16px; padding: 0 12px; }
.terms .rule { display: block; max-width: none; margin: 0; font-size: 13px; font-weight: 400; line-height: 1.7; color: var(--k-ink2); }
.terms .notes { margin-top: 8px; padding: 0; border: 0; background: transparent; }
.terms .note { font-size: 12px; line-height: 1.7; color: var(--k-muted); }
.code-row :deep(.k-button) { height: 32px; min-height: 32px; padding: 0 12px; border-radius: 16px; font-size: 12px; }
/* 11-18 第四轮返修：320 宽好友行的状态挪到日期那一行的右边（和日期同一条底线），昵称占满整行，不再被挤成省略号 */
@media (max-width: 359px) {
  .list-card > .friend .friend__status { position: absolute; right: 12px; bottom: 8px; max-width: 96px; white-space: normal; text-align: right; line-height: 17px; }
  .list-card > .friend .friend__copy .k-meta { line-height: 17px; }
}
/* 11-19 微信实拍返修：卡下说明和区块标题、卡片同一条左线（不再缩进 12，全页只有一条左线）；
   奖励说明最宽 17em：三句各占一行（只在逗号处折行），和下面三条规则同一种节奏，不再上短下长 */
.terms { padding: 0; }
.terms .rule { max-width: 17em; }
</style>
