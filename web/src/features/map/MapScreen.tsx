import * as Tabs from '@radix-ui/react-tabs'
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { inputLabel } from '../../dcs/combos'
import { forceFeedbackFor } from '../../dcs/forceFeedback'
import { useWatchPads } from '../../gamepad/poll'
import { usePads } from '../../gamepad/store'
import { useWords } from '../../i18n/i18n'
import { fail } from '../../state/aircraft'
import { selectEntry, undo } from '../../state/bindings'
import { entryProfile, entryTemplate, padFor } from '../../state/lookup'
import { cancel, useMapUi, type Filter } from '../../state/mapUi'
import { openMods } from '../../state/modifiers'
import { resetEntry } from '../../state/prepare'
import { commandsUsing, problemsOf } from '../../state/problems'
import { setupOf, useSession, type SessionState } from '../../state/session'
import type { Entry } from '../../state/types'
import { Button, Chip, Chips } from '../../ui/Button'
import { cx } from '../../ui/cx'
import { Footer } from '../../ui/Footer'
import { ArrowIcon } from '../../ui/icons'
import { SearchField } from '../../ui/SearchField'
import { Section } from './Fields'
import { categoriesOf, categoryLabel, commandsIn, filterItems, isMapped, searchResults, type Category } from './tree'
import { FfDialog } from './dialogs/FfDialog'
import { openFf } from './dialogs/open'
import { ModsDialog } from './dialogs/ModsDialog'
import { TuneDialog } from './dialogs/TuneDialog'
import { MapPicture } from './MapPicture'
import styles from './Map.module.css'
import { StatusCard } from './Status'

const FILTERS: Filter[] = ['all', 'mapped', 'free', 'problems']

function PadPill({ s, entry }: { s: SessionState; entry: Entry }) {
  const { t, tr } = useWords()
  const pads = usePads((p) => p.pads)
  const identify = useMapUi((m) => m.identify)
  const lastPressed = useMapUi((m) => m.lastPressed)
  const pad = padFor(s, entry, pads)
  const name = s.devices[entry.deviceId].name
  if (pad) {
    const using = lastPressed ? commandsUsing(s, entry, lastPressed) : []
    const what = using.length ? using.map((u) => tr(u.command.name)).join('; ') : t('map.free')
    return (
      <span className={cx(styles.pill, styles.pillOk)}>
        <i className={styles.liveDot} />
        <span>{t('map.connected')} · {lastPressed ? t('map.lastPressed', { input: inputLabel(lastPressed), what }) : t('map.pressToSee')}</span>
      </span>
    )
  }
  if (identify === entry.uid) {
    return (
      <span className={cx(styles.pill, styles.pillBusy)}>
        <span>{t('link.waiting', { name })}</span>
        <Button variant="link" small onClick={() => useMapUi.setState({ identify: null })}>{t('map.cancel')}</Button>
      </span>
    )
  }
  return (
    <span className={styles.pill}>
      <span>{t('link.none')}</span>
      <Button small onClick={() => useMapUi.setState({ identify: entry.uid })}>{t('link.start')}</Button>
    </span>
  )
}

function defaultOpen(categories: Category[]) {
  const hotas = categories.find((c) => c.name === 'HOTAS') ?? categories[0]
  return hotas ? [hotas.id] : []
}

