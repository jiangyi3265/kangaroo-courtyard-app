<template>
  <view class="k-page" :class="$userSurface">
    <k-topbar title="兴趣城市" back custom-back @back="back" />
    <view class="k-body interests">
      <text class="k-title">下一站，想去哪里？</text>
      <text class="intro">选择你感兴趣的旅居城市，可多选，也可以先逛逛。</text>
      <button class="city-search" @click="searchCities"><k-icon name="search" :size="16" color="muted" /><text>搜索全国城市、区县 / 拼音</text><k-icon name="chevron-right" :size="12" color="muted" /></button>
      <view v-if="selected.length" class="selected-cities"><button v-for="name in selected" :key="name" @click="toggle(name)"><text>{{ name }}</text><k-icon name="x" :size="12" color="red" /></button></view>
      <view class="cities">
        <button v-for="city in cities" :key="city.name" class="city" :class="{ selected: selected.includes(city.name) }" @click="toggle(city.name)">
          <image class="city__ico" :src="city.icon" mode="aspectFit" /><text>{{ city.name }}</text>
          <view v-if="selected.includes(city.name)" class="tick"><k-icon name="check" :size="12" color="white" /></view>
        </button>
      </view>
      <image class="map" src="/pages/auth/static/onb-map.jpg" mode="aspectFit" />
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
/* 底部两个按钮约 124px 高，再加安全区，最后一行说明不被盖住 */
.k-page{--k-bg:var(--k-page)}.k-page :deep(.k-bottom){background:var(--k-paper);box-shadow:0 -.5px 0 rgba(58,50,43,.1)}.k-page :deep(.k-bottom__inner){padding:8px 16px!important}.actions :deep(.k-button.is-lg){height:44px;font-size:15px}.actions :deep(.is-ghost){height:36px;font-size:13px;font-weight:500;color:var(--k-muted)}
.interests{padding:16px 16px calc(132px + var(--k-safe-bottom))}.interests .k-title{display:block;font-size:22px;line-height:30px}
.intro{display:block;margin-top:4px;font-size:13px;color:var(--k-muted);line-height:1.6}
.city-search{display:flex;align-items:center;gap:8px;width:100%;margin:24px 0 0;padding:0 14px;height:36px;text-align:left;color:var(--k-light);background:var(--k-paper);border-radius:18px;font-size:13px;line-height:36px}.city-search::after{border:0}
.city-search text{flex:1}
.selected-cities{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.selected-cities button{display:flex;align-items:center;gap:4px;margin:0;padding:0 10px 0 12px;height:28px;border:0;border-radius:14px;color:var(--k-red-deep);background:var(--k-red-soft);font-size:12px;font-weight:500;line-height:28px;box-sizing:border-box}.selected-cities button::after{border:0}
.cities{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:16px}
.city{position:relative;margin:0;padding:0 4px;width:100%;height:56px;border:0;border-radius:12px;background:var(--k-paper);color:var(--k-ink2);display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:500;overflow:hidden;box-sizing:border-box}.city::after{border:0}
.city.selected{background:var(--k-red-soft);color:var(--k-red-deep);font-weight:500}.city__ico{width:28px;height:28px;flex:none;mix-blend-mode:multiply;filter:brightness(1.08)}
.tick{position:absolute;right:6px;top:6px;width:16px;height:16px;border-radius:50%;background:var(--k-red);display:flex;align-items:center;justify-content:center}
.map{display:block;width:100%;height:calc((100vw - 32px) * .7305);margin-top:24px;border-radius:12px;background:var(--k-paper)}.map+.intro{margin-top:12px}.actions{width:100%;display:flex;flex-direction:column;gap:4px}
.city text{white-space:nowrap}
@media (max-width:360px){.cities{grid-template-columns:repeat(2,minmax(0,1fr))}.intro{font-size:12px}.interests .k-title{font-size:20px;line-height:28px}}
</style>
