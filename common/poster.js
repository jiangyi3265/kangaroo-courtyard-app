// 岗位分享海报：在本机离屏画布上绘制（不依赖模板里的 <canvas>），H5 直接下载，微信小程序存入相册。
//
// 暂不含小程序码：生成小程序码要调用微信服务端接口（需要 AppSecret），接入后再把二维码画进右下角。
// 海报上写明分享码，用户在小程序里打开岗位时带着分享码即可归因。

const W = 750
const H = 1060

function wrap(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = String(text || '').split('')
  let line = ''
  let lines = 0
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      lines++
      if (lines === maxLines) {
        ctx.fillText(line.slice(0, -1) + '…', x, y)
        return
      }
      ctx.fillText(line, x, y)
      line = chars[i]
      y += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, y)
}

function drawCover(ctx, img, dx, dy, dw, dh) {
  // aspectFill：按比例裁掉多出来的部分
  const iw = img.width || dw
  const ih = img.height || dh
  const scale = Math.max(dw / iw, dh / ih)
  const sw = dw / scale
  const sh = dh / scale
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, dx, dy, dw, dh)
}

// 颜色跟 styles/theme.scss 走（画布读不到 CSS 变量）：奶白底 --k-bg、标题 --k-ink、摘要 --k-muted、底部条 --k-red（暖棕）
function paint(ctx, img, { title, summary, code, kind }) {
  ctx.fillStyle = '#FCF9F3'
  ctx.fillRect(0, 0, W, H)
  if (img) drawCover(ctx, img, 0, 0, W, 560)
  ctx.fillStyle = '#3A322B'
  ctx.font = 'bold 44px sans-serif'
  wrap(ctx, title, 48, 650, W - 96, 58, 2)
  ctx.fillStyle = '#6F6A65'
  ctx.font = '28px sans-serif'
  wrap(ctx, summary, 48, 790, W - 96, 40, 2)
  ctx.fillStyle = '#9A6B3F'
  ctx.fillRect(48, 890, W - 96, 116)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText('微信搜索「袋鼠全球青年」小程序报名', 80, 940)
  ctx.font = '26px sans-serif'
  // 员工分享带分享码用于归因；用户自己分享的海报没有分享码，只写岗位编号
  ctx.fillText(code ? '分享码 ' + code : kind === 'activity' ? '在活动页搜索活动名称，查看详情并报名' : '在小程序里搜索岗位名称即可报名', 80, 984)
}

/** 生成并保存海报。成功 resolve，失败 reject（Error.message 可直接提示给用户） */
export async function savePosterImage(opts) {
  // #ifdef H5
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = await new Promise((resolve) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = () => resolve(null)
    i.src = opts.cover
  })
  paint(ctx, img, opts)
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = (opts.kind === 'activity' ? 'kangaroo-activity-' : 'kangaroo-job-') + (opts.code || 'poster') + '.png'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  return true
  // #endif
  // #ifdef MP-WEIXIN
  const canvas = wx.createOffscreenCanvas({ type: '2d', width: W, height: H })
  const ctx = canvas.getContext('2d')
  const img = await new Promise((resolve) => {
    const i = canvas.createImage()
    i.onload = () => resolve(i)
    i.onerror = () => resolve(null)
    i.src = opts.cover
  })
  paint(ctx, img, opts)
  const filePath = await new Promise((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas,
      fileType: 'png',
      success: (r) => resolve(r.tempFilePath),
      fail: () => {
        // 老基础库不支持离屏画布导出：退回 dataURL 写临时文件
        try {
          const base64 = canvas.toDataURL('image/png').replace(/^data:image\/\w+;base64,/, '')
          const path = `${wx.env.USER_DATA_PATH}/poster-${Date.now()}.png`
          wx.getFileSystemManager().writeFileSync(path, base64, 'base64')
          resolve(path)
        } catch (e) {
          reject(new Error('当前微信版本不支持生成海报，请升级微信后重试'))
        }
      }
    })
  })
  await new Promise((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: (e) => reject(new Error(/auth|deny/i.test((e && e.errMsg) || '') ? '请在设置里允许保存到相册' : '保存失败，请重试'))
    })
  })
  return true
  // #endif
  // eslint-disable-next-line no-unreachable
  throw new Error('当前平台暂不支持生成海报')
}
