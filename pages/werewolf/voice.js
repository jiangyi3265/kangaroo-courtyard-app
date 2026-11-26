import { API_BASE } from '@/common/config.js'
import { getToken } from '@/common/request.js'
import { uploadTo } from '@/common/upload.js'
import { partyCode as roomCode } from '@/common/party-code.js'

// #ifdef MP-WEIXIN
let nativeRecorder = null
let nativeOwner = null
function getNativeRecorder() {
	if (!nativeRecorder) {
		nativeRecorder = uni.getRecorderManager()
		nativeRecorder.onStart(() => nativeOwner?.started())
		nativeRecorder.onStop((result) => {
			const owner = nativeOwner
			nativeOwner = null
			owner?.stopped(result)
		})
		nativeRecorder.onError(() => {
			const owner = nativeOwner
			nativeOwner = null
			owner?.failed()
		})
	}
	return nativeRecorder
}
// #endif

export const requestId = () => 'voice_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,12)
const voiceGame = game => game === 'party' || game === 'undercover' ? game : 'werewolf'

export const sendVoice = (code, filePath, data, game = 'werewolf') =>
	uploadTo(`/app/${voiceGame(game)}/rooms/${roomCode(code)}/voice`, filePath, data)

export function createVoicePlayer() {
	// #ifdef H5
	const audio = new Audio()
	let disposed = false, failed = () => {}
	return {
		set src(value) { audio.src = value },
		set volume(value) { audio.volume = value },
		set loop(value) { audio.loop = value },
		onPlay(callback) { audio.onplaying = callback },
		onEnded(callback) { audio.onended = callback },
		onError(callback) { failed = callback; audio.onerror = callback },
		play() { audio.play().catch(error => { if (!disposed) failed(error) }) },
		stop() { audio.pause() },
		pause() { audio.pause() },
		destroy() { disposed = true; audio.onplaying = audio.onended = audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load() }
	}
	// #endif
	// #ifdef MP-WEIXIN
	return uni.createInnerAudioContext()
	// #endif
}

export async function loadVoice(code, id, game = 'werewolf') {
	const token = getToken()
	const response = await new Promise((resolve, reject) =>
		uni.request({
			url: API_BASE + `/app/${voiceGame(game)}/rooms/${roomCode(code)}/voice/${encodeURIComponent(id)}`,
			responseType: 'arraybuffer',
			header: { 'X-App-Token': token },
			success: resolve,
			fail: () => reject(new Error('语音读取失败，请重试'))
		})
	)
	if (token !== getToken()) throw new Error('登录状态已变化')
	const headers = response.header || {}
	const key = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type')
	const mime = String(headers[key] || '').split(';')[0]
	const extensions = {
		'audio/mpeg': 'mp3',
		'audio/mp4': 'm4a',
		'audio/webm': 'webm',
		'audio/wav': 'wav'
	}
	if (response.statusCode !== 200 || !extensions[mime])
		throw new Error('语音已过期或暂时无法播放')
	// #ifdef H5
	const url = URL.createObjectURL(new Blob([response.data], { type: mime }))
	return { url, release: () => URL.revokeObjectURL(url) }
	// #endif
	// #ifdef MP-WEIXIN
	const fs = uni.getFileSystemManager()
	const url = wx.env.USER_DATA_PATH + '/werewolf-voice-' + Date.now() + '.' + extensions[mime]
	await new Promise((resolve, reject) =>
		fs.writeFile({
			filePath: url,
			data: response.data,
			success: resolve,
			fail: () => reject(new Error('语音暂存失败'))
		})
	)
	return { url, release: () => fs.unlink({ filePath: url, fail: () => {} }) }
	// #endif
}

