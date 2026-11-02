const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const R = L.map((code) => [...code].map((bit) => (bit === '0' ? '1' : '0')).join(''))
const G = R.map((code) => [...code].reverse().join(''))
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

/** The 95 modules of an EAN-13 as 1s and 0s. */
export function ean13Bars(code: string): string {
  if (!/^\d{13}$/.test(code)) throw new Error('An EAN-13 is thirteen digits')
  const digits = [...code].map(Number)
  const parity = PARITY[digits[0]]
  let bars = '101'
  for (let i = 0; i < 6; i++) bars += (parity[i] === 'L' ? L : G)[digits[i + 1]]
  bars += '01010'
  for (let i = 7; i < 13; i++) bars += R[digits[i]]
  return bars + '101'
}

/** A self-contained SVG of the barcode, with its number under the bars. */
export function ean13Svg(code: string): string {
  const width = 2
  const rects = [...ean13Bars(code)]
    .map((bit, i) => (bit === '1' ? `<rect x="${i * width + 20}" y="0" width="${width}" height="80"/>` : ''))
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="230" height="104">${rects}<text x="115" y="98" text-anchor="middle" font-family="monospace" font-size="14">${code}</text></svg>`
}
