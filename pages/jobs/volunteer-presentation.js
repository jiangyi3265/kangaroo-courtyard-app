// 换宿详情的展示层：缺资料也保留原稿区块；占位文案不写入业务数据。
export function photoSlots(images, count) {
  const list = (images || []).filter(src => src && !src.endsWith('/static/media/cover-empty.png'))
  return Array.from({ length: count }, (_, index) => ({ src: list[index] || '', index }))
}

export function volunteerHero(images) {
  const count = (images || []).filter(src => src && !src.endsWith('/static/media/cover-empty.png')).length
  const slots = photoSlots(images, Math.max(1, Math.min(6, count)))
  return { main: slots[0].src, grid: slots.slice(1), more: Math.max(0, count - slots.length) }
}

const completeRows = (keys, rows, fallback) => keys.map(k => (rows || []).find(row => row.k === k) || { k, v: fallback })

export function volunteerSections(data) {
  const { travel, stats, content, work, welfare, benefits, manager, facilities, assurance, insuranceFlag } = data
  const columns = (benefits || []).map(column => ({ ...column, items: column.items.length ? column.items : ['具体安排待补充'] }))
  if (!columns.length) columns.push({ title: '食宿与福利', items: ['食宿安排待补充', '福利说明待补充'] })
  if (columns.length === 1) columns.push({ title: '结算说明', items: ['结算方式待补充', '报名前可与门店确认'] })
  const facilitySlots = [...(facilities || [])]
  const assuranceSlots = ['insurance', 'license', 'help'].map(key => (assurance || []).find(row => row.key === key) || ({
    insurance: { key, k: '保险保障', v: String(insuranceFlag) === '1' ? '本岗位不含平台意外险' : '保险信息待补充', pending: true },
    license: { key, k: '门店资质', v: '营业执照待补充', link: '查看营业执照', pending: true },
    help: { key, k: '平台协助', v: '服务期间遇到问题，可联系袋鼠平台协调处理' }
  })[key])
  return {
    ...data,
    travel: { rows: completeRows(['高铁', '机场'], travel?.rows, '路线待补充'), cost: travel?.cost || '待补充' },
    requirements: data.requirements || { title: '换工要求', rows: [{ k: '', v: '岗位要求待补充' }] },
    stats: completeRows(['招募信息', '到岗时间', '最短期限'], stats, '待确认'),
    content: content?.length ? content : ['具体工作内容待补充', '报名前可与门店沟通确认'],
    work: { ...work, hours: work?.hours || '工时待补充', mode: work?.mode || '排班待补充' },
    welfare: welfare || { title: '福利待遇', highlights: [], items: [] },
    benefits: columns,
    manager: { name: '', avatar: '', years: '', skills: '', quote: '', ratingText: '', ...manager },
    facilities: facilitySlots,
    assurance: assuranceSlots
  }
}
