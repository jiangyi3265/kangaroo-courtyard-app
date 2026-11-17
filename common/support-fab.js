// 人工客服小钮：用户端和商家端固定显示在右侧，可以聊天发图片。
// 钮画在每页都有的顶栏 components/k-topbar 里；填写屏的底部操作条 pages/staff/components/fc-kefu.vue 用的也是这里的规则。
// 这里只放判断（主包，纯函数，不 import 任何东西）。session-from 的格式和 common/support-chat.js 的 contactFrom 一样：用户编号|support-情境。

// 不出小钮的页面：登录流程、全屏选择器、客服页本身、聊天页（有输入栏，且已经在沟通）、状态样例、给亲友看的行程页
export const FAB_HIDDEN_ROUTES = [
  'pages/auth/login', 'pages/auth/identity', 'pages/auth/onboarding', 'pages/auth/legal',
  'pages/home/city-picker', 'pages/system/picker', 'pages/home/assistant',
  'pages/notice/support', 'pages/notice/states', 'pages/community/chat', 'pages/jobs/itinerary'
]

/** 用户身份一律出；员工身份只有合作商家出；登录态恢复前不出，免得老员工冷启动闪一下 */
export function fabVisible({ route, restored, mode, roleCode, dark }) {
  if (!restored || dark || !route || FAB_HIDDEN_ROUTES.includes(route)) return false
  return mode !== 'staff' || roleCode === 'merchant'
}

export const fabSessionFrom = (accountId) => String(accountId || 'guest') + '|support-fab'
