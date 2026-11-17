// Display only. Never use this value in an editor, request, URL, identifier or agreement.
// Quotes/code/links and explicit names remain verbatim; the original record is retained.
const protectedText = /```[\s\S]*?```|`[^`\n]*`|^\s*>[^\n]*|(?:https?:\/\/|www\.)[^\s<>"“”「」『』]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|<[^>]*>/gim
const quotedText = /“[^”]*”|「[^」]*」|『[^』]*』|‘[^’]*’|"[^"\n]*"/gm

export function displayWording(value, preserve = [], options = {}) {
  if (typeof value !== 'string' || !value.includes('义工')) return value == null ? '' : value
  // Structured chat payloads (shared posts/files) must be parsed before displaying text.
  if (/^\s*[\[{]/.test(value)) {
    try { JSON.parse(value); return value } catch (_) { /* ordinary text */ }
  }
  const names = (Array.isArray(preserve) ? preserve : [preserve]).filter(n => typeof n === 'string' && n.includes('义工'))
  const spans = []
  for (const pattern of options.preserveQuotes === false ? [protectedText] : [protectedText, quotedText]) {
    pattern.lastIndex = 0
    let hit
    while ((hit = pattern.exec(value))) spans.push([hit.index, hit.index + hit[0].length])
  }
  for (const name of names) {
    let start = 0
    while ((start = value.indexOf(name, start)) !== -1) { spans.push([start, start + name.length]); start += name.length }
  }
  return value.replace(/义工/g, (word, at) => spans.some(([start, end]) => at < end && at + word.length > start) ? word : '换工')
}

export const wordingChanged = (value, preserve = []) => displayWording(value, preserve) !== (value == null ? '' : value)

export function messageWording(message = {}) {
  const names = [message.peerName, message.actorName, message.nickname]
  // Conversation titles can be personal/group names. Social titles contain actor names.
  const identityTitle = ['chat', 'group', 'comment', 'like'].includes(message.category)
  // Platform templates quote job titles with 「…」; these are labels, not quoted UGC.
  const options = { preserveQuotes: identityTitle }
  return {
    title: identityTitle ? message.title || '' : displayWording(message.title, names, options),
    content: displayWording(message.content, names, options),
    sourceLabel: displayWording(message.sourceLabel, names),
    postTitle: displayWording(message.postTitle, names)
  }
}
