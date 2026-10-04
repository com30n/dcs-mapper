import { describe, expect, it } from 'vitest'
import type { PadFrame } from '../gamepad/pads'
import { emptyDevice } from './model'
import { padFrame, useEditor } from './store'

function frame(index: number, axes: number[], fresh: string[] = []): PadFrame {
  const pad = { id: '346e-0006-MOZA AB9 FFB Base', index, mapping: '', buttons: Array.from({ length: 4 }), axes } as unknown as Gamepad
  return { pads: [pad], states: new Map([[index, { inputs: new Set(fresh), axes }]]), fresh: new Map([[index, fresh]]) }
}

describe('pressing on the device in the editor', () => {
  it('picks the button pressed and names the device as DCS does', () => {
    useEditor.setState({ device: emptyDevice(), selected: null, reported: [] })
    padFrame(frame(0, [0, 0, 0, 0], ['JOY_BTN3']))
    expect(useEditor.getState()).toMatchObject({ selected: 'JOY_BTN3', device: { dcsName: 'MOZA AB9 FFB Base' } })
    expect(useEditor.getState().reported).toEqual(['JOY_BTN1', 'JOY_BTN2', 'JOY_BTN3', 'JOY_BTN4', 'JOY_X', 'JOY_Y', 'JOY_Z', 'JOY_RX'])
  })

  it('picks an axis once it moves well away from where it rested', () => {
    useEditor.setState({ device: emptyDevice(), selected: null })
    padFrame(frame(1, [0, -1, 0, 0]))
    padFrame(frame(1, [0.2, -1, 0, 0]))
    expect(useEditor.getState().selected).toBeNull()
    padFrame(frame(1, [0.2, 0, 0, 0]))
    expect(useEditor.getState().selected).toBe('JOY_Y')
  })
})
