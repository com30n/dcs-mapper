export interface CalloutItem {
  id: string
  x: number
  y: number
  height: number
}

export interface PlacedCallout extends CalloutItem {
  side: 'left' | 'right'
  left: number
  top: number
  anchorX: number
  anchorY: number
}

interface Box {
  width: number
  height: number
  column: number
  inset?: number
  gap?: number
}

export function layoutCallouts(items: CalloutItem[], { width, height, column, inset = 4, gap = 8 }: Box) {
  const sides = { left: [] as CalloutItem[], right: [] as CalloutItem[] }
  for (const item of items) sides[item.x < width / 2 ? 'left' : 'right'].push(item)
  const needed = Math.max(...Object.values(sides).map((list) => list.reduce((sum, it) => sum + it.height + gap, 0)))
  const boxHeight = Math.max(height, needed)
  const placed: PlacedCallout[] = []
  for (const side of ['left', 'right'] as const) {
    const list = [...sides[side]].sort((a, b) => a.y - b.y)
    const tops: number[] = []
    let next = 0
    for (const it of list) {
      tops.push(Math.max(it.y - it.height / 2, next))
      next = tops.at(-1)! + it.height + gap
    }
    let limit = boxHeight
    for (let i = list.length - 1; i >= 0; i--) {
      tops[i] = Math.min(tops[i], limit - list[i].height)
      limit = tops[i] - gap
    }
    const left = side === 'left' ? inset : width - inset - column
    list.forEach((it, i) => placed.push({
      ...it, side, left, top: tops[i],
      anchorX: side === 'left' ? left + column : left,
      anchorY: tops[i] + it.height / 2,
    }))
  }
  return { placed, height: boxHeight }
}

export function leader(from: { x: number; y: number }, to: { x: number; y: number }, stopShort: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  const keep = length > stopShort ? (length - stopShort) / length : 0
  return { x1: from.x, y1: from.y, x2: from.x + dx * keep, y2: from.y + dy * keep }
}

let measurer: CanvasRenderingContext2D | null = null

export function wrapText(text: string, font: string, width: number) {
  measurer ??= document.createElement('canvas').getContext('2d')
  const ctx = measurer!
  ctx.font = font
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}
