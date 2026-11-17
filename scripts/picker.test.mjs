import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 通用选择页（common/picker.js + pages/system/picker.vue）：滚轮的日期计算，以及页面里不再让人手动输入 HH:mm / yyyy-MM-dd / MM-dd
const source = await readFile(new URL('../common/picker.js', import.meta.url), 'utf8')
const { daysIn, range, ymd, clampYmd, snapTime } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

test('wheel date helpers handle month lengths, leap years and limits', () => {
  assert.equal(daysIn(2028, 2), 29)
  assert.equal(daysIn(2027, 2), 28)
  assert.equal(daysIn(2026, 4), 30)
  assert.equal(daysIn(2000, 2), 29) // 月日滚轮用闰年，生日可以选 2 月 29 日
  assert.deepEqual(range(0, 59, 15), [0, 15, 30, 45])
  assert.equal(ymd(2019, 3, 7), '2019-03-07')
  assert.equal(clampYmd('2030-01-01', '', '2026-10-12'), '2026-10-12')
  assert.equal(clampYmd('2020-01-01', '2021-05-01', ''), '2021-05-01')
  assert.equal(clampYmd('2024-06-01', '2021-05-01', '2026-10-12'), '2024-06-01')
})

test('time wheel snaps to the step and never overflows the hour', () => {
  assert.deepEqual(snapTime('14:32', 5), [14, 30])
  assert.deepEqual(snapTime('14:58', 5), [14, 55])
  assert.deepEqual(snapTime('22:50', 30), [22, 30])
  assert.deepEqual(snapTime('', 5), [9, 0])
})

test('pages no longer ask users to type dates or times by hand', async () => {
  const root = new URL('../pages/', import.meta.url)
  const bad = []
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) await walk(p)
      else if (e.name.endsWith('.vue')) {
        const text = await readFile(p, 'utf8')
        for (const line of text.split('\n')) if (/prompt\(|placeholderText/.test(line) && /HH:mm|yyyy-MM-dd|MM-dd/.test(line)) bad.push(p + ': ' + line.trim().slice(0, 80))
      }
    }
  }
  await walk(fileURLToPath(root))
  assert.deepEqual(bad, [])
})

test('long pickers open the one-screen list instead of paging, and the picker page is registered', async () => {
  const ui = await readFile(new URL('../common/ui.js', import.meta.url), 'utf8')
  assert.match(ui, /export async function pickPaged\(labels, title = '请选择'\) \{\s*if \(labels\.length <= 6\) return sheetOnce\(labels\)\s*const picked = await pickFromList/)
  const pages = JSON.parse(await readFile(new URL('../pages.json', import.meta.url), 'utf8'))
  assert.ok(pages.pages.some(p => p.path === 'pages/system/picker'))
})
