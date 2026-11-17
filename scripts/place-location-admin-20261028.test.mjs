import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePickedPoint, pointPreviewUrl } from '../../RuoYi-Vue3/src/components/PlaceLocationInput/point.js'
import { openNativePlace } from '../common/place-navigation.js'
test('后台粘贴选点结果到小程序打开位置，坐标不颠倒、地址不丢失',()=>{
  const point=parsePickedPoint(' 102.123456，25.123456 ')
  assert.deepEqual(point,{longitude:102.123456,latitude:25.123456})
  const opened=[]
  openNativePlace({...point,stayName:'定位测试小院',address:'门牌1号'}, {openLocation:p=>opened.push(p)},()=>{})
  assert.equal(opened[0].longitude,point.longitude);assert.equal(opened[0].latitude,point.latitude)
  assert.equal(opened[0].name,'定位测试小院');assert.equal(opened[0].address,'门牌1号')
  const url=new URL(pointPreviewUrl(point,'小院 & 茶'))
  assert.equal(url.searchParams.get('position'),'102.123456,25.123456');assert.equal(url.searchParams.get('name'),'小院 & 茶')
})
test('错误粘贴、越界、0,0和颠倒的中国坐标被拒绝，不猜测真实店址',()=>{
  for(const value of ['', '文本地址41号', '25.1,102.2', '181,25', '102,91', '0,0', '102,25,3', 'NaN,25', 'https://example.com/102,25']) assert.equal(parsePickedPoint(value),null,value)
})
test('超过6位的小数按地图精度规范保存，不超出后台字段长度',()=>{
  assert.deepEqual(parsePickedPoint('102.1234567890123,25.1234567890123'),{longitude:102.123457,latitude:25.123457})
})
