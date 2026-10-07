import { controlName, dcsCompare } from '../../dcs/combos'
import { KINDS, type Bindings, type Command, type Kind, type Profile } from '../../dcs/types'
import { categoryId, type Filter } from '../../state/mapUi'
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
  const key = [...names].sort((a, b) => dcsCompare(tr(a), tr(b))).map((name): Category => ({ id: categoryId('key', name), kind: 'key', name }))
  return profile.commands.axis.length ? [{ id: categoryId('axis'), kind: 'axis', name: '' }, ...key] : key
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

const indexCache = new WeakMap<Command[], Map<string, Command>>()

export function commandOf(profile: Profile, kind: Kind, hash: string) {
  const list = profile.commands[kind]
  let index = indexCache.get(list)
  if (!index) indexCache.set(list, (index = new Map(list.map((c) => [c.hash, c]))))
  return index.get(hash)
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

export function mergeProfiles(profiles: Profile[]): Profile {
  const commands = Object.fromEntries(KINDS.map((kind) => {
    const byHash = new Map<string, Command>()
    for (const profile of profiles) {
      for (const command of profile.commands[kind]) {
        const seen = byHash.get(command.hash)
        if (!seen || (seen.joystick === false && command.joystick !== false)) byHash.set(command.hash, command)
      }
    }
    return [kind, [...byHash.values()]]
  })) as Profile['commands']
  return { commands, defaults: { key: {}, axis: {} } }
}

export function shownItems(wanted: Bindings[], list: Item[], filter: Filter) {
  if (filter === 'mapped') return list.filter((item) => wanted.some((w) => isMapped(w, item)))
  if (filter === 'free') return list.filter((item) => !wanted.some((w) => isMapped(w, item)))
  return list
}

export function tableItems(s: SessionState, entries: Entry[], list: Item[], filter: Filter) {
  if (filter !== 'problems') return shownItems(entries.map((e) => e.wanted!), list, filter)
  return list.filter(({ command, kind }) => entries.some((e) => (e.wanted![kind][command.hash] ?? []).some((c) => comboIssue(s, e, c, command.hash))))
}
