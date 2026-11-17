import test from 'node:test'
import assert from 'node:assert/strict'
import { citySuggestions } from '../pages/jobs/job-city-search.js'
import { panelLayout, filterFromQuery } from '../pages/jobs/job-filters.js'

const directory = [
  { name: '大理', pinyin: 'dali', searchAliases: 'dl,大理市', cityName: '大理', level: 'destination' },
  { name: '丽江', pinyin: 'lijiang', searchAliases: 'lj', cityName: '丽江', level: 'city' },
  { name: '思明区', pinyin: 'simingqu', searchAliases: 'smq', cityName: '厦门', parentName: '厦门市', level: 'district' },
  { name: '平潭', pinyin: 'pingtan', searchAliases: 'pt,平潭岛', cityName: '平潭', level: 'destination' }
]
test('城市联想支持文字、拼音、缩写和别名，区县映射到业务城市', () => {
  for (const query of ['大理', 'DALI', ' dl ']) assert.equal(citySuggestions(directory, [], query)[0].city, '大理')
  assert.equal(citySuggestions(directory, [], '平潭岛')[0].city, '平潭')
  assert.equal(citySuggestions(directory, [], '思明')[0].city, '厦门')
  assert.deepEqual(citySuggestions(directory, [], '不认识的城市'), [])
  assert.deepEqual(citySuggestions(directory, [], ''), [])
})
test('有岗位城市优先，同名不重复，景区匹配到所属城市', () => {
  const rows = citySuggestions(directory, [{ name: '大理', count: 3 }], '大理')
  assert.equal(rows[0].name, '大理')
  assert.equal(rows.filter(r => r.name === '大理').length, 1)
  assert.equal(rows.find(r => r.name === '大理古城').city, '大理')
  assert.ok(rows.find(r => r.name === '大理古城').scenic)
  assert.equal(citySuggestions(directory, [], '大理', 1).length, 1)
})
test('面板始终避开顶部胶囊和底部安全区，城市标签多少不影响按钮位置', () => {
  for (const windowHeight of [568, 640, 844]) {
    const layout = panelLayout({ windowHeight, navBottom: 88, chipsTop: 350, chipsBottom: 390, safeBottom: 34 })
    assert.ok(layout.top >= 88)
    assert.ok(layout.bottom <= windowHeight - 34 - 12)
    assert.equal(layout.top, 96)
  }
})

test('新的多城市选择覆盖来源页单城市；明确重置不能带回定位城市', () => {
  assert.deepEqual(filterFromQuery({ city: '伊犁哈萨克自治州', cities: '大理,丽江' }).cities, ['大理', '丽江'])
  assert.deepEqual(filterFromQuery({ city: '伊犁哈萨克自治州', cities: '' }).cities, [])
  assert.deepEqual(filterFromQuery({}).cities, [])
  assert.deepEqual(filterFromQuery({ city: '平潭' }).cities, ['平潭'], '兼容显式单城市筛选链接')
  assert.deepEqual(filterFromQuery({ cities: '伊犁哈萨克自治州' }).cities, ['伊犁哈萨克自治州'], '用户仍然可以主动选择当前所在城市')
})
