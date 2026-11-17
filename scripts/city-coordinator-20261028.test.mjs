import test from 'node:test'
import assert from 'node:assert/strict'
import { coordinatorCity, localSubscriptionPayload, localSubscriptions } from '../pages/jobs/city-coordinator.js'

const row = overrides => ({ subId: 8, status: '0', cities: '平潭', jobTypes: 'volunteer,parttime,fulltime', ...overrides })
test('地区名称与本地三类岗位订阅一致，不携带民宿编号', () => {
  assert.equal(coordinatorCity('平潭岛'), '平潭')
  assert.equal(coordinatorCity('平潭县'), '平潭')
  assert.equal(coordinatorCity('丽江市'), '丽江')
  assert.deepEqual(localSubscriptionPayload('平潭岛'), {cities:['平潭'],jobTypes:['volunteer','parttime','fulltime'],keyword:'',freq:'instant'})
  assert.equal(localSubscriptionPayload(' '), null)
})
test('刷新识别已有城市订阅，兼容数组、顺序、别名和每日汇总', () => {
  for (const value of [row({}),row({cities:'平潭岛',jobTypes:'fulltime,parttime,volunteer',freq:'daily'}),row({cities:['平潭'],jobTypes:['volunteer','parttime','fulltime']})]) {
    assert.deepEqual(localSubscriptions([value], '平潭'), [value])
  }
})
test('取消当地订阅不会操作民宿关注、其他城市或筛选订阅', () => {
  const unrelated = [row({storeId:102}), row({cities:'丽江'}), row({cities:'平潭,丽江'}), row({keyword:'咖啡'}), row({jobTypes:'parttime'}), row({jobTypes:''}), row({jobTypes:'volunteer,parttime,online'}), row({fromDate:'2026-12-01'}), row({status:'1'})]
  assert.deepEqual(localSubscriptions(unrelated, '平潭'), [])
  assert.deepEqual(localSubscriptions([row({})], ''), [])
})
