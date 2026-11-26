<template>
  <view class="k-page subscriptions" :class="$userSurface">
    <k-topbar title="微信订阅提醒" back />
    <view class="k-body">
      <text class="intro">一次订阅当前身份的微信提醒。</text>
      <text class="hint">多项业务可以共用一个模板。每个模板允许一次，可收到一条微信提醒。</text>
      <view v-if="!account" class="empty"><view class="empty__ico"><k-icon name="bell" :size="32" color="red" /></view><text>登录后设置自己的提醒</text><k-button @click="goLogin">去登录</k-button></view>
      <view v-else-if="state.loading && !state.groups.length" class="empty">正在读取订阅设置…</view>
      <view v-else-if="!state.enabled || !state.groups.length" class="empty"><view class="empty__ico"><k-icon name="bell-off" :size="32" color="red" /></view><text>微信提醒暂未开放，站内消息照常接收。</text></view>
      <text v-if="state.error" class="error">{{state.error}}</text><text v-if="state.notice" class="notice">{{state.notice}}</text>
      <k-button v-if="state.retry" :disabled="state.busy" @click="controller.retrySave">重试保存授权</k-button>
      <k-button v-else-if="state.error" :disabled="state.loading || state.busy" type="secondary" @click="controller.warm(true)">重新读取</k-button>
      <view v-if="account && state.enabled && state.groups.length" class="batch">
        <k-button block :disabled="state.busy || state.loading || state.retry || !canAsk" @click="controller.ask(true)">{{ batchLabel }}</k-button>
        <text v-if="state.remaining > 3" class="hint">还有 {{state.remaining}} 个模板，微信每次最多确认 3 个。其余可在这里继续订阅。</text>
      </view>
      <view v-if="account && state.groups.length" class="sub-list">
      <view v-for="group in state.groups" :key="group.templateId" class="subscription-card">
        <view class="sub-main"><text class="card-title"><text v-for="(l,i) in group.labels" :key="l" class="card-title__seg">{{l}}{{i !== group.labels.length-1 ? '、' : ''}}</text></text>
        <text class="hint">{{group.quota>0?'本地记录可发 '+group.quota+' 条，以微信实际授权为准':'暂无可用授权，允许后接收一条提醒'}}</text><k-button v-if="group.quota>0" size="sm" type="ghost" :disabled="state.busy || state.loading || state.retry" @click="stop(group)">关闭此模板提醒</k-button></view>
      </view>
      </view>
      <text class="hint tail">员工提醒只发送给业务已指定的人员。打开消息后仍会核对身份、门店和城市权限。</text>
    </view>
  </view>
