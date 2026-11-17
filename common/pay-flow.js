// 共享支付流程：服务端决定通道，最终以服务端查到"已支付"为准。
//   · 联调（mock）通道：用系统弹窗确认，标题写明"联调模拟支付"，不画任何像微信收银台的界面，不扣款；
//   · 真实通道：uni.requestPayment 拉起微信官方支付界面（商户号与证书未配置时服务端直接拒绝，页面如实提示）。
// 返回 { status: 'paid' | 'cancel' | 'unknown', pay }
import { apiPayPrepay, apiPayMockConfirm, apiPayStatus, apiPayConfig } from './api.js'
import { modal, yuan, sleep } from './ui.js'

const received = (pay) => ['paid', 'part_refunded', 'refunded'].includes(pay.status)

// 客户端回调丢失或报错不代表未扣款。只重查，不重试拉起收银台。
async function queryResult(payNo, attempts = 5, isCurrent = () => true) {
  let pay
  for (let i = 0; i < attempts; i++) {
    if (!isCurrent()) return { status: 'unknown' }
    try {
      pay = (await apiPayStatus(payNo)).data || {}
      if (!isCurrent()) return { status: 'unknown' }
      if (received(pay)) return { status: 'paid', pay }
    } catch (e) { /* 网络暂时不可用时继续有限次查询，不能据此判定未支付 */ }
    if (i < attempts - 1) await sleep(1000)
  }
  return { status: 'unknown', pay }
}

export async function payFlow(payNo, { isCurrent = () => true } = {}) {
  if (!isCurrent()) return { status: 'unknown' }
  // #ifndef MP-WEIXIN
  const config = (await apiPayConfig()).data || {}
  if (!isCurrent()) return { status: 'unknown' }
  if (config.mode === 'wechat') throw new Error('请在微信小程序内完成支付')
  // #endif
  let pre
  try {
    pre = (await apiPayPrepay(payNo)).data || {}
    if (!isCurrent()) return { status: 'unknown' }
  } catch (e) {
    // 已付款的订单再次进入时，预支付接口可能拒绝创建；先检查已有交易。
    const result = await queryResult(payNo, 1, isCurrent)
    if (result.status === 'paid') return result
    throw e
  }
  if (pre.channel === 'mock') {
    const r = await modal('联调模拟支付', `当前为联调环境，不会真实扣款。确认模拟支付 ¥${yuan(pre.amount)}？`, { confirmText: '模拟支付' })
    if (!isCurrent()) return { status: 'unknown' }
    if (!r.confirm) return { status: 'cancel' }
    try { await apiPayMockConfirm(payNo) } catch (e) { /* 确认响应丢失也要查最终状态 */ }
  } else if (pre.channel === 'wechat') {
    if (!isCurrent()) return { status: 'unknown' }
    // #ifndef MP-WEIXIN
    throw new Error('请在微信小程序内完成支付')
    // #endif
    const outcome = await new Promise((resolve) => {
      try {
        uni.requestPayment({
          provider: 'wxpay',
          ...(pre.params || {}),
          success: () => resolve('success'),
          fail: (e) => resolve(/cancel/i.test((e && e.errMsg) || '') ? 'cancel' : 'unknown')
        })
      } catch (e) { resolve('unknown') }
    })
    if (outcome === 'cancel') {
      const result = await queryResult(payNo, 1, isCurrent)
      return result.status === 'paid' ? result : { status: 'cancel', pay: result.pay }
    }
  } else {
    throw new Error('当前支付渠道不可用，请刷新后重试')
  }
  return queryResult(payNo, 5, isCurrent)
}

/** 渠道显示名：联调通道要写清楚"不扣款" */
export const channelLabel = (mode) => (mode === 'wechat' ? '微信支付' : mode === 'mock' ? '模拟支付（联调，不扣款）' : '支付方式确认中')
