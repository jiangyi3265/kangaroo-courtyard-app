/**
 * 运行时配置。
 *
 * 只放"环境相关"的值，不放业务规则。这里不写任何密钥：
 * 小程序端拿不到也不需要 AppSecret，微信登录的 code 由服务端换取 openid。
 *
 * 注意写法：用"先声明再条件覆盖"，不要写成多个 `export const API_BASE`。
 * scripts/experience.test.mjs 会用一个不加载 uni 插件的 Vite 实例加载本目录下的模块，
 * 那时 `// #ifdef` 只是普通注释、不会被条件编译剔除，多次 export 同名常量会直接语法报错。
 */

let apiBase = 'https://daishu.uuok.top'

// 构建时可用环境变量覆盖，不必改代码：
//   VITE_API_BASE=https://api.example.com npx vite build --mode production
//
// HBuilderX 本地运行、CLI 开发和发布构建默认都连接已部署的 HTTPS 服务。
// 需要本机后端联调时，显式设置 VITE_API_BASE=http://localhost:8080。
// H5 开发由 vite.config.js 将该地址作为代理目标，浏览器使用同源 /dev-api，
// 避免线上接口不允许 localhost 跨域时出现网络错误。发布和小程序不走该代理。
// 避免只启动前端时仍请求未启动的本机后端，导致所有页面报网络错误。
// 读取要带异常保护 —— scripts/experience.test.mjs 会在一个不加载 uni 插件的
// Vite 实例里加载本模块，别的宿主环境未必有 import.meta.env。
try {
  // 必须直接写 import.meta.env.VITE_API_BASE 这个完整成员：构建期会把它静态替换成字符串。
  // 此前为了兼容测试用 typeof import.meta 判断，Vite 构建小程序时把它编译成 Node 才有的 require("url").pathToFileURL，
  // 微信环境里抛异常被下面的空 catch 吞掉，API_BASE 永远是 localhost —— 真机上所有请求、上传、图片都指向 localhost（2026-09-28 复核发现）
  const injected = import.meta.env.VITE_API_BASE
  if (injected) apiBase = String(injected).replace(/\/+$/, '')
} catch (e) {
  // 拿不到环境变量也使用线上 HTTPS 服务
}

// #ifdef MP-WEIXIN
// 微信小程序要求 https，且域名必须在微信公众平台「开发设置 - 服务器域名」中配置
//（必须 HTTPS、不能带端口和路径）。本地用微信开发者工具调试时，勾选
//「不校验合法域名」可临时沿用 http 地址。
//
// 体验版/正式版必须在微信公众平台配置上述 HTTPS 域名；关闭本地域名校验不能代替此配置。
// #endif

export const API_BASE = apiBase

/**
 * 小程序版本号：体验版、开发版读不到正式版本号时用它（见 common/request.js 的 X-App-Client）。每次发版跟着改。
 * 服务端 KgRoleSwitchService.MIN_CLIENT_VERSION 是切换门槛，版本号变了那边也要核对。
 */
export const APP_VERSION = '2026.11.27.4'

/** 请求超时（毫秒）。列表与详情接口都应远快于此，超时即视为网络异常。 */
export const TIMEOUT = 15000

/** 本机存储的登录令牌 key。不能用 experience.js 里按账号分区的 key —— 拿到令牌时还没有账号。 */
export const TOKEN_KEY = 'kangaroo:app-token'
