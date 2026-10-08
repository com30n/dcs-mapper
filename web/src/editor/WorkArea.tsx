import { useRef, useState, type PointerEvent, type MouseEvent } from 'react'
import { inputLabel, isAxisKey, markLabel } from '../dcs/combos'
import { pictureUrl } from '../data/load'
import { frameLayout } from '../data/frame'
import type { Crop, Frame, Mark } from '../data/types'
import { useWords } from '../i18n/i18n'
import { Button } from '../ui/Button'
import { cx } from '../ui/cx'
import { DevicePicture } from '../ui/DevicePicture'
import { offer, type MenuItem } from '../ui/offer'
import { RightMenu } from '../ui/RightMenu'
import { PictureInput } from './About'
import styles from './Editor.module.css'
import { alignedWith, changeCount, cropOf, fitCrop, gridLines, markExtent, marksOf, viewMarks } from './model'
import { addPictureFile, allInputs, frameOf, setGrid, setSnap, moveInView, moveMark, place, placeInView, placedInputs, resetMarks, select, setCrop, setMode, takeOff, useEditor, type Mode } from './store'

const MODES: Mode[] = ['buttons', 'card', 'views']
const FULL: Required<Crop> = { x: 0, y: 0, w: 100, h: 100 }

type Drag = { mark: string } | { dx: number; dy: number } | 'corner'

function Bar() {
  const { t } = useWords()
  const s = useEditor()
  if (s.mode !== 'buttons') {
    const frame = frameOf(s)
    return <div className={styles.barLight}>{frame?.layers ? t('editor.layers', { count: frame.layers.length }) : t('editor.frameHint')}</div>
  }
  const selected = s.selected
  const view = s.whole !== null ? s.device!.views[s.whole] : null
  const here = !!selected && (view ? viewMarks(s.device!, view).some((m) => m.input === selected) : !!s.picture && marksOf(s.device!, s.picture).some((m) => m.input === selected))
  const copies = view && selected ? viewMarks(s.device!, view).filter((m) => m.input === selected).length : 1
  const all = allInputs(s)
  const placed = placedInputs(s)
  const text = !s.picture && !view ? t('editor.bar.first')
    : selected ? t(here ? 'editor.bar.move' : 'editor.bar.place', { input: inputLabel(selected) })
      : all.length && all.every((input) => placed.has(input)) ? t('editor.bar.done') : t('editor.bar.pick')
  const moved = !!s.original?.id && changeCount(s.original, s.device) > 0
  return (
    <div className={styles.bar} role="status">
      <span>{text}</span>
      <span className="row">
        <label className={styles.snap} title={t('editor.snapHint')}>
          <input type="checkbox" checked={s.snap} onChange={(e) => setSnap(e.target.checked)} />{t('editor.snap')}
        </label>
        <label className={styles.snap} title={t('editor.gridHint')}>
          <input type="checkbox" checked={s.grid} onChange={(e) => setGrid(e.target.checked)} />{t('editor.grid')}
        </label>
        {here && <Button variant="ghost" small onClick={() => takeOff(selected)}>{t(copies > 1 ? 'editor.removeCopy' : 'editor.remove', { input: inputLabel(selected) })}</Button>}
        {moved && <Button variant="ghost" small onClick={resetMarks}>{t('editor.reset')}</Button>}
      </span>
    </div>
  )
}

function DropZone() {
  const { t } = useWords()
  const [over, setOver] = useState(false)
  return (
    <div className={cx(styles.drop, over && styles.dropActive)}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        for (const file of e.dataTransfer.files) addPictureFile(file).catch((error: Error) => useEditor.setState({ message: error.message }))
      }}>
      <strong>{t('editor.drop')}</strong>
      <span>{t('editor.dropHint')}</span>
      <PictureInput className={styles.chooseButton}>{t('editor.choose')}</PictureInput>
    </div>
  )
}

