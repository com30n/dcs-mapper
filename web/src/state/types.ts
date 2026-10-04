import type { Bindings, Combo, DeviceDiff, ForceFeedback, Kind, Modifiers } from '../dcs/types'

export type Start = 'preset' | 'current' | 'file' | 'empty'

export interface Entry {
  uid: string
  deviceId: string
  generic: string | null
  dcsId: string
  start: Start
  startChosen: boolean
  fileText: string | null
  fileName: string | null
  ready: string | null
  wanted: Bindings | null
  extra: DeviceDiff
  dead: string[]
  padId: string | null
  padIndex: number | null
  uiWanted: Bindings | null
  uiExtra: DeviceDiff
  uiChanged: boolean
}

export interface UiCombo {
  combo: Combo
  name: string
  hash: string
}

export interface EntryRuntime {
  installed: Bindings
  installedFf: Partial<ForceFeedback>
  uiInstalled: Bindings
  original: DeviceDiff
  uiOriginal: DeviceDiff
}

export interface AircraftSetup {
  entries: Entry[]
  modifiers: Modifiers | null
  modifiersBase: Modifiers | null
  modifiersChanged: boolean
}

export interface Listening {
  hash: string
  kind: Kind
  name: string
}

export type Dialog =
  | { type: 'mods'; adding: 'modifier' | 'switch' | null; device: string; key: string; name: string | null }
  | { type: 'tune'; hash: string; drafts: TuneDraft[]; at: number; input: number }
  | { type: 'ff'; draft: ForceFeedback }

export interface TuneDraft {
  deadzone: number
  saturationX: number
  saturationY: number
  single: number
  points: number[]
  user: boolean
  slider: boolean
  invert: boolean
  rest: Record<string, unknown>
}

export const EMPTY_SETUP: AircraftSetup = { entries: [], modifiers: null, modifiersBase: null, modifiersChanged: false }
