<template>
  <view class="k-page sc">
    <k-topbar title="写评论" back custom-back @back="onBack" />

    <view v-if="stage === 'loading'" class="sc-gate"><text class="sc-gate__sub">加载中…</text></view>

    <view v-else-if="stage === 'error'" class="sc-gate">
      <text class="sc-gate__title">{{ loadError }}</text>
      <view class="sc-gate__btn"><k-button size="md" label="重新加载" @click="loadMe" /></view>
    </view>

    <view v-else-if="stage === 'guest'" class="sc-gate">
      <image class="sc-gate__img" src="/static/media/stays-kangaroo-stamp.png" mode="aspectFit" />
      <text class="sc-gate__title">登录后才能写评论</text>
      <text class="sc-gate__sub">登录并验证手机号就能写，登录后会回到这里。</text>
      <view class="sc-gate__btn"><k-button size="md" label="去登录" @click="goLogin" /></view>
    </view>

    <view v-else-if="stage === 'phone'" class="sc-gate">
      <image class="sc-gate__img" src="/static/media/stays-kangaroo-stamp.png" mode="aspectFit" />
      <text class="sc-gate__title">先验证手机号</text>
      <text class="sc-gate__sub">验证后就能写评论。号码不会显示给其他人，已经写的内容不会丢。</text>
      <view class="sc-gate__btn"><k-button size="md" open-type="getPhoneNumber" label="授权并验证" @getphonenumber="onPhone" @click="onPhoneClick" /></view>
    </view>

    <view v-else class="sc-form">
      <view class="sc-tip">
        <text class="sc-tip__line">评论由平台审核后才展示，审核中只有你看得到。</text>
        <text class="sc-tip__line">不打星，不计入小院评分，和「住过的家人评价」分开。</text>
      </view>

      <view class="sc-box">
        <!-- 原生 textarea 画在页面最上层，滑到底部按钮下面会抢走点击；不在输入时只显示同样的文字，点一下才换成真输入框（和 review.vue 同一个做法） -->
        <textarea v-if="editing" v-model="text" class="sc-area" :maxlength="TEXT_MAX" placeholder="说说在小院的日常：住得怎么样，发生了什么有意思的事" placeholder-class="k-placeholder" :focus="true" auto-focus :show-confirm-bar="false" @blur="onAreaBlur" />
        <view v-else class="sc-area sc-area--idle" hover-class="k-press" @click="editing = true"><text :class="{ 'k-placeholder': !text }">{{ text || '说说在小院的日常：住得怎么样，发生了什么有意思的事' }}</text></view>
        <text class="sc-count">{{ text.length }}/{{ TEXT_MAX }}</text>
      </view>

      <view class="sc-media">
        <view class="sc-media__head"><text class="sc-media__title">图片或视频</text><text class="sc-media__hint">选填，二选一 · {{ video ? '1 段视频' : pics.length ? pics.length + '/' + PIC_MAX + ' 张' : '最多 ' + PIC_MAX + ' 张或 1 段视频' }}</text></view>
        <view class="sc-grid">
          <view v-for="(pic, picIdx) in pics" :key="pic.url" class="sc-cell">
            <image class="sc-cell__img" :src="pic.img" mode="aspectFill" @click="previewPic(picIdx)" />
            <view class="sc-cell__del" role="button" aria-label="删除这张照片" hover-class="k-press-s" @click.stop="removePic(picIdx)"><k-icon name="x" :size="12" color="white" :stroke="2.4" /></view>
          </view>
          <view v-if="video" class="sc-cell">
            <image v-if="video.cover" class="sc-cell__img" :src="absUrl(video.cover)" mode="aspectFill" @click="previewOwnVideo" />
            <view v-else class="sc-cell__img sc-cell__img--video" hover-class="k-press-s" @click="previewOwnVideo" />
            <view class="sc-cell__play" hover-class="k-press-s" @click="previewOwnVideo"><k-icon name="play" :size="14" color="white" fill /></view>
            <view class="sc-cell__del" role="button" aria-label="删除这段视频" hover-class="k-press-s" @click.stop="removeVideo"><k-icon name="x" :size="12" color="white" :stroke="2.4" /></view>
          </view>
          <view v-if="!video && pics.length < PIC_MAX" class="sc-cell sc-cell--add" role="button" aria-label="添加照片" hover-class="k-press-s" @click="addPics"><view class="sc-cell__in"><k-icon name="image-plus" :size="24" color="#8A5E36" :stroke="1.6" /><text class="sc-cell__text">{{ picUploading ? '上传中' : '添加照片' }}</text></view></view>
          <view v-if="!video && !pics.length" class="sc-cell sc-cell--add" role="button" aria-label="添加视频" hover-class="k-press-s" @click="addVideo"><view class="sc-cell__in"><k-icon name="video" :size="24" color="#8A5E36" :stroke="1.6" /><text class="sc-cell__text">{{ videoUploading ? '上传中' : '添加视频' }}</text></view></view>
        </view>
        <text class="sc-media__rule">视频 {{ VIDEO_MAX_SECONDS }} 秒、{{ VIDEO_MAX_MB }}MB 以内</text>
      </view>

      <view v-if="pics.length || video" class="sc-check" role="checkbox" :aria-checked="portrait" hover-class="k-press" @click="portrait = !portrait">
        <view class="sc-check__box" :class="{ on: portrait }"><k-icon v-if="portrait" name="check" :size="13" color="white" :stroke="2.8" /></view>
        <text class="sc-check__text">我确认图片和视频不侵犯他人肖像，拍到的人已经同意</text>
      </view>

      <view class="sc-who">
        <text class="sc-who__line">提交后这条评论会标记为「{{ me.identityText || '未核实' }}」，审核的人和读者都看得到。</text>
        <text v-if="me.identity === 'unverified'" class="sc-who__line">住过或做过换工，但系统没查到记录也能写，只是不带核实标记。</text>
        <text v-if="!me.consented" class="sc-who__line">第一次提交要先同意《社区公约》。</text>
        <text v-if="tooManyPending" class="sc-who__line sc-who__line--warn">你在这家小院已有 {{ me.pending }} 条评论在审核中，等审核完再写吧。</text>
      </view>

      <k-bottom flat pad="8px 16px 4px"><k-button block :disabled="submitting || tooManyPending" :label="submitting ? '提交中…' : '提交评论'" @click="submit" /></k-bottom>
    </view>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 写小院评论（2026-10-31，V65，主人：「他们写评论就行了，文字 + 图片或视频，审核后才展示」）。入口：生活碎片页「写评论」→ /pages/profile/stay-comment?stayId=
