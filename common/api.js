/**
 * 业务接口清单。
 *
 * 页面只调用这里的函数，不直接拼接口路径，这样接口契约变化时只改一处。
 * 每个函数的返回值都是后端返回体（含 code/msg/data 或 rows/total）。
 */
import { get, post, request } from './request.js'
export const apiGovernanceSmsConsent = () => get('/app/governance/sms-consent')
export const apiSetGovernanceSmsConsent = enabled => post('/app/governance/sms-consent', { enabled })

// ---------------- 账号 ----------------

export const apiWxLogin = (code, profile) =>
  post('/app/auth/wx-login', { code, nickname: profile && profile.nickname, avatar: profile && profile.avatar }, { auth: false })

export const apiAccount = () => get('/app/auth/account')

export const apiLogout = () => post('/app/auth/logout')

export const apiPing = () => get('/app/auth/ping', null, { auth: false })

// ---------------- 岗位 ----------------

// 这两个接口后端是 @AppAuth(required=false)：游客能拿到岗位数据，登录用户还会拿到
// 自己的 favorite 标记。所以不能写 { auth: false } —— 那样永远不带 X-App-Token，
// 后端一律按未登录算，favorite 恒为 false，收藏状态读不回来也就取消不掉。
// request.js 是"有令牌才带、没令牌也照常发"，未登录浏览不受影响。
export const apiJobList = (params) => get('/app/job/list', params)

export const apiJobDetail = (jobId) => get('/app/job/' + jobId)

// 换工类型（日常换工 / 剪辑换工 / 摄影换工…）：运营在后台「字典管理 → 换工类型」里改，这里只取启用的 [{value, label, desc}]
export const apiJobKinds = () => get('/app/job/kinds')
// 「全职旅行」列表顶上的培训活动横幅（2026-10-18，后台「首页内容管理」栏目选「全职培训横幅」）：cities = 列表里已选的城市（逗号分隔），没有配置时 data 为空
export const apiJobTrainingBanner = (cities) => get('/app/job/training-banner', { cities: cities || undefined })

// 小程序公告（运营在后台「小程序公告」编辑）：消息页列表、详情（编号或固定标识，如 online-guide）、
// 进小程序时的弹窗（seen = 本机记下的「编号:版本」，游客靠它）、「我知道了」（要登录，游客只记在本机）
export const apiCampGroups = (params) => get('/app/camp/groups', params)
export const apiNotices = () => get('/app/notices')
export const apiNoticeDetail = (idOrKey) => get('/app/notices/' + encodeURIComponent(idOrKey))
export const apiNoticePopup = (seen) => get('/app/notices/popup', { seen })
export const apiNoticeSeen = (noticeId, version) => post('/app/notices/' + noticeId + '/seen', { version })
export const apiNoticeReplies = (id, before) => get('/app/notices/' + id + '/replies', { before })
export const apiNoticeReply = (id, payload) => post('/app/notices/' + id + '/replies', payload)
export const apiNoticeRepliesRead = (id, through) => post('/app/notices/' + id + '/replies/read', { through })

export const apiJobFavorites = () => get('/app/job/favorites')

export const apiToggleFavorite = (jobId, favorite) =>
  post('/app/job/favorite/' + jobId, null, { params: { favorite } })

// ---------------- 报名 ----------------

export const apiSubmitApplication = (payload) => post('/app/application', payload)

export const apiMyApplications = (status) => get('/app/application/mine', { status })

export const apiApplicationDetail = (appId) => get('/app/application/' + appId)
export const apiApplicationMessages = (appId, params = {}) => get('/app/application/' + appId + '/messages', params)
export const apiApplicationDates = (appId, merchant = false) => get((merchant ? '/app/staff/applications/' : '/app/application/') + appId + '/dates')
export const apiProposeApplicationDates = (appId, data) => post('/app/staff/applications/' + appId + '/dates', data)
export const apiConfirmApplicationDates = (appId, revision) => post('/app/application/' + appId + '/dates/confirm', { revision })

export const apiWithdrawApplication = (appId) => post('/app/application/' + appId + '/withdraw')

export const apiInterviewSlots = (appId) => get('/app/application/' + appId + '/slots')

export const apiBookInterview = (appId, slotId) =>
  post('/app/application/' + appId + '/book-interview', { slotId })

export const apiFinishInterview = (appId, payload) =>
  post('/app/application/' + appId + '/finish-interview', payload || {})

export const apiConfirmIntent = (appId, intent) =>
  post('/app/application/' + appId + '/confirm', { intent })


// ---------------- 消息 ----------------

// more（可选）：{ bucket, page, size }。带 bucket 时服务端只回这一组的一页，并回 hasMore（10-15 起；老接口忽略这几个参数）
export const apiMessages = (mode, category, more) => get('/app/message/list', { mode, category, ...more })

export const apiMessageSummary = (mode) => get('/app/message/summary', { mode })

export const apiUnreadCount = (mode) => get('/app/message/unread', { mode })

export const apiMarkRead = (msgId) => post('/app/message/' + msgId + '/read')

export const apiDeleteMessage = (msgId, mode) => post('/app/message/' + msgId + '/delete', null, { params: { mode } })

// bucket 为空：清掉这个身份的全部未读；带 bucket 只清这一组（进「评论」「赞」「系统通知」子页时用）。
// 老接口不认 bucket、会整个身份清掉：调用方要先确认列表回了 hasMore（服务端已分组）再带 bucket 调。
// maxId：只读掉这个消息ID及以前的，并回 unreadIds（读掉前还没读的那些ID）
export const apiMarkAllRead = (mode, bucket, maxId) => post('/app/message/read-all', null, { params: { mode, bucket, maxId } })

// ---------------- 员工工作台 ----------------

export const apiStaffStores = () => get('/app/staff/stores')

export const apiStaffApplications = (params) => get('/app/staff/applications', params)

export const apiStaffApplicationDetail = (appId) => get('/app/staff/applications/' + appId)
// 报名详情「＋技能标签」：门店给报名人加 / 删标签（action: add | remove），存人才库标记
export const apiStaffAppTag = (appId, tag, action) => post('/app/staff/applications/' + appId + '/tags', { tag, action })

