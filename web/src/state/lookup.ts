import { sameId, templateOf } from '../dcs/combos'
import { profileFor } from '../dcs/diff'
import type { DeviceDiff, Profile } from '../dcs/types'
import type { Device } from '../data/types'
import type { PadInfo } from '../gamepad/store'
import { setupOf, type SessionState } from './session'
import type { Entry } from './types'

export const entryTemplate = (s: SessionState, entry: Entry) => templateOf(entry.dcsId || s.devices[entry.deviceId]?.dcsName || entry.generic || '')

export const entryProfile = (s: SessionState, entry: Entry): Profile => profileFor(s.catalog!, entryTemplate(s, entry))

export const uiProfile = (s: SessionState, entry: Entry): Profile => profileFor(s.uiCatalog!, entryTemplate(s, entry))

export function presetFor(s: SessionState, entry: Entry): DeviceDiff | null {
  if (!s.catalog) return null
  const device = s.devices[entry.deviceId]
  const name = device?.preset === undefined ? entryTemplate(s, entry) : device.preset
  return name ? s.catalog.presets[name] ?? null : null
}

export const isOff = (s: SessionState, name: string) => s.off.some((d) => sameId(d, name))

export const canonicalId = (s: SessionState, name: string) => s.scan.devices.find((d) => sameId(d, name)) ?? name

export const configFile = (s: SessionState, name: string) =>
  (s.catalog && (s.scan.bindings[s.catalog.folder] ?? []).find((f) => sameId(f, name))) || null

export const matchingIds = (s: SessionState, device: Pick<Device, 'dcsName'>) =>
  s.scan.devices.filter((d) => sameId(templateOf(d), device.dcsName) && !isOff(s, d))

export const candidatesFor = (s: SessionState, name: string) => s.library.filter((d) => sameId(d.dcsName, templateOf(name)))

export const undecided = (s: SessionState, entry: Entry) => !entry.pictureChosen && !!entry.generic && candidatesFor(s, entryTemplate(s, entry)).length > 0

export const deviceLabel = (s: SessionState, id: string) =>
  s.devices[setupOf(s).entries.find((e) => sameId(e.dcsId, id))?.deviceId ?? '']?.name ?? templateOf(id)

export const userDiffPath = (s: SessionState, entry: Entry) => `${s.catalog!.folder}/joystick/${entry.dcsId}.diff.lua`
export const uiPath = (entry: Entry) => `UiLayer/joystick/${entry.dcsId}.diff.lua`

export function padFor(s: SessionState, entry: Entry, pads: PadInfo[]) {
  if (entry.padId) {
    const same = pads.filter((p) => p.id === entry.padId)
    return same.find((p) => p.index === entry.padIndex) ?? (same.length === 1 ? same[0] : null)
  }
  const name = entryTemplate(s, entry).toLowerCase()
  const candidates = pads.filter((p) => p.id.toLowerCase().includes(name))
  return candidates.length === 1 ? candidates[0] : null
}
