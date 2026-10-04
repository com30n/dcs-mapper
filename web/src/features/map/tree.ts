import { controlName, dcsCompare } from '../../dcs/combos'
import { KINDS, type Bindings, type Command, type Kind, type Profile } from '../../dcs/types'
import type { Filter } from '../../state/mapUi'
import { comboIssue } from '../../state/problems'
import type { SessionState } from '../../state/session'
import type { Entry } from '../../state/types'

export interface Category {
  id: string
  kind: Kind
  name: string
}

export interface Item {
  command: Command
  kind: Kind
}

export interface Slot extends Item {
  position: string
}

export interface Row {
  control: string
  kind: Kind
  slots: Slot[]
}

type Translate = (text: string) => string

export const categoryLabel = (category: Category, tr: Translate) => tr(category.kind === 'axis' ? 'Axis Commands' : category.name)

export function categoriesOf(profile: Profile, tr: Translate): Category[] {
  const names = new Set(profile.commands.key.flatMap((c) => c.category))
  const key = [...names].sort((a, b) => dcsCompare(tr(a), tr(b))).map((name): Category => ({ id: `key:${name}`, kind: 'key', name }))
  return profile.commands.axis.length ? [{ id: 'axis', kind: 'axis', name: '' }, ...key] : key
}

const byName = (tr: Translate) => (a: Item, b: Item) => dcsCompare(tr(a.command.name), tr(b.command.name))

export function commandsIn(profile: Profile, category: Category, tr: Translate): Item[] {
  const list = category.kind === 'axis' ? profile.commands.axis : profile.commands.key.filter((c) => c.category.includes(category.name))
  return list.map((command) => ({ command, kind: category.kind })).sort(byName(tr))
}

export function searchResults(profile: Profile, search: string, tr: Translate): Item[] {
  const query = search.trim().toLowerCase()
  return KINDS.flatMap((kind) => profile.commands[kind].map((command) => ({ command, kind })))
    .filter(({ command }) => `${command.name} ${tr(command.name)} ${command.category.join(' ')} ${command.category.map(tr).join(' ')}`.toLowerCase().includes(query))
    .sort(byName(tr))
    .slice(0, 300)
}

export const isMapped = (wanted: Bindings, { command, kind }: Item) => (wanted[kind][command.hash] ?? []).length > 0

export function groupRows(list: Item[], tr: Translate): Row[] {
  const rows: Row[] = []
  for (const item of list) {
    const shown = controlName(tr(item.command.name))
    const slot = { ...item, position: shown.position || controlName(item.command.name).position }
    const last = rows.at(-1)
    if (last && last.control === shown.control && last.kind === item.kind) last.slots.push(slot)
    else rows.push({ control: shown.control, kind: item.kind, slots: [slot] })
  }
  return rows
}

export function filterItems(s: SessionState, entry: Entry, list: Item[], filter: Filter) {
  if (filter === 'mapped') return list.filter((item) => isMapped(entry.wanted!, item))
  if (filter === 'free') return list.filter((item) => !isMapped(entry.wanted!, item))
  if (filter === 'problems') return list.filter(({ command, kind }) => (entry.wanted![kind][command.hash] ?? []).some((c) => comboIssue(s, entry, c, command.hash)))
  return list
}
