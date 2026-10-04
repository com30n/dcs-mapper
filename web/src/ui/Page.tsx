import type { ReactNode } from 'react'
import { cx } from './cx'
import styles from './Page.module.css'

interface PageProps {
  eyebrow: string
  title: string
  lead?: string
  narrow?: boolean
  fill?: boolean
  children: ReactNode
}

export const Page = ({ eyebrow, title, lead, narrow, fill, children }: PageProps) => (
  <main className={cx(styles.page, narrow && styles.narrow, fill && styles.fill)}>
    <p className="eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    {lead && <p className={styles.lead}>{lead}</p>}
    {children}
  </main>
)
