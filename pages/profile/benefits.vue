<template>
  <view class="k-page benefits">
    <k-topbar :title="benefitId ? '权益详情' : '会员权益'" back />
    <view class="k-body k-pad-tab">
      <template v-if="!benefitId">
        <view class="intro"><text class="eyebrow">成长有礼 · 一起发现好店</text><text class="intro-title">我的成长与会员权益</text><view class="current-level"><level-icon v-if="member" :level="member.level" :size="26" /><text class="muted">{{ member ? '当前等级：' + member.levelName : '登录后可查看当前等级适用的权益' }}</text></view></view>
        <view v-if="levels.length" class="level-overview">
          <text class="section-title">等级权益</text>
          <text class="muted level-help">点击等级查看权益内容与使用条件</text>
          <scroll-view scroll-x class="level-tabs" :show-scrollbar="false" :scroll-into-view="'benefit-level-' + selectedLevel?.level">
            <button v-for="levelItem in levels" :id="'benefit-level-' + levelItem.level" :key="levelItem.level" :class="{ selected: selectedLevel?.level === levelItem.level }" @click="selectedLevelId=levelItem.level"><text>{{ levelItem.levelName }}</text><text class="level-points">{{ levelItem.minPoints }} 积分</text></button>
          </scroll-view>
          <view v-if="selectedLevel" class="level-details">
            <view class="level-heading"><level-icon :level="selectedLevel.level" :size="40" /><view><text class="shop-name">{{ selectedLevel.levelName }}</text><text class="muted level-help">{{ benefitLevelStatus(selectedLevel, member) }}</text></view></view>
            <view v-for="(line, i) in selectedLevel.items" :key="i" class="level-rule"><k-icon name="check" :size="16" color="red" /><text>{{ line }}</text></view>
            <text v-if="!selectedLevel.items.length" class="muted">该等级权益说明待补充</text>
          </view>
          <text v-if="!executionEnabled" class="muted level-help">等级权益可查看，领取和兑换暂未开放。</text>
          <view class="actions"><k-button v-if="memberSignedIn && executionEnabled" type="ghost" @click="go('/pages/profile/member-wallet')">领取权益与使用记录</k-button><k-button type="ghost" @click="go(R.profile + '?s=3')">{{ memberSignedIn ? '查看成长积分与规则' : '登录查看我的等级' }}</k-button></view>
        </view>
        <view class="shop-section-heading"><text class="section-title">合作店权益</text><text class="muted">查看店铺优惠、适用等级和到店规则</text></view>
        <view class="search"><k-icon name="search" :size="19" /><input v-model="keyword" maxlength="30" placeholder="搜索店铺、权益或折扣" confirm-type="search" @confirm="reload" /><button @click="reload">搜索</button></view>
        <view class="filters"><button @click="chooseCity"><k-icon name="map-pin" :size="17" /><text>{{ city || '全部城市' }}</text><k-icon name="chevron-down" :size="16" /></button><text class="muted">{{ total }} 项合作店权益</text></view>
        <scroll-view scroll-x class="categories"><button v-for="categoryItem in categories" :key="categoryItem.value" :class="{ selected: category === categoryItem.value }" @click="selectCategory(categoryItem.value)">{{ categoryItem.label }}</button></scroll-view>
        <view v-if="loading && !rows.length" class="state muted">正在查找合作店权益…</view>
        <view v-else-if="error" class="state"><text>{{ error }}</text><k-button type="ghost" @click="reload">重新加载</k-button></view>
        <view v-else-if="!rows.length" class="state"><k-icon name="store" :size="34" color="muted" /><text>暂无{{ keyword || city || category ? '符合筛选条件的' : '上架的' }}合作店权益</text><text class="muted">{{ keyword || city || category ? '换个城市或分类试试，也可以清除筛选。' : '合作店优惠上架后会在这里展示，等级权益可在上方查看。' }}</text><k-button v-if="keyword || city || category" type="ghost" @click="clearFilters">查看全部合作店</k-button></view>
        <view v-for="benefitItem in rows" :key="benefitItem.benefitId" class="benefit-row" hover-class="k-press" @click="openBenefit(benefitItem)">
          <image v-if="benefitItem.cover" class="shop-image" :src="absUrl(benefitItem.cover)" mode="aspectFill" /><view v-else class="shop-placeholder"><k-icon name="store" :size="30" color="red" :stroke="1.6" /></view>
          <view class="benefit-copy"><text class="shop-name">{{ benefitItem.merchantName }}</text><text class="discount">{{ benefitItem.discountText }}</text><text class="muted">{{ [benefitItem.city, benefitItem.title].filter(Boolean).join(' · ') }}</text><view class="eligibility"><text :class="benefitItem.eligible ? 'available' : 'muted'">{{ benefitItem.eligibilityText }}</text><text class="muted">{{ benefitItem.levelLabel }}</text></view></view>
          <k-icon name="chevron-right" :size="18" color="muted" />
        </view>
        <button v-if="hasMore && !error" class="more" :disabled="loading" @click="fetchList(true)">{{ loading ? '加载中…' : '加载更多权益' }}</button>
      </template>
      <template v-else>
        <view v-if="loading" class="state muted">正在读取权益…</view>
        <view v-else-if="error" class="state"><text>{{ error }}</text><k-button type="ghost" @click="loadDetail">重新加载</k-button><k-button type="ghost" @click="go(R.memberBenefits)">查看其他权益</k-button></view>
        <template v-else-if="detail">
          <image v-if="detail.cover" class="detail-image" :src="absUrl(detail.cover)" mode="aspectFill" />
          <view class="detail-heading"><text class="eyebrow">{{ [detail.city, categoryLabel(detail.category)].filter(Boolean).join(' · ') }}</text><text class="detail-title">{{ detail.merchantName }}</text><text class="discount detail-discount">{{ detail.discountText }}</text><text class="muted">{{ detail.title }}</text></view>
          <view v-if="intro.text" class="detail-section"><text class="section-title">店铺介绍</text><text class="rules">{{ introOpen ? intro.text : intro.short }}</text><button v-if="intro.long" class="expand" @click="introOpen=!introOpen">{{ introOpen ? '收起' : '展开全部' }}</button></view>
          <view class="detail-section"><text class="section-title">适用会员</text><text>{{ detail.levelLabel }}</text><text :class="detail.eligible ? 'available' : 'muted'">{{ detail.eligibilityText }}</text><text class="muted">{{ validity }}</text></view>
          <view class="detail-section"><text class="section-title">使用规则</text><text class="rules">{{ detail.rules }}</text></view>
          <view v-if="detail.address || detail.phone" class="detail-section"><text class="section-title">到店信息</text><text v-if="detail.address">{{ detail.address }}</text><view class="actions"><k-button v-if="detail.address" type="ghost" @click="copyAddress">复制地址</k-button><k-button v-if="detail.phone" type="ghost" @click="callShop">联系店铺</k-button></view></view>
          <view v-if="detail.eligible" class="detail-section"><text class="section-title">申请使用权益</text><text class="muted">填写到店时间、商品或预订需求，平台确认后完成核销。底价不与其他折扣叠加。</text><textarea v-model="useContent" maxlength="1000" placeholder="例如：11月8日晚两人到店，使用会员餐饮底价"/><text v-if="useError" class="use-error">{{ useError }}</text><text v-if="useSuccess" class="available">{{ useSuccess }}</text><k-button block :disabled="using" @click="useBenefit">{{ using ? '提交中…' : '提交使用申请' }}</k-button><k-button type="ghost" @click="go('/pages/profile/member-wallet')">查看处理结果</k-button></view>
          <k-button block @click="go(R.profile + '?s=3')">{{ memberSignedIn ? '查看我的会员信息' : '登录查看会员信息' }}</k-button>
          <text class="footnote">到店使用前，请确认适用商品、使用时段与叠加限制。</text>
        </template>
      </template>
    </view>
    <!-- 之前没传 mode：员工身份打开会员权益时底栏变成了用户底栏 -->
    <k-tabbar active="profile" :mode="experience.mode" />
  </view>