//   GET  /app/stay/{stayId}/comments/me  写之前的提示：手机号验没验、同意过公约没、现在算什么身份、有几条在审核
//   POST /app/stay/{stayId}/comments     文字必填；图 9 张或视频 1 段，二选一；一律待审
// 图片传 /app/upload/image，视频分段传（review-video.js，和评价同一份，60 秒 50MB）。
// 游客引导登录；没验证手机号的就地验证（内容不丢）；没同意公约的提交时由 gated 弹规则。
// ---------------------------------------------------------------------------
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useScreen, go, back, toast } from '@/common/screen.js'
import { get, post } from '@/common/request.js'
import { confirm, errText } from '@/common/ui.js'
import { absUrl, uploadTo } from '@/common/upload.js'
import { ensureSession, experience } from '@/common/experience.js'
import { gated, fail, verifyPhone } from '@/common/community.js'
import R from '@/common/routes.js'
import { VIDEO_MAX_SECONDS, VIDEO_MAX_MB, chooseAndUploadVideo, uploadVideoParts, previewVideo } from './review-video.js'
import { TEXT_MAX, PIC_MAX, commentProblem, commentPayload, pickImages } from './stay-comment-form.js'

let stayId = 0
useScreen(1, {
  onLoad: (q) => {
    stayId = Number(q.stayId) > 0 ? Number(q.stayId) : 0
    loadMe()
  }
})

const stage = ref('loading') // loading | error | guest | phone | form
const loadError = ref('')
const me = ref({})
const tooManyPending = computed(() => Number(me.value.pendingMax) > 0 && Number(me.value.pending) >= Number(me.value.pendingMax))

