<template>
  <k-feature-gate feature="group-chat">
  <view class="k-page camp" :class="$userSurface">
    <k-topbar title="进入袋鼠群聊" back />
    <view class="camp-body">
      <view class="camp-cover"><view class="camp-cover__art"><k-icon name="tent" :size="22" color="red" /></view>
      <text class="eyebrow">在这里，遇见旅途同伴</text>
      <text class="camp-title">{{ '一座城的日常，\n下一站的期待。' }}</text>
      <text class="intro">找到身边的朋友，也提前认识下一站的同行者。</text></view>
      <view class="city-box"><view class="city-line"><k-icon name="map-pin" :size="16" color="red" /><text>{{ locating ? '正在识别当前城市…' : (current ? '当前城市：' + current : '尚未获取当前城市') }}</text><button :disabled="locating" @click="locate">重新定位</button></view>
      <text v-if="locationHint" class="hint city-hint">{{ locationHint }}</text></view>
      <view v-if="loading" class="loading" role="status"><view class="camp-skel"><view class="camp-skel__head" /><view class="camp-skel__card"><view class="camp-skel__icon" /><view class="camp-skel__lines"><view /><view /><text>正在读取社群信息…</text></view></view></view><view class="camp-skel"><view class="camp-skel__head" /><view class="camp-skel__card"><view class="camp-skel__icon" /><view class="camp-skel__lines"><view /><view /></view></view></view></view>
      <view v-else-if="error" class="load-error"><text>{{ error }}</text><button @click="loadGroups">重新加载</button></view>
      <template v-else>
        <view v-for="item in cards" :key="item.kind" class="group-section">
          <view class="group-heading"><text>{{ item.kind === 'current' ? '此刻所在' : '下一站想去' }}</text><button @click="choose(item.kind)">选择城市<k-icon name="chevron-right" :size="12" color="muted" /></button></view>
          <button class="group-card" :class="'group-card--' + item.kind" @click="openGroup(item.kind)">
            <view class="group-card__icon"><k-icon :name="item.kind === 'current' ? 'users-round' : 'map'" :size="24" color="red" /></view><view class="group-card__text"><text class="group-name">{{ item.city ? item.name : (item.kind === 'current' ? '找到你的同城群' : '找到你的目的地群') }}</text><text class="group-desc">{{ item.city ? (item.kind === 'current' ? '约一场活动，分享身边的新鲜事' : '出发前先聊聊，让陌生的城市熟悉起来') : '选择一座城市，看看有哪些旅途同伴' }}</text><view class="group-status" :class="{ 'group-status--off': item.city && item.state !== 'ready', 'group-status--pick': !item.city }"><text>{{ !item.city ? '选择城市' : item.state === 'ready' ? '查看入群活码' : '社群暂未开放' }}</text><k-icon name="chevron-right" :size="12" :color="item.city && item.state !== 'ready' ? 'light' : 'red'" /></view></view>
          </button>
          <text v-if="item.kind === 'destination' && item.city" class="hint">{{ data.destinationSource === 'signup' ? '根据你最近报名的城市推荐' : destinationManual ? '你选择的目的地' : '根据你最近浏览的城市推荐' }}</text>
        </view>
      </template>
      <view class="camp-footer" hover-class="k-press" @click="go('/pages/camp/handbook')"><view class="camp-footer__icon"><k-icon name="book-open" :size="20" color="red" /></view><text>第一次来？翻开袋鼠使用手册</text><k-icon name="chevron-right" :size="12" color="muted" /></view>
    </view>
    <view v-if="activeKind" class="qr-mask" @click="closeGroup" @touchmove.stop.prevent>
      <view class="qr-dialog" role="dialog" aria-modal="true" :aria-label="activeGroup?.name || '入群活码'" @click.stop>
        <button class="qr-close" aria-label="关闭" @click="closeGroup"><k-icon name="x" :size="18" color="muted" /></button>
        <text class="qr-title">{{ activeGroup?.name || '入群活码' }}</text>
        <text v-if="qrLoading" class="qr-state">正在获取最新活码…</text>
        <template v-else-if="activeGroup?.state === 'ready' && !qrError">
          <image class="qr-image" :src="absUrl(activeGroup.qrUrl)" mode="aspectFit" show-menu-by-longpress @error="qrError = '活码图片加载失败，请重新获取'" />
          <text class="qr-instruction">长按识别加入</text><text class="hint">企业微信群 · 入群后请遵守群内约定</text>
        </template>
        <template v-else><text class="qr-state">{{ qrError || '本城市社群暂未开放，请稍后再来' }}</text><button class="qr-retry" @click="openGroup(activeKind)">重新获取</button></template>
      </view>
    </view>
  </view>
  </k-feature-gate>
