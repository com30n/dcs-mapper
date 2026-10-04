import { Fragment, useEffect, useRef } from 'react'
import { isDefaultFilter } from '../../dcs/axis'
import { comboId, comboText } from '../../dcs/combos'
import { useWords } from '../../i18n/i18n'
import { carry, listen, removeCombo, why } from '../../state/bindings'
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

function Field({ s, entry, slot, section }: { s: SessionState; entry: Entry; slot: Slot; section: string }) {
  const { t, tr } = useWords()
  const { command, kind } = slot
  const combos = entry.wanted![kind][command.hash] ?? []
  const active = useMapUi((m) => m.listening?.hash === command.hash)
  const addAxis = useMapUi((m) => m.listening?.hash === command.hash && m.addAxis)
  const focus = useMapUi((m) => (combos.some((c) => c.key === m.focus) ? m.focus : null))
  const flash = useMapUi((m) => m.flash === command.hash)
  const scrollHere = useMapUi((m) => m.scrollTo === `${section}|${command.hash}`)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!scrollHere) return
    ref.current?.scrollIntoView({ block: 'center' })
    useMapUi.setState({ scrollTo: null })
  }, [scrollHere])
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
  const pick = () => listen(hash, kind, name)
  if (active || !combos.length) {
    const bound = combos.map(comboText).join(', ')
    const waiting = addAxis && bound ? `${bound}, …` : t(kind === 'axis' ? 'map.moveAxisShort' : 'map.pressShort')
    return (
      <div ref={ref} className={styles.slot}>{label}
        <div className={styles.slotRow}>
          <button type="button" className={cx(styles.field, active ? styles.listen : styles.empty)} title={name} onClick={pick}>
            {active ? waiting : t(kind === 'axis' ? 'map.assignAxis' : 'map.assignButton')}
          </button>
        </div>
      </div>
    )
  }
  return (
    <div ref={ref} className={styles.slot}>{label}
      {combos.map((combo, i) => {
        const issue = comboIssue(s, entry, combo, hash)
        const state = issue ? 'warn' : flash ? 'flash' : combo.key === focus ? 'focus' : null
        const about = `${name} · ${comboText(combo)}`
        return (
          <Fragment key={comboId(combo)}>
            <div className={styles.slotRow}>
              <button type="button" className={cx(styles.field, state && styles[state])} title={name} onClick={pick}>{comboText(combo)}</button>
              {kind === 'axis' && (
                <Button small tone="blue" className={styles.tune} title={t('tune.hint')} onClick={() => openTune(entry, hash, i)}>
                  {t('tune.button')}{isDefaultFilter(combo.filter) ? '' : ' ●'}
                </Button>
              )}
              <Button small aria-label={`${t('map.copy')}: ${about}`} onClick={() => carry(kind, hash, name, combo, 'copy')}>{t('map.copy')}</Button>
              <Button small aria-label={`${t('map.move')}: ${about}`} onClick={() => carry(kind, hash, name, combo, 'move')}>{t('map.move')}</Button>
              <Button small tone="warn" aria-label={`${t('map.clearOne')}: ${about}`} onClick={() => removeCombo(kind, hash, comboId(combo), name)}>{t('map.clearOne')}</Button>
            </div>
            {issue && <button type="button" className={styles.problem} title={issueText(issue)} onClick={() => why(combo.key)}>{t('map.why')}</button>}
          </Fragment>
        )
      })}
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
          <div className={styles.slots} role="cell">{row.slots.map((slot) => <Field key={slot.command.hash} s={s} entry={entry} slot={slot} section={id} />)}</div>
        </div>
      ))}
      {!rows.length && <p className={cx('muted', map.pad)}>{t('map.noCommands')}</p>}
    </section>
  )
}
