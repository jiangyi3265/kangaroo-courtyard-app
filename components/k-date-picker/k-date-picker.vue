<template>
  <view class="calendar-overlay">
    <view class="calendar-mask" @click="emit('cancel')" @touchmove.stop.prevent />
    <view class="calendar-panel" role="dialog" aria-modal="true" :aria-label="title">
      <!-- 标题行和底部按钮区不会滚，在上面拖动时拦住，背后的页面不跟着滚；面板本身包着 scroll-view 不能拦（拦了日历自己也滑不动） -->
      <view class="calendar-header" @touchmove.stop.prevent>
        <text class="calendar-title">{{ title }}</text>
        <button class="calendar-cancel" @click="emit('cancel')">取消</button>
      </view>
      <scroll-view scroll-y class="calendar-scroll">
        <view class="calendar-month">
          <button class="calendar-arrow" aria-label="上个月" :disabled="!canPrevious" @click="changeMonth(-1)"><k-icon name="chevron-left" :size="24" /></button>
          <text class="calendar-month-label">{{ monthLabel }}</text>
          <button class="calendar-arrow" aria-label="下个月" :disabled="!canNext" @click="changeMonth(1)"><k-icon name="chevron-right" :size="24" /></button>
        </view>
        <view class="calendar-week"><text v-for="day in weeks" :key="day">{{ day }}</text></view>
        <view class="calendar-grid">
          <view v-for="day in days" :key="day.date" class="calendar-cell">
            <button v-if="day.current" class="calendar-day" :class="{ selected: selected === day.date, today: day.date === today }" :disabled="day.disabled" :aria-label="day.date" :aria-pressed="selected === day.date" @click="selected = day.date">{{ day.day }}</button>
          </view>
        </view>
        <view class="calendar-options">
          <button v-if="allowEmpty" class="calendar-unlimited" :class="{ active: selected === '' }" @click="selected = ''">不限日期</button>
          <button class="calendar-today" @click="jumpToday">回到本月</button>
        </view>
      </scroll-view>
      <view class="calendar-footer" @touchmove.stop.prevent>
        <text class="calendar-selection">{{ selected ? '已选：' + selected : (allowEmpty ? '不限日期' : '请选择日期') }}</text>
        <k-button block :disabled="!valid" @click="emit('confirm', selected)">确定日期</k-button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { todayCn } from '@/common/ui.js'
import { calendarMonth, monthDays, shiftMonth } from '@/common/calendar.js'
const props = defineProps({
  title: { type: String, default: '选择日期' },
  value: { type: String, default: '' },
  minDate: { type: String, default: '' },
  maxDate: { type: String, default: '' },
  allowEmpty: { type: Boolean, default: false }
})
const emit = defineEmits(['cancel', 'confirm'])
const today = todayCn()
const inRange = value => value >= props.minDate && (!props.maxDate || value <= props.maxDate)
const selected = ref(props.value && inRange(props.value) ? props.value : '')
const month = ref(calendarMonth(selected.value || props.minDate || today))
const weeks = ['一', '二', '三', '四', '五', '六', '日']
const days = computed(() => monthDays(month.value, props.minDate, props.maxDate))
const monthLabel = computed(() => `${month.value.slice(0, 4)}年${Number(month.value.slice(5, 7))}月`)
const canPrevious = computed(() => !props.minDate || month.value > calendarMonth(props.minDate))
const canNext = computed(() => !props.maxDate || month.value < calendarMonth(props.maxDate))
const valid = computed(() => selected.value ? inRange(selected.value) : props.allowEmpty)
function changeMonth(offset) {
  if (offset < 0 && !canPrevious.value) return
  if (offset > 0 && !canNext.value) return
  month.value = shiftMonth(month.value, offset)
}
function jumpToday() {
  const lower = props.minDate > today ? props.minDate : today
  month.value = calendarMonth(props.maxDate && lower > props.maxDate ? props.maxDate : lower)
}
</script>

<style scoped lang="scss">
.calendar-overlay { position: fixed; inset: 0; z-index: 1000; }
.calendar-mask { position: absolute; inset: 0; background: rgba(36,27,23,.45); }
.calendar-panel { position: absolute; bottom: 0; left: 0; right: 0; max-width: 540px; margin: 0 auto; background: var(--k-paper); color: var(--k-ink); border-radius: 20px 20px 0 0; padding-bottom: env(safe-area-inset-bottom); overflow: hidden; }
.calendar-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px 0; }
.calendar-title { font-size: 18px; font-weight: 700; }
.calendar-cancel, .calendar-arrow, .calendar-day, .calendar-unlimited, .calendar-today { margin: 0; padding: 0; border: 0; border-radius: 8px; font-size: 16px; color: var(--k-ink); background: transparent; line-height: 48px; }
button::after { border: 0; }
.calendar-cancel { min-width: 56px; color: var(--k-muted); }
.calendar-scroll { max-height: calc(85vh - 170px); }
.calendar-month { display: flex; align-items: center; justify-content: space-between; padding: 0 12px; }
.calendar-month-label { font-size: 17px; font-weight: 600; }
.calendar-arrow { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; }
.calendar-arrow[disabled] { opacity: .3; }
.calendar-week, .calendar-grid { display: flex; flex-wrap: wrap; padding: 0 8px; }
.calendar-week text { width: 14.285714%; text-align: center; line-height: 36px; color: var(--k-muted); font-size: 14px; }
.calendar-cell { width: 14.285714%; height: 48px; padding: 2px; box-sizing: border-box; }
.calendar-day { width: 100%; height: 44px; line-height: 44px; }
.calendar-day.today { box-shadow: inset 0 0 0 1px var(--k-red); color: var(--k-red); }
.calendar-day[disabled] { color: var(--k-light); }
.calendar-day.selected { background: var(--k-red); color: #fff; box-shadow: none; font-weight: 700; }
.calendar-options { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; }
.calendar-unlimited { padding: 0 16px; border: 1px solid var(--k-line); font-size: 14px; }
.calendar-unlimited.active { color: var(--k-red); border-color: var(--k-red); background: var(--k-bg); }
.calendar-today { padding: 0 8px; margin-left: auto; font-size: 14px; color: var(--k-muted); }
.calendar-footer { padding: 10px 16px 16px; border-top: 1px solid var(--k-line); }
.calendar-selection { display: block; margin-bottom: 10px; font-size: 14px; color: var(--k-muted); }
</style>
