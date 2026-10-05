import { structuredPatch } from 'diff'
import { strToU8, zipSync } from 'fflate'
import i18n from 'i18next'
import { filterWithDefaults, isDefaultFilter } from '../dcs/axis'
import { comboId, comboText, dcsCompare, inputLabel, KEYBOARD_MODIFIERS, sameId } from '../dcs/combos'
import { buildDiff, namesOf } from '../dcs/diff'
import { FORCE_FEEDBACK_KEYS, forceFeedbackFor } from '../dcs/forceFeedback'
import { luaFile } from '../dcs/lua'
import { KINDS, type AxisFilter, type Bindings, type Combo, type Command, type DeviceDiff, type Modifier, type Modifiers, type Profile } from '../dcs/types'
import { tr, trUi } from '../i18n/i18n'
import { offChanged } from './folder'
import { deviceLabel, entryProfile, entryTemplate, isOff, uiPath, uiProfile, userDiffPath } from './lookup'
import { setupOf, type SessionState } from './session'
import type { Entry } from './types'

export interface Change {
  sign: '+' | '-'
  name: string
  text: string
}

const t = (key: string, vars?: Record<string, unknown>) => i18n.t(key, vars)
export const percent = (v: number) => Math.round(v * 10000) / 100

function namedAs(original: DeviceDiff, translate: (text: string) => string) {
  const names = namesOf(original)
  return (c: Command) => names[c.hash] ?? (translate(c.name) || c.name)
}

const differ = (a: Modifiers, b: Modifiers) => [...new Set([...Object.keys(a), ...Object.keys(b)])].some((n) => JSON.stringify(a[n]) !== JSON.stringify(b[n]))

export function exportFiles(s: SessionState) {
  const files: [string, string][] = []
  const skipped: Entry[] = []
  const setup = setupOf(s)
  for (const entry of setup.entries) {
    if (!entry.wanted) continue
    if (!entry.dcsId.includes('{')) { skipped.push(entry); continue }
    const runtime = s.runtime[entry.uid]
    const original = runtime?.original ?? {}
    const uiOriginal = runtime?.uiOriginal ?? {}
    files.push([userDiffPath(s, entry), luaFile('diff', buildDiff(entryProfile(s, entry), entry.wanted, entry.extra, namedAs(original, tr), original))])
    if (entry.uiChanged) files.push([uiPath(entry), luaFile('diff', buildDiff(uiProfile(s, entry), entry.uiWanted!, entry.uiExtra, namedAs(uiOriginal, trUi), uiOriginal))])
  }
  const { modifiers, modifiersBase } = setup
  if (modifiers && (differ(modifiers, modifiersBase ?? {}) || differ(modifiers, KEYBOARD_MODIFIERS))) files.push([`${s.catalog!.folder}/modifiers.lua`, luaFile('modifiers', modifiers)])
  if (offChanged(s)) {
    files.push(['disabled.lua', luaFile('disabled', { pnp: false, ...s.scan.disabledFile, devices: Object.fromEntries(s.off.map((d) => [d, true])) })])
  }
  return { files, skipped }
}

export function fileDiff(before: string | null, after: string) {
  const { hunks } = structuredPatch('', '', (before ?? '').replace(/\r\n/g, '\n'), after, '', '', { context: 3 })
  const lines = hunks.flatMap((h) => h.lines)
  return { hunks, added: lines.filter((l) => l[0] === '+').length, removed: lines.filter((l) => l[0] === '-').length }
}

export function filterText(filter?: Partial<AxisFilter>) {
  const f = filterWithDefaults(filter)
  const parts: string[] = []
  if (f.deadzone) parts.push(`${t('tune.deadzone')} ${percent(f.deadzone)}`)
  if (f.saturationX !== 1) parts.push(`${t('tune.saturationX')} ${percent(f.saturationX)}`)
  if (f.saturationY !== 1) parts.push(`${t('tune.saturationY')} ${percent(f.saturationY)}`)
  if (f.curvature.length >= 4) parts.push(t('tune.userCurve'))
  else if (f.curvature[0]) parts.push(`${t('tune.curvature')} ${percent(f.curvature[0])}`)
  if (f.slider) parts.push(t('tune.slider'))
  if (f.invert) parts.push(t('tune.invert'))
  return parts.join(', ')
}

