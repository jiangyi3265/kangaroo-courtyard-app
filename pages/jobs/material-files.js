// 接单人交付页「门店素材」里的附件（V41：压缩包和 PDF、Word、Excel、PPT）：打开文档、发到微信聊天、保存到电脑、复制下载链接。
// 只给 pages/jobs/deliver.vue 用：放在 jobs 分包目录里，构建时跟着分包走，不进主包（主包只剩几 KB）。
// 门店那边另有一份 pages/staff/online-material.js —— 两个分包引用同一个模块，uni-app 会把它挪进主包，所以各放各的。
import { API_BASE } from '../../common/config.js'
import { getToken } from '../../common/request.js'
import { downloadError, readSmallText } from '../../common/upload.js'

/** 长文字先显示前 limit 个字，点「展开全文」再看全部 */
export const foldText = (text, limit = 300) => {
  const s = String(text || '')
  return s.length > limit ? s.slice(0, limit) + '…' : s
}

// ---------------- 成果链接（V47：可以是整段分享口令） ----------------
// 小红书、抖音复制出来的是「链接 + 复制口令」一整段文字：提交时原样收下（只去首尾空白），显示时把其中第一个网址标出来、点了复制。
// 门店那边 pages/staff/online-material.js 有同样的一份（两个分包各放各的，见文件头）

/** 成果链接或口令的字数上限（KgOnlineTaskService.LINK_MAX，kg_online_submission.link varchar(500)） */
export const LINK_MAX = 500

/** 一段文字里的第一个 http(s) 网址；没有返回 ''。网址只认 ASCII 字符，碰到空格、中文、全角标点就断开，末尾的英文标点不算 */
export const firstUrl = (text) => {
  const m = /https?:\/\/[A-Za-z0-9\-._~:\/?#[\]@!$&'()*+,;=%]+/i.exec(String(text || ''))
  return m ? m[0].replace(/[.,;:!?'")\]]+$/, '') : ''
}

/** 拆成「网址前 / 网址 / 网址后」三段，页面把网址那段标成可点；没有网址时整段在 before 里 */
export const splitLink = (text) => {
  const s = String(text || '')
  const url = firstUrl(s)
  if (!url) return { before: s, url: '', after: '' }
  const i = s.indexOf(url)
  return { before: s.slice(0, i), url, after: s.slice(i + url.length) }
}

// 2026-10-17 主人反馈：有人一次发了好几篇帖子，「提交成果」分三栏、最多 3 个链接或口令（每个 500 字内），
// 后端用换行连起来存在同一列（每个链接里的换行先并成空格），交付记录里按换行拆开、一个一个显示

/** 一轮成果最多几个链接或口令（KgOnlineTaskService.LINKS_MAX） */
export const LINKS_MAX = 3

/** 把存着的成果链接（换行隔开；老数据是一段）拆成列表，空的去掉 */
export const splitLinks = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean)

/** 一个链接或口令收成一行：去首尾空白，中间的换行、连续空白并成一个空格（和后端 oneLine 一样） */
export const oneLine = (text) => String(text || '').replace(/\s+/g, ' ').trim()

/** 附件的下载地址（接单人侧，相对后端根） */
export const workerFilePath = (appId, fileId) => '/app/online/assignments/' + appId + '/material-files/' + fileId

/** 电脑版微信（Windows / Mac） */
export function isDesktop() {
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
 * 一个附件下面放哪些按钮（纯函数，见 scripts/online-files.test.mjs）：
 *   · 网页版（H5）：「下载」；
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
 * 带登录令牌把附件下载到小程序自己的目录，文件名用 omat_<ID>.<扩展名>（保证转发出去的扩展名对），返回本地路径。
 * onProgress(百分比)；服务端回的是错误 JSON 时把原因交给页面。
 */
export function downloadLocal(path, f, onProgress) {
  return new Promise((resolve, reject) => {
    // #ifdef MP-WEIXIN
    const local = wx.env.USER_DATA_PATH + '/omat_' + f.fileId + '.' + f.ext
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
      // 小程序切到后台 5 秒后，进行中的下载会被中断；附件最大 100MB，小程序目录一共 200MB，满了时让人改用下载链接
      fail: (e) => reject(new Error(/interrupt|abort/i.test(String(e && e.errMsg)) ? '下载被打断了（切到后台会中断下载），请重试'
        : /exceed|storage|space/i.test(String(e && e.errMsg)) ? '小程序的存储空间不够了，可以「复制下载链接」用浏览器下载'
          : '网络连接失败，请检查网络后重试'))
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
