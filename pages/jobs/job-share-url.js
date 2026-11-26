import { API_BASE } from '../../common/config.js'

/** 仅复用当前 H5 部署路径，新的分享链接只带目的页面的公开参数。 */
export function jobShareWebUrl(pagePath, href = '') {
  let base = API_BASE + '/'
  if (href) {
    try {
      const page = new URL(href)
      if (page.protocol === 'https:' || page.protocol === 'http:') base = page.origin + page.pathname
    } catch {
      // 没有有效的 H5 页面地址时沿用公开地址。
    }
  }
  return base + '#' + pagePath
}
