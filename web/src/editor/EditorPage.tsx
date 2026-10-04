import { useEffect, useState } from 'react'
import header from '../app/Header.module.css'
import { loadLanguages } from '../data/load'
import type { LanguageEntry } from '../data/types'
import { setLanguage, useWords } from '../i18n/i18n'
import { Button } from '../ui/Button'
import { cx } from '../ui/cx'
import { BrandIcon } from '../ui/icons'
import { About } from './About'
import styles from './Editor.module.css'
import { changeCount } from './model'
import { Side } from './Side'
import { discardDraft, downloadFolder, idOf, isDrafted, newDevice, openDevice, tryInMapper, useEditor } from './store'
import { WorkArea } from './WorkArea'

function EditorHeader() {
  const { t, lang } = useWords()
  const [languages, setLanguages] = useState<LanguageEntry[]>([])
  useEffect(() => { loadLanguages().then(setLanguages).catch(() => setLanguages([])) }, [])
  return (
    <header className={header.top}>
      <div className={header.brand}><BrandIcon /><span>{t('app.name')} <span className="muted">· {t('editor.title')}</span></span></div>
      <span className={styles.grow} />
      <a href="../" className={styles.strongLink}>{t('editor.openMapper')}</a>
      <div className={header.segmented} role="group" aria-label={t('app.language')}>
        {languages.map((l) => <button key={l.code} type="button" aria-pressed={l.code === lang} onClick={() => setLanguage(l.code)}>{l.label}</button>)}
      </div>
    </header>
  )
}

function Toolbar() {
  const { t } = useWords()
  const s = useEditor()
  const changes = changeCount(s.original, s.device)
  return (
    <div className={styles.toolbar}>
      <label htmlFor="device-pick" className="eyebrow">{t('editor.device')}</label>
      <select id="device-pick" className={cx('text', styles.devicePick)} value={s.device!.id}
        onChange={(e) => { openDevice(e.target.value).catch((error: Error) => useEditor.setState({ message: error.message })) }}>
        {!s.device!.id && <option value="">{t('editor.newDeviceOption')}</option>}
        {s.library.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <button type="button" className={styles.dashedButton} onClick={newDevice}>{t('editor.newDevice')}</button>
      <span className={styles.grow} />
      <span className={changes ? 'warn-text' : 'muted'}>{changes ? t('editor.changes', { count: changes }) : t('editor.noChanges')}</span>
    </div>
  )
}

function EditorFooter() {
  const { t } = useWords()
  const s = useEditor()
  return (
    <footer className={styles.footer}>
      <div className={styles.send}>
        <strong>{t('editor.send')}</strong>
        <span>{t('editor.sendHint', { folder: idOf(s) })}</span>
        {s.message && <span className="warn-text" role="alert">{s.message}</span>}
        {isDrafted(s) && (
          <span className="row"><span className="ok-text">{t('editor.drafted')}</span><Button variant="link" small onClick={() => { discardDraft().catch(() => undefined) }}>{t('editor.discardDraft')}</Button></span>
        )}
      </div>
      <div className="row">
        <Button onClick={() => { tryInMapper().catch(() => undefined) }}>{t('editor.try')}</Button>
        <Button variant="primary" onClick={() => { downloadFolder().catch((error: Error) => useEditor.setState({ message: error.message })) }}>{t('editor.download')}</Button>
      </div>
    </footer>
  )
}

export function EditorPage() {
  const device = useEditor((s) => s.device)
  if (!device) return null
  return (
    <div className={styles.page}>
      <EditorHeader />
      <Toolbar />
      <main className={styles.main}>
        <About />
        <WorkArea />
        <Side />
      </main>
      <EditorFooter />
    </div>
  )
}
