import type { ReactNode } from 'react'
import { cx } from './cx'
import styles from './Notice.module.css'

interface NoticeProps {
  tone?: 'ok' | 'warn'
  compact?: boolean
  as?: 'div' | 'section' | 'label' | 'p'
  className?: string
  children: ReactNode
}

export const Notice = ({ tone, compact, as: Tag = 'div', className, children }: NoticeProps) => (
  <Tag className={cx(styles.notice, tone && styles[tone], compact && styles.compact, className)}>{children}</Tag>
)

export const Alert = ({ error, children }: { error?: boolean; children: ReactNode }) => (
  <p className={cx(styles.box, error ? styles.boxError : styles.boxWarn)}>{children}</p>
)
