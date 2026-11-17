<template>
  <view class="fc-sheet">
    <view class="fc-sheet__mask" @click="emit('cancel')" @touchmove.stop.prevent />
    <view class="fc-sheet__panel" role="dialog" aria-modal="true" :aria-label="title">
      <view class="fc-sheet__head" @touchmove.stop.prevent>
        <view class="fc-sheet__cancel" hover-class="k-press" @click="emit('cancel')"><text>取消</text></view>
        <text class="fc-sheet__title">{{ title }}</text>
      </view>
      <scroll-view scroll-y class="fc-sheet__list" :class="{ 'fc-sheet__list--multi': multiple }">
        <view v-for="rowItem in rows" :key="rowItem.rowKey" class="fc-sheet__opt" :class="{ on: rowItem.on }" hover-class="k-press" @click="tap(rowItem)">
          <view class="fc-sheet__copy"><text class="fc-sheet__name">{{ rowItem.label }}</text><text v-if="rowItem.desc" class="fc-sheet__desc">{{ rowItem.desc }}</text></view>
          <!-- 多选（2026-11-03 主人：「增加一个对勾…能清楚的看到我选了那个」）：每行右边一个圆，没选是空心圈，选中是暖棕实心圆里一个白对勾 -->
          <view v-if="multiple" class="fc-sheet__mark" :class="{ on: rowItem.on }"><k-icon v-if="rowItem.on" name="check" :size="14" color="white" :stroke="3" /></view>
          <k-icon v-else-if="rowItem.on" name="check" :size="20" color="#8A5E36" :stroke="2.2" />
        </view>
        <view v-if="customLabel" class="fc-sheet__opt" hover-class="k-press" @click="addCustom"><view class="fc-sheet__copy"><text class="fc-sheet__name fc-sheet__name--add">{{ customLabel }}</text></view></view>
      </scroll-view>
      <view v-if="multiple" class="fc-sheet__foot" @touchmove.stop.prevent>
        <view class="fc-sheet__ok" hover-class="k-press-s" @click="done"><text>{{ okLabel }}</text></view>
      </view>
    </view>
  </view>
</template>

<script setup>
// 填写页的底部弹层（2026-10-31，R7）：选项超过 4 个的单选（可带说明）、多选。招募、活动、房源、线上任务、报销共用，用法看 jobs.vue 的 sheetConf、confirmSheet。
// 放在 staff 分包，页面显式引入，不走全局 easycom，不进主包。
//   单选：点一项选中并关闭；有「不选」的放第一行；当前项棕字 + 字重 600 + 右边对勾。
//   多选：对勾随点随变，底部一个大按钮确定（不放右上角，年纪大的人容易找不到）；超过上限提示一句。
//   点遮罩、取消都是不改。
// 不用系统菜单 uni.showActionSheet：它最多 6 项，不能显示当前选了哪个，不能带说明，不能多选。
import { computed, ref } from 'vue'
import { toast } from '@/common/screen.js'
import { prompt } from '@/common/ui.js'

defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })

const props = defineProps({
  title: { type: String, default: '' },
  options: { type: Array, default: () => [] },       // [{ label, value, desc? }]
  value: { type: [String, Number, Array, Boolean, Object], default: '' }, // 单选：当前值（null 也行）；多选：当前值的数组
  multiple: { type: Boolean, default: false },
  max: { type: Number, default: 0 },                 // 多选上限；0 = 不限
  emptyLabel: { type: String, default: '' },         // 单选第一行（如「不选」），选它 confirm 的是 ''；不传就没有这一行
  customLabel: { type: String, default: '' },        // 最后一行（如「＋ 自己写一个」），不传就没有
  customTitle: { type: String, default: '' },        // 系统输入框的标题
  customHint: { type: String, default: '' },         // 系统输入框的占位字
  customMax: { type: Number, default: 32 }           // 自己写的最多几个字，超了截掉
})
const emit = defineEmits(['confirm', 'cancel'])

