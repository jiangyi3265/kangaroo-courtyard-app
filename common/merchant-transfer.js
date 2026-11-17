export function requireMerchantTransfer() {
  // #ifdef MP-WEIXIN
  if (!wx.canIUse('requestMerchantTransfer')) throw Error('请更新微信后再申请提现')
  return
  // #endif
  // #ifndef MP-WEIXIN
  throw Error('请在微信小程序中申请提现并确认收款')
  // #endif
}

export function confirmMerchantTransfer(params) {
  requireMerchantTransfer()
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => wx.requestMerchantTransfer({
    ...params,
    success: resolve,
    fail: () => reject(Error('收款确认尚未完成，可在提现记录中继续确认')),
  }))
  // #endif
}
