// 线上任务门店侧：「发素材」的多选图片、并发上传、选文件和上传附件，「退回修改」的截图（V41）。
// 只给 pages/staff/online-jobs.vue 用：放在 staff 分包目录里，构建时跟着分包走，不进主包（主包只剩几 KB）。
// 接单人那边（pages/jobs/deliver.vue）另有一份 pages/jobs/material-files.js —— 两个分包引用同一个模块，uni-app 会把它挪进主包，所以各放各的。
import { API_BASE } from '../../common/config.js'
import { getToken } from '../../common/request.js'

/** 发素材每次最多几张图（KgOnlineMaterialService.MAX_IMAGES） */
export const MAX_IMAGES = 20
/** 退回修改最多几张截图（KgOnlineTaskService.REVIEW_IMAGES_MAX） */
export const MAX_SHOTS = 9
/** 每次最多带几个文件（KgOnlineMaterialService.MAX_FILES） */
export const MAX_FILES = 5
/** 单个文件上限（KgOnlineMaterialFiles.MAX_BYTES）：2026-10-16 起 100MB（之前 10MB，6 张原图打的包就超了） */
export const MAX_FILE_MB = 100
/** 超过这个大小的分段上传，每段这么大（KgOnlineMaterialFiles.PART_BYTES）：服务器一次只收 10MB 以内的上传 */
export const PART_BYTES = 8 * 1024 * 1024
/** 素材文字上限（KgOnlineMaterialService.MAX_CONTENT） */
export const MAX_TEXT = 10000
/** 退回说明上限（KgOnlineTaskService.RETURN_MAX） */
export const MAX_RETURN_TEXT = 5000
/** 同时上传几张图：微信 request / uploadFile / downloadFile 一共最多同时 10 个 */
export const UPLOAD_CONCURRENCY = 3
export const FILE_EXTS = ['zip', 'rar', '7z', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
export const OPENABLE_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']
export const TYPE_HINT = '只能发 zip / rar / 7z 压缩包和 PDF、Word、Excel、PPT 文件'
/** 上传附件时提醒别走开：小程序切到后台 5 秒会中断上传；网页版不提「小程序」 */
export let STAY_HINT = '，请不要关闭页面'
// #ifdef MP-WEIXIN
STAY_HINT = '，请不要离开小程序'
// #endif

// ---------------- 成果链接（V47：可以是整段分享口令） ----------------
// 接单人粘贴的可能是小红书、抖音的「链接 + 复制口令」一整段：验收页原样显示全文，把其中第一个网址标出来、点了复制。
// 接单人那边 pages/jobs/material-files.js 有同样的一份（两个分包各放各的，见文件头）

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

/**
 * 把一轮成果里的几个链接或口令拆成列表（2026-10-17 主人反馈：一次发了好几篇帖子的，分栏交最多 3 个，后端用换行连起来存）；
 * 空的去掉，老数据就是一个。接单人那边 pages/jobs/material-files.js 有同样的一份
 */
export const splitLinks = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean)

/** 扩展名（小写，不带点） */
export const extOf = (name) => {
  const m = /\.([A-Za-z0-9]+)\s*$/.exec(String(name || ''))
  return m ? m[1].toLowerCase() : ''
}

/** 字数：去掉首尾空白再算（和发送前的检查、服务端一致） */
export const textLen = (text) => String(text || '').trim().length

/**
 * 字数显示：平时「已写 N 字」；写到上限的九成以上才显示「N/上限」，免得让人觉得有字数压力。
 * 输入框不限长度（写上限的话，粘贴超长会被悄悄截掉）：超了页面把这行标红，发送前拦下并说明
 */
export const countText = (text, max) => {
  const n = textLen(text)
  return n > max * 0.9 ? `${n}/${max}` : `已写 ${n} 字`
}

/** 长文字先显示前 limit 个字（交付记录里 5000 字的原因不会铺满屏幕）；没超过就原样 */
export const foldText = (text, limit = 300) => {
  const s = String(text || '')
  return s.length > limit ? s.slice(0, limit) + '…' : s
}

/** 选中的文件先在本机检查格式和大小；能发返回 ''，不能发返回原因（文件名由汇总那句带上） */
export function fileProblem(f) {
  const name = (f && f.name) || ''
  if (!FILE_EXTS.includes(extOf(name))) return TYPE_HINT
  if (Number(f && f.size) > MAX_FILE_MB * 1024 * 1024) return `超过 ${MAX_FILE_MB}MB，可以分成几个压缩包，或把网盘链接写在文字里`
  return ''
}

