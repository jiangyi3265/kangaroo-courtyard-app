/**
 * 网络请求层。
 *
 * 设计约束：
 * 1. 模块加载时不得产生任何副作用、不得调用 uni.* —— scripts/experience.test.mjs 会在
 *    只 stub 了 getStorageSync/setStorageSync 的环境里 import 本模块的依赖方。
 * 2. uni API 在 Vue3 下没有被 promisify（uni.promisify.adaptor 只在 VUE2 分支引入），
 *    所以这里手工把 success/fail 回调包成 Promise。
 * 3. 统一处理后端的 { code, msg, data } 约定：code 200 才算成功，其余一律 reject，
 *    并把 code 带在错误对象上，调用方可以按 401/403 区分处理。
 */
import { API_BASE, APP_VERSION, TIMEOUT, TOKEN_KEY } from './config.js'
import R from './routes.js'

let memoryToken = null

/** 城市负责人日报、周报页：这次按招募账（recruit）还是经营账（空）。别的角色不设，服务端也只对城市负责人看这个头 */
let reportAs = ''
export function setReportAs(value) {
  reportAs = value === 'recruit' ? 'recruit' : ''
}

/** 未登录/登录失效时的回调，由 experience.js 注册，避免本模块反向依赖业务状态 */
let onUnauthorized = null

export function setUnauthorizedHandler(fn) {
  onUnauthorized = typeof fn === 'function' ? fn : null
}

/**
 * 403 时的回调，同样由 experience.js 注册：员工授权被撤销、门店被停用后，
 * 服务端逐请求拒绝，本机缓存的授权却还在，需要由业务层核对并纠正。
 * 这里只把请求信息交出去，不判断是不是"门店授权"类的 403。
 */
let onForbidden = null

export function setForbiddenHandler(fn) {
  onForbidden = typeof fn === 'function' ? fn : null
}

export function getToken() {
  if (memoryToken) return memoryToken
  try {
    memoryToken = uni.getStorageSync(TOKEN_KEY) || null
  } catch (e) {
    memoryToken = null
  }
  return memoryToken
}

export function setToken(token) {
  memoryToken = token || null
  try {
    if (token) uni.setStorageSync(TOKEN_KEY, token)
    else uni.removeStorageSync(TOKEN_KEY)
  } catch (e) {
    // 存储写入失败不应打断登录流程，内存中的令牌仍可用于本次会话
  }
}

export function clearToken() {
  setToken(null)
}

/** 后端返回的业务错误。code 为后端的业务码，不是 HTTP 状态码。 */
export class ApiError extends Error {
  constructor(message, code, data) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.data = data
  }
}

// 游客（或登录已失效的人）做了要登录才能做的事（提交报名、收藏、关注…），之前只弹一句「未登录或登录已失效」，
// 页面上没有去登录的路，只能自己退回首页再点「我的」，填的内容也没了。现在写请求被 401 拒绝时问一句要不要去登录：
// 登录页压在当前页上面，普通用户登录后退回原页，页面上填的内容还在。读取类请求多是页面自动加载，不弹框打扰。
// 页面自己已经问了「去登录」（报名页、同行页等）时，在 catch 里同步设置 e.loginHandled = true，这里就不再弹：
// 两个对话框接连弹出，后一个会顶掉前一个，前一个的回调再也不回来（页面按钮会一直卡在"处理中"）。
// 被别的弹窗顶掉时本对话框的 complete 同样不回调，所以"正在弹"最多只算 10 秒，不会从此再也不弹。
const LOGIN_PROMPT_HOLD = 10000
let loginPromptAt = 0
const currentRoute = () => {
  const pages = getCurrentPages()
  return pages.length ? '/' + pages[pages.length - 1].route : ''
}
function promptLogin(err) {
  if (Date.now() - loginPromptAt < LOGIN_PROMPT_HOLD || typeof uni.showModal !== 'function' || typeof getCurrentPages !== 'function') return
  const route = currentRoute()
  if (!route || route === R.login) return
  loginPromptAt = Date.now()
  // 等页面自己的出错提示弹出来以后收掉它，免得提示叠在对话框上
  setTimeout(() => {
    if (err && err.loginHandled) { loginPromptAt = 0; return }
    try {
      if (typeof uni.hideToast === 'function') uni.hideToast()
      uni.showModal({
        title: '需要先登录', content: '登录后才能继续这一步，登录完会回到当前页面。', confirmText: '去登录', cancelText: '再看看',
        // 点的时候已经在登录页（别处先带过去了）就不再压一层
        success: (r) => { if (r.confirm && currentRoute() !== R.login) uni.navigateTo({ url: R.login }) },
        complete: () => { loginPromptAt = 0 }
      })
    } catch (e) {
      loginPromptAt = 0
    }
  }, 0)
}

