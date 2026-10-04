import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { redo, undo } from '../state/history'
import { cx } from '../ui/cx'
import { Header } from './Header'
import styles from './Layout.module.css'
import { stepAt } from './steps'

const TYPING = 'input:not([type=radio]):not([type=checkbox]):not([type=button]), textarea, [contenteditable]'

export function Layout() {
  const step = stepAt(useLocation().pathname)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.code !== 'KeyZ') return
      if ((event.target as Element).closest?.(TYPING)) return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className={cx(styles.app, ['devices', 'map'].includes(step) && styles.fixed)}>
      <Header />
      <Outlet />
    </div>
  )
}
