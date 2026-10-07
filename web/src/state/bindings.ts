import i18n from 'i18next'
import { comboId, comboText, isAxisKey, sameCombo } from '../dcs/combos'
import { isDefaultFilter } from '../dcs/axis'
import { forceFeedbackDiff } from '../dcs/forceFeedback'
import { KEYBOARD_MODIFIER_KEYS } from '../dcs/keyboard'
import type { AxisFilter, Combo, ForceFeedback, Kind } from '../dcs/types'
import { usePads } from '../gamepad/store'
import { tr } from '../i18n/i18n'
import { entryProfile } from './lookup'
import { categoryId, useMapUi } from './mapUi'
import { remember, said } from './history'
import { commandsUsing, modifierOn } from './problems'
import { draftSetup, setupOf, useSession, type SessionState } from './session'
import type { Entry, Listening } from './types'

const get = () => useSession.getState()
const activeOf = (s: SessionState) => setupOf(s).entries[s.active] as Entry | undefined

function edit(uid: string, change: (entry: Entry) => void) {
  useSession.setState((s) => {
    const entry = draftSetup(s).entries.find((e) => e.uid === uid)
    if (entry) change(entry)
  })
}

const waitFor = (listening: Listening) =>
  useMapUi.setState({ listening, adding: [], addAxis: false, focus: null, flash: null, toast: null, toastAction: null, drawer: true })

export function pickColumn(uid?: string) {
  if (!uid) return
  const s = get()
  const index = setupOf(s).entries.findIndex((e) => e.uid === uid)
  if (index >= 0 && index !== s.active) selectEntry(index)
}

export function listen(hash: string, kind: Kind, name: string, uid?: string) {
  pickColumn(uid)
  if (useMapUi.getState().listening?.hash === hash) return useMapUi.setState({ drawer: true })
  waitFor({ hash, kind, name })
}

export function selectEntry(index: number) {
  const s = get()
  const to = setupOf(s).entries[index]
  const { listening } = useMapUi.getState()
  const kept = listening && !listening.carry && to && entryProfile(s, to).commands[listening.kind].some((c) => c.hash === listening.hash)
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
  const { carry } = listening
  const own = modifierOn(s, entry, input)
  if (own && !axis && !carry) return toggleAdding(own)
  const reformers = [...new Set([...adding, ...heldModifiers(s, entry)])]
  const combo: Combo = carry ? { ...carry.combo, key: input } : reformers.length ? { key: input, reformers } : { key: input }
  if (carry && sameCombo(combo, carry.combo)) return useMapUi.setState({ listening: null, adding: [], addAxis: false, drawer: false })
  const commands = entryProfile(s, entry).commands[listening.kind]
  const stays = (c: Combo) => carry ? !sameCombo(c, combo) && !(carry.mode === 'move' && sameCombo(c, carry.combo))
    : addAxis ? !sameCombo(c, combo) : layerOf(c) !== layerOf(combo)
  const kept = (entry.wanted[listening.kind][listening.hash] ?? []).filter(stays)
  let movedFrom = ''
  remember()
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
  const words = { command: listening.name, input: comboText(combo), from: movedFrom, kept: kept.map(comboText).join(', ') }
  const toast = carry ? [i18n.t(`toast.${carry.mode === 'move' ? 'moved' : 'copied'}`, words), movedFrom && i18n.t('toast.takenFrom', words)].filter(Boolean).join(' ')
    : i18n.t(movedFrom ? 'toast.movedAssigned' : addAxis && kept.length ? 'toast.addedAxis' : 'toast.assigned', words)
  said(toast)
  useMapUi.setState({
    flash: listening.hash, listening: null, adding: [], addAxis: false, drawer: false,
  })
}

export function pressKey(key: string, held: string[]) {
  if (KEYBOARD_MODIFIER_KEYS.includes(key)) return
  const modifiers = setupOf(get()).modifiers ?? {}
  const names = held.flatMap((k) => Object.keys(modifiers).filter((n) => modifiers[n].device === 'Keyboard' && modifiers[n].key === k))
  useMapUi.setState((m) => { m.adding = [...new Set([...m.adding, ...names])] })
  assign(key)
}

export function find(input: string) {
  const s = get()
  const entry = activeOf(s)
  const using = entry?.wanted ? commandsUsing(s, entry, input) : []
  if (!using.length) return useMapUi.setState({ focus: input, explain: false })
  const { open, filter } = useMapUi.getState()
  const wanted = using.map(({ command, kind }) => categoryId(kind, command.category[0]))
  useMapUi.setState({
    focus: input, explain: false, search: '', filter: filter === 'mapped' ? 'mapped' : 'all', scrollTo: `${wanted[0]}|${using[0].command.hash}`,
    open: open && [...open, ...wanted.filter((id, i) => !open.includes(id) && wanted.indexOf(id) === i)],
  })
}

export function carry(kind: Kind, hash: string, name: string, combo: Combo, mode: 'copy' | 'move', uid?: string) {
  pickColumn(uid)
  waitFor({ hash, kind, name, carry: { combo, mode } })
}

export function press(input: string) {
  if (useMapUi.getState().listening) assign(input)
  else find(input)
}

export const why = (input: string) => useMapUi.setState({ focus: input, explain: true, listening: null })

export function removeCombo(kind: Kind, hash: string, id: string, name: string, uid?: string) {
  pickColumn(uid)
  const entry = activeOf(get())!
  remember()
  edit(entry.uid, (target) => {
    const left = (target.wanted![kind][hash] ?? []).filter((c) => comboId(c) !== id)
    if (left.length) target.wanted![kind][hash] = left
    else delete target.wanted![kind][hash]
    target.dead = target.dead.filter((h) => h !== hash)
  })
  said(i18n.t('toast.cleared', { command: name }))
}

export function freeUi(uid: string, id: string) {
  remember()
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
  remember()
  edit(entry.uid, (target) => {
    target.wanted!.axis[hash].forEach((combo, i) => {
      if (isDefaultFilter(filters[i])) delete combo.filter
      else combo.filter = filters[i]
    })
  })
  const name = entryProfile(s, entry).commands.axis.find((c) => c.hash === hash)?.name ?? hash
  said(i18n.t('tune.saved', { command: tr(name) }))
  useMapUi.setState({ dialog: null })
}

export function saveForceFeedback(defaults: ForceFeedback, settings: ForceFeedback) {
  const s = get()
  const entry = activeOf(s)!
  const diff = forceFeedbackDiff(defaults, settings)
  remember()
  edit(entry.uid, (target) => {
    if (Object.keys(diff).length) target.extra.ffDiffs = diff
    else delete target.extra.ffDiffs
  })
  said(i18n.t('ff.saved', { device: s.devices[entry.deviceId]?.name ?? '' }))
  useMapUi.setState({ dialog: null })
}
