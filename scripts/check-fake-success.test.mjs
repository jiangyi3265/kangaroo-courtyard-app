import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { saveLocalDraft } from '../common/local-drafts.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PAGES_DIR = join(ROOT, 'pages')
// 后端仓库与小程序是并列的两个目录。状态机取值以后端源码为准，不在这里抄一份，
// 抄一份就会和后端各自漂移，而漂移正是这条检查要抓的东西。
const BACKEND_ENUM_DIR = join(ROOT, '..', 'RuoYi-Vue', 'ruoyi-kangaroo', 'src', 'main', 'java', 'com', 'ruoyi', 'kangaroo', 'enums')

// 已接线页面：相对基线提交有改动的 pages/*.vue 一律算已接线，必须对得上真实请求。
// 其余页面按 INTEGRATION.md 第二节仍是静态原型，本文件只统计、不判负。
//
// 这里刻意**不写死名单**。写死的名单靠人维护，接线了一页却忘了加进来，
// 代价是"这一页的假成功检查静默关闭"，而且不会有任何提示 ——
// 本轮就漏过 pages/jobs/contract.vue。改成从 git 推导后，改了哪页就检查哪页。
const baselineRef = () => {
  const f = join(ROOT, '.qa', 'baseline-ref')
  if (existsSync(f)) {
    const ref = readFileSync(f, 'utf8').split('#')[0].trim()
    if (ref) return ref
  }
  const roots = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'],
    { cwd: ROOT, encoding: 'utf8' }).trim().split(/\s+/)
  return roots[roots.length - 1]
}

const changedPages = () => {
  const ref = baselineRef()
  const changed = execFileSync('git', ['diff', '--name-only', ref, '--', 'pages'],
    { cwd: ROOT, encoding: 'utf8' })
  // git diff 看不见未跟踪的文件。基线之后**新建**的页面一定是本轮的新工作，
  // 不是 INTEGRATION.md 第二节说的静态原型；只看 diff 就会漏掉它，
  // 代价又是"新加一页、这一页的假成功检查静默关闭"—— 正是不写死名单要避免的那件事。
  const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'pages'],
    { cwd: ROOT, encoding: 'utf8' })
  // 基线之后删掉或挪走的页面（例如 pages/system/states.vue 挪进了分包）也会出现在 git diff 里：
  // 文件已经不在，没有可检查的东西，跳过；不跳过就会读文件报 ENOENT，整份检查跑挂。
  return [...new Set((changed + '\n' + added).split(/\r?\n/).filter(p => p.endsWith('.vue') && existsSync(join(ROOT, p))))].sort()
}

const WIRED_PAGES = changedPages()

// 断言这些词出现在 toast 里就等于对用户宣称"事情已经发生了"。
// 只收"已完成"语气的词：'提交失败'、'请先确认' 这类不在内，它们没有宣称任何结果。
// 词表漏一个说法就等于放过一类假成功：'提交完成' 既不含"已提交"也不含"成功"，
// 原先直接从检查里溜过去。发现新说法应当往这里加，而不是放宽别的条件。
const SUCCESS_WORDS = [
  '已保存', '已提交', '已发送', '已发布', '已支付', '已生效', '已确认', '已领取',
  '已导出', '已群发', '已撤回', '已下单', '已预约', '已报名', '已申请', '已开通',
  '成功', '完成', '搞定', '已受理', '已生成', '已上传', '已绑定', '已解绑',
  // 下面这批是复核补的。漏掉「已重置」让 pages/jobs/filter.vue 的假成功溜了过去 ——
  // 那一屏的筛选项根本不可点、无物可重置，按钮却弹「已重置」。
  // 凡是「动作已经发生」的过去式说法都要在表里，漏一个就等于放过一类。
  '已重置', '已清空', '已删除', '已取消', '已关闭', '已开启', '已切换', '已更新',
  '已添加', '已移除', '已复制', '已收藏', '已点赞', '已关注', '已退出', '已结束',
  '已暂停', '已恢复', '已兑换', '已核销', '已签到', '已置顶', '已申请', '已预约',
  // 第三批。漏掉这几个词，staff/vlog（已驳回）、home/city（已订阅新机会）、
  // community/activity（已加入活动群）三个整页的假成功一条都没进过欠账清单 ——
  // 清单少算了页数，而报告拿那个数字当过"欠账全貌"。
  '已驳回', '已订阅', '已加入', '已存为', '已复用', '已关联', '已设置', '已下载',
  '已同步', '已离线', '已通过', '已拒绝', '已认领', '已分配', '已锁定', '已解锁',
  '已上架', '已下架', '已入库', '已归档', '已标记', '已转发', '已邀请', '已续期'
]

/**
 * 形态判据：`已` 开头的短句一律按"宣称动作已完成"处理。
 *
 * 加它的理由是这个词表已经漏过三次了（提交完成 / 已重置 / 已驳回），
 * 每次都要等有人想起来补一个词。靠穷举一定还会漏，所以补一条形态规则：
 * 以「已」开头、整句不超过 12 个字、且不含否定或疑问语气的 toast，
 * 都算宣称结果。真有例外，往 SUCCESS_EXEMPT 里显式登记，而不是让它默默溜过。
 */
const SUCCESS_EXEMPT = ['已是最新版本', '已达上限', '已过期', '已满', '已停用', '已失效',
  // 列表翻到底的告知（「已经是全部记录了」「已加载全部」）说的是"没有更多了"，不宣称任何动作完成
  '已经是全部', '已加载全部']
// 按分句判：「请查收，已发送」「提交成功，无法撤回」里只要有一个分句宣称完成就算。
// 被排除的只是**整个分句**本身是引导 / 失败告知的情形（2026-09-24 逐条核过的误报）：
//   「请选择一段已完成的换工经历」是提交前的校验引导；「授权未完成」是失败的如实告知；
//   「房源不存在或已下架」里的「已下架」说的是对象状态，不是本次操作的结果。
const claimsSuccess = (text) => {
  const t = String(text || '').trim()
  if (!t) return false
  return t.split(/[，,。；;！!\n]/).map(c => c.trim()).some(clauseClaims)
}
const clauseClaims = (t) => {
  if (!t) return false
  if (SUCCESS_EXEMPT.some(w => t.includes(w))) return false
  if (/^请/.test(t)) return false
  if (/[未不没无](?:能)?(?:完成|成功)/.test(t)) return false
  if (/不存在|失败|无法/.test(t)) return false
  if (SUCCESS_WORDS.some(word => t.includes(word))) return true
  return /^已[\u4e00-\u9fa5]{1,3}/.test(t) && t.length <= 12 && !/[？?不无未]/.test(t)
}

// ---------------- 基础扫描工具 ----------------

const listVueFiles = (dir, prefix = 'pages') => {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + '/' + entry.name
    if (entry.isDirectory()) out.push(...listVueFiles(join(dir, entry.name), rel))
    else if (entry.name.endsWith('.vue')) out.push(rel)
  }
  return out.sort()
}

// 从 i 处的引号扫到配对的收尾引号，返回收尾引号之后的下标。
// 模板字符串里的 ${} 不再嵌套引号（本仓库现状如此），所以不做递归。
const skipString = (code, i) => {
  const quote = code[i]
  let j = i + 1
  while (j < code.length) {
    if (code[j] === '\\') { j += 2; continue }
    if (code[j] === quote) return j + 1
    j++
  }
  return code.length
}

// 去掉 JS 注释但保留字符串。注释里的"成功""已提交"是解释不是页面文案；
// 被注释掉的 api 调用也不能算"真的发过请求"。
const stripComments = (code) => {
  let out = ''
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++
      continue
    }
    if (c === '/' && code[i + 1] === '*') {
      i += 2
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '\'' || c === '"' || c === '`') {
      const end = skipString(code, i)
      out += code.slice(i, end)
      i = end
      continue
    }
    out += c
    i++
  }
  return out
}

// 单文件组件拆成模板与脚本两段。本仓库的 .vue 一律是 template / script / style 顺序，
// 所以模板取 <script 之前的全部内容，不用去数嵌套的 <template v-if>。
const splitSfc = (src) => {
  const m = /<script[^>]*>([\s\S]*?)<\/script>/.exec(src)
  if (!m) return { template: src, script: '' }
  return { template: src.slice(0, m.index), script: stripComments(m[1]) }
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length

// 从 open 位置的左括号扫到配对的右括号，返回括号内的文本。
const balanced = (code, open) => {
  let depth = 0
  let i = open
  while (i < code.length) {
    const c = code[i]
    if (c === '\'' || c === '"' || c === '`') { i = skipString(code, i); continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      depth--
      if (depth === 0) return code.slice(open + 1, i)
    }
    i++
  }
  return code.slice(open + 1)
}

// 取出一段代码里的所有字符串字面量内容。
const stringLiterals = (code) => {
  const out = []
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '\'' || c === '"' || c === '`') {
      const end = skipString(code, i)
      out.push(code.slice(i + 1, end - 1))
      i = end
      continue
    }
    i++
  }
  return out
}

