<template>
  <view class="mediation-entry">
    <view class="mediation-entry__card">
    <view class="mediation-entry__heading"><text class="mediation-entry__title">纠纷调解</text><text class="mediation-entry__hint">申请调解、跟进处理，都从这里进入</text></view>
    <button class="mediation-entry__link" hover-class="k-press" @click="go('/pages/governance/mediation')"><view class="mediation-entry__icon"><k-icon name="scale" :size="18" color="ink2" /></view><view class="mediation-entry__text"><text class="mediation-entry__label">我的调解</text><text class="mediation-entry__hint">查看我参与的申请、进度和处理结果</text></view><k-icon name="chevron-right" :size="12" color="muted" /></button>
    <button v-for="entry in workEntries" :key="entry.role" class="mediation-entry__link" hover-class="k-press" @click="go(entry.url)"><view class="mediation-entry__icon"><k-icon name="briefcase-business" :size="18" color="ink2" /></view><view class="mediation-entry__text"><text class="mediation-entry__label">{{ entry.label }}</text><text class="mediation-entry__hint">授权范围：{{ entry.scope }}</text></view><k-icon name="chevron-right" :size="12" color="muted" /></button>
    </view>
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
/* 2026-11-18 第三轮返修（第 2 轮）：自己成一组，和设置页「账号与安全」同一种写法 ——
   组名「纠纷调解」放在白卡上方（12 / 500 灰字，左边让出 12 和卡里的字同一条线，下 8），说明紧跟在组名后面、同色 12 / 400；
   卡里只留入口行：和「我的」常用入口同一种两行列表行（图标 18 + 名字 14 + 下面 12 号灰字 + 12 号箭头），52 高、上下 8，
   行间发丝线从名字那条线开始（12 + 18 + 10 = 40），右边停在卡内边距线（右 12）。不再和宫格混在一张卡里。 */
.mediation-entry{display:block}
.mediation-entry__heading{display:flex;align-items:baseline;gap:8px;margin:0 12px 8px}
.mediation-entry__title{flex:0 0 auto;font-size:12px;font-weight:500;line-height:17px;color:var(--k-muted)}
.mediation-entry__hint{display:block;color:var(--k-muted);font-size:12px;font-weight:400;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mediation-entry__heading .mediation-entry__hint{flex:1;min-width:0;line-height:17px}
.mediation-entry__card{border-radius:12px;background:var(--k-paper);overflow:hidden}
/* 入口行：button 的 ::after 是微信的边框，去掉；行间线画在 ::before */
.mediation-entry__link{position:relative;display:flex;align-items:center;gap:10px;width:100%;min-height:52px;margin:0;padding:8px 12px;background:transparent;border:0;border-radius:0;text-align:left;line-height:1.4;font-size:14px;box-sizing:border-box}
.mediation-entry__link + .mediation-entry__link::before{content:"";position:absolute;left:40px;right:12px;top:0;height:1px;background:var(--k-line);transform:scaleY(.5);transform-origin:0 0}
.mediation-entry__link::after{border:0}
.mediation-entry__icon{display:flex;align-items:center;justify-content:center;flex:0 0 18px;width:18px;height:18px}
.mediation-entry__text{display:flex;flex-direction:column;gap:0;flex:1;min-width:0}
.mediation-entry__label{font-size:14px;font-weight:400;line-height:20px;color:var(--k-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 11-18 第三轮返修（第 3 轮）：组名「纠纷调解」收进白卡，和「我的」宫格各组的组名同一种写法（13 / 500 灰字、卡内上 16、左边和行里的图标同一条线）；
   后面那句说明同一行、12 号灰字，放不下省略；组名到第一行入口 4（入口行自带上下 8）。卡里的入口行不变（52 高两行行） */
.mediation-entry__heading{margin:0;padding:16px 12px 4px}
.mediation-entry__title{font-size:13px;line-height:18px}
.mediation-entry__heading .mediation-entry__hint{line-height:18px}
.mediation-entry__heading + .mediation-entry__link::before{display:none}
/* 11-18 第三轮返修（第 4 轮）：组名后面那句说明退成 --k-light 浅灰（离组名 8），让组名先被看到 */
.mediation-entry__heading .mediation-entry__hint{color:var(--k-light)}
/* 11-18 第四轮：组名挪到白卡外面（和设置页「账号与安全」同一种写法：13 / 500 灰字、左边对齐卡里的字、下 8），卡里只留入口行 */
.mediation-entry__heading{margin:0;padding:0 12px 8px}
.mediation-entry__title{font-size:13px;font-weight:500;line-height:18px;color:var(--k-muted)}
.mediation-entry__heading .mediation-entry__hint{line-height:18px;color:var(--k-light)}
/* 11-19 微信实拍返修：「我的」页上下两张列表卡做法统一 —— 组名收回白卡里，和上面宫格卡的组名同一种写法（13 / 600 二级墨、卡内上 16、左边卡内 12），
   说明跟在组名后面 12 号浅灰；组名到第一行入口 4（入口行自带上下 8），第一行上面不画发丝线 */
.mediation-entry__heading{margin:0;padding:16px 12px 4px}
.mediation-entry__title{font-size:13px;font-weight:600;line-height:18px;color:var(--k-ink2)}
</style>
