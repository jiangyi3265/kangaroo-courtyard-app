// Code-drawn decorative artwork; never substitutes for a real property photo.
const svg = (body) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' + body + '</svg>')
const arrow = (color) => svg('<path d="M14 3 22 10 14 17v-4c-5.5-.2-8.8 2.6-12 7 1.1-7.6 5-12.1 12-12V3Z" fill="none" stroke="' + color + '" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>')
const paper = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><defs><filter id="p"><feTurbulence type="fractalNoise" baseFrequency=".76" numOctaves="3" seed="19" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 .52 0 0 0 0 .35 0 0 0 0 .26 0 0 0 .13 0"/></filter></defs><rect width="128" height="128" filter="url(#p)"/></svg>')
// Escape parentheses as well: this value is interpolated into an unquoted CSS url().
export const STAY_ART = { share: arrow('#A57850'), shareLight: arrow('#FFFDF9'), paper: paper.replace(/\(/g, '%28').replace(/\)/g, '%29') }
