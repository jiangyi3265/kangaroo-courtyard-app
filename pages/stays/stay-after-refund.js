export function parseRefundAmount(value, maximumFen) {
  const text=String(value||'').trim()
  if(!/^\d+(\.\d{1,2})?$/.test(text))return {error:'请填写正确的金额，最多两位小数'}
  const [whole,decimal='']=text.split('.')
  const fen=Number(whole)*100+Number(decimal.padEnd(2,'0'))
  if(!Number.isSafeInteger(fen)||fen<=0)return {error:'申请金额至少 0.01 元'}
  if(fen>Number(maximumFen))return {error:'申请金额不能超过当前可退余额'}
  return {fen}
}
