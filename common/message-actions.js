import { experience, getMessageScopeKey, deleteMessage } from './experience.js'
import { toast } from './screen.js'

let deleting = false
export async function removeInboxMessage(id) {
  if (deleting || !experience.account) return false
  deleting = true
  const scope = getMessageScopeKey()
  const current = () => !!experience.account && getMessageScopeKey() === scope
  try {
    const confirmed = await new Promise(resolve => uni.showModal({
      title: '删除这条消息？', content: '仅移除这条提醒，不影响报名、订单或聊天记录。',
      confirmText: '删除', confirmColor: '#B24F42', cancelText: '取消',
      success: r => resolve(!!r.confirm), fail: () => resolve(false)
    }))
    if (!confirmed || !current()) return false
    const removed = await deleteMessage(id)
    if (!removed || !current()) return false
    toast('消息已删除')
    return true
  } catch (e) {
    if (current()) toast(e?.message || '删除失败，请重试')
    return false
  } finally { deleting = false }
}
