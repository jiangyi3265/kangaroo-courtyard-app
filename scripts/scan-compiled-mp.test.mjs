// 2026-10-31：scripts/scan-compiled-mp.mjs 的回归。
// 对 2026.10.30.2 的发布产物要能抓到 images（换宿岗位详情一直空白的原因）；对当前版本的产物要查不出问题。
// 产物不存在、或产物不是当前版本时，对应的用例跳过并写明原因（跳过不等于通过，看 skip 的说明）。
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { scanCompiledMp } from './scan-compiled-mp.mjs'
import { checkMpPackage } from './mp-package.mjs'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const requireBabel = createRequire(createRequire(join(app, 'package.json')).resolve('@vue/compiler-sfc/package.json'))
const { parse } = requireBabel('@babel/parser')
const babelTraverse = requireBabel('@babel/traverse')
const traverse = babelTraverse.default || babelTraverse
const BROKEN = resolve(app, '../artifacts/release-20261030-role-switch/mp-weixin')
const sourceVersion = /APP_VERSION = '([^']+)'/.exec(readFileSync(join(app, 'common/config.js'), 'utf8'))[1]

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'kangaroo-scan-test-'))
  t.after(() => rmSync(root, { recursive: true }))
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true })
    writeFileSync(join(root, name), content)
  }
  return root
}

test('渲染函数用了脚本没定义的名字：抓到文件和名字；框架自带的 $ 开头名字不算', (t) => {
  const root = fixture(t, {
    'pages/bad.js': 'const a={setup(e){const n=1;return(c,r)=>({a:n,b:c.images.length,d:c.$slots,f:c.$props})}};module.exports=a;',
    'pages/good.js': 'const a={setup(e){const n=1;return(c,r)=>({a:n,b:c.$slots})}};module.exports=a;',
    'pages/plain.js': 'function f(){return x=>x.images}\nmodule.exports={f,render:{setup(){return 1}}};'
  })
  const report = scanCompiledMp(root)
  assert.deepEqual(report.undefinedNames, [{ file: 'pages/bad.js', names: ['images'] }])
  assert.equal(report.renders, 2, '不是 setup 返回的箭头函数不算渲染函数')
  assert.equal(report.ok, false)
  assert.match(report.problems.join('\n'), /pages\/bad\.js: images/)
})

test('压缩后 return 是逗号表达式：一样认出渲染函数，一样抓到没定义的名字', (t) => {
  const report = scanCompiledMp(fixture(t, {
    'pages/bad.js': 'const a={setup(e){return f(),(c,r)=>({b:c.images.length})}};module.exports=a;',
    'pages/bad2.js': 'const a={setup(e){return f(),g(),(c,r)=>{return{b:c.photos.length}}}};module.exports=a;',
    'pages/good.js': 'const a={setup(e){const n=1;return f(),(c,r)=>({a:n,b:c.$slots})}};module.exports=a;',
    // 没有局部变量的 setup：箭头函数直接返回渲染函数，没有 return 语句（真产物 components/k-bottom）
    'pages/noreturn.js': 'const a={setup:e=>(c,r)=>({b:c.videos.length})};module.exports=a;',
    'pages/noreturn2.js': 'const a={setup:e=>(f(),(c,r)=>({b:c.covers.length}))};module.exports=a;'
  }))
  assert.deepEqual(report.undefinedNames, [
    { file: 'pages/bad.js', names: ['images'] }, { file: 'pages/bad2.js', names: ['photos'] },
    { file: 'pages/noreturn.js', names: ['videos'] }, { file: 'pages/noreturn2.js', names: ['covers'] }
  ])
  assert.equal(report.renders, 5)
  assert.deepEqual(report.unscannedSetups, [])
})

test('setup 里认不出渲染函数：报出来，不当成没问题；不带参数的渲染函数碰不到 _ctx，不算', (t) => {
  const report = scanCompiledMp(fixture(t, {
    'pages/object.js': 'const a={setup(){return{n:1}}};module.exports=a;',
    'pages/conditional.js': 'const a={setup(e){return e?(c,r)=>({b:c.images.length}):null}};module.exports=a;',
    'pages/property.js': 'const a={setup:function(){return{n:1}}};module.exports=a;',
    'pages/noargs.js': 'const a={setup(){return()=>({})}};module.exports=a;',
    'pages/early.js': 'const a={setup(e){if(e)return;return(c,r)=>({a:1})}};module.exports=a;'
  }))
  assert.deepEqual(report.unscannedSetups, [
    { file: 'pages/conditional.js', count: 1 }, { file: 'pages/object.js', count: 1 }, { file: 'pages/property.js', count: 1 }
  ])
  assert.equal(report.ok, false)
  assert.match(report.problems.join('\n'), /template not checked: pages\/conditional\.js: 1/)
})