let messageScopeProvider = () => ''
export function setMessageScopeProvider(provider) { messageScopeProvider = provider }
function buildQuery(params) {
  if (!params) return ''
  const parts = []
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null || v === '') return
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v))
  })
  return parts.length ? '?' + parts.join('&') : ''
}

// 告诉服务端这是哪个渠道、哪个版本（如 release/2026.10.30.2）：后台切换角色前按人显示谁已更新，不参与授权。
// 正式版读 miniProgram.version；体验版、开发版这一项是空的，用代码里的版本号。读不到就不带，网页版也不带
let clientTag = null
function appClient() {
  if (clientTag !== null) return clientTag
  clientTag = ''
  // #ifdef MP-WEIXIN
  try {
    const mp = wx.getAccountInfoSync().miniProgram
    clientTag = mp.envVersion + '/' + (mp.version || APP_VERSION)
  } catch (e) { /* 读不到不影响请求 */ }
  // #endif
  return clientTag
}

/**
 * 发起请求。
 *
 * @param {object} options
 *   url     接口路径，如 '/app/job/list'
 *   method  GET / POST / PUT / DELETE，默认 GET
 *   params  拼到 query string 的参数
 *   data    请求体
 *   auth    是否携带登录令牌，默认 true。浏览类接口没有令牌时也能调用，
 *           所以这里只是"有就带"，不会因为没令牌而提前失败。
 * @returns Promise，resolve 为后端返回体（完整对象，含 code/msg/data/rows/total）
 */
