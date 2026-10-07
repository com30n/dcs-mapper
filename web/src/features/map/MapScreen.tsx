import { useEffect, type CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { inputLabel } from '../../dcs/combos'
import { forceFeedbackFor } from '../../dcs/forceFeedback'
import { dcsKey, KEYBOARD_MODIFIER_KEYS } from '../../dcs/keyboard'
import { useWatchPads } from '../../gamepad/poll'
import { gamepadsSupported, usePads } from '../../gamepad/store'
import { useWords } from '../../i18n/i18n'
import { fail } from '../../state/aircraft'
import { pressKey, selectEntry } from '../../state/bindings'
import { redo, undo } from '../../state/history'
import { entryProfile, entryTemplate, isBuiltIn, padFor } from '../../state/lookup'
import { cancel, useMapUi, type Filter } from '../../state/mapUi'
import { openMods } from '../../state/modifiers'
import { resetEntry, usePrepared } from '../../state/prepare'
import { commandsUsing, problemsOf } from '../../state/problems'
import { setupOf, useSession, type SessionState } from '../../state/session'
import { Button, Chip, Chips } from '../../ui/Button'
import { cx } from '../../ui/cx'
import { Footer } from '../../ui/Footer'
import { IconButton } from '../../ui/IconButton'
import { ArrowIcon, ForceIcon, HideIcon, ShowIcon, TickIcon } from '../../ui/icons'
import { SearchField } from '../../ui/SearchField'
import { Section, type Column } from './Fields'
import fields from './Fields.module.css'
import { categoriesOf, categoryLabel, commandsIn, isMapped, mergeProfiles, searchResults, tableItems } from './tree'
import { FfDialog } from './dialogs/FfDialog'
import { openFf } from './dialogs/open'
import { ModsDialog } from './dialogs/ModsDialog'
import { TuneDialog } from './dialogs/TuneDialog'
import { MapPicture } from './MapPicture'
import styles from './Map.module.css'
import { StatusCard } from './Status'

const FILTERS: Filter[] = ['all', 'mapped', 'free', 'problems']

function PadPill({ s, column }: { s: SessionState; column: Column }) {
  const { t, tr } = useWords()
  const pads = usePads((p) => p.pads)
  const lastPressed = useMapUi((m) => m.lastPressed)
  if (!padFor(s, column.entry, pads)) return null
  const using = lastPressed ? commandsUsing(s, column.entry, lastPressed) : []
  const what = using.length ? using.map((u) => tr(u.command.name)).join('; ') : t('map.free')
  return (
    <span className={cx(styles.pill, styles.pillOk)}>
      <i className={styles.liveDot} />
      <span>{column.device.name} · {lastPressed ? t('map.lastPressed', { input: inputLabel(lastPressed), what }) : t('map.pressToSee')}</span>
    </span>
  )
}

function LinkState({ s, column }: { s: SessionState; column: Column }) {
  const { t } = useWords()
  const pads = usePads((p) => p.pads)
  const identify = useMapUi((m) => m.identify)
  const { entry, device } = column
  if (isBuiltIn(device)) return <span className={fields.linkText}><i className={cx(fields.linkDot, fields.builtIn)} />{t('link.builtIn')}</span>
  const pad = padFor(s, entry, pads)
  if (pad) return <span className={cx(fields.linkText, 'ok-text')} title={pad.id}><i className={cx(fields.linkDot, fields.linked)} />{t('link.short', { n: pad.index + 1 })}</span>
  if (!gamepadsSupported()) return <span className={fields.linkText} title={t('link.unsupported')}><i className={fields.linkDot} />{t('link.none')}</span>
  if (identify === entry.uid) {
    return (
      <>
        <span className={cx(fields.linkText, 'busy-text')} title={t('link.waiting', { name: device.name })}>{t('link.waitingShort')}</span>
        <Button variant="link" small className={fields.push} onClick={() => useMapUi.setState({ identify: null })}>{t('map.cancel')}</Button>
      </>
    )
  }
  return (
    <>
      <span className={fields.linkText}><i className={fields.linkDot} />{t('link.none')}</span>
      <Button small className={cx(fields.push, fields.linkButton)} title={t('link.how', { name: device.name })} onClick={() => useMapUi.setState({ identify: entry.uid })}>{t('link.start')}</Button>
    </>
  )
}

function ColumnHeads({ s, columns }: { s: SessionState; columns: Column[] }) {
  const { t, tr } = useWords()
  const aircraft = tr(s.catalog!.name)
  return (
    <div ref={measureHeads} className={fields.heads} role="row">
      <div className={cx(fields.name, fields.headName)} role="columnheader"><span className="eyebrow">{t('map.command')}</span></div>
      {columns.map((column) => {
        const { entry, device, index, active } = column
        const ff = forceFeedbackFor(s.catalog!, entryTemplate(s, entry))
        return (
          <div key={entry.uid} className={cx(fields.colHead, active && fields.activeHead)} role="columnheader">
            <button type="button" className={fields.colName} aria-pressed={active} title={t('map.showPicture', { name: device.name })} onClick={() => selectEntry(index)}>
              <span className="eyebrow">{t(`role.${device.role}`)}</span>
              <strong>{device.name}</strong>
            </button>
            <div className={fields.linkRow}>
              <LinkState s={s} column={column} />
              {ff && entry.dcsId.includes('{') && (
                <IconButton tone="blue" className={fields.push} label={`${t('ff.button')}: ${device.name}`} hint={t('ff.hint', { aircraft })}
                  onClick={() => { selectEntry(index); openFf(useSession.getState(), entry) }}><ForceIcon /></IconButton>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Dialogs({ s, column }: { s: SessionState; column: Column }) {
  const dialog = useMapUi((m) => m.dialog)
  if (dialog?.type === 'mods') return <ModsDialog s={s} dialog={dialog} />
  if (dialog?.type === 'tune') return <TuneDialog s={s} entry={column.entry} dialog={dialog} />
  if (dialog?.type === 'ff') return <FfDialog s={s} entry={column.entry} draft={dialog.draft} />
  return null
}

function useKeyCapture(on: boolean) {
  useEffect(() => {
    if (!on) return
    const held = new Set<string>()
    const down = (event: KeyboardEvent) => {
      const key = dcsKey(event.code)
      if (!key || event.key === 'Escape' || useMapUi.getState().dialog) return
      event.preventDefault()
      event.stopPropagation()
      if (KEYBOARD_MODIFIER_KEYS.includes(key)) held.add(key)
      else if (!event.repeat) pressKey(key, [...held])
    }
    const up = (event: KeyboardEvent) => { const key = dcsKey(event.code); if (key) held.delete(key) }
    const blur = () => held.clear()
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
      window.removeEventListener('blur', blur)
    }
  }, [on])
}

function measureHeads(el: HTMLDivElement | null) {
  if (!el) return
  const observer = new ResizeObserver(() => el.parentElement?.style.setProperty('--heads', `${el.offsetHeight}px`))
  observer.observe(el)
  return () => observer.disconnect()
}

export function MapScreen() {
  useWatchPads()
  const { t, tr } = useWords()
  const s = useSession()
  const ui = useMapUi(useShallow((m) => ({ filter: m.filter, open: m.open, search: m.search, toast: m.toast, toastAction: m.toastAction, drawer: m.drawer, listening: m.listening, hidden: m.hidden, dock: m.dock })))
  usePrepared()
  useKeyCapture(!!ui.listening && s.devices[setupOf(s).entries[s.active]?.deviceId ?? '']?.role === 'keyboard')
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const m = useMapUi.getState()
      if (event.key === 'Escape' && !m.dialog && (m.listening || m.drawer)) cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const entries = setupOf(s).entries
  useEffect(() => {
    if (!entries.length) navigate('/devices')
  }, [entries.length, navigate])
  const visible = entries.some((e) => !ui.hidden.includes(e.uid)) ? entries.filter((e) => !ui.hidden.includes(e.uid)) : entries
  const activeEntry = entries[s.active]
  useEffect(() => {
    if (activeEntry && !visible.includes(activeEntry)) selectEntry(entries.indexOf(visible[0]))
  })
  if (!activeEntry?.wanted || visible.some((e) => !e.wanted)) return null
  const columns: Column[] = visible.map((entry) => ({ entry, index: entries.indexOf(entry), active: entry === activeEntry, profile: entryProfile(s, entry), device: s.devices[entry.deviceId] }))
  const column = columns.find((c) => c.active) ?? { entry: activeEntry, index: s.active, active: true, profile: entryProfile(s, activeEntry), device: s.devices[activeEntry.deviceId] }
  const shownEntries = columns.map((c) => c.entry)
  const profile = mergeProfiles(columns.map((c) => c.profile))
  const categories = categoriesOf(profile, tr)
  const open = ui.open ?? categories.map((c) => c.id)
  const narrowed = ui.filter !== 'all'
  const shown = categories.filter((c) => !narrowed || tableItems(s, shownEntries, commandsIn(profile, c, tr), ui.filter).length)
  const total = profile.commands.key.length + profile.commands.axis.length
  const problemCount = shownEntries.reduce((n, e) => n + problemsOf(s, e).length, 0)
  const mapped = shownEntries.reduce((n, e) => n + Object.keys(e.wanted!.key).length + Object.keys(e.wanted!.axis).length, 0)
  const aircraft = tr(s.catalog!.name)
  const search = ui.search.trim()
  const device = column.device

  const toggle = (id: string) => {
    if (narrowed) useMapUi.setState({ scrollTo: id, search: '' })
    else if (open.includes(id)) useMapUi.setState({ open: open.filter((x) => x !== id), search: '' })
    else useMapUi.setState({ open: [...open, id], scrollTo: id, search: '' })
  }
  const toggleShown = (uid: string) => useMapUi.setState((m) => { m.hidden = m.hidden.includes(uid) ? m.hidden.filter((x) => x !== uid) : [...m.hidden, uid] })

  const listed = search ? searchResults(profile, search, tr)
    : shown.filter((c) => narrowed || open.includes(c.id)).flatMap((c) => tableItems(s, shownEntries, commandsIn(profile, c, tr), ui.filter))
  const highlight = new Set(listed.flatMap(({ command, kind }) => (activeEntry.wanted![kind][command.hash] ?? []).map((c) => c.key)))
  const picture = <MapPicture s={s} entry={activeEntry} highlight={highlight} />
  const toast = ui.toast && (
    <div className={styles.toast} role="status">
      <span>{ui.toast}</span>
      {ui.toastAction && <Button small onClick={ui.toastAction === 'undo' ? undo : redo}>{t(ui.toastAction === 'undo' ? 'map.undo' : 'map.redo')}</Button>}
    </div>
  )
  const tableStyle = { '--cols': columns.length } as CSSProperties
  return (
    <div className={cx(styles.root, !ui.dock && styles.dockHidden)}>
      <div className={styles.contextbar}>
        <span className="eyebrow">{aircraft} · {t('map.show')}</span>
        <div className={styles.tabs} role="group" aria-label={t('map.shownDevices')}>
          {entries.map((e) => {
            const on = visible.includes(e)
            const d = s.devices[e.deviceId]
            return (
              <button key={e.uid} type="button" className={styles.tab} aria-pressed={on} disabled={on && visible.length === 1} onClick={() => toggleShown(e.uid)}>
                <span className={styles.tick}>{on && <TickIcon />}</span>
                <span className="eyebrow">{t(`role.${d.role}`)}</span><span>{d.name}</span>
              </button>
            )
          })}
        </div>
        <div className={styles.spacer} />
        <Button small tone="modifier" onClick={() => openMods()}>{t('mods.button', { count: Object.keys(setupOf(s).modifiers ?? {}).length })}</Button>
        <PadPill s={s} column={column} />
        <Button small className={styles.showDock} onClick={() => useMapUi.setState({ dock: true })}><ShowIcon />{t('map.showDock')}</Button>
      </div>
      <main className={styles.grid}>
        <nav className={styles.nav} aria-label={t('map.categories')}>
          <SearchField label={t('map.search', { count: total })} value={ui.search} onChange={(value) => useMapUi.setState({ search: value })} />
          <Chips>
            {FILTERS.map((f) => (
              <Chip key={f} pressed={ui.filter === f} onClick={() => useMapUi.setState({ filter: f })}>
                {t(`map.filter.${f}`, f === 'problems' ? { count: problemCount } : undefined)}
              </Chip>
            ))}
          </Chips>
          <div className={styles.navHead}>
            <span className="eyebrow">{t('map.categoriesAsInDcs')}</span>
            <span className={styles.navActions}>
              <Button variant="link" small disabled={open.length === categories.length} onClick={() => useMapUi.setState({ open: null })}>{t('map.selectAll')}</Button>
              <Button variant="link" small disabled={!open.length} onClick={() => useMapUi.setState({ open: [] })}>{t('map.selectNone')}</Button>
            </span>
          </div>
          <ul className={styles.tree}>
            {shown.map((category) => {
              const all = commandsIn(profile, category, tr)
              const count = all.filter((item) => shownEntries.some((e) => isMapped(e.wanted!, item))).length
              const isOpen = narrowed || open.includes(category.id)
              return (
                <li key={category.id}>
                  <button type="button" className={cx(styles.node, isOpen && styles.open)} aria-expanded={isOpen} onClick={() => toggle(category.id)}>
                    <span className={styles.chev}>{isOpen ? '▾' : '▸'}</span>
                    <span className={styles.nodeName}>{categoryLabel(category, tr)}</span>
                    <span className={cx(styles.count, count > 0 && styles.has)}>{count ? `${count} / ` : ''}{all.length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <section className={styles.center} aria-labelledby="map-title">
          <div className={styles.top}>
            <h1 id="map-title" className="sr">{t('step.map')}</h1>
            <div className={styles.howto}>
              <span><b>1</b>{t('map.how1')}</span><span><b>2</b>{t('map.how2')}</span><span className="muted">{t('map.how3')}</span>
              <Button variant="link" small className={styles.push} onClick={() => resetEntry(activeEntry.uid).catch(fail)}>{t('map.reset', { name: device.name })}</Button>
            </div>
            <StatusCard s={s} entry={activeEntry} />
            {toast}
          </div>
          <div className={styles.sections} role="table" aria-label={t('map.table')}>
            <div className={fields.table} style={tableStyle}>
              <ColumnHeads s={s} columns={columns} />
              {search
                ? <Section s={s} columns={columns} id="search" label={t('map.searchResults', { query: search })} all={searchResults(profile, search, tr)} collapsible={false} />
                : shown.filter((c) => narrowed || open.includes(c.id)).map((c) => (
                  <Section key={c.id} s={s} columns={columns} id={c.id} label={categoryLabel(c, tr)} all={commandsIn(profile, c, tr)} collapsible={!narrowed} onToggle={() => toggle(c.id)} />
                ))}
              {!search && !shown.some((c) => narrowed || open.includes(c.id)) && (
                <p className={cx('muted', styles.pad)}>{t(narrowed ? 'map.noCommands' : 'map.openHint')}</p>
              )}
            </div>
          </div>
        </section>
        <aside className={styles.dock} aria-label={t('map.picture')}>
          <div className={styles.drawerHead}>
            <div><span className="eyebrow">{t(`role.${device.role}`)} · {t('map.usedLast')}</span><h2>{device.name}</h2></div>
            <Button small onClick={() => useMapUi.setState({ dock: false })}><HideIcon />{t('map.hideDock')}</Button>
          </div>
          {picture}
        </aside>
      </main>
      <button type="button" className={styles.drawerTab} aria-expanded={ui.drawer} onClick={() => useMapUi.setState({ drawer: !ui.drawer })}>{t('map.picture')}</button>
      {ui.drawer && (
        <div className={styles.drawer} role="dialog" aria-label={t('map.picture')}>
          <div className={styles.drawerHead}>
            <div>
              <h2>{device.name}</h2>
              <span className="muted">{t(!ui.listening ? 'map.drawerLook' : ui.listening.kind === 'axis' ? 'map.drawerAxis' : 'map.drawerButton', { name: ui.listening?.name ?? '' })}</span>
            </div>
            <Button variant="icon" aria-label={t('map.close')} onClick={() => useMapUi.setState({ drawer: false })}>›</Button>
          </div>
          <div className={styles.drawerCard}><StatusCard s={s} entry={activeEntry} />{toast}</div>
          {picture}
        </div>
      )}
      <Footer flat left={<Button variant="link" onClick={() => navigate('/devices')}>{t('nav.back')}</Button>}>
        <span className="muted">{t('map.footer', { count: mapped, problems: problemCount })}</span>
        <Button variant="primary" onClick={() => navigate('/export')}>{t('map.next')}<ArrowIcon /></Button>
      </Footer>
      <Dialogs s={s} column={column} />
    </div>
  )
}
