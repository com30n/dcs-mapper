import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useWords } from '../i18n/i18n'
import { cx } from './cx'
import { RightMenu } from './RightMenu'
import { NO_ZOOM, panBy, zoomAt, type Zoom } from './zoom'
import styles from './ZoomBox.module.css'

const STEP = 1.25
const DRAG = 4

export function ZoomBox({ children, className }: { children: ReactNode; className?: string }) {
  const { t } = useWords()
  const box = useRef<HTMLDivElement>(null)
  const [zoom, setZoomState] = useState<Zoom>(NO_ZOOM)
  const current = useRef<Zoom>(NO_ZOOM)
  const setZoom = (next: Zoom) => { current.current = next; setZoomState(next) }
  const [panning, setPanning] = useState(false)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [base, setBase] = useState(0)
  const size = () => ({ width: box.current!.clientWidth, height: box.current!.clientHeight })

  useEffect(() => {
    const el = box.current!
    const onWheel = (event: WheelEvent) => {
      if (!event.deltaY) return
      const r = el.getBoundingClientRect()
      const z = current.current
      const next = zoomAt(z, size(), event.clientX - r.left, event.clientY - r.top, event.deltaY < 0 ? STEP : 1 / STEP)
      if (next.scale === z.scale && z.scale === 1) return
      event.preventDefault()
      if (z.scale === 1) setBase(el.offsetHeight)
      current.current = next
      setZoomState(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const down = (event: PointerEvent) => {
    if (zoom.scale === 1 || event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, moved: false }
  }
  const move = (event: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = event.clientX - d.x
    const dy = event.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < DRAG) return
    if (!d.moved) { d.moved = true; setPanning(true); box.current!.setPointerCapture(event.pointerId) }
    drag.current = { x: event.clientX, y: event.clientY, moved: true }
    setZoom(panBy(current.current, size(), dx, dy))
  }
  const up = () => { setPanning(false); setTimeout(() => { drag.current = null }) }
  const zoomBy = (x: number, y: number, step: number) => {
    const z = current.current
    if (z.scale === 1) setBase(box.current!.offsetHeight)
    setZoom(zoomAt(z, size(), x, y, step))
  }
  const menu = (event: MouseEvent) => {
    const r = box.current!.getBoundingClientRect()
    const x = event.clientX - r.left
    const y = event.clientY - r.top
    return [
      { label: t('menu.zoomIn'), run: () => zoomBy(x, y, STEP * STEP) },
      { label: t('menu.zoomOut'), run: () => zoomBy(x, y, 1 / (STEP * STEP)), disabled: zoom.scale === 1 },
      { label: t('zoom.resetHint'), run: () => setZoom(NO_ZOOM), disabled: zoom.scale === 1 },
    ]
  }

  return (
    <RightMenu rest={menu}>
      <div ref={box} className={cx(styles.box, zoom.scale > 1 && styles.zoomed, panning && styles.panning, className)} style={zoom.scale > 1 && base ? { height: base } : undefined}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClickCapture={(event) => { if (drag.current?.moved) { event.stopPropagation(); event.preventDefault() } }}>
        <div className={styles.content} style={{ width: `${zoom.scale * 100}%`, transform: `translate(${Math.round(zoom.x)}px, ${Math.round(zoom.y)}px)`, '--zoom': zoom.scale } as CSSProperties}>{children}</div>
        {zoom.scale > 1 && (
          <button type="button" className={styles.reset} onClick={() => setZoom(NO_ZOOM)} title={t('zoom.resetHint')}>
            {Math.round(zoom.scale * 100)}% · {t('zoom.reset')}
          </button>
        )}
      </div>
    </RightMenu>
  )
}
