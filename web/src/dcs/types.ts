export type Kind = 'key' | 'axis'

export const KINDS: Kind[] = ['key', 'axis']

export interface AxisFilter {
  deadzone: number
  saturationX: number
  saturationY: number
  curvature: number[]
  slider: boolean
  invert: boolean
  [extra: string]: unknown
}

export interface Combo {
  key: string
  reformers?: string[]
  filter?: AxisFilter
}

export interface CommandDiff {
  name?: string
  added?: Combo[]
  removed?: Combo[]
  changed?: Combo[]
}

export interface ForceFeedback {
  trimmer: number
  shake: number
  swapAxes: boolean
  invertX: boolean
  invertY: boolean
}

export interface DeviceDiff {
  keyDiffs?: Record<string, CommandDiff>
  axisDiffs?: Record<string, CommandDiff>
  ffDiffs?: Partial<ForceFeedback>
  [extra: string]: unknown
}

export interface Command {
  hash: string
  name: string
  category: string[]
  joystick?: false
}

export type Bindings = Record<Kind, Record<string, Combo[]>>

export interface Profile {
  commands: Record<Kind, Command[]>
  defaults: Bindings
}

export interface Catalog {
  id: string
  folder: string
  name: string
  commands: Record<Kind, Command[]>
  defaults: Record<string, Bindings>
  profiles: Record<string, Profile>
  presets: Record<string, DeviceDiff>
  forceFeedback?: Record<string, (ForceFeedback & { ignore: boolean }) | null>
}

export interface Modifier {
  device: string
  key: string
  switch: boolean
}

export type Modifiers = Record<string, Modifier>
