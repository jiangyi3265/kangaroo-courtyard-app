import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const cli = resolve(dirname(require.resolve('@dcloudio/vite-plugin-uni/package.json')), 'bin/uni.js')
// Uni's Windows static-file watcher requires an absolute input directory.
// UNI_INPUT_DIR=. compiles pages, but can silently omit the whole static folder.
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, UNI_INPUT_DIR: projectRoot }
})
child.on('error', (error) => { console.error(error); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
