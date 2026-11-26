<template>
  <view class="editor">
    <k-topbar title="编辑动态" back custom-back @back="close" />
    <view class="editor-body">
      <view v-if="!ready" class="editor-state"><text>{{ error || '正在读取原内容…' }}</text><k-button v-if="error" type="outline" @click="load">重新加载</k-button></view>
      <template v-else>
        <text class="editor-hint">修改后会重新检查内容，审核通过后公开展示。</text>
        <text class="editor-label">标题</text>
        <input v-model="title" class="editor-input" maxlength="60" placeholder="填写动态标题" :disabled="busy" />
        <text class="editor-label">正文</text>
        <textarea v-model="content" class="editor-content" maxlength="500" placeholder="分享你的内容" :disabled="busy" />
        <text class="editor-count">{{ content.length }}/500</text>
        <text class="editor-label">图片 {{ images.length }}/9</text>
        <view class="editor-images">
          <view v-for="(src, i) in images" :key="i" class="editor-photo">
            <image :src="absUrl(src)" mode="aspectFill" @click="preview(i)" />
            <button class="editor-remove" :disabled="busy" :aria-label="'移除第' + (i + 1) + '张图片'" @click="images.splice(i, 1)"><k-icon name="x" :size="14" color="muted" /></button>
          </view>
          <button v-if="images.length < 9" class="editor-add" :disabled="busy" @click="addImages"><k-icon name="plus" :size="24" color="red" /><text>{{ uploading ? '上传中…' : '添加图片' }}</text></button>
        </view>
        <view v-if="activityId" class="editor-hint">关联活动及报名记录会保留。活动时间、地点等信息请在“管理活动”中编辑。</view>
        <text v-if="error" class="editor-error">{{ error }}</text>
        <view class="editor-actions"><k-button type="outline" :disabled="busy" @click="close">取消</k-button><k-button :disabled="busy" @click="save">{{ saving ? '保存中…' : '保存修改' }}</k-button></view>
      </template>
    </view>
  </view>
