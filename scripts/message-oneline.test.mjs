import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { messageWording } from '../common/display-wording.js'

// 2026-10-16 主人截图：接待发的多行消息在「消息」列表里真的换行，整行被撑高，字压到上下两条。
// 列表每行只显示一行：标题和正文里的换行、连续空白并成一个空格；行内容超出部分裁掉。
const src = readFileSync(new URL('../pages/messages/index.vue', import.meta.url), 'utf8')

test('消息列表的标题和正文都先压成一行再显示', () => {
  assert.match(src, /title: oneLine\(shown\.title\), desc: oneLine\(shown\.content\)/)
  assert.match(src, /\.row__main\{flex:1;min-width:0;overflow:hidden\}/)
})

test('oneLine 把换行、制表、全角空格并成一个空格并去掉首尾空白', () => {
  const def = src.match(/const oneLine = (\(v\) => [^\n]+)/)
  assert.ok(def, 'oneLine 定义还在')
  const oneLine = (0, eval)(def[1])
  assert.equal(oneLine('果酱（接待）：1️⃣标题：\n平潭以及福州\r\n\n平潭海鲜\n'), '果酱（接待）：1️⃣标题： 平潭以及福州 平潭海鲜')
  assert.equal(oneLine('在吗\t　　明天到'), '在吗 明天到')
  assert.equal(oneLine(null), '')
  assert.equal(oneLine(undefined), '')
  const raw = Object.freeze({ title: '义工\n报名', content: '义工\n工作', category: 'apply' })
  const shown = messageWording(raw)
  assert.equal(oneLine(shown.title), '换工 报名')
  assert.equal(oneLine(shown.content), '换工 工作')
  assert.equal(raw.content, '义工\n工作')
})
