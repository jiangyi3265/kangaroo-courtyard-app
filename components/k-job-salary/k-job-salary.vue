<template>
  <view class="salary-editor">
    <text class="salary-heading">食宿与底薪（可多选）</text>
    <text class="salary-hint">可一起提供或单独提供；都不选则不提供食宿与底薪。</text>
    <checkbox-group class="salary-extras" @change="setBenefits">
      <label class="salary-choice" :class="{ selected: benefits.boardEnabled }"><checkbox value="board" :checked="benefits.boardEnabled" color="#9A6B3F" /><text>提供食宿</text></label>
      <label class="salary-choice" :class="{ selected: benefits.salaryEnabled }"><checkbox value="salary" :checked="benefits.salaryEnabled" color="#9A6B3F" /><text>提供底薪</text></label>
    </checkbox-group>
    <template v-if="benefits.salaryEnabled">
    <text class="salary-heading">底薪周期（选一项）</text>
    <radio-group class="salary-periods" @change="setValue('salaryType', $event.detail.value)">
      <label v-for="option in SALARY_OPTIONS" :key="option.value" class="salary-choice" :class="{ selected: modelValue.salaryType === option.value }">
        <radio :value="option.value" :checked="modelValue.salaryType === option.value" color="#9A6B3F" />
        <text>{{ option.label }}</text>
      </label>
    </radio-group>
    <label class="salary-heading" for="job-base-salary">底薪金额（{{ option.unit }}）</label>
    <view class="salary-amount">
      <input id="job-base-salary" type="digit" :value="modelValue.salary || ''" :placeholder="'例如 ' + option.example" maxlength="9" @input="setValue('salary', $event.detail.value)" @blur="setValue('salary', $event.detail.value)" />
      <text>{{ option.unit }}</text>
    </view>
    </template>
    <text class="salary-heading">奖金与提成（可多选）</text>
    <text class="salary-hint">可单独提供，也可与底薪或食宿组合。</text>
    <checkbox-group class="salary-extras" @change="setExtras">
      <label class="salary-choice" :class="{ selected: modelValue.bonusEnabled }"><checkbox value="bonus" :checked="!!modelValue.bonusEnabled" color="#9A6B3F" /><text>奖金</text></label>
      <label class="salary-choice" :class="{ selected: modelValue.commissionEnabled }"><checkbox value="commission" :checked="!!modelValue.commissionEnabled" color="#9A6B3F" /><text>提成</text></label>
    </checkbox-group>
    <view v-if="modelValue.bonusEnabled" class="salary-rule">
      <label class="salary-heading" for="job-bonus-rule">奖金规则 <text>*</text></label>
      <textarea v-if="editingBonus" id="job-bonus-rule" :value="modelValue.bonusDesc" maxlength="120" placeholder="例如：服务满 30 天奖励 500 元，离店时结算" :focus="true" auto-focus @input="setValue('bonusDesc', $event.detail.value)" @blur="onBlurBonus" />
      <view v-else id="job-bonus-rule-idle" class="salary-area-idle" @click="editingBonus = true"><text :class="{ 'k-placeholder': !modelValue.bonusDesc }">{{ modelValue.bonusDesc || '例如：服务满 30 天奖励 500 元，离店时结算' }}</text></view>
    </view>
    <view v-if="modelValue.commissionEnabled" class="salary-rule">
      <label class="salary-heading" for="job-commission-rule">提成规则 <text>*</text></label>
      <textarea v-if="editingCommission" id="job-commission-rule" :value="modelValue.commissionDesc" maxlength="120" placeholder="例如：按个人销售额的 5% 提成，每月结算" :focus="true" auto-focus @input="setValue('commissionDesc', $event.detail.value)" @blur="onBlurCommission" />
      <view v-else id="job-commission-rule-idle" class="salary-area-idle" @click="editingCommission = true"><text :class="{ 'k-placeholder': !modelValue.commissionDesc }">{{ modelValue.commissionDesc || '例如：按个人销售额的 5% 提成，每月结算' }}</text></view>
    </view>
    <text class="salary-preview">{{ preview }}</text>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { SALARY_OPTIONS, salaryOption, parseSalaryAmount, jobBenefits } from '@/common/job-salary.js'
