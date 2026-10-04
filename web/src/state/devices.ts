import i18n from 'i18next'
import { sameId, templateOf } from '../dcs/combos'
import { currentFrom, profileFor } from '../dcs/diff'
import { parseLua } from '../dcs/lua'
import type { DeviceDiff } from '../dcs/types'
import { genericDevice, loadDevice } from '../data/load'
import type { Device } from '../data/types'
import { candidatesFor, canonicalId, configFile, isOff, matchingIds, presetFor } from './lookup'
import { draftSetup, setupOf, useSession, type SessionState } from './session'
import type { Entry, Start } from './types'

const get = () => useSession.getState()

export async function deviceFor(name: string, role: string | null): Promise<Device> {
  const candidates = candidatesFor(get(), name)
  const pick = candidates.find((d) => d.role === role) ?? candidates[0]
  const device = pick ? await loadDevice(pick.id) : genericDevice(templateOf(name))
  useSession.setState((s) => { s.devices[device.id] = device })
  return device
}

export function newEntry(s: SessionState, device: Device, dcsId: string, start: Start, file?: { name: string; text: string }): Entry {
  const linked = Object.values(s.byAircraft).flatMap((a) => a.entries).find((e) => e.padId && sameId(e.dcsId, dcsId))
  return {
    uid: crypto.randomUUID(), deviceId: device.id, generic: device.generic ? device.dcsName : null, dcsId, start,
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

const AXIS_ROLES: Record<string, string> = {
  pitch: 'stick', roll: 'stick',
  thrust: 'throttle', thrust_left: 'throttle', thrust_right: 'throttle',
  rudder: 'pedals', left_wheel_brake: 'pedals', right_wheel_brake: 'pedals', wheel_brake: 'pedals',
}

export function roleOf(diff: DeviceDiff, name: string) {
  const profile = profileFor(get().catalog!, templateOf(name))
  const bound = currentFrom(profile, diff).axis
  const roles = new Set(profile.commands.axis.filter((c) => bound[c.hash]?.length).map((c) => AXIS_ROLES[c.assignment ?? '']))
  return ['stick', 'throttle', 'pedals'].find((role) => roles.has(role)) ?? null
}

export const configRole = (name: string) => installedDiff(name).then((diff) => roleOf(diff, name)).catch(() => null)

export async function bestId(device: Device) {
  const s = get()
  const free = matchingIds(s, device).filter((id) => !setupOf(s).entries.some((e) => sameId(e.dcsId, id)))
  for (const id of free) if (await configRole(id) === device.role) return id
  return free[0] ?? ''
}

const pushEntry = (entry: Entry) => useSession.setState((s) => { draftSetup(s).entries.push(entry) })

export async function addDevice(id: string) {
  const device = await loadDevice(id)
  useSession.setState((s) => { s.devices[id] = device })
  const s = get()
  const entry = newEntry(s, device, await bestId(device), 'empty')
  entry.start = configFile(s, entry.dcsId) ? 'current' : presetFor({ ...s, devices: { ...s.devices, [id]: device } }, entry) ? 'preset' : 'empty'
  pushEntry(entry)
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
    const device = await deviceFor(name, s.catalog ? roleOf(diff, name) : null)
    pushEntry(newEntry(get(), device, id, 'file', { name: file.name, text }))
  }
}

export async function loadFromFolder() {
  const s = get()
  if (!s.folder || !s.catalog) return
  const names = s.scan.bindings[s.catalog.folder] ?? []
  useSession.setState((d) => {
    for (const entry of draftSetup(d).entries) if (!entry.wanted && configFile(d, entry.dcsId)) entry.start = 'current'
  })
  let added = 0
  for (const name of names) {
    const now = get()
    const id = canonicalId(now, name)
    if (isOff(now, id) || setupOf(now).entries.some((e) => sameId(e.dcsId, id))) continue
    const device = await deviceFor(id, await configRole(id))
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

export const setStart = (uid: string, start: Start) => updateEntry(uid, (e) => { e.start = start })
export const setDcsId = (uid: string, dcsId: string) => updateEntry(uid, (e) => { e.dcsId = dcsId.trim() })
export const setPresetFile = async (uid: string, file: File) => {
  const text = await file.text()
  updateEntry(uid, (e) => { e.fileText = text; e.fileName = file.name; e.start = 'file' })
}
export const linkPad = (uid: string, padId: string, padIndex: number) => updateEntry(uid, (e) => { e.padId = padId; e.padIndex = padIndex })

export async function changePicture(uid: string, deviceId: string) {
  const s = get()
  const entry = setupOf(s).entries.find((e) => e.uid === uid)!
  const device = deviceId ? await loadDevice(deviceId) : genericDevice(templateOf(entry.dcsId || s.devices[entry.deviceId]?.dcsName || ''))
  useSession.setState((d) => { d.devices[device.id] = device })
  updateEntry(uid, (e) => {
    e.deviceId = device.id
    e.generic = device.generic ? device.dcsName : null
    e.ready = null
    if (e.start === 'preset' && !presetFor(get(), { ...e, deviceId: device.id })) e.start = 'empty'
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
  const device = await deviceFor(name, await configRole(name))
  pushEntry(newEntry(get(), device, name, configFile(get(), name) ? 'current' : 'empty'))
}

export async function ensureDevices() {
  const s = get()
  const missing = Object.values(s.byAircraft).flatMap((a) => a.entries).filter((e) => !s.devices[e.deviceId])
  for (const entry of missing) {
    const device = entry.generic ? genericDevice(entry.generic) : await loadDevice(entry.deviceId).catch(() => genericDevice(templateOf(entry.dcsId)))
    useSession.setState((d) => { d.devices[entry.deviceId] = { ...device, id: entry.deviceId } })
  }
}
