import { describe, expect, it } from 'vitest'
import { sheetFrame, sheetHeight } from './layoutSheet'

describe('size of the printable sheet', () => {
  it('stays A4 landscape for an ordinary picture with few labels', () => {
    const frame = sheetFrame(1)
    expect(frame.width).toBe(1754)
    expect(sheetHeight(400)).toBe(1240)
  })

  it('grows taller so every label fits instead of being cut off', () => {
    expect(sheetHeight(2000)).toBe(1240 + 2000 - 950)
  })

  it('grows wider for a wide picture so it is not shrunk to a strip', () => {
    const frame = sheetFrame(3.5)
    expect(frame.width).toBeGreaterThan(1754)
    expect(frame.ph).toBeGreaterThanOrEqual(950 * 0.7 - 1)
    expect(frame.px).toBeGreaterThan(56 + 360)
    expect(frame.px + frame.pw).toBeLessThan(frame.width - 56 - 360)
  })

  it('does not grow without end for a very wide picture', () => {
    expect(sheetFrame(40).width).toBeLessThanOrEqual(3400)
  })
})
