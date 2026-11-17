// 私信里的文件（V46，2026-10-16 主人真机反馈）：门店和报名人 / 接单人的会话里发文件、打开文件、转发、复制下载链接。
// 只给 pages/community/chat.vue 用：放在 community 分包目录里，构建时跟着分包走，不进主包（主包只剩约 100KB）。
// 做法照线上任务素材附件 pages/jobs/material-files.js（接单人）、pages/staff/online-material.js（门店）——
// 那两份在别的分包里，从这里引用会让 uni-app 把它们挪进主包，所以单独放一份。
import { API_BASE } from '../../common/config.js'
import { get, getToken } from '../../common/request.js'
import { downloadError, readSmallText } from '../../common/upload.js'

/** 能发的文件（KgOnlineMaterialFiles 白名单） */
export const FILE_EXTS = ['zip', 'rar', '7z', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
/** 单个文件上限（KgChatFiles.MAX_BYTES） */
export const MAX_FILE_MB = 10
export const TYPE_HINT = '只能发 zip / rar / 7z 压缩包和 PDF、Word、Excel、PPT 文件'
/** 「发图片 / 发文件」选项里那一行：小程序只能从微信聊天记录里选文件，先说清楚 */
export let FILE_PICK_LABEL = '发文件（PDF、Word、Excel、PPT、压缩包）'
/** 发文件时提醒别走开：小程序切到后台 5 秒会中断上传；网页版不提「小程序」 */
export let STAY_HINT = '，请不要关闭页面'
// #ifdef MP-WEIXIN
FILE_PICK_LABEL = '发文件（从微信聊天记录里选）'
STAY_HINT = '，请不要离开小程序'
// #endif

/** 扩展名（小写，不带点） */
export const extOf = (name) => {
  const m = /\.([A-Za-z0-9]+)\s*$/.exec(String(name || ''))
  return m ? m[1].toLowerCase() : ''
}

/** 1536 → "1.5 KB"，10485760 → "10 MB"（与服务端 KgOnlineMaterialFiles.sizeLabel 一样） */
export function sizeLabel(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return n + ' B'
  const v = n < 1024 * 1024 ? n / 1024 : n / (1024 * 1024)
  const unit = n < 1024 * 1024 ? ' KB' : ' MB'
  const s = v >= 100 ? String(Math.round(v)) : v.toFixed(1)
  return (s.endsWith('.0') ? s.slice(0, -2) : s) + unit
}

/** 选中的文件先在本机检查格式和大小；能发返回 ''，不能发返回原因 */
export function fileProblem(f) {
  if (!f) return '没有选到文件'
  if (!FILE_EXTS.includes(extOf(f.name))) return TYPE_HINT
  if (Number(f.size) > MAX_FILE_MB * 1024 * 1024) return `文件超过 ${MAX_FILE_MB}MB，可以分成几个压缩包，或把网盘链接发在消息里`
  return ''
}

/**
 * 选一个文件，返回 {path, name, size, file}，取消返回 null。
 * 小程序只能从微信聊天记录里选（chooseMessageFile，type 必须是 file，extension 才生效）；网页版从本机选。
 */
export function pickChatFile() {
  return new Promise((resolve, reject) => {
    const fail = (e) => (/cancel/i.test(String(e && e.errMsg)) ? resolve(null) : reject(new Error('没能打开文件选择，请重试')))
    // #ifdef MP-WEIXIN
    wx.chooseMessageFile({
      count: 1, type: 'file', extension: FILE_EXTS,
      success: (r) => { const x = (r.tempFiles || [])[0]; resolve(x ? { path: x.path, name: x.name, size: x.size } : null) },
      fail
    })
    // #endif
    // #ifndef MP-WEIXIN
    uni.chooseFile({
      count: 1, extension: FILE_EXTS.map((x) => '.' + x),
      success: (r) => { const x = (r.tempFiles || [])[0]; resolve(x ? { path: (r.tempFilePaths || [])[0] || x.path, name: x.name, size: x.size, file: x } : null) },
      fail
    })
    // #endif
  })
}

/** 服务端回包 → 结果；不是 {code: 200} 的一律当失败，带上服务端给的原因（和发图片一样带 code，页面按 401/403 处理） */
export function parseUpload(res) {
  if (res && res.statusCode === 413) return { error: `文件太大了，单个不能超过 ${MAX_FILE_MB}MB` }
  let body = null
  try { body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data } catch (e) { body = null }
  if (body && body.code === 200) return { data: body.data }
  return { error: (body && body.msg) || '文件发送结果无法确认，请重试', code: body && body.code }
}

/**
 * 发一个文件到会话（服务端 POST /app/chat/{convId}/files）。原文件名放在 name 里（小程序上传时的文件名是临时名）；
 * clientMessageId 让重试不会发两条。onProgress(百分比)；超时放宽到 10 分钟。
 */
export function uploadChatFile(convId, f, clientMessageId, token, onProgress) {
  return new Promise((resolve, reject) => {
    const opts = {
      url: API_BASE + '/app/chat/' + convId + '/files',
      filePath: f.path,
      name: 'file',
      formData: { name: f.name, clientMessageId },
      header: token ? { 'X-App-Token': token } : {},
      timeout: 600000,
      success: (res) => {
        const r = parseUpload(res)
        if (!r.error) return resolve(r.data)
        const e = new Error(r.error)
        e.code = r.code || (res && res.statusCode === 413 ? 413 : undefined)
        reject(e)
      },
      // 小程序切到后台 5 秒后，进行中的上传会被中断（errMsg 里有 interrupted / abort）
      fail: (e) => reject(new Error(/interrupt|abort/i.test(String(e && e.errMsg)) ? '发送被打断了（切到后台会中断上传），请重试' : '网络连接失败，请检查网络后重试'))
    }
    // #ifdef H5
    if (f.file) opts.file = f.file
    // #endif
    const task = uni.uploadFile(opts)
    if (task && typeof task.onProgressUpdate === 'function' && onProgress) task.onProgressUpdate((p) => onProgress(p.progress))
  })
}

/** 文件的下载地址（相对后端根，要带登录令牌） */
export const filePath = (convId, msgId) => '/app/chat/' + convId + '/messages/' + msgId + '/file'

/** 复制下载链接用：{url（相对后端根）, expireAt, hours}，3 天内有效 */
export const fileLink = (convId, msgId) => get(filePath(convId, msgId) + '/link')

/** 电脑版微信（Windows / Mac） */
function isDesktop() {
  try {
    const p = (uni.getSystemInfoSync() || {}).platform
    return p === 'windows' || p === 'mac'
  } catch (e) {
    return false
  }
}

/** 当前端能做什么：是不是小程序、是不是电脑版微信、能不能转发文件到聊天（基础库 2.16.1 起）、能不能保存到电脑 */
export function fileEnv() {
  let env = { mp: false, desktop: false, canShare: false, canSave: false }
  // #ifdef MP-WEIXIN
  env = { mp: true, desktop: isDesktop(), canShare: typeof wx.shareFileMessage === 'function', canSave: typeof wx.saveFileToDisk === 'function' }
  // #endif
  return env
}

/**
 * 点文件卡片后的选项（纯函数，见 scripts/chat-files.test.mjs）：
 *   · 网页版：「下载」；
 *   · 小程序：PDF / Office 文档「打开」（右上角「…」还能转发、保存）；压缩包在手机上「发到微信聊天」，电脑版微信「保存到电脑」；
 *   · 都有「复制下载链接」（3 天内有效，粘贴到浏览器里下载）。
 */
export function fileActions(f, env) {
  const acts = []
  if (!env || !env.mp) acts.push('下载')
  else {
    if (f && f.openable) acts.push('打开')
    if (env.desktop && env.canSave) acts.push('保存到电脑')
    else if (!(f && f.openable) && env.canShare) acts.push('发到微信聊天')
  }
  acts.push('复制下载链接')
  return acts
}

/** 删掉小程序目录里下载的临时文件（用户目录总共只有 200MB） */
export function removeLocal(local) {
  // #ifdef MP-WEIXIN
  try { wx.getFileSystemManager().unlinkSync(local) } catch (e) { /* 已经删了 */ }
  // #endif
}

/**
 * 带登录令牌把文件下载到小程序自己的目录，文件名用 chatf_<消息ID>.<扩展名>（保证转发出去的扩展名对），返回本地路径。
 * onProgress(百分比)；服务端回的是错误 JSON 时把原因交给页面。
 */
export function downloadLocal(path, msgId, f, onProgress) {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    const local = wx.env.USER_DATA_PATH + '/chatf_' + msgId + '.' + f.ext
    removeLocal(local)
    const token = getToken()
    const task = wx.downloadFile({
      url: API_BASE + path,
      header: token ? { 'X-App-Token': token } : {},
      filePath: local,
      timeout: 600000,
      success: async (r) => {
        const msg = downloadError(await readSmallText(local), '')
        if (msg || r.statusCode !== 200) {
          removeLocal(local)
          return reject(new Error(msg || `下载失败（HTTP ${r.statusCode}）`))
        }
        resolve(local)
      },
      // 小程序切到后台 5 秒后，进行中的下载会被中断
      fail: (e) => reject(new Error(/interrupt|abort/i.test(String(e && e.errMsg)) ? '下载被打断了（切到后台会中断下载），请重试' : '网络连接失败，请检查网络后重试'))
    })
    if (task && typeof task.onProgressUpdate === 'function' && onProgress) task.onProgressUpdate((p) => onProgress(p.progress))
    // #endif
    // #ifndef MP-WEIXIN
    reject(new Error('请用「下载」保存文件'))
    // #endif
  })
}

/** 转发到微信聊天（要在点击里调用）。转发成功或取消后删掉本地文件，返回是否发出；其他失败保留文件，好让下一次点击直接转发 */
export function shareLocal(local, f) {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    wx.shareFileMessage({
      filePath: local,
      fileName: f.name,
      success: () => { removeLocal(local); resolve(true) },
      fail: (e) => {
        if (/cancel/i.test(String(e && e.errMsg))) { removeLocal(local); return resolve(false) }
        reject(new Error('没能打开转发'))
      }
    })
    // #endif
    // #ifndef MP-WEIXIN
    reject(new Error('请用「下载」保存文件'))
    // #endif
  })
}

/** 电脑版微信：弹出「另存为」保存到电脑（只有电脑端有这个能力），完了删掉本地临时文件 */
export function saveLocal(local) {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    wx.saveFileToDisk({
      filePath: local,
      success: () => resolve(true),
      fail: (e) => (/cancel/i.test(String(e && e.errMsg)) ? resolve(false) : reject(new Error('没能保存到电脑，可以复制下载链接用浏览器下载'))),
      complete: () => removeLocal(local)
    })
    // #endif
    // #ifndef MP-WEIXIN
    reject(new Error('请用「下载」保存文件'))
    // #endif
  })
}