export function comboChanges(profile: Profile, before: Bindings, after: Bindings, translate: (text: string) => string): Change[] {
  const lines: Change[] = []
  const id = (c: Combo) => `${comboId(c)}|${isDefaultFilter(c.filter) ? '' : JSON.stringify(filterWithDefaults(c.filter))}`
  const text = (c: Combo) => comboText(c) + (isDefaultFilter(c.filter) ? '' : ` (${filterText(c.filter)})`)
  for (const kind of [...KINDS].reverse()) {
    const names = Object.fromEntries(profile.commands[kind].map((c) => [c.hash, c.name]))
    for (const hash of new Set([...Object.keys(before[kind]), ...Object.keys(after[kind])])) {
      const was = new Set((before[kind][hash] ?? []).map(id))
      const now = new Set((after[kind][hash] ?? []).map(id))
      const name = translate(names[hash] ?? hash)
      for (const c of before[kind][hash] ?? []) if (!now.has(id(c))) lines.push({ sign: '-', name, text: text(c) })
      for (const c of after[kind][hash] ?? []) if (!was.has(id(c))) lines.push({ sign: '+', name, text: text(c) })
    }
  }
  return lines.sort((a, b) => dcsCompare(a.name, b.name))
}

export function ffChanges(s: SessionState, entry: Entry): Change[] {
  const defaults = forceFeedbackFor(s.catalog!, entryTemplate(s, entry))
  if (!defaults) return []
  const before = { ...defaults, ...s.runtime[entry.uid]?.installedFf }
  const after = { ...defaults, ...entry.extra.ffDiffs }
  const show = (v: number | boolean) => (typeof v === 'boolean' ? t(v ? 'export.on' : 'export.off') : String(percent(v)))
  return FORCE_FEEDBACK_KEYS.filter((k) => before[k] !== after[k])
    .map((k) => ({ sign: '+', name: t('export.ff'), text: t('export.was', { what: `${t(`ff.${k}`)} ${show(after[k])}`, was: show(before[k]) }) }))
}

export function modifierChanges(s: SessionState): Change[] {
  const setup = setupOf(s)
  const before = setup.modifiersBase ?? {}
  const after = setup.modifiers ?? {}
  const text = (m: Modifier) => `${deviceLabel(s, m.device)} · ${inputLabel(m.key)} · ${t(m.switch ? 'export.switch' : 'export.hold')}`
  const lines: Change[] = []
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (JSON.stringify(before[name]) === JSON.stringify(after[name])) continue
    if (before[name]) lines.push({ sign: '-', name, text: text(before[name]) })
    if (after[name]) lines.push({ sign: '+', name, text: text(after[name]) })
  }
  return lines
}

export const offChanges = (s: SessionState): Change[] => [
  ...s.scan.disabled.filter((d) => !isOff(s, d)).map((d): Change => ({ sign: '+', name: d, text: t('export.turnedOn') })),
  ...s.off.filter((d) => !s.scan.disabled.some((w) => sameId(w, d))).map((d): Change => ({ sign: '-', name: d, text: t('export.turnedOff') })),
]

export function download(name: string, blob: Blob) {
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

export function downloadZip(s: SessionState) {
  const files = Object.fromEntries(exportFiles(s).files.map(([path, text]) => [`Config/Input/${path}`, strToU8(text)]))
  download(`${s.catalog!.folder}-controls.zip`, new Blob([zipSync(files)], { type: 'application/zip' }))
}

export function downloadPreset(s: SessionState, entry: Entry) {
  const text = luaFile('diff', buildDiff(entryProfile(s, entry), entry.wanted!))
  download(`${entryTemplate(s, entry)}.diff.lua`, new Blob([text], { type: 'text/plain' }))
}
