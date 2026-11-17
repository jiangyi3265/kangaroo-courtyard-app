import test from 'node:test'
import assert from 'node:assert/strict'
import { listDrafts, saveLocalDraft, removeLocalDraft, migrateLocalDrafts } from '../common/local-drafts.js'

function storage() {
  const data = new Map()
  globalThis.uni = { getStorageSync: k => structuredClone(data.get(k)), setStorageSync: (k,v) => data.set(k, structuredClone(v)), removeStorageSync: k => data.delete(k) }
  return data
}
test('community types and wishes coexist; editing and publishing affect only selected draft', () => {
  storage()
  const saved = ['找搭子','旅居日常','经验分享','心愿'].map((type,i) => saveLocalDraft(12,{kind:i===3?'wish':'community',data:{type,title:type}}))
  assert.equal(listDrafts(12).length,4)
  saveLocalDraft(12,{...saved[1],data:{type:'旅居日常',title:'新日常'}})
  assert.equal(listDrafts(12).length,4)
  assert.equal(listDrafts(12).find(x=>x.id===saved[1].id).data.title,'新日常')
  removeLocalDraft(12,saved[3].id)
  assert.equal(listDrafts(12).length,3)
  assert.equal(listDrafts(12,'wish').length,0)
  assert.equal(listDrafts(12).find(x=>x.id===saved[0].id).data.title,'找搭子')
})
test('ten-draft limit preserves all content and permits editing existing drafts', () => {
  storage()
  for(let i=0;i<10;i++)saveLocalDraft(12,{kind:'wish',data:{title:String(i)}})
  const before=listDrafts(12)
  assert.throws(()=>saveLocalDraft(12,{kind:'community',data:{title:'eleven'}}),/最多保存10份/)
  assert.deepEqual(listDrafts(12),before)
  saveLocalDraft(12,{...before[0],data:{title:'edit'}})
  assert.equal(listDrafts(12).length,10)
})
test('drafts are isolated by account and legacy migration is lossless and idempotent', () => {
  const data=storage()
  data.set('kangaroo:publish-draft:12',{type:'旅居日常',title:'old post'})
  data.set('wish:draft:12',{title:'old wish'})
  migrateLocalDrafts(12);migrateLocalDrafts(12)
  assert.equal(listDrafts(12).length,2)
  assert.equal(listDrafts(13).length,0)
  removeLocalDraft(13,'legacy-wish')
  assert.equal(listDrafts(12).length,2)
  assert(!data.has('wish:draft:12'))
  assert.throws(()=>saveLocalDraft(null,{kind:'wish',data:{}}),/请先登录/)
})
test('full storage and write failures never delete old drafts during migration', () => {
  const data=storage()
  for(let i=0;i<10;i++)saveLocalDraft(12,{kind:'wish',data:{title:String(i)}})
  data.set('wish:draft:12',{title:'unmigrated'})
  migrateLocalDrafts(12)
  assert.equal(data.get('wish:draft:12').title,'unmigrated')
  const before=listDrafts(12)
  uni.setStorageSync=()=>{throw new Error('storage full')}
  assert.throws(()=>saveLocalDraft(12,{...before[0],data:{title:'lost?'}}),/storage full/)
  assert.deepEqual(listDrafts(12),before)
})
