<template>
  <view class="coordinator">
    <view class="coordinator__identity">
      <view class="coordinator__avatar"><image v-if="profile.avatar && !avatarError" class="coordinator__photo" :src="absUrl(profile.avatar)" mode="aspectFill" @error="avatarError = true" /><k-icon v-else name="user-round" :size="22" color="red" /></view>
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
/* 2026-11-17 改版「小而精」：白底通栏一块，和上面的内容面板隔 8px，不描边；头像 40、名字 14 / 600 */
.coordinator{margin:8px 0 0;padding:14px 16px;background:#fff;color:var(--k-ink2);box-sizing:border-box}
.coordinator__identity{display:flex;align-items:center;gap:10px}.coordinator__avatar{width:40px;height:40px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#F5F1EB}.coordinator__photo{width:100%;height:100%;border-radius:50%}
.coordinator__copy{flex:1;min-width:0}.coordinator__name{display:block;font-size:14px;font-weight:600;line-height:20px;color:var(--k-ink)}.coordinator__person{display:block;margin-top:2px;font-size:12px;line-height:18px;color:var(--k-ink2)}.coordinator__intro{display:block;margin-top:2px;font-size:12px;line-height:18px;color:var(--k-muted)}
.coordinator__service{display:block;margin-top:10px;padding:6px 10px;border-radius:8px;background:#F7F5F2;font-size:12px;line-height:18px;color:var(--k-ink2)}.coordinator__error{display:block;margin-top:4px;padding:7px 0;color:var(--k-alert);font-size:12px;line-height:18px}
@media (max-width:359px){.coordinator{padding-left:12px;padding-right:12px}}
/* 2026-11-18 第三轮返修第 2 轮（r3jobsa）：前面区块都是发丝线分隔，这里原来是一条 8px 灰带：改成发丝线 + 20 留白 */
.coordinator { position: relative; margin-top: 0; padding-top: 20px; }
.coordinator::before { content: ''; position: absolute; left: 16px; right: 16px; top: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
/* 2026-11-19 第四轮返修（r3jobsa）：「实地探访岗位…」不再是一条灰底条（详情页一屏叠了太多浅灰块），退成名字下方对齐的一行灰字 */
.coordinator__service { margin: 6px 0 0 50px; padding: 0; border-radius: 0; background: transparent; color: var(--k-muted); }
</style>
