import i18n from 'i18next'
import { sameCombo, sameId } from '../dcs/combos'
import { KINDS, type Bindings, type Combo, type Command, type Kind } from '../dcs/types'
import { trUi } from '../i18n/i18n'
import { entryProfile, uiProfile } from './lookup'
import { setupOf, type SessionState } from './session'
import type { Entry, UiCombo } from './types'

export type Issue =
  | { code: 'dead' }
  | { code: 'modifierKey' | 'unknownModifier'; name: string }
  | { code: 'uiLayer' | 'modifierUi'; name: string; owner: Entry; ui: UiCombo }

export interface Use {
  command: Command
  combo: Combo
  kind: Kind
}

const uiCache = new WeakMap<Bindings, UiCombo[]>()

export function uiCombos(s: SessionState, entry: Entry): UiCombo[] {
  if (!entry.uiWanted || !s.uiCatalog) return []
  const cached = uiCache.get(entry.uiWanted)
  if (cached) return cached
  const profile = uiProfile(s, entry)
  const names = Object.fromEntries(KINDS.flatMap((kind) => profile.commands[kind]).map((c) => [c.hash, c.name]))
  const list = Object.entries({ ...entry.uiWanted.key, ...entry.uiWanted.axis })
    .flatMap(([hash, combos]) => combos.map((combo) => ({ combo, name: names[hash], hash })))
  uiCache.set(entry.uiWanted, list)
  return list
}

export const modifierOn = (s: SessionState, entry: Entry, key: string) =>
  Object.entries(setupOf(s).modifiers ?? {}).find(([, m]) => m.key === key && m.device === entry.dcsId)?.[0]

export function comboKeys(s: SessionState, entry: Entry, combo: Combo) {
  const modifiers = setupOf(s).modifiers ?? {}
  const held = (combo.reformers ?? []).flatMap((name) => (modifiers[name] && sameId(modifiers[name].device, entry.dcsId) ? [modifiers[name].key] : []))
  return [combo.key, ...held]
}

export function comboIssue(s: SessionState, entry: Entry, combo: Combo, hash?: string): Issue | null {
  if (hash && entry.dead.includes(hash)) return { code: 'dead' }
  const modifier = modifierOn(s, entry, combo.key)
  if (modifier) return { code: 'modifierKey', name: modifier }
  const clash = uiCombos(s, entry).find((u) => sameCombo(u.combo, combo))
  if (clash) return { code: 'uiLayer', name: clash.name, owner: entry, ui: clash }
  const { entries, modifiers } = setupOf(s)
  for (const name of combo.reformers ?? []) {
    const m = modifiers?.[name]
    if (!m) return { code: 'unknownModifier', name }
    const owner = entries.find((e) => e.dcsId === m.device)
    const ui = owner && uiCombos(s, owner).find((u) => u.combo.key === m.key)
    if (owner && ui) return { code: 'modifierUi', name, owner, ui }
  }
  return null
}

export const issueText = (issue: Issue) =>
  i18n.t(`problem.${issue.code}`, { name: issue.code === 'uiLayer' ? trUi(issue.name) : 'name' in issue ? issue.name : '' })

export function comboProblem(s: SessionState, entry: Entry, combo: Combo, hash?: string) {
  const issue = comboIssue(s, entry, combo, hash)
  return issue ? issueText(issue) : ''
}

function uses(s: SessionState, entry: Entry, keep: (combo: Combo, command: Command) => boolean): Use[] {
  if (!entry.wanted) return []
  const profile = entryProfile(s, entry)
  return KINDS.flatMap((kind) => profile.commands[kind].flatMap((command) =>
    (entry.wanted![kind][command.hash] ?? []).filter((combo) => keep(combo, command)).map((combo) => ({ command, combo, kind }))))
}

export const commandsUsing = (s: SessionState, entry: Entry, key: string) => uses(s, entry, (combo) => combo.key === key)

export type KeyKind = 'warn' | 'modifier' | 'used' | 'free'

export function keyState(s: SessionState, entry: Entry, key: string) {
  const using = commandsUsing(s, entry, key)
  const modifier = modifierOn(s, entry, key)
  const ui = uiCombos(s, entry).filter((u) => u.combo.key === key && !u.combo.reformers)
  const kind: KeyKind = using.some((u) => comboIssue(s, entry, u.combo, u.command.hash)) ? 'warn'
    : modifier ? 'modifier' : using.length || ui.length ? 'used' : 'free'
  return { using, modifier, ui, kind }
}

export const problemsOf = (s: SessionState, entry: Entry) =>
  uses(s, entry, () => true).flatMap((use) => {
    const issue = comboIssue(s, entry, use.combo, use.command.hash)
    return issue ? [{ ...use, issue }] : []
  })
