import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
const source=await readFile(new URL('../common/city-directory.js',import.meta.url),'utf8')
const {filterCities,groupCities,confirmedLocation}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
// Read the same nationwide seed shipped with the server. Quoted alias lists contain commas.
const seed = await readFile(new URL('../../RuoYi-Vue/sql/kangaroo/V25__national_cities.sql', import.meta.url), 'utf8')
const manifest = JSON.parse(await readFile(new URL('../../RuoYi-Vue/ruoyi-kangaroo/src/main/resources/geo/source.json', import.meta.url), 'utf8'))
const rows = []
const cityInsert = /^insert into kg_city \(([^)]+)\) values \((.+?)\) on duplicate key update/gm
for (const [, columns, tuple] of seed.matchAll(cityInsert)) {
  const fields = columns.split(',').map(name => name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()))
  const values = tuple.match(/'(?:''|[^'])*'|[^,]+/g)
  assert.equal(values.length, fields.length, 'V25 city columns and values must match')
  const row = {}
  for (const [i, field] of fields.entries()) {
    row[field] = values[i].replace(/^'|'$/g, '').replaceAll("''", "'")
  }
  rows.push(row)
}
assert.equal(rows.length, manifest.catalog_entries, 'all nationwide seed rows are present')
const directory={all:rows}
test('nationwide catalog includes Fujian cities and Pingtan without rendering thousands of counties at once',()=>{
  const list=filterCities(directory)
  assert.ok(list.length>300 && list.length<500)
  for(const name of ['福州','平潭','厦门','泉州','宁德','龙岩','三明','莆田','南平','漳州']) assert.ok(list.some(c=>c.name===name),name)
})
test('Chinese, full name, island alias, pinyin and initials find Pingtan',()=>{
  for(const q of ['平潭','平潭县','平潭岛','平潭综合实验区','pingtan',' PT ']) assert.ok(filterCities(directory,q).some(c=>c.name==='平潭'),q)
  assert.ok(filterCities(directory,'福建').length>90)
})
test('same-name counties remain separate and searchable by parent',()=>{
  const list=filterCities(directory,'鼓楼区')
  assert.ok(list.length>1)
  assert.equal(new Set(list.map(c=>c.name)).size,list.length)
  assert.ok(list.some(c=>c.parentName==='福州市'))
})
test('group indexes contain missing old letters B and P and no empty groups',()=>{
  const letters=groupCities(filterCities(directory)).map(g=>g.letter)
  assert.ok(letters.includes('B')&&letters.includes('P'))
  assert.deepEqual(groupCities(filterCities(directory,'不存在的城市xyz')),[])
})
test('legacy nearest-city and uncertain results are never presented as current location',()=>{
  assert.equal(confirmedLocation({found:true,name:'泉州',distanceKm:132}),false)
  assert.equal(confirmedLocation({found:false,name:'泉州',source:'administrative_boundary'}),false)
  assert.equal(confirmedLocation({found:true,name:'平潭',source:'administrative_boundary'}),true)
})
