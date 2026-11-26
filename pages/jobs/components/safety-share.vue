<template>
  <!-- 报名结束页的两块（2026-10-31 主人：「可以跟亲友分享」「安全负责人点击当地换工主理人的聊天」）。报名页整张，进度页、面试页 compact 两行小入口。
       线上任务、已结束的报名什么都不出；读不到只给一行重试，不打断主流程。 -->
  <view v-if="state === 'failed'" class="ss-retry" :class="{ 'ss-retry--compact': compact }" role="button" hover-class="k-press-s" @click="load"><k-icon name="refresh-cw" :size="16" color="red" /><text>联系人信息暂时读不到，点这里重试</text></view>
  <view v-else-if="shown" class="ss" :class="{ 'ss--compact': compact }">
    <!-- 安全负责人：kind=service 时微信里是客服会话按钮、网页版去客服中心；其余进这家店的沟通窗口（chat?appId=，「联系专员」同一条路） -->
    <view class="ss-person">
      <view class="ss-face"><image v-if="avatarUrl && !avatarBroken" class="ss-face__img" :src="avatarUrl" mode="aspectFill" @error="avatarBroken = true" /><k-icon v-else :name="isService ? 'headset' : 'user-round'" :size="compact ? 20 : 24" color="red" /></view>
      <view class="ss-person__main">
        <!-- 2026-11-03 主人：「安全负责人 · 换工主理人」这行字去掉，改成一句「有问题找当地主理人」（没有当地主理人时是平台客服） -->
        <text class="ss-label">{{ isService ? '有问题找客服' : '有问题找' + contactParty }}</text>
        <text class="ss-name">{{ personName }}</text>
        <text v-if="!compact" class="ss-role">{{ userRoleWording(safety.roleLabel) }}</text>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <button v-if="isService" class="ss-act" open-type="contact" :session-from="contactFrom" hover-class="k-press-s" aria-label="联系人工客服"><text>找客服</text></button>
      <!-- #endif -->
      <!-- #ifndef MP-WEIXIN -->
      <view v-if="isService" class="ss-act" role="button" aria-label="联系人工客服" hover-class="k-press-s" @click="openSupport"><text>找客服</text></view>
      <!-- #endif -->
      <view v-if="!isService" class="ss-act" role="button" :aria-label="'联系' + contactParty" hover-class="k-press-s" @click="contactPerson"><text>联系{{ safety.designated ? '主理人' : '商家' }}</text></view>
    </view>
    <text v-if="!compact" class="ss-tip">{{ isService ? '路上、到店遇到问题，都可以找人工客服。' : safety.designated ? '路上、到店遇到问题，可以直接联系这位当地主理人。' : '路上、到店遇到问题都可以找 TA，这家店的接待也能看到消息。' }}</text>

    <view class="ss-line" />

    <!-- 分享给亲友：微信转发卡片（亲友打开不用登录的行程页）；网页版没有转发，改复制 -->
    <template v-if="compact">
      <view class="ss-person">
        <view class="ss-face ss-face--icon"><k-icon name="share-2" :size="18" color="red" /></view>
        <view class="ss-person__main" role="button" aria-label="改一下分享时的称呼" hover-class="k-press" @click="editName"><view class="ss-label ss-label--edit"><text>分享给亲友</text><k-icon name="pencil" :size="12" color="red" /></view><view class="ss-name ss-name--small ss-name--pair"><text>{{ shareWhen }}</text><text>{{ sharePlace }}</text></view></view>
        <!-- #ifdef MP-WEIXIN -->
        <button class="ss-act" open-type="share" hover-class="k-press-s" aria-label="分享行程给亲友"><text>分享</text></button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view class="ss-act" role="button" aria-label="复制行程发给亲友" hover-class="k-press-s" @click="copyTrip"><text>复制</text></view>
        <!-- #endif -->
      </view>
    </template>
    <template v-else>
      <view class="ss-share__head"><text class="ss-label">分享给亲友</text><view class="ss-edit" role="button" aria-label="改一下分享时的称呼" hover-class="k-press" @click="editName"><k-icon name="pencil" :size="14" color="red" /><text>改称呼</text></view></view>
      <text class="ss-share__title">{{ shareTitle }}</text>
      <text class="ss-share__sub">{{ stayText }}不会带上你的手机号</text>
      <view class="ss-share__btn">
        <!-- #ifdef MP-WEIXIN -->
        <k-button block type="secondary" size="md" icon="share-2" open-type="share" label="分享给亲友" />
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <k-button block type="secondary" size="md" icon="copy" label="复制行程发给亲友" @click="copyTrip" />
        <!-- #endif -->
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { get } from '@/common/request.js'
import { absUrl } from '@/common/upload.js'
import { go, toast } from '@/common/screen.js'
import { copy, prompt, sheet } from '@/common/ui.js'
import { experience } from '@/common/experience.js'
import R from '@/common/routes.js'
import { durationLabel } from '../apply-flow.js'
import { FALLBACK_NAME, cleanName, monthDay, tripCopyText, tripImageUrl, tripTitle } from '../trip-share.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  appId: { type: [Number, String], default: null },
  compact: { type: Boolean, default: false },
  // 报名状态变了（撤回、被拒）重新读一次：已结束的报名这两块都不出
  status: { type: String, default: '' }
})
const emit = defineEmits(['ready'])

