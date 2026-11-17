import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import { devApiConfig } from './dev-api.mjs'

test('only H5 development uses the proxy; releases and WeChat retain their API URLs', () => {
  assert.deepEqual(devApiConfig('build', 'h5'), {})
  assert.deepEqual(devApiConfig('serve', 'mp-weixin'), {})
  assert.deepEqual(devApiConfig('build', 'mp-weixin'), {})
  const config = devApiConfig('serve', 'h5')
  assert.equal(config.server.proxy['/dev-api'].target, 'https://daishu.oksja.cn')
  assert.equal(JSON.parse(config.define['import.meta.env.VITE_API_BASE']), '/dev-api')
})

test('same-origin forwarding preserves login headers, query parameters, upload bytes and backend errors', async () => {
  const requests = []
  const backend = createHttpServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    requests.push({ url: req.url, method: req.method, token: req.headers['x-app-token'], body: Buffer.concat(chunks) })
    res.writeHead(req.url.includes('/missing') ? 404 : 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ code: 200, data: { favorite: false } }))
  })
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve))
  let vite
  try {
    const target = `http://127.0.0.1:${backend.address().port}`
    const config = devApiConfig('serve', 'h5', { VITE_API_BASE: target + '///' })
    vite = await createViteServer({ configFile: false, envFile: false, logLevel: 'silent', ...config,
      server: { ...config.server, host: '127.0.0.1', port: 0, hmr: false } })
    await vite.listen()
    const base = `http://127.0.0.1:${vite.httpServer.address().port}/dev-api`
    assert.equal((await fetch(base + '/app/job/favorite/7?favorite=false', {
      method: 'POST', headers: { 'X-App-Token': 'test-only' }
    })).status, 200)
    const bytes = new Uint8Array([0, 1, 128, 255, 10])
    await fetch(base + '/app/upload/image', { method: 'POST', body: bytes })
    assert.equal((await fetch(base + '/app/missing')).status, 404)
    assert.deepEqual(requests[0], { url: '/app/job/favorite/7?favorite=false', method: 'POST', token: 'test-only', body: Buffer.alloc(0) })
    assert.deepEqual(requests[1].body, Buffer.from(bytes))
    assert.equal(requests[1].url, '/app/upload/image')
  } finally {
    if (vite) await vite.close()
    await new Promise(resolve => backend.close(resolve))
  }
})