export const apiStaffAudit = (appId, pass, reason) =>
  post('/app/staff/applications/' + appId + '/audit', { pass, reason })

export const apiStaffConfirm = (appId) => post('/app/staff/applications/' + appId + '/confirm')

export const apiStaffOnboard = (appId) => post('/app/staff/applications/' + appId + '/onboard')

export const apiStaffTerminate = (appId, reason) =>
  post('/app/staff/applications/' + appId + '/terminate', { reason })

// ---------------- 员工工作台·扩展（面试日程 / 保险 / 岗位 / 调度 / 门店与角色） ----------------
// storeId 由页面按"当前门店"传入，只是数据范围；服务端逐请求校验授权与角色。

export const apiStaffInterviews = (params) => get('/app/staff/interviews', params)

export const apiStaffInterviewDetail = (id) => get('/app/staff/interviews/' + id)
export const apiStaffInterviewMeeting = (id, meetingInfo) => request({ url: '/app/staff/interviews/' + id + '/meeting', method: 'PUT', data: { meetingInfo } })

export const apiStaffSlots = (storeId) => get('/app/staff/interview-slots', { storeId })
export const apiStaffAddSlot = (payload) => post('/app/staff/interview-slots', payload)
export const apiStaffCloseSlot = (id, storeId) => post('/app/staff/interview-slots/' + id + '/close', { storeId })
export const apiStaffReschedule = (id, slotId) => post('/app/staff/interviews/' + id + '/reschedule', { slotId })

export const apiStaffRateInterview = (id, rating, note) => post('/app/staff/interviews/' + id + '/rate', { rating, note })

export const apiStaffFinishInterview = (id) => post('/app/staff/interviews/' + id + '/finish')

export const apiStaffInsurance = (params) => get('/app/staff/insurance', params)

export const apiStaffInsurancePlans = () => get('/app/staff/insurance/plans')

export const apiStaffInsuranceForApp = (appId) => get('/app/staff/insurance/app/' + appId)

export const apiStaffInsuranceApply = (payload) => post('/app/staff/insurance/apply', payload)

export const apiStaffInsuranceToBuy = (storeId) => get('/app/staff/insurance/to-buy', { storeId })

export const apiStaffInsuranceApplyBatch = (storeId, appIds, planId) =>
  post('/app/staff/insurance/apply-batch', { appIds, planId }, { params: { storeId } })

// storeId 不传 = 本账号有授权的全部门店
export const apiStaffPolicies = (params) => get('/app/staff/insurance/policies', params)

export const apiStaffPolicyNotices = (applyId) => get('/app/staff/insurance/' + applyId + '/notices')

// 主理人登记保单号：服务端只认这条申请所在门店的主理人
export const apiStaffRegisterPolicy = (applyId, storeId, policyNo) =>
  request({ url: '/app/staff/insurance/applies/' + applyId + '/policy', method: 'PUT', params: { storeId }, data: { policyNo } })

export const apiStaffJobs = (params) => get('/app/staff/jobs', params)

export const apiStaffJobKeywords = () => get('/app/staff/jobs/keywords')

export const apiStaffDescribeJob = (storeId, payload) => post('/app/staff/jobs/describe', payload, { params: { storeId } })

export const apiStaffCreateJob = (storeId, payload) => post('/app/staff/jobs', payload, { params: { storeId } })

export const apiStaffBatchJobs = (storeId, jobIds, action) => post('/app/staff/jobs/batch', { jobIds, action }, { params: { storeId } })

// count=false 只取分享码、不记一次分享（打开分享面板时用）；不传 = 记一次。之前这个参数被丢掉，打开面板就给两个渠道各记了一次
export const apiStaffShareJob = (jobId, channel, count) => post('/app/staff/jobs/' + jobId + '/share', { channel, count })

export const apiStaffShareStats = (params) => get('/app/staff/jobs/share-stats', params)

export const apiDispatchBoard = (params) => get('/app/staff/dispatch/board', params)

export const apiDispatchAdjustInfo = (params) => get('/app/staff/dispatch/adjust', params)

export const apiDispatchAdjust = (payload) => post('/app/staff/dispatch/adjust', payload)

export const apiDispatchUrgentInfo = (jobId) => get('/app/staff/dispatch/urgent', { jobId })

export const apiDispatchUrgent = (payload) => post('/app/staff/dispatch/urgent', payload)

export const apiDispatchLogs = (params) => get('/app/staff/dispatch/logs', params)

export const apiDispatchUndo = (logId) => post('/app/staff/dispatch/logs/' + logId + '/undo')

export const apiDispatchExport = (params) => get('/app/staff/dispatch/logs/export', params)

export const apiStaffHub = (storeId) => get('/app/staff/team/hub', { storeId })

export const apiStaffStoreInfo = (storeId, view) => get('/app/staff/team/stores', { storeId, view })

export const apiStaffSwitchStore = (storeId) => post('/app/staff/team/switch', { storeId })

export const apiStaffRoles = (storeId, role) => get('/app/staff/team/roles', { storeId, role })

export const apiStaffGrant = (storeId, target, role) => post('/app/staff/team/grant', { target, role }, { params: { storeId } })

export const apiStaffRevoke = (storeId, grantId) => post('/app/staff/team/revoke', { grantId }, { params: { storeId } })

export const apiStaffOpLogs = (params) => get('/app/staff/team/logs', params)

export const apiStaffReportOp = (logId, reason) => post('/app/staff/team/logs/' + logId + '/report', { reason })

// ---------------- 分享回传（用户侧） ----------------

export const apiShareVisit = (code) => post('/app/share/visit', { code })

export const apiShareBind = (appId, code) => post('/app/share/bind', { appId, code })

// ---------------- 支付（共享） ----------------
// 通道由服务端决定：联调环境是 mock（不扣款），真实环境是微信支付；页面以服务端查到"已支付"为准。

export const apiPayConfig = () => get('/app/pay/config')

export const apiPayPrepay = (payNo) => post('/app/pay/' + payNo + '/prepay')

export const apiPayMockConfirm = (payNo) => post('/app/pay/' + payNo + '/mock-confirm')

