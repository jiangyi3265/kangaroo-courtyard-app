<template>
  <view class="k-page team-reports">
    <k-topbar :title="detail ? detail.title : '团队报表'" back custom-back @back="back" />
    <view class="body">
      <view v-if="!ready" class="state">正在读取查阅权限…</view>
      <view v-else-if="!allowed" class="state"><text>{{ error || '未开通团队报表查阅权限，请联系平台管理员。' }}</text><button class="minor" @click="boot">重新加载</button></view>
      <template v-else>
        <view v-if="error" class="error"><text>{{ error }}</text><button class="minor" @click="detailId ? open(detailId) : search()">重试</button></view>
        <template v-if="detail">
          <text class="hint">只读查阅 · 按提交时统计口径展示，后台修订会同步反映在日报中</text>
          <view v-for="(f,i) in detail.fields || []" :key="i" class="data-row"><text class="label">{{ f.label }}</text><text class="value">{{ f.value || '—' }}</text></view>
          <text v-if="detail.text" class="report-text">{{ detail.text }}</text>
          <view v-if="images.length" class="proofs"><image v-for="(src,i) in images" :key="src" :src="src" mode="aspectFill" @click="preview(i)" /></view>
          <button class="minor return" @click="back">返回报表列表</button>
        </template>
        <template v-else>
          <text class="hint">查看全部城市已提交的日报、周报和月度总结</text>
          <view class="tabs"><button v-for="t in kinds" :key="t.key" :class="{active:kind===t.key}" @click="switchKind(t.key)">{{ t.label }}</button></view>
          <view class="filters"><picker mode="date" fields="month" :value="month" @change="month=$event.detail.value;search()"><view class="selector">{{ month }} ▾</view></picker><picker :range="cityOptions" range-key="name" :value="cityIndex" @change="cityIndex=Number($event.detail.value);search()"><view class="selector">{{ cityOptions[cityIndex]?.name || '全部城市' }} ▾</view></picker></view>
          <view class="search"><input v-model="keyword" maxlength="40" placeholder="按填报人姓名搜索" confirm-type="search" @confirm="search" /><button class="minor" @click="search">查询</button></view>
          <text class="hint">共 {{ total }} 份{{ kind==='weekly'?' · 按周开始日期所属月份筛选':'' }}</text>
          <view v-for="r in rows" :key="r.id" class="report-row" hover-class="k-press" @click="open(r.id)"><view><text class="row-title">{{ r.ownerName || '团队' }} · {{ r.period }}</text><text class="hint">{{ r.cityName }}{{ r.storeName?' · '+r.storeName:'' }} · {{ r.title || roleName(r.roleCode) }}</text><text class="hint">{{ kind==='monthly'?'生成':'提交' }}于 {{ r.submittedAt }}</text></view><text class="arrow">›</text></view>
          <view v-if="loading" class="state">正在读取报表…</view><view v-else-if="!rows.length && !error" class="state">该筛选范围暂无已提交报表</view>
          <button v-if="rows.length<total" class="minor more" :disabled="loading" @click="more">加载更多</button>
        </template>
      </template>
    </view>
  </view>
