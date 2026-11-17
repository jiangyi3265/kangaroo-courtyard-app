// 岗位详情展示餐补、宠物、住宿照片和视频（V66）。住宿区对提供住宿的岗位保留空状态，老数据、老服务端不能坏。
// 10.28.4 换宿详情空白就是模板用了没定义的名字（images），所以这里把新名字都钉住，构建时 scan-compiled-mp 再查一遍。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'
import { welfareCard, volunteerWelfareColumns, lodgingCard, petCard, mediaCells } from '../pages/jobs/store-page.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8')
const sfc = (rel) => parse(src(rel)).descriptor

test('餐补进福利，紧跟住宿；服务端没给（包吃、老服务端）就不写，老内容一条不变', () => {
  const base = { jobType: 'volunteer', roomTypeLabel: '双人间', settleDesc: '月结' }
  assert.deepEqual(welfareCard(base, { board: '包住宿' }).items, ['住宿：双人间', '结算：月结'])
  assert.deepEqual(welfareCard({ ...base, mealAllowanceText: '' }, { board: '包住宿' }).items, ['住宿：双人间', '结算：月结'])
  assert.deepEqual(welfareCard({ ...base, mealAllowanceText: '15 元/天' }, { board: '包住宿' }).items, ['住宿：双人间', '餐补：15 元/天', '结算：月结'])
  // 换宿两栏：餐补归福利那一栏，不进结算
  const columns = volunteerWelfareColumns(welfareCard({ ...base, mealAllowanceText: '15 元/天' }, { board: '包住宿' }))
  assert.deepEqual(columns[0].items, ['住宿：双人间', '餐补：15 元/天'])
  assert.deepEqual(columns[1].items, ['结算：月结'])
  // 兼职全职：同一个 welfareCard，不是押金之类，走主列表
  assert.deepEqual(welfareCard({ jobType: 'fulltime', mealAllowanceText: '300 元/月' }, { board: '不包食宿' }).items, ['餐补：300 元/月'])
})

test('住宿展示：提供住宿时保留空状态；旧素材仍展示，线上任务不出', () => {
  assert.equal(lodgingCard(null), null)
  assert.equal(lodgingCard({}), null)
  assert.equal(lodgingCard({ lodgingImages: [], lodgingVideo: '', lodgingVideoCover: '' }), null)
  assert.equal(lodgingCard({ lodgingImages: 'x', lodgingVideo: null }), null)
  for (const data of [{ jobType: 'volunteer' }, { jobType: 'parttime', boardType: 'room' }, { jobType: 'fulltime', boardType: 'all' }]) {
    assert.deepEqual(lodgingCard(data), { images: [], video: '', cover: '' })
  }
  for (const boardType of ['none', 'meal']) assert.equal(lodgingCard({ jobType: 'parttime', boardType }), null)
  assert.equal(lodgingCard({ jobType: 'online', boardType: 'all', lodgingImages: ['/a.jpg'] }), null)
  assert.deepEqual(lodgingCard({ lodgingImages: ['/a.jpg', '', null], lodgingVideo: '', lodgingVideoCover: '/stale.jpg' }), { images: ['/a.jpg'], video: '', cover: '' }, '没视频时封面不算')
  assert.deepEqual(lodgingCard({ lodgingImages: [], lodgingVideo: '/v.mp4', lodgingVideoCover: '/c.jpg' }), { images: [], video: '/v.mp4', cover: '/c.jpg' })
})

test('宠物：没填不出；没有、有各一句；有的话带照片', () => {
  assert.equal(petCard(null), null)
  assert.equal(petCard({}), null)
  assert.equal(petCard({ petStatus: '' }), null)
  assert.equal(petCard({ petStatus: '乱写' }), null)
  assert.deepEqual(petCard({ petStatus: 'none', petImages: ['/a.jpg'] }), { text: '店里没有宠物', images: [] })
  assert.deepEqual(petCard({ petStatus: 'yes', petImages: ['/a.jpg'] }), { text: '店里有宠物', images: ['/a.jpg'] })
  assert.deepEqual(petCard({ petStatus: 'yes' }), { text: '店里有宠物', images: [] })
})

