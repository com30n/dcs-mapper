import i18n from 'i18next'
import { sameId, templateOf } from '../dcs/combos'
import { parseLua } from '../dcs/lua'
import type { DeviceDiff } from '../dcs/types'
import { genericDevice, loadDevice } from '../data/load'
import type { Device } from '../data/types'
import { candidatesFor, canonicalId, configFile, isOff, matchingIds, presetFor } from './lookup'
import { draftSetup, setupOf, useSession, type SessionState } from './session'
import type { Entry, Start } from './types'

const get = () => useSession.getState()

const usedIn = (diff: DeviceDiff) =>
  [diff.keyDiffs, diff.axisDiffs].flatMap((section) => Object.values(section ?? {})).flatMap((d) => [...(d.added ?? []), ...(d.changed ?? [])]).map((c) => c.key)

function fits(device: Device | null, used: string[]): device is Device {
  const inputs = new Set(Object.values(device?.pictures ?? {}).flatMap((p) => (p.marks ?? []).map((m) => m.input)))
  return !!device && used.every((key) => inputs.has(key))
}

async function usedFor(name: string, diff: DeviceDiff) {
  const { folder, scan } = get()
  const paths = Object.entries(scan.bindings).flatMap(([aircraft, names]) => names.filter((n) => sameId(n, name)).map((n) => `${aircraft}/joystick/${n}.diff.lua`))
  const texts = folder ? await Promise.all(paths.map((path) => folder.read(path))) : []
  const diffs = texts.flatMap((text) => { try { return text ? [parseLua(text) as DeviceDiff] : [] } catch { return [] } })
  return [diff, ...diffs].flatMap(usedIn)
}

const entryDevice = (entry: Entry) =>
  entry.generic ? Promise.resolve(genericDevice(entry.generic)) : loadDevice(entry.deviceId).catch(() => genericDevice(templateOf(entry.dcsId)))

const allEntries = (s: SessionState) => Object.values(s.byAircraft).flatMap((a) => a.entries)

const sameDevice = (a: string, b: string) => a.includes('{') && sameId(a, b)

async function knownDevice(name: string, diff: DeviceDiff = {}) {
  const chosen = allEntries(get()).find((e) => e.pictureChosen && sameDevice(e.dcsId, name))
  if (chosen) return entryDevice(chosen)
  const candidates = candidatesFor(get(), name)
  if (!candidates.length) return null
  const used = await usedFor(name, diff)
  const fitting = (await Promise.all(candidates.map((d) => loadDevice(d.id).catch(() => null)))).filter((d) => fits(d, used))
  return fitting.length === 1 ? fitting[0] : null
}

export async function deviceFor(name: string, diff: DeviceDiff = {}): Promise<Device> {
  const device = (await knownDevice(name, diff)) ?? genericDevice(templateOf(name))
  useSession.setState((s) => { s.devices[device.id] = device })
  return device
}

export function newEntry(s: SessionState, device: Device, dcsId: string, start: Start, file?: { name: string; text: string }): Entry {
  const linked = allEntries(s).find((e) => e.padId && sameId(e.dcsId, dcsId))
  const chosen = allEntries(s).find((e) => e.pictureChosen && sameDevice(e.dcsId, dcsId))
  return {
    uid: crypto.randomUUID(), deviceId: device.id, generic: device.generic ? device.dcsName : null, dcsId, start, startChosen: false, pictureChosen: chosen?.deviceId === device.id,
    fileText: file?.text ?? null, fileName: file?.name ?? null, ready: null, wanted: null, extra: {}, dead: [],
    padId: linked?.padId ?? null, padIndex: linked?.padIndex ?? null, uiWanted: null, uiExtra: {}, uiChanged: false,
  }
}

export async function installedText(name: string) {
  const s = get()
  const file = configFile(s, name)
  return file && s.folder ? s.folder.read(`${s.catalog!.folder}/joystick/${file}.diff.lua`) : null
}

export async function installedDiff(name: string): Promise<DeviceDiff> {
  const text = await installedText(name)
  return text ? (parseLua(text) as DeviceDiff) : {}
}

const blank = (entry: Entry) => entry.start !== 'file' && !entry.startChosen && (!entry.wanted ||
  (entry.start === 'empty' && ![entry.wanted.key, entry.wanted.axis, entry.extra].some((table) => Object.keys(table).length)))

export async function bestId(device: Device) {
  const s = get()
  const free = matchingIds(s, device).filter((id) => !setupOf(s).entries.some((e) => sameId(e.dcsId, id)))
  const told = await Promise.all(free.map(async (id) => (await knownDevice(id))?.id))
  const mine = free.filter((_, i) => told[i] === device.id)
  const open = free.filter((_, i) => !told[i] || told[i] === device.id)
  return mine.length === 1 ? mine[0] : open.length === 1 ? open[0] : ''
}

const pushEntry = (entry: Entry) => useSession.setState((s) => { draftSetup(s).entries.push(entry) })

export async function addDevice(id: string) {
  const device = await loadDevice(id)
  useSession.setState((s) => { s.devices[id] = device })
  const s = get()
  const entry = newEntry(s, device, await bestId(device), 'empty')
  entry.start = configFile(s, entry.dcsId) ? 'current' : presetFor({ ...s, devices: { ...s.devices, [id]: device } }, entry) ? 'preset' : 'empty'
  pushEntry(entry)
  choose(entry.uid, entry.dcsId, device)
}

