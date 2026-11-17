import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileScript, parse, compileTemplate } from '@vue/compiler-sfc'
import { partyCode, partyPath, partyLoginReturn } from '../common/party-code.js'

test('room invitations and login returns accept only six-digit public room selectors',()=>{
  assert.equal(partyCode('658127'),'658127')
  assert.equal(partyPath('658127'),'/pages/party/index?code=658127')
  assert.equal(partyLoginReturn({partyCode:'658127'}),'/pages/party/index?code=658127')
  assert.equal(partyLoginReturn({partyCode:'658127',partyJoin:'1'}),'/pages/party/index?code=658127&join=1')
  assert.equal(partyLoginReturn({partyCode:'658127',partyJoin:'https://bad.test'}),'/pages/party/index?code=658127')
  assert.equal(partyLoginReturn({}), '')
  for(const value of ['','012345','12345','1234567','658127&next=evil','https://example.test','../auth/login']){
    assert.equal(partyCode(value),'')
    assert.throws(()=>partyLoginReturn({partyCode:value}),/房间号无效/)
  }
})

test('party and login templates compile with loading, closed-room and login recovery controls',()=>{
  for(const name of ['party/index','auth/login']){
    const path=new URL('../pages/'+name+'.vue',import.meta.url)
    const source=readFileSync(path,'utf8')
    const {descriptor,errors}=parse(source)
    assert.deepEqual(errors,[])
    assert.ok(compileScript(descriptor,{id:'party-share'}).content)
    assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:path.pathname,id:'party-share'}).errors,[])
  }
})

test('the real login completion returns both customer and staff accounts to the invited room',()=>{
  const source=readFileSync(new URL('../pages/auth/login.vue',import.meta.url),'utf8')
  const logic=source.slice(source.indexOf('const completeEntry ='),source.indexOf('const profileNickname='))
  for(const staff of [false,true]){
    const destinations=[]
    const complete=new Function('bindOnly','activityReturn','hasStaffAccess','relaunch',logic+';return completeEntry')(
      {value:false},{value:partyLoginReturn({partyCode:'658127'})},{value:staff},value=>destinations.push(value))
    complete()
    assert.deepEqual(destinations,['/pages/party/index?code=658127'])
  }
})

test('manual room-code input reserves usable content height with its border and padding',()=>{
  const source=readFileSync(new URL('../pages/party/index.vue',import.meta.url),'utf8')
  const style=source.match(/\.join-row input\{([^}]+)\}/)[1]
  const height=Number(style.match(/height:(\d+)px/)[1]),padding=Number(style.match(/padding:(\d+)px/)[1])
  assert.match(style,/box-sizing:border-box/)
  assert.ok(height-padding*2-2>=20,'native H5 input content must remain visible')
})