const info = ref(null)
// loading 读取中 / ready 读到了 / hidden 不用显示（不是本人、没登录）/ failed 读不到，给一行重试
const state = ref('loading')
let loadVersion = 0
const load = async () => {
  const version = ++loadVersion
  if (!props.appId) { info.value = null; state.value = 'hidden'; return }
  state.value = 'loading'
  try {
    const res = await get('/app/application/' + props.appId + '/after-apply')
    if (version !== loadVersion) return
    info.value = (res && res.data) || null
    state.value = 'ready'
  } catch (e) {
    if (version !== loadVersion) return
    info.value = null
    state.value = [401, 403, 404].includes(Number(e && e.code)) ? 'hidden' : 'failed'
  }
}
watch(() => [props.appId, props.status, experience.account?.id], load, { immediate: true })
onUnmounted(() => { loadVersion++ })

const shown = computed(() => {
  const d = info.value
  return state.value === 'ready' && !!d && !d.online && !d.ended && !!d.trip && !!d.safety
})
const safety = computed(() => (info.value && info.value.safety) || {})
const isService = computed(() => safety.value.kind === 'service')
const contactParty = computed(() => safety.value.designated ? '当地主理人' : '商家')
const avatarUrl = computed(() => absUrl(safety.value.avatar))
const avatarBroken = ref(false)
watch(avatarUrl, () => { avatarBroken.value = false })
// 昵称空时写角色；service 时服务端给「袋鼠客服」。2026-11-03 主人：统一叫法——服务端给的内部岗位名（换工主理人 / 小院主理人）在用户这边写「当地主理人」，
// 线上专员 / 城市负责人 / 商家服务人写「袋鼠工作人员」；用户只见这两个词
const userRoleWording = (t) => String(t || '').replace(/换工主理人|小院主理人/g, '当地主理人').replace(/线上任务专员|线上专员|城市负责人|商家服务人/g, '袋鼠工作人员')
const personName = computed(() => safety.value.name || userRoleWording(safety.value.roleLabel) || '门店接待')
const openChat = () => { if (safety.value.appId) go(R.chat + '?appId=' + safety.value.appId + (safety.value.designated ? '&contact=lead' : '')) }
const contactPerson = async () => {
  const version = loadVersion
  const onlineLabel = '在线联系' + contactParty.value
  const choice = await sheet([onlineLabel, '电话联系（门店电话）'])
  if (version !== loadVersion || !shown.value || isService.value) return
  if (choice === 0) return openChat()
  if (choice !== 1) return
  const phoneNumber = String(safety.value.contactPhone || '').trim()
  if (!/^\+?[0-9]{5,20}$/.test(phoneNumber)) return toast('门店暂未登记联系电话，请' + onlineLabel)
  uni.makePhoneCall({
    phoneNumber,
    fail: (error) => {
      if (!/cancel/i.test(String(error && error.errMsg))) toast('暂时无法拨打，请' + onlineLabel)
    }
  })
}
// 网页版没有微信客服会话，去客服中心（能提交人工工单）；这条是主人要的人工客服退路，不是「问问题跳走」
const openSupport = () => go('/pages/notice/support')
const contactFrom = computed(() => String((experience.account && experience.account.id) || 'guest') + '|support-safety')

