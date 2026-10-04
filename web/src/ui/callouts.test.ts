import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { frameLayout } from '../data/frame'
import type { Device } from '../data/types'
import { layoutCallouts, leader, type PlacedCallout } from './callouts'

const box = { width: 1000, height: 400, column: 200, gap: 10 }

const mh16 = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', '..', '..', 'devices/MOZA/AB9 + MH16/device.json'), 'utf-8')) as Device

function halfTheButtonsOfMh16() {
  const layout = frameLayout(mh16, mh16.views[0])
  const scale = Math.min(802 / layout.width, 950 / layout.height)
  const [width, height] = [layout.width * scale, layout.height * scale]
  const seen = new Set<string>()
  return layout.marks.filter((m) => !seen.has(m.input) && seen.add(m.input)).filter((_, i) => i % 2 === 0)
    .map((m) => ({ id: m.input, x: (1754 - width) / 2 + m.x / 100 * width, y: (950 - height) / 2 + m.y / 100 * height, height: 36 }))
}

const side = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))

const crossing = (placed: PlacedCallout[]) => placed.flatMap((p, i) => placed.slice(i + 1).filter((q) => {
  const [p1, q1] = [{ x: p.anchorX, y: p.anchorY }, { x: q.anchorX, y: q.anchorY }]
  return side(p1, p, q1) * side(p1, p, q) < 0 && side(q1, q, p1) * side(q1, q, p) < 0
}))

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

  it('grows the box when the labels fill both columns', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: String(i), x: 900, y: 200, height: 50 }))
    expect(layoutCallouts(items, box).height).toBe(600)
  })

  it('puts the lowest labels of an overfull half at the bottom of the other column', () => {
    const overfull = Array.from({ length: 10 }, (_, i) => ({ id: String(i), x: 100, y: 20 + i * 40, height: 50 }))
    const { placed, height } = layoutCallouts([...overfull, { id: 'own', x: 900, y: 380, height: 50 }], box)
    expect(height).toBe(400)
    expect(placed.filter((p) => p.side === 'right').sort((a, b) => a.top - b.top).map((p) => p.id)).toEqual(['own', '6', '7', '8', '9'])
  })

  it('keeps an overfull half to itself when asked to', () => {
    const overfull = Array.from({ length: 10 }, (_, i) => ({ id: String(i), x: 100, y: 20 + i * 40, height: 50 }))
    const { placed, height } = layoutCallouts(overfull, { ...box, spill: false })
    expect(placed.every((p) => p.side === 'left')).toBe(true)
    expect(height).toBe(600)
  })

  it('centres a crowded group of labels on its buttons instead of pushing it down', () => {
    const items = ['a', 'b', 'c'].map((id) => ({ id, x: 100, y: 200, height: 40 }))
    expect(layoutCallouts(items, box).placed.map((p) => p.top)).toEqual([130, 180, 230])
  })

  it('keeps each label on the half of the picture its button is on, even when the other column has room', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: String(i), x: 520, y: 200, height: 60 }))
    expect(layoutCallouts(items, box).placed.every((p) => p.side === 'right')).toBe(true)
  })

  it('labels the MH16 picture on both sides with no lines crossing', () => {
    const { placed, height } = layoutCallouts(halfTheButtonsOfMh16(), { width: 1754, height: 950, column: 360, inset: 56, gap: 10 })
    expect(height).toBe(950)
    expect(crossing(placed)).toEqual([])
    expect(placed.every((p) => (p.side === 'left') === (p.x < 1754 / 2))).toBe(true)
  })

  it('stops a leader line short of the button so the number stays readable', () => {
    expect(leader({ x: 0, y: 0 }, { x: 30, y: 40 }, 10)).toEqual({ x1: 0, y1: 0, x2: 24, y2: 32 })
  })
})
