<template>
  <view class="k-page sc" :class="$userSurface">
    <k-topbar title="写评论" back custom-back @back="onBack" />

    <view v-if="stage === 'loading'" class="sc-gate"><text class="sc-gate__sub">加载中…</text></view>

    <view v-else-if="stage === 'error'" class="sc-gate sc-gate--error">
      <view class="sc-gate__ic"><k-icon name="house" :size="32" color="red" /></view>
      <text class="sc-gate__title">{{ loadError }}</text>
      <text class="sc-gate__sub">小院可能已下线，或链接不完整</text>
      <view class="sc-gate__btn"><k-button size="md" label="重新加载" @click="loadMe" /></view>
    </view>

    <view v-else-if="stage === 'guest'" class="sc-gate sc-gate--card">
      <view class="sc-gate__ic"><k-icon name="log-in" :size="32" color="red" /></view>
      <text class="sc-gate__title">登录后才能写评论</text>
      <text class="sc-gate__sub">登录并验证手机号就能写，登录后会回到这里。</text>
      <view class="sc-gate__btn"><k-button size="md" label="去登录" @click="goLogin" /></view>
    </view>

    <view v-else-if="stage === 'phone'" class="sc-gate sc-gate--card">
      <view class="sc-gate__ic"><k-icon name="smartphone" :size="32" color="red" /></view>
      <text class="sc-gate__title">先验证手机号</text>
      <text class="sc-gate__sub">验证后就能写评论。号码不会显示给其他人，已经写的内容不会丢。</text>
      <view class="sc-gate__btn"><k-button size="md" open-type="getPhoneNumber" label="授权并验证" @getphonenumber="onPhone" @click="onPhoneClick" /></view>
    </view>

    <view v-else class="sc-form">
      <view class="sc-tip">
        <view class="sc-tip__ic"><k-icon name="info" :size="14" color="muted" /></view>
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
        <view class="sc-grid" :class="{ 'is-compact': !video && !pics.length }">
          <view v-for="(pic, picIdx) in pics" :key="pic.url" class="sc-cell">
            <image class="sc-cell__img" :src="pic.img" mode="aspectFill" @click="previewPic(picIdx)" />
            <view class="sc-cell__del" role="button" aria-label="删除这张照片" hover-class="k-press-s" @click.stop="removePic(picIdx)"><k-icon name="x" :size="12" color="white" /></view>
          </view>
          <view v-if="video" class="sc-cell">
            <image v-if="video.cover" class="sc-cell__img" :src="absUrl(video.cover)" mode="aspectFill" @click="previewOwnVideo" />
            <view v-else class="sc-cell__img sc-cell__img--video" hover-class="k-press-s" @click="previewOwnVideo" />
            <view class="sc-cell__play" hover-class="k-press-s" @click="previewOwnVideo"><k-icon name="play" :size="14" color="white" fill /></view>
            <view class="sc-cell__del" role="button" aria-label="删除这段视频" hover-class="k-press-s" @click.stop="removeVideo"><k-icon name="x" :size="12" color="white" /></view>
          </view>
          <view v-if="!video && pics.length < PIC_MAX" class="sc-cell sc-cell--add" role="button" aria-label="添加照片" hover-class="k-press-s" @click="addPics"><view class="sc-cell__in"><k-icon name="image-plus" :size="22" color="red" /><text class="sc-cell__text">{{ picUploading ? '上传中' : '添加照片' }}</text></view></view>
          <view v-if="!video && !pics.length" class="sc-cell sc-cell--add" role="button" aria-label="添加视频" hover-class="k-press-s" @click="addVideo"><view class="sc-cell__in"><k-icon name="video" :size="22" color="red" /><text class="sc-cell__text">{{ videoUploading ? '上传中' : '添加视频' }}</text></view></view>
        </view>
        <text class="sc-media__rule">视频 {{ VIDEO_MAX_SECONDS }} 秒、{{ VIDEO_MAX_MB }}MB 以内</text>
      </view>

      <view v-if="pics.length || video" class="sc-check" role="checkbox" :aria-checked="portrait" hover-class="k-press" @click="portrait = !portrait">
        <view class="sc-check__box" :class="{ on: portrait }"><k-icon v-if="portrait" name="check" :size="14" color="white" /></view>
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
.sc { background: var(--k-bg); }
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
.sc-cell__img--video { background: var(--k-ink); }
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

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底，输入区和图片区各一张白卡（12 圆角、不描边），说明文字收小一档。
   功能和文字不变：登录 / 验证手机号提示、输入、加图片或视频、肖像确认、提交评论都在；输入的字仍是 15 */