const props = defineProps({ modelValue: { type: Object, required: true } })
const emit = defineEmits(['update:modelValue'])
const option = computed(() => salaryOption(props.modelValue.salaryType))
const benefits = computed(() => jobBenefits(props.modelValue))
const setValue = (key, value) => emit('update:modelValue', { ...props.modelValue, [key]: value })
// 原生 textarea 会盖在页面最上层，压到底部导航和固定的「下一步」时会抢走点击；只在输入时才渲染真输入框
const editingBonus = ref(false), editingCommission = ref(false)
function onBlurBonus(event) { editingBonus.value = false; setValue('bonusDesc', event.detail.value) }
function onBlurCommission(event) { editingCommission.value = false; setValue('commissionDesc', event.detail.value) }
function setBenefits(event) {
  const selected = event.detail.value || []
  const boardEnabled = selected.includes('board'), salaryEnabled = selected.includes('salary')
  emit('update:modelValue', { ...props.modelValue, boardEnabled, salaryEnabled,
    pay: salaryEnabled ? 'salary' : boardEnabled ? 'board' : 'none' })
}
function setExtras(event) {
  const selected = event.detail.value || []
  emit('update:modelValue', { ...props.modelValue, bonusEnabled: selected.includes('bonus'), commissionEnabled: selected.includes('commission') })
}
const preview = computed(() => {
  const f = props.modelValue, amount = parseSalaryAmount(f.salary)
  const parts = benefits.value.boardEnabled ? ['提供食宿'] : []
  if (benefits.value.salaryEnabled) parts.push(amount === null ? '待填写底薪' : `${amount} ${option.value.unit}`)
  if (f.bonusEnabled) parts.push('奖金')
  if (f.commissionEnabled) parts.push('提成')
  return parts.length ? parts.join(' + ') : '不提供食宿、底薪、奖金或提成'
})
</script>

<style scoped lang="scss">
.salary-editor { margin: 14px 0 18px; color: var(--k-ink); }
.salary-heading { display: block; margin: 12px 0 7px; font-size: 14px; line-height: 1.5; font-weight: 600; }
.salary-heading > text { color: var(--k-red); }
.salary-hint { display: block; margin: -2px 0 9px; color: var(--k-muted); font-size: 13px; line-height: 1.6; }
.salary-periods, .salary-extras { display: flex; gap: 8px; flex-wrap: wrap; }
.salary-choice { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 46px; flex: 1 1 calc(50% - 8px); box-sizing: border-box; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); font-size: 14px; }
.salary-extras .salary-choice { flex: 1; }
.salary-choice.selected { border-color: var(--k-red); color: var(--k-red); }
.salary-choice radio, .salary-choice checkbox { transform: scale(.8); }
.salary-amount { display: flex; align-items: center; min-height: 46px; padding: 0 12px; gap: 8px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); }
.salary-amount input { flex: 1; min-width: 0; font-size: 16px; height: 46px; }
.salary-amount > text { flex-shrink: 0; font-size: 14px; color: var(--k-muted); }
.salary-rule textarea, .salary-area-idle { display: block; box-sizing: border-box; width: 100%; height: 86px; padding: 10px 12px; border: 1px solid var(--k-line2); border-radius: 8px; background: var(--k-paper); font-size: 14px; line-height: 1.6; }
/* 未输入时的预览框与输入框同尺寸，长文字换行并截掉多余部分 */
.salary-area-idle { overflow: hidden; white-space: pre-wrap; word-break: break-all; }
.salary-preview { display: block; margin-top: 12px; font-size: 14px; line-height: 1.6; font-weight: 600; overflow-wrap: anywhere; }
</style>
