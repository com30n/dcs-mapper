import * as ContextMenu from '@radix-ui/react-context-menu'
import { useState, type MouseEvent, type ReactElement } from 'react'
import { cx } from './cx'
import { TickIcon } from './icons'
import { takeOffered, type MenuItem } from './offer'
import styles from './RightMenu.module.css'

interface RightMenuProps {
  children: ReactElement
  rest?: (e: MouseEvent) => MenuItem[]
}

export function RightMenu({ children, rest }: RightMenuProps) {
  const [items, setItems] = useState<MenuItem[]>([])
  const open = (e: MouseEvent) => {
    const list = [...takeOffered(e)]
    const more = rest?.(e) ?? []
    if (list.length && more.length) list.push('line')
    list.push(...more)
    if (!list.length) return e.preventDefault()
    setItems(list)
  }
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild onContextMenu={open}>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles.menu} collisionPadding={8}>
          {items.map((item, i) => item === 'line' ? <ContextMenu.Separator key={i} className={styles.line} />
            : 'turn' in item ? (
              <ContextMenu.CheckboxItem key={i} className={styles.item} checked={item.on} onCheckedChange={item.turn}>
                <span className={styles.tick}><ContextMenu.ItemIndicator><TickIcon /></ContextMenu.ItemIndicator></span>{item.label}
              </ContextMenu.CheckboxItem>
            ) : (
              <ContextMenu.Item key={i} className={cx(styles.item, item.tone && styles[item.tone])} disabled={item.disabled} onSelect={item.run}>
                <span className={styles.tick} />{item.label}
              </ContextMenu.Item>
            ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
