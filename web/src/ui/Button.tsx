import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'
import { cx } from './cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'ghostDark' | 'link' | 'icon'
type Tone = 'modifier' | 'warn' | 'ok' | 'blue'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  small?: boolean
  tone?: Tone
}

export function Button({ variant = 'secondary', small, tone, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(styles[variant], small && styles.small, tone && styles[tone], className)} {...rest} />
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean
  look?: 'onDark' | 'dashed'
}

export function Chip({ pressed, look, className, type = 'button', ...rest }: ChipProps) {
  return <button type={type} aria-pressed={pressed} className={cx(styles.chip, look && styles[look], className)} {...rest} />
}

export const Chips = ({ children }: { children: ReactNode }) => <div className={styles.chips}>{children}</div>
