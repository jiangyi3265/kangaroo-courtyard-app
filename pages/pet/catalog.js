// #ifdef MP-WEIXIN
// 微信编译器通过完整的文件路径识别分包内需要保留的场景和角色素材。
const wechatArt = {
  'bag': '/pages/pet/static/mp-weixin/bag.png',
  'bath': '/pages/pet/static/mp-weixin/bath.jpg',
  'book': '/pages/pet/static/mp-weixin/book.png',
  'cake': '/pages/pet/static/mp-weixin/cake.png',
  'camera': '/pages/pet/static/mp-weixin/camera.jpg',
  'card': '/pages/pet/static/mp-weixin/card.png',
  'clovers': '/pages/pet/static/mp-weixin/clovers.png',
  'egg': '/pages/pet/static/mp-weixin/egg.jpg',
  'envelope': '/pages/pet/static/mp-weixin/envelope.png',
  'feed': '/pages/pet/static/mp-weixin/feed.jpg',
  'grass': '/pages/pet/static/mp-weixin/grass.jpg',
  'hatch': '/pages/pet/static/mp-weixin/hatch.jpg',
  'hop': '/pages/pet/static/mp-weixin/hop.png',
  'idle': '/pages/pet/static/mp-weixin/idle.png',
  'letter': '/pages/pet/static/mp-weixin/letter.jpg',
  'level-0': '/pages/pet/static/mp-weixin/level-0.png',
  'level-1': '/pages/pet/static/mp-weixin/level-1.png',
  'level-2': '/pages/pet/static/mp-weixin/level-2.png',
  'level-3': '/pages/pet/static/mp-weixin/level-3.png',
  'level-4': '/pages/pet/static/mp-weixin/level-4.png',
  'level-5': '/pages/pet/static/mp-weixin/level-5.png',
  'mailbox': '/pages/pet/static/mp-weixin/mailbox.jpg',
  'pack': '/pages/pet/static/mp-weixin/pack.png',
  'pastry': '/pages/pet/static/mp-weixin/pastry.jpg',
  'photos': '/pages/pet/static/mp-weixin/photos.png',
  'postcard': '/pages/pet/static/mp-weixin/postcard.jpg',
  'reach': '/pages/pet/static/mp-weixin/reach.png',
  'return': '/pages/pet/static/mp-weixin/return.png',
  'shell': '/pages/pet/static/mp-weixin/shell.png',
  'room': '/pages/pet/static/mp-weixin/room.jpg',
  'tree': '/pages/pet/static/mp-weixin/tree.jpg',
  'visit': '/pages/pet/static/mp-weixin/visit.jpg',
}
// #endif
export function asset(name) {
  // #ifdef MP-WEIXIN
  return wechatArt[name]
  // #endif
  // #ifndef MP-WEIXIN
  return '/pages/pet/static/h5/' + name + '.webp'
  // #endif
}
export const supplies = [
  ['map','万能地图',20,'随机小院'],['satchel','兼职小书包',30,'必带换工线索'],
  ['camera','相机',25,'必带明信片'],['horn','社交喇叭',15,'更容易偶遇'],
  ['speed','加速卡',15,'立即回家'],['shield','羁绊保护卡',10,'离线时自动照顾']
]
export const wardrobe = [
  ['hat','草帽',25,'头部'],['scarf','绿围巾',25,'颈部'],['flower','鲜花',25,'手持'],
  ['stars','星夜',25,'小窝背景'],['sea','海边',25,'小窝背景']
]
export const privileges = [
  ['幼崽鼠',1,'本省出行'],['小袋鼠',2,'全国出行 · 优惠券概率 +10%'],
  ['袋鼠',2,'行程缩短 10% · 明信片概率 +20%'],['大袋鼠',3,'工作线索概率 +30%'],
  ['巨袋鼠',3,'每次至少一件稀有物品'],['袋鼠王',4,'发现概率加倍 · 每日多一次出行']
]
export const titleGroups = [
  ['陪伴','初来乍到 · 7天','庭院常客 · 30天','百日守候 · 100天','岁月旅人 · 365天'],
  ['出行','短途游侠 · 10次','轨迹猎人 · 50次','流浪大师 · 100次','时空旅者 · 500次'],
  ['探索','拾光者 · 5城','图鉴收藏家 · 15城','九州行者 · 30城']
]
export const category = { grass:'幸运草',coupon:'体验券',postcard:'明信片',photo:'合影',specialty:'特产',job:'换工线索',activity:'活动线索',stay:'住宿线索' }
export const pictures = { grass:'grass',postcard:'postcard',photo:'visit',specialty:'pastry',job:'bag',activity:'postcard',stay:'room' }
export const placeTabs = [['home','小窝'],['shop','行囊'],['album','足迹'],['mail','邮筒']]
