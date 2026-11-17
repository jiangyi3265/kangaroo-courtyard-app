// 招募换工 / 兼职 / 全职的预设模板（2026-11-03）。
// 主人：「优化界面，现在操作太繁琐了看不懂，增加一个预设模板，一键填写，我只要改一部分就行」。
// 发布表单（jobs.vue）顶上一排模板，点一下就把标题、工作内容、换工类型、工时、排班、最短期限、食宿、住宿条件、年龄、性格、技能、要求、
// 结算方式、试用期、培训、门店类型都填上；岗位照片、工作地点、到岗日期、招募人数、住宿照片视频、宠物、补贴、奖金、提成、保险不动（这些是门店自己的事）。
// 兼职、全职的薪资金额不替门店写（各地工钱不一样，写错了用户当真），只选好日薪 / 月薪，底部提交栏会提示「还差：薪资金额」。
// 放在 staff 分包里（不进 common，不算主包）；纯数据 + 纯函数，scripts/job-templates-20261103.test.mjs 逐个检查每个模板都能通过表单和服务端的校验。
//
// 取值约定（和 jobs.vue、服务端 KgStaffJobService / JobFilterFields 同一组）：
//   workKind   换工类型，字典 kg_volunteer_kind：daily 日常 / edit 剪辑 / live 直播 / photo 摄影 / craft 手作 / other 其他（停用的不填）
//   restMode   1-1 / 4-3 / 2-1 / 5-2 / 3-2 / 3-1 / 6-1；roomType single / double / triple / multi；minDays null / 7 / 15 / 20 / 30
//   boardType  换宿只能 all / room；兼职、全职 all / room / meal / none
//   dailyHours 每天 2 / 4 / 6 / 8 小时；age、personality 用后台「岗位要求选项」的默认那组（取不到就不填）
//   标题 30 字、工作内容 300 字、要求连同年龄性格技能 300 字、技能每个 8 字以内最多 4 个、上班时段 32 字、食宿说明 60 字、培训 64 字

const lines = (...xs) => xs.join('\n')

