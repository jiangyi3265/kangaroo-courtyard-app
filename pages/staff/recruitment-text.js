export function parseRecruitmentText(text) {
  const form = {}, gen = {}
  let description = ''
  const sections = text.replace(/(招聘岗位|岗位名称|岗位标题|职位名称|招聘人数|招募人数|人数|月工资|月薪|底薪|时薪|日薪|周薪|工作内容|工作职责|岗位职责|任职要求|岗位要求|工作地址|工作地点|上班地点|地址)\s*[:：]/g, '\n$1：')
    .replace(/(\d),(?=\d{3}(?!\d))/g, '$1')
  for (const clause of sections.trim().split(/[，,；;。\n]+/).map(s => s.trim()).filter(Boolean)) {
    if (description && !/^(?:招聘|招募|招|岗位|职位|月工资|月薪|底薪|时薪|日薪|周薪|工作|职责|负责|要求|任职|人数|上班地点|地址|食宿|只包|包吃|包住|包食宿|不包|双休|单休|[上做][五六]休[一二]|每天|每日)/.test(clause)) {
      gen[description] += '，' + clause
      continue
    }
    description = ''
    const countField = /^(?:(?:招聘|招募)?人数\s*[:：]?\s*|(?:招聘|招募|招)\s*(?=\d))/.exec(clause)
    const title = !countField && /^(?:招聘岗位|岗位名称|岗位标题|职位名称|岗位(?!职责|要求)|职位|[^：:]*?招聘|招募|招)\s*[:：]?\s*(?:全职)?\s*([^\d，。]+?)(?=\s*\d+(?:\.\d+)?\s*(?:[人名位]|[-~～–—至到])|\s*(?:月薪|月工资|底薪|时薪|日薪|周薪)|$)/.exec(clause)
    if (title && title[1].trim() && title[1].length <= 30) gen.title = title[1].trim()
    const countText = clause.slice(countField ? countField[0].length : title ? title[0].length : 0).trim()
    const count = /^(\d{1,2})\s*[人名位](?!\s*[-~～–—至到]|以上|以下|左右)/.exec(countText)
      || (countField && /^(\d{1,2})$/.exec(countText))
    if (count && Number(count[1]) > 0) form.headcount = Number(count[1])
    const pay = /(?:月薪|月工资|底薪|时薪|日薪|周薪)\s*[:：]?\s*[¥￥]?\s*(\d+(?:\.\d{1,2})?)\s*(千|[kK]|万)?\s*元?(?![\d.])/.exec(clause)
    if (pay && !/^\s*(?:[-~～–—至到]\s*[¥￥]?\s*\d|起|以上|以下|左右)/.test(clause.slice(pay.index + pay[0].length))) {
      const amount = Number(pay[1]) * (pay[2] === '万' ? 10000 : pay[2] ? 1000 : 1)
      if (amount > 0 && amount <= 100000) {
        form.salary = String(Math.round(amount*100)/100)
        form.salaryType = ({时:'hourly',日:'daily',周:'weekly'})[pay[0][0]] || 'monthly'
      }
    }
    const work = /^(?:工作内容|工作职责|岗位职责|职责|负责)\s*[:：]?\s*(.+)/.exec(clause)
    if (work) { gen.work = [gen.work, work[1]].filter(Boolean).join('\n'); description = 'work' }
    const req = /^(?:岗位要求|任职要求|其他要求|要求|需具备)\s*[:：]?\s*(.+)/.exec(clause)
    if (req) { gen.hope = [gen.hope, req[1]].filter(Boolean).join('\n'); description = 'hope' }
    const address = /^(?:工作地址|工作地点|上班地点|地址)\s*[:：]?\s*(.+)/.exec(clause)
    if (address) form.address = address[1]
    const hours = /(?:每天|每日)\s*(\d{1,2})\s*(?:个)?小时/.exec(clause)
    if (hours && +hours[1] > 0 && +hours[1] <= 24) form.dailyHours = '每天 ' + hours[1] + ' 小时'
    if (/不包吃\s*(?:也)?不包住|不包住\s*(?:也)?不包吃|不包吃住|不包食宿|食宿自理/.test(clause)) form.boardType = 'none'
    else if (/只包住|包住不包吃/.test(clause)) form.boardType = 'room'
    else if (/只包吃|包吃不包住/.test(clause)) form.boardType = 'meal'
    else if (/包吃包住|包食宿|包吃住/.test(clause)) form.boardType = 'all'
    else if (/^包住$/.test(clause)) form.boardType = 'room'
    else if (/^包吃$/.test(clause)) form.boardType = 'meal'
    const rest = clause.replace(/(?:不保证|不承诺|不提供|没有|不含|不是|无|非|不)\s*(?:周末)?\s*(?:双休|单休|[做上][五六]休[一二])/g, '')
    if (/双休|做五休二|上五休二/.test(rest)) form.restMode = '5-2'
    else if (/单休|做六休一|上六休一/.test(rest)) form.restMode = '6-1'
  }
  for (const key of ['work','hope']) if (gen[key]) gen[key] = gen[key].slice(0, 300)
  return {form,gen}
}
