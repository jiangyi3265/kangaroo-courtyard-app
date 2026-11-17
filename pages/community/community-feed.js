// 社区信息流的页签、类型名和卡片排版（2026-10-16 社区改版，对照主人样稿 21）。
// 只给 pages/community 下的页面用：放在 community 分包目录里，构建时跟着分包走，不进主包；不引用别的分包和 @/ 下的模块，方便 node --test 直接测。

// 页签：全部 / 找搭子 / 旅居日常 / 经验分享。「经验分享」就是原来的「换工日记」（只改名字，后端代码还是 diary）。
// 2026-10-21：恢复「旅居日常」名称，沿用 daily 数据类型和已有帖子。
// 找搭子不再跳到单独的一屏：留在社区页，下面换成找搭子列表（分类 + 筛选 + 安全须知），数据走 apiBuddies。
export const FEED_TABS = ['全部', '找搭子', '旅居日常', '经验分享']
export const FEED_KIND = { 全部: '', 旅居日常: 'daily', 经验分享: 'diary' }
export const BUDDY_TAB = '找搭子'
export const DIARY_TAB = '经验分享'

// 「经验分享」下面那行小字（主人原话）：按关联经历的岗位类型筛，后端参数 jobType
export const JOB_CHIPS = [
  { key: 'volunteer', label: '换宿旅行' },
  { key: 'parttime', label: '线下兼职' },
  { key: 'fulltime', label: '全职' }
]

// 搜索框提示字：社区搜索只搜得到动态（搭子 / 旅居日常 / 经验分享），搜不到活动，所以不写「活动」（样稿写的「活动」没照搬）
export const SEARCH_PLACEHOLDER = '搜索搭子、旅居日常、经验分享'

// 发布页的类型（2026-10-17 对照主人样稿 图 3：三个大胶囊 找搭子 / 经验分享 / 旅居日常）。
// 每个类型自己的标题 / 正文提示字，和「补充信息」卡的副标题（写的是这一类收进去的字段）
export const PUBLISH_TYPES = [
  { name: '找搭子', desc: '约见 / 组队', icon: 'users', titlePh: '给这次出发起个标题', bodyPh: '说说你想去哪里、想找什么样的同行伙伴', extraSub: '城市、出发日期、同行性别可填写' },
  { name: '经验分享', desc: '换宿 / 兼职 / 全职', icon: 'book-open', titlePh: '分享你的真实经历', bodyPh: '说说这段经历里做了什么、学到了什么、给后来人的建议', extraSub: '城市、日期可填写' },
  { name: '旅居日常', desc: '生活 / 灵感', icon: 'house', titlePh: '记录今天的旅居日常', bodyPh: '分享小院里的生活、路上的风景，或今天的小发现', extraSub: '城市、日期、伙伴说（推荐 / 避雷）可填写' }
]
export const PUBLISH_KIND = { 找搭子: 'buddy', 旅居日常: 'daily', 经验分享: 'diary' }
// 本机草稿里存的是类型名：改名前存下的「换工日记」「旅居攻略」要认成新名字，否则查不到类型、发布时报「请选择发布类型」
const LEGACY_TYPES = { 义工日记: '经验分享', 换工日记: '经验分享', 旅居攻略: '旅居日常' }
export const restoreType = (saved, fallback = '找搭子') => {
  const t = LEGACY_TYPES[saved] || saved
  return PUBLISH_KIND[t] ? t : fallback
}
// 发布页地址带 ?kind=daily / buddy / diary 时预选对应类型（2026-10-17：会员信息「赚取积分」的旅居日常任务点「去完成」带 kind=daily）；认不出的返回 ''
export const typeOfKind = (kind) => Object.keys(PUBLISH_KIND).find(name => PUBLISH_KIND[name] === kind) || ''