</template>
<script setup>
import { ref,computed,watch } from 'vue'
import { onShow,onHide,onUnload } from '@dcloudio/uni-app'
import { ensureSession,experience } from '@/common/experience.js'
import { get } from '@/common/request.js'
import { absUrl } from '@/common/upload.js'
const kinds=[{key:'daily',label:'日报'},{key:'weekly',label:'周报'},{key:'monthly',label:'月度总结'}]
const ready=ref(false),allowed=ref(false),error=ref(''),loading=ref(false),rows=ref([]),total=ref(0),kind=ref('daily'),month=ref(''),cityIndex=ref(0),cities=ref([]),keyword=ref(''),detail=ref(null),detailId=ref(null)
const cityOptions=computed(()=>[{cityId:null,name:'全部城市'},...cities.value]),images=computed(()=>String(detail.value?.images||'').split(',').filter(Boolean).map(absUrl))
let seq=0,page=1,visible=true
const roleName=r=>r==='keeper'?'小院主理人':'换工主理人'
function invalidate(){seq++;rows.value=[];detail.value=null;detailId.value=null;total.value=0;allowed.value=false;ready.value=false}
watch(()=>experience.account?.id,invalidate)
function handleError(e){error.value=e?.message||'报表暂时无法读取';if([401,403].includes(Number(e?.code))){allowed.value=false;rows.value=[];detail.value=null;detailId.value=null}}
async function boot(){visible=true;await ensureSession();const n=++seq;ready.value=false;error.value='';try{const r=await get('/app/team-reports/access');if(n!==seq||!visible)return;allowed.value=r.data.allowed===true;cities.value=r.data.cities||[];if(!month.value)month.value=r.data.month;if(!allowed.value){rows.value=[];detail.value=null;detailId.value=null;return}if(detailId.value)await open(detailId.value);else await search()}catch(e){if(n===seq){allowed.value=false;handleError(e)}}finally{if(visible)ready.value=true}}
async function fetchList(append){const n=++seq;loading.value=true;error.value='';try{const r=await get('/app/team-reports',{kind:kind.value,month:month.value,cityId:cityOptions.value[cityIndex.value]?.cityId||undefined,keyword:keyword.value.trim(),pageNum:append?page+1:1});if(n!==seq||!visible)return;rows.value=append?[...rows.value,...r.data.rows]:r.data.rows||[];total.value=Number(r.data.total)||0;page=append?page+1:1}catch(e){if(n===seq)handleError(e)}finally{if(n===seq)loading.value=false}}
function search(){rows.value=[];total.value=0;detail.value=null;detailId.value=null;return fetchList(false)}
function more(){if(!loading.value)return fetchList(true)}
function switchKind(next){if(next===kind.value)return;kind.value=next;search()}
async function open(id){const n=++seq;detailId.value=id;detail.value=null;loading.value=true;error.value='';try{const r=await get('/app/team-reports/'+kind.value+'/'+id);if(n!==seq||!visible)return;detail.value=r.data;uni.pageScrollTo({scrollTop:0,duration:0})}catch(e){if(n===seq)handleError(e)}finally{if(n===seq)loading.value=false}}
function back(){if(detailId.value){seq++;detail.value=null;detailId.value=null;error.value='';loading.value=false;uni.pageScrollTo({scrollTop:0,duration:0});return}if(getCurrentPages().length>1)uni.navigateBack();else uni.reLaunch({url:'/pages/profile/index'})}
function preview(i){uni.previewImage({urls:images.value,current:images.value[i]})}
onShow(boot);onHide(()=>{visible=false;seq++;detail.value=null;rows.value=[]});onUnload(()=>{visible=false;invalidate()})
</script>
<style scoped>
.body{padding:18px 18px calc(28px + env(safe-area-inset-bottom))}.hint{display:block;font-size:12px;line-height:1.7;color:var(--k-muted);margin-top:5px}.tabs{display:flex;border-bottom:1px solid var(--k-line);margin:18px 0}.tabs button{flex:1;margin:0;border:0;border-radius:0;padding:10px 4px;font-size:15px;background:transparent;color:var(--k-muted)}.tabs button::after,.minor::after{border:0}.tabs .active{color:var(--k-ochre);font-weight:700;border-bottom:2px solid var(--k-ochre)}.filters{display:flex;gap:10px}.filters picker{flex:1;min-width:0}.selector{padding:12px;border:1px solid var(--k-line);border-radius:10px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.search{display:flex;align-items:center;gap:10px;margin:14px 0}.search input{height:44px;box-sizing:border-box;flex:1;min-width:0;border-bottom:1px solid var(--k-line);padding:10px 0;font-size:14px}.minor{display:inline-block;margin:0;padding:8px 15px;line-height:1.5;font-size:14px;color:var(--k-ochre);border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper)}.report-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;border-bottom:1px solid var(--k-line)}.report-row>view{min-width:0}.row-title{font-size:16px;font-weight:600;line-height:1.5}.arrow{color:var(--k-muted)}.data-row{padding:15px 0;border-bottom:1px solid var(--k-line)}.label{display:block;font-weight:600;font-size:14px;line-height:1.6}.value,.report-text{display:block;white-space:pre-wrap;word-break:break-word;line-height:1.85;font-size:15px;margin-top:5px}.report-text{margin:20px 0}.proofs{display:flex;flex-wrap:wrap;gap:10px}.proofs image{width:100px;height:100px;border-radius:8px}.state{padding:32px 0;line-height:1.8;color:var(--k-muted)}.state button{display:block;margin-top:16px}.error{padding:12px;background:var(--k-paper);line-height:1.7}.error .minor{margin-left:10px}.more,.return{display:block;margin:24px auto 0}
</style>
