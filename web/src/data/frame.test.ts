import { describe, expect, it } from 'vitest'
import { allViews, frameLayout } from './frame'

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

describe('allViews', () => {
  it('keeps a single view as it is', () => {
    const view = { name: 'Main', picture: 'wide.png' }
    expect(allViews({ ...device, views: [view] })).toBe(view)
  })

  it('puts several views side by side at one height, so every button of the device is in it', () => {
    const frame = allViews({ ...device, views: [{ name: 'Grip', picture: 'wide.png' }, { name: 'Panel', picture: 'tall.png' }] })
    const { width, height, marks } = frameLayout(device, frame)
    expect([width, height]).toEqual([2560, 1000])
    expect(marks.map((m) => [m.input, Math.round(m.x), Math.round(m.y)])).toEqual([['JOY_BTN1', 20, 50], ['JOY_BTN2', 59, 50], ['JOY_BTN3', 90, 50]])
  })
})