// null、undefined、'' 算同一个「空」；数字和字符串按文字比（不限 = null、一周 = 7）
const same = (a, b) => String(a ?? '') === String(b ?? '')
const picks = ref(props.multiple && Array.isArray(props.value) ? props.value.slice() : [])
const rows = computed(() => {
  const list = props.options.slice()
  const known = (v) => list.some(o => same(o.value, v))
  // 不在清单里的当前值（自己写过的）也列出来，不然用户看不到、也取消不掉
  if (props.multiple) { for (const v of picks.value) if (!known(v)) list.push({ label: String(v), value: v }) }
  else if (props.customLabel && !same(props.value, '') && !known(props.value)) list.push({ label: String(props.value), value: props.value })
  const head = props.emptyLabel ? [{ label: props.emptyLabel, value: '' }] : []
  return head.concat(list).map(o => ({ ...o, rowKey: 'k' + String(o.value ?? ''), on: props.multiple ? picks.value.some(v => same(v, o.value)) : same(o.value, props.value) }))
})
const okLabel = computed(() => '确定（已选 ' + picks.value.length + ' 个' + (props.max ? '，最多 ' + props.max + ' 个' : '') + '）')
const full = () => props.max > 0 && picks.value.length >= props.max
function tap(row) {
  if (!props.multiple) return emit('confirm', row.value)
  const at = picks.value.findIndex(v => same(v, row.value))
  if (at >= 0) { picks.value.splice(at, 1); return }
  if (full()) return toast('最多选 ' + props.max + ' 个')
  picks.value.push(row.value)
}
const done = () => emit('confirm', picks.value.slice())
async function addCustom() {
  if (props.multiple && full()) return toast('最多选 ' + props.max + ' 个')
  const typed = await prompt(props.customTitle || props.title, { placeholder: props.customHint })
  const text = String(typed || '').trim().slice(0, props.customMax)
  if (!text) return
  if (!props.multiple) return emit('confirm', text)
  if (!picks.value.includes(text) && !full()) picks.value.push(text)
}
</script>

<style scoped lang="scss">
// 只有这一个组件用，所以样式放这里（scoped 的 data-v 不跨组件），不写在 form-clean.scss：页面不用多带这一段。
// 每行 56px 高，字 16，说明 14；高度上限 76vh，选项区自己滚；只有这里有阴影；动画只有面板上滑，200ms，不回弹。
// 比网页版的系统输入框、提示（都是 999）低一层：不然「自己写一个」的输入框点不到，「最多选 N 个」的提示看不见。小程序里那些是原生的，不受影响
.fc-sheet { position: fixed; left: 0; top: 0; right: 0; bottom: 0; z-index: 998; }
.fc-sheet__mask { position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(58, 50, 43, .45); }
.fc-sheet__panel { position: absolute; left: 0; right: 0; bottom: 0; max-height: 76vh; padding-bottom: var(--k-safe-bottom); border-radius: 16px 16px 0 0; background: var(--k-paper); box-shadow: var(--k-sh3); display: flex; flex-direction: column; animation: fc-sheet-up .2s cubic-bezier(.25, 1, .5, 1); }
@keyframes fc-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
.fc-sheet__head { position: relative; flex-shrink: 0; min-height: 56px; padding: 0 72px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--k-line); }
.fc-sheet__title { font-size: 17px; font-weight: 600; color: var(--k-ink); white-space: nowrap; }
.fc-sheet__cancel { position: absolute; left: 0; top: 0; bottom: 0; width: 72px; padding-left: 16px; display: flex; align-items: center; font-size: 16px; color: var(--k-muted); }
// scroll-view 要有明确的高度上限才滚得动：单选 = 面板高减标题栏；多选再减底部「确定」那一行
.fc-sheet__list { max-height: calc(76vh - 56px - var(--k-safe-bottom)); }
.fc-sheet__list--multi { max-height: calc(76vh - 120px - var(--k-safe-bottom)); }
.fc-sheet__foot { flex-shrink: 0; display: flex; padding: 8px 16px; border-top: 1px solid var(--k-line); }
.fc-sheet__ok { flex: 1; min-width: 0; height: 48px; border-radius: 12px; background: var(--k-red-deep); color: var(--k-paper); display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 600; }
.fc-sheet__opt { position: relative; box-sizing: border-box; min-height: 56px; padding: 8px 16px; display: flex; align-items: center; gap: 12px; }
.fc-sheet__opt::after { content: ''; position: absolute; left: 16px; right: 0; bottom: 0; height: 1px; background: var(--k-line); }
.fc-sheet__opt:last-child::after { display: none; }
.fc-sheet__copy { flex: 1; min-width: 0; }
.fc-sheet__name { display: block; font-size: 16px; line-height: 24px; color: var(--k-ink); }
.fc-sheet__name--add { font-weight: 500; color: var(--k-red-deep); }
.fc-sheet__desc { display: block; font-size: 14px; line-height: 20px; color: var(--k-muted); }
.fc-sheet__opt.on .fc-sheet__name { color: var(--k-red-deep); font-weight: 600; }
.fc-sheet__mark { flex-shrink: 0; width: 24px; height: 24px; border: 1.5px solid var(--k-muted); border-radius: 50%; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.fc-sheet__mark.on { border-color: var(--k-red-deep); background: var(--k-red-deep); }
/* #ifdef H5 */
/* 系统设了减少动态时不动。只编进网页版：微信 wxss 认不认这个媒体查询没法在这一轮核实，认不了会让整个小程序上传失败 */
@media (prefers-reduced-motion: reduce) { .fc-sheet__panel { animation: none; } }
/* #endif */
</style>