test('图格：视频第一格；最多 6 格，放不下的写 +N；点开从这张开始', () => {
  const pics = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => n + '.jpg')
  let cells = mediaCells({ images: pics, video: '/v.mp4', cover: '/c.jpg' })
  assert.equal(cells.length, 6)
  assert.deepEqual(cells[0], { key: 'video', video: true, src: '/c.jpg', index: -1, more: 0 })
  assert.equal(cells[1].src, '1.jpg')
  assert.equal(cells[1].index, 0)
  assert.equal(cells[5].src, '5.jpg')
  assert.equal(cells[5].more, 4, '9 张放了 5 张，还有 4 张')
  cells = mediaCells({ images: pics.slice(0, 6) })
  assert.equal(cells.length, 6)
  assert.equal(cells[5].more, 0, '正好放下不写 +N')
  cells = mediaCells({ images: pics })
  assert.equal(cells[5].more, 3)
  assert.equal(mediaCells({ images: [], video: '/v.mp4' })[0].src, '', '没封面：深色底 + 播放钮')
  assert.deepEqual(mediaCells({ images: [] }), [])
})

test('换宿版式：住宿和宠物放在福利后面；住宿接入展示布局，用到的名字都定义了', () => {
  const d = sfc('pages/jobs/detail.vue')
  const tpl = d.template.content.replace(/\r\n/g, '\n')
  const s = d.scriptSetup.content
  assert.match(tpl, /<view v-if="lodgingInfo" class="sp-card sp-extra sp-lodging">/)
  assert.match(tpl, /<view v-if="petInfo" class="sp-card sp-extra">/)
  assert.match(tpl, /<job-media-grid :images="lodgingInfo\.images" :video="lodgingInfo\.video" :cover="lodgingInfo\.cover" title="住宿展示" layout="lodging" \/>/)
  assert.ok(tpl.indexOf('v-if="sections.welfare"') < tpl.indexOf('v-if="lodgingInfo"'))
  assert.ok(tpl.indexOf('v-if="lodgingInfo"') < tpl.indexOf('v-if="sections.manager"'))
  assert.match(s, /const lodgingInfo = computed\(/)
  assert.match(s, /const petInfo = computed\(/)
  assert.match(s, /import JobMediaGrid from '\.\/components\/job-media-grid\.vue'/)
  assert.match(s, /lodgingCard, petCard,/)
  // 只给 sp 块（换宿）：线上任务那一段没有
  assert.doesNotMatch(tpl.slice(0, tpl.indexOf('<parttime-detail')), /lodgingInfo|petInfo/)
  // 不碰采访视频的播放状态
  assert.doesNotMatch(s, /playing\.value = \{ url: .*lodging/)
})

test('兼职全职版式：住宿环境在待遇后面，宠物不出', () => {
  const d = sfc('pages/jobs/components/parttime-detail.vue')
  const tpl = d.template.content.replace(/\r\n/g, '\n')
  assert.match(tpl, /<view v-if="m\.lodging" class="pt-card pt-lodging">/)
  assert.ok(tpl.indexOf('class="pt-benefits"') < tpl.indexOf('pt-lodging'))
  assert.ok(tpl.indexOf('pt-lodging') < tpl.indexOf('pt-manager'))
  assert.doesNotMatch(tpl, /pet/i)
  assert.match(d.scriptSetup.content, /import JobMediaGrid from '\.\/job-media-grid\.vue'/)
  assert.match(sfc('pages/jobs/detail.vue').scriptSetup.content, /lodging: lodgingInfo\.value,/)
})

test('图格组件：看大图、放视频都在自己里面；全屏播放，不用 inline；3 列', () => {
  const d = sfc('pages/jobs/components/job-media-grid.vue')
  assert.match(d.template.content, /<job-video-player v-if="playing" :src="video" :poster="cover" :title="title" @close="playing = false" \/>/)
  assert.doesNotMatch(d.template.content, /inline/)
  assert.match(d.scriptSetup.content, /uni\.previewImage\(/)
  assert.match(d.styles[0].content, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(d.template.content, /hover-class="k-press-s"/)
})
