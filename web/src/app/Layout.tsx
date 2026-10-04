import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { keyAction, redo, undo } from '../state/history'
import { cx } from '../ui/cx'
import { Header } from './Header'
import styles from './Layout.module.css'
import { stepAt } from './steps'

export function Layout() {
  const step = stepAt(useLocation().pathname)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = keyAction(event)
      if (!action) return
      event.preventDefault()
      if (action === 'redo') redo()
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
