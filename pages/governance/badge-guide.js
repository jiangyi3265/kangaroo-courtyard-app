const orders = { label: '查看订单与评价', to: '/pages/profile/orders' }
const publish = { label: '发布社区内容', to: '/pages/community/publish' }
const feedback = { label: '填写意见箱', to: '#feedback' }
export function badgeGuide(d = {}) {
  if (['referrer', 'referrer_gold'].includes(d.code)) return {
    text: '从“我的邀请”邀请朋友注册。朋友完成首次有效体验后计入推荐记录，可在邀请页查看。',
    actions: [{ label: '查看我的邀请', to: '/pages/profile/invite' }]
  }
  if (['juror', 'juror_gold'].includes(d.code)) return {
    text: '到“大众评审”保存参与意愿，符合资格并收到邀请后，按时提交有效评审意见。',
    actions: [{ label: '进入大众评审', to: '/pages/governance/jury' }]
  }
  if (d.code === 'recorder') return {
    text: '持续提交有效评价、已公开的社区动态或经核验有效的意见箱反馈，按自然月累计。',
    actions: [orders, publish, feedback]
  }
  if (d.metric === 'quality' || d.code === 'review_annual') return {
    text: '完成真实服务后，从订单记录提交评价。评价经平台核验为精华后，计入对应徽章条件。',
    actions: [orders]
  }
  if (['creator', 'hot_author'].includes(d.code)) return {
    text: '发布真实的社区内容，经审核公开后，参与官方转发或本周热门评选。',
    actions: [publish]
  }
  if (d.code === 'traveler') return {
    text: '完成真实的换宿、兼职、全职或住宿体验，并通过评价和社区分享记录旅程。',
    actions: [orders, publish]
  }
  if (d.metric === 'manual') return { text: '由平台根据身份核验、任命或评选结果颁发；获得后会显示在“已获得”。', actions: [] }
  return { text: '按下方条件参与相应服务，符合条件后由系统或平台核验记录。', actions: [] }
}
