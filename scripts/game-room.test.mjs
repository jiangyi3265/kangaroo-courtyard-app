import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../common/use-game-room.js', import.meta.url), 'utf8')
  .replace(/^import .*\r?\n/gm, '')
  .replace('export function useGameRoom', 'function useGameRoom')
const snapshot = version => ({ version, serverTime: Date.now(), phaseToken: 'turn-1' })
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

function fixture() {
  const lifecycle = {}, watchers = [], writes = []
  let token = 'account-one', id = 0
  const behavior = {
    read: async () => snapshot(1),
    command: async () => snapshot(2),
    session: async () => {}
  }
  const api = {
    readRoom: (...args) => behavior.read(...args),
    command: (...args) => { writes.push(args); return behavior.command(...args) },
    requestId: () => 'request-identifier-' + (++id)
  }
  const context = vm.createContext({
    ref: value => ({ value }),
    watch: (_, callback) => watchers.push(callback),
    onShow: callback => { lifecycle.show = callback },
    onHide: callback => { lifecycle.hide = callback },
    onUnload: callback => { lifecycle.unload = callback },
    ensureSession: () => behavior.session(),
    experience: { account: { id: 1 } },
    getToken: () => token,
    setTimeout: () => 1,
    clearTimeout: () => {},
    setInterval: () => 2,
    clearInterval: () => {},
    uni: { showToast: () => {} }
  })
  vm.runInContext(source, context)
  const code = { value: '123456' }
  const state = context.useGameRoom(code, api)
  return { state, behavior, lifecycle, watchers, writes, code, setToken: value => { token = value },
    setCode: value => { const old=code.value;code.value=value;watchers[0](value,old) },
    accountChanged: (value,old) => watchers[1](value,old) }
}

test('shared polling never overwrites a command with an older snapshot', async () => {
  const f = fixture()
  await f.lifecycle.show()
  await flush()
  let resolveRead
  f.behavior.read = () => new Promise(resolve => { resolveRead = resolve })
  const pending = f.state.refresh()
  await f.state.act('ready', { ready: true })
  assert.equal(f.state.room.value.version, 2)
  resolveRead(snapshot(1))
  await pending
  assert.equal(f.state.room.value.version, 2)
})

test('hiding the page cancels delivery of an in-flight room action', async () => {
  const f = fixture()
  let complete
  f.behavior.command = () => new Promise(resolve => { complete = resolve })
  await f.lifecycle.show()
  await flush()
  const pending = f.state.act('vote', { target: 2 })
  f.lifecycle.hide()
  complete(snapshot(5))
  assert.equal(await pending, null)
  assert.equal(f.state.room.value.version, 1)
  assert.equal(f.state.busy.value, false)
})

test('session changes invalidate private room state and pending receipts', async () => {
  const f = fixture()
  await f.lifecycle.show()
  await flush()
  assert.equal(f.state.room.value.version, 1)
  f.lifecycle.hide()
  f.setToken('account-two')
  f.accountChanged(2, 1)
  assert.equal(f.state.room.value, null)
  assert.equal(f.state.busy.value, false)
})

test('network retries reuse one receipt while server rejections permit a fresh request', async () => {
  const f = fixture()
  await f.lifecycle.show()
  await flush()
  let code = -1
  f.behavior.command = async () => { throw Object.assign(new Error('retry'), { code }) }
  await f.state.act('ready', { ready: true })
  await f.state.act('ready', { ready: true })
  assert.equal(f.writes[0][3], f.writes[1][3])
  code = 409
  await f.state.act('ready', { ready: true })
  f.behavior.command = async () => snapshot(2)
  await f.state.act('ready', { ready: true })
  assert.notEqual(f.writes[2][3], f.writes[3][3])
})

