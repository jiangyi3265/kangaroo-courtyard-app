const dateToken = /(?:(\d{4})[年/-])?(\d{1,2})[月/-](\d{1,2})(?:日|号)?|今天|明天|后天/g
const timeToken = /(?:(上午|下午|晚上|中午|早上|早晨)\s*)?(\d{1,2})(?:[:：](\d{2})|[点时](半|\d{1,2}分?)?)/g
// 人数和收费都只接受一个确定值，识别其他字段前先遮掉区间，避免 8-12 被当成日期。
const numberRange = /[¥￥]?\d+(?:\.\d+)?\s*[人名位元]?\s*[-–—~～至到]\s*[¥￥]?\d+(?:\.\d+)?\s*[人名位元]?/g
function maskQuantityRange(range, offset, clause) {
  const labeled = /(?:人数|限额|每人|人均(?:费用)?|费用|收费)\s*[:：]?\s*$/.test(clause.slice(0, offset))
  return labeled || /[人名位元¥￥]/.test(range) ? ' ' : range
}

const fieldNames = { title:'标题', city:'城市', place:'地点', people:'人数', feeKind:'费用方式', fee:'每人费用', aaFee:'AA预估', intro:'介绍', safety:'安全说明', date:'集合日期', time:'集合时间', endDate:'结束日期', endTime:'结束时间', deadlineDate:'截止日期', deadlineTime:'截止时间' }
const feeNames = { free:'免费', paid:'收费', aa:'AA制' }
export function activityTextPreview(values, dates) {
  return Object.entries({...values, ...dates})
    .map(([key, value]) => fieldNames[key] + '：' + (key === 'feeKind' ? feeNames[value] : value))
    .join('\n')
}

