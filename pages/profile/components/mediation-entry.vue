<template>
  <view class="card mediation-entry">
    <view class="mediation-entry__heading"><view class="mediation-entry__icon"><k-icon name="scale" :size="24" color="ochre" /></view><view><text class="mediation-entry__title">纠纷调解</text><text class="mediation-entry__hint">申请调解、跟进处理，都从这里进入</text></view></view>
    <button class="mediation-entry__link" hover-class="k-press" @click="go('/pages/governance/mediation')"><view><text class="mediation-entry__label">我的调解</text><text class="mediation-entry__hint">查看我参与的申请、进度和处理结果</text></view><k-icon name="chevron-right" :size="18" /></button>
    <button v-for="entry in workEntries" :key="entry.role" class="mediation-entry__link" hover-class="k-press" @click="go(entry.url)"><view><text class="mediation-entry__label">{{ entry.label }}</text><text class="mediation-entry__hint">授权范围：{{ entry.scope }}</text></view><k-icon name="chevron-right" :size="18" /></button>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { staffStores } from '@/common/experience.js'
import { go } from '@/common/screen.js'
import { mediationWorkEntries } from '../mediation-entry.js'
const workEntries = computed(() => mediationWorkEntries(staffStores.value))
</script>

<style lang="scss" scoped>
.mediation-entry{margin-top:16px;padding:16px;border:1px solid var(--input-line,#ddd5c9)}
.mediation-entry__heading{display:flex;align-items:center;gap:10px;padding-bottom:12px}
.mediation-entry__heading>view:last-child{min-width:0;flex:1}
.mediation-entry__icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:40px;height:40px;border-radius:12px;background:var(--soft-ochre,#f4e8d2)}
.mediation-entry__title{display:block;font-size:18px;font-weight:600;line-height:1.35;color:var(--deep-ink,#3a322b)}
.mediation-entry__hint{display:block;margin-top:4px;color:var(--muted-ink,#6f6a65);font-size:13px;font-weight:400;line-height:1.55;white-space:normal;overflow-wrap:anywhere}
.mediation-entry__link{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:64px;margin:0;padding:12px 0;background:transparent;border:0;border-top:1px solid var(--warm-line,#efe9e1);border-radius:0;text-align:left;line-height:1.4}
.mediation-entry__link::after{border:0}
.mediation-entry__link>view{min-width:0;flex:1}
.mediation-entry__label{font-size:15px;font-weight:600;color:var(--warm-brown-deep,#8a5e36)}
</style>