// 称呼：默认是报名时的简历称呼（可能是真名），这里能临时改，只改这次分享，不写回简历
const editedName = ref(null)
const shareTrip = computed(() => {
  if (!shown.value) return null
  const t = info.value.trip
  return { ...t, name: cleanName(editedName.value === null ? t.name : editedName.value), imageUrl: tripImageUrl(absUrl(t.cover)) }
})
const shareTitle = computed(() => (shareTrip.value ? tripTitle(shareTrip.value) : ''))
// 小入口一行放不下整句，只写哪天到哪里；窄屏在「到」和地点之间折行，地点写全，不截断
const shareWhen = computed(() => (shareTrip.value ? monthDay(shareTrip.value.arrival) + ' 到' : ''))
const sharePlace = computed(() => (shareTrip.value ? shareTrip.value.place : ''))
const stayText = computed(() => {
  const stay = shareTrip.value ? durationLabel(shareTrip.value.days) : ''
  return stay ? '预计待' + stay + ' · ' : ''
})
// 页面的 onShareAppMessage 要用：读到了给行程，已结束或读不到给 null（转发退回岗位详情）
watch(shareTrip, (trip) => emit('ready', trip), { immediate: true })

const editName = async () => {
  const raw = await prompt('分享时怎么称呼你', { value: shareTrip.value ? shareTrip.value.name : '', placeholder: '最多 8 个字，不要写手机号' })
  if (raw == null) return
  const name = cleanName(raw)
  if (raw && !name) return toast('称呼里不能有手机号或网址')
  editedName.value = name
  // 小入口上看不到称呼，说一声
  if (props.compact) toast('分享时称呼你「' + (name || FALLBACK_NAME) + '」')
}
const copyTrip = () => {
  if (!shareTrip.value) return
  const href = typeof location !== 'undefined' ? location.href : ''
  copy(tripCopyText(shareTrip.value, href), '行程已复制，发给亲友吧')
}
</script>

