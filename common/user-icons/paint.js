// Shared paints and geometry from the approved 24-unit SVG masters.
export const none = 'none'
export const white = 'white'
export const ink = '#89735E'
export const softInk = '#B19579'
export const deepInk = '#826C58'
export const ivory = '#FFFAF3'
export const orange = '#DB9155'
export const paper = 'url(#paper)'
export const linen = 'url(#linen)'
export const apricot = 'url(#apricot)'
export const amber = 'url(#amber)'

function paint(fill, stroke = none, width = 1) {
  return ' fill="' + fill + '" stroke="' + stroke + '"' +
    (stroke === none ? '' : ' stroke-width="' + width + '"') + '/>'
}

export function path(d, ...colors) {
  return '<path d="' + d + '"' + paint(...colors)
}

export function circle(x, y, radius, ...colors) {
  return '<circle cx="' + x + '" cy="' + y + '" r="' + radius + '"' + paint(...colors)
}

export function rect(x, y, width, height, radius, ...colors) {
  return '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '" rx="' + radius + '"' + paint(...colors)
}

export function line(x1, y1, x2, y2, ...colors) {
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + paint(...colors)
}

export function polyline(points, ...colors) {
  return '<polyline points="' + points + '"' + paint(...colors)
}

export const group = (transform, body) => '<g transform="' + transform + '">' + body + '</g>'
export const clipPath = (id, body) => '<defs><clipPath id="' + id + '">' + body + '</clipPath></defs>'
export const clipped = (id, body) => '<g clip-path="url(#' + id + ')">' + body + '</g>'