export function request(options) {
  const opts = options || {}
  const url = API_BASE + opts.url + buildQuery(opts.params)
  const header = { 'Content-Type': 'application/json;charset=UTF-8' }
  if (['/app/message/', '/app/insurance/', '/app/pay/'].some(prefix => String(opts.url).startsWith(prefix))) header['X-Message-Scope'] = messageScopeProvider()
  if (String(opts.url).startsWith('/app/chat/')) header['X-Chat-Mode'] = messageScopeProvider() === 'user' ? 'user' : 'staff'
  const client = appClient()
  if (client) header['X-App-Client'] = client
  if (reportAs && String(opts.url).startsWith('/app/manage/')) header['X-Report-As'] = reportAs
  if (opts.auth !== false) {
    const token = getToken()
    if (token) header['X-App-Token'] = token
  }

  return new Promise((resolve, reject) => {
    const method = (opts.method || 'GET').toUpperCase()
    let retries = 0
    const sameSession = () => opts.auth === false || (header['X-App-Token'] || '') === (getToken() || '')
    // 只重试读取请求；提交、支付、取消等写入绝不自动重放。
    const retryOrReject = error => {
      if (method !== 'GET' || opts.retry === false || retries >= 2 || !sameSession()) return reject(error)
      const delay = [600, 1400][retries++]
      setTimeout(() => {
        if (!sameSession()) return reject(new ApiError('登录状态已变化，请重新加载', 409))
        send()
      }, delay)
    }
    const send = () => uni.request({
      url,
      method,
      data: opts.data,
      header,
      timeout: opts.timeout || TIMEOUT,
      success(res) {
        const httpStatus = Number(res.statusCode) || 200
        // 网关的 HTML 错误页也有明确的 HTTP 状态，不能当成业务响应或登录失效。
        if ([502, 503, 504].includes(httpStatus)) {
          retryOrReject(new ApiError('服务暂时不可用，请稍后重新加载', httpStatus))
          return
        }
        let body = res.data
        if (typeof body === 'string') {
          try { body = JSON.parse(body) } catch (e) { /* 非 JSON 响应按错误处理 */ }
        }
        if (!body || typeof body !== 'object') {
          reject(new ApiError('页面数据暂时无法加载，请重试', httpStatus >= 400 ? httpStatus : -1))
          return
        }
        if (httpStatus >= 400 && body.code === 200) {
          reject(new ApiError('请求失败，请稍后重试', httpStatus))
          return
        }
        const code = body.code
        if (code === 200) {
          resolve(body)
          return
        }
        const error = new ApiError(body.msg || '请求失败', code, body)
        // 旧令牌（或登录前发出）的迟到响应不算：那时已经换了新会话
        const isCurrentSession = sameSession()
        if (code === 401 && isCurrentSession && header['X-App-Token']) {
          clearToken()
          if (onUnauthorized) onUnauthorized()
        }
        if (code === 401 && isCurrentSession && opts.auth !== false && method !== 'GET') {
          try { promptLogin(error) } catch (e) { /* 引导失败不影响本次请求的结果 */ }
        }
        // 只对当前令牌发出的请求回调；旧令牌的迟到响应不能触发对新会话的核对。
        // 回调不阻塞本次 reject，页面照常拿到服务端的拒绝原因。
        if (code === 403 && onForbidden && header['X-App-Token'] && header['X-App-Token'] === getToken()) {
          try { onForbidden({ url: opts.url, params: opts.params, data: opts.data, message: body.msg || '' }) } catch (e) { /* 回调失败不影响本次请求的结果 */ }
        }
        reject(error)
      },
      fail(err) {
        const error = new ApiError('网络连接失败，请检查网络后重试', -1, err)
        if (/abort|cancel|url not in domain|invalid url/i.test(err?.errMsg || '')) reject(error)
        else retryOrReject(error)
      }
    })
    send()
  })
}

export const get = (url, params, opts) => request({ ...opts, url, method: 'GET', params })
export const post = (url, data, opts) => request({ ...opts, url, method: 'POST', data })
export const put = (url, data, opts) => request({ ...opts, url, method: 'PUT', data })
export const del = (url, params, opts) => request({ ...opts, url, method: 'DELETE', params })

const H5_CODE_KEY = 'kangaroo:h5-login-code'

/**
 * 取登录凭证 code，交给服务端换取身份。
 *
 * 微信小程序端用 uni.login 拿真实的一次性 code。
 *
 * H5 端没有 uni.login（uni.promisify.adaptor 只在 VUE2 分支引入，且 H5 也没有微信运行时），
 * 这里改为生成一个本机固定的调试凭证串发给服务端。这不是绕过鉴权：
 * 服务端仍要用它去微信换 openid，只有在本地联调模式（kangaroo.wx.mock-enabled=true）下
 * 才会被接受，而那个开关默认关闭、且只有在后端连着本机数据库时才允许启动。
 * 对着生产后端，这个 code 一定换不到身份。
 */
export function wxLoginCode() {
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success(res) {
        if (res && res.code) resolve(res.code)
        else reject(new ApiError('未获取到登录凭证', -1, res))
      },
      fail(err) {
        reject(new ApiError('登录失败，请重试', -1, err))
      }
    })
  })
  // #endif

  // #ifndef MP-WEIXIN
  let code = null
  try {
    code = uni.getStorageSync(H5_CODE_KEY) || null
  } catch (e) {
    code = null
  }
  if (!code) {
    code = 'h5-dev-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36)
    try { uni.setStorageSync(H5_CODE_KEY, code) } catch (e) { /* 存不下也能用完即走 */ }
  }
  return Promise.resolve(code)
  // #endif
}
