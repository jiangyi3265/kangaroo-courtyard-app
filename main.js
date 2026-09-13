import App from './App'
import { hasStaffAccess } from './common/experience.js'

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
	createSSRApp
} from 'vue'
export function createApp() {
	const app = createSSRApp(App)
	app.mixin({
		onLoad() {
			const route = getCurrentPages().pop()?.route || ''
			if (/^pages\/(staff|manage)\//.test(route) && !hasStaffAccess.value) {
				uni.redirectTo({ url: '/pages/auth/identity' })
			}
		}
	})
	return {
		app
	}
}
// #endif