</template>
<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiPostEditView, apiEditPost } from '@/common/api.js'
import { experience } from '@/common/experience.js'
import { absUrl, chooseImages, uploadTo } from '@/common/upload.js'
import { gated } from '@/common/community.js'
import { errText, confirm } from '@/common/ui.js'
import { toast } from '@/common/screen.js'
const props = defineProps({ postId: { type: Number, required: true } })
const emit = defineEmits(['close', 'saved'])
const title = ref(''), content = ref(''), images = ref([]), activityId = ref(0), ready = ref(false), error = ref(''), saving = ref(false), uploading = ref(false)
const busy = computed(() => saving.value || uploading.value)
let token = '', initial = '', owner = experience.account?.id, loading = false
const snapshot = () => JSON.stringify([title.value, content.value, images.value])
function sameAccount() { if (!owner || experience.account?.id !== owner) throw new Error('登录账号已变化，请退出编辑后重试') }
async function load() {
  if (loading) return
  loading = true; error.value = ''
  try {
    sameAccount()
    const d = (await apiPostEditView(props.postId)).data
    sameAccount()
    title.value = d.title || ''; content.value = d.content || ''; images.value = d.images || []; activityId.value = d.activityId || 0; token = d.editToken
    initial = snapshot(); ready.value = true
  } catch (e) { error.value = errText(e, '原内容加载失败') }
  finally { loading = false }
}
async function close() {
  if (busy.value) return
  if (ready.value && initial !== snapshot() && !(await confirm('放弃修改', '当前修改还未保存，确认返回？'))) return
  emit('close')
}
const preview = (i) => uni.previewImage({ current: i, urls: images.value.map(absUrl) })
async function addImages() {
  if (busy.value) return
  uploading.value = true; error.value = ''
  try {
    sameAccount()
    const paths = await chooseImages(9 - images.value.length)
    for (const path of paths.slice(0, 9 - images.value.length)) {
      sameAccount()
      const res = await uploadTo('/app/upload/image', path)
      sameAccount(); images.value.push(res.data.url)
    }
  } catch (e) { error.value = errText(e, '上传失败，请重试') }
  finally { uploading.value = false }
}
async function save() {
  if (busy.value || !ready.value) return
  if (!title.value.trim()) { error.value = '请填写标题'; return }
  saving.value = true; error.value = ''
  try {
    sameAccount()
    const payload = { title: title.value.trim(), content: content.value, images: [...images.value], editToken: token }
    const res = await gated(() => { sameAccount(); return apiEditPost(props.postId, payload) })
    sameAccount(); toast(res.data?.message || '修改已保存'); emit('saved')
  } catch (e) { error.value = errText(e, '保存失败，修改内容已保留') }
  finally { saving.value = false }
}
onMounted(load)
</script>
<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：页边距 12；输入框是白底圆角 12、不描边；图片圆角 8；按钮是 42 高的胶囊。功能和文字不变 */
.editor-body { padding: 8px 12px calc(28px + env(safe-area-inset-bottom)); }
.editor-hint { display:block; color:var(--k-muted); font-size:12px; line-height:1.7; margin:0 2px 10px; }
.editor-label { display:block; margin:14px 2px 6px; font-size:14px; font-weight:600; color:var(--k-ink); }
.editor-input, .editor-content { box-sizing:border-box; width:100%; padding:12px; background:var(--k-paper); border:0; border-radius:12px; font-size:15px; }
.editor-input { height:44px; padding:0 12px; }.editor-content { height:180px; font-size:14px; line-height:1.7; }
.editor-count { display:block; text-align:right; margin-top:4px; color:var(--k-muted); font-size:11px; }
.editor-images { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
.editor-photo,.editor-add { position:relative; width:calc((100% - 16px) / 3); height:96px; }
.editor-photo image { width:100%; height:100%; border-radius:8px; }
.editor-remove { position:absolute; top:0; right:0; margin:0; width:32px; height:32px; padding:0; line-height:30px; color:var(--k-alert); background:var(--k-paper); border-radius:0 8px; }
/* 第二轮精修：右上角的「移除」从文字「×」换成 14 号浅灰叉图标，按钮大小不变 */
.editor-remove { display:flex; align-items:center; justify-content:center; }
.editor-remove::after { border:0; }
.editor-add { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; margin:0; padding:0; color:var(--k-red-deep); font-size:11px; background:var(--k-paper); border:1px dashed var(--k-line2); border-radius:8px; }
.editor-actions { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:10px; margin-top:20px; }
.editor-actions :deep(.k-button) { height:44px; border-radius:22px; box-shadow:none; font-size:15px; }
/* 「取消」是次按钮：白底 + 棕色细边 + 深棕字（原来是灰边黑字）；不可点时跟着整体淡掉 */
.editor-actions :deep(.k-button.is-outline) { border-color:var(--k-red-line) !important; color:var(--k-red-deep) !important; background:var(--k-paper) !important; }
.editor-error { display:block; color:var(--k-alert); font-size:12px; line-height:1.6; }
.editor-state { display:flex; flex-direction:column; gap:12px; align-items:center; padding:32px 0; color:var(--k-muted); font-size:12px; }
/* 正在读取 / 没读出来：白卡内居中，12 号浅灰说明，上下留白 28；
   「重新加载」是次按钮小胶囊：看上去 32 高（白底 + 棕色细边 + 深棕字），外面 2 的透明边把可点高度留在 36 */
.editor-state { gap:10px; margin-top:4px; padding:28px 16px; border-radius:12px; background:var(--k-paper); line-height:1.6; text-align:center; }
.editor-state :deep(.k-button) { height:36px; padding:0 16px; border:2px solid transparent; border-radius:18px; background:#fff padding-box; box-shadow:inset 0 0 0 1px var(--k-red-line); color:var(--k-red-deep); font-size:12px; font-weight:500; }
</style>