function Canvas({ picture }: { picture: string }) {
  const { t } = useWords()
  const s = useEditor()
  const device = s.device!
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const startedOnItem = useRef(false)
  const [held, setHeld] = useState<Required<Crop> | null>(null)
  const [pointer, setPointer] = useState<Pointer | null>(null)
  const [width, height] = device.pictures[picture].size
  const crop = s.mode === 'buttons' ? null : cropOf(frameOf(s))
  const fresh = s.mode === 'buttons' ? markExtent(marksOf(device, picture)) : FULL
  const area = held ?? fresh
  const point = (e: PointerEvent | MouseEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: area.x + (e.clientX - r.left) / r.width * area.w, y: area.y + (e.clientY - r.top) / r.height * area.h }
  }
  const at = (x: number, y: number) => ({ left: `${(x - area.x) / area.w * 100}%`, top: `${(y - area.y) / area.h * 100}%` })
  const grab = (e: PointerEvent, what: Drag) => {
    e.stopPropagation()
    setHeld(area)
    drag.current = what
    startedOnItem.current = true
    box.current!.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    const what = drag.current
    const p = point(e)
    const here = s.mode === 'buttons' ? pointerAt(marksOf(device, picture), p, what && what !== 'corner' && 'mark' in what ? what.mark : undefined, s.snap && !e.altKey) : null
    setPointer(here)
    if (!what) return
    if (what === 'corner') { if (crop) setCrop(fitCrop({ ...crop, w: p.x - crop.x, h: p.y - crop.y })) }
    else if ('mark' in what) moveMark(what.mark, here!.x, here!.y)
    else if (crop) setCrop(fitCrop({ ...crop, x: Math.max(0, p.x - what.dx), y: Math.max(0, p.y - what.dy) }))
  }
  const onClick = (e: MouseEvent) => {
    if (startedOnItem.current) { startedOnItem.current = false; return }
    if (s.mode !== 'buttons') return
    const p = point(e)
    place(p.x, p.y)
  }
  return (
    <RightMenu rest={(e) => s.mode === 'buttons' ? canvasMenu(t, () => { const p = point(e); place(p.x, p.y) }) : []}>
      <div ref={box} className={cx(styles.canvas, s.mode === 'buttons' && styles.placing)} style={{ aspectRatio: `${width * area.w} / ${height * area.h}`, width: `min(100%, calc((100vh - 440px) * ${width * area.w / (height * area.h)}))` }}
        onPointerMove={onMove} onPointerLeave={() => setPointer(null)} onPointerUp={() => { drag.current = null; setHeld(null) }} onPointerCancel={() => { drag.current = null; setHeld(null) }} onClick={onClick}>
        <img src={pictureUrl(device, picture)} alt="" draggable={false}
          style={{ ...at(0, 0), width: `${10000 / area.w}%`, height: `${10000 / area.h}%` }} />
        {s.grid && <Grid area={area} />}
        {s.mode === 'buttons' && s.original && (
          <Ghosts area={area} moved={movedFrom(marksOf(s.original, picture).map((m) => ({ ...m, key: m.input })), marksOf(device, picture).map((m) => ({ ...m, key: m.input })))} />
        )}
        {s.mode === 'buttons' && <Guides pointer={pointer} area={area} />}
        {s.mode === 'buttons' && marksOf(device, picture).map((m) => (
          <button key={m.input} type="button" className={cx(styles.mark, isAxisKey(m.input) && styles.axisMark, s.selected === m.input && styles.selected)}
            style={at(m.x, m.y)} title={inputLabel(m.input)} aria-label={inputLabel(m.input)} aria-pressed={s.selected === m.input}
            onPointerDown={(e) => { if (e.button !== 0) return; select(m.input); grab(e, { mark: m.input }) }}
            onContextMenu={offer(() => markMenu(t, m.input, 1, () => { select(m.input); takeOff(m.input) }))}>
            {markLabel(m.input)}
          </button>
        ))}
        {crop && <FrameBox crop={crop} label={s.mode === 'card' ? t('editor.mode.card') : device.views[s.view]?.name ?? ''}
          onGrab={(e) => { const p = point(e); grab(e, { dx: p.x - crop.x, dy: p.y - crop.y }) }} onGrabCorner={(e) => grab(e, 'corner')} />}
      </div>
    </RightMenu>
  )
}