// 取出被调用的标识符及其位置。排除 a.b() 这种成员调用（点号后面的名字不是本文件的局部函数），
// 也排除 if/for 这类关键字。
// 位置是必须的：同一段代码里"写请求之前调用的函数"和"写请求返回之后调用的函数"，
// 前者里的成功提示是凭空宣布，后者是如实转述，只看名字分不开这两种。
// open 是左括号下标，判定"这次调用的返回值"要从它的配对右括号往后接着看。
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'await', 'new'])
const callSites = (code) => {
  const out = []
  const re = /([A-Za-z_$][\w$]*)\s*\(/g
  let m
  while ((m = re.exec(code))) {
    const before = code[m.index - 1]
    if (before === '.') continue
    if (KEYWORDS.has(m[1])) continue
    // `function foo(...)` 里的 foo 是声明不是调用。把它算成调用点，"从没被调用过的
    // function 声明"就会显得被调用过一次，它体内的写请求于是跑去给外面的提示背书。
    if (/\bfunction\s+$/.test(code.slice(Math.max(0, m.index - 10), m.index))) continue
    out.push({ name: m[1], index: m.index, open: m.index + m[0].length - 1 })
  }
  return out
}

// 找 const/let/var/function 定义并取出其右侧整体（箭头函数体、对象字面量、数组字面量都适用）。
// 扫描规则：括号深度回到 0 且遇到换行，且已读到的文本不以运算符结尾，就认为这条声明结束。
//
// 上限存在的理由：括号一旦不配对（写坏的代码、本扫描器没覆盖到的语法），深度永远回不到 0，
// 整个文件就会被当成这一个函数体，里面随便哪个 api 调用都会让检查失效地变绿。
// 加上限后同样的情况会变成"读少了"——最多误报，不会漏报。本仓库最长的处理函数不到 2000 字符。
const MAX_BODY = 4000
const TRAILING_OPERATOR = /(=>|[=+\-*/%<>!&|?:,({[])\s*$/
const findDefinition = (script, name) => {
  // function 那一支停在左括号**之前**：从括号内部开始读会让深度从 -1 起步，
  // 函数体里的第一个换行就满足"深度回到 0"，声明会被截成半句。
  const re = new RegExp('(?:^|[\\n;{}])\\s*(?:export\\s+)?(?:const|let|var)\\s+' + name + '\\s*=|(?:^|[\\n;{}])\\s*function\\s+' + name + '\\s*(?=\\()', 'm')
  const m = re.exec(script)
  if (!m) return null
  let i = m.index + m[0].length
  let depth = 0
  let body = ''
  while (i < script.length) {
    const c = script[i]
    if (c === '\'' || c === '"' || c === '`') {
      const end = skipString(script, i)
      body += script.slice(i, end)
      i = end
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    if (c === '\n' && depth <= 0 && body.trim() && !TRAILING_OPERATOR.test(body)) break
    if (body.length > MAX_BODY) break
    body += c
    i++
  }
  return body
}

// findDefinition 给回来的是"等号右边的整体"，函数的话带着 `async (x) => {` 这层头部。
// 判执行路径要的是函数体**内部**：头部留着的话，函数自己的那对大括号会被当成一层嵌套作用域，
// 而嵌套作用域收不到调用方传进来的"你是被一个已成功的写请求叫进来的"标记，
// `await apiSave(); showDone()` 这种正确写法就会被报成假成功。
const FN_BRACED = [
  /^\s*(?:async\s+)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/,
  /^\s*(?:async\s+)?\([^()]*\)\s*\{/
]
const FN_CONCISE = /^\s*(?:async\s+)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>\s*/
const stripFnHeader = (def) => {
  if (def == null) return null
  for (const re of FN_BRACED) {
    const m = re.exec(def)
    if (m) return { code: balanced(def, m[0].length - 1), concise: false }
  }
  const m = FN_CONCISE.exec(def)
  if (m) return { code: def.slice(m[0].length), concise: true }
  return { code: def, concise: false }
}
const functionBody = (script, name) => stripFnHeader(findDefinition(script, name))

// v-for 的别名 -> 数据源，用来解开 @click="q.to()" 这类通过循环项调用的处理函数。
const forAliases = (template) => {
  const map = {}
  const re = /v-for\s*=\s*"\s*\(?\s*([A-Za-z_$][\w$]*)[^"]*?\bin\s+([A-Za-z_$][\w$]*)/g
  let m
  while ((m = re.exec(template))) map[m[1]] = m[2]
  return map
}

// 在一个数组/对象字面量里取出 `prop: (…) => …` 形式的函数体，每个函数单独一段。
// 不拼成一整串，是因为下面按"文本先后"判断提示是否在请求之后：拼起来以后
// [{ fn: () => apiSave() }, { fn: () => toast('已保存') }] 的第二项会被第一项的请求撑住。
const propArrows = (literal, prop) => {
  const out = []
  const re = new RegExp('\\b' + prop + '\\s*:', 'g')
  let m
  while ((m = re.exec(literal))) out.push(literal.slice(m.index + m[0].length, m.index + m[0].length + 400))
  return out
}

// ---------------- 请求语义：读 / 写 ----------------

// common/api.js 的每个导出最终都落到 request.js 的 get/post/put/del 上，METHOD 读得出来。
// 必须分读写，是因为"链路里有请求"这条判据挡不住最省事的假成功写法：
//   const submit = async () => { await apiJobDetail(jobId); toast('已提交') }
// 请求是真的，提交是假的。GET 接口拿不回任何"改变了什么"的结果，撑不起完成语气的断言。
const apiCatalog = () => {
  const src = readFileSync(join(ROOT, 'common', 'api.js'), 'utf8')
  const marks = [...src.matchAll(/^export\s+const\s+([A-Za-z_$][\w$]*)\s*=/gm)]
  const names = []
  const writes = new Set()
  marks.forEach((mark, i) => {
    const body = src.slice(mark.index + mark[0].length, i + 1 < marks.length ? marks[i + 1].index : src.length)
    names.push(mark[1])
    if (/\b(?:post|put|del)\s*\(/.test(body) || /\bmethod\s*:\s*['"](?:POST|PUT|DELETE)['"]/i.test(body)) writes.add(mark[1])
  })
  return { names, writes }
}
const { names: API_NAMES, writes: API_WRITES } = apiCatalog()

// common/ 下的业务助手自己会发写请求（loginWithWeixin -> apiWxLogin、
// markAllMessagesRead -> apiMarkAllRead）。页面 await 完它们再说"已全部已读"是成立的，
// 不认这一层就会把正确的写法报成假成功。api.js 与 request.js 是被包装的那一层，不算助手。
const helperWriteNames = () => {
  const out = new Set()
  const isWrite = (body) => [...API_WRITES].some(api => new RegExp('\\b' + api + '\\s*\\(').test(body))
  for (const file of readdirSync(join(ROOT, 'common'))) {
    if (!file.endsWith('.js') || file === 'api.js' || file === 'request.js') continue
    const src = stripComments(readFileSync(join(ROOT, 'common', file), 'utf8'))
    const marks = [...src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)]
    marks.forEach((mark, i) => {
      const body = src.slice(mark.index, i + 1 < marks.length ? marks[i + 1].index : src.length)
      if (isWrite(body)) out.add(mark[1])
    })
  }
  return out
}

const WRITE_CALLS = new Set([...API_WRITES, ...helperWriteNames()])

// 从 open 处的左括号跳到它的配对右括号之后。
const afterCall = (code, open) => open + 1 + balanced(code, open).length + 1

// `await Promise.all([...])` / `Promise.race([...])` 会把里面任何一个 promise 的失败原样抛出来，
// 所以写请求包在里面和直接 await 它是同一回事。不认这一层，pages/staff/index.vue 那种
// 一次并发发两个请求再报结果的正确写法就会被报成假成功。
// allSettled / any 刻意不在内：它们把失败压平成结果，后端拒绝时后面的完成语气照样弹。
const awaitWrappers = (code) => {
  const out = []
  const re = /\bawait\s+Promise\s*\.\s*(?:all|race)\s*\(/g
  let m
  while ((m = re.exec(code))) {
    const open = m.index + m[0].length - 1
    out.push({ start: open, end: afterCall(code, open) })
  }
  return out
}

// ---------------- 执行路径：按函数体切作用域 ----------------

// 成对括号索引。一次前向扫描同时记下 ( 与 { 的配对位置，字符串整段跳过。
const bracketPairs = (code) => {
  const paren = new Map()
  const brace = new Map()
  const ps = []
  const bs = []
  const strings = []
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '\'' || c === '"' || c === '`') {
      const end = skipString(code, i)
      strings.push([i, end])
      i = end
      continue
    }
    if (c === '(') ps.push(i)
    else if (c === ')') { const o = ps.pop(); if (o !== undefined) paren.set(o, i) }
    else if (c === '{') bs.push(i)
    else if (c === '}') { const o = bs.pop(); if (o !== undefined) brace.set(o, i) }
    i++
  }
  return { paren, brace, strings }
}

// `) {` 这个形状在控制结构上也成立，这几个词后面的大括号是普通块不是函数体。
const CONTROL_HEADS = new Set(['if', 'for', 'while', 'switch', 'catch', 'with'])

// 简写箭头 `() => expr` 没有大括号兜底，往后扫到这个表达式自然结束的位置。
const conciseEnd = (code, from) => {
  let depth = 0
  let seen = ''
  let i = from
  while (i < code.length) {
    const c = code[i]
    if (c === '\'' || c === '"' || c === '`') {
      const end = skipString(code, i)
      seen += code.slice(i, end)
      i = end
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) break            // 闭合的是外面那层，说明箭头体到此为止
      depth--
    } else if ((c === ',' || c === ';') && depth === 0) break
    else if (c === '\n' && depth === 0 && seen.trim() && !TRAILING_OPERATOR.test(seen)) break
    seen += c
    i++
  }
  return i
}

// 切出这段代码里每个**函数体**的区间 [start, end)。
//
// 这是本轮的核心修正。上一版把整段代码当成一条直线，只记"最早一处 await 写接口结束在哪个下标"，
// 于是嵌套回调里的写请求会给它外面的 toast 背书：
//   uni.showModal({ success: async r => { await apiWithdraw(1) } }); toast('已撤回')
// 弹窗还没确认就说撤回了，扁平下标看不出来。按函数体切开之后，写请求只能为
// 同一作用域（或更里层）的代码背书，跨不到外面来。
const functionScopes = (code) => {
  const { paren, brace, strings } = bracketPairs(code)
  const closeParen = new Map()
  for (const [o, c] of paren) closeParen.set(c, o)
  const inString = (i) => strings.some(([a, b]) => i >= a && i < b)
  const scopes = []
  const add = (start, end, headEnd) => {
    const head = code.slice(0, headEnd).replace(/\s+$/, '')
    // 只有 `const 名字 = ... => ...` / `function 名字(...)` 这种绑定到局部名字的函数
    // 才谈得上"被不被调用"。内联回调（success: r => …）永远算可达。
    const named = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)?\s*=>$/.exec(head)
      || /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^()]*\)$/.exec(head)
    const name = named ? named[1] : null
    const refs = name ? (code.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length : 0
    scopes.push({ start, end, name, dead: !!name && refs <= 1 })
  }
  for (const [open, close] of brace) {
    const head = code.slice(0, open).replace(/\s+$/, '')
    let isFn = head.endsWith('=>')
    if (!isFn && head.endsWith(')')) {
      const p = closeParen.get(head.length - 1)
      if (p !== undefined) {
        const word = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, p))
        isFn = !word || !CONTROL_HEADS.has(word[1])   // 对象方法简写 success(r) { … } 也是函数体
      }
    }
    if (isFn) add(open + 1, close, open)
  }
  const arrow = /=>/g
  let m
  while ((m = arrow.exec(code))) {
    if (inString(m.index)) continue
    const rest = /^\s*/.exec(code.slice(m.index + 2))[0].length
    const bodyAt = m.index + 2 + rest
    if (code[bodyAt] === '{') continue                // 带大括号的上面已经收了
    add(bodyAt, conciseEnd(code, bodyAt), m.index + 2)
  }
  return scopes
}

const innermostScope = (scopes, i) => {
  let best = null
  for (const s of scopes) {
    if (i < s.start || i >= s.end) continue
    if (!best || s.start > best.start) best = s
  }
  return best
}
// null 代表"这段代码的最外层"，它是所有作用域的祖先。
const isAncestorScope = (a, b) => !a || (!!b && a.start <= b.start && b.end <= a.end)
const inDeadScope = (scopes, i) => scopes.some(s => s.dead && i >= s.start && i < s.end)

const inAnyRange = (ranges, i) => ranges.some(([from, to]) => i > from && i < to)

// 把参数列表按顶层逗号切开，返回每段相对 inner 的 [起, 止]。
const splitArgs = (inner) => {
  const out = []
  let depth = 0
  let start = 0
  let i = 0
  while (i < inner.length) {
    const c = inner[i]
    if (c === '\'' || c === '"' || c === '`') { i = skipString(inner, i); continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) { out.push([start, i]); start = i + 1 }
    i++
  }
  out.push([start, inner.length])
  return out
}

// 失败处理是"如实告诉用户"还是"当无事发生"。
// 重新抛出、把错误原样弹给用户、或者直接中断流程，都是正当处理；
// 空 catch、只记个日志变量、只 return 一个默认值，就是把失败吞了。
const HANDLER_SURFACES = /\bthrow\b|\breject\s*\(|\btoast\s*\(|\.\s*show(?:Toast|Modal)\s*\(|\bconsole\s*\.\s*(?:error|warn)\s*\(/
const swallows = (handler) => !HANDLER_SURFACES.test(handler)

// 顺着 apiX(...) 后面的 .then/.catch/.finally 链走一遍，回答三件事：
//  - end：整条链的值最终在哪里定下来（await 要等到的是这里，不是第一个调用的右括号）；
//  - swallowed：链上有没有把失败吃掉的处理器。吃掉了的话 await 一定 resolve，
//    后面那句"已提交"在后端拒绝时照样弹出来 —— 和压根没发请求对用户是同一种谎；
//  - then/never：成功回调区间（里面的提示成立）与失败回调区间（里面的完成语气一律判负）。
const chainOutcome = (code, from) => {
  let end = from
  let swallowed = false
  const then = []
  const never = []
  let chain
  while ((chain = /^\s*\.\s*(then|catch|finally)\s*\(/.exec(code.slice(end)))) {
    const open = end + chain[0].length - 1
    const inner = balanced(code, open)
    const args = splitArgs(inner)
    if (chain[1] === 'then') {
      then.push([open, open + 1 + args[0][1]])
      if (args.length > 1 && args[1] && inner.slice(args[1][0], args[1][1]).trim()) {
        // .then(onOk, onError) 的第二个参数就是 catch，链路照样 resolve
        never.push([open + 1 + args[1][0] - 1, open + 1 + args[1][1]])
        if (swallows(inner.slice(args[1][0], args[1][1]))) swallowed = true
      }
    } else if (chain[1] === 'catch') {
      never.push([open, open + 1 + inner.length])
      if (swallows(inner)) swallowed = true
    }
    end = open + 1 + inner.length + 1
  }
  return { end, swallowed, then, never }
}

// 一次调用的结局，连同它可能所处的 `await Promise.all/race(...)` 包装一起算。
// 包装存在时值要等整个包装表达式才定下来，而且包装后面还能再挂一层 .catch，
// 两层的失败处理都得看：`await Promise.all([apiX()]).catch(() => {})` 一样是把失败吞了。
const callSettlement = (code, site, wrappers) => {
  const inner = chainOutcome(code, afterCall(code, site.open))
  const wrap = wrappers.find(w => site.index > w.start && site.index < w.end)
  if (!wrap) return { wrapped: false, end: inner.end, swallowed: inner.swallowed, then: inner.then, never: inner.never }
  const outer = chainOutcome(code, wrap.end)
  return {
    wrapped: true,
    end: outer.end,
    swallowed: inner.swallowed || outer.swallowed,
    then: [...inner.then, ...outer.then],
    never: [...inner.never, ...outer.never]
  }
}

// try 块区间 + 它的 catch 是否中断流程。
// await 只为它所在的 try 块**内部**背书：抛异常时控制流跳到 catch，try 之后的语句照样执行，
// 所以 `try { await apiSubmit() } catch (e) {}` 后面那句"已提交"失败时一样会弹。
// 例外是 catch 里 return / throw —— 那样 try 之后的代码只有成功才走得到。
const tryBlocks = (code) => {
  const out = []
  const re = /\btry\s*\{/g
  let m
  while ((m = re.exec(code))) {
    const open = m.index + m[0].length - 1
    const inner = balanced(code, open)
    const end = open + 1 + inner.length
    const ch = /^\s*catch\s*(?:\([^()]*\))?\s*\{/.exec(code.slice(end + 1))
    let terminates = false
    if (ch) {
      const hOpen = end + 1 + ch[0].length - 1
      terminates = /\breturn\b|\bthrow\b/.test(balanced(code, hOpen))
    }
    out.push({ start: open, end, terminates })
  }
  return out
}

// 失败分支：catch 块与 finally 块。finally 无论成败都会执行，里面说"已提交"同样是假成功。
const failureBlocks = (code) => {
  const out = []
  const re = /\b(?:catch\s*(?:\([^()]*\))?|finally)\s*\{/g
  let m
  while ((m = re.exec(code))) {
    const open = m.index + m[0].length - 1
    out.push([open, open + 1 + balanced(code, open).length])
  }
  return out
}

// 一个 await 能管到哪里：本作用域末尾为止，中途被不中断流程的 try 块截断。
const settleBound = (from, scopeEnd, trys) => {
  const enclosing = trys.filter(t => from > t.start && from < t.end).sort((a, b) => b.start - a.start)
  for (const t of enclosing) if (!t.terminates) return Math.min(t.end, scopeEnd)
  return scopeEnd
}

// ---------------- "写请求成功返回了"的判定 ----------------

// 一个局部函数 await 完能不能代表"写请求成功返回了"。
// fpDeepLegit -> fpA -> fpB -> fpC -> apiSubmitApplication 这种拆法是完全正确的写法：
// fpA 里 `await fpB()` 之后说"已提交"属实。上一版只认字面上的 `await 写接口(...)`，
// 把这类正确代码报成"整条链路没有写请求"，读报告的人第一反应就是去删断言。
const MAX_DEPTH = 8
const settleAnalyzer = (script) => {
  const cache = new Map()
  const compute = (name, stack) => {
    if (WRITE_CALLS.has(name)) return { settles: true, truncated: false, partial: false }
    if (stack.includes(name)) return { settles: false, truncated: false, partial: true }   // 递归调用
    if (cache.has(name)) return cache.get(name)
    if (stack.length >= MAX_DEPTH) return { settles: false, truncated: true, partial: true }
    const fn = functionBody(script, name)
    if (!fn) return { settles: false, truncated: false, partial: false }
    const scopes = functionScopes(fn.code)
    const wrappers = awaitWrappers(fn.code)
    const next = [...stack, name]
    let settles = false
    let truncated = false
    let partial = false
    for (const site of callSites(fn.code)) {
      // 嵌套回调里的 await 不算：await 这个函数返回，等不到它内部回调里的那个请求。
      if (innermostScope(scopes, site.index)) continue
      const head = fn.code.slice(Math.max(0, site.index - 12), site.index)
      const before = fn.code.slice(0, site.index)
      const returned = /\breturn\s+$/.test(head) || (fn.concise && !before.trim())
      const settlement = callSettlement(fn.code, site, wrappers)
      if (!/\bawait\s+$/.test(head) && !returned && !settlement.wrapped) continue
      const r = compute(site.name, next)
      truncated = truncated || r.truncated
      partial = partial || r.partial
      if (r.settles && !settlement.swallowed) settles = true
    }
    const res = { settles, truncated, partial }
    if (!partial && !truncated) cache.set(name, res)
    return res
  }
  return (name) => compute(name, [])
}

// 一段代码里每次写请求的结局**与它的位置**，按执行路径而不是按扁平下标。
// 三条位置清单形状相同（能管到的区间 + 所处作用域），只是结论不同：
//  - scoped：成功返回了，同作用域或更里层的提示成立；
//  - swallowed：失败被吞掉了，await 照样 resolve，后面的完成语气在后端拒绝时也会弹；
//  - unknown：链路深到展不开，有没有写请求兜底说不清。
// 三者都按位置记而不是压成整段的布尔值：同一次点击里完全可以既有一句铁定的假成功、
// 又有一条深到展不开的调用链，压成布尔值就只能给出一个结论，必然冤枉其中一个。
// 另外两条：
//  - then：写接口 .then(...) 的成功回调，以及 uni.request 非 GET 时的整个选项对象。
//  - never：catch / finally / .catch(...) 处理体，里面的完成语气一律判负。
// 只认 await 与 .then 而不认裸调用：`apiSave(); toast('已保存')` 发了请求但不看结果，
// 后端拒了照样说保存成功，这和不发请求对用户是同一种谎。
const pathFacts = (code, scopes, settlesOf) => {
  const scoped = []
  const swallowed = []
  const unknown = []
  const then = []
  const never = failureBlocks(code)
  const trys = tryBlocks(code)
  const wrappers = awaitWrappers(code)
  let hasWrite = false
  let deepCut = false
  // 一次调用从 from 起能管到哪里：本作用域末尾为止，中途被不中断流程的 try 截断。
  const span = (from, at) => {
    const scope = innermostScope(scopes, at)
    return { from, to: settleBound(from, scope ? scope.end : code.length, trys), scope }
  }
  for (const site of callSites(code)) {
    if (inDeadScope(scopes, site.index)) continue    // 从没被调用过的嵌套函数，里面写什么都不算数
    const head = code.slice(Math.max(0, site.index - 12), site.index)
    const wrapped = wrappers.some(w => site.index > w.start && site.index < w.end)
    const awaited = /\bawait\s+$/.test(head) || wrapped
    if (!WRITE_CALLS.has(site.name)) {
      if (!awaited) continue
      const r = settlesOf(site.name)
      deepCut = deepCut || r.truncated
      // 触到展开上限的链路：位置照样记下来，后面的提示才能被说成"无法判定"
      // 而不是"没有写请求"—— 后一种说法会把人骗去删断言。
      if (!r.settles) {
        if (r.truncated) unknown.push(span(callSettlement(code, site, wrappers).end, site.index))
        continue
      }
    }
    hasWrite = true
    const settlement = callSettlement(code, site, wrappers)
    then.push(...settlement.then)
    never.push(...settlement.never)
    if (!awaited) continue
    if (settlement.swallowed) { swallowed.push(span(settlement.end, site.index)); continue }
    scoped.push(span(settlement.end, site.index))
  }
  const ur = /\buni\.request\s*\(/g
  let m
  while ((m = ur.exec(code))) {
    const open = m.index + m[0].length - 1
    if (inDeadScope(scopes, m.index)) continue
    const inner = balanced(code, open)
    if (!/\bmethod\s*:\s*['"](?:POST|PUT|DELETE)['"]/i.test(inner)) continue
    hasWrite = true
    then.push([open, open + 1 + inner.length])
  }
  return { scoped, swallowed, unknown, then, never, hasWrite, deepCut }
}

// 把一个 @click 表达式展开成"这次点击真正会执行到的代码"，但不是拼成一整串，
// 而是拆成若干段：表达式本身 + 它调用到的局部函数体（递归到 MAX_DEPTH 层）。
// 每段带一个 settledAt(下标) 判定，回答"这个位置上的代码，是不是在某个写请求成功返回之后才执行的"。
//
// settledOnEntry 是为了支持把请求和提示拆到两个函数里的写法：
//   const save = async () => { await apiSave(); showDone() }
//   const showDone = () => toast('已保存')
// showDone 段内看不到任何请求，但它是被一个已经成功的写请求叫进来的。
const collectSegments = (expr, script, aliases) => {
  const out = []
  const seen = new Set()
  const settlesOf = settleAnalyzer(script)
  const walk = (code, depth, settledOnEntry) => {
    const scopes = functionScopes(code)
    const facts = pathFacts(code, scopes, settlesOf)
    // 一条位置清单管不管得到下标 i：i 在区间内，且那次调用所处的作用域是 i 的祖先。
    const reaches = (list, i) => {
      const here = innermostScope(scopes, i)
      return list.some(s => i > s.from && i < s.to && isAncestorScope(s.scope, here))
    }
    const settledAt = (i) => {
      if (inAnyRange(facts.never, i)) return false
      if (settledOnEntry) return true
      if (inAnyRange(facts.then, i)) return true
      return reaches(facts.scoped, i)
    }
    const seg = {
      code,
      settledAt,
      live: (i) => !inDeadScope(scopes, i),
      unknownAt: (i) => reaches(facts.unknown, i),
      swallowedAt: (i) => reaches(facts.swallowed, i),
      hasWrite: facts.hasWrite,
      deepCut: facts.deepCut
    }
    out.push(seg)
    // 同名函数在本段里被调用多次时，只要有一处在写请求之后，就按"之后"算：
    // 宁可少报一条，也不要把 `await apiSave(); showDone()` 这种正确写法报成假成功。
    const sites = new Map()
    for (const site of callSites(code)) {
      if (!seg.live(site.index)) continue
      sites.set(site.name, sites.get(site.name) || settledAt(site.index))
    }
    for (const [name, settledHere] of sites) {
      if (seen.has(name)) continue
      const fn = functionBody(script, name)
      if (!fn) continue
      if (depth >= MAX_DEPTH) {
        // 这里停下来意味着更深处的 toast 看不见了（漏报），也意味着这次点击的展开
        // 是不完整的。它不改变已经发现的那些提示的判定，但会让"整条链路没有写请求"
        // 这句断言站不住 —— 所以只记一个链路级别的保留，措辞上不再把话说死。
        seg.deepCut = true
        continue
      }
      seen.add(name)
      walk(fn.code, depth + 1, settledHere)
    }
  }

  let entry = expr
  // @click="submit" 没有括号，callSites 看不见它；补一个调用形态让它照常展开
  const bare = /^[A-Za-z_$][\w$]*$/.exec(expr.trim())
  if (bare) entry += '\n' + bare[0] + '()'
  walk(entry, 0, false)
  // q.to() / item.fn()：顺着 v-for 别名找到数据源数组，把同名属性上的箭头函数都算进来
  const member = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/.exec(expr.trim())
  if (member && aliases[member[1]]) {
    const source = findDefinition(script, aliases[member[1]])
    for (const arrow of source ? propArrows(source, member[2]) : []) walk(arrow, 1, false)
  }
  return out
}

// 这段代码里的 toast 文案及其位置。uni.showToast 一起算，两种写法都是对用户说话。
const toastClaims = (code) => {
  const out = []
  const re = /(?:\btoast|\.showToast)\s*\(/g
  let m
  while ((m = re.exec(code))) {
    const open = m.index + m[0].length - 1
    for (const text of stringLiterals(balanced(code, open))) out.push({ index: m.index, text })
  }
  return out
}

// 给一句被判负的提示配一条**对得上实际掌握的信息量**的理由。
// "没有写请求"是一句断言，"展开层数不够"是一句自白，两者不能互相冒充：
// 把自白说成断言，下一个人会照着去改页面或删断言；把断言说成自白，真 bug 会被当成工具局限放过。
const whyFor = (seg, i, anyWrite, deepCut) => {
  if (seg.unknownAt(i)) return `提示之前有一条超过 ${MAX_DEPTH} 层展不开的调用链，无法判定有没有写请求兜底（按未通过处理）`
  if (seg.swallowedAt(i)) return '提示之前的写请求把失败吞掉了，后端拒绝时照样弹'
  if (anyWrite) return '提示不在写请求成功返回之后'
  if (deepCut) return `提示之前没有写请求；链路超过 ${MAX_DEPTH} 层没展开完，更深处有没有写请求判定不了`
  return '整条链路没有写请求'
}

// 只改本机状态、本来就不需要写请求的点击，逐条登记理由（2026-09-24 逐条读过处理函数）。
// 键 = "页面#@click 表达式"。登记的前提：文案如实说明了"只在本机"，或清空 / 重置 / 生成的对象本来就只是本页输入框；
// 存本机的那几条还要求 setStorageSync 失败时如实提示失败（staff/rooms 的 Vlog 草稿原来吞掉失败照样说"已保存"，已改）。
// 登记项在代码里消失时下面有一条断言会报出来，免得清单变成永远不收缩的豁免池。
const LOCAL_ONLY = {
  'pages/profile/merchant.vue#saveDraft(true)': '入驻表单的本机草稿，存储失败时显示错误。',
  'pages/community/publish.vue#saveDraft': '草稿存本机（setStorageSync），文案写明「仅本机」，失败时提示「草稿保存失败」',
  'pages/wish/publish.vue#saveDraft': '心愿草稿存本机，写入完成后提示「草稿已保存到本机」，失败时明确提示保存失败；下方运行时测试覆盖成功和失败',
  'pages/staff/activities.vue#saveDraft': '同上：活动草稿存本机，文案写明「仅本机」',
  'pages/staff/rooms.vue#saveVlogDraft': '同上：Vlog 草稿存本机，文案写明「仅本机」',
  'pages/profile/review.vue#saveOffline': '把到店路线存到本机供离线查看，文案写明「已保存到本机」',
  'pages/home/index.vue#clearPrefs': '清空的是 AI 助手本页的输入框（想法、日期、人数），没有要保存到服务端的东西',
  'pages/jobs/filter.vue#reset': '重置的是本页筛选条件（随后「查看结果」才发请求），筛选项此时都可点、有物可重置',
  'pages/staff/online-jobs.vue#generate': '按模板在本页生成任务描述文字，提交时才随表单发给服务端，文案提示可再修改',
  'pages/staff/interviews.vue#storeLater': '「稍后处理」：报名保持原状态、回到列表，本来就不改任何数据；「已保留」说的就是"没动它"',
  'pages/staff/online-jobs.vue#goInspect': '没有新成果时的状态告知：「已退回修改」描述的是服务端上一次验收的结果（latest.status === returned），不是本次点击做了什么',
  'pages/stays/list.vue#clearRecent': '清空的是本机的近期搜索词（removeStorageSync + 本页列表），本来就不在服务端',
  'pages/stays/shop.vue#addToCart(item)': '切换的是本页「待结算」里选中的服务（一次只能结一项），下单时才发请求；文案说明了切换原因',
  // 2026-10-15 网页版没有地图 key：有坐标时点地址改成复制到本机剪贴板（小程序照旧打开地图），不改任何数据
  'pages/jobs/contract.vue#openMap': '网页版把门店地址复制到本机剪贴板，「地址已复制」在 setClipboardData 成功回调里才弹，失败时改为提示地址；本来就不需要写请求',
  'pages/jobs/detail.vue#tapRow(item)': '同上：网页版点「工作地点」把地址复制到本机剪贴板，成功回调里才提示「地址已复制」',
  // 2026-10-18 线下岗位改版成「门店页」：「位置与交通」右边的小地图，和上面「工作地点」整行是同一个 openMap
  'pages/jobs/detail.vue#openMap': '同上：网页版点小地图把地址复制到本机剪贴板，成功回调里才提示「地址已复制」；小程序打开地图',
  // 2026-11-03 招募表单的预设模板：点模板只是把本页表单填好（提交时才随表单发给服务端），撤销只是把本页表单改回去
  'pages/staff/jobs.vue#useTemplate(tpl)': '按预设模板（job-templates.js）在本页填表，提交时才随表单发给服务端；「已填好，改一改就能提交」说的就是本页表单',
  'pages/staff/jobs.vue#undoTemplate': '把本页表单改回点模板之前的样子，本来就不在服务端；「已撤销」说的是本页表单'
}

// 一个页面里所有"宣称操作已完成、却没有一个写请求为它兜底"的点击处理。
const fakeSuccessClicks = (relPath) => {
  const src = readFileSync(join(ROOT, relPath), 'utf8')
  const { template, script } = splitSfc(src)
  const aliases = forAliases(template)
  const out = []
  const re = /@(?:click|tap)(?:\.[\w.]+)?\s*=\s*"([^"]*)"/g
  let m
  while ((m = re.exec(template))) {
    const expr = m[1]
    if (LOCAL_ONLY[relPath + '#' + expr.trim()]) continue
    const segments = collectSegments(expr, script, aliases)
    const anyWrite = segments.some(seg => seg.hasWrite)
    const deepCut = segments.some(seg => seg.deepCut)
    for (const seg of segments) {
      for (const claim of toastClaims(seg.code)) {
        if (!claimsSuccess(claim.text)) continue
        if (!seg.live(claim.index)) continue    // 不可达的代码骗不到用户
        if (seg.settledAt(claim.index)) continue
        out.push({
          file: relPath,
          line: lineOf(src, m.index),
          expr: expr.trim(),
          text: claim.text,
          why: whyFor(seg, claim.index, anyWrite, deepCut)
        })
      }
    }
  }
  return out
}

// ---------------- 1. 假成功文案 ----------------

test('已接线页面不会只弹一句成功提示就了事', () => {
  const offenders = WIRED_PAGES.flatMap(fakeSuccessClicks)
  const report = offenders.map(o => `  ${o.file}:${o.line}  @click="${o.expr}"  toast: ${o.text}  （${o.why}）`).join('\n')
  assert.equal(offenders.length, 0, `以下点击告诉用户操作已完成，但没有写请求的成功返回为它兜底：\n${report}`)
})

// 未接线原型页里"点了只弹一句成功提示"的条数上限。
// 这是欠账，不是回归基线 —— 它只应该随着接线推进往下走。
//
// 这个数字被上调过两次，两次都是因为**判据变严**而不是产品变差：
//   27 条 / 16 页  ->  41 条 / 22 页   补进「已重置」等 24 个过去式说法之后
//   41 条 / 22 页  ->  55 条 / 26 页   再补 24 个说法 + 「已+短句」形态判据之后
// 后一次多出来的 4 个整页（staff/vlog、home/city、community/activity 等）
// 此前一条都没被统计过。报告里引用这个数字时必须说明它量的是"当前判据下的欠账"，
// 不同判据下的数字不能互相比较。
const FAKE_SUCCESS_BASELINE = 55

test('未接线页面的假成功文案作为欠账清单打印出来', () => {
  const others = listVueFiles(PAGES_DIR).filter(p => !WIRED_PAGES.includes(p))
  const rows = others.map(p => [p, fakeSuccessClicks(p).length]).filter(r => r[1] > 0)
  const total = rows.reduce((sum, r) => sum + r[1], 0)
  console.log(`\n[欠账] 未接线页面仍有 ${total} 条"只弹成功提示"的点击，分布在 ${rows.length} 个页面：`)
  for (const [page, count] of rows.sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${page}`)
  console.log('  这些页面按 INTEGRATION.md 第二节未纳入接线范围，接线时应逐条清掉。\n')
  // 这里前后写坏过两次：第一次是 assert.ok(total >= 0)（计数恒 >= 0），
  // 第二次改成 assert.equal(total, rows.reduce(同一个表达式))——右边是左边的字面复制，
  // 对同一个没被改过的 rows 再 reduce 一次必然相等。两次都是"看起来是断言、永远不会红"。
  //
  // 换成棘轮，和本文件里 DEAD_EXPORT_BASELINE 的做法一致：欠账只许减不许增。
  // 接线范围扩大时这个数会降，把基线跟着调小即可；
  // 而"新写的页面又加了一个假成功按钮"会立刻被拦下来。
  assert.ok(total <= FAKE_SUCCESS_BASELINE,
    `未接线页面的假成功从基线 ${FAKE_SUCCESS_BASELINE} 条涨到了 ${total} 条。`
    + '新增的原型页不能再留"点了只弹一句成功提示"的按钮；'
    + `确实是接线范围变化导致的，就把 FAKE_SUCCESS_BASELINE 改成 ${total} 并在报告里说明。`)
})

test('只改本机状态的登记项都还指向真实存在的点击处理', () => {
  const stale = Object.keys(LOCAL_ONLY).filter(k => {
    const [file, expr] = k.split('#')
    const path = join(ROOT, file)
    if (!existsSync(path)) return true
    const escaped = expr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return !new RegExp('@(?:click|tap)(?:\\.[\\w.]+)?\\s*=\\s*"' + escaped + '"').test(readFileSync(path, 'utf8'))
  })
  assert.deepEqual(stale, [], `LOCAL_ONLY 里这些登记项在页面上已经找不到了，请删掉：\n  ${stale.join('\n  ')}`)
})

test('心愿草稿只在本机写入完成后提示保存，未登录和存储失败都如实提示', t => {
  const { script } = splitSfc(readFileSync(join(ROOT, 'pages/wish/publish.vue'), 'utf8'))
  const saveDraft = new Function('saveLocalDraft', 'experience', 'form', 'toast', 'activeDraftId', functionBody(script, 'saveDraft').code)
  const form = { title: '帮我寄一张明信片', images: ['/uploads/wish.jpg'] }
  const events = []
  const experience = {account: {id: 7}}
  const previous = globalThis.uni
  t.after(() => { if (previous === undefined) delete globalThis.uni; else globalThis.uni = previous })
  globalThis.uni = {
    getStorageSync: () => [],
    setStorageSync(key, [row]) {
      assert.equal(key, 'kangaroo:drafts:v2:7')
      assert.equal(row.kind, 'wish')
      assert.deepEqual(row.data, {...form, agreed: false})
      assert.notEqual(row.data.images, form.images)
      events.push('stored')
    }
  }
  const save = () => saveDraft(saveLocalDraft, experience, form, message => events.push(message), '')
  save()
  assert.deepEqual(events, ['stored', '已保存，可在发布页的草稿箱继续编辑'])

  events.length = 0
  globalThis.uni.setStorageSync = () => { throw new Error('storage full') }
  save()
  assert.deepEqual(events, ['草稿保存失败，请检查本机存储空间后重试'])

  events.length = 0
  experience.account = null
  globalThis.uni.setStorageSync = () => assert.fail('未登录不能写入草稿')
  save()
  assert.deepEqual(events, ['请先登录后使用草稿箱'])
})

// ---------------- 2. api.js 死导出 ----------------

// 基线：2026-09-13 实测 30 个导出里有 11 个零调用点。
// 这 11 个对应"后端已实现、小程序页面还没接上去"的能力，不是错误，
// 但只能减不能增 —— 再加一个没人调用的导出，说明又写了一层没接到页面的壳。
// 实测是 9 个，基线原先写的是 11 —— 松了 2 个额度，等于允许再新增两个死导出而不报。
// 棘轮要贴着实际值才有约束力。
// 2026-09-24：V9–V13 新增的死导出改为按名字登记（见下方 KNOWN_UNWIRED），登记之外实测剩 6 个，棘轮贴着实际值收紧到 6。
// 2026-09-26：「我的收藏」接上岗位收藏后又少一个，收紧到 5。
const DEAD_EXPORT_BASELINE = 3  // 2026-09-26：岗位订阅的修改 / 删除接上页面，收紧到 3

test('api.js 不会多出没有任何调用点的导出', () => {
  const sources = []
  for (const rel of listVueFiles(PAGES_DIR)) sources.push(readFileSync(join(ROOT, rel), 'utf8'))
  // 组件里直接调接口的也算调用点（如 components/k-interview-slots 调的三个员工时段接口），
  // 只扫 pages/ 时它们被误报成死导出
  for (const rel of listVueFiles(join(ROOT, 'components'), 'components')) sources.push(readFileSync(join(ROOT, rel), 'utf8'))
  for (const name of readdirSync(join(ROOT, 'common'))) {
    if (name.endsWith('.js') && name !== 'api.js') sources.push(readFileSync(join(ROOT, 'common', name), 'utf8'))
  }
  const all = sources.join('\n')
  const dead = API_NAMES.filter(name => !new RegExp('\\b' + name + '\\b').test(all))
  if (dead.length) {
    console.log(`\n[死导出] common/api.js 里 ${dead.length} 个导出在 pages/ 与 common/ 下零调用（基线 ${DEAD_EXPORT_BASELINE}）：`)
    for (const name of dead) console.log(`  ${name}`)
    console.log('')
  }
  // V9–V13 扩展后死导出从 9 个涨到 20 个。2026-09-24 逐个核过：下面 14 个都对应后端已实现、页面没有入口的能力，
  // 其中用户可感知的缺口写进了验收报告（「取消待支付订单」已于同日接上页面，已从名单删去）。
  // 这里不把数字棘轮放宽成 20，而是按名字登记：再多一个没人调用的导出照样红；某个接上了页面就从这里删掉。
  // 2026-10-15：退回修改要带截图（V41），pages/staff/online-jobs.vue 改在页面里直接调退回接口（带 images），
  // 不去改主包的 common/api.js（主包只剩几 KB）。apiOnlineReturn 因此没人调用了，下次动 common/api.js 时删掉它、并从这里去掉。
  // 2026-11-03 简化房源「更多」：「设置地图位置」删掉了（编辑表单里的「地图选点」随表单一起保存坐标，走 apiStaffEditStay），
  // apiStaffStayLocation 因此没人调用了，下次动 common/api.js 时删掉它、并从这里去掉。
  const KNOWN_UNWIRED = new Set([
    'apiStayMyOrders', 'apiStayCurrentOrder',
    'apiStaffStayOrders', 'apiStaffShopOrders', 'apiPoints',
    'apiOnlineReturn', 'apiStaffStayLocation'
  ])
  const unexplained = dead.filter(name => !KNOWN_UNWIRED.has(name))
  assert.ok(
    unexplained.length <= DEAD_EXPORT_BASELINE,
    `零调用导出（除已登记的 V9–V13 缺口外）从基线 ${DEAD_EXPORT_BASELINE} 涨到了 ${unexplained.length}：${unexplained.join(', ')}`
  )
  const wired = [...KNOWN_UNWIRED].filter(name => !dead.includes(name))
  assert.deepEqual(wired, [], `这些导出已经有调用点了，请从 KNOWN_UNWIRED 里删掉：${wired.join(', ')}`)
})

// ---------------- 3. 状态机取值拼写 ----------------

// 后端状态/分类都是精确匹配的单值：拼错一个字母不会报错，只会返回空列表或永远不成立的分支，
// 界面上看起来"没有数据"，排查起来极贵。所以取值必须来自后端枚举源码。
const backendConstants = (file) => {
  const path = join(BACKEND_ENUM_DIR, file)
  if (!existsSync(path)) return null
  const src = readFileSync(path, 'utf8')
  return new Set([...src.matchAll(/public\s+static\s+final\s+String\s+\w+\s*=\s*"([^"]+)"/g)].map(m => m[1]))
}

// 常量表只取最外层的键与值。CATEGORY_LOOK = { apply: { tone: 'green' } } 里的 'green'
// 是配色不是分类取值，往里挖一层就会把视觉词汇当成机器取值误报。
const topLevelTokens = (literal) => {
  const out = []
  let depth = 0
  let i = 0
  while (i < literal.length) {
    const c = literal[i]
    if (c === '\'' || c === '"' || c === '`') {
      const end = skipString(literal, i)
      if (depth === 0) out.push(literal.slice(i + 1, end - 1))
      i = end
      continue
    }
    if (c === '(' || c === '[' || c === '{') { depth++; i++; continue }
    if (c === ')' || c === ']' || c === '}') { depth--; i++; continue }
    if (depth === 0) {
      const key = /^([A-Za-z_$][\w$]*)\s*:/.exec(literal.slice(i))
      if (key && !/[\w$.]/.test(literal[i - 1] || '')) { out.push(key[1]); i += key[0].length; continue }
    }
    i++
  }
  return out
}

// 取值出现的位置：status:'x' / .status === 'x' / 名字里带 STATUS、CATEGORY、JOB_TYPE 的常量表。
const enumLiteralsAt = (script, key) => {
  const out = []
  const direct = new RegExp('\\b' + key + '\\s*(?::|===?|!==?)\\s*(\'[^\']*\'|"[^"]*")', 'gi')
  let m
  const settled = new Set()
  for (const match of script.matchAll(/(?:const|let)\s*\[([^\]]+)\]\s*=\s*await Promise\.allSettled\(/g)) {
    for (const name of match[1].split(',')) if (/^\s*\w+\s*$/.test(name)) settled.add(name.trim())
  }
  const settledArrays = new Set([...script.matchAll(/(?:const|let)\s+(\w+)\s*=\s*await Promise\.allSettled\(/g)].map(x => x[1]))
  while ((m = direct.exec(script))) {
    const value = m[1].slice(1, -1)
    const owner = /([\w$]+)\.$/.exec(script.slice(0, m.index))?.[1]
    const indexedOwner = /([\w$]+)\[\d+\]\.$/.exec(script.slice(0, m.index))?.[1]
    if (key === 'status' && (settled.has(owner) || settledArrays.has(indexedOwner)) && ['fulfilled', 'rejected'].includes(value)) continue
    out.push(value)
  }
  const table = new RegExp('\\b[A-Z_]*' + key.toUpperCase() + '[A-Z_]*\\s*=\\s*[{[]', 'g')
  while ((m = table.exec(script))) out.push(...topLevelTokens(balanced(script, m.index + m[0].length - 1)))
  return out
}

test('状态枚举扫描区分 Promise 结果与业务状态，不能放过业务拼写错误', () => {
  assert.deepEqual(enumLiteralsAt("const [rows, cities] = await Promise.allSettled([]); rows.status === 'fulfilled'; cities.status === 'rejected'; job.status === 'aproved'", 'status'), ['aproved'])
  assert.deepEqual(enumLiteralsAt("const r = await Promise.allSettled([]); r[0].status === 'fulfilled'; job.status === 'bad'", 'status'), ['bad'])
  assert.deepEqual(enumLiteralsAt("job.status === 'fulfilled'; const payload = {status: 'rejected'}", 'status'), ['fulfilled', 'rejected'])
})

// 核心报名 / 岗位流程页面：status 只能是 ApplicationStatus / JobStatus 里的取值
const CORE_STATUS_PAGES = [
  'pages/jobs/list.vue', 'pages/jobs/detail.vue', 'pages/jobs/apply.vue', 'pages/jobs/progress.vue',
  'pages/jobs/interview.vue', 'pages/staff/applications.vue', 'pages/staff/index.vue', 'pages/messages/index.vue'
]
const MIGRATION_DIR = join(ROOT, '..', 'RuoYi-Vue', 'sql', 'kangaroo')
// 迁移脚本里每一个 *status* 列注释中出现的小写英文取值
const migrationStatusTokens = () => {
  const out = new Set()
  if (!existsSync(MIGRATION_DIR)) return out
  for (const name of readdirSync(MIGRATION_DIR)) {
    if (!/^V\d+__.*\.sql$/.test(name) || /rollback|duplicates/.test(name)) continue
    for (const line of readFileSync(join(MIGRATION_DIR, name), 'utf8').split(/\r?\n/)) {
      const m = /^\s*`?\w*status\w*`?\s+(?:varchar|char)\(\d+\).*comment\s+'([^']*)'/i.exec(line)
      if (m) for (const t of m[1].match(/\b[a-z][a-z0-9_]*\b/g) || []) out.add(t)
    }
  }
  // 不落库、由接口现算的状态（例如房态日历每天的 past / beyond / closed / full / available）：
  // 取后端扩展模块里 status = "x" / put("status", "x") 的字面量；支付流程 common/pay-flow.js 返回的 { status: 'x' } 同理。
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.java')) {
        const src = readFileSync(p, 'utf8')
        for (const m of src.matchAll(/\bstatus\s*=\s*"([a-z][a-z0-9_]*)"|put\("status",\s*"([a-z][a-z0-9_]*)"\)/g)) out.add(m[1] || m[2])
      }
    }
  }
  if (existsSync(EXT_JAVA_DIR)) walk(EXT_JAVA_DIR)
  const payFlow = join(ROOT, 'common', 'pay-flow.js')
  if (existsSync(payFlow)) for (const m of readFileSync(payFlow, 'utf8').matchAll(/status:\s*'([a-z][a-z0-9_]*)'/g)) out.add(m[1])
  return out
}
const EXT_JAVA_DIR = join(ROOT, '..', 'RuoYi-Vue', 'ruoyi-kangaroo', 'src', 'main', 'java', 'com', 'ruoyi', 'kangaroo', 'ext')

const wishCategories = () => {
  const source = readFileSync(join(EXT_JAVA_DIR, 'wish', 'WishService.java'), 'utf8')
  const declaration = /\bCATEGORIES\s*=\s*[^;]*Arrays\.asList\(([^)]*)\)/.exec(source)
  assert.ok(declaration, '必须从 WishService 的分类校验集合读取真实取值')
  const values = [...declaration[1].matchAll(/"([a-z][a-z0-9_]*)"/g)].map(match => match[1])
  assert.ok(values.length > 0, '后端心愿分类不能为空')
  return new Set(values)
}

test('心愿分类选项完整对应后端分类校验集合', () => {
  const source = readFileSync(join(ROOT, 'pages/wish/wish.js'), 'utf8')
  const declaration = /export const categories\s*=\s*\[([\s\S]*?)\]/.exec(source)
  assert.ok(declaration, '必须读取页面实际使用的心愿分类')
  const values = [...declaration[1].matchAll(/\bkey:\s*'([^']+)'/g)].map(match => match[1])
  assert.deepEqual(values.sort(), [...wishCategories()].sort())
})

test('认证位与保险位的极性没有被判反', () => {
  // kg_store.safe_cert、kg_job.insurance_flag 的口径都是"0 是 / 1 否"。
  // 判反的后果是未认证门店挂上绿色认证章、没保险的岗位写着"已投保"——
  // 页面说的和数据是反的，而用户据此做决定。
  //
  // 这个坑踩过三次：detail.vue 的 s=2 判反过（那里现在还留着说明注释），
  // 这一轮 interview.vue 又判反一次。所以用断言守住，不再靠人记得。
  // 判据不能要求"字段名和比较写在同一行"：真实写法往往是
  //   const cert = ...safeCert
  //   return String(cert) === '1'
  // 我用"把 interview.vue 改回判反"实测过——只看同一行的版本一次都没红。
  // 所以从字段名出现的那一行往下开一个 8 行的窗口，窗口里出现和 '1' 的相等比较就判负。
  const EQ_ONE = /[=!]==?\s*['"]1['"]/
  const WINDOW = 8
  const offenders = []
  for (const file of listVueFiles(PAGES_DIR)) {
    const src = readFileSync(join(ROOT, file), 'utf8')
    const lines = src.split(/\r?\n/)
    lines.forEach((line, i) => {
      if (!/safeCert|insuranceFlag/.test(line)) return
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) return
      for (let j = i; j < Math.min(lines.length, i + WINDOW); j++) {
        const probe = lines[j]
        if (probe.trim().startsWith('//') || probe.trim().startsWith('*')) continue
        // 明确的否定说明：1 分支写暂不含保险，不能当作正向保险认证。
        if (/insuranceFlag\) === '1' \? '本岗位暂不含平台统一保险' : '保险信息待确认'/.test(probe)) continue
        if (EQ_ONE.test(probe)) {
          offenders.push(`  ${file}:${j + 1}  ${probe.trim().slice(0, 120)}`
            + `（${i + 1} 行在取 ${/safeCert/.test(line) ? 'safeCert' : 'insuranceFlag'}）`)
          break
        }
      }
    })
  }
  assert.equal(offenders.length, 0,
    '这两个字段是"0 是 / 1 否"，和 \'1\' 比等于把结论判反了：\n' + offenders.join('\n'))
})

test('已接线页面用的后端状态与分类取值都在后端枚举里', () => {
  const application = backendConstants('ApplicationStatus.java')
  const job = backendConstants('JobStatus.java')
  const category = backendConstants('MessageCategory.java')
  const jobType = backendConstants('JobType.java')
  if (!application || !job || !category || !jobType) {
    // 拿不到后端枚举就等于这条检查没执行。原先在这里 console.log 后直接 return，
    // node:test 会把它记成 pass —— 正是"环境不具备被显示成通过"。
    // 宁可判失败，让一键验收如实报告，也不拿一份可能过期的抄件当真。
    assert.fail(`未找到后端枚举源码（${BACKEND_ENUM_DIR}），状态取值无法校验。`
      + '这项检查依赖后端仓库与小程序并列存放；缺少时按未通过处理，不按跳过处理。')
  }
  const vocab = {
    status: new Set([...application, ...job, '']),
    category: new Set([...category, '']),
    job_type: new Set([...jobType, ''])
  }
  // V7 起的扩展模块（社区、旅居、经营、合同与保险…）各有自己的状态机，没有 Java 枚举，
  // 取值的唯一来源是迁移脚本里 status 列的注释（例如 'pending 待审核 / online 已发布 / rejected 已驳回'）。
  // 核心报名 / 岗位页面仍只认 ApplicationStatus + JobStatus；其余页面再加上迁移里登记过的全部状态取值 ——
  // 拼错（'aproved'）照样判错，只是分不出"取值合法但属于另一张表"。
  const extStatus = migrationStatusTokens()
  if (!extStatus.size) assert.fail(`未能从 ${MIGRATION_DIR} 读出任何 status 列注释，扩展页面的状态取值无法校验`)
  const extVocab = new Set([...vocab.status, ...extStatus])
  const extSource = name => readFileSync(join(BACKEND_ENUM_DIR, '..', 'ext', name), 'utf8')
  const completedStates = [...extSource('staff/KgWorkEndService.java').matchAll(/"(\w+)"\.equals\(app\.get\("status"\)\)/g)].map(match => match[1])
  const progressStates = [...extSource('operations/OpsDaily.java').matchAll(/"(\w+)"\.equals\(target\.get\("status"\)\)/g)].map(match => match[1])
  const wishCategoryVocab = new Set([...wishCategories(), ''])
  const bad = []
  for (const rel of WIRED_PAGES) {
    const { script } = splitSfc(readFileSync(join(ROOT, rel), 'utf8'))
    for (const key of Object.keys(vocab)) {
      let allowed = vocab[key]
      if (key === 'status' && !CORE_STATUS_PAGES.includes(rel)) allowed = extVocab
      if (key === 'status' && rel === 'pages/jobs/interview.vue') allowed = new Set([...allowed, ...completedStates])
      if (key === 'status' && rel === 'pages/staff/operations.vue') allowed = new Set([...allowed, ...progressStates])
      if (key === 'category' && rel.startsWith('pages/wish/')) allowed = wishCategoryVocab
      for (const value of enumLiteralsAt(script, key)) {
        // 中文字面量是给人看的文案，不是机器取值；只校验 ASCII 小写取值。
        if (!/^[a-z][a-z0-9_]*$/.test(value) && value !== '') continue
        if (!allowed.has(value)) bad.push(`${rel}  ${key} = '${value}'`)
      }
    }
  }
  assert.deepEqual(bad, [], `以下取值不在后端枚举里，接口会静默返回空结果：\n  ${bad.join('\n  ')}`)
})

/*
 * 这个文件检查什么、为什么这么划范围
 *
 * 检查 1（假成功文案）针对本轮反复出现的一类问题：按钮点下去只 uni.showToast 一句
 * "已提交/已保存"，一个请求都没发。用户以为事情做完了，数据库里什么都没有。
 * 判定条件是"这句完成语气的文案不是在某个写请求成功返回之后说的"。展开范围包含
 * @click 表达式本身、它调用到的局部函数（递归 MAX_DEPTH 层）、以及 v-for 循环项上的
 * 处理函数（@click="q.to()" 这种）。
 *
 * 判据原先是"展开后的代码里有没有任何 api 调用"，那太松。现在分四步收紧：
 *   1. 分读写。common/api.js 每个导出落到 request.js 的 get/post/put/del 上，METHOD 读得出来，
 *      GET 接口不算数 —— 读请求带不回"改变了什么"的结果。
 *   2. 看先后，而且**按执行路径看**。文案必须落在同一作用域（或更里层）里一次
 *      `await 写接口(...)` 之后，或落在写接口的 .then(...) 成功回调里。嵌套回调里的写请求
 *      背不动它外面的 toast：`uni.showModal({ success: async r => { await apiWithdraw(1) } });
 *      toast('已撤回')` 是弹窗还没确认就宣布撤回了，必须判负。绑定到局部名字却从没被引用过的
 *      嵌套函数，整段按不可达处理：里面的写请求不算数，里面的提示也不报（它弹不出来）。
 *   3. 失败被吞掉不算成功。`await apiX().catch(() => {})`、`.then(ok, onError)`、
 *      `try { await apiX() } catch (e) {}` 之后的完成语气一律判负 —— 后端拒了照样弹。
 *      await 只为它所在的 try 块内部背书，除非 catch 自己 return/throw 中断了流程。
 *      `.catch` 里重新抛出、或者把错误如实弹给用户，不算吞。
 *   4. 排除失败分支。catch / finally 块、.catch(...) 处理体里的完成语气照样判负。
 * 请求和文案拆到两个函数里（await apiSave(); showDone()）仍然放行；中间隔好几层
 * （fpA -> fpB -> fpC -> 写接口）也放行 —— "await 一个最终会 await 到写接口的局部函数"
 * 等价于 await 写接口本身，这一步是递归算出来的，不是按层数猜的。
 * `await Promise.all([写接口(), 写接口()])` 也放行：它把里面任何一个失败原样抛出来，
 * 和直接 await 等价（allSettled / any 不等价，故意不认）。
 *
 * 判负时给出的理由是**按提示所在的位置**算的，不是整段一个结论：同一次点击里可以既有一句
 * 铁定的假成功、又有一条深到展不开的调用链。"没有写请求"是断言，"层数不够"是自白，
 * 两者互相冒充都会误导下一个人 —— 前者会让真 bug 被当成工具局限放过，后者会让人去删断言。
 *
 * 只对 WIRED_PAGES 判负，是因为 INTEGRATION.md 第二节明确写了旅居预订、社区、经营数据等
 * 页面本轮未接线、保持原样静态原型。对它们断言只会得到一片红色，然后被人用 skip 关掉，
 * 检查就死了。所以改成打印欠账数量：数字在，压力在，但不会阻塞。接线一页就把它加进
 * WIRED_PAGES，欠账自然下降 —— 这个列表是范围声明，不是豁免名单。
 * WIRED_PAGES 取"相对基线有改动的页面 + 基线之后新建的页面"两部分：只取前者的话，
 * 新建的页面是未跟踪文件，git diff 看不见，这一页的检查会静默关闭。
 *
 * 检查 2（死导出）抓的是另一头：接口写好了但页面没接上。它不该直接判负，因为后端能力
 * 先于页面落地是正常节奏，所以钉一个基线只防增长。
 *
 * 检查 3（状态取值）抓的是拼写漂移。后端 status/category 是精确匹配的单值，拼错既不报错
 * 也不抛异常，只会让列表永远空、分支永远不成立。取值来源只认后端枚举源码，不在小程序这边
 * 抄一份常量表 —— 抄件过期时这条检查会变成绿色的谎。
 *
 * 这套检查抓不到什么（别把绿色当成"没有假成功"）。
 * 这份清单每条都在隔离的合成工程里当探针跑过，关掉的不留在这里，还在的不藏起来：
 *
 * 漏报（会把假成功放过去）：
 * - 只看 @click / @tap。@change、@confirm 这些事件上的假成功不在覆盖内
 *   （写下时已逐页确认接线页面的这些事件里没有 toast，但以后加了就漏）。
 * - 不判"发的是不是这次操作该发的那个请求"。`await apiMarkAllRead(mode); toast('已提交报名')`
 *   仍然能过：要判到这一步得知道按钮和接口的对应关系，这份信息不在代码里。
 * - 同一作用域内只看文本先后，不做分支分析。`if (ok) { await apiSave() } else { toast('已保存') }`
 *   里 else 分支的文案会被前面那句 await 撑住，漏报。三元、switch 同理。
 * - 找 toast 的那次展开也停在 MAX_DEPTH（8）层：第 9 层往下的纯假成功看不见。
 *   这个方向的上限是漏报，不是误报，所以没法靠"保守判负"兜住，只能靠不写那么深。
 * - `.catch(e => toast(e.message))` 之后再弹成功提示，本检查放行。理由是错误已经如实
 *   告知用户了；但失败时两条提示会一起弹，这仍然是个该改的写法，检查抓不到。
 *   `catch { toast(错误) }` 形式的 try/catch 则不放行，因为 await 只管到 try 块结尾。
 * - 同一段里同名函数既在写请求之前、又在之后被调用时，按"之后"算（就宽不就严）。
 *   settledOnEntry 一旦为真，该段里除失败分支外的提示全部放行，同理就宽不就严。
 *   跨段也一样：一个函数第一次是从"已结算"的位置走到的，之后从别处再走到它就不重展开了。
 * - 成功语义靠词表匹配。换一种说法（"搞定了""收到啦"）就绕过去了；
 *   发现新的说法应当往 SUCCESS_WORDS 里加，而不是放宽别的条件。
 * - "从没被引用过的局部函数"是按标识符出现次数判的。某个函数只通过字符串名字或动态方式
 *   被调用时，会被误当成不可达而整段跳过，里面的假成功也就不报了。
 *
 * 误报（会把正确代码报出来，此时该做的是压平链路或改写法，不是删断言）：
 * - 判 settle 的那次递归也停在 MAX_DEPTH（8）层。触到上限时那句提示的结论是
 *   "无法判定有没有写请求兜底"并判负 —— 措辞不会伪装成"没有写请求"，但结果仍是红的。
 * - 写请求作为参数传给别的 await 表达式时不算数：只有 `await Promise.all/race([...])`
 *   被认成透明包装。`await Promise.allSettled([写接口()])`（它本来就吞失败，判负是对的）、
 *   `await wrap(写接口())`（wrap 等不等这个 promise，看不出来）都会被报出来。
 * - 作用域是按大括号配对 + 头部形状切出来的，不是真的 JS 语法树。
 *   `a < b, c > (d)` 这类刁钻写法、被 MAX_BODY 截断的超长函数，都可能把范围读错；
 *   读错的方向被限制成"读少了"（误报），不是"读多了"（漏报）。
 * - 读写以 common/api.js 的 get/post/put/del 为准。后端若把写操作做成 GET 接口，
 *   这里会当成读，正确的成功提示反而被报出来 —— 那时该改的是接口方法，不是这条判据。
 *
 * 曾经列在这里、现在已经关掉的（留个记号，免得再被当成"本来就抓不到"）：
 * - "只认发出了请求、不认请求成功了"。`apiSave(); toast('已保存')` 这种裸调用现在判负：
 *   写请求只有被 await 到、或提示落在它的 .then 成功回调里，才算为提示兜底。
 * - "写请求只要文本上出现在提示之前就算数"。现在按函数体切作用域，嵌套回调里的、
 *   以及从没被调用过的嵌套函数里的写请求，都背不动它外面的提示。
 */
