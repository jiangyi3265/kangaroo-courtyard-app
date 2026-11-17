export const SALARY_OPTIONS = [
  { value: 'hourly', label: '时薪', unit: '元/小时', example: '25.5' },
  { value: 'daily', label: '日薪', unit: '元/天', example: '150' },
  { value: 'weekly', label: '周薪', unit: '元/周', example: '1000' },
  { value: 'monthly', label: '月薪', unit: '元/月', example: '5000' }
]

export const salaryOption = (type) => SALARY_OPTIONS.find(o => o.value === type) || SALARY_OPTIONS[1]

// 新表单两项独立选择；未带新字段的旧客户端仍按原 pay 选项解释。
export function jobBenefits(form) {
  return {
    boardEnabled: typeof form.boardEnabled === 'boolean' ? form.boardEnabled : form.pay === 'board',
    salaryEnabled: typeof form.salaryEnabled === 'boolean' ? form.salaryEnabled : form.pay === 'salary'
  }
}

export function parseSalaryAmount(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null
  const amount = Number(text)
  return amount > 0 && amount <= 100000 ? amount : null
}

export function validateSalaryForm(form) {
  if (jobBenefits(form).salaryEnabled) {
    if (!SALARY_OPTIONS.some(o => o.value === form.salaryType)) return '请选择底薪周期'
    if (parseSalaryAmount(form.salary) === null) return '底薪需大于 0、不超过 100000，最多两位小数'
  }
  for (const [key, label] of [['bonus', '奖金'], ['commission', '提成']]) {
    if (!form[`${key}Enabled`]) continue
    const text = String(form[`${key}Desc`] || '').trim()
    if (!text) return `请填写${label}规则`
    if (text.length > 120) return `${label}规则不能超过 120 字`
  }
  return ''
}

// 隐藏或取消勾选的待遇不进入发布请求，避免残留内容继续对外展示。
export function salaryPayload(form) {
  const paid = jobBenefits(form).salaryEnabled
  return {
    salaryType: paid ? form.salaryType : 'none',
    salary: paid ? parseSalaryAmount(form.salary) : 0,
    bonusEnabled: !!form.bonusEnabled,
    bonusDesc: form.bonusEnabled ? String(form.bonusDesc || '').trim() : null,
    commissionEnabled: !!form.commissionEnabled,
    commissionDesc: form.commissionEnabled ? String(form.commissionDesc || '').trim() : null
  }
}
