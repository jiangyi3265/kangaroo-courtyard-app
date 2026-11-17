// 详情页原稿中的纸纹、地图与线描图标。矢量内容在 jobs 分包内，不请求第三方图片。
const svg = (width, height, body) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${body}</svg>`).replace(/[()']/g, c => '%' + c.charCodeAt(0).toString(16))

// 兼职/全职稿使用蓝灰线描设施，换宿稿继续使用原有素材。
const facility = body => svg(48, 40, `<g stroke="#627580" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${body}</g>`)
const car = color => `<path d="M7 23l5-9h20l6 9 4 2v8H5v-8Z" fill="${color}"/><path d="m15 16-3 7h22l-4-7Z" fill="#f7fbfc"/><path d="M23 16v7M6 27h5m25 0h5M17 26h7" fill="none"/><circle cx="13" cy="32" r="4" fill="#747a79"/><circle cx="34" cy="32" r="4" fill="#747a79"/><circle cx="13" cy="32" r="1.5" fill="#fffdf7"/><circle cx="34" cy="32" r="1.5" fill="#fffdf7"/>`
export const EMPLOYMENT_FAC_ART = {
  gym: facility('<path d="M8 3h5v31H8ZM19 5h5v27h-5Z" fill="#c3dce9"/><path d="M5 35h36M12 9h16l7 8v15M21 15h10M21 19h9M29 29v6" fill="none"/><path d="M16 27h18l4 5H16Z" fill="#bad8e8"/><path d="M16 13h4v12h-4ZM26 10h7v4h-7Z" fill="#e6eff2"/><path d="M9 4v26M20 6v17" stroke="#fff"/>'),
  pool: facility('<path d="M4 24c7-8 28-11 39-5l-1 8c-10 8-29 8-38-3Z" fill="#a8d9ed"/><path d="M4 24c14 8 25 6 39-5M10 23c7-5 16-5 23-4" fill="none"/><path d="M30 21V7c0-5 7-5 7 0v4M24 23V10c0-5 6-5 6 0M25 14h5M25 18h5" fill="none"/><path d="M7 23c6 3 9 3 13 2" fill="none" stroke="#fff"/>'),
  ebike: facility('<circle cx="11" cy="30" r="6" fill="#626767"/><circle cx="37" cy="30" r="6" fill="#626767"/><circle cx="11" cy="30" r="2.5" fill="#e8e4d8"/><circle cx="37" cy="30" r="2.5" fill="#e8e4d8"/><path d="M5 27c1-10 16-13 20-6l-4 6h11l-6-15 5-2 9 17h-8l-4 3H15l1-6H8Z" fill="#d8a65d"/><path d="M9 16h13l3 4H9Z" fill="#555d61"/><path d="m28 11-3-5h-5M30 10l4-2M34 5v3M10 12V8h8v7M34 23h5M7 26h10" fill="none"/><path d="M27 13h5l3 8-4 1Z" fill="#f3dcac"/><path d="M6 28c3-5 10-4 13 0M31 28c2-5 8-5 11-1" fill="none" stroke="#bb8e4f"/>'),
  parking: facility(`<path d="M17 12v-6h15l5 8M20 9h11" fill="#c2dfe8"/>${car('#b4d8e7')}`),
  cook: facility('<path d="M10 3h27v33H10Z" fill="#d9e5e9"/><path d="M14 7h19v18H14Z" fill="#fbfcf8"/><path d="M15 29h17M14 33h19M13 36v2m21-2v2" fill="none"/><path d="M19 19h9l2 4H17ZM20 16c-3-3 4-3 1-6m5 6c-3-3 4-3 1-6" fill="none"/><circle cx="16" cy="29" r="1" fill="#82959f"/>'),
  lounge: facility('<path d="M7 16h34v20H7Z" fill="#e6d8c5"/><path d="M10 19h28v14H10Z" fill="#fffaf2"/><path d="M24 19v14M5 36h38M17 13h14M22 8c0-5 8-5 8 0s-8 5-8 0Z" fill="none"/><path d="M26 12v4" fill="none"/><path d="M12 14V9m-2 2 4 3" fill="none"/>')
}

// 短纤维以固定种子散布，避免规则横竖线在手机上变成方格纸。
let fibers = '', seed = 7369
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
for (let i = 0; i < 270; i++) {
  const x = (random() * 164).toFixed(1), y = (random() * 164).toFixed(1)
  const length = (2 + random() * 15).toFixed(1), slant = (random() * 6 - 3).toFixed(1)
  fibers += `<path d="M${x} ${y}l${length} ${slant}" opacity="${(.025 + random() * .04).toFixed(3)}"/>`
}

export const DETAIL_ART = {
  employmentMap: svg(100, 84, `<rect width="100" height="84" rx="7" fill="#eef2ed"/>
    <path d="M3 6L28 0 19 34 0 23ZM42 5L72 0 62 29 30 35ZM72 38L99 29 100 63 84 57ZM7 61L35 71 25 84 0 79Z" fill="#e2eee4"/>
    <g fill="none" stroke="#fffef9" stroke-width="3"><path d="M17-5L8 88M32-3L19 89M74-4L24 89M100 9L43 85M-5 18L108 76M-4 41L104 95"/></g>
    <g fill="none" stroke="#dde9df" stroke-width="1"><path d="M19 0L10 84M35 0L22 84M79 0L30 84M0 35L100 87"/></g>
    <path d="M6-5C22 21 19 45 5 63L0 84" fill="none" stroke="#d4e8e6" stroke-width="2"/>
    <path d="M58 29c-6 0-10 4-10 10 0 7 10 15 10 15s10-8 10-15c0-6-4-10-10-10Z" fill="#41adbf" stroke="#fbfcf6" stroke-width="1.4"/>
    <circle cx="58" cy="39" r="4.2" fill="#fcfffc"/>`),
  paper: svg(164, 164, `<defs><filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".86" numOctaves="3" seed="37" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 .47 0 0 0 0 .39 0 0 0 0 .34 .75 0 0 0 -.32"/></filter></defs><rect width="164" height="164" filter="url(#grain)"/><g fill="none" stroke="#987b70" stroke-width=".55">${fibers}</g>`),
  map: svg(150, 100, `
    <rect width="150" height="100" rx="8" fill="#e9e8eb"/>
    <g fill="none" stroke="#fffdf7" stroke-width="1.2">
      <path d="M24-5L87 104M49-5L105 102M136-4L94 103M-5 78L152 21M-5 49L151 82M4-5L72 41L153 67M-5 15L153 95"/>
    </g>
    <path d="M-5 26C36 55 78 77 153 103" fill="none" stroke="#fffaf0" stroke-width="9"/>
    <path d="M-5 26C36 55 78 77 153 103" fill="none" stroke="#e6d7b7" stroke-width="4"/>
    <g fill="none" stroke="#86bdbb" stroke-width="1.3">
      <path d="M-5 91L42 58C31 42 34 31 57 24L117 5L153 22"/>
      <path d="M-5 84L37 55C26 39 32 28 55 20L116 1L153 17"/>
      <path d="M39 45C65 62 96 53 119 58L155 57M44 58C69 74 111 83 153 96"/>
    </g>
    <circle cx="98" cy="75" r="3" fill="#d8eeee" stroke="#6aadaa"/>
    <path d="M119 15C110 14 103 20 103 28C103 37 111 50 111 50S128 38 131 29C134 21 128 16 119 15Z" fill="#403b3f" stroke="#fffdf9" stroke-width="1.4"/>
    <circle cx="118" cy="27" r="5.5" fill="#faf8f3"/>
  `),
  clock: svg(40, 40, '<g fill="none" stroke="#766351" stroke-width="1.7" stroke-linecap="round"><circle cx="20" cy="20" r="17"/><path d="M20 7L19 21L29 24"/></g>'),
  star: svg(40, 40, '<path d="m20 3 5.5 10.7 11.7 2.1-8.4 8.7 1.5 12L20 31l-10.3 5.5 1.5-12-8.4-8.7 11.7-2.1Z" fill="none" stroke="#a58161" stroke-width="2" stroke-linejoin="round"/>'),
  kangaroo: svg(32, 32, '<path d="M13 15c-2-4-1-9 0-14 3 3 4 6 4 10l4-9c2 5 1 8-1 12l4 2-2 4-5-1c2 2 5 4 5 7-5 4-11 4-15 1-4-3-4-8-5-11 4 1 5 4 7 5l4-6Z" fill="#f3d79f"/>'),
  store: svg(60, 60, '<g fill="none" stroke="#b8b1b1" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 29-4 22 16-3 16 3 17-4-6-22-11 4-16-4-12 4Z"/><path d="m21 25-1 23m17-19 1 22m-27-8 8-8 8 8 7-9 12 8"/></g><path d="M31 7c-5 0-9 4-9 9 0 7 9 15 9 15s9-8 9-15c0-5-4-9-9-9Z" fill="#b8b1b1"/><circle cx="31" cy="16" r="3" fill="#f6f3f1"/>')
}