<style scoped lang="scss">
.ss { margin-top: 12px; padding: 14px; border: 1px solid #E9DFD3; border-radius: 15px; background: var(--k-paper); box-shadow: 0 3px 10px rgba(91, 61, 32, .04); }
.ss--compact { margin-top: 10px; padding: 4px 14px; }
.ss-person { min-height: 56px; display: flex; align-items: center; gap: 12px; }
.ss-face { flex: 0 0 auto; width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: #F5E9D8; display: flex; align-items: center; justify-content: center; }
.ss-face__img { width: 100%; height: 100%; display: block; }
.ss--compact .ss-face { width: 38px; height: 38px; }
.ss-person__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ss-label { font-size: 13px; line-height: 18px; color: #8A7865; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ss-label--edit { display: flex; align-items: center; gap: 4px; }
.ss-name { font-size: 17px; line-height: 24px; font-weight: 700; color: var(--k-ink); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ss-name--small { font-size: 14px; line-height: 20px; font-weight: 600; }
/* 小入口两段字：放得下就一行，放不下从两段中间折行，都写全 */
.ss-label--pair, .ss-name--pair { display: flex; flex-wrap: wrap; column-gap: 4px; white-space: normal; overflow: visible; }
.ss-role { font-size: 13px; line-height: 18px; color: var(--k-ink2); }
/* 手指点的地方：高 40、四周再留白，年纪大的人好点 */
.ss-act { flex: 0 0 auto; width: auto; height: 40px; min-width: 76px; padding: 0 14px; margin: 0; border-radius: 20px; background: #F5E9D8; color: var(--k-red-deep); font-size: 14px; font-weight: 700; line-height: 40px; text-align: center; box-sizing: border-box; }
.ss-act::after { border: 0; }
.ss-tip { display: block; margin-top: 6px; font-size: 13px; line-height: 20px; color: var(--k-muted); }
.ss-line { height: 1px; margin: 12px 0; background: var(--k-line); transform: scaleY(.5); }
.ss--compact .ss-line { margin: 2px 0 2px 50px; }
.ss-share__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ss-edit { min-height: 32px; padding: 0 2px 0 8px; display: flex; align-items: center; gap: 3px; color: var(--k-red-deep); font-size: 13px; }
.ss-share__title { display: block; margin-top: 2px; font-size: 16px; line-height: 24px; font-weight: 700; color: var(--k-ink); word-break: keep-all; overflow-wrap: anywhere; }
.ss-share__sub { display: block; margin-top: 2px; font-size: 13px; line-height: 20px; color: var(--k-muted); }
.ss-share__btn { margin-top: 10px; }
.ss-retry { margin-top: 12px; min-height: 44px; padding: 8px 14px; border: 1px solid #E9DFD3; border-radius: 15px; background: var(--k-paper); display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 20px; color: var(--k-ink2); }
.ss-retry--compact { margin-top: 10px; }
/* 2026-11-17 改版「小而精」：白卡 12 圆角、不描边、不加阴影；头像 40、名字 15 / 600；
   「联系 TA / 分享 / 找客服」是白底细棕边的小胶囊（看上去 30 高，透明边把可点范围留在 40）。改称呼、分享、联系都照旧。 */
.ss { margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; box-shadow: none; }
.ss--compact { margin-top: 8px; padding: 2px 12px; }
.ss-person { min-height: 52px; gap: 10px; }
.ss-face { width: 40px; height: 40px; background: linear-gradient(160deg, #FFF6EA, #FFE7CC); }
.ss--compact .ss-face { width: 36px; height: 36px; }
.ss-face--icon { border-radius: 10px; }
.ss-label { font-size: 11px; line-height: 16px; color: var(--k-muted); }
.ss-name { font-size: 15px; line-height: 22px; font-weight: 600; }
.ss-name--small { font-size: 13px; line-height: 19px; font-weight: 600; }
.ss-role { font-size: 12px; }
.ss-act { min-width: 72px; height: 40px; padding: 0 8px; border: 5px solid transparent; border-radius: 20px; background: var(--k-paper) padding-box; box-shadow: inset 0 0 0 1px var(--k-red-line); font-size: 12px; font-weight: 500; line-height: 30px; }
.ss-tip { margin-top: 4px; font-size: 12px; line-height: 18px; }
.ss-line { margin: 10px 0; }
.ss--compact .ss-line { margin: 0 0 0 46px; transform: scaleY(.5); }
.ss-edit { font-size: 12px; }
.ss-share__title { font-size: 14px; line-height: 21px; font-weight: 600; }
.ss-share__sub { font-size: 11px; line-height: 16px; }
.ss-share__btn :deep(.k-button) { border-radius: 20px; }
.ss-retry { margin-top: 8px; padding: 8px 12px; border: 0; border-radius: 12px; }
.ss-retry--compact { margin-top: 8px; }
/* r3jobsb 返修 2（11-18）：联系卡两个打头的方块同一个样子——圆角方块、浅棕纯色底（原来一个正圆一个方块、都是渐变底） */
.ss-face { border-radius: 12px; background: var(--k-red-soft); }
.ss--compact .ss-face { border-radius: 10px; }
/* r3jobsb 返修 4（11-18 夜）：小入口卡左右内边距 16（和同页白卡一条线）；每行至少 56 高、上下各留 6，两行字时离卡底也有空 */
.ss--compact { padding: 4px 16px; }
.ss--compact .ss-person { box-sizing: border-box; min-height: 56px; padding: 6px 0; }
</style>
