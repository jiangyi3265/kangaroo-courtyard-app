<template>
  <!-- 选择目的地独占一个面板；当前定位不会自动成为已选城市。 -->
  <view class="cp-root">
    <view class="cp-mask" @click="emit('close')" @touchmove.stop.prevent />
    <view class="cp" :style="{ paddingTop: topInset + 'px' }">
      <view class="cp__head" @touchmove.stop.prevent>
        <view class="cp__back" hover-class="k-press" @click="emit('close')"><k-icon name="chevron-left" :size="22" color="ink" :stroke="1.8" /></view>
        <view class="cp__heading"><text class="cp__title">选择城市</text><text class="cp__num">已选 {{ picked.length }}/{{ max }}</text></view>
        <view class="cp__done" hover-class="k-press" @click="confirm"><text>完成</text></view>
      </view>
      <view class="cp__search" @touchmove.stop.prevent>
        <k-icon name="search" :size="16" color="muted" :stroke="1.8" />
        <input v-model="keyword" class="cp__input" maxlength="20" confirm-type="search" :placeholder="searchPh" placeholder-class="cp__ph" @confirm="hideKeyboard" />
        <view v-if="keyword" class="cp__clear" hover-class="k-press" @click="keyword = ''"><k-icon name="x" :size="14" color="muted" :stroke="2" /></view>
      </view>
      <scroll-view scroll-y class="cp__picked" :style="{ height: pickedHeight + 'px' }">
        <view class="cp__selected-content">
        <text v-if="!picked.length" class="cp__none">不选城市，查看全国岗位</text>
        <view v-else class="cp__picked-scroll">
          <view class="cp__picked-inner">
            <view v-for="pickedName in picked" :key="pickedName" class="cp-tag" hover-class="k-press-s" @click="toggle(pickedName)"><k-icon name="circle-check" :size="16" color="#8A603D" :stroke="2.2" /><text class="cp-tag__name">{{ shortCity(pickedName) }}</text><k-icon name="x" :size="12" color="muted" :stroke="2" /></view>
          </view>
        </view>
        </view>
      </scroll-view>
      <scroll-view scroll-y class="cp__body" :scroll-into-view="intoView">
        <template v-if="query">
          <view v-for="rowItem in results" :key="rowItem.name" class="cp-row" hover-class="k-press" @click="toggle(rowItem.pick || rowItem.name)">
            <view class="cp-row__main"><view class="cp-row__line"><text class="cp-row__name" :class="{ on: picked.includes(rowItem.city) }">{{ rowItem.label }}</text><text v-if="rowItem.scenic" class="cp-row__kind">景区片区</text></view><text v-if="rowItem.region" class="cp-row__region">{{ rowItem.region }}</text></view>
            <text v-if="rowItem.count" class="cp-row__count">{{ rowItem.count }} 个岗位</text>
            <view class="cp-check" :class="{ on: picked.includes(rowItem.city) }"><k-icon v-if="picked.includes(rowItem.city)" name="check" :size="11" color="white" :stroke="3" /></view>
          </view>
          <text v-if="!results.length" class="cp-state">{{ loading ? '正在加载城市…' : '没有找到「' + query + '」，试试城市全称、区县或拼音' }}</text>
        </template>
        <template v-else>
          <template v-if="hotCities.length">
            <text class="cp-head">热门城市</text>
            <view class="cp-cells">
              <view v-for="hotName in hotCities" :key="'h' + hotName" class="cp-cell" :class="{ on: picked.includes(hotName) }" hover-class="k-press-s" @click="toggle(hotName)"><text class="cp-cell__name">{{ hotName }}</text></view>
            </view>
          </template>
          <text v-if="letterGroups.length" class="cp-head">全部城市</text>
          <template v-if="letterGroups.length">
            
            <view v-for="groupItem in letterGroups" :id="'cpl-' + groupItem.letter" :key="'g' + groupItem.letter">
              <text class="cp-letter-head">{{ groupItem.letter }}</text>
              <view class="cp-cells">
                <view v-for="cityRow in groupItem.items" :key="'c' + cityRow.name" class="cp-cell cp-cell--az" :class="{ on: picked.includes(cityRow.city) }" hover-class="k-press-s" @click="toggle(cityRow.name)"><text class="cp-cell__name cp-cell__name--full">{{ cityRow.label }}</text><text v-if="cityRow.prov" class="cp-cell__prov">{{ cityRow.prov }}</text></view>
              </view>
            </view>
          </template>
          <text v-if="loading && !jobCities.length && !hot.length" class="cp-state">正在加载城市…</text>
          <text v-else-if="loadFailed && !jobCities.length && !hot.length" class="cp-state">城市列表暂时取不到，可以直接输入城市名</text>
          <text class="cp-tip">想去的地方不在上面？在搜索框输入城市、区县或拼音</text>
        </template>
      </scroll-view>
      <view v-if="!query" class="cp-index" aria-label="城市首字母索引"><button v-for="g in letterGroups" :key="g.letter" @click="jumpLetter(g.letter)">{{ g.letter }}</button></view>
      <view class="cp__foot" @touchmove.stop.prevent>
        <view class="cp__reset" hover-class="k-press" @click="picked = []"><text>重置</text></view>
        <view class="cp__ok" hover-class="k-press-s" @click="confirm"><text>{{ picked.length ? '确认城市（' + picked.length + '）' : '查看全国岗位' }}</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, watch, getCurrentInstance } from 'vue'