/** 长文件名缩短到 max 个字以内，保留扩展名：「门店拍摄原图第一批精修….zip」 */
export function shortName(name, max = 16) {
  const s = String(name || '')
  if (s.length <= max) return s
  const ext = extOf(s)
  const tail = ext && ext.length <= 5 ? '.' + ext : ''
  return s.slice(0, Math.max(4, max - tail.length - 1)) + '…' + tail
}

/**
 * 网页版 uni.chooseImage / uni.chooseFile 会把超出 count 的悄悄丢掉，页面根本不知道多选了：
 * 多选时把 count 放宽到这个数，拿到全部再由页面截取，并提示「只加前 N 张」。小程序的选择框自己会拦住，不用放宽
 */
const H5_PICK_ALL = 99

/** 一次选多了的提示：「最多还能加 3 张，只加前 3 张」「最多还能加 2 个文件，只加前 2 个」；没超返回 '' */
export const overPickNote = (picked, left, unit = '张', noun = '') => (picked > left ? `最多还能加 ${left} ${unit}${noun}，只加前 ${left} ${unit}` : '')

/**
 * 选图（最多 n 张），返回临时路径。微信里优先 chooseMedia（一次最多 20 张），
 * 不支持时退回 chooseImage（一次最多 9 张）；H5 用 chooseImage（会带 multiple，可以一次多选；可能多于 n 张，由页面截取并提示）。
 */
export function pickImages(n) {
  const count = Math.max(1, Math.min(MAX_IMAGES, n || 1))
  return new Promise((resolve) => {
    let max = count
    // #ifdef MP-WEIXIN
    max = Math.min(9, count)
    // #endif
    // #ifdef H5
    if (count > 1) max = H5_PICK_ALL
    // #endif
    const fallback = () => uni.chooseImage({ count: max, sizeType: ['compressed'], success: (r) => resolve(r.tempFilePaths || []), fail: () => resolve([]) })
    // #ifdef MP-WEIXIN
    if (typeof wx !== 'undefined' && typeof wx.chooseMedia === 'function' && (!wx.canIUse || wx.canIUse('chooseMedia'))) {
      wx.chooseMedia({
        count, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'],
        success: (r) => resolve((r.tempFiles || []).map((x) => x.tempFilePath).filter(Boolean)),
        // 用户取消就算了；别的失败（老版本、隐私授权没声明等）退回 chooseImage，不让点了没反应
        fail: (e) => (/cancel/i.test(String(e && e.errMsg)) ? resolve([]) : fallback())
      })
      return
    }
    // #endif
    fallback()
  })
}

/**
 * 并发上传（同时 limit 张，默认 3）。upload(path) 返回平台图片地址；onProgress(已处理, 总数) 每传完（或失败）一张回调一次。
 * 返回 { urls: 按选择顺序排好的成功地址, failed: 失败张数, reason: 第一条失败原因, failedAt: 失败的是选中的第几张（从 0 起，升序） }。一张失败不影响其他张。
 */
export async function uploadAll(paths, upload, onProgress, limit = UPLOAD_CONCURRENCY) {
  const list = paths || []
  const urls = new Array(list.length)
  const failedAt = []
  let next = 0
  let done = 0
  let failed = 0
  let reason = ''
  const worker = async () => {
    while (next < list.length) {
      const i = next++
      try {
        urls[i] = await upload(list[i])
      } catch (e) {
        failed++
        failedAt.push(i)
        if (!reason) reason = (e && e.message) || ''
      }
      done++
      if (onProgress) onProgress(done, list.length)
    }
  }
  const workers = []
  for (let k = 0; k < Math.max(1, Math.min(limit, list.length)); k++) workers.push(worker())
  await Promise.all(workers)
  return { urls: urls.filter(Boolean), failed, reason, failedAt: failedAt.sort((x, y) => x - y) }
}

/**
 * 图片上传失败的汇总（页面用红字显示）：写明是这次选的第几张 ——「第 2、5 张没传上（原因），可以重新添加」，
 * 失败多了只列前 5 个序号再说一共几张；全成功返回 ''。小程序里的图片临时文件名是乱码，所以用序号不用文件名
 */
