/**
 * F10「操作成功后重新拉取并展示最新结果」的通用判据，供后台浏览器用例共用。
 *
 * 记录页面**自己**发出的每一个 /kangaroo/** 写请求（POST/PUT/DELETE，导出除外），
 * 要求其中业务上成功的（响应 code=200）之后、下一次整页跳转之前，
 * 页面又发出了同一模块的 GET /kangaroo/<模块>/list。
 *
 * "下一次整页跳转之前"这个边界是必须的：用例在两步之间常会 page.goto 重新打开页面，
 * 那一次加载也会拉列表，不设边界的话它会把"操作后根本没刷新"掩盖成"刷新了"。
 *
 * 用例里直接用 fetch 调的接口（准备数据、回服务端核对）不经过页面，不会被计入。
 */
export function trackRefetch(page) {
  const events = []
  let seq = 0

  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) events.push({ n: ++seq, kind: 'nav' })
  })

  page.on('response', async resp => {
    const req = resp.request()
    let url
    try { url = new URL(req.url()) } catch { return }
    const m = url.pathname.match(/\/kangaroo\/([A-Za-z]+)(\/.*)?$/)
    if (!m) return
    const module = m[1]
    const rest = m[2] || ''
    const method = req.method()
    const n = ++seq                       // 先按到达顺序占位，再异步解析响应体
    if (method === 'GET') {
      if (rest === '/list') events.push({ n, kind: 'list', module })
      return
    }
    if (/\/export$/.test(rest)) return
    const ev = { n, kind: 'write', module, method, path: url.pathname, ok: null }
    events.push(ev)
    try {
      const body = await resp.json()
      ev.ok = !!body && body.code === 200
    } catch {
      ev.ok = false
    }
  })

  return {
    /** 业务上成功的写请求 */
    okWrites() {
      return events.filter(e => e.kind === 'write' && e.ok === true)
    },
    /** 成功之后、下一次整页跳转之前，没有重新拉同模块列表的写请求 */
    missing() {
      return this.okWrites().filter(w => {
        const nextNav = events.find(e => e.kind === 'nav' && e.n > w.n)
        const bound = nextNav ? nextNav.n : Infinity
        return !events.some(e => e.kind === 'list' && e.module === w.module && e.n > w.n && e.n < bound)
      })
    },
    /** 还没解析完响应体的写请求数（断言前应当为 0） */
    pending() {
      return events.filter(e => e.kind === 'write' && e.ok === null).length
    },
  }
}
