import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { reportMpPackage } from './scripts/mp-package.mjs'
import { devApiConfig } from './scripts/dev-api.mjs'

export default defineConfig(({ command, mode }) => ({
  ...devApiConfig(command, process.env.UNI_PLATFORM, loadEnv(mode, process.cwd(), 'VITE_')),
  // HBuilderX ships a different development runtime from the CLI. Minify both
  // so a preview build does not exceed the main-package limit either.
  build: process.env.UNI_PLATFORM === 'mp-weixin'
    ? { minify: 'terser', sourcemap: false }
    : {},
  plugins: [
    uni(),
    {
      name: 'kangaroo:mp-package-check',
      apply: 'build',
      closeBundle() {
        if (process.env.UNI_PLATFORM === 'mp-weixin') {
          reportMpPackage(process.env.UNI_OUTPUT_DIR)
        }
      }
    }
  ]
}))
