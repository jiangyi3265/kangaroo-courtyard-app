<template>
  <view class="k-page invite">
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
          <text class="rule">{{ data.rule }}</text>
          <k-button block icon="share-2" open-type="share" class="share-btn" @click="onShare">分享给朋友</k-button>
          <view class="notes"><text v-for="note in data.notes" :key="note" class="note">· {{ note }}</text></view>
        </view>

        <view class="card list-card">
          <view class="k-between list-head">
            <text class="k-title">我邀请的朋友</text>
            <text class="k-small k-muted">{{ summaryText }}</text>
          </view>
          <text v-if="!data.invitees.length" class="empty">还没有邀请到朋友。点上面的「分享给朋友」，朋友从你分享的页面进来并登录后，就会显示在这里。</text>
          <view v-for="(friend, i) in data.invitees" :key="i" class="friend">
            <view class="friend__copy">
              <text class="friend__name">{{ friend.name }}</text>
              <text class="k-meta">{{ friend.joinDate ? friend.joinDate + ' 加入' : '已加入' }}</text>
            </view>
            <text class="friend__status" :class="{ done: friend.done }">{{ friend.statusText }}</text>
          </view>
        </view>

        <view v-if="data.canBind" class="card bind-card">
          <text class="k-title">是朋友邀请你来的？</text>
          <text class="k-small k-muted bind-tip">注册 24 小时内、还没报名或下单时，可以填朋友的邀请码。{{ data.executionEnabled ? '你完成符合条件的换工、兼职或全职培训后，朋友会得到积分。' : '你完成第一次换工或线上任务后，朋友会得到积分。' }}</text>
          <k-button type="secondary" size="md" :disabled="binding" :label="binding ? '正在提交…' : '填写朋友的邀请码'" @click="bindCode" />
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
  : { title: '袋鼠全球青年 · 换工换宿', path: '/pages/home/index' }))

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
</style>
