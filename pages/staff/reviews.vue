<template>
  <view class="k-page reviews-page">
    <template v-if="s===1">
      <k-topbar title="评价管理" back />
      <view class="review-list k-pad-tab"><view class="review-tabs"><text :class="{ active: tab === 'all' }" @click="setTab('all')">全部 {{ counts.total || 0 }}</text><text :class="{ active: tab === 'pending' }" @click="setTab('pending')">待回复 {{ counts.pending || 0 }}</text><text :class="{ active: tab === 'low' }" @click="setTab('low')">低分 {{ counts.low || 0 }}</text><text :class="{ active: tab === 'featured' }" @click="setTab('featured')">已精选 {{ counts.featured || 0 }}</text></view><view class="review-filters"><button @click="pickSrc"><text>{{ srcText }}</text><k-icon name="chevron-down" :size="12" color="muted" /></button><button @click="pickStars"><text>{{ starsText }}</text><k-icon name="chevron-down" :size="12" color="muted" /></button><button @click="pickDays"><text>{{ daysText }}</text><k-icon name="chevron-down" :size="12" color="muted" /></button><button @click="pickFilter"><k-icon name="list-filter" :size="14" color="ink2" /><text>{{ filter ? '有图' : '筛选' }}</text></button></view><view class="latest"><text>最新评价</text><text @click="batch">批量操作</text></view>
        <view v-for="(r,i) in reviews" :key="r.reviewId" class="review-card" @click="open(r)"><view class="source-line"><view class="source-dot" :class="r.sourceTone"><k-icon :name="r.sourceIcon" :size="11" color="ink2" /></view><text>{{r.source}}</text><text>{{r.date}}</text></view><view class="user-line"><image :src="r.avatar" mode="aspectFill" /><text>{{r.name}}</text><view class="stars"><text v-for="n in 5" :key="n" :class="{off:n>r.stars}">★</text></view><text>{{r.score}}</text></view><text class="content">{{r.content}}</text><view v-if="r.images || r.videos" class="review-images"><view v-for="vid in (r.videos || [])" :key="vid.url" class="review-video" @click.stop="playReviewVideo(vid)"><image v-if="vid.cover" :src="vid.cover" mode="aspectFill" /><view class="review-video__play"><k-icon name="play" :size="12" color="white" fill /></view></view><image v-for="img in (r.images || [])" :key="img" :src="img" mode="aspectFill" /></view><view class="ai-tags"><text v-if="r.low" class="low">低分</text><text>{{r.sentiment}}</text><text v-if="r.tags && r.tags.length" class="label">关键词</text><text v-for="t in r.tags" :key="t">{{t}}</text></view><view class="review-foot"><text v-if="r.views != null">浏览 {{r.views}}</text><text>回复 {{r.reply}}</text><text v-if="r.likes != null">点赞 {{r.likes}}</text><text :class="r.stateTone">{{r.state}}</text></view></view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===2">
      <k-topbar title="评价详情" back custom-back @back="s=1" />
      <view class="detail k-pad-tab"><view class="original"><text class="section-title">原评价</text><view class="detail-user"><image :src="detailAvatar" mode="aspectFill" /><view><text>{{ dd.name }}　 <text>{{ ff.verified ? '已核验履约' : '' }}</text></text><view class="stars"><text v-for="n in 5" :key="n" :class="{ off: n > dd.stars }">★</text><text class="score">{{ dd.score }}</text></view></view><text>{{ dd.time }}</text></view><text class="detail-content">{{ dd.hiddenByPlatform ? '（平台已判定违规并隐藏，不再公开）' : (dd.hiddenForReview ? '（待平台复核，暂不公开）' : '') }}{{ dd.content || '（只打了分，没有写文字）' }}</text><view v-if="detailImages.length" class="detail-images"><image v-for="(img, ii) in detailImages.slice(0, 2)" :key="img" :src="img" mode="aspectFill" @click="preview(ii)" /><view @click="preview(0)"><text>共 {{ detailImages.length }} 张</text></view></view><view v-if="detailVideos.length" class="detail-videos"><view v-for="vid in detailVideos" :key="vid.url" class="detail-video" @click="playReviewVideo(vid)"><image v-if="vid.cover" :src="vid.cover" mode="aspectFill" /><view class="review-video__play detail-video__play"><k-icon name="play" :size="18" color="white" fill /></view><text class="detail-video__tag">评价视频</text></view></view></view>
        <view class="detail-card"><view class="card-title"><text>关联订单</text><view class="card-link" hover-class="k-press" @click="openOrder"><text>查看订单</text><k-icon name="chevron-right" :size="12" color="muted" /></view></view><view class="order"><view class="order-icon"><k-icon name="hand" :size="18" color="ink" /></view><text>{{ ff.title || '—' }}</text><text v-if="ff.status">{{ ff.status }}</text></view><view class="order-info"><text>{{ ff.no || '—' }}</text><text>履约时间　{{ ff.period || '—' }}</text><text>{{ ff.placeLabel || '地点' }}　{{ ff.place || '—' }}</text></view><view class="fulfill"><text>真实履约标记</text><view><k-icon :name="ff.verified ? 'circle-check' : 'circle-alert'" :size="16" :color="ff.verified ? 'green' : 'muted'" /><text>{{ ff.verified ? '已核验为真实履约评价　核验时间 ' + ff.verifiedTime : '系统没有找到履约记录' }}</text></view><view class="records"><text v-if="ev[0]">{{ ev[0] }}</text><text v-if="ev[1]">{{ ev[1] }}</text><text v-if="ev[2]">{{ ev[2] }}</text></view><text>核验方式　{{ ff.method }}</text></view></view>
        <view class="detail-card public"><text class="section-title">用户公开信息</text><view><k-icon name="map-pin" :size="14" color="muted" /><text>{{ pubText }}</text><button v-if="false"><text>关注</text></button></view></view>
        <view class="dual"><view><text class="section-title">举报与风险</text><text class="safe">● {{ dd.reports ? '被举报 ' + dd.reports + ' 次' : '未被举报' }}</text><text>风险等级　 <text class="tag-soft">{{ dd.risk || '低风险' }}</text></text><text v-if="dd.reportResult" class="report-result">本店提请：{{ dd.reportResult }}</text></view><view><text class="section-title">内部备注</text><view class="note" @click="editNote"><text>{{ dd.internalNote || '添加备注（仅内部可见）' }}</text><text>{{ (dd.internalNote || '').length }}/200</text></view></view></view>
        <view class="detail-actions"><button @click="more"><k-icon name="ellipsis" :size="16" color="ink" /><text>更多操作</text></button><button @click="toFeature"><k-icon name="star" :size="16" color="ink" /><text>{{ dd.featured ? '已精选' : '标记精选' }}</text></button><button @click="openReply"><text>{{ dd.reply ? '修改回复' : '回复评价' }}</text></button></view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else-if="s===3">
      <k-topbar :title="'回复草稿'" back custom-back @back="s=2" />
      <view class="reply-page k-pad-tab"><view v-if="showWarn" class="ai-warning"><k-icon name="circle-alert" :size="16" color="ochre" /><text>草稿来自回复模板库（非 AI），请核对修改后再发布</text><k-icon name="x" :size="16" color="muted" @click="showWarn = false" /></view><view class="reply-card"><view class="card-title"><text>基于评价生成的回复（可编辑）</text><text @click="reroll">换一换</text></view><text class="tone-label">语气选择</text><view class="tones"><text class="active" :style="tone === '温和' ? '' : neutralTone" @click="setTone('温和')">温和</text><text :class="{ active: tone === '真诚' }" @click="setTone('真诚')">真诚</text><text :class="{ active: tone === '专业' }" @click="setTone('专业')">专业</text><text :class="{ active: tone === '活泼' }" @click="setTone('活泼')">活泼</text></view><!-- 2026-11-03 主人：简化回复草稿——直接在页面里的文本框改（最多 500 字，右下角计数），不再弹系统输入框；「AI 优化」去掉（点了只说要配置模型） -->
        <view class="reply-text"><textarea v-model="draft" class="reply-area" :maxlength="500" :placeholder="drafting ? '生成中…' : '回复内容，可直接输入表情'" placeholder-class="reply-ph" aria-label="回复内容" /><text class="reply-count">{{ draft.length }}/500</text></view><view class="reply-tools"><text @click="pickPhrase">☑ 插入快捷语</text></view></view>
        <view class="basis"><text class="section-title">生成依据（仅供参考）</text><text>{{ basis[0] || '' }}</text><text>{{ basis[1] || '' }}</text><text>{{ basis[2] || '' }}</text><text>{{ basis[3] || '' }}</text></view><view class="suggest"><text class="section-title">建议补充（可选）</text><view><text @click="appendSuggest(0)">活动推荐</text><text @click="appendSuggest(1)">课程上新</text><text @click="appendSuggest(2)">优惠福利</text><text @click="appendSuggest(3)">到店指引</text></view></view><view class="publish-tip"><k-icon name="lightbulb" :size="16" color="ochre" /><text>发布前请人工确认，内容需真实、合规、友善</text></view><view class="reply-actions"><button @click="previewReply"><text>预览效果</text></button><button @click="publishReply"><text>提交发布</text></button></view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
    <template v-else>
      <k-topbar title="精选标记" back custom-back @back="s=2" />
      <view class="feature-page k-pad-tab"><view class="preview-card"><view class="card-title"><text>精选展示预览</text><text>实际展示以线上为准</text></view><view class="preview-tabs"><text class="active" :style="previewTab === 'community' ? '' : neutralTab" @click="previewTab = 'community'">社区动态</text><text :class="{ active: previewTab === 'store' }" @click="previewTab = 'store'">商家主页</text></view><view class="community-card"><view class="detail-user"><image :src="detailAvatar" mode="aspectFill" /><view><text>{{ dd.name }}　 <text>{{ ff.verified ? '已核验履约' : '' }}</text></text><view class="stars"><text v-for="n in 5" :key="n" :class="{ off: n > dd.stars }">★</text><text class="score">{{ dd.score }}</text></view></view><text class="featured">♕ 精选</text></view><text class="detail-content">{{ dd.content || '（只打了分，没有写文字）' }}</text><view v-if="detailImages.length" class="detail-images"><image v-for="(img, ii) in detailImages.slice(0, 2)" :key="img" :src="img" mode="aspectFill" @click="preview(ii)" /><view @click="preview(0)"><text>共 {{ detailImages.length }} 张</text></view></view><view class="community-foot"><text>{{ previewTab === 'store' ? '门店主页 · 评价' : '☕ ' + (dd.source || '社区动态') }}</text><text>{{ previewTab === 'store' ? (dd.featured ? '精选置顶中' : '标记后排在最前') : (dd.featured ? '展示中' : '') }}</text></view></view></view>
        <view class="reason-card"><text class="section-title">选择精选理由（可多选）</text><view class="reason-grid"><view v-for="(r,i) in reasons" :key="r" @click="toggleReason(r)"><view class="box" :class="{checked: picked.includes(r)}"><k-icon v-if="picked.includes(r)" name="check" :size="14" color="white" /></view><text>{{r}}</text></view></view></view>
        <view class="reward"><view><text class="section-title">积分奖励</text><text>{{ rewardDesc }}</text></view><button @click="reward"><text>{{ rewardBtn }}</text></button></view>
        <view class="record"><text class="section-title">操作记录</text><view><text>操作者</text><text>{{ dd.featuredBy || '—' }}</text></view><view><text>操作时间</text><text>{{ dd.featuredTime || '—' }}</text></view><view><text>备注</text><view @click="editFeatureNote"><text>{{ featureNote || '添加备注（可选）' }}</text><text>{{ featureNote.length }}/200</text></view></view></view><view class="feature-actions"><button @click="saveFeature(false)"><text>取消精选</text></button><button @click="saveFeature(true)"><text>标记精选</text></button></view>
      </view><k-tabbar mode="staff" active="work" />
    </template>
  </view>