const adding = new Set<string>()

export async function toggleDevice(id: string) {
  if (adding.has(id)) return
  const copies = setupOf(get()).entries.filter((e) => e.deviceId === id)
  if (copies.length === 1) return removeDevice(copies[0].uid)
  if (copies.length) return
  adding.add(id)
  try { await addDevice(id) } finally { adding.delete(id) }
}

export async function addFiles(files: File[]) {
  for (const file of files) {
    const name = file.name.replace(/\.diff\.lua$/i, '').replace(/\.lua$/i, '')
    const text = await file.text()
    let diff: DeviceDiff
    try { diff = parseLua(text) as DeviceDiff } catch {
      useSession.setState({ message: i18n.t('load.badFile', { file: file.name }) })
      continue
    }
    const s = get()
    const id = name.includes('{') ? canonicalId(s, name) : ''
    const device = await deviceFor(name, diff)
    pushEntry(newEntry(get(), device, id, 'file', { name: file.name, text }))
  }
}

export async function loadFromFolder() {
  const s = get()
  if (!s.folder || !s.catalog) return
  const names = s.scan.bindings[s.catalog.folder] ?? []
  let added = 0
  useSession.setState((d) => {
    for (const entry of draftSetup(d).entries) if (entry.start !== 'current' && blank(entry) && configFile(d, entry.dcsId)) { entry.start = 'current'; added++ }
  })
  for (const name of names) {
    const now = get()
    const id = canonicalId(now, name)
    if (isOff(now, id) || setupOf(now).entries.some((e) => sameId(e.dcsId, id))) continue
    const device = await deviceFor(id)
    pushEntry(newEntry(get(), device, id, 'current'))
    added++
  }
  if (added) useSession.setState({ message: i18n.t('load.loaded', { count: added, aircraft: i18n.t(s.catalog.name, { ns: 'aircraft', defaultValue: s.catalog.name }) }) })
}

const updateEntry = (uid: string, change: (entry: Entry) => void) =>
  useSession.setState((s) => { const entry = draftSetup(s).entries.find((e) => e.uid === uid); if (entry) change(entry) })

export const removeDevice = (uid: string) => useSession.setState((s) => {
  const setup = draftSetup(s)
  setup.entries = setup.entries.filter((e) => e.uid !== uid)
  s.active = 0
})

export const setStart = (uid: string, start: Start) => updateEntry(uid, (e) => { e.start = start; e.startChosen = true })
export function setDcsId(uid: string, dcsId: string) {
  updateEntry(uid, (e) => { e.dcsId = dcsId.trim() })
  const entry = setupOf(get()).entries.find((e) => e.uid === uid)
  const device = entry && get().devices[entry.deviceId]
  if (!entry?.pictureChosen || !device) return
  if (sameId(templateOf(entry.dcsId), device.dcsName)) choose(uid, entry.dcsId, device)
  else if (entry.dcsId) updateEntry(uid, (e) => { e.pictureChosen = false })
}
export const setPresetFile = async (uid: string, file: File) => {
  const text = await file.text()
  updateEntry(uid, (e) => { e.fileText = text; e.fileName = file.name; e.start = 'file' })
}
export const linkPad = (uid: string, padId: string, padIndex: number) => updateEntry(uid, (e) => { e.padId = padId; e.padIndex = padIndex })

export async function changePicture(uid: string, deviceId: string) {
  const s = get()
  const entry = setupOf(s).entries.find((e) => e.uid === uid)!
  const device = deviceId ? await loadDevice(deviceId) : genericDevice(templateOf(entry.dcsId || s.devices[entry.deviceId]?.dcsName || ''))
  choose(uid, entry.dcsId, device)
}

function choose(uid: string, dcsId: string, device: Device) {
  useSession.setState((d) => {
    d.devices[device.id] = device
    for (const e of allEntries(d).filter((e) => e.uid === uid || sameDevice(e.dcsId, dcsId))) {
      Object.assign(e, { deviceId: device.id, generic: device.generic ? device.dcsName : null, pictureChosen: true })
      if (e.uid !== uid) continue
      e.ready = null
      if (e.start === 'preset' && !presetFor(d, e)) e.start = 'empty'
    }
  })
}

export function turnOff(uid: string) {
  useSession.setState((s) => {
    const setup = draftSetup(s)
    const entry = setup.entries.find((e) => e.uid === uid)!
    s.off.push(entry.dcsId)
    setup.entries = setup.entries.filter((e) => e.uid !== uid)
    s.active = 0
  })
}

export async function turnOn(name: string) {
  useSession.setState((s) => { s.off = s.off.filter((d) => !sameId(d, name)) })
  const s = get()
  if (!name.includes('{') || setupOf(s).entries.some((e) => sameId(e.dcsId, name))) return
  const device = await deviceFor(name)
  pushEntry(newEntry(get(), device, name, configFile(get(), name) ? 'current' : 'empty'))
}

export async function ensureDevices() {
  const s = get()
  const missing = allEntries(s).filter((e) => !s.devices[e.deviceId])
  for (const entry of missing) {
    const device = await entryDevice(entry)
    useSession.setState((d) => { d.devices[entry.deviceId] = { ...device, id: entry.deviceId } })
  }
}
