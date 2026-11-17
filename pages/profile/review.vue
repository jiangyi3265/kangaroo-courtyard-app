<template>
  <!-- #ifdef MP-WEIXIN -->
  <page-meta :page-style="aiOpen ? 'overflow: hidden' : ''" />
  <!-- page-meta 必须是页面第一个节点：AI袋鼠弹层开着时锁住页面滚动（网页版由弹层自己锁 body） -->
  <!-- #endif -->
  <view class="k-page review">
    <k-topbar :title="titles[s - 1]" back custom-back @back="onBack">
      <view v-if="s === 4" class="k-tabs">
        <view v-for="t in errTabs" :key="t.key" class="k-tabs__item err-tab" :class="{ active: errTab === t.key }" @click="errTab = t.key"><text>{{ t.label }}</text></view>
      </view>
    </k-topbar>

    <!-- 1 AI 引导式评价 -->
    <view v-if="s === 1" class="ai k-pad-bottom">
      <text class="ai__progress">评价进度 {{ progress }}/{{ questions.length }}</text>
      <view class="ai__hello">
        <image class="ai__avatar" src="/static/media/review-kangaroo.jpg" mode="aspectFill" />
        <view class="bubble">
          <view class="bubble__tail" />
          <text class="bubble__hi">HI，我是小院评价助手</text>
          <text class="bubble__copy">{{ bubbleCopy }}</text>
        </view>
      </view>
      <view v-for="(q, i) in questions" :key="q.title" class="q">
        <view class="q__head"><view class="q__num"><text>{{ i + 1 }}</text></view><text class="q__title">{{ q.title }}</text></view>
        <view class="q__stars">
          <view v-for="n in 5" :key="n" class="q__star" @click="setStar(q, n)"><k-icon name="star" :size="24" color="#C99043" :stroke="1.6" :fill="n <= q.stars" /></view>
          <text class="q__level">{{ q.label }}</text>
        </view>
        <view class="q__box">
          <!-- 原生 textarea 画在页面最上层，滑到底部「提交评价」下面会抢走点击；不在输入时只显示同样的文字，点一下才换成真输入框 -->
          <textarea v-if="editingIdx === i" v-model="q.text" class="q__area" auto-height :maxlength="200" placeholder="说说你的真实感受" placeholder-class="k-placeholder" :focus="true" auto-focus @blur="q.text = $event.detail.value; onAreaBlur(i)" />
          <view v-else class="q__area review-area-idle" @click="editingIdx = i"><text :class="{ 'k-placeholder': !q.text }">{{ q.text || '说说你的真实感受' }}</text></view>
          <text class="q__counter">{{ q.text.length }}/200</text>
        </view>
      </view>
      <!-- 2026-10-17 改版 R2：住宿评价可以晒照片（选填，最多 9 张），显示在小院「住过的家人评价」里；岗位和住宿评价均可使用 -->
      <view v-if="canPhoto" class="pics">
        <view class="pics__head"><text class="pics__title">晒晒小院照片</text><text class="pics__hint">选填 · {{ reviewPics.length }}/{{ PIC_MAX }}</text></view>
        <view class="pics__grid">
          <view v-for="(pic, picIdx) in reviewPics" :key="pic.url" class="pics__cell">
            <image class="pics__img" :src="pic.img" mode="aspectFill" @click="previewPic(picIdx)" />
            <view class="pics__del" @click.stop="removePic(picIdx)"><k-icon name="x" :size="12" color="white" :stroke="2.4" /></view>
          </view>
          <view v-if="reviewPics.length < PIC_MAX" class="pics__cell pics__add" hover-class="k-press-s" @click="addPics"><view class="pics__add-in"><k-icon name="image-plus" :size="24" color="#8A5E36" :stroke="1.6" /><text class="pics__add-text">添加照片</text></view></view>
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
            <view class="pics__del" @click.stop="removeVideo"><k-icon name="x" :size="12" color="white" :stroke="2.4" /></view>
          </view>
          <view v-else class="pics__cell pics__add" hover-class="k-press-s" @click="addVideo"><view class="pics__add-in"><k-icon name="video" :size="24" color="#8A5E36" :stroke="1.6" /><text class="pics__add-text">{{ videoUploading ? '上传中' : '添加视频' }}</text></view></view>
        </view>
      </view>
      <view class="polish">
        <view class="k-row k-gap4"><k-icon name="star" :size="14" color="green" :stroke="1.6" fill /><text class="polish__title">评价预览（原文合并，不做改写）</text></view>
        <view class="polish__chip"><text>{{ previewChip }}</text></view>
      </view>
      <view class="polish__box"><text class="polish__text">{{ preview }}</text></view>
      <text class="ai__note">以上评价将匿名展示，感谢你的真实分享！</text>
      <k-bottom flat pad="8px 16px 4px"><k-button block :disabled="submitting" :label="submitting ? '提交中…' : '提交评价'" @click="submitReview" /></k-bottom>
    </view>

    <!-- 2 到店路线 -->
    <view v-else-if="s === 2" class="k-body k-pad-bottom route">
      <view class="shop">
        <image class="shop__img" :src="shopImg" mode="aspectFill" />
        <view class="k-flex1">
          <text class="shop__title">{{ shopTitle }}</text>
          <view v-if="shopPrice" class="k-row k-gap4 k-mt4"><text class="k-price">{{ shopPrice }}</text><text class="k-meta">{{ shopUnit }}</text></view>
          <text class="shop__addr">{{ shopAddr }}</text>
          <text class="shop__addr">{{ shopSub }}</text>
        </view>
        <view class="shop__call" @click="call">
          <view class="k-circle k-circle--outline shop__phone"><k-icon name="phone" :size="16" color="ink" :stroke="1.6" /></view>
          <text class="k-meta">联系商家</text>
        </view>
      </view>
      <!-- #ifdef MP-WEIXIN -->
      <!-- 店名气泡最像按钮，也要能点开导航；关掉地图自带地名，免得点到别家名字没反应 -->
      <map v-if="hasCoord" class="map" :latitude="mapLat" :longitude="mapLng" :scale="15" :markers="markers" :enable-scroll="false" :enable-zoom="false" :enable-poi="false" @tap="openMap" @markertap="openMap" @callouttap="openMap" />
      <!-- #endif -->
      <view class="modes">
        <view v-for="m in modes" :key="m" class="mode" :class="{ active: mode === m }" @click="mode = m"><text>{{ m }}</text></view>
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
              <k-icon v-else :name="st.icon" :size="14" color="muted" :stroke="1.6" />
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
        <view class="search__box"><k-icon name="search" :size="18" color="muted" :stroke="1.8" /><input v-model="keyword" :confirm-type="'search'" placeholder="搜索城市 / 区域 / 房源 / 店铺" placeholder-class="k-placeholder" @confirm="searchStays" /></view>
        <view class="search__filter" @click="go(R.jobsFilter)">
          <k-icon name="sliders-horizontal" :size="16" color="ink" :stroke="1.8" /><text>筛选</text>
          <view v-if="false" class="search__badge"><text>2</text></view>
        </view>
      </view>
      <view class="filters">
        <view v-for="f in ['位置', '类型', '价格', '更多']" :key="f" class="filter" @click="searchStays"><text>{{ f }}</text><k-icon name="chevron-down" :size="14" color="ink" :stroke="1.8" /></view>
      </view>
      <view class="unavail">
        <image class="unavail__img" src="/static/media/review-robot.jpg" mode="aspectFit" />
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
        <image v-if="errTab === 'location'" class="perm__img" src="/static/media/review-pin.jpg" mode="aspectFit" />
        <view v-else class="perm__icon" :class="'is-' + current.tone"><k-icon :name="current.icon" :size="46" :color="current.tone" :stroke="1.4" /></view>
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
          <text class="k-small perm__help-link">联系客服</text>
          <k-icon name="headset" :size="16" color="muted" :stroke="1.6" />
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
  ? [{ id: 1, latitude: mapLat.value, longitude: mapLng.value, iconPath: '/static/media/map-marker.png', width: 32, height: 32, callout: { content: rt.value.title, display: 'ALWAYS', padding: 6, borderRadius: 6 } }]
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
.q__num { width: 16px; height: 16px; border-radius: 50%; background: var(--k-green); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
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
.polish__chip { height: 18px; padding: 0 6px; border-radius: 4px; background: var(--k-green); color: #fff; font-size: 10px; display: flex; align-items: center; }
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
.vids__ph { background: #3A322B; }
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
.mode.active { background: var(--k-red); color: #fff; font-weight: 600; }
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
.search__badge { position: absolute; right: -6px; top: -6px; width: 16px; height: 16px; border-radius: 50%; background: var(--k-red); color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; }
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
</style>
