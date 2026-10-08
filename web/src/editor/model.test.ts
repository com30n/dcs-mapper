import { describe, expect, it } from 'vitest'
import type { Device } from '../data/types'
import { addPicture, changeCount, dcsNameOf, deviceId, deviceJson, emptyDevice, fitCrop, layerAt, markExtent, nextOpen, toPicture, viewMarks, padInputs, placeMark, removeMark, sortInputs, withCrop } from './model'

const device = (): Device => ({
  id: 'MOZA/AB9 + MH16', name: 'MOZA AB9 FFB Base + MH16 grip', role: 'stick', dcsName: 'MOZA AB9 FFB Base',
  pictures: { 'mh16.png': { size: [1141, 909], marks: [{ input: 'JOY_BTN2', x: 10, y: 10 }, { input: 'JOY_BTN1', x: 20, y: 20 }] } },
  card: { picture: 'mh16.png', x: 10, y: 0, w: 50, h: 60 }, views: [{ name: 'Main', picture: 'mh16.png' }],
})

describe('device editor model', () => {
  it('orders buttons by number, then hats, then axes', () => {
    expect(sortInputs(['JOY_X', 'JOY_BTN10', 'JOY_BTN_POV1_L', 'JOY_BTN2', 'JOY_BTN_POV1_U'])).toEqual(['JOY_BTN2', 'JOY_BTN10', 'JOY_BTN_POV1_U', 'JOY_BTN_POV1_L', 'JOY_X'])
  })

  it('lists what a connected controller reports', () => {
    expect(padInputs(3, true, 2)).toEqual(['JOY_BTN1', 'JOY_BTN2', 'JOY_BTN3', ...['U', 'UR', 'R', 'DR', 'D', 'DL', 'L', 'UL'].map((d) => `JOY_BTN_POV1_${d}`), 'JOY_X', 'JOY_Y'])
  })

  it('takes the DCS name from the controller name in Chrome and Firefox', () => {
    expect(dcsNameOf('MOZA AB9 FFB Base (Vendor: 346e Product: 1000)')).toBe('MOZA AB9 FFB Base')
    expect(dcsNameOf('346e-1000-MOZA AB9 FFB Base')).toBe('MOZA AB9 FFB Base')
  })

  it('moves a mark, keeps one mark per input and stays inside the picture', () => {
    const moved = placeMark(device(), 'mh16.png', 'JOY_BTN1', 33.333, 120)
    expect(moved.pictures['mh16.png'].marks).toEqual([{ input: 'JOY_BTN2', x: 10, y: 10 }, { input: 'JOY_BTN1', x: 33.33, y: 100 }])
    expect(removeMark(moved, 'mh16.png', 'JOY_BTN2').pictures['mh16.png'].marks).toEqual([{ input: 'JOY_BTN1', x: 33.33, y: 100 }])
  })

  it('picks the next input that has no mark yet', () => {
    expect(nextOpen(['JOY_BTN1', 'JOY_BTN2', 'JOY_BTN3'], new Set(['JOY_BTN1', 'JOY_BTN3']))).toBe('JOY_BTN2')
    expect(nextOpen(['JOY_BTN1'], new Set(['JOY_BTN1']))).toBeNull()
  })

  it('keeps a crop inside the picture and drops it when it covers the whole picture', () => {
    expect(fitCrop({ x: 90, y: -0, w: 30, h: 1 })).toEqual({ x: 70, y: 0, w: 30, h: 2 })
    expect(withCrop({ picture: 'a.png', x: 5, y: 5, w: 50, h: 50 }, { x: 0, y: 0, w: 100, h: 100 })).toEqual({ picture: 'a.png' })
  })

  it('names the folder after the maker and the device without repeating the maker', () => {
    expect(deviceId('MOZA', 'MOZA MTQ Throttle Panel + TQF grip')).toBe('MOZA/MTQ Throttle Panel + TQF grip')
    expect(deviceId('', 'My/Panel*')).toBe('Other/My Panel')
  })

  it('writes device.json like the repository files: marks in order, no editor-only fields', () => {
    const d = addPicture(placeMark(device(), 'mh16.png', 'JOY_BTN3', 50, 50), 'side.png', [100, 50], 'blob:x')
    const json = JSON.parse(deviceJson(d))
    expect(Object.keys(json)).toEqual(['name', 'role', 'dcsName', 'pictures', 'card', 'views'])
    expect(json.pictures['mh16.png'].marks.map((m: { input: string }) => m.input)).toEqual(['JOY_BTN1', 'JOY_BTN2', 'JOY_BTN3'])
    expect(json.pictures['side.png']).toEqual({ size: [100, 50] })
    expect(deviceJson(d).startsWith('{\n "name"')).toBe(true)
  })

  it('keeps the fields of device.json the editor does not know', () => {
    const d = { ...device(), unverified: ['axes'] }
    expect(JSON.parse(deviceJson(d)).unverified).toEqual(['axes'])
  })

  it('gives a new device its first picture as card and view', () => {
    const d = addPicture(emptyDevice(), 'grip.png', [800, 600], 'blob:y')
    expect([d.card, d.views]).toEqual([{ picture: 'grip.png' }, [{ name: 'Main', picture: 'grip.png' }]])
  })

  it('counts each moved, added or removed mark and each changed frame as a change', () => {
    const before = device()
    const after = withCrop(placeMark(removeMark(before, 'mh16.png', 'JOY_BTN2'), 'mh16.png', 'JOY_BTN1', 1, 1).card!, { x: 0, y: 0, w: 40, h: 40 })
    expect(changeCount(before, { ...placeMark(removeMark(before, 'mh16.png', 'JOY_BTN2'), 'mh16.png', 'JOY_BTN1', 1, 1), card: after })).toBe(3)
  })
})

