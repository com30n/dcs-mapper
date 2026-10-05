import { dcsCompare, sameId } from '../dcs/combos'
import type { Modifiers } from '../dcs/types'
import { remember } from './history'
import { useMapUi } from './mapUi'
import { draftSetup, setupOf, useSession, type SessionState } from './session'
import type { Dialog } from './types'

type ModsDialog = Extract<Dialog, { type: 'mods' }>

export const modifierNames = (modifiers: Modifiers | null) => Object.keys(modifiers ?? {}).sort((a, b) => {
  const keyboard = (n: string) => Number(modifiers![n].device === 'Keyboard')
  return keyboard(a) - keyboard(b) || dcsCompare(a, b)
})

export const ownersOf = (s: SessionState) => setupOf(s).entries.filter((e) => e.dcsId.includes('{'))

export const ownerFor = (s: SessionState, device: string) => ownersOf(s).find((e) => sameId(e.dcsId, device)) ?? ownersOf(s)[0]

export function openMods(options: Partial<Omit<ModsDialog, 'type'>> = {}) {
  const s = useSession.getState()
  const active = setupOf(s).entries[s.active]
  useMapUi.setState({ dialog: { type: 'mods', adding: null, device: active?.dcsId ?? '', key: '', name: null, ...options } })
}

export const editMods = (change: Partial<ModsDialog>) =>
  useMapUi.setState((m) => { if (m.dialog?.type === 'mods') Object.assign(m.dialog, change) })

export function saveModifier() {
  const dialog = useMapUi.getState().dialog as ModsDialog
  const owner = ownerFor(useSession.getState(), dialog.device)
  const name = (dialog.name ?? dialog.key).trim()
  remember()
  useSession.setState((s) => {
    const setup = draftSetup(s)
    setup.modifiers = { ...setup.modifiers, [name]: { device: owner.dcsId, key: dialog.key, switch: dialog.adding === 'switch' } }
  })
  editMods({ adding: null, key: '', name: null })
}

export function removeModifier(name: string) {
  remember()
  useSession.setState((s) => { delete draftSetup(s).modifiers![name] })
  useMapUi.setState((m) => { m.adding = m.adding.filter((n) => n !== name) })
}

export function renameModifier(from: string, raw: string) {
  const to = raw.trim()
  const modifiers = setupOf(useSession.getState()).modifiers ?? {}
  if (!to || to === from || modifiers[to]) return
  const rename = (r: string) => (r === from ? to : r)
  remember()
  useSession.setState((s) => {
    const setup = draftSetup(s)
    setup.modifiers = Object.fromEntries(Object.entries(setup.modifiers!).map(([n, m]) => [rename(n), m]))
    for (const entry of setup.entries) {
      for (const combos of Object.values(entry.wanted?.key ?? {})) for (const c of combos) if (c.reformers) c.reformers = c.reformers.map(rename)
    }
  })
  useMapUi.setState((m) => { m.adding = m.adding.map(rename) })
}
