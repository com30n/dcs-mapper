import { cleanCombo, comboId, filterKey, sameCombo } from './combos'
import { KINDS, type Bindings, type Catalog, type Combo, type Command, type CommandDiff, type DeviceDiff, type Kind, type Profile } from './types'

const SECTION: Record<Kind, 'keyDiffs' | 'axisDiffs'> = { key: 'keyDiffs', axis: 'axisDiffs' }

export function profileFor(catalog: Catalog, template: string): Profile {
  const own = catalog.profiles[template]
  return {
    commands: own ? own.commands : catalog.commands,
    defaults: own ? own.defaults : (catalog.defaults[template] ?? catalog.defaults['']),
  }
}

export function applyDiff(hashes: string[], defaults: Record<string, Combo[]>, diff?: Record<string, CommandDiff>) {
  const current: Record<string, Combo[]> = {}
  const updated: string[] = []
  const entries = Object.entries(diff ?? {})
  const infos: Record<string, { added?: string; removed?: string }> = {}
  for (const [hash, d] of entries) {
    for (const c of d.added ?? []) (infos[comboId(c)] ??= {}).added = hash
    for (const c of d.removed ?? []) (infos[comboId(c)] ??= {}).removed = hash
  }
  const without = (combos: Combo[], list?: Combo[]) => {
    for (const c of list ?? []) {
      const index = combos.findIndex((x) => sameCombo(x, c))
      if (index >= 0) combos.splice(index, 1)
    }
  }
  const withAdded = (combos: Combo[], list?: Combo[]) => {
    for (const c of list ?? []) if (!combos.some((x) => sameCombo(x, c))) combos.push(cleanCombo(c))
  }
  for (const hash of hashes) {
    const base = defaults[hash]
    let combos = base ? base.map((c) => cleanCombo(c)) : null
    if (combos && entries.length) {
      const isUpdated = combos.some((c) => {
        const info = infos[comboId(c)]
        return info && hash !== info.added && hash !== info.removed
      })
      if (isUpdated) updated.push(hash)
      else for (const [, d] of entries) { without(combos, d.added); without(combos, d.removed); without(combos, d.changed) }
    }
    const own = diff?.[hash]
    if (own) {
      combos ??= []
      without(combos, own.removed)
      withAdded(combos, own.added)
      withAdded(combos, own.changed)
    }
    if (combos?.length) current[hash] = combos
  }
  return { current, updated }
}

export function commandDiff(name: string, defaultCombos: Combo[] | undefined, wantedCombos: Combo[] | undefined, axis: boolean, keptRemovals: Combo[] = []): CommandDiff | null {
  const byId = new Map((defaultCombos ?? []).map((c) => [comboId(c), c]))
  const wantedIds = new Set((wantedCombos ?? []).map(comboId))
  const entry: CommandDiff = {
    added: (wantedCombos ?? []).filter((c) => !byId.has(comboId(c))).map((c) => cleanCombo(c)),
    removed: [...(defaultCombos ?? []), ...keptRemovals.filter((c) => !byId.has(comboId(c)))]
      .filter((c) => !wantedIds.has(comboId(c))).map((c) => cleanCombo(c, false)),
  }
  if (axis) {
    entry.changed = (wantedCombos ?? []).filter((c) => byId.has(comboId(c)) && filterKey(c) !== filterKey(byId.get(comboId(c))!)).map((c) => cleanCombo(c))
  }
  for (const key of ['added', 'removed', 'changed'] as const) if (!entry[key]?.length) delete entry[key]
  return Object.keys(entry).length ? { name, ...entry } : null
}

export function buildDiff(profile: Profile, wanted: Bindings, extra: DeviceDiff = {}, nameOf = (command: Command) => command.name, original: DeviceDiff = {}): DeviceDiff {
  const diff: DeviceDiff = { ...extra }
  delete diff.keyDiffs
  delete diff.axisDiffs
  for (const kind of KINDS) {
    const entries: Record<string, CommandDiff> = {}
    for (const command of profile.commands[kind]) {
      const entry = commandDiff(nameOf(command), profile.defaults[kind][command.hash], wanted[kind][command.hash], kind === 'axis', original[SECTION[kind]]?.[command.hash]?.removed)
      if (entry) entries[command.hash] = entry
    }
    if (Object.keys(entries).length) diff[SECTION[kind]] = entries
  }
  return diff
}

export function currentFrom(profile: Profile, diff?: DeviceDiff): Bindings & { updated: Set<string> } {
  const result = { key: {}, axis: {}, updated: new Set<string>() } as Bindings & { updated: Set<string> }
  for (const kind of KINDS) {
    const { current, updated } = applyDiff(profile.commands[kind].map((c) => c.hash), profile.defaults[kind], diff?.[SECTION[kind]])
    result[kind] = current
    for (const hash of updated) result.updated.add(hash)
  }
  return result
}

export const namesOf = (diff: DeviceDiff): Record<string, string> => Object.fromEntries(
  [...Object.entries(diff.keyDiffs ?? {}), ...Object.entries(diff.axisDiffs ?? {})].flatMap(([hash, d]) => (d.name ? [[hash, d.name]] : [])))

export const extraOf = (diff: DeviceDiff): DeviceDiff => Object.fromEntries(Object.entries(diff).filter(([k]) => k !== 'keyDiffs' && k !== 'axisDiffs'))
