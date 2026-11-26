<template>
  <view class="fp" :class="{ 'fp--online': type === 'online' }">
    <view class="fp__head">
      <text class="fp__title">筛选条件</text>
      <view class="fp__close" aria-role="button" aria-label="关闭筛选，不保存更改" hover-class="k-press" @click="emit('close')"><text>关闭</text><k-icon name="x" :size="16" color="ink2" /></view>
    </view>
    <!-- 完整分组标题在上、选项在下；长文案换行或占整行，避免小屏截断。 -->
    <scroll-view class="fp__body" scroll-y :show-scrollbar="false">
      <view class="fp__content">
      <view v-for="(groupItem, gi) in groups" :key="groupItem.key" class="fp-group" :class="{ 'fp-group--line': gi > 0 }">
        <view class="fp-group__head"><text class="fp__label">{{ groupItem.title }}</text><text v-if="['skills', 'restModes', 'roomTypes', 'categories'].includes(groupItem.key)" class="fp__hint">可多选</text></view>
        <view class="fp-opts" :class="{ 'fp-opts--two': ['skills', 'restModes', 'roomTypes', 'board', 'minStay', 'categories', 'task'].includes(groupItem.key), 'fp-opts--salary': ['payDay', 'payMonth'].includes(groupItem.key) }">
          <view v-for="optItem in groupItem.options" :key="optItem.value" class="fp-opt" :class="{ on: optItem.on, 'fp-opt--wide': optItem.wide, 'fp-opt--long': optItem.long, 'fp-opt--assured': groupItem.key === 'assured' }" hover-class="k-press-s" @click="pick(groupItem.key, optItem.value)">
            <k-icon v-if="groupItem.key === 'assured'" class="fp-opt__icon" name="shield-check" :size="14" :color="optItem.on ? 'red' : 'green'" />
            <text class="fp-opt__text">{{ optItem.label }}</text>
          </view>
        </view>
      </view>
      <text v-if="!groups.length" class="fp-empty">这一类没有可选的条件</text>
      </view>
    </scroll-view>
    <view class="fp__foot">
      <text class="fp__count">{{ counting ? '正在统计符合条件的' + noun + '…' : countError ? '数量暂不可用，可直接查看结果' : '找到 ' + count + ' 个符合条件的' + noun }}</text>
      <view class="fp__btns">
        <view class="fp__reset" hover-class="k-press" @click="emit('reset')"><text>重置条件</text></view>
        <view class="fp__ok" hover-class="k-press-s" @click="emit('confirm')"><text>查看结果</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { panelGroups } from '../job-filters.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
const props = defineProps({
  type: { type: String, default: 'volunteer' },
  draft: { type: Object, required: true },
  kinds: { type: Array, default: () => [] },  // 换工类型（后台字典）
  count: { type: Number, default: 0 },
  counting: { type: Boolean, default: false },
  countError: { type: Boolean, default: false }
})
const emit = defineEmits(['pick', 'reset', 'confirm', 'close'])
const groups = computed(() => panelGroups(props.type, props.draft, props.kinds))
const noun = computed(() => (props.type === 'online' ? '任务' : '岗位'))
// 选项值都是字符串（数字组在 job-filters.pickOption 里再转回数字）
const pick = (key, value) => emit('pick', key, value)
</script>

<style scoped lang="scss">
/* 2026-11-03 主人：筛选不全屏铺满，占一半左右 —— 底部弹层定高 56vh（小程序里 scroll-view 要有确定高度才滚得动），
   条件区在中间自己滚，标题和「重置 / 查看结果」固定在上下两头 */