export const JOB_TEMPLATES = {
  volunteer: [
    {
      key: 'front', name: '前台接待换工', sub: '办入住、接待客人',
      fill: {
        title: '民宿前台接待换工', workKind: 'daily',
        work: lines('帮客人办理入住、退房，介绍房间和周边', '回复线上咨询、接听电话', '整理前台和公共区域，保持干净整洁', '给客人推荐游玩路线和好吃的'),
        hope: lines('能按约定待满时间', '会用手机和电脑的基本操作'),
        dailyHours: '每天 4 小时', restMode: '5-2', minDays: 30, shiftTime: '早班或晚班，到店后商量',
        boardType: 'all', roomType: 'multi', age: '18-35岁', personality: ['活泼开朗', '善于沟通'], keywords: ['前台接待', '沟通']
      }
    },
    {
      key: 'housekeep', name: '民宿管家 / 客房换工', sub: '打扫客房、整理布草',
      fill: {
        title: '民宿管家客房换工', workKind: 'daily',
        work: lines('打扫客房、更换床单毛巾、补充用品', '检查房间设施，发现问题及时告诉店长', '晾晒、收纳布草', '帮忙整理公共区域和小院'),
        hope: lines('做事细心、爱干净', '能接受一定的体力活'),
        dailyHours: '每天 4 小时', restMode: '5-2', minDays: 30, shiftTime: '上午退房后开始打扫',
        boardType: 'all', roomType: 'multi', age: '18-40岁', personality: ['细心耐心', '吃苦耐劳'], keywords: ['客房整理', '打扫']
      }
    },
    {
      key: 'photo', name: '摄影拍摄换工', sub: '拍房间、拍客人、修图',
      fill: {
        title: '民宿摄影换工（拍照修图）', workKind: 'photo',
        work: lines('拍民宿的房间、风景和日常照片', '帮客人拍旅行照，简单修图后发给客人', '整理照片素材，给公众号、小红书用', '每周交几组成片'),
        hope: lines('有相机或拍照好看的手机', '会用一种修图软件，有作品更好'),
        dailyHours: '每天 4 小时', restMode: '5-2', minDays: 30, shiftTime: '',
        boardType: 'all', roomType: 'multi', age: '18-35岁', personality: ['有责任心', '善于沟通'], keywords: ['摄影', '修图']
      }
    },
    {
      key: 'live', name: '直播 / 短视频换工', sub: '拍剪短视频、做直播',
      fill: {
        title: '民宿直播短视频换工', workKind: 'live',
        work: lines('拍摄、剪辑民宿日常短视频', '运营抖音、小红书等账号，定期发布内容', '配合店里直播，介绍房间和周边玩法', '回复评论和私信'),
        hope: lines('会用剪映等剪辑软件', '不怕镜头，说话清楚'),
        dailyHours: '每天 4 小时', restMode: '5-2', minDays: 30, shiftTime: '',
        boardType: 'all', roomType: 'multi', age: '18-30岁', personality: ['活泼开朗', '善于沟通'], keywords: ['直播', '剪辑', '短视频']
      }
    },
    {
      key: 'event', name: '活动策划换工', sub: '组织篝火、徒步、桌游',
      fill: {
        title: '民宿活动策划换工', workKind: 'other',
        work: lines('策划组织客人活动：篝火、徒步、桌游、电影夜', '活动前准备物料，活动时带动气氛', '拍照记录，写活动小结', '不忙的时候帮忙接待客人'),
        hope: lines('喜欢热闹，敢在人前说话', '组织过活动更好'),
        dailyHours: '每天 4 小时', restMode: '5-2', minDays: 30, shiftTime: '下午和晚上为主',
        boardType: 'all', roomType: 'multi', age: '18-35岁', personality: ['活泼开朗', '善于沟通'], keywords: ['活动策划', '组织']
      }
    },
    {
      key: 'coffee', name: '咖啡 / 吧台换工', sub: '做咖啡饮品、点单收银',
      fill: {
        title: '咖啡吧台换工', workKind: 'other',
        work: lines('做咖啡、茶饮和简单饮品', '点单、收银、招呼客人', '吧台清洁和物料盘点', '不忙的时候帮忙店里其他事'),
        hope: lines('会做咖啡更好，不会可以教', '讲卫生，手脚麻利'),
        dailyHours: '每天 4 小时', restMode: '5-2', minDays: 30, shiftTime: '',
        boardType: 'all', roomType: 'multi', age: '18-35岁', personality: ['细心耐心', '善于沟通'], keywords: ['咖啡', '调饮']
      }
    },
    {
      key: 'farm', name: '农场 / 户外换工', sub: '照顾菜园、带户外活动',
      fill: {
        title: '农场户外换工', workKind: 'other',
        work: lines('照顾菜园、果园：浇水、除草、采摘', '喂养小动物、打扫圈舍', '带客人体验农活和户外活动', '维护院子和步道'),
        hope: lines('身体健康，能接受日晒和体力活', '喜欢自然和小动物'),
        dailyHours: '每天 4 小时', restMode: '5-2', minDays: 30, shiftTime: '早上和傍晚为主，中午休息',
        boardType: 'all', roomType: 'multi', age: '18-40岁', personality: ['吃苦耐劳', '有责任心'], keywords: ['农活', '户外']
      }
    }
  ],
  parttime: [
    {
      key: 'pt-coffee', name: '咖啡店兼职', sub: '吧台出品、收银',
      fill: {
        title: '咖啡店吧台兼职', salaryType: 'daily', settleDesc: '日结',
        work: lines('做咖啡和饮品', '点单、收银', '整理座位和吧台卫生'),
        hope: lines('有咖啡店工作经验优先', '周末两天都能到岗'),
        dailyHours: '每天 6 小时', restMode: '5-2', minDays: 7, shiftTime: '',
        boardType: 'meal', roomType: '', age: '18-35岁', personality: ['细心耐心', '善于沟通'], keywords: ['咖啡', '收银']
      }
    },
    {
      key: 'pt-front', name: '民宿前台兼职', sub: '办入住、回咨询',
      fill: {
        title: '民宿前台兼职', salaryType: 'daily', settleDesc: '周结',
        work: lines('帮客人办理入住、退房', '回复线上咨询、接听电话', '整理前台和公共区域'),
        hope: lines('说话清楚、有耐心', '能按排班到岗'),
        dailyHours: '每天 6 小时', restMode: '5-2', minDays: 15, shiftTime: '',
        boardType: 'all', roomType: 'double', age: '18-35岁', personality: ['善于沟通', '有责任心'], keywords: ['前台接待', '沟通']
      }
    },
    {
      key: 'pt-clean', name: '客房保洁兼职', sub: '打扫客房、换布草',
      fill: {
        title: '民宿客房保洁兼职', salaryType: 'daily', settleDesc: '日结',
        work: lines('打扫客房、更换床单毛巾', '补充房间用品', '整理布草间'),
        hope: lines('做事细心、爱干净', '能接受体力活'),
        dailyHours: '每天 4 小时', restMode: '5-2', minDays: 7, shiftTime: '上午退房后开始',
        boardType: 'meal', roomType: '', age: '18岁以上', personality: ['细心耐心', '吃苦耐劳'], keywords: ['客房整理', '打扫']
      }
    }
  ],
  fulltime: [
    {
      key: 'ft-manager', name: '民宿店长', sub: '管运营、排房、带人',
      fill: {
        title: '民宿店长', salaryType: 'monthly', settleDesc: '月结', category: 'homestay', probation: '1个月', trainDesc: '入职有老店长带 1 周',
        work: lines('负责民宿日常运营和排房', '带换工、员工完成接待和打扫', '处理客人的问题和评价', '管理线上平台和店铺账号'),
        hope: lines('有 1 年以上民宿或酒店经验', '能长期在店'),
        dailyHours: '每天 8 小时', restMode: '6-1', minDays: 30, shiftTime: '',
        boardType: 'all', roomType: 'single', age: '18-40岁', personality: ['有责任心', '善于沟通'], keywords: ['民宿运营', '管理']
      }
    },
    {
      key: 'ft-butler', name: '民宿管家', sub: '接待客人、照看客房',
      fill: {
        title: '民宿管家', salaryType: 'monthly', settleDesc: '月结', category: 'homestay', probation: '1个月', trainDesc: '入职带薪培训 3 天，有师傅带',
        work: lines('接待客人，办理入住、退房', '照看客房卫生和用品', '回复线上咨询，给客人安排行程'),
        hope: lines('有服务行业经验优先', '能长期在店'),
        dailyHours: '每天 8 小时', restMode: '5-2', minDays: 30, shiftTime: '',
        boardType: 'all', roomType: 'double', age: '18-40岁', personality: ['细心耐心', '善于沟通'], keywords: ['前台接待', '客房整理']
      }
    },
    {
      key: 'ft-barista', name: '咖啡师', sub: '出品咖啡、打理吧台',
      fill: {
        title: '咖啡师', salaryType: 'monthly', settleDesc: '月结', category: 'food', probation: '1个月', trainDesc: '入职有咖啡出品培训',
        work: lines('出品咖啡和饮品，保证口味稳定', '吧台清洁和物料管理', '招呼客人、点单收银'),
        hope: lines('有咖啡师工作经验', '能长期在店'),
        dailyHours: '每天 8 小时', restMode: '5-2', minDays: 30, shiftTime: '',
        boardType: 'all', roomType: 'double', age: '18-35岁', personality: ['细心耐心', '有责任心'], keywords: ['咖啡', '调饮']
      }
    }
  ]
}

