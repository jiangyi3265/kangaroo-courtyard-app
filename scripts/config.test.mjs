import test from 'node:test'
import assert from 'node:assert/strict'
import { build, createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const entry = fileURLToPath(new URL('../common/config.js', import.meta.url))

async function withNodeEnv(mode, action) {
  const keys = ['NODE_ENV', 'VITE_USER_NODE_ENV']
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  for (const key of keys) process.env[key] = mode
  try {
    return await action()
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

async function productionConfig(apiBase, source = entry) {
  const result = await withNodeEnv('production', () => build({
    root, configFile: false, envFile: false, logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase) },
    build: { write: false, minify: true, lib: { entry: source, formats: ['cjs'] } }
  }))
  const chunk = result[0].output.find(item => item.type === 'chunk')
  // Execute with only CommonJS exports, like the mini-program config module:
  // Node globals/require must not be needed to discover the deployed API URL.
  const exports = {}
  runInNewContext(chunk.code, { exports, URL })
  return exports
}

test('release build without an override connects to the deployed HTTPS API', async () => {
  assert.equal((await productionConfig('')).API_BASE, 'https://daishu.uuok.top')
})

test('release build keeps an explicit integration environment and trims trailing slashes', async () => {
  assert.equal((await productionConfig('https://staging.example.com///')).API_BASE,
    'https://staging.example.com')
})

test('copied job and itinerary links use the release API domain and preserve browser origins', async () => {
  const origin = 'https://daishu.uuok.top'
  const team = await productionConfig(origin, fileURLToPath(new URL('../pages/jobs/team-page.js', import.meta.url)))
  const trip = await productionConfig(origin, fileURLToPath(new URL('../pages/jobs/trip-share.js', import.meta.url)))
  assert.match(team.shareCopyText({ title: '岗位', jobId: 12 }), /https:\/\/daishu\.uuok\.top\/#\/pages\/jobs\/detail\?jobId=12$/)
  assert.match(trip.tripCopyText({ jobId: 12, arrival: '2026-11-09', days: 3, name: '小李' }), /https:\/\/daishu\.uuok\.top\/#\/pages\/jobs\/itinerary\?/)
  const currentPage = 'https://preview.example.com/#/pages/jobs/apply'
  assert.match(team.shareCopyText({ jobId: 12, href: currentPage }), /https:\/\/preview\.example\.com\/#\/pages\/jobs\/detail/)
  assert.match(trip.tripCopyText({ jobId: 12 }, currentPage), /https:\/\/preview\.example\.com\/#\/pages\/jobs\/itinerary/)
})

for (const [name, injected, expected] of [
  ['local development defaults to the deployed HTTPS API', '', 'https://daishu.uuok.top'],
  ['local development can explicitly select a local backend', 'http://localhost:8080///', 'http://localhost:8080']
]) {
  test(name, () => withNodeEnv('development', async () => {
    const server = await createServer({
      root, configFile: false, envFile: false,
      define: { 'import.meta.env.VITE_API_BASE': JSON.stringify(injected) },
      server: { middlewareMode: true, hmr: false }
    })
    try {
      assert.equal((await server.ssrLoadModule('/common/config.js')).API_BASE, expected)
    } finally {
      await server.close()
    }
  }))
}
