<template>
  <view class="coordinator">
    <view class="coordinator__identity">
      <view class="coordinator__avatar"><image v-if="profile.avatar && !avatarError" class="coordinator__photo" :src="absUrl(profile.avatar)" mode="aspectFill" @error="avatarError = true" /><k-icon v-else name="user-round" :size="29" color="#A57D52" :stroke="1.5" /></view>
      <view class="coordinator__copy"><text class="coordinator__name">{{ cityName ? cityName + '袋鼠工作人员' : '袋鼠工作人员' }}</text><text v-if="profile.name" class="coordinator__person">{{ profile.name }}</text><text class="coordinator__intro">{{ profile.intro || (cityName ? '负责' + cityName + '地区的岗位探访与用户服务' : '负责当地岗位探访与用户服务') }}</text></view>
    </view>
    <text class="coordinator__service">实地探访岗位，一对一解决用户问题</text>
    <text v-if="profileError" class="coordinator__error" role="button" @click="refreshProfile">工作人员资料读取失败，点击重试</text>
  </view>
</template>

<script setup>
import { computed, ref, watch, onUnmounted } from 'vue'
import { apiCityCoordinator } from '@/common/api.js'
import { absUrl } from '@/common/upload.js'
import { coordinatorCity } from '../city-coordinator.js'
defineOptions({ options: { virtualHost: true, styleIsolation: 'isolated' } })
const props = defineProps({ city: { type: String, default: '' } })
const cityName = computed(() => coordinatorCity(props.city))
const profile = ref({}), profileError = ref(false), avatarError = ref(false)
let profileRequest = 0
async function refreshProfile() {
  const id = ++profileRequest, city = cityName.value
  profileError.value = false
  if (!city) { profile.value = {}; return }
  try {
    const response = await apiCityCoordinator(city)
    if (id === profileRequest && city === cityName.value) { profile.value = response.data || {}; avatarError.value = false }
  } catch (_) { if (id === profileRequest) { profile.value = {}; profileError.value = true } }
}
watch(cityName, () => { profile.value = {}; refreshProfile() }, { immediate: true })
onUnmounted(() => { ++profileRequest })
defineExpose({ refresh: refreshProfile })
</script>

<style scoped>
.coordinator__photo{width:100%;height:100%;border-radius:50%}.coordinator__person{display:block;font-size:13px;line-height:1.5;margin-top:3px;color:#6e5845}
.coordinator{margin:12px 14px 0;padding:14px;background:#fffdf9;border:1px solid #d5c5b1;border-radius:12px;color:#4a3b30;box-sizing:border-box}
.coordinator__identity{display:flex;align-items:center;gap:11px}.coordinator__avatar{width:48px;height:48px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#f2e8d9;border:1px solid #e4d3bc}.coordinator__copy{flex:1;min-width:0}.coordinator__name{display:block;font-size:17px;font-weight:700;line-height:1.4}.coordinator__intro{display:block;margin-top:4px;font-size:12px;line-height:1.6;color:#84715e}.coordinator__service{display:block;margin-top:11px;font-size:12px;line-height:1.6;color:#6e5845}.coordinator__error{display:block;margin-top:8px;color:#a34635;font-size:12px;line-height:1.5}
</style>
