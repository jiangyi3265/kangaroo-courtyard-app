import test from 'node:test'
import assert from 'node:assert/strict'
import { rememberDestination, recentDestination } from '../common/camp-history.js'
import { isAssistedStay } from '../pages/stays/booking-channel.js'
test('browse history remains scoped to guest or account and latest visit wins', () => {
  const store=new Map()
  globalThis.uni={setStorageSync:(k,v)=>store.set(k,v),getStorageSync:k=>store.get(k)}
  rememberDestination(null,'成都',1000)
  rememberDestination(7,'大理',2000)
  rememberDestination(7,'杭州',3000)
  rememberDestination(7,'全部城市',4000)
  assert.deepEqual(recentDestination(7),{city:'杭州',at:3000})
  assert.deepEqual(recentDestination(null),{city:'成都',at:1000})
  assert.deepEqual(recentDestination(8),{city:'',at:0})
})
test('storage failure does not break page browsing', () => {
  globalThis.uni={setStorageSync(){throw Error('full')},getStorageSync(){throw Error('denied')}}
  assert.doesNotThrow(()=>rememberDestination(7,'成都'))
  assert.deepEqual(recentDestination(7),{city:'',at:0})
})
test('explicit property type controls booking independently of store type', () => {
  assert.equal(isAssistedStay({houseType:'direct',operateMode:'managed'}),true)
  assert.equal(isAssistedStay({houseType:'managed',operateMode:'direct'}),false)
  assert.equal(isAssistedStay({operateMode:'direct'}),true)
  assert.equal(isAssistedStay({operateMode:'franchise'}),false)
})