test('小程序环境没有的全局变量：抓到；白名单里的不算；common/vendor 运行库不扫', (t) => {
  const report = scanCompiledMp(fixture(t, {
    'pages/bad.js': 'wx.getSystemInfoSync();localStorage.getItem("a");',
    'pages/good.js': 'wx.getSystemInfoSync();setTimeout(()=>{},1);require("./x.js");',
    'common/vendor.js': 'localStorage.getItem("a");'
  }))
  assert.deepEqual(report.unknownGlobals, [{ file: 'pages/bad.js', names: ['localStorage'] }])
})

test('解析不了的文件要报出来，不能当成没问题；目录不存在直接报错', (t) => {
  const report = scanCompiledMp(fixture(t, { 'pages/broken.js': 'const = ;' }))
  assert.equal(report.parseFailures.length, 1)
  assert.equal(report.parseFailures[0].file, 'pages/broken.js')
  assert.equal(report.ok, false)
  assert.throws(() => scanCompiledMp(join(app, 'no-such-output')), /产物目录不存在/)
})

test('打包检查（mp-package）会拦住这种产物，发布脚本走的就是它', (t) => {
  const root = fixture(t, {
    'App.vue': '<template><view /></template>', 'main.js': '',
    'pages/.keep': '', 'components/.keep': '', 'common/.keep': '', 'styles/.keep': '', 'static/.keep': '',
    'pages.json': JSON.stringify({ pages: [{ path: 'pages/home' }], subPackages: [] }),
    'dist/app.json': JSON.stringify({ pages: ['pages/home'] }),
    'dist/project.config.json': JSON.stringify({ packOptions: { ignore: [] } }),
    'dist/static/.keep': '',
    'dist/pages/home.js': 'const a={setup(e){return(c,r)=>({b:c.images.length})}};module.exports=a;',
    'dist/pages/home.json': '{}', 'dist/pages/home.wxml': '', 'dist/pages/home.wxss': ''
  })
  const report = checkMpPackage(join(root, 'dist'), root)
  assert.match(report.problems.join('\n'), /pages\/home\.js: images/)
  assert.equal(report.ok, false)
})

test('打包检查：逗号表达式的渲染函数、解析不了的文件、认不出渲染函数的 setup，都要拦住', (t) => {
  const pack = (js) => {
    const root = fixture(t, {
      'App.vue': '<template><view /></template>', 'main.js': '',
      'pages/.keep': '', 'components/.keep': '', 'common/.keep': '', 'styles/.keep': '', 'static/.keep': '',
      'pages.json': JSON.stringify({ pages: [{ path: 'pages/home' }], subPackages: [] }),
      'dist/app.json': JSON.stringify({ pages: ['pages/home'] }),
      'dist/project.config.json': JSON.stringify({ packOptions: { ignore: [] } }),
      'dist/static/.keep': '',
      'dist/pages/home.js': js,
      'dist/pages/home.json': '{}', 'dist/pages/home.wxml': '', 'dist/pages/home.wxss': ''
    })
    return checkMpPackage(join(root, 'dist'), root)
  }
  const sequence = pack('const a={setup(e){return f(),(c,r)=>({b:c.images.length})}};module.exports=a;')
  assert.match(sequence.problems.join('\n'), /names the script never defines: pages\/home\.js: images/)
  assert.equal(sequence.ok, false)
  const broken = pack('const = ;')
  assert.match(broken.problems.join('\n'), /could not be scanned: pages\/home\.js/)
  assert.equal(broken.ok, false)
  const unknown = pack('const a={setup(){return{n:1}}};module.exports=a;')
  assert.match(unknown.problems.join('\n'), /template not checked: pages\/home\.js: 1/)
  assert.equal(unknown.ok, false)
  assert.equal(pack('const a={setup(e){const n=1;return f(),(c,r)=>({a:n})}};module.exports=a;').ok, true, '干净的不误伤')
})

