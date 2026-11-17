<template>
  <view class="uc-page">
    <k-topbar back title="谁是卧底" :fab="false" />
    <view class="uc-body">
      <view class="uc-intro">
        <view class="uc-intro__mark"><k-icon name="search" :size="36" color="green" /></view>
        <text class="uc-title">{{ '同桌的朋友，\n谁藏着另一个词？' }}</text>
        <text class="uc-muted">4～10人 · 轮流描述 · 投票找出卧底</text>
      </view>
      <k-button block :disabled="busy" :label="busy ? '正在创建房间…' : '邀请朋友开一局'" @click="create" />
      <button v-if="currentRoom" class="uc-resume" @click="go(roomPath(currentRoom.code))">
        <view><text class="uc-strong">继续我的房间</text><text class="uc-muted">{{ currentRoom.code }} · {{ currentRoom.phase === 'waiting' ? '等待朋友准备' : currentRoom.phase === 'finished' ? '查看本局结果' : '对局进行中' }}</text></view>
        <k-icon name="chevron-right" :size="20" color="green" />
      </button>
      <view class="uc-join">
        <text class="uc-section-title">朋友已经开好房？</text>
        <view class="uc-row">
          <input v-model="joinCode" class="uc-input" type="number" maxlength="6" placeholder="输入6位房间号" aria-label="6位房间号" confirm-type="go" @confirm="join" />
          <k-button type="outline" :disabled="busy" @click="join">加入</k-button>
        </view>
      </view>
      <view v-if="error" class="uc-error">{{ error }}</view>
      <view class="uc-how">
        <view class="uc-heading"><text class="uc-section-title">一看就会玩</text><button class="uc-link" @click="go('/pages/undercover/rules')">完整规则 ›</button></view>
        <view class="uc-how__row"><k-icon name="lock" :size="21" color="green" /><view><text class="uc-strong">悄悄看词</text><text class="uc-muted">大多数人拿到同一个词，卧底拿到相近的词。</text></view></view>
        <view class="uc-how__row"><k-icon name="message-circle" :size="21" color="green" /><view><text class="uc-strong">说一点，留一点</text><text class="uc-muted">用一句话描述，听听谁的说法有些不同。</text></view></view>
        <view class="uc-how__row"><k-icon name="users" :size="21" color="green" /><view><text class="uc-strong">一起找卧底</text><text class="uc-muted">每轮投票淘汰一人，结束后揭晓所有词语。</text></view></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { publicShare, shareWithCover, timelineShare, showPublicShareMenu } from '@/common/public-share.js'
import { ref, watch } from 'vue'
import { onShow, onHide, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { ensureSession, experience } from '@/common/experience.js'
import { getToken } from '@/common/request.js'
import { go } from '@/common/screen.js'
import { askBackToRoom, createRoom, myRoom, requestId, roomCode, roomPath } from './api.js'

const joinCode = ref('')
const busy = ref(false)
const error = ref('')
const currentRoom = ref(null)
let createId = requestId()
let epoch = 0
watch(() => experience.account?.id, () => {
  currentRoom.value = null
  createId = requestId()
})
async function create() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  const token = getToken()
  const generation = epoch
  try {
    const room = await createRoom(createId)
    if (getToken() !== token || generation !== epoch) return
    createId = requestId()
    go(roomPath(room.code))
  } catch (e) {
    if (generation !== epoch || getToken() !== token) return
    // 409：还在另一个没结束的房间里，开不了新房间。查一下是哪个房间，问要不要回去
    const mine = e.code === 409 ? await myRoom().catch(() => null) : null
    if (generation !== epoch || getToken() !== token) return
    if (mine) {
      currentRoom.value = mine
      askBackToRoom(mine, '开新房间', go)
    } else error.value = e.message || '创建失败，请重试'
  } finally {
    busy.value = false
  }
}
function join() {
  const code = roomCode(joinCode.value)
  if (!code) { error.value = '请输入6位房间号'; return }
  error.value = ''
  go(roomPath(code))
}
onShow(async () => {
  const generation = ++epoch
  await ensureSession()
  if (generation !== epoch) return
  currentRoom.value = null
  if (!experience.account) return
  const token = getToken()
  try {
    const data = await myRoom()
    if (generation === epoch && getToken() === token) currentRoom.value = data
  } catch (e) {
    if (generation === epoch && getToken() === token) error.value = e.message
  }
})
onHide(() => { epoch++ })

const pageShareMessage = () => publicShare('/pages/undercover/index', {}, '谁是卧底 · 和好友一起玩')

onShareAppMessage((event) => shareWithCover(pageShareMessage(event)))
onShareTimeline(() => timelineShare(pageShareMessage()))
onShow(showPublicShareMenu)
</script>

<style lang="scss">
@import './undercover.scss';
</style>