/** A recorder instance owns its resources. Closing a page cancels a pending permission request too. */
export function recorder(onComplete, onError, onStarted = () => {}) {
	let pressed = false
	let startedAt = 0
	let recording = null
	let stream = null
	let timeout
	let cancelled = false
	let maxSeconds = 60
	let attempt = 0
	const stopTracks = () => {
		stream?.getTracks?.().forEach((track) => track.stop())
		stream = null
	}
	const complete = (file, release = () => {}, elapsed = Date.now() - startedAt) => {
		const duration = Math.max(1, Math.min(60, Math.round(elapsed / 1000)))
		if (cancelled) {
			release()
			return
		}
		if (elapsed < 1000) {
			release()
			onError(new Error('录音太短，请至少说1秒'))
			return
		}
		onComplete({ file, duration, release })
	}
	// The native recorder is a singleton. One listener set routes events to its current owner.
	// #ifdef MP-WEIXIN
	const nativeCallbacks = {
		started() {
			startedAt = Date.now()
			onStarted()
			if (!pressed || cancelled) recording?.stop()
		},
		stopped(result) {
			recording = null
			pressed = false
			clearTimeout(timeout)
			complete(result.tempFilePath, () => uni.getFileSystemManager?.().unlink({ filePath: result.tempFilePath, fail: () => {} }), result.duration)
		},
		failed() {
			recording = null
			pressed = false
			clearTimeout(timeout)
			if (!cancelled) onError(new Error('无法录音，请在微信设置中允许麦克风权限'))
		}
	}
	// #endif
	async function start(options = {}) {
		if (pressed || recording) return
		const current = ++attempt
		maxSeconds = Math.max(1, Math.min(60, Number(options.maxSeconds) || 60))
		pressed = true
		cancelled = false
		try {
			// #ifdef H5
			if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
				throw new Error('当前浏览器无法录音，请使用微信小程序或文字发言')
			const acquired = await navigator.mediaDevices.getUserMedia({ audio: true })
			if (current !== attempt) {
				acquired.getTracks().forEach(track => track.stop())
				return
			}
			stream = acquired
			if (!pressed || cancelled) {
				stopTracks()
				if (!cancelled) onError(new Error('麦克风已就绪，请再次按住录音'))
				return
			}
			const mimeType = ['audio/mp4', 'audio/wav'].find((type) =>
				MediaRecorder.isTypeSupported(type)
			)
			if (!mimeType)
				throw new Error('当前浏览器无法录制微信可播放的语音，请用文字发言或微信小程序录音')
			recording = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 })
			const chunks = []
			recording.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data)
			}
			recording.onstop = () => {
				const type = recording.mimeType
				recording = null
				stopTracks()
				if (chunks.length) {
					const url = URL.createObjectURL(new Blob(chunks, { type }))
					complete(url, () => URL.revokeObjectURL(url))
				} else if (!cancelled) onError(new Error('未录到语音，请重新录制'))
			}
			recording.start()
			onStarted()
			// #endif
			// #ifdef MP-WEIXIN
			if (uni.getSetting && uni.authorize) {
				const settings = await new Promise((resolve, reject) => uni.getSetting({ success: resolve, fail: reject }))
				if (current !== attempt) return
				if (!pressed || cancelled) { if (!cancelled) onError(new Error('请按住至少1秒后再松开发送')); return }
				if (settings.authSetting?.['scope.record'] === false) throw new Error('请在麦克风设置中允许录音权限')
				if (!settings.authSetting?.['scope.record']) {
					await new Promise((resolve, reject) => uni.authorize({ scope: 'scope.record', success: resolve, fail: () => reject(new Error('请允许麦克风权限后再次按住录音')) }))
					if (current !== attempt) return
				}
				if (!pressed || cancelled) { if (!cancelled) onError(new Error('麦克风已就绪，请再次按住录音')); return }
			}
			if (nativeOwner) throw new Error('上一段录音正在结束，请稍后再试')
			recording = getNativeRecorder()
			nativeOwner = nativeCallbacks
			recording.start({
				duration: maxSeconds * 1000,
				sampleRate: 16000,
				numberOfChannels: 1,
				encodeBitRate: 32000,
				format: 'mp3'
			})
			// #endif
			startedAt = Date.now()
			timeout = setTimeout(stop, maxSeconds * 1000)
		} catch (error) {
			if (current !== attempt) return
			// #ifdef MP-WEIXIN
			if (nativeOwner === nativeCallbacks) nativeOwner = null
			// #endif
			recording = null
			pressed = false
			stopTracks()
			onError(
				new Error(
					error.name === 'NotAllowedError'
						? '请允许麦克风权限，或使用文字发言'
						: error.message || '录音失败'
				)
			)
		}
	}
	function stop() {
		pressed = false
		clearTimeout(timeout)
		if (recording && recording.state !== 'inactive') recording.stop()
	}
	function cancel() {
		attempt++
		cancelled = true
		stop()
		stopTracks()
	}
	return { start, stop, cancel, busy: () => pressed || !!recording }
}