.fp { display: flex; flex-direction: column; height: 56vh; max-height: 56vh; box-sizing: border-box; overflow: hidden; border: 1px solid #E8DCCB; border-radius: 20px 20px 0 0; background: #FFFDFA; color: #3A322B; }
.fp__head { flex-shrink: 0; min-height: 44px; position: relative; box-sizing: border-box; padding: 0 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #F1EDE7; }
.fp__title { font-size: 15px; font-weight: 600; }
.fp__close { min-width: 60px; height: 44px; display: flex; gap: 3px; align-items: center; justify-content: flex-end; font-size: 13px; color: var(--k-ink2); }
.fp__body { flex: 1; height: 0; min-height: 0; overscroll-behavior: contain; box-sizing: border-box; padding: 0 14px; }
/* #ifdef H5 */
.fp__body :deep(.uni-scroll-view) { overscroll-behavior: contain; }
/* #endif */
.fp-group { padding: 18px 0; }
.fp-group--line { border-top: 1px solid #F1EDE7; }
.fp-group__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.fp__label { font-size: 15px; font-weight: 600; line-height: 22px; }
.fp__hint { font-size: 12px; color: var(--k-muted); }
.fp__help { display: block; margin: -4px 0 10px; font-size: 12px; line-height: 1.5; color: #7A7570; }
.fp-opts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.fp-opts--four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.fp-opts--two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.fp-opt { min-width: 0; min-height: 48px; box-sizing: border-box; padding: 8px 5px; border: 1px solid transparent; border-radius: 10px; background: #F7F5F1; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; font-weight: 400; color: var(--k-ink2); }
.fp-opts--four .fp-opt { padding-left: 2px; padding-right: 2px; }
.fp-opt.on { border-color: #B79772; background: #F4E9DB; color: #78512E; font-weight: 600; }
.fp-opt__text { min-width: 0; white-space: normal; line-height: 1.4; text-align: center; }
.fp-opt--long { font-size: 14px; }
.fp-opt--wide { grid-column: 1 / -1; justify-content: flex-start; padding: 10px 12px; }
.fp-opt__icon { flex: 0 0 auto; }
.fp-empty { display: block; padding: 18px 0; font-size: 13px; color: #7A7570; }
.fp__foot { flex-shrink: 0; box-sizing: border-box; padding: 12px 14px calc(14px + var(--k-safe-bottom, 0px)); border-top: 1px solid #EDE8E1; }
.fp__count { display: block; margin-bottom: 9px; text-align: center; font-size: 12px; line-height: 16px; color: #7A7570; }
.fp__btns { display: flex; gap: 10px; }
.fp__reset, .fp__ok { height: 48px; box-sizing: border-box; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 500; }
.fp__reset { flex: 0 0 32%; border: 1px solid #D8CFC4; color: #51483F; }
.fp__ok { flex: 1; min-width: 0; background: #8A603D; color: #FFFFFF; }
@media (max-width: 359px) {
  .fp__body { padding: 0 14px; }
  .fp-opts { gap: 6px; }
  .fp-opt { padding-left: 4px; padding-right: 4px; }
  .fp-opts--salary .fp-opt { padding-left: 2px; padding-right: 2px; font-size: 12px; }
}
/* 底部弹层固定标题和按钮，条件区独立滚动。 */
.fp-group { padding-top: 12px; padding-bottom: 12px; }
.fp-group__head { margin-bottom: 8px; }
.fp__label { font-size: 14px; line-height: 20px; color: #4D3827; }
.fp-opt { border-radius: 19px; min-height: 38px; padding-top: 6px; padding-bottom: 6px; font-size: 13px; background: #F6F3EF; }
.fp-opt--long { font-size: 13px; }
.fp__foot { padding-top: 8px; padding-bottom: calc(10px + var(--k-safe-bottom, 0px)); }
.fp__count { margin-bottom: 6px; }
.fp__reset, .fp__ok { height: 42px; font-size: 14px; }
/* 顶上一道小横条，看得出是从底部弹出来的一层 */
.fp__head::before { content: ''; position: absolute; left: 50%; top: 5px; width: 36px; height: 4px; margin-left: -18px; border-radius: 2px; background: #E4D9CB; }
.fp-opt.on { background: #F3E3CC; border-color: #BE966C; }
.fp__reset, .fp__ok { border-radius: 24px; }
/* 2026-11-17 改版「小而精」：白底弹层、顶上 16 圆角，不描边；分组之间靠留白不画线；选项是 36 高、8 圆角的浅色块，
   选中换成浅棕底 + 细棕边；底部「重置条件」是白底细边的次按钮，「查看结果」是暖棕渐变胶囊。分组、选项、统计数一项不少。 */
.fp { border: 0; border-radius: 16px 16px 0 0; background: var(--k-paper); color: var(--k-ink); }
.fp__head { min-height: 48px; padding: 8px 12px 0 16px; border-bottom: 0; }
.fp__head::before { top: 6px; width: 32px; background: #E6E1DA; }
.fp__title { font-size: 16px; font-weight: 700; }
.fp__close { font-size: 12px; color: var(--k-muted); }
.fp__body { padding: 0 16px; }
.fp-group { padding-top: 10px; padding-bottom: 6px; }
.fp-group--line { border-top: 0; }
.fp__label { font-size: 14px; font-weight: 600; line-height: 20px; color: var(--k-ink); }
.fp__hint { font-size: 11px; }
.fp-opt { min-height: 36px; padding: 4px 6px; border: 0; border-radius: 8px; background: var(--k-page); box-shadow: none; font-size: 13px; font-weight: 400; color: var(--k-ink2); }
/* 选中：浅棕底 + 1px 暖棕实线 + 深棕 600；没选中：浅灰底无描边，一眼分得出 */
.fp-opt.on { border: 0; background: var(--k-red-soft); box-shadow: inset 0 0 0 1px var(--k-red); color: var(--k-red-deep); font-weight: 600; }
.fp-opt--wide { padding: 4px 12px; }
.fp-empty { color: var(--k-muted); }
.fp__foot { padding: 8px 16px calc(10px + var(--k-safe-bottom, 0px)); border-top: 0; background-image: linear-gradient(to bottom, var(--k-line) 50%, transparent 50%); background-size: 100% 1px; background-repeat: no-repeat; background-position: left top; }
.fp__count { margin-bottom: 8px; font-size: 11px; color: var(--k-muted); }
.fp__reset, .fp__ok { height: 42px; border-radius: 21px; font-size: 14px; }
.fp__reset { flex-basis: 30%; border-color: var(--k-red-line); background: var(--k-paper); color: var(--k-red-deep); font-weight: 500; }
.fp__ok { background: linear-gradient(135deg, #B5814D, #8E5E33); font-weight: 600; }
</style>
