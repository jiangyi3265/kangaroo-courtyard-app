import { inject } from 'vue'

export const userIconScope = Symbol('user icons')
const originalIcons = { value: false }
const internalPages = new Set([
  'pages/auth/identity', 'pages/notice/states', 'pages/governance/merchant-cases', 'pages/profile/team-reports'
])

export function isUserIconPage(path = '') {
  const route = (path || '').replace(/^\//, '').split('?')[0]
  return route.startsWith('pages/') && !/^pages\/(werewolf|staff|manage)\//.test(route) && !internalPages.has(route)
}

export const useUserIcons = () => inject(userIconScope, originalIcons)
