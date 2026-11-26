<script>
	import { watch } from 'vue'
	import { subscriptionScope, visitSubscriptions } from './common/visit-subscriptions.js'
	import { ensureSession } from './common/experience.js'
	import { noteInviter } from './common/invite.js'
	import { installBackGuard } from './common/back-guard.js'
	import { startNewsPolling, stopNewsPolling } from './common/news-toast.js'
	import { API_BASE } from './common/config.js'
	import { startFeaturePolling, stopFeaturePolling } from './common/features.js'
	import { startStaffTaskReminders, stopStaffTaskReminders } from './common/staff-task-reminder.js'

	// 从朋友分享的页面进来（任意页面带 ?inviter=邀请码）：记下邀请码，已登录就等登录态恢复后交给服务端绑定，没登录的登录后再绑。
	// 之前只有刚记下新码时才去问；现在启动、切回前台时，本机还有没得到明确答复的码（上次碰上服务器出错 / 太频繁 / 没网）也再问一次，
	// 同一时间最多一个请求（见 common/invite.js）
	export default {
		onLaunch: function(options) {
			// 冷启动用本机令牌恢复登录态；令牌失效时静默回到游客态，不打断启动
			ensureSession()
			noteInviter(options, ensureSession)
			// #ifdef MP-WEIXIN
			watch(subscriptionScope, () => visitSubscriptions.warm(), { immediate: true })
			// 页内分屏时系统返回不再直接退出小程序（见 common/back-guard.js）
			installBackGuard()
			// 微信下载好新版本后提示重启；不重启的话下次冷启动也会用上新版
			if (wx.getUpdateManager) {
				const updater = wx.getUpdateManager()
				updater.onUpdateReady(() => wx.showModal({
					title: '有新版本', content: '新版本已准备好，重启小程序后生效。', confirmText: '重启', cancelText: '稍后',
					success: (r) => { if (r.confirm) updater.applyUpdate() }
				}))
			}
			// 标题字体（思源黑体 粗体 / 特粗，见 styles/theme.scss 的 --k-display-font）：文件只放在网页版里（static/h5/fonts），小程序从线上加载、全局生效；
			// 加载完之前和加载失败时都用系统黑体，不影响使用
			if (wx.loadFontFace && /^https:/.test(API_BASE)) {
				[['700', 'kg-sans-bold'], ['900', 'kg-sans-heavy']].forEach(([weight, file]) => wx.loadFontFace({
					global: true, family: 'KG Sans', source: 'url("' + API_BASE + '/static/h5/fonts/' + file + '.woff2")', desc: { weight }, scopes: ['webview', 'native'],
					fail: () => {}
				}))
				// 与详情页 H5 字体映射一致，避免真机正文退回设备字体而改变换行和卡片高度。
				const detailFonts = [['400', 'kg-detail-medium'], ['500', 'kg-detail-medium'], ['600', 'kg-detail-medium'], ['700', 'kg-sans-bold'], ['900', 'kg-sans-heavy']]
				detailFonts.forEach(([weight, file]) => wx.loadFontFace({
					global: true, family: 'KG Detail', source: 'url("' + API_BASE + '/static/h5/fonts/' + file + '.woff2")', desc: { weight }, scopes: ['webview', 'native'],
					fail: () => {}
				}))
			}
			// #endif
		},
		onShow: function(options) {
			// #ifdef MP-WEIXIN
			visitSubscriptions.warm()
			// #endif
			startFeaturePolling()
			console.log('App Show')
			noteInviter(options, ensureSession)
			// 在前台时每 60 秒查一次未读数，有新消息在顶栏下面提示 3 秒（见 common/news-toast.js）；切到后台就停
			startNewsPolling()
			startStaffTaskReminders()
		},
		onHide: function() {
			// #ifdef MP-WEIXIN
			visitSubscriptions.endVisit()
			// #endif
			stopFeaturePolling()
			console.log('App Hide')
			stopNewsPolling()
			stopStaffTaskReminders()
		}
	}
</script>

<style lang="scss">
	@import './styles/theme.scss';
	@import './styles/user-surface.scss';
	/* #ifdef MP-WEIXIN */
	/* 返回拦截用的隐形 page-container（见 common/back-guard.js）显示时，微信基础库会给页面 body 写行内样式
	   position: fixed + top: -滚动距离 来锁住页面滚动（togglePageScroll）——结果所有带返回箭头的页内分屏都滑不动：
	   房态日历下面的「下一步」够不着、申请接单的说明框卡在「下一步」按钮底下。这里用 !important 盖掉那两条行内样式，页面照常滚动。
	   （WXSS 的 page 选择器编译后就是 body） */
	page {
		position: static !important;
		top: auto !important;
	}
	/* #endif */
	/* #ifdef H5 */
	// 框架的离屏导航阴影预加载不参与页面展示，避免启动后请求外部装饰图片。
	body::after {
		animation: none !important;
	}
	/* #endif */
</style>
