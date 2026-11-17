export const hasGenderCounts = (job = {}) => job.jobType === 'volunteer'
  && job.genderMaleCount != null && job.genderFemaleCount != null
export const genderCountText = (job = {}) => hasGenderCounts(job)
  ? `男生 ${job.genderMaleCount} 人 · 女生 ${job.genderFemaleCount} 人` : ''
const count = value => /^\d{1,2}$/.test(String(value ?? '')) ? Number(value) : null
export function genderPlanError(form) {
  if (form.jobType !== 'volunteer' || !form.genderCountsEnabled) return ''
  const male = count(form.genderMaleCount), female = count(form.genderFemaleCount)
  if (male == null || female == null) return '请填写男生和女生人数，不招请填 0'
  if (male + female < 1 || male + female > 99) return '男生和女生合计需为 1–99 人'
  return ''
}
export function genderPlanPayload(form) {
  const enabled = form.jobType === 'volunteer' && !!form.genderCountsEnabled
  const male = enabled ? count(form.genderMaleCount) : null
  const female = enabled ? count(form.genderFemaleCount) : null
  return {
    genderCountsEnabled: enabled, genderMaleCount: male, genderFemaleCount: female,
    headcount: enabled ? (male ?? 0) + (female ?? 0) : form.headcount,
    genderPref: form.jobType !== 'volunteer' ? '' : enabled
      ? (male === 0 ? 'F' : female === 0 ? 'M' : '') : (form.genderPref || '')
  }
}
