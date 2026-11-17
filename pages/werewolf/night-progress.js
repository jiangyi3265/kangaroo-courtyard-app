export const nightStages = count => [
  ...(count >= 10 ? [{ key: 'guard', label: '守卫' }] : []),
  { key: 'wolves', label: '狼人' }, { key: 'seer', label: '预言家' }, { key: 'witch', label: '女巫' }
]
export function nightProgress(room, now) {
  const stages = nightStages(room?.playerCount || 6)
  const index = stages.findIndex(stage => stage.key === room?.phase)
  if (index < 0) return null
  const remaining = Math.max(0, Math.ceil((room.deadline - now) / 1000))
  return { stages, index, label: stages[index].label + '行动', remaining,
    total: remaining + (stages.length - index - 1) * room.nightSeconds }
}
export function clockText(seconds) {
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
}
