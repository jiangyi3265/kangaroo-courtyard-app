<template>
  <!-- 入住 / 离店区间日历（2026-10-17）：一个日历点两下——先点入住、再点离店；选好的两天标「入住 / 离店」，中间一段铺浅色，
       标题栏写「共 N 晚」，底部按钮「确定（共N晚）」。之前是先选入住日、再弹「住几晚」菜单（主人：「选择住几晚就不要跳了」）。
       只在旅居分包里用（显式 import，不走 easycom），不占主包 -->
  <view class="rp-overlay">
    <view class="rp-mask" @click="emit('cancel')" @touchmove.stop.prevent />
    <view class="rp-panel" role="dialog" aria-modal="true" :aria-label="title">
      <view class="rp-head" @touchmove.stop.prevent>
        <view class="rp-head__main">
          <text class="rp-title">{{ title }}</text>
          <text class="rp-hint" :class="{ on: sel.start && sel.end }">{{ hint }}</text>
        </view>
        <view class="rp-cancel" hover-class="k-press" @click="emit('cancel')"><text>取消</text></view>
      </view>
      <view class="rp-fields" @touchmove.stop.prevent>
        <view class="rp-field" :class="{ active: field === 'start' }" hover-class="k-press" @click="field = 'start'"><text class="rp-sum__label">入住日期</text><text class="rp-sum__val">{{ sel.start ? dayLabel(sel.start) : '请选择' }}</text></view>
        <k-icon name="arrow-right" :size="18" color="muted" />
        <view class="rp-field" :class="{ active: field === 'end' }" hover-class="k-press" @click="field = sel.start ? 'end' : 'start'"><text class="rp-sum__label">离店日期</text><text class="rp-sum__val">{{ sel.end ? dayLabel(sel.end) : '请选择' }}</text></view>
      </view>
      <text class="rp-rule">一周起订，至少 {{ minNights }} 晚</text>
      <view class="rp-week" @touchmove.stop.prevent><text v-for="w in weeks" :key="w" :class="{ weekend: w === '六' || w === '日' }">{{ w }}</text></view>
      <scroll-view scroll-y class="rp-scroll" :scroll-into-view="intoView">
        <view v-for="m in months" :key="m.ym" :id="'rpm' + m.id" class="rp-month">
          <text class="rp-month__title">{{ m.title }}</text>
          <view class="rp-grid">
            <view v-for="c in m.cells" :key="c.key" :data-date="c.ymd" class="rp-cell" :class="{ empty: c.empty, off: c.disabled, start: c.start, end: c.end, mid: c.inRange, 'has-end': c.start && !!sel.end }" @click="tap(c)">
              <view v-if="!c.empty" class="rp-day" :class="{ pick: c.start || c.end, today: c.today && !c.start && !c.end }">
                <text class="rp-day__num">{{ c.day }}</text>
                <text v-if="c.tag" class="rp-day__tag">{{ c.tag }}</text>
              </view>
            </view>
          </view>
        </view>
        <text class="rp-foot-note">最多连住 {{ maxNights }} 晚，可点击上方日期修改</text>
      </scroll-view>
      <view class="rp-foot" @touchmove.stop.prevent>
        <k-button block :disabled="!(sel.start && sel.end)" :label="btnText" @click="ok" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { tapRange, editRange, initialRange, rangeMonth, monthsBetween, monthTitle, rangeHint, confirmLabel, lastDay, MIN_NIGHTS, MAX_NIGHTS } from '../stays-range.js'
import { dayText, weekText } from '../stays-state.js'

