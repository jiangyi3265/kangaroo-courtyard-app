import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkWxmlBindings } from './check-wxml-bindings.mjs'
import { scanCompiledMp } from './scan-compiled-mp.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const normalize = (path) => path.replaceAll('\\', '/')
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const limitBytes = 2 * 1024 * 1024
// 微信上传时会把代码再编译一遍，它量出来的主包比这里逐个文件加起来的大约多 80 KB（fixes5：微信 2,085,023，这里 2,006,052）。
// 多出来的部分跟着代码走、图片 1:1 不变。按 18 次真实上传拟合（最大误差 428 字节）：
//   微信主包 ≈ 这里的主包 + 0.2135×JS + 0.3267×WXSS − 0.03×WXML − 25,343
// 留 8 KB 余量：估算超过 2 MiB − 8 KiB 就让构建失败，别等到上传时才被微信拒。
export const wechatMarginBytes = 8 * 1024
export const estimateWechatMain = ({ bytes, js = 0, wxss = 0, wxml = 0 }) =>
  Math.round(bytes + 0.2135 * js + 0.3267 * wxss - 0.03 * wxml - 25343)

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
  const privateApis = app.requiredPrivateInfos || []
  if (privateApis.includes('getLocation') && privateApis.includes('getFuzzyLocation')) {
    problems.push('getLocation and getFuzzyLocation are mutually exclusive in requiredPrivateInfos')
  }
  for (const issue of checkWxmlBindings(output)) {
    problems.push(`Component props shadowed by loop alias ${issue.alias}: ${issue.file}:${issue.line}`)
  }
  // 模板用了脚本没定义的名字：运行时报错、页面停在第一帧（2026.10.28.4 起换宿岗位详情一直空白就是这样）。见 scan-compiled-mp.mjs
  const scan = scanCompiledMp(output)
  for (const { file, names } of scan.undefinedNames) {
    problems.push(`Template uses names the script never defines: ${file}: ${names.join(', ')}`)
  }
  // 没扫到不等于没问题：解析不了的文件、认不出渲染函数的 setup，模板都没查过
  for (const { file, message } of scan.parseFailures) {
    problems.push(`Compiled file could not be scanned: ${file}: ${message}`)
  }
  for (const { file, count } of scan.unscannedSetups) {
    problems.push(`setup without a recognizable render function, template not checked: ${file}: ${count}`)
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
  const assetRoots = [
    resolve(root, 'static'),
    ...(sourceConfig.subPackages || sourceConfig.subpackages || [])
      .map(pack => resolve(root, pack.root, 'static')).filter(path => existsSync(path))
  ]
  for (const source of assetRoots.flatMap(filesIn)) {
    const name = normalize(relative(root, source))
    if (excluded.has(name)) continue
    // static/<平台>/ 只进对应平台（uni-app 规则）：static/h5/（网页版和小程序从线上加载的标题字体）本来就不进小程序包
    if (/(?:^|\/)static\/(h5|web|app|app-plus|app-harmony|mp-(?!weixin\/)[a-z-]+)\//.test(name)) continue
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
  const mainCode = { js: 0, wxss: 0, wxml: 0 }
  const packageOf = name => packages.find(pack => pack.root && name.startsWith(pack.root)) || packages[0]
  for (const file of filesIn(output)) {
    const name = normalize(relative(output, file))
    const bytes = statSync(file).size
    if (excluded.has(name)) { excludedBytes += bytes; continue }
    if (name.endsWith('.map')) problems.push(`Source map included in package: ${name}`)
    const pack = packageOf(name)
    if (extname(file) === '.json' && existsSync(file.slice(0, -5) + '.wxml')) {
      const definition = readJson(file)
      for (const [component, location] of Object.entries(definition.usingComponents || {})) {
        if (!location.startsWith('.') && !location.startsWith('/')) continue
        const target = location.startsWith('/') ? resolve(output, '.' + location) : resolve(dirname(file), location)
        const targetPack = packageOf(normalize(relative(output, target)))
        if (targetPack.root && targetPack !== pack && !definition.componentPlaceholder?.[component]) {
          problems.push(`Missing componentPlaceholder for cross-package component: ${name} -> ${component}`)
        }
      }
    }
    pack.bytes += bytes
    pack.files++
    const type = extname(name).slice(1)
    if (pack === packages[0] && type in mainCode) mainCode[type] += bytes
  }
  for (const pack of packages) {
    pack.limitBytes = limitBytes
    pack.remainingBytes = limitBytes - pack.bytes
    pack.ok = pack.bytes < limitBytes
    if (!pack.ok) problems.push(`${pack.name} exceeds 2 MiB: ${pack.bytes} bytes`)
  }
  // 主包按微信口径的估算（见文件开头）；发布前仍要在开发者工具预览里记下微信给的真实大小
  const estimateBytes = estimateWechatMain({ bytes: packages[0].bytes, ...mainCode })
  const wechatMain = { ...mainCode, checkerBytes: packages[0].bytes, estimateBytes, limitBytes: limitBytes - wechatMarginBytes,
    remainingBytes: limitBytes - wechatMarginBytes - estimateBytes, ok: estimateBytes <= limitBytes - wechatMarginBytes }
  if (!wechatMain.ok) {
    problems.push(`main WeChat-size estimate ${estimateBytes} bytes exceeds ${wechatMain.limitBytes} (2 MiB minus the 8 KiB margin)`)
  }
  const totalBytes = packages.reduce((sum, pack) => sum + pack.bytes, 0)
  if (totalBytes >= 20 * 1024 * 1024) problems.push('Total package exceeds 20 MiB')
  return { output, pages: expectedRoutes.length, checkedAssets, assetBytes, excluded: [...excluded], excludedBytes,
    packages, wechatMain, totalBytes, problems, ok: problems.length === 0 }
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
  const wx = report.wechatMain
  console.log(`[mp-package] main as WeChat measures it (estimate): ${(wx.estimateBytes / 1024).toFixed(1)} KiB / ${(wx.limitBytes / 1024).toFixed(0)} KiB, ${(wx.remainingBytes / 1024).toFixed(1)} KiB left ${wx.ok ? 'OK' : 'OVER LIMIT'}`)
  console.log(`[mp-package] ${report.pages} routes; ${report.checkedAssets} assets checked byte-for-byte; total ${(report.totalBytes / 1024).toFixed(1)} KiB`)
  if (!report.ok) throw new Error(report.problems.join('\n'))
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  reportMpPackage(resolve(projectRoot, process.argv[2] || 'dist/build/mp-weixin'))
}