export const apiPayStatus = (payNo) => get('/app/pay/' + payNo)

// ---------------- 旅居 ----------------
// 金额一律整数分（…Fen），页面用 ui.js 的 yuan() 换算。

export const apiStayCities = () => get('/app/stay/cities')

export const apiStayAreas = (city) => get('/app/stay/areas', { city })

export const apiStayList = (params) => get('/app/stay/list', params)

export const apiStayPromos = (city) => get('/app/stay/promos', { city })

export const apiStayDetail = (stayId) => get('/app/stay/' + stayId)

export const apiStayRoomTypes = (stayId, params) => get('/app/stay/' + stayId + '/room-types', params)

export const apiStayCalendar = (roomTypeId, month, promoId) => get('/app/stay/room-types/' + roomTypeId + '/calendar', { month, promoId })

export const apiStayRecommend = (roomTypeId, params) => get('/app/stay/room-types/' + roomTypeId + '/recommend', params)

export const apiStayVlogs = (stayId) => get('/app/stay/' + stayId + '/vlogs')

export const apiStayVlogOpen = (vlogId) => post('/app/stay/vlogs/' + vlogId + '/open')

export const apiStayVlogTrack = (vlogId, event) => post('/app/stay/vlogs/' + vlogId + '/track', null, { params: { event } })

export const apiStayVlogLike = (vlogId) => post('/app/stay/vlogs/' + vlogId + '/like')

export const apiStayVlogComments = (vlogId) => get('/app/stay/vlogs/' + vlogId + '/comments')

export const apiStayVlogComment = (vlogId, content) => post('/app/stay/vlogs/' + vlogId + '/comments', { content })

export const apiStayVlogReport = (commentId) => post('/app/stay/vlogs/comments/' + commentId + '/report')

export const apiStayFavorite = (stayId, favorite) => post('/app/stay/' + stayId + '/favorite', null, { params: { favorite } })

export const apiStayFavorites = (params) => get('/app/stay/favorites', params)

export const apiStayQuote = (payload) => post('/app/stay/orders/quote', payload)

export const apiStayCreateOrder = (payload) => post('/app/stay/orders', payload)

export const apiStayMyOrders = (params) => get('/app/stay/orders/mine', params)

export const apiStayCurrentOrder = () => get('/app/stay/orders/current')

export const apiStayOrder = (orderNo) => get('/app/stay/orders/' + orderNo)
export const apiStayEnrollActivity = (orderNo, activityId) => post('/app/stay/orders/' + orderNo + '/activities/' + activityId, {})

export const apiStayCancelOrder = (orderNo) => post('/app/stay/orders/' + orderNo + '/cancel')

export const apiStayRefundPreview = (orderNo) => get('/app/stay/orders/' + orderNo + '/refund-preview')

export const apiStayRefund = (orderNo, reason, expectedRefundFen) =>
  post('/app/stay/orders/' + orderNo + '/refund', { reason, expectedRefundFen })

export const apiStayRefreshCode = (orderNo) => post('/app/stay/orders/' + orderNo + '/verify-code/refresh')

// ---------------- 增值服务 ----------------

export const apiShopServices = (params) => get('/app/shop/services', params)

export const apiShopService = (serviceId) => get('/app/shop/services/' + serviceId)

export const apiShopSlots = (serviceId, stayOrderNo) => get('/app/shop/services/' + serviceId + '/slots', { stayOrderNo })

export const apiShopQuote = (payload) => post('/app/shop/orders/quote', payload)

export const apiShopCreateOrder = (payload) => post('/app/shop/orders', payload)

export const apiShopMyOrders = (params) => get('/app/shop/orders/mine', params)

export const apiShopOrder = (orderNo) => get('/app/shop/orders/' + orderNo)

export const apiShopCancelOrder = (orderNo) => post('/app/shop/orders/' + orderNo + '/cancel')

export const apiShopRefund = (orderNo, reason) => post('/app/shop/orders/' + orderNo + '/refund', { reason })

export const apiShopReschedule = (orderNo, useDate, timeSlot) => post('/app/shop/orders/' + orderNo + '/reschedule', { useDate, timeSlot })

// ---------------- 员工端旅居（房源、房态、订单、核销、退款审批） ----------------

export const apiStaffStays = (params) => get('/app/staff/stay/stays', params)

export const apiStaffStay = (stayId) => get('/app/staff/stay/stays/' + stayId)

export const apiStaffCreateStay = (storeId, payload) => post('/app/staff/stay/stays', payload, { params: { storeId } })

export const apiStaffEditStay = (stayId, payload) => request({ url: '/app/staff/stay/stays/' + stayId, method: 'PUT', data: payload })

export const apiStaffSubmitStay = (stayId) => post('/app/staff/stay/stays/' + stayId + '/submit')

export const apiStaffOfflineStay = (stayId, reason) => post('/app/staff/stay/stays/' + stayId + '/offline', { reason })

export const apiStaffStayLocation = (stayId, payload) => request({ url: '/app/staff/stay/stays/' + stayId + '/location', method: 'PUT', data: payload })
export const apiStaffStayGroup = (stayId, payload) => request({ url: '/app/staff/stay/stays/' + stayId + '/group', method: 'PUT', data: payload })

export const apiStaffRoomCalendar = (roomTypeId, month) => get('/app/staff/stay/room-types/' + roomTypeId + '/calendar', { month })

export const apiStaffSetRoomCalendar = (roomTypeId, payload) =>
  request({ url: '/app/staff/stay/room-types/' + roomTypeId + '/calendar', method: 'PUT', data: payload })

export const apiStaffCreateRoomType = (stayId, payload) => post('/app/staff/stay/stays/' + stayId + '/room-types', payload)

export const apiStaffEditRoomType = (roomTypeId, payload) =>
  request({ url: '/app/staff/stay/room-types/' + roomTypeId, method: 'PUT', data: payload })

export const apiStaffQualExpire = (stayId, type, expire) =>
  request({ url: '/app/staff/stay/stays/' + stayId + '/qualifications/' + type + '/expire', method: 'PUT', data: { expire } })

