export const commentStickers = [
  ['wave', '你好'], ['joy', '开心'], ['like', '点赞'],
  ['thanks', '谢谢'], ['think', '疑问'], ['hug', '抱抱'],
  ['facepalm', '捂脸笑']
].map(([key, label]) => ({
  key, label, token: '[袋鼠·' + label + ']', image: '/pages/community/static/stickers/' + key + '.png'
}))

const byToken = new Map(commentStickers.map(sticker => [sticker.token, sticker]))

// 评论保存可读标记，只有已登记的标记会显示为贴纸。
export function commentParts(text) {
  return text.split(/(\[袋鼠·[^\[\]\s]{1,8}\])/u).filter(Boolean).map(part => ({
    text: part, sticker: byToken.get(part)
  }))
}
