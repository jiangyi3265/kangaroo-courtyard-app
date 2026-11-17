import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { diaryHeader, diaryCard, twoColumns, previewList, diarySource } from '../pages/stays/stays-media.js'

test('岗位日常按岗位定位门店，原小院入口继续可用，缺失或非法编号不发请求', () => {
  assert.deepEqual(diarySource({ jobId: '7', stayId: '99' }), { kind: 'job', title: '店里日常', url: '/app/job/7/diary' })
  assert.deepEqual(diarySource({ stayId: '9' }), { kind: 'stay', title: '近期生活碎片', url: '/app/stay/9/diary' })
  for (const q of [{}, { jobId: '-1' }, { jobId: 'abc' }, { jobId: '1.5' }]) assert.equal(diarySource(q), null)
})

test('生活碎片顶部完整采用门店上传数据，长文案不会在映射中截断', () => {
  const header = { bg: '/profile/upload/custom.jpg', title: '海边日记', subtitle: '记录我们共同生活的每一天', lines: ['长文案'.repeat(25), '第二句', '第三句'] }
  assert.deepEqual(diaryHeader(header), header)
  assert.equal(diaryHeader(null).title, '小院日记')
  assert.equal(diaryHeader({}).bg, '')
})

test('照片视频保持员工顺序，视频使用上传封面，照片预览不会混入视频', () => {
  const rows = [diaryCard({ diaryId: 1, type: 'video', url: '/video.mp4', cover: '/cover.jpg', caption: '晚霞', date: '10.12' }), diaryCard({ diaryId: 2, type: 'image', url: '/photo.jpg', caption: '早餐', date: '10.10' })]
  assert.equal(rows[0].thumb, '/cover.jpg')
  assert.deepEqual(twoColumns(rows).map(col => col.map(x => x.diaryId)), [[1], [2]])
  assert.deepEqual(previewList(rows, rows[1]), { urls: ['/photo.jpg'], current: '/photo.jpg' })
})

test('员工修改副标题只保存当前门店该字段；取消、超长不会发送', async () => {
  const src = fs.readFileSync(new URL('../pages/staff/rooms.vue', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const start = src.indexOf('async function editDiarySubtitle()')
  const code = src.slice(start, src.indexOf('\n}\n', start) + 2)
  const writes = [], toasts = [], media = { value: { diary: { subtitle: '原副标题' } } }
  let answer = '把海边的每一天记下来'
  const edit = new Function('media', 'prompt', 'toast', 'mediaRun', 'put', 'mediaApi', 'sid', code + ';return editDiarySubtitle')(
    media, async () => answer, msg => toasts.push(msg), work => work(), (url, body) => writes.push({ url, body }), id => '/app/staff/stay/stays/' + id, () => 7)
  await edit()
  assert.deepEqual(writes.pop(), { url: '/app/staff/stay/stays/7/diary-header', body: { subtitle: answer } })
  answer = null; await edit(); assert.equal(writes.length, 0)
  answer = '字'.repeat(81); await edit(); assert.equal(writes.length, 0); assert.equal(toasts.pop(), '副标题最多 80 个字')
  answer = ''; await edit(); assert.deepEqual(writes.pop().body, { subtitle: '' })
})