export const apiStaffStayOrders = (params) => get('/app/staff/stay/orders', params)
// 旅居订单台（员工端排房 / 房态 / 办理入住退房 / 房间床位设置）
export const apiPmsOverview = (params) => get('/app/staff/stay/pms/overview', params)
export const apiPmsOrders = (params) => get('/app/staff/stay/pms/orders', params)
export const apiPmsOrder = (orderNo) => get('/app/staff/stay/pms/orders/' + orderNo)
export const apiPmsUnitOptions = (orderNo) => get('/app/staff/stay/pms/orders/' + orderNo + '/units')
export const apiPmsAssign = (orderNo, unitIds) => post('/app/staff/stay/pms/orders/' + orderNo + '/assign', { unitIds })
export const apiPmsUnassign = (orderNo) => post('/app/staff/stay/pms/orders/' + orderNo + '/unassign')
export const apiPmsCheckIn = (orderNo) => post('/app/staff/stay/pms/orders/' + orderNo + '/check-in')
export const apiPmsCheckOut = (orderNo) => post('/app/staff/stay/pms/orders/' + orderNo + '/check-out')
export const apiPmsNote = (orderNo, note) => post('/app/staff/stay/pms/orders/' + orderNo + '/note', { note })
// 门店主动退款（只有主理人）：amountFen 分、reason 原因（客人能看到）、idemKey 这次提交的编号（连点只退一次）
export const apiPmsRefund = (orderNo, body) => post('/app/staff/stay/pms/orders/' + orderNo + '/refund', body)
export const apiPmsAutoAssign = (stayId, days) => post('/app/staff/stay/pms/auto-assign', { stayId, days })
export const apiPmsBoard = (params) => get('/app/staff/stay/pms/board', params)
export const apiPmsUnits = (stayId) => get('/app/staff/stay/pms/units', { stayId })
export const apiPmsAddUnits = (roomTypeId, names) => post('/app/staff/stay/pms/units', { roomTypeId, names })
export const apiPmsUpdateUnit = (unitId, body) => request({ url: '/app/staff/stay/pms/units/' + unitId, method: 'PUT', data: body })
export const apiPmsRemoveUnit = (unitId) => request({ url: '/app/staff/stay/pms/units/' + unitId, method: 'DELETE' })

export const apiStaffShopOrders = (params) => get('/app/staff/stay/shop-orders', params)

/** 二消订单：住宿 + 服务订单合并，tab = unused / used / refunded，biz = stay / shop，days = 1 / 7 / 30 */
export const apiStaffResaleOrders = (params) => get('/app/staff/stay/resale-orders', params)

export const apiStaffVerifyResolve = (storeId, code) => post('/app/staff/stay/verify/resolve', { code }, { params: { storeId } })

export const apiStaffVerifyConfirm = (storeId, code) => post('/app/staff/stay/verify/confirm', { code }, { params: { storeId } })

export const apiStaffRefunds = (storeId) => get('/app/staff/stay/refunds', { storeId })

export const apiStaffRefundApprove = (bizType, orderNo) => post('/app/staff/stay/refunds/approve', { bizType, orderNo })

export const apiStaffRefundReject = (bizType, orderNo, reason) => post('/app/staff/stay/refunds/reject', { bizType, orderNo, reason })

// ---------------- 员工端 Vlog ----------------

export const apiStaffVlogs = (params) => get('/app/staff/stay/vlogs', params)

export const apiStaffVlog = (vlogId) => get('/app/staff/stay/vlogs/' + vlogId)

export const apiStaffCreateVlog = (storeId, payload) => post('/app/staff/stay/vlogs', payload, { params: { storeId } })

export const apiStaffVlogApprove = (vlogId) => post('/app/staff/stay/vlogs/' + vlogId + '/approve')

export const apiStaffVlogReject = (vlogId, reason) => post('/app/staff/stay/vlogs/' + vlogId + '/reject', { reason })

export const apiStaffVlogOffline = (vlogId, reason) => post('/app/staff/stay/vlogs/' + vlogId + '/offline', { reason })

export const apiStaffVlogData = (storeId, days) => get('/app/staff/stay/vlogs/data', { storeId, days })

export const apiStaffVlogComments = (storeId, tab) => get('/app/staff/stay/vlogs/comments', { storeId, tab })

export const apiStaffVlogHandleLogs = (storeId) => get('/app/staff/stay/vlogs/handle-logs', { storeId })

export const apiStaffVlogReply = (commentId, reply) => post('/app/staff/stay/vlogs/comments/' + commentId + '/reply', { reply })

export const apiStaffVlogDraft = (commentId) => get('/app/staff/stay/vlogs/comments/' + commentId + '/draft')

export const apiStaffVlogHide = (commentId, hidden, note) => post('/app/staff/stay/vlogs/comments/' + commentId + '/hide', { hidden, note })

export const apiStaffVlogDismiss = (commentId) => post('/app/staff/stay/vlogs/comments/' + commentId + '/dismiss')

