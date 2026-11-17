// 定位到所在城市（服务端按行政区边界判定）。切换城市屏（pages/home/city.vue）和首页首次打开的自动定位共用。
// 成功回接口给的城市（name / label…）；拒绝授权、定位失败、判不出城市都回 null，不抛错。
// 和到店距离核验共用已声明的 getLocation：微信禁止同时声明模糊定位与精确定位
import { apiLocateCity } from './api.js'
import { confirmedLocation } from './city-directory.js'

export function locateCity({ onFailure = () => {} } = {}) {
  let type = 'wgs84'
  // #ifdef MP-WEIXIN
  type = 'gcj02'
  // #endif
  return new Promise((resolve) => {
    let finished = false
    const finish = (value, message) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      if (message) onFailure(message)
      resolve(value)
    }
    const timeout = setTimeout(() => finish(null, '定位超时，请到开阔处重试，或手动选择城市'), 15000)
    uni.getLocation({
      type, isHighAccuracy: true, highAccuracyExpireTime: 6000,
      success: (r) => apiLocateCity(r.latitude, r.longitude, r.accuracy, type)
        .then((res) => confirmedLocation(res?.data) ? finish(res.data) : finish(null, '当前位置精度不足或靠近城市边界，请重试或手动选择'), () => finish(null, '城市定位服务暂时不可用，请稍后重试')),
      fail: (error) => finish(null, /auth|deny|denied|permission/i.test(error?.errMsg || '')
        ? '请在微信与手机设置中允许定位，然后重试'
        : '未能获取GPS位置，请开启手机定位后重试')
    })
  })
}
