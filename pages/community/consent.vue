<template>
  <view class="k-page consent-page" :class="$userSurface"><k-topbar :title="doc?.title || '参与须知'" back :fab="false" />
    <view class="consent-body">
      <text v-if="loading" class="consent-loading">正在加载全文…</text>
      <template v-else-if="doc">
        <k-agreement-reader :content-key="doc.content" :text="doc.content" height="53vh" @read="markRead" />
        <checkbox-group @change="agreed = readComplete && $event.detail.value.includes('agree')"><label class="consent-check"><checkbox value="agree" :checked="agreed" :disabled="!readComplete || saving" /><text>我已年满18周岁，已阅读并同意以上规则</text></label></checkbox-group>
        <k-button block :disabled="!readComplete || !agreed || saving" :label="saving ? '正在确认…' : '同意并继续'" @click="accept" />
      </template>
      <view v-if="error" class="err-card" :class="{ 'err-card--plain': !!doc }"><view v-if="!doc" class="err-card__icon"><k-icon name="alert-circle" :size="28" color="red" /></view><text v-if="error" class="k-alert">{{ error }}</text><k-button v-if="error && !doc" type="outline" label="重新加载" @click="load" /></view>
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
/* 2026-11-17 改版「小而精」：浅灰底、页边距 12、按钮是 44 高的胶囊；须知全文的字号不动（要读完才能勾选） */
.consent-page{--k-bg:var(--k-page);background:var(--k-page)}
.consent-page :deep(.k-topbar){background:var(--k-page)}
.consent-page :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.consent-page .consent-body{padding:12px 12px 36px}
.consent-page .consent-check{margin:16px 2px;font-size:13px;line-height:1.6}
.consent-page .consent-body :deep(.k-button){height:44px;border-radius:22px;box-shadow:none;font-size:15px}
/* 须知没加载出来：和「我的发布」的空状态一个样子——居中的小圆标 + 一句说明 + 居中的「重新加载」（原来红字和按钮都贴在左上角） */
.consent-page .consent-body .k-alert{text-align:center;font-size:13px;line-height:1.7}
.consent-page .consent-body .k-alert:first-child{margin-top:64px}
.consent-page .consent-body .k-alert:first-child::before{content:'!';display:block;width:40px;height:40px;margin:0 auto 10px;border-radius:50%;background:var(--k-alert-soft);color:var(--k-alert);font-size:20px;font-weight:600;line-height:40px;text-indent:0}
.consent-page .consent-body :deep(.k-button.is-outline){display:flex;width:128px;height:36px;margin:14px auto 0;padding:0;border-color:var(--k-red-line);border-radius:18px;color:var(--k-red-deep);font-size:13px}
/* 第二轮精修：加载中是居中的 12 号浅灰字，上下留白 28 */
.consent-page .consent-loading{display:block;padding:28px 0;text-align:center;color:var(--k-muted);font-size:12px;line-height:1.6}
/* 勾选框：圆角 4，勾上是暖棕底白勾（和全站选中色一致） */
.consent-page .consent-check :deep(.wx-checkbox-input),.consent-page .consent-check :deep(.uni-checkbox-input){border-radius:4px;border-color:var(--k-line2)}
.consent-page .consent-check :deep(.wx-checkbox-input.wx-checkbox-input-checked),.consent-page .consent-check :deep(.uni-checkbox-input.uni-checkbox-input-checked){background:var(--k-red);border-color:var(--k-red)}
.consent-page .consent-check :deep(.wx-checkbox-input.wx-checkbox-input-checked::before),.consent-page .consent-check :deep(.uni-checkbox-input.uni-checkbox-input-checked::before){color:#fff}
</style>

<style scoped>
/* 11-18 第三轮精修：须知没加载出来时和全组空状态一个样子——白卡（圆角 12、上下留白 32）里 56 的浅红方块 + 32 线性图标、14 / 500 一句话、32 高次按钮小胶囊 */
.consent-page .err-card{margin-top:12px;padding:32px 16px;border-radius:12px;background:var(--k-paper);display:flex;flex-direction:column;align-items:center}
.consent-page .err-card--plain{margin-top:12px;padding:0;background:transparent}
.consent-page .err-card__icon{width:56px;height:56px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:var(--k-alert-soft)}
.consent-page .consent-body .err-card .k-alert{margin:0;font-size:14px;font-weight:500;line-height:1.6;color:var(--k-ink)}
.consent-page .consent-body .err-card .k-alert:first-child{margin-top:0}
.consent-page .consent-body .err-card .k-alert::before{content:none;display:none}
.consent-page .consent-body .err-card :deep(.k-button.is-outline){width:auto;height:32px;margin:12px auto 0;padding:0 16px;font-size:12px;font-weight:500}
</style>

<style scoped>
/* 11-18 返修第 5 轮：三个出错 / 兜底卡离顶栏统一 12（页面本身上边距已是 12） */
.consent-page .consent-body .err-card{margin-top:0}
</style>
<style scoped>
/* 11-18 夜 第四轮精修：须知没加载出来时不套白卡，放在页面底色上、下移到约屏高 1/4；浅棕方块 + 暖棕图标；「重新加载」32 高次按钮 */
.consent-page .consent-body .err-card:not(.err-card--plain){margin-top:84px;padding:0 16px;background:transparent}
.consent-page .err-card__icon{margin-bottom:12px;background:var(--k-red-soft)}
.consent-page .consent-body .err-card :deep(.k-button.is-outline){height:32px;margin-top:16px;padding:0 16px;border-radius:16px;line-height:32px;font-size:12px}
</style>
