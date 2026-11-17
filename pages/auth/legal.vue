<template>
  <view class="k-page legal">
    <k-topbar :title="doc.title || '协议与隐私'" back />
    <view class="k-body k-pad-bottom">
      <k-card :pad="16">
        <view v-if="doc.configured">
          <text v-if="doc.updated" class="k-meta">更新日期：{{ doc.updated }}</text>
          <k-agreement-reader :content-key="doc.version" :html="doc.html" height="58vh" @read="readComplete = $event" />
          <k-button block :disabled="!readComplete" label="已读完，返回" @click="finishRead" />
        </view>
        <!-- 之前加载失败也显示「尚未发布」，还把后台菜单路径（给运营看的）露给了用户 -->
        <view v-else-if="loadError" class="empty">
          <text>{{ loadError }}</text>
          <text class="k-link k-mt8" @click="load">点此重新加载</text>
        </view>
        <view v-else-if="loaded" class="empty">
          <text>协议内容暂不可用，请稍后重试。</text>
          <text class="k-meta k-mt8">内容恢复前不会要求你同意，你仍可以先浏览。</text>
          <text class="k-link k-mt8" @click="load">重新加载</text>
        </view>
        <text v-else class="k-meta">加载中…</text>
      </k-card>
    </view>
  </view>
</template>

<script setup>
// 协议与隐私全文：内容由运营在后台通知公告发布，代码里不内置法律文本
import { ref, getCurrentInstance } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { apiLegal } from '@/common/api.js'
import { errText } from '@/common/ui.js'

const doc = ref({ title: '', configured: false, html: '' })
const loaded = ref(false)
const readComplete = ref(false), instance = getCurrentInstance()
function finishRead() {
  if (!readComplete.value || !doc.value.configured) return
  instance.proxy.getOpenerEventChannel?.().emit('read', { key, version: doc.value.version })
  uni.navigateBack()
}
const loadError = ref('')
let key = 'privacy'
async function load() {
  loadError.value = ''
  readComplete.value = false
  loaded.value = false
  doc.value = { title: key === 'terms' ? '用户协议' : '隐私政策', configured: false, html: '' }
  try {
    const data = (await apiLegal(key)).data
    if (!data || typeof data.configured !== 'boolean') throw new Error('协议加载失败，请重试')
    doc.value = { ...data, configured: data.configured && typeof data.html === 'string' && data.html.trim().length > 0 }
  } catch (e) {
    loadError.value = errText(e, '加载失败，请重试')
  } finally {
    loaded.value = true
  }
}
onLoad((q) => {
  key = q?.key === 'terms' ? 'terms' : 'privacy'
  doc.value.title = key === 'terms' ? '用户协议' : '隐私政策'
  load()
})
</script>

<style scoped lang="scss">
/* 10-19 字体复查：协议全文是正文，用系统黑体（--k-serif 现在是只有粗体的标题字体，整页挂着全文都变粗）；标题在顶栏 */
.legal { font-family: var(--k-sans); }
.content { display: block; max-width: 100%; overflow-wrap: anywhere; word-break: break-all; font-size: 14px; line-height: 1.75; color: var(--k-ink); }
.empty { display: flex; flex-direction: column; padding: 24px 0; font-size: 14px; color: var(--k-ink); }
</style>
