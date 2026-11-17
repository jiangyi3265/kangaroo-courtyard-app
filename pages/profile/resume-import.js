// 返回路径与原始文件名；微信和 H5 都只导入文档，扫描图片提示手动填写。
export const chooseResumeDocument = () => new Promise((resolve, reject) => {
  const success = r => resolve(r.tempFiles?.[0]?.path || r.tempFilePaths?.[0] || null)
  const fail = e => /cancel/i.test(e?.errMsg || '') ? resolve(null) : reject(new Error('无法选择简历，请重试'))
  // #ifdef MP-WEIXIN
  wx.chooseMessageFile({count:1,type:'file',extension:['pdf','docx','txt'],success,fail})
  // #endif
  // #ifdef H5
  uni.chooseFile({count:1,extension:['.pdf','.docx','.txt'],success,fail})
  // #endif
})