const GEN_KEYS = ['title', 'work', 'hope']

export const templatesOf = (kind) => JOB_TEMPLATES[kind] || []

/**
 * 按模板填表：返回新的 { form, gen }，不改传进来的。
 * opts：ages / personalities / personalityMax 是当前的岗位要求选项（后台可配），kinds 是当前启用的换工类型值；不在里面的不填（服务端会拒停用的换工类型）
 */
export function applyTemplate(form, gen, tpl, { ages = [], personalities = [], personalityMax = 3, kinds = [] } = {}) {
  const t = (tpl && tpl.fill) || {}
  const kind = form.jobType
  const volunteer = kind === 'volunteer'
  const full = kind === 'fulltime'
  const known = volunteer ? ['all', 'room'] : ['all', 'room', 'meal', 'none']
  const boardType = known.includes(t.boardType) ? t.boardType : 'all'
  const housing = volunteer || ['all', 'room'].includes(boardType)
  const next = {
    ...form,
    // 换工类型：模板的那个停用了就留着门店自己选的
    workKind: volunteer ? (kinds.includes(t.workKind) ? t.workKind : form.workKind) : form.workKind,
    minDays: Number(t.minDays) > 0 ? Number(t.minDays) : null,
    dailyHours: t.dailyHours || form.dailyHours,
    restMode: t.restMode || '',
    shiftTime: t.shiftTime || '',
    boardType,
    boardEnabled: boardType !== 'none',
    roomType: housing ? (t.roomType || '') : '',
    boardDesc: boardType !== 'none' ? (t.boardDesc || '') : '',
    // 包吃了就没有餐补（和表单 setBoard 同一条）
    mealAllowance: ['room', 'none'].includes(boardType) ? form.mealAllowance : '',
    genderPref: volunteer ? (t.genderPref || '') : '',
    age: t.age && t.age !== '不限' && ages.includes(t.age) ? t.age : '',
    personality: (t.personality || []).filter(p => personalities.includes(p)).slice(0, personalityMax),
    keywords: (t.keywords || []).map(k => String(k).trim()).filter(k => k && k.length <= 8).slice(0, 4),
    settleDesc: volunteer ? '' : (t.settleDesc || ''),
    probation: full ? (t.probation || '') : '',
    trainDesc: full ? (t.trainDesc || '') : '',
    category: full ? (t.category || '') : ''
  }
  // 兼职、全职：只换薪资类型；类型变了原来的金额就不对了，清掉让门店重填
  if (!volunteer && t.salaryType && t.salaryType !== form.salaryType) {
    next.salaryType = t.salaryType
    next.salary = ''
  }
  next.pay = next.salaryEnabled ? 'salary' : next.boardEnabled ? 'board' : 'none'
  return { form: next, gen: { ...gen, title: String(t.title || '').slice(0, 30), work: String(t.work || '').slice(0, 300), hope: String(t.hope || '') } }
}

