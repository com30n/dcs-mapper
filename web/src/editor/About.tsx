import type { ReactNode } from 'react'
import { pictureUrl } from '../data/load'
import type { Role } from '../data/types'
import { useWords } from '../i18n/i18n'
import { cx } from '../ui/cx'
import styles from './Editor.module.css'
import { addPictureFile, setMaker, setMeta, showPicture, useEditor } from './store'

const ROLES: Role[] = ['stick', 'throttle', 'pedals', 'panel', 'other']

export function PictureInput({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <label className={className}>
      {children}
      <input type="file" className="sr" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(e) => {
          for (const file of e.target.files ?? []) addPictureFile(file).catch((error: Error) => useEditor.setState({ message: error.message }))
          e.target.value = ''
        }} />
    </label>
  )
}

export function About() {
  const { t } = useWords()
  const s = useEditor()
  const device = s.device!
  return (
    <section className={styles.left} aria-labelledby="about">
      <div className={styles.card}>
        <h2 id="about">{t('editor.about')}</h2>
        <label className={styles.field}>{t('editor.name')}
          <input className="text" value={device.name} placeholder={t('editor.namePlaceholder')} onChange={(e) => setMeta({ name: e.target.value })} />
        </label>
        <label className={styles.field}>{t('editor.maker')}
          <input className="text" value={s.maker} placeholder={t('editor.makerPlaceholder')} disabled={!!device.id} onChange={(e) => setMaker(e.target.value)} />
        </label>
        <label className={styles.field}>{t('editor.type')}
          <select className="text" value={device.role} onChange={(e) => setMeta({ role: e.target.value as Role })}>
            {ROLES.map((role) => <option key={role} value={role}>{t(`role.${role}`)}</option>)}
          </select>
        </label>
        <label className={styles.field}>{t('editor.dcsName')}
          <input className="text mono" value={device.dcsName} placeholder={t('editor.dcsPlaceholder')} onChange={(e) => setMeta({ dcsName: e.target.value })} />
        </label>
        <span className="hint">{t('editor.dcsHint')}</span>
      </div>
      <div className={styles.card}>
        <h2>{t('editor.pictures')}</h2>
        {Object.entries(device.pictures).map(([name, picture]) => (
          <button key={name} type="button" className={cx(styles.pictureItem, s.picture === name && styles.on)} aria-pressed={s.picture === name} onClick={() => showPicture(name)}>
            <img src={pictureUrl(device, name)} alt="" />
            <span className="stack">
              <strong>{name}</strong>
              <span className="muted small">{t('editor.pictureInfo', { width: picture.size[0], height: picture.size[1], count: picture.marks?.length ?? 0 })}</span>
            </span>
          </button>
        ))}
        <PictureInput className={styles.dashedButton}>{t('editor.addPicture')}</PictureInput>
        <span className="hint">{t('editor.pictureHint')}</span>
      </div>
    </section>
  )
}