function ViewCanvas({ view }: { view: Frame }) {
  const { t } = useWords()
  const s = useEditor()
  const device = s.device!
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ layer: number; input: string } | null>(null)
  const startedOnItem = useRef(false)
  const marks = viewMarks(device, view)
  const [held, setHeld] = useState<Required<Crop> | null>(null)
  const [pointer, setPointer] = useState<Pointer | null>(null)
  const area = held ?? markExtent(marks)
  const { width, height } = frameLayout(device, view)
  const point = (e: PointerEvent | MouseEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: area.x + (e.clientX - r.left) / r.width * area.w, y: area.y + (e.clientY - r.top) / r.height * area.h }
  }
  const at = (x: number, y: number) => ({ left: `${(x - area.x) / area.w * 100}%`, top: `${(y - area.y) / area.h * 100}%` })
  const stop = () => { drag.current = null; setHeld(null) }
  const copies = (input: string) => marks.filter((m) => m.input === input).length
  return (
    <RightMenu rest={(e) => canvasMenu(t, () => { const p = point(e); placeInView(p.x, p.y) })}>
      <div ref={box} className={cx(styles.canvas, styles.placing)} style={{ aspectRatio: `${width * area.w} / ${height * area.h}`, width: `min(100%, calc((100vh - 440px) * ${width * area.w / (height * area.h)}))` }}
        onPointerMove={(e) => {
          const d = drag.current
          const here = pointerAt(marks, point(e), d?.input, s.snap && !e.altKey)
          setPointer(here)
          if (d) moveInView(d.layer, d.input, here.x, here.y)
        }}
        onPointerLeave={() => setPointer(null)} onPointerUp={stop} onPointerCancel={stop}
        onClick={(e) => { if (startedOnItem.current) { startedOnItem.current = false; return } const p = point(e); placeInView(p.x, p.y) }}>
        <div className={styles.whole} style={{ ...at(0, 0), width: `${10000 / area.w}%`, height: `${10000 / area.h}%` }}>
          <DevicePicture device={device} frame={view} />
        </div>
        {s.grid && <Grid area={area} />}
        {s.original && (
          <Ghosts area={area} moved={movedFrom(viewMarks(s.original, view).map((m) => ({ ...m, key: `${m.layer}:${m.input}` })), marks.map((m) => ({ ...m, key: `${m.layer}:${m.input}` })))} />
        )}
        <Guides pointer={pointer} area={area} />
        {marks.map((m) => (
          <button key={`${m.layer}:${m.input}`} type="button" className={cx(styles.mark, isAxisKey(m.input) && styles.axisMark, s.selected === m.input && (s.selectedLayer === null || s.selectedLayer === m.layer) && styles.selected)}
            style={at(m.x, m.y)} title={`${inputLabel(m.input)} · ${m.picture}`} aria-label={inputLabel(m.input)} aria-pressed={s.selected === m.input}
            onContextMenu={offer(() => markMenu(t, m.input, copies(m.input), () => { select(m.input, m.layer); takeOff(m.input) }))}
            onPointerDown={(e) => {
              e.stopPropagation()
              if (e.button !== 0) return
              select(m.input, m.layer)
              drag.current = { layer: m.layer, input: m.input }
              startedOnItem.current = true
              setHeld(area)
              box.current!.setPointerCapture(e.pointerId)
            }}>
            {markLabel(m.input)}
          </button>
        ))}
      </div>
    </RightMenu>
  )
}

type Words = ReturnType<typeof useWords>['t']

function markMenu(t: Words, input: string, copies: number, remove: () => void): MenuItem[] {
  return [{ label: t(copies > 1 ? 'editor.removeCopy' : 'editor.remove', { input: inputLabel(input) }), run: remove, tone: 'warn' }]
}

function canvasMenu(t: Words, putHere: () => void): MenuItem[] {
  const s = useEditor.getState()
  const moved = !!s.original?.id && changeCount(s.original, s.device) > 0
  return [
    ...(s.selected ? [{ label: t('menu.putHere', { input: inputLabel(s.selected) }), run: putHere }] : []),
    ...(moved ? [{ label: t('editor.reset'), run: resetMarks }] : []),
    ...(s.selected || moved ? ['line' as const] : []),
    { label: t('editor.snap'), on: s.snap, turn: setSnap },
    { label: t('editor.grid'), on: s.grid, turn: setGrid },
  ]
}

const GRID_STEP = 5

function Grid({ area }: { area: Required<Crop> }) {
  const lines = gridLines(area, GRID_STEP)
  return (
    <svg className={styles.grid} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {lines.x.map((x) => <line key={`x${x}`} className={cx(x % (GRID_STEP * 2) === 0 && styles.gridMajor)} x1={(x - area.x) / area.w * 100} x2={(x - area.x) / area.w * 100} y1={0} y2={100} />)}
      {lines.y.map((y) => <line key={`y${y}`} className={cx(y % (GRID_STEP * 2) === 0 && styles.gridMajor)} y1={(y - area.y) / area.h * 100} y2={(y - area.y) / area.h * 100} x1={0} x2={100} />)}
    </svg>
  )
}

interface Pointer {
  x: number
  y: number
  aligned: { x: number | null; y: number | null }
}

function pointerAt(marks: Pick<Mark, 'input' | 'x' | 'y'>[], p: { x: number; y: number }, skip?: string, snap = true): Pointer {
  const aligned = snap ? alignedWith(marks, p, skip) : { x: null, y: null }
  return { x: aligned.x ?? p.x, y: aligned.y ?? p.y, aligned }
}

