<template>
  <view class="k-page"><k-topbar :title="doc?.title || '参与须知'" back :fab="false" />
    <view class="consent-body">
      <text v-if="loading">正在加载全文…</text>
      <template v-else-if="doc">
        <k-agreement-reader :content-key="doc.content" :text="doc.content" height="53vh" @read="markRead" />
        <checkbox-group @change="agreed = readComplete && $event.detail.value.includes('agree')"><label class="consent-check"><checkbox value="agree" :checked="agreed" :disabled="!readComplete || saving" /><text>我已年满18周岁，已阅读并同意以上规则</text></label></checkbox-group>
        <k-button block :disabled="!readComplete || !agreed || saving" :label="saving ? '正在确认…' : '同意并继续'" @click="accept" />
      </template>
      <text v-if="error" class="k-alert">{{ error }}</text><k-button v-if="error && !doc" type="outline" label="重新加载" @click="load" />
    </view>
  </view>
</template>
<script setup>
import { ref, getCurrentInstance } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { apiCommunityRules, apiCommunityConsent } from '@/common/api.js'
import { getToken } from '@/common/request.js'
const instance = getCurrentInstance(), doc = ref(null), loading = ref(false), error = ref(''), saving = ref(false), readComplete = ref(false), agreed = ref(false)
let key = '', session = '', alive = true, completed = false
const markRead = value => { readComplete.value = value; if (!value) agreed.value = false }
async function load() {
  loading.value = true; doc.value = null; error.value = ''; markRead(false)
  try { const data = (await apiCommunityRules(key)).data; if (!data?.content?.trim()) throw new Error('须知内容暂不可用'); if (alive) doc.value = data }
  catch(e) { if (alive) error.value = e.message || '加载失败' } finally { if (alive) loading.value = false }
}
async function accept() {
  if (!doc.value || !readComplete.value || !agreed.value || saving.value) return
  saving.value = true; error.value = ''
  try {
    if (!session || session !== getToken()) throw new Error('登录状态已改变，请返回后重新操作')
    const latest = (await apiCommunityRules(key)).data
    if (!alive) return
    if (session !== getToken()) throw new Error('登录状态已改变，请返回后重新操作')
    if (!latest?.content?.trim()) { doc.value = null; markRead(false); throw new Error('须知内容暂不可用，请重新加载') }
    if (latest?.content !== doc.value.content) { doc.value = latest; markRead(false); throw new Error('须知已更新，请重新阅读') }
    await apiCommunityConsent(key)
    if (!alive || session !== getToken()) return
    completed = true; instance.proxy.getOpenerEventChannel().emit('done', true); uni.navigateBack()
  } catch(e) { if (alive) error.value = e.message || '确认失败' } finally { if (alive) saving.value = false }
}
onLoad(q => { key = q?.doc || ''; session = getToken(); load() })
onUnload(() => { alive = false; if (!completed) instance.proxy.getOpenerEventChannel().emit('done', false) })
</script>
<style scoped>
.consent-body{padding:16px 20px 36px;font-size:14px;line-height:1.8}.consent-check{display:flex;align-items:flex-start;gap:8px;margin:20px 0}.k-alert{display:block;margin-top:12px}
</style>
