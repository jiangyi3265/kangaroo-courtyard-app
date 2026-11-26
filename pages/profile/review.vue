<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <view class="k-page review" :class="$userSurface">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack">
      <view v-if="s === 4" class="k-tabs">
        <view v-for="t in errTabs" :key="t.key" class="k-tabs__item err-tab" :class="{ active: errTab === t.key }" @click="errTab = t.key"><text>{{ t.label }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 AI 引导式评价 -->
    <view v-if="s === 1" class="ai k-pad-bottom">
      <view class="ai__hello">
        <image class="ai__avatar" src="/static/media/review-kangaroo.jpg" mode="aspectFill" />
        <view class="bubble">
          <view class="bubble__tail" />
          <text class="bubble__hi">HI，我是小院评价助手</text>
          <text class="bubble__copy">{{ bubbleCopy }}</text>
        </view>
      </view>
      <!-- 11-18 第三轮返修 2：评价进度挪到助手气泡下面，做成一条 4 高进度条 + 右边「评价进度 N/5」 -->
      <view class="ai__prog"><view class="ai__bar"><view class="ai__bar-fill" :style="{ width: (questions.length ? progress / questions.length * 100 : 0) + '%' }" /></view><text class="ai__progress">评价进度 {{ progress }}/{{ questions.length }}</text></view>
      <!-- 11-18 第四轮：四道题合成一张问卷卡（发丝线分题） -->
      <view class="q-list">
      <view v-for="(q, i) in questions" :key="q.title" class="q">
        <view class="q__head"><view class="q__num"><text>{{ i + 1 }}</text></view><text class="q__title">{{ q.title }}</text></view>
        <view class="q__stars">
          <view v-for="n in 5" :key="n" class="q__star" hover-class="k-press" @click="setStar(q, n)"><k-icon name="star" :size="28" color="ochre" :fill="n <= q.stars" /></view>
          <text class="q__level" :class="{ on: q.stars > 0 }">{{ q.label }}</text>
        </view>
        <view class="q__box">
          <!-- 原生 textarea 画在页面最上层，滑到底部「提交评价」下面会抢走点击；不在输入时只显示同样的文字，点一下才换成真输入框 -->
          <textarea v-if="editingIdx === i" v-model="q.text" class="q__area" auto-height :maxlength="200" placeholder="说说你的真实感受" placeholder-class="k-placeholder" :focus="true" auto-focus @blur="q.text = $event.detail.value; onAreaBlur(i)" />
          <view v-else class="q__area review-area-idle" hover-class="k-press" @click="editingIdx = i"><text :class="{ 'k-placeholder': !q.text }">{{ q.text || '说说你的真实感受' }}</text></view>
          <text class="q__counter">{{ q.text.length }}/200</text>
        </view>
      </view>
      </view>
      <!-- 2026-10-17 改版 R2：住宿评价可以晒照片（选填，最多 9 张），显示在小院「住过的家人评价」里；岗位和住宿评价均可使用 -->
      <!-- 11-18 第三轮返修：照片和视频合成一张卡；还没加照片时两个格子并排，加了照片再上下排 -->
      <view v-if="canPhoto" class="media-card" :class="{ 'is-compact': !reviewPics.length }">
      <view v-if="canPhoto" class="pics">
        <view class="pics__head"><text class="pics__title">晒晒小院照片</text><text class="pics__hint">选填 · {{ reviewPics.length }}/{{ PIC_MAX }}</text></view>
        <view class="pics__grid">
          <view v-for="(pic, picIdx) in reviewPics" :key="pic.url" class="pics__cell">
            <image class="pics__img" :src="pic.img" mode="aspectFill" @click="previewPic(picIdx)" />
            <view class="pics__del" @click.stop="removePic(picIdx)"><k-icon name="x" :size="12" color="white" /></view>
          </view>
          <view v-if="reviewPics.length < PIC_MAX" class="pics__cell pics__add" hover-class="k-press-s" @click="addPics"><view class="pics__add-in"><k-icon name="image-plus" :size="22" color="red" /><text class="pics__add-text">添加照片</text></view></view>
        </view>
      </view>
      <!-- 2026-10-17 改版 R3：住宿评价还可以附 1 段视频（选填，60 秒、200MB 以内），在小院「住过的家人评价」里满宽播放；岗位和住宿评价均可使用 -->
      <view v-if="canPhoto" class="pics vids">
        <view class="pics__head"><text class="pics__title">拍段小院视频</text><text class="pics__hint">选填 · {{ VIDEO_MAX_SECONDS }} 秒以内</text></view>
        <view class="pics__grid">
          <view v-if="reviewVideo" class="pics__cell">
            <image v-if="reviewVideo.cover" class="pics__img" :src="absUrl(reviewVideo.cover)" mode="aspectFill" @click="previewOwnVideo" />
            <view v-else class="pics__img vids__ph" @click="previewOwnVideo" />
            <view class="vids__play" @click="previewOwnVideo"><k-icon name="play" :size="14" color="white" fill /></view>
            <view class="pics__del" @click.stop="removeVideo"><k-icon name="x" :size="12" color="white" /></view>
          </view>
          <view v-else class="pics__cell pics__add" hover-class="k-press-s" @click="addVideo"><view class="pics__add-in"><k-icon name="video" :size="22" color="red" /><text class="pics__add-text">{{ videoUploading ? '上传中' : '添加视频' }}</text></view></view>
        </view>
      </view>
      </view>
      <view class="polish">
        <view class="k-row k-gap4"><k-icon name="file-text" :size="16" color="muted" /><text class="polish__title">评价预览</text><text class="polish__sub">（原文合并，不做改写）</text></view>
        <view class="polish__chip"><text>{{ previewChip }}</text></view>
      </view>
      <view class="polish__box"><text class="polish__text">{{ preview }}</text></view>
      <text class="ai__note">以上评价将匿名展示，感谢你的真实分享！</text>
      <k-bottom flat pad="8px 16px 4px"><k-button block :disabled="submitting" :label="submitting ? '提交中…' : '提交评价'" @click="submitReview" /></k-bottom>
    </view>

    <!-- 2 到店路线 -->
    <view v-else-if="s === 2" class="k-body k-pad-bottom route">
      <view class="shop">
        <image class="shop__img" :src="shopThumb" mode="aspectFill" />
        <view class="k-flex1">
          <text class="shop__title">{{ shopTitle }}</text>
          <view v-if="shopPrice" class="k-row k-gap4 k-mt4"><text class="k-price">{{ shopPrice }}</text><text class="k-meta">{{ shopUnit }}</text></view>
          <text class="shop__addr">{{ shopAddr }}</text>
          <text class="shop__addr">{{ shopSub }}</text>
        </view>
        <view class="shop__call" hover-class="k-press" @click="call">
          <view class="k-circle k-circle--outline shop__phone"><k-icon name="phone" :size="18" color="red" /></view>
          <text class="k-meta">联系商家</text>
        </view>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <!-- 店名气泡最像按钮，也要能点开导航；关掉地图自带地名，免得点到别家名字没反应 -->
      <map v-if="hasCoord" class="map" :latitude="mapLat" :longitude="mapLng" :scale="15" :markers="markers" :enable-scroll="false" :enable-zoom="false" :enable-poi="false" @tap="openMap" @markertap="openMap" @callouttap="openMap" />
      <!-- #endif -->
      <view class="modes">
        <view v-for="m in modes" :key="m" class="mode" :class="{ active: mode === m }" hover-class="k-press" @click="mode = m"><text>{{ m }}</text></view>
      </view>
      <view v-for="p in plans" :key="p.name" class="plan" :class="{ 'plan--on': mode === p.mode || mode === '推荐路线' }">
        <view class="plan__head">
          <text class="plan__name">{{ p.name }}<text v-if="p.rec" class="k-green"> (推荐)</text></text>
          <text class="plan__stat">{{ p.time }}</text>
          <text class="plan__stat">{{ p.dist }}</text>
          <text class="plan__stat plan__stat--last">{{ p.cost }}</text>
        </view>
        <view v-if="p.steps" class="plan__steps">
          <view v-for="(st, i) in p.steps" :key="st.text" class="step">
            <view class="step__track">
              <view v-if="st.dot" class="step__dot" :class="'step__dot--' + st.dot" />
              <k-icon v-else :name="st.icon" :size="14" color="muted" />
              <view v-if="i < p.steps.length - 1" class="step__line" />
            </view>
            <text class="step__text">{{ st.text }}</text>
          </view>
        </view>
        <text v-else-if="p.sub" class="plan__sub">{{ p.sub }}</text>
      </view>
      <text class="sec-title">{{ photoTitle }}</text>
      <view v-if="photos.length" class="photos">
        <image v-for="(ph, n) in photos" :key="ph" class="photos__img" :src="ph" mode="aspectFill" @click="previewPhoto(n)" />
      </view>
      <k-bottom flat>
        <k-button type="outline" size="md" @click="call">联系商家</k-button>
        <k-button type="outline" size="md" @click="shareRoute">分享路线</k-button>
        <view class="k-flex1"><k-button block size="md" icon="download" label="离线保存" @click="saveOffline" /></view>
      </k-bottom>
    </view>

    <!-- 3 AI 暂不可用 -->
    <view v-else-if="s === 3" class="k-body k-pad-tab search">
      <view class="k-row k-gap8">
        <view class="search__box"><k-icon name="search" :size="16" color="muted" /><input v-model="keyword" :confirm-type="'search'" placeholder="搜索城市 / 区域 / 房源 / 店铺" placeholder-class="k-placeholder" @confirm="searchStays" /></view>
        <view class="search__filter" hover-class="k-press" @click="go(R.jobsFilter)">
          <k-icon name="sliders-horizontal" :size="16" color="ink" /><text>筛选</text>
          <view v-if="false" class="search__badge"><text>2</text></view>
        </view>
      </view>
      <view class="filters">
        <view v-for="f in ['位置', '类型', '价格', '更多']" :key="f" class="filter" hover-class="k-press" @click="searchStays"><text>{{ f }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view>
      </view>
      <view class="unavail">
        <view class="unavail__ic"><k-icon name="cloud-off" :size="32" color="red" /></view>
        <text class="unavail__title">推荐服务暂时不可用</text>
        <text class="unavail__desc">推荐服务当前暂时不可用，\n你仍可以使用普通搜索与筛选功能。</text>
        <view class="unavail__btns">
          <k-button block @click="retry">稍后重试</k-button>
          <k-button block type="secondary" @click="go(R.staysList)">使用普通筛选</k-button>
          <k-button block type="secondary" @click="aiOpen = true">联系客服</k-button>
        </view>
      </view>
    </view>

    <!-- 4 权限与错误恢复 -->
    <view v-else class="k-body k-pad-tab perm">
      <view class="perm__body">
        <view v-if="errTab === 'location'" class="perm__icon is-location"><k-icon name="map-pin-x" :size="32" color="red" /></view>
        <view v-else class="perm__icon" :class="'is-' + current.tone"><k-icon :name="current.icon" :size="32" :color="current.tone === 'alert' ? 'alert' : 'red'" /></view>
        <text class="perm__title">{{ current.title }}</text>
        <text class="perm__desc">{{ current.desc }}</text>
        <view class="perm__steps">
          <view v-for="(st, i) in current.steps" :key="st" class="perm__step">
            <view class="perm__num"><text>{{ i + 1 }}</text></view>
            <text class="perm__step-text">{{ st }}</text>
          </view>
        </view>
        <k-button block @click="onPrimary">{{ current.primary }}</k-button>
        <k-button block type="outline" class="k-mt10" @click="onSecondary">{{ current.secondary }}</k-button>
        <view class="perm__help" @click="aiOpen = true">
          <text class="k-small k-muted">仍无法解决？</text>
          <k-icon name="headset" :size="14" color="red" />
          <text class="k-small perm__help-link">联系客服</text>
        </view>
      </view>
    </view>

    <k-tabbar v-if="s === 3 || s === 4" :active="s === 3 ? 'home' : ''" />
    <!-- 「联系客服」：AI袋鼠在本页底部弹出，不跳页 -->
    <k-ai-sheet :show="aiOpen" ctx="profile" @close="aiOpen = false" />
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 评价 / 到店 / 降级与权限页接入情况：
//   s=1 引导式评价：5 个分项打星（默认 0 星）+ 每项可写感受，原文合并为评价正文提交（apiWriteReview）；不是 AI，不做改写
//       入口带 ?bizType&bizId（订单 / 评价管理）；没带时从「待评价」里选
//   s=2 到店路线：apiRoute 取房源 / 门店的地址、坐标、照片、电话；导航交给微信内置地图，时间按直线距离估算，不编造公交线路
//       「离线保存」把这份路线存在本机，接口失败时回退显示
//   s=3 推荐不可用：重试推荐接口；普通搜索跳房源列表
//   s=4 权限与错误恢复：?tab=location|camera|pay|network，按钮调用真实的授权 / 设置 / 网络检查
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { useScreen, go, replace, back, toast } from '@/common/screen.js'
import { apiReviewsTodo, apiWriteReview, apiRoute, apiHomeFeed } from '@/common/api.js'
import { ensureSession, experience } from '@/common/experience.js'
import { pickPaged, alert, confirm, copy, errText } from '@/common/ui.js'
import { absUrl, uploadTo, chooseImages } from '@/common/upload.js'
// 评价视频的选择和分段上传（R3）：放在 profile 分包里的一份，不进主包
import { VIDEO_MAX_SECONDS, chooseAndUploadVideo, uploadVideoParts, previewVideo } from './review-video.js'
import R from '@/common/routes.js'
const aiOpen = ref(false)

let ready = false
let query = {}
const s = useScreen(4, {
  onLoad: async (q) => {
    query = q || {}
    if (query.tab && errTabs.some(t => t.key === query.tab)) errTab.value = query.tab
    await ensureSession()
    ready = true
    loadScreen(s.value)
  }
})
const titles = ['引导式评价', '到店路线', '房源搜索', '权限与错误恢复']
const onBack = () => back()
function loadScreen(v) {
  if (v === 1 && !target.value) loadTarget()
  if (v === 2 && !rt.value) loadRoute()
}
watch(s, (v) => { if (ready) loadScreen(v) })

// ---------------- s=1 引导式评价 ----------------
const QUESTIONS = {
  application: [['位置与交通便利吗?', '位置'], ['团队和相处氛围如何?', '氛围'], ['工作内容与安排如何?', '工作'], ['餐食与住宿体验如何?', '吃住']],
  stay_order: [['房间卫生如何?', '卫生'], ['设施与描述相符吗?', '设施相符'], ['主人 / 管家服务如何?', '服务'], ['安静与睡眠如何?', '安静舒适'], ['位置与周边便利性如何?', '位置周边']],
  activity_signup: [['活动内容如何?', '活动内容'], ['组织与时间安排如何?', '组织安排'], ['主办方服务如何?', '主办方'], ['安全与秩序如何?', '安全秩序'], ['集合地点好找吗?', '集合地点']]
}
const starLabels = { 0: '未评分', 1: '很差', 2: '较差', 3: '一般', 4: '较好', 5: '很好' }
const target = ref(null)
const questions = ref([])
// 2026-10-17 改版 R2：住宿评价可以附照片——先逐张传 /app/upload/image（和社区发帖同一个上传接口），提交时把平台路径放进 images；
// 后端只收平台上传的路径、最多 9 张。岗位和住宿评价均可附图、视频，活动保持原流程，提交的内容和以前一样
const PIC_MAX = 9
const reviewPics = ref([])
const picUploading = ref(false)
const canPhoto = computed(() => !!target.value && ['application', 'stay_order'].includes(target.value.bizType))
async function addPics() {
  if (picUploading.value) return
  const left = PIC_MAX - reviewPics.value.length
  if (left <= 0) return toast(`最多 ${PIC_MAX} 张照片`)
  const paths = await chooseImages(left)
  if (!paths.length) return
  picUploading.value = true
  // 带遮罩：上传中再点「添加照片」会叠着再选一批
  uni.showLoading({ title: '上传中', mask: true })
  let err = null
  try {
    for (const p of paths.slice(0, left)) {
      const up = await uploadTo('/app/upload/image', p)
      reviewPics.value.push({ url: up.data.url, img: absUrl(up.data.url) })
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
const removePic = (i) => reviewPics.value.splice(i, 1)
// 2026-10-17 改版 R3：评价视频（最多 1 段）。先分段传到 /app/upload/video，再把缩略图传成封面；提交时放进 videos: [{url, cover}]。
// 后端只收平台视频上传接口给的路径（文件要在）。网页版选视频没有缩略图，封面留空（列表里画暖灰底 + 播放按钮）
const reviewVideo = ref(null)
const videoUploading = ref(false)
async function addVideo() {
  if (videoUploading.value) return
  videoUploading.value = true
  let err = null
  try {
    const v = await chooseAndUploadVideo((pct) => uni.showLoading({ title: '视频上传中 ' + pct + '%', mask: true }), {
      // 选好、检查过才开始转圈（选择框里取消不出加载框）
      upload: (f, cb) => { uni.showLoading({ title: '视频上传中', mask: true }); return uploadVideoParts(f, cb) }
    })
    if (v && v.url) reviewVideo.value = { url: v.url, cover: v.cover || '' }
  } catch (e) {
    err = e
  } finally {
    uni.hideLoading()
    videoUploading.value = false
  }
  // 微信里 hideLoading 会连提示一起关掉，所以先关加载框再提示
  if (err) toast(errText(err, '视频上传失败'))
}
const removeVideo = () => { reviewVideo.value = null }
const previewOwnVideo = () => { if (reviewVideo.value) previewVideo(absUrl(reviewVideo.value.url), absUrl(reviewVideo.value.cover)) }
const previewPic = (i) => uni.previewImage({ urls: reviewPics.value.map(x => x.img), current: reviewPics.value[i] && reviewPics.value[i].img })
// 正在输入的是第几项（-1 = 都没在输入）：只有这一项渲染真 textarea，免得原生输入框盖住底部按钮
const editingIdx = ref(-1)
// 直接点另一项时，新一项的点击可能先于旧一项的失焦到达，只收回自己那一项
const onAreaBlur = (i) => { if (editingIdx.value === i) editingIdx.value = -1 }
function resetQuestions(bizType) {
  editingIdx.value = -1
  reviewPics.value = []
  reviewVideo.value = null
  questions.value = (QUESTIONS[bizType] || QUESTIONS.application).map(([title, short]) => ({ title, short, stars: 0, label: starLabels[0], text: '' }))
}
resetQuestions(query.bizType)
async function loadTarget() {
  const bizType = query.bizType
  const bizId = Number(query.bizId) || 0
  let todo = []
  try {
    todo = (await apiReviewsTodo()).data || []
  } catch (e) {
    return toast(errText(e, '加载失败'))
  }
  let t = bizType && bizId ? todo.find(x => x.bizType === bizType && Number(x.bizId) === bizId) : null
  if (!t && !(bizType && bizId)) {
    if (!todo.length) {
      await alert('暂时没有待评价的订单', '岗位完成、住宿离店或活动结束后 30 天内可以评价。')
      return replace(R.orders + '?s=2')
    }
    const i = todo.length === 1 ? 0 : await pickPaged(todo.map(x => `${x.sub}｜${x.title}`), '选择要评价的订单')
    if (i < 0) return back()
    t = todo[i]
  }
  if (!t) {
    // 之前只说「可能已经评价过，或者还没有完成」；住宿离店、活动结束超过 30 天的订单也会落到这里，原因没说全
    await alert('这笔订单暂时不能评价', '可能已经评价过、还没有完成，或已超过完成后 30 天的评价期。')
    return replace(R.orders + '?s=2')
  }
  target.value = t
  resetQuestions(t.bizType)
}
const progress = computed(() => questions.value.filter(x => x.stars > 0).length)
const setStar = (q, n) => { q.stars = n; q.label = starLabels[n] }
const bubbleCopy = computed(() => (target.value
  ? `正在评价「${target.value.title}」\n请按真实体验打分～`
  : '为了帮更多小伙伴找到安心好去处，\n请分享你的真实体验～'))
const content = computed(() => questions.value.filter(x => x.text.trim()).map(x => `【${x.short}】${x.text.trim()}`).join('\n'))
const preview = computed(() => content.value || '写下感受后，这里显示将要提交的评价正文。')
const previewChip = computed(() => `${content.value.length}/1000`)
// 提交成功后要等 0.9 秒才跳走：之前这段时间里按钮又能点，再点一次就重复提交；现在成功后一直锁着，只有失败才放开
const submitting = ref(false)
async function submitReview() {
  if (!target.value) return toast('请先选择要评价的订单')
  const miss = questions.value.findIndex(x => !x.stars)
  if (miss >= 0) return toast(`第 ${miss + 1} 项还没打分`)
  if (content.value.length > 1000) return toast('评价内容不超过 1000 字')
  if (picUploading.value) return toast('照片还在上传，请稍等')
  if (videoUploading.value) return toast('视频还在上传，请稍等')
  if (submitting.value) return
  submitting.value = true
  try {
    const payload = {
      bizType: target.value.bizType, bizId: target.value.bizId, dims: questions.value.map(x => x.stars), content: content.value, anonymous: true
    }
    if (canPhoto.value && reviewPics.value.length) payload.images = reviewPics.value.map(x => x.url)
    if (canPhoto.value && reviewVideo.value) payload.videos = [{ url: reviewVideo.value.url, cover: reviewVideo.value.cover }]
    const res = await apiWriteReview(payload)
    toast((res.data && res.data.message) || '评价已提交')
    // 之前落到评价管理的「待评价」页签，刚写的评价已不在那里，看起来像没提交上；现在直接落到「已发布」
    setTimeout(() => replace(R.orders + '?s=2&tab=' + encodeURIComponent('已发布')), 900)
  } catch (e) {
    toast(errText(e, '提交失败'))
    submitting.value = false
  }
}

// ---------------- s=2 到店路线 ----------------
// Offline addresses belong to one account and one requested destination.
const savedRouteKey = () => `kangaroo:${experience.account?.id || 'guest'}:saved-route:${Number(query.stayId) || 0}:${Number(query.storeId) || 0}`
const rt = ref(null)
const here = ref(null)
const routeLoading = ref(false)
const routeNotice = ref('')
async function loadRoute() {
  routeLoading.value = true
  routeNotice.value = ''
  rt.value = null
  here.value = null
  const params = {}
  if (Number(query.stayId)) params.stayId = Number(query.stayId)
  if (Number(query.storeId)) params.storeId = Number(query.storeId)
  try {
    rt.value = (await apiRoute(params)).data
  } catch (e) {
    let saved = null
    // A business rejection (including no eligible order) is not an offline condition.
    if (e?.code === -1) {
      try { saved = uni.getStorageSync(savedRouteKey()) || null } catch (err) { saved = null }
    }
    if (!saved) {
      routeNotice.value = errText(e, '路线加载失败')
      return toast(routeNotice.value)
    }
    rt.value = saved
    routeNotice.value = '正在显示本机保存的离线路线，联网后请核对最新信息'
    toast('加载失败，显示上次离线保存的路线')
  } finally {
    routeLoading.value = false
  }
  uni.getLocation({ type: 'gcj02', success: (r) => { here.value = { latitude: r.latitude, longitude: r.longitude } }, fail: () => { here.value = null } })
}
const rad = (d) => (d * Math.PI) / 180
const km = computed(() => {
  const t = rt.value
  if (!t || !here.value || t.latitude == null || t.longitude == null) return null
  const la1 = rad(here.value.latitude)
  const la2 = rad(Number(t.latitude))
  const a = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(rad(Number(t.longitude) - here.value.longitude) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
})
const distText = computed(() => (km.value == null ? '' : km.value < 1 ? Math.round(km.value * 1000) + '米' : km.value.toFixed(1) + '公里'))
const shopImg = computed(() => (rt.value && rt.value.cover ? absUrl(rt.value.cover) : '/static/media/cover-empty.png'))
// 纯展示：店铺卡缩略图没有封面时先用第一张门店照片，最后才用占位图（11-18 第四轮）
const shopThumb = computed(() => (rt.value && rt.value.cover ? shopImg.value : (photos.value[0] || shopImg.value)))
const shopTitle = computed(() => (rt.value ? rt.value.title : routeLoading.value ? '加载中…' : routeNotice.value || '暂无可用路线'))
const shopPrice = computed(() => (rt.value && rt.value.price ? '¥' + rt.value.price : ''))
const shopUnit = computed(() => (rt.value && rt.value.unit) || '')
const shopAddr = computed(() => (rt.value ? rt.value.address : ''))
const shopSub = computed(() => {
  if (!rt.value) return ''
  if (routeNotice.value) return routeNotice.value
  if (km.value != null) return `距你直线约 ${distText.value}${rt.value.visit ? ' · ' + rt.value.visit : ''}`
  return rt.value.visit || rt.value.hint || '允许定位后显示距离；点地图可直接导航'
})
const modes = ['推荐路线', '步行', '公交', '打车']
const mode = ref('推荐路线')
const plans = computed(() => {
  if (!rt.value) return []
  const d = km.value
  if (d == null) {
    return [{ name: '微信地图导航', rec: true, mode: '推荐路线', time: '', dist: '', cost: '', sub: '允许定位后可估算步行 / 打车时间；点上方地图用微信内置地图规划路线' }]
  }
  const walk = Math.max(1, Math.round((d / 4.5) * 60))
  const taxi = Math.max(3, Math.round((d / 25) * 60) + 3)
  return [
    { name: '步行', rec: d <= 2, mode: '步行', time: `约${walk}分钟`, dist: distText.value, cost: '', steps: [
      { icon: 'footprints', text: '从你当前的位置出发' },
      { dot: 'green', text: `直线约 ${distText.value}，按每小时 4.5 公里估算` },
      { icon: 'target', text: rt.value.title }
    ] },
    { name: '公交', mode: '公交', time: '', dist: '', cost: '', sub: '具体线路请点地图，用微信内置地图查询' },
    { name: '打车', rec: d > 2, mode: '打车', time: `约${taxi}分钟`, dist: distText.value, cost: '费用以打车软件为准' }
  ]
})
// 真实地图：以房源 / 门店坐标为中心打点，点地图或标记用微信内置地图导航（没有登记坐标时不显示地图）
const hasCoord = computed(() => !!(rt.value && rt.value.latitude != null && rt.value.longitude != null))
const mapLat = computed(() => (hasCoord.value ? Number(rt.value.latitude) : 0))
const mapLng = computed(() => (hasCoord.value ? Number(rt.value.longitude) : 0))
const markers = computed(() => (hasCoord.value
  ? [{ id: 1, latitude: mapLat.value, longitude: mapLng.value, iconPath: '/pages/profile/static/user-icons/map-pin.png', width: 32, height: 32, callout: { content: rt.value.title, display: 'ALWAYS', padding: 6, borderRadius: 6 } }]
  : []))
// 旧版后端会把空的门店封面（cover=''）也当照片返回，先去掉空地址，没有照片时只显示「还没有上传照片」
const photos = computed(() => ((rt.value && rt.value.photos) || []).map((u) => String(u || '').trim()).filter(Boolean).map(absUrl))
// 房源路线没有照片时也要说「房源」，不能笼统写成门店
const photoTitle = computed(() => (!rt.value ? '门店照片' : (rt.value.kind === 'stay' ? '房源' : '门店') + (photos.value.length ? '照片' : '还没有上传照片')))
const previewPhoto = (i) => uni.previewImage({ urls: photos.value, current: photos.value[i] })
async function call() {
  const t = rt.value
  if (!t) return toast('暂无可用路线，请先选择订单或门店')
  if (t.phone) return uni.makePhoneCall({ phoneNumber: t.phone })
  if (t.appId && (await confirm('联系商家', `${t.phoneHint || '门店没有登记电话'}。现在给门店发消息？`))) return go(R.chat + '?appId=' + t.appId)
  if (!t.appId) alert('联系商家', t.phoneHint || '可以在消息里联系门店')
}
// 一次点击可能同时触发地图、图钉、气泡几个事件，短时间内只打开一次地图
let mapOpenedAt = 0
function openMap() {
  const now = Date.now()
  if (now - mapOpenedAt < 800) return
  mapOpenedAt = now
  const t = rt.value
  if (!t) return toast('暂无可用路线，请先选择订单或门店')
  if (t.latitude == null) return alert('还没有登记位置', t.address || '门店还没有登记地址')
  uni.openLocation({
    latitude: Number(t.latitude), longitude: Number(t.longitude), name: t.title, address: t.address || '',
    fail: () => copy(t.address || t.title, '当前环境打不开地图，地址已复制')
  })
}
const shareRoute = () => rt.value ? copy(`${rt.value.title}\n${rt.value.address}`, '地址已复制，可以发给同行的朋友') : toast('暂无可用路线，请先选择订单或门店')
function saveOffline() {
  if (!rt.value) return toast('暂无可用路线，请先选择订单或门店')
  try {
    uni.setStorageSync(savedRouteKey(), rt.value)
    toast('已保存到本机，没网时这里也能看到地址')
  } catch (e) {
    toast('保存失败')
  }
}

// ---------------- s=3 推荐不可用 ----------------
const keyword = ref('')
const searchStays = () => go(R.staysList + '?s=2' + (keyword.value.trim() ? '&keyword=' + encodeURIComponent(keyword.value.trim()) : ''))
async function retry() {
  try {
    await apiHomeFeed()
    toast('推荐服务已恢复')
    setTimeout(() => go(R.home), 500)
  } catch (e) {
    toast(errText(e, '推荐服务仍不可用，请先用普通筛选'))
  }
}

// ---------------- s=4 权限与错误恢复 ----------------
const errTabs = [
  { key: 'location', label: '定位拒绝', icon: 'map-pin-x', tone: 'green', title: '无法获取你的位置信息', desc: '定位权限已被拒绝，将影响附近房源、路线规划等功能\n请按照以下步骤开启定位权限。', steps: ['打开小程序右上角「···」>「设置」', '找到「位置信息」', '选择「仅在使用小程序期间」', '返回小程序，重新获取位置'], primary: '去系统设置', secondary: '重新获取位置' },
  { key: 'camera', label: '相机未授权', icon: 'camera-off', tone: 'ochre', title: '相机权限未授权', desc: '相机权限未开启，将无法拍摄与上传照片\n请按照以下步骤开启相机权限。', steps: ['打开小程序右上角「···」>「设置」', '找到「摄像头」并开启', '如仍不行，到手机「设置」里允许微信使用相机', '返回小程序，重新拍摄'], primary: '去系统设置', secondary: '重新授权相机' },
  { key: 'pay', label: '支付超时', icon: 'hourglass', tone: 'alert', title: '支付已超时', desc: '订单未在限定时间内完成支付\n请回到订单重新发起支付。', steps: ['打开「我的 - 订单」里的待付款订单', '确认订单信息后重新发起支付', '在页面提示的时间内完成微信支付', '支付完成后到「我的 - 订单」查看'], primary: '重新支付', secondary: '查看订单' },
  { key: 'network', label: '网络断开', icon: 'wifi-off', tone: 'indigo', title: '网络连接已断开', desc: '当前网络不可用，将影响内容加载与提交\n请检查网络设置后重试。', steps: ['检查手机 Wi-Fi 或移动数据是否开启', '关闭飞行模式或切换网络', '返回小程序，下拉刷新页面', '仍无法连接可联系客服'], primary: '重试', secondary: '检查网络设置' }
]
const errTab = ref('location')
const current = computed(() => errTabs.find(t => t.key === errTab.value))
function openSetting() {
  if (typeof uni.openSetting !== 'function') return alert('去系统设置', '请在手机「设置」里找到当前应用，开启对应权限后返回。')
  uni.openSetting({ fail: () => alert('去系统设置', '请在手机「设置」里找到当前应用，开启对应权限后返回。') })
}
const networkType = () => new Promise((resolve) => uni.getNetworkType({ success: (r) => resolve(r.networkType), fail: () => resolve('unknown') }))
async function onPrimary() {
  const k = errTab.value
  if (k === 'location' || k === 'camera') return openSetting()
  if (k === 'pay') return go(R.orders + '?tab=' + encodeURIComponent('待付款'))
  const t = await networkType()
  if (t === 'none') return toast('仍然没有网络')
  toast('网络已恢复')
  setTimeout(() => back(), 500)
}
async function onSecondary() {
  const k = errTab.value
  if (k === 'location') {
    return uni.getLocation({ type: 'gcj02', success: () => toast('已获取位置'), fail: () => toast('仍未获取到位置，请先在设置里开启') })
  }
  if (k === 'camera') {
    if (typeof uni.authorize !== 'function') return toast('当前环境不需要单独授权相机')
    return uni.authorize({ scope: 'scope.camera', success: () => toast('相机已授权'), fail: () => toast('仍未授权，请在设置里开启') })
  }
  if (k === 'pay') return go(R.orders)
  const t = await networkType()
  alert('当前网络', t === 'none' ? '没有检测到可用网络，请打开 Wi-Fi 或移动数据。' : `当前网络：${t}，如仍加载失败请稍后重试。`)
}
</script>

<style scoped lang="scss">
.sec-title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 15px; margin: 14px 0 10px; }

/* s1 */
/* 底部固定着「提交评价」：之前这里的 padding 简写把 k-pad-bottom 的底部留白盖成了 0，最后的预览和说明被按钮挡住、滑不上来 */
.ai { padding: 8px 14px calc(88px + var(--k-safe-bottom)); }
.ai__progress { display: block; font-size: 13px; color: var(--k-muted); margin-bottom: 8px; }
.ai__hello { display: flex; align-items: flex-start; gap: 8px; }
.ai__avatar { width: 46px; height: 46px; border-radius: 50%; flex: 0 0 auto; border: 1px solid var(--k-line); }
.bubble { position: relative; flex: 1; min-width: 0; max-width: 240px; background: var(--k-paper); border: 1px solid var(--k-line2); border-radius: 10px; padding: 8px 12px; }
.bubble__tail { position: absolute; left: -6px; top: 16px; width: 10px; height: 10px; background: var(--k-paper); border-left: 1px solid var(--k-line2); border-bottom: 1px solid var(--k-line2); transform: rotate(45deg); }
.bubble__hi { display: block; font-size: 14px; font-weight: 500; }
.bubble__copy { display: block; font-size: 12px; color: var(--k-muted); line-height: 1.6; margin-top: 4px; white-space: pre-line; }
.q { margin-top: 6px; }
.q__head { display: flex; align-items: center; gap: 6px; height: 24px; }
.q__num { width: 16px; height: 16px; border-radius: 50%; background: var(--k-green); color: var(--k-paper); font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.q__title { font-family: var(--k-serif); font-weight: 700; font-size: 14px; }
.q__stars { display: flex; align-items: center; gap: 8px; padding: 2px 0 4px 2px; }
.q__star { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.q__level { margin-left: auto; margin-right: 8px; font-size: 13px; color: var(--k-muted); }
.q__box { position: relative; background: var(--k-paper); border: 1px solid var(--k-line2); border-radius: 8px; padding: 6px 10px 16px; }
.q__area { width: 100%; height: 22px; font-size: 13px; line-height: 22px; }
/* 不在输入时的占位文字：真 textarea 是 auto-height，这里也跟着内容长高，换行规则对齐输入框 */
.q__area.review-area-idle { height: auto; min-height: 22px; white-space: pre-wrap; word-break: break-all; overflow: hidden; }
.q__counter { position: absolute; right: 10px; bottom: 3px; font-size: 11px; color: var(--k-light); }
.polish { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.polish__title { font-size: 13px; }
.polish__chip { height: 18px; padding: 0 6px; border-radius: 4px; background: var(--k-green); color: var(--k-paper); font-size: 10px; display: flex; align-items: center; }
.polish__box { margin-top: 6px; background: var(--k-paper); border: 1px solid var(--k-line2); border-radius: 8px; padding: 8px 10px; }
.polish__text { font-size: 12.5px; line-height: 1.6; color: var(--k-muted); }
/* 住宿评价附照片（2026-10-17 R2） */
.pics { margin-top: 12px; }
.pics__head { display: flex; align-items: baseline; justify-content: space-between; }
.pics__title { font-family: var(--k-serif); font-weight: 700; font-size: 14px; }
.pics__hint { font-size: 12px; color: var(--k-muted); }
.pics__grid { margin-top: 8px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.pics__cell { position: relative; height: 0; padding-bottom: 100%; border-radius: 10px; overflow: hidden; background: var(--k-paper2); }
.pics__img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
.pics__del { position: absolute; right: 4px; top: 4px; width: 20px; height: 20px; border-radius: 50%; background: rgba(58, 50, 43, .6); display: flex; align-items: center; justify-content: center; }
.pics__add { border: 1px dashed var(--k-line2); background: var(--k-red-soft); box-sizing: border-box; }
.pics__add-in { position: absolute; left: 0; top: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.pics__add-text { font-size: 11px; color: var(--k-red-deep); }
/* 2026-10-17 R3：评价视频格（和照片格同样大小）：没封面时暖灰底，中间一个播放按钮 */
.vids__ph { background: var(--k-ink); }
.vids__play { position: absolute; left: 50%; top: 50%; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; background: rgba(36, 27, 23, .5); display: flex; align-items: center; justify-content: center; }
.ai__note { display: block; text-align: center; font-size: 12px; color: var(--k-muted); margin-top: 8px; }

/* s2 */
.shop { display: flex; align-items: flex-start; gap: 12px; }
.shop__img { width: 78px; height: 72px; border-radius: 8px; flex: 0 0 auto; }
.shop__title { display: block; font-family: var(--k-serif); font-weight: 700; font-size: 17px; }
.shop__addr { display: block; font-size: 11px; color: var(--k-muted); line-height: 1.5; }
.shop__call { display: flex; flex-direction: column; align-items: center; gap: 4px; padding-left: 10px; border-left: 1px solid var(--k-line); align-self: center; }
.shop__phone { width: 32px; height: 32px; border-width: 1px; }
.map { width: 100%; height: 160px; border-radius: 12px; margin-top: 12px; }
.modes { display: flex; align-items: center; margin-top: 12px; }
.mode { flex: 1; height: 38px; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px; color: var(--k-ink); }
.mode.active { background: var(--k-red); color: var(--k-paper); font-weight: 600; }
.plan { margin-top: 10px; background: var(--k-paper); border: 1px solid var(--k-line); border-radius: 12px; padding: 10px 12px; }
.plan__head { display: flex; align-items: center; }
.plan__name { flex: 1.3; font-family: var(--k-serif); font-weight: 700; font-size: 15px; }
.plan__stat { flex: 1; font-size: 13px; }
.plan__stat--last { text-align: right; flex: .7; }
.plan__steps { margin-top: 8px; }
.step { display: flex; align-items: stretch; gap: 8px; min-height: 22px; }
.step__track { position: relative; width: 14px; display: flex; justify-content: center; align-items: flex-start; padding-top: 4px; }
.step__dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 3px; z-index: 1; }
.step__dot--green { background: var(--k-green); }
.step__dot--red { background: var(--k-red); }
.step__dot--hollow { background: var(--k-paper); border: 1.5px solid var(--k-line2); }
.step__line { position: absolute; left: 6px; top: 16px; bottom: -4px; width: 0; border-left: 1px dashed var(--k-line2); }
.step__text { font-size: 12px; color: var(--k-ink); line-height: 22px; }
.plan__sub { display: block; font-size: 12px; color: var(--k-muted); margin-top: 6px; }
.photos { display: flex; gap: 8px; }
.photos__img { flex: 1; min-width: 0; height: 90px; border-radius: 8px; }

/* s3 */
.search__box { flex: 1; min-width: 0; height: 40px; border-radius: 999px; border: 1px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; gap: 8px; padding: 0 14px; }
.search__box input { flex: 1; min-width: 0; font-size: 13px; }
.search__filter { position: relative; height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; gap: 6px; font-size: 14px; flex: 0 0 auto; }
.search__badge { position: absolute; right: -6px; top: -6px; width: 16px; height: 16px; border-radius: 50%; background: var(--k-red); color: var(--k-paper); font-size: 10px; display: flex; align-items: center; justify-content: center; }
.filters { display: flex; gap: 8px; margin-top: 10px; }
.filter { flex: 1; min-width: 0; height: 38px; border-radius: 8px; border: 1px solid var(--k-line2); background: var(--k-paper); display: flex; align-items: center; justify-content: space-between; padding: 0 12px; font-size: 14px; }
/* 320 宽时每格只有 66px：两字标签被挤成一字一行（位/置），改成不换行、两边留白收窄 */
.filter text { white-space: nowrap; }
@media (max-width: 340px) { .filter { padding: 0 8px; } }
.unavail { display: flex; flex-direction: column; align-items: center; padding-top: 44px; }
.unavail__img { width: 180px; height: 140px; }
.unavail__title { font-family: var(--k-serif); font-weight: 700; font-size: 22px; margin-top: 14px; }
.unavail__desc { font-size: 14px; color: var(--k-muted); line-height: 1.7; text-align: center; margin-top: 8px; white-space: pre-line; }
.unavail__btns { width: 236px; display: flex; flex-direction: column; gap: 12px; margin-top: 22px; }

/* s4 */
.err-tab { font-size: 15px; }
.perm__body { display: flex; flex-direction: column; align-items: center; padding: 60px 8px 0; }
.perm__img { width: 112px; height: 118px; }
.perm__icon { width: 112px; height: 112px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--k-paper2); }
.perm__icon.is-ochre { background: var(--k-ochre-soft); }
.perm__icon.is-alert { background: var(--k-alert-soft); } /* 支付超时是报错，用提醒红 */
.perm__icon.is-indigo { background: var(--k-indigo-soft); }
.perm__title { font-family: var(--k-serif); font-weight: 700; font-size: 22px; margin-top: 18px; }
.perm__desc { font-size: 13px; color: var(--k-muted); line-height: 1.8; text-align: center; margin-top: 10px; white-space: pre-line; }
.perm__steps { width: 100%; display: flex; flex-direction: column; gap: 12px; margin: 22px 0 26px; padding: 0 8px; }
.perm__step { display: flex; align-items: center; gap: 12px; }
.perm__num { width: 22px; height: 22px; border-radius: 50%; border: 1.2px solid var(--k-light); color: var(--k-muted); font-size: 12px; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
.perm__step-text { font-size: 14px; }
.perm__help { display: flex; align-items: center; gap: 6px; margin-top: 18px; }
.perm__help-link { color: var(--k-ink); }

/* ---------------------------------------------------------------------------------------------------------------
   2026-11-17 改版「小而精」（主人按样张第三版拍板）：写评价、到店路线、推荐暂不可用、权限恢复四屏 —— 浅灰底、白卡 12 圆角、不描边不加阴影。
   功能和文字不变：每题打星和文字、晒照片 / 视频、评价预览、提交评价、路线方式、联系商家 / 分享 / 离线保存、重试 / 联系客服都在。
   星星的点按格从 32 放到 36；评价输入的字从 13 调到 14；带米色底的小插画用 darken 混合，底色融进页面。
   --------------------------------------------------------------------------------------------------------------- */
.review { --k-bg: var(--k-page); --k-radius: 12px; background: var(--k-page); }
.review :deep(.k-navbar__title) { font-family: var(--k-sans); font-size: 16px; font-weight: 600; }
.review .k-body { padding-left: 12px; padding-right: 12px; }
.review :deep(.k-button.is-lg) { height: 44px; font-size: 15px; box-shadow: none; }
.review :deep(.k-button.is-secondary) { color: var(--k-red-deep); }
.sec-title { font-family: var(--k-sans); }
/* 1 写评价：每一题一张白卡，输入区是卡里的浅灰块 */
.ai { padding: 8px 12px calc(88px + var(--k-safe-bottom)); }
.ai__progress { font-size: 12px; }
.ai__avatar { width: 40px; height: 40px; border: 0; }
.bubble { padding: 10px 12px; border: 0; border-radius: 12px; }
.bubble__tail { top: 14px; border: 0; }
.bubble__hi { font-weight: 600; }
.q { margin-top: 8px; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.q__num { width: 18px; height: 18px; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 11px; font-weight: 600; }
.q__title { font-family: var(--k-sans); font-weight: 600; }
.q__stars { gap: 4px; padding: 4px 0 6px; }
.q__star { width: 36px; height: 36px; }
.q__level { margin-right: 0; font-size: 12px; }
.q__box { padding: 8px 10px 18px; border: 0; border-radius: 8px; background: var(--k-page); }
.q__area { font-size: 14px; }
.q__counter { bottom: 4px; }
.pics { margin-top: 8px; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.pics__title { font-family: var(--k-sans); font-weight: 600; }
.pics__hint { font-size: 11px; }
.pics__cell { border-radius: 8px; background: var(--k-page); }
.pics__add { border-color: var(--k-red-line); background: var(--k-paper); }
.polish { margin-top: 14px; padding: 0 2px; }
.polish__title { font-weight: 600; }
.polish__chip { height: 17px; padding: 0 5px; background: var(--k-green-soft); color: var(--k-green); font-weight: 500; }
.polish__box { margin-top: 8px; padding: 12px; border: 0; border-radius: 12px; }
.polish__text { font-size: 13px; line-height: 1.65; }
.ai__note { margin-top: 10px; font-size: 11px; }
/* 2 到店路线 */
.shop { gap: 10px; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.shop__img { width: 72px; }
.shop__title { font-family: var(--k-sans); font-size: 15px; font-weight: 600; }
.map { margin-top: 8px; }
.modes { margin-top: 8px; padding: 3px; border-radius: 10px; background: #EFEBE5; }
.mode { height: 32px; font-size: 13px; color: var(--k-ink2); }
.mode.active { background: var(--k-paper); color: var(--k-red-deep); }
.plan { margin-top: 8px; padding: 12px; border: 0; }
.plan__name { font-family: var(--k-sans); font-size: 14px; font-weight: 600; }
.plan__stat { font-size: 12px; color: var(--k-ink2); }
/* 3 推荐暂不可用 */
.search__box { height: 36px; padding: 0 12px; border: 0; }
.search__filter { height: 36px; border: 0; border-radius: 999px; font-size: 13px; }
.filters { gap: 6px; margin-top: 8px; }
.filter { height: 32px; padding: 0 10px; border: 0; font-size: 13px; }
.unavail { padding-top: 36px; }
.unavail__img { width: 150px; height: 119px; mix-blend-mode: darken; }
.unavail__title { margin-top: 12px; font-family: var(--k-sans); font-size: 17px; }
.unavail__desc { font-size: 13px; }
.unavail__btns { width: 220px; gap: 10px; margin-top: 20px; }
/* 4 权限与错误恢复 */
.err-tab { font-size: 14px; }
.perm__body { padding-top: 44px; }
.perm__img { width: 96px; height: 101px; mix-blend-mode: darken; }
.perm__icon { width: 88px; height: 88px; }
.perm__title { margin-top: 16px; font-family: var(--k-sans); font-size: 17px; }
.perm__desc { margin-top: 8px; line-height: 1.7; }
.perm__steps { gap: 10px; margin: 18px 0 20px; padding: 12px; border-radius: 12px; background: var(--k-paper); }
.perm__num { width: 20px; height: 20px; border: 0; background: var(--k-red-soft); color: var(--k-red-deep); font-size: 11px; font-weight: 600; }
.perm__step-text { font-size: 13px; }
.perm__body :deep(.k-button + .k-button) { margin-top: 10px; }
.perm__help { min-height: 44px; margin-top: 6px; }
/* 复查补充：路线方式页签、筛选下拉看着仍是 32 高，用透明的 ::after 把点按范围撑回 36 以上；页内按钮统一成胶囊 */
.mode, .filter { position: relative; }
.mode::after { content: ""; position: absolute; left: 0; right: 0; top: -3px; bottom: -3px; }
.filter::after { content: ""; position: absolute; left: 0; right: 0; top: -2px; bottom: -2px; }
.review :deep(.k-button) { border-radius: 999px; }
/* 不能点的按钮：11-18 第二轮起交给公共组件 —— 原配色整体 .45，不再盖成冷灰块 */
/* 「说说你的真实感受」：整块浅灰输入区都能点开输入（之前只有那一行字能点），样子不变 */
.q__area.review-area-idle { margin: -8px 0 -18px; padding: 8px 0 18px; }
/* 2026-11-18 评审修正（只动样子） */
/* 1) 路线卡标题「微信地图导航 (推荐)」之前被挤成两行（右边三格没内容也占着宽度）：标题不折行，放不下时由右边三格让出宽度 */
.plan__name, .plan__name text { white-space: nowrap; }
/* 2) 门店照片只有一张时按 16:9 显示（之前固定 90 高，整宽的一张被压成 4:1 的扁条）；两张以上还是并排的小图 */
.photos__img:only-child { height: calc((100vw - 24px) * .5625); max-height: 240px; }
/* 3) 「位置 / 类型 / 价格 / 更多」和上面的搜索框、筛选钮统一成胶囊 */
.filter { padding: 0 12px; border-radius: 999px; }
/* 4) 权限恢复屏：步骤卡和两个大按钮回到 12 页边距（之前两边各多缩进 8） */
.perm__body { padding-left: 0; padding-right: 0; }
/* 11-18 第二轮精修（只动样子） */
/* 1) 描边按钮（重新获取位置、联系商家、分享路线等）统一成次按钮：细棕边 + 深棕字（之前灰边墨字） */
.review :deep(.k-button.is-outline) { border-color: var(--k-red-line); color: var(--k-red-deep); }
/* 2) 「联系商家」电话圆钮：1px 浅线描边，图标在模板里换成二级墨（之前 1.5px 深墨描边，比旁边的字还重） */
.shop__phone { border-color: var(--k-line2); }
/* 3) 路线方式：分段控件 —— var(--k-fill) 外框 32 高、白块 28 高，字 13（选中 600 墨色、没选 400 二级墨）；透明 ::after 上下各撑 4，点按区 36 */
.modes { padding: 2px; border-radius: 16px; background: var(--k-fill); }
.mode { height: 28px; border-radius: 14px; font-size: 13px; font-weight: 400; color: var(--k-ink2); }
.mode.active { background: var(--k-paper); color: var(--k-ink); font-weight: 600; }
.mode::after { top: -4px; bottom: -4px; }
/* 4) 错误恢复屏的页签：字 14，没选 400 灰、选中 600 墨色，下面 16×3 暖棕短条，整行 40 高 */
.err-tab { padding: 9px 0; font-size: 14px; font-weight: 400; line-height: 22px; color: var(--k-muted); }
.err-tab.active { color: var(--k-ink); font-weight: 600; }
.err-tab.active::after { width: 16px; height: 3px; margin-left: -8px; border-radius: 2px; background: var(--k-red); }
/* ===================================================================================================
   11-18 第三轮「逐页精修」（只动样子；功能、文字、点按区不变）
   页边距 16、卡内 16、卡间 12；星星统一 k-icon star（实心用 fill，赭色）；图标只用线性、语义色。
   =================================================================================================== */
.review .k-body { padding-left: 16px; padding-right: 16px; }
/* 1 引导式评价：每题一张白卡，题号 18 浅棕圆；星星 24（点按格 40）；进度一行在最上面 */
.ai { padding: 12px 16px calc(88px + var(--k-safe-bottom)); }
.ai__progress { margin-bottom: 12px; font-size: 12px; font-variant-numeric: tabular-nums; }
.ai__hello { gap: 10px; margin-bottom: 4px; }
.ai__avatar { width: 40px; height: 40px; }
.bubble { max-width: none; padding: 12px 14px; }
.bubble__hi { font-size: 14px; line-height: 20px; }
.bubble__copy { margin-top: 2px; font-size: 12px; line-height: 1.6; }
.q { margin-top: 12px; padding: 16px; }
.q__head { gap: 8px; height: 20px; }
.q__title { font-size: 14px; font-weight: 600; line-height: 20px; }
.q__stars { gap: 4px; margin: 8px 0 8px -8px; padding: 0; }
.q__star { width: 40px; height: 40px; }
.q__level { font-size: 12px; color: var(--k-muted); }
.q__box { padding: 10px 12px 20px; border-radius: 8px; background: var(--k-bg); }
.pics { margin-top: 12px; padding: 16px; }
.pics__title { font-size: 14px; line-height: 20px; }
.pics__grid { margin-top: 10px; }
.pics__add { border: 1px dashed var(--k-red-line); background: var(--k-paper); }
.pics__add-text { margin-top: 2px; font-size: 11px; color: var(--k-red-deep); }
.polish { margin-top: 24px; padding: 0; }
.polish__title { font-size: 14px; line-height: 20px; }
.polish__chip { font-variant-numeric: tabular-nums; }
.polish__box { margin-top: 10px; padding: 16px; }
.polish__text { font-size: 13px; line-height: 1.7; color: var(--k-ink2); }
.ai__note { margin-top: 12px; }
/* 2 到店路线 */
.route { padding-top: 12px; }
.shop { gap: 12px; padding: 16px; }
.shop__img { width: 72px; height: 72px; }
.shop__title { font-size: 15px; line-height: 21px; }
.shop__addr { margin-top: 2px; font-size: 12px; }
.shop__call { border-left: 0; padding-left: 12px; box-shadow: inset 1px 0 0 0 var(--k-line); }
.shop__phone { width: 36px; height: 36px; }
.map { margin-top: 12px; }
.modes { margin-top: 12px; }
.plan { margin-top: 12px; padding: 16px; }
.photos { margin-top: 0; }
.route .sec-title { margin: 24px 0 10px; font-size: 16px; font-weight: 700; line-height: 22px; }
/* 3 推荐暂不可用：插画收小，主按钮 40 高 200 宽；另外两个是并排的 32 高次按钮小胶囊，空状态不再竖着压三颗大按钮 */
.search { padding-top: 12px; }
.filters { margin-top: 10px; }
.unavail { padding-top: 48px; }
.unavail__img { width: 128px; height: 101px; }
.unavail__title { margin-top: 16px; font-size: 17px; font-weight: 700; line-height: 24px; }
.unavail__desc { margin-top: 6px; font-size: 13px; line-height: 1.7; }
.unavail__btns { width: 240px; flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 24px; }
.unavail__btns :deep(.k-button) { flex: 1 1 0; min-width: 0; height: 32px; padding: 0 12px; border-radius: 16px; font-size: 13px; font-weight: 500; box-shadow: none; }
.unavail__btns :deep(.k-button.is-primary) { flex: 0 0 100%; height: 40px; margin-bottom: 4px; border-radius: 20px; font-size: 14px; font-weight: 600; }
.unavail__btns :deep(.k-button.is-secondary) { background: var(--k-paper); border: 1px solid var(--k-red-line); color: var(--k-red-deep); }
/* 4 权限与错误恢复：顶上的 3D 绿色定位针换成 40 号线性图标放在 80 浅棕圆角方块里（支付超时仍是提醒红）；步骤卡 16 内边距 */
.perm__body { padding-top: 40px; }
.perm__icon, .perm__icon.is-ochre, .perm__icon.is-indigo, .perm__icon.is-green, .perm__icon.is-location { width: 80px; height: 80px; border-radius: 24px; background: var(--k-red-soft); }
.perm__icon.is-alert { background: var(--k-alert-soft); }
.perm__title { margin-top: 16px; font-size: 17px; font-weight: 700; line-height: 24px; }
.perm__desc { margin-top: 6px; font-size: 13px; line-height: 1.7; }
.perm__steps { gap: 0; margin: 24px 0; padding: 4px 16px; }
.perm__step { position: relative; gap: 10px; min-height: 44px; }
.perm__step + .perm__step::before { content: ""; position: absolute; left: 28px; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.perm__num { width: 18px; height: 18px; font-size: 11px; }
.perm__step-text { font-size: 13px; line-height: 20px; color: var(--k-ink); }
.perm__help { gap: 4px; margin-top: 8px; }
.perm__help-link { color: var(--k-red-deep); font-weight: 500; }
@media (max-width: 350px) {
  .review .k-body, .ai { padding-left: 12px; padding-right: 12px; }
  .q { padding: 12px; }
  .q__star { width: 36px; height: 36px; }
  .shop { gap: 10px; padding: 12px; }
  .shop__img { width: 64px; height: 64px; }
}
/* ===================================================================================================
   11-18 第三轮返修（独立评审第 1 轮；只动样子）
   =================================================================================================== */
/* 1 照片 + 视频一张卡：还没加照片时两格并排（76 方格、各自标题和说明在格子上面），加了照片后上下排、中间一条发丝线 */
.media-card { margin-top: 12px; padding: 16px; border-radius: 12px; background: var(--k-paper); }
.media-card .pics { margin: 0; padding: 0; border-radius: 0; background: transparent; }
.media-card .vids { position: relative; margin-top: 16px; padding-top: 16px; }
.media-card .vids::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
.media-card.is-compact { display: flex; gap: 16px; }
.media-card.is-compact .pics { flex: 1 1 0; min-width: 0; }
.media-card.is-compact .vids { margin-top: 0; padding-top: 0; }
.media-card.is-compact .vids::before { display: none; }
.media-card.is-compact .pics__head { flex-direction: column; align-items: flex-start; gap: 2px; }
.media-card.is-compact .pics__hint { line-height: 16px; }
.media-card.is-compact .pics__grid { display: flex; gap: 8px; margin-top: 10px; }
.media-card.is-compact .pics__cell { flex: 0 0 auto; width: 76px; height: 76px; padding-bottom: 0; }
/* 评价预览的字数：12 号灰色纯文字（和每题输入框右下角的计数一个样子），不再是绿色小胶囊 */
.polish__chip { height: auto; padding: 0; border-radius: 0; background: transparent; color: var(--k-muted); font-size: 12px; font-weight: 400; font-variant-numeric: tabular-nums; }
/* 打完分：「较好 / 很好」变成 13 / 600 暖棕，有反馈 */
.q__level.on { font-size: 13px; font-weight: 600; color: var(--k-red-deep); }
/* 2 到店路线：底部三颗按钮放进白底操作条（顶部发丝线），宽度 1 : 1 : 1.4；窄屏主按钮去掉图标 */
.route :deep(.k-bottom) { background: var(--k-paper); border-top-color: transparent; box-shadow: 0 -.5px 0 var(--k-line2); }
.route :deep(.k-bottom__inner) { padding: 8px 16px !important; gap: 8px; }
.route :deep(.k-bottom__inner > .k-button) { flex: 1 1 0; min-width: 0; height: 40px; padding: 0 8px; border-radius: 20px; font-size: 14px; }
.route :deep(.k-bottom__inner > .k-flex1) { flex: 1.4 1 0; min-width: 0; }
.route :deep(.k-bottom__inner > .k-flex1 .k-button) { height: 40px; padding: 0 8px; border-radius: 20px; font-size: 14px; }
@media (max-width: 359px) {
  .route :deep(.k-bottom__inner) { padding: 8px 12px !important; }
  .route :deep(.k-bottom__inner > .k-button) { font-size: 13px; }
}
/* 3 推荐暂不可用：顶部换成 80 浅棕方块 + 40 号线性图标（和 s4 一套做法）；主按钮 44 高，两颗次按钮 32 高 13 号字并排居中 */
.unavail__ic { width: 80px; height: 80px; border-radius: 20px; background: var(--k-red-soft); display: flex; align-items: center; justify-content: center; }
.review .unavail__btns { width: 248px; }
.review .unavail__btns :deep(.k-button.is-primary) { flex: 0 0 100%; height: 44px; border-radius: 22px; font-size: 15px; font-weight: 600; }
.review .unavail__btns :deep(.k-button.is-secondary) { flex: 1 1 0; min-width: 0; height: 32px; padding: 0 14px; border-radius: 16px; font-size: 13px; font-weight: 500; }
/* 4 权限说明：窄屏说明收到 12 号，不再把「功能」两个字单独挤到一行 */
@media (max-width: 359px) {
  .perm__desc { font-size: 12px; }
}
/* ===================================================================================================
   11-18 第三轮返修 2（独立评审第 2 轮；只动样子）
   =================================================================================================== */
/* 1 评价进度：助手气泡下面一条 4 高进度条（暖棕填充），右边 12 号「评价进度 N/5」 */
.ai__prog { display: flex; align-items: center; gap: 12px; margin: 12px 0 4px; }
.ai__bar { flex: 1; min-width: 0; height: 4px; border-radius: 2px; background: var(--k-line); overflow: hidden; }
.ai__bar-fill { height: 100%; border-radius: 2px; background: var(--k-red); transition: width .2s; }
.ai__prog .ai__progress { flex: 0 0 auto; margin: 0; font-size: 12px; line-height: 16px; color: var(--k-muted); }
/* 照片 / 视频还没加时：两栏的添加格拉满各自栏宽（72 高），右边不再空一块 */
.media-card.is-compact .pics__grid { display: flex; }
.media-card.is-compact .pics__cell.pics__add { flex: 1 1 auto; width: auto; height: 72px; }
/* 2 到店路线：店铺卡不再放分隔线，电话圆 + 「联系商家」小字收到右上角（字的样式见返修 5）；文字区拿到整行 */
.shop { position: relative; }
.shop > .k-flex1, .shop > .shop__main { min-width: 0; padding-right: 36px; }
.shop__call { position: absolute; top: 6px; right: 10px; padding: 6px; box-shadow: none; border-left: 0; }
.shop__phone { width: 32px; height: 32px; }
.plan__name .k-green { font-size: 11px; font-weight: 500; }
/* 3 推荐暂不可用：空状态图标块和全站一套（56 方块 + 32 图标） */
.unavail__ic { width: 56px; height: 56px; border-radius: 16px; }
/* 4 权限与错误恢复：「仍无法解决？」后面的耳机图标挪到「联系客服」前面（间距 4）；次按钮退成 36 高、按字宽、居中的描边胶囊 */
.perm__body :deep(.k-button.is-outline) { align-self: center; width: auto; min-width: 128px; height: 36px; margin-left: auto; margin-right: auto; padding: 0 20px; border-radius: 18px; font-size: 14px; font-weight: 500; }
/* ===================================================================================================
   11-18 第三轮返修 3（独立评审第 3 轮；只动样子）
   =================================================================================================== */
/* 1 引导式评价：「评价预览」标题收进预览卡（卡内 16，标题 15 / 600，右边计数），和照片 / 视频卡一样标题在卡里 */
.review .polish { margin-top: 12px; padding: 16px 16px 0; border-radius: 12px 12px 0 0; background: var(--k-paper); }
.review .polish__title { font-size: 15px; font-weight: 600; line-height: 21px; }
.review .polish__box { margin-top: 0; padding: 10px 16px 16px; border-radius: 0 0 12px 12px; }
/* 2 到店路线：地图固定 16:9、12 圆角；底栏三颗按钮所有宽度都带图标位（窄屏内边距收到 10） */
.review .map { width: 100%; height: calc((100vw - 32px) * 9 / 16); border-radius: 12px; background: var(--k-red-soft); }
@media (max-width: 359px) {
  .review .map { height: calc((100vw - 24px) * 9 / 16); }
  .route :deep(.k-bottom__inner > .k-button), .route :deep(.k-bottom__inner > .k-flex1 .k-button) { padding: 0 10px; }
}
/* 3 推荐暂不可用 / 4 权限：同一套空状态 —— 56 浅棕方块 + 32 图标，块整体下移到视口约 38% 处；
   按钮同一套：主按钮 248 宽 44 高实心，次按钮 40 高描边（s3 两颗并排平分 248，s4 一颗 248 宽） */
.review .unavail { padding-top: 18vh; }
.review .unavail__btns { width: 248px; gap: 8px; }
.review .unavail__btns :deep(.k-button.is-primary) { flex: 0 0 100%; height: 44px; margin-bottom: 4px; border-radius: 22px; font-size: 15px; font-weight: 600; box-shadow: none; }
.review .unavail__btns :deep(.k-button.is-secondary) { flex: 1 1 0; min-width: 0; height: 40px; padding: 0 12px; border-radius: 20px; font-size: 14px; font-weight: 500; }
.review .perm__body { padding-top: 12vh; }
.review .perm__icon, .review .perm__icon.is-ochre, .review .perm__icon.is-indigo, .review .perm__icon.is-green, .review .perm__icon.is-location { width: 56px; height: 56px; border-radius: 16px; }
.review .perm__body :deep(.k-button) { align-self: center; width: 248px; margin-left: auto; margin-right: auto; }
.review .perm__body :deep(.k-button.is-primary) { height: 44px; border-radius: 22px; font-size: 15px; font-weight: 600; box-shadow: none; }
.review .perm__body :deep(.k-button.is-outline) { min-width: 0; height: 40px; padding: 0 16px; border-radius: 20px; font-size: 14px; font-weight: 500; }
.review .perm__body :deep(.k-button + .k-button) { margin-top: 8px; }
/* ===================================================================================================
   11-18 第三轮返修 4（独立评审第 4 轮；只动样子）
   =================================================================================================== */
/* 1 评价进度条底色换成浅灰填充（0 分时也看得出是一条进度条） */
.review .ai__bar { height: 4px; border-radius: 2px; background: var(--k-fill); }
/* 2 房源照片：三张等分，右边留 24 给浮动客服钮，不再压住第三张 */
.review .route .photos { padding-right: 24px; }
/* 4 权限与错误恢复：整块上移，页底留「导航 + 32」，「联系客服」和中间凸起的「发布」钮至少隔 8 */
.review .perm { padding-bottom: calc(124px + var(--k-safe-bottom)); }
.review .perm__body { padding-top: 6vh; }
/* ===================================================================================================
   11-18 第三轮返修 5（独立评审第 5 轮；只动样子）
   =================================================================================================== */
/* 2 到店路线：电话圆钮下面的「联系商家」小字恢复显示（11 / 14 灰，圆钮 + 字竖排在卡片右上角）；文字区右边让出这一列 */
.review .shop > .k-flex1 { padding-right: 52px; }
.review .shop__call { top: 12px; right: 12px; padding: 0; gap: 2px; }
.review .shop__call .k-meta { display: block; font-size: 11px; line-height: 14px; color: var(--k-muted); white-space: nowrap; }
/* 房源照片三张等分拉满到页面右线（不再右边空 24） */
.review .route .photos { padding-right: 0; }
.review .route .photos__img { flex: 1 1 0; width: auto; }
/* 1 引导式评价：窄屏「评价预览（原文合并，不做改写）」收到 13 号一行放下，右边计数 11 号 */
@media (max-width: 359px) {
  .review .polish > .k-row { flex: 1 1 auto; min-width: 0; }
  .review .polish__title { font-size: 13px; line-height: 20px; white-space: nowrap; }
  .review .polish__chip { flex: 0 0 auto; margin-left: 8px; font-size: 11px; }
}
/* 4 权限与错误恢复：图标方块上方留白收一点 */
.review .perm__body { padding-top: 4vh; }
/* ===================================================================================================
   11-18 第四轮精修（微信实拍评审；只动样子）。前缀 .k-page.review 压过上面各轮
   =================================================================================================== */
/* 1 引导式评价：四道题合成一张问卷卡，题与题之间发丝线 + 20 留白；星星 28、间距 12、左对齐，「未评分 / 很满意」紧跟星星；没输入时输入块是 40 高单行 */
.k-page.review .q-list { margin-top:12px;border-radius:12px;background:var(--k-paper); }
.k-page.review .q { position:relative;margin:0;padding:20px 16px;border-radius:0;background:transparent;box-shadow:none; }
.k-page.review .q + .q::before { content:"";position:absolute;left:16px;right:16px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5); }
.k-page.review .q__stars { justify-content:flex-start;gap:12px;margin:12px 0;padding:0; }
.k-page.review .q__star { width:28px;height:36px; }
.k-page.review .q__level { margin:0;font-size:12px;line-height:18px; }
.k-page.review .q__level.on { font-size:13px; }
.k-page.review .q__box { min-height:40px;padding:9px 64px 9px 12px;box-sizing:border-box; }
.k-page.review .q__counter { right:12px;bottom:11px;line-height:18px; }
@media (max-width:359px) {
  .k-page.review .q { padding:16px 12px; }
  .k-page.review .q + .q::before { left:12px;right:12px; }
  .k-page.review .q__stars { gap:8px; }
}
/* 2 到店路线：「(推荐)」用深棕 12 / 500（绿色只给成功）；电话钮 36 圆、浅灰填充底 + 18 号暖棕电话；「离线保存」回到主按钮渐变 */
.k-page.review .plan__name .k-green { color:var(--k-red-deep);font-size:12px;font-weight:500; }
.k-page.review .shop__phone { width:36px;height:36px;border:0;background:var(--k-fill);box-shadow:none; }
.k-page.review .route :deep(.k-bottom__inner > .k-flex1 .k-button.is-primary) { background:var(--k-grad-brown);box-shadow:none; }
/* 3 推荐暂不可用：只留搜索框一个白块 —— 「筛选」和四个下拉退成文字下拉（13 二级墨 + 12 箭头，间距 20）；
   出错块的按钮按全端出错规矩：「稍后重试」32 高描边小按钮，另外两个出口是 12 / 500 暖棕文字按钮 */
.k-page.review .search__filter { height:36px;padding:0 4px;border:0;border-radius:0;background:transparent;box-shadow:none;gap:4px;font-size:13px;color:var(--k-ink2); }
.k-page.review .filters { justify-content:flex-start;gap:20px;margin-top:8px;padding:0 4px; }
.k-page.review .filter { flex:0 0 auto;justify-content:flex-start;gap:2px;height:32px;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;font-size:13px;color:var(--k-ink2); }
.k-page.review .unavail__btns { width:248px;flex-direction:row;flex-wrap:wrap;justify-content:center;gap:0 16px;margin-top:16px; }
.k-page.review .unavail__btns :deep(.k-button.is-primary) { flex:0 0 112px;width:112px;height:32px;margin:0 calc(50% - 56px) 4px;padding:0 12px;border:1px solid var(--k-red-line);border-radius:16px;background:var(--k-paper);box-shadow:none;color:var(--k-red-deep);font-size:13px;font-weight:500;box-sizing:border-box; }
.k-page.review .unavail__btns :deep(.k-button.is-secondary) { flex:0 0 auto;width:auto;min-width:0;height:32px;padding:0 4px;border:0;border-radius:0;background:transparent;box-shadow:none;color:var(--k-red);font-size:12px;font-weight:500; }
/* 4 权限与错误恢复：两个按钮和步骤卡同宽同左线（满宽 44 高，主次隔 8）；图标上方留白收到 32 */
.k-page.review .perm__body { padding-top:20px; }
.k-page.review .perm__body :deep(.k-button) { align-self:stretch;width:100%;margin-left:0;margin-right:0; }
.k-page.review .perm__body :deep(.k-button.is-outline) { height:44px;padding:0 16px;border-color:var(--k-red-line);border-radius:22px;color:var(--k-red-deep);font-size:15px;font-weight:600; }
.k-page.review .perm__body :deep(.k-button + .k-button) { margin-top:8px; }
/* 第四轮复查：店名、地址、固定说明只在空格 / 标点处断行，不再掉单字 */
.k-page.review .shop__title, .k-page.review .shop__addr, .k-page.review .unavail__desc, .k-page.review .perm__desc, .k-page.review .plan__sub, .k-page.review .bubble__copy { word-break:keep-all;overflow-wrap:break-word;overflow-wrap:anywhere; }
/* ===================================================================================================
   11-19 第四轮返修（独立复评；只动样子）
   =================================================================================================== */
/* 1 题号、4 步骤号：和一键报名的步骤号一套 —— 18 实心暖棕圆 + 白字 11 / 600 */
.k-page.review .q__num, .k-page.review .perm__num { width:18px;height:18px;border:0;border-radius:50%;background:var(--k-red);color:var(--k-paper);font-size:11px;font-weight:600; }
.k-page.review .q__num text, .k-page.review .perm__num text { color:var(--k-paper); }
/* 3 推荐不可用：出错块按组里的出错 / 空状态规矩 —— 一颗 248 × 44 主按钮（和写评论出错页、技能匹配空状态一套），另外两个出口是 13 / 500 暖棕文字按钮 */
.k-page.review .unavail__btns { width:248px;gap:0 24px;margin-top:24px; }
.k-page.review .unavail__btns :deep(.k-button.is-primary) { flex:0 0 100%;width:248px;height:44px;margin:0 0 8px;padding:0;border:0;border-radius:22px;background:var(--k-grad-brown);box-shadow:none;color:var(--k-paper);font-size:15px;font-weight:600;line-height:44px; }
.k-page.review .unavail__btns :deep(.k-button.is-secondary) { height:36px;padding:0 4px;font-size:13px; }
/* 4 页签下面不画通栏线（和经历列表、评价管理的页签一样） */
.k-page.review .k-tabs { border-bottom:0;box-shadow:none; }
/* ===================================================================================================
   11-19 微信实拍返修（只动样子）
   =================================================================================================== */
/* 1 助手头像收到 36 正圆、外圈 0.5 发丝线（素描图自带的圆底看着是有意的），顶和气泡顶对齐、尾巴对准头像中线 */
.k-page.review .ai__avatar { width:36px;height:36px;border:0;border-radius:50%;background:var(--k-paper);box-shadow:0 0 0 .5px var(--k-line2); }
/* 评价预览标题：「评价预览」15 / 600 墨色 + 说明 12 / 400 灰（字不变，拆成两段）；图标换 16 号灰色文稿，不再是和打分同形的实心星 */
.k-page.review .polish__title { font-size:15px;font-weight:600;line-height:21px;color:var(--k-ink);white-space:nowrap; }
.k-page.review .polish__sub { margin-left:-4px;font-size:12px;font-weight:400;line-height:18px;color:var(--k-muted);white-space:nowrap; }
/* 底部「提交评价」条：白底 + 顶部发丝线（和到店路线底栏一套），问卷滚到条后面不再一刀切 */
.k-page.review .ai :deep(.k-bottom) { background:var(--k-paper);border-top-color:transparent;box-shadow:0 -.5px 0 var(--k-line2); }
@media (max-width:359px) {
  .k-page.review .polish__title { font-size:14px;line-height:20px; }
  .k-page.review .polish__sub { font-size:11px; }
}
</style>
