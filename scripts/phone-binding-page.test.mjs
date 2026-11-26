import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const require = createRequire(import.meta.url)
const { ref, computed } = require('vue')
const compiler = require('@vue/compiler-sfc')
const page = readFileSync(new URL('../pages/auth/login.vue', import.meta.url), 'utf8')
const conditional = []
const setup = compiler.parse(page).descriptor.scriptSetup.content.split('\n').filter(line => {
  const directive = /^\s*\/\/\s*#(ifdef|ifndef|endif)\b\s*([\w-]*)/.exec(line)
  if (!directive) return conditional.every(Boolean)
  if (directive[1] === 'endif') conditional.pop()
  else conditional.push(directive[1] === 'ifdef' ? directive[2] === 'MP-WEIXIN' : directive[2] !== 'MP-WEIXIN')
  return false
}).join('\n')
const statements = compiler.babelParse(setup, { sourceType: 'module' }).program.body
const script = statements.filter(node => node.type !== 'ImportDeclaration')
  .map(node => setup.slice(node.start, node.end)).join('\n')

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
const { createPhoneBinding } = await server.ssrLoadModule('/pages/auth/phone-binding.js')
const { gated } = await server.ssrLoadModule('/common/community.js')
await server.close()

const codeEvent = { detail: { code: 'one-use-fixture', errMsg: 'getPhoneNumber:ok' } }
const consentConflict = () => Object.assign(new Error('协议已更新，请重新阅读并同意后继续'), { code: 409 })

function makePage({ source = 'pages/profile/index', query = { s: '4', mode: 'bind-phone' }, consentError, verifyError } = {}) {
  const calls = []
  const nav = []
  const experience = { account: { id: 'sample' } }
  const versions = { termsVersion: 'aaaaaaaaaaaaaaaa', privacyVersion: 'bbbbbbbbbbbbbbbb' }
  const pages = [source, 'pages/auth/login'].map(route => ({ route }))
  let onLoad
  const goBack = () => nav.push('back')
  const context = vm.createContext({
    ref, computed, experience, codeEvent, onMounted() {}, onUnload() {},
    getCurrentPages: () => pages, back: goBack,
    partyLoginReturn: () => '', loginActivityReturn: () => '',
    R: { profile: '/pages/profile/index', legal: '/pages/auth/legal', home: '/pages/home/index' },
    hasStaffAccess: ref(false), ensureSession: async () => {}, toast() {},
    logout() { calls.push('logout'); experience.account = null },
    relaunch(url) { nav.push(url) },
    useScreen(max, hooks) { onLoad = hooks.onLoad; return ref(Number(query.s)) },
    uni: {
      navigateTo(options) {
        const key = new URL(options.url, 'https://example.test').searchParams.get('key')
        options.events.read({ key, version: versions[key + 'Version'] })
      },
      navigateBack: goBack,
      redirectTo({ url }) { nav.push(url) }
    },
    apiLegal() {},
    loadLegalVersions() { calls.push('load'); return { ...versions } },
    async post(path, submitted) {
      assert.equal(path, '/app/me/consent/legal')
      assert.equal(submitted.termsVersion, versions.termsVersion)
      calls.push('consent')
      if (consentError) throw consentError
    },
    bindWechatPhone: createPhoneBinding({
      restore: async () => {}, login: () => assert.fail('Existing account must be reused'),
      account: () => experience.account,
      async verify(code) {
        assert.equal(code, codeEvent.detail.code)
        calls.push('verify')
        if (verifyError) throw verifyError
        return { data: { ...experience.account, phoneBound: true, phone: '***' } }
      },
      accept(account) { experience.account = account }
    })
  })
  const run = code => vm.runInContext(code, context)
  run(script)
  onLoad(query)
  return {
    calls, nav, experience, run,
    async readAndAgree() {
      await run('loadLegal()')
      run("openLegal('terms'); openLegal('privacy'); toggleAgreement(true)")
      assert.equal(run('agreed2.value'), true)
      calls.length = 0
    }
  }
}

test('settings binding sends consent once, before exchanging the one-use WeChat code', async () => {
  const page = makePage()
  await page.readAndAgree()
  await page.run('onPhoneAuth(codeEvent)')
  assert.deepEqual(page.calls, ['consent', 'verify'])
  assert.equal(page.experience.account.phoneBound, true)
  assert.equal(page.nav.length, 1)
})

test('missing native authorization does not submit consent, exchange a code, or leave the page', async () => {
  const page = makePage()
  await page.readAndAgree()
  await page.run("onPhoneAuth({ detail: { errMsg: 'getPhoneNumber:fail' } })")
  assert.deepEqual(page.calls, [])
  assert.deepEqual(page.nav, [])
  assert.equal(page.run('submitting.value'), false)
  assert.ok(page.run('loginError.value'))
})

test('an updated agreement is reloaded once and requires a new explicit confirmation', async () => {
  const page = makePage({ consentError: consentConflict() })
  await page.readAndAgree()
  await page.run('onPhoneAuth(codeEvent)')
  assert.deepEqual(page.calls, ['consent', 'load'])
  assert.equal(page.run('legalRead.value || agreed2.value || submitting.value'), false)
  assert.equal(page.experience.account.phoneBound, undefined)
  assert.deepEqual(page.nav, [])
})

test('a phone exchange conflict does not request consent or the same phone code twice', async () => {
  const page = makePage({ verifyError: Object.assign(new Error('手机号已被其他账号绑定'), { code: 409 }) })
  await page.readAndAgree()
  await page.run('onPhoneAuth(codeEvent)')
  assert.deepEqual(page.calls, ['consent', 'verify'])
  assert.deepEqual(page.nav, [])
  assert.equal(page.run('submitting.value'), false)
})

test('skipping the older community binding link returns to the caller with the account intact', () => {
  const page = makePage({ source: 'pages/community/index', query: { s: '4' } })
  page.run('skip()')
  assert.equal(page.experience.account?.id, 'sample')
  assert.deepEqual(page.nav, ['back'])
})

test('community binding completes on the originating page without reopening settings or home', async t => {
  let link
  const originalUni = globalThis.uni
  t.after(() => {
    if (originalUni === undefined) delete globalThis.uni
    else globalThis.uni = originalUni
  })
  globalThis.uni = {
    showModal({ success }) { success({ confirm: true }) },
    navigateTo({ url }) { link = new URL(url, 'https://example.test') }
  }
  await assert.rejects(gated(async () => { throw Object.assign(new Error('请先验证手机号'), { code: 428 }) }),
    err => err.silent === true)
  assert.equal(link.pathname, '/pages/auth/login')
  const query = Object.fromEntries(link.searchParams)
  const page = makePage({ source: 'pages/community/index', query })
  await page.readAndAgree()
  await page.run('onPhoneAuth(codeEvent)')
  assert.deepEqual(page.calls, ['consent', 'verify'])
  assert.deepEqual(page.nav, ['back'])
  assert.equal(page.experience.account.phoneBound, true)
})

test('skipping a merchant application returns to the existing application page', () => {
  const page = makePage({ source: 'pages/profile/merchant', query: { s: '4', mode: 'bind-phone', returnTo: 'merchant' } })
  page.run('skip()')
  assert.equal(page.experience.account?.id, 'sample')
  assert.deepEqual(page.nav, ['back'])
})
