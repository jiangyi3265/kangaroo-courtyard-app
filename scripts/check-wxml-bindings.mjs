import { readFileSync, readdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// A loop alias must not shadow a hoisted component-props key. For example,
// wx:for-item="m" + u-p="{{m}}" passes the row object, not the props-cache key.
export function findShadowedProps(wxml) {
  const stack = []
  const issues = []
  const tags = /<\/?[\w-]+\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/g
  for (const match of wxml.matchAll(tags)) {
    const tag = match[0]
    if (tag.startsWith('</')) { stack.pop(); continue }
    const attrs = Object.fromEntries([...tag.matchAll(/([:@\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map((attr) => [attr[1], attr[2] ?? attr[3]]))
    const inherited = stack.at(-1) || []
    const aliases = attrs['wx:for']
      ? [...inherited, attrs['wx:for-item'] || 'item', attrs['wx:for-index'] || 'index']
      : inherited
    const reference = attrs['u-p']?.match(/^\{\{\s*([\w$]+)\s*(?:\|\|\s*['"]{2})?\s*\}\}$/)?.[1]
    if (reference && aliases.includes(reference)) {
      issues.push({ alias: reference, line: wxml.slice(0, match.index).split('\n').length, tag })
    }
    if (!tag.endsWith('/>')) stack.push(aliases)
  }
  return issues
}

export function checkWxmlBindings(output) {
  const issues = []
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith('.wxml')) {
        for (const issue of findShadowedProps(readFileSync(path, 'utf8'))) {
          issues.push({ file: relative(output, path).replaceAll('\\', '/'), ...issue })
        }
      }
    }
  }
  walk(output)
  return issues
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = checkWxmlBindings(resolve(process.argv[2] || 'dist/build/mp-weixin'))
  console.log(JSON.stringify(issues, null, 2))
  process.exitCode = issues.length ? 1 : 0
}