// ---------------------------------------------------------------- 社区（V10）
export const apiCommunityStatus = () => get('/app/community/status')
export const apiCommunityRules = (doc) => get('/app/community/rules/' + doc)
export const apiCommunityConsent = (doc) => post('/app/community/consent', { doc })
export const apiPhoneVerify = (code) => post('/app/auth/phone-verify', { code })
export const apiFeed = (params) => get('/app/community/feed', params)
export const apiBuddies = (params) => get('/app/community/buddies', params)
export const apiPost = (id) => get('/app/community/posts/' + id)
export const apiPostComments = (id, sort) => get('/app/community/posts/' + id + '/comments', { sort })
export const apiPostComment = (id, content, parentId, images = []) => post('/app/community/posts/' + id + '/comments', { content, parentId, images })
export const apiCommentLike = (id) => post('/app/community/comments/' + id + '/like')
export const apiCommentDelete = (id) => request({ url: '/app/community/comments/' + id, method: 'DELETE' })
// 删除自己的动态（服务端只认本人）：「我的发布」里用
export const apiPostDelete = (id) => request({ url: '/app/community/posts/' + id, method: 'DELETE' })
export const apiPostLike = (id) => post('/app/community/posts/' + id + '/like')
export const apiPostFavorite = (id) => post('/app/community/posts/' + id + '/favorite')
export const apiFollow = (uid) => post('/app/community/users/' + uid + '/follow')
export const apiBlock = (uid) => post('/app/community/users/' + uid + '/block')
export const apiReport = (targetType, targetId, reason, detail) => post('/app/community/reports', { targetType, targetId, reason, detail })
export const apiPublishPost = (payload) => post('/app/community/posts', payload)
export const apiPostEditView = (id) => get('/app/community/posts/' + id + '/edit')
export const apiEditPost = (id, data) => request({ url: '/app/community/posts/' + id, method: 'PUT', data })
export const apiMyPosts = (page) => get('/app/community/posts/mine', page ? { page } : {})
// 发布页「关联帖子」选择页（2026-10-17）：type = place 小院和门店 / job 岗位 / activity 活动，keyword、city、page。
// 原来的 apiPostRefs（/refs：自己的报名 / 住宿订单）新版发布页不用了，删掉；服务端接口留着给老版本小程序
export const apiPostLinkables = (params) => get('/app/community/linkables', params)
export const apiExperiences = () => get('/app/community/experiences')
// 社区内测建议（2026-10-11）：用户个人主页、我关注的人、我收藏的帖子、「谁可以私信我」（all 所有人 / following 我关注的人 / mutual 互相关注的人）
export const apiUserProfile = (uid, page) => get('/app/community/users/' + uid, page ? { page } : {})
export const apiFollowingUsers = () => get('/app/community/following')
export const apiPostFavorites = (page) => get('/app/community/favorites', page ? { page } : {})
export const apiDmPrivacy = () => get('/app/community/settings/dm')
export const apiSaveDmPrivacy = (value) => request({ url: '/app/community/settings/dm', method: 'PUT', data: { value } })

export const apiActivities = (params) => get('/app/activities', params)
export const apiActivityRecommend = (city) => get('/app/activities/recommend', { city })
export const apiActivity = (id, params) => get('/app/activities/' + id, params)
// 房源详情「小院活动」（2026-11-03）：这家门店主办的活动 { current 进行中, past 往期 }，游客可看、不用关注门店
export const apiStoreActivities = (storeId) => get('/app/activities/store/' + storeId)
export const apiActivitySignup = (id, channel, memberWalletId) => post('/app/activities/' + id + '/signup', { channel, memberWalletId })
export const apiActivityFavorite = (id) => post('/app/activities/' + id + '/favorite')
export const apiActivitySubscribe = (city, on) => post('/app/activities/subscribe', { city, on })
export const apiSignup = (signupId) => get('/app/activities/signups/' + signupId)
export const apiSignupCancel = (signupId, reason) => post('/app/activities/signups/' + signupId + '/cancel', { reason })
export const apiSignupHide = (signupId) => request({ url: '/app/activities/signups/' + signupId + '/record', method: 'DELETE' })
export const apiSignupRemind = (signupId, remind) => request({ url: '/app/activities/signups/' + signupId + '/remind', method: 'PUT', data: { remind } })
export const apiMyActivities = (tab) => get('/app/activities/mine', { tab })
// 我收藏的活动（后端 mine 没有 fav 页签，收藏单独走这个接口）
export const apiActivityFavorites = () => get('/app/activities/favorites')
export const apiCreateActivity = (payload) => post('/app/activities', payload)
// 发起活动勾选「同步到社区」：活动建好后发一条关联它的找搭子动态
export const apiActivitySyncCommunity = (id) => post('/app/activities/' + id + '/sync-community')
export const apiEditActivity = (id, payload) => request({ url: '/app/activities/' + id, method: 'PUT', data: payload })
export const apiManageActivity = (id) => get('/app/activities/' + id + '/manage')
export const apiManageAction = (id, action, body) => post('/app/activities/' + id + '/manage/' + action, body || {})
export const apiManagePhone = (id, signupId) => get('/app/activities/' + id + '/manage/members/' + signupId + '/phone')

export const apiTrips = (tab) => get('/app/trips', { tab })
export const apiTripDetail = (refType, refId) => get('/app/trips/detail', { refType, refId })
export const apiPublishPlan = (payload) => post('/app/trip-plans', payload)
export const apiMyPlans = () => get('/app/trip-plans/mine')
export const apiClosePlan = (planId) => post('/app/trip-plans/' + planId + '/close')
export const apiMatches = (planId) => get('/app/trip-plans/matches', { planId })
export const apiPlanPerson = (planId) => get('/app/trip-plans/' + planId + '/person')

export const apiChatOpen = (payload) => post('/app/chat/open', payload)
// 我最近的私信会话（帖子「分享到私信」时选发给谁）
export const apiChatRecent = () => get('/app/chat/recent')
export const apiChat = (convId) => get('/app/chat/' + convId)
export const apiChatMessages = (convId, after) => get('/app/chat/' + convId + '/messages', { after })
export const apiChatSend = (convId, content, clientMessageId) => post('/app/chat/' + convId + '/messages', { content, ...(clientMessageId ? { clientMessageId } : {}) })
export const apiChatDetail = (convId) => get('/app/chat/' + convId + '/detail')
export const apiChatFlag = (convId, flag, on) => request({ url: '/app/chat/' + convId + '/flags', method: 'PUT', data: { flag, on } })
export const apiChatAnnounce = (convId, text) => request({ url: '/app/chat/' + convId + '/announcement', method: 'PUT', data: { text } })
export const apiChatLeave = (convId) => post('/app/chat/' + convId + '/leave')
// 私信交换联系方式：agree=true 同意 / false 撤回自己的请求（双方都同意后手机号、微信号才显示）
export const apiChatContact = (convId, agree) => post('/app/chat/' + convId + '/contact', { agree })

