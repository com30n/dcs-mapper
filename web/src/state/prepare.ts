import { KEYBOARD_MODIFIERS } from '../dcs/combos'
import { currentFrom, extraOf } from '../dcs/diff'
import { parseLua } from '../dcs/lua'
import type { Bindings, DeviceDiff, Modifiers } from '../dcs/types'
import { installedDiff, installedText } from './devices'
import { remember } from './history'
import { entryProfile, entryTemplate, presetFor, uiPath, uiProfile, userDiffPath } from './lookup'
import { draftSetup, setupOf, useSession } from './session'
import type { Entry } from './types'

const get = () => useSession.getState()
const bindingsOf = ({ key, axis }: Bindings): Bindings => ({ key, axis })

async function startDiff(entry: Entry): Promise<DeviceDiff> {
  if (entry.start === 'preset') return presetFor(get(), entry) ?? {}
  if (entry.start === 'current') return installedDiff(entry.dcsId)
  if (entry.start === 'file') return parseLua(entry.fileText ?? '') as DeviceDiff
  return {}
}

const uiLayerText = (entry: Entry) => {
  const s = get()
  return s.folder && entry.dcsId ? s.folder.read(uiPath(entry)) : Promise.resolve(null)
}

const uiLayerDiff = (entry: Entry, text: string | null): DeviceDiff =>
  text ? (parseLua(text) as DeviceDiff) : (get().uiCatalog!.presets[entryTemplate(get(), entry)] ?? {})

async function loadModifiers(): Promise<Modifiers> {
  const s = get()
  const text = s.folder ? await s.folder.read(`${s.catalog!.folder}/modifiers.lua`) : null
  return text ? (parseLua(text) as unknown as Modifiers) : { ...KEYBOARD_MODIFIERS }
}

async function prepareEntry(entry: Entry) {
  const s = get()
  const ready = `${s.aircraftId}|${entry.start}|${entry.dcsId}|${entry.fileText?.length ?? 0}`
  const patch: Partial<Entry> = {}
  if (entry.ready !== ready || !entry.wanted) {
    const diff = await startDiff(entry)
    const current = currentFrom(entryProfile(s, entry), diff)
    Object.assign(patch, {
      wanted: entry.start === 'empty' ? { key: {}, axis: {} } : bindingsOf(current),
      dead: entry.start === 'current' ? [...current.updated] : [],
      extra: entry.start === 'current' ? extraOf(diff) : {},
      ready,
    })
  }
  const uiText = await uiLayerText(entry)
  const ui = uiLayerDiff(entry, uiText)
  const uiInstalled = bindingsOf(currentFrom(uiProfile(s, entry), ui))
  if (!entry.uiChanged) Object.assign(patch, { uiWanted: uiInstalled, uiExtra: extraOf(ui) })
  const installed = await installedDiff(entry.dcsId).catch((): DeviceDiff => ({}))
  const original = await installedText(entry.dcsId)
  const runtime = { installed: bindingsOf(currentFrom(entryProfile(s, entry), installed)), installedFf: installed.ffDiffs ?? {}, uiInstalled, original: installed, uiOriginal: uiText ? ui : {} }
  useSession.setState((d) => {
    const target = draftSetup(d).entries.find((e) => e.uid === entry.uid)
    if (target) Object.assign(target, patch)
    d.runtime[entry.uid] = runtime
    if (entry.dcsId) {
      d.originals[userDiffPath(d, entry)] = original
      d.originals[uiPath(entry)] = uiText
    }
  })
}

export async function prepareMap() {
  if (!setupOf(get()).modifiers) {
    const modifiers = await loadModifiers()
    useSession.setState((s) => {
      const setup = draftSetup(s)
      setup.modifiers = modifiers
      setup.modifiersBase = modifiers
    })
  }
  for (const entry of setupOf(get()).entries) await prepareEntry(entry)
  const s = get()
  for (const path of [`${s.catalog!.folder}/modifiers.lua`, 'disabled.lua']) {
    const text = s.folder ? await s.folder.read(path) : null
    useSession.setState((d) => { d.originals[path] = text })
  }
  useSession.setState((s) => { s.active = Math.max(0, Math.min(s.active, setupOf(s).entries.length - 1)) })
}

export async function resetEntry(uid: string) {
  remember()
  useSession.setState((s) => {
    const target = draftSetup(s).entries.find((e) => e.uid === uid)
    if (target) target.ready = null
  })
  await prepareMap()
}
