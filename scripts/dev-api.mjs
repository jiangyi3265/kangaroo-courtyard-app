const DEFAULT_API = 'https://daishu.oksja.cn'

// Browser development needs a same-origin endpoint: the deployed API does not
// allow localhost CORS. Mini-program requests and release URLs stay untouched.
export function devApiConfig(command, platform, env = {}) {
  if (command !== 'serve' || platform !== 'h5') return {}
  const target = String(env.VITE_API_BASE || DEFAULT_API).replace(/\/+$/, '')
  if (!/^https?:\/\//.test(target)) throw new Error('VITE_API_BASE 必须是完整的 HTTP(S) 后端地址')
  return {
    define: { 'import.meta.env.VITE_API_BASE': JSON.stringify('/dev-api') },
    server: {
      proxy: {
        '/dev-api': {
          target,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/dev-api(?=\/|$)/, '')
        }
      }
    }
  }
}
