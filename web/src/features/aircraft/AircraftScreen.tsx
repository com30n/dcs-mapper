import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useWords } from '../../i18n/i18n'
import { chooseAircraft, fail } from '../../state/aircraft'
import { connectFolder } from '../../state/folder'
import { useSession } from '../../state/session'
import { Button } from '../../ui/Button'
import cards from '../../ui/Card.module.css'
import { cx } from '../../ui/cx'
import { Footer } from '../../ui/Footer'
import { ArrowIcon } from '../../ui/icons'
import { Notice } from '../../ui/Notice'
import { Page } from '../../ui/Page'
import { SearchField } from '../../ui/SearchField'

export function AircraftScreen() {
  const { t } = useWords()
  const s = useSession()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const query = search.toLowerCase()
  const list = s.aircraftIndex.filter((a) => `${a.name} ${a.id}`.toLowerCase().includes(query))
  const chosen = s.aircraftIndex.find((a) => a.id === s.aircraftId)
  return (
    <>
      <Page narrow eyebrow={t('step.of', { n: 1 })} title={t('aircraft.title')} lead={t('aircraft.lead')}>
        {s.folder ? (
          <Notice tone="ok"><strong>{t('load.connected', { count: s.scan.aircraft.length })}</strong><span>{t('load.pick')}</span></Notice>
        ) : (
          <Notice>
            <strong>{t('load.title')}</strong><span>{t('load.text')}</span>
            <div className="row">
              <Button variant="primary" small onClick={connectFolder}>{t('devices.folder.open')}</Button>
              <span className="muted small">{t('devices.folder.private')}</span>
            </div>
          </Notice>
        )}
        <SearchField wide label={t('aircraft.search')} value={search} onChange={setSearch} />
        <div className={cards.grid}>
          {list.map((a) => {
            const yours = (s.scan.bindings[a.folder] ?? []).length
            const selected = a.id === s.aircraftId
            return (
              <button key={a.id} type="button" className={cx(cards.card, selected && cards.selected)} aria-pressed={selected}
                onClick={() => chooseAircraft(a.id).catch(fail)}>
                <span className={cards.title}>{a.name}</span>
                <span className="mono muted">{a.id}</span>
                <span className="muted">{t('aircraft.commands', { count: a.commands })}</span>
                {yours > 0 && <span className={cards.badge}>{t('aircraft.yours', { count: yours })}</span>}
              </button>
            )
          })}
          {!list.length && <p className="muted">{t('aircraft.none')}</p>}
        </div>
        <p className="muted">{t('aircraft.missing')}</p>
      </Page>
      <Footer left={chosen && t('aircraft.selected', { name: chosen.name, count: chosen.commands })}>
        <Button variant="primary" disabled={!s.catalog} onClick={() => navigate('/devices')}>{t('aircraft.next')}<ArrowIcon /></Button>
      </Footer>
    </>
  )
}
