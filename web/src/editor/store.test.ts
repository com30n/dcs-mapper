import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { PadFrame } from '../gamepad/pads'
import { emptyDevice } from './model'
import { editedDevices, moveInView, moveMark, openDevice, padFrame, placeInView, setGrid, takeOff, useEditor } from './store'
import type { Device } from '../data/types'

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

describe('placing numbers on the view the mapper shows', () => {
  const layered = (): Device => ({
    id: 'MOZA/MTQ', name: 'MTQ', role: 'throttle', dcsName: 'MOZA', card: null,
    pictures: { 'panel.png': { size: [1000, 1000], marks: [{ input: 'JOY_BTN1', x: 50, y: 50 }] }, 'grip.png': { size: [1000, 500], marks: [{ input: 'JOY_BTN2', x: 120, y: -20 }] } },
    views: [{ name: 'Main', size: [2000, 1000], layers: [{ picture: 'panel.png', at: [0, 0, 50] }, { picture: 'grip.png', at: [50, 0, 50] }] }],
  })
  const marks = () => Object.fromEntries(Object.entries(useEditor.getState().device!.pictures).map(([name, p]) => [name, p.marks]))

  it('moves a number within the picture it belongs to', () => {
    useEditor.setState({ device: layered(), mode: 'buttons', view: 0, whole: 0, selected: null })
    moveInView(1, 'JOY_BTN2', 75, 25)
    expect(marks()['grip.png']).toEqual([{ input: 'JOY_BTN2', x: 50, y: 50 }])
  })

  it('takes off only the copy that was picked when a number is on two pictures', () => {
    const twice = layered()
    twice.pictures['panel.png'].marks = [{ input: 'JOY_BTN2', x: 10, y: 10 }]
    useEditor.setState({ device: twice, mode: 'buttons', view: 0, whole: 0, selected: 'JOY_BTN2', selectedLayer: 0 })
    takeOff('JOY_BTN2')
    expect(marks()).toEqual({ 'panel.png': [], 'grip.png': [{ input: 'JOY_BTN2', x: 120, y: -20 }] })
  })

  it('puts a number on the picture under the pointer and takes it off the other one', () => {
    useEditor.setState({ device: layered(), mode: 'buttons', view: 0, whole: 0, selected: 'JOY_BTN1' })
    placeInView(75, 25)
    expect(marks()).toEqual({ 'panel.png': [], 'grip.png': [{ input: 'JOY_BTN2', x: 120, y: -20 }, { input: 'JOY_BTN1', x: 50, y: 50 }] })
  })
})

describe('editing several devices in one go', () => {
  const repo = resolve(import.meta.dirname, '..', '..', '..')
  const serve = () => vi.stubGlobal('fetch', async (path: string) => new Response(readFileSync(resolve(repo, decodeURIComponent(path.replace(/^\.?\//, ''))))))

  it('keeps the moved numbers of a device while another one is open', async () => {
    serve()
    await openDevice('MOZA/AB9 + MH16')
    moveMark('JOY_BTN1', 1, 2)
    await openDevice('MOZA/MTQ + TQF')
    expect(editedDevices(useEditor.getState()).map((d) => d.id)).toEqual(['MOZA/AB9 + MH16'])
    await openDevice('MOZA/AB9 + MH16')
    const mark = useEditor.getState().device!.pictures['mh16.png'].marks!.find((m) => m.input === 'JOY_BTN1')
    expect(mark).toEqual({ input: 'JOY_BTN1', x: 1, y: 2 })
  })
})

describe('grid over the picture in the editor', () => {
  it('stays off until it is turned on and remembers the choice', () => {
    const kept = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => kept.set(key, value) })
    expect(useEditor.getState().grid).toBe(false)
    setGrid(true)
    expect(useEditor.getState().grid).toBe(true)
    expect(localStorage.getItem('hotas-mapper-editor-grid')).toBe('on')
    setGrid(false)
    expect(localStorage.getItem('hotas-mapper-editor-grid')).toBe('off')
    vi.unstubAllGlobals()
  })
})
