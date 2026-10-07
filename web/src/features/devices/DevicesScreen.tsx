import { useState } from 'react'
import { useNavigate } from 'react-router'
import { sameId, templateOf } from '../../dcs/combos'
import { useWords } from '../../i18n/i18n'
import { fail } from '../../state/aircraft'
import { addFiles, toggleBuiltIn, toggleDevice, turnOn } from '../../state/devices'
import { BUILT_IN } from '../../folder/scan'
import { connectFolder } from '../../state/folder'
import { setupOf, useSession, type SessionState } from '../../state/session'
import { Button, Chip, Chips } from '../../ui/Button'
import cards from '../../ui/Card.module.css'
import { cx } from '../../ui/cx'
import { DeviceThumb } from '../../ui/DevicePicture'
import { Footer } from '../../ui/Footer'
import { ArrowIcon, KeyboardIcon, MouseIcon } from '../../ui/icons'
import { Notice } from '../../ui/Notice'
import { Page } from '../../ui/Page'
import { SearchField } from '../../ui/SearchField'
import styles from './Devices.module.css'
import { SetupCard } from './SetupCard'

function pointAt(uids: string[]) {
  if (uids.length < 2) return
  uids.map((uid) => document.getElementById(uid)).forEach((card, i) => {
    if (!i) card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    card?.animate([{ boxShadow: 'inset 0 0 0 3px var(--blue)' }, { boxShadow: 'inset 0 0 0 3px transparent' }], 1600)
  })
}

const ROLES = ['all', 'stick', 'throttle', 'pedals'] as const

function FolderNotice({ s }: { s: SessionState }) {
  const { t } = useWords()
  if (!s.folder) {
    return (
      <Notice>
        <strong>{t('devices.folder.title')}</strong><span>{t('devices.folder.why')}</span>
        <Button variant="primary" small onClick={connectFolder}>{t('devices.folder.open')}</Button>
        <span className="muted small">{t('devices.folder.private')}</span>
      </Notice>
    )
  }
  return (
    <Notice tone="ok">
      <strong>{t('devices.folder.connected')}</strong><span className="mono">{s.folder.name}</span>
      <span>{t('devices.folder.found', { devices: s.scan.devices.length, aircraft: s.scan.aircraft.length })}</span>
      {s.off.length > 0 && <span className="muted">{t('devices.folder.offSummary', { count: s.off.length })}</span>}
      <Button small onClick={connectFolder}>{t('devices.folder.change')}</Button>
    </Notice>
  )
}

function OffGroup({ s }: { s: SessionState }) {
  const { t } = useWords()
  if (!s.off.length) return null
  const aircraftWith = (name: string) => s.scan.aircraft.filter((folder) => (s.scan.bindings[folder] ?? []).some((n) => sameId(n, name)))
  return (
    <section className={styles.off} aria-labelledby="off-title">
      <h3 id="off-title">{t('devices.off.title', { count: s.off.length })}</h3>
      <span className="small">{t('devices.off.lead')}</span>
      {s.off.map((name) => {
        const folders = aircraftWith(name)
        return (
          <div key={name} className={styles.offItem}>
            <div className="stack">
              <strong>{templateOf(name)}</strong><span className="mono small">{name}</span>
              <span className="small">{folders.length ? t('devices.off.bindings', { aircraft: folders.join(', ') }) : t('devices.off.noBindings')}</span>
            </div>
            <Button small tone="ok" onClick={() => turnOn(name).catch(fail)}>{t('devices.turnOn')}</Button>
          </div>
        )
      })}
      <span className="muted small">{t('devices.off.saved')}</span>
    </section>
  )
}

export function DevicesScreen() {
  const { t, tr } = useWords()
  const s = useSession()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<(typeof ROLES)[number]>('all')
  const entries = setupOf(s).entries
  const added = new Set(entries.map((e) => e.deviceId))
  const builtIn = BUILT_IN.filter((name) => s.catalog?.profiles[name])
  const query = search.toLowerCase()
  const library = s.library.filter((d) => (role === 'all' || d.role === role) && `${d.name} ${d.dcsName}`.toLowerCase().includes(query))
  return (
    <>
      <Page fill eyebrow={`${t('step.of', { n: 2 })} · ${tr(s.catalog!.name)}`} title={t('devices.title')} lead={t('devices.lead')}>
        <div className={styles.split}>
          <section className={styles.library} aria-labelledby="lib">
            <h2 id="lib">{t('devices.library')}</h2>
            <div className={styles.toolbar}>
              <SearchField label={t('devices.search')} value={search} onChange={setSearch} />
              <Chips>{ROLES.map((r) => <Chip key={r} pressed={role === r} onClick={() => setRole(r)}>{t(`devices.filter.${r}`)}</Chip>)}</Chips>
            </div>
            <p className="muted small">{t('devices.pickHint')}</p>
            {builtIn.length > 0 && (
              <>
                <span className="eyebrow">{t('link.builtIn')}</span>
                <div className={cards.grid}>
                  {builtIn.map((name) => {
                    const on = entries.some((e) => e.dcsId === name)
                    const role = name.toLowerCase()
                    return (
                      <button key={name} type="button" className={cx(cards.card, styles.pick, on && styles.picked)} aria-pressed={on} onClick={() => toggleBuiltIn(name)}>
                        <span className={styles.builtInIcon}>{role === 'keyboard' ? <KeyboardIcon /> : <MouseIcon />}</span>
                        <span className="eyebrow">{t('link.builtIn')}</span>
                        <span className={cards.title}>{t(`role.${role}`)}</span>
                        <span className="small">{t(`devices.builtIn.${role}`)}</span>
                      </button>
                    )
                  })}
                </div>
                <span className="eyebrow">{t('devices.library')}</span>
              </>
            )}
            <div className={cards.grid}>
              {library.map((d) => (
                <button key={d.id} type="button" className={cx(cards.card, styles.pick, added.has(d.id) && styles.picked)} aria-pressed={added.has(d.id)}
                  onClick={() => { pointAt(entries.filter((e) => e.deviceId === d.id).map((e) => e.uid)); toggleDevice(d.id).catch(fail) }}>
                  <DeviceThumb device={d} />
                  <span className="eyebrow">{t(`role.${d.role}`)}</span>
                  <span className={cards.title}>{d.name}</span>
                </button>
              ))}
            </div>
            <p className="muted small">{t('devices.libraryMissing')}</p>
          </section>
          <section className={styles.yours} aria-labelledby="yours">
            <h2 id="yours">{t('devices.yours')}</h2>
            <Notice><strong>{t('link.explainTitle')}</strong><span>{t('link.explain')}</span></Notice>
            <FolderNotice s={s} />
            {entries.map((entry) => <SetupCard key={entry.uid} s={s} entry={entry} />)}
            {!entries.length && <p className="muted">{t('devices.emptySetup')}</p>}
            <OffGroup s={s} />
            <Notice as="label" className={styles.upload}>
              <strong>{t('devices.fromFile')}</strong><span>{t('devices.fromFileHint')}</span>
              <input type="file" accept=".lua" multiple onChange={(e) => addFiles([...(e.target.files ?? [])]).catch(fail)} />
            </Notice>
          </section>
        </div>
      </Page>
      <Footer left={<Button variant="link" onClick={() => navigate('/')}>{t('nav.back')}</Button>}>
        <Button variant="primary" disabled={!entries.length} onClick={() => navigate('/map')}>{t('devices.next')}<ArrowIcon /></Button>
      </Footer>
    </>
  )
}