export function failedNote(failedAt, reason) {
  const list = failedAt || []
  if (!list.length) return ''
  const which = list.slice(0, 5).map((i) => i + 1).join('、') + ' 张' + (list.length > 5 ? `等 ${list.length} 张` : '')
  return `第 ${which}没传上${reason ? '（' + reason + '）' : ''}，可以重新添加`
}

/**
 * 文件没加上的汇总（页面用红字显示），写明是哪个文件（长名字缩短）：fails 是 [{name, reason}]，原因相同的并成一句 ——
 * 「「安装包.exe」「工具.exe」没加上：只能发 zip …；「拍摄原图.zip」没加上：文件内容和格式对不上…」；都加上了返回 ''
 */
export function filesFailedNote(fails) {
  const groups = []
  for (const f of fails || []) {
    const g = groups.find((x) => x.reason === f.reason)
    if (g) g.names.push(f.name)
    else groups.push({ reason: f.reason, names: [f.name] })
  }
  return groups.map((g) => g.names.map((n) => '「' + shortName(n) + '」').join('') + '没加上' + (g.reason ? '：' + g.reason : '，可以重新添加')).join('；')
}

/**
 * 选文件（最多 n 个），返回 [{path, name, size, file}]。
 * 小程序只能从微信聊天记录里选（chooseMessageFile，type 必须是 file，extension 才生效）；H5 从本机选（可能多于 n 个，由页面截取并提示）。
 */
export function pickFiles(n) {
  const count = Math.max(1, Math.min(MAX_FILES, n || 1))
  return new Promise((resolve, reject) => {
    const fail = (e) => (/cancel/i.test(String(e && e.errMsg)) ? resolve([]) : reject(new Error('没能打开文件选择，请重试')))
    // #ifdef MP-WEIXIN
    wx.chooseMessageFile({
      count, type: 'file', extension: FILE_EXTS,
      success: (r) => resolve((r.tempFiles || []).map((x) => ({ path: x.path, name: x.name, size: x.size }))),
      fail
    })
    // #endif
    // #ifndef MP-WEIXIN
    uni.chooseFile({
      count: count > 1 ? H5_PICK_ALL : count, extension: FILE_EXTS.map((x) => '.' + x),
      success: (r) => resolve((r.tempFiles || []).map((x, i) => ({ path: (r.tempFilePaths || [])[i] || x.path, name: x.name, size: x.size, file: x }))),
      fail
    })
    // #endif
  })
}

/** 服务端回包 → 上传结果；不是 {code: 200} 的一律当失败，带上服务端给的原因 */
export function parseUpload(res) {
  if (res && res.statusCode === 413) return { error: `文件太大了，单个不能超过 ${MAX_FILE_MB}MB` }
  let body = null
  try { body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data } catch (e) { body = null }
  if (body && body.code === 200) return { data: body.data }
  return { error: (body && body.msg) || '上传失败，请重试' }
}

const filesBase = (appId) => API_BASE + '/app/staff/online/assignments/' + appId + '/material-files'

/** 网络层失败的说法（小程序切到后台 5 秒后，进行中的上传会被中断，errMsg 里有 interrupted / abort） */
const netError = (e) => new Error(/interrupt|abort/i.test(String(e && e.errMsg)) ? '上传被打断了（切到后台会中断上传），请重试' : '网络连接失败，请检查网络后重试')

/**
 * 是不是原始字节：小程序 readFile 读出来的 ArrayBuffer 来自另一个运行环境，instanceof ArrayBuffer 是 false
 * （微信模拟器实测；按 JSON 发出去服务端收到的长度不对），所以看类型标签
 */
export const isBinary = (data) => Object.prototype.toString.call(data) === '[object ArrayBuffer]'

/**
 * 调一次分段上传的接口：data 是 ArrayBuffer 时按原始字节发（application/octet-stream），否则发 JSON。
 * 成功返回服务端的 data；失败的 Error 带 retry —— 网络断了、服务端 5xx 可以重试，业务上拒收（4xx、code 不是 200）不重试
 */
export function partCall(method, url, data) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const header = { 'content-type': isBinary(data) ? 'application/octet-stream' : 'application/json' }
    if (token) header['X-App-Token'] = token
    // 小程序直接用 wx.request：uni.request 包装层处理参数时会把 readFile 读出的字节弄坏（模拟器实测服务端收到的长度不对），wx.request 原样发出
    let send = (o) => uni.request(o)
    // #ifdef MP-WEIXIN
    send = (o) => wx.request(o)
    // #endif
    send({
      url, method, data, header, timeout: 300000,
      success: (res) => {
        const r = parseUpload(res)
        if (!r.error) return resolve(r.data)
        const e = new Error(r.error)
        e.retry = !res || !(res.statusCode < 500)
        reject(e)
      },
      fail: (e) => { const err = netError(e); err.retry = true; reject(err) }
    })
  })
}

