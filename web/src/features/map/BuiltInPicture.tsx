import type { CSSProperties } from 'react'
import { markLabel } from '../../dcs/combos'
import { KEYBOARD_ROWS, KEYBOARD_WIDTH, MOUSE_INPUTS } from '../../dcs/keyboard'
import type { Role } from '../../data/types'
import { usePads } from '../../gamepad/store'
import { press } from '../../state/bindings'
import { cx } from '../../ui/cx'
import styles from './BuiltInPicture.module.css'
import type { MarkInfo } from './MapPicture'
import { useMarkMenu } from './markMenu'

const GAP = 0.25
const ROWS = KEYBOARD_ROWS.length + GAP

const KEYS = KEYBOARD_ROWS.flatMap((row, r) => {
  let x = 0
  return row.flatMap(([id, width, label, tall]) => {
    const key = id ? [{ id, label: label ?? id, x, y: r + (r > 0 ? GAP : 0), width, height: tall ?? 1 }] : []
    x += width
    return key
  })
})

const pct = (v: number, of: number) => `${(v / of) * 100}%`

function Key({ id, label, info, style }: { id: string; label: string; info: MarkInfo; style: CSSProperties }) {
  const live = usePads((p) => p.live.includes(id))
  const menu = useMarkMenu()
  return (
    <button type="button" className={cx(styles.key, styles[info.kind], info.lit && styles.lit, live && styles.live, info.wrong && styles.wrong)}
      style={style} title={info.title} aria-label={info.title} aria-disabled={info.wrong || undefined} onClick={() => press(id)} onContextMenu={menu(id)}>{label}</button>
  )
}

function KeyboardPicture({ info }: { info: (input: string) => MarkInfo }) {
  return (
    <div className={styles.keyboard} style={{ aspectRatio: `${KEYBOARD_WIDTH} / ${ROWS}` }}>
      {KEYS.map((k) => (
        <Key key={k.id} id={k.id} label={k.label} info={info(k.id)}
          style={{ left: pct(k.x, KEYBOARD_WIDTH), top: pct(k.y, ROWS), width: `calc(${pct(k.width, KEYBOARD_WIDTH)} - 3px)`, height: `calc(${pct(k.height, ROWS)} - 3px)` }} />
      ))}
    </div>
  )
}

const MOUSE: Record<string, [number, number]> = {
  MOUSE_BTN1: [95, 85], MOUSE_BTN2: [205, 85], MOUSE_BTN3: [150, 40], MOUSE_Z: [150, 128],
  MOUSE_BTN4: [22, 205], MOUSE_BTN5: [22, 245], MOUSE_X: [150, 300], MOUSE_Y: [150, 345],
}

function MousePicture({ info }: { info: (input: string) => MarkInfo }) {
  const menu = useMarkMenu()
  return (
    <div className={styles.mouse}>
      <svg viewBox="0 0 300 420" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M150 20 C80 20 50 80 50 160 L50 280 C50 360 95 400 150 400 C205 400 250 360 250 280 L250 160 C250 80 220 20 150 20 Z" className={styles.body} />
        <path d="M150 20 L150 150M50 150 L250 150M50 190 L40 190 L40 250 L50 250" />
        <rect x="136" y="60" width="28" height="56" rx="14" className={styles.wheel} />
      </svg>
      {MOUSE_INPUTS.map((input) => {
        const [x, y] = MOUSE[input]
        const i = info(input)
        return (
          <button key={input} type="button" className={cx(styles.dot, styles[i.kind], i.lit && styles.lit, i.wrong && styles.wrong)}
            style={{ left: pct(x, 300), top: pct(y, 420) }} title={i.title} aria-label={i.title} aria-disabled={i.wrong || undefined} onClick={() => press(input)} onContextMenu={menu(input)}>{markLabel(input)}</button>
        )
      })}
    </div>
  )
}

export function BuiltInPicture({ role, info }: { role: Role; info: (input: string) => MarkInfo }) {
  return role === 'keyboard' ? <KeyboardPicture info={info} /> : <MousePicture info={info} />
}
