import { useRef, useState, type PointerEvent, type MouseEvent } from 'react'
import { inputLabel, isAxisKey, markLabel } from '../dcs/combos'
import { pictureUrl } from '../data/load'
import type { Crop } from '../data/types'
import { useWords } from '../i18n/i18n'
import { Button } from '../ui/Button'
import { cx } from '../ui/cx'
import { DevicePicture } from '../ui/DevicePicture'
import { PictureInput } from './About'
import styles from './Editor.module.css'
import { changeCount, cropOf, fitCrop, markExtent, marksOf } from './model'
import { addPictureFile, allInputs, frameOf, moveMark, place, placedInputs, resetMarks, select, setCrop, setMode, takeOff, useEditor, type Mode } from './store'

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
  const here = !!selected && !!s.picture && marksOf(s.device!, s.picture).some((m) => m.input === selected)
  const all = allInputs(s)
  const placed = placedInputs(s)
  const text = !s.picture ? t('editor.bar.first')
    : selected ? t(here ? 'editor.bar.move' : 'editor.bar.place', { input: inputLabel(selected) })
      : all.length && all.every((input) => placed.has(input)) ? t('editor.bar.done') : t('editor.bar.pick')
  const moved = !!s.original?.id && changeCount(s.original, s.device) > 0
  return (
    <div className={styles.bar} role="status">
      <span>{text}</span>
      <span className="row">
        {here && <Button variant="ghost" small onClick={() => takeOff(selected)}>{t('editor.remove', { input: inputLabel(selected) })}</Button>}
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
    if (!what) return
    const p = point(e)
    if (what === 'corner') { if (crop) setCrop(fitCrop({ ...crop, w: p.x - crop.x, h: p.y - crop.y })) }
    else if ('mark' in what) moveMark(what.mark, p.x, p.y)
    else if (crop) setCrop(fitCrop({ ...crop, x: Math.max(0, p.x - what.dx), y: Math.max(0, p.y - what.dy) }))
  }
  const onClick = (e: MouseEvent) => {
    if (startedOnItem.current) { startedOnItem.current = false; return }
    if (s.mode !== 'buttons') return
    const p = point(e)
    place(p.x, p.y)
  }
  return (
    <div ref={box} className={cx(styles.canvas, s.mode === 'buttons' && styles.placing)} style={{ aspectRatio: `${width * area.w} / ${height * area.h}`, width: `min(100%, calc((100vh - 440px) * ${width * area.w / (height * area.h)}))` }}
      onPointerMove={onMove} onPointerUp={() => { drag.current = null; setHeld(null) }} onPointerCancel={() => { drag.current = null; setHeld(null) }} onClick={onClick}>
      <img src={pictureUrl(device, picture)} alt="" draggable={false}
        style={{ ...at(0, 0), width: `${10000 / area.w}%`, height: `${10000 / area.h}%` }} />
      {s.mode === 'buttons' && marksOf(device, picture).map((m) => (
        <button key={m.input} type="button" className={cx(styles.mark, isAxisKey(m.input) && styles.axisMark, s.selected === m.input && styles.selected)}
          style={at(m.x, m.y)} title={inputLabel(m.input)} aria-label={inputLabel(m.input)} aria-pressed={s.selected === m.input}
          onPointerDown={(e) => { select(m.input); grab(e, { mark: m.input }) }}>
          {markLabel(m.input)}
        </button>
      ))}
      {crop && <FrameBox crop={crop} label={s.mode === 'card' ? t('editor.mode.card') : device.views[s.view]?.name ?? ''}
        onGrab={(e) => { const p = point(e); grab(e, { dx: p.x - crop.x, dy: p.y - crop.y }) }} onGrabCorner={(e) => grab(e, 'corner')} />}
    </div>
  )
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
        : frame?.layers ? <div className={styles.canvas}><DevicePicture device={device} frame={frame} /></div>
          : picture ? <Canvas picture={picture} /> : null}
      {picture && s.mode !== 'buttons' && <CropFields />}
    </section>
  )
}