export function MapScreen() {
  useWatchPads()
  const { t, tr } = useWords()
  const s = useSession()
  const ui = useMapUi()
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
  const entry = entries[s.active]
  if (!entry?.wanted) return null
  const device = s.devices[entry.deviceId]
  const profile = entryProfile(s, entry)
  const categories = categoriesOf(profile, tr)
  const open = ui.open ?? defaultOpen(categories)
  const narrowed = ui.filter !== 'all'
  const shown = categories.filter((c) => !narrowed || filterItems(s, entry, commandsIn(profile, c, tr), ui.filter).length)
  const total = profile.commands.key.length + profile.commands.axis.length
  const problemCount = problemsOf(s, entry).length
  const mapped = Object.keys(entry.wanted.key).length + Object.keys(entry.wanted.axis).length
  const ff = forceFeedbackFor(s.catalog!, entryTemplate(s, entry))
  const aircraft = tr(s.catalog!.name)
  const search = ui.search.trim()

  const toggle = (id: string) => {
    if (narrowed) useMapUi.setState({ scrollTo: id, search: '' })
    else if (open.includes(id)) useMapUi.setState({ open: open.filter((x) => x !== id), search: '' })
    else useMapUi.setState({ open: [...open, id], scrollTo: id, search: '' })
  }

  const listed = search ? searchResults(profile, search, tr)
    : shown.filter((c) => narrowed || open.includes(c.id)).flatMap((c) => filterItems(s, entry, commandsIn(profile, c, tr), ui.filter))
  const highlight = new Set(listed.flatMap(({ command, kind }) => (entry.wanted![kind][command.hash] ?? []).map((c) => c.key)))
  const picture = <MapPicture s={s} entry={entry} highlight={highlight} />
  const toast = ui.toast && (
    <div className={styles.toast} role="status">
      <span>{ui.toast}</span>
      {ui.undo && <Button small onClick={undo}>{t('map.undo')}</Button>}
    </div>
  )
  const dialog = ui.dialog
  return (
    <Tabs.Root className={styles.root} value={String(s.active)} onValueChange={(v) => selectEntry(Number(v))}>
      <div className={styles.contextbar}>
        <span className="eyebrow">{aircraft} · {t('map.bindTo')}</span>
        <Tabs.List className={styles.tabs}>
          {entries.map((e, i) => (
            <Tabs.Trigger key={e.uid} value={String(i)} className={styles.tab}>
              <span className="eyebrow">{t(`role.${s.devices[e.deviceId].role}`)}</span><span>{s.devices[e.deviceId].name}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className={styles.spacer} />
        <Button small tone="modifier" onClick={() => openMods()}>{t('mods.button', { count: Object.keys(setupOf(s).modifiers ?? {}).length })}</Button>
        <Button small disabled={!ff || !entry.dcsId.includes('{')} title={t(ff ? 'ff.hint' : 'ff.none', { aircraft })} onClick={() => openFf(s, entry)}>{t('ff.button')}</Button>
        <PadPill s={s} entry={entry} />
      </div>
      <Tabs.Content value={String(s.active)} asChild>
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
              <Button variant="link" small disabled={!open.length} onClick={() => useMapUi.setState({ open: [] })}>{t('map.collapseAll')}</Button>
            </div>
            <ul className={styles.tree}>
              {shown.map((category) => {
                const all = commandsIn(profile, category, tr)
                const count = all.filter((item) => isMapped(entry.wanted!, item)).length
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
                <Button variant="link" small className={styles.push} onClick={() => resetEntry(entry.uid).catch(fail)}>{t('map.reset')}</Button>
              </div>
              <StatusCard s={s} entry={entry} />
              {toast}
            </div>
            <div className={styles.sections}>
              {search
                ? <Section s={s} entry={entry} id="search" label={t('map.searchResults', { query: search })} all={searchResults(profile, search, tr)} collapsible={false} />
                : shown.filter((c) => narrowed || open.includes(c.id)).map((c) => (
                  <Section key={c.id} s={s} entry={entry} id={c.id} label={categoryLabel(c, tr)} all={commandsIn(profile, c, tr)} collapsible={!narrowed} onToggle={() => toggle(c.id)} />
                ))}
              {!search && !shown.some((c) => narrowed || open.includes(c.id)) && (
                <p className={cx('muted', styles.pad)}>{t(narrowed ? 'map.noCommands' : 'map.openHint')}</p>
              )}
            </div>
          </section>
          <aside className={styles.dock} aria-label={t('map.picture')}><h2>{device.name}</h2>{picture}</aside>
        </main>
      </Tabs.Content>
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
          <div className={styles.drawerCard}><StatusCard s={s} entry={entry} />{toast}</div>
          {picture}
        </div>
      )}
      <Footer flat left={<Button variant="link" onClick={() => navigate('/devices')}>{t('nav.back')}</Button>}>
        <span className="muted">{t('map.footer', { count: mapped, problems: problemCount })}</span>
        <Button variant="primary" onClick={() => navigate('/export')}>{t('map.next')}<ArrowIcon /></Button>
      </Footer>
      {dialog?.type === 'mods' && <ModsDialog s={s} dialog={dialog} />}
      {dialog?.type === 'tune' && <TuneDialog s={s} entry={entry} dialog={dialog} />}
      {dialog?.type === 'ff' && <FfDialog s={s} entry={entry} draft={dialog.draft} />}
    </Tabs.Root>
  )
}