</template>
<script setup>
import {computed} from 'vue'
import {onShow} from '@dcloudio/uni-app'
import {apiSubscribeRevoke} from '@/common/api.js'
import {experience,ensureSession} from '@/common/experience.js'
import {subscriptionState as state, subscriptionScope, visitSubscriptions as controller} from '@/common/visit-subscriptions.js'
const account = computed(() => experience.account)
const canAsk = computed(() => state.value.groups.some(g => g.quota < 5))
const batchLabel = computed(() => {
  if (!canAsk.value) return '提醒次数已满'
  if (state.value.busy) return '正在处理…'
  if (!state.value.remaining) return '再订阅一次'
  if (state.value.remaining > 3) return '订阅本组提醒'
  return state.value.groups.filter(g => g.quota < 5).length === state.value.remaining ? '订阅全部提醒' : '订阅剩余提醒'
})
onShow(async () => { await ensureSession(); controller.warm(true) })
const goLogin=()=>uni.navigateTo({url:'/pages/auth/login'})
const stop = group => {
  const owner = subscriptionScope()
  uni.showModal({title:'关闭此模板提醒',content:'将清空「'+group.labels.join('、')+'」共用的微信授权次数。站内消息不受影响。',success:async result=>{
    if (!result.confirm || !owner || owner !== subscriptionScope()) return
    try { await apiSubscribeRevoke(group.keys[0]); if (owner === subscriptionScope()) await controller.warm(true) }
    catch(e) { if (owner === subscriptionScope()) uni.showToast({title:e?.message||'关闭失败',icon:'none'}) }
  }})
}
</script>
<style scoped>
.batch{margin:14px 0}.batch .hint{display:block;margin-top:6px}
.k-body{padding:20px 16px 40px}.intro,.hint,.card-title,.error,.notice{display:block}.intro{font-size:18px;font-weight:600;line-height:1.6}.hint{font-size:12px;line-height:1.7;color:var(--k-muted);margin-top:8px}.subscription-card{padding:18px;margin-top:16px;background:var(--k-surface);border:1px solid var(--k-line2);border-radius:18px}.card-title{font-size:15px;font-weight:600;line-height:1.6}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.error{color:var(--k-alert);margin:12px 0}.notice{color:var(--k-green);margin:12px 0;line-height:1.7}.empty{padding:32px 0;display:flex;flex-direction:column;gap:20px}.tail{margin-top:22px}
/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底，每组提醒一张白卡（12 圆角、不描边；之前卡片没有底色）。功能和文字不变：订阅、再订阅一次、关闭、重试、查看全部都在 */
.subscriptions{--k-bg:var(--k-page);--k-radius:12px;background:var(--k-page)}
.subscriptions :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.subscriptions :deep(.k-button.is-lg){height:44px;font-size:15px;box-shadow:none}
.subscriptions :deep(.k-button.is-secondary){color:var(--k-red-deep)}
.subscriptions :deep(.k-button){border-radius:999px}
.k-body{padding:12px 12px 40px}
.intro{padding:0 2px;font-size:15px;font-weight:700;line-height:1.5}
.hint{margin-top:4px}
.k-body>.hint{padding:0 2px}
.subscription-card{margin-top:8px;padding:12px;border:0;border-radius:12px;background:var(--k-paper)}
.card-title{font-size:14px}
.actions{margin-top:10px}
.tail{margin-top:16px}
/* 11-18 第二轮：每张卡一颗的「订阅提醒 / 再订阅一次」改成浅底小按钮（28 高、浅棕底深棕字），整页不再排着十几颗实心棕钮；
   「关闭此模板提醒」退成 12 号灰字。不可点时交给公共组件整体变淡 .45（颜色加 !important，免得被公共组件的不可点原色盖回实心棕） */
/*    11-18 返修：看着仍 28 高，四周各 4 的透明边（和草稿箱「继续编辑」同一写法），点按高度 36；按钮行往左、上下各收 4，看着的位置不变 */
.subscriptions .actions{gap:0;margin:6px 0 -4px -4px}
.subscriptions .actions :deep(.k-button.is-sm){height:36px;padding:0 12px;border:4px solid transparent;border-radius:18px;font-size:12px;font-weight:500;box-shadow:none}
.subscriptions .actions :deep(.k-button.is-sm.is-primary){border-color:transparent;background:var(--k-red-soft) padding-box!important;color:var(--k-red-deep)!important}
.subscriptions .actions :deep(.k-button.is-sm.is-ghost){padding:0 8px;font-weight:400;color:var(--k-muted)!important}
/* 未登录 / 读取中 / 未开放：白卡里居中的空状态，「去登录」是 32 高的次按钮小胶囊 */
.empty{align-items:center;gap:8px;margin-top:8px;padding:28px 12px;border-radius:12px;background:var(--k-paper);font-size:12px;line-height:1.6;color:var(--k-muted);text-align:center}
/* 「去登录」原来 48 高：看着 32，上下各 6 的透明边，点按高度仍是 44 */
.subscriptions .empty :deep(.k-button.is-lg){height:44px;padding:0 16px;border:6px solid transparent!important;border-radius:22px;font-size:13px;font-weight:500;background:var(--k-paper) padding-box!important;box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep)!important}
/* 11-18 第三轮：页边距 16；顶部首句 14 / 600 墨色、说明 12 灰字；提醒组合成一张白卡（每行最少 64 高，行间发丝线左缩进 12），
   左边名字 14 / 600 + 说明 12 灰，右边一列：28 高小按钮、下面「关闭此模板提醒」12 号灰字；空状态加 56 浅棕方块 + 32 号图标 */
