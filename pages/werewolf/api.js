import { request } from '@/common/request.js'
const rulesRequest = (options) => request({ ...options, params: { ...options.params, rulesVersion: 2 } })

const base = '/app/werewolf'
export const requestId = () =>
	'ww_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12)
export const roomCode = (value) => (/^[1-9]\d{5}$/.test(String(value || '')) ? String(value) : '')
export const invitePath = (code) => '/pages/werewolf/invite?code=' + roomCode(code)
export const readRoom = (code) =>
	rulesRequest({ url: `${base}/rooms/${roomCode(code)}` }).then((r) => r.data)
export const createRoom = (id) =>
	rulesRequest({ url: base + '/rooms', method: 'POST', data: { requestId: id } }).then((r) => r.data)
export const myRoom = () => rulesRequest({ url: base + '/mine' }).then((r) => r.data.room)
export const history = () => request({ url: base + '/history' }).then((r) => r.data)
export const gameResult = (code, id) =>
	rulesRequest({ url: `${base}/rooms/${roomCode(code)}/results/${encodeURIComponent(id)}` }).then(
		(r) => r.data
	)
export const command = (code, action, data = {}, id = requestId()) =>
	rulesRequest({
		url: `${base}/rooms/${roomCode(code)}/${action}`,
		method: 'POST',
		data: { ...data, requestId: id }
	}).then((r) => r.data)
export const inviteCode = (code, env) =>
	request({ url: `${base}/rooms/${roomCode(code)}/invite-code`, params: { env } }).then(
		(r) => r.data
	)

export const ROLES = {
	hunter: { label: '猎人袋鼠', short: '猎人', sprite: 3, icon: 'crosshair', team: '好人阵营', description: '被狼人淘汰或放逐时，可在30秒内开枪带走一人，也可放弃。被女巫毒杀不能开枪。' },
	guard: { label: '守卫袋鼠', short: '守卫', sprite: 3, icon: 'shield-check', team: '好人阵营', description: '每晚守护一人，可以守护自己，不能连续守护同一人。守护和解药同时落在狼刀目标身上，该玩家仍出局；毒药不受守护影响。' },
	wolf: {
		label: '狼人袋鼠',
		short: '狼人',
		sprite: 0,
		team: '狼人阵营',
		description: '每晚和同伴选择一位好人。意见不一致时，平票无人出局。'
	},
	seer: {
		label: '预言家袋鼠',
		short: '预言家',
		sprite: 1,
		team: '好人阵营',
		description: '每晚查验一位其他玩家，只有你能看到查验结果。'
	},
	witch: {
		label: '女巫袋鼠',
		short: '女巫',
		sprite: 2,
		team: '好人阵营',
		description: '解药、毒药各一瓶，一晚最多使用一瓶。仅第一夜可以自救。'
	},
	villager: {
		label: '村民袋鼠',
		short: '村民',
		sprite: 3,
		team: '好人阵营',
		description: '认真听取发言，在白天投票找出狼人。夜晚安心等待天亮。'
	}
}
export const roleOf = (role) => ROLES[role] || ROLES.villager
export const PLAY_MODES = [{ key: 'online', label: '线上组局' }, { key: 'face_to_face', label: '线下面对面' }]
export const modeLabel = value => PLAY_MODES.find(x => x.key === value)?.label || '线上组局'
export function roleCountsFor(count = 6) {
  const wolves = count === 12 ? 4 : count >= 9 ? 3 : 2
  return { wolf: wolves, seer: 1, witch: 1, ...(count >= 8 ? { hunter: 1 } : {}), ...(count >= 10 ? { guard: 1 } : {}), villager: count - wolves - 2 - (count >= 8 ? 1 : 0) - (count >= 10 ? 1 : 0) }
}
export const lineupText = counts => Object.entries(counts || {}).map(([role, count]) => `${count}${roleOf(role).short}`).join(' · ')
export const resultLabel = (winner) =>
	({ good: '好人阵营获胜', wolf: '狼人阵营获胜', draw: '本局平局' })[winner] || '对局结算'
export const routeFor = (room) =>
	'/pages/werewolf/' +
	(room.phase === 'waiting' ? 'room' : room.phase === 'finished' ? 'result' : 'game') +
	'?code=' +
	room.code
export function inviteText(code) {
	let link = ''
	// #ifdef H5
	link = '\n' + window.location.origin + window.location.pathname + '#' + invitePath(code)
	// #endif
	return `一起玩袋鼠狼人杀！房间号 ${code}，在袋鼠全球青年的「社区 → 袋鼠狼人杀」输入房间号加入。${link}`
}