</template>

<script setup>
// ---------------------------------------------------------------------------
// 评价运营（员工端）接入情况：
//   s=1 本店评价列表：全部 / 待回复 / 低分 / 已精选 + 来源、评分、时间、有图筛选；倾向按分数派生（不是 AI），昵称脱敏
//   s=2 评价详情：关联订单与真实履约核验（只列系统里真实存在的记录）、用户公开信息、举报与风险、内部备注
//   s=3 回复草稿：回复模板库（非 AI）按语气生成，员工编辑确认后发布，发布后通知评价人
//   s=4 精选：选择理由后标记 / 取消精选（主理人、管家），精选评价会优先展示在门店页
// ---------------------------------------------------------------------------
import { ref, computed, watch } from 'vue'
import { useScreen, go, toast } from '@/common/screen.js'
import { apiStaffReviews, apiStaffReview, apiStaffReviewNote, apiStaffReviewDraft, apiStaffReviewReply, apiStaffReviewFeature, apiStaffReviewReport } from '@/common/api.js'
import { ensureSession, currentStaffStoreId } from '@/common/experience.js'
import { sheet, prompt, alert, copy, errText } from '@/common/ui.js'
import { absUrl } from '@/common/upload.js'
// 评价视频的预览（2026-10-17 R3）：员工分包里的一份，不进主包
import { previewVideo } from './stay-video.js'

