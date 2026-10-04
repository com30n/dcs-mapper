import i18n from 'i18next'
import { useMapUi } from './mapUi'
import { useSession, type SessionState } from './session'

type Snapshot = Pick<SessionState, 'byAircraft' | 'off' | 'pictures' | 'links' | 'active'>

interface Step {
  state: Snapshot
  label: string
}

const LIMIT = 200
const past: Step[] = []
const future: Step[] = []

function snapshot(): Snapshot {
  const { byAircraft, off, pictures, links, active } = useSession.getState()
  return { byAircraft, off, pictures, links, active }
}

export function remember() {
  past.push({ state: snapshot(), label: '' })
  if (past.length > LIMIT) past.shift()
  future.length = 0
}

export function said(toast: string) {
  if (past.length) past[past.length - 1].label = toast
  useMapUi.setState({ toast, toastAction: 'undo' })
}

export function forget() {
  past.length = 0
  future.length = 0
}

function step(from: Step[], to: Step[], done: 'undone' | 'redone') {
  const target = from.pop()
  if (!target) return
  to.push({ state: snapshot(), label: target.label })
  useSession.setState(target.state)
  useMapUi.setState({
    listening: null, dialog: null, focus: null, identify: null, flash: null,
    toast: i18n.t(target.label ? `toast.${done}` : `toast.${done}Any`, { what: target.label }),
    toastAction: done === 'undone' ? 'redo' : 'undo',
  })
}

interface KeyPress {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  target: EventTarget | null
}

const TYPING = 'input:not([type=radio]):not([type=checkbox]):not([type=button]), textarea, [contenteditable]'

export function keyAction({ key, code, ctrlKey, metaKey, altKey, shiftKey, target }: KeyPress) {
  const z = /^[a-z]$/i.test(key) ? key.toLowerCase() === 'z' : code === 'KeyZ'
  if (!(ctrlKey || metaKey) || altKey || !z) return null
  if ((target as Element | null)?.closest?.(TYPING) || useMapUi.getState().dialog) return null
  return shiftKey ? 'redo' : 'undo'
}

export const undo = () => step(past, future, 'undone')
export const redo = () => step(future, past, 'redone')
