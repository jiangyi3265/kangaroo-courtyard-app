import { ref, watch, onBeforeUnmount } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import cue from './static/turn.wav'

export function useUndercoverCues(room, secondsLeft) {
  const cuesEnabled = ref(uni.getStorageSync('kangaroo:undercover:cues') !== false)
  const cuesBlocked = ref(false)
  let audio, visible = true, ready = false, generation = 0, phase = ''
  let armed = false, pending = null
  const playedTicks = new Set()
  function disposeAudio() { generation++; ready = false; armed = false; pending = null; const old = audio; audio = null; old?.destroy() }
  function prepare() {
    if (audio) return
    const current = ++generation
    const loaded = () => { if (generation === current) ready = true }
    const failed = () => { if (generation === current) { ready = false; armed = false; pending = null; cuesBlocked.value = true } }
    const playing = () => {
      if (generation !== current) return
      const request = pending
      if (!visible || !cuesEnabled.value || !request || request.phase !== phase || Date.now() > request.expires) { silence(); return }
      ready = true; armed = true; cuesBlocked.value = false
      if (request.prime) silence()
    }
    // Preload once. Unready ticks are skipped, never queued into a later round.
    // #ifdef H5
    const a = new Audio(cue)
    let playAttempt = 0
    a.preload = 'auto'; a.volume = .8
    a.oncanplaythrough = loaded; a.onplaying = playing
    a.onerror = failed
    audio = {
      set volume(value) { a.volume = value },
      stop() { playAttempt++; a.pause(); a.currentTime = 0 },
      play() { const attempt = ++playAttempt; a.play().catch(() => { if (attempt === playAttempt) failed() }) },
      destroy() { playAttempt++; a.oncanplaythrough = a.onplaying = a.onerror = null; a.pause(); a.removeAttribute('src'); a.load() }
    }
    a.load()
    // #endif
    // #ifndef H5
    const a = uni.createInnerAudioContext()
    a.volume = .8; a.obeyMuteSwitch = false
    a.onCanplay(loaded)
    a.onError(failed)
    a.onPlay(playing)
    a.src = cue; audio = a
    // #endif
  }
  function silence() { pending = null; audio?.stop(); if (audio) audio.volume = .8 }
  function playCue(prime = false) {
    silence()
    pending = { prime, phase, expires: Date.now() + (prime ? 1500 : 700) }
    audio.volume = prime ? 0 : .8
    audio.play()
  }
  // Unlock on ordinary room interaction, without asking players to toggle sound.
  // No countdown tick is queued while audio is loading or the page is hidden.
  function armCues() {
    if (!visible || !cuesEnabled.value || (armed && !cuesBlocked.value) || pending?.prime) return
    if (cuesBlocked.value) disposeAudio()
    cuesBlocked.value = false
    prepare()
    playCue(true)
  }
  watch(() => room.value?.phaseToken, token => { phase = token || ''; playedTicks.clear(); silence() }, { flush: 'sync', immediate: true })
  watch(secondsLeft, seconds => {
    if (!visible || !cuesEnabled.value || !phase || seconds < 1 || seconds > 5) return
    if (!(room.value?.me?.canSpeak || room.value?.me?.canVote)) return
    const key = phase + ':' + seconds
    if (playedTicks.has(key)) return
    playedTicks.add(key)
    if (ready) playCue()
    if (seconds <= 3) uni.vibrateShort?.({ type: 'light', fail() {} })
  }, { flush: 'post' })
  function toggleCues() {
    const retry = cuesBlocked.value
    cuesEnabled.value = retry || !cuesEnabled.value
    if (retry) disposeAudio()
    cuesBlocked.value = false
    uni.setStorageSync('kangaroo:undercover:cues', cuesEnabled.value)
    prepare()
    if (cuesEnabled.value) { if (ready) playCue(); else armCues() } else silence()
  }
  onShow(() => {
    visible = true; prepare()
    // #ifndef H5
    armCues()
    // #endif
  })
  onHide(() => { visible = false; armed = false; silence() })
  onBeforeUnmount(() => { visible = false; disposeAudio() })
  prepare()
  return { cuesEnabled, cuesBlocked, toggleCues, armCues }
}