</template>
<script setup>
import { ref, computed } from 'vue'
import { refreshFeatures } from '@/common/features.js'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { apiCampGroups } from '@/common/api.js'
import { experience, ensureSession } from '@/common/experience.js'
import { recentDestination } from '@/common/camp-history.js'
import { locateCity } from '@/common/locate.js'
import { selectCity } from '@/common/city-picker.js'
import { absUrl } from '@/common/upload.js'
import { go } from '@/common/screen.js'
import { errText } from '@/common/ui.js'
const current = ref(''), destination = ref(''), visitedAt = ref(0), destinationManual = ref(false)
const locating = ref(false), locationHint = ref(''), loading = ref(true), error = ref(''), data = ref({})
const activeKind = ref(''), activeGroup = ref(null), qrLoading = ref(false), qrError = ref('')
let requestId = 0, qrRequest = 0, locationRequest = 0, owner = null, disposed = false
const cards = computed(() => ['current','destination'].map(kind => ({ kind, ...(data.value[kind] || {}) })))
const params = () => ({ current: current.value, destination: destination.value, visitedAt: visitedAt.value })
async function loadGroups() {
  if (!(await refreshFeatures()).groupChatEnabled) return
  const id = ++requestId
  loading.value = true; error.value = ''
  try { const res = await apiCampGroups(params()); if (id === requestId && !disposed) data.value = res.data || {} }
  catch(e) { if(id === requestId) error.value = errText(e, '社群信息加载失败，请重试') }
  finally { if(id === requestId) loading.value = false }
}
async function locate() {
  const id = ++locationRequest
  locating.value = true; locationHint.value = ''
  const result = await locateCity({ onFailure: message => { if(id === locationRequest) locationHint.value = message } })
  if(id !== locationRequest || disposed) return
  locating.value = false
  if(result) { current.value = result.name; loadGroups() }
}
async function choose(kind) {
  const city = await selectCity({ value: kind === 'current' ? current.value : destination.value })
  if(!city || disposed) return
  if(kind === 'current') { ++locationRequest; locating.value=false; current.value=city; locationHint.value='已手动选择城市，可重新定位更新' }
  else { destination.value=city; visitedAt.value=Date.now(); destinationManual.value=true }
  loadGroups()
}
async function openGroup(kind) {
  if(!data.value[kind]?.city) return choose(kind)
  activeKind.value=kind; activeGroup.value=data.value[kind]; qrLoading.value=true; qrError.value=''
  const id = ++qrRequest
  try { const res = await apiCampGroups(params()); if(id === qrRequest) { data.value=res.data || {}; activeGroup.value=data.value[kind] } }
  catch(e) { if(id === qrRequest) qrError.value=errText(e, '活码读取失败，请重试') }
  finally { if(id === qrRequest) qrLoading.value=false }
}
function closeGroup() { ++qrRequest; activeKind.value=''; activeGroup.value=null }
onLoad(async () => { if((await refreshFeatures()).groupChatEnabled) locate() })
onShow(async () => {
  await ensureSession()
  const nextOwner = experience.account?.id || 'guest'
  if(owner !== nextOwner) { owner=nextOwner; destinationManual.value=false; closeGroup(); data.value={} }
  if(!destinationManual.value) { const recent=recentDestination(experience.account?.id); destination.value=recent.city; visitedAt.value=recent.at }
  loadGroups()
})
onUnload(() => { disposed=true; ++requestId; ++qrRequest; ++locationRequest })
</script>
<style scoped>
/* 2026-11-17 改版「小而精」：浅灰底；标题 20、说明 12；定位行和手册入口是白底 12 圆角的细行；两张社群卡是很浅的绿 / 暖色、12 圆角，状态收成白色小胶囊；活码弹层 16 圆角。重新定位、选择城市、活码、手册入口都在。 */
.camp { --k-bg:var(--k-page); min-height:100vh; background:var(--k-page); }
.camp :deep(.k-navbar__title) { font-family:var(--k-sans); font-size:16px; font-weight:600; }
.camp-body { max-width:640px; margin:auto; padding:12px 12px calc(28px + var(--k-safe-bottom)); }
.eyebrow { display:block; font-size:11px; color:var(--k-green); letter-spacing:.5px; }
.camp-title { display:block; margin:4px 0 6px; font-size:20px; font-weight:700; line-height:1.45; color:var(--k-ink); }
.intro { display:block; color:var(--k-muted); font-size:12px; line-height:1.7; }
.city-line { display:flex; align-items:center; gap:6px; min-height:44px; margin-top:12px; padding:0 12px; border-radius:12px; background:var(--k-paper); font-size:12px; color:var(--k-ink2); }
.city-line>text { flex:1; }
.city-line button,.group-heading button { margin:0; padding:10px 0 10px 8px; background:transparent; font-size:12px; color:var(--k-green); line-height:1.5; flex-shrink:0; }
.city-line button::after,.group-heading button::after,.group-card::after,.qr-close::after,.load-error button::after,.qr-retry::after { border:0; }
.hint { display:block; margin-top:6px; color:var(--k-muted); font-size:11px; line-height:1.65; }
.group-section { margin-top:10px; }
/* 「选择城市」跟在小标题后面，不放最右边：右边缘那一条有浮着的「客服」小钮，这一页又不够长、滑不开，放右边会被压住点不到 */
.group-heading { display:flex; align-items:center; justify-content:flex-start; font-size:14px; font-weight:600; color:var(--k-ink); }
.group-card { display:flex; align-items:center; gap:10px; text-align:left; margin:0; padding:12px; border-radius:12px; line-height:1.5; background:linear-gradient(120deg,#EEF4E8,#DFEAD4); }
.group-card--destination { background:linear-gradient(120deg,var(--k-red-soft),#F6E9D6); }
.group-card__text { flex:1; min-width:0; }
.group-name,.group-desc { display:block; }
.group-name { font-size:16px; color:var(--k-ink); font-weight:700; overflow-wrap:anywhere; }
.group-desc { font-size:12px; color:var(--k-ink2); margin:2px 0 10px; }
.group-status { display:inline-block; height:26px; padding:0 12px; border-radius:13px; background:rgba(255,255,255,.9); font-size:12px; font-weight:600; line-height:26px; color:var(--k-green); }
.camp-footer { display:flex; align-items:center; gap:8px; min-height:48px; margin-top:12px; padding:0 12px; border-radius:12px; background:var(--k-paper); font-size:13px; color:var(--k-ink2); }
.camp-footer>text:first-of-type { flex:1; }
.loading,.load-error { padding:32px 0; color:var(--k-muted); font-size:13px; text-align:center; }
/* 2026-11-18 第二轮精修：「选择城市」后的「›」换成 12 号小箭头；加载提示放进白卡；手册入口行尾箭头 12 暖灰 */
.group-heading button { display:inline-flex; align-items:center; gap:2px; }
.loading { margin-top:10px; padding:28px 16px; border-radius:12px; background:var(--k-paper); font-size:12px; line-height:1.6; }
.load-error button { display:inline-block; height:36px; margin-top:12px; padding:0 18px; border:1px solid var(--k-red-line); border-radius:18px; background:var(--k-paper); color:var(--k-red-deep); font-size:13px; line-height:34px; }
.qr-mask { position:fixed; inset:0; z-index:200; background:rgba(20,14,10,.5); display:flex; align-items:center; justify-content:center; padding:24px; }
.qr-dialog { position:relative; width:100%; max-width:320px; box-sizing:border-box; background:var(--k-paper); padding:32px 20px 20px; border-radius:16px; text-align:center; }
.qr-close { position:absolute; right:2px; top:2px; display:flex; align-items:center; justify-content:center; width:44px; height:44px; padding:0; background:transparent; }
.qr-title { display:block; font-size:16px; font-weight:700; color:var(--k-ink); }
.qr-image { width:100%; height:220px; margin:16px 0 12px; }
.qr-instruction { display:block; font-size:14px; font-weight:600; color:var(--k-green); }
.qr-state { display:block; padding:32px 0; font-size:13px; color:var(--k-muted); }
.qr-retry { height:40px; border-radius:20px; background:linear-gradient(135deg,#B5814D,#8E5E33); color:var(--k-paper); font-size:14px; font-weight:600; line-height:40px; }
/* 2026-11-18 第三轮逐页精修：营地整页强调色从绿色换回全站暖棕（绿色只留给成功 / 安心）；页边距 16；
   标题区留白放大（眉题 11 → 标题 22 → 说明 13）；定位行 52 高、定位钉 16 暖棕；两张社群卡改成白卡：左边 48 的浅棕方块 + 24 号线性图标（同城 = 人群、目的地 = 地图），
   中间群名 16/700、说明 12、状态小胶囊，右边小箭头；区块标题 16/700，「选择城市」跟在标题后；手册入口左边也放一个 36 的浅棕小方块，和社群卡同一套做法。 */
.camp-body { padding:16px 16px calc(32px + var(--k-safe-bottom)); }
.eyebrow { font-size:11px; font-weight:500; letter-spacing:1px; color:var(--k-red-deep); }
.camp-title { margin:8px 0 8px; font-size:22px; line-height:1.4; }
.intro { font-size:13px; line-height:1.6; }
.city-line { gap:8px; min-height:52px; margin-top:20px; padding:0 8px 0 16px; font-size:13px; }
.city-line button,.group-heading button { color:var(--k-red-deep); font-weight:500; }
.city-line button { padding:10px 8px; }
.group-section { margin-top:24px; }
.group-heading { height:22px; margin-bottom:10px; gap:8px; font-size:16px; font-weight:700; line-height:22px; }
.group-heading button { gap:2px; padding:8px 0; font-size:12px; }
.group-card,.group-card--destination { gap:12px; padding:16px; background:var(--k-paper); }
.group-card__icon { flex:0 0 48px; width:48px; height:48px; display:flex; align-items:center; justify-content:center; border-radius:14px; background:var(--k-red-soft); }
.group-name { font-size:16px; line-height:22px; }
.group-desc { margin:2px 0 10px; color:var(--k-muted); line-height:1.6; }
.group-status { height:24px; padding:0 10px; border-radius:12px; background:var(--k-red-soft); font-size:12px; font-weight:500; line-height:24px; color:var(--k-red-deep); }
.group-status--off { background:var(--k-fill); color:var(--k-muted); }
.group-section>.hint { margin-top:8px; }
.camp-footer { gap:12px; min-height:56px; margin-top:24px; padding:0 16px 0 12px; font-size:14px; color:var(--k-ink); }
.camp-footer__icon { flex:0 0 36px; width:36px; height:36px; display:flex; align-items:center; justify-content:center; border-radius:10px; background:var(--k-red-soft); }
.loading { margin-top:24px; }
.qr-instruction { color:var(--k-ink); }
/* 2026-11-18 第三轮返修（评审第 1 轮）：
   1) 层次拉开：区块标题「此刻所在 / 下一站想去」退成 15/600 二级墨，卡里群名升到 17/700；
   2) 区块右侧的「选择城市」右对齐到内容线；卡里已经有一颗状态胶囊（选择城市 / 查看入群活码），右边的小箭头去掉，一张卡只留一个「能点」的暗示，也给说明文字让出 24（320 宽不再掉两个字）。 */
.group-heading { justify-content:space-between; font-size:15px; font-weight:600; color:var(--k-ink2); }
.group-heading button { margin-right:-2px; }
.group-name { font-size:17px; line-height:24px; }
/* 2026-11-18 第三轮返修（评审第 2 轮）：
   1) 页标题 20/700（按字号档位）；区块右侧「选择城市」右边贴卡片边线；
   2) 卡里的「查看入群活码 / 选择城市」改成 28 高的小按钮：12/600 字 + 12 号向右箭头，一看就能点；「社群暂未开放」暖灰底、不带箭头；
   3) 底部手册入口左右内边距 16，图标和上面两张社群卡的图标同一条线。 */
.camp-title { font-size:20px; }
.group-heading button { margin-right:0; }
.group-status { display:inline-flex; align-items:center; gap:2px; height:28px; padding:0 8px 0 12px; border-radius:14px; box-sizing:border-box; font-size:12px; font-weight:600; line-height:28px; vertical-align:top; }
.group-status--off { padding:0 12px; background:var(--k-line); font-weight:500; }
.camp-footer { padding:0 16px; }
/* 11-18 第三轮返修（评审第 3 轮）：
   1) 头部三行字收进一张暖色封面卡（浅棕渐到白、12 圆角、内边距 20/16），右上 56 的白色圆里放 28 号帐篷图标 —— 第一屏有了焦点，和手册封面同一套；
   2) 社群卡图标方块 44（圆角 14），手册入口方块 36 圆角 10；
   3) 区块标题右侧的「选择城市」退成 12/400 灰字、不带箭头，卡里的「选择城市」胶囊才是主要入口。 */
.camp-cover { position:relative; padding:20px 16px; border-radius:12px; background:linear-gradient(160deg,var(--k-red-soft) 0%,var(--k-paper) 100%); }
.camp-cover__art { position:absolute; right:16px; top:16px; display:flex; align-items:center; justify-content:center; width:56px; height:56px; border-radius:50%; background:var(--k-paper); }
.camp-cover .eyebrow { padding-right:64px; }
.camp-cover .camp-title { margin:8px 0; padding-right:64px; font-size:22px; line-height:1.35; }
.camp-cover .intro { margin:0; }
.group-card__icon { flex:0 0 44px; width:44px; height:44px; border-radius:14px; }
.camp-footer__icon { border-radius:10px; }
.group-heading button { color:var(--k-muted); font-weight:400; }
/* 11-18 第三轮返修（评审第 4 轮）：
   1) 定位提示收进定位卡，做卡里第二行（12/1.5 灰字，和城市名同一条起点线）；
   2) 手册入口方块和社群卡一样 44 / 圆角 14、22 号图标，文字起点对齐社群卡；
   3) 封面卡左边暖色更明显（浅棕到白在 70% 处结束），白圆加极淡阴影；说明和手册入口文字折行时两行等长，避开末行只剩一个字。 */
.city-box { margin-top:20px; border-radius:12px; background:var(--k-paper); }
.city-box>.city-line { margin-top:0; background:transparent; }
.city-box>.city-hint { margin:-10px 0 0; padding:0 16px 14px 40px; font-size:12px; line-height:1.5; color:var(--k-muted); }
.camp-footer { min-height:68px; }
.camp-footer__icon { flex:0 0 44px; width:44px; height:44px; border-radius:14px; }
.camp-cover { background:linear-gradient(160deg,var(--k-red-soft) 0%,var(--k-paper) 70%); }
.camp-cover__art { box-shadow:0 1px 2px rgba(58,50,43,.08); }
.camp-cover .intro,.camp-footer>text:first-of-type { text-wrap:balance; }
/* 2026-11-18 第四轮精修（按微信实拍评审）：
   1) 区块标题右边「选择城市」后面的 12 号灰箭头放回来（上一轮被藏掉），和字一起是 12 号灰色文字链；
   2) 社群卡里的小箭头一直显示：社群暂未开放时用浅灰箭头（整张卡照样能点）；
   3) 读取社群信息时按最终版式画两块骨架（小标题条 + 白卡：左 44 方块 + 右两条线），「正在读取社群信息…」12 号灰字放在第一块里，加载完不跳；
   4) 区块之间统一 20（封面 → 定位卡 → 社群 → 手册入口）；封面右上和手册、我的心愿同一做法：44 白圆 + 22 号暖棕图标。 */
.camp .group-heading button { gap:2px; }
.camp .group-status--off { padding:0 8px 0 12px; }
.camp .city-box { margin-top:20px; }
.camp .group-section { margin-top:20px; }
.camp .camp-footer { margin-top:20px; }
.camp .loading { margin-top:0; padding:0; border-radius:0; background:transparent; text-align:left; }
.camp-skel { margin-top:20px; }
.camp-skel__head { width:64px; height:16px; margin:3px 0 13px; border-radius:6px; background:var(--k-fill); }
.camp-skel__card { display:flex; align-items:center; gap:12px; height:112px; box-sizing:border-box; padding:16px; border-radius:12px; background:var(--k-paper); }
.camp-skel__icon { flex:0 0 44px; width:44px; height:44px; border-radius:14px; background:var(--k-fill); }
.camp-skel__lines { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; }
.camp-skel__lines>view { width:56%; height:16px; border-radius:6px; background:var(--k-fill); }
.camp-skel__lines>view+view { width:88%; height:12px; }
.camp-skel__lines>text { font-size:12px; line-height:16px; color:var(--k-muted); }
.camp .camp-cover__art { right:16px; top:16px; width:44px; height:44px; box-shadow:none; }
.camp .camp-cover .eyebrow,.camp .camp-cover .camp-title { padding-right:56px; }
/* 2026-11-19 第四轮返修（按复评）：没选城市时，卡里的「选择城市」不再是浅棕胶囊（和区块标题右侧的「选择城市」上下重复）—— 退成 12/500 暖棕文字链 + 小箭头，没有底色。 */
.camp .group-status.group-status--pick{height:20px;padding:0;border-radius:0;background:transparent;font-weight:500;line-height:20px}
/* 2026-11-19 第五轮（按微信实拍复核）：
   1) 封面右上帐篷图标不再是白圆贴纸：44 浅棕圆角方块（圆角 12），和资质页、手册入口一个做法；
   2) 手册入口和上面城市行同高（56），图标方块缩到 36（图标 20），左边图标起点和定位图标同一条线（左 16）。 */
.camp .camp-cover__art{border-radius:12px;background:var(--k-red-soft)}
.camp .camp-footer{min-height:56px;padding:0 16px}
.camp .camp-footer__icon{flex:0 0 36px;width:36px;height:36px;border-radius:10px}
</style>

<style scoped lang="scss">
.camp.user-surface {
  .camp-cover { border-radius: 13px; }
  .group-card { border-radius: 12px; }
  .group-card__icon { border-radius: 10px; background: var(--user-icon-field); }
  .group-card__text { min-width: 0; }
  .group-desc { line-height: 1.55; }
}
</style>
