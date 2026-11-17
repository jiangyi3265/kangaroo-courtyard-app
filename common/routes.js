/** 设计图编号 → 页面路由。页面内用 ?s=N 打开第 N 屏（1–4）。 */
export const R = {
  wishes: '/pages/wish/index',
  wishPublish: '/pages/wish/publish',
  wishMine: '/pages/wish/mine',
  login: '/pages/auth/login',                 // 01 登录与微信授权
  onboarding: '/pages/auth/onboarding',       // 首页可选兴趣城市
  identity: '/pages/auth/identity',           // 独立员工身份入口
  home: '/pages/home/index',                  // 03 首页(s1) 与 AI 搜索(s2-4)
  search: '/pages/search/index',              // 普通关键词搜索：岗位 / 旅居
  city: '/pages/home/city',                   // 04 城市页(s1-2) 与智能助手(s3-4)
  jobsList: '/pages/jobs/list',               // 05 岗位分类列表（type=volunteer|parttime|fulltime|online）
  jobsFilter: '/pages/jobs/filter',           // 06 筛选抽屉/订阅/无限加载/空状态
  jobDetail: '/pages/jobs/detail',            // 07 岗位详情（4 个页签）
  jobReviews: '/pages/jobs/reviews',          // 岗位体验评价
  jobTeam: '/pages/jobs/team',                // 08 同行队伍/分享面板/海报/商家评价
  jobCompanions: '/pages/jobs/companions',    // 同一岗位主动加入的同行伙伴
  jobApply: '/pages/jobs/apply',              // 09 报名表单
  jobProgress: '/pages/jobs/progress',        // 10 审核进度与面试选择
  jobInterview: '/pages/jobs/interview',      // 11 视频面试与双向确认
  jobNotices: '/pages/jobs/notices',          // 本次报名的系统通知
  jobContract: '/pages/jobs/contract',        // 12 签约到店与保险
  jobDeliver: '/pages/jobs/deliver',          // 线上任务交付（提交成果、确认线下结算）
  legal: '/pages/auth/legal',                 // 协议与隐私全文（后台通知公告发布）
  notice: '/pages/notice/index',              // 小程序公告：?s=1 全部公告 / ?id=编号 或 ?key=online-guide 看一条（后台「小程序公告」编辑）
  staysList: '/pages/stays/list',             // 13 旅居搜索与房源列表
  stayDetail: '/pages/stays/detail',          // 14 房源详情与 Vlog
  stayBooking: '/pages/stays/booking',        // 15 房型日历与活动加购
  stayPay: '/pages/stays/pay',                // 16 订单确认与微信支付
  stayOrder: '/pages/stays/order',            // 17 入住群聊退款与核销
  stayShop: '/pages/stays/shop',              // 18 二消商品购买流程
  community: '/pages/community/index',        // 19 社区信息流与帖子
  werewolf: '/pages/werewolf/index',          // 袋鼠狼人杀，好友围桌入座
  undercover: '/pages/undercover/index',     // 谁是卧底，好友描述与投票
  publish: '/pages/community/publish',        // 20 内容发布与准入规则
  myPosts: '/pages/community/mine',           // 我的发布与审核状态
  activity: '/pages/community/activity',      // 21 活动发现与报名
  activityMine: '/pages/community/activity-mine', // 22 活动发起与我的活动
  trip: '/pages/community/trip',              // 23 行程与同行匹配
  chat: '/pages/community/chat',              // 24 私信群聊与行程分享
  userProfile: '/pages/community/user',       // 用户个人主页（?uid=）：资料、关注 / 私信、TA 的动态
  messages: '/pages/messages/index',          // 25 消息：系统通知 / 评论 / 赞三个入口 + 订单、进度、私信、群聊列表
  inbox: '/pages/notice/inbox',               // 消息分组子页：?type=system|comment|like（员工身份 system|apply|order）
  support: '/pages/notice/support',           // 客服中心：常见问题、小袋鼠助手、转人工、电话（原消息页 ?s=4）
  reminders: '/pages/messages/reminders',     // 49 三方流程提醒
  profile: '/pages/profile/index',            // 26 个人主页积分与设置
  memberBenefits: '/pages/profile/benefits',  // 成长会员的合作店权益
  invite: '/pages/profile/invite',            // 我的邀请：邀请码、分享给朋友、邀请到的人（朋友完成第一次换工 / 线上任务得积分）
  resume: '/pages/profile/resume',            // 27 简历技能与经历
  opportunities: '/pages/profile/opportunities', // 28 技能匹配与成长机会
  orders: '/pages/profile/orders',            // 29 订单评价提醒与攻略
  review: '/pages/profile/review',            // 30 AI 评价到店引导与异常
  myFollows: '/pages/profile/follows',        // 我的关注：关注的门店与门店在招岗位（?storeId= 直接看一家店）
  myIncome: '/pages/profile/income',          // 我的收入：线上任务结算单的合计与明细（只读）
  merchant: '/pages/profile/merchant',        // 成为商家：袋鼠合作介绍 + 入驻申请表（V56，后台「商家入驻申请」跟进）
  assistant: '/pages/home/assistant',         // 51 智能助手浮层与问题闭环
  staff: '/pages/staff/index',                // 31 员工工作台与任务
  staffApplications: '/pages/staff/applications', // 32 报名管理与简历转发
  staffInterviews: '/pages/staff/interviews', // 33 面试管理与保险办理
  staffRooms: '/pages/staff/rooms',           // 34 房源管理与审核
  staffJobs: '/pages/staff/jobs',             // 35 岗位管理与 AI 发布
  staffDispatch: '/pages/staff/dispatch',     // 36 调度后台
  staffActivities: '/pages/staff/activities', // 37 活动运营管理
  staffReviews: '/pages/staff/reviews',       // 38 评价运营管理
  staffInsurance: '/pages/staff/insurance',   // 39 保险与二消订单
  staffStayOrders: '/pages/staff/stay-orders', // 旅居订单台：排房 / 房态 / 办理入住退房
  staffTalents: '/pages/staff/talents',       // 40 人员与技能标签
  staffOnline: '/pages/staff/online-jobs',    // 47 线上兼职完整闭环
  staffVlog: '/pages/staff/vlog',             // 50 房源 Vlog 运营与数据
  staffBusiness: '/pages/staff/business',     // 52 员工业务中心与权限
  weekly: '/pages/manage/weekly',             // 41 代运营周报
  tasks: '/pages/manage/tasks',               // 42 下周任务与角色认证
  daily: '/pages/manage/daily',               // 43 每日经营报表
  dashboard: '/pages/manage/dashboard',       // 44 数据看板与门店排名
  wallet: '/pages/manage/wallet',             // 45 主理人钱包与分佣
  honor: '/pages/manage/honor',               // 46 主理人荣誉与关怀
  states: '/pages/notice/states'              // 48 全局组件与状态（设计样例，没有入口）
}
export default R
