export const PHOTO_MAX_BYTES = 20 * 1024 * 1024
export function pickedPhotos(result) {
  const files = result.tempFiles || []
  const paths = result.tempFilePaths?.length ? result.tempFilePaths : files.map(f => f.path || f.tempFilePath)
  return paths.filter(Boolean).map((path, i) => ({ path, size: Number(files[i]?.size) || 0 }))
}
export function chooseWishPhotos(count) {
  return new Promise((resolve, reject) => uni.chooseImage({
    count, sizeType: ['compressed'],
    success: r => resolve(pickedPhotos(r)),
    fail: e => /cancel/i.test(e.errMsg || '') ? resolve([]) : reject(new Error('无法打开照片，请检查微信的照片权限后重试'))
  }))
}
export function uploadedPhoto(result) {
  const url = result?.data?.url
  if (typeof url !== 'string' || !url.startsWith('/profile/')) throw new Error('未收到有效的图片地址，请重新上传')
  return url
}