let booting = true
// 主理人从经营看板点进来会带 ?storeId=，看的是那家门店的评价；保持字符串，不转 Number（大号 ID 会丢精度）
let viewStoreId = null
const s = useScreen(4, {
  onLoad: async (q) => {
    await ensureSession()
    if (q?.storeId) viewStoreId = q.storeId
    if (Number(q?.reviewId)) await open({ reviewId: Number(q.reviewId) })
    // 评价打不开（已删除 / 不属于当前门店）时之前停在没加载过的列表上，显示「暂无评价」；现在照常加载列表
    if (s.value === 1) await load()
    booting = false
  }
})
watch(s, (v) => { if (!booting && v === 1) load() })

// ---------------- s=1 ----------------
const tab = ref('all')
const src = ref('')
const stars = ref('')
const days = ref('')
const filter = ref('')
const data = ref({ counts: {}, rows: [] })
async function load() {
  try {
    // 只有列表按门店查；详情、备注、回复、精选、提请平台都按评价自己所属门店校验，不需要再带 storeId
    data.value = (await apiStaffReviews({ storeId: viewStoreId || currentStaffStoreId() || undefined, tab: tab.value, source: src.value || undefined, stars: stars.value || undefined,
      days: days.value || undefined, filter: filter.value || undefined })).data || data.value
  } catch (e) {
    toast(errText(e, '评价加载失败'))
  }
}
const counts = computed(() => data.value.counts || {})
const setTab = (t) => { tab.value = t; load() }
const SRC = [['', '全部来源'], ['job', '岗位'], ['stay', '住宿'], ['activity', '活动'], ['online', '线上任务']]
const STARS = [['', '全部评分'], ['5', '5星'], ['4', '4星'], ['3', '3星'], ['2', '2星及以下']]
const DAYS = [['', '全部时间'], ['7', '近7天'], ['30', '近30天'], ['90', '近90天']]
const label = (list, v) => (list.find(x => x[0] === v) || list[0])[1]
const srcText = computed(() => label(SRC, src.value))
const starsText = computed(() => label(STARS, stars.value))
const daysText = computed(() => label(DAYS, days.value))
async function pick(list, target) {
  const i = await sheet(list.map(x => x[1]))
  if (i < 0) return
  target.value = list[i][0]
  load()
}
const pickSrc = () => pick(SRC, src)
const pickStars = () => pick(STARS, stars)
const pickDays = () => pick(DAYS, days)
async function pickFilter() {
  const i = await sheet(['只看有图', '清除筛选'])
  if (i < 0) return
  filter.value = i === 0 ? 'images' : ''
  if (i === 1) { src.value = ''; stars.value = ''; days.value = '' }
  load()
}
const batch = () => alert('批量操作', '批量回复、批量精选请在管理后台进行，小程序里逐条处理更不容易出错。')
const DEFAULT_AVATAR = '/static/media/profile-avatar.jpg'
// 评价没有浏览数、点赞数（kg_review 里没有这两项数据，接口也不返回），卡片底部只在接口给了值时才显示，不再显示空的「浏览」「点赞」
const reviews = computed(() => {
  const rows = (data.value.rows || []).map(r => ({ ...r, avatar: r.avatar ? absUrl(r.avatar) : DEFAULT_AVATAR, images: r.images ? r.images.map(absUrl) : null, videos: mediaVideos(r.videos) }))
  return rows.length ? rows : [{ reviewId: 0, source: '暂无评价', sourceTone: 'green', sourceIcon: 'message-square', date: '', avatar: DEFAULT_AVATAR, name: '—', stars: 0, score: '',
    content: '岗位、住宿、活动完成后，客人与伙伴写的评价会出现在这里。', images: null, sentiment: '—', tags: [], reply: 0, state: '', stateTone: '' }]
})

