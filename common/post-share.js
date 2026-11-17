// 社区帖子分享与「伙伴说」标签的纯函数（不依赖 uni / 接口，见 scripts/post-share.test.mjs）。
//
// 分享到私信：之前帖子只能点右上角「···」转发，没法发给社区里聊过天的人；现在可以把帖子发进一个私信会话。
// 私信只能发文字，所以按固定格式拼一段话；聊天页认出这个格式就显示成一张可点的帖子卡片，点开进帖子详情。
// 老版本小程序收到的就是这段文字本身，照样看得懂。

const SHARE_HEAD = '【分享动态】'
const SHARE_TAIL = '\n点开查看：袋鼠全球青年 · 社区动态 #'
const LEGACY_SHARE_TAIL = '\n点开查看：袋鼠小院 · 社区动态 #'

/** 分享到私信的消息正文。标题去掉换行、最多 60 字；没有编号返回 '' */
export function sharePostText(post) {
  const id = Number(post && post.postId)
  if (!Number.isInteger(id) || id <= 0) return ''
  const title = String((post && post.title) || '').replace(/\s+/g, ' ').trim().slice(0, 60) || '一条社区动态'
  return SHARE_HEAD + title + SHARE_TAIL + id
}

/** 认出私信里的分享消息：是就返回 { postId, title }，不是返回 null */
export function parseSharedPost(content) {
  const s = String(content || '')
  if (!s.startsWith(SHARE_HEAD)) return null
  const tail = s.includes(SHARE_TAIL) ? SHARE_TAIL : LEGACY_SHARE_TAIL
  const at = s.lastIndexOf(tail)
  if (at < SHARE_HEAD.length) return null
  const idText = s.slice(at + tail.length)
  if (!/^[1-9]\d{0,11}$/.test(idText)) return null
  const title = s.slice(SHARE_HEAD.length, at)
  if (!title || title.includes('\n')) return null
  return { postId: Number(idText), title }
}

/** 帖子的分享路径（小程序转发卡片、H5 复制链接共用） */
export const postPath = (postId) => '/pages/community/index?postId=' + Number(postId)

/** 「伙伴说」：旅居日常可选的标签，'' = 不选 */
export const TONES = [
  { key: '', label: '不选' },
  { key: 'recommend', label: '推荐' },
  { key: 'avoid', label: '避雷' }
]
export const toneLabel = (key) => (TONES.find(t => t.key && t.key === key) || {}).label || ''