/** 读出文件的一段（ArrayBuffer）：小程序按位置读本地文件，网页用 File.slice */
export function readSlice(f, start, length) {
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({ filePath: f.path, position: start, length, success: (r) => resolve(r.data), fail: () => reject(new Error('读取文件失败，请重新选择')) })
  })
  // #endif
  // #ifndef MP-WEIXIN
  const part = f.file && typeof f.file.slice === 'function' ? f.file.slice(start, start + length) : null
  if (!part) return Promise.reject(new Error('读取文件失败，请重新选择'))
  if (typeof part.arrayBuffer === 'function') return part.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('读取文件失败，请重新选择'))
    reader.readAsArrayBuffer(part)
  })
  // #endif
}

/** 网络抖动时同一段最多再试 2 次（服务端重复收到已收过的段会直接算成功） */
async function withRetry(run, times = 3) {
  for (let k = 1; ; k++) {
    try {
      return await run()
    } catch (e) {
      if (!e || !e.retry || k >= times) throw e
    }
  }
}

/**
 * 大文件（超过 8MB）分段上传：先登记文件名和大小（服务端先查格式、大小和配额），再按顺序一段一段传（每段 8MB），
 * 最后让服务端核对拼好。中途失败就告诉服务端放弃这次上传（删掉已收的部分）。onProgress(百分比) 每传完一段回调一次
 */
export async function uploadInParts(appId, f, onProgress, call = partCall, read = readSlice) {
  const base = filesBase(appId)
  const size = Number(f.size) || 0
  const begin = await call('POST', base + '/parts', { name: f.name, size })
  const step = Number(begin && begin.partBytes) || PART_BYTES
  const total = Number(begin && begin.parts) || Math.ceil(size / step)
  const id = begin && begin.uploadId
  try {
    for (let i = 0; i < total; i++) {
      const start = i * step
      const buf = await read(f, start, Math.min(step, size - start))
      await withRetry(() => call('POST', base + '/parts/' + id + '/' + i, buf))
      if (onProgress) onProgress(Math.min(99, Math.floor(((i + 1) / total) * 100)))
    }
    const saved = await withRetry(() => call('POST', base + '/parts/' + id + '/finish', {}), 2)
    if (onProgress) onProgress(100)
    return saved
  } catch (e) {
    call('DELETE', base + '/parts/' + id).catch(() => {})
    throw e
  }
}

/**
 * 上传一个附件到这个接单（先上传、发送时随素材一起发出）。原文件名放在 name 里（小程序上传时的文件名是临时名）。
 * 超过 8MB 的分段上传（{@link uploadInParts}，单个最多 100MB）；小的整个传。
 * onProgress(百分比)；超时放宽到 10 分钟。返回服务端的 {fileId, name, size, sizeLabel, ext, kind, openable}
 */
export function uploadMaterialFile(appId, f, onProgress) {
  if (Number(f && f.size) > PART_BYTES) return uploadInParts(appId, f, onProgress)
  return new Promise((resolve, reject) => {
    const token = getToken()
    const opts = {
      url: filesBase(appId),
      filePath: f.path,
      name: 'file',
      formData: { name: f.name },
      header: token ? { 'X-App-Token': token } : {},
      timeout: 600000,
      success: (res) => {
        const r = parseUpload(res)
        if (r.error) reject(new Error(r.error))
        else resolve(r.data)
      },
      fail: (e) => reject(netError(e))
    }
    // #ifdef H5
    if (f.file) opts.file = f.file
    // #endif
    const task = uni.uploadFile(opts)
    if (task && typeof task.onProgressUpdate === 'function' && onProgress) task.onProgressUpdate((p) => onProgress(p.progress))
  })
}

/** 附件的下载地址（门店侧，相对后端根）与签名链接接口 */
export const storeFilePath = (appId, fileId) => '/app/staff/online/assignments/' + appId + '/material-files/' + fileId
export const linkPath = (appId, fileId) => storeFilePath(appId, fileId) + '/link'
