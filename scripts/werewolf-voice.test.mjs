import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function nativeRecorderFixture(options = {}) {
  const listeners = { start: [], stop: [], error: [] }
  let stopCalls = 0
  let startCalls = 0
  const manager = {
    onStart: callback => listeners.start.push(callback),
    onStop: callback => listeners.stop.push(callback),
    onError: callback => listeners.error.push(callback),
    start() { startCalls++ },
    stop() { stopCalls++ }
  }
  const timers = new Set()
  const context = vm.createContext({
    uni: { getRecorderManager: () => manager, ...options },
    setTimeout: callback => { timers.add(callback); return callback },
    clearTimeout: callback => timers.delete(callback)
  })
  const source = readFileSync(new URL('../pages/werewolf/voice.js', import.meta.url), 'utf8')
    .replace(/^[\t ]*\/\/ #ifdef H5\r?\n[\s\S]*?^[\t ]*\/\/ #endif\r?\n/gm, '')
    .replace(/^import .*\r?\n/gm, '')
    .replace(/^export /gm, '')
  const recorder = vm.runInContext(source + '\nrecorder', context)
  const emit = (name, result) => listeners[name].forEach(callback => callback(name === 'stop' ? { duration: 1200, ...result } : result))
  return { recorder, listeners, emit, stopCalls: () => stopCalls, startCalls: () => startCalls, timers }
}

test('successive native recordings submit exactly once with one listener set', async () => {
  const fixture = nativeRecorderFixture()
  const completed = []
  const recorder = fixture.recorder(result => completed.push(result), assert.fail)
  for (let index = 0; index < 2; index++) {
    await recorder.start()
    fixture.emit('start')
    recorder.stop()
    fixture.emit('stop', { tempFilePath: 'recording-' + index + '.mp3' })
  }
  assert.equal(completed.length, 2)
  assert.equal(fixture.listeners.stop.length, 1)
  assert.equal(fixture.listeners.error.length, 1)
  assert.equal(fixture.timers.size, 0)
})

test('leaving during the microphone permission prompt cancels its eventual recording', async () => {
  const fixture = nativeRecorderFixture()
  const completed = []
  const recorder = fixture.recorder(result => completed.push(result), assert.fail)
  await recorder.start()
  recorder.cancel()
  fixture.emit('start')
  assert.equal(fixture.stopCalls(), 2)
  fixture.emit('stop', { tempFilePath: 'cancelled.mp3' })
  assert.equal(completed.length, 0)
  assert.equal(fixture.timers.size, 0)
})

test('another page takes ownership without invoking the disposed recorder callbacks', async () => {
  const fixture = nativeRecorderFixture()
  const previous = fixture.recorder(assert.fail, assert.fail)
  await previous.start()
  previous.cancel()
  fixture.emit('stop', { tempFilePath: 'previous.mp3' })
  const completed = []
  const next = fixture.recorder(result => completed.push(result), assert.fail)
  await next.start()
  fixture.emit('start')
  next.stop()
  fixture.emit('stop', { tempFilePath: 'next.mp3' })
  assert.equal(completed.length, 1)
  assert.equal(completed[0].file, 'next.mp3')
  assert.equal(fixture.listeners.stop.length, 1)
})

test('short native recordings are rejected instead of sending an empty clip', async () => {
  const fixture = nativeRecorderFixture(), completed = [], errors = []
  const recorder = fixture.recorder(result => completed.push(result), error => errors.push(error.message))
  await recorder.start(); fixture.emit('start'); recorder.stop()
  fixture.emit('stop', { tempFilePath: 'short.mp3', duration: 200 })
  assert.equal(completed.length, 0)
  assert.match(errors[0], /至少说1秒/)
  assert.equal(recorder.busy(), false)
})

test('first permission grant after releasing the button asks to hold again without recording',async()=>{
  let grant;const errors=[]
  const f=nativeRecorderFixture({getSetting:o=>o.success({authSetting:{}}),authorize:o=>{grant=o.success}})
  const mic=f.recorder(assert.fail,e=>errors.push(e.message));const starting=mic.start();await Promise.resolve();mic.stop();grant();await starting
  assert.equal(f.startCalls(),0);assert.match(errors[0],/再次按住录音/);assert.equal(mic.busy(),false)
})
test('leaving during permission inspection never opens a late authorization dialog',async()=>{
  let settings,asked=0;const f=nativeRecorderFixture({getSetting:o=>{settings=o.success},authorize:()=>{asked++}})
  const mic=f.recorder(assert.fail,assert.fail);const starting=mic.start();mic.cancel();settings({authSetting:{}});await starting
  assert.equal(asked,0);assert.equal(f.startCalls(),0)
})

test('a short tap during permission inspection resolves without leaving recording busy',async()=>{
  let settings;const errors=[];const f=nativeRecorderFixture({getSetting:o=>{settings=o.success},authorize:assert.fail})
  const mic=f.recorder(assert.fail,e=>errors.push(e.message));const starting=mic.start();mic.stop();settings({authSetting:{}});await starting
  assert.equal(f.startCalls(),0);assert.equal(mic.busy(),false);assert.match(errors[0],/至少1秒/)
})

test('取消后再次按住时，上一次迟到的微信授权回调不能抢走新的录音',async()=>{
  const settings=[],errors=[],sent=[]
  const f=nativeRecorderFixture({getSetting:q=>settings.push(q),authorize:assert.fail})
  const mic=f.recorder(clip=>sent.push(clip),e=>errors.push(e.message))
  const oldStart=mic.start()
  mic.cancel()
  const newStart=mic.start()
  settings[0].success({authSetting:{'scope.record':true}})
  await oldStart
  assert.equal(f.startCalls(),0)
  settings[1].success({authSetting:{'scope.record':true}})
  await newStart
  assert.equal(f.startCalls(),1)
  f.emit('start');mic.stop();f.emit('stop',{tempFilePath:'second.mp3'})
  assert.deepEqual(errors,[])
  assert.equal(sent.length,1);assert.equal(sent[0].file,'second.mp3')
})

test('H5迟到的麦克风授权只释放旧音轨，不能启动或关闭后一次录音',async()=>{
  const pending=[],started=[],released=[]
  class FakeRecorder {
    static isTypeSupported(){return true}
    constructor(stream){this.stream=stream}
    start(){started.push(this.stream.id)}
    stop(){}
  }
  const stream=id=>({id,getTracks:()=>[{stop:()=>released.push(id)}]})
  const source=readFileSync(new URL('../pages/werewolf/voice.js',import.meta.url),'utf8')
    .replace(/^[\t ]*\/\/ #ifdef MP-WEIXIN\r?\n[\s\S]*?^[\t ]*\/\/ #endif\r?\n/gm,'')
    .replace(/^import .*\r?\n/gm,'').replace(/^export /gm,'')
  const recorder=vm.runInNewContext(source+'\nrecorder',{MediaRecorder:FakeRecorder,
    navigator:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>pending.push(resolve))}},setTimeout,clearTimeout})
  const mic=recorder(assert.fail,assert.fail)
  const old=mic.start();mic.cancel();const current=mic.start()
  pending[1](stream('current'));await current
  pending[0](stream('old'));await old
  try {
    assert.deepEqual(started,['current'])
    assert.deepEqual(released,['old'])
  } finally { mic.cancel() }
  assert.deepEqual(released,['old','current'])
})
