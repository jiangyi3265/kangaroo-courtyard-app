// 2026-10-19 主人「字体统一，都换一下吧」的全站字体守卫（node --test，只读源码）。
// 10-19 标题字体换成 KG Sans（思源黑体粗体 / 特粗的子集，只有 700 / 900 两档），--k-serif / --k-brand 都指向它。复查时发现：
//   · 好几页整页挂着 --k-serif（10-16 那时它等于系统黑体）：隐私政策全文、城市页、增值服务、住宿订单、房态日历、提醒中心、员工端几页的正文全变成了粗体；
//   · 签署姓名还在用楷体（KaiTi / STKaiti）、经营日报 / 荣誉页有几处写的是 sans-serif；
//   · k-h1 / k-title 等标题类写的 600（字体到了显示 700、没到时系统字体是半粗，两种样子）。
// 守住：
//   1. 字体只用 --k-sans（正文）/ --k-display-font / --k-brand / --k-serif（标题）四个变量，不出现宋体、楷体、Georgia、serif、sans-serif 之类的字体名（@font-face 除外）；
//   2. 用了标题字体的规则（同一文件里同一选择器合起来看）字重必须写 700 或 900 —— 没写字重的，多半是正文被挂上了标题字体。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['node_modules', 'dist', 'unpackage', 'artifacts', 'out-urgent-city', 'scripts', 'static', '.impeccable'])
const TOKENS = /var\(--k-(sans|display-font|brand|serif)\)/g
const DISPLAY = /var\(--k-(display-font|brand|serif)\)/

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(vue|scss|css)$/.test(name)) out.push(p)
  }
  return out
}
const stylesOf = (file, text) => (file.endsWith('.vue') ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]) : [text])
// 最里层的「选择器 { 声明 }」；选择器前面混进来的上层声明（scss 嵌套）按分号切掉
const rulesOf = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(m => ({ sel: m[1].split(';').pop().trim(), body: m[2] }))
const declsOf = (body) => body.split(';').map(d => d.trim()).filter(d => d.includes(':')).map(d => [d.slice(0, d.indexOf(':')).trim().toLowerCase(), d.slice(d.indexOf(':') + 1).trim()])

const files = [...walk(path.join(APP, 'pages')), ...walk(path.join(APP, 'components')), ...walk(path.join(APP, 'styles')), path.join(APP, 'App.vue')]
const rel = (f) => path.relative(APP, f).replace(/\\/g, '/')

test('字体名：只用四个字体变量，不出现宋体 / 楷体 / Georgia / serif / sans-serif 之类（@font-face 除外）', () => {
  const bad = []
  for (const f of files) {
    for (const css of stylesOf(f, fs.readFileSync(f, 'utf8'))) {
      for (const { sel, body } of rulesOf(css)) {
        if (/@font-face/.test(sel)) continue
        for (const [k, v] of declsOf(body)) {
          if (k === 'font-family' && v.replace(TOKENS, '').replace(/[\s,]/g, '')) bad.push(`${rel(f)} ${sel} → ${v}`)
          if (k === 'font' && /['"]|serif|sans|mono|kai|song|georgia|cursive/i.test(v.replace(TOKENS, ''))) bad.push(`${rel(f)} ${sel} → font: ${v}`)
        }
      }
    }
  }
  assert.deepEqual(bad, [])
})

test('用了标题字体的规则字重写 700 或 900（没写字重的多半是正文被挂上了只有粗体的标题字体）', () => {
  const bad = []
  for (const f of files) {
    for (const css of stylesOf(f, fs.readFileSync(f, 'utf8'))) {
      const merged = new Map()
      for (const { sel, body } of rulesOf(css)) {
        if (sel.startsWith('@')) continue
        for (const s of sel.split(',').map(x => x.trim()).filter(Boolean)) {
          const m = merged.get(s) || {}
          for (const [k, v] of declsOf(body)) {
            if (k === 'font-family') m.family = v
            if (k === 'font') { m.family = v; const w = /^(\d{3}|bold|normal)\b/.exec(v); m.weight = w ? w[1] : '400' }
            if (k === 'font-weight') m.weight = v
          }
          merged.set(s, m)
        }
      }
      for (const [s, m] of merged) {
        if (m.family && DISPLAY.test(m.family) && !['700', '900', 'bold'].includes(String(m.weight || ''))) bad.push(`${rel(f)} ${s} 字重=${m.weight || '没写'}`)
      }
    }
  }
  assert.deepEqual(bad, [])
})

test('标题类和几处整页字体：k-h1 / k-title 等写 700；隐私政策、城市页、订房几页整页是系统黑体；签署姓名不再用楷体', () => {
  const theme = fs.readFileSync(path.join(APP, 'styles/theme.scss'), 'utf8')
  for (const c of ['k-h1', 'k-h2', 'k-title', 'k-subtitle', 'k-section__title']) assert.match(theme, new RegExp('\\.' + c + ' \\{ font-family: var\\(--k-serif\\); font-weight: 700;'), c)
  const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8')
  assert.match(read('pages/auth/legal.vue'), /\.legal \{ font-family: var\(--k-sans\); \}/)
  assert.match(read('pages/home/city.vue'), /\.city-page \{ font-family: var\(--k-sans\); \}/)
  assert.match(read('pages/stays/booking.vue'), /\.booking-page \{ padding-bottom: calc\(18px \+ var\(--k-safe-bottom\)\); font-family: var\(--k-sans\); \}/)
  assert.match(read('pages/stays/order.vue'), /\.stay-order \{ font-family: var\(--k-sans\); \}/)
  assert.match(read('pages/stays/shop.vue'), /\.shop-page \{ font-family: var\(--k-sans\); \}/)
  assert.match(read('pages/jobs/contract.vue'), /\.signature>text \{ font: 700 44px\/1\.2 var\(--k-display-font\);/)
  assert.doesNotMatch(read('pages/jobs/contract.vue'), /KaiTi|STKaiti/)
})