import { groupCities, businessCityName } from '@/common/city-directory.js'
import { toggleCitySelection } from '@/common/city-picker-model.js'
import { citySuggestions } from '../job-city-search.js'
import { loadJobCityDirectory, loadJobCities } from '../job-city-source.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  type: { type: String, default: 'volunteer' },   // 当前页签：「有岗位的城市」按它统计
  value: { type: Array, default: () => [] },      // 打开时已选的城市
  max: { type: Number, default: 5 }
})
const emit = defineEmits(['close', 'confirm'])

const picked = ref([...new Set(props.value)].slice(0, props.max))
const pickedHeight = ref(40)
const instance = getCurrentInstance()
function measurePicked() {
  nextTick(() => {
    uni.createSelectorQuery().in(instance.proxy).select('.cp__selected-content').boundingClientRect((rect) => {
      if (rect) pickedHeight.value = Math.min(64, Math.max(40, Math.ceil(rect.height) + 16))
    }).exec()
  })
}
onMounted(measurePicked)
watch(picked, measurePicked)
const keyword = ref('')
const topInset = (() => { try { const s = uni.getSystemInfoSync(); return (s.statusBarHeight || 0) + 44 } catch (_) { return 44 } })()
const query = computed(() => keyword.value.trim())
const loading = ref(false)
const loadFailed = ref(false)
const hot = ref(dirHot)
const jobCities = ref(jobCityCache[props.type] || [])
// 字典行（3000 多行，含区县）放在模块变量里，不放进页面数据：渲染只用联想出来的前 40 行
const dirTick = ref(dirRows.length)

function load() {
  if (!dirRows.length) {
    loading.value = true
    if (!dirPromise) dirPromise = loadJobCityDirectory().then((d) => { dirRows = d.all || []; dirHot = d.hot || [] })
    dirPromise.then(() => { hot.value = dirHot; dirTick.value = dirRows.length }).catch(() => { dirPromise = null; loadFailed.value = true }).finally(() => { loading.value = false })
  }
  const type = props.type
  if (!jobCityCache[type] && type !== 'online') {
    loadJobCities(type).then((r) => { jobCityCache[type] = r || []; jobCities.value = jobCityCache[type] }).catch(() => {})
  }
}
load()

// 「湘潭·湖南省」→「湘潭」：只用来显示，选中、查岗位还是用字典里的原名
const shortCity = (name) => String(name || '').split('·')[0]
// 联想：先列名字里带这个词的「有岗位的城市」，再列字典匹配的城市 / 区县（城市名、全称、省、上级、拼音、首字母、别名）。
// 排序：有岗位的在前；再按名字以这个词开头 → 名字里有这个词 → 只是省 / 上级 / 拼音对上；同一档城市在区县前面
const results = computed(() => {
  if (dirTick.value < 0) return []
  return citySuggestions(dirRows, jobCities.value, query.value)
})
const hotCities = computed(() => hot.value)

