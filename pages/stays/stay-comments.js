// 小院评论（2026-10-31，V65）生活碎片页的「小伙伴评论」页签用的小函数。不碰 vue / uni，node 测试里能直接 import；放在 pages/stays 分包，不占主包。
// 接口：GET /app/stay/{stayId}/comments?page=  → { total, hasMore, rows: 已通过的, mine: 本人还没公开的（只有第 1 页有）}
// 和「住过的家人评价」是两回事：不打星，不进综合分、AI 总结、积分。身份标签由服务端在提交时算好，这里只负责显示。

export const TAB_DIARY = 'diary'
export const TAB_COMMENT = 'comment'

/** 通知带 tab=comment 打开评论页签；岗位「店里日常」入口没有页签，一律是日记 */
export const tabFromQuery = (q, stayId) => (Number(stayId) > 0 && q && q.tab === TAB_COMMENT ? TAB_COMMENT : TAB_DIARY)

/** 页签上的字：还没拿到条数时不写 (0)，免得看着像真的没有 */
export const commentTabLabel = (total) => (total === null || total === undefined ? '小伙伴评论' : '小伙伴评论 (' + (Number(total) > 0 ? Number(total) : 0) + ')')

/** 写评论页（pages/profile 分包） */
export const stayCommentWriteUrl = (stayId) => '/pages/profile/stay-comment?stayId=' + Number(stayId)

export const REPORT_REASONS = ['广告或留联系方式', '人身攻击或骚扰', '内容不实', '未经同意拍到别人', '其他']

/** 还没公开的评论写给本人看的一句话；已公开的没有 */
export const commentNotice = (c) => {
  const why = String((c && c.auditReason) || '').trim()
  if (c && c.status === 'pending') return '审核中，只有你看得到'
  if (c && c.status === 'rejected') return '未通过审核' + (why ? '：' + why : '') + '。只有你看得到，可以删掉重写'
  if (c && c.status === 'offline') return '已下架' + (why ? '：' + why : '') + '。只有你看得到'
  return ''
}

/** 照片格子：1 张大图，2、4 张两列，其余三列 */
export const picGrid = (n) => (n === 1 ? 'one' : n === 2 || n === 4 ? 'two' : 'three')

const IDENTITY = { guest: '已核实住客', volunteer: '已核实换工', unverified: '未核实' }

/** 接口的一条评论 → 页面用的卡片；少字段也不报错 */
export const commentCard = (r) => {
  const images = ((r && r.images) || []).filter(Boolean)
  const identity = r && IDENTITY[r.identity] ? r.identity : 'unverified'
  const video = r && r.video && r.video.url ? { url: r.video.url, cover: r.video.cover || '' } : null
  return {
    commentId: Number(r && r.commentId) || 0,
    name: (r && r.name) || '小伙伴',
    avatar: (r && r.avatar) || '',
    identity,
    identityText: (r && r.identityText) || IDENTITY[identity],
    content: (r && r.content) || '',
    images,
    grid: picGrid(images.length),
    video,
    dateText: (r && r.dateText) || '',
    status: (r && r.status) || 'online',
    notice: commentNotice(r),
    isMe: !!(r && r.isMe)
  }
}

/** 本人还没公开的放最上面，后面接已公开的（同一条不出现两次：翻页时新通过的评论可能排进下一页） */
export const commentList = (mine, rows) => {
  const seen = new Set()
  return [...(mine || []), ...(rows || [])].filter((c) => (seen.has(c.commentId) ? false : seen.add(c.commentId)))
}
