// 顶部明确展示当前操作人；门店/城市只是工作范围，不能拿门店名冒充负责人姓名。
export function workIdentity(account, grant) {
  const name = String(account?.nickname || '').trim()
  return {
    name: name || '姓名待完善',
    scope: String(grant?.storeName || grant?.city || '').trim(),
    role: grant?.roleCode === 'merchant' ? '合作商家' : String(grant?.roleName || '当前负责人')
  }
}
