// 取消选图保持原草稿；权限/设备异常须说明原因，不能当成选了零张图静默结束。
export function chooseCommentImages(remaining, picker = options => uni.chooseImage(options)) {
  return new Promise((resolve, reject) => {
    const fail = error => {
      const message = String(error?.errMsg || error?.message || '')
      if (/cancel/i.test(message)) return resolve([])
      reject(new Error('无法打开相册，请检查微信的照片权限后重试'))
    }
    try {
      picker({
        count: Math.max(1, Math.min(3, Number(remaining) || 1)),
        sizeType: ['compressed'],
        success: result => resolve(Array.isArray(result?.tempFilePaths) ? result.tempFilePaths : []),
        fail
      })
    } catch (error) { fail(error) }
  })
}
