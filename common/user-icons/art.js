import { drawings } from './drawings.js'
import { ink, softInk, deepInk, ivory, orange } from './paint.js'

const aliases = {
  'amenity-washer': 'amenity-laundry', 'amenity-hotwater': 'amenity-heater',
  bath: 'amenity-bath', 'cooking-pot': 'amenity-cook', 'waves-ladder': 'amenity-pool', wifi: 'amenity-wifi',
  'user-round': 'user', 'user-round-plus': 'user-plus', 'user-round-x': 'user-x', 'users-round': 'users',
  'lock-keyhole': 'lock', 'alert-circle': 'circle-alert'
}
const outlines = { heart: 'heart-outline', bookmark: 'bookmark-outline', star: 'star-outline' }
const paints = {
  paper: ['#FFFAF3', '#FDF4E8'], linen: ['#FFF1DD', '#FBE3C7'],
  apricot: ['#FBE2C4', '#F6CEA5'], amber: ['#DD8D4D', '#EFA968']
}
const reverseInk = { [ink]: '#FFFFFF', [softInk]: '#F3DDC3', [deepInk]: '#FFFFFF', [ivory]: '#FFF7E9', [orange]: '#FFD099' }
const semanticTones = new Set(['green', 'alert', 'indigo'])
const commonPictures = new Set([
  'entry-exchange', 'entry-parttime', 'entry-staffed', 'entry-online', 'entry-stay',
  'nav-home', 'nav-community', 'nav-publish', 'nav-messages', 'nav-profile', 'mine-ai', 'wish-mine'
])
const profilePictures = new Set([
  'mine-trip', 'mine-review', 'mine-income', 'mine-resume', 'mine-create',
  'mine-save', 'mine-guide', 'mine-invite', 'mine-merchant', 'mine-settings'
])

export function userIconPicture(name) {
  if (commonPictures.has(name)) return '/static/user-icons/' + name + '.png'
  if (profilePictures.has(name)) return '/pages/profile/static/user-icons/' + name + '.png'
  return ''
}

function gradient(id, inverse) {
  const [start, end] = paints[id]
  const stop = (color, opacity, offset) => '<stop offset="' + offset + '" stop-color="' + color + '"' +
    (inverse ? ' stop-opacity="' + opacity + '"' : '') + '/>'
  const light = id === 'amber' || id === 'apricot'
  return '<linearGradient id="' + id + '" x1="0" y1="0" x2=".88" y2="1" gradientUnits="objectBoundingBox">' +
    stop(inverse ? (light ? '#FFCA91' : '#FFF7EC') : start, light ? .76 : .12, 0) +
    stop(inverse ? (light ? '#FFE6C9' : '#FFF4E2') : end, light ? .9 : .25, 1) + '</linearGradient>'
}

export function userIconSvg(name, { fill, color, tone, stroke, size }) {
  const key = (!fill && outlines[name]) || aliases[name] || name
  const draw = Object.prototype.hasOwnProperty.call(drawings, key) && drawings[key]
  if (!draw) return ''
  let body = draw()
  const inverse = tone === 'white' || tone === 'paper' || /^#(?:fff|ffffff|fffaf[0-9a-f])$/i.test(color)
  if (inverse) {
    body = body.replace(/#[0-9A-F]{6}/g, paint => reverseInk[paint] || paint)
  } else if (semanticTones.has(tone) || /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(tone)) {
    // Keep the pale fill while preserving status colours on checks, warnings and custom buttons.
    body = body.replace(/#[0-9A-F]{6}/g, paint => paint === ink || paint === orange ? color : paint)
  }
  const customStroke = stroke !== '' && stroke != null && Number.isFinite(Number(stroke))
  if (customStroke || size <= 16) {
    const scale = customStroke ? Math.max(0, Number(stroke)) / 1.7 : 1
    body = body.replace(/stroke-width="([\d.]+)"/g, (_, width) => {
      const readable = size <= 16 ? Math.max(1.2, Number(width)) : Number(width)
      return 'stroke-width="' + (readable * scale).toFixed(2) + '"'
    })
  }
  const gradients = Object.keys(paints).filter(id => body.includes('url(#' + id + ')')).map(id => gradient(id, inverse)).join('')
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
    (gradients ? '<defs>' + gradients + '</defs>' : '') +
    '<g stroke-linecap="round" stroke-linejoin="round">' + body + '</g></svg>'
}