/**
 * 「用上次的岗位」：copied 是 draftJobForm(上次那条岗位的详情) 的结果。岗位照片、到岗日期用现在表上的（照片每个岗位不一样，日期是新的）；
 * 工作地点自己选过的留着，没选就用上次的；住宿照片视频、宠物现在表上已经有就留着，没有就沿用上次的（门店的东西，传一次不容易）。
 * 换工类型停用了就不带（服务端会拒）
 */
export function mergeLastJob(current, copied, { kinds = [] } = {}) {
  const f = { ...copied.form }
  // 老岗位详情的 shiftDesc 是「每日工时（上班时段）」拼好的，带着它改了工时也不生效
  delete f.hours
  f.jobType = current.jobType
  f.images = (current.images || []).slice()
  f.startDate = current.startDate
  if (current.address) {
    f.address = current.address
    f.latitude = current.latitude
    f.longitude = current.longitude
  }
  if ((current.lodgingImages || []).length || current.lodgingVideo) {
    f.lodgingImages = current.lodgingImages.slice()
    f.lodgingVideo = current.lodgingVideo
    f.lodgingVideoCover = current.lodgingVideoCover
  }
  if (current.petStatus) {
    f.petStatus = current.petStatus
    f.petImages = (current.petImages || []).slice()
  }
  if (f.workKind && !kinds.includes(f.workKind)) f.workKind = ''
  const g = copied.gen || {}
  return { form: f, gen: { title: String(g.title || '').slice(0, 30), work: String(g.work || '').slice(0, 300), hope: String(g.hope || '') } }
}

/** 填之前 / 填之后比一比，记下改了哪些项的原值（撤销只还原这些；之后门店自己改的别的项不动） */
export function undoPatch(before, after) {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const form = {}
  const gen = {}
  for (const k of Object.keys({ ...before.form, ...after.form })) if (!same(before.form[k], after.form[k])) form[k] = before.form[k] === undefined ? undefined : JSON.parse(JSON.stringify(before.form[k]))
  for (const k of GEN_KEYS) if (!same(before.gen[k] || '', after.gen[k] || '')) gen[k] = before.gen[k] || ''
  return { form, gen }
}
