import type { Catalog } from '../dcs/types'
import { readDrafts, withDrafts } from './drafts'
import type { AircraftIndexEntry, Device, DeviceIndexEntry, LanguageEntry } from './types'

const root = typeof document === 'undefined' ? null : document.querySelector<HTMLMetaElement>('meta[name="data-root"]')
export const DATA = import.meta.env.DEV ? '/' : (root?.content ?? './')

export const devicePath = (id: string) => `${DATA}devices/${id.split('/').map(encodeURIComponent).join('/')}`

export const pictureUrl = (device: Pick<Device, 'id' | 'pictures'>, name: string) =>
  device.pictures[name]?.src ?? `${devicePath(device.id)}/${encodeURIComponent(name)}`

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`${path}: ${response.status}`)
  return response.json() as Promise<T>
}

const optional = <T>(path: string, fallback: T) => fetchJson<T>(path).catch(() => fallback)

export const loadAircraftIndex = () => fetchJson<AircraftIndexEntry[]>(`${DATA}aircraft/index.json`)
export const loadCatalog = (folder: string) => fetchJson<Catalog>(`${DATA}aircraft/${encodeURIComponent(folder)}/aircraft.json`)
export const loadWords = (folder: string, lang: string) => optional<Record<string, string>>(`${DATA}aircraft/${encodeURIComponent(folder)}/l10n/${lang}.json`, {})
export const loadDeviceIndex = () => fetchJson<DeviceIndexEntry[]>(`${DATA}devices/index.json`).then(withDrafts)
export const loadDevice = (id: string): Promise<Device> => {
  const draft = readDrafts()[id]
  return draft ? Promise.resolve(draft) : fetchJson<Omit<Device, 'id'>>(`${devicePath(id)}/device.json`).then((device): Device => ({ ...device, id }))
}
export const loadLanguages = () => fetchJson<LanguageEntry[]>(`${DATA}locales/index.json`)
export const loadMessages = (code: string) => fetchJson<Record<string, string>>(`${DATA}locales/${code}.json`)

export function genericDevice(template: string): Device {
  const id = `dcs-${template.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  return { id, name: template, role: 'other', dcsName: template, pictures: {}, card: null, views: [], axes: [], generic: true }
}
