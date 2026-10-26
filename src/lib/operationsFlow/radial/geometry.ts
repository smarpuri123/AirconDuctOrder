/** Polar helpers for arc-band workflow segments (degrees: 0 = east, 90 = south). */

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = degToRad(deg)
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

/** Single open circular arc from startDeg to endDeg (clockwise when endDeg > startDeg). */
export function openArcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const [x1, y1] = polar(cx, cy, r, startDeg)
  const [x2, y2] = polar(cx, cy, r, endDeg)
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  const sweep = endDeg > startDeg ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`
}

/** Annular sector from startDeg to endDeg (clockwise in SVG y-down space). */
export function annularSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const [x1, y1] = polar(cx, cy, outerR, startDeg)
  const [x2, y2] = polar(cx, cy, outerR, endDeg)
  const [x3, y3] = polar(cx, cy, innerR, endDeg)
  const [x4, y4] = polar(cx, cy, innerR, startDeg)
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0
  const sweep = endDeg > startDeg ? 1 : 0
  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${large} ${sweep} ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${large} ${1 - sweep} ${x4} ${y4}`,
    'Z',
  ].join(' ')
}

/** Split an annular sector into inner and outer half-rings (for flat / plasma). */
export function splitAnnularSectorPaths(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): { inner: string; outer: string } {
  const midR = (innerR + outerR) / 2
  return {
    inner: annularSectorPath(cx, cy, innerR, midR, startDeg, endDeg),
    outer: annularSectorPath(cx, cy, midR, outerR, startDeg, endDeg),
  }
}

export function horizontalCellRect(
  x: number,
  y: number,
  w: number,
  h: number,
  pad: number,
): { x: number; y: number; w: number; h: number } {
  return { x: x + pad, y: y + pad, w: w - pad * 2, h: h - pad * 2 }
}
