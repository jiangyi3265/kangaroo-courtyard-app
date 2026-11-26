<template>
  <view class="k-page team-reports">
    <k-topbar :title="detail ? detail.title : '团队报表'" back custom-back @back="back" />
    <view class="body">
      <view v-if="!ready" class="state">正在读取查阅权限…</view>
      <view v-else-if="!allowed" class="state"><view class="state__ico"><k-icon name="lock" :size="32" color="red" /></view><text>{{ error || '未开通团队报表查阅权限，请联系平台管理员。' }}</text><button class="minor" @click="boot">重新加载</button></view>
      <template v-else>
        <view v-if="error" class="error"><text>{{ error }}</text><button class="minor" @click="detailId ? open(detailId) : search()">重试</button></view>
        <template v-if="detail">
          <text class="hint">只读查阅 · 按提交时统计口径展示，后台修订会同步反映在日报中</text>
          <view class="fields"><view v-for="(f,i) in detail.fields || []" :key="i" class="data-row"><text class="label">{{ f.label }}</text><text class="value">{{ f.value || '—' }}</text></view></view>
          <text v-if="detail.text" class="report-text">{{ detail.text }}</text>
          <view v-if="images.length" class="proofs"><image v-for="(src,i) in images" :key="src" :src="src" mode="aspectFill" @click="preview(i)" /></view>
          <button class="minor return" @click="back">返回报表列表</button>
        </template>
        <template v-else>
          <text class="hint">查看全部城市已提交的日报、周报和月度总结</text>
          <view class="tabs"><button v-for="t in kinds" :key="t.key" :class="{active:kind===t.key}" @click="switchKind(t.key)">{{ t.label }}</button></view>
          <view class="filters"><picker mode="date" fields="month" :value="month" @change="month=$event.detail.value;search()"><view class="selector"><text>{{ month }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></picker><picker :range="cityOptions" range-key="name" :value="cityIndex" @change="cityIndex=Number($event.detail.value);search()"><view class="selector"><text>{{ cityOptions[cityIndex]?.name || '全部城市' }}</text><k-icon name="chevron-down" :size="12" color="muted" /></view></picker></view>
          <view class="search"><input v-model="keyword" maxlength="40" placeholder="按填报人姓名搜索" confirm-type="search" @confirm="search" /><button class="minor" @click="search">查询</button></view>
          <text class="hint">共 {{ total }} 份{{ kind==='weekly'?' · 按周开始日期所属月份筛选':'' }}</text>
          <view v-if="rows.length" class="report-list">
          <view v-for="r in rows" :key="r.id" class="report-row" hover-class="k-press" @click="open(r.id)"><view><text class="row-title">{{ r.ownerName || '团队' }} · {{ r.period }}</text><text class="hint">{{ r.cityName }}{{ r.storeName?' · '+r.storeName:'' }} · {{ r.title || roleName(r.roleCode) }}</text><text class="hint">{{ kind==='monthly'?'生成':'提交' }}于 {{ r.submittedAt }}</text></view><k-icon name="chevron-right" :size="12" color="muted" /></view>
          </view>
          <view v-if="loading" class="state">正在读取报表…</view><view v-else-if="!rows.length && !error" class="state"><view class="state__ico"><k-icon name="file-text" :size="32" color="red" /></view><text>该筛选范围暂无已提交报表</text></view>
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
let seq=0,page=1,visible=false
let accessRequest = 0
const roleName = role => ({ keeper: '小院主理人', manager: '换工主理人', city_lead: '城市负责人' }[role] || '团队成员')
function invalidate(){
  accessRequest++; seq++; page=1
  rows.value=[]; detail.value=null; detailId.value=null; total.value=0
  cities.value=[]; cityIndex.value=0; keyword.value=''; month.value=''
  allowed.value=false; ready.value=false; loading.value=false; error.value=''
}
watch(()=>experience.account?.id, () => {
  invalidate()
  if (visible) boot()
}, {flush:'sync'})
function handleError(e){error.value=e?.message||'报表暂时无法读取';if([401,403].includes(Number(e?.code))){allowed.value=false;rows.value=[];detail.value=null;detailId.value=null}}
async function boot() {
  const request = ++accessRequest
  const current = () => visible && request === accessRequest
  ready.value = false
  error.value = ''
  try {
    await ensureSession()
    if (!current()) return
    const {data} = await get('/app/team-reports/access')
    if (!current()) return
    allowed.value = data.allowed === true
    cities.value = data.cities || []
    if (!month.value) month.value = data.month
    if (allowed.value) {
      if (detailId.value) await open(detailId.value)
      else await search()
    } else {
      rows.value = []; detail.value = null; detailId.value = null
    }
  } catch (e) {
    if (current()) { allowed.value = false; handleError(e) }
  } finally {
    if (current()) ready.value = true
  }
}
async function fetchList(append){const n=++seq;loading.value=true;error.value='';try{const r=await get('/app/team-reports',{kind:kind.value,month:month.value,cityId:cityOptions.value[cityIndex.value]?.cityId||undefined,keyword:keyword.value.trim(),pageNum:append?page+1:1});if(n!==seq||!visible)return;rows.value=append?[...rows.value,...r.data.rows]:r.data.rows||[];total.value=Number(r.data.total)||0;page=append?page+1:1}catch(e){if(n===seq)handleError(e)}finally{if(n===seq)loading.value=false}}
function search(){rows.value=[];total.value=0;detail.value=null;detailId.value=null;return fetchList(false)}
function more(){if(!loading.value)return fetchList(true)}
function switchKind(next){if(next===kind.value)return;kind.value=next;search()}
async function open(id){const n=++seq;detailId.value=id;detail.value=null;loading.value=true;error.value='';try{const r=await get('/app/team-reports/'+kind.value+'/'+id);if(n!==seq||!visible)return;detail.value=r.data;uni.pageScrollTo({scrollTop:0,duration:0})}catch(e){if(n===seq)handleError(e)}finally{if(n===seq)loading.value=false}}
function back(){if(detailId.value){seq++;detail.value=null;detailId.value=null;error.value='';loading.value=false;uni.pageScrollTo({scrollTop:0,duration:0});if (!rows.value.length && allowed.value) return search();return}if(getCurrentPages().length>1)uni.navigateBack();else uni.reLaunch({url:'/pages/profile/index'})}
function preview(i){uni.previewImage({urls:images.value,current:images.value[i]})}
onShow(() => {visible=true; return boot()})
onHide(() => {visible=false; accessRequest++; seq++; ready.value=false; detail.value=null; rows.value=[]})
onUnload(()=>{visible=false;invalidate()})
</script>
<style scoped>
.body{padding:18px 18px calc(28px + env(safe-area-inset-bottom))}.hint{display:block;font-size:12px;line-height:1.7;color:var(--k-muted);margin-top:5px}.tabs{display:flex;border-bottom:1px solid var(--k-line);margin:18px 0}.tabs button{flex:1;margin:0;border:0;border-radius:0;padding:10px 4px;font-size:15px;background:transparent;color:var(--k-muted)}.tabs button::after,.minor::after{border:0}.tabs .active{color:var(--k-ochre);font-weight:700;border-bottom:2px solid var(--k-ochre)}.filters{display:flex;gap:10px}.filters picker{flex:1;min-width:0}.selector{padding:12px;border:1px solid var(--k-line);border-radius:10px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.search{display:flex;align-items:center;gap:10px;margin:14px 0}.search input{height:44px;box-sizing:border-box;flex:1;min-width:0;border-bottom:1px solid var(--k-line);padding:10px 0;font-size:14px}.minor{display:inline-block;margin:0;padding:8px 15px;line-height:1.5;font-size:14px;color:var(--k-ochre);border:1px solid var(--k-line);border-radius:10px;background:var(--k-paper)}.report-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 0;border-bottom:1px solid var(--k-line)}.report-row>view{min-width:0}.row-title{font-size:16px;font-weight:600;line-height:1.5}.data-row{padding:15px 0;border-bottom:1px solid var(--k-line)}.label{display:block;font-weight:600;font-size:14px;line-height:1.6}.value,.report-text{display:block;white-space:pre-wrap;word-break:break-word;line-height:1.85;font-size:15px;margin-top:5px}.report-text{margin:20px 0}.proofs{display:flex;flex-wrap:wrap;gap:10px}.proofs image{width:100px;height:100px;border-radius:8px}.state{padding:32px 0;line-height:1.8;color:var(--k-muted)}.state button{display:block;margin-top:16px}.error{padding:12px;background:var(--k-paper);line-height:1.7}.error .minor{margin-left:10px}.more,.return{display:block;margin:24px auto 0}
/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：浅灰底，每份报表、每个字段一张白卡（12 圆角、不描边）；页签是灰底里的白色小块；
   筛选和搜索框是白底。字号不变（这是工作人员看报表的页面）。功能和文字不变：三类报表、月份 / 城市筛选、按姓名搜索、加载更多、详情和图片都在 */
.team-reports{--k-bg:var(--k-page);background:var(--k-page)}
.team-reports :deep(.k-navbar__title){font-family:var(--k-sans);font-size:16px;font-weight:600}
.body{padding:8px 12px calc(28px + env(safe-area-inset-bottom))}
.body>.hint{padding:0 2px}
.tabs{margin:10px 0;padding:3px;border-bottom:0;border-radius:10px;background:#EFEBE5}
.tabs button{padding:7px 4px;border-radius:8px;line-height:1.5;color:var(--k-ink2)}
.tabs .active{border-bottom:0;background:var(--k-paper);color:var(--k-red-deep);font-weight:600}
.filters{gap:8px}
.selector{border:0;background:var(--k-paper)}
.search{gap:8px;margin:8px 0}
.search input{padding:0 12px;border-bottom:0;border-radius:10px;background:var(--k-paper)}
.minor{border-color:var(--k-red-line);border-radius:999px;color:var(--k-red-deep)}
.report-row{margin-top:8px;padding:12px;border-bottom:0;border-radius:12px;background:var(--k-paper)}
.data-row{margin-top:6px;padding:10px 12px;border-bottom:0;border-radius:12px;background:var(--k-paper)}
.label{font-weight:500;color:var(--k-muted)}
.value{margin-top:2px}
.report-text{margin:6px 0 12px;padding:12px;border-radius:12px;background:var(--k-paper)}
.proofs{gap:8px}
.state{padding:32px 2px}
.error{border-radius:12px}
.more,.return{margin-top:16px}
/* 2026-11-18 评审修正：没权限 / 读取中 / 没有报表这几种提示做成居中的空状态 —— 一句说明居中，下面一个宽度适中的次按钮（之前一行靠左的灰字加通栏按钮，像调试页） */
.state{display:flex;flex-direction:column;align-items:center;padding:56px 16px 32px;text-align:center}
.state button{min-width:132px;margin-top:14px}
/* 11-18 第二轮精修（只动样子；报表的行标题、字段字号不动 —— 这是工作人员看的页面）
   1) 日报 / 周报 / 月度总结：分段控件 —— var(--k-fill) 外框 32 高、白块 28 高；字 14（选中 600 墨色、没选 400 二级墨） */
.tabs{padding:2px;border-radius:16px;background:var(--k-fill)}
.tabs button{padding:0 4px;border-radius:14px;font-size:14px;font-weight:400;line-height:28px;color:var(--k-ink2)}
.tabs .active{background:var(--k-paper);color:var(--k-ink);font-weight:600}
/* 2) 每份报表行尾的「›」换成 12 号灰箭头（模板里换了图标） */
.report-row :deep(.k-icon){flex:0 0 auto}
/* 3) 报表详情：所有字段合成一张白卡（模板里包了一层 .fields），每个字段一行、行间发丝线，最后一行下面不画；字段名和内容字号不动 */
.fields{margin-top:8px;padding:0 12px;border-radius:12px;background:var(--k-paper)}
.fields>.data-row{position:relative;margin-top:0;padding:12px 0;border-radius:0;background:transparent}
.fields>.data-row+.data-row::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
/* 4) 没权限 / 读取中 / 没有报表：白卡里居中，说明 14 / 500 二级墨，按钮是 32 高的次按钮小胶囊 */
.state{gap:8px;margin-top:8px;padding:28px 12px;border-radius:12px;background:var(--k-paper);font-size:14px;font-weight:500;line-height:1.6;color:var(--k-ink2)}
.state .minor{min-width:0;margin-top:0;padding:0 16px;font-size:13px;font-weight:500;line-height:30px}
/* 5) 月份 / 城市选择和搜索框：40 高、圆角 8；「查询」40 高圆角 20，和输入框对齐 */
.selector{height:40px;padding:0 12px;border-radius:8px;line-height:40px;box-sizing:border-box}
.search input{height:40px;border-radius:8px}
.search .minor{height:40px;border-radius:20px;line-height:38px;box-sizing:border-box}
.hint{margin-top:4px}
/* 11-18 第二轮返修：
   1) 日报 / 周报 / 月度总结：白块看着仍 28 高，透明 ::after 上下各伸 4，点按高度 36（第一轮约 36）；微信 button 默认 overflow:hidden，要放开
   2) 没权限时的「重新加载」：看着 32 高的次按钮小胶囊，上下各 6 的透明边，点按高度 44（第一轮约 39，不再变小） */
.tabs button{position:relative;height:28px;overflow:visible}
.tabs button::after{content:"";position:absolute;left:0;right:0;top:-4px;bottom:-4px;width:auto;height:auto;border:0;border-radius:0;transform:none}
.state .minor{height:44px;padding:0 16px;border:6px solid transparent;border-radius:22px;background:var(--k-paper) padding-box;box-shadow:inset 0 0 0 1px var(--k-red-line);line-height:32px;box-sizing:border-box}
/* 11-18 第三轮：页边距 16；没权限 / 没有报表的空状态加 56 的浅棕方块 + 32 号线性图标（锁 / 文件），说明 14 / 500；
   月份、城市选择里的「▾」换成 12 号 chevron-down，字和箭头两端对齐；报表行标题 15 / 600、两行说明 12 灰字 */
.body{padding-left:16px;padding-right:16px}
.state{gap:0;padding:32px 16px 28px}
.state__ico{display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-bottom:12px;border-radius:16px;background:var(--k-red-soft)}
.state>text{font-size:14px;font-weight:500;line-height:1.6;color:var(--k-ink2)}
.state .minor{margin-top:12px}
.selector{display:flex;align-items:center;justify-content:space-between;gap:6px}
.selector>text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.report-row{padding:12px}
.row-title{font-size:15px;line-height:21px}
.report-row .hint{margin-top:2px;line-height:1.5}
/* 「查询」字垂直居中（原来上下 8 的内边距把字挤到底边） */
.search .minor{display:flex;align-items:center;justify-content:center;flex:0 0 auto;margin:0;padding:0 16px;line-height:20px}
/* 11-18 第三轮返修：「加载更多」退成居中的 13 号暖棕文字（不再是满宽描边大胶囊，比报表行还重）；顶部说明、「共 N 份」贴页边距 16 */
.body>.hint,.hint{padding-left:0;padding-right:0;margin-left:0}
.more{display:block;width:auto;height:36px;min-height:36px;margin:12px auto 0;padding:0 16px;border:0;border-radius:18px;background:transparent;box-shadow:none;color:var(--k-red);font-size:13px;font-weight:500;line-height:36px}
.more::after{border:0}
/* 11-18 返修（第 2 轮）：报表合成一张白卡、每份一行（最少 64 高、左右 12），行间发丝线从卡内边距线开始（左右各 12），和订阅提醒页同一种列表写法；
   「加载更多」在卡下面 12，32 高浅棕小胶囊 */
.report-list{margin-top:8px;border-radius:12px;background:var(--k-paper);overflow:hidden}
.report-list>.report-row{position:relative;min-height:64px;margin:0;padding:12px;border-radius:0;background:transparent;box-sizing:border-box}
.report-list>.report-row+.report-row::before{content:"";position:absolute;left:12px;right:12px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.more{max-width:max-content;height:32px;min-height:32px;margin-top:12px;padding:0 16px;border-radius:16px;background:var(--k-red-soft);color:var(--k-red-deep);line-height:32px}
/* 11-18 第三轮返修（第 3 轮）：「查询」和左边搜索框同一种形状 —— 40 高、12 圆角的浅棕方按钮（不描边），不再一个方框一个全圆胶囊 */
.search input{border-radius:12px}
.search .minor{height:40px;min-height:40px;padding:0 16px;border:0;border-radius:12px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:13px;font-weight:500}
.search .minor::after{border:0}
/* 11-18 第三轮返修（第 4 轮）：报表列表行标题 15 / 600（和订阅、钱包、草稿箱的列表行一样），不再比上面的分段控件、筛选框还重 */
.report-row .row-title{font-size:15px;font-weight:600;line-height:21px}
/* 11-18 第三轮返修（第 5 轮）：分段控件选中块加极淡阴影、字用深棕，底槽加一圈发丝边，选中态一眼看得出 */
.tabs{box-shadow:inset 0 0 0 .5px var(--k-line2)}
.tabs .active{box-shadow:0 1px 2px rgba(58,50,43,.12);color:var(--k-red-deep)}
/* 11-18 第四轮（全端统一：整页只剩一个出错 / 无权限状态时不套卡）：直接放在浅灰底上、离顶栏约 96；
   56 浅棕方块 + 32 号锁 → 16 → 文案 14 / 500 二级墨（最宽 264、行高 1.6）→ 16 →「重新加载」32 高描边小钮 */
.state{margin-top:72px;padding:0 16px;border-radius:0;background:transparent}
.state>text{max-width:264px;font-size:14px;font-weight:500;line-height:1.6;color:var(--k-ink2)}
.state__ico{margin-bottom:16px}
.state .minor{margin-top:16px}
/* 11-18 第四轮返修：无权限 / 空状态说明只在标点、空格处折行：「未开通团队报表查阅权限，」/「请联系平台管理员。」，不再把「管理员」拆开 */
.state>text{max-width:300px;word-break:keep-all;overflow-wrap:anywhere}
/* 11-19 微信实拍返修：无权限 / 读取中这类整页状态离顶栏 88（和消息提醒、积分商城统一）；状态句 14 / 500 是主角，「重新加载」退成 13 / 400 暖棕，离句子 20 */
.body>.state{margin-top:88px}
.state .minor{margin-top:20px;font-size:13px;font-weight:400}
</style>
