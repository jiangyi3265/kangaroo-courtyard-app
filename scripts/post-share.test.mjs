import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sharePostText, parseSharedPost, postPath, toneLabel, TONES } from '../common/post-share.js'

// 帖子「分享到私信」的消息格式：拼出来的文字聊天页要能认回来；普通聊天内容不能被误认成分享卡片
test('shared post text round-trips to a post card', () => {
  const text = sharePostText({ postId: 128, title: '  洱海边的\n日落  ' })
  assert.equal(text, '【分享动态】洱海边的 日落\n点开查看：袋鼠全球青年 · 社区动态 #128')
  assert.deepEqual(parseSharedPost(text), { postId: 128, title: '洱海边的 日落' })
})

test('shared posts sent before the brand rename still open as cards', () => {
  assert.deepEqual(parseSharedPost('【分享动态】旧分享\n点开查看：袋鼠小院 · 社区动态 #128'), { postId: 128, title: '旧分享' })
})

test('long or empty titles are trimmed / defaulted and bad ids produce nothing', () => {
  assert.equal(parseSharedPost(sharePostText({ postId: 5, title: '字'.repeat(80) })).title.length, 60)
  assert.equal(parseSharedPost(sharePostText({ postId: 5, title: '' })).title, '一条社区动态')
  for (const bad of [null, {}, { postId: 0 }, { postId: -3 }, { postId: 'abc' }, { postId: 1.5 }]) assert.equal(sharePostText(bad), '')
})

test('ordinary chat messages are never mistaken for shared posts', () => {
  for (const s of ['', null, '你好', '【分享动态】', '【分享动态】标题\n点开查看：袋鼠小院 · 社区动态 #', '【分享动态】标题\n点开查看：袋鼠小院 · 社区动态 #12a',
    '【分享动态】标题\n点开查看：袋鼠小院 · 社区动态 #0', '【分享动态】第一行\n第二行\n点开查看：袋鼠小院 · 社区动态 #9', '前缀【分享动态】标题\n点开查看：袋鼠小院 · 社区动态 #9']) {
    assert.equal(parseSharedPost(s), null, String(s))
  }
})

test('share path and tone labels', () => {
  assert.equal(postPath(42), '/pages/community/index?postId=42')
  assert.deepEqual(TONES.map(t => t.key), ['', 'recommend', 'avoid'])
  assert.equal(toneLabel('recommend'), '推荐')
  assert.equal(toneLabel('avoid'), '避雷')
  assert.equal(toneLabel(''), '')
  assert.equal(toneLabel('great'), '')
})

// 分享按钮：小程序里直接用 open-type="share" 一点就打开微信转发面板，不再弹「请点击右上角…」；页面的转发卡片带上帖子编号
test('community page shares with a native share button and no corner-menu dialog', () => {
  const page = readFileSync(new URL('../pages/community/index.vue', import.meta.url), 'utf8')
  assert.match(page, /open-type="share"/)
  assert.doesNotMatch(page, /shareTip/)
  assert.match(page, /onShareAppMessage\(/)
  assert.match(page, /postPath\(/)
})
