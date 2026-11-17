<template>
  <view class="uc-page" @touchstart="armCues" @click="armCues" :class="{'uc-playing': playing}" :style="{'--uc-nav-top': navTop + 'px'}">
    <k-topbar back custom-back title="谁是卧底" :fab="false" @back="lobby" />
    <view class="uc-body">
      <view v-if="!code" class="uc-state">
        <text>房间号无效，请确认朋友发来的邀请。</text>
        <k-button block @click="lobby">返回大厅</k-button>
      </view>
      <template v-else>
        <view v-if="error" class="uc-error">
          <text>{{ error }}</text><button class="uc-link" @click="refresh">重新同步</button>
        </view>
        <view v-if="loading && !room" class="uc-state">正在寻找你的朋友…</view>
        <template v-if="room">
          <view v-if="!playing" class="uc-heading uc-room-heading">
            <view>
              <text class="uc-muted">好友房间</text>
              <button class="uc-code" aria-label="复制房间号" @click="copy(code, '房间号已复制')">{{ code }} <k-icon name="copy" :size="16" color="muted" /></button>
            </view>
            <button class="uc-link" @click="go('/pages/undercover/rules')">玩法说明</button>
          </view>

          <template v-if="!room.me">
            <view class="uc-state">
              <text class="uc-section-title">{{ hostName }}邀请你加入</text>
              <text class="uc-muted">{{ room.players.length }}/10人 · {{ categoryLabel(room.category) }}</text>
              <k-button block :disabled="busy || room.phase !== 'waiting' || room.players.length >= 10" @click="join">
                {{ room.phase !== 'waiting' ? '本局已开始，请等待下一局' : room.players.length >= 10 ? '房间已满' : '加入房间' }}
              </k-button>
              <button class="uc-link" @click="lobby">返回大厅</button>
            </view>
          </template>

          <template v-else-if="room.phase === 'waiting'">
            <view class="uc-heading">
              <text class="uc-section-title">等朋友到齐</text><text class="uc-count">{{ room.players.length }}/10人</text>
            </view>
            <text class="uc-muted">{{ room.players.length < 4 ? '至少4人即可开局' : '本局' + spyCount + '名卧底，其余为平民' }} · {{ readyCount }}人已准备</text>
            <view class="uc-players">
              <view v-for="person in room.players" :key="person.userId" class="uc-player">
                <view class="uc-seat">{{ person.seat }}</view>
                <view class="uc-player__copy">
                  <text class="uc-player__name">{{ person.name }}{{ person.userId === room.me.userId ? '（我）' : '' }}</text>
                  <text class="uc-player__status" :class="{ 'uc-success': person.ready && person.online }">
                    {{ person.userId === room.hostId ? '房主 · ' : '' }}{{ !person.online ? '暂时离线' : person.ready ? '已准备' : '待准备' }}
                  </text>
                </view>
                <button v-if="isHost && person.canKick && person.userId !== room.me.userId" class="uc-remove" :disabled="busy" :aria-label="'移出' + person.name" @click="act('kick', { seat: person.seat })">移出</button>
              </view>
            </view>
            <view class="uc-share-row">
              <!-- #ifdef MP-WEIXIN -->
              <button class="uc-secondary" open-type="share">邀请微信好友</button>
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <button class="uc-secondary" @click="copy(invitation(code), '邀请已复制')">复制邀请链接</button>
              <!-- #endif -->
              <button class="uc-secondary" :disabled="qrBusy" @click="showCode">{{ qrBusy ? '正在生成…' : '房间二维码' }}</button>
            </view>
            <view v-if="qrImage || qrError" class="uc-qr">
              <image v-if="qrImage" :src="qrImage" mode="aspectFit" class="uc-qr__image" @click="previewCode" />
              <text v-if="qrError" class="uc-muted">{{ qrError }}</text>
              <text v-else class="uc-muted">朋友扫码即可进入房间</text>
            </view>
            <view class="uc-settings">
              <text class="uc-section-title">本局设置</text>
              <text class="uc-label">词库</text>
              <view class="uc-options">
                <button v-for="item in categories" :key="item.value" :class="{ on: room.category === item.value }" :disabled="!isHost || busy" @click="settings(item.value, room.speechSeconds)">{{ item.label }}</button>
              </view>
              <text class="uc-label">每人描述时间</text>
              <view class="uc-options">
                <button v-for="seconds in [15, 20, 30, 45, 60]" :key="seconds" :class="{ on: room.speechSeconds === seconds }" :disabled="!isHost || busy" @click="settings(room.category, seconds)">{{ seconds }}秒</button>
              </view>
              <text class="uc-label">离线自动处理</text><view class="uc-options"><button v-for="seconds in [0,60,120,180]" :key="seconds" :class="{on:(room.offlineSeconds||0)===seconds}" :disabled="!isHost||busy" @click="settings(room.category,room.speechSeconds,seconds)">{{seconds ? seconds+'秒' : '关闭'}}</button></view><text class="uc-muted">等待时移出房间；对局中标记出局。短暂切屏不会立即移出。</text>
              <text class="uc-muted">进入即准备，调整设置不会取消准备。每轮投票45秒。</text>
            </view>
            <view class="uc-actions">
              <k-button v-if="isHost" block :disabled="busy || !canStart" @click="act('start')">{{ canStart ? '开始游戏，秘密发词' : '等待至少4人且全员准备' }}</k-button>
              <text v-else class="uc-success">已自动准备，等待房主开局</text>
              <button class="uc-link" :disabled="busy" @click="leave">退出房间</button>
            </view>
          </template>

          <template v-else-if="room.phase === 'finished'">
            <view class="uc-result">
              <k-icon name="flag" :size="36" color="green" />
              <text class="uc-title">{{ resultLabel(room.winner) }}</text>
              <text class="uc-muted">{{ room.round }}轮描述后，答案揭晓</text>
            </view>
            <view class="uc-word-pair">
              <view><text class="uc-muted">平民词语</text><text class="uc-word">{{ room.civilianWord }}</text></view>
              <view><text class="uc-muted">卧底词语</text><text class="uc-word">{{ room.undercoverWord }}</text></view>
            </view>
            <view class="uc-results">
              <view v-for="person in room.players" :key="person.userId" class="uc-result-person">
                <text class="uc-seat">{{ person.seat }}</text>
                <view class="uc-player__copy"><text class="uc-strong">{{ person.name }}</text><text class="uc-muted">{{ person.alive ? '留到最后' : '已出局' }} · {{ person.word }}</text></view>
                <text :class="person.role === 'undercover' ? 'uc-spy' : 'uc-success'">{{ person.role === 'undercover' ? '卧底' : '平民' }}</text>
              </view>
            </view>
            <view class="uc-actions">
              <k-button v-if="isHost" block :disabled="busy" @click="act('replay')">再来一局</k-button>
              <text v-else class="uc-muted">等待房主发起下一局</text>
              <button class="uc-link" :disabled="busy" @click="leave">退出房间</button>
            </view>
          </template>

          <template v-else-if="room.phase !== 'closed'">
            <view class="uc-phase">
              <view><text class="uc-muted">第{{ room.round }}轮{{ room.runoff ? ' · 平票加赛' : '' }}</text><text class="uc-section-title">{{ phaseTitle }}</text></view>
              <button class="uc-cue" @click="toggleCues">{{cuesBlocked?'开启提示音':cuesEnabled?'提示音开':'提示音关'}}</button><text class="uc-timer" :class="{ urgent: secondsLeft <= 10 }">{{ secondsLeft }}<text class="uc-timer__unit">秒</text></text>
            </view>
            <button class="uc-secret" :aria-label="revealed ? '收起我的词语' : '查看我的词语'" @click="toggleWord">
              <k-icon :name="revealed ? 'eye' : 'lock'" :size="25" color="green" />
              <view><text class="uc-secret__word">{{ revealed ? room.me.word : '查看我的词语' }}</text><text class="uc-muted">{{ revealed ? '仅自己可见 · 点击收起' : '避开朋友的视线，点开查看' }}</text></view>
            </button>
            <text class="uc-instruction">{{ instruction }}</text>
            <view v-if="room.me.canSpeak" class="uc-compose">
              <textarea v-model="description" class="uc-description" maxlength="100" placeholder="用一句话描述你的词语，别直接说出答案" aria-label="我的描述" :disabled="busy" :adjust-position="true" :cursor-spacing="100" :hold-keyboard="true" />
              <text class="uc-char-count">{{ description.length }}/100</text>
              <k-button block :disabled="busy || !description.trim() || secondsLeft === 0" @click="sendDescription">提交描述，下一位</k-button>
              <button class="uc-done" :disabled="busy || secondsLeft === 0" @click="act('endSpeech')">发言完毕 / 跳过</button>
            </view>
            <view class="uc-players">
              <button v-for="person in room.players" :key="person.userId" class="uc-player uc-player--button" :class="{ selected: target === person.seat, speaking: room.speaker === person.seat, eliminated: !person.alive }" :disabled="!selectable(person) || busy" :aria-label="person.seat + '号 ' + person.name + (!person.alive ? ' 已出局' : '')" @click="target = person.seat">
                <view class="uc-seat">{{ person.seat }}</view><text v-if="!person.alive" class="uc-out">OUT</text>
                <view class="uc-player__copy"><text class="uc-player__name">{{ person.name }}{{ person.userId === room.me.userId ? '（我）' : '' }}</text><text class="uc-player__status">{{ !person.alive ? '已出局' : room.speaker === person.seat ? '正在描述' : target === person.seat ? '已选择' : room.runoff && candidateSeats.includes(Number(person.seat)) ? '平票候选' : !person.online ? '暂时离线' : '游戏中' }}</text></view>
              </button>
            </view>
            <view v-if="canVote" class="uc-actions">
              <k-button block :disabled="busy || !target" @click="act('vote', { target })">{{ target ? '确认投给' + target + '号' : '请先选择一位玩家' }}</k-button>
              <button class="uc-link" :disabled="busy" @click="act('vote', { target: 0 })">本轮弃票</button>
            </view>
            <view v-if="room.phase === 'vote'" class="uc-vote-status">
              <text>{{ room.me.submitted ? '你的投票已提交，等待统一揭晓' : !room.me.alive ? '你已出局，可以继续观看' : '投票提交后无法修改' }}</text>
              <text class="uc-muted">{{ room.votesSubmitted }}/{{ aliveCount }}人已投票</text>
            </view>
            <ww-chat :active="pageActive" :room="room" :busy="busy" recorded-voice voice-only game="undercover" @refresh="refresh" />
            <text class="uc-muted">可录音描述；发送后可继续发言，点“发言完毕”交给下一位。不要直接说出词语。</text>
          </template>

          <view v-if="room.me && room.events.length" class="uc-log">
            <button class="uc-heading uc-log-toggle" @click="showLog = !showLog"><text class="uc-section-title">对局记录</text><k-icon :name="showLog ? 'chevron-up' : 'chevron-down'" :size="18" color="muted" /></button>
            <scroll-view v-if="showLog" scroll-y style="height:180px"><text v-for="(event, index) in room.events" :key="index" class="uc-log__event">{{ event }}</text></scroll-view>
          </view>
        </template>
      </template>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { onLoad, onHide, onUnload, onShareAppMessage } from '@dcloudio/uni-app'
