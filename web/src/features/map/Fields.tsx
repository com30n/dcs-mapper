import { useEffect, useRef } from 'react'
import { isDefaultFilter } from '../../dcs/axis'
import { comboText } from '../../dcs/combos'
import { useWords } from '../../i18n/i18n'
import { clear, listen, why } from '../../state/bindings'
import { useMapUi } from '../../state/mapUi'
import { comboIssue, issueText } from '../../state/problems'
import type { SessionState } from '../../state/session'
import type { Entry } from '../../state/types'
import { Button } from '../../ui/Button'
import { cx } from '../../ui/cx'
import { filterItems, groupRows, isMapped, type Item, type Slot } from './tree'
import styles from './Fields.module.css'
import { openTune } from './dialogs/open'
import map from './Map.module.css'

function Field({ s, entry, slot }: { s: SessionState; entry: Entry; slot: Slot }) {
  const { t, tr } = useWords()
  const { listening, addAxis, focus, flash } = useMapUi()
  const { command, kind } = slot
  const label = (
    <span className={styles.slotLabel}>
      {slot.position || t('map.action')}{kind === 'axis' && <span className={styles.axisTag}>{t('map.axisTag')}</span>}
    </span>
  )
  if (command.joystick === false) {
    return (
      <div className={styles.slot}>{label}
        <div className={styles.slotRow}><span className={cx(styles.field, styles.off)} title={t('map.notForJoystick')}>{t('map.notForJoystickShort')}</span></div>
      </div>
    )
  }
  const hash = command.hash
  const name = tr(command.name)
  const combos = entry.wanted![kind][hash] ?? []
  const active = listening?.hash === hash
  const issues = combos.map((c) => comboIssue(s, entry, c, hash))
  const problemAt = issues.findIndex(Boolean)
  const state = active ? 'listen' : !combos.length ? 'empty' : problemAt >= 0 ? 'warn' : flash === hash ? 'flash' : combos.some((c) => c.key === focus) ? 'focus' : null
  const bound = combos.map(comboText).join(', ')
  const waiting = addAxis && bound ? `${bound}, …` : t(kind === 'axis' ? 'map.moveAxisShort' : 'map.pressShort')
  const text = active ? waiting : bound || t(kind === 'axis' ? 'map.assignAxis' : 'map.assignButton')
  return (
    <div className={styles.slot}>{label}
      <div className={styles.slotRow}>
        <button type="button" className={cx(styles.field, state && styles[state])} title={name} onClick={() => listen(hash, kind, name)}>{text}</button>
        {combos.length > 0 && !active && <Button variant="icon" aria-label={t('map.clear')} onClick={() => clear(kind, hash, name)}>×</Button>}
        {kind === 'axis' && combos.length > 0 && !active && (
          <Button small tone="blue" className={styles.tune} title={t('tune.hint')} onClick={() => openTune(entry, hash)}>
            {t('tune.button')}{combos.some((c) => !isDefaultFilter(c.filter)) ? ' ●' : ''}
          </Button>
        )}
      </div>
      {problemAt >= 0 && (
        <button type="button" className={styles.problem} title={issueText(issues[problemAt]!)} onClick={() => why(combos[problemAt].key)}>{t('map.why')}</button>
      )}
    </div>
  )
}

interface SectionProps {
  s: SessionState
  entry: Entry
  id: string
  label: string
  all: Item[]
  collapsible: boolean
  onToggle?: () => void
}

export function Section({ s, entry, id, label, all, collapsible, onToggle }: SectionProps) {
  const { t, tr } = useWords()
  const filter = useMapUi((m) => m.filter)
  const scrollTo = useMapUi((m) => m.scrollTo)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (scrollTo !== id) return
    ref.current?.scrollIntoView({ block: 'start' })
    useMapUi.setState({ scrollTo: null })
  }, [scrollTo, id])
  const rows = groupRows(filterItems(s, entry, all, filter), tr)
  const mapped = all.filter((item) => isMapped(entry.wanted!, item)).length
  return (
    <section ref={ref} className={styles.sec} aria-label={label}>
      <div className={styles.head}>
        {collapsible
          ? <button type="button" className={styles.title} aria-expanded="true" onClick={onToggle}><span className={map.chev}>▾</span>{label}</button>
          : <span className={styles.title}>{label}</span>}
        <span className={cx(map.count, mapped > 0 && map.has)}>{mapped ? `${mapped} / ` : ''}{all.length}</span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className={styles.row} role="row">
          <div className={styles.control} role="cell"><strong>{row.control}</strong></div>
          <div className={styles.slots} role="cell">{row.slots.map((slot) => <Field key={slot.command.hash} s={s} entry={entry} slot={slot} />)}</div>
        </div>
      ))}
      {!rows.length && <p className={cx('muted', map.pad)}>{t('map.noCommands')}</p>}
    </section>
  )
}
