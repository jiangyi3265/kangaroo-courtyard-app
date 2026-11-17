import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as vue from 'vue'
const source=fs.readFileSync(new URL('../pages/werewolf/components/ww-chat.vue',import.meta.url),'utf8').split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm,'')
const tick=async()=>{await vue.nextTick();await new Promise(r=>setImmediate(r))}
function setup(t) {
  const hides=[],shows=[],disposed=[],sent=[],players=[],released=[]
  let complete,failed,started,token='account-one',failUpload=false,pendingLoad=null,number=0
  const props=vue.reactive({room:{code:'123456',createdAt:1,serverTime:Date.now(),deadline:0,phase:'waiting',phaseToken:'waiting',me:{userId:1,canSpeak:true,skipAt:0},messages:[]},recordedVoice:true,busy:false,active:true})
  const mic={starts:[],stops:0,cancels:0,busy:()=>false,start(o){this.starts.push(o);started()},stop(){this.stops++},cancel(){this.cancels++}}
  const deps={ref:vue.ref,computed:vue.computed,watch:vue.watch,defineProps:()=>props,defineEmits:()=>()=>{},onHide:fn=>hides.push(fn),onShow:fn=>shows.push(fn),onBeforeUnmount:fn=>disposed.push(fn),
    voiceFocus:()=>()=>{},getToken:()=>token,requestId:()=>`recorded-request-${++number}`,recorder:(a,b,c)=>{complete=a;failed=b;started=c;return mic},
    sendVoice:async(...args)=>{sent.push(args);if(failUpload)throw new Error('网络暂时中断')},
    loadVoice:async(code,id)=>pendingLoad?pendingLoad(code,id):({url:id,release:()=>released.push(id)}),
    uni:{createInnerAudioContext(){const p={events:{},onPlay(fn){this.events.play=fn},onEnded(fn){this.events.end=fn},onError(fn){this.events.error=fn},play(){this.events.play()},stop(){this.stopped=true},destroy(){this.destroyed=true}};players.push(p);return p},openSetting(){}}
  }
  deps.createVoicePlayer=()=>deps.uni.createInnerAudioContext()
  const scope=vue.effectScope()
  const api=scope.run(()=>new Function(...Object.keys(deps),source+'\nreturn {startRecording,stopRecording,moveRecording,cancelRecording,play,upload,recording,voiceError,draft,playing,loadingId};')(...Object.values(deps)))
  t.after(()=>{disposed.forEach(fn=>fn());scope.stop()})
  return {...api,props,mic,sent,players,released,hides,shows,
    complete:()=>complete({file:'clip.mp3',duration:2,release:()=>released.push('recording')}),
    failUpload:v=>{failUpload=v},switchAccount:()=>{token='account-two'},loader:fn=>{pendingLoad=fn}}
}
test('polling the same room does not interrupt recording; release sends one turn-scoped clip',async t=>{
  const c=setup(t);c.startRecording({type:'touchstart',touches:[{clientY:300}]})
  c.props.room={...c.props.room,serverTime:Date.now()+2000};await tick();assert(c.recording.value)
  c.stopRecording();c.complete();await tick()
  assert.equal(c.sent.length,1);assert.equal(c.sent[0][2].phaseToken,'waiting');assert.equal(c.sent[0][2].duration,2)
  assert.equal(c.draft.value,null)
})
test('swipe cancellation, turn changes and account changes never upload old recordings',async t=>{
  const c=setup(t);c.startRecording({type:'touchstart',touches:[{clientY:300}]});c.moveRecording({touches:[{clientY:200}]});c.stopRecording();assert(c.mic.cancels>0);assert.equal(c.sent.length,0)
  c.startRecording();c.props.room.phaseToken='discussion-2';await tick();c.complete();await tick();assert.equal(c.sent.length,0)
  c.startRecording();c.switchAccount();c.complete();await tick();assert.equal(c.sent.length,0)
})
test('failed upload retries the same operation without duplicating or losing the draft',async t=>{
  const c=setup(t);c.failUpload(true);c.startRecording();c.stopRecording();c.complete();await tick()
  assert(c.draft.value);assert.match(c.voiceError.value,/网络/);assert.equal(c.released.length,0)
  c.failUpload(false);await c.upload();assert.equal(c.sent.length,2);assert.equal(c.sent[0][2].requestId,c.sent[1][2].requestId);assert.equal(c.draft.value,null)
})
test('recording respects remaining speech time and disabled speaking modes',async t=>{
  const c=setup(t);c.props.room.deadline=Date.now()+30000;await tick();c.startRecording();assert(c.mic.starts[0].maxSeconds<=28);c.cancelRecording()
  c.props.room.deadline=Date.now()+1000;await tick();c.startRecording();assert.equal(c.mic.starts.length,1)
  c.props.room.deadline=0;c.props.room.me.canSpeak=false;await tick();c.startRecording();assert.equal(c.mic.starts.length,1)
  c.props.room.me.canSpeak=true;c.props.recordedVoice=false;await tick();c.startRecording();assert.equal(c.mic.starts.length,1)
})
test('playback is manual, one clip at a time, and leaving destroys its audio resource',async t=>{
  const c=setup(t);assert.equal(c.players.length,0)
  await c.play({id:'one',audio:'one'});assert.equal(c.playing.value,'one')
  await c.play({id:'two',audio:'two'});assert(c.players[0].destroyed);assert.equal(c.playing.value,'two')
  c.players[0].events.error();assert.equal(c.playing.value,'two')
  c.hides.forEach(fn=>fn());assert(c.players[1].destroyed);assert.equal(c.playing.value,'')
})
test('out-of-order audio downloads and account changes cannot start stale playback',async t=>{
  const c=setup(t),waiting={};c.loader((code,id)=>new Promise(resolve=>{waiting[id]=()=>resolve({url:id,release:()=>c.released.push(id)})}))
  const first=c.play({id:'one',audio:'one'}),second=c.play({id:'two',audio:'two'})
  waiting.two();await second;waiting.one();await first
  assert.equal(c.players.length,1);assert.equal(c.playing.value,'two');assert(c.released.includes('one'))
  const third=c.play({id:'three',audio:'three'});c.switchAccount();waiting.three();await third;assert.equal(c.players.length,1)
})

test('parent page activity stops audio and recording even without component page hooks',async t=>{
 const c=setup(t);await c.play({id:'one',audio:'one'});c.props.active=false;
 assert(c.players[0].destroyed);c.startRecording();assert.equal(c.mic.starts.length,0);
 c.props.active=true;c.startRecording();assert(c.recording.value);c.props.active=false;c.complete();await tick();assert.equal(c.sent.length,0);
})