// 找搭子分类（和服务端 CATEGORY_LABEL 一一对应）
export const BUDDY_CATS = ['全部', '徒步登山', '摄影', '拼饭', '美食分享', '骑行', '跑步', '其他']
export const CAT_KEY = { 徒步登山: 'hike', 摄影: 'photo', 拼饭: 'meal', 美食分享: 'food', 骑行: 'ride', 跑步: 'run', 其他: 'other' }
// 找搭子卡片没有图时，左边放分类小图标 + 出发日期，不拿「暂无图片」占位图凑
export const CAT_ICON = { hike: 'mountain', photo: 'camera', meal: 'utensils', food: 'coffee', ride: 'bike', run: 'footprints', other: 'users' }
export const catIcon = (label) => CAT_ICON[CAT_KEY[label]] || 'users'
// 「10月18日 08:00」→「10/18」；没有日期 →「待定」
export const shortDate = (text) => {
  const m = /(\d{1,2})月(\d{1,2})日/.exec(String(text || ''))
  return m ? `${m[1]}/${m[2]}` : '待定'
}

// 卡片标题：「话题｜标题」（话题 = 服务端 topicLabel：经验分享是换宿旅行 / 线下兼职 / 全职，找搭子是分类，旅居日常是第一个标签；没有就只显示标题）。
// 2026-10-17：找搭子「自动识别」没命中时分类落在「其他」，之前标题成了「其他｜酒吧」（主人截图嫌难看）：话题是「其他」就不加前缀，只显示标题
// （服务端 10-17 起也不再给「其他」当话题，这里再挡一次老接口）。卡片、详情、我的发布都用这一个
const NO_TOPIC = ['其他']
export const topicOf = (p) => (p && p.topicLabel && !NO_TOPIC.includes(p.topicLabel) ? p.topicLabel : '')
export const titleOf = (p) => (topicOf(p) ? topicOf(p) + '｜' : '') + ((p && p.title) || '')

// 卡片上的小标签：审核中 / 找搭子限定的同行性别（仅限女生 / 仅限男生）/ 旅居日常的「伙伴说 · 推荐 / 避雷」。
// 大卡片和一行两列的半张卡用同一份：之前半张卡只显示「审核中」，限定性别和伙伴说都看不到
export function postTags(p) {
  if (!p) return []
  const out = []
  if (p.activity) out.push({ key: 'activity', text: '活动' + p.activity.label, tone: ['cancelled', 'ended', 'rejected'].includes(p.activity.status) ? 'ink' : 'green' })
  if (p.status === 'pending') out.push({ key: 'pending', text: '动态待审核·仅自己可见', tone: 'ochre' })
  if (p.kind === 'buddy' && p.genderLimit) out.push({ key: 'gender', text: p.genderLimitLabel || (p.genderLimit === 'male' ? '仅限男生' : '仅限女生'), tone: 'red' })
  if (p.toneLabel) out.push({ key: 'tone', text: '伙伴说 · ' + p.toneLabel, tone: p.tone === 'avoid' ? 'red' : 'green' })
  return out
}

// 能不能分享：审核中 / 没通过的动态别人打不开，复制链接、微信转发、分享到私信都先拦下（老接口没有 status 的照常能分享）
export const canShare = (p) => !!p && (!p.status || p.status === 'online')

// 2026-10-17 主人反馈「发帖审核中时点赞和收藏还有评论都不能用」：只有已发布的帖子能点赞 / 收藏 / 评论（服务端 409 兜底），
// 审核中 / 没通过的按钮灰掉，点了只弹这句；老接口没有 status 的照常能点
export const canInteract = (p) => !!p && (!p.status || p.status === 'online')
export const INTERACT_TIP = '审核通过后才能点赞、收藏和评论'

// 顶栏城市：320 宽的手机上「全部城市」挤在袋鼠贴纸和微信胶囊中间只剩「全部…」，窄屏显示成「全部」
export const cityLabel = (city, narrow) => (narrow && city === '全部城市' ? '全部' : city)

