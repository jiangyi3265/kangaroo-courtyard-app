// 文件上传：选图 / 选文件后以 multipart 上传（带 X-App-Token），返回后端回包的 data。
// 后端返回的图片地址是相对路径（/profile/…、/kangaroo/file/private?…），显示前用 absUrl 补上接口域名。
import { API_BASE } from './config.js'
import { getToken } from './request.js'

export const absUrl = (path) => {
  const p = String(path || '')
  return /^\/(profile|kangaroo)\//.test(p) ? API_BASE + p : p
}

export function uploadTo(url, filePath, formData = {}) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    uni.uploadFile({
      url: API_BASE + url,
      filePath,
      name: 'file',
      timeout: 300000,
      formData,
      header: token ? { 'X-App-Token': token, 'X-App-Upload-Version': '2' } : { 'X-App-Upload-Version': '2' },
      success: (res) => {
        let body = null
        try { body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data } catch (e) { body = null }
        if (body && body.code === 200) resolve(body)
        else {
          const err = new Error((body && body.msg) || '上传失败')
          err.code = body ? body.code : -1
          reject(err)
        }
      },
      fail: () => reject(new Error('网络连接失败，请检查网络后重试'))
    })
  })
}

export const chooseImage = () => new Promise((resolve) => {
  uni.chooseImage({ count: 1, sizeType: ['compressed'], success: (r) => resolve(r.tempFilePaths[0]), fail: () => resolve(null) })
})

/** 多选图片（最多 n 张），返回临时路径数组 */
export const chooseImages = (n) => new Promise((resolve) => {
  uni.chooseImage({ count: Math.max(1, Math.min(9, n || 1)), sizeType: ['compressed'], success: (r) => resolve(r.tempFilePaths || []), fail: () => resolve([]) })
})

/** 选证照：相册、拍照，或文件（小程序从聊天记录选，H5 从本机选）。 */
export const chooseDoc = (source = 'file') => new Promise((resolve, reject) => {
  const fail = (error) => {
    if (/cancel/i.test(String(error && error.errMsg))) return resolve(null)
    const message = source === 'camera' ? '无法打开相机，请检查相机权限后重试'
      : source === 'album' ? '无法打开相册，请检查照片权限后重试' : '无法选择文件，请重试'
    reject(new Error(message))
  }
  if (source === 'album' || source === 'camera') {
    uni.chooseImage({
      count: 1, sizeType: ['original'], sourceType: [source],
      success: (r) => resolve((r.tempFilePaths || [])[0] || null), fail
    })
    return
  }
  // #ifdef MP-WEIXIN
  wx.chooseMessageFile({
    count: 1, type: 'all', extension: ['pdf', 'jpg', 'jpeg', 'png'],
    success: (r) => resolve((r.tempFiles || [])[0]?.path || null), fail
  })
  // #endif
  // #ifdef H5
  uni.chooseFile({ count: 1, extension: ['.pdf', '.jpg', '.jpeg', '.png'], success: (r) => resolve((r.tempFilePaths || [])[0] || null), fail })
  // #endif
  // #ifndef MP-WEIXIN || H5
  uni.chooseImage({ count: 1, success: (r) => resolve((r.tempFilePaths || [])[0] || null), fail })
  // #endif
})

/** 查看文件：图片直接预览，PDF 下载后用系统能力打开 */
export function openFile(url, isPdf) {
  const full = absUrl(url)
  if (!isPdf) {
    uni.previewImage({ urls: [full] })
    return
  }
  // #ifdef H5
  window.open(full, '_blank')
  // #endif
  // #ifndef H5
  uni.downloadFile({ url: full, success: (r) => uni.openDocument({ filePath: r.tempFilePath, fileType: 'pdf' }) })
  // #endif
}

// 下载接口出错（没权限、登录过期、日期不对……）时服务端回的是 {code, msg} 这样的 JSON，HTTP 状态码多半仍是 200。
// 只有不超过这个长度的内容才读出来看：错误回包都很短，真正的报表文件远大于它，也不会是 JSON。
export const DOWNLOAD_ERROR_MAX = 4096