const props = defineProps({
  title: { type: String, default: '选择入住和离店日期' },
  start: { type: String, default: '' },
  end: { type: String, default: '' },
  initialField: { type: String, default: 'range' },
  // 最早能入住的一天（一般是今天）、最晚能入住的一天（下单接口：最多提前 180 天）；离店最晚到入住 + maxNights
  minDate: { type: String, default: '' },
  maxStart: { type: String, default: '' },
  today: { type: String, default: '' },
  minNights: { type: Number, default: MIN_NIGHTS },
  maxNights: { type: Number, default: MAX_NIGHTS }
})
const emit = defineEmits(['cancel', 'confirm'])
const opts = () => ({ min: props.minDate, maxStart: props.maxStart, minNights: props.minNights, maxNights: props.maxNights })
const sel = ref(initialRange(props.start, props.end, opts()))
const field = ref(props.initialField === 'end' && !sel.value.start ? 'start' : props.initialField)
const weeks = ['一', '二', '三', '四', '五', '六', '日']
const months = computed(() => monthsBetween(props.minDate || props.start, lastDay(props.maxStart, props.maxNights)).map(ym => ({
  ym, id: ym.replace('-', ''), title: monthTitle(ym), cells: monthCells(ym)
})))
function monthCells(ym) {
  const cells = rangeMonth(ym, sel.value, { ...opts(), today: props.today })
  if (field.value === 'range') return cells
  const picking = field.value === 'end' ? { start: sel.value.start, end: '' } : { start: '', end: '' }
  const availability = rangeMonth(ym, picking, opts())
  return cells.map((c, i) => ({ ...c, disabled: availability[i].disabled || (field.value === 'end' && c.ymd <= sel.value.start) }))
}
// 打开时滚到已选入住日所在的月（只在打开时定位一次，点选时不跳）
const intoView = ref(sel.value.start ? 'rpm' + sel.value.start.slice(0, 7).replace('-', '') : '')
const hint = computed(() => field.value === 'range' || (sel.value.start && sel.value.end) ? rangeHint(sel.value) : (field.value === 'end' ? '请选择离店日期' : '请选择入住日期'))
const btnText = computed(() => confirmLabel(sel.value))
const dayLabel = (ymd) => `${dayText(ymd)} ${weekText(ymd)}`
function tap(c) {
  if (!c || c.empty || c.disabled) return
  const next = field.value === 'range' ? tapRange(sel.value, c.ymd, opts()) : editRange(sel.value, c.ymd, field.value, opts())
  if (next.msg) uni.showToast({ title: next.msg, icon: 'none' })
  sel.value = { start: next.start, end: next.end }
  if (!next.msg && field.value === 'start' && next.start) field.value = 'end'
}
function ok() {
  const valid = initialRange(sel.value.start, sel.value.end, opts())
  if (valid.start && valid.end) emit('confirm', valid)
}
</script>

