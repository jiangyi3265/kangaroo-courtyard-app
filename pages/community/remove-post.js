import {sheet,confirm,prompt} from '@/common/ui.js'
import {toast} from '@/common/screen.js'
import {post as send} from '@/common/request.js'
import {experience} from '@/common/experience.js'
export async function removeCommunityPost(item){
  const owner=experience.account?.id;if(!owner)return false
  try{
    let cancelActivity=false,reason=''
    if(item.activity?.canCancel){
      const n=await sheet(['取消活动并删除动态','仅删除动态，活动照常']);if(n<0)return false
      cancelActivity=n===0
      if(cancelActivity){reason=(await prompt('取消活动原因',{placeholder:'原因会通知报名者',maxlength:200}))?.trim()||'';if(!reason)return false}
    }
    const tip=cancelActivity?'关联活动将停止报名并通知报名者，动态同时删除。已取消记录保留供查询。确认继续？':item.activity?'仅删除社区动态，活动及报名记录保留。活动不再举办时请选择取消活动并删除。确认继续？':'删除后社区不再展示这条动态。确认删除？'
    if(!await confirm('删除动态',tip)||owner!==experience.account?.id)return false
    await send('/app/community/posts/'+item.postId+'/remove',{cancelActivity,reason})
    if(owner!==experience.account?.id)return false
    toast(cancelActivity?'活动已取消，动态已删除':'动态已删除');return true
  }catch(e){toast(e?.message||'删除失败，请重试');return false}
}
