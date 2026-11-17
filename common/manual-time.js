export function normalizeClock(value) {
  const raw=String(value||'').trim().replace(/：/g,':')
  let h,m
  if(/^\d{3,4}$/.test(raw)){h=raw.slice(0,-2);m=raw.slice(-2)}
  else {const match=/^(\d{1,2}):(\d{2})$/.exec(raw);if(!match)return '';[,h,m]=match}
  if(Number(h)>23||Number(m)>59)return ''
  return String(Number(h)).padStart(2,'0')+':'+m
}
