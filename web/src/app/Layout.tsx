import { Outlet, useMatch } from 'react-router'
import { cx } from '../ui/cx'
import { Header } from './Header'
import styles from './Layout.module.css'

export const Layout = () => (
  <div className={cx(styles.app, useMatch('/map') && styles.fixed)}>
    <Header />
    <Outlet />
  </div>
)
