// 旅居改版 R3（2026-10-17，主人效果图 7）：小院详情的「3分钟看小院」、房型短视频、「近期生活碎片」入口和生活碎片页、评价视频共用的小函数。
// 不碰 vue / uni，node 测试里能直接 import；放在 pages/stays 分包里，不占主包。
// 数据来自 GET /app/stay/{id}（introVideo / diary / roomTypes[].videoUrl）、/room-types、/diary、/reviews（后端 KgStayMediaService、KgStayReviewService）。

/** 卡片上的字（效果图原样） */
export const INTRO_TITLE = '3分钟看小院'
export const INTRO_CAPTION = '看院子全貌、房间和公共空间'
export const DIARY_TITLE = '近期生活碎片'
export const DIARY_SUB = '主理人更新小院日常'
export const ROOM_VIDEO_BADGE = '≤1分钟'

/** 只认本平台视频上传接口给的路径（/profile/upload/videos/yyyy/MM/dd/{32位}.mp4|mov），别的都当没有 */
export const isVideoUrl = (u) => /^\/profile\/upload\/videos\/\d{4}\/\d{2}\/\d{2}\/[0-9a-f]{32}\.(mp4|mov)$/.test(String(u || ''))

/** 详情接口的 introVideo → 卡片数据 {url, cover}；没传视频返回 null（页面不出这张卡）。封面没有时用房源封面 */
export const introCard = (v, stayCover) => (v && isVideoUrl(v.url) ? { url: v.url, cover: v.cover || stayCover || '' } : null)

/** 详情接口的 diary 摘要 → 入口卡数据 {count, thumbs}；一条都没有返回 null（页面不出「近期生活碎片」入口） */
export const diaryEntry = (d) => {
  const n = Number(d && d.count) || 0
  return n > 0 ? { count: n, thumbs: ((d && d.thumbs) || []).filter(Boolean).slice(0, 3) } : null
}

/** 生活碎片页地址 */
export const stayDiaryUrl = (stayId) => '/pages/stays/diary?stayId=' + Number(stayId)

/** 门店日常复用生活碎片页；岗位入口由服务端解析所属门店，不信任客户端指定门店。 */
export function diarySource(q = {}) {
  const id = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 0
  const jobId = id(q.jobId), stayId = id(q.stayId)
  if (jobId) return { kind: 'job', title: '店里日常', url: '/app/job/' + jobId + '/diary' }
  if (stayId) return { kind: 'stay', title: DIARY_TITLE, url: '/app/stay/' + stayId + '/diary' }
  return null
}

/** 「住过的家人评价 / 近期生活碎片 / 小院 Vlog」入口一共几张（只有 1 张时占满一行） */
export const entryCount = (hasDiary, vlogCount) => 1 + (hasDiary ? 1 : 0) + (Number(vlogCount) > 0 ? 1 : 0)

/** 房型卡的视频：{url, cover}；房型没传视频返回 null（不出「≤1分钟」角标和播放按钮）。封面没有时用房型图 */
export const roomVideo = (r) => (r && isVideoUrl(r.videoUrl) ? { url: r.videoUrl, cover: r.videoCover || r.cover || '' } : null)

/** 评价卡的视频（一条评价最多 1 段）：{url, cover}；没有返回 null */
export const reviewVideo = (review) => {
  const v = ((review && review.videos) || []).find((x) => x && isVideoUrl(x.url))
  return v ? { url: v.url, cover: v.cover || '' } : null
}

/** 评价照片宫格的格子高度（R3 照片放大：之前三列只有 96px，主人说看不清）：1 张 220、2 张 / 4 张两列 150、其余三列 104。
 *  10-19 复查：两列、三列的格子改成正方形（宽度跟着卡片走，三张并排正好铺满卡片宽），这里的高度只剩一张大图（220）还在用 */
export const PHOTO_HEIGHT = { one: 220, two: 150, three: 104 }

/**
 * 全屏播放的方向（10-19 复查，主人：「评价的视频要能占满整个手机横屏」）：小程序 VideoContext.requestFullScreen 的 direction。
 * 横拍（宽 > 高）→ 90（横屏，手机逆时针转过来看）；竖拍 / 方的 → 0；还不知道宽高 → null（不指定，交给微信按宽高比判断）
 */
export const fullDirection = (size) => {
  const w = Number(size && size.w) || 0
  const h = Number(size && size.h) || 0
  if (!(w > 0 && h > 0)) return null
  return w > h ? 90 : 0
}

/**
 * 网页版的横屏铺满：横拍的视频、可视区又是竖的（宽 < 高）→ 整个播放层转 90°：宽 = 可视区高、高 = 可视区宽，
 * 绕左上角转 90° 再右移一个可视区宽，正好盖满屏幕（顶栏落在横过来以后的上边，和小程序 direction 90 同一个方向）。
 * 竖拍的、或者手机已经横过来了（宽 ≥ 高）→ null，不转
 */
export const landscapeTurn = (size, view) => {
  const vw = Number(view && view.w) || 0
  const vh = Number(view && view.h) || 0
  if (fullDirection(size) !== 90 || !(vw > 0 && vh > 0) || vw >= vh) return null
  return { width: vh, height: vw, transform: `translateX(${vw}px) rotate(90deg)` }
}

/** 生活碎片一条 → 卡片：缩略图（照片用它自己，视频用封面，没封面给 '' 画占位底色）、日期角标、一句话 */
export const diaryCard = (r) => ({
  diaryId: Number(r && r.diaryId) || 0,
  type: r && r.type === 'video' ? 'video' : 'image',
  url: (r && r.url) || '',
  thumb: (r && r.type === 'video' ? r.cover : r && (r.cover || r.url)) || '',
  date: (r && r.date) || '',
  caption: (r && r.caption) || ''
})

/** 两列错落排布（效果图的瀑布流）：按顺序左右交替放（第 1、3、5… 条在左），图片按原比例显示（widthFix），高度自然错开；
 *  不按图片加载后的高度重排，免得图片陆续加载时卡片在两列之间跳来跳去 */
export const twoColumns = (cards) => {
  const left = []
  const right = []
  ;(cards || []).forEach((c, i) => (i % 2 === 0 ? left : right).push(c))
  return [left, right]
}

/** 生活碎片页顶部：接口给的 header → {bg, title, subtitle, lines}；没传背景图时 bg 是房源封面（接口已经兜过底） */
export const diaryHeader = (h) => ({
  bg: (h && h.bg) || '',
  title: (h && h.title) || '小院日记',
  subtitle: (h && h.subtitle) || '把日子过成一段可以翻看的记忆',
  lines: ((h && h.lines) || []).filter((x) => String(x || '').trim()).slice(0, 3)
})

/** 点一张照片看大图：只放照片（视频点了是播放），从点的那张开始 */
export const previewList = (cards, current) => {
  const urls = (cards || []).filter((c) => c.type === 'image' && c.url).map((c) => c.url)
  return { urls, current: current && current.type === 'image' ? current.url : urls[0] }
}