// ---------------- s=2 详情 ----------------
const d = ref(null)
async function open(r) {
  if (!r.reviewId) return
  try {
    d.value = (await apiStaffReview(r.reviewId)).data
    picked.value = [...(d.value.featureReasons || [])]
    featureNote.value = d.value.featureNote || ''
    s.value = 2
  } catch (e) {
    toast(errText(e, '评价不存在'))
  }
}
const dd = computed(() => d.value || { images: [], fulfillment: { evidence: [] }, publicInfo: {} })
const detailAvatar = computed(() => (dd.value.avatar ? absUrl(dd.value.avatar) : DEFAULT_AVATAR))
const detailImages = computed(() => (dd.value.images || []).map(absUrl))
// 2026-10-17 R3：住客评价可以附 1 段视频（[{url, cover}]），列表放带播放标记的缩略图，详情里满宽一格，点了全屏播放
function mediaVideos(list) {
  const out = (list || []).filter(v => v && v.url).map(v => ({ url: absUrl(v.url), cover: v.cover ? absUrl(v.cover) : '' }))
  return out.length ? out : null
}
const detailVideos = computed(() => mediaVideos(dd.value.videos) || [])
const playReviewVideo = (v) => previewVideo(v.url, v.cover)
const ff = computed(() => dd.value.fulfillment || { evidence: [] })
const ev = computed(() => ff.value.evidence || [])
const pub = computed(() => dd.value.publicInfo || {})
const pubText = computed(() => `${pub.value.city || '—'}　　注册 ${pub.value.registered || '—'}　　评价 ${pub.value.reviews || 0} 条 · 获赞 ${pub.value.likes || 0}`)
const preview = (i) => uni.previewImage({ urls: detailImages.value, current: detailImages.value[i] })
const openOrder = () => (ff.value.link ? go(ff.value.link) : toast('没有关联的订单'))
// 备注 / 提请平台 / 回复 / 精选都是写请求：网络慢时连点会重复提交（回复会重复通知评价人）
let busy = false
const once = async (fn) => {
  if (busy) return
  busy = true
  try { return await fn() } finally { busy = false }
}
async function editNote() {
  const v = await prompt('内部备注（仅门店员工可见，200 字内）', { value: dd.value.internalNote || '' })
  if (v === null) return
  const note = v.trim()
  if (note.length > 200) return toast('备注最多 200 字')
  await once(async () => {
    try {
      await apiStaffReviewNote(dd.value.reviewId, note)
      d.value = { ...d.value, internalNote: note }
      toast('已保存')
    } catch (e) {
      toast(errText(e, '保存失败'))
    }
  })
}
async function more() {
  const i = await sheet(['提请平台处理', '复制评价内容'])
  if (i === 1) return copy(dd.value.content || '', '已复制评价内容')
  if (i !== 0) return
  const reason = await prompt('需要平台处理的原因', { placeholder: '例如：恶意差评、与事实不符' })
  if (!reason) return
  await once(async () => {
    try {
      { const res = await apiStaffReviewReport(dd.value.reviewId, reason.trim()); toast(res.msg || (typeof res.data === 'string' ? res.data : '') || '已提交') }
    } catch (e) {
      toast(errText(e, '提交失败'))
    }
  })
}
const toFeature = () => { if (!dd.value.canFeature) return toast('当前角色没有精选评价权限'); s.value = 4 }

