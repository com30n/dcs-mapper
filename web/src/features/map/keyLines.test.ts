import { describe, expect, it } from 'vitest'
import { calloutShown } from './keyLines'

describe('labels next to the buttons', () => {
  it('keeps the labels of bound buttons while waiting for an input', () => {
    const shown = (input: string) => calloutShown(input, { focus: null, hovered: ['JOY_BTN2'], highlight: new Set(['JOY_BTN1']) })
    expect(['JOY_BTN1', 'JOY_BTN2', 'JOY_BTN3'].map(shown)).toEqual([true, true, false])
  })
})
