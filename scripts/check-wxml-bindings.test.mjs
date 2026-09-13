import assert from 'node:assert/strict'
import test from 'node:test'
import { findShadowedProps } from './check-wxml-bindings.mjs'

test('detects profile menu props shadowed by the loop row', () => {
  const template = '<view wx:for="{{l}}" wx:for-item="m"><k-icon u-p="{{m.b}}"/><text>{{m.c}}</text><k-icon u-p="{{m}}"/></view>'
  assert.equal(findShadowedProps(template).length, 1)
  assert.equal(findShadowedProps(template)[0].alias, 'm')
})
test('descriptive aliases preserve the hoisted props reference', () => {
  assert.deepEqual(findShadowedProps('<view wx:for="{{l}}" wx:for-item="menuItem"><k-icon u-p="{{menuItem.b}}"/><k-icon u-p="{{m}}"/></view>'), [])
})
test('checks ancestor aliases inside nested loops', () => {
  assert.equal(findShadowedProps('<view wx:for="{{l}}" wx:for-item="p"><view wx:for="{{p.list}}" wx:for-item="image"><k-icon u-p="{{p}}"/></view></view>').length, 1)
})
test('does not leak aliases after a loop closes', () => {
  assert.deepEqual(findShadowedProps('<view wx:for="{{l}}" wx:for-item="m"><text>{{m.title}}</text></view><k-icon u-p="{{m}}"/>'), [])
})
test('handles comparison operators inside quoted attributes', () => {
  assert.equal(findShadowedProps('<view wx:for="{{l}}" wx:for-item="m" wx:if="{{n > 1}}"><k-icon u-p="{{m}}"/></view>').length, 1)
})
