import './styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { makeRouter } from './app/router'
import { startPolling } from './gamepad/poll'
import { initI18n } from './i18n/i18n'
import { boot } from './state/aircraft'

const root = document.getElementById('root')!

initI18n()
  .then(boot)
  .then(() => {
    startPolling()
    createRoot(root).render(<StrictMode><RouterProvider router={makeRouter()} /></StrictMode>)
  })
  .catch((error: Error) => { root.textContent = `Failed to start: ${error.message}` })
