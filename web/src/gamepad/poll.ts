import { useEffect } from 'react'
import { AXES } from '../dcs/combos'
import { assign, find } from '../state/bindings'
import { linkPad } from '../state/devices'
import { useMapUi } from '../state/mapUi'
import { setupOf, useSession } from '../state/session'
import type { Entry, Listening } from '../state/types'
import { movedAxes, onPadFrame, startPads, type PadFrame, type PadState } from './pads'
import { padFor } from '../state/lookup'
import { usePads } from './store'

const watched = new Map<string, { stuck: Set<string>; live: Set<string> }>()
let listenStart: { listening: Listening; state: PadState } | null = null
let watching = false

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))

function watch(entry: Entry, now: PadState) {
  let w = watched.get(entry.uid)
  if (!w) watched.set(entry.uid, (w = { stuck: new Set(now.inputs), live: new Set() }))
  for (const input of [...w.stuck]) if (!now.inputs.has(input)) w.stuck.delete(input)
  const before = w.live
  const stuck = w.stuck
  const live = new Set([...now.inputs].filter((input) => !stuck.has(input)))
  w.live = live
  if (!sameSet(live, new Set(usePads.getState().live))) usePads.setState({ live: [...live] })
  const ui = useMapUi.getState()
  if (ui.listening && !ui.dialog) {
    if (listenStart?.listening !== ui.listening) {
      listenStart = { listening: ui.listening, state: now }
      return
    }
    const start = listenStart.state
    const found = ui.listening.kind === 'axis' ? movedAxes(now, start) : [...live].filter((input) => before.has(input) && !start.inputs.has(input))
    if (found.length) {
      listenStart = null
      assign(found[0])
    }
    return
  }
  const fresh = [...live].filter((input) => !before.has(input))
  const dialog = ui.dialog
  const picked = dialog?.type === 'mods' && dialog.adding && fresh.find((input) => input.startsWith('JOY_BTN'))
  if (picked) {
    useMapUi.setState((m) => { Object.assign(m.dialog!, { device: entry.dcsId, key: picked, name: null }) })
    return
  }
  if (fresh.length) useMapUi.setState({ lastPressed: fresh.at(-1)! })
  if (fresh.length && !dialog) find(fresh.at(-1)!)
  if (dialog?.type === 'tune') {
    const combo = entry.wanted?.axis[dialog.hash]?.[dialog.at]
    const value = combo && now.axes[AXES.indexOf(combo.key)]
    if (value !== undefined && value !== dialog.input) useMapUi.setState((m) => { if (m.dialog?.type === 'tune') m.dialog.input = value })
  }
}

function mapperFrame({ pads, states, fresh }: PadFrame) {
  const identify = useMapUi.getState().identify
  if (identify) {
    const pressed = pads.find((pad) => fresh.get(pad.index)?.some((input) => input.startsWith('JOY_BTN')))
    if (pressed) {
      linkPad(identify, pressed.id, pressed.index)
      watched.delete(identify)
      useMapUi.setState({ identify: null })
    }
  }
  const s = useSession.getState()
  const entry = setupOf(s).entries[s.active]
  const pad = watching && entry && !identify ? padFor(s, entry, usePads.getState().pads) : null
  if (entry && pad) watch(entry, states.get(pad.index)!)
}

export function startPolling() {
  onPadFrame(mapperFrame)
  startPads()
}

export function useWatchPads() {
  useEffect(() => {
    watching = true
    return () => {
      watching = false
      usePads.setState({ live: [] })
    }
  }, [])
}
