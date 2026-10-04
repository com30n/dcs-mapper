import type { AxisFilter } from './types'

export const DEFAULT_FILTER: AxisFilter = {
  deadzone: 0, saturationX: 1, saturationY: 1, hardwareDetentMax: 0, hardwareDetentAB: 0, hardwareDetent: false, slider: false, invert: false, curvature: [0],
}
export const USER_CURVE_POINTS = 11

export const filterWithDefaults = (filter?: Partial<AxisFilter> | null): AxisFilter => ({
  ...DEFAULT_FILTER,
  ...(filter ?? {}),
  curvature: [...(filter?.curvature ?? [0])],
})

export const isDefaultFilter = (filter?: Partial<AxisFilter> | null) => JSON.stringify(filterWithDefaults(filter)) === JSON.stringify(DEFAULT_FILTER)

function splineSecondDerivatives(y: number[]) {
  const n = y.length
  const h = 1 / (n - 1)
  const y2 = new Array<number>(n).fill(0)
  const u = new Array<number>(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const p = 0.5 * y2[i - 1] + 2
    y2[i] = -0.5 / p
    u[i] = ((6 * ((y[i + 1] - y[i]) / h - (y[i] - y[i - 1]) / h)) / (2 * h) - 0.5 * u[i - 1]) / p
  }
  for (let k = n - 2; k >= 0; k--) y2[k] = y2[k] * y2[k + 1] + u[k]
  return y2
}

function splineAt(y: number[], y2: number[], x: number) {
  const n = y.length - 1
  const h = 1 / n
  let lo = 0
  let hi = n
  while (hi - lo > 1) {
    const k = (hi + lo) >> 1
    if (k * h > x) hi = k
    else lo = k
  }
  const a = (hi * h - x) / h
  const b = (x - lo * h) / h
  return a * y[lo] + b * y[hi] + (((a * a * a - a) * y2[lo] + (b * b * b - b) * y2[hi]) * h * h) / 6
}

export function axisResponse(filter: Partial<AxisFilter> | null | undefined, x: number) {
  const f = filterWithDefaults(filter)
  const { deadzone: dz, saturationX: sx, saturationY: sy, curvature: points } = f
  const y2 = points.length >= 4 ? splineSecondDerivatives(points) : null
  const shape = (t: number) => {
    if (dz >= t) return 0
    if (t >= sx) return sy
    if (!y2) {
      const c = points[0] || 0
      const k = 10 * c
      const u = (t - dz) / (sx - dz)
      return sy * (c === 0 ? u : (Math.exp(k * u) - 1) / (Math.exp(k) - 1))
    }
    const at = Math.trunc(t * 1000) / 1000
    const v = dz >= at ? 0 : at >= sx ? sy : splineAt(points, y2, (at - dz) / (sx - dz))
    return Math.min(sy, Math.max(0, v * sy))
  }
  const v = Math.max(-1, Math.min(1, x))
  if (f.slider) return (2 * shape((v + 1) / 2) - 1) * (f.invert ? -1 : 1)
  return (v < 0 ? -1 : 1) * (f.invert ? -1 : 1) * shape(Math.abs(v))
}
