import {get,post} from '@/common/request.js'
import {partyPath} from '@/common/party-code.js'
export const requestId=()=> 'party_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12)
export const path=partyPath
// 房间自身每隔几秒同步一次；单次读取失败及时呈现重试入口，不叠加三轮网络重试。
export const readRoom=code=>get('/app/party/rooms/'+code,undefined,{retry:false}).then(r=>r.data)
export const command=(code,action,data,id=requestId())=>post('/app/party/rooms/'+code+'/'+action,{...data,requestId:id}).then(r=>r.data)
export const create=(mode,id)=>post('/app/party/rooms',{mode,requestId:id}).then(r=>r.data)
export const mine=()=>get('/app/party/mine').then(r=>r.data.room)
