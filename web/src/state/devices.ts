import i18n from 'i18next'
import { sameId, templateOf } from '../dcs/combos'
import { parseLua } from '../dcs/lua'
import type { DeviceDiff } from '../dcs/types'
import { genericDevice, loadDevice } from '../data/load'
import type { Device } from '../data/types'
import { remember } from './history'
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
  const chosen = name.includes('{') ? get().pictures[name.toLowerCase()] : undefined
  if (chosen !== undefined) return chosen ? loadDevice(chosen).catch(() => genericDevice(templateOf(name))) : genericDevice(templateOf(name))
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
  const linked = s.links[dcsId.toLowerCase()]
  return {
    uid: crypto.randomUUID(), deviceId: device.id, generic: device.generic ? device.dcsName : null, dcsId, start, pictureChosen: dcsId.includes('{') && s.pictures[dcsId.toLowerCase()] === (device.generic ? '' : device.id),
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
  remember()
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
  let noted = false
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
    if (!noted) remember()
    noted = true
    pushEntry(newEntry(get(), device, id, 'file', { name: file.name, text }))
  }
}

export async function loadFromFolder() {
  const { folder, catalog, scan, aircraftId } = get()
  if (!folder || !catalog || !aircraftId) return
  const present = (id: string) => (get().byAircraft[aircraftId]?.entries ?? []).some((e) => sameId(e.dcsId, id))
  let added = 0
  for (const name of scan.bindings[catalog.folder] ?? []) {
    const id = canonicalId(get(), name)
    if (isOff(get(), id) || present(id)) continue
    const entry = newEntry(get(), await deviceFor(id), id, 'current')
    if (get().folder !== folder) return
    if (present(id)) continue
    useSession.setState((d) => { draftSetup(d, aircraftId).entries.push(entry) })
    added++
  }
  if (added) useSession.setState({ message: i18n.t('load.loaded', { count: added, aircraft: i18n.t(catalog.name, { ns: 'aircraft', defaultValue: catalog.name }) }) })
}

export async function reloadFromFolder() {
  useSession.setState((d) => {
    d.byAircraft = {}
    d.active = 0
  })
  await loadFromFolder()
}

const updateEntry = (uid: string, change: (entry: Entry) => void) =>
  useSession.setState((s) => { const entry = draftSetup(s).entries.find((e) => e.uid === uid); if (entry) change(entry) })

export function removeDevice(uid: string) {
  remember()
  useSession.setState((s) => {
    const setup = draftSetup(s)
    setup.entries = setup.entries.filter((e) => e.uid !== uid)
    s.active = 0
  })
}

export function setStart(uid: string, start: Start) {
  remember()
  updateEntry(uid, (e) => { e.start = start })
}

export function setDcsId(uid: string, dcsId: string) {
  remember()
  updateEntry(uid, (e) => { e.dcsId = dcsId.trim() })
  const entry = setupOf(get()).entries.find((e) => e.uid === uid)
  const device = entry && get().devices[entry.deviceId]
  if (!entry?.pictureChosen || !device) return
  if (sameId(templateOf(entry.dcsId), device.dcsName)) choose(uid, entry.dcsId, device)
  else if (entry.dcsId) updateEntry(uid, (e) => { e.pictureChosen = false })
}
export const setPresetFile = async (uid: string, file: File) => {
  const text = await file.text()
  remember()
  updateEntry(uid, (e) => { e.fileText = text; e.fileName = file.name; e.start = 'file' })
}
export function linkPad(uid: string, padId: string, padIndex: number) {
  remember()
  useSession.setState((s) => {
    const dcsId = draftSetup(s).entries.find((e) => e.uid === uid)?.dcsId ?? ''
    for (const e of allEntries(s).filter((e) => e.uid === uid || sameDevice(e.dcsId, dcsId))) Object.assign(e, { padId, padIndex })
    if (dcsId.includes('{')) s.links[dcsId.toLowerCase()] = { padId, padIndex }
  })
}

export async function changePicture(uid: string, deviceId: string) {
  const s = get()
  const entry = setupOf(s).entries.find((e) => e.uid === uid)!
  const device = deviceId ? await loadDevice(deviceId) : genericDevice(templateOf(entry.dcsId || s.devices[entry.deviceId]?.dcsName || ''))
  remember()
  choose(uid, entry.dcsId, device)
}

function choose(uid: string, dcsId: string, device: Device) {
  useSession.setState((d) => {
    d.devices[device.id] = device
    if (dcsId.includes('{')) d.pictures[dcsId.toLowerCase()] = device.generic ? '' : device.id
    for (const e of allEntries(d).filter((e) => e.uid === uid || sameDevice(e.dcsId, dcsId))) {
      Object.assign(e, { deviceId: device.id, generic: device.generic ? device.dcsName : null, pictureChosen: true })
      if (e.uid !== uid) continue
      e.ready = null
      if (e.start === 'preset' && !presetFor(d, e)) e.start = 'empty'
    }
  })
}

export function turnOff(uid: string) {
  remember()
  useSession.setState((s) => {
    const setup = draftSetup(s)
    const entry = setup.entries.find((e) => e.uid === uid)!
    s.off.push(entry.dcsId)
    setup.entries = setup.entries.filter((e) => e.uid !== uid)
    s.active = 0
  })
}

export async function turnOn(name: string) {
  remember()
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
