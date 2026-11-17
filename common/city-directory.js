const normalized = value => String(value || '').trim().toLowerCase().replace(/\s+/g, '')

export function cityEntries(directory) {
  if (directory.all?.length) return directory.all
  return (directory.groups || []).flatMap(group => group.items.map(name => ({ name, initial: group.letter })))
}

export function filterCities(directory, keyword = '') {
  const query = normalized(keyword)
  return cityEntries(directory).filter(city => {
    if (!query) return city.level !== 'district'
    return [city.name, city.fullName, city.province, city.parentName, city.pinyin, city.initial, city.searchAliases]
      .some(value => normalized(value).includes(query))
  })
}

export function groupCities(rows) {
  const groups = new Map()
  for (const row of rows) {
    const letter = /^[A-Z]$/.test(row.initial || '') ? row.initial : '#'
    if (!groups.has(letter)) groups.set(letter, [])
    groups.get(letter).push(row)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([letter, items]) => ({ letter, items }))
}

// 区县行带着后端算好的业务城市名（思明区 → 厦门）。门店、房源、活动、岗位存的是城市名，
// 选中区县时要保存所属城市，否则这些列表全部为空。旧服务端没有 cityName 时原样返回。
export function businessCityName(rows, name) {
  const row = (rows || []).find(item => item.name === name)
  return row?.cityName || name
}

// Older servers returned the nearest city up to 150 km away. Never label that as current location.
export const confirmedLocation = result => !!(result?.found && result.source === 'administrative_boundary' && result.name)