async function loadMe() {
  if (!stayId) {
    loadError.value = '没有找到这家小院'
    stage.value = 'error'
    return
  }
  stage.value = 'loading'
  await ensureSession()
  if (!experience.account) {
    stage.value = 'guest'
    return
  }
  try {
    me.value = (await get('/app/stay/' + stayId + '/comments/me')).data || {}
    stage.value = me.value.phoneVerified ? 'form' : 'phone'
  } catch (e) {
    if (e && e.code === 401) {
      stage.value = 'guest'
      return
    }
    loadError.value = errText(e, '加载失败，请重试')
    stage.value = 'error'
  }
}
// 登录页压在本页上面，登录完退回来时重新看一次；其他情况（选完照片回来也会触发 onShow）不动表单
onShow(() => {
  if (stage.value === 'guest' && experience.account) loadMe()
})
const goLogin = () => go(R.login)

async function onPhone(e) {
  try {
    await verifyPhone(e)
    toast('手机号已验证')
    await loadMe()
  } catch (err) {
    fail(err, '验证失败')
  }
}
const onPhoneClick = () => {
  // #ifdef H5
  onPhone(null)
  // #endif
}

// ---------------- 文字 ----------------
const text = ref('')
const editing = ref(false)
const onAreaBlur = (e) => {
  text.value = String((e && e.detail && e.detail.value) ?? text.value).slice(0, TEXT_MAX)
  editing.value = false
}

// ---------------- 图片、视频（二选一） ----------------
const pics = ref([])
const video = ref(null)
const portrait = ref(false)
const picUploading = ref(false)
const videoUploading = ref(false)
async function addPics() {
  if (picUploading.value || videoUploading.value) return
  const left = PIC_MAX - pics.value.length
  if (left <= 0) return toast(`最多 ${PIC_MAX} 张照片`)
  let paths = []
  try {
    paths = await pickImages(left)
  } catch (e) {
    return toast(errText(e, '没能打开相册，请重试'))
  }
  if (!paths.length) return
  picUploading.value = true
  // 带遮罩：上传中再点「添加照片」会叠着再选一批
  uni.showLoading({ title: '上传中', mask: true })
  let err = null
  try {
    for (const p of paths.slice(0, left)) {
      const up = await uploadTo('/app/upload/image', p)
      pics.value.push({ url: up.data.url, img: absUrl(up.data.url) })
    }
  } catch (e) {
    err = e
  } finally {
    uni.hideLoading()
    picUploading.value = false
  }
  // 微信里 hideLoading 会连提示一起关掉，所以先关加载框再提示
  if (err) toast(errText(err, '照片上传失败'))
}
const removePic = (i) => pics.value.splice(i, 1)
const previewPic = (i) => uni.previewImage({ urls: pics.value.map(x => x.img), current: pics.value[i] && pics.value[i].img })
async function addVideo() {
  if (picUploading.value || videoUploading.value) return
  videoUploading.value = true
  let err = null
  try {
    const v = await chooseAndUploadVideo((pct) => uni.showLoading({ title: '视频上传中 ' + pct + '%', mask: true }), {
      // 选好、检查过才开始转圈（选择框里取消不出加载框）
      upload: (f, cb) => { uni.showLoading({ title: '视频上传中', mask: true }); return uploadVideoParts(f, cb) }
    })
    if (v && v.url) video.value = { url: v.url, cover: v.cover || '' }
  } catch (e) {
    err = e
  } finally {
    uni.hideLoading()
    videoUploading.value = false
  }
  if (err) toast(errText(err, '视频上传失败'))
}
const removeVideo = () => { video.value = null }
const previewOwnVideo = () => { if (video.value) previewVideo(absUrl(video.value.url), absUrl(video.value.cover)) }

