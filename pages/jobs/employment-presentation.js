// Only rearrange text supplied by the store; never infer missing employment terms.
export function employmentContent(lines = []) {
  const source = lines.map(value => String(value || '').trim()).filter(Boolean)
  const numbered = /^\d+[.、．]\s*/
  const hasIntroduction = source.length > 1 && !numbered.test(source[0]) && source.slice(1).every(line => numbered.test(line))
  return {
    introduction: hasIntroduction ? source[0] : '',
    lines: (hasIntroduction ? source.slice(1) : source).map(line => line.replace(numbered, ''))
  }
}

export function employmentSchedule(work) {
  if (!work) return null
  const result = { ...work }
  // Older posts stored both fields in one sentence. Split only this unambiguous format.
  const match = !work.mode && !work.hours && /^(每周\s*\d+(?:\.\d+)?\s*天)\s*[，,]\s*(?:每天|每日)\s*(\d+(?:\.\d+)?\s*小时)\s*[。.]?$/.exec(String(work.note || '').trim())
  if (match) Object.assign(result, { mode: match[1].replace(/\s/g, ''), hours: match[2].replace(/\s/g, ''), note: '' })
  return result
}

// The shared store profile keeps its original text for volunteer posts.
export function employmentSkills(skills) {
  return String(skills || '').split(/[、,，]/).map(item => item.replace(/换工|义工/g, '').trim()).filter(Boolean).join('、')
}
