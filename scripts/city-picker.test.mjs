import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
const moduleUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64')
const directoryModule = moduleUrl(await readFile(new URL('../common/city-directory.js', import.meta.url), 'utf8'))
const modelSource = (await readFile(new URL('../common/city-picker-model.js', import.meta.url), 'utf8')).replace("'./city-directory.js'", JSON.stringify(directoryModule))
const { pickerEntries, searchPickerEntries, toggleCitySelection } = await import(moduleUrl(modelSource))
const directory = { all: [
  { name: '平潭', fullName: '平潭县', level: 'destination', pinyin: 'pingtan', searchAliases: 'pt,平潭岛' },
  { name: '鼓楼区·福州', fullName: '鼓楼区', level: 'district', pinyin: 'gulouqu', parentName: '福州市' },
  { name: '大理', fullName: '大理市', level: 'destination', pinyin: 'dali', searchAliases: 'dl' }
] }
test('scoped cities retain exact business value and counts, support pinyin, never expose other cities', () => {
  const rows = pickerEntries(directory, [{ name: '平潭县', note: '2 家线上房源' }, '海岛营地', '平潭县'])
  assert.equal(rows.length, 2)
  assert.equal(searchPickerEntries(rows, 'PT', true)[0].name, '平潭县')
  assert.equal(rows[0].note, '2 家线上房源')
  assert.deepEqual(searchPickerEntries(rows, '大理', true), [])
  assert.deepEqual(pickerEntries(directory, []), [])
})
test('scoped district remains visible without a keyword, nationwide district remains searchable', () => {
  const rows = pickerEntries(directory, ['鼓楼区·福州'])
  assert.equal(searchPickerEntries(rows, '', true).length, 1)
  assert.equal(searchPickerEntries(directory.all, '').length, 2)
  assert.equal(searchPickerEntries(directory.all, '福州')[0].name, '鼓楼区·福州')
})
test('multi-select preserves draft isolation, toggles and enforces the caller limit', () => {
  const original = ['大理', '平潭']
  assert.equal(toggleCitySelection(original, '厦门', 2).limited, true)
  assert.deepEqual(toggleCitySelection(original, '大理', 2).selected, ['平潭'])
  assert.deepEqual(toggleCitySelection(original, '厦门', 0).selected, ['大理', '平潭', '厦门'])
  assert.deepEqual(original, ['大理', '平潭'])
})
test('selection return, cancel, duplicate taps and failed navigation settle without changing the caller', async () => {
  const picker = await import(moduleUrl(await readFile(new URL('../common/city-picker.js', import.meta.url), 'utf8')))
  let navigation, notices = 0
  globalThis.uni = { navigateTo: o => { navigation = o }, showToast: () => notices++ }
  const initial = ['大理']
  const pending = picker.selectCities({ selected: initial })
  const id = navigation.url.split('request=')[1]
  picker.cityPickerRequest(id).selected.push('平潭')
  assert.deepEqual(initial, ['大理'])
  assert.equal(await picker.selectCity(), null)
  picker.finishCityPicker(id, null)
  assert.equal(await pending, null)
  const all = picker.selectCity({ allowAll: true })
  picker.finishCityPicker(navigation.url.split('request=')[1], [''])
  assert.equal(await all, '')
  const failed = picker.selectCity()
  navigation.fail()
  assert.equal(await failed, null)
  assert.equal(notices, 1)
  const chosen = picker.selectCity()
  picker.finishCityPicker(navigation.url.split('request=')[1], ['平潭'])
  assert.equal(await chosen, '平潭')
})
test('choosing a district keeps its business city so lists are not empty', async () => {
  const { businessCityName } = await import(directoryModule)
  const rows = [
    { name: '思明区', level: 'district', parentName: '厦门市', cityName: '厦门' },
    { name: '平潭', level: 'destination', cityName: '平潭' },
    { name: '大理', level: 'destination' }
  ]
  assert.equal(businessCityName(rows, '思明区'), '厦门')
  assert.equal(businessCityName(rows, '平潭'), '平潭')
  // 旧服务端没有 cityName、或名字不在字典里：原样返回，不猜
  assert.equal(businessCityName(rows, '大理'), '大理')
  assert.equal(businessCityName(rows, '海岛营地'), '海岛营地')
  assert.equal(businessCityName(undefined, '厦门'), '厦门')
})
