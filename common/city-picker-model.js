import { cityEntries, filterCities } from './city-directory.js'

export function pickerEntries(directory, items) {
  const all = cityEntries(directory)
  if (items === undefined) return all
  const byName = new Map(all.map(item => [item.name, item]))
  for (const item of all) if (item.fullName && !byName.has(item.fullName)) byName.set(item.fullName, item)
  const seen = new Set()
  return items.map(item => typeof item === 'string' ? { name: item } : item)
    .filter(item => item?.name && !seen.has(item.name) && seen.add(item.name))
    .map(item => ({ ...byName.get(item.name), ...item, name: item.name }))
}

export function searchPickerEntries(rows, keyword, scoped = false) {
  // In scoped pickers every available city must remain visible, including county-level destinations.
  return !keyword.trim() && scoped ? rows : filterCities({ all: rows }, keyword)
}

export function toggleCitySelection(selected, name, max = 5) {
  if (selected.includes(name)) return { selected: selected.filter(city => city !== name), limited: false }
  if (max > 0 && selected.length >= max) return { selected: [...selected], limited: true }
  return { selected: [...selected, name], limited: false }
}
