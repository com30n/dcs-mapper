import { gamepadsSupported, usePads } from '../../gamepad/store'
import { useWords } from '../../i18n/i18n'
import { fail } from '../../state/aircraft'
import { changePicture, removeDevice, setDcsId, setPresetFile, setStart, turnOff } from '../../state/devices'
import { candidatesFor, configFile, entryTemplate, matchingIds, padFor, presetFor, undecided } from '../../state/lookup'
import { useMapUi } from '../../state/mapUi'
import type { SessionState } from '../../state/session'
import type { Entry, Start } from '../../state/types'
import { Button } from '../../ui/Button'
import { cx } from '../../ui/cx'
import { DeviceThumb } from '../../ui/DevicePicture'
import styles from './Devices.module.css'

function LinkBox({ s, entry }: { s: SessionState; entry: Entry }) {
  const { t } = useWords()
  const pads = usePads((p) => p.pads)
  const identify = useMapUi((m) => m.identify)
  const device = s.devices[entry.deviceId]
  if (!gamepadsSupported()) return <p className="hint warn">{t('link.unsupported')}</p>
  const pad = padFor(s, entry, pads)
  const waiting = identify === entry.uid
  return (
    <div className={styles.link}>
      <span className={styles.label}>{t('link.title')}</span>
      {pad
        ? <span className="hint ok-text">{t('link.linked', { id: pad.id, n: pad.index + 1 })}</span>
        : <span className={cx('hint', waiting && 'busy-text')}>{t(waiting ? 'link.waiting' : 'link.how', { name: device.name })}</span>}
      <div className="row">
        <Button small onClick={() => useMapUi.setState({ identify: waiting ? null : entry.uid })}>
          {t(waiting ? 'map.cancel' : pad ? 'link.again' : 'link.start')}
        </Button>
      </div>
    </div>
  )
}

function StartOptions({ s, entry }: { s: SessionState; entry: Entry }) {
  const { t, tr } = useWords()
  const preset = presetFor(s, entry)
  const current = !!s.folder && !!configFile(s, entry.dcsId)
  const options: [Start, string, string, boolean][] = [
    ['preset', t('devices.start.preset'), preset
      ? t('devices.start.presetHint', { count: Object.keys(preset.keyDiffs ?? {}).length + Object.keys(preset.axisDiffs ?? {}).length })
      : t('devices.start.noPreset', { aircraft: tr(s.catalog!.name) }), !preset],
    ['current', t('devices.start.current'), current ? t('devices.start.currentHint', { folder: s.catalog!.folder }) : t('devices.start.noCurrent'), !current],
    ['file', t('devices.start.file'), entry.fileName ?? t('devices.start.fileHint'), false],
    ['empty', t('devices.start.empty'), t('devices.start.emptyHint'), false],
  ]
  return (
    <fieldset className={styles.options}>
      <legend>{t('devices.startFrom')}</legend>
      {options.map(([value, label, hint, disabled]) => (
        <label key={value} className={cx(styles.option, entry.start === value && styles.checked, disabled && styles.disabled)}>
          <input type="radio" name={`start-${entry.uid}`} value={value} checked={entry.start === value} disabled={disabled} onChange={() => setStart(entry.uid, value)} />
          <span>
            <span className={styles.optionLabel}>{label}</span>
            <span className={styles.optionHint}>{hint}</span>
            {value === 'file' && (
              <input className={styles.file} type="file" accept=".lua" aria-label={t('devices.start.file')}
                onChange={(e) => { const file = e.target.files?.[0]; if (file) setPresetFile(entry.uid, file).catch(fail) }} />
            )}
          </span>
        </label>
      ))}
    </fieldset>
  )
}

export function SetupCard({ s, entry }: { s: SessionState; entry: Entry }) {
  const { t } = useWords()
  const device = s.devices[entry.deviceId]
  const ids = matchingIds(s, device)
  const idState = entry.dcsId.includes('{') ? (ids.includes(entry.dcsId) ? 'matched' : 'typed') : 'missing'
  const name = entryTemplate(s, entry)
  const candidates = candidatesFor(s, name)
  const unsure = undecided(s, entry)
  return (
    <article id={entry.uid} className={cx(styles.setup, unsure && styles.unsure)}>
      <div className={styles.head}>
        <DeviceThumb device={device} small />
        <div className="stack"><span className="eyebrow">{t(`role.${device.role}`)}</span><strong>{device.name}</strong></div>
        <Button variant="icon" aria-label={t('devices.remove')} onClick={() => removeDevice(entry.uid)}>×</Button>
      </div>
      {candidates.length > 0 && (
        <>
          <label className={styles.label} htmlFor={`pic-${entry.uid}`}>{t('devices.picture')}</label>
          <select id={`pic-${entry.uid}`} className={cx('text', unsure && styles.choose)} value={unsure ? '?' : device.generic ? '' : device.id} onChange={(e) => changePicture(entry.uid, e.target.value).catch(fail)}>
            {unsure && <option value="?" disabled>{t('devices.choosePicture')}</option>}
            {candidates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            <option value="">{t('devices.noPicture')}</option>
          </select>
          {unsure && <span className="hint warn">{t('devices.pictureUnknown', { name })}</span>}
          {!entry.pictureChosen && !device.generic && candidates.length > 1 && <span className="hint">{t('devices.pictureHint', { name })}</span>}
        </>
      )}
      <label className={styles.label} htmlFor={`id-${entry.uid}`}>{t('devices.dcsId')}</label>
      <input key={entry.dcsId} id={`id-${entry.uid}`} className="text mono" list={`ids-${entry.uid}`} defaultValue={entry.dcsId} placeholder={`${device.dcsName} {…}`}
        onBlur={(e) => { if (e.target.value.trim() !== entry.dcsId) setDcsId(entry.uid, e.target.value) }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      <datalist id={`ids-${entry.uid}`}>{ids.map((id) => <option key={id} value={id} />)}</datalist>
      <span className={cx('hint', idState === 'missing' && 'warn')}>{t(`devices.id.${idState}`, { count: ids.length })}</span>
      <LinkBox s={s} entry={entry} />
      <StartOptions s={s} entry={entry} />
      {s.folder && entry.dcsId.includes('{') && (
        <div className={cx('row', styles.turnOff)}>
          <Button small tone="warn" onClick={() => turnOff(entry.uid)}>{t('devices.turnOff')}</Button>
          <span className="muted small">{t('devices.turnOffHint')}</span>
        </div>
      )}
    </article>
  )
}