.sc { --k-bg: var(--k-page); --k-radius: 12px; background: var(--k-page); }
.sc :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
.sc :deep(.k-button.is-lg) { height: 44px; font-size: 15px; box-shadow: none; }
.sc :deep(.k-button) { border-radius: 999px; }
/* 不能点的按钮（提交中）：11-18 第二轮起交给公共组件 —— 原配色整体 .45，不再盖成冷灰块 */
.sc-gate { padding-top: 48px; }
.sc-gate__img { border-radius: 12px; }
.sc-gate__title { font-size: 16px; }
.sc-gate__sub { font-size: 13px; }
.sc-form { padding: 8px 12px calc(92px + var(--k-safe-bottom)); }
.sc-tip { border-radius: 8px; background: #FFF8EE; }
.sc-tip__line { font-size: 12px; color: #7A5A22; }
.sc-box { margin-top: 8px; padding: 12px 12px 26px; border: 0; }
.sc-count { font-size: 11px; }
.sc-media { margin-top: 8px; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.sc-media__title { font-size: 14px; font-weight: 600; }
.sc-media__hint, .sc-media__rule { font-size: 11px; }
.sc-cell { border-radius: 8px; background: var(--k-page); }
.sc-cell--add { border-color: var(--k-red-line); background: var(--k-paper); }
.sc-cell__text { font-size: 11px; color: var(--k-red-deep); }
.sc-check { min-height: 36px; margin-top: 10px; padding: 8px 2px; box-sizing: border-box; }
.sc-check__box { border-radius: 4px; }
.sc-check__box.on { border-color: var(--k-red); background: var(--k-red); }
.sc-check__text { font-size: 13px; }
.sc-who { margin-top: 8px; padding: 0 2px; }
.sc-who__line { font-size: 12px; }
.sc-who__line--warn { color: var(--k-alert); }
/* 11-18 第二轮：读取出错时整块放进白卡（居中，出错原因 14 / 500 二级墨），「重新加载」是 32 高的次按钮小胶囊（白底细棕边深棕字），不再是实心主按钮 */
.sc-gate--error { margin: 8px 12px 0; padding: 28px 12px; border-radius: 12px; background: var(--k-paper); }
.sc-gate--error .sc-gate__title { margin-top: 0; font-size: 14px; font-weight: 500; line-height: 1.6; color: var(--k-ink2); }
.sc-gate--error .sc-gate__btn { margin-top: 8px; }
/*    11-18 返修：按钮原来 40 高，看着 32，上下各 6 的透明边，点按高度 44（和权益、邀请等页的「重新加载」同一写法） */
.sc-gate--error :deep(.k-button) { height: 44px; padding: 0 16px; border: 6px solid transparent; border-radius: 22px; background: var(--k-paper) padding-box; box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-size: 13px; font-weight: 500; }
/* ===================================================================================================
   11-18 第三轮「逐页精修」（只动样子；功能、文字、点按区不变）：页边距 16、卡内 16、卡间 12；
   提示条左边一枚 16 号线性 info 图标；出错卡加 56 浅棕方块 + 小院图标；加图格子用暖棕线性图标。
   =================================================================================================== */
.sc-form { padding: 12px 16px calc(92px + var(--k-safe-bottom)); }
.sc-tip { position: relative; padding: 12px 12px 12px 34px; border-radius: 12px; background: var(--k-red-soft); }
.sc-tip__ic { position: absolute; left: 12px; top: 13px; width: 16px; height: 16px; }
.sc-tip__line { font-size: 12px; line-height: 20px; color: var(--k-red-deep); }
.sc-box { margin-top: 12px; padding: 16px 16px 28px; border-radius: 12px; }
.sc-area { font-size: 15px; line-height: 1.65; }
.sc-count { right: 16px; bottom: 8px; font-variant-numeric: tabular-nums; }
.sc-media { margin-top: 12px; padding: 16px; }
.sc-media__title { font-size: 14px; line-height: 20px; }
.sc-grid { margin-top: 10px; }
.sc-cell--add { border: 1px dashed var(--k-red-line); background: var(--k-paper); }
.sc-cell__text { margin-top: 2px; }
.sc-media__rule { margin-top: 10px; }
.sc-check { margin-top: 12px; padding: 8px 0; }
.sc-check__box { width: 18px; height: 18px; border-color: var(--k-line2); }
.sc-who { margin-top: 8px; padding: 0; }
.sc-who__line { font-size: 12px; line-height: 1.6; }
.sc-gate { padding-top: 56px; }
.sc-gate__title { line-height: 24px; }
.sc-gate__sub { margin-top: 6px; line-height: 1.6; }
.sc-gate--error { margin: 12px 16px 0; padding: 32px 16px 28px; }
.sc-gate__ic { width: 56px; height: 56px; border-radius: 16px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.sc-gate--error .sc-gate__title { margin-top: 12px; }
.sc-gate--error .sc-gate__btn { margin-top: 10px; }
/* 窄屏：说明文字放不下一行时整段换到标题下面、靠左，不再剩一个「频」字挂在右边 */
.sc-media__head { flex-wrap: wrap; row-gap: 2px; }
.sc-media__hint { white-space: nowrap; }
@media (max-width: 374px) { .sc-media__hint { flex-basis: 100%; text-align: left; } }
/* ===================================================================================================
   11-18 第三轮返修（独立评审第 1 轮；只动样子）
   =================================================================================================== */
/* 游客 / 没验证手机号的挡板：和出错卡一个样子 —— 白卡、56 浅棕方块 + 32 号线性图标、14 / 500 标题、12 号说明、36 高按钮（不再用带米色方底的邮戳图） */
.sc-gate--card { margin: 12px 16px 0; padding: 32px 16px 28px; border-radius: 12px; background: var(--k-paper); }
.sc-gate--card .sc-gate__title { margin-top: 12px; font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.sc-gate--card .sc-gate__sub { margin-top: 4px; font-size: 12px; line-height: 1.6; color: var(--k-muted); text-align: center; }
.sc-gate--card .sc-gate__btn { margin-top: 16px; }
.sc-gate--card :deep(.k-button) { height: 36px; padding: 0 20px; border-radius: 18px; font-size: 14px; font-weight: 600; }
@media (max-width: 359px) {
  .sc-tip { padding: 10px 10px 10px 30px; }
  .sc-tip__ic { left: 10px; top: 12px; }
  .sc-tip__line { font-size: 11px; line-height: 18px; }
}
/* ===================================================================================================
   11-18 第三轮返修 2（独立评审第 2 轮；只动样子）
   =================================================================================================== */
/* 加图 / 加视频格子：虚线框 1px 算进高度后不再是 75.5 × 77.5，宽高相等 */
.sc-cell--add { padding-bottom: calc(100% - 2px); }
/* 卡外说明：11 号脚注（和简历页尾的隐私说明同一档），390 宽一行收住，不再剩「到。」两个字 */
.sc-who__line { font-size: 11px; line-height: 18px; }
/* 出错卡：和游客挡板一套 —— 标题下面加一行 12 号灰色说明，按钮 36 高 */
.sc-gate--error .sc-gate__title { font-size: 14px; font-weight: 500; line-height: 20px; color: var(--k-ink2); }
.sc-gate--error .sc-gate__sub { margin-top: 4px; font-size: 12px; line-height: 1.6; color: var(--k-muted); text-align: center; }
.sc-gate--error .sc-gate__btn { margin-top: 16px; }
.sc-gate--error :deep(.k-button) { height: 36px; padding: 0 20px; border-radius: 18px; font-size: 14px; font-weight: 600; }
/* 11-18 第三轮返修 3：出错卡「重新加载」和游客卡「去登录」同一尺寸（36 高、最少 112 宽）：去登录实心，重新加载描边 */
.sc .sc-gate :deep(.k-button) { min-width: 112px; height: 36px; padding: 0 20px; border: 0; border-radius: 18px; box-sizing: border-box; font-size: 14px; font-weight: 600; }
.sc .sc-gate--error :deep(.k-button) { background: var(--k-paper); box-shadow: inset 0 0 0 1px var(--k-red-line); color: var(--k-red-deep); font-weight: 500; }
/* ===================================================================================================
   11-18 第三轮返修 4（独立评审第 4 轮；只动样子）
   =================================================================================================== */
/* 出错卡 / 游客 / 验证手机号挡板：和评价页「推荐暂不可用」「权限与错误恢复」同一套 —— 不要白卡，整块放在距顶约 30% 处；
   56 浅棕方块 + 32 图标、17 / 700 标题、13 号灰色说明、主按钮 248 × 44 */
.sc .sc-gate--error, .sc .sc-gate--card { margin: 0; padding: 22vh 32px 0; border-radius: 0; background: transparent; }
.sc .sc-gate--error .sc-gate__title, .sc .sc-gate--card .sc-gate__title { margin-top: 16px; font-size: 17px; font-weight: 700; line-height: 24px; color: var(--k-ink); }
.sc .sc-gate--error .sc-gate__sub, .sc .sc-gate--card .sc-gate__sub { margin-top: 6px; font-size: 13px; line-height: 1.7; color: var(--k-muted); }
.sc .sc-gate--error .sc-gate__btn, .sc .sc-gate--card .sc-gate__btn { margin-top: 24px; }
.sc .sc-gate :deep(.k-button), .sc .sc-gate--error :deep(.k-button) { width: 248px; height: 44px; border-radius: 22px; background: var(--k-grad-brown); box-shadow: none; color: var(--k-paper); font-size: 15px; font-weight: 600; }
/* ===================================================================================================
   11-18 第三轮返修 5（独立评审第 5 轮；只动样子）
   =================================================================================================== */
/* 还没加图片 / 视频时：两个添加格各占半宽、72 高（和评价页同一个控件一个样子），右边不再空一大片 */
.sc-grid.is-compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sc-grid.is-compact .sc-cell, .sc-grid.is-compact .sc-cell--add { height: 72px; padding-bottom: 0; }
/* ===================================================================================================
   11-18 第四轮精修（只动样子）：出错页保持；表单态正文输入当主角（16 号字、行高 1.7、最小 200 高），提示退成无底 12 灰小注（和简历技能页一套）
   =================================================================================================== */
.k-page.sc .sc-tip { padding:0 4px 0 22px;border-radius:0;background:transparent; }
.k-page.sc .sc-tip__ic { left:4px;top:2px;width:14px;height:14px; }
.k-page.sc .sc-tip__line { font-size:12px;line-height:18px;color:var(--k-muted); }
.k-page.sc .sc-area { height:200px;font-size:16px;line-height:1.7; }
.k-page.sc .sc-area--idle { height:auto;min-height:200px; }
.k-page.sc .sc-gate__sub, .k-page.sc .sc-tip__line { word-break:keep-all;overflow-wrap:break-word;overflow-wrap:anywhere; }
/* 11-19 第四轮返修：窄屏顶部提示 —— 第二句最宽 21 个字，在「，」处断成两行（「不打星，不计入小院评分，和」/「「住过的家人评价」分开。」），不再剩「分开。」；320 宽字号 11，第一句一行放下 */
@media (max-width:374px) {
  .k-page.sc .sc-tip__line + .sc-tip__line { max-width:21em; }
}
@media (max-width:359px) {
  .k-page.sc .sc-tip__line { font-size:11px; }
}
</style>
