import i18n from 'i18next'
import { comboId, comboText, isAxisKey, sameCombo } from '../dcs/combos'
import { isDefaultFilter } from '../dcs/axis'
import { forceFeedbackDiff } from '../dcs/forceFeedback'
import type { AxisFilter, Combo, ForceFeedback, Kind } from '../dcs/types'
import { usePads } from '../gamepad/store'
import { tr } from '../i18n/i18n'
import { entryProfile } from './lookup'
import { useMapUi } from './mapUi'
import { modifierOn } from './problems'
import { draftSetup, setupOf, useSession, type SessionState } from './session'
import type { Entry } from './types'

const get = () => useSession.getState()
const activeOf = (s: SessionState) => setupOf(s).entries[s.active] as Entry | undefined

function edit(uid: string, change: (entry: Entry) => void) {
  useSession.setState((s) => {
    const entry = draftSetup(s).entries.find((e) => e.uid === uid)
    if (entry) change(entry)
  })
}

function rememberUndo(entry: Entry) {
  useMapUi.setState({ undo: { uid: entry.uid, wanted: entry.wanted! } })
}

export function listen(hash: string, kind: Kind, name: string) {
  if (useMapUi.getState().listening?.hash === hash) return useMapUi.setState({ drawer: true })
  useMapUi.setState({ listening: { hash, kind, name }, adding: [], addAxis: false, focus: null, flash: null, toast: null, undo: null, drawer: true })
}

export function selectEntry(index: number) {
  const s = get()
  const to = setupOf(s).entries[index]
  const { listening } = useMapUi.getState()
  const kept = listening && to && entryProfile(s, to).commands[listening.kind].some((c) => c.hash === listening.hash)
  useSession.setState({ active: index })
  useMapUi.setState({ listening: kept ? { ...listening } : null, focus: null, dialog: null })
}

export const toggleAdding =(name: string) =>
  useMapUi.setState((m) => { m.adding = m.adding.includes(name) ? m.adding.filter((n) => n !== name) : [...m.adding, name] })

const heldModifiers = (s: SessionState, entry: Entry) =>
  usePads.getState().live.map((key) => modifierOn(s, entry, key)).filter((name): name is string => !!name)

const layerOf = (c: Combo) => [...(c.reformers ?? [])].sort().join('+')

export function assign(input: string) {
  const s = get()
  const entry = activeOf(s)
  const { listening, adding, addAxis } = useMapUi.getState()
  if (!entry?.wanted || !listening) return
  const axis = listening.kind === 'axis'
  if (isAxisKey(input) !== axis) return
  const own = modifierOn(s, entry, input)
  if (own && !axis) return toggleAdding(own)
  const reformers = [...new Set([...adding, ...heldModifiers(s, entry)])]
  const combo: Combo = reformers.length ? { key: input, reformers } : { key: input }
  const commands = entryProfile(s, entry).commands[listening.kind]
  const stays = (c: Combo) => (addAxis ? !sameCombo(c, combo) : layerOf(c) !== layerOf(combo))
  const kept = (entry.wanted[listening.kind][listening.hash] ?? []).filter(stays)
  let movedFrom = ''
  rememberUndo(entry)
  edit(entry.uid, (target) => {
    const table = target.wanted![listening.kind]
    for (const [hash, combos] of Object.entries(table)) {
      if (hash === listening.hash) continue
      const index = combos.findIndex((c) => sameCombo(c, combo))
      if (index < 0) continue
      combos.splice(index, 1)
      movedFrom = tr(commands.find((c) => c.hash === hash)?.name ?? hash)
      if (!combos.length) delete table[hash]
    }
    table[listening.hash] = [...(table[listening.hash] ?? []).filter(stays), combo]
    target.dead = target.dead.filter((h) => h !== listening.hash)
  })
  const toast = movedFrom ? 'toast.movedAssigned' : addAxis && kept.length ? 'toast.addedAxis' : 'toast.assigned'
  useMapUi.setState({
    toast: i18n.t(toast, { command: listening.name, input: comboText(combo), from: movedFrom, kept: kept.map(comboText).join(', ') }),
    flash: listening.hash, listening: null, adding: [], addAxis: false, drawer: false,
  })
}

export function press(input: string) {
  if (useMapUi.getState().listening) assign(input)
  else useMapUi.setState({ focus: input })
}

export const why = (input: string) => useMapUi.setState({ focus: input, listening: null })

export function clear(kind: Kind, hash: string, name: string) {
  const entry = activeOf(get())!
  rememberUndo(entry)
  edit(entry.uid, (target) => { delete target.wanted![kind][hash] })
  useMapUi.setState({ toast: i18n.t('toast.cleared', { command: name }) })
}

export function undo() {
  const saved = useMapUi.getState().undo
  if (saved) edit(saved.uid, (target) => { target.wanted = saved.wanted })
  useMapUi.setState({ undo: null, toast: null })
}

export function removeCombo(kind: Kind, hash: string, id: string) {
  const entry = activeOf(get())!
  rememberUndo(entry)
  edit(entry.uid, (target) => {
    const left = (target.wanted![kind][hash] ?? []).filter((c) => comboId(c) !== id)
    if (left.length) target.wanted![kind][hash] = left
    else delete target.wanted![kind][hash]
    target.dead = target.dead.filter((h) => h !== hash)
  })
}

export function freeUi(uid: string, id: string) {
  edit(uid, (target) => {
    const table = target.uiWanted!.key
    for (const [hash, combos] of Object.entries(table)) {
      const left = combos.filter((c) => comboId(c) !== id)
      if (left.length) table[hash] = left
      else delete table[hash]
    }
    target.uiChanged = true
  })
  useMapUi.setState({ focus: null })
}

export function saveTune(hash: string, filters: AxisFilter[]) {
  const s = get()
  const entry = activeOf(s)!
  rememberUndo(entry)
  edit(entry.uid, (target) => {
    target.wanted!.axis[hash].forEach((combo, i) => {
      if (isDefaultFilter(filters[i])) delete combo.filter
      else combo.filter = filters[i]
    })
  })
  const name = entryProfile(s, entry).commands.axis.find((c) => c.hash === hash)?.name ?? hash
  useMapUi.setState({ toast: i18n.t('tune.saved', { command: tr(name) }), dialog: null })
}

export function saveForceFeedback(defaults: ForceFeedback, settings: ForceFeedback) {
  const s = get()
  const entry = activeOf(s)!
  const diff = forceFeedbackDiff(defaults, settings)
  edit(entry.uid, (target) => {
    if (Object.keys(diff).length) target.extra.ffDiffs = diff
    else delete target.extra.ffDiffs
  })
  useMapUi.setState({ toast: i18n.t('ff.saved', { device: s.devices[entry.deviceId]?.name ?? '' }), undo: null, dialog: null })
}
