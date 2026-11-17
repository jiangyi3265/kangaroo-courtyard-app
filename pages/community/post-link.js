// 帖子「关联」（2026-10-17 发布页改版，对照主人样稿 图 3）：发布时可以关联一个 小院 / 门店、岗位 或 活动（主人拍板：支持关联自己已公开的帖子）。
// 服务端 r1 存在 kg_post 原来的 ref_type / ref_id（stay / store / job / activity），2026-10-17 r2（V52）起单独存 link_type / link_id；
// 信息流、详情里每条帖子带 link 小卡片：{ type, id, title, cover, city, label, sub }，页面按 type + id 拼跳转地址（linkRoute）。
// 经验分享的 ref 是「经历校验」那条报名；r2 起也能自己选关联，没选时自动关联到那条报名的岗位（服务端算，岗位下架退到门店）。
// 只给 pages/community 下的页面用：放在 community 分包目录里，构建时跟着分包走，不进主包；不引用 @/ 下的模块，方便 node --test 直接测。

// 关联选择页的三个页签：小院和门店一起搜（type=place），岗位只给在招的，活动只给还没结束的
export const LINK_TABS = [
  { key: 'place', label: '小院/门店' },
  { key: 'job', label: '岗位' },
  { key: 'activity', label: '活动' },
  { key: 'post', label: '我的帖子' }
]
export const LINK_TYPES = ['stay', 'store', 'job', 'activity', 'post']
export const LINK_TYPE_LABEL = { stay: '小院', store: '门店', job: '岗位', activity: '活动', post: '帖子' }

// 点「关联：XXX」去哪儿：小院详情 / 门店在招岗位 / 岗位详情 / 活动详情；不认识的类型不给入口
export function linkRoute(link) {
  const id = Number(link && link.id) || 0
  if (!id) return ''
  switch (link.type) {
    case 'stay': return '/pages/stays/detail?stayId=' + id
    case 'store': return '/pages/profile/follows?storeId=' + id
    case 'job': return '/pages/jobs/detail?jobId=' + id
    case 'post': return '/pages/community/index?postId=' + id
    case 'activity': return '/pages/community/activity?id=' + id + '&channel=community'
    default: return ''
  }
}

// 服务端给的 link 整理成页面用的样子（小标签没给时按类型补；标题空的不算关联）
export function linkView(link) {
  if (!link || typeof link !== 'object' || !LINK_TYPES.includes(link.type) || !Number(link.id) || !String(link.title || '').trim()) return null
  return {
    type: link.type, id: Number(link.id), title: String(link.title).trim(), cover: link.cover || '', city: link.city || '',
    label: link.label || LINK_TYPE_LABEL[link.type], sub: link.sub || '', to: linkRoute(link)
  }
}

// 发布时带给服务端的字段（选了才带）：
//   2026-10-17 r2（V52）：关联单独带 linkType / linkId，经验分享也能选了；
//   找搭子 / 旅居攻略另外照旧带 refType / refId（和 r1 一样，后端还没升级时照样认）；
//   经验分享不带 refType / refId（它的 ref 是经历那条报名，由经历校验页给）；没选关联时服务端自动关联那段经历的岗位
export function linkPayload(kind, link) {
  const v = linkView(link)
  if (!v) return {}
  const out = { linkType: v.type, linkId: v.id }
  return kind === 'diary' ? out : { refType: v.type, refId: v.id, ...out }
}
// 经验分享没选关联时「关联帖子」卡上的提示
export const DIARY_AUTO_LINK_HINT = '不选的话，会自动关联你在「经历校验」里选的那段经历的岗位'

// 本机草稿里存的关联：只认支持的公开对象（老草稿存的是自己的报名 / 住宿订单，新发布页不再用，恢复时丢掉）
export function restoreLink(saved) {
  const v = linkView(saved)
  return v ? { type: v.type, id: v.id, title: v.title, cover: v.cover, city: v.city, label: v.label, sub: v.sub } : null
}

// 2026-10-18：别的页面带着关联对象打开发布页（岗位详情「寻伴同行」→ 发到搭子墙：?kind=buddy&linkType=job&linkId=&linkTitle=&linkCity=），
// 「关联帖子」直接预先选好它，和在关联选择页里选的是同一个样子（发出去照样带 linkType / linkId）；类型、编号、标题不全就当没带
export function linkFromQuery(q) {
  if (!q || typeof q !== 'object') return null
  return restoreLink({ type: q.linkType, id: q.linkId, title: q.linkTitle, city: q.linkCity || '' })
}

// ---------------- 关联选择页的打开 / 返回（同 common/city-picker.js 的做法：选的结果交还给打开它的发布页） ----------------
const requests = new Map()
let nextId = 0
export const linkRequest = (id) => (requests.get(String(id)) || {}).options || null
// 选好了（或返回 / 取消 = null）：把结果交给发布页，只交一次
export function finishLinkPicker(id, result = null) {
  const r = requests.get(String(id))
  if (!r) return
  requests.delete(String(id))
  r.resolve(result)
}
// options: { city, current }（current = 已选的关联，选择页里标「已关联」）。navigate 由调用方传入（页面里是 uni.navigateTo），这样 node 里也能测
export function openLinkPicker(options = {}, navigate) {
  if (requests.size) return Promise.resolve(null)
  return new Promise((resolve) => {
    const id = String(++nextId)
    requests.set(id, { options: { city: options.city || '', current: options.current || null }, resolve })
    const fail = () => finishLinkPicker(id, null)
    try {
      navigate({ url: '/pages/community/link?request=' + id, fail })
    } catch (e) {
      fail()
    }
  })
}

// ---------------- 发布成功页 ----------------
// 发布接口的结果先记在这里（关联对象的标题等不放进地址栏），成功页按 postId 取；取不到（比如页面被重建）就按 postId 再查一次帖子
let lastPublished = null
export function rememberPublished(res, kind) {
  lastPublished = res && res.postId ? { postId: Number(res.postId), status: res.status || 'pending', kind: kind || '', link: linkView(res.link), activityId: res.activityId || null } : null
  return lastPublished
}
export const publishedOf = (postId) => (lastPublished && lastPublished.postId === Number(postId) ? lastPublished : null)
export const publishedUrl = (res) => '/pages/community/published?postId=' + (Number(res && res.postId) || 0) + '&status=' + (res && res.status === 'online' ? 'online' : 'pending')
// 成功页的大标题和说明：已上线 =「发布成功」；先审后发 =「发布成功，等待审核」（2026-10-19 复查：主人要的是「明确告诉用户发布成功」，
// 之前先审后发写的「已提交，审核通过后展示」，带图的动态、找搭子在线上都要人工审核，大多数人看到的是这一句，像是没发成）
export function publishedText(status) {
  if (status === 'rejected') return { title: '帖子未通过审核', sub: '到「我的发布」查看原因，修改后可以重新提交' }
  if (status === 'offline') return { title: '帖子已下架', sub: '当前内容未在社区展示，可到「我的发布」查看详情' }
  return status === 'online'
    ? { title: '发布成功', sub: '你的分享已出现在社区，去看看吧' }
    : { title: '发布成功', sub: '审核通过后会展示在社区并通知你；审核中只有你自己看得到' }
}