// 2026-10-19 选的城市空着时自动看全国（总负责人在微信模拟器里发现：模拟器定位在大连、主人人在伊犁，社区默认是自己的城市，
// 这个城市一条动态都没有时整页只剩「这里还没有动态」，像是社区没人用）。和首页「其他城市的近期活动」一个思路：
// 没在搜索、不是「已关注」（那个本来就不分城市）、选的不是「全部城市」、这个页签第一页一条都没有（找搭子页签同样），
// 就再取一次全国的同一页签，列表上面一行小字「X还没有…，先看看全国的」+「只看X」（点了回到只看这个城市，cityOnly = 这个城市）。
// 记住的社区城市不改；「我的 → 全国攻略」（?tab=guide&all=1）本来就是全部城市，不会走到这里
export const ALL_CITIES = '全部城市'
export function shouldWiden({ city, keyword, sort, rows, cityOnly } = {}) {
  return !!city && city !== ALL_CITIES && !String(keyword || '').trim() && sort !== 'follow' && !(rows && rows.length) && cityOnly !== city
}
// 那行小字：按页签说（找搭子带了分类 / 筛选条件时说「符合条件的搭子」）
export function widenNotice(city, tab, filtered) {
  const what = tab === BUDDY_TAB ? (filtered ? '符合条件的搭子' : '人找搭子') : tab === '旅居日常' ? '旅居日常' : tab === DIARY_TAB ? '经验分享' : '动态'
  return `${city}还没有${what}，先看看全国的`
}

// 2026-10-18 社区「杂志感」改版：卡片左上一行小字（kicker）写帖子类型，并按类型给一个低饱和的类型色
// （找搭子豆绿 / 旅居日常赭黄 / 经验分享陶土），没图的卡片靠它和浅色引号做出层次，不拿占位图凑。已知类型统一使用当前名称，未知类型保留服务端名称
const KIND_NAME = { buddy: '找搭子', daily: '旅居日常', diary: '经验分享' }
export const kindOf = (p) => {
  const key = p && KIND_NAME[p.kind] ? p.kind : ''
  return { key: key || 'other', label: KIND_NAME[key] || (p && p.kindLabel) || '' }
}
// 类型色（小字、引号图标用）：和 index.vue 样式里 .kd-* 的 --kc 一致；图标画在 SVG 里读不到 CSS 变量，所以这里另存一份
export const KIND_COLOR = { buddy: '#4A6E3A', daily: '#8A5A1C', diary: '#94513B', other: '#8A5E36' }

// 热门活动插在信息流里的位置：第 3 条动态前，之后每隔 5 条一张
const ACT_SLOTS = [2, 7, 12, 17]
const hasImgs = (p) => !!(p && p.imgs && p.imgs.length)

/**
 * 把一页动态（和本周热门活动）排成卡片块，排法只看数据、每次结果一样：
 *   · 第一条带图的动态 → 大图卡（hero）；
 *   · 前 3 条动态都没图时，第一条文字帖 → 开篇卡（lead：类型色底 + 大引号 + 大标题，顶替大图卡的位置，不用占位图）；
 *   · 之后有图内容按「两张并排、一张右侧缩略图」交替（pair / thumb），对应原稿的混合版式；
 *   · 落单的带图动态 → 右边小图的列表卡（thumb）；落单的活动 → 通栏活动卡（act）；
 *   · 没图的动态（2026-10-18 主人嫌「一条条白条太单调」）→ 一行两列的文字小卡（pair，格子里是类型色底的「封面字」）
 *     和通栏文字卡（text，摘要放在浅色引号块里）交替排：两张并排、一张通栏、两张并排……；凑不成对的落单那张走通栏。
 * 第一张活动卡所在的那块带 moreActs: true：页面在它下面放「更多活动 ›」，进完整的活动列表（原来顶上「本周热门 · 更多」的入口）。
 * posts 的每一项要有 postId、imgs（图片地址数组）；acts 的每一项要有 activityId。
 */
export function buildBlocks(posts, acts = []) {
  const list = posts || []
  const hots = acts || []
  const seq = []
  let ai = 0
  list.forEach((p, i) => {
    if (ai < hots.length && ACT_SLOTS.includes(i)) seq.push({ act: hots[ai++] })
    seq.push({ post: p })
  })
  // 动态太少（不到 3 条）够不着第一个位置：活动排在最后，最多两张
  if (ai === 0) while (ai < Math.min(2, hots.length)) seq.push({ act: hots[ai++] })
  // 内测反馈：动态与活动均使用通栏卡片，避免双列、封面大图混排。
  const out = seq.map(it => it.act
    ? { type: 'act', key: 'a' + it.act.activityId, act: it.act }
    : { type: hasImgs(it.post) ? 'thumb' : 'text', key: 'p' + it.post.postId, post: it.post })
  const firstAct = out.find(block => block.act)
  if (firstAct) firstAct.moreActs = true
  return out
}
