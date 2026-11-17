// 视频上传（2026-10-17 旅居改版 R3）：选视频（60 秒、200MB 以内）→ 分段传到 /app/upload/video/parts（每段 8MB 原样放在请求体里）→ 拿到平台路径；
// 小程序选视频时给的缩略图另外传成图片，当视频封面（网页版没有缩略图，封面留空，页面画中性的占位底色）。
// 员工端「视频与生活碎片」（pages/staff/rooms.vue）用这一份；住客写评价（pages/profile/review.vue）用 pages/profile/review-video.js —— 内容相同，
// 两个分包引用同一个模块的话 uni-app 会把它挪进主包（主包只剩约 100KB），所以各放各的（和 online-material.js / material-files.js 一样）。
// 分段上传的做法照 pages/staff/online-material.js（线上已经跑通）：
//   · 微信 readFile({position, length}) 读出来的 ArrayBuffer 来自另一个运行环境，instanceof ArrayBuffer 是 false，所以用类型标签判断；
//   · uni.request 包装层会把这些字节弄坏（服务端收到的长度不对），小程序里直接用 wx.request 发。
import { API_BASE } from '../../common/config.js'
import { getToken } from '../../common/request.js'

/** 单个视频上限（KgVideoUploads.MAX_BYTES） */
export const VIDEO_MAX_MB = 200
/** 时长上限（KgVideoUploads.MAX_SECONDS）；服务端量不了时长，这里选完就拦 */
export const VIDEO_MAX_SECONDS = 60
/** 小院介绍视频（「3分钟看小院」，登记时带 kind=intro）放宽到 3 分钟、200MB（KgVideoUploads.INTRO_MAX_SECONDS / INTRO_MAX_BYTES，2026-10-17） */
export const INTRO_MAX_SECONDS = 180
export const INTRO_MAX_MB = 200
/** 每段字节数（KgVideoUploads.PART_BYTES） */
export const PART_BYTES = 8 * 1024 * 1024
export const VIDEO_EXTS = ['mp4', 'mov']
const BASE = '/app/upload/video/parts'

/** 扩展名（小写，不带点）；小程序的临时文件名形如 wxfile://tmp_xxx.mp4 */
export const extOf = (name) => {
  const m = /\.([A-Za-z0-9]+)\s*(\?.*)?$/.exec(String(name || ''))
  return m ? m[1].toLowerCase() : ''
}

/** 选好的视频能不能传：能传返回 ''，不能传返回原因（时长按选择框给的秒数，四舍五入留 0.5 秒余量） */
export function videoProblem(v, intro = false, label = '小院视频') {
  const maxMb = intro ? INTRO_MAX_MB : VIDEO_MAX_MB, maxSec = intro ? INTRO_MAX_SECONDS : VIDEO_MAX_SECONDS
  if (!v || !v.path) return '没有选到视频'
  if (!VIDEO_EXTS.includes(extOf(v.name || v.path))) return '只能上传 mp4 / mov 视频'
  if (Number(v.size) > maxMb * 1024 * 1024) return `视频不能超过 ${maxMb}MB，可以剪短一点或用手机压缩后再传`
  if (Number(v.duration) > maxSec + 0.5) return intro ? `${label}不能超过 ${maxSec / 60} 分钟，请剪短后再传` : `视频不能超过 ${maxSec} 秒，请剪短后再传`
  if (!(Number(v.size) > 0)) return '视频是空的，请重新选择'
  return ''
}

/**
 * 选一个视频（相册或拍摄，拍摄最长 60 秒），返回 {path, name, size, duration, thumb, file}；取消返回 null。
 * 微信里优先 chooseMedia（带缩略图 thumbTempFilePath），不支持时退回 chooseVideo；网页版 chooseVideo 给 File（分段读用它），没有缩略图
 */
export function pickVideo() {
  return new Promise((resolve, reject) => {
    const fail = (e) => (/cancel/i.test(String(e && e.errMsg)) ? resolve(null) : reject(new Error('没能打开视频选择，请重试')))
    const fromChooseVideo = () => uni.chooseVideo({
      sourceType: ['album', 'camera'], maxDuration: VIDEO_MAX_SECONDS, compressed: true, camera: 'back',
      success: (r) => {
        const file = r.tempFile || null
        resolve({ path: r.tempFilePath, name: (file && file.name) || r.name || r.tempFilePath, size: Number(r.size || (file && file.size)) || 0,
          duration: Number(r.duration) || 0, thumb: r.thumbTempFilePath || '', file })
      },
      fail
    })
    // #ifdef MP-WEIXIN
    if (typeof wx !== 'undefined' && typeof wx.chooseMedia === 'function' && (!wx.canIUse || wx.canIUse('chooseMedia'))) {
      wx.chooseMedia({
        count: 1, mediaType: ['video'], sourceType: ['album', 'camera'], maxDuration: VIDEO_MAX_SECONDS, camera: 'back',
        success: (r) => {
          const f = (r.tempFiles || [])[0]
          if (!f) return resolve(null)
          resolve({ path: f.tempFilePath, name: f.tempFilePath, size: Number(f.size) || 0, duration: Number(f.duration) || 0, thumb: f.thumbTempFilePath || '', file: null })
        },
        // 用户取消就算了；别的失败（老版本、隐私授权没声明等）退回 chooseVideo，不让点了没反应
        fail: (e) => (/cancel/i.test(String(e && e.errMsg)) ? resolve(null) : fromChooseVideo())
      })
      return
    }
    // #endif
    fromChooseVideo()
  })
}