describe('numbers placed beside a picture', () => {
  it('widens the canvas to the numbers outside the picture, with room around them', () => {
    expect(markExtent([{ input: 'JOY_BTN1', x: 50, y: 50 }])).toEqual({ x: 0, y: 0, w: 100, h: 100 })
    expect(markExtent([{ input: 'JOY_BTN1', x: 119, y: -37.5 }, { input: 'JOY_X', x: -21.9, y: 40 }])).toEqual({ x: -25.9, y: -41.5, w: 148.9, h: 141.5 })
  })
})

describe('numbers on a view put together from several pictures', () => {
  const layered: Device = {
    id: 'MOZA/MTQ', name: 'MTQ', role: 'throttle', dcsName: 'MOZA', card: null,
    pictures: { 'panel.png': { size: [1000, 1000], marks: [{ input: 'JOY_BTN1', x: 50, y: 50 }] }, 'grip.png': { size: [1000, 500], marks: [{ input: 'JOY_BTN2', x: 120, y: -20 }] } },
    views: [{ name: 'Main', size: [2000, 1000], layers: [{ picture: 'panel.png', at: [0, 0, 50] }, { picture: 'grip.png', at: [50, 0, 50] }] }],
  }
  const view = layered.views[0]

  it('places every number where the mapper shows it, even beside its picture', () => {
    expect(viewMarks(layered, view)).toEqual([{ layer: 0, picture: 'panel.png', input: 'JOY_BTN1', x: 25, y: 50 }, { layer: 1, picture: 'grip.png', input: 'JOY_BTN2', x: 110, y: -10 }])
  })

  it('turns a point of the view back into the picture it belongs to', () => {
    expect(toPicture(layered, view, 1, 110, -10)).toEqual({ x: 120, y: -20 })
    expect([layerAt(layered, view, 25, 50), layerAt(layered, view, 75, 20), layerAt(layered, view, 75, 80)]).toEqual([0, 1, null])
  })
})
