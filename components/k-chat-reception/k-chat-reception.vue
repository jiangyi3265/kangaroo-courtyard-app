<template>
  <view v-if="canManage" class="reception">
    <button class="reception-open" @click="openSettings"><text>线上任务接待</text><text>设置接待账号 ›</text></button>
    <view v-if="opened" class="reception-panel">
      <text class="reception-title">选择接待账号 · 最多2人</text>
      <text class="reception-help">设置后由所选在职账号接待。接待权限不包含招聘审核；未指定时沿用本店全部在职员工。</text>
      <text v-if="loading">正在读取当前设置…</text>
      <template v-else>
        <button v-for="person in people" :key="person.userId" class="reception-person" :disabled="saving" @click="toggle(person.userId)" role="checkbox" :aria-checked="selected.includes(String(person.userId))">
          <text>{{ selected.includes(String(person.userId)) ? '✓' : '○' }}</text><text>{{ person.nickname || '员工' }} · {{ person.userId }}</text><text>{{ person.roleCode === 'manager' ? '换工主理人' : person.roleCode === 'keeper' ? '小院主理人' : person.roleCode === 'online_staff' ? '线上任务专员' : person.roleCode === 'merchant' ? '合作商家' : '员工' }}</text>
        </button>
        <text v-if="missing.length" class="reception-error">已指定账号 {{ missing.join('、') }} 已不在可用名单。不会自动交给其他员工，请调整后保存。</text>
      </template>
      <text v-if="error" class="reception-error">{{ error }}</text>
      <view class="reception-actions"><button :disabled="saving" @click="close">关闭</button><button :disabled="loading || saving" @click="save">{{ saving ? '保存中…' : '保存接待设置' }}</button></view>
    </view>
  </view>
</template>
<script setup>
import { ref, computed, watch } from 'vue'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import { experience } from '@/common/experience.js'
import { getToken } from '@/common/request.js'
import { apiChatReception, apiChatReceptionSave } from '@/common/api.js'
import { toast } from '@/common/screen.js'
const props=defineProps({storeId:{type:[Number,String],default:null}})
const opened=ref(false),loading=ref(false),saving=ref(false),selected=ref([]),people=ref([]),error=ref('')
let epoch=0,visible=true
const grant=computed(()=>(experience.account?.staffGrants||[]).find(g=>g.active===true&&String(g.storeId)===String(props.storeId)))
const canManage=computed(()=>!!getToken()&&['manager','keeper','city_lead'].includes(grant.value?.roleCode))
const identity=()=>[getToken(),experience.account?.id,props.storeId,JSON.stringify(experience.account?.staffGrants||[])].join('|')
const current=(key,n)=>visible&&canManage.value&&n===epoch&&identity()===key
const missing=computed(()=>selected.value.filter(id=>!people.value.some(p=>String(p.userId)===id)))
function clear(){++epoch;opened.value=false;loading.value=false;saving.value=false;selected.value=[];people.value=[];error.value=''}
function close(){clear()}
watch(identity,clear,{flush:'sync'})
onHide(()=>{visible=false;clear()});onUnload(clear);onShow(()=>{visible=true})
async function openSettings(){
 // 保存途中再点「设置接待账号」会换掉 epoch，保存回来就不再放开 saving，关闭 / 保存按钮一直灰着；保存完再开
 if(!canManage.value||saving.value)return
 opened.value=true;loading.value=true;error.value='';const key=identity(),n=++epoch
 try{const r=(await apiChatReception(props.storeId)).data;if(!current(key,n))return
   if(String(r.storeId)!==String(props.storeId))throw new Error('设置门店不匹配')
   people.value=r.staff||[];selected.value=(r.selectedUserIds||[]).map(String)
 }catch(e){if(current(key,n))error.value=e.message||'读取失败，请关闭后重试'}finally{if(current(key,n))loading.value=false}
}
function toggle(id){id=String(id);if(saving.value||loading.value)return
 if(selected.value.includes(id))selected.value=selected.value.filter(x=>x!==id)
 else if(selected.value.length<2)selected.value=[...selected.value,id]
 else error.value='最多选择2位接待员工'
}
async function save(){
 if(!canManage.value||saving.value||loading.value)return
 const key=identity(),n=epoch,store=props.storeId,ids=[...selected.value];saving.value=true;error.value=''
 try{await apiChatReceptionSave(store,ids);if(!current(key,n))return
   const r=(await apiChatReception(store)).data;if(!current(key,n))return
   if(String(r.storeId)!==String(store)||JSON.stringify((r.selectedUserIds||[]).map(String))!==JSON.stringify(ids))throw new Error('保存后的设置已变化，请重新读取核对')
   selected.value=ids;people.value=r.staff||[];toast('接待设置已保存')
 }catch(e){if(current(key,n))error.value=e.message||'保存失败，选择已保留，可重试'}finally{if(current(key,n))saving.value=false}
}
</script>
<style scoped lang="scss">
.reception{margin:12px 14px;padding:12px;background:var(--k-paper);border:1px solid var(--k-line);border-radius:8px}.reception button::after{border:0}.reception button{margin:0;min-height:48px;font:inherit;color:var(--k-ink);background:var(--k-paper2);padding:10px 12px;line-height:1.5}.reception-open{display:flex;width:100%;justify-content:space-between;gap:12px;text-align:left}.reception-open text:last-child{font-size:13px;color:var(--k-muted)}.reception-panel{display:flex;flex-direction:column;gap:12px;padding-top:16px}.reception-title{font-size:16px;font-weight:600}.reception-help{font-size:13px;line-height:1.6;color:var(--k-muted)}.reception-person{display:flex;align-items:center;gap:10px;text-align:left}.reception-person text:nth-child(2){flex:1}.reception-person text:last-child{font-size:12px;color:var(--k-muted)}.reception-actions{display:flex;gap:12px}.reception-actions button{flex:1}.reception-error{font-size:13px;color:var(--k-alert)}
</style>
