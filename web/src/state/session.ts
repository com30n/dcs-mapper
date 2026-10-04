import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Catalog } from '../dcs/types'
import type { AircraftIndexEntry, Device, DeviceIndexEntry, LanguageEntry } from '../data/types'
import type { DcsFolder } from '../folder/folder'
import { EMPTY_SCAN, type Scan } from '../folder/scan'
import { EMPTY_SETUP, type AircraftSetup, type Entry, type EntryRuntime } from './types'

export interface SessionState {
  aircraftId: string | null
  byAircraft: Record<string, AircraftSetup>
  active: number
  languages: LanguageEntry[]
  aircraftIndex: AircraftIndexEntry[]
  library: DeviceIndexEntry[]
  catalog: Catalog | null
  uiCatalog: Catalog | null
  devices: Record<string, Device>
  runtime: Record<string, EntryRuntime>
  originals: Record<string, string | null>
  folder: DcsFolder | null
  scan: Scan
  off: string[]
  pictures: Record<string, string>
  links: Record<string, { padId: string; padIndex: number | null }>
  message: string
}

export const useSession = create<SessionState>()(
  persist(
    immer(() => ({
      aircraftId: null,
      byAircraft: {},
      active: 0,
      languages: [],
      aircraftIndex: [],
      library: [],
      catalog: null,
      uiCatalog: null,
      devices: {},
      runtime: {},
      originals: {},
      folder: null,
      scan: EMPTY_SCAN,
      off: [],
      pictures: {},
      links: {},
      message: '',
    }) as SessionState),
    {
      name: 'hotas-mapper-next-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ aircraftId: s.aircraftId, byAircraft: s.byAircraft, active: s.active, pictures: s.pictures, links: s.links }),
      merge: (saved, current) => adoptOldAnswers({ ...current, ...(saved as Partial<SessionState>) }),
    },
  ),
)

export function adoptOldAnswers(s: SessionState): SessionState {
  const pictures = { ...s.pictures }
  const links = { ...s.links }
  for (const e of Object.values(s.byAircraft).flatMap((a) => a.entries).filter((e) => e.dcsId.includes('{'))) {
    const id = e.dcsId.toLowerCase()
    if (e.pictureChosen) pictures[id] ??= e.generic ? '' : e.deviceId
    if (e.padId) links[id] ??= { padId: e.padId, padIndex: e.padIndex }
  }
  return { ...s, pictures, links }
}

export const setupOf = (s: SessionState): AircraftSetup => (s.aircraftId && s.byAircraft[s.aircraftId]) || EMPTY_SETUP

export function draftSetup(s: SessionState, id = s.aircraftId!): AircraftSetup {
  s.byAircraft[id] ??= { entries: [], modifiers: null, modifiersBase: null, modifiersChanged: false }
  return s.byAircraft[id]
}

export const useSetup = () => useSession(setupOf)
export const useEntries = () => useSession((s) => setupOf(s).entries)
export const useActiveEntry = () => useSession((s) => setupOf(s).entries[s.active] as Entry | undefined)

export const deviceOf = (s: SessionState, entry: Entry): Device | undefined => s.devices[entry.deviceId]
