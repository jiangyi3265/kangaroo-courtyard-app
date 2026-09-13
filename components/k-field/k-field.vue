<template>
  <view class="k-field" :class="{ 'is-row': row }">
    <view v-if="label" class="k-field__label"><text>{{ label }}</text><text v-if="required" class="k-field__req">*</text><text v-if="hint" class="k-field__hint">{{ hint }}</text></view>
    <view class="k-field__box" :class="{ 'is-error': !!error, 'is-focus': focused, 'is-area': type === 'textarea', 'is-readonly': readonly }">
      <slot name="prefix" />
      <textarea v-if="type === 'textarea'" class="k-field__area" :value="modelValue" :placeholder="placeholder" placeholder-class="k-placeholder" :maxlength="maxlength" :disabled="readonly" @input="onInput" @focus="focused = true" @blur="focused = false" />
      <input v-else class="k-field__input" :type="type" :value="modelValue" :placeholder="placeholder" placeholder-class="k-placeholder" :maxlength="maxlength" :disabled="readonly" @input="onInput" @focus="focused = true" @blur="focused = false" />
      <text v-if="counter && maxlength > 0" class="k-field__counter">{{ String(modelValue || '').length }}/{{ maxlength }}</text>
      <slot name="suffix" />
    </view>
    <text v-if="error" class="k-field__error">{{ error }}</text>
  </view>
</template>

<script setup>
import { ref } from 'vue'
defineOptions({ options: { virtualHost: true, styleIsolation: 'apply-shared' } })
defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },        // 标签后的灰色说明，如“（选填）”
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },    // text | number | textarea
  required: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  error: { type: String, default: '' },
  maxlength: { type: Number, default: -1 },
  counter: { type: Boolean, default: false },
  row: { type: Boolean, default: false }      // 标签与输入框同一行
})
const emit = defineEmits(['update:modelValue'])
const focused = ref(false)
const onInput = (e) => emit('update:modelValue', e.detail.value)
</script>

<style scoped lang="scss">
.k-field { display: flex; flex-direction: column; gap: 6px; }
.k-field.is-row { flex-direction: row; align-items: center; gap: 12px; }
.k-field.is-row .k-field__label { width: 72px; flex: 0 0 auto; }
.k-field.is-row .k-field__box { flex: 1; }
.k-field__label { font-size: 13px; color: var(--k-ink); font-weight: 500; display: flex; align-items: center; gap: 2px; }
.k-field__req { color: var(--k-red); }
.k-field__hint { color: var(--k-light); font-weight: 400; margin-left: 4px; }
.k-field__box { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; background: var(--k-paper); border: 1px solid var(--k-line2); border-radius: 8px; }
.k-field__box.is-area { align-items: flex-start; padding: 10px 12px; position: relative; }
.k-field__box.is-focus { border-color: var(--k-red); }
.k-field__box.is-error { border-color: var(--k-red); }
.k-field__box.is-readonly { background: var(--k-paper2); }
.k-field__input { flex: 1; min-width: 0; height: 42px; font-size: 14px; }
.k-field__area { flex: 1; width: 100%; min-height: 84px; height: auto; font-size: 14px; line-height: 1.5; }
.k-field__counter { position: absolute; right: 12px; bottom: 8px; font-size: 11px; color: var(--k-light); }
.k-field__error { font-size: 12px; color: var(--k-red); }
</style>
