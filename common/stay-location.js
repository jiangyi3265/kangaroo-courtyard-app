import { alert, confirm, prompt } from './ui.js'

export function coordinates(value = {}) {
  if (value.latitude == null || value.longitude == null || String(value.latitude).trim() === '' || String(value.longitude).trim() === '') return null
  const latitude = Number(value.latitude), longitude = Number(value.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null
  return { latitude, longitude }
}

// Only opens after a staff member taps the location control. Never requests location on page load.
export async function chooseStayLocation(current = {}) {
  // #ifdef H5
  const latitude = await prompt('房源纬度', { value: current.latitude == null ? '' : String(current.latitude), placeholder: '腾讯地图坐标，范围 -90 到 90' })
  if (latitude === null) return null
  const longitude = await prompt('房源经度', { value: current.longitude == null ? '' : String(current.longitude), placeholder: '腾讯地图坐标，范围 -180 到 180' })
  if (longitude === null) return null
  const point = coordinates({ latitude, longitude })
  if (!point) { await alert('坐标无效', '请填写完整、有效的经纬度，或在微信小程序中使用地图选点。'); return null }
  return { ...point, address: current.address || '' }
  // #endif
  // #ifndef H5
  try {
    const result = await new Promise((resolve, reject) => uni.chooseLocation({ ...(coordinates(current) || {}), success: resolve, fail: reject }))
    const point = coordinates(result)
    if (!point) { await alert('未选到有效位置', '请重新在地图上确认房源位置。'); return null }
    let address = String(result.address || '').trim()
    const name = String(result.name || '').trim()
    if (name && !address.includes(name)) address += name
    return { ...point, address: address || current.address || '' }
  } catch (error) {
    const message = String(error?.errMsg || '')
    if (/cancel/i.test(message)) return null
    if (/auth deny|auth denied|authorize|permission/i.test(message)) {
      if (await confirm('需要位置授权', '请在设置中允许位置权限，然后重新点击地图选点。')) uni.openSetting({ fail: () => {} })
    } else {
      await alert('地图暂时无法打开', '请稍后重试；也可联系平台在房源管理中补充地图坐标。')
    }
    return null
  }
  // #endif
}
