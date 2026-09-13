<template>
  <view class="k-page">
    <k-topbar title="报名加入" back @back="prev" />
    <view class="steps"><k-steps :steps="['报名资料', '到岗安排', '确认信息']" :current="step" /></view>
    <view class="k-body application">
      <text class="context">报名岗位：{{ jobTitle }}</text>
      <template v-if="step === 1">
        <text class="intro">确定感兴趣后，再填写本次报名需要的资料。</text>
        <k-field v-model="form.name" label="姓名" required placeholder="请输入姓名" :error="errors.name" :maxlength="40" />
        <k-field v-model="form.age" label="年龄" type="number" required placeholder="请输入年龄" :error="errors.age" :maxlength="3" />
        <k-field v-model="form.phone" label="联系手机号" type="number" required placeholder="请输入手机号" :error="errors.phone" :maxlength="11" />
        <k-field v-model="form.skills" label="技能与经历" hint="（选填）" type="textarea" placeholder="如咖啡制作、摄影，或相关工作经历" :maxlength="500" />
      </template>
      <template v-else-if="step === 2">
        <text class="intro">按这次报名填写到岗安排，未报名时无需提前确定。</text>
        <view><text class="field-label">预计到岗日期 *</text><picker mode="date" :value="form.arrival || today" :start="today" @change="form.arrival = $event.detail.value"><view class="date-field"><text>{{ form.arrival || '请选择到岗日期' }}</text><k-icon name="calendar-days" :size="20" color="ink" /></view></picker><text v-if="errors.arrival" class="error">{{ errors.arrival }}</text></view>
        <k-field v-model="form.days" label="可停留天数" type="number" required placeholder="请输入本次可停留天数" :error="errors.days" :maxlength="3" />
        <k-field v-model="form.note" label="补充说明" hint="（选填）" type="textarea" placeholder="如可工作时段、想提前沟通的问题" :maxlength="500" />
      </template>
      <template v-else>
        <text class="k-title">核对本次报名资料</text>
        <view v-for="item in summary" :key="item.label" class="summary-row"><text>{{ item.label }}</text><text>{{ item.value || '未填写' }}</text></view>
        <text class="intro">当前可保存报名草稿，暂未开放在线提交。保存后不会产生审核、面试或签约通知。</text>
        <text v-if="saved" class="saved">资料已保存，可返回继续浏览，下次报名时修改。</text>
        <k-button v-if="saved" type="outline" block @click="back">返回继续浏览</k-button>
      </template>
    </view>
    <k-bottom flat><k-button v-if="step > 1" type="outline" @click="prev">上一步</k-button><view class="k-flex1"><k-button block @click="next">{{ step < 3 ? '下一步' : '保存报名草稿' }}</k-button></view></k-bottom>
  </view>
</template>
<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { back, toast } from '@/common/screen.js'
import { loadApplicationDraft, saveApplicationDraft } from '@/common/experience.js'
const step = ref(1)
const saved = ref(false)
const jobTitle = ref('古城咖啡馆驻店伙伴')
const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
const draft = loadApplicationDraft()
const fields = ['name','age','phone','skills','arrival','days','note']
const form = reactive(Object.fromEntries(fields.map(key => [key, typeof draft[key] === 'string' ? draft[key] : ''])))
const errors = reactive({})
fields.forEach(key => watch(() => form[key], () => { errors[key] = ''; saved.value = false }))
onLoad(q => { if (q?.title) jobTitle.value = q.title })
const validatePersonal = () => {
  errors.name = form.name.trim() ? '' : '请填写姓名'
  errors.age = /^\d+$/.test(form.age) && Number(form.age) > 0 && Number(form.age) <= 120 ? '' : '请填写有效年龄'
  errors.phone = /^1\d{10}$/.test(form.phone) ? '' : '请填写11位手机号'
  return !errors.name && !errors.age && !errors.phone
}
const validateSchedule = () => {
  errors.arrival = /^\d{4}-\d{2}-\d{2}$/.test(form.arrival) && form.arrival >= today ? '' : '请选择今天或之后的到岗日期'
  errors.days = /^\d+$/.test(form.days) && Number(form.days) > 0 && Number(form.days) <= 365 ? '' : '请填写1至365天'
  return !errors.arrival && !errors.days
}
const next = () => {
  saved.value = false
  if (!validatePersonal()) { step.value = 1; return }
  if (step.value === 1) { step.value = 2; return }
  if (!validateSchedule()) { step.value = 2; return }
  if (step.value === 2) { step.value = 3; return }
  try { saveApplicationDraft({ ...form, name: form.name.trim(), jobTitle: jobTitle.value }); saved.value = true }
  catch { toast('保存失败，请重试') }
}
const prev = () => { saved.value = false; if (step.value > 1) step.value--; else back() }
const summary = computed(() => [
  { label:'姓名', value:form.name }, { label:'年龄', value:form.age }, { label:'手机号', value:form.phone },
  { label:'技能与经历', value:form.skills }, { label:'到岗日期', value:form.arrival },
  { label:'停留天数', value:form.days + ' 天' }, { label:'补充说明', value:form.note }
])
</script>
<style scoped lang="scss">
.steps { padding:16px; }.application { display:flex; flex-direction:column; gap:20px; padding-bottom:130px; }.context { font-size:16px; font-weight:600; line-height:1.6; }.intro { font-size:14px; color:var(--k-muted); line-height:1.8; }.field-label { font-size:14px; display:block; margin-bottom:8px; }.date-field { min-height:48px; display:flex; justify-content:space-between; align-items:center; padding:0 12px; border:1px solid var(--k-line2); border-radius:8px; background:var(--k-paper); font-size:14px; }.error { display:block; color:var(--k-red); font-size:14px; margin-top:6px; }.summary-row { display:flex; justify-content:space-between; gap:24px; padding-bottom:14px; border-bottom:1px solid var(--k-line); font-size:14px; line-height:1.7; }.summary-row>text:first-child { flex:0 0 84px; color:var(--k-muted); }.summary-row>text:last-child { overflow-wrap:anywhere; text-align:right; }.saved { color:var(--k-green); font-size:14px; line-height:1.8; }
</style>