// 按字母分组：字典里城市级的行（不含区县，约 370 个），按后端给的首字母排；字典没取到时整块不显示。
// 和别处重名的城市字典里叫「湘潭·湖南省」，一格放不下被截成「湘潭·湖…」：格子里只写「湘潭」，省份（去掉「省 / 自治区」）
// 作小字跟在后面，只在放得下时显示（一格约 65px：城市名 + 省份合计不超过 5 个字）；城市名不截断，太长就在格子里折行
const shortProvince = (p) => String(p || '').replace(/(维吾尔|壮族|回族)?自治区$|特别行政区$|省$|市$/, '')
const letterGroups = computed(() => (dirTick.value > 0 ? groupCities(dirRows.filter(row => row.level !== 'district')).map(groupItem => ({
  ...groupItem,
  items: groupItem.items.map((row) => {
    const label = shortCity(row.name)
    const prov = label !== row.name ? shortProvince(row.province) : ''
    return { name: row.name, city: row.cityName || row.name, label, prov: prov && label.length + prov.length <= 5 ? prov : '' }
  })
})) : []))
// 点字母跳到那一组：先清空再设，连点同一个字母也会再滚过去
const intoView = ref('')
function jumpLetter(letter) {
  intoView.value = ''
  nextTick(() => { intoView.value = 'cpl-' + letter })
}

function toggle(name) {
  const city = businessCityName(dirRows, name)
  if (city !== name && !picked.value.includes(city)) uni.showToast({ title: `已按所属城市「${city}」选择`, icon: 'none' })
  const next = toggleCitySelection(picked.value, city, props.max)
  if (next.limited) { uni.showToast({ title: `最多选 ${props.max} 个城市`, icon: 'none' }); return }
  picked.value = next.selected
  // 从联想里选完清空搜索词，接着输入下一个城市
  if (query.value) keyword.value = ''
}
// 城市、区县、拼音均支持联想。
const SEARCH_PH = '搜索城市、区县或拼音'
const SEARCH_PH_NARROW = '搜索城市、区县或拼音'
const searchPh = (() => { try { return (uni.getSystemInfoSync().windowWidth || 375) < 360 ? SEARCH_PH_NARROW : SEARCH_PH } catch (e) { return SEARCH_PH } })()
const hideKeyboard = () => uni.hideKeyboard()
const confirm = () => { hideKeyboard(); emit('confirm', picked.value.slice()) }
</script>

<script>
// 模块级缓存：同一次打开小程序里，城市字典只取一次，「有岗位的城市」每个页签取一次
let dirRows = []
let dirHot = []
let dirPromise = null
const jobCityCache = {}
</script>

<style scoped lang="scss">
/* 2026-11-03 主人：选城市也不铺满屏幕 —— 底部弹层约半屏（定高 56vh：小程序里 scroll-view 要有确定高度才滚得动），
   城市列表在中间自己滚，搜索框和「重置 / 查看全国岗位」固定在上下两头；点暗处关闭（不保存） */
