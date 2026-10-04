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
  spill?: boolean
}

function closestTops(list: CalloutItem[], boxHeight: number, gap: number) {
  const offsets: number[] = []
  const blocks: { from: number; sum: number; mean: number }[] = []
  list.forEach((it, i) => {
    offsets.push(i ? offsets[i - 1] + (list[i - 1].height + it.height) / 2 + gap : 0)
    let block = { from: i, sum: it.y - offsets[i], mean: it.y - offsets[i] }
    while (blocks.length && blocks.at(-1)!.mean >= block.mean) {
      const prev = blocks.pop()!
      block = { from: prev.from, sum: prev.sum + block.sum, mean: (prev.sum + block.sum) / (i - prev.from + 1) }
    }
    blocks.push(block)
  })
  const low = list.length ? list[0].height / 2 : 0
  const high = list.length ? boxHeight - list.at(-1)!.height / 2 - offsets.at(-1)! : 0
  return list.map((it, i) => {
    const center = blocks.findLast((b) => b.from <= i)!.mean
    return Math.min(Math.max(center, low), high) + offsets[i] - it.height / 2
  })
}

const turn = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
  Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))

function crosses(a: PlacedCallout, b: PlacedCallout) {
  const [a1, b1] = [{ x: a.anchorX, y: a.anchorY }, { x: b.anchorX, y: b.anchorY }]
  return turn(a1, a, b1) * turn(a1, a, b) < 0 && turn(b1, b, a1) * turn(b1, b, a) < 0
}

export function layoutCallouts(items: CalloutItem[], { width, height, column, inset = 4, gap = 8, spill = true }: Box) {
  const need = (list: CalloutItem[]) => list.reduce((sum, it) => sum + it.height + gap, 0)
  const own = { left: items.filter((it) => it.x < width / 2), right: items.filter((it) => it.x >= width / 2) }
  const guests = { left: [] as CalloutItem[], right: [] as CalloutItem[] }
  const total = (side: 'left' | 'right') => need(own[side]) + need(guests[side])
  if (spill) {
    for (const [from, to] of [['left', 'right'], ['right', 'left']] as const) {
      for (const it of [...own[from]].sort((a, b) => b.y - a.y)) {
        const size = it.height + gap
        if (total(from) <= height || total(to) + size > total(from) - size) break
        own[from] = own[from].filter((o) => o !== it)
        guests[to] = [...guests[to], it]
      }
    }
  }
  const boxHeight = Math.max(height, total('left'), total('right'))
  const byY = (list: CalloutItem[]) => [...list].sort((a, b) => a.y - b.y)
  const placed = (['left', 'right'] as const).flatMap((side) => {
    const left = side === 'left' ? inset : width - inset - column
    const anchorX = side === 'left' ? left + column : left
    const place = (order: CalloutItem[]) => {
      const tops = closestTops(order, boxHeight, gap)
      const placed = order.map((it, i): PlacedCallout => ({ ...it, side, left, top: tops[i], anchorX, anchorY: tops[i] + it.height / 2 }))
      const length = placed.reduce((sum, p) => sum + Math.hypot(p.x - p.anchorX, p.y - p.anchorY), 0)
      const crossings = placed.reduce((n, p, i) => n + placed.slice(i + 1).filter((q) => crosses(p, q)).length, 0)
      return { order, placed, cost: length + crossings * column }
    }
    let best = place([...byY(own[side]), ...byY(guests[side])])
    for (let improved = true; improved;) {
      improved = false
      for (let i = 1; i < best.order.length; i++) {
        if (i === own[side].length) continue
        const o = best.order
        const tried = place([...o.slice(0, i - 1), o[i], o[i - 1], ...o.slice(i + 1)])
        if (tried.cost < best.cost - 0.5) {
          best = tried
          improved = true
        }
      }
    }
    return best.placed
  })
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