import { go } from '@/common/screen.js'
import { copy } from '@/common/ui.js'
import { getToken } from '@/common/request.js'
import { useGameRoom } from '@/common/use-game-room.js'
import WwChat from '../werewolf/components/ww-chat.vue'
import { useUndercoverCues } from './use-cues.js'
import * as api from './api.js'
import { categories, categoryLabel, resultLabel, invitation } from './api.js'

let navTop=88
// #ifndef H5
try{navTop=(uni.getSystemInfoSync().statusBarHeight||20)+44}catch(e){navTop=64}
// #endif
const code = ref('')
const revealed = ref(false)
const target = ref(0)
const description = ref('')
const showLog = ref(false)
const qrImage = ref('')
const qrError = ref('')
const qrBusy = ref(false)
let wordTimer
let qrEpoch = 0
const { room, error, loading, busy, now, refresh, act, pageActive } = useGameRoom(code, api)

onLoad(query => {
  let scene = ''
  try { scene = decodeURIComponent(query.scene || '') } catch (e) { scene = '' }
  code.value = api.roomCode(query.code || scene.replace(/^u_/, ''))
})
onShareAppMessage(() => ({ title: '一起玩谁是卧底，听出朋友话里的不同', path: api.roomPath(code.value) }))
const lobby = () => uni.redirectTo({ url: '/pages/undercover/index' })
const isHost = computed(() => !!room.value?.me && room.value.hostId === room.value.me.userId)
const hostName = computed(() => room.value?.players.find(p => p.userId === room.value.hostId)?.name || '朋友')
const spyCount = computed(() => room.value?.players.length >= 7 ? 2 : 1)
const readyCount = computed(() => room.value?.players.filter(p => p.ready).length || 0)
const canStart = computed(() => room.value?.players.length >= 4 && readyCount.value === room.value.players.length)
const aliveCount = computed(() => room.value?.players.filter(p => p.alive).length || 0)
const secondsLeft = computed(() => Math.max(0, Math.ceil(((room.value?.deadline || 0) - now.value) / 1000)))
const playing=computed(()=>room.value?.me && !['waiting','finished','closed'].includes(room.value.phase))
const {cuesEnabled,cuesBlocked,toggleCues,armCues}=useUndercoverCues(room,secondsLeft)
const candidateSeats=computed(()=>(room.value?.candidates||[]).map(Number))
const canVote = computed(() => (room.value?.me?.canVote ?? true) && room.value?.phase === 'vote' && room.value.me?.alive && !room.value.me.submitted && secondsLeft.value > 0)
const messageGroups=computed(()=>{const bySeat=new Map();for(const m of room.value?.messages||[]){if(!bySeat.has(m.seat))bySeat.set(m.seat,{seat:m.seat,name:m.name,messages:[]});bySeat.get(m.seat).messages.push(m)}return [...bySeat.values()].sort((a,b)=>a.seat-b.seat)})
const phaseTitle = computed(() => {
  if (room.value?.phase === 'reveal') return '词语已送到，请悄悄查看'
  if (room.value?.phase === 'vote') return room.value.runoff ? '从平票玩家中选出卧底' : '谁的词语和大家不同？'
  return room.value?.me?.canSpeak ? '轮到你描述了' : '正在听' + room.value?.speaker + '号描述'
})
const instruction = computed(() => {
  if (!room.value?.me?.alive) return '你已出局，可以继续观看，身份将在结算时揭晓。'
  if (room.value.phase === 'reveal') return '记住自己的词语，倒计时结束后开始轮流描述。'
  if (room.value.phase === 'vote') return room.value.runoff ? '投给平票候选中的其他玩家，也可以弃票。' : '选择你怀疑的其他玩家，全部提交后统一揭晓。'
  if (room.value.me.canSpeak) return '提交一句文字，或面对面说完后点击发言完毕。'
  return '认真听朋友的描述，看看哪些细节和你的词语不同。'
})
function selectable(person) {
  return canVote.value && person.alive && person.userId !== room.value.me.userId
    && (!room.value.runoff || candidateSeats.value.includes(Number(person.seat)))
}
function hideWord() {
  clearTimeout(wordTimer)
  revealed.value = false
}
function toggleWord() {
  const next = !revealed.value
  hideWord()
  revealed.value = next
  if (next) wordTimer = setTimeout(hideWord, 8000)
}
watch(() => room.value?.phaseToken, () => {
  hideWord()
  target.value = 0
  description.value = ''
})
watch(() => room.value?.me?.userId, () => {
  hideWord()
  qrImage.value = ''
  qrError.value = ''
  qrEpoch++
  qrBusy.value = false
})
// 还在另一个没打完或等人的房间里，就先问要不要回那边（打完的那局服务端会自动退出，不用拦）；服务端同样会拦，这里只是给个回去的路
let checking = false
async function join() {
  if (busy.value || checking) return
  checking = true
  let mine = null
  try { if (getToken()) mine = await api.myRoom() } catch (e) { mine = null } finally { checking = false }
  if (mine && mine.code !== code.value && mine.phase !== 'finished') {
    api.askBackToRoom(mine, '加入这个房间', url => uni.redirectTo({ url }))
    return
  }
  act('join')
}
function settings(category, speechSeconds, offlineSeconds=room.value.offlineSeconds||0) {
  if (category === room.value.category && speechSeconds === room.value.speechSeconds && offlineSeconds===(room.value.offlineSeconds||0)) return
  act('settings', { category, speechSeconds, offlineSeconds })
}
async function sendDescription() {
  await act('describe', { text: description.value.trim() })
}
async function leave() {
  if (await act('leave')) lobby()
}
async function showCode() {
  if (qrBusy.value) return
  qrBusy.value = true
  qrError.value = ''
  const generation = ++qrEpoch
  const token = getToken()
  let env
  // #ifdef MP-WEIXIN
  try { env = wx.getAccountInfoSync().miniProgram.envVersion } catch (e) { env = undefined }
  // #endif
  try {
    const result = await api.inviteCode(code.value, env)
    if (generation !== qrEpoch || token !== getToken()) return
    qrImage.value = result.state === 'ready' ? result.image : ''
    if (!qrImage.value) qrError.value = result.message || '二维码暂时不可用，可以分享邀请或房间号。'
  } catch (e) {
    if (generation === qrEpoch && token === getToken()) qrError.value = e.message || '生成失败，请重试'
  } finally {
    if (generation === qrEpoch) qrBusy.value = false
  }
}
const previewCode = () => uni.previewImage({ urls: [qrImage.value] })
function cleanup() {
  hideWord()
  qrEpoch++
  qrBusy.value = false
}
onHide(cleanup)
onUnload(cleanup)
</script>
<style lang="scss">
@import './undercover.scss';
</style>
