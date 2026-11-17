import { filterCities } from '../../common/city-directory.js'
import { scenicSuggest } from './job-filters.js'

// Both search entrances use the same city/county/alias mapping. A district or
// scenic area selects its business city, never an unsupported free-text filter.
export function citySuggestions(directory, jobCities, keyword, limit = 40) {
  const query = String(keyword || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!query) return []
  const counts = new Map((jobCities || []).map(c => [c.name, c.count]))
  const seen = new Set(), rows = []
  const add = row => {
    if (!row.name || seen.has(row.name)) return
    seen.add(row.name)
    rows.push(row)
  }
  for (const city of jobCities || []) {
    if (city.name.toLowerCase().includes(query)) add({ name: city.name, label: city.name.split('·')[0], city: city.name, count: city.count, region: '' })
  }
  for (const row of filterCities({ all: directory || [] }, query)) {
    const city = row.cityName || row.name
    add({ name: row.name, label: row.name.split('·')[0], city, pick: city, count: counts.get(city) || 0, district: row.level === 'district',
      region: [row.province, row.parentName !== row.province ? row.parentName : ''].filter(Boolean).join(' · ') })
  }
  for (const area of scenicSuggest(query)) {
    add({ name: area.name, label: area.name, city: area.city, pick: area.city, region: '按所属城市「' + area.city + '」筛选', count: 0, district: true, scenic: true })
  }
  const rank = row => (row.count > 0 ? 0 : 100) + (row.name === query ? -10 : row.name.startsWith(query) ? 0 : row.name.includes(query) ? 10 : 20) + (row.district ? 1 : 0)
  return rows.map((row, index) => ({ row, index, rank: rank(row) })).sort((a, b) => a.rank - b.rank || a.index - b.index).slice(0, limit).map(x => x.row)
}
