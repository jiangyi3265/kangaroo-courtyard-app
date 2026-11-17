// 入口来自账号全部有效授权，不因当前停留在用户或商家身份而隐藏主理人入口。
// 这里只决定导航；案件范围与可执行操作仍由服务端逐次鉴权。
export function mediationWorkEntries(grants = []) {
  const active = Array.isArray(grants) ? grants.filter(g => g?.active === true) : []
  return [
    { role: 'manager', label: '换工调解跟进', mode: 'support' },
    { role: 'city_lead', label: '本城调解待办', mode: 'city' }
  ].flatMap(entry => {
    const matches = active.filter(g => g.roleCode === entry.role)
    if (!matches.length) return []
    const scopes = [...new Set(matches.map(g => [g.city, g.storeName].filter(Boolean).join(' · ')).filter(Boolean))]
    return [{ ...entry, scope: scopes.join('；') || '以后台当前有效授权为准', url: '/pages/governance/mediation?mode=' + entry.mode }]
  })
}
