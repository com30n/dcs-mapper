export interface Zoom {
  scale: number
  x: number
  y: number
}

export const ZOOM_MAX = 5
export const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 }

interface Box {
  width: number
  height: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function fit(z: Zoom, box: Box): Zoom {
  const x = clamp(z.x, box.width * (1 - z.scale), 0)
  const y = clamp(z.y, box.height * (1 - z.scale), 0)
  return { scale: z.scale, x: x + 0, y: y + 0 }
}

export function zoomAt(z: Zoom, box: Box, px: number, py: number, factor: number): Zoom {
  const scale = clamp(z.scale * factor, 1, ZOOM_MAX)
  const k = scale / z.scale
  return fit({ scale, x: px - (px - z.x) * k, y: py - (py - z.y) * k }, box)
}

export const panBy = (z: Zoom, box: Box, dx: number, dy: number): Zoom => fit({ ...z, x: z.x + dx, y: z.y + dy }, box)
