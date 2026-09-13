import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { checkMpPackage } from './mp-package.mjs'

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
  for (const ext of ['js', 'json', 'wxml', 'wxss']) write(`dist/pages/home.${ext}`, '')
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

test('accounts for a subpackage separately', (t) => {
  const f = fixture(t)
  f.write('pages.json', JSON.stringify({ pages: [{ path: 'pages/home' }], subPackages: [{ root: 'pages/jobs', pages: [{ path: 'list' }] }] }))
  f.write('dist/app.json', JSON.stringify({ pages: ['pages/home'], subPackages: [{ root: 'pages/jobs', pages: ['list'] }] }))
  for (const ext of ['js', 'json', 'wxml', 'wxss']) f.write(`dist/pages/jobs/list.${ext}`, 'subpackage-content')
  const report = checkMpPackage(f.output, f.root)
  assert.equal(report.ok, true)
  assert.equal(report.packages[1].files, 4)
  assert.equal(report.packages[1].bytes, 4 * Buffer.byteLength('subpackage-content'))
})
