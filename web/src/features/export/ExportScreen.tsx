import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { usePrepared } from '../../state/prepare'
import { useNavigate } from 'react-router'
import { comboText } from '../../dcs/combos'
import { useWords } from '../../i18n/i18n'
import { fail } from '../../state/aircraft'
import { comboChanges, download, downloadPreset, downloadZip, exportFiles, ffChanges, fileDiff, modifierChanges, offChanges, type Change } from '../../state/export'
import { offChanged } from '../../state/folder'
import { entryProfile, uiPath, uiProfile, userDiffPath } from '../../state/lookup'
import { issueText, problemsOf } from '../../state/problems'
import { setupOf, useSession, type SessionState } from '../../state/session'
import type { Entry } from '../../state/types'
import { Button } from '../../ui/Button'
import { cx } from '../../ui/cx'
import { Notice } from '../../ui/Notice'
import { Page } from '../../ui/Page'
import styles from './Export.module.css'
import { drawSheet, hasSheet, sheetName } from './layoutSheet'

const configPath = (path: string) => `Config\\Input\\${path.replace(/\//g, '\\')}`

function Changes({ lines }: { lines: Change[] }) {
  const { t } = useWords()
  if (!lines.length) return <span className="muted">{t('export.noChanges')}</span>
  const count = (sign: Change['sign']) => lines.filter((l) => l.sign === sign).length
  return (
    <details className={styles.diff}>
      <summary>{t('export.changes', { added: count('+'), removed: count('-') })}</summary>
      <pre className="mono">
        {lines.map((l, i) => <span key={i} className={l.sign === '+' ? styles.add : styles.del}>{`${l.sign} ${l.name}  ·  ${l.text}`}{i < lines.length - 1 ? '\n' : ''}</span>)}
      </pre>
    </details>
  )
}

