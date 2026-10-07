import { parseLua } from '../dcs/lua'
import type { DcsFolder } from './folder'

export const BUILT_IN = ['Keyboard', 'Mouse']

const DEVICE_LINE = /created \[.*?\] with full id \[(.+?)\]/g

export interface DisabledFile {
  devices?: Record<string, boolean>
  pnp?: boolean
  [extra: string]: unknown
}

export interface Scan {
  aircraft: string[]
  bindings: Record<string, string[]>
  devices: string[]
  disabled: string[]
  disabledFile: DisabledFile | null
  builtIn: Record<string, string[]>
}

export const EMPTY_SCAN: Scan = { aircraft: [], bindings: {}, devices: [], disabled: [], disabledFile: null, builtIn: {} }

async function readDisabled(folder: DcsFolder): Promise<DisabledFile | null> {
  try { return parseLua((await folder.read('disabled.lua')) ?? '') as DisabledFile } catch { return null }
}

export async function scanFolder(folder: DcsFolder): Promise<Scan> {
  const devices = new Set<string>()
  const aircraft: string[] = []
  const bindings: Record<string, string[]> = {}
  const builtIn: Record<string, string[]> = {}
  for (const entry of await folder.list('')) {
    if (!entry.dir) continue
    for (const name of BUILT_IN) {
      const files = await folder.list(`${entry.name}/${name.toLowerCase()}`)
      if (files.some((f) => f.name.toLowerCase() === `${name.toLowerCase()}.diff.lua`)) (builtIn[entry.name] ??= []).push(name)
    }
    const files = (await folder.list(`${entry.name}/joystick`)).map((f) => f.name).filter((n) => n.endsWith('.diff.lua'))
    const names = files.map((file) => file.slice(0, -'.diff.lua'.length)).filter((name) => name.includes('{'))
    if (names.length) {
      aircraft.push(entry.name)
      bindings[entry.name] = names
    }
    for (const name of names) devices.add(name)
  }
  const byLower = new Map([...devices].map((d) => [d.toLowerCase(), d]))
  const log = await folder.log()
  if (log) for (const m of log.matchAll(DEVICE_LINE)) byLower.set(m[1].toLowerCase(), m[1])
  const disabledFile = await readDisabled(folder)
  return { aircraft, bindings, devices: [...byLower.values()].sort(), disabled: Object.keys(disabledFile?.devices ?? {}), disabledFile, builtIn }
}