export const apiStaffActivities = (params) => get('/app/staff/activities', params)
export const apiStaffActivity = (id) => get('/app/staff/activities/' + id)
export const apiStaffCreateActivity = (storeId, payload) => post('/app/staff/activities', payload, { params: { storeId } })
export const apiStaffEditActivity = (id, payload) => request({ url: '/app/staff/activities/' + id, method: 'PUT', data: payload })
export const apiStaffActivityData = (id, from, to) => get('/app/staff/activities/' + id + '/data', { from, to })
export const apiStaffActivityAction = (id, action, reason) => post('/app/staff/activities/' + id + '/action/' + action, { reason })
export const apiStaffActivityBroadcast = (id, text) => post('/app/staff/activities/' + id + '/broadcast', { text })
export const apiStaffActivityCheckin = (id, code) => post('/app/staff/activities/' + id + '/checkin', { code })
export const apiStaffActivityPhone = (id, signupId) => get('/app/staff/activities/' + id + '/members/' + signupId + '/phone')
export const apiStaffActivityRefund = (id, signupId, decision, reason) => post('/app/staff/activities/' + id + '/refunds/' + signupId + '/' + decision, { reason })

// ---------------------------------------------------------------- 用户端扩展（V11）
export const apiCities = () => get('/app/cities')
export const apiCityCoordinator = city => get('/app/cities/coordinator', { city }, { auth: false })
export const apiLocateCity = (lat, lng, accuracy, coordinateType = 'wgs84') => get('/app/cities/locate', { lat, lng, accuracy, coordinateType })
export const apiCityOverview = (city) => get('/app/cities/overview', { city })
export const apiHomeFeed = (city) => get('/app/home/feed', { city })
export const apiMemberBenefits = (params) => get('/app/member/benefits', params)
export const apiMemberBenefit = (id) => get('/app/member/benefits/' + id)
export const apiHomeMatch = (payload) => post('/app/home/match', payload)
export const apiSupportFaqs = () => get('/app/support/faqs')
export const apiSupportAsk = (payload) => post('/app/support/ask', payload)
export const apiSupportQuick = (context) => get('/app/support/quick', { context })
export const apiSupportFeedback = (logId, helpful) => post('/app/support/feedback', { logId, helpful })
export const apiSupportTicket = (payload) => post('/app/support/tickets', payload)
export const apiSupportTickets = () => get('/app/support/tickets')
export const apiSupportRate = (id, score) => post('/app/support/tickets/' + id + '/rate', { score })
export const apiResume = () => get('/app/resume')
export const apiResumeBasic = (payload) => request({ url: '/app/resume/basic', method: 'PUT', data: payload })
export const apiResumeSkills = (payload) => request({ url: '/app/resume/skills', method: 'PUT', data: payload })
export const apiResumeReuse = () => post('/app/resume/reuse')
export const apiResumeAddExp = (payload) => post('/app/resume/exps', payload)
export const apiResumeEditExp = (id, payload) => request({ url: '/app/resume/exps/' + id, method: 'PUT', data: payload })
export const apiResumeRemoveExp = (id) => request({ url: '/app/resume/exps/' + id, method: 'DELETE' })
export const apiOpportunities = (city) => get('/app/resume/opportunities', { city })
export const apiMyOrders = (tab) => get('/app/orders', { tab })
export const apiReviewsTodo = () => get('/app/reviews/todo')
export const apiReviewsMine = (featured) => get('/app/reviews/mine', { featured })
export const apiWriteReview = (payload) => post('/app/reviews', payload)
export const apiStoreReviews = (storeId, params) => get('/app/stores/' + storeId + '/reviews', params)
export const apiNotifyPrefs = () => get('/app/notify-prefs')
export const apiSetNotifyPref = (payload) => request({ url: '/app/notify-prefs', method: 'PUT', data: payload })
export const apiGuideApply = (payload) => post('/app/guide-apply', payload)
export const apiGuideStatus = () => get('/app/guide-apply')
export const apiRoute = (params) => get('/app/route', params)

// ---------------------------------------------------------------- 经营（V12）：周报 / 日报 / 看板 / 任务 / 钱包 / 荣誉 / 申报
export const apiWeekly = (params) => get('/app/manage/weekly', params)
export const apiWeeklyOpen = (payload) => post('/app/manage/weekly/open', payload)
export const apiWeeklyDetail = (id) => get('/app/manage/weekly/' + id)
export const apiWeeklySummary = (params) => get('/app/manage/weekly/summary', params)
export const apiWeeklySave = (id, payload) => request({ url: '/app/manage/weekly/' + id + '/draft', method: 'PUT', data: payload })
export const apiWeeklySubmit = (id, payload) => post('/app/manage/weekly/' + id + '/submit', payload)
export const apiDaily = (params) => get('/app/manage/daily', params)
export const apiDailyAdd = (payload) => post('/app/manage/daily/entries', payload)
export const apiDailyVoid = (id) => post('/app/manage/daily/entries/' + id + '/void')
export const apiDailySend = (payload) => post('/app/manage/daily/report/send', payload)
export const apiDashOverview = (period) => get('/app/manage/dashboard/overview', { period })
export const apiDashTrend = (params) => get('/app/manage/dashboard/trend', params)
export const apiDashRank = (params) => get('/app/manage/dashboard/rank', params)
export const apiDashReviews = (params) => get('/app/manage/dashboard/reviews', params)
export const apiDashPlan = (payload) => post('/app/manage/dashboard/improvement-plan', payload)
export const apiTasks = (params) => get('/app/manage/tasks', params)
export const apiTask = (id) => get('/app/manage/tasks/' + id)
export const apiTaskStaff = (storeId) => get('/app/manage/tasks/eligible-staff', { storeId })
export const apiTaskSave = (payload) => post('/app/manage/tasks', payload)
export const apiTaskClaim = (id) => post('/app/manage/tasks/' + id + '/claim')
export const apiTaskUnclaim = (id) => post('/app/manage/tasks/' + id + '/unclaim')
export const apiTaskCheck = (id, payload) => post('/app/manage/tasks/' + id + '/check', payload)
export const apiTaskCancel = (id, reason) => post('/app/manage/tasks/' + id + '/cancel', { reason })
export const apiWallet = () => get('/app/wallet')
export const apiWalletEntries = (params) => get('/app/wallet/entries', params)
export const apiWalletRules = () => get('/app/wallet/rules')
export const apiWalletWithdraws = () => get('/app/wallet/withdraws')
export const apiWalletWithdraw = (payload) => post('/app/wallet/withdraw', payload)
export const apiPoints = () => get('/app/points')
export const apiHonor = () => get('/app/honor')
export const apiHonorGrowth = () => get('/app/honor/growth')
export const apiHonorBirthday = () => get('/app/honor/birthday')
export const apiSetBirthday = (birthday) => request({ url: '/app/honor/birthday', method: 'PUT', data: { birthday } })
export const apiClaimGift = (payload) => post('/app/honor/birthday/claim', payload)
export const apiAppealOptions = () => get('/app/appeal/options')
export const apiAppeal = (payload) => post('/app/appeal', payload)

