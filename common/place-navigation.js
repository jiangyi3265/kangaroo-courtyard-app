// 门店坐标为 GCJ-02。浏览位置只使用门店坐标，不能用选点地图的当前位置冒充目的地。
export function placePoint(place = {}) {
  const { latitude, longitude } = place
  if (latitude == null || longitude == null || String(latitude).trim() === '' || String(longitude).trim() === '') return null
  const lat = Number(latitude), lng = Number(longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)
    ? { latitude: lat, longitude: lng } : null
}

export function placeAddress(place = {}) {
  const address = String(place.address || place.areaDesc || '').trim()
  const city = String(place.city || '').trim()
  return address && city && !address.includes(city.replace(/市$/, '')) ? `${city} ${address}` : address
}

export function placeMapUrl(place = {}) {
  const point = placePoint(place), address = placeAddress(place)
  const name = String(place.stayName || place.storeName || place.title || address).trim()
  if (point) return `https://uri.amap.com/marker?position=${point.longitude},${point.latitude}&name=${encodeURIComponent(name)}&coordinate=gaode&src=daishu&callnative=1`
  if (!address) return ''
  return `https://uri.amap.com/search?keyword=${encodeURIComponent(address)}&city=${encodeURIComponent(String(place.city || '').trim())}&view=map&src=daishu&callnative=1`
}

export function openNativePlace(place, api, notify) {
  const address = placeAddress(place), point = placePoint(place)
  const fail = error => {
    if (!/cancel/i.test(String(error?.errMsg || ''))) notify('地图暂时无法打开，请稍后重试')
  }
  const open = (position, name, targetAddress) => api.openLocation({ ...position, name, address: targetAddress, scale: 16, fail })
  if (point) return open(point, place.stayName || place.storeName || place.title || address, address)
  if (!address) return notify('门店位置待补充')
  // chooseLocation 是编辑位置，不是按地址导航；未传坐标会落到用户当前位置。
  api.showModal({ title: '门店定位待完善',
    content: '门店尚未设置地图定位，暂不能直接导航。可复制以下地址到地图中搜索：\n' + address,
    confirmText: '复制地址', cancelText: '知道了',
    success: result => {
      if (!result.confirm) return
      api.setClipboardData({ data: address, showToast: false,
        success: () => notify('地址已复制，可在地图中搜索'),
        fail: () => notify('复制失败，请长按页面地址复制')
      })
    }
  })
}
