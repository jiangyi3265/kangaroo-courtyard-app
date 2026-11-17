import { API_BASE } from './config.js'
import { getToken } from './request.js'
import { downloadError } from './upload.js'

// 聊天图片上限（KgChatImage.MAX）：2026-10-16 起 20MB（之前 5MB）
export const CHAT_IMAGE_MAX = 20 * 1024 * 1024
export function positiveId(value) {
  const id = String(value ?? '')
  if (!/^[1-9][0-9]{0,18}$/.test(id) || (id.length === 19 && id > '9223372036854775807')) throw new Error('消息编号不正确')
  return id
}
export function imagePath(convId, msgId) { return `/app/chat/${positiveId(convId)}/messages/${positiveId(msgId)}/image` }
export function binaryImage(buffer, contentType = '') {
  const bytes = new Uint8Array(buffer)
  if (!bytes.length || bytes.length > CHAT_IMAGE_MAX) throw new Error('图片大小不正确')
  const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b)
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : ''
  const header = String(contentType).split(';')[0].trim().toLowerCase()
  if (!mime || header !== mime) {
    let text = ''
    if (bytes.length <= 4096) {
      try { text = decodeURIComponent(Array.from(bytes, b => '%' + b.toString(16).padStart(2, '0')).join('')) } catch (_) {}
    }
    throw new Error(downloadError(text, contentType) || '服务器未返回可用图片')
  }
  return { bytes, mime, extension: png ? 'png' : 'jpg' }
}
export function mediaScope(read) {
  let epoch = 0
  let visible = false
  const capture = () => ({ epoch, visible, ...read() })
  const current = scope => { const now = read(); return !!scope?.visible && visible && scope.epoch === epoch
    && scope.token === now.token && !!now.token && !!now.accountId && String(scope.accountId) === String(now.accountId)
    && String(scope.convId) === String(now.convId) && scope.grants === now.grants }
  return { capture, current, show(){ visible = true; ++epoch }, invalidate(){ visible = false; ++epoch }, renew(){ ++epoch } }
}
export async function privateImage(convId, msgId, scope, isCurrent) {
  if (!isCurrent(scope) || scope.token !== getToken()) throw new Error('会话身份已变化')
  const path = imagePath(convId, msgId)
  const result = await new Promise((resolve, reject) => {
    uni.request({ url: API_BASE + path, method: 'GET', responseType: 'arraybuffer',
      header: { 'X-App-Token': scope.token },
      success: r => {
        try {
          const headers = r.header || {}
          const key = Object.keys(headers).find(k => k.toLowerCase() === 'content-type')
          const value = binaryImage(r.data, key ? headers[key] : '')
          if (r.statusCode !== 200) throw new Error(`图片读取失败（HTTP ${r.statusCode}）`)
          resolve(value)
        } catch (e) { reject(e) }
      }, fail: () => reject(new Error('图片加载失败，请检查网络后重试')) })
  })
  if (!isCurrent(scope) || scope.token !== getToken()) throw new Error('会话身份已变化')
  // H5 creates an unguessable local Blob only after checking current identity.
  // #ifdef H5
  const url = URL.createObjectURL(new Blob([result.bytes], { type: result.mime }))
  return { url, extension: result.extension, release: () => URL.revokeObjectURL(url) }
  // #endif
  // #ifndef H5
  const fs = uni.getFileSystemManager()
  const localRoot = typeof wx !== 'undefined' && wx.env?.USER_DATA_PATH || uni.env?.USER_DATA_PATH
  if(!localRoot)throw new Error('当前客户端不支持私有图片暂存')
  const filePath = localRoot + '/chat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '.' + result.extension
  await new Promise((resolve,reject) => fs.writeFile({filePath,data:result.bytes.buffer,success:resolve,fail:()=>reject(new Error('图片暂存失败'))}))
  const release = () => fs.unlink({filePath,fail:()=>{}})
  if (!isCurrent(scope) || scope.token !== getToken()) { release(); throw new Error('会话身份已变化') }
  return { url:filePath, extension: result.extension, release }
  // #endif
}
export function savePrivateImage(resource) {
  // #ifdef H5
  const link=document.createElement('a');link.href=resource.url;link.download='聊天图片.'+resource.extension;link.click();return Promise.resolve('download-started')
  // #endif
  // #ifndef H5
  return new Promise((resolve,reject) => uni.saveImageToPhotosAlbum({filePath:resource.url,success:()=>resolve('saved'),fail:()=>reject(new Error('保存失败，请允许相册权限后重试'))}))
  // #endif
}
export function sendPrivateImage(convId, filePath, clientMessageId, scope, isCurrent) {
  positiveId(convId)
  if (!/^[a-z0-9_-]{16,64}$/.test(clientMessageId) || !isCurrent(scope) || scope.token !== getToken()) return Promise.reject(new Error('会话身份已变化'))
  return new Promise((resolve,reject) => uni.uploadFile({url:API_BASE+`/app/chat/${convId}/images`,name:'file',filePath,timeout:300000,
    formData:{clientMessageId},header:{'X-App-Token':scope.token,'X-App-Upload-Version':'2'},
    success:r=>{if(r.statusCode!==200)return reject(new Error('图片发送结果无法确认，请重试'));let data;try{data=typeof r.data==='string'?JSON.parse(r.data):r.data;if(!data||typeof data!=='object')throw new Error('invalid')}catch(_){return reject(new Error('图片发送结果无法确认，请重试'))}
      if(data.code!==200){const error=new Error(data.msg||'图片发送失败');error.code=data.code;return reject(error)}
      if(!isCurrent(scope)||scope.token!==getToken())return reject(new Error('会话身份已变化'))
      resolve(data)},fail:()=>reject(new Error('图片发送结果无法确认，可点击重试'))}))
}
