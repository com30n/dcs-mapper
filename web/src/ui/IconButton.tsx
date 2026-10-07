import * as Tooltip from '@radix-ui/react-tooltip'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'
import styles from './IconButton.module.css'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  hint: string
  tone?: 'blue' | 'warn'
  children: ReactNode
}

const HINT_DELAY = 250

export const HintProvider = ({ children }: { children: ReactNode }) => <Tooltip.Provider delayDuration={HINT_DELAY}>{children}</Tooltip.Provider>

export function IconButton({ label, hint, tone, className, type = 'button', children, ...rest }: IconButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button type={type} aria-label={label} className={cx(styles.button, tone && styles[tone], className)} {...rest}>{children}</button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={styles.hint} sideOffset={6} collisionPadding={8}>
          {hint}
          <Tooltip.Arrow className={styles.arrow} />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