</template>
<script setup>
import { ref, computed } from 'vue'
import { onLoad, onShow, onHide, onReachBottom, onPullDownRefresh } from '@dcloudio/uni-app'
import { apiMemberBenefits, apiMemberBenefit, apiMemberAction } from '@/common/api.js'
import { absUrl } from '@/common/upload.js'
import { selectCity } from '@/common/city-picker.js'
import { experience } from '@/common/experience.js'
import { go, toast } from '@/common/screen.js'
import R from '@/common/routes.js'
// 等级小图标（10-18）：和「我的」会员卡同一枚（品牌袋鼠贴纸 + 等级圆环和徽记）
import LevelIcon from './components/level-icon.vue'
import { benefitLevels, benefitLevelStatus } from './member-benefits-model.js'
const categories=[{value:'',label:'全部'},{value:'stay',label:'住宿'},{value:'food',label:'餐饮'},{value:'coffee',label:'咖啡茶饮'},{value:'bar',label:'酒吧'},{value:'experience',label:'体验玩乐'},{value:'shopping',label:'购物'},{value:'other',label:'其他'}]
const benefitId=ref(null), keyword=ref(''),city=ref(''),category=ref(''),rows=ref([]),total=ref(0),page=ref(1),hasMore=ref(false),member=ref(null),detail=ref(null),loading=ref(false),error=ref('')
const useContent=ref(''),useError=ref(''),useSuccess=ref(''),using=ref(false)
const levels=ref([]), selectedLevelId=ref(null), executionEnabled=ref(false)
const selectedLevel=computed(()=>levels.value.find(item=>item.level===selectedLevelId.value) || levels.value.find(item=>item.level===Number(member.value?.level)) || levels.value[0])
let useKey=''
async function useBenefit(){
  if(using.value)return
  useError.value='';useSuccess.value=''
  if(useContent.value.trim().length<2){useError.value='请填写使用需求';return}
  using.value=true
  useKey=useKey||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)
  try{await apiMemberAction('request',{benefitId:Number(benefitId.value),content:useContent.value,requestId:useKey});useKey='';useContent.value='';useSuccess.value='申请已提交，可在我的会员权益中查看处理结果'}catch(e){useError.value=e.message||'提交失败，请重试'}finally{using.value=false}
}
let request=0
const memberSignedIn=computed(()=>!!experience.account)
const categoryLabel=value=>categories.find(item=>item.value===value)?.label || '合作店铺'
const dateText=value=>value ? String(value).slice(0,10) : ''
const validity=computed(()=>detail.value?.endTime ? `有效期：${dateText(detail.value.startTime) || '即日起'} 至 ${dateText(detail.value.endTime)}` : '有效期：上架期间有效，具体限制见使用规则')
// 店铺介绍（后台「会员店铺权益」里填）：纯文本、保留换行，没填不显示；超过 5 行或 120 个字先显示前面一段，点「展开全部」看全文
const INTRO_LINES=5, INTRO_CHARS=120
function introParts(value){
  const text=String(value ?? '').replace(/\r\n?/g,'\n').replace(/^\s*\n/,'').trimEnd()
  const short=Array.from(text.split('\n').slice(0,INTRO_LINES).join('\n')).slice(0,INTRO_CHARS).join('')
  return short===text ? {text,short:text,long:false} : {text,short:short.trimEnd()+'…',long:true}
}
const intro=computed(()=>introParts(detail.value?.intro)), introOpen=ref(false)
async function fetchList(append=false) {
  if(append && (loading.value || !hasMore.value)) return
  const token=++request, next=append?page.value+1:1
  loading.value=true; error.value=''
  try {
    const {data}=await apiMemberBenefits({keyword:keyword.value,city:city.value,category:category.value,pageNum:next})
    if(token!==request)return
    rows.value=append?rows.value.concat(data.rows || []):(data.rows || []);total.value=data.total || 0;hasMore.value=!!data.hasMore;page.value=next;member.value=data.member
    levels.value=benefitLevels(data);executionEnabled.value=data.executionEnabled===true
  } catch(e) {if(token===request){error.value=e?.message || '权益读取失败，请重试';if(!append)rows.value=[]}}
  finally{if(token===request){loading.value=false;listInterrupted=false}}
}
const reload=()=>fetchList(false)
async function loadDetail(){const token=++request;loading.value=true;error.value='';detail.value=null;try{const {data}=await apiMemberBenefit(benefitId.value);if(token===request)detail.value=data}catch(e){if(token===request)error.value=e?.message || '权益暂不可用'}finally{if(token===request)loading.value=false}}
async function chooseCity(){const value=await selectCity({value:city.value,allowAll:true});if(value!==null){city.value=value;reload()}}
function selectCategory(value){category.value=value;reload()}
function clearFilters(){keyword.value='';city.value='';category.value='';reload()}
const openBenefit=item=>go(R.memberBenefits+'?id='+item.benefitId)
const copyAddress=()=>uni.setClipboardData({data:detail.value.address})
const callShop=()=>{const phone=String(detail.value.phone || '').replace(/[\s-]/g,'');if(!/^\+?\d{5,20}$/.test(phone))return toast('请按店铺说明联系商家');uni.makePhoneCall({phoneNumber:phone})}
onLoad(query=>{benefitId.value=query.id || null})
// 之前：每次回到列表（看完权益详情、选完城市）都从第 1 页重新拉，「加载更多」翻过的后几页和滚动位置全丢。
// 现在：列表已经加载过、且离开时没有请求被打断，就保持原样；首次进入、上次请求被 onHide 打断或列表为空时才重新拉
let listInterrupted=true
onShow(()=>benefitId.value?loadDetail():((listInterrupted || !rows.value.length) && reload()))
onHide(()=>{if(loading.value)listInterrupted=true;request++;loading.value=false})
onReachBottom(()=>{if(!benefitId.value)fetchList(true)})
onPullDownRefresh(()=>Promise.resolve(benefitId.value?loadDetail():reload()).finally(()=>uni.stopPullDownRefresh()))
</script>
<style scoped lang="scss">
.detail-section textarea{width:100%;box-sizing:border-box;min-height:100px;border:1px solid #dfd1be;padding:12px;border-radius:10px;font-size:14px}.use-error{color:#a74837;font-size:13px}
.benefits { font-size:14px; line-height:1.6; }
.level-overview{padding:0 0 24px;border-bottom:1px solid var(--k-line)}
.level-help{display:block;margin:5px 0 10px;font-size:12px;line-height:1.6}
.level-tabs{white-space:nowrap;margin:12px 0}
.level-tabs button{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-height:62px;min-width:76px;margin-right:8px;padding:8px 12px;border:1px solid var(--k-line);border-radius:12px}
.level-tabs button.selected{color:var(--k-red);border-color:var(--k-red);background:var(--k-paper2)}
.level-points{font-size:11px;color:var(--k-muted)}
.level-details{padding:16px;background:var(--k-paper);border:1px solid var(--k-line);border-radius:16px}
.level-heading{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.level-heading .level-help{margin:3px 0 0}
.level-rule{display:flex;align-items:flex-start;gap:8px;margin-top:10px;white-space:pre-wrap;overflow-wrap:anywhere}
.level-rule text{flex:1;min-width:0}
.shop-section-heading{display:flex;flex-direction:column;gap:4px;padding:24px 0 12px}
.shop-section-heading .muted{font-size:12px}
.intro { padding:8px 0 22px; display:flex; flex-direction:column; gap:8px; }
.eyebrow { display:block; color:var(--k-green); font-size:14px; }
.intro-title { font-size:22px; line-height:1.5; font-family:var(--k-serif); font-weight:700; }
.muted,.footnote { color:var(--k-muted); }
.current-level { display:flex; align-items:center; gap:8px; }
.search { display:flex; align-items:center; gap:10px; border:1px solid var(--k-line); border-radius:999px; padding-left:14px; background:var(--k-paper); }
.search input { flex:1; min-width:0; height:48px; font-size:14px; }
button { color:var(--k-ink); font-size:14px; background:transparent; border:0; line-height:1.5; margin:0; }
button::after { border:0; }
.search button { min-height:48px; padding:0 16px; display:flex; align-items:center; }
.filters { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; }
.filters button { display:flex; align-items:center; gap:6px; padding:0; min-height:48px; }
.categories { white-space:nowrap; padding-bottom:4px; }
.categories button { display:inline-flex; align-items:center; min-height:48px; padding:0 16px; border-radius:24px; }
.categories .selected { color:var(--k-red); background:var(--k-red-soft,var(--k-paper2)); font-weight:600; }
/* 10-18：每条权益一张白卡（圆角 16、柔和阴影），不再是一条条分隔线 */
.benefit-row { display:flex; align-items:center; gap:12px; margin-top:12px; padding:12px; border-radius:16px; background:var(--k-paper); box-shadow:var(--k-sh1); }
.shop-image,.shop-placeholder { width:76px; height:76px; border-radius:12px; flex-shrink:0; }
.shop-placeholder { display:flex; align-items:center; justify-content:center; background:linear-gradient(145deg,#FBF1E4 0%,#F3E1C8 100%); }
.benefit-copy { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; overflow-wrap:anywhere; }
.shop-name { font-size:16px; font-weight:600; }
.discount { color:var(--k-red); font-size:18px; font-weight:700; line-height:1.4; }
.eligibility { display:flex; flex-wrap:wrap; gap:4px 10px; margin-top:4px; }
.available { color:var(--k-green); }
.state { display:flex; flex-direction:column; gap:14px; padding:42px 16px; text-align:center; align-items:center; }
/* 全局 button 的 line-height 是 inherit（这里 1.5），48px 高的按钮文字会贴在顶上，要显式居中 */
.more { width:100%; min-height:48px; margin-top:12px; color:var(--k-red); display:flex; align-items:center; justify-content:center; }
.detail-image { width:100%; height:190px; border-radius:12px; margin-bottom:20px; }
.detail-title { display:block; font-size:26px; font-weight:600; margin:8px 0; overflow-wrap:anywhere; }
.detail-discount { display:block; font-size:24px; margin:8px 0; }
.detail-section { display:flex; flex-direction:column; gap:8px; padding:24px 0; border-top:1px solid var(--k-line); margin-top:20px; overflow-wrap:anywhere; }
.section-title { font-size:18px; font-weight:600; margin-bottom:4px; }
.rules { white-space:pre-wrap; line-height:1.85; }
.expand { align-self:flex-start; min-height:44px; padding:0; color:var(--k-red); display:flex; align-items:center; }
.actions { display:flex; flex-wrap:wrap; gap:10px; }
.footnote { display:block; margin:14px 0 24px; text-align:center; }
.benefits { --k-paper:#FFFEFC;background:linear-gradient(140deg,#FAF6EE,#F8F8F4);font-family:var(--k-sans); }
.intro { padding:16px;margin-bottom:18px;gap:6px;border:1px solid #EFE2CD;border-radius:20px;background:linear-gradient(125deg,#F6EAD4,#FCF9F0); }
.intro-title { font-family:var(--k-sans);font-size:21px;color:#59402D; }
.eyebrow { color:#9D7747;font-size:12px;letter-spacing:.4px; }
.search { box-shadow:0 3px 10px rgba(89,64,33,.04);border-color:#D7C5A9;padding-right:4px; }
.search button { min-height:40px;margin:4px 0;border-radius:999px;background:#AF7C3F;color:#FFFDF7;padding:0 16px; }
.categories .selected { background:#EED9B8;color:#835A2B; }
.benefit-row { padding:14px;border:1px solid #EFE6D8;border-radius:20px;box-shadow:0 5px 14px rgba(83,60,34,.055);gap:12px; }
.shop-image,.shop-placeholder { width:82px;height:90px;border-radius:13px; }
.shop-name { font-size:17px;font-weight:650; }
.benefit-copy>.muted { font-size:12px; }
.eligibility { font-size:12px;gap:4px 8px; }
.detail-image { border-radius:20px;height:210px;margin-bottom:0; }
.detail-heading { position:relative;margin:-16px 8px 0;padding:17px 16px;background:#FFFEFC;border-radius:18px;box-shadow:0 5px 14px rgba(83,60,34,.06); }
.detail-title { font-size:24px;margin:5px 0; }
.detail-discount { margin:6px 0;font-size:25px;color:#A5763C; }
.detail-section { margin-top:14px;padding:16px;border:1px solid #EFE6D8;border-radius:18px;background:#FFFEFC;box-shadow:0 4px 12px rgba(83,60,34,.04); }
.section-title { font-size:17px;color:#57402E; }
.rules { font-size:14px;line-height:1.85; }
.detail-section+.k-button { margin-top:18px; }
@media(max-width:350px) { .intro-title { font-size:18px; }.shop-image,.shop-placeholder { width:66px;height:80px; }.benefit-row { gap:10px;padding:12px; }.shop-name { font-size:16px; } }
</style>
