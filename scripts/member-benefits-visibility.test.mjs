import test from 'node:test'
import assert from 'node:assert/strict'
import { benefitLevels, benefitLevelStatus } from '../pages/profile/member-benefits-model.js'

test('等级权益独立于合作店列表，保留完整房型、数量与条件', () => {
  const levels = benefitLevels({ rows: [], total: 0, levelPerks: [
    { level: 0, levelName: '起步会员', minPoints: 0, items: ['基础浏览与报名'] },
    { level: 5, levelName: '最高会员', minPoints: 400, items: ['每年四人间免费 3 晚、双人间免费 2 晚、单人间免费 1 晚', ' 每年转赠最多 3 晚，限 1 次 ', ''] }
  ] })
  assert.equal(levels.length, 2)
  assert.deepEqual(levels[1].items, ['每年四人间免费 3 晚、双人间免费 2 晚、单人间免费 1 晚', '每年转赠最多 3 晚，限 1 次'])
})
test('兼容已有接口的后台等级说明，不把没有券当作没有权益', () => {
  const [level] = benefitLevels({ member: { levels: [{ level: '2', minPoints: 40, description: '袋鼠周边任选一\n社区置顶每周1次，每次2小时' }] } })
  assert.deepEqual(level.items, ['袋鼠周边任选一', '社区置顶每周1次，每次2小时'])
  assert.deepEqual(benefitLevels({}), [])
  assert.deepEqual(benefitLevels({ levelPerks: [{ level: 0 }] })[0].items, [])
})
test('游客、未达等级、当前等级、已达等级及冻结会员均有明确状态', () => {
  const level = { level: 2, minPoints: 40 }
  assert.equal(benefitLevelStatus(level, null), '达到 40 积分可享')
  assert.equal(benefitLevelStatus(level, { level: 1 }), '达到 40 积分解锁')
  assert.equal(benefitLevelStatus(level, { level: 2 }), '当前等级')
  assert.equal(benefitLevelStatus(level, { level: 3 }), '已达到该等级')
  assert.equal(benefitLevelStatus(level, { level: 2, memberFrozen: true }), '权益已冻结，请查看会员通知')
})
