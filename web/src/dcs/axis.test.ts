import { describe, expect, it } from 'vitest'
import { axisResponse, isDefaultFilter } from './axis'

const points = (values: number[]) => values.map((v) => v / 100)

describe('axis response, as bin/Input.dll computes it', () => {
  it('is the identity without a filter', () => {
    expect(axisResponse(null, 0.37)).toBe(0.37)
    expect(axisResponse(null, -0.5)).toBe(-0.5)
  })

  it('bends exponentially with k = 10 x curvature', () => {
    expect(axisResponse({ curvature: [0.2] }, 0.5)).toBeCloseTo((Math.E - 1) / (Math.exp(2) - 1), 12)
    expect(axisResponse({ curvature: [0.2] }, -0.5)).toBeCloseTo(-axisResponse({ curvature: [0.2] }, 0.5), 12)
  })

  it('applies deadzone and both saturations before the curve', () => {
    const filter = { deadzone: 0.1, saturationX: 0.9, saturationY: 0.8 }
    expect(axisResponse(filter, 0.05)).toBe(0)
    expect(axisResponse(filter, 0.95)).toBe(0.8)
    expect(axisResponse(filter, 0.5)).toBeCloseTo(0.4, 12)
  })

  it('passes a user curve through every point', () => {
    const curve = points([0, 2, 5, 10, 18, 28, 40, 55, 70, 85, 100])
    for (let i = 0; i <= 10; i++) expect(axisResponse({ curvature: curve }, i / 10)).toBeCloseTo(curve[i], 9)
  })

  it('samples a user curve every 1/1000 of travel', () => {
    const curve = points([0, 2, 5, 10, 18, 28, 40, 55, 70, 85, 100])
    expect(axisResponse({ curvature: curve }, 0.5004)).toBe(axisResponse({ curvature: curve }, 0.5))
  })

  it('maps the whole travel of a slider and inverts', () => {
    expect(axisResponse({ slider: true }, -1)).toBe(-1)
    expect(axisResponse({ slider: true }, 1)).toBe(1)
    expect(axisResponse({ invert: true }, 0.3)).toBe(-0.3)
  })

  it('knows the default filter', () => {
    expect(isDefaultFilter(undefined)).toBe(true)
    expect(isDefaultFilter({ deadzone: 0, curvature: [0] })).toBe(true)
    expect(isDefaultFilter({ curvature: [0.15] })).toBe(false)
  })
})
