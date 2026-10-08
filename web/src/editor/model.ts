import { AXES, POV } from '../dcs/combos'
import type { Crop, Device, Frame, Mark, View } from '../data/types'

export const ALL_INPUTS = [
  ...Array.from({ length: 128 }, (_, i) => `JOY_BTN${i + 1}`),
  ...POV.map((d) => `JOY_BTN_POV1_${d}`),
  ...AXES,
]

function rank(input: string) {
  const button = /^JOY_BTN(\d+)$/.exec(input)
  if (button) return Number(button[1])
  const pov = /^JOY_BTN_POV(\d)_(\w+)$/.exec(input)
  if (pov) return 1000 + Number(pov[1]) * 10 + POV.indexOf(pov[2])
  return AXES.includes(input) ? 2000 + AXES.indexOf(input) : 3000
}

export const sortInputs = (inputs: Iterable<string>) => [...new Set(inputs)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

export function padInputs(buttons: number, hat: boolean, axes: number) {
  return [
    ...Array.from({ length: Math.min(buttons, 128) }, (_, i) => `JOY_BTN${i + 1}`),
    ...(hat ? POV.map((d) => `JOY_BTN_POV1_${d}`) : []),
    ...AXES.slice(0, axes),
  ]
}

export const dcsNameOf = (padId: string) => padId.replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '').replace(/\s*\(.*\)\s*$/, '').trim()

const round = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 100) / 100

export const marksOf = (device: Device, picture: string): Mark[] => device.pictures[picture]?.marks ?? []

export function placeMark(device: Device, picture: string, input: string, x: number, y: number): Device {
  const marks = marksOf(device, picture).filter((m) => m.input !== input)
  return { ...device, pictures: { ...device.pictures, [picture]: { ...device.pictures[picture], marks: [...marks, { input, x: round(x), y: round(y) }] } } }
}

export function removeMark(device: Device, picture: string, input: string): Device {
  return { ...device, pictures: { ...device.pictures, [picture]: { ...device.pictures[picture], marks: marksOf(device, picture).filter((m) => m.input !== input) } } }
}

const MARGIN = 4
const two = (v: number) => Math.round(v * 100) / 100

export function markExtent(marks: Mark[]): Required<Crop> {
  const x = Math.min(0, ...marks.map((m) => m.x - MARGIN))
  const y = Math.min(0, ...marks.map((m) => m.y - MARGIN))
  const right = Math.max(100, ...marks.map((m) => m.x + MARGIN))
  const bottom = Math.max(100, ...marks.map((m) => m.y + MARGIN))
  return { x: two(x), y: two(y), w: two(right - x), h: two(bottom - y) }
}

export const nextOpen = (order: string[], placed: Set<string>) => order.find((input) => !placed.has(input)) ?? null

export const cropOf = (frame: Frame | null): Required<Crop> | null =>
  frame && !frame.layers ? { x: frame.x ?? 0, y: frame.y ?? 0, w: frame.w ?? 100, h: frame.h ?? 100 } : null

export function fitCrop({ x, y, w, h }: Required<Crop>): Required<Crop> {
  const width = Math.min(100, Math.max(2, w))
  const height = Math.min(100, Math.max(2, h))
  return { x: round(Math.min(x, 100 - width)), y: round(Math.min(y, 100 - height)), w: round(width), h: round(height) }
}

export function withCrop<T extends Frame>(frame: T, crop: Required<Crop>): T {
  const { x, y, w, h } = fitCrop(crop)
  const whole = x === 0 && y === 0 && w === 100 && h === 100
  const { x: _x, y: _y, w: _w, h: _h, ...rest } = frame as T & Crop
  return (whole ? rest : { ...rest, x, y, w, h }) as T
}

export const folderName = (text: string) => text.replace(/[^\w .+()&-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 64)

export function deviceId(maker: string, name: string) {
  const vendor = folderName(maker) || 'Other'
  const prefix = new RegExp(`^${vendor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i')
  return `${vendor}/${folderName(name.replace(prefix, '')) || 'Device'}`
}

const WRITTEN = new Set(['id', 'generic', 'name', 'role', 'dcsName', 'axes', 'preset', 'pictures', 'card', 'views'])

export function deviceJson(device: Device): string {
  const pictures = Object.fromEntries(Object.entries(device.pictures).map(([name, p]) => {
    const marks = sortMarks(p.marks ?? [])
    return [name, marks.length ? { size: p.size, marks } : { size: p.size }]
  }))
  const views = device.views.map((v: View) => ({ ...v }))
  const out = {
    name: device.name, role: device.role, dcsName: device.dcsName,
    ...(device.axes?.length ? { axes: device.axes } : {}),
    ...(device.preset !== undefined ? { preset: device.preset } : {}),
    pictures, card: device.card, views,
    ...Object.fromEntries(Object.entries(device).filter(([key]) => !WRITTEN.has(key))),
  }
  return `${JSON.stringify(out, null, 1)}\n`
}

const sortMarks = (marks: Mark[]) => [...marks].sort((a, b) => rank(a.input) - rank(b.input))

export function changeCount(before: Device | null, after: Device | null) {
  if (!before || !after) return 0
  let count = 0
  for (const name of new Set([...Object.keys(before.pictures), ...Object.keys(after.pictures)])) {
    const was = new Map(marksOf(before, name).map((m) => [m.input, `${m.x},${m.y}`]))
    const now = new Map(marksOf(after, name).map((m) => [m.input, `${m.x},${m.y}`]))
    for (const input of new Set([...was.keys(), ...now.keys()])) if (was.get(input) !== now.get(input)) count++
    if (!before.pictures[name] || !after.pictures[name]) count++
  }
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  if (!same(before.card, after.card)) count++
  if (!same(before.views, after.views)) count++
  for (const key of ['name', 'role', 'dcsName'] as const) if (before[key] !== after[key]) count++
  return count
}

export function emptyDevice(): Device {
  return { id: '', name: '', role: 'stick', dcsName: '', pictures: {}, card: null, views: [] }
}

export function addPicture(device: Device, name: string, size: [number, number], src: string): Device {
  const pictures = { ...device.pictures, [name]: { size, src } }
  return {
    ...device, pictures,
    card: device.card ?? { picture: name },
    views: device.views.length ? device.views : [{ name: 'Main', picture: name }],
  }
}