// ---------------------------------------------------------------- 员工端扩展（V13）：评价运营 / 人才库 / 线上任务
export const apiStaffReviews = (params) => get('/app/staff/reviews', params)
export const apiStaffReview = (id) => get('/app/staff/reviews/' + id)
export const apiStaffReviewNote = (id, note) => request({ url: '/app/staff/reviews/' + id + '/note', method: 'PUT', data: { note } })
export const apiStaffReviewDraft = (id, tone, seed) => get('/app/staff/reviews/' + id + '/draft', { tone, seed })
export const apiStaffReviewReply = (id, content) => post('/app/staff/reviews/' + id + '/reply', { content })
export const apiStaffReviewFeature = (id, payload) => post('/app/staff/reviews/' + id + '/feature', payload)
export const apiStaffReviewReport = (id, reason) => post('/app/staff/reviews/' + id + '/report', { reason })
export const apiTalentTags = (storeId) => get('/app/staff/talents/tags', { storeId })
export const apiTalentSearch = (filters, countOnly, storeId) => request({ url: '/app/staff/talents/search?countOnly=' + (countOnly ? 'true' : 'false') + (storeId ? '&storeId=' + storeId : ''), method: 'POST', data: filters })
export const apiTalentJobs = (storeId) => get('/app/staff/talents/jobs', { storeId })
export const apiTalent = (userId, storeId) => get('/app/staff/talents/' + userId, { storeId })
export const apiTalentMark = (userId, payload, storeId) => request({ url: '/app/staff/talents/' + userId + '/mark' + (storeId ? '?storeId=' + storeId : ''), method: 'POST', data: payload })
export const apiTalentInvite = (userId, jobId, storeId) => request({ url: '/app/staff/talents/' + userId + '/invite' + (storeId ? '?storeId=' + storeId : ''), method: 'POST', data: { jobId } })
export const apiOnlineTasks = (storeId) => get('/app/staff/online/tasks', { storeId })
export const apiOnlineCreate = (payload, storeId) => request({ url: '/app/staff/online/tasks' + (storeId ? '?storeId=' + storeId : ''), method: 'POST', data: payload })
export const apiOnlineTask = (jobId, storeId) => get('/app/staff/online/tasks/' + jobId, { storeId })
export const apiOnlineAssignments = (jobId, storeId) => get('/app/staff/online/tasks/' + jobId + '/assignments', { storeId })
export const apiOnlineAssignment = (appId) => get('/app/staff/online/assignments/' + appId)
export const apiOnlineAccept = (appId, comment, qualifiedCount) => post('/app/staff/online/assignments/' + appId + '/accept', { comment, qualifiedCount })
export const apiOnlineReturn = (appId, reason) => post('/app/staff/online/assignments/' + appId + '/return', { reason })
export const apiOnlinePayout = (appId, payload) => post('/app/staff/online/assignments/' + appId + '/payout', payload)
export const apiMyOnline = (appId) => get('/app/online/assignments/' + appId)
export const apiOnlineSubmit = (appId, payload) => post('/app/online/assignments/' + appId + '/submit', payload)
export const apiOnlineConfirm = (appId, received, reason) => post('/app/online/assignments/' + appId + '/confirm', { received, reason })
export const apiLegal = (key) => get('/app/legal/' + key)
export const apiJobTeam = (jobId) => get('/app/jobs/' + jobId + '/team')
export const apiJoinTeam = (jobId, visible) => post('/app/jobs/' + jobId + '/team', { visible })
export const apiJobSubs = () => get('/app/job-subscriptions')
export const apiAddJobSub = (payload) => post('/app/job-subscriptions', payload)
export const apiEditJobSub = (id, payload) => request({ url: '/app/job-subscriptions/' + id, method: 'PUT', data: payload })
export const apiRemoveJobSub = (id) => request({ url: '/app/job-subscriptions/' + id, method: 'DELETE' })
export const apiJobSearch = (payload) => post('/app/jobs/search', payload)
export const apiContract = (appId) => get('/app/application/' + appId + '/contract')
export const apiContractSign = (appId, payload) => post('/app/application/' + appId + '/contract/sign', payload)
export const apiSaveArrival = (appId, payload) => request({ url: '/app/application/' + appId + '/arrival', method: 'PUT', data: payload })

// ---------------------------------------------------------------------------
// 「我的」页的账号能力：资料、黑名单、授权、设备、实名、积分、导出、注销
// ---------------------------------------------------------------------------
export const apiMeProfile = () => get('/app/me/profile')
export const apiSaveMeProfile = (payload) => post('/app/me/profile', payload)
export const apiMePoints = (page) => get('/app/me/points', { page: page || 1 })
export const apiMeBlocks = () => get('/app/me/blocks')
export const apiMeUnblock = (uid) => post('/app/me/blocks/' + uid + '/remove')
export const apiMeAuthorizations = () => get('/app/me/authorizations')
export const apiMeWithdrawConsent = (doc) => post('/app/me/consent/withdraw', { doc })
export const apiMeSessions = () => get('/app/me/sessions')
export const apiMeRevokeOthers = () => post('/app/me/sessions/revoke-others')
export const apiMeRevokeSession = (id) => post('/app/me/sessions/revoke', { id })
export const apiMeSmsSend = (phone, scene) => post('/app/me/sms/send', { phone, scene: scene || 'bind' })
export const apiMeRealName = (name, idNo) => post('/app/me/real-name', { name, idNo })
export const apiMeDeactivation = () => get('/app/me/deactivation')
export const apiMeDeactivate = (confirm, reason) => post('/app/me/deactivate', { confirm, reason })
// 成为商家（V56）：我最近一份入驻申请（latest 为 null = 还没交过）+ 店铺类型 / 想招的人两组选项；提交入驻申请
export const apiMerchantApply = () => get('/app/merchant/apply')
export const apiSubmitMerchantApply = (payload) => post('/app/merchant/apply', payload)

