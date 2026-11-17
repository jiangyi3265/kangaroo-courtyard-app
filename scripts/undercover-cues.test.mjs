import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as vue from 'vue'
const source=fs.readFileSync(new URL('../pages/undercover/use-cues.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/    \/\/ #ifdef H5[\s\S]*?    \/\/ #endif/,'').replace('export function','function')

function fixture() {
 const hooks={},players=[],room=vue.ref({phaseToken:'existing-turn',me:{canSpeak:true}}),seconds=vue.ref(30)
 const deps={ref:vue.ref,watch:vue.watch,cue:'turn.wav',onShow:f=>hooks.show=f,onHide:f=>hooks.hide=f,onBeforeUnmount:f=>hooks.destroy=f,
 uni:{getStorageSync:()=>true,setStorageSync(){},vibrateShort(){},createInnerAudioContext(){const p={played:0,primes:0,stopped:0,onCanplay(f){this.ready=f},onError(f){this.fail=f},onPlay(f){this.started=f},play(){if(this.volume===0)this.primes++;else this.played++},stop(){this.stopped++},destroy(){this.destroyed=true}};players.push(p);return p}}}
 const scope=vue.effectScope(),state=scope.run(()=>new Function(...Object.keys(deps),source+';return useUndercoverCues;')(...Object.values(deps))(room,seconds))
 return {hooks,players,room,seconds,state,dispose(){hooks.destroy();scope.stop()}}
}

test('an already-loaded turn plays cues once even when the server clock moves backwards',async()=>{
 const f=fixture();try {f.players[0].ready();for(const n of [5,4,5,4,3,2,1]){f.seconds.value=n;await vue.nextTick()}assert.equal(f.players[0].played,5)}finally{f.dispose()}
})

test('retry recreates failed audio and ignores readiness from the destroyed player',async()=>{
 const f=fixture();try {
  const old=f.players[0];old.fail();assert.equal(f.state.cuesBlocked.value,true);f.state.toggleCues();assert.equal(old.destroyed,true);assert.equal(f.players.length,2)
  old.ready();f.seconds.value=5;await vue.nextTick();assert.equal(f.players[1].played,0)
  f.players[1].ready();f.seconds.value=4;await vue.nextTick();assert.equal(f.players[1].played,1)
  f.hooks.hide();f.seconds.value=3;await vue.nextTick();assert.equal(f.players[1].played,1)
 }finally{f.dispose()}
})
test('cues preload, play five final ticks once, and never replay a delayed tick in the next round',async()=>{
 const hooks={},room=vue.ref({phaseToken:'turn1',me:{canSpeak:true}}),seconds=vue.ref(30);let played=0,stopped=0,destroyed=0,ready;
 const deps={ref:vue.ref,watch:vue.watch,cue:'turn.wav',onShow:f=>hooks.show=f,onHide:f=>hooks.hide=f,onBeforeUnmount:f=>hooks.destroy=f,
 uni:{getStorageSync:()=>true,setStorageSync(){},vibrateShort(){},createInnerAudioContext(){return{onCanplay:f=>ready=f,onError(){},onPlay(){},play(){if(this.volume!==0)played++},stop(){stopped++},destroy(){destroyed++}}}}}
 const scope=vue.effectScope();scope.run(()=>new Function(...Object.keys(deps),source+';return useUndercoverCues;')(...Object.values(deps))(room,seconds));
 room.value={...room.value,phaseToken:'turn2'};seconds.value=5;await vue.nextTick();assert.equal(played,0);
 room.value={...room.value,phaseToken:'turn3'};seconds.value=30;ready();await vue.nextTick();assert.equal(played,0);
 for(const n of [5,4,3,2,1]){seconds.value=n;await vue.nextTick()}assert.equal(played,5);
 room.value={...room.value,phaseToken:'turn4'};seconds.value=30;await vue.nextTick();assert.equal(played,5);assert(stopped>=6);
 hooks.hide();seconds.value=3;await vue.nextTick();assert.equal(played,5);
 hooks.show();seconds.value=2;await vue.nextTick();assert.equal(played,6);
 hooks.destroy();scope.stop();assert.equal(destroyed,1);
})

test('H5 ignores an interrupted play from a previous turn but can recover a current audio failure',async()=>{
 const h5=fs.readFileSync(new URL('../pages/undercover/use-cues.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/    \/\/ #ifndef H5[\s\S]*?    \/\/ #endif/,'').replace('export function','function')
 const hooks={},players=[],room=vue.ref({phaseToken:'turn1',me:{canSpeak:true}}),seconds=vue.ref(30)
 class FakeAudio {
  constructor(){this.rejects=[];players.push(this)}
  load(){} pause(){} removeAttribute(){this.removed=true}
  play(){return new Promise((_,reject)=>this.rejects.push(reject))}
 }
 const deps={ref:vue.ref,watch:vue.watch,Audio:FakeAudio,cue:'turn.wav',onShow:f=>hooks.show=f,onHide:f=>hooks.hide=f,onBeforeUnmount:f=>hooks.destroy=f,uni:{getStorageSync:()=>true,setStorageSync(){},vibrateShort(){}}}
 const scope=vue.effectScope(),state=scope.run(()=>new Function(...Object.keys(deps),h5+';return useUndercoverCues;')(...Object.values(deps))(room,seconds))
 try {
  const old=players[0];old.oncanplaythrough();seconds.value=5;await vue.nextTick()
  room.value={...room.value,phaseToken:'turn2'};seconds.value=30;await vue.nextTick()
  old.rejects[0](new Error('interrupted by pause'));await Promise.resolve()
  assert.equal(state.cuesBlocked.value,false,'a stopped prior turn must not block current audio')
  seconds.value=5;await vue.nextTick();old.rejects[1](new Error('real playback failure'));await Promise.resolve()
  assert.equal(state.cuesBlocked.value,true)
  state.toggleCues();assert.equal(players.length,2);assert.equal(old.removed,true);assert.equal(old.onerror,null)
  players[1].oncanplaythrough();seconds.value=4;await vue.nextTick();assert.equal(players[1].rejects.length,2,'silent unlock attempt precedes the countdown tick')
  hooks.hide();players[1].rejects[1](new Error('interrupted on hide'));await Promise.resolve();assert.equal(state.cuesBlocked.value,false)
 } finally {hooks.destroy();scope.stop()}
})

test('normal room interaction silently unlocks playback even before canplay; no toggle is needed',async()=>{
 const f=fixture();try {
  f.state.armCues();const audio=f.players[0];assert.equal(audio.volume,0);assert.equal(audio.primes,1)
  audio.started();assert.equal(audio.volume,.8);assert.equal(audio.played,0)
  f.seconds.value=5;await vue.nextTick();assert.equal(audio.played,1)
  f.state.armCues();assert.equal(audio.primes,1,'ordinary taps do not interrupt an armed cue')
  audio.fail();f.state.armCues();assert.equal(f.players.length,2,'a normal gesture retries a blocked player')
  f.hooks.hide();const stopped=f.players[1].stopped;f.players[1].started();assert(f.players[1].stopped>stopped,'late playback after hiding is stopped')
 } finally {f.dispose()}
})

test('switching sound off prevents gesture priming and countdown sounds',async()=>{
 const f=fixture();try{f.state.toggleCues();f.state.armCues();f.players[0].ready();f.seconds.value=5;await vue.nextTick();assert.equal(f.players[0].primes,0);assert.equal(f.players[0].played,0)}finally{f.dispose()}
})
