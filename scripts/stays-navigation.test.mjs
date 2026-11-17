import test from 'node:test'
import assert from 'node:assert/strict'
import { stayMapUrl } from '../pages/stays/stays-navigation.js'

test('真实坐标按经度纬度顺序打开地图并正确编码门店名',()=>{
  const url=new URL(stayMapUrl({latitude:26.1,longitude:119.2,stayName:'小院 & 茶馆'}))
  assert.equal(url.pathname,'/marker');assert.equal(url.searchParams.get('position'),'119.2,26.1')
  assert.equal(url.searchParams.get('name'),'小院 & 茶馆')
  assert.equal(url.searchParams.get('coordinate'),'gaode');assert.equal(url.searchParams.get('callnative'),'1')
})
test('没有坐标使用完整地址搜索；无效坐标不产生假地图落点',()=>{
  for(const point of [{},{latitude:'',longitude:''},{latitude:0,longitude:0},{latitude:NaN,longitude:119},{latitude:91,longitude:119}]){
    const url=new URL(stayMapUrl({...point,city:'丽江',address:'大研街道文运东村41号'}))
    assert.equal(url.pathname,'/search');assert.equal(url.searchParams.get('keyword'),'丽江 大研街道文运东村41号')
  }
  const url=new URL(stayMapUrl({city:'丽江市',address:'丽江市古城区41号'}))
  assert.equal(url.searchParams.get('keyword'),'丽江市古城区41号')
  assert.equal(stayMapUrl({city:'丽江'}),'')
})