// 积分与邀请：我的邀请、绑定邀请人、加急投递（花积分）、员工确认换工完成（发积分）
export const apiMyInvite = () => get('/app/me/invite')
export const apiBindInviter = (code) => post('/app/me/inviter', { code })
export const apiUrgentInfo = (appId) => get('/app/applications/' + appId + '/urgent')
export const apiUrgentApply = (appId) => post('/app/applications/' + appId + '/urgent')
export const apiStaffVolunteerDone = (appId, days) => post('/app/staff/applications/' + appId + '/volunteer-done', { days })

// 通知偏好（提醒页设置屏）
export const apiNotifySettings = () => get('/app/notify-settings')
export const apiSaveNotifySettings = (payload) => post('/app/notify-settings', payload)

// 关注门店 / 服务收藏 / 面试改期
export const apiFollowStore = (storeId, follow) => post('/app/stores/' + storeId + '/follow?follow=' + (follow ? 'true' : 'false'))
// 我的关注：关注的门店列表 / 某家门店的在招岗位（游客也能看）
export const apiMyFollows = () => get('/app/me/follows')
export const apiStoreJobs = (storeId) => get('/app/stores/' + storeId + '/jobs')
// 我的收入：线上任务结算单的合计与明细（只读）。status = all | pending | confirmed | disputed
export const apiMyIncome = (params) => get('/app/me/income', params)
// 员工端线上任务「发素材」：{ content, images: [平台图片地址] }，返回最新的接单记录
export const apiOnlineSendMaterial = (appId, payload) => post('/app/staff/online/assignments/' + appId + '/materials', payload)
export const apiFavoriteService = (serviceId, favorite) => post('/app/shop/services/' + serviceId + '/favorite?favorite=' + (favorite ? 'true' : 'false'))
export const apiServiceFavorites = () => get('/app/shop/favorites')
export const apiRescheduleInterview = (appId, slotId, reason) => post('/app/application/' + appId + '/reschedule-interview', { slotId, reason })

// 门店工作台
export const apiWorkbenchHome = (storeId) => get('/app/staff/workbench/home', { storeId })
export const apiWorkbenchTodos = (params) => get('/app/staff/workbench/todos', params)
export const apiWorkbenchTodo = (key, storeId) => get('/app/staff/workbench/todo', { key, storeId })
export const apiWorkbenchMetrics = (storeId) => get('/app/staff/workbench/metrics', { storeId })
export const apiWorkbenchAssign = (key, ownerId, storeId) => post('/app/staff/workbench/assign', { key, ownerId, storeId })
export const apiWorkbenchNote = (key, note, storeId) => post('/app/staff/workbench/note', { key, note, storeId })
export const apiWorkbenchDigest = (storeId) => post('/app/staff/workbench/digest', { storeId })
export const apiResumeForwards = (appId, storeId) => get('/app/staff/workbench/forwards', { appId, storeId })
export const apiResumeForwardStores = (storeId, q) => get('/app/staff/workbench/forward-stores', { storeId, q })
export const apiSharedResume = (id) => get('/app/staff/workbench/shared-resume/' + id)
export const apiResumeForward = (payload) => post('/app/staff/workbench/forward', payload)
export const apiResumePoster = (appId, storeId) => get('/app/staff/workbench/resume-poster', { appId, storeId })
export const apiSupportContact = () => get('/app/support/contact')

// 微信订阅消息（一次性授权：授权一次只能发一条）
export const apiSubscribeStatus = () => get('/app/subscribe/status')
export const apiSubscribePrepare = () => post('/app/subscribe/prepare', {})
export const apiSubscriptionMessage = (id, mode) => get('/app/message/subscription/' + id, { mode })
export const apiSubscribeAccept = (results) => post('/app/subscribe/accept', results)
export const apiSubscribeRevoke = (bizKey) => post('/app/subscribe/revoke', { bizKey })

// Current DB-authorized online reception settings, separate from hiring grants.
export const apiChatReception = storeId => get('/app/staff/chat-reception', { storeId })
export const apiChatReceptionSave = (storeId, userIds) => request({url:'/app/staff/chat-reception?storeId=' + encodeURIComponent(storeId), method:'PUT', data:{ userIds }})

// 2026-11-03 主人：活动签到二维码生成失败 —— 签到码按小程序版本生成，带普通二维码 / 6 位活动签到码兜底
export const apiStaffActivityCheckinCode = (id, env) => get('/app/staff/activities/' + id + '/checkin-code', { env })
export const apiActivityCheckinCode = (id, env) => get('/app/activities/' + id + '/manage/checkin-code', { env })
export const apiActivityCheckinPin = (id, code) => post('/app/activities/' + id + '/checkin-pin', { code })

// 2026-11-03 主人：「历史聊天记录，永久保存，不能删除」—— AI袋鼠聊天记录（V72），只有查看和追加，没有删除接口
export const apiSupportHistory = (before) => get('/app/support/history', before ? { before } : {})
export const apiSupportFaqRead = (faqId, context) => post('/app/support/faq-read', { faqId, context })

// Membership wallet: actions are explicit and server-authorized.
export const apiMemberWallet = () => get('/app/member/wallet')
export const apiMemberPins = () => get('/app/member/pins')
export const apiMemberCases = () => get('/app/member/cases')
export const apiMemberAction = (action, data) => {
  const [kind,id]=action.split('/')
  const paths={claim:'/wallet/claim',redeem:'/wallet/redeem',gift:'/wallet/gift',request:'/requests',pin:'/pins',undo:'/wallet/'+id+'/undo',cancel:'/requests/'+id+'/cancel',appeal:'/cases/'+id+'/appeal'}
  if(!paths[kind]) return Promise.reject(new Error('操作无效'))
  return post('/app/member'+paths[kind],data)
}
