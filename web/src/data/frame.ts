import type { Crop, Device, Frame, Layer } from './types'

export const MARK_SCALE = 1141

export const round = (v: number) => Math.round(v * 1000) / 1000
export const pct = (v: number) => `${round(v)}%`

export interface PlacedLayer {
  picture: string
  c: Required<Crop>
  ax: number
  ay: number
  aw: number
  ah: number
}

const cropOf = (l: Crop): Required<Crop> => ({ x: l.x ?? 0, y: l.y ?? 0, w: l.w ?? 100, h: l.h ?? 100 })

export function frameLayout(device: Pick<Device, 'pictures'>, frame: Frame) {
  const layers: Layer[] = frame.layers ?? [frame]
  const [width, height] = frame.layers
    ? frame.size
    : [device.pictures[frame.picture].size[0] * cropOf(frame).w / 100, device.pictures[frame.picture].size[1] * cropOf(frame).h / 100]
  const placed: PlacedLayer[] = layers.map((layer) => {
    const c = cropOf(layer)
    const [pw, ph] = device.pictures[layer.picture].size
    const [ax, ay, aw] = layer.at ?? [0, 0, 100]
    return { picture: layer.picture, c, ax, ay, aw, ah: aw * (width / height) * (ph * c.h) / (pw * c.w) }
  })
  const marks = placed.flatMap((p) => (device.pictures[p.picture].marks ?? []).map((m) => ({
    input: m.input, x: p.ax + (m.x - p.c.x) / p.c.w * p.aw, y: p.ay + (m.y - p.c.y) / p.c.h * p.ah,
  }))).filter((m) => m.x >= 0 && m.x <= 100 && m.y >= 0 && m.y <= 100)
  return { width, height, placed, marks }
}

const VIEW_GAP = 0.06

export function allViews(device: Pick<Device, 'pictures' | 'views'>): Frame {
  if (device.views.length === 1) return device.views[0]
  const layouts = device.views.map((view) => frameLayout(device, view))
  const height = Math.max(...layouts.map((l) => l.height))
  const widths = layouts.map((l) => l.width * height / l.height)
  const gap = height * VIEW_GAP
  const width = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1)
  let left = 0
  const layers = layouts.flatMap((l, i) => {
    const offset = left
    left += widths[i] + gap
    return l.placed.map((p) => ({ picture: p.picture, ...p.c, at: [(offset + p.ax / 100 * widths[i]) / width * 100, p.ay, p.aw / 100 * widths[i] / width * 100] as [number, number, number] }))
  })
  return { size: [width, height], layers }
}