test('host can change settings after leaving while a request is in flight and returning', async () => {
  const f=fixture();await f.lifecycle.show();await flush()
  let previous;f.behavior.command=()=>new Promise(r=>{previous=r})
  const old=f.state.act('settings',{speechSeconds:120});assert.equal(f.state.busy.value,true)
  f.lifecycle.hide();await f.lifecycle.show();await flush()
  f.behavior.command=async()=>({...snapshot(3),speechSeconds:45})
  assert.equal((await f.state.act('settings',{speechSeconds:45})).speechSeconds,45)
  previous({...snapshot(2),speechSeconds:120});await old
  assert.equal(f.state.room.value.speechSeconds,45);assert.equal(f.state.busy.value,false)
})
test('a token refresh during an action cannot leave settings permanently disabled',async()=>{
  const f=fixture();await f.lifecycle.show();await flush()
  f.behavior.command=async()=>{f.setToken('renewed');return snapshot(2)}
  assert.equal(await f.state.act('settings'),null);assert.equal(f.state.busy.value,false)
  f.behavior.command=async()=>snapshot(3);assert.equal((await f.state.act('settings')).version,3)
})
test('concurrent refreshes share a request and equal-version older server clocks are ignored',async()=>{
  const f=fixture();f.behavior.read=async()=>({...snapshot(1),serverTime:2000});await f.lifecycle.show();await flush()
  let count=0,done;f.behavior.read=()=>{count++;return new Promise(r=>{done=r})}
  const a=f.state.refresh(),b=f.state.refresh();assert.equal(count,1)
  done({...snapshot(1),serverTime:1000});await Promise.all([a,b]);assert.equal(f.state.room.value.serverTime,2000)
})

test('shared cold entry loads after onShow runs before the room code arrives',async()=>{
  const f=fixture(),seen=[]
  f.code.value=''
  f.behavior.read=async code=>{seen.push(code);return snapshot(1)}
  await f.lifecycle.show();await flush()
  assert.equal(seen.length,0)
  assert.equal(f.state.loading.value,false)
  f.setCode('658127');await flush()
  assert.deepEqual(seen,['658127'])
  assert.equal(f.state.room.value.version,1)
  assert.equal(f.state.loading.value,false)
})

test('session restoration and late room parameters cannot cancel initialization',async()=>{
  const f=fixture(),seen=[];let finish
  f.code.value=''
  f.behavior.session=()=>new Promise(resolve=>{finish=resolve})
  f.behavior.read=async code=>{seen.push(code);return snapshot(2)}
  const showing=f.lifecycle.show()
  f.setCode('658127')
  f.accountChanged(2,1)
  assert.equal(seen.length,0)
  finish();await showing;await flush()
  assert.deepEqual(seen,['658127'])
  assert.equal(f.state.loading.value,false)
  assert.equal(f.state.room.value.version,2)
})

test('new room ignores late old room read and old pending commands',async()=>{
  const f=fixture();await f.lifecycle.show();await flush()
  let finishRead,finishCommand
  f.behavior.read=()=>new Promise(resolve=>{finishRead=resolve})
  const reading=f.state.refresh()
  f.behavior.command=()=>new Promise(resolve=>{finishCommand=resolve})
  const acting=f.state.act('roll')
  f.behavior.read=async()=>({...snapshot(1),code:'658127'})
  f.setCode('658127');await flush()
  finishRead({...snapshot(99),code:'123456'})
  finishCommand({...snapshot(100),code:'123456'})
  await reading;assert.equal(await acting,null)
  assert.equal(f.state.room.value.code,'658127')
  assert.equal(f.state.room.value.version,1)
  assert.equal(f.state.busy.value,false)
})

test('a hidden page cannot resume a delayed session or late query until shown again',async()=>{
  const f=fixture();let finish;let reads=0
  f.behavior.session=()=>new Promise(resolve=>{finish=resolve})
  f.behavior.read=async()=>{reads++;return snapshot(1)}
  const showing=f.lifecycle.show()
  f.lifecycle.hide();f.setCode('658127');finish();await showing;await flush()
  assert.equal(reads,0)
  f.behavior.session=async()=>{}
  await f.lifecycle.show();await flush()
  assert.equal(reads,1)
})

test('failed first room read leaves loading and can be retried without a write',async()=>{
  const f=fixture()
  f.behavior.read=async()=>{throw Object.assign(new Error('房间已过期'),{code:404})}
  await f.lifecycle.show();await flush()
  assert.equal(f.state.loading.value,false)
  assert.equal(f.state.error.value,'房间已过期')
  f.behavior.read=async()=>({...snapshot(2),phase:'closed'})
  await f.state.refresh()
  assert.equal(f.state.room.value.phase,'closed')
  assert.equal(f.state.error.value,'')
  assert.equal(f.writes.length,0)
})
