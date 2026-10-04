import { describe, expect, it } from 'vitest'
import { assign, saveTune, selectEntry } from './bindings'
import { useMapUi } from './mapUi'
import { catalog, entry, session } from './session.fixture'
import { useSession } from './session'

const command = catalog.commands.axis[0]
const PEDALS = 'Rudder Pedals {22222222-2222-3333-4444-555555555555}'

function waitThenSwitch(pedalCommands = catalog.commands) {
  const pedals = entry({ uid: 'pedals', dcsId: PEDALS })
  useSession.setState(session([entry(), pedals], undefined, {
    catalog: { ...catalog, profiles: { 'Rudder Pedals': { commands: pedalCommands, defaults: { key: {}, axis: {} } } } },
  }))
  useMapUi.setState({ listening: { hash: command.hash, kind: 'axis', name: command.name }, drawer: true })
  selectEntry(1)
  return useMapUi.getState()
}

describe('switching devices while waiting for an input', () => {
  it('keeps waiting for the same command on the other device', () => {
    const ui = waitThenSwitch()
    expect(useSession.getState().active).toBe(1)
    expect(ui.listening).toEqual({ hash: command.hash, kind: 'axis', name: command.name })
    expect(ui.drawer).toBe(true)
  })

  it('stops waiting when the other device has no such command', () => {
    expect(waitThenSwitch({ key: catalog.commands.key, axis: [] }).listening).toBeNull()
  })
})

const LEFT_HALF = { curvature: [0], deadzone: 0, invert: false, saturationX: 1, saturationY: 0.5, slider: true }
const RIGHT_HALF = { ...LEFT_HALF, invert: true }

function moveAxisOnRudder(input: string, addAxis: boolean) {
  useSession.setState(session([entry({ wanted: { key: {}, axis: { [command.hash]: [{ key: 'JOY_SLIDER1', filter: LEFT_HALF }] } } })]))
  useMapUi.setState({ listening: { hash: command.hash, kind: 'axis', name: command.name }, addAxis })
  assign(input)
}

const rudderCombos = () => useSession.getState().byAircraft[catalog.id].entries[0].wanted!.axis[command.hash]

describe('several axes on one command, as DCS allows', () => {
  it('replaces the axis already there by default', () => {
    moveAxisOnRudder('JOY_Y', false)
    expect(rudderCombos()).toEqual([{ key: 'JOY_Y' }])
  })

  it('adds the moved axis next to the one already there when asked', () => {
    moveAxisOnRudder('JOY_Y', true)
    expect(rudderCombos()).toEqual([{ key: 'JOY_SLIDER1', filter: LEFT_HALF }, { key: 'JOY_Y' }])
    expect(useMapUi.getState().addAxis).toBe(false)
  })

  it('does not add the same axis twice', () => {
    moveAxisOnRudder('JOY_SLIDER1', true)
    expect(rudderCombos()).toEqual([{ key: 'JOY_SLIDER1' }])
  })

  it('tunes each axis of the command on its own', () => {
    moveAxisOnRudder('JOY_Y', true)
    saveTune(command.hash, [LEFT_HALF, RIGHT_HALF])
    expect(rudderCombos()).toEqual([{ key: 'JOY_SLIDER1', filter: LEFT_HALF }, { key: 'JOY_Y', filter: RIGHT_HALF }])
  })
})
