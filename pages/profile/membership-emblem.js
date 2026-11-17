// 六级袋鼠成长徽章：圆脸幼崽与旅行配件，小尺寸保留表情和等级轮廓。
const PALETTES = [
  ['#EEF1E7', '#5E7151', '#C5CEB9'],
  ['#F5EDDF', '#8A6845', '#D8C5A8'],
  ['#EAF0F2', '#516A76', '#BFCDD2'],
  ['#E7EFE9', '#426554', '#BACDC1'],
  ['#F3E8D5', '#946831', '#D8BF93'],
  ['#EEE5D8', '#775437', '#C4AB8D']
]
const MUTED = ['#F1EFEB', '#898278', '#D6D0C7']
const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const cache = new Map()
function mascot(i, off) {
  const c = off ? { fur:'#BEB8AE', dark:'#77736C', cream:'#F4F1EA', pink:'#D2CBC4', accent:'#99948A', gold:'#C5BFB2' }
    : { fur:'#E8B784', dark:'#956443', cream:'#FFF2DA', pink:'#EEAB9C', accent:['#88A68C','#D78067','#709CA7','#73937B','#B290AE','#B47758'][i], gold:'#F2C96A' }
  const tone=fill=>fill===c.fur?'url(#fur)':fill===c.cream?'url(#cream)':fill===c.accent?'url(#accent)':fill===c.gold?'url(#gold)':fill
  const shape=(d,fill=c.fur)=>`<path d="${d}" fill="${tone(fill)}" stroke="${c.dark}" stroke-width="1.05" stroke-linejoin="round" stroke-linecap="round"/>`
  const ellipse=(x,y,rx,ry,fill)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`
  const seam=d=>`<path d="${d}" fill="none" stroke="${c.cream}" stroke-width=".8" stroke-linecap="round" opacity=".8"/>`
  const gradient=(id,a,b)=>`<linearGradient id="${id}" x1=".15" y1="0" x2=".8" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`
  const defs=`<defs>${gradient('fur',off?'#E5E0D8':'#FAD8A9',off?'#ABA59C':'#D99A61')}${gradient('cream','#FFFCF3',c.cream)}${gradient('accent',off?'#C8C3B9':['#B7CBB1','#F0AA90','#A3C9D0','#AFC4A0','#D5BED9','#D9A484'][i],c.accent)}${gradient('gold','#FFF0B6',off?'#B6AFA0':'#DBA444')}</defs>`
  const star=(x,y)=>`<path d="M${x} ${y-4}Q${x+1} ${y-1} ${x+4} ${y}Q${x+1} ${y+1} ${x} ${y+4}Q${x-1} ${y+1} ${x-4} ${y}Q${x-1} ${y-1} ${x} ${y-4}Z" fill="${c.gold}"/>`
  const ears=shape('M32 33C23 23 25 9 30 10C36 11 39 25 38 32Z')+shape('M57 32C56 23 60 9 66 10C72 12 67 27 63 34Z')
    +`<path d="M31 27Q27 15 30 15Q34 18 34 28Z M61 28Q61 18 65 15Q67 20 63 29Z" fill="${c.pink}"/>`+seam('M28 18Q27 24 31 29M62 16L60 24')
  const face=shape('M25 43C25 30 35 25 48 25C62 25 72 32 72 44C72 58 61 64 48 64C34 64 24 57 25 43Z')
    +`<path d="M29 39Q33 29 46 29" fill="none" stroke="${c.cream}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`
    +ellipse(48,53,14,10,'url(#cream)')+`<g opacity=".65">${ellipse(32,51,5,2.8,c.pink)+ellipse(64,51,5,2.8,c.pink)}</g>`
    +ellipse(38.5,44,3.25,4.2,off?'#68635F':'#543B2C')+ellipse(57.5,44,3.25,4.2,off?'#68635F':'#543B2C')
    +ellipse(39,42.3,1.2,1.5,'#FFFDF7')+ellipse(58,42.3,1.2,1.5,'#FFFDF7')
    +ellipse(37.5,45.7,.55,.65,c.gold)+ellipse(56.5,45.7,.55,.65,c.gold)
    +`<path d="M35 37Q38 35 40 36M55 36Q58 35 61 37" fill="none" stroke="${c.dark}" stroke-width="1" stroke-linecap="round" opacity=".65"/>`
    +shape('M44 50Q48 48 52 50Q51 53.5 48 53.5Q45 53.5 44 50Z',off?'#77736C':'#74503B')+ellipse(47,50,1.7,.7,off?'#AAA49A':'#B98B6A')
    +`<path d="M48 54V56M43.5 56Q45.5 59 48 56Q50.5 59 52.5 56" fill="none" stroke="${c.dark}" stroke-width="1.1" stroke-linecap="round"/>`
  const body=shape('M34 65Q25 80 15 76Q19 88 37 81Z')+shape('M34 58Q48 53 61 59L66 76Q67 85 48 85Q29 85 30 76Z')+ellipse(48,74,11,9,c.cream)
    +ellipse(36,84,8,3.5,'url(#fur)')+ellipse(60,84,8,3.5,'url(#fur)')+seam('M32 84V85M35 84V85M60 84V85M63 84V85')
  const paws=ellipse(32,65,5,6,'url(#fur)')+ellipse(64,65,5,6,'url(#fur)')+seam('M29 63Q28 65 30 67M61 63Q60 65 62 67')
  const scarf=shape('M33 59Q48 66 63 59L62 65Q48 71 34 65Z',c.accent)+shape('M56 65L63 74L56 77L52 67Z',c.accent)
  const pack=shape('M24 58Q17 57 18 65V77Q18 81 28 80L32 60Z',c.accent)+seam('M21 64V75Q21 77 26 77')+shape('M19 68H28V74H19Z',c.accent)+ellipse(24,70,1,1,c.gold)
  const hat=shape('M29 32L34 22Q47 16 62 23L66 34Z',c.accent)+`<path d="M31 29Q48 25 64 31L66 34Q48 30 29 33Z" fill="${c.dark}" opacity=".65"/>`+shape('M24 33Q47 29 73 35Q71 42 47 39Q27 40 24 33Z',c.accent)+seam('M28 35Q48 33 68 36')+shape('M59 29Q56 20 62 18Q65 24 59 29Z',c.gold)
  const crown=shape('M36 28L34 16L43 21L49 12L55 21L64 16L61 29Z',c.gold)+shape('M37 26H61V30H37Z',c.gold)+ellipse(49,23,2.5,3,c.pink)+ellipse(48.5,22,0.7,1,c.cream)+ellipse(34,16,1.6,1.6,c.gold)+ellipse(49,12,1.6,1.6,c.gold)+ellipse(64,16,1.6,1.6,c.gold)+seam('M39 28H58')
  const cape=shape('M33 59Q24 69 24 83Q47 91 72 83L63 58Z',c.accent)
  if(i===0)return defs+ears+face+shape('M24 59Q48 69 72 59L69 78Q66 88 48 88Q29 88 26 78Z',c.accent)+shape('M31 65Q48 72 65 65Q63 83 48 83Q34 83 31 65Z',c.cream)+seam('M28 68L30 78Q33 85 47 85M68 68L66 77')+shape('M45 76Q42 72 40 75Q39 78 45 81Q51 78 50 75Q48 72 45 76Z',c.pink)+ellipse(33,62,5,3.5,'url(#fur)')+ellipse(63,62,5,3.5,'url(#fur)')
  let result=defs+(i===5?cape:'')+((i===2||i===3)?pack:'')+body+ears+face+(i===3?hat:'')+(i===1?scarf+seam('M37 64Q47 67 58 63M57 69L60 73'):'')+paws
  if(i===2)result+=shape('M41 66H55V79H41Z',c.accent)+seam('M43 68V77H53')+ellipse(49,71,2.3,2.3,c.gold)+`<path d="M46 75H52" stroke="${c.cream}" stroke-width=".8"/>`
  if(i===4)result+=`<g transform="translate(29 56) scale(.4)">${ears+face}</g>`+shape('M36 79Q48 85 60 79Q58 89 48 89Q38 89 36 79Z',c.accent)
  if(i===5)result+=crown+ellipse(48,68,3.5,4,'url(#gold)')+ellipse(48,68,1.4,1.8,c.pink)+seam('M28 73L27 82M67 73L69 82')
  return result+(i>=3?star(17,38):'')+(i>=4?star(80,51):'')+(i===5?star(77,22):'')
}
export const memberLevelIndex = level => Math.max(0, Math.min(5, Math.floor(Number(level)) || 0))
function base64(value) {
  let out = ''
  for (let i = 0; i < value.length; i += 3) {
    const a = value.charCodeAt(i), b = value.charCodeAt(i + 1), c = value.charCodeAt(i + 2)
    const n = (a << 16) | ((b || 0) << 8) | (c || 0)
    out += CH[(n >> 18) & 63] + CH[(n >> 12) & 63] + (isNaN(b) ? '=' : CH[(n >> 6) & 63]) + (isNaN(c) ? '=' : CH[n & 63])
  }
  return out
}
export function membershipEmblem(level, off = false) {
  const index = memberLevelIndex(level), key = `${index}:${off}`
  if (!cache.has(key)) {
    const [paper, , line] = off ? MUTED : PALETTES[index]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="49" r="46" fill="${line}" opacity=".3"/><circle cx="48" cy="47" r="45" fill="${paper}" stroke="${line}" stroke-width=".7"/><circle cx="48" cy="47" r="42" fill="none" stroke="#FFFCF6" stroke-width="1.8"/><path d="M12 36A38 38 0 0 1 42 10" fill="none" stroke="#FFFCF6" stroke-width="3" stroke-linecap="round" opacity=".8"/><ellipse cx="48" cy="85" rx="25" ry="4" fill="${line}" opacity=".25"/>${mascot(index,off)}</svg>`
    cache.set(key, `data:image/svg+xml;base64,${base64(svg)}`)
  }
  return cache.get(key)
}
