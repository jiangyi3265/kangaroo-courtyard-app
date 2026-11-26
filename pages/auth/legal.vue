<template>
  <view class="k-page legal" :class="$userSurface" :style="{ '--legal-top': statusTop + 'px' }">
    <k-topbar :title="doc.title || '协议与隐私'" back />
    <view class="k-body k-pad-safe">
      <k-card :pad="16">
        <view v-if="doc.configured">
          <text v-if="doc.updated" class="k-meta">更新日期：{{ doc.updated }}</text>
          <scroll-view :key="doc.version" class="legal-text" scroll-y enhanced :show-scrollbar="false">
            <rich-text :nodes="doc.html" />
          </scroll-view>
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
        <view v-else class="empty empty--c"><k-icon name="loader-circle" :size="16" color="muted" /><text>加载中…</text></view>
      </k-card>
    </view>
    <k-bottom v-if="doc.configured" flat pad="8px 16px"><k-button block label="已读完，返回" @click="finishRead" /></k-bottom>
  </view>
</template>

<script setup>
// 协议与隐私全文：内容由运营在后台通知公告发布，代码里不内置法律文本
import { ref, getCurrentInstance } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { apiLegal } from '@/common/api.js'
import { errText } from '@/common/ui.js'

// 11-18 微信里整页比一屏高、出现两层滚动：阅读框高度要扣掉自绘顶栏里的状态栏（和 k-topbar 同一种取法），页面底部只留安全区
let statusTop = 44
// #ifndef H5
try { statusTop = uni.getSystemInfoSync().statusBarHeight || 20 } catch (e) { statusTop = 20 }
// #endif
const doc = ref({ title: '', configured: false, html: '' })
const loaded = ref(false)
const instance = getCurrentInstance()
let returning = false
function finishRead() {
  if (returning || !doc.value.configured) return
  returning = true
  instance.proxy.getOpenerEventChannel?.().emit('read', { key, version: doc.value.version })
  uni.navigateBack({ fail: () => { returning = false } })
}
const loadError = ref('')
let key = 'privacy'
async function load() {
  loadError.value = ''
  loaded.value = false
  doc.value = { title: key === 'terms' ? '用户协议' : '隐私政策', configured: false, html: '' }
  try {
    const data = (await apiLegal(key)).data
    if (!data || typeof data.configured !== 'boolean') throw new Error('协议加载失败，请重试')
    doc.value = { ...data, configured: !!data.version && data.configured && typeof data.html === 'string' && data.html.trim().length > 0 }
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
.legal{--k-bg:var(--k-page);--k-sh1:none}
.legal :deep(.k-card){border-radius:12px!important;padding:14px 16px 16px!important}
.legal :deep(.k-button.is-lg){height:44px;font-size:15px}
.legal :deep(.k-bottom){box-shadow:0 -.5px 0 rgba(58,50,43,.1)}
.legal-text{height:calc(100vh - var(--legal-top) - 170px - var(--k-safe-bottom));margin-top:8px;color:var(--k-ink2);font-size:14px;line-height:1.85;overflow-wrap:anywhere}
.k-body{padding-left:16px;padding-right:16px}
.empty{display:flex;flex-direction:column;padding:24px 0;font-size:14px;color:var(--k-ink)}.empty--c{align-items:center;gap:8px;padding:48px 0;font-size:12px;color:var(--k-muted)}
</style>
