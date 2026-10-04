import { useLocation, useNavigate } from 'react-router'
import { useWords } from '../i18n/i18n'
import { changeLanguage } from '../state/aircraft'
import { useSession } from '../state/session'
import { cx } from '../ui/cx'
import { BrandIcon } from '../ui/icons'
import styles from './Header.module.css'
import { pathOf, stepAt, stepAvailable, STEPS } from './steps'

export function Header() {
  const { t, lang } = useWords()
  const s = useSession()
  const navigate = useNavigate()
  const current = STEPS.indexOf(stepAt(useLocation().pathname))
  return (
    <>
      <header className={styles.top}>
        <div className={styles.brand}><BrandIcon /><span>{t('app.name')} <span className="muted">{t('app.for')}</span></span></div>
        <nav className={styles.steps} aria-label={t('step.label')}>
          {STEPS.map((step, i) => (
            <button key={step} type="button" className={cx(styles.step, i === current && styles.current, i < current && styles.done)}
              disabled={!stepAvailable(s, step)} aria-current={i === current ? 'step' : undefined} onClick={() => navigate(pathOf(step))}>
              <span className={styles.num}>{i < current ? '✓' : i + 1}</span>{t(`step.${step}`)}
            </button>
          ))}
        </nav>
        <div className={styles.segmented} role="group" aria-label={t('app.language')}>
          {s.languages.map((l) => (
            <button key={l.code} type="button" aria-pressed={l.code === lang} onClick={() => changeLanguage(l.code)}>{l.label}</button>
          ))}
        </div>
      </header>
      {s.message && <div className={styles.banner} role="status">{s.message}</div>}
    </>
  )
}
