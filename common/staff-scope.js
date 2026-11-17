// 城市身份只用于筹备；业务权限必须由服务端返回的实际门店授权提供。
export const pendingStaffScope = grant => !!grant && grant.active !== false && grant.storeId == null && grant.cityId != null
export function pendingStaffRoute(route, grant) {
  return pendingStaffScope(grant) && /^pages\/(staff|manage)\//.test(route)
    && !['pages/staff/index', 'pages/staff/business'].includes(route)
}
