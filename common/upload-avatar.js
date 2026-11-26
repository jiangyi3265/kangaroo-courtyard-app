import { chooseDoc, chooseImage, uploadTo } from './upload.js'

export function pickAvatarImage() {
  // #ifdef MP-WEIXIN
  if (typeof wx !== 'undefined' && typeof wx.chooseMedia === 'function') {
    return new Promise((resolve, reject) => wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album'], sizeType: ['compressed'],
      success: result => resolve(result.tempFiles?.[0]?.tempFilePath || null),
      fail: error => /cancel/i.test(error.errMsg || '') ? resolve(null) : reject(new Error('无法打开相册，请检查照片权限后重试'))
    }))
  }
  return chooseDoc('album')
  // #endif
  // #ifndef MP-WEIXIN
  return chooseImage()
  // #endif
}

export function avatarPickerError(event) {
  return /cancel/i.test(event?.detail?.errMsg || '') ? '' : '微信没有返回头像，可以重试或从相册选择'
}

/** 微信头像可能是没有图片扩展名的临时文件，按解码器识别的格式命名上传副本。 */
export async function uploadAvatar(path, isCurrent) {
  // #ifdef MP-WEIXIN
  if (!/\.(?:jpe?g|png|webp|gif)$/i.test(path)) {
    const info = await new Promise((resolve, reject) => wx.getImageInfo({
      src: path, success: resolve, fail: () => reject(new Error('读取头像失败，请重新选择'))
    }))
    if (!/^(?:jpe?g|png|webp|gif)$/i.test(info.type)) throw new Error('请选择 JPG、PNG、GIF 或 WebP 图片')
    const fs = wx.getFileSystemManager()
    const copy = wx.env.USER_DATA_PATH + '/avatar-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + info.type.toLowerCase()
    await new Promise((resolve, reject) => fs.copyFile({
      srcPath: path, destPath: copy, success: resolve, fail: () => reject(new Error('头像暂存失败，请重试'))
    }))
    try {
      if (!isCurrent()) throw new Error('账号已切换，请重新选择头像')
      return await uploadTo('/app/upload/image', copy)
    } finally {
      fs.unlink({filePath:copy, fail() {}})
    }
  }
  // #endif
  return uploadTo('/app/upload/image', path)
}