/**
 * 判断下载回来的内容是不是服务端的错误回包，是就返回服务端给的原因，不是（真的是文件）返回 ''。
 * text 是回包文本（读不到时传 ''），contentType 是响应头（小程序 downloadFile 拿不到，传 ''）。
 * 纯函数，见 scripts/download-error.test.mjs。
 */
export function downloadError(text, contentType = '') {
  const json = /json/i.test(String(contentType || ''))
  const s = typeof text === 'string' ? text.trim() : ''
  let body = null
  if (s.charAt(0) === '{' && s.length <= DOWNLOAD_ERROR_MAX) {
    try { body = JSON.parse(s) } catch (e) { body = null }
  }
  if (body && typeof body === 'object' && (body.msg != null || body.code != null)) {
    // 能解析成 {code,msg} 就一定不是要下载的那份文件：哪怕 code 是 200 也按失败处理，避免把一段 JSON 当成报表打开
    const msg = String(body.msg || '').trim()
    if (msg && body.code !== 200) return msg
    return body.code != null && body.code !== 200 ? `下载失败（错误码 ${body.code}）` : '下载失败，服务端没有返回文件'
  }
  // 响应头说是 JSON 却解析不出原因：同样不是文件
  return json ? '下载失败，服务端没有返回文件' : ''
}

// 小程序 downloadFile 拿不到响应头：文件不大时把内容读出来看一眼，读不到就当作文件
export function readSmallText(filePath) {
  return new Promise((resolve) => {
    let fs = null
    try { fs = typeof uni.getFileSystemManager === 'function' ? uni.getFileSystemManager() : null } catch (e) { fs = null }
    if (!fs || !filePath) return resolve('')
    fs.stat({
      path: filePath,
      success: (st) => {
        const size = st && st.stats ? Number(st.stats.size) : NaN
        if (!(size <= DOWNLOAD_ERROR_MAX)) return resolve('')
        fs.readFile({ filePath, encoding: 'utf8', success: (r) => resolve(typeof r.data === 'string' ? r.data : ''), fail: () => resolve('') })
      },
      fail: () => resolve('')
    })
  })
}

/** 下载需要登录的文件（带 X-App-Token）并打开：小程序 downloadFile + openDocument；H5 取回后另存。失败时 reject 的消息就是服务端给的原因 */
export function downloadDoc(path, fileType, filename) {
  const token = getToken()
  return new Promise((resolve, reject) => {
    // #ifdef H5
    fetch(API_BASE + path, { headers: token ? { 'X-App-Token': token } : {} })
      .then(async (r) => {
        const ct = r.headers.get('Content-Type') || ''
        const b = await r.blob()
        if (!r.ok || /json|text/i.test(ct) || b.size <= DOWNLOAD_ERROR_MAX) {
          const msg = downloadError(await b.text(), ct)
          if (msg) throw new Error(msg)
        }
        if (!r.ok) throw new Error(`下载失败（HTTP ${r.status}）`)
        return b
      }, () => { throw new Error('网络连接失败，请检查网络后重试') })
      .then((b) => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = filename || 'report.' + fileType
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
        resolve()
      })
      .catch((e) => reject(e))
    // #endif
    // #ifndef H5
    uni.downloadFile({
      url: API_BASE + path,
      header: token ? { 'X-App-Token': token } : {},
      success: async (r) => {
        // 先看回来的是不是错误 JSON（状态码 200 也可能是），是就把服务端原因交给页面，而不是一律"打开文件失败"
        const msg = downloadError(await readSmallText(r.tempFilePath), '')
        if (msg) return reject(new Error(msg))
        if (r.statusCode !== 200) return reject(new Error(`下载失败（HTTP ${r.statusCode}）`))
        uni.openDocument({ filePath: r.tempFilePath, fileType, showMenu: true, success: () => resolve(), fail: () => reject(new Error('文件已下载，但打开失败，请稍后重试')) })
      },
      fail: () => reject(new Error('网络连接失败，请检查网络后重试'))
    })
    // #endif
  })
}