// ---------------- s=3 回复 ----------------
const TONES = ['温和', '真诚', '专业', '活泼']
const tone = ref('温和')
const seed = ref(0)
const draft = ref('')
const basis = ref([])
const showWarn = ref(true)
const neutralTone = 'border-color: var(--k-line2); color: var(--k-ink)'
// 草稿还在生成时文本框空着，占位文字写「生成中…」
const drafting = ref(false)
async function loadDraft() {
  drafting.value = true
  try {
    const res = (await apiStaffReviewDraft(dd.value.reviewId, tone.value, seed.value)).data
    // 文本框最多 500 字，生成的草稿也截到 500，右下角计数才不会一打开就超
    draft.value = String(res.text || '').slice(0, 500)
    basis.value = res.basis || []
  } catch (e) {
    toast(errText(e, '草稿生成失败'))
  } finally {
    drafting.value = false
  }
}
async function openReply() {
  s.value = 3
  if (dd.value.reply) {
    draft.value = dd.value.reply
    await loadDraft().then(() => { draft.value = dd.value.reply })
  } else {
    await loadDraft()
  }
}
const setTone = (t) => { tone.value = t; loadDraft() }
const reroll = () => { seed.value += 1; loadDraft() }
// 2026-11-03 主人：简化——回复内容直接在页面文本框里改（v-model="draft"，maxlength 500），原来点一下弹系统输入框的 editDraft 和只会说「需要配置模型服务」的 AI 优化按钮都去掉了
const PHRASES = ['欢迎下次再来～', '有任何问题可以在消息里联系我们。', '已把你的建议转给店长。', '期待与你再次相遇！', '祝你旅途愉快！', '感谢你的耐心与理解。']
async function pickPhrase() {
  const i = await sheet(PHRASES)
  if (i >= 0) draft.value = (draft.value + '\n' + PHRASES[i]).slice(0, 500)
}
const SUGGEST = ['近期有新的活动，欢迎关注门店动态参加～', '门店课程有上新，下次可以体验看看。', '关注门店可以第一时间收到优惠与福利通知。', '到店可以在消息里联系我们，我们会提前告诉你路线。']
const appendSuggest = (i) => { draft.value = (draft.value + '\n' + SUGGEST[i]).slice(0, 500) }
const previewReply = () => alert('回复预览', draft.value || '（空）')
async function publishReply() {
  if (!draft.value.trim()) return toast('回复内容不能为空')
  await once(async () => {
    try {
      d.value = (await apiStaffReviewReply(dd.value.reviewId, draft.value.trim())).data
      toast('回复已发布')
      s.value = 2
    } catch (e) {
      toast(errText(e, '发布失败'))
    }
  })
}

// ---------------- s=4 精选 ----------------
const reasons = ['内容真实有价值', '具有代表性', '帮助其他用户决策', '图文优质美观']
// 精选预览两个页签：精选评价实际排在门店主页评价列表的最前面，「商家主页」页签按这个展示（原先只是一个点不动的字）
const previewTab = ref('community')
const neutralTab = 'color: var(--k-ink); border-bottom: 0'
const picked = ref([])
const featureNote = ref('')
const toggleReason = (r) => { picked.value = picked.value.includes(r) ? picked.value.filter(x => x !== r) : [...picked.value, r] }
// 设为精选不发积分：门店自己挑评价再给作者奖励，就是以利益换好评（设计 PLAN B10 / P11），积分奖励暂未开放
const rewardDesc = '设为精选不会给作者发放积分，积分奖励暂未开放'
const rewardBtn = '暂未开放'
const reward = () => uni.showModal({
  title: '积分奖励',
  content: '为避免"以奖励换好评"，把评价设为精选不会给评价作者发放积分；积分奖励开放前会另行通知。',
  showCancel: false
})
async function editFeatureNote() {
  const v = await prompt('精选备注（选填，200 字内）', { value: featureNote.value })
  if (v !== null) featureNote.value = v.trim().slice(0, 200)
}
async function saveFeature(on) {
  if (on && !picked.value.length) return toast('请至少选择一条精选理由')
  await once(async () => {
    try {
      d.value = (await apiStaffReviewFeature(dd.value.reviewId, { featured: on, reasons: picked.value, note: featureNote.value })).data
      toast(on ? '已标记精选' : '已取消精选')
      s.value = 2
    } catch (e) {
      toast(errText(e, '操作失败'))
    }
  })
}
</script>

