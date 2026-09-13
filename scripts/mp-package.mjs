import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkWxmlBindings } from './check-wxml-bindings.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const normalize = (path) => path.replaceAll('\\', '/')
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const limitBytes = 2 * 1024 * 1024

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${path}`)
    return entry.isDirectory() ? filesIn(path) : [path]
  })
}

function routes(config, compiled = false) {
  return [
    ...config.pages.map((page) => compiled ? page : page.path),
    ...(config.subPackages || config.subpackages || []).flatMap((pack) =>
      pack.pages.map((page) => `${pack.root}/${compiled ? page : page.path}`))
  ].sort()
}

export function checkMpPackage(outputDirectory, root = projectRoot) {
  const output = resolve(outputDirectory)
  const config = readJson(resolve(output, 'project.config.json'))
  const app = readJson(resolve(output, 'app.json'))
  const sourceConfig = readJson(resolve(root, 'pages.json'))
  const problems = []
  for (const issue of checkWxmlBindings(output)) {
    problems.push(`Component props shadowed by loop alias ${issue.alias}: ${issue.file}:${issue.line}`)
  }
  const ignored = config.packOptions?.ignore || []
  // Keep the exclusion deliberately narrow. Never silently exclude new assets.
  for (const item of ignored) {
    if (item.type !== 'file' || item.value !== 'static/media/kangaroo-atlas.png') {
      problems.push(`Unverified upload exclusion: ${JSON.stringify(item)}`)
    }
  }
  const excluded = new Set(ignored.filter((item) => item.type === 'file').map((item) => item.value))
  const runtimeSources = ['pages', 'components', 'common', 'styles'].flatMap((dir) => filesIn(resolve(root, dir)))
    .concat(resolve(root, 'App.vue'), resolve(root, 'main.js'))
    .filter((path) => ['.vue', '.js', '.ts', '.css', '.scss', '.json'].includes(extname(path)))
  for (const path of runtimeSources) {
    const source = readFileSync(path, 'utf8')
    for (const asset of excluded) {
      if (source.includes(asset) || source.includes('kangaroo-atlas')) {
        problems.push(`Excluded asset is referenced by ${normalize(relative(root, path))}`)
      }
    }
  }

  let checkedAssets = 0
  let assetBytes = 0
  for (const source of filesIn(resolve(root, 'static'))) {
    const name = normalize(relative(root, source))
    if (excluded.has(name)) continue
    const target = resolve(output, name)
    if (!existsSync(target)) problems.push(`Missing asset: ${name}`)
    else if (hash(source) !== hash(target)) problems.push(`Asset changed: ${name}`)
    checkedAssets++
    assetBytes += statSync(source).size
  }
  const compiledRoutes = routes(app, true)
  const expectedRoutes = routes(sourceConfig)
  if (JSON.stringify(compiledRoutes) !== JSON.stringify(expectedRoutes)) {
    problems.push('Source and compiled page routes differ')
  }
  for (const route of expectedRoutes) {
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      if (!existsSync(resolve(output, `${route}.${extension}`))) problems.push(`Missing page: ${route}.${extension}`)
    }
  }
  const packages = [
    { name: 'main', root: '', bytes: 0, files: 0 },
    ...(app.subPackages || app.subpackages || []).map((pack) => ({ name: pack.root, root: `${pack.root}/`, bytes: 0, files: 0 }))
  ]
  let excludedBytes = 0
  for (const file of filesIn(output)) {
    const name = normalize(relative(output, file))
    const bytes = statSync(file).size
    if (excluded.has(name)) { excludedBytes += bytes; continue }
    if (name.endsWith('.map')) problems.push(`Source map included in package: ${name}`)
    const pack = packages.slice(1).find((pack) => name.startsWith(pack.root)) || packages[0]
    pack.bytes += bytes
    pack.files++
  }
  for (const pack of packages) {
    pack.limitBytes = limitBytes
    pack.remainingBytes = limitBytes - pack.bytes
    pack.ok = pack.bytes < limitBytes
    if (!pack.ok) problems.push(`${pack.name} exceeds 2 MiB: ${pack.bytes} bytes`)
  }
  const totalBytes = packages.reduce((sum, pack) => sum + pack.bytes, 0)
  if (totalBytes >= 20 * 1024 * 1024) problems.push('Total package exceeds 20 MiB')
  return { output, pages: expectedRoutes.length, checkedAssets, assetBytes, excluded: [...excluded], excludedBytes,
    packages, totalBytes, problems, ok: problems.length === 0 }
}

export function reportMpPackage(outputDirectory) {
  const report = checkMpPackage(outputDirectory)
  mkdirSync(resolve(projectRoot, '.qa'), { recursive: true })
  const path = normalize(outputDirectory)
  const prefix = path.includes('/unpackage/') || path.includes('/hbuilder-') ? 'hbuilder-' : ''
  const name = prefix + (/\/(?:hbuilder-)?dev\//.test(path) ? 'dev' : 'build')
  writeFileSync(resolve(projectRoot, `.qa/mp-package-${name}.json`), JSON.stringify(report, null, 2) + '\n')
  for (const pack of report.packages) {
    console.log(`[mp-package] ${pack.name}: ${(pack.bytes / 1024).toFixed(1)} KiB / 2048 KiB ${pack.ok ? 'OK' : 'OVER LIMIT'}`)
  }
  console.log(`[mp-package] ${report.pages} routes; ${report.checkedAssets} assets checked byte-for-byte; total ${(report.totalBytes / 1024).toFixed(1)} KiB`)
  if (!report.ok) throw new Error(report.problems.join('\n'))
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reportMpPackage(resolve(projectRoot, process.argv[2] || 'dist/build/mp-weixin'))
}
