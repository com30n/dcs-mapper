import { AXES, POV } from '../dcs/combos'
import { gamepadsSupported, usePads } from './store'

export interface PadState {
  inputs: Set<string>
  axes: number[]
}

export interface PadFrame {
  pads: Gamepad[]
  states: Map<number, PadState>
  fresh: Map<number, string[]>
}

const states = new Map<number, PadState>()
const hooks = new Set<(frame: PadFrame) => void>()
let running = false

function readInputs(pad: Gamepad): PadState {
  const inputs = new Set<string>()
  pad.buttons.forEach((b, i) => { if (b.pressed) inputs.add(`JOY_BTN${i + 1}`) })
  const hat = pad.axes[9]
  if (pad.mapping !== 'standard' && hat !== undefined && hat >= -1.01 && hat <= 1.01) inputs.add(`JOY_BTN_POV1_${POV[Math.round((hat + 1) * 3.5) % 8]}`)
  return { inputs, axes: pad.axes.slice(0, AXES.length) }
}

export const movedAxes = (now: PadState, start: PadState) =>
  AXES.filter((_, i) => now.axes[i] !== undefined && start.axes[i] !== undefined && Math.abs(now.axes[i] - start.axes[i]) > 0.5)

export const hasHat = (pad: Gamepad) => pad.mapping !== 'standard' && pad.axes.length > 9

function frame() {
  const pads = [...navigator.getGamepads()].filter((p): p is Gamepad => !!p)
  const ids = (list: { id: string; index: number }[]) => list.map((p) => `${p.index}:${p.id}`).join('|')
  if (ids(pads) !== ids(usePads.getState().pads)) usePads.setState({ pads: pads.map(({ id, index }) => ({ id, index })) })
  const fresh = new Map<number, string[]>()
  for (const pad of pads) {
    const now = readInputs(pad)
    const prev = states.get(pad.index) ?? now
    states.set(pad.index, now)
    fresh.set(pad.index, [...now.inputs].filter((input) => !prev.inputs.has(input)))
  }
  for (const hook of hooks) hook({ pads, states, fresh })
  requestAnimationFrame(frame)
}

export function onPadFrame(hook: (frame: PadFrame) => void) {
  hooks.add(hook)
  return () => { hooks.delete(hook) }
}

export function startPads() {
  if (running || !gamepadsSupported()) return
  running = true
  requestAnimationFrame(frame)
}