<style scoped lang="scss">
/* 2026-11-17 改版「小而精」：浅灰底 + 白卡（12 圆角、不描边、不加阴影），页边距 12、卡片之间 8；正文 13、辅助 11–12、小标签 10（原来整页是 10–11 的小字加描边框）。
   页签、筛选是白色的条和胶囊；评价卡里的情绪 / 关键词、订单状态都是 17 高的小标签；底部三个按钮是 40 高的胶囊，最后一个是暖棕主按钮，贴着 50 高的底栏。功能和文字都没动 */
.reviews-page{--k-bg:#F7F5F2;--k-sh1:none;background:var(--k-bg)}.reviews-page :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}button{margin:0;padding:0;border:0;background:transparent}.review-list{padding:8px 12px calc(88px + var(--k-safe-bottom))}.review-tabs{height:40px;border-radius:12px;background:var(--k-paper);display:flex}.review-tabs text{position:relative;flex:1;display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--k-ink2)}.review-tabs .active{color:var(--k-red-deep);font-weight:600}.review-tabs .active:after{content:'';position:absolute;bottom:4px;width:18px;height:2px;border-radius:1px;background:var(--k-red)}.review-filters{height:44px;display:flex;gap:6px;align-items:center}.review-filters button{height:28px;flex:1;min-width:0;border-radius:999px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;gap:3px;font-size:12px;color:var(--k-ink2)}.review-filters button:last-child{flex:.75}.latest{height:30px;padding:0 2px;display:flex;align-items:center;justify-content:space-between;font-family:var(--k-sans);font-size:14px;font-weight:600}.latest text:last-child{color:var(--k-red-deep);font-size:12px;font-weight:400}.review-card{margin-bottom:8px;padding:12px;border-radius:12px;background:var(--k-paper)}.source-line{display:flex;align-items:center;gap:6px;color:var(--k-muted);font-size:11px}.source-line>text:nth-child(2){flex:1}.source-dot{width:17px;height:17px;border-radius:4px;display:flex;align-items:center;justify-content:center;background:var(--k-green)}.source-dot.blue{background:var(--k-indigo)}.source-dot.red{background:var(--k-red)}.user-line{height:40px;display:flex;align-items:center;gap:8px}.user-line image{width:32px;height:32px;border-radius:50%;background:var(--k-paper2)}.user-line>text:nth-child(2){font-family:var(--k-sans);font-size:14px;font-weight:600}.stars{display:flex;align-items:center;gap:1px;color:var(--k-ochre);font-size:12px}.stars .off{color:#DDD6CC}.user-line>text:last-child{color:var(--k-muted);font-size:11px}.content{display:block;margin-left:40px;font-size:13px;line-height:1.6;color:var(--k-ink2)}.review-images{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0 40px}.review-images image{width:76px;height:56px;border-radius:8px}.ai-tags{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin-top:8px;font-size:10px;color:var(--k-muted)}.ai-tags text{height:17px;padding:0 5px;border-radius:4px;background:var(--k-green-soft);color:var(--k-green);font-weight:500;line-height:17px}.ai-tags .label{padding:0;background:transparent;color:var(--k-muted);font-weight:400}.ai-tags .low{background:var(--k-alert-soft);color:var(--k-alert)}.review-foot{min-height:26px;margin-top:8px;padding-top:8px;border-top:1px solid var(--k-line);display:flex;align-items:center;gap:16px;color:var(--k-muted);font-size:11px}.review-foot text:last-child{margin-left:auto;height:17px;padding:0 5px;border-radius:4px;background:#F5F1EB;font-size:10px;font-weight:500;line-height:17px}.green-text{color:var(--k-green)}.blue-text{color:var(--k-indigo)}.amber-text{color:var(--k-ochre-deep)}
.detail,.reply-page,.feature-page{padding:8px 12px calc(140px + var(--k-safe-bottom))}.original,.detail-card,.dual>view,.reply-card,.basis,.suggest,.preview-card,.reason-card,.reward,.record{border-radius:12px;background:var(--k-paper);padding:12px}.section-title{display:block;font-family:var(--k-sans);font-size:15px;font-weight:700;line-height:22px}.detail-user{display:flex;align-items:center;gap:10px;margin-top:8px}.detail-user image{width:40px;height:40px;border-radius:50%;background:var(--k-paper2)}.detail-user>view{min-width:0;flex:1}.detail-user>view>text:first-child{font-family:var(--k-sans);font-size:14px;font-weight:600}.detail-user>view>text:first-child text{font-family:var(--k-sans);font-size:11px;color:var(--k-muted);font-weight:400}.detail-user>text:last-child{color:var(--k-muted);font-size:11px}.score{margin-left:6px;color:var(--k-muted);font-size:11px}.detail-content{display:block;margin-top:8px;font-size:13px;line-height:1.7;color:var(--k-ink2)}.detail-images{display:flex;gap:6px;margin-top:8px}.detail-images image,.detail-images>view{width:31%;height:72px;border-radius:8px}.detail-images>view{display:flex;align-items:center;justify-content:center;background:var(--k-paper2);color:var(--k-muted);font-size:11px}.detail-card{margin-top:8px}.card-title{display:flex;align-items:center;justify-content:space-between}.card-title text:first-child{font-family:var(--k-sans);font-size:15px;font-weight:700;line-height:22px}.card-title text:last-child{color:var(--k-indigo);font-size:12px}.order{height:44px;display:flex;align-items:center;gap:8px}.order-icon{width:32px;height:32px;border-radius:10px;background:linear-gradient(145deg,#FCF4E8,#F4E4CC);display:flex;align-items:center;justify-content:center}.order>text:nth-child(2){min-width:0;flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-family:var(--k-sans);font-size:14px;font-weight:600}.order>text:last-child{flex-shrink:0;height:17px;padding:0 5px;border-radius:4px;background:var(--k-green-soft);color:var(--k-green);font-size:10px;font-weight:500;line-height:17px}.order-info,.fulfill{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--k-ink2)}.fulfill{margin-top:10px;padding-top:10px;border-top:1px solid var(--k-line)}.fulfill>text:first-child{font-family:var(--k-sans);font-size:14px;font-weight:600;color:var(--k-ink)}.fulfill>view{display:flex;align-items:center;gap:6px;color:var(--k-muted)}.records{padding-left:22px;gap:6px!important;flex-wrap:wrap}.records text{height:17px;padding:0 5px;border-radius:4px;background:var(--k-green-soft);color:var(--k-green);font-size:10px;font-weight:500;line-height:17px}.public>view{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px;color:var(--k-ink2)}.public button{margin-left:auto;width:47px;height:27px;border:1px solid var(--k-red-line);border-radius:7px;color:var(--k-red)}.dual{margin-top:8px;display:flex;gap:8px}.dual>view{width:50%;box-sizing:border-box}.dual>view:first-child{display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--k-ink2)}.safe{color:var(--k-green)}.report-result{color:var(--k-muted);line-height:1.5;word-break:break-all}.tag-soft{padding:1px 5px;border-radius:4px;background:var(--k-green-soft);color:var(--k-green);font-size:10px;font-weight:500}.note{position:relative;min-height:52px;margin-top:8px;padding:8px 8px 20px;word-break:break-all;border:1px solid var(--k-line2);border-radius:8px;color:var(--k-muted);font-size:12px}.note text:last-child{position:absolute;right:6px;bottom:5px;font-size:11px;color:var(--k-light)}.detail-actions,.reply-actions,.feature-actions{position:fixed;left:0;right:0;bottom:calc(50px + var(--k-safe-bottom));z-index:43;padding:8px 12px 18px;background:var(--k-bg);display:flex;gap:8px}.detail-actions button,.reply-actions button,.feature-actions button{height:40px;flex:1;border:1px solid var(--k-line2);border-radius:20px;background:var(--k-paper);display:flex;align-items:center;justify-content:center;gap:5px;font-family:var(--k-sans);font-size:14px;font-weight:500;color:var(--k-ink)}.detail-actions button:last-child,.reply-actions button:last-child,.feature-actions button:last-child{background:linear-gradient(135deg,#B5814D,#8E5E33);color:#fff;border-color:transparent;font-weight:600}
.ai-warning{min-height:36px;padding:6px 10px;border-radius:12px;background:var(--k-ochre-soft);display:flex;align-items:center;gap:8px;color:var(--k-ochre-deep);font-size:12px}.ai-warning>text{min-width:0;flex:1}.reply-card{margin-top:8px}.tone-label{display:block;margin:10px 0 8px;font-family:var(--k-sans);font-size:14px;font-weight:600}.tones{display:flex;gap:8px}.tones text{height:32px;flex:1;border:1px solid var(--k-line2);border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:13px}.tones .active{border-color:var(--k-red);color:var(--k-red-deep)}.reply-text{position:relative;min-height:135px;margin-top:10px;padding:10px 12px 22px;border:1px solid var(--k-line2);border-radius:12px;box-sizing:border-box}.reply-text text:first-child{white-space:pre-line;font-size:11px;line-height:1.55}.reply-text text:last-child{position:absolute;right:8px;bottom:6px;color:var(--k-muted);font-size:10px}.reply-tools{height:40px;display:flex;align-items:center;justify-content:space-around;font-size:13px;color:var(--k-red-deep)}.basis,.suggest{margin-top:8px;display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--k-ink2)}.basis .section-title,.suggest .section-title{margin-bottom:2px;color:var(--k-ink)}.suggest>view{display:flex;gap:6px}.suggest>view text{height:30px;flex:1;border-radius:999px;background:#F5F1EB;display:flex;align-items:center;justify-content:center}.publish-tip{min-height:40px;margin-top:8px;padding:6px 12px;border-radius:12px;background:var(--k-ochre-soft);display:flex;align-items:center;gap:8px;color:var(--k-ochre-deep);font-size:12px}
.preview-tabs{height:36px;margin-top:6px;border-bottom:1px solid var(--k-line);display:flex}.preview-tabs text{flex:1;display:flex;align-items:center;justify-content:center;font-size:13px}.preview-tabs .active{color:var(--k-red-deep);border-bottom:2px solid var(--k-red)}.community-card{margin-top:10px;padding:10px;border-radius:12px;background:#F7F5F2}.featured{padding:0 6px;border-radius:4px;background:var(--k-ochre-soft);line-height:18px;color:var(--k-ochre-deep)!important}.community-card .detail-images image,.community-card .detail-images>view{height:59px}.community-foot{display:flex;justify-content:space-between;margin-top:8px;color:var(--k-muted);font-size:11px}.reason-card{margin-top:8px}.reason-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;margin-top:6px}.reason-grid>view{min-height:36px;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--k-ink2)}.box{flex-shrink:0;width:18px;height:18px;border:1px solid var(--k-line2);border-radius:4px;display:flex;align-items:center;justify-content:center}.box.checked{background:var(--k-green);border-color:var(--k-green)}.reward{margin-top:8px;display:flex;align-items:center;gap:10px}.reward>view{min-width:0;flex:1}.reward>view>text:last-child{color:var(--k-muted);font-size:12px}.reward button{flex-shrink:0;min-width:96px;height:32px;padding:0 14px;border:1px solid var(--k-red-line);border-radius:999px;background:var(--k-paper);color:var(--k-red-deep);font-size:13px}.record{margin-top:8px}.record>view{min-height:30px;display:flex;align-items:center;font-size:12px}.record>view>text:first-child{width:70px;color:var(--k-muted)}.record>view>view{position:relative;min-height:48px;flex:1;margin-top:4px;padding:8px 8px 20px;word-break:break-all;border:1px solid var(--k-line2);border-radius:8px;color:var(--k-muted)}.record>view>view text:last-child{position:absolute;right:6px;bottom:5px;font-size:11px;color:var(--k-light)}
/* 全局 button 的 line-height 是 inherit：积分奖励的「暂未开放」按钮没有居中，字贴在按钮顶上 */
.reward button{display:flex;align-items:center;justify-content:center}
/* 2026-11-03 主人：简化——回复草稿改成页面内文本框，字放大到 14px 方便年长员工看；计数在右下角 */
.reply-area{display:block;width:100%;min-height:110px;padding:0;box-sizing:border-box;font-size:14px;line-height:1.55;color:var(--k-ink)}.reply-ph{color:var(--k-light)}.reply-count{position:absolute;right:8px;bottom:6px;color:var(--k-muted);font-size:11px}
.reply-page .reply-text{min-height:125px}.reply-page .basis,.reply-page .suggest{gap:4px}.feature-page .community-card .detail-user{margin-top:0}.feature-page .community-card .detail-content{margin-top:6px}.feature-page .community-card .detail-images{margin-top:6px}.feature-page .community-card .detail-images image,.feature-page .community-card .detail-images>view{height:56px}
/* 2026-10-17 R3：评价视频缩略图（列表）和满宽视频格（详情） */
.review-video{position:relative;width:76px;height:56px;border-radius:8px;overflow:hidden;background:#3A322B}.review-video image{width:100%;height:100%}.review-video__play{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(36,27,23,.5);display:flex;align-items:center;justify-content:center}.detail-videos{margin-top:8px}.detail-video{position:relative;width:100%;height:0;padding-bottom:56.25%;border-radius:8px;overflow:hidden;background:#3A322B}.detail-video image{position:absolute;left:0;top:0;width:100%;height:100%}.detail-video__play{width:40px;height:40px;margin:-20px 0 0 -20px}.detail-video__tag{position:absolute;left:8px;top:8px;padding:2px 7px;border-radius:9px;background:rgba(36,27,23,.55);color:#fff;font-size:10px}
/* 11-18 精修 */
/* 页签：14 号，未选灰、选中墨色 600，下面 16×3 的暖棕短条 */
.review-tabs text{font-size:14px;color:var(--k-muted)}.review-tabs .active{color:var(--k-ink);font-weight:600}.review-tabs .active:after{left:50%;width:16px;height:3px;margin-left:-8px;border-radius:2px}
/* 来源小方块：旁边已经写了「住宿 / 岗位 / 活动」，不再用颜色区分，统一中性浅底 + 深灰图标 */
.source-dot,.source-dot.blue,.source-dot.red{background:#F5F1EB}
/* 关键词是中性小标签（绿色只留给情绪「好评」这类语义） */
.ai-tags .label~text{background:#F5F1EB;color:var(--k-ink2)}
/* 卡内分隔用发丝线 */
.review-foot{position:relative;border-top:0}.review-foot::before,.fulfill::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}.fulfill{position:relative;border-top:0}
/* 「查看订单」：灰色小字 + 12 号小箭头 */
.card-link{display:flex;align-items:center;gap:2px;min-height:28px}.card-title .card-link text{font-family:inherit;font-size:12px;font-weight:400;line-height:1.4;color:var(--k-muted)}
.detail-images>view{background:#F5F1EB}
/* 底部三键条：白底 + 顶上一条发丝线（和订单页一样），上面的卡片滑到下面时边界清楚 */
.detail-actions,.reply-actions,.feature-actions{background:var(--k-paper)}
.detail-actions::before,.reply-actions::before,.feature-actions::before{content:'';position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5)}
</style>