/** 服务端回包 → {data} 或 {error}；不是 {code: 200} 的一律当失败，带上服务端给的原因 */
export function parseResult(res) {
  if (res && res.statusCode === 413) return { error: `视频太大了，不能超过 ${VIDEO_MAX_MB}MB` }
  let body = null
  try { body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data } catch (e) { body = null }
  if (body && body.code === 200) return { data: body.data }
  return { error: (body && body.msg) || '上传失败，请重试' }
}

const netError = (e) => new Error(/interrupt|abort/i.test(String(e && e.errMsg)) ? '上传被打断了（切到后台会中断上传），请重试' : '网络连接失败，请检查网络后重试')

/** 是不是原始字节（见文件头：小程序 readFile 读出的 ArrayBuffer instanceof 判断不准） */
export const isBinary = (data) => Object.prototype.toString.call(data) === '[object ArrayBuffer]'

/** 调一次分段接口：data 是 ArrayBuffer 时按原始字节发，否则发 JSON。失败的 Error 带 retry（网络断了、5xx 可以重试；4xx 不重试） */
export function partCall(method, url, data) {
  return new Promise((resolve, reject) => {
    const token = getToken()
    const header = { 'content-type': isBinary(data) ? 'application/octet-stream' : 'application/json' }
    if (token) header['X-App-Token'] = token
    let send = (o) => uni.request(o)
    // #ifdef MP-WEIXIN
    send = (o) => wx.request(o)
    // #endif
    send({
      url: API_BASE + url, method, data, header, timeout: 300000,
      success: (res) => {
        const r = parseResult(res)
        if (!r.error) return resolve(r.data)
        const e = new Error(r.error)
        e.retry = !res || !(res.statusCode < 500)
        reject(e)
      },
      fail: (e) => { const err = netError(e); err.retry = true; reject(err) }
    })
  })
}

/** 读出视频的一段（ArrayBuffer）：小程序按位置读本地文件，网页用 File.slice */
export function readSlice(f, start, length) {
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({ filePath: f.path, position: start, length, success: (r) => resolve(r.data), fail: () => reject(new Error('读取视频失败，请重新选择')) })
  })
  // #endif
  // #ifndef MP-WEIXIN
  const part = f.file && typeof f.file.slice === 'function' ? f.file.slice(start, start + length) : null
  if (!part) return Promise.reject(new Error('读取视频失败，请重新选择'))
  if (typeof part.arrayBuffer === 'function') return part.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('读取视频失败，请重新选择'))
    reader.readAsArrayBuffer(part)
  })
  // #endif
}

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
 * 分段上传一个视频：先登记（服务端查格式、大小、时长、频率），再按顺序一段一段传，最后让服务端核对文件头、挪进公开目录。
 * 中途失败就告诉服务端放弃（删掉已收的部分）。onProgress(百分比) 每传完一段回调一次。返回 {url, size}
 */
export async function uploadVideoParts(f, onProgress, call = partCall, read = readSlice) {
  const size = Number(f.size) || 0
  const begin = await call('POST', BASE, Object.assign({ name: f.name || f.path, size, duration: Number(f.duration) || undefined }, f.kind ? { kind: f.kind } : {}))
  const step = Number(begin && begin.partBytes) || PART_BYTES
  const total = Number(begin && begin.parts) || Math.ceil(size / step)
  const id = begin && begin.uploadId
  try {
    for (let i = 0; i < total; i++) {
      const start = i * step
      const buf = await read(f, start, Math.min(step, size - start))
      await withRetry(() => call('POST', BASE + '/' + id + '/' + i, buf))
      if (onProgress) onProgress(Math.min(99, Math.floor(((i + 1) / total) * 100)))
    }
    const saved = await withRetry(() => call('POST', BASE + '/' + id + '/finish', {}), 2)
    if (onProgress) onProgress(100)
    return saved
  } catch (e) {
    call('DELETE', BASE + '/' + id).catch(() => {})
    throw e
  }
}

/** 封面：把选视频时给的缩略图传成图片；没有缩略图或传失败都返回 ''（封面不是必须的） */
export function uploadThumb(thumb) {
  if (!thumb) return Promise.resolve('')
  return new Promise((resolve) => {
    const token = getToken()
    uni.uploadFile({
      url: API_BASE + '/app/upload/image', filePath: thumb, name: 'file',
      header: token ? { 'X-App-Token': token, 'X-App-Upload-Version': '2' } : { 'X-App-Upload-Version': '2' },
      success: (res) => { const r = parseResult(res); resolve(r.error ? '' : ((r.data && r.data.url) || '')) },
      fail: () => resolve('')
    })
  })
}

/** 选 + 检查 + 上传 一条龙：返回 {url, cover, duration}；取消返回 null；不能传 / 传失败抛出带原因的 Error */
export async function chooseAndUploadVideo(onProgress, deps = {}, opts = {}) {
  const pick = deps.pick || pickVideo
  const v = await pick()
  if (!v) return null
  // 小院介绍视频：服务端按 kind=intro 放宽到 3 分钟、200MB（相册里选；拍摄仍受微信 60 秒限制）
  if (opts.intro) v.kind = 'intro'
  const why = videoProblem(v, !!opts.intro, opts.label)
  if (why) throw new Error(why)
  const saved = await (deps.upload || uploadVideoParts)(v, onProgress)
  const cover = await (deps.thumb || uploadThumb)(v.thumb)
  return { url: saved && saved.url, cover, duration: Number(v.duration) || 0 }
}

/** 预览一个视频：小程序用系统的媒体预览（全屏，可以横屏），网页版新开一页播放 */
export function previewVideo(url, poster) {
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && typeof wx.previewMedia === 'function') {
    wx.previewMedia({ sources: [{ url, type: 'video', poster: poster || '' }], fail: () => uni.showToast({ title: '视频暂时播放不了', icon: 'none' }) })
    return
  }
  // #endif
  // #ifdef H5
  window.open(url, '_blank')
  // #endif
}
