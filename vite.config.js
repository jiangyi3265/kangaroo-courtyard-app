import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { reportMpPackage } from './scripts/mp-package.mjs'

export default defineConfig({
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
})
