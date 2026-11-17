// A temporary selection belongs to its opener. Back/cancel never changes that page's fields.
const requests = new Map()
let nextId = 0
let activeId = null

export function cityPickerRequest(id) { return requests.get(id)?.options || null }

export function finishCityPicker(id, result = null) {
  const request = requests.get(id)
  if (!request) return
  requests.delete(id)
  if (activeId === id) activeId = null
  request.resolve(result)
}

function openPicker(options) {
  if (activeId) return Promise.resolve(null)
  return new Promise(resolve => {
    const id = String(++nextId)
    activeId = id
    requests.set(id, { options: { ...options, selected: [...(options.selected || [])] }, resolve })
    uni.navigateTo({
      url: '/pages/home/city-picker?request=' + id,
      fail: () => {
        finishCityPicker(id)
        uni.showToast({ title: '城市选择未打开，请返回上一页后重试', icon: 'none' })
      }
    })
  })
}

/** options.items, when supplied (even []), restricts selection to this business's available cities. */
export async function selectCity(options = {}) {
  const result = await openPicker({ ...options, multiple: false, selected: options.value ? [options.value] : [] })
  return result === null ? null : result[0]
}

export const selectCities = (options = {}) => openPicker({ max: 5, ...options, multiple: true })
