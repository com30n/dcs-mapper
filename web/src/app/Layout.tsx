import { Outlet, useLocation } from 'react-router'
import { cx } from '../ui/cx'
import { Header } from './Header'
import styles from './Layout.module.css'
import { stepAt } from './steps'

export const Layout = () => (
  <div className={cx(styles.app, ['devices', 'map'].includes(stepAt(useLocation().pathname)) && styles.fixed)}>
    <Header />
    <Outlet />
  </div>
)