function Guides({ pointer, area }: { pointer: Pointer | null; area: Required<Crop> }) {
  if (!pointer) return null
  const left = (pointer.x - area.x) / area.w * 100
  const top = (pointer.y - area.y) / area.h * 100
  return (
    <>
      <span className={cx(styles.guideV, pointer.aligned.x !== null && styles.guideOn)} style={{ left: `${left}%` }} aria-hidden="true" />
      <span className={cx(styles.guideH, pointer.aligned.y !== null && styles.guideOn)} style={{ top: `${top}%` }} aria-hidden="true" />
      <span className={styles.guideText} style={{ left: `${left}%`, top: `${top}%` }} aria-hidden="true">{pointer.x.toFixed(1)} · {pointer.y.toFixed(1)}</span>
    </>
  )
}

interface Moved {
  key: string
  input: string
  from: { x: number; y: number }
  to: { x: number; y: number }
}

function Ghosts({ moved, area }: { moved: Moved[]; area: Required<Crop> }) {
  const sx = (x: number) => (x - area.x) / area.w * 100
  const sy = (y: number) => (y - area.y) / area.h * 100
  return (
    <>
      <svg className={styles.ghostLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {moved.map((m) => <line key={m.key} x1={sx(m.from.x)} y1={sy(m.from.y)} x2={sx(m.to.x)} y2={sy(m.to.y)} />)}
      </svg>
      {moved.map((m) => (
        <span key={m.key} className={cx(styles.mark, styles.ghost, isAxisKey(m.input) && styles.axisMark)} style={{ left: `${sx(m.from.x)}%`, top: `${sy(m.from.y)}%` }} aria-hidden="true">
          {markLabel(m.input)}
        </span>
      ))}
    </>
  )
}

function movedFrom(before: { key: string; input: string; x: number; y: number }[], after: { key: string; input: string; x: number; y: number }[]): Moved[] {
  const was = new Map(before.map((m) => [m.key, m]))
  return after.flatMap((m) => {
    const o = was.get(m.key)
    return o && (o.x !== m.x || o.y !== m.y) ? [{ key: m.key, input: m.input, from: { x: o.x, y: o.y }, to: { x: m.x, y: m.y } }] : []
  })
}

interface FrameBoxProps {
  crop: Required<Crop>
  label: string
  onGrab: (e: PointerEvent) => void
  onGrabCorner: (e: PointerEvent) => void
}

function FrameBox({ crop: { x, y, w, h }, label, onGrab, onGrabCorner }: FrameBoxProps) {
  const hole = `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${y}%, ${x}% ${y}%, ${x}% ${y + h}%, ${x + w}% ${y + h}%, ${x + w}% ${y}%, 0 ${y}%)`
  return (
    <>
      <div className={styles.shade} style={{ clipPath: hole }} />
      <div className={styles.frame} style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }} onPointerDown={onGrab}>
        <span className={styles.frameLabel}>{label}</span>
        <span className={styles.corner} onPointerDown={onGrabCorner} />
      </div>
    </>
  )
}

function CropFields() {
  const { t } = useWords()
  const crop = cropOf(frameOf(useEditor()))
  if (!crop) return null
  return (
    <div className={styles.cropFields}>
      {(['x', 'y', 'w', 'h'] as const).map((key) => (
        <label key={key}>{key.toUpperCase()}
          <input type="number" step="any" className={cx('text', styles.number)} value={crop[key]}
            onChange={(e) => { const value = Number(e.target.value); if (e.target.value !== '' && !Number.isNaN(value)) setCrop(fitCrop({ ...crop, [key]: value })) }} />
        </label>
      ))}
      <span>{t('editor.percent')}</span>
    </div>
  )
}

export function WorkArea() {
  const { t } = useWords()
  const s = useEditor()
  const device = s.device!
  const frame = s.mode === 'buttons' ? null : frameOf(s)
  const whole = s.mode === 'buttons' && s.whole !== null ? device.views[s.whole] ?? null : null
  const picture = s.mode === 'buttons' ? s.picture : frame && !frame.layers ? frame.picture : null
  return (
    <section className={styles.center} aria-labelledby="work">
      <div className={styles.headRow}>
        <h2 id="work">{t(`editor.heading.${s.mode}`)}</h2>
        <div role="tablist" aria-label={t('editor.title')} className={styles.tabs}>
          {MODES.map((mode) => <button key={mode} type="button" role="tab" aria-selected={s.mode === mode} onClick={() => setMode(mode)}>{t(`editor.mode.${mode}`)}</button>)}
        </div>
      </div>
      <Bar />
      {!Object.keys(device.pictures).length ? <DropZone />
        : whole ? <ViewCanvas view={whole} />
        : frame?.layers ? <div className={styles.canvas}><DevicePicture device={device} frame={frame} /></div>
          : picture ? <Canvas picture={picture} /> : null}
      {picture && s.mode !== 'buttons' && <CropFields />}
    </section>
  )
}
