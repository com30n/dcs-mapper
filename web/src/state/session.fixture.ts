import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { KEYBOARD_MODIFIERS } from '../dcs/combos'
import type { Catalog, Modifiers } from '../dcs/types'
import type { Device } from '../data/types'
import { EMPTY_SCAN } from '../folder/scan'
import type { SessionState } from './session'
import type { Entry } from './types'

const repo = resolve(import.meta.dirname, '..', '..', '..')
const read = <T>(path: string): T => JSON.parse(readFileSync(resolve(repo, path), 'utf-8')) as T

export const catalog = read<Catalog>('aircraft/F-16C_50/aircraft.json')
export const uiCatalog = read<Catalog>('aircraft/UiLayer/aircraft.json')

export const STICK = 'MOZA AB9 FFB Base {11111111-2222-3333-4444-555555555555}'

const device: Device = { id: 'MOZA/AB9 + MH16', name: 'AB9', role: 'stick', dcsName: 'MOZA AB9 FFB Base', pictures: {}, card: null, views: [] }

export function entry(change: Partial<Entry> = {}): Entry {
  return {
    uid: 'stick', deviceId: device.id, generic: null, dcsId: STICK, start: 'empty', startChosen: false, fileText: null, fileName: null, ready: null,
    wanted: { key: {}, axis: {} }, extra: {}, dead: [], padId: null, padIndex: null, uiWanted: { key: {}, axis: {} }, uiExtra: {}, uiChanged: false,
    ...change,
  }
}

export function session(entries: Entry[], modifiers: Modifiers = KEYBOARD_MODIFIERS, change: Partial<SessionState> = {}): SessionState {
  return {
    aircraftId: catalog.id, active: 0, languages: [], aircraftIndex: [], library: [], catalog, uiCatalog,
    byAircraft: { [catalog.id]: { entries, modifiers, modifiersBase: KEYBOARD_MODIFIERS, modifiersChanged: modifiers !== KEYBOARD_MODIFIERS } },
    devices: { [device.id]: device }, runtime: {}, originals: {}, folder: null, scan: EMPTY_SCAN, off: [], message: '',
    ...change,
  }
}
