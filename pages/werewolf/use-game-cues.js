import { ref, watch, onBeforeUnmount } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import cue from './static/turn.wav'

export function useGameCues(room, secondsLeft) {
	const enabled = ref(false)
	let audio
	let visible = true
	let warned = ''
	function play() {
		if (!enabled.value || !visible) return
		if (!audio) {
			audio = uni.createInnerAudioContext()
			audio.src = cue
			audio.volume = 0.25
		}
		audio.stop()
		audio.play()
	}
	watch(
		() => room.value?.phaseToken,
		(current, previous) => {
			if (previous && current && current !== previous) play()
		}
	)
	watch(secondsLeft, (seconds) => {
		const phase = room.value?.phaseToken
		if (seconds > 0 && seconds <= 10 && phase && warned !== phase) {
			warned = phase
			play()
		}
	})
	onShow(() => {
		visible = true
	})
	onHide(() => {
		visible = false
		audio?.stop()
	})
	onBeforeUnmount(() => audio?.destroy())
	return { cuesEnabled: enabled }
}
