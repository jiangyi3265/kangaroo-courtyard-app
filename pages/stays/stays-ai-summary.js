// 模型参考分与住客原始评分分别呈现；模型未完成时绝不把统计平均分标为 AI。
export function stayAiSummary(value) {
  const ai = value || {}
  const score = Number(ai.score)
  const ready = ai.status === 'ready' && ai.source === 'model' && Number.isFinite(score) && score >= 1 && score <= 5 && Number(ai.reviewCount) > 0
  return {
    ready,
    score: ready ? score.toFixed(1) : '',
    summary: ready ? String(ai.summary || '') : '',
    highlights: ready && Array.isArray(ai.highlights) ? ai.highlights.filter(x => typeof x === 'string') : [],
    cautions: ready && Array.isArray(ai.cautions) ? ai.cautions.filter(x => typeof x === 'string') : [],
    count: ready ? Number(ai.reviewCount) : 0,
    note: ready ? 'AI参考分，不替代住客评分' : ai.status === 'pending' ? 'AI总结生成中，先展示住客评分' : ai.status === 'no_reviews' ? '暂无入住评价，尚不能生成AI总结' : 'AI总结暂未生成，展示住客评分'
  }
}