function FileDiff({ path, before, after }: { path: string; before: string | null; after: string }) {
  const { t } = useWords()
  const { hunks, added, removed } = fileDiff(before, after)
  if (!hunks.length) return null
  const shown = `Saved Games\\DCS\\${configPath(path)}`
  return (
    <details className={styles.diff}>
      <summary>{t('export.fileDiff', { added, removed })}</summary>
      <div className={cx('mono', styles.fileDiff)}>
        <div className={styles.fileHead}>
          <span>− {t(before === null ? 'export.fileNew' : 'export.fileNow', { path: shown })}</span>
          <span>+ {t('export.fileZip')}</span>
        </div>
        {hunks.map((h, i) => (
          <Fragment key={i}>
            <div className={cx(styles.line, styles.hunk)}>{`@@ −${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`}</div>
            {h.lines.map((l, j) => (
              <div key={j} className={cx(styles.line, l[0] === '+' && styles.lineAdd, l[0] === '-' && styles.lineDel)}>
                <span className={styles.sign}>{l[0] === '+' ? '+' : l[0] === '-' ? '−' : ''}</span>
                <span className={styles.code}>{l.slice(1)}</span>
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </details>
  )
}

interface FileRowProps {
  s: SessionState
  texts: Map<string, string>
  role: string
  name: string
  path: string
  extra?: ReactNode
  lines: Change[]
}

const FileRow = ({ s, texts, role, name, path, extra, lines }: FileRowProps) => (
  <div className={styles.file}>
    <div className="stack"><span className="eyebrow">{role}</span><strong>{name}</strong><span className="mono small">{configPath(path)}</span></div>
    {extra}
    <Changes lines={lines} />
    {texts.has(path) && <FileDiff path={path} before={s.originals[path] ?? null} after={texts.get(path)!} />}
  </div>
)

function EntryRows({ s, entry, texts }: { s: SessionState; entry: Entry; texts: Map<string, string> }) {
  const { t, tr, trUi } = useWords()
  const device = s.devices[entry.deviceId]
  const role = t(`role.${device.role}`)
  const count = Object.keys(entry.wanted?.key ?? {}).length + Object.keys(entry.wanted?.axis ?? {}).length
  const extra = (
    <>
      <span className="muted">{t('export.bindings', { count })}</span>
      <Button small onClick={() => downloadPreset(s, entry)}>{t('export.preset')}</Button>
    </>
  )
  if (!entry.dcsId.includes('{')) {
    return (
      <div className={styles.file}>
        <div className="stack"><span className="eyebrow">{role}</span><strong>{device.name}</strong><span className="mono small">{t('export.noId')}</span></div>
        {extra}
      </div>
    )
  }
  const runtime = s.runtime[entry.uid]
  const lines = runtime && entry.wanted ? [...comboChanges(entryProfile(s, entry), runtime.installed, entry.wanted, tr), ...ffChanges(s, entry)] : []
  return (
    <>
      <FileRow s={s} texts={texts} role={role} name={device.name} path={userDiffPath(s, entry)} extra={extra} lines={lines} />
      {entry.uiChanged && runtime && (
        <FileRow s={s} texts={texts} role={t('export.allAircraft')} name={t('export.uiLayer', { device: device.name })} path={uiPath(entry)}
          lines={comboChanges(uiProfile(s, entry), runtime.uiInstalled, entry.uiWanted!, trUi)} />
      )}
    </>
  )
}

function SheetPreview({ s, entry }: { s: SessionState; entry: Entry }) {
  const { lang } = useWords()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let made: string | null = null
    let alive = true
    drawSheet(s, entry).then((blob) => {
      if (!alive) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    }).catch(fail)
    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [s, entry, lang])
  return url ? <img className={styles.sheet} src={url} alt="" /> : <div className={styles.sheet} />
}

function SheetRow({ s, entry, first }: { s: SessionState; entry: Entry; first: boolean }) {
  const { t } = useWords()
  const [open, setOpen] = useState(first)
  const device = s.devices[entry.deviceId]
  const count = Object.keys(entry.wanted?.key ?? {}).length + Object.keys(entry.wanted?.axis ?? {}).length
  const available = hasSheet(s, entry)
  return (
    <div className={styles.file}>
      <div className="stack">
        <span className="eyebrow">{t(`role.${device.role}`)}</span><strong>{device.name}</strong>
        <span className="mono small">{available ? sheetName(s, entry) : t('export.noSheet')}</span>
      </div>
      <span className="muted">{t('export.bindings', { count })}</span>
      <Button small disabled={!available} onClick={() => drawSheet(s, entry).then((blob) => download(sheetName(s, entry), blob)).catch(fail)}>
        {t('export.sheetDownload')}
      </Button>
      {available && (
        <details className={styles.diff} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary>{t('export.preview')}</summary>
          {open && <SheetPreview s={s} entry={entry} />}
        </details>
      )}
    </div>
  )
}

export function ExportScreen() {
  usePrepared()
  const { t, tr } = useWords()
  const s = useSession()
  const navigate = useNavigate()
  const setup = setupOf(s)
  const { files, skipped } = exportFiles(s)
  const texts = new Map(files)
  const problems = setup.entries.flatMap((entry) => problemsOf(s, entry))
  const aircraft = tr(s.catalog!.name)
  const withBindings = setup.entries.filter((entry) => entry.wanted)
  return (
    <Page narrow eyebrow={`${t('step.of', { n: 4 })} · ${aircraft}`} title={t('export.title')}>
      {problems.length ? (
        <Notice as="section" tone="warn" compact>
          <h2>{t('export.problems', { count: problems.length })}</h2>
          <ul className="plain">
            {problems.slice(0, 20).map((p, i) => (
              <li key={i}><strong>{tr(p.command.name)}</strong> · <span className="mono">{comboText(p.combo)}</span> — {issueText(p.issue)}</li>
            ))}
          </ul>
          <Button small onClick={() => navigate('/map')}>{t('export.fix')}</Button>
        </Notice>
      ) : <Notice as="p" tone="ok">{t('export.noProblems')}</Notice>}
      <section>
        <h2>{t('export.what')}</h2>
        <p className="hint">{t(s.folder ? 'export.comparedInstalled' : 'export.comparedDefaults')}</p>
        {setup.entries.map((entry) => <EntryRows key={entry.uid} s={s} entry={entry} texts={texts} />)}
        {texts.has(`${s.catalog!.folder}/modifiers.lua`) && (
          <FileRow s={s} texts={texts} role={aircraft} name={t('export.modifiers')} path={`${s.catalog!.folder}/modifiers.lua`} lines={modifierChanges(s)} />
        )}
        {offChanged(s) && <FileRow s={s} texts={texts} role={t('export.allAircraft')} name={t('export.offDevices')} path="disabled.lua" lines={offChanges(s)} />}
        {skipped.length > 0 && <p className="hint warn">{t('export.skipped', { count: skipped.length })}</p>}
      </section>
      <section>
        <h2>{t('export.sheets')}</h2>
        <p className="hint">{t('export.sheetsLead')}</p>
        {withBindings.map((entry, i) => <SheetRow key={entry.uid} s={s} entry={entry} first={i === 0} />)}
      </section>
      <section className={styles.save}>
        <h2>{t('export.save')}</h2>
        <Button variant="primary" disabled={!files.length} onClick={() => downloadZip(s)}>{t('export.zip')}</Button>
        <ol className={styles.install}>
          <li>{t('export.install1')}</li>
          <li>{t('export.install2')}</li>
          <li>{t('export.install3', { aircraft })}</li>
        </ol>
      </section>
    </Page>
  )
}
