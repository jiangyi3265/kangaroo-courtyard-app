import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { checkMpPackage, estimateWechatMain, wechatMarginBytes } from './mp-package.mjs'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'kangaroo-package-test-'))
  const output = join(root, 'dist')
  const write = (name, content) => {
    const path = join(root, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  for (const dir of ['pages', 'components', 'common', 'styles']) mkdirSync(join(root, dir))
  write('App.vue', '<template><view /></template>')
  write('main.js', '')
  write('pages.json', JSON.stringify({ pages: [{ path: 'pages/home' }], subPackages: [] }))
  write('static/media/photo.jpg', 'unchanged-image-bytes')
  write('static/media/kangaroo-atlas.png', 'unused-atlas')
  write('dist/app.json', JSON.stringify({ pages: ['pages/home'] }))
  write('dist/project.config.json', JSON.stringify({ packOptions: { ignore: [{ type: 'file', value: 'static/media/kangaroo-atlas.png' }] } }))
  write('dist/static/media/photo.jpg', 'unchanged-image-bytes')
  write('dist/static/media/kangaroo-atlas.png', 'unused-atlas')
  for (const ext of ['js', 'json', 'wxml', 'wxss']) write(`dist/pages/home.${ext}`, ext === 'json' ? '{}' : '')
  t.after(() => {
    // Only remove this test's uniquely created, explicitly bounded fixture.
    assert.equal(dirname(root), resolve(tmpdir()))
    assert.ok(root.startsWith(join(tmpdir(), 'kangaroo-package-test-')))
    rmSync(root, { recursive: true })
  })
  return { root, output, write }
}

test('counts upload files while preserving and verifying source images', (t) => {
  const f = fixture(t)
  const report = checkMpPackage(f.output, f.root)
  assert.equal(report.ok, true)
  assert.equal(report.checkedAssets, 1)
  assert.equal(report.excludedBytes, Buffer.byteLength('unused-atlas'))
  assert.equal(report.pages, 1)
})

test('fails if the compiler omits a static asset', (t) => {
  const f = fixture(t)
  unlinkSync(join(f.output, 'static/media/photo.jpg'))
  assert.match(checkMpPackage(f.output, f.root).problems.join('\n'), /Missing asset/)
})

test('requires a placeholder when a page loads a component from another subpackage', t => {
  const f = fixture(t)
  f.write('dist/app.json', JSON.stringify({ pages: ['pages/home'], subPackages: [{ root: 'stays', pages: [] }] }))
  const definition = { usingComponents: { refund: '../stays/refund' } }
  f.write('dist/pages/home.json', JSON.stringify(definition))
  assert.match(checkMpPackage(f.output, f.root).problems.join('\n'), /Missing componentPlaceholder.*refund/)
  definition.componentPlaceholder = { refund: 'view' }
  f.write('dist/pages/home.json', JSON.stringify(definition))
  assert.equal(checkMpPackage(f.output, f.root).ok, true)
})

test('fails if image bytes change', (t) => {
  const f = fixture(t)
  f.write('dist/static/media/photo.jpg', 'lossy-replacement')
  assert.match(checkMpPackage(f.output, f.root).problems.join('\n'), /Asset changed/)
})

test('fails if a future page references the excluded atlas', (t) => {
  const f = fixture(t)
  f.write('pages/home.vue', '<image src="/static/media/kangaroo-atlas.png" />')
  assert.match(checkMpPackage(f.output, f.root).problems.join('\n'), /Excluded asset is referenced/)
})

test('fails if a page disappears from the compiled routes', (t) => {
  const f = fixture(t)
  f.write('dist/app.json', JSON.stringify({ pages: [] }))
  assert.match(checkMpPackage(f.output, f.root).problems.join('\n'), /page routes differ/)
})

test('fails if main package exceeds the limit', (t) => {
  const f = fixture(t)
  f.write('dist/oversized.js', Buffer.alloc(2 * 1024 * 1024))
  assert.equal(checkMpPackage(f.output, f.root).packages[0].ok, false)
})

test('rejects mutually exclusive WeChat location permissions before upload', (t) => {
  const f = fixture(t)
  f.write('dist/app.json', JSON.stringify({
    pages: ['pages/home'], requiredPrivateInfos: ['getLocation', 'getFuzzyLocation']
  }))
  const report = checkMpPackage(f.output, f.root)
  assert.equal(report.ok, false)
  assert.match(report.problems.join('\n'), /getLocation.*getFuzzyLocation.*mutually exclusive/)
})

test('allows the precise location API used for distance verification', (t) => {
  const f = fixture(t)
  f.write('dist/app.json', JSON.stringify({
    pages: ['pages/home'], requiredPrivateInfos: ['getLocation']
  }))
  assert.equal(checkMpPackage(f.output, f.root).ok, true)
})

test('accounts for a subpackage separately', (t) => {
  const f = fixture(t)
  f.write('pages.json', JSON.stringify({ pages: [{ path: 'pages/home' }], subPackages: [{ root: 'pages/jobs', pages: [{ path: 'list' }] }] }))
  f.write('dist/app.json', JSON.stringify({ pages: ['pages/home'], subPackages: [{ root: 'pages/jobs', pages: ['list'] }] }))
  for (const ext of ['js', 'json', 'wxml', 'wxss']) f.write(`dist/pages/jobs/list.${ext}`, ext === 'json' ? '{}'.padEnd('subpackage-content'.length) : 'subpackage-content')
  f.write('pages/jobs/static/cover.jpg', 'cover')
  f.write('dist/pages/jobs/static/cover.jpg', 'cover')
  const report = checkMpPackage(f.output, f.root)
  assert.equal(report.ok, true)
  assert.equal(report.packages[1].files, 5)
  assert.equal(report.packages[1].bytes, 4 * Buffer.byteLength('subpackage-content') + Buffer.byteLength('cover'))
  assert.equal(report.checkedAssets, 2)
  unlinkSync(join(f.output, 'pages/jobs/static/cover.jpg'))
  assert.ok(checkMpPackage(f.output, f.root).problems.includes('Missing asset: pages/jobs/static/cover.jpg'))
})

// 微信口径的主包估算：拿两次真实上传对一下（微信回报的主包大小），误差不超过拟合时的最大误差 428 字节
test('WeChat-size estimate matches real uploads within the fitted error', () => {
  const fixes5 = estimateWechatMain({ bytes: 2006052, js: 350549, wxss: 101376, wxml: 110075 })
  const polish3 = estimateWechatMain({ bytes: 2001855, js: 347424, wxss: 101241, wxml: 109138 })
  assert.ok(Math.abs(fixes5 - 2085023) <= 428, String(fixes5))
  assert.ok(Math.abs(polish3 - 2080594) <= 428, String(polish3))
  assert.equal(wechatMarginBytes, 8192)
})

test('reports the WeChat-size estimate from main-package code only', (t) => {
  const f = fixture(t)
  // 假 JS 用空格填：全 0 字节解析不了，打包检查会拦（见 scan-compiled-mp.test.mjs）
  f.write('dist/common/vendor.js', Buffer.alloc(10000, ' '))
  f.write('dist/app.wxss', Buffer.alloc(4000))
  f.write('dist/pages/home.wxml', Buffer.alloc(1000))
  f.write('pages.json', JSON.stringify({ pages: [{ path: 'pages/home' }], subPackages: [{ root: 'pages/jobs', pages: [{ path: 'list' }] }] }))
  f.write('dist/app.json', JSON.stringify({ pages: ['pages/home'], subPackages: [{ root: 'pages/jobs', pages: ['list'] }] }))
  for (const ext of ['json', 'wxml', 'wxss']) f.write(`dist/pages/jobs/list.${ext}`, ext === 'json' ? '{}'.padEnd(50000) : Buffer.alloc(50000))
  f.write('dist/pages/jobs/list.js', Buffer.alloc(50000, ' '))
  const report = checkMpPackage(f.output, f.root)
  const main = report.packages[0]
  assert.deepEqual([report.wechatMain.js, report.wechatMain.wxss, report.wechatMain.wxml], [10000, 4000, 1000])
  assert.equal(report.wechatMain.checkerBytes, main.bytes)
  assert.equal(report.wechatMain.estimateBytes, Math.round(main.bytes + 0.2135 * 10000 + 0.3267 * 4000 - 0.03 * 1000 - 25343))
  assert.equal(report.wechatMain.limitBytes, 2 * 1024 * 1024 - 8192)
  assert.equal(report.wechatMain.ok, true)
  assert.equal(report.ok, true)
})

// 本脚本数出来还差 200 多 KB 才到 2 MiB，但按微信口径已经超了：构建要失败，不能等上传时才被拒
test('fails when the WeChat-size estimate is over the limit although the raw count fits', (t) => {
  const f = fixture(t)
  f.write('dist/common/vendor.js', Buffer.alloc(1800000))
  const report = checkMpPackage(f.output, f.root)
  assert.equal(report.packages[0].ok, true)
  assert.ok(report.wechatMain.estimateBytes > 2 * 1024 * 1024 - 8192)
  assert.equal(report.wechatMain.ok, false)
  assert.ok(report.wechatMain.remainingBytes < 0)
  assert.equal(report.ok, false)
  assert.match(report.problems.join('\n'), /WeChat-size estimate \d+ bytes exceeds 2088960/)
})

test('subpackage code does not count toward the WeChat main estimate', (t) => {
  const f = fixture(t)
  f.write('pages.json', JSON.stringify({ pages: [{ path: 'pages/home' }], subPackages: [{ root: 'pages/jobs', pages: [{ path: 'list' }] }] }))
  f.write('dist/app.json', JSON.stringify({ pages: ['pages/home'], subPackages: [{ root: 'pages/jobs', pages: ['list'] }] }))
  for (const ext of ['json', 'wxml', 'wxss']) f.write(`dist/pages/jobs/list.${ext}`, ext === 'json' ? '{}' : '')
  f.write('dist/pages/jobs/list.js', Buffer.alloc(1800000, ' '))
  const report = checkMpPackage(f.output, f.root)
  assert.equal(report.wechatMain.js, 0)
  assert.equal(report.wechatMain.ok, true)
  assert.equal(report.ok, true)
})
