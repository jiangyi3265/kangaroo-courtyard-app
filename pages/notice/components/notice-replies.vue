<template>
  <view class="replies">
    <view class="replies__heading"><text class="replies__title">联系管理员</text><text v-if="account" class="replies__refresh" @click="load(false)">刷新</text></view>
    <text class="replies__hint">仅你与平台管理员可见，回复后可在消息中心继续沟通。</text>
    <template v-if="!account"><k-button type="outline" size="sm" label="登录后回复" @click="go(R.login)" /></template>
    <template v-else>
      <text v-if="loading && !ready" class="replies__hint">正在加载对话…</text>
      <view v-if="error" class="replies__error"><text>{{ error }}</text><k-button size="sm" type="outline" label="重新加载" @click="load(false)" /></view>
      <template v-if="ready">
        <text v-if="thread && !noticeAvailable" class="replies__hint">原公告已下线：{{ thread.noticeTitle }}。已有对话仍可继续。</text>
        <k-button v-if="hasMore" type="outline" size="sm" :disabled="loading" label="查看更早记录" @click="load(true)" />
        <text v-if="!messages.length" class="replies__empty">对这条通知有疑问？在下方写给管理员。</text>
        <view v-for="m in messages" :key="m.replyId" class="reply" :class="{ 'reply--mine': m.sender === 'user' }">
          <text class="reply__meta">{{ m.sender === 'user' ? '我' : '平台管理员' }} · {{ m.createTime }}</text>
          <text class="reply__text">{{ m.content }}</text>
        </view>
        <text v-if="thread && thread.pending === '1'" class="replies__hint">已发送，等待管理员回复</text>
        <view class="replies__compose">
          <textarea v-model="draft" class="replies__input" :maxlength="1000" :disabled="sending" placeholder="写下你的问题或回复…" :adjust-position="true" :cursor-spacing="90" />
          <view class="replies__actions"><text class="replies__hint">{{ draft.length }}/1000</text><k-button size="sm" :disabled="sending || !draft.trim()" :label="sending ? '发送中…' : '发送回复'" @click="send" /></view>
          <text v-if="sendError" class="replies__error">{{ sendError }}</text>
        </view>
      </template>
    </template>
  </view>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { experience } from '@/common/experience.js'
import { apiNoticeReplies, apiNoticeReply, apiNoticeRepliesRead } from '@/common/api.js'
import { go } from '@/common/screen.js'
import R from '@/common/routes.js'
import { errText } from '@/common/ui.js'
const props = defineProps({ noticeId: { type: [Number, String], required: true }, active: Boolean, noticeAvailable: Boolean })
const account = computed(() => experience.account)
const messages = ref([]), thread = ref(null), ready = ref(false), loading = ref(false), hasMore = ref(false)
const draft = ref(''), error = ref(''), sendError = ref(''), sending = ref(false)
let serial = 0, generation = 0, timer, retry = null, marked = 0
const merge = rows => {
  const all = new Map(messages.value.map(m => [String(m.replyId), m]))
  rows.forEach(m => all.set(String(m.replyId), m))
  messages.value = [...all.values()].sort((a, b) => Number(a.replyId) - Number(b.replyId))
}
async function load(older = false) {
  if (!account.value || !props.active || loading.value) return
  const seq = ++serial
  loading.value = true
  try {
    const d = (await apiNoticeReplies(props.noticeId, older ? messages.value[0]?.replyId : undefined)).data
    if (seq !== serial) return
    thread.value = d.thread
    if (older || !ready.value) hasMore.value = d.hasMore
    merge(d.rows || [])
    ready.value = true; error.value = ''
    const through = Number(messages.value[messages.value.length - 1]?.replyId || 0)
    if (through > marked) {
      await apiNoticeRepliesRead(props.noticeId, through)
      if (seq === serial) marked = through
    }
  } catch (e) {
    if (seq === serial) error.value = errText(e, '对话加载失败，请重试')
  } finally { if (seq === serial) loading.value = false }
}
async function send() {
  const content = draft.value.trim()
  if (!content || sending.value) return
  if (!retry || retry.content !== content) retry = { content, requestId: 'notice_' + Date.now() + '_' + Math.random().toString(36).slice(2) }
  const current = generation
  sending.value = true; sendError.value = ''
  try {
    const r = await apiNoticeReply(props.noticeId, { ...retry, mode: experience.mode })
    if (current !== generation) return
    merge([r.data]); draft.value = ''; retry = null
    thread.value = { ...(thread.value || {}), pending: '1' }
    load(false)
  } catch (e) { if (current === generation) sendError.value = errText(e, '发送失败，内容已保留，请重试') }
  finally { if (current === generation) sending.value = false }
}
watch(() => [props.noticeId, account.value?.id], () => {
  serial++; generation++; loading.value = false; sending.value = false; marked = 0
  messages.value = []; thread.value = null; ready.value = false; hasMore.value = false
  draft.value = ''; error.value = ''; sendError.value = ''; retry = null
  load(false)
}, { immediate: true })
watch(() => props.active, active => {
  clearInterval(timer)
  if (active) { load(false); timer = setInterval(() => load(false), 10000) }
  else { serial++; loading.value = false }
}, { immediate: true })
onBeforeUnmount(() => { serial++; generation++; clearInterval(timer) })
</script>
<style scoped>
.replies{margin-top:24px;padding:0 2px 24px}.replies__heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}.replies__title{font-size:17px;font-weight:600;color:var(--k-ink)}.replies__refresh{padding:10px 0 10px 16px;font-size:13px;color:var(--k-brown)}.replies__hint{display:block;font-size:12px;color:var(--k-muted);line-height:1.7;margin-bottom:12px}.replies__empty{display:block;padding:22px 0;font-size:14px;color:var(--k-muted)}.reply{display:flex;flex-direction:column;align-items:flex-start;margin:16px 0}.reply--mine{align-items:flex-end}.reply__meta{font-size:11px;color:var(--k-muted);margin-bottom:6px}.reply__text{max-width:88%;box-sizing:border-box;background:var(--k-paper);border:1px solid var(--k-line2);padding:11px 13px;border-radius:12px;font-size:14px;line-height:1.75;white-space:pre-wrap;word-break:break-word;color:var(--k-ink)}.reply--mine .reply__text{background:var(--k-paper2)}.replies__compose{margin-top:18px;padding:12px;background:var(--k-paper);border:1px solid var(--k-line2);border-radius:12px}.replies__input{width:100%;height:88px;font-size:14px;line-height:1.65;color:var(--k-ink);box-sizing:border-box}.replies__actions{display:flex;align-items:center;justify-content:space-between;margin-top:10px}.replies__actions .replies__hint{margin:0}.replies__error{display:flex;align-items:center;gap:8px;margin:10px 0;font-size:13px;line-height:1.6;color:var(--k-alert)}
</style>
