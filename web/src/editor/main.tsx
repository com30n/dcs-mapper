import '../styles/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { onPadFrame, startPads } from '../gamepad/pads'
import { initI18n } from '../i18n/i18n'
import { EditorPage } from './EditorPage'
import { loadLibrary, newDevice, openDevice, padFrame, useEditor } from './store'

const root = document.getElementById('root')!

initI18n()
  .then(loadLibrary)
  .then(() => {
    const first = useEditor.getState().library[0]
    return location.hash === '#new' || !first ? newDevice() : openDevice(first.id)
  })
  .then(() => {
    onPadFrame(padFrame)
    startPads()
    createRoot(root).render(<StrictMode><EditorPage /></StrictMode>)
  })
  .catch((error: Error) => { root.textContent = `Failed to start: ${error.message}` })
