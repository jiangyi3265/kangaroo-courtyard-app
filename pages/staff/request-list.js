// 商家需求列表的分页状态（线上任务审核、商家服务人、城市负责人共用）：换页签时晚到的旧结果不覆盖新的，翻页失败不清空已有的。
import { ref } from 'vue'

/** fetchPage(pageNum) 返回接口的 data：{ rows, total, hasMore, city } */
export function useRequestList(fetchPage) {
  const rows = ref([]), total = ref(0), hasMore = ref(false), city = ref('')
  const loading = ref(false), loaded = ref(false), error = ref('')
  let seq = 0, page = 1
  async function reload() {
    const id = ++seq
    loading.value = true
    error.value = ''
    try {
      const d = (await fetchPage(1)) || {}
      if (id !== seq) return
      rows.value = d.rows || []
      total.value = Number(d.total) || 0
      hasMore.value = !!d.hasMore
      city.value = d.city || ''
      page = 1
      loaded.value = true
    } catch (e) {
      if (id !== seq) return
      rows.value = []
      total.value = 0
      hasMore.value = false
      error.value = (e && e.message) || '加载失败，请重试'
    } finally {
      if (id === seq) loading.value = false
    }
  }
  async function more() {
    if (loading.value || !hasMore.value) return false
    const id = ++seq
    loading.value = true
    try {
      const d = (await fetchPage(page + 1)) || {}
      if (id !== seq) return false
      rows.value = rows.value.concat(d.rows || [])
      hasMore.value = !!d.hasMore
      page += 1
      return true
    } catch (e) {
      if (id === seq) uni.showToast({ title: (e && e.message) || '加载失败，请重试', icon: 'none' })
      return false
    } finally {
      if (id === seq) loading.value = false
    }
  }
  /** 离开页面：还在路上的结果作废 */
  const cancel = () => { seq++ }
  return { rows, total, hasMore, city, loading, loaded, error, reload, more, cancel }
}
