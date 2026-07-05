export interface Point {
  t: number
  v: number
}
export interface Scaled {
  x: number
  y: number
}

export function scalePoints(
  points: Point[],
  width: number,
  height: number,
  pad: number,
  yMin?: number,
  yMax?: number,
): Scaled[] {
  if (points.length === 0) return []
  const ts = points.map((p) => p.t)
  const vs = points.map((p) => p.v)
  const tMin = Math.min(...ts)
  const tMax = Math.max(...ts)
  const vLo = yMin ?? Math.min(...vs)
  const vHi = yMax ?? Math.max(...vs)
  const innerW = width - 2 * pad
  const innerH = height - 2 * pad
  const xFor = (t: number) =>
    tMax === tMin ? pad + innerW / 2 : pad + ((t - tMin) / (tMax - tMin)) * innerW
  const yFor = (v: number) =>
    vHi === vLo ? pad + innerH / 2 : pad + (1 - (v - vLo) / (vHi - vLo)) * innerH
  return points.map((p) => ({ x: xFor(p.t), y: yFor(p.v) }))
}

export function polyline(scaled: Scaled[]): string {
  return scaled.map((s) => `${s.x},${s.y}`).join(' ')
}
