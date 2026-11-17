import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
const vite=await createServer({configFile:false,server:{middlewareMode:true,hmr:false}})
const {downloadError,readSmallText}=await vite.ssrLoadModule('/common/upload.js');await vite.close()
const source=await readFile('common/arrival-media.js','utf8')
function load(target, dependencies={}) {
  const stack=[];const lines=[]
  for(const line of source.split('\n')) {
    const m=line.match(/\/\/ #(ifdef|ifndef) H5/)
    if(m){stack.push(m[1]==='ifdef'?target==='H5':target!=='H5');continue}
    if(line.includes('// #endif')){stack.pop();continue}
    if(stack.every(Boolean)&&!line.startsWith('import '))lines.push(line.replace(/^export /,''))
  }
  return new Function('API_BASE','getToken','downloadError','readSmallText','uni','fetch','URL',lines.join('\n')+'\nreturn {arrivalTicketPath,loadArrivalImages,releaseArrivalImages}')('http://localhost:8182',()=>dependencies.token??'session-secret',downloadError,readSmallText,dependencies.uni,dependencies.fetch,dependencies.URL)
}
const ref='/private/arrival/12/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg'
test('file URL carries application and encoded reference, never a token',()=> {
  const path=load('MP').arrivalTicketPath(12,ref);assert(path.startsWith('/app/application/12/arrival/ticket?file='));assert(!path.includes('secret'))
})
test('historical Chinese, spaced and percent names use only authenticated encoded reader',()=> {
  const f=load('MP').arrivalTicketPath
  for(const name of ['测试票据.jpg','票据 (1).jpg','ticket 20%.JPG','车票#1.jpg','票据?1.jpg']){
    const path='/profile/upload/2026/10/06/'+name
    assert.equal(f(12,path),'/app/application/12/arrival/ticket?file='+encodeURIComponent(path))
  }
  for(const name of ['../x.jpg','a/b.jpg','a\\b.jpg','a,b.jpg','a\nb.jpg','a.jpg#fragment','a.jpg?x=1'])assert.throws(()=>f(12,'/profile/upload/2026/10/06/'+name))
})
test('rejects another application, traversal, arbitrary URL and nonpositive IDs',()=>{
  const f=load('MP').arrivalTicketPath
  for(const [id,p] of [[13,ref],[12,'../file.jpg'],[12,'https://example.org/file.jpg'],[0,ref],[12,'/profile/upload/x.svg']])assert.throws(()=>f(id,p))
})
test('unauthenticated download never sends request',async()=>{await assert.rejects(load('MP',{token:''}).loadArrivalImages(12,[ref]),/重新登录/)})
test('native adapter sends header and rejects HTTP 200 error JSON',async()=>{
  globalThis.uni={getFileSystemManager:()=>({stat:r=>r.success({stats:{size:30}}),readFile:r=>r.success({data:'{"code":403,"msg":"门店授权已撤销"}'})})}
  let sent
  const uni={downloadFile:r=>{sent=r;r.success({statusCode:200,tempFilePath:'temp.jpg'})}}
  await assert.rejects(load('MP',{uni}).loadArrivalImages(12,[ref]),/授权已撤销/)
  assert.equal(sent.header['X-App-Token'],'session-secret');assert(!sent.url.includes('secret'))
  delete globalThis.uni
})
test('native large image is not decoded as UTF8; returns downloaded local file',async()=>{
  globalThis.uni={getFileSystemManager:()=>({stat:r=>r.success({stats:{size:100000}}),readFile:()=>assert.fail('Image must not be read as text')})}
  const uni={downloadFile:r=>r.success({statusCode:200,tempFilePath:'image-temp.jpg'})}
  assert.deepEqual(await load('MP',{uni}).loadArrivalImages(12,[ref]),['image-temp.jpg']);delete globalThis.uni
})
test('H5 rejects non-image response and frees prior blobs on partial failure',async()=>{
  let calls=0;const revoked=[]
  const fetch=async()=>++calls===1?{ok:true,headers:{get:()=> 'image/jpeg'},blob:async()=>({})}:{ok:true,headers:{get:()=> 'application/json'},text:async()=>'{"code":401,"msg":"登录已失效"}'}
  const URL={createObjectURL:()=> 'blob:test',revokeObjectURL:u=>revoked.push(u)}
  await assert.rejects(load('H5',{fetch,URL}).loadArrivalImages(12,[ref,ref]),/登录已失效/);assert.deepEqual(revoked,['blob:test'])
})
