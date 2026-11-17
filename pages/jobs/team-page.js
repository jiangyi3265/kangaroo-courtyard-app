// 寻伴同行页（原「同行队伍 / 找人一起去」，2026-10-18 主人：「搭子页面还是好丑，和我发你的完全不一样」）的文案和分享内容。
// 只在 jobs 分包里用，不进主包；不引用 @/ 下的模块，node --test 直接测。
import { API_BASE } from '../../common/config.js'

// 「找个搭子，一起去{城市}做换工」：换宿 = 做换工、兼职 = 做兼职、全职 = 去工作（「一起到大理去工作」比「一起去大理去工作」顺）
const DOING = { volunteer: '做换工', parttime: '做兼职', fulltime: '去工作' }
export function teamHeadline(jobType, city) {
  const c = String(city || '').split('·')[0].trim()
  const doing = DOING[jobType] || '做换工'
  if (!c) return { line1: '找个搭子，', line2: jobType === 'fulltime' ? '一起去工作' : '一起去' + doing }
  return { line1: '找个搭子，', line2: (jobType === 'fulltime' ? '一起到' : '一起去') + c + doing }
}
export const TEAM_SUBTITLE = '分享岗位，约同行，结伴出发更安心'
export const TEAM_SAFETY = ['平台已核验门店', '部分岗位含保险', '结伴报名更安心']

/** 公开分享仍可使用，但未报名的人不能被引导报名已关闭或满员的岗位。 */
export function teamEntryNotice(job = {}, detail = {}, remaining) {
  const d = detail || {}
  const status = job.status || d.status
  if (status === 'paused') return '该岗位已暂停招聘，暂不能报名。可分享给朋友，恢复招聘后再一起出发。'
  if (status === 'closed') return '该岗位已结束招聘，暂不能报名'
  if (d.acceptsApplication === false) return (d.applyClosedReason || '该岗位当前不接受报名') + '。仍可查看同行伙伴。'
  if (remaining != null && String(remaining).trim() !== '' && Number(remaining) === 0) return '该岗位名额已满，仍可查看同行伙伴'
  return '查看主动加入的伙伴，报名后也可加入同行'
}

/**
 * 「选择分享方式」四行：key 给页面分派动作，tone 是左边圆形图标的底色（10-19 参考图：橙色文档、绿色微信、蓝色图片、粉橙链接）。
 * 1 小程序搭子社区：发到站内「找搭子」，带上这个岗位做关联；2 微信好友 / 群：转发小程序卡片（网页版复制链接）；
 * 3 朋友圈：生成分享海报；4 复制链接
 */
export const SHARE_WAYS = [
  { key: 'community', title: '小程序搭子社区', desc: '发到站内搭子墙，快速找同行', icon: 'file-text', tone: 'orange' },
  { key: 'wechat', title: '微信好友 / 微信群', desc: '转发小程序卡片，直接约朋友', icon: 'wechat', tone: 'wechat' },
  { key: 'moments', title: '微信朋友圈', desc: '生成分享海报，公开招募搭子', icon: 'image', tone: 'blue' },
  { key: 'link', title: '复制链接', desc: '复制岗位链接，发到任意地方', icon: 'link', tone: 'pink' }
]

/** 岗位详情的小程序路径（转发卡片、复制链接都用它） */
export const jobPath = (jobId) => '/pages/jobs/detail?jobId=' + (Number(jobId) || 0)

/**
 * 复制出去的那段话：岗位名 + 城市 + 打开方式。网页版有可以直接打开的地址（href = 当前站点 + #/pages/jobs/detail?jobId=）；
 * 小程序复制公开的岗位网页链接，接收人无需猜测或重新搜索岗位名。
 */
export function shareCopyText({ title, city, jobId, href = '' }) {
  const head = '【袋鼠全球青年】' + (String(title || '').trim() || '一起去旅居打工') + (city ? '｜' + String(city).split('·')[0] : '')
  if (href) return head + ' ' + href.replace(/#.*$/, '') + '#' + jobPath(jobId)
  return head + ' ' + API_BASE + '/#' + jobPath(jobId)
}

/** 发到「找搭子」带的地址参数：预选找搭子，关联这个岗位（发布页认 linkType / linkId / linkTitle） */
export function buddyPublishQuery({ jobId, title, city }) {
  const q = { kind: 'buddy', linkType: 'job', linkId: Number(jobId) || 0, linkTitle: String(title || '').slice(0, 40), linkCity: String(city || '').split('·')[0] }
  return Object.keys(q).filter(k => q[k] !== '' && q[k] !== 0).map(k => k + '=' + encodeURIComponent(q[k])).join('&')
}
