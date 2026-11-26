import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as vue from 'vue'
import { nightProgress } from '../pages/werewolf/night-progress.js'
test('one night progresses across roles without resetting its total countdown or day',()=>{
  for(const count of [6,12]){
    const phases=count===12?['guard','wolves','seer','witch']:['wolves','seer','witch']
    let previous=Infinity
    for(let i=0;i<phases.length;i++){
      const r={phase:phases[i],playerCount:count,nightSeconds:30,day:1,deadline:1000+(i+1)*30000}
      for(let dt=0;dt<30000;dt+=1000){const state=nightProgress(r,1000+i*30000+dt);assert(state.total<=previous);previous=state.total;assert.equal(state.index,i)}
    }
  }
  assert.equal(nightProgress({phase:'discussion'},0),null)
})
test('music pauses for voice, survives hide/show, and remembers an explicit off preference',()=>{
  const source=fs.readFileSync(new URL('../pages/werewolf/components/ww-sound.vue',import.meta.url),'utf8').split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm,'')
  const busy=vue.ref(false),players=[],hooks={},props=vue.reactive({active:true,track:'local.mp3',preferenceKey:'kangaroo:werewolf:music'});let stored
  const deps={ref:vue.ref,watch:vue.watch,defineProps:()=>props,voiceBusy:busy,music:'local.mp3',
    uni:{getStorageSync:()=>stored,setStorageSync:(k,v)=>{stored=v}},
    onShow:f=>hooks.show=f,onHide:f=>hooks.hide=f,onBeforeUnmount:f=>hooks.dispose=f,
    createVoicePlayer:()=>{const p={onPlay(f){this.started=f},onError(f){this.error=f},play(){this.started()},pause(){this.paused=true},stop(){this.stopped=true},destroy(){this.destroyed=true}};players.push(p);return p}}
  const scope=vue.effectScope(),state=scope.run(()=>new Function(...Object.keys(deps),source+'\nreturn {toggle,enabled};')(...Object.values(deps)))
  assert.equal(players.length,1);assert.equal(players[0].loop,true);assert(players[0].volume<=.2)
  busy.value=true;assert(players[0].paused);assert(!players[0].destroyed);busy.value=false;assert.equal(players.length,1)
  props.active=false;assert(players[0].destroyed);props.active=true;assert.equal(players.length,2)
  state.toggle();assert.equal(stored,false);assert(players[1].destroyed);props.active=false;props.active=true;assert.equal(players.length,2)
  hooks.dispose();scope.stop()
})
