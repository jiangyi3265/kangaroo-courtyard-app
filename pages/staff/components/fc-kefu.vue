<template>
  <!-- #ifdef MP-WEIXIN -->
  <button v-if="show" class="fc-kefu" open-type="contact" :session-from="from" hover-class="k-press-s" aria-label="联系人工客服"><k-icon name="headset" :size="20" color="#8A5E36" :stroke="1.8" /><text class="fc-kefu__t">客服</text></button>
  <!-- #endif -->
  <!-- #ifndef MP-WEIXIN -->
  <view v-if="show" class="fc-kefu" hover-class="k-press-s" aria-label="联系人工客服" @click="openSupport"><k-icon name="headset" :size="20" color="#8A5E36" :stroke="1.8" /><text class="fc-kefu__t">客服</text></view>
  <!-- #endif -->
</template>

<script setup>
// 填写屏底部操作条最左边的人工客服（2026-10-31，R7 + R10）：48×48 的奶油色方块，提交按钮在它右边。
// 填写屏的字段从屏幕边开始，浮动小钮（k-topbar 里的 k-fab）滚动时会压字，所以这几屏 k-topbar 传 :fab="false"，改放这里：一样一直看得到、一样在左边。
// 谁能看到用同一条规则（common/support-fab.js）：用户身份和合作商家出，员工不出。不出时什么都不画，旁边的提交按钮自己占满。用法：放在 .fc-bar__btns 里提交按钮前面，不用传任何东西。
import { computed, onMounted, ref } from 'vue'
import { experience, session, currentStaffStore } from '@/common/experience.js'
import { fabVisible, fabSessionFrom } from '@/common/support-fab.js'
// #ifndef MP-WEIXIN
import { go } from '@/common/screen.js'
// #endif

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

const pageRoute = ref('')
onMounted(() => {
  try {
    const pages = getCurrentPages()
    pageRoute.value = (pages[pages.length - 1] && pages[pages.length - 1].route) || ''
  } catch (e) { pageRoute.value = '' }
})
const show = computed(() => fabVisible({ route: pageRoute.value, restored: session.restored, mode: experience.mode, roleCode: currentStaffStore.value && currentStaffStore.value.roleCode, dark: false }))
const from = computed(() => fabSessionFrom(experience.account && experience.account.id))
// #ifndef MP-WEIXIN
const openSupport = () => go('/pages/notice/support')
// #endif
</script>

<style scoped>
.fc-kefu { flex: 0 0 48px; box-sizing: border-box; width: 48px; height: 48px; margin: 0; padding: 0; border-radius: 12px; background: var(--k-paper2); color: var(--k-ink2); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; line-height: 1; }
.fc-kefu::after { border: 0; }
.fc-kefu__t { font-size: 13px; line-height: 16px; }
</style>
