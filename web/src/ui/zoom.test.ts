import { describe, expect, it } from 'vitest'
import { panBy, zoomAt, ZOOM_MAX, type Zoom } from './zoom'

const box = { width: 400, height: 200 }
const none: Zoom = { scale: 1, x: 0, y: 0 }

describe('zooming the device picture', () => {
  it('keeps the point under the pointer in place', () => {
    const z = zoomAt(none, box, 100, 50, 2)
    expect(z).toEqual({ scale: 2, x: -100, y: -50 })
    expect([(100 - z.x) / z.scale, (50 - z.y) / z.scale]).toEqual([100, 50])
  })

  it('stays between the whole picture and the closest zoom', () => {
    expect(zoomAt(none, box, 0, 0, 0.5)).toEqual(none)
    expect(zoomAt(none, box, 0, 0, 100).scale).toBe(ZOOM_MAX)
  })

  it('never shows the empty space past the picture edges', () => {
    const z = zoomAt(none, box, 400, 200, 2)
    expect(z).toEqual({ scale: 2, x: -400, y: -200 })
    expect(panBy(z, box, -50, 30)).toEqual({ scale: 2, x: -400, y: -170 })
    expect(panBy(z, box, 1000, 1000)).toEqual({ scale: 2, x: 0, y: 0 })
  })
})
