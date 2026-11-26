<template>
  <view class="k-page benefits" :class="$userSurface">
    <k-topbar :title="benefitId ? '权益详情' : '会员权益'" back />
    <view class="k-body k-pad-tab">
      <template v-if="!benefitId">
        <view class="intro"><text class="eyebrow">成长有礼 · 一起发现好店</text><text class="intro-title">我的成长与会员权益</text><view class="current-level"><level-icon v-if="member" :level="member.level" :size="26" /><text class="muted">{{ member ? '当前等级：' + member.levelName : '登录后可查看当前等级适用的权益' }}</text></view></view>
        <view v-if="levels.length" class="level-overview">
          <text class="section-title">等级权益</text>
          <text class="muted level-help">点击等级查看权益内容与使用条件</text>
          <scroll-view scroll-x class="level-tabs" :show-scrollbar="false" :scroll-into-view="levelScrollId">
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
        <view class="search"><k-icon name="search" :size="16" color="muted" /><input v-model="keyword" maxlength="30" placeholder="搜索店铺、权益或折扣" confirm-type="search" @confirm="reload" /><button @click="reload">搜索</button></view>
        <view class="filters"><button @click="chooseCity"><k-icon name="map-pin" :size="14" color="ink2" /><text>{{ city || '全部城市' }}</text><k-icon name="chevron-down" :size="12" color="muted" /></button><text class="muted">{{ total }} 项合作店权益</text></view>
        <scroll-view scroll-x class="categories"><button v-for="categoryItem in categories" :key="categoryItem.value" :class="{ selected: category === categoryItem.value }" @click="selectCategory(categoryItem.value)">{{ categoryItem.label }}</button></scroll-view>
        <view v-if="loading && !rows.length" class="state muted">正在查找合作店权益…</view>
        <view v-else-if="error" class="state"><text>{{ error }}</text><k-button type="ghost" @click="reload">重新加载</k-button></view>
        <view v-else-if="!rows.length" class="state"><view class="state__ico"><k-icon name="store" :size="32" color="red" /></view><text>暂无{{ keyword || city || category ? '符合筛选条件的' : '上架的' }}合作店权益</text><text class="muted">{{ keyword || city || category ? '换个城市或分类试试，也可以清除筛选。' : '合作店优惠上架后会在这里展示，等级权益可在上方查看。' }}</text><k-button v-if="keyword || city || category" type="ghost" @click="clearFilters">查看全部合作店</k-button></view>
        <view v-for="benefitItem in rows" :key="benefitItem.benefitId" class="benefit-row" hover-class="k-press" @click="openBenefit(benefitItem)">
          <image v-if="benefitItem.cover" class="shop-image" :src="absUrl(benefitItem.cover)" mode="aspectFill" /><view v-else class="shop-placeholder"><k-icon name="store" :size="28" color="red" /></view>
          <view class="benefit-copy"><text class="shop-name">{{ benefitItem.merchantName }}</text><text class="discount" :class="{ 'discount--long': String(benefitItem.discountText || '').length > 24 }">{{ benefitItem.discountText }}</text><text class="muted">{{ [benefitItem.city, benefitItem.title].filter(Boolean).join(' · ') }}</text><view class="eligibility"><text class="level-tag">{{ benefitItem.levelLabel }}</text><text :class="benefitItem.eligible ? 'available' : 'muted'">{{ benefitItem.eligibilityText }}</text></view></view>
          <k-icon name="chevron-right" :size="12" color="muted" />
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
          <k-button block class="benefit-sub" @click="go(R.profile + '?s=3')">{{ memberSignedIn ? '查看我的会员信息' : '登录查看会员信息' }}</k-button>
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
// 11-18 微信核对：横滑区左右贴到屏幕边、首颗靠左外边距留出 16；直接滚到选中那颗会把它顶到屏幕边上 —— 改成滚到它前一颗，选中第一级时不滚
const levelScrollId=computed(()=>{const i=levels.value.findIndex(x=>x.level===selectedLevel.value?.level);return i>0?'benefit-level-'+levels.value[i-1].level:''})
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
.benefits { background:linear-gradient(140deg,#FAF6EE,#F8F8F4);font-family:var(--k-sans); }
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

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：会员权益列表和权益详情 —— 浅灰底、白卡 12 圆角、不描边不加阴影，图、字、按钮收小一档。
   功能和文字不变：等级切换、领取 / 查看积分、搜索、城市、分类、每条权益、加载更多、详情里的申请使用都在。
   搜索框 36 高；分类胶囊和搜索钮看着是 28 / 30 高，四周留一圈透明边，点按区仍有 36。 */
.benefits { --k-bg:var(--k-page);--k-radius:12px;background:var(--k-page);font-size:13px; }
.benefits :deep(.k-navbar__title) { font-family:var(--k-sans);font-size:16px;font-weight:600; }
.benefits .k-body { padding-top:8px;padding-left:12px;padding-right:12px; }
.benefits :deep(.k-button.is-lg) { height:44px;font-size:15px;box-shadow:none; }
.benefits :deep(.k-button.is-ghost) { height:36px;padding:0 14px;border-color:var(--k-red-line);border-radius:999px;background:var(--k-paper);color:var(--k-red-deep);font-size:13px;font-weight:500; }
.intro { gap:4px;margin-bottom:8px;padding:14px 12px;border:0;border-radius:12px;background:linear-gradient(105deg,#FAEBD0,#F0D8AC); }
.eyebrow { font-size:11px;letter-spacing:0;color:#8A6A35; }
.intro-title { font-size:17px;line-height:1.4;color:#5E3D1F; }
.current-level { gap:6px; }
.intro .muted { font-size:12px;color:#7A5A22; }
.level-overview { padding:12px;border-bottom:0;border-radius:12px;background:var(--k-paper); }
.section-title { margin-bottom:0;font-size:15px;font-weight:700;color:var(--k-ink); }
.level-help { margin:2px 0 8px;font-size:11px;line-height:1.5; }
.level-tabs { margin:8px 0 10px; }
.level-tabs button { min-width:72px;min-height:52px;margin-right:6px;padding:6px 10px;border:0;border-radius:8px;background:var(--k-page);font-size:13px; }
.level-tabs button.selected { background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-weight:600; }
.level-tabs button.selected .level-points { font-weight:400; }
.level-details { padding:12px;border:0;border-radius:8px;background:#F9F7F3; }
.level-heading { margin-bottom:6px; }
.level-heading .level-help { margin:1px 0 0; }
.level-rule { margin-top:6px;line-height:1.65;color:var(--k-ink2); }
.level-rule :deep(.k-icon) { margin-top:3px; }
.actions { gap:8px;margin-top:10px; }
.shop-section-heading { gap:2px;padding:16px 2px 8px; }
.shop-section-heading .muted { font-size:11px; }
.search { gap:8px;height:36px;padding-left:12px;padding-right:0;border:0;background:var(--k-paper);box-shadow:none; }
.search input { height:36px;font-size:13px; }
.search button { height:36px;min-height:36px;margin:0;padding:0 14px;border:3px solid transparent;background:linear-gradient(135deg,#B5814D,#8E5E33) padding-box;color:var(--k-paper);font-size:13px; }
.filters { padding:2px; }
.filters button { gap:4px;min-height:44px;font-size:13px; }
.filters .muted { font-size:11px; }
.categories { padding-bottom:2px; }
.categories button { height:36px;min-height:36px;padding:0 12px;border:4px solid transparent;border-radius:999px;background-color:var(--k-paper);background-clip:padding-box;color:var(--k-ink2);font-size:12px; }
.categories .selected { background-color:var(--k-red-soft);background-clip:padding-box;color:var(--k-red-deep);font-weight:600; }
.state { gap:10px;padding:36px 16px; }
.benefit-row { gap:10px;margin-top:8px;padding:12px;border:0;border-radius:12px;box-shadow:none; }
.shop-image,.shop-placeholder { width:76px;height:76px;border-radius:8px; }
.shop-placeholder { background:linear-gradient(145deg,#FCF4E8,#F4E4CC); }
.benefit-copy { gap:2px; }
.shop-name { font-size:14px;font-weight:600;line-height:20px; }
.level-heading .shop-name { display:block;font-size:15px; }
.discount { font-size:15px;line-height:1.4;color:var(--k-red-deep); }
.benefit-copy>.muted { font-size:11px; }
.eligibility { margin-top:2px;font-size:11px; }
.more { min-height:44px;margin-top:8px;font-size:13px;color:var(--k-red-deep); }
/* 权益详情 */
.detail-image { height:200px;border-radius:12px; }
.detail-heading { margin:8px 0 0;padding:12px;border-radius:12px;box-shadow:none; }
.detail-title { margin:2px 0;font-size:17px;font-weight:700; }
.detail-discount { margin:2px 0;font-size:18px;color:var(--k-red-deep); }
.detail-section { gap:6px;margin-top:8px;padding:12px;border:0;border-radius:12px;box-shadow:none; }
.detail-section textarea { padding:10px 12px;border-color:var(--k-line2); }
.rules { font-size:13px;line-height:1.75; }
.expand { font-size:13px;color:var(--k-red-deep); }
.use-error { color:var(--k-alert);font-size:12px; }
.detail-section+.k-button { margin-top:12px; }
.footnote { margin:12px 0 20px;font-size:11px; }
/* 2026-11-18 评审修正（只动样子） */
/* 1) 合作店列表里的优惠那一行最多两行、超出省略（之前有的店写了一长段，棕色粗字排了 4 行还没写完，把卡撑得比别的高一大截）；字 14 / 600。完整内容点进权益详情看，详情页不受影响 */
.benefit-copy>.discount { display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px;font-weight:600;line-height:20px; }
/* 2) 选中的等级块只用浅棕底 + 深棕字，不再套一圈棕色描边 */
.level-tabs button.selected { box-shadow:none; }
/* 11-18 第二轮精修（只动样子；不可点的按钮交给公共组件整体变淡 .45，不再盖成冷灰块）
   1) 「搜索」从实心棕钮改成浅底小按钮：看着 28 高（四周 4 的透明边，点按高度仍 36），浅棕底深棕字 12 / 500；搜索框里的放大镜在模板里改成 16 号灰色，不再靠半透明调淡 */
.search button { padding:0 12px;border:4px solid transparent;border-radius:18px;background:var(--k-red-soft) padding-box;color:var(--k-red-deep);font-size:12px;font-weight:500;line-height:28px; }
/* 2) 分类胶囊选中 500 字重（和全站筛选胶囊一样） */
.categories .selected { font-weight:500; }
/* 3) 读取中 / 出错 / 没有权益：放进白卡里居中；标题 14 / 500 二级墨，说明 12 灰、行高 1.6；按钮是 32 高的次按钮小胶囊 */
.state { gap:8px;margin-top:8px;padding:28px 12px;border-radius:12px;background:var(--k-paper);font-size:14px;font-weight:500;line-height:1.6;color:var(--k-ink2); }
.state.muted { font-size:12px;font-weight:400;color:var(--k-muted); }
.state > .muted { font-size:12px;font-weight:400;color:var(--k-muted); }
/*    按钮原来 48 高：看着 32，上下各 6 的透明边，点按高度仍是 44 */
.state :deep(.k-button.is-ghost) { height:44px;padding:0 16px;border:6px solid transparent;border-radius:22px;background:var(--k-paper) padding-box;box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-size:13px;font-weight:500; }
/* 4) 区块标题：卡外的「合作店权益」16 / 700、行高 22；卡里的（等级权益、店铺介绍、使用规则等）14 / 600 */
.shop-section-heading .section-title { font-size:16px;font-weight:700;line-height:22px; }
.level-overview .section-title, .detail-section .section-title { font-size:14px;font-weight:600; }
/* 5) 权益详情底部「查看我的会员信息」退成次按钮（白底、细棕边、深棕字），一屏只留「提交使用申请」一个实心主按钮；高度仍 44 */
.benefits :deep(.k-button.benefit-sub) { border-color:var(--k-red-line);background:var(--k-paper);color:var(--k-red-deep); }
/* 11-18 第三轮（主人：间距布局不精致）：
   1) 页边距 16；
   2) 等级选择：灰色大方块（约 70×52、最后一块被截成「巨…」）改成一排 32 高的胶囊，积分写在胶囊里（11 号），右边留 16 让最后一个能完整滑出来；
   3) 两颗按钮各占一半、36 高、13 / 600，铺满卡内宽度；
   4) 合作店卡：照片 1:1（72）；店名 14 / 600 墨色，优惠 13 / 500 深棕单行省略（不再和店名一样大抢标题），城市分类 12 灰；
      「大袋鼠及以上」做成 17 高的浅棕小标签，后面跟可用状态 11 号字；卡内行距 4；
   5) 没有权益的空状态：56 浅棕方块 + 32 号线性图标 */
.benefits .k-body { padding-left:16px;padding-right:16px; }
.intro { padding:16px; }
.level-overview { padding:14px 12px 12px; }
.level-tabs { width:auto;margin:4px -12px 12px;padding:0 12px;white-space:nowrap; }
.level-tabs button { display:inline-flex;flex-direction:row;align-items:center;gap:4px;min-width:0;height:32px;min-height:32px;margin-right:8px;padding:0 12px;border-radius:16px;background:var(--k-paper2);color:var(--k-ink2);font-size:13px;line-height:32px; }
.level-tabs button:last-child { margin-right:24px; }
.level-tabs button.selected { background:var(--k-red-soft);color:var(--k-red-deep);font-weight:500; }
.level-points { font-size:11px;line-height:32px;color:var(--k-muted); }
.level-tabs button.selected .level-points { color:var(--k-red-deep);opacity:.8; }
.level-details { padding:12px; }
.actions { display:flex;gap:8px; }
.level-overview .actions :deep(.k-button) { flex:1;min-width:0;height:36px;padding:0 8px;font-size:13px;font-weight:600; }
.benefit-row { align-items:center;gap:12px; }
.shop-image,.shop-placeholder { flex:0 0 72px;width:72px;height:72px; }
.shop-placeholder { display:flex;align-items:center;justify-content:center;background:var(--k-red-soft); }
.benefit-copy { gap:4px; }
.benefit-copy>.shop-name { overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:var(--k-ink); }
.benefit-copy>.discount { display:block;-webkit-line-clamp:unset;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:13px;font-weight:500;line-height:18px;color:var(--k-red-deep); }
.benefit-copy>.muted { font-size:12px;line-height:17px; }
.eligibility { display:flex;align-items:center;gap:6px;margin-top:0;font-size:11px;line-height:17px; }
.level-tag { flex:0 0 auto;height:17px;padding:0 5px;border-radius:4px;background:var(--k-red-soft);color:var(--k-red-deep);font-size:11px;font-weight:500;line-height:17px; }
.state__ico { display:flex;align-items:center;justify-content:center;width:56px;height:56px;margin-bottom:4px;border-radius:16px;background:var(--k-red-soft); }
.shop-section-heading { padding:20px 4px 10px; }
/* 11-18 第三轮返修：
   1) 等级胶囊横滑区：左右留白放进滚动内容里（第一颗左边 12、最后一颗右边 12），切口落在卡片边上，不再在卡内边距线被一刀切；
   2) 等级详情不再白卡里套灰底框：去掉灰底，上下各一道发丝线；
   3) 「合作店权益」标题贴页边距 16；搜索钮 28 高、离右边 4，和左边放大镜对称；城市行到分类胶囊收紧到约 12；
   4) 320 宽：等级权益两颗按钮上下排、各自满宽 */
.level-tabs { margin-left:-12px;margin-right:-12px;padding:0; }
.level-tabs button:first-child { margin-left:12px; }
.level-tabs button:last-child { margin-right:12px; }
.level-details { position:relative;padding:12px 0;border:0;border-radius:0;background:transparent; }
.level-details::before, .level-details::after { content:"";position:absolute;left:0;right:0;height:1px;background:var(--k-line);transform:scaleY(.5); }
.level-details::before { top:0;transform-origin:0 0; }
.level-details::after { bottom:0;transform-origin:0 100%; }
.level-overview .actions { margin-top:12px; }
.shop-section-heading { padding-left:0;padding-right:0; }
.search { padding-right:4px; }
.search button { height:28px;min-height:28px;margin:0;padding:0 12px;border:0;border-radius:14px;background:var(--k-red-soft);line-height:28px; }
.search button::after { border:0; }
.filters button { min-height:36px; }
.categories { margin-top:-4px; }
@media (max-width:359px) {
  .level-overview .actions { flex-direction:column; }
  .level-overview .actions :deep(.k-button) { flex:none;width:100%; }
}
/* 11-18 返修（第 2 轮）：
   1) 等级胶囊：没选中的白底 + 发丝描边、二级墨 400，选中的浅棕底、深棕 600（和下面「全部 / 住宿…」分类胶囊一个写法）——之前两种底色几乎一样，看不出选了哪级；
   2) 顶部介绍卡和「等级权益」白卡之间 12（之前只有 8，挤在一起） */
.level-tabs button { background:var(--k-paper);box-shadow:inset 0 0 0 1px var(--k-line);color:var(--k-ink2);font-weight:400; }
.level-tabs button .level-points { color:var(--k-muted); }
.level-tabs button.selected { background:var(--k-red-soft);box-shadow:none;color:var(--k-red-deep);font-weight:600; }
.level-tabs button.selected .level-points { color:var(--k-red-deep); }
.intro { margin-bottom:12px; }
/* 11-18 第三轮返修（第 3 轮）：
   1) 「等级权益」「合作店权益」两个同级区块，标题都放在卡外、一样大（17 / 700，下面 12 号灰字说明，再下 12），页面上只有顶部卡的标题是 20；
      等级胶囊横滑区贴着页面左右边（首尾各留 16），选中等级的权益放进白卡（不再白卡里再套发丝线），两颗按钮在白卡下面；
   2) 区块之间 20；
   3) 合作店卡：照片和店名顶对齐；等级小标签和资格说明同一行，放不下时说明省略，不再折到第 5 行把卡撑高；
   4) 搜索框、城市行的图标按模板里的大小（16 / 14 / 12），不再用样式硬压。 */
.intro { margin-bottom:0; }
.intro-title { font-size:20px;font-weight:700;line-height:28px; }
.level-overview { margin-top:20px;padding:0;border-radius:0;background:transparent; }
.level-overview > .section-title, .shop-section-heading .section-title { display:block;font-size:17px;font-weight:700;line-height:24px;color:var(--k-ink); }
.level-overview > .level-help, .shop-section-heading .muted { display:block;margin:2px 0 0;font-size:12px;line-height:17px;color:var(--k-muted); }
.level-tabs { margin:12px -16px 0;padding:0; }
.level-tabs button:first-child { margin-left:16px; }
.level-tabs button:last-child { margin-right:16px; }
.level-details { margin-top:12px;padding:12px;border-radius:12px;background:var(--k-paper); }
.level-details::before, .level-details::after { display:none; }
.level-details ~ .level-help { margin-top:8px; }
.level-overview .actions { margin-top:12px; }
.shop-section-heading { display:flex;flex-direction:column;gap:0;padding:20px 0 12px; }
.benefit-row { align-items:flex-start; }
.benefit-row > :deep(.k-icon) { align-self:center; }
.eligibility { flex-wrap:nowrap;min-width:0; }
.eligibility > text:last-child { min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis; }
/* 11-18 第三轮返修（第 4 轮）：分类胶囊横滑条和上面的等级胶囊一样贴着屏幕左右边滑出去（胶囊自带 4 的透明边，首尾再留 12，看得见的胶囊仍从 16 开始）；
   「N 项合作店权益」右边让出 24，往下滑时不再贴着悬浮客服钮 */
.categories { width:auto;margin-left:-16px;margin-right:-16px; }
.categories button:first-child { margin-left:12px; }
.categories button:last-child { margin-right:12px; }
.filters { padding-right:24px; }
/* 权益说明折行时两行差不多长，375 宽不再只剩「用）」掉到第二行 */
.level-rule text { text-wrap:balance; }
/* 11-18 第三轮返修（第 5 轮）：「N 项合作店权益」回到页面右边线（和搜索框、卡片右边对齐）；权益说明只在空格、标点处折行（「…限本人入住，」/「法定节假日不可用）」），整段太长才在字中间断 */
.filters { padding:2px; }
.level-rule text { text-wrap:wrap; word-break:keep-all; overflow-wrap:anywhere; }
/* 11-18 第四轮（高级感）：
   1) 合作店卡的主角是优惠内容：完整显示、按内容折行（不再一行省略），13 / 500 深棕、行高 18；
      等级要求去掉浅棕底，改成 11 / 500 深棕文字，和资格说明同一行、放不下就折行；卡与卡之间 12；
   2) 等级胶囊和分类胶囊同一种写法：32 高，未选白底、二级墨 400，选中浅棕底 + 1px 棕线 + 深棕 500；
   3) 搜索框里的「搜索」不再是浅棕色块：13 / 600 暖棕文字，前面一道竖发丝线；
   4) 两颗描边大按钮改成白卡下面的两条 13 / 500 暖棕文字链接（中间竖发丝线），右边让出 40 给客服竖条。 */
.benefit-copy>.discount { white-space:normal;overflow:visible;text-overflow:clip;word-break:break-all;line-height:18px; }
.eligibility { flex-wrap:wrap;row-gap:0;column-gap:6px; }
.eligibility > text:last-child { min-width:0;overflow:visible;white-space:normal;text-overflow:clip; }
.level-tag { height:auto;padding:0;border-radius:0;background:transparent;color:var(--k-red-deep);font-size:11px;font-weight:500;line-height:17px; }
.benefit-row { margin-top:12px; }
.level-tabs button, .categories button { height:32px;min-height:32px;padding:0 12px;border:0;border-radius:16px;background:var(--k-paper);box-shadow:none;color:var(--k-ink2);font-size:12px;font-weight:400;line-height:32px; }
.categories button { margin-right:8px; }
.level-tabs button.selected, .categories button.selected { background:var(--k-red-soft);box-shadow:inset 0 0 0 1px var(--k-red-line);color:var(--k-red-deep);font-weight:500; }
.level-tabs button::after, .categories button::after { border:0; }
.search button { position:relative;height:36px;min-height:36px;padding:0 12px;border-radius:0;background:transparent;color:var(--k-red);font-size:13px;font-weight:600;line-height:36px; }
.search button::before { content:"";position:absolute;left:0;top:10px;bottom:10px;width:1px;background:var(--k-line2);transform:scaleX(.5); }
.level-overview .actions { flex-direction:row;flex-wrap:wrap;gap:0;margin-top:4px;padding-right:40px; }
.level-overview .actions :deep(.k-button) { position:relative;flex:none;width:auto;min-width:0;height:40px;padding:0 12px;border:0;border-radius:0;background:transparent;box-shadow:none;color:var(--k-red-deep);font-size:13px;font-weight:500; }
.level-overview .actions :deep(.k-button:first-child) { padding-left:0; }
.level-overview .actions :deep(.k-button + .k-button)::before { content:"";position:absolute;left:0;top:14px;bottom:14px;width:1px;background:var(--k-line2);transform:scaleX(.5); }
.level-overview .actions :deep(.k-button)::after { border:0; }
.categories button:first-child { margin-left:16px; }
.categories button:last-child { margin-right:16px; }
@media (max-width:359px) {
  .level-overview .actions { flex-direction:column;align-items:flex-start; }
  .level-overview .actions :deep(.k-button + .k-button) { padding-left:0; }
  .level-overview .actions :deep(.k-button + .k-button)::before { display:none; }
}
/* 11-18 第四轮返修：
   1) 顶部介绍卡去掉渐变底，做成页头（小字眉题 → 20 / 700 大标题 → 当前等级一行），等级胶囊横条直接接在下面；全页只有这一个大标题，
      「等级权益」「合作店权益」两个区块标题降到 17 / 600；
   2) 320 宽两条文字链接上下排时每条 32 高、中间 4，不再像两行飘着的字；
   3) 合作店名最多两行，不再被省略号截掉。 */
.intro { gap:4px; padding:4px 0 0; border:0; border-radius:0; background:transparent; box-shadow:none; }
.intro-title { color:var(--k-ink); }
.intro .muted { color:var(--k-ink2); }
.level-overview { margin-top:16px; }
.level-overview > .section-title, .shop-section-heading .section-title { font-size:17px; font-weight:600; }
.benefit-copy>.shop-name { display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; white-space:normal; overflow:hidden; text-overflow:clip; overflow-wrap:anywhere; }
@media (max-width:359px) {
  .level-overview .actions { gap:4px; margin-top:8px; }
  .level-overview .actions :deep(.k-button) { height:32px; min-height:32px; margin:0; line-height:32px; }
}
/* 11-19 微信实拍返修：
   1) 优惠文字只在标点、词和数字的边界处换行（不再 break-all 把「基础」「399元」「豪华」拆开），整段太长才在字中间断；
   2) 超过 24 个字的长优惠说明退成 13 / 400 二级墨，暖棕 500 只留给「8折」「八五折」这类短优惠，一张卡不再压成一大块棕字；
   3) 卡右箭头不再随卡高竖直居中：固定在封面图中线（上 34），长卡、短卡的箭头同一个位置；
   4) 页头大标题 20 / 700 下面隔 24 才是区块标题，区块标题「等级权益」「合作店权益」降到 16 / 600，两层标题拉开。 */
.benefit-copy>.discount { word-break:normal; overflow-wrap:anywhere; text-wrap:pretty; }
.benefit-copy>.discount.discount--long { color:var(--k-ink2); font-weight:400; }
.benefit-row > :deep(.k-icon) { align-self:flex-start; margin-top:34px; }
.level-overview { margin-top:24px; }
.level-overview > .section-title, .shop-section-heading .section-title { font-size:16px; font-weight:600; line-height:22px; }
</style>