.k-body{padding-left:16px;padding-right:16px}
.intro{padding:0 4px;font-size:14px;font-weight:600;line-height:20px;color:var(--k-ink)}
.k-body>.hint{padding:0 4px;line-height:1.6}
.sub-list{margin-top:12px;border-radius:12px;background:var(--k-paper);overflow:hidden}
.sub-list>.subscription-card{position:relative;display:flex;align-items:center;gap:12px;min-height:64px;margin:0;padding:10px 8px 10px 12px;border-radius:0;background:transparent;box-sizing:border-box}
.sub-list>.subscription-card+.subscription-card::before{content:"";position:absolute;left:12px;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.sub-main{flex:1;min-width:0}
.sub-list .card-title{font-size:14px;font-weight:600;line-height:20px;color:var(--k-ink)}
.sub-list .hint{margin-top:2px;font-size:12px;line-height:1.5}
.subscriptions .sub-list .actions{flex:0 0 auto;flex-direction:column;align-items:flex-end;flex-wrap:nowrap;gap:0;margin:-4px 0}
.subscriptions .sub-list .actions :deep(.k-button.is-sm.is-ghost){height:28px;margin-top:-4px;padding:0 8px;border-width:0 4px;font-size:12px}
.empty{display:flex;flex-direction:column;align-items:center;gap:0;padding:32px 16px 28px}
.empty__ico{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-bottom:12px;border-radius:16px;background:var(--k-red-soft)}
.empty>text{font-size:14px;font-weight:500;line-height:1.6;color:var(--k-ink2)}
.empty :deep(.k-button){margin-top:12px}
.tail{padding:0 4px;text-align:left}
/* 11-18 第三轮返修：顶部说明、页尾说明贴页边距 16（和卡片同一条左线）；右边一列「关闭此模板提醒」右对齐到小胶囊的右边缘；
   320 宽：按钮挪到说明下面左对齐排成一行，文字占满整行，不再被挤成一两个字一行 */
.intro,.k-body>.hint,.tail{padding-left:0;padding-right:0}
.subscriptions .sub-list .actions :deep(.k-button.is-sm.is-ghost){margin-right:4px;padding-right:0;border-right-width:0}
@media (max-width:359px){
  .sub-list>.subscription-card{flex-direction:column;align-items:stretch;gap:0;padding-right:12px}
  .subscriptions .sub-list .actions{flex-direction:row;align-items:center;margin:6px 0 -4px -4px}
  .subscriptions .sub-list .actions :deep(.k-button.is-sm.is-ghost){margin-top:0;margin-right:0;padding:0 8px;border-width:4px}
}
/* 11-18 返修（第 2 轮）：每行的小胶囊都顶对齐（胶囊上沿和名字上沿齐），有两个操作和只有一个操作的行，胶囊在同一个位置；
   320 宽：首句 13 号、按整句均衡折两行，不再第二行只剩「进展。」 */
.sub-list>.subscription-card{align-items:flex-start;padding-top:14px;padding-bottom:14px}
@media (max-width:359px){
  .intro{font-size:13px;text-wrap:balance}
}
/* 11-18 第三轮返修（第 3 轮）：顶部首句 15 / 600（不再像公告那样 16 加粗），说明 12 号灰字；右侧「订阅提醒 / 再订阅一次」小胶囊最少 88 宽、字居中，一列按钮左右对齐 */
.intro{font-size:15px;font-weight:600;line-height:21px}
.k-body>.hint{font-size:12px;color:var(--k-muted)}
.subscriptions .sub-list .actions :deep(.k-button.is-sm.is-primary){min-width:88px;justify-content:center}
/* 11-18 第三轮返修（第 4 轮）：胶囊四周有 4 的透明边，最少宽改成 96（看得见的部分 88），「再订阅一次」「订阅提醒」左右两边都对齐；
   行间发丝线右边也缩进 12，和左边一样 */
.subscriptions .sub-list .actions :deep(.k-button.is-sm.is-primary){min-width:96px}
.sub-list>.subscription-card+.subscription-card::before{right:12px}
/* 11-18 第三轮返修（第 5 轮）：首句是说明不是标题：14 / 500 墨色，比卡内每行名字轻一档，第一眼落在下面的提醒列表上（320 宽仍 13 号） */
.intro{font-size:14px;font-weight:500;line-height:20px}
@media (max-width:359px){.intro{font-size:13px}}
/* 11-18 微信核对：标题按业务名分段、段内不断行，只在「、」处换行，不再落下一个「核」字 */
.sub-list .card-title__seg{white-space:nowrap}
/* 11-18 第四轮（高级感）：像 iOS 的通知设置 —— 每行左边「名字 14 / 600 + 状态 12 灰 +（已订阅时）『关闭此模板提醒』12 / 500 暖棕文字」，
   右边只留一颗 28 高描边小胶囊、竖直居中；一整列不再有浅棕色块。名字只在「、」处折行，首行能放几个业务就放几个；页首说明只在标点处折行 */
.sub-list>.subscription-card{align-items:center}
.subscriptions .sub-list .actions{align-self:center;margin:0}
.subscriptions .sub-list .actions :deep(.k-button.is-sm.is-primary){min-width:88px;height:28px;min-height:28px;padding:0 12px;border:0;border-radius:14px;background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-size:12px;font-weight:500}
.sub-main :deep(.k-button.is-sm.is-ghost){display:inline-flex;width:auto;height:24px;min-height:24px;margin:4px 0 0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;color:var(--k-red-deep);font-size:12px;font-weight:500}
.sub-main :deep(.k-button.is-sm.is-ghost)::after{border:0}
.sub-list .card-title{word-break:keep-all;overflow-wrap:anywhere}
.sub-list .card-title__seg{white-space:normal}
.k-body>.hint{word-break:keep-all;overflow-wrap:anywhere}
@media (max-width:359px){
  .subscriptions .sub-list .actions{margin:8px 0 0}
}
@media (max-width:359px){
  .sub-list>.subscription-card{align-items:stretch}
  .subscriptions .sub-list .actions{align-self:flex-start}
}
/* 11-18 第四轮返修：右边小胶囊真正变成白底细棕线（旧规则带 !important 的浅棕底压过了新写的白底，这里同样加 !important）；
   「关闭此模板提醒」补上行高 24（微信 button 默认行高约 2.55，字会偏下）；
   320 宽：小胶囊和「关闭此模板提醒」在同一行 —— 先「再订阅一次」、右边隔 12 是「关闭此模板提醒」，不再先看到关、后看到开 */
.subscriptions .sub-list .actions :deep(.k-button.is-sm.is-primary){background:var(--k-paper)!important;color:var(--k-red-deep)!important}
.sub-main :deep(.k-button.is-sm.is-ghost){line-height:24px}
@media (max-width:359px){
  .sub-list>.subscription-card{padding-bottom:14px}
  .sub-main :deep(.k-button.is-sm.is-ghost){position:absolute;left:112px;bottom:16px;margin:0}
}
/* 11-19 微信实拍返修：一列描边胶囊减半，状态一眼分得出 ——
   · 未授权的「订阅提醒」保留 28 高白底细棕线胶囊；
   · 已授权的「再订阅一次」改成无边框 12 / 500 暖棕文字钮（同样 28 高、右边和胶囊同一条线）；
   · 「关闭此模板提醒」是退订类次要操作：12 / 400 灰字，不再用暖棕抢主操作的颜色 */
.subscriptions .sub-list .actions--again :deep(.k-button.is-sm.is-primary){min-width:0;padding:0 0 0 12px;background:transparent!important;box-shadow:none;justify-content:flex-end}
.sub-main :deep(.k-button.is-sm.is-ghost){color:var(--k-muted);font-weight:400}
@media (max-width:359px){
  .subscriptions .sub-list .actions--again :deep(.k-button.is-sm.is-primary){padding:0;justify-content:flex-start}
  .sub-main :deep(.k-button.is-sm.is-ghost){left:92px}
}
</style>
