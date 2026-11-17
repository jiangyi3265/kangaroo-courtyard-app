// 扫微信小程序打包产物，找两类会让页面运行时报错的问题：
//   1. 模板用到、脚本里却没定义的名字。<script setup> 里定义过的名字打包后直接用，只有没定义的才会落到渲染函数的第一个参数（_ctx）上，
//      于是 _ctx.images.length 这种写法读到 undefined 就报错；uni 的运行库吞掉这个错误、不再更新页面，页面就一直停在第一帧。
//      2026.10.28.4 到 2026.10.30.2 的换宿岗位详情一直空白就是这样（pages/jobs/detail.vue 的 images）。
//   2. 脚本里用了小程序运行环境没有的全局变量（白名单之外的）。
// 查产物不查源码：产物已经按微信条件编译过，只在 #ifdef H5 分支里定义、微信里缺的名字也能查出来。网页版验收查不出这种问题。
//
// 用法：node scripts/scan-compiled-mp.mjs [产物目录，默认 dist/build/mp-weixin]，有问题时退出码为 1。
// scripts/mp-package.mjs 打包检查时也会跑，拦第 1 类和「没扫到」（文件解析失败、setup 里认不出渲染函数）；第 2 类靠这个命令和 scan-compiled-mp.test.mjs。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// @babel/parser、@babel/traverse 不是项目的直接依赖，从直接依赖 @vue/compiler-sfc 那边解析
const requireFromProject = createRequire(join(projectRoot, 'package.json'))
const requireBabel = createRequire(requireFromProject.resolve('@vue/compiler-sfc/package.json'))

// 小程序运行环境里有的全局变量。微信产物里还留着的 window、document 等都是运行库带判断的兼容代码，也放行
export const KNOWN_GLOBALS = new Set(`
  wx getApp getCurrentPages App Page Component Behavior require module exports console
  setTimeout clearTimeout setInterval clearInterval Promise Object Array String Number Boolean Math JSON Date RegExp Symbol Reflect Proxy
  Error TypeError RangeError EvalError SyntaxError URIError ReferenceError AggregateError SuppressedError
  Map Set WeakMap WeakSet WeakRef BigInt isNaN isFinite parseInt parseFloat
  encodeURIComponent decodeURIComponent encodeURI decodeURI escape unescape undefined NaN Infinity
  globalThis global self window arguments Function Intl
  ArrayBuffer DataView Uint8Array Uint8ClampedArray Int8Array Uint16Array Int16Array Uint32Array Int32Array Float32Array Float64Array
  TextDecoder TextEncoder atob btoa URL URLSearchParams performance process define getRegExp queueMicrotask structuredClone
  navigator document location requirePlugin requireMiniProgram __wxConfig
`.trim().split(/\s+/))

function jsFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return jsFiles(path)
    return entry.name.endsWith('.js') ? [path] : []
  })
}

/**
 * @returns {{ files: number, renders: number, undefinedNames: {file: string, names: string[]}[], unknownGlobals: {file: string, names: string[]}[], unscannedSetups: {file: string, count: number}[], parseFailures: {file: string, message: string}[], problems: string[], ok: boolean }}
 */
export function scanCompiledMp(outputDirectory) {
  const root = resolve(outputDirectory)
  if (!existsSync(root)) throw new Error(`产物目录不存在：${root}`)
  const { parse } = requireBabel('@babel/parser')
  const babelTraverse = requireBabel('@babel/traverse')
  const traverse = babelTraverse.default || babelTraverse
  const report = { files: 0, renders: 0, undefinedNames: [], unknownGlobals: [], unscannedSetups: [], parseFailures: [] }

  for (const path of jsFiles(root)) {
    const file = relative(root, path).split(sep).join('/')
    // 运行库本身不扫：它的兼容代码很多，也不是我们写的页面
    if (file.startsWith('common/vendor')) continue
    let ast
    try {
      ast = parse(readFileSync(path, 'utf8'), { sourceType: 'script', allowReturnOutsideFunction: true })
    } catch (error) {
      report.parseFailures.push({ file, message: error.message })
      continue
    }
    report.files++
    const setups = new Set()
    const scanned = new Set()
    const isSetup = (fn) => (fn.node.key?.name ?? fn.parentPath?.node.key?.name) === 'setup'
    // value：setup 返回的东西。压缩后也可能是 return f(),(_ctx,_cache)=>{...}（产物里有 46 个），逗号表达式取最后一项
    const checkRender = (owner, value) => {
      const renderPath = value.isSequenceExpression() ? value.get('expressions').at(-1) : value
      const render = renderPath.node
      if (render?.type !== 'ArrowFunctionExpression') return
      // 一个参数都没有的渲染函数碰不到 _ctx，不用查
      if (!render.params.length) { scanned.add(owner.node); return }
      if (render.params[0].type !== 'Identifier') return
      scanned.add(owner.node)
      report.renders++
      const ctx = renderPath.scope.getBinding(render.params[0].name)
      const names = new Set()
      for (const reference of ctx?.referencePaths || []) {
        const member = reference.parentPath
        if (!member.isMemberExpression() || member.node.object !== reference.node || member.node.computed) continue
        // $slots、$props 这类框架自带的不算
        if (!member.node.property.name.startsWith('$')) names.add(member.node.property.name)
      }
      if (names.size) report.undefinedNames.push({ file, names: [...names] })
    }
    traverse(ast, {
      Program(program) {
        const names = Object.keys(program.scope.globals).filter((name) => !KNOWN_GLOBALS.has(name))
        if (names.length) report.unknownGlobals.push({ file, names })
      },
      Function(fn) {
        if (!isSetup(fn)) return
        setups.add(fn.node)
        // 没有局部变量的 setup 压缩后是 setup:e=>(_ctx,_cache)=>...，没有 return 语句（components/k-bottom 就是）
        if (fn.isArrowFunctionExpression() && !fn.get('body').isBlockStatement()) checkRender(fn, fn.get('body'))
      },
      // <script setup> 打包后是 setup(props) { ...; return (_ctx, _cache) => {...} }，返回的箭头函数就是渲染函数
      ReturnStatement(returned) {
        const owner = returned.getFunctionParent()
        if (owner && isSetup(owner)) checkRender(owner, returned.get('argument'))
      }
    })
    // 看不懂的写法不能当成没问题：以后压缩结果再变，这里报出来，而不是悄悄少扫
    if (setups.size > scanned.size) report.unscannedSetups.push({ file, count: setups.size - scanned.size })
  }

  report.problems = [
    ...report.undefinedNames.map(({ file, names }) => `Template uses names the script never defines: ${file}: ${names.join(', ')}`),
    ...report.unknownGlobals.map(({ file, names }) => `Unknown global in mini program code: ${file}: ${names.join(', ')}`),
    ...report.unscannedSetups.map(({ file, count }) => `setup without a recognizable render function, template not checked: ${file}: ${count}`)
  ]
  report.ok = report.problems.length === 0 && report.parseFailures.length === 0
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = scanCompiledMp(resolve(projectRoot, process.argv[2] || 'dist/build/mp-weixin'))
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.ok ? 0 : 1
}
