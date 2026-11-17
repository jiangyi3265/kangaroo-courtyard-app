import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chooseWishPhotos, pickedPhotos, uploadedPhoto, PHOTO_MAX_BYTES } from '../pages/wish/photo-upload.js'
test('photo picker supports both WeChat result formats and preserves file sizes',()=>{
 assert.deepEqual(pickedPhotos({tempFiles:[{path:'local.jpg',size:123}]}),[{path:'local.jpg',size:123}])
 assert.equal(pickedPhotos({tempFilePaths:['local.png'],tempFiles:[{size:PHOTO_MAX_BYTES+1}]})[0].size,20971521)
 assert.equal(uploadedPhoto({data:{url:'/profile/upload/a.jpg'}}),'/profile/upload/a.jpg')
 for(const result of [{},{data:{}},{data:{url:'https://untrusted.example/a.jpg'}}])assert.throws(()=>uploadedPhoto(result))
})
test('photo cancellation is quiet but denied permission produces actionable error',async()=>{
 globalThis.uni={chooseImage:options=>options.fail({errMsg:'chooseImage:fail cancel'})}
 assert.deepEqual(await chooseWishPhotos(3),[])
 globalThis.uni={chooseImage:options=>options.fail({errMsg:'chooseImage:fail permission denied'})}
 await assert.rejects(chooseWishPhotos(3),/照片权限/)
 delete globalThis.uni
})
const source=readFileSync(new URL('../common/locate.js',import.meta.url),'utf8').replace(/^import.*$/mg,'').replace('export function','function')
function locator(uni,api){return new Function('uni','apiLocateCity','confirmedLocation',source+';return locateCity')(uni,api,r=>!!(r?.found&&r?.source==='administrative_boundary'&&r?.name))}
test('location resolves only verified city and reports GPS denial independently',async()=>{
 let problem=''
 const denied=locator({getLocation:o=>o.fail({errMsg:'permission denied'})},()=>{throw Error('must not call backend')})
 assert.equal(await denied({onFailure:m=>problem=m}),null);assert.match(problem,/允许定位/)
 const location=locator({getLocation:o=>o.success({latitude:25.5,longitude:119.7,accuracy:20})},async()=>({data:{found:true,source:'administrative_boundary',name:'平潭'}}))
 assert.equal((await location()).name,'平潭')
 const ambiguous=locator({getLocation:o=>o.success({})},async()=>({data:{found:true,source:'nearest',name:'邻近城市'}}))
 assert.equal(await ambiguous({onFailure:m=>problem=m}),null);assert.match(problem,/精度不足/)
})
