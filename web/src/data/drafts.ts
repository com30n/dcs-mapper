import type { Device, DeviceIndexEntry } from './types'

const KEY = 'hotas-mapper-device-drafts'

export function readDrafts(): Record<string, Device> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Device> } catch { return {} }
}

export function writeDraft(device: Device) {
  localStorage.setItem(KEY, JSON.stringify({ ...readDrafts(), [device.id]: device }))
}

export function dropDraft(id: string) {
  const drafts = readDrafts()
  delete drafts[id]
  try { localStorage.setItem(KEY, JSON.stringify(drafts)) } catch { return }
}

export const indexEntry = (d: Device): DeviceIndexEntry => ({
  id: d.id, vendor: d.id.split('/')[0], name: d.name, role: d.role, dcsName: d.dcsName, card: d.card, pictures: d.pictures,
})

export function withDrafts(index: DeviceIndexEntry[]) {
  const drafts = readDrafts()
  const listed = index.map((entry) => (drafts[entry.id] ? indexEntry(drafts[entry.id]) : entry))
  const added = Object.values(drafts).filter((d) => !index.some((entry) => entry.id === d.id)).map(indexEntry)
  return [...listed, ...added]
}
