import { Fragment, useEffect, useRef } from 'react'
import { isDefaultFilter } from '../../dcs/axis'
import { comboId, comboText } from '../../dcs/combos'
import type { Profile } from '../../dcs/types'
import type { Device } from '../../data/types'
import { useWords } from '../../i18n/i18n'
import { carry, listen, pickColumn, removeCombo, why } from '../../state/bindings'
import { useMapUi } from '../../state/mapUi'
import { comboIssue, issueText } from '../../state/problems'
import type { SessionState } from '../../state/session'
import type { Entry } from '../../state/types'
import { cx } from '../../ui/cx'
import { IconButton } from '../../ui/IconButton'
import { ClearIcon, CopyIcon, MoveIcon, TuneIcon } from '../../ui/icons'
import { commandOf, groupRows, isMapped, tableItems, type Item } from './tree'
import styles from './Fields.module.css'
import { openTune } from './dialogs/open'
import map from './Map.module.css'

export interface Column {
  entry: Entry
  index: number
  active: boolean
  profile: Profile
  device: Device
}

function OffCell({ text, title }: { text: string; title?: string }) {
  return <div className={styles.cell} role="cell"><span className={cx(styles.field, styles.off)} title={title}>{text}</span></div>
}

function Cell({ s, column, item, section }: { s: SessionState; column: Column; item: Item; section: string }) {
  const { t, tr } = useWords()
  const { entry, active, device } = column
  const { kind } = item
  const hash = item.command.hash
  const combos = entry.wanted![kind][hash] ?? []
  const listening = useMapUi((m) => active && m.listening?.hash === hash)
  const addAxis = useMapUi((m) => active && m.listening?.hash === hash && m.addAxis)
  const focus = useMapUi((m) => (active && combos.some((c) => c.key === m.focus) ? m.focus : null))
  const flash = useMapUi((m) => active && m.flash === hash)
  const scrollHere = useMapUi((m) => active && m.scrollTo === `${section}|${hash}`)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!scrollHere) return
    ref.current?.scrollIntoView({ block: 'center', inline: 'nearest' })
    useMapUi.setState({ scrollTo: null })
  }, [scrollHere])
  const command = commandOf(column.profile, kind, hash)
  if (device.role === 'keyboard' && kind === 'axis') return <OffCell text={t('map.noKeyboardAxes')} title={t('map.notOfferedHint', { device: device.name })} />
  if (!command) return <OffCell text={t('map.notOffered')} title={t('map.notOfferedHint', { device: device.name })} />
  if (command.joystick === false) {
    if (device.role === 'keyboard' || device.role === 'mouse') {
      return <OffCell text={t('map.notOffered')} title={t('map.notOfferedHint', { device: device.name })} />
    }
    return <OffCell text={t('map.notForJoystickShort')} title={t('map.notForJoystick')} />
  }
  const name = tr(command.name)
  const pick = () => listen(hash, kind, name, entry.uid)
  if (listening || !combos.length) {
    const bound = combos.map(comboText).join(', ')
    const waiting = addAxis && bound ? `${bound}, …` : t(device.role === 'mouse' ? 'map.pickMouseShort' : device.role === 'keyboard' ? 'map.pressKeyShort' : kind === 'axis' ? 'map.moveAxisShort' : 'map.pressShort')
    return (
      <div ref={ref} className={styles.cell} role="cell">
        <div className={styles.slotRow}>
          <button type="button" className={cx(styles.field, listening ? styles.listen : styles.empty)} title={`${name} · ${device.name}`} onClick={pick}>
            {listening ? waiting : t(kind === 'axis' ? 'map.assignAxis' : device.role === 'keyboard' ? 'map.assignKey' : 'map.assignButton')}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div ref={ref} className={styles.cell} role="cell">
      {combos.map((combo, i) => {
        const issue = comboIssue(s, entry, combo, hash)
        const state = issue ? 'warn' : flash ? 'flash' : combo.key === focus ? 'focus' : null
        const about = `${name} · ${comboText(combo)} · ${device.name}`
        return (
          <Fragment key={comboId(combo)}>
            <div className={styles.slotRow}>
              <button type="button" className={cx(styles.field, state && styles[state])} title={`${name} · ${device.name}`} onClick={pick}>{comboText(combo)}</button>
              {kind === 'axis' && (
                <IconButton tone="blue" className={cx(!isDefaultFilter(combo.filter) && styles.tuned)} label={`${t('tune.button')}: ${about}`} hint={t('tune.hint')}
                  onClick={() => { pickColumn(entry.uid); openTune(entry, hash, i) }}><TuneIcon /></IconButton>
              )}
              <IconButton label={`${t('map.copy')}: ${about}`} hint={t('map.copyHint')} onClick={() => carry(kind, hash, name, combo, 'copy', entry.uid)}><CopyIcon /></IconButton>
              <IconButton label={`${t('map.move')}: ${about}`} hint={t('map.moveHint')} onClick={() => carry(kind, hash, name, combo, 'move', entry.uid)}><MoveIcon /></IconButton>
              <IconButton tone="warn" label={`${t('map.clearOne')}: ${about}`} hint={t('map.clearHint')} onClick={() => removeCombo(kind, hash, comboId(combo), name, entry.uid)}><ClearIcon /></IconButton>
            </div>
            {issue && <button type="button" className={styles.problem} title={issueText(issue)} onClick={() => { pickColumn(entry.uid); why(combo.key) }}>{t('map.why')}</button>}
          </Fragment>
        )
      })}
    </div>
  )
}

interface SectionProps {
  s: SessionState
  columns: Column[]
  id: string
  label: string
  all: Item[]
  collapsible: boolean
  onToggle?: () => void
}

export function Section({ s, columns, id, label, all, collapsible, onToggle }: SectionProps) {
  const { t, tr } = useWords()
  const filter = useMapUi((m) => m.filter)
  const scrollTo = useMapUi((m) => m.scrollTo)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (scrollTo !== id) return
    ref.current?.scrollIntoView({ block: 'start' })
    useMapUi.setState({ scrollTo: null })
  }, [scrollTo, id])
  const rows = groupRows(tableItems(s, columns.map((c) => c.entry), all, filter), tr)
  const mapped = all.filter((item) => columns.some((c) => isMapped(c.entry.wanted!, item))).length
  return (
    <section ref={ref} className={styles.sec} aria-label={label}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          {collapsible
            ? <button type="button" className={styles.title} aria-expanded="true" onClick={onToggle}><span className={map.chev}>▾</span>{label}</button>
            : <span className={styles.title}>{label}</span>}
          <span className={cx(map.count, mapped > 0 && map.has)}>{mapped ? `${mapped} / ` : ''}{all.length}</span>
        </div>
      </div>
      {rows.flatMap((row) => row.slots.map((slot, i) => (
        <div key={`${slot.kind}:${slot.command.hash}`} className={cx(styles.row, i === 0 && styles.first)} role="row">
          <div className={styles.name} role="rowheader">
            {i === 0 && <strong>{row.control}</strong>}
            {(slot.position || slot.kind === 'axis') && (
              <span className={styles.slotLabel}>{slot.position}{slot.kind === 'axis' && <span className={styles.axisTag}>{t('map.axisTag')}</span>}</span>
            )}
          </div>
          {columns.map((column) => <Cell key={column.entry.uid} s={s} column={column} item={slot} section={id} />)}
        </div>
      )))}
      {!rows.length && <p className={cx('muted', map.pad)}>{t('map.noCommands')}</p>}
    </section>
  )
}
