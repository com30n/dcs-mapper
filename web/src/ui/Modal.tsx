import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import { cx } from './cx'
import styles from './Modal.module.css'

interface ModalProps {
  eyebrow: string
  title: string
  sub?: string
  size?: 'wide' | 'narrow'
  onClose: () => void
  foot: ReactNode
  children: ReactNode
}

export function Modal({ eyebrow, title, sub, size, onClose, foot, children }: ModalProps) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.back}>
          <Dialog.Content className={cx(styles.modal, size && styles[size])} onPointerDownOutside={(e) => e.preventDefault()}
            {...(sub ? {} : { 'aria-describedby': undefined })}>
            <div className={styles.head}>
              <div>
                <span className="eyebrow">{eyebrow}</span>
                <Dialog.Title>{title}</Dialog.Title>
                {sub && <Dialog.Description className="muted">{sub}</Dialog.Description>}
              </div>
              <Dialog.Close asChild><Button variant="icon" aria-label={t('map.close')}>×</Button></Dialog.Close>
            </div>
            {children}
            <div className={styles.foot}>{foot}</div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
