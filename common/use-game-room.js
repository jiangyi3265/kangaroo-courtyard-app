import { ref, watch } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { ensureSession, experience } from '@/common/experience.js'
import { getToken } from '@/common/request.js'

export function useGameRoom(code, api, onUpdate = () => {}, options = {}) {
	const { readRoom, command, requestId } = api
	const room = ref(null)
	const error = ref('')
	const loading = ref(true)
	const pageActive = ref(false)
	const busy = ref(false)
	const now = ref(Date.now())
	let offset = 0
	let active = false
	let sessionReady = false
	let activation = 0
	let epoch = 0
	let timer
	let clock
	let pending = null
	let reading = null
	let actionSequence = 0
	const current = (scope) => active && sessionReady && epoch === scope.epoch && code.value === scope.code && getToken() === scope.token
	const capture = () => ({ epoch, token: getToken(), code: code.value })
	const accept = (data) => {
		if (!room.value || data.version > room.value.version || (data.version === room.value.version && data.serverTime >= room.value.serverTime)) {
			room.value = data
			offset = data.serverTime - Date.now()
			now.value = Date.now() + offset
			onUpdate(data)
		}
		error.value = ''
	}
	async function refresh() {
		clearTimeout(timer)
		if (!active || !sessionReady) return
		if (!code.value) { loading.value = false; return }
		if (reading && reading.epoch === epoch) return reading.promise
		if (!room.value) loading.value = true
		const scope = capture()
		const flight = { epoch, promise: null }
		reading = flight
		flight.promise = (async () => {
		try {
			const data = await readRoom(scope.code)
			if (current(scope)) accept(data)
		} catch (e) {
			if (current(scope)) error.value = e.message || '房间同步失败，请重试'
		} finally {
			if (reading === flight) reading = null
			if (active && epoch === scope.epoch) {
				loading.value = false
				timer = setTimeout(refresh, error.value ? 4000 : (options.pollMs || 2000))
			}
		}
		})()
		return flight.promise
	}
	async function act(action, data = {}) {
		if (!active || !sessionReady || !code.value || busy.value) return null
		const scope = capture()
		const sequence = ++actionSequence
		const payload = { phaseToken: room.value?.phaseToken || '', ...data }
		const signature = action + JSON.stringify(payload)
		if (!pending || pending.signature !== signature) pending = { signature, id: requestId() }
		busy.value = true
		try {
			const result = await command(scope.code, action, payload, pending.id)
			if (!current(scope)) return null
			pending = null
			accept(result)
			return result
		} catch (e) {
			if (current(scope)) {
				error.value = e.message || '操作失败，请重试'
				if (e.code > 0) pending = null
				uni.showToast({ title: error.value, icon: 'none' })
			}
			return null
		} finally {
			if (epoch === scope.epoch && sequence === actionSequence) busy.value = false
		}
	}
	function stop() {
		active = false
		sessionReady = false
		activation++
		pageActive.value = false
		epoch++
		clearTimeout(timer)
		clearInterval(clock)
		reading = null
		actionSequence++
		busy.value = false
	}
	function invalidateRoom() {
		epoch++
		clearTimeout(timer)
		reading = null
		room.value = null
		error.value = ''
		pending = null
		busy.value = false
		loading.value = Boolean(code.value)
		if (active && sessionReady) refresh()
	}
	// 分享冷启动和页面恢复时，onShow 可能先于 onLoad 的房号赋值。
	// 房号真正到达后再读取，并丢弃上一房间迟到的响应。
	watch(() => code.value, (value, previous) => {
		if (value !== previous) invalidateRoom()
	})
	watch(
		() => experience.account?.id,
		(id, previous) => {
			if (id !== previous) invalidateRoom()
		}
	)
	onShow(async () => {
		stop()
		active = true
		pageActive.value = true
		const generation = activation
		try { await ensureSession() } catch (e) {
			if (active && generation === activation) { sessionReady = true; loading.value = false; error.value = e.message || '房间恢复失败，请重试' }
			return
		}
		if (!active || generation !== activation) return
		sessionReady = true
		room.value = null
		loading.value = Boolean(code.value)
		refresh()
		clock = setInterval(() => {
			now.value = Date.now() + offset
		}, 500)
	})
	onHide(stop)
	onUnload(stop)
	return { room, error, loading, busy, now, refresh, act, stop, pageActive }
}