<style scoped lang="scss">
.rp-overlay { position: fixed; inset: 0; z-index: 1000; }
.rp-rule { display: block; padding: 0 16px 10px; color: var(--k-red-deep); font-size: 14px; font-weight: 600; }
.rp-mask { position: absolute; inset: 0; background: rgba(36,27,23,.45); }
.rp-panel { position: absolute; bottom: 0; left: 0; right: 0; max-width: 540px; margin: 0 auto; background: var(--k-paper); color: var(--k-ink); border-radius: 20px 20px 0 0; padding-bottom: env(safe-area-inset-bottom); overflow: hidden; }
.rp-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 6px; }
.rp-head__main { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.rp-title { font-size: 18px; font-weight: 700; white-space: nowrap; }
.rp-hint { font-size: 13px; color: var(--k-muted); white-space: nowrap; }
.rp-hint.on { color: var(--k-red); font-weight: 700; font-size: 15px; }
.rp-cancel { flex-shrink: 0; min-width: 48px; height: 48px; display: flex; align-items: center; justify-content: flex-end; color: var(--k-muted); font-size: 15px; }
.rp-week { display: flex; padding: 0 8px; border-bottom: 1px solid var(--k-line); }
.rp-week text { width: 14.285714%; text-align: center; line-height: 32px; color: var(--k-muted); font-size: 13px; }
.rp-week text.weekend { color: var(--k-ochre); }
.rp-scroll { height: calc(80vh - 240px); max-height: 460px; }
.rp-fields { display: flex; align-items: center; gap: 10px; padding: 8px 16px 12px; }
.rp-field { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; min-height: 60px; box-sizing: border-box; padding: 9px 10px; border: 1px solid transparent; border-radius: 12px; background: var(--k-paper2); }
.rp-field.active { border-color: var(--k-red); background: var(--k-red-soft); }
.rp-month { padding: 4px 8px 6px; }
.rp-month__title { display: block; padding: 10px 6px 6px; font-size: 15px; font-weight: 700; }
.rp-grid { display: flex; flex-wrap: wrap; }
.rp-cell { width: 14.285714%; height: 54px; padding: 2px 0; box-sizing: border-box; }
/* 选好的一段铺成一条浅色带：中间的日子整格铺，入住日铺右半、离店日铺左半，看上去连成一段 */
.rp-cell.mid { background: var(--k-red-soft, #F6E6DA); }
.rp-cell.start.has-end { background: linear-gradient(90deg, transparent 50%, var(--k-red-soft, #F6E6DA) 50%); }
.rp-cell.end { background: linear-gradient(90deg, var(--k-red-soft, #F6E6DA) 50%, transparent 50%); }
.rp-day { height: 50px; margin: 0 2px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.rp-day__num { font-size: 16px; line-height: 1.2; }
.rp-day__tag { font-size: 10px; line-height: 1.2; margin-top: 2px; color: var(--k-muted); }
.rp-day.today { box-shadow: inset 0 0 0 1px var(--k-red); }
.rp-day.today .rp-day__tag { color: var(--k-red); }
.rp-day.pick { background: var(--k-red); }
.rp-day.pick .rp-day__num { color: var(--k-paper); font-weight: 700; }
.rp-day.pick .rp-day__tag { color: var(--k-paper); }
.rp-cell.off .rp-day__num { color: var(--k-light); }
.rp-cell.off .rp-day__tag { color: var(--k-light); }
.rp-foot-note { display: block; padding: 6px 16px 14px; font-size: 12px; color: var(--k-muted); text-align: center; }
.rp-foot { padding: 10px 16px 14px; border-top: 1px solid var(--k-line); }
.rp-sum { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
.rp-sum__col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.rp-sum__col:last-child { align-items: flex-end; }
.rp-sum__label { font-size: 12px; color: var(--k-muted); }
.rp-sum__val { font-size: 15px; font-weight: 700; white-space: nowrap; }

/* 2026-11-17 改版「小而精」（主人按样张第三版拍板）：弹层 16 圆角，入住 / 离店两格是 8 圆角的浅灰块（当前那格浅棕底 + 细棕边），字收小一档，
   底部「确定」是 44 高的暖棕胶囊。日历的点选、区间、起订规则都没动。 */
.rp-overlay .rp-panel { border-radius: 16px 16px 0 0; }
.rp-overlay .rp-head { padding: 10px 12px 2px; }
.rp-overlay .rp-title { font-size: 16px; }
.rp-overlay .rp-hint { font-size: 12px; }
.rp-overlay .rp-hint.on { color: var(--k-red-deep); font-size: 13px; font-weight: 600; }
.rp-overlay .rp-cancel { height: 44px; font-size: 14px; }
.rp-overlay .rp-fields { gap: 8px; padding: 6px 12px 10px; }
.rp-overlay .rp-field { min-height: 52px; padding: 7px 10px; gap: 1px; border-radius: 8px; background: var(--k-fill); }
.rp-overlay .rp-field.active { border-color: var(--k-red-line); background: var(--k-red-soft); }
.rp-overlay .rp-sum__label { font-size: 11px; }
.rp-overlay .rp-sum__val { font-size: 15px; font-weight: 600; }
.rp-overlay .rp-rule { padding: 0 12px 8px; font-size: 12px; font-weight: 500; }
.rp-overlay .rp-week text { line-height: 28px; font-size: 12px; }
.rp-overlay .rp-month__title { font-size: 14px; font-weight: 600; }
.rp-overlay .rp-day__num { font-size: 15px; }
.rp-overlay .rp-day.pick { background: var(--k-red-deep); }
.rp-overlay .rp-foot-note { font-size: 11px; }
.rp-overlay .rp-foot { padding: 8px 12px 12px; }
.rp-overlay .rp-foot :deep(.k-button) { height: 44px; background: linear-gradient(135deg,#B5814D,#8E5E33); box-shadow: none; font-size: 15px; }
/* 2026-11-18 第二轮精修：没选完日期时「确定」交给公共按钮的不可点样式（原配色整体变淡，不再是冷灰底，页面里不再另写）；星期行下面改发丝线 */
.rp-overlay .rp-week { position: relative; border-bottom: 0; }
.rp-overlay .rp-week::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--k-line); transform: scaleY(.5); }
</style>