test('2026.10.30.2 的发布产物：抓到 pages/jobs/detail.js 的 images，而且只有这一处', { skip: existsSync(BROKEN) ? false : `产物不存在，没法验证：${BROKEN}` }, () => {
  const report = scanCompiledMp(BROKEN)
  assert.deepEqual(report.undefinedNames, [{ file: 'pages/jobs/detail.js', names: ['images'] }])
  assert.deepEqual(report.unknownGlobals, [])
  assert.deepEqual(report.unscannedSetups, [])
  assert.deepEqual(report.parseFailures, [])
  assert.equal(report.ok, false)
})

// 另一种数法，不走扫描器的判断：真产物里每个文件数 setup( 和 setup: 出现几次
function countSetups(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const name = prefix + entry.name
    if (entry.isDirectory()) return total + countSetups(join(directory, entry.name), name + '/')
    if (!entry.name.endsWith('.js') || name.startsWith('common/vendor')) return total
    return total + (readFileSync(join(directory, entry.name), 'utf8').match(/\bsetup[(:]/g) || []).length
  }, 0)
}

test('2026.10.30.2 的发布产物：每个 setup 的渲染函数都扫到了（115 个：直接返回 68、逗号表达式 46、没有 return 语句 1；原来只认第一种）', { skip: existsSync(BROKEN) ? false : `产物不存在，没法验证：${BROKEN}` }, () => {
  const report = scanCompiledMp(BROKEN)
  assert.equal(countSetups(BROKEN), 115)
  assert.equal(report.renders, 115)
})

test('真产物里 return 是逗号表达式的页面和组件：植入 images 都抓得到', { skip: existsSync(BROKEN) ? false : `产物不存在，没法验证：${BROKEN}` }, (t) => {
  for (const file of ['pages/auth/login.js', 'pages/community/index.js', 'pages/jobs/components/city-coordinator.js', 'pages/home/city-picker.js']) {
    const code = readFileSync(join(BROKEN, file), 'utf8')
    // 找 setup 里 return 的逗号表达式最后一项，第一个参数是 _ctx。真产物的写法变了这里会找不到，用例就失败，不会悄悄跳过
    let render = null
    traverse(parse(code, { sourceType: 'script', allowReturnOutsideFunction: true }), {
      ReturnStatement(returned) {
        const owner = returned.getFunctionParent()
        const argument = returned.node.argument
        if (owner?.node.key?.name === 'setup' && argument?.type === 'SequenceExpression') render = argument.expressions.at(-1)
      }
    })
    assert.equal(render?.type, 'ArrowFunctionExpression', `${file} 没有逗号表达式的渲染函数`)
    const { start, end, type } = render.body
    const use = `void ${render.params[0].name}.images.length`
    const planted = type === 'BlockStatement'
      ? `${code.slice(0, start + 1)}${use};${code.slice(start + 1)}`
      : `${code.slice(0, start)}(${use},${code.slice(start, end)})${code.slice(end)}`
    const report = scanCompiledMp(fixture(t, { [file]: planted }))
    assert.deepEqual(report.undefinedNames, [{ file, names: ['images'] }], file)
  }
})

// 默认看 dist/build/mp-weixin，试构建到别处时用 MP_SCAN_DIR 指过去。旧产物不代表现在的源码，版本号对不上就跳过
function currentOutput() {
  const dir = resolve(app, process.env.MP_SCAN_DIR || 'dist/build/mp-weixin')
  if (!existsSync(dir)) return { dir, skip: `产物不存在，没法验证（先构建，或用 MP_SCAN_DIR 指定）：${dir}` }
  const config = join(dir, 'common/config.js')
  const built = existsSync(config) ? /APP_VERSION\s*=\s*"([^"]+)"/.exec(readFileSync(config, 'utf8'))?.[1] : ''
  if (built !== sourceVersion) return { dir, skip: `产物版本 ${built || '读不到'} 不是当前源码的 ${sourceVersion}，没法验证（先构建，或用 MP_SCAN_DIR 指定）：${dir}` }
  return { dir, skip: false }
}
const current = currentOutput()
test(`当前版本 ${sourceVersion} 的产物：查不出问题`, { skip: current.skip }, () => {
  const report = scanCompiledMp(current.dir)
  assert.deepEqual(report.problems, [])
  assert.deepEqual(report.parseFailures, [])
  assert.ok(report.files > 100 && report.renders > 50, `扫到的文件太少，可能目录不对：${report.files} / ${report.renders}`)
  assert.equal(report.renders, countSetups(current.dir), '每个 setup 的渲染函数都要扫到')
  assert.equal(report.ok, true)
})
