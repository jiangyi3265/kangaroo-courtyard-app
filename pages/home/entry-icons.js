// 首页入口的轻双色线稿，与现有 SVG 图片图标使用同一种小程序渲染方式。
const brown = '#805633', green = '#50745C', cream = '#FCF9F3', peach = '#E8C6A3'
const path = (d, fill = 'none', stroke = brown, width = 1.8) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`
const ground = path('M7 49c0-3 3-5 5-3 1-4 6-4 7 0h26c1-4 5-4 6-1 3-1 5 1 5 4Z', '#B7C7A7', green, 1.4)
const house = path('M13 28 32 12 51 28v21H13Z', cream) + path('M9 29 32 9 55 29M43 18v-7h5v11')
const icons = {
  house: ground + house + path('M28 49V34h9v15', peach) + path('M17 30 32 17 47 30', 'none', brown, 1.2),
  backpack: path('M25 15v-3c0-8 14-8 14 0v3', 'none', brown, 2) + path('M19 22c-7 5-10 18-6 26l7-3M45 22c7 5 10 18 6 26l-7-3', peach) + path('M18 23c0-8 5-11 14-11s14 3 14 11v25c0 5-4 7-8 7H26c-4 0-8-2-8-7Z', peach) + path('M23 23c0-5 3-7 9-7s9 2 9 7v10H23Z', '#F2D9BC') + path('M23 38h18v10c0 3-18 3-18 0ZM23 42h18', '#F2D9BC') + path('M35 42v3', 'none', brown, 1.5),
  store: ground + path('M14 27v22h36V27', cream) + path('M11 25 18 10h28l7 15c0 8-10 8-10 0 0 8-11 8-11 0 0 8-11 8-11 0 0 8-10 8-10 0Z', peach) + path('M27 49V36h11v13', '#F1DDC3') + path('M22 10h20', 'none', brown, 1.2),
  cloud: path('M18 39h30c13-1 11-19 0-19-2-15-22-17-27-3C7 14 3 38 18 39Z', '#F8FCF9', '#47756B', 2.1) + path('M23 46h20M28 51h10', 'none', '#47756B', 1.9),
  stay: ground + house + path('M29 49V33h10v16', peach) + path('M18 33h6v8h-6Z', '#D7E4D8', brown, 1.5)
}
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const base64 = text => {
  let result = ''
  for (let i = 0; i < text.length; i += 3) {
    const a = text.charCodeAt(i), b = text.charCodeAt(i + 1), c = text.charCodeAt(i + 2)
    const n = (a << 16) | ((b || 0) << 8) | (c || 0)
    result += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + (Number.isNaN(b) ? '=' : alphabet[(n >> 6) & 63]) + (Number.isNaN(c) ? '=' : alphabet[n & 63])
  }
  return result
}
const images = Object.fromEntries(Object.entries(icons).map(([name, body]) => [name, 'data:image/svg+xml;base64,' + base64(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`)]))
export const homeEntryIcon = name => images[name] || images.house
