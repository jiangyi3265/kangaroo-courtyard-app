// 10-15 订房第一步房型卡片窄屏复查（node --test，不需要构建、不发请求）。守住这几件事：
//   · 「早鸟价」「安心住」标签不再把房型名挤没：标题行可折行，房型名只在自己都超过一行时才省略；
//   · 7晚/15晚/30晚与所选日期的金额分别由 booking-price-display.test.mjs 验证；
//   · 床型筛选不把「—」（没填床型）当成一种床型，选真实床型后照常筛选；
//   · 设施小图标和图片放在同一列、紧贴图片下面，不再钉在卡片底部。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { bookingPriceDisplay } from '../pages/stays/period-price.js'

const src = (await readFile(new URL('../pages/stays/booking.vue', import.meta.url), 'utf8')).replace(/\r\n/g, '\n')
const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(src)[1].replace(/\/\*[\s\S]*?\*\//g, '')
const between = (s, a, b) => {
  const i = s.indexOf(a)
  const j = s.indexOf(b, i)
  assert.ok(i >= 0 && j > i, `找不到 ${a} … ${b}`)
  return s.slice(i, j)
}
const ref = (v) => ({ value: v })
const computed = (fn) => ({ get value() { return fn() } })
const yuan = (fen) => String(fen / 100)
// 同一选择器可能分几处写（也可能和别的选择器写在一组），按出现顺序合并声明（后写的覆盖先写的）；@media 里的不算
const plain = style.replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*\s*\}/g, '')
const rule = (sel) => {
  const out = {}
  for (const m of plain.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!m[1].split(',').map(s => s.trim()).includes(sel)) continue
    for (const d of m[2].split(';')) {
      const k = d.slice(0, d.indexOf(':')).trim()
      if (k) out[k] = d.slice(d.indexOf(':') + 1).trim()
    }
  }
  return out
}

test('床型筛选只列真正填了的床型，「—」不算；选了床型照常筛选', () => {
  const code = between(src, 'const allRoomTypes = computed(', 'async function filterRooms')
  const roomRows = ref([
    { roomTypeId: 1, typeName: '六人间床位', bedDesc: '', capacity: 6, unitLabel: '床位', priceFromFen: 6950, features: [] },
    { roomTypeId: 2, typeName: '山景大床房', bedDesc: '1.8米大床', capacity: 2, unitLabel: '间', priceFromFen: 26800, features: [] },
    { roomTypeId: 3, typeName: '标间', bedDesc: null, capacity: 2, unitLabel: '间', priceFromFen: 20000, features: [] },
    { roomTypeId: 4, typeName: '亲子房', bedDesc: '1.8米大床', capacity: 3, unitLabel: '间', priceFromFen: 30000, features: [] },
  ])
  const m = new Function('roomRows', 'yuan', 'ref', 'computed', 'bookingPriceDisplay', code + '; return { allRoomTypes, bedOptions, roomTypes, bedName }')(roomRows, yuan, ref, computed, bookingPriceDisplay)
  // 卡片上没填床型的仍显示「—」
  assert.deepEqual(m.allRoomTypes.value.map(r => r.bed), ['—', '1.8米大床', '—', '1.8米大床'])
  assert.deepEqual(m.bedOptions.value, ['1.8米大床'])
  m.bedName.value = '1.8米大床'
  assert.deepEqual(m.roomTypes.value.map(r => r.roomTypeId), [2, 4])
  m.bedName.value = '全部床型'
  assert.equal(m.roomTypes.value.length, 4)
  // 筛选面板用的正是这份床型列表
  assert.match(between(src, 'async function filterRooms', 'const i = await sheet'), /kind === 1 \? \['全部床型', \.\.\.bedOptions\.value\]/)
})

test('标题行可折行：标签放不下时掉到下一行，房型名保住自己的宽度', () => {
  assert.equal(rule('.type-title').display, 'flex')
  assert.equal(rule('.type-title')['flex-wrap'], 'wrap')
  const name = rule('.type-title>text')
  assert.equal(name['max-width'], '100%')
  assert.equal(name['white-space'], 'normal', '纵向大图卡允许长房型名完整换行')
  assert.match(src, /<view class="type-title"><text>\{\{ room\.name \}\}<\/text><k-chip v-if="room\.promo"/)
})

test('设施小图标紧贴图片下面（和图片同一列），不再钉在卡片底部', () => {
  assert.match(src, /<view class="type-media"><image :src="absUrl\(room\.image\)[^>]*\/><view v-if="room\.features\.length" class="type-features"><view v-for="item in room\.features"[\s\S]*?<\/view><\/view><\/view><view class="type-main">/)
  const f = rule('.type-features')
  assert.equal(f.position, undefined)
  assert.equal(f.bottom, undefined)
  assert.equal(f['flex-wrap'], 'wrap')
  assert.equal(rule('.type-media').width, '100%', '与详情页一致的全宽房型照片')
  assert.equal(rule('.type-media>image').height, '160px')
  assert.doesNotMatch(style, /\.type-card>image/)
  assert.equal(rule('.type-features>view>text')['white-space'], 'nowrap')
})
