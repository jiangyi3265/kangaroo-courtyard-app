import App from './App'
import { ensureSession, experience, hasStaffAccess, refreshUnread, currentStaffStore, staffStores } from './common/experience.js'
import { pendingStaffRoute } from './common/staff-scope.js'
import { hasStaffTaskRole } from './common/staff-task-reminder.js'
import { refreshFeatures } from './common/features.js'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
App.mpType = 'app'
const app = new Vue({
	...App
})
app.$mount()
// #endif

// #ifdef VUE3
import {
	createSSRApp, computed
} from 'vue'
import { isUserIconPage, userIconScope } from './common/user-icons/scope.js'
// tabbar 红点取自服务端未读数，但只有消息中心和个人中心会拉全量消息列表。
// 每次页面显示时补一次轻量刷新，用户才可能在首页或岗位列表上看到
// 「报名审核通过、24 小时内选面试时间」这类有时限的通知。
let unreadPending = false

function refreshUnreadQuietly() {
	// 全局 mixin 在一次页面切换里可能被多个实例触发，用 in-flight 标记合并成一次请求
	if (unreadPending) return
	unreadPending = true
	ensureSession()
		.then(() => {
			// 未登录、或本机预览账号（服务端上没有消息）时不发请求
			if (!experience.account || experience.account.preview) return null
			return refreshUnread()
		})
		// 静默失败：红点刷不出来不该弹提示，更不该挡住页面渲染
		.catch(() => {})
		.then(() => { unreadPending = false })
}

export function createApp() {
	const app = createSSRApp(App)
	// 用户页面在自己的最外层绑定此类；同一页面切到员工身份时恢复原主题。
	Object.defineProperty(app.config.globalProperties, '$userSurface', {
		get: () => experience.mode === 'staff' ? '' : 'user-surface'
	})
	app.mixin({
		provide() {
			if (this.$mpType !== 'page') return {}
			// Bind to the owning page so an overlay or a page underneath it keeps its own icons.
			const route = this.$scope?.route || this.route || this.$scope?.is
			return { [userIconScope]: computed(() => isUserIconPage(route) && experience.mode !== 'staff') }
		},
		onShow() {
			refreshFeatures()
			refreshUnreadQuietly()
		},
		async onLoad(q) {
			const route = getCurrentPages().pop()?.route || ''
			if (!/^pages\/(staff|manage)\//.test(route)) return
			// 冷启动时登录态是异步恢复的，必须等恢复完成再判定，
			// 否则持有有效令牌的员工会在进入工作台的瞬间被误踢到身份页。
			await ensureSession()
			// 保险付款归属本人；员工授权撤销后仍可查本人余额和申请退费，办理权限由保险接口校验。
			if (route === 'pages/staff/insurance-account' && experience.account) return
			// 消息点开带 ?storeId=：账号在那家店有授权就按那家店的角色判（页面随后自己切过去）。先按当前门店判的话，一人几个身份时会被送回工作台，丢了门店和需求编号
			const grant = (q?.storeId && staffStores.value.find(g => String(g.storeId) === String(q.storeId))) || currentStaffStore.value
			const role = grant?.roleCode
            // 管理员任务会派给 换工主理人 / 小院主理人 / 线上专员 / 商家服务人 / 城市负责人（与工作台入口、后端 @AppAuth 一致），有其中任一授权就放行
            // 本城还没有门店的城市授权也能被派任务（后端 cityGrant 放行），所以放在「门店开通后才能用」的拦截前面
            const managerTask = route === 'pages/staff/platform-tasks' && hasStaffTaskRole(experience.account?.staffGrants)
            if (!managerTask && pendingStaffRoute(route, grant)) {
                uni.redirectTo({ url: '/pages/staff/index' })
                uni.showToast({ title: '本城还没有开通门店，门店开通并授权后可使用该业务', icon: 'none' })
                return
            }
			if (['staff', 'manager'].includes(role) && ['pages/staff/rooms','pages/staff/stay-orders'].includes(route)) {
                uni.showToast({title:'当前角色没有旅居管理权限', icon:'none'}); uni.redirectTo({url:'/pages/staff/index'}); return
            }
            if (['manager', 'staff'].includes(role) && route === 'pages/staff/online-jobs') { uni.showToast({title:'当前角色不使用线上任务管理',icon:'none'}); uni.redirectTo({url:'/pages/staff/index'}); return }
			// 2026-11-03 主人：简化商家端。商家点到没权限的页（老链接、内部按钮）被送回首页时说一句，不再悄悄跳走；toast 失败（页面还没就绪）不影响跳转
			if (!managerTask && role === 'merchant' && !['pages/staff/index','pages/staff/business','pages/staff/merchant-request','pages/staff/applications','pages/staff/jobs','pages/staff/online-jobs','pages/staff/interviews','pages/staff/insurance','pages/staff/rooms','pages/staff/stay-orders','pages/staff/room-types','pages/staff/vlog','pages/staff/settlements','pages/staff/publication-fees','pages/staff/activities','pages/staff/activity-members','pages/staff/reviews'].includes(route)) { uni.redirectTo({url:'/pages/staff/index'}); try { uni.showToast({ title: '商家身份没有这个页面', icon: 'none' }) } catch (e) { /* 页面未就绪时 toast 可能报错，不管 */ } return }
			if (!managerTask && ((role === 'merchant_service' && !['pages/staff/index','pages/staff/business','pages/staff/service','pages/staff/service-activities','pages/staff/online-daily','pages/staff/applications','pages/staff/online-jobs'].includes(route)) || (role === 'city_lead' && !['pages/staff/index','pages/staff/business','pages/staff/operations','pages/staff/city','pages/staff/city-finance','pages/manage/wallet','pages/manage/honor'].includes(route) && grant?.fullAccess !== true))) { uni.redirectTo({url:'/pages/staff/index'}); return }
			if (!managerTask && role === 'online_staff' && !['pages/staff/index', 'pages/staff/business', 'pages/staff/applications', 'pages/staff/online-jobs'].includes(route)) {
				uni.redirectTo({ url: '/pages/staff/index' })
				return
			}
			// 门店任务页也给没有员工授权的在店义工用（只显示义工任务，服务端按入职记录判权），不送去员工入口
			if (!hasStaffAccess.value && !(route === 'pages/manage/tasks' && experience.account)) {
				uni.redirectTo({ url: '/pages/auth/identity' })
			}
		}
	})
	return {
		app
	}
}
// #endif
