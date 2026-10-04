import { Fragment } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { inputLabel, isAxisKey, markLabel } from '../../dcs/combos'
import { frameLayout, pct } from '../../data/frame'
import type { Device, Frame } from '../../data/types'
import { usePads } from '../../gamepad/store'
import { useWords } from '../../i18n/i18n'
import { press } from '../../state/bindings'
import { useMapUi } from '../../state/mapUi'
import { keyState, type KeyKind } from '../../state/problems'
import type { SessionState } from '../../state/session'
import type { Entry } from '../../state/types'
import { layoutCallouts, leader, wrapText } from '../../ui/callouts'
import { cx } from '../../ui/cx'
import { DevicePicture, type PlacedMark } from '../../ui/DevicePicture'
import { Notice } from '../../ui/Notice'
import { useWidth } from '../../ui/useWidth'
import { keyLines, type KeyLine } from './keyLines'
import styles from './MapPicture.module.css'

type MarkKind = KeyKind | 'sel'

const COLUMN = 0.225
const FONT = '600 12px Barlow'
const LINE = 16
const PAD = 10
const TEXT_INSET = 44
const TONE = { plain: styles.tonePlain, modifier: styles.toneModifier, ui: styles.toneUi, warn: styles.toneWarn, free: styles.toneFree }

export const Dot = ({ kind }: { kind: MarkKind }) => <i className={cx(styles.dot, styles[kind])} />

interface MarkInfo {
  kind: MarkKind
  lit: boolean
  wrong: boolean
  title: string
}

function Mark({ mark, info }: { mark: PlacedMark; info: MarkInfo }) {
  const live = usePads((p) => p.live.includes(mark.input))
  return (
    <button type="button" className={cx(styles.mark, styles[info.kind], isAxisKey(mark.input) && styles.axis, info.lit && styles.lit, live && styles.live, info.wrong && styles.wrong)}
      style={{ left: pct(mark.x), top: pct(mark.y) }} title={info.title} aria-label={info.title} aria-disabled={info.wrong || undefined} onClick={() => press(mark.input)}>
      {markLabel(mark.input)}
    </button>
  )
}

interface CalloutViewProps {
  device: Device
  frame: Frame
  info: (input: string) => MarkInfo
  callouts: (input: string) => KeyLine[] | null
  focus: string | null
}

function CalloutView({ device, frame, info, callouts, focus }: CalloutViewProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const column = width * COLUMN
  const picture = width - 2 * column
  const layout = frameLayout(device, frame)
  const pictureHeight = picture * layout.height / layout.width
  const seen = new Set<string>()
  const items = layout.marks.flatMap((m) => {
    const lines = seen.has(m.input) ? null : callouts(m.input)
    seen.add(m.input)
    if (!lines || !width) return []
    const rows = lines.map((l) => ({ tone: l.tone, rows: wrapText(l.text, FONT, column - TEXT_INSET) }))
    const count = rows.reduce((n, r) => n + r.rows.length, 0)
    return [{ id: m.input, x: column + m.x / 100 * picture, y: m.y / 100 * pictureHeight, height: count * LINE + PAD, rows }]
  })
  const { placed, height } = layoutCallouts(items, { width, height: pictureHeight, column, inset: 0, gap: 6 })
  const rowsOf = new Map(items.map((it) => [it.id, it.rows]))
  return (
    <div ref={ref} className={styles.callouts} style={{ height: width ? height : undefined }}>
      {width > 0 && (
        <>
          <div className={styles.frame} style={{ left: column, width: picture }}>
            <DevicePicture device={device} frame={frame} mark={(m, i) => <Mark key={`${i}:${m.input}`} mark={m} info={info(m.input)} />} />
          </div>
          <svg className={styles.leaders} width={width} height={height} aria-hidden="true">
            {placed.map((p) => {
              const l = leader({ x: p.anchorX, y: p.anchorY }, { x: p.x, y: p.y }, 14)
              return <line key={p.id} {...l} className={cx(styles.leader, p.id === focus && styles.leaderFocus)} />
            })}
          </svg>
          {placed.map((p) => (
            <div key={p.id} className={cx(styles.label, p.id === focus && styles.labelFocus)} style={{ left: p.left, top: p.top, width: column }}>
              <span className={cx(styles.badge, styles[info(p.id).kind])}>{markLabel(p.id)}</span>
              <span className={styles.labelText}>
                {rowsOf.get(p.id)!.flatMap((line, i) => line.rows.map((row, j) => <span key={`${i}:${j}`} className={TONE[line.tone]}>{row}</span>))}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export function MapPicture({ s, entry, highlight }: { s: SessionState; entry: Entry; highlight: Set<string> }) {
  const { t, tr, trUi } = useWords()
  const { listening, focus, adding } = useMapUi(useShallow((m) => ({ listening: m.listening, focus: m.focus, adding: m.adding })))
  const device = s.devices[entry.deviceId]
  if (!device.views.length) return <Notice as="p">{t('map.noPicture')}</Notice>
  const listened = listening ? (entry.wanted![listening.kind][listening.hash] ?? []).map((c) => c.key) : []
  const info = (input: string): MarkInfo => {
    const { using, modifier, ui, kind } = keyState(s, entry, input)
    const selected = focus === input || listened.includes(input) || (!!modifier && adding.includes(modifier))
    const lit = highlight.has(input) && !selected
    const parts = [
      modifier ? t('map.modifierShort', { name: modifier }) : '',
      ...ui.map((u) => t('map.uiLayer', { name: trUi(u.name) })),
      using.map((u) => tr(u.command.name)).join('; '),
    ].filter(Boolean)
    const wrong = !!listening && isAxisKey(input) !== (listening.kind === 'axis')
    const needs = wrong ? t(listening.kind === 'axis' ? 'map.needsAxis' : 'map.needsButton', { command: listening.name, input: inputLabel(input) }) : ''
    const title = [needs, lit ? t('map.inOpen') : '', inputLabel(input), ...(parts.length ? parts : [t('map.free')])].filter(Boolean).join(' — ')
    return { kind: selected ? 'sel' : kind, lit, wrong, title }
  }
  const callouts = (input: string) => (input === focus || (highlight.has(input) && !listening) ? keyLines(s, entry, input) : null)
  return (
    <>
      {device.views.map((view, i) => (
        <Fragment key={i}>
          {device.views.length > 1 && <span className="eyebrow">{view.name}</span>}
          <CalloutView device={device} frame={view} info={info} callouts={callouts} focus={focus} />
        </Fragment>
      ))}
      <div className={styles.legend}>
        {(['used', 'free', 'warn', 'modifier', 'sel'] as const).map((kind) => (
          <span key={kind}><Dot kind={kind} />{t(`legend.${kind === 'sel' ? 'selected' : kind}`)}</span>
        ))}
        <span><i className={cx(styles.dot, styles.used, styles.lit)} />{t('legend.open')}</span>
      </div>
      <p className="muted small">{t('map.pictureHint')}</p>
    </>
  )
}
