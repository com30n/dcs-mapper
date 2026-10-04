import i18n from 'i18next'
import { inputLabel, markLabel } from '../../dcs/combos'
import { allViews, frameLayout, MARK_SCALE } from '../../data/frame'
import { pictureUrl } from '../../data/load'
import { tr } from '../../i18n/i18n'
import { setupOf, type SessionState } from '../../state/session'
import type { Entry } from '../../state/types'
import { layoutCallouts, leader, wrapText } from '../../ui/callouts'
import { keyLines, type Tone } from '../map/keyLines'

const W = 1754
const H = 1240
const MARGIN = 56
const COLUMN = 360
const TOP = 190
const BOTTOM = 1140
const INK = '#14181E'
const INK2 = '#3B4452'
const MUTED = '#566070'
const TONE: Record<Tone, string> = { plain: INK, modifier: '#6B3FA0', ui: INK2, warn: INK, free: INK }
const SIZES = [16, 14, 12]
const COLORS = ['#0072B2', '#D55E00', '#00876A', '#8F6A00', '#B4407E']

const imageFrom = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image()
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error(`Cannot load ${src}`))
  img.src = src
})

async function loadImage(src: string, [width, height]: [number, number]) {
  if (!/\.svg$|^data:image\/svg/i.test(src)) return imageFrom(src)
  const text = await (await fetch(src)).text()
  const sized = /<svg[^>]*\swidth=/.test(text) ? text : text.replace('<svg', `<svg width="${width}" height="${height}"`)
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }))
  try { return await imageFrom(url) } finally { URL.revokeObjectURL(url) }
}

export const hasSheet = (s: SessionState, entry: Entry) => s.devices[entry.deviceId].views.length > 0