function dayOf(match, today, reference = today) {
  if (!match[2]) {
    const days = ['今天','明天','后天'].indexOf(match[0])
    const d = new Date(today + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const monthDay = match[2].padStart(2,'0') + '-' + match[3].padStart(2,'0')
  const year = match[1] || Number(reference.slice(0,4)) + Number(monthDay < reference.slice(5))
  const iso = year + '-' + monthDay
  const d = new Date(iso + 'T00:00:00Z')
  return !isNaN(d) && d.toISOString().slice(0,10) === iso ? iso : ''
}

function clock(match) {
  let hour = Number(match[2])
  const minute = match[4] === '半' ? 30 : parseInt(match[3] || match[4] || '0', 10)
  if (match[1] && hour > 12) return ''
  if ((/下午|晚上/.test(match[1]) && hour < 12) || (match[1] === '中午' && hour <= 3)) hour += 12
  return hour < 24 && minute < 60 ? String(hour).padStart(2,'0') + ':' + String(minute).padStart(2,'0') : ''
}

export function parseActivityText(text, today) {
  const values = {}, schedule = {}
  let description = ''
  const sections = text.replace(/(活动标题|活动名称|主题|标题|活动城市|城市|集合地点|活动地点|地点|活动介绍|介绍|安全说明|注意事项|集合时间|开始时间|结束时间|报名截止|预计人数|招募人数|人数|限额|人均费用|费用|收费)\s*[:：]/g, '\n$1：')
  for (const original of sections.trim().split(/[，,；;。\n]+/).map(x => x.trim()).filter(Boolean)) {
    const clause = original.replace(numberRange, maskQuantityRange)
    const field = /^(活动标题|活动名称|主题|标题|城市|活动城市|集合地点|活动地点|地点|活动介绍|介绍|安全说明|注意事项)\s*[:：]?\s*(.+)$/.exec(original)
    if (field) {
      const keys = {活动标题:'title',活动名称:'title',主题:'title',标题:'title',城市:'city',活动城市:'city',集合地点:'place',活动地点:'place',地点:'place',活动介绍:'intro',介绍:'intro',安全说明:'safety',注意事项:'safety'}
      values[keys[field[1]]] = field[2].trim()
      description = ['intro','safety'].includes(keys[field[1]]) ? keys[field[1]] : ''
      continue
    }
    const dates = Array.from(clause.matchAll(dateToken)).filter(match => !/(?:[\d.]|\d[:：])$/.test(clause.slice(0, match.index)))
    const times = Array.from(clause.matchAll(timeToken))
    const end = /^(结束|散场)/.test(clause) || /结束$/.test(clause)
    const deadline = /截止/.test(clause)
    if (description && !dates.length && !times.length && !/人数|\d\s*[人名位]|每人|人均|费用|免费|平摊|AA|集合|截止/.test(clause)) {
      values[description] += '，' + original
      continue
    }
    description = ''
    const dateKey = deadline ? 'deadlineDate' : end && times.length < 2 ? 'endDate' : 'date'
    const timeKey = deadline ? 'deadlineTime' : end && times.length < 2 ? 'endTime' : 'time'
    if (dates.length) {
      const reference = dateKey === 'endDate' ? schedule.date || today : today
      const day = dayOf(dates[0], today, reference)
      if (day) schedule[dateKey] = day
    }
    if (times.length && clock(times[0])) schedule[timeKey] = clock(times[0])
    if (!deadline && dates.length > 1) {
      const lastDay = dayOf(dates[1], today, schedule.date || today)
      if (lastDay) schedule.endDate = lastDay
    }
    if (times.length > 1 && !deadline && clock(times[1])) {
      const endClock = [...times[1]]
      if (!endClock[1] && times[0][1] && dates.length < 2 && Number(endClock[2]) >= Number(times[0][2]) && Number(endClock[2]) < 12) endClock[1] = times[0][1]
      schedule.endTime = clock(endClock)
      if (dates.length === 1 && schedule.date) {
        const lastDay = new Date(schedule.date + 'T00:00:00Z')
        if (schedule.endTime < schedule.time) lastDay.setUTCDate(lastDay.getUTCDate() + 1)
        schedule.endDate = lastDay.toISOString().slice(0,10)
      }
    }
    const people = /(?:预计人数|招募人数|限额|人数)\s*[:：]?\s*(\d+)\s*(?:[人位名](?!\s*(?:以上|以下|左右|起))|$)/.exec(clause) || /(\d+)\s*[人位名]\s*(?=$|参加|报名|参与|同行|一起)/.exec(clause)
    if (people && +people[1] >= 2 && +people[1] <= 50) values.people = +people[1]
    const price = /(?:每人|人均(?:费用)?|费用|收费)\s*[:：]?\s*[¥￥]?\s*(\d+(?:\.\d{1,2})?)(?=\s*(?:[元块](?!\s*(?:起|以[上下]|左右))|$))/.exec(clause) || /(?:^|[^\d.])(\d+(?:\.\d{1,2})?)\s*元\s*\/\s*人(?!\s*(?:起|以[上下]|左右))/.exec(clause)
    if (/AA|平摊/i.test(clause)) {
      values.feeKind = 'aa'
      if (values.fee) { values.aaFee = values.fee; delete values.fee }
    }
    else if (/^(?:本次|此次)?(?:活动费用|报名费|活动|报名|费用|收费)?\s*[:：]?\s*(?:免费(?:参加|参与|报名|入场)?|免报名费)$/.test(clause)) values.feeKind = 'free'
    if (price && Number(price[1]) === 0 && values.feeKind !== 'aa') values.feeKind = 'free'
    if (price && Number(price[1]) > 0) {
      if (values.feeKind !== 'aa') values.feeKind = 'paid'
      values[values.feeKind === 'aa' ? 'aaFee' : 'fee'] = price[1]
    }
    const place = /(?:在|到)([^，。]{2,40}?)(?:集合|碰面)/.exec(clause) || /^(.{2,40}?)集合$/.exec(clause.replace(/^.*(?:[:：]\d{2}|点(?:半)?)\s*/, ''))
    if (place) values.place = place[1].trim()
    if (!values.title && !field && !dates.length && !times.length && !people && !price && !place && !/免费|平摊|AA|截止/i.test(clause) && clause.length <= 30 && /徒步|露营|聚餐|骑行|读书|旅行|桌游|沙龙|体验|爬山|观影|漫步|分享会|烧烤/.test(clause)) values.title = clause
  }
  return {values,schedule}
}
