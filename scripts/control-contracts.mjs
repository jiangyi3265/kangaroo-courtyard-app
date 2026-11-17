import assert from 'node:assert/strict'

// ExtCrud renders an optional selection column, then its explicit primary key.
// Text in other cells (including another object's ID) must never select a row.
export function exactExtensionRowIndex(meta, pk, headers, rows) {
  assert.ok(meta && typeof meta.allowDelete === 'boolean' && typeof meta.pk === 'string' && meta.pk.length > 0, 'complete ExtCrud metadata')
  assert.ok((typeof pk === 'number' && Number.isSafeInteger(pk) && pk > 0) || (typeof pk === 'string' && pk.trim() === pk && pk.length > 0), 'nonempty exact primary key')
  const column = meta.allowDelete ? 1 : 0
  assert.ok(Array.isArray(headers) && headers[column]?.trim() === '编号', 'metadata primary-key column matches rendered header')
  assert.ok(Array.isArray(rows) && rows.every(row => Array.isArray(row) && typeof row[column] === 'string'), 'rendered primary-key cells are present')
  const indexes = rows.flatMap((row,index) => row[column].trim() === String(pk) ? [index] : [])
  assert.equal(indexes.length, 1, 'exactly one rendered row with this primary key')
  return indexes[0]
}

export function assertReportContextResponse({base,url,method,httpStatus,payload,reportId,reference}) {
  const actual = new URL(url)
  assert.equal(actual.origin, new URL(base).origin, 'context came through the current admin origin')
  assert.equal(actual.pathname, '/dev-api/kangaroo/core/report/' + reportId + '/context', 'context response belongs to the exact clicked report')
  assert.equal(actual.search, '', 'report context request has no substitute identifier')
  assert.equal(method, 'GET'); assert.equal(httpStatus, 200); assert.equal(payload?.code, 200)
  assert.ok(reference?.reviewContext && typeof reference.reviewContext.text === 'string' && reference.reviewContext.text.length > 0, 'real same-ID reference has original content')
  assert.deepEqual(payload.data, reference, 'complete same-report context matches actual direct API')
}

// Reviewed expected manifest is checked in separately. Never derive expectations
// from /getRouters, the response being tested.
export function assertExtensionRoutes(routes, manifest) {
  assert.ok(Array.isArray(routes) && Array.isArray(manifest) && manifest.length > 0)
  const expected = manifest.map(x => x.component).sort()
  assert.equal(new Set(expected).size, expected.length, 'duplicate manifest component')
  assert.deepEqual(routes.map(x => x.component).sort(), expected, 'exact extension component set')
  assert.equal(new Set(routes.map(x => x.path)).size, routes.length, 'duplicate routed path')
  for (const route of routes) assert.match(route.path, /^\/(?!\/)[^?#]+$/, 'local route path')
}

export function assertExtensionSource(entry, source) {
  if (entry.kind === 'ext-crud') {
    assert.deepEqual([...source.matchAll(/\bentity="([^"]+)"/g)].map(x => x[1]), [entry.entity], 'component entity mapping')
  } else {
    assert.equal(entry.kind, 'application-list')
    assert.match(source, /import\s+ApplicationList\s+from\s+["']@\/views\/kangaroo\/application\/index\.vue["']/)
    assert.deepEqual([...source.matchAll(/\bfixed-job-type="([^"]+)"/g)].map(x => x[1]), [entry.jobType], 'fixed review category')
  }
}

export function assertApplicationList(entry, requestUrl, payload) {
  const url = new URL(requestUrl)
  assert.equal(url.pathname, '/dev-api/kangaroo/application/list')
  assert.equal(url.searchParams.get('jobType'), entry.jobType, 'request includes fixed category')
  assert.equal(payload.code, 200)
  assert.ok(Array.isArray(payload.rows))
  assert.ok(payload.rows.length > 0, 'isolated full-flow fixture must populate this review category')
  assert.ok(payload.rows.every(x => x.jobType === entry.jobType), 'no cross-category applications')
  assert.equal(new Set(payload.rows.map(x => x.appId)).size, payload.rows.length, 'unique application IDs')
}

export function assertFaqPayload(payload) {
  assert.equal(payload.code, 200)
  assert.ok(Array.isArray(payload.data) && payload.data.length > 0, 'migration FAQ fixture must be available')
  for (const row of payload.data) {
    assert.ok(Number(row.faqId) > 0)
    assert.ok(typeof row.question === 'string' && row.question.trim())
    assert.ok(typeof row.answer === 'string' && row.answer.trim())
  }
  assert.equal(new Set(payload.data.map(x => x.faqId)).size, payload.data.length)
  return payload.data
}

export function assertQuickPayload(payload) {
  assert.equal(payload.code, 200)
  assert.ok(Array.isArray(payload.data) && payload.data.length >= 3)
  assert.ok(payload.data.every(x => typeof x === 'string' && x.trim()))
  assert.ok(payload.data.slice(0, 3).includes('退款规则'), 'real profile quick questions include refund entry')
  return payload.data
}

const normalize = text => String(text).replace(/\s+/g, ' ').trim()
export function assertServiceAnswer({httpStatus, request, payload, title, content, question}) {
  assert.equal(httpStatus, 200)
  assert.deepEqual(request, {context: 'profile', question}, 'actual user question and context')
  assert.equal(payload.code, 200)
  const data = payload.data
  assert.ok(data && typeof data.text === 'string' && data.text.trim(), 'real full answer is required')
  assert.equal(normalize(title), normalize(question), 'modal question title')
  const expected = [data.text]
  for (const card of data.cards || []) expected.push('· ' + card.title + (card.status ? '（' + card.status + '）' : ''))
  if (data.source) expected.push('信息来源：' + data.source)
  assert.equal(normalize(content), normalize(expected.join('\n')), 'entire API answer rendered, not a prefix')
}
