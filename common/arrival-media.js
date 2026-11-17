import { API_BASE } from './config.js'
import { getToken } from './request.js'
import { downloadError, readSmallText } from './upload.js'

export function arrivalTicketPath(appId, ref) {
  if (!Number.isSafeInteger(Number(appId)) || Number(appId) <= 0) throw new Error('报名编号不合法')
  const p = String(ref || '')
  const privateRef = /^\/private\/arrival\/\d+\/[0-9a-f]{32}\.(jpg|jpeg|png|gif|webp)$/.test(p)
  const legacyRef = /^\/profile\/upload\/(?:\d{4}\/\d{2}\/\d{2}\/)?[^/\\\x00-\x1f\x7f,]+\.(jpg|jpeg|png|gif|webp)$/i.test(p)
  if (!privateRef && !legacyRef) throw new Error('票据地址不合法，请重新上传')
  if (p.startsWith('/private/arrival/') && p.split('/')[3] !== String(Number(appId))) throw new Error('票据不属于这条报名')
  return `/app/application/${Number(appId)}/arrival/ticket?file=${encodeURIComponent(p)}`
}

export function releaseArrivalImages(urls) {
  // #ifdef H5
  for (const url of urls || []) if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  // #endif
}

function downloadImage(path) {
  const token = getToken()
  if (!token) return Promise.reject(new Error('请重新登录后查看票据'))
  return new Promise((resolve, reject) => {
    // #ifdef H5
    fetch(API_BASE + path, { headers: { 'X-App-Token': token }, cache: 'no-store' }).then(async (res) => {
      const ct = res.headers.get('Content-Type') || ''
      if (!res.ok || !ct.startsWith('image/')) {
        const message = downloadError(await res.text(), ct)
        throw new Error(message || `票据读取失败（HTTP ${res.status}）`)
      }
      return URL.createObjectURL(await res.blob())
    }).then(resolve, reject)
    // #endif
    // #ifndef H5
    uni.downloadFile({ url: API_BASE + path, header: { 'X-App-Token': token },
      success: async (res) => {
        try {
          if (res.statusCode !== 200) throw new Error(`票据读取失败（HTTP ${res.statusCode}）`)
          const text = await readSmallText(res.tempFilePath)
          const error = downloadError(text)
          if (error) throw new Error(error)
          resolve(res.tempFilePath)
        } catch (error) { reject(error) }
      }, fail: () => reject(new Error('网络连接失败，请重试')) })
    // #endif
  })
}

export async function loadArrivalImages(appId, refs) {
  const urls = []
  try {
    for (const ref of refs || []) urls.push(await downloadImage(arrivalTicketPath(appId, ref)))
    return urls
  } catch (e) { releaseArrivalImages(urls); throw e }
}
