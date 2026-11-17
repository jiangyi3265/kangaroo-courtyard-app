// 员工端按钮按角色显隐。权限表取自服务端 StaffPerms（/app/staff/team/roles 返回的 permissions，
// 与各写接口的校验是同一张表），前端不抄一份：两边各改一处就又会出现"按钮在、点了被拒"。
// 按"门店:角色"缓存，换门店或角色后自动重新取。
import { reactive } from 'vue'
import { apiStaffRoles } from './api.js'
import { currentStaffStore } from './experience.js'

const ACTIONS = ['view', 'edit', 'audit', 'pay', 'export']
const tables = reactive({})
const pending = {}

const keyOf = (store) => (store && store.storeId != null ? store.storeId + ':' + (store.roleCode || '') : '')

/** 取当前门店、当前角色的权限表（已取过直接返回）；失败返回 null，由调用方按"未知"处理 */
export function loadStaffPerms(store = currentStaffStore.value) {
  const k = keyOf(store)
  if (!k) return Promise.resolve(null)
  if (tables[k]) return Promise.resolve(tables[k])
  if (!pending[k]) {
    pending[k] = apiStaffRoles(store.storeId, store.roleCode)
      .then((res) => {
        const table = {}
        for (const row of res?.data?.permissions || []) table[row.code] = row.values || []
        tables[k] = table
        return table
      })
      .catch(() => null)
      .finally(() => { delete pending[k] })
  }
  return pending[k]
}

/**
 * 当前门店、当前角色能不能做某项操作。item 用服务端编码（rooms / jobs / dispatch / activities / reviews / insurance / finance / dashboard），
 * action 是 view / edit / audit / pay / export。'part'（只能处理本人经手的）算能做，逐条由服务端判断。
 * 权限还未读取时先隐藏操作入口，读取成功后自动显示，避免加载期间出现无权使用的按钮。
 */
export function staffCan(item, action, store = currentStaffStore.value) {
  const table = tables[keyOf(store)]
  if (!table) {
    loadStaffPerms(store)
    return false
  }
  const v = (table[item] || [])[ACTIONS.indexOf(action)]
  return v === 'yes' || v === 'part'
}

