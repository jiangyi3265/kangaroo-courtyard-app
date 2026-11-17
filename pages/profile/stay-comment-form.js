// 写小院评论（2026-10-31，V65）的校验和选图。放在 pages/profile 分包，不进 common。
// 规则和后端 KgStayCommentService 一致：文字必填 1–500 字；图片最多 9 张或 1 段视频，二选一，都是选填；带图或视频要确认不侵犯他人肖像。

export const TEXT_MAX = 500
export const PIC_MAX = 9

/** 能不能提交：能提交返回 ''，不能提交返回写给用户的原因 */
export function commentProblem({ text, pics, video, portrait, uploading }) {
  const body = String(text || '').trim()
  if (uploading) return '图片或视频还在上传，请稍等'
  if (!body) return '先写点什么吧'
  if (body.length > TEXT_MAX) return `评论不能超过 ${TEXT_MAX} 字`
  const n = (pics || []).length
  if (n > PIC_MAX) return `最多 ${PIC_MAX} 张照片`
  if (n && video) return '照片和视频只能选一种'
  if ((n || video) && !portrait) return '带图片或视频，要先勾选不侵犯他人肖像'
  return ''
}

/** 提交给 POST /app/stay/{stayId}/comments 的内容 */
export function commentPayload({ text, pics, video, portrait }) {
  const body = { content: String(text || '').trim() }
  if ((pics || []).length) body.images = pics.map((p) => p.url)
  if (video) body.videos = [{ url: video.url, cover: video.cover || '' }]
  if ((pics || []).length || video) body.portraitConfirmed = !!portrait
  return body
}

/** 选图失败写给用户的话。common/upload.js 的 chooseImages 失败时什么都不说，真机上就是「点了没反应」（主人说的「没办法上传」可能就是这个），这里单独处理 */
export function pickFailText(errMsg) {
  const m = String(errMsg || '')
  if (/privacy|scope is not declared/i.test(m)) return '需要先同意隐私保护指引才能选照片，请重新打开小程序后再试'
  if (/auth|deny|denied|permission/i.test(m)) return '没有相册或相机权限，请点右上角「···」→「设置」打开后再试'
  return '没能打开相册，请重试'
}

/** 选照片：返回临时路径数组；用户取消返回 []；打不开相册抛出带原因的 Error */
export const pickImages = (n) => new Promise((resolve, reject) => {
  uni.chooseImage({
    count: Math.max(1, Math.min(PIC_MAX, n || 1)),
    sizeType: ['compressed'],
    success: (r) => resolve(r.tempFilePaths || []),
    fail: (e) => (/cancel/i.test(String(e && e.errMsg)) ? resolve([]) : reject(new Error(pickFailText(e && e.errMsg))))
  })
})
