import test from 'node:test'
import assert from 'node:assert/strict'
import {drawCard,truths,dares,rollDice,remainingSeconds} from '../pages/undercover/party-tools.js'
import {normalizeClock} from '../common/manual-time.js'
import {blankFilter,filterParams,filterForTab,panelGroups} from '../pages/jobs/job-filters.js'
test('both 20-card decks exhaust without repetition and restart safely',()=>{
 for(const kind of ['truth','dare']){let seen=[];const cards=new Set();for(let i=0;i<20;i++){const r=drawCard(kind,seen,()=>.3);seen=r.seen;cards.add(r.text)}assert.equal(cards.size,20);const next=drawCard(kind,seen,()=>0);assert.equal(next.seen.length,1);assert(next.text)}
 assert.equal(truths.length,20);assert.equal(dares.length,20)
})
test('dice count and outcomes stay within one to six',()=>{assert.deepEqual(rollDice(6,()=>0),[1,1,1,1,1,1]);assert.deepEqual(rollDice(2,()=>.999999),[6,6]);assert.equal(rollDice(99).length,6);assert.equal(rollDice(0).length,1)})
test('countdown resumes by elapsed real time and never becomes negative',()=>{assert.equal(remainingSeconds(10000,4999),6);assert.equal(remainingSeconds(10000,9999),1);assert.equal(remainingSeconds(10000,15000),0)})
test('manual time normalizes supported forms and rejects invalid hours/minutes',()=>{
 for(const [a,b] of [['9:30','09:30'],['0930','09:30'],['930','09:30'],['09：30','09:30'],['00:00','00:00'],['23:59','23:59']])assert.equal(normalizeClock(a),b)
 for(const a of ['24:00','09:60','-1:30','hello','9:3','1',''])assert.equal(normalizeClock(a),'')
})
test('bathroom filters are included in volunteer requests and cleared for other job types',()=>{
 const f={...blankFilter(),bathroom:'private'};assert.equal(filterParams('volunteer',f).bathroom,'private');assert(!('bathroom' in filterParams('online',f)));assert.equal(filterForTab('parttime',f).bathroom,'');assert(panelGroups('volunteer',f,[]).some(x=>x.key==='bathroom'))
})
