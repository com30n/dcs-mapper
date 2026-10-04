import { describe, expect, it } from 'vitest'
import { frameLayout } from './frame'

const device = {
  pictures: {
    'wide.png': { size: [2000, 1000] as [number, number], marks: [{ input: 'JOY_BTN1', x: 25, y: 50 }, { input: 'JOY_BTN2', x: 75, y: 50 }] },
    'tall.png': { size: [500, 1000] as [number, number], marks: [{ input: 'JOY_BTN3', x: 50, y: 50 }] },
  },
}

describe('frameLayout', () => {
  it('crops a single picture and keeps only marks inside the window', () => {
    const { width, height, marks } = frameLayout(device, { picture: 'wide.png', x: 0, y: 0, w: 50, h: 100 })
    expect([width, height]).toEqual([1000, 1000])
    expect(marks).toEqual([{ input: 'JOY_BTN1', x: 50, y: 50 }])
  })

  it('places layers so their height follows the picture ratio', () => {
    const { placed, marks } = frameLayout(device, { size: [1000, 1000], layers: [{ picture: 'tall.png', at: [0, 0, 50] }] })
    expect(placed[0].ah).toBe(100)
    expect(marks).toEqual([{ input: 'JOY_BTN3', x: 25, y: 50 }])
  })
})