export const sheetName = (s: SessionState, entry: Entry) =>
  `${tr(s.catalog!.name)} — ${s.devices[entry.deviceId].name}.png`.replace(/[\\/:*?"<>|]/g, '-')

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, height: number, fill: string, center: boolean) {
  ctx.save()
  ctx.font = `600 ${height * 0.55}px "IBM Plex Mono"`
  const width = Math.max(height, ctx.measureText(text).width + height * 0.5)
  const left = center ? x - width / 2 : x
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.roundRect(left, y - height / 2, width, height, height / 2)
  ctx.fill()
  if (center) {
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, left + width / 2, y + 1)
  ctx.restore()
  return width
}

export async function drawSheet(s: SessionState, entry: Entry): Promise<Blob> {
  await Promise.all(['700 72px Barlow', '600 16px Barlow', '500 16px Barlow', '500 14px "IBM Plex Mono"'].map((font) => document.fonts.load(font)))
  const device = s.devices[entry.deviceId]
  const view = allViews(device)
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H })
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = INK
  ctx.font = '700 72px Barlow'
  ctx.fillText(tr(s.catalog!.name), MARGIN, 44)
  ctx.fillStyle = INK2
  ctx.font = '600 26px Barlow'
  ctx.fillText(`${i18n.t(`role.${device.role}`)} · ${device.name}`, MARGIN, 128)
  ctx.textAlign = 'right'
  ctx.font = '500 22px Barlow'
  ctx.fillStyle = MUTED
  const forDcs = ` ${i18n.t('app.for')}`
  ctx.fillText(forDcs, W - MARGIN, 52)
  const forWidth = ctx.measureText(forDcs).width
  ctx.font = '700 22px Barlow'
  ctx.fillStyle = INK
  ctx.fillText(i18n.t('app.name'), W - MARGIN - forWidth, 52)
  ctx.font = '500 16px "IBM Plex Mono"'
  ctx.fillStyle = MUTED
  ctx.fillText(`Config\\Input\\${s.catalog!.folder}\\joystick`, W - MARGIN, 88)

  const layout = frameLayout(device, view)
  const scale = Math.min((W - 2 * MARGIN - 2 * COLUMN - 120) / layout.width, (BOTTOM - TOP) / layout.height)
  const pw = layout.width * scale
  const ph = layout.height * scale
  const px = (W - pw) / 2
  const py = TOP + (BOTTOM - TOP - ph) / 2
  const images = await Promise.all(layout.placed.map((p) => loadImage(pictureUrl(device, p.picture), device.pictures[p.picture].size)))
  layout.placed.forEach((p, i) => {
    const img = images[i]
    const [dx, dy, dw, dh] = [px + p.ax / 100 * pw, py + p.ay / 100 * ph, p.aw / 100 * pw, p.ah / 100 * ph]
    ctx.save()
    ctx.beginPath()
    ctx.rect(Math.max(dx, px), Math.max(dy, py), Math.min(dw, pw), Math.min(dh, ph))
    ctx.clip()
    ctx.drawImage(img, dx - p.c.x / p.c.w * dw, dy - p.c.y / p.c.h * dh, dw * 100 / p.c.w, dh * 100 / p.c.h)
    ctx.restore()
  })

  const markSize = Math.min(26, Math.max(16, 1.3 * 22 * pw / (MARK_SCALE * layout.width / Math.max(layout.width, layout.height))))
  const seen = new Set<string>()
  const keys = layout.marks.filter((m) => !seen.has(m.input) && seen.add(m.input)).flatMap((m) => {
    const lines = keyLines(s, entry, m.input).filter((l) => l.tone !== 'warn' && l.tone !== 'free')
    return lines.length ? [{ input: m.input, x: px + m.x / 100 * pw, y: py + m.y / 100 * ph, lines }] : []
  })

  let size = SIZES[0]
  let placed: ReturnType<typeof layoutCallouts>['placed'] = []
  let rowsOf = new Map<string, { tone: Tone; rows: string[] }[]>()
  for (const [spill, tried] of [false, true].flatMap((spill) => SIZES.map((tried) => [spill, tried] as const))) {
    size = tried
    const line = Math.round(size * 1.4)
    const font = `600 ${size}px Barlow`
    rowsOf = new Map(keys.map((k) => [k.input, k.lines.map((l) => ({ tone: l.tone, rows: wrapText(l.text, font, COLUMN - 24 - size * 2.6) }))]))
    const items = keys.map((k) => ({ id: k.input, x: k.x, y: k.y - TOP, height: rowsOf.get(k.input)!.reduce((n, l) => n + l.rows.length, 0) * line + 14 }))
    const result = layoutCallouts(items, { width: W, height: BOTTOM - TOP, column: COLUMN, inset: MARGIN, gap: 10, spill })
    placed = result.placed.map((p) => ({ ...p, top: p.top + TOP, anchorY: p.anchorY + TOP, y: p.y + TOP }))
    if (result.height <= BOTTOM - TOP) break
  }

  const colorOf = new Map<string, string>()
  for (const side of ['left', 'right']) {
    placed.filter((p) => p.side === side).sort((a, b) => a.top - b.top).forEach((p, i) => colorOf.set(p.id, COLORS[i % COLORS.length]))
  }
  ctx.lineWidth = 2
  for (const p of placed) {
    const l = leader({ x: p.anchorX, y: p.anchorY }, { x: p.x, y: p.y }, 16)
    ctx.strokeStyle = colorOf.get(p.id)!
    ctx.beginPath()
    ctx.moveTo(l.x1, l.y1)
    ctx.lineTo(l.x2, l.y2)
    ctx.stroke()
  }
  for (const k of keys) {
    pill(ctx, markLabel(k.input), k.x, k.y, markSize, colorOf.get(k.input)!, true)
  }
  const line = Math.round(size * 1.4)
  for (const p of placed) {
    ctx.fillStyle = '#FFFFFF'
    ctx.strokeStyle = '#C3CBD5'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(p.left + 0.5, p.top + 0.5, COLUMN - 1, p.height - 1, 8)
    ctx.fill()
    ctx.stroke()
    const badge = pill(ctx, markLabel(p.id), p.left + 10, p.top + 7 + line / 2, Math.round(size * 1.5), colorOf.get(p.id)!, false)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    let y = p.top + 7 + (line - size) / 2
    for (const l of rowsOf.get(p.id)!) {
      ctx.fillStyle = TONE[l.tone]
      ctx.font = `${l.tone === 'ui' ? 500 : 600} ${size}px Barlow`
      for (const row of l.rows) {
        ctx.fillText(row, p.left + 20 + badge, y)
        y += line
      }
    }
  }

  const modifiers = Object.entries(setupOf(s).modifiers ?? {})
  const own = modifiers.filter(([, m]) => m.device === entry.dcsId)
    .map(([name, m]) => `${name} = ${inputLabel(m.key)} (${i18n.t(m.switch ? 'sheet.switch' : 'sheet.hold')})`)
  const keyboard = modifiers.filter(([, m]) => m.device === 'Keyboard').map(([name]) => name)
  ctx.strokeStyle = '#D6DCE3'
  ctx.beginPath()
  ctx.moveTo(MARGIN, H - 84)
  ctx.lineTo(W - MARGIN, H - 84)
  ctx.stroke()
  ctx.font = '500 17px Barlow'
  ctx.fillStyle = INK2
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  const footer = [own.length ? i18n.t('sheet.modifiers', { list: own.join(', ') }) : '', keyboard.length ? i18n.t('sheet.keyboard', { names: keyboard.join(', ') }) : ''].filter(Boolean).join(' · ')
  ctx.fillText(footer, MARGIN, H - 66)
  ctx.textAlign = 'right'
  ctx.fillText(i18n.t('sheet.numbers'), W - MARGIN, H - 66)

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG failed'))), 'image/png'))
}
