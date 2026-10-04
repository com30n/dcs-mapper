import type { ReactNode } from 'react'
import { cx } from './cx'
import styles from './Footer.module.css'

export const Footer = ({ left, children, flat }: { left?: ReactNode; children: ReactNode; flat?: boolean }) => (
  <footer className={cx(styles.bottom, flat && styles.flat)}>
    <div>{left}</div>
    <div className={styles.right}>{children}</div>
  </footer>
)
