import { filterWithDefaults } from './axis'
import { KEYBOARD_MODIFIER_KEYS } from './keyboard'
import type { Combo, Modifiers } from './types'

export const AXES = ['JOY_X', 'JOY_Y', 'JOY_Z', 'JOY_RX', 'JOY_RY', 'JOY_RZ', 'JOY_SLIDER1', 'JOY_SLIDER2']
export const POV = ['U', 'UR', 'R', 'DR', 'D', 'DL', 'L', 'UL']
const POV_ARROWS: Record<string, string> = { U: '↑', UR: '↗', R: '→', DR: '↘', D: '↓', DL: '↙', L: '←', UL: '↖' }

export const templateOf = (deviceName: string) => deviceName.replace(/\s\{.*\}$/, '')
export const MOUSE_AXES = ['MOUSE_X', 'MOUSE_Y', 'MOUSE_Z']
export const isAxisKey = (key: string) => AXES.includes(key) || MOUSE_AXES.includes(key)
export const sameId = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

export const comboId = (c: Combo) => `${c.key}|${[...(c.reformers ?? [])].sort().join('+')}`
export const sameCombo = (a: Combo, b: Combo) => comboId(a) === comboId(b)
export const filterKey = (c: Combo) => JSON.stringify(filterWithDefaults(c.filter))

export function cleanCombo(c: Combo, withFilter = true): Combo {
  const clean: Combo = { key: c.key }
  if (c.reformers?.length) clean.reformers = [...c.reformers]
  if (withFilter && c.filter && Object.keys(c.filter).length) clean.filter = filterWithDefaults(c.filter)
  return clean
}

export function inputLabel(key: string) {
  const button = /^JOY_BTN(\d+)$/.exec(key)
  if (button) return `Btn ${button[1]}`
  const pov = /^JOY_BTN_POV(\d)_(\w+)$/.exec(key)
  if (pov) return `POV${pov[1] === '1' ? '' : pov[1]} ${POV_ARROWS[pov[2]]}`
  if (key.startsWith('MOUSE_')) return `Mouse ${markLabel(key)}`
  return key.replace(/^JOY_/, '')
}

const MOUSE_BUTTONS: Record<string, string> = { '1': 'L', '2': 'R', '3': 'M' }

export function markLabel(input: string) {
  const mouse = /^MOUSE_(?:BTN)?(\w+)$/.exec(input)
  if (mouse) return MOUSE_BUTTONS[mouse[1]] ?? mouse[1]
  const button = /^JOY_BTN(\d+)$/.exec(input)
  if (button) return button[1]
  const pov = /^JOY_BTN_POV\d_(\w+)$/.exec(input)
  if (pov) return POV_ARROWS[pov[1]]
  return input.replace(/^JOY_/, '').replace('SLIDER', 'S')
}

export const comboText = (combo: Combo) => [...(combo.reformers ?? []), inputLabel(combo.key)].join(' + ')

export function controlName(name: string) {
  const at = name.indexOf(' - ')
  return at < 0 ? { control: name, position: '' } : { control: name.slice(0, at), position: name.slice(at + 3) }
}

export const KEYBOARD_MODIFIERS: Modifiers = Object.fromEntries(KEYBOARD_MODIFIER_KEYS
  .map((key) => [key, { device: 'Keyboard', key, switch: false }]))

export function dcsCompare(a: string, b: string) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue
    const x = a[i].toLowerCase()
    const y = b[i].toLowerCase()
    if (x !== y) return x < y ? -1 : 1
    return a[i] < b[i] ? -1 : 1
  }
  return a.length - b.length
}