.cp-mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 80; background: rgba(58, 50, 43, .36); }
.cp { position: fixed; left: 0; right: 0; bottom: 0; height: 100vh; max-height: 100vh; box-sizing: border-box; z-index: 81; animation: cp-up .2s ease-out; display: flex; flex-direction: column; border-radius: 0; background: #FFFFFF; box-shadow: 0 12px 36px rgba(58, 50, 43, .12); overflow: hidden; color: #3A322B; }
@keyframes cp-up { from { transform: translateY(40px); opacity: .4; } to { transform: none; opacity: 1; } }
.cp__head { position: relative; flex: 0 0 auto; height: 48px; display: flex; align-items: center; gap: 2px; padding: 0 10px 0 6px; }
.cp__back { width: 40px; height: 44px; display: flex; align-items: center; justify-content: center; }
.cp__heading { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; }
.cp__title { flex: 0 0 auto; font-size: 16px; font-weight: 600; }
/* 保留微信胶囊和系统状态栏的安全空间。 */
.cp__head::before { display: none; content: ''; position: absolute; left: 50%; top: 5px; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: #E4D9CB; }
.cp__num { flex: 0 0 auto; font-size: 11px; color: #7A7570; }
.cp__done { flex: 0 0 auto; height: 44px; padding: 0 8px; display: flex; align-items: center; font-size: 14px; font-weight: 500; color: #8A603D; }
.cp__search { flex: 0 0 auto; margin: 0 18px 2px; height: 38px; box-sizing: border-box; padding: 0 12px; border: 1px solid #E7E0D7; border-radius: 12px; background: #FCFAF7; display: flex; align-items: center; gap: 8px; }
.cp__input { flex: 1; min-width: 0; height: 36px; font-size: 14px; color: #3A322B; }
.cp__ph { color: #7A7570; font-size: 13px; }
.cp__clear { width: 28px; height: 36px; display: flex; align-items: center; justify-content: center; }
.cp__picked { flex: 0 0 auto; max-height: 112px; min-height: 40px; box-sizing: border-box; padding: 8px 18px 8px; }
.cp__none { font-size: 12px; line-height: 22px; color: #7A7570; }
.cp__picked-scroll { width: 100%; }
.cp__picked-inner { display: flex; flex-wrap: wrap; gap: 6px; }
.cp-tag { flex: 0 0 auto; min-height: 32px; max-width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 10px; background: #F4E9DB; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #78512E; }
.cp-tag__name { min-width: 0; line-height: 18px; overflow-wrap: anywhere; font-weight: 500; }
.cp__body { padding-right: 38px !important; flex: 1; height: 0; min-height: 0; box-sizing: border-box; padding: 0 18px; border-top: 1px solid #F1EDE7; }
/* #ifdef H5 */
.cp__body :deep(.uni-scroll-view), .cp__picked :deep(.uni-scroll-view) { overscroll-behavior: contain; }
/* #endif */
.cp-head { display: block; padding: 12px 0 8px; font-size: 13px; font-weight: 600; }
.cp-cells { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.cp-cell { min-height: 42px; min-width: 0; box-sizing: border-box; padding: 8px 5px; border: 1px solid transparent; border-radius: 10px; background: #F7F5F1; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 13px; font-weight: 400; color: #51483F; }
.cp-cell.on { border-color: #B79772; background: #F4E9DB; color: #78512E; font-weight: 600; }
.cp-cell__name { min-width: 0; white-space: normal; word-break: break-all; text-align: center; line-height: 1.4; }
.cp-cell__prov { flex: 0 0 auto; font-size: 10px; color: #7A7570; }
.cp-cell__count { flex: 0 0 auto; font-size: 11px; color: #7A7570; }
.cp-all { margin-top: 12px; min-height: 42px; border-top: 1px solid #F1EDE7; border-bottom: 1px solid #F1EDE7; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #51483F; }
.cp-all__right { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #7A7570; }
.cp-letters { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; padding: 12px 0; }
.cp-letter { height: 36px; border-radius: 8px; background: #F7F5F1; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #51483F; }
.cp-letter-head { display: block; padding: 14px 0 8px; font-size: 13px; font-weight: 600; color: #8A603D; }
.cp-row { min-height: 56px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid #F1EDE7; }
.cp-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.cp-row__line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.cp-row__name { min-width: 0; font-size: 14px; color: #3A322B; line-height: 1.5; }
.cp-row__kind { flex: 0 0 auto; height: 16px; padding: 0 5px; border-radius: 4px; background: #F4E9DB; color: #78512E; font-size: 10px; line-height: 16px; }
.cp-row__name.on { color: #78512E; font-weight: 600; }
.cp-row__region { margin-top: 2px; font-size: 11px; color: #7A7570; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cp-row__count { flex: 0 0 auto; font-size: 11px; color: #557B69; }
.cp-check { flex: 0 0 auto; width: 18px; height: 18px; box-sizing: border-box; border: 1px solid #D8CFC4; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.cp-check.on { border-color: #8A603D; background: #8A603D; }
.cp-state { display: block; padding: 24px 0; font-size: 13px; line-height: 1.6; color: #7A7570; }
.cp-tip { display: block; padding: 16px 0; font-size: 11px; line-height: 1.6; color: #7A7570; }
.cp__foot { flex: 0 0 auto; display: flex; gap: 10px; padding: 8px 18px calc(10px + var(--k-safe-bottom)); border-top: 1px solid #EDE8E1; }
.cp__reset, .cp__ok { height: 42px; box-sizing: border-box; border-radius: 21px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; }
.cp__reset { flex: 0 0 32%; border: 1px solid #D8CFC4; color: #51483F; }
.cp__ok { flex: 1; min-width: 0; background: #8A603D; color: #FFFFFF; }
@media (max-width: 359px) {
  .cp__title { font-size: 15px; }
  .cp__heading { gap: 6px; }
  .cp__body { padding: 0 14px; }
  .cp__search { margin-left: 14px; margin-right: 14px; }
  .cp__picked, .cp__foot { padding-left: 14px; padding-right: 14px; }
}
.cp-index { position:absolute; right:5px; top:230px; bottom:85px; display:flex; flex-direction:column; justify-content:center; width:26px; }
.cp-index button { flex:1; min-height:14px; max-height:23px; margin:0; padding:0; line-height:20px; width:26px; background:transparent; color:#78512E; font-size:11px; }
.cp-index button::after { border:0; }
</style>
