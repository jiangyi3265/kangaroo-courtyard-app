<template>
  <view class="k-page">
    <k-topbar title="兴趣城市" back custom-back @back="back" />
    <view class="k-body interests">
      <text class="k-title">下一站，想去哪里？</text>
      <text class="intro">选择你感兴趣的旅居城市，可多选，也可以先逛逛。</text>
      <button class="city-search" @click="searchCities"><k-icon name="search" :size="20" color="muted" /><text>搜索全国城市、区县 / 拼音</text><k-icon name="chevron-right" :size="18" color="muted" /></button>
      <view v-if="selected.length" class="selected-cities"><button v-for="name in selected" :key="name" @click="toggle(name)"><text>{{ name }}</text><k-icon name="x" :size="14" color="red" /></button></view>
      <view class="cities">
        <button v-for="city in cities" :key="city.name" class="city" :class="{ selected: selected.includes(city.name) }" @click="toggle(city.name)">
          <image :src="city.icon" mode="aspectFit" /><text>{{ city.name }}</text>
          <view v-if="selected.includes(city.name)" class="tick"><k-icon name="check" :size="12" color="white" /></view>
        </button>
      </view>
      <image class="map" src="/static/media/onb-map.jpg" mode="aspectFit" />
      <text class="intro">这里只保存兴趣。出发日期、停留时长和个人资料，在报名或预订时再填写。</text>
    </view>
    <k-bottom flat><view class="actions">
      <k-button block @click="save">保存并返回首页</k-button>
      <k-button type="ghost" block @click="leave">暂不设置，继续逛逛</k-button>
    </view></k-bottom>
  </view>
</template>
<script setup>
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { back, relaunch, replace, toast } from '@/common/screen.js'
import { experience, loadPreferences, savePreferences, saveAllCities } from '@/common/experience.js'
import { selectCities } from '@/common/city-picker.js'
import R from '@/common/routes.js'
loadPreferences()
const selected = ref([...experience.cities])
const cities = [
  { name: '大理', icon: '/static/media/onb-city-dali.jpg' },
  { name: '丽江', icon: '/static/media/onb-city-lijiang.jpg' },
  { name: '成都', icon: '/static/media/onb-city-chengdu.jpg' },
  { name: '杭州', icon: '/static/media/onb-city-hangzhou.jpg' },
  { name: '厦门', icon: '/static/media/onb-city-xiamen.jpg' },
  { name: '景德镇', icon: '/static/media/onb-city-jingdezhen.jpg' }
]
// Preserve old identity links without making identity an onboarding step.
onLoad(q => { if (q?.s === '4') replace(R.identity) })
const toggle = name => { selected.value = selected.value.includes(name) ? selected.value.filter(c => c !== name) : [...selected.value, name] }
async function searchCities() {
  const result = await selectCities({ title: '兴趣城市', selected: selected.value, max: 0 })
  if (result !== null) selected.value = result
}
const leave = () => relaunch(R.home)
// 「保存并返回首页」顺带关掉首页的「全部城市」开关：之前首页选过全部城市，这里改了兴趣城市保存回去，首页还是全部城市，像没保存上。
// 现在首页换成第一个兴趣城市（一个都没选时仍是全部城市）
const save = () => {
  try { savePreferences(selected.value); saveAllCities(false); leave() }
  catch { toast('未能保存，请重试') }
}
</script>
<style scoped lang="scss">
/* 底部两个按钮约 124px 高，再加手机底部安全区：之前固定 160px，安全区大的机型最后一行说明被按钮盖住 */
.interests { padding-top:24px; padding-bottom:calc(140px + var(--k-safe-bottom)); }
.intro { display:block; margin-top:12px; font-size:14px; color:var(--k-muted); line-height:1.7; }
.city-search { display:flex; align-items:center; gap:10px; width:100%; margin:20px 0 0; padding:12px; min-height:48px; text-align:left; color:var(--k-muted); background:var(--k-paper); border:1px solid var(--k-line); border-radius:24px; font-size:14px; line-height:1.5; }
.city-search text { flex:1; }.city-search::after, .selected-cities button::after { border:0; }
.selected-cities { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.selected-cities button { display:flex; align-items:center; gap:8px; margin:0; padding:8px 12px; min-height:40px; border:1px solid var(--k-line); border-radius:20px; color:var(--k-red); background:var(--k-paper); font-size:14px; line-height:1.5; }
.cities { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px 12px; margin-top:24px; }
.city { position:relative; margin:0; padding:12px 4px; width:100%; min-height:72px; border:1px solid var(--k-line2); border-radius:10px; background:var(--k-paper); color:var(--k-ink); display:flex; align-items:center; justify-content:center; gap:4px; font-size:16px; }
.city::after { border:0; }.city.selected { border-color:var(--k-green); background:var(--k-green-soft); }.city image { width:28px; height:28px; }
.tick { position:absolute; right:0; bottom:0; width:20px; height:20px; border-radius:50%; background:var(--k-green); display:flex; align-items:center; justify-content:center; }
.map { width:100%; height:230px; margin-top:16px; }.actions { width:100%; display:flex; flex-direction:column; gap:4px; }
.city text { white-space:nowrap; }.actions :deep(.k-button::after) { border:0; }
@media (max-width:360px) { .cities { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }.map { height:190px; } }
</style>
