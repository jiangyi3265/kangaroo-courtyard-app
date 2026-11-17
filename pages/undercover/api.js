import { request } from '@/common/request.js'

const base = '/app/undercover'
export const requestId = () =>
  'uc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12)
export const roomCode = (value) => /^[1-9]\d{5}$/.test(String(value || '')) ? String(value) : ''
export const roomPath = (code) => '/pages/undercover/room?code=' + roomCode(code)
export const readRoom = (code) => request({ url: `${base}/rooms/${roomCode(code)}` }).then(r => r.data)
export const myRoom = () => request({ url: base + '/mine' }).then(r => r.data.room)
export const createRoom = (id) => request({
  url: base + '/rooms', method: 'POST', data: { requestId: id }
}).then(r => r.data)
export const command = (code, action, data, id = requestId()) => request({
  url: `${base}/rooms/${roomCode(code)}/${action}`,
  method: 'POST', data: { ...data, requestId: id }
}).then(r => r.data)
export const inviteCode = (code, env) => request({
  url: `${base}/rooms/${roomCode(code)}/invite-code`, params: { env }
}).then(r => r.data)
// 同一时间只能待在一个没结束的房间（服务端拦下时回 409）：问一句要不要回到那个房间。open(url) 决定怎么跳
export function askBackToRoom(room, next, open) {
  const playing = room.phase !== 'waiting' && room.phase !== 'finished'
  uni.showModal({
    title: '你还在另一个房间里',
    content: playing
      ? `房间 ${room.code} 的这一局还没打完，打完才能${next}。`
      : `房间 ${room.code} 还没结束，同一时间只能待在一个房间。回到那个房间点「退出房间」，就能${next}了。`,
    confirmText: '回到房间',
    cancelText: '先不去',
    success: (r) => { if (r.confirm) open(roomPath(room.code)) }
  })
}
export const categories = [
  { value: 'travel', label: '旅行见闻' },
  { value: 'daily', label: '日常生活' },
  { value: 'mixed', label: '随机混合' }
]
export const categoryLabel = value => categories.find(item => item.value === value)?.label || '旅行见闻'
export const resultLabel = winner => ({ civilian: '平民阵营获胜', undercover: '卧底阵营获胜', draw: '本局平局' })[winner] || '本局结束'
export function invitation(code) {
  let link = ''
  // #ifdef H5
  link = '\n' + window.location.origin + window.location.pathname + '#' + roomPath(code)
  // #endif
  return `一起玩谁是卧底！房间号 ${code}，打开袋鼠全球青年「社区 → 谁是卧底」，输入房间号加入。${link}`
}
