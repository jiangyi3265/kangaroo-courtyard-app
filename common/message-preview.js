import { go } from './screen.js'
export function showMessagePreview(message) {
  const route=String(message?.route||'')
  uni.showModal({title:String(message?.title||'消息详情'),content:String(message?.content||'暂无更多内容'),showCancel:!!route,cancelText:'关闭',confirmText:route?'查看详情':'知道了',success:r=>{if(r.confirm&&route)go(route)}})
}
