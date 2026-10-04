import { describe, expect, it } from 'vitest'
import { layoutCallouts, leader } from './callouts'

const box = { width: 1000, height: 400, column: 200, gap: 10 }

describe('callout layout', () => {
  it('puts each label on the side of its button and next to it when there is room', () => {
    const { placed } = layoutCallouts([{ id: 'a', x: 300, y: 100, height: 40 }, { id: 'b', x: 700, y: 300, height: 40 }], box)
    expect(placed.map((p) => [p.id, p.side, p.top])).toEqual([['a', 'left', 80], ['b', 'right', 280]])
    expect(placed.find((p) => p.id === 'b')!.anchorX).toBe(796)
  })

  it('never lets labels on one side overlap and keeps them inside the box', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: String(i), x: 100, y: 390 - i, height: 50 }))
    const { placed, height } = layoutCallouts(items, box)
    const sorted = [...placed].sort((a, b) => a.top - b.top)
    sorted.slice(1).forEach((p, i) => expect(p.top).toBeGreaterThanOrEqual(sorted[i].top + sorted[i].height + 10))
    expect(sorted[0].top).toBeGreaterThanOrEqual(0)
    expect(sorted.at(-1)!.top + 50).toBeLessThanOrEqual(height)
  })

  it('grows the box when the labels do not fit beside the picture', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: String(i), x: 900, y: 200, height: 50 }))
    expect(layoutCallouts(items, box).height).toBe(600)
  })

  it('stops a leader line short of the button so the number stays readable', () => {
    expect(leader({ x: 0, y: 0 }, { x: 30, y: 40 }, 10)).toEqual({ x1: 0, y1: 0, x2: 24, y2: 32 })
  })
})
