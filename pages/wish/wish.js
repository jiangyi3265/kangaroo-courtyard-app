export const categories = [
  { key: 'craft', label: '文创手作', icon: 'shopping-bag', hint: '手作好物 · 地方工艺' },
  { key: 'souvenir', label: '地方好物', icon: 'gift', hint: '纪念品 · 特色物件' },
  { key: 'postcard', label: '拍照寄语', icon: 'camera', hint: '风景打卡 · 明信片' },
  { key: 'errand', label: '生活互助', icon: 'heart', hint: '代买 · 日常小事' },
  { key: 'food', label: '食品类', icon: 'utensils', hint: '服务者需通过资质审核' },
  { key: 'licensed', label: '特殊许可', icon: 'shield-check', hint: '烟酒类 · 单独审核' }
]
export const deliveries = [{ key: 'express', label: '快递寄送' }, { key: 'digital', label: '线上交付' }, { key: 'meet', label: '当面交付' }]
export const statusText = s => ({ pending_payment: '待支付', reviewing: '审核中', open: '等待帮忙', accepted: '进行中', submitted: '待确认完成', completed: '已完成', disputed: '平台处理中', refunding: '退款中', refund_failed: '退款未完成', cancelled: '已取消' }[s] || '状态更新中')
export const categoryText = key => categories.find(x => x.key === key)?.label || '心愿互助'
export const deliveryText = key => deliveries.find(x => x.key === key)?.label || '待协商'
export const money = n => (Number(n || 0) / 100).toFixed(2)
export const requestKey = () => 'wish-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)
export const route = (page, id) => '/pages/wish/' + page + (id ? '?id=' + id : '')
