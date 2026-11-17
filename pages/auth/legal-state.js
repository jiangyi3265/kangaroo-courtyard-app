export async function loadLegalVersions(fetchDocument) {
  const docs = await Promise.all(['terms', 'privacy'].map(key => fetchDocument(key)))
  const result = {}
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]?.data
    if (doc?.configured !== true || typeof doc.html !== 'string' || !doc.html.trim() || !/^[a-f0-9]{16}$/.test(doc.version || '')) {
      throw new Error('协议内容暂不可用，请稍后重试；你仍可先浏览')
    }
    result[i ? 'privacyVersion' : 'termsVersion'] = doc.version
  }
  return result
}