// ---------------- 提交 ----------------
// 成功后要等 0.9 秒才退回去，这段时间一直锁着，免得再点一次又交一条
const submitting = ref(false)
async function submit() {
  if (submitting.value) return
  editing.value = false
  const form = { text: text.value, pics: pics.value, video: video.value, portrait: portrait.value, uploading: picUploading.value || videoUploading.value }
  const why = commentProblem(form)
  if (why) return toast(why)
  submitting.value = true
  try {
    const res = await gated(() => post('/app/stay/' + stayId + '/comments', commentPayload(form)), { onPhone: () => { stage.value = 'phone' } })
    toast(res.msg || '已提交，审核通过后展示')
    setTimeout(back, 900)
  } catch (e) {
    submitting.value = false
    fail(e, '提交失败')
  }
}

async function onBack() {
  const dirty = !submitting.value && stage.value === 'form' && (text.value.trim() || pics.value.length || video.value)
  if (dirty && !(await confirm('还没提交', '退出后这条评论不会保存，确定退出吗？'))) return
  back()
}
</script>

<style scoped lang="scss">
@import '../../styles/look.scss';
.sc { background: #FCF9F3; }
.sc-gate { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 56px 28px 0; }
.sc-gate__img { width: 150px; height: 100px; }
.sc-gate__title { margin-top: 12px; font-size: 17px; font-weight: 700; color: var(--k-ink); }
.sc-gate__sub { margin-top: 8px; font-size: 14px; line-height: 1.65; color: var(--k-muted); }
.sc-gate__btn { margin-top: 20px; }

/* 底部固定着「提交评论」：留够空，最后的说明不被按钮挡住 */
.sc-form { padding: 10px 14px calc(92px + var(--k-safe-bottom)); }
.sc-tip { padding: 10px 12px; border-radius: 10px; background: #F6EEE4; }
.sc-tip__line { display: block; font-size: 13px; line-height: 1.6; color: #714429; }
.sc-box { position: relative; margin-top: 12px; padding: 10px 12px 26px; border-radius: 12px; background: var(--k-paper); border: 1px solid #E9DFD3; }
.sc-area { display: block; width: 100%; height: 150px; font-size: 15px; line-height: 1.6; color: var(--k-ink); }
.sc-area--idle { white-space: pre-wrap; word-break: break-all; overflow: hidden; height: auto; min-height: 150px; }
.sc-count { position: absolute; right: 12px; bottom: 6px; font-size: 12px; color: var(--k-muted); }

.sc-media { margin-top: 14px; }
.sc-media__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.sc-media__title { flex-shrink: 0; font-size: 15px; font-weight: 700; color: var(--k-ink); }
.sc-media__hint { font-size: 12px; color: var(--k-muted); text-align: right; }
.sc-media__rule { display: block; margin-top: 8px; font-size: 12px; color: var(--k-muted); }
.sc-grid { margin-top: 8px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.sc-cell { position: relative; height: 0; padding-bottom: 100%; border-radius: 10px; overflow: hidden; background: var(--k-paper2); }
.sc-cell--add { border: 1px dashed #CDBBA7; background: #F6EEE4; box-sizing: border-box; }
.sc-cell__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.sc-cell__img--video { background: #3A322B; }
.sc-cell__in { position: absolute; left: 0; top: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.sc-cell__text { font-size: 12px; color: #80522E; }
.sc-cell__del { position: absolute; right: 2px; top: 2px; width: 24px; height: 24px; border-radius: 50%; background: rgba(58, 50, 43, .62); display: flex; align-items: center; justify-content: center; }
.sc-cell__play { position: absolute; left: 50%; top: 50%; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; background: rgba(36, 27, 23, .5); display: flex; align-items: center; justify-content: center; }

.sc-check { display: flex; align-items: flex-start; gap: 8px; margin-top: 14px; padding: 4px 0; }
.sc-check__box { flex-shrink: 0; width: 20px; height: 20px; margin-top: 1px; border-radius: 5px; border: 1.5px solid #B7A28C; background: var(--k-paper); box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.sc-check__box.on { border-color: #8A5A30; background: #8A5A30; }
.sc-check__text { font-size: 14px; line-height: 1.5; color: var(--k-ink); }

.sc-who { margin-top: 12px; display: flex; flex-direction: column; gap: 4px; }
.sc-who__line { font-size: 13px; line-height: 1.6; color: var(--k-muted); }
.sc-who__line--warn { color: #A33A2C; font-weight: 600; }
</style>
