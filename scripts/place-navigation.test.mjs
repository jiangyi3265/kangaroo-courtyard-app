import test from 'node:test'
import assert from 'node:assert/strict'
import { openNativePlace, placeMapUrl } from '../common/place-navigation.js'

function harness() {
  const log={opened:[],choices:[],copied:[],notices:[],modals:[]}
  return {log,api:{openLocation:o=>log.opened.push(o),chooseLocation:o=>log.choices.push(o),getLocation:()=>{throw new Error('不得读取游客位置')},showModal:o=>log.modals.push(o),setClipboardData:o=>log.copied.push(o)},notify:s=>log.notices.push(s)}
}
test('已有坐标直接打开地图，游客无需登录或访问位置权限',()=>{
  const h=harness();openNativePlace({latitude:26.1,longitude:119.2,stayName:'小院',address:'门牌1号'},h.api,h.notify)
  assert.equal(h.log.opened.length,1);assert.equal(h.log.choices.length,0);assert.equal(h.log.copied.length,0)
  assert.equal(h.log.opened[0].latitude,26.1)
})
test('没有门店坐标不打开当前位置；明确提示后可取消，不修改资料',()=>{
  const h=harness(),place={city:'丽江',address:'门牌1号',latitude:null,longitude:null}
  openNativePlace(place,h.api,h.notify)
  assert.equal(h.log.choices.length,0);assert.equal(h.log.opened.length,0);assert.equal(h.log.copied.length,0)
  assert.match(h.log.modals[0].content,/丽江 门牌1号/)
  h.log.modals[0].success({confirm:false});assert.equal(h.log.copied.length,0)
  assert.equal(place.latitude,null)
})
test('确认后复制完整门店地址；复制成功或失败均不误开选点地图',()=>{
  const h=harness();openNativePlace({city:'丽江',address:'门牌1号'},h.api,h.notify)
  h.log.modals[0].success({confirm:true});assert.equal(h.log.copied[0].data,'丽江 门牌1号')
  h.log.copied[0].success();assert.match(h.log.notices.at(-1),/地址已复制/)
  h.log.copied[0].fail({});assert.match(h.log.notices.at(-1),/复制失败/)
  assert.equal(h.log.choices.length,0);assert.equal(h.log.opened.length,0)
})
test('无地址无坐标仅提示待补充；特殊字符地址正确编码',()=>{
  const h=harness();openNativePlace({},h.api,h.notify);assert.equal(h.log.choices.length,0);assert.match(h.log.notices[0],/待补充/)
  const url=new URL(placeMapUrl({city:'丽江',address:'A&B小院 #1'}));assert.equal(url.searchParams.get('keyword'),'丽江 A&B小院 #1')
})
