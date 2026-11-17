import test from 'node:test'
import assert from 'node:assert/strict'
import { stayReviewsUrl, activeFilters, reviewQuery } from '../pages/stays/stays-reviews.js'
import { roomRate } from '../pages/stays/stays-ui.js'

test('房型评价地址携带真实房型编号，中文名称和特殊字符可往返', () => {
  const name = '双人间 / 独卫 & 阳台'
  const url = new URL(stayReviewsUrl(7, 10, name), 'https://example.test')
  assert.equal(url.pathname, '/pages/stays/reviews')
  assert.equal(url.searchParams.get('stayId'), '7')
  assert.equal(url.searchParams.get('roomTypeId'), '10')
  assert.equal(url.searchParams.get('roomTypeName'), name)
  assert.deepEqual(reviewQuery({ roomTypeId: url.searchParams.get('roomTypeId') }), { pageNum: 1, pageSize: 10, roomTypeId: 10 })
  for (const id of [undefined, 0, -1, 1.5, NaN, Infinity, 'bad']) {
    assert.equal(stayReviewsUrl(7, id, name), '/pages/stays/reviews?stayId=7')
  }
})

test('无评价的房型也有明确的筛选名称，有汇总时使用服务端名称', () => {
  assert.deepEqual(activeFilters({ roomTypeId: 10, roomName: '双人间独卫' }, {}), [{ key: 'room', text: '双人间独卫' }])
  assert.deepEqual(activeFilters({ roomTypeId: 10, roomName: '旧名称' }, { roomTypes: [{ roomTypeId: 10, name: '新双人间' }] }), [{ key: 'room', text: '新双人间' }])
  assert.deepEqual(activeFilters({ roomTypeId: 0, roomName: '双人间独卫' }, {}), [])
})

test('只显示本房型有效评价分，不能用门店分数填补零评价', () => {
  assert.deepEqual(roomRate({ rating: 4.7, reviewCount: 3 }), { score: '4.7', count: 3 })
  assert.deepEqual(roomRate({ rating: '3', reviewCount: '1' }), { score: '3.0', count: 1 })
  for (const data of [{ rating: 4.8, reviewCount: 0 }, { rating: 4.8 }, { rating: null, reviewCount: 3 }, { rating: 6, reviewCount: 1 }, { rating: Infinity, reviewCount: 1 }, { rating: 4.8, reviewCount: -1 }, { rating: 4.8, reviewCount: 0.5 }]) {
    assert.equal(roomRate(data), null)
  }
})
