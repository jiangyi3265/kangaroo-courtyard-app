// 展示身份与实际门店授权分开：城市服务人只选一次身份，业务接口仍使用真实授权门店。
export function grantKey(grant) {
  if (!grant || typeof grant !== 'object') return grant
  if (grant.identityKey) return grant.identityKey
  if (grant.storeId != null && grant.storeId !== '') return grant.storeId
  return grant.cityId != null ? 'city:' + grant.cityId : null
}

export function groupStaffIdentities(grants = []) {
  const identities = [], cities = new Map()
  for (const grant of grants) {
    if (grant.active !== true) continue
    const city = String(grant.city || '').trim()
    if (grant.roleCode !== 'merchant_service' || !city) {
      identities.push(grant)
      continue
    }
    let group = cities.get(city)
    if (!group) {
      group = { ...grant, city, scopeKind: 'service-city', identityKey: 'service-city:' + encodeURIComponent(city),
        roleName: '商家服务人', storeIds: [], memberKeys: [] }
      cities.set(city, group)
      identities.push(group)
    }
    if (grant.storeId != null && grant.storeId !== '' && !group.storeIds.some(id => String(id) === String(grant.storeId))) {
      group.storeIds.push(grant.storeId)
      // 城市筹备授权没有门店时，后续真实门店可作为查询锚点。
      if (group.storeId == null || group.storeId === '') Object.assign(group, { storeId: grant.storeId, storeName: grant.storeName })
    }
    const key = grantKey(grant)
    if (key != null && !group.memberKeys.some(id => String(id) === String(key))) group.memberKeys.push(key)
  }
  return identities
}

export function findStaffIdentity(identities, selection) {
  const key = grantKey(selection)
  if (key == null) return null
  // 对象选择带角色，避免同一门店的其他角色错误命中；旧缓存仅编号时兼容原有顺序。
  const matchesRole = grant => !selection?.roleCode || grant.roleCode === selection.roleCode
  return identities.find(grant => matchesRole(grant) && String(grantKey(grant)) === String(key))
    || identities.find(grant => matchesRole(grant) && grant.memberKeys?.some(id => String(id) === String(key))) || null
}

export function staffIdentityLabel(grant) {
  if (grant?.scopeKind === 'service-city') return `${grant.city} · 商家服务人`
  return [grant?.storeName || grant?.city || '已授权团队', grant?.roleName || '员工'].join(' · ')
}

// 微信提醒使用服务端给出的消息范围；兼容升级前按门店生成的链接。
export function staffIdentityForMessageScope(grants, scope) {
  const identities = groupStaffIdentities(grants)
  // 微信与H5可能保留外层query编码。只解整参数一层，不递归解城市名里的百分号。
  if (/^(service-city|store|city)%3A/i.test(scope)) {
    try { scope = decodeURIComponent(scope) } catch { return null }
  }
  const city = identities.find(grant => grant.identityKey === scope)
    || identities.find(grant => grant.scopeKind === 'service-city' && `service-city:${grant.city}` === scope)
  if (city) return city
  const legacy = grants.find(grant => grant.active === true
    && `${grant.storeId != null ? 'store:' + grant.storeId : 'city:' + grant.cityId}:${grant.roleCode}` === scope)
  return legacy ? findStaffIdentity(identities, legacy) : null
}
