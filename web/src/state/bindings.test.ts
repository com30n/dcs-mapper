import { describe, expect, it } from 'vitest'
import { assign, carry, listen, press, pressKey, showPicture, removeCombo, saveTune, selectEntry, why } from './bindings'
import { hoverKeys, unhover, useMapUi } from './mapUi'
import { comboId, KEYBOARD_MODIFIERS } from '../dcs/combos'
import type { Bindings, Combo, Kind } from '../dcs/types'
import { catalog, entry, session, STICK } from './session.fixture'
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

const slew = catalog.commands.axis[1]
const withPinky = { ...KEYBOARD_MODIFIERS, Pinky: { device: STICK, key: 'JOY_BTN65', switch: false } }
const axes = () => useSession.getState().byAircraft[catalog.id].entries[0].wanted!.axis

function moveXForSlew(wanted = {}) {
  useSession.setState(session([entry({ wanted: { key: {}, axis: wanted } })], withPinky))
  useMapUi.setState({ listening: { hash: slew.hash, kind: 'axis', name: slew.name }, adding: ['Pinky'], addAxis: false })
  assign('JOY_X')
}

describe('modifiers on axes, as DCS allows', () => {
  it('binds the axis with the modifiers picked for it', () => {
    moveXForSlew()
    expect(axes()[slew.hash]).toEqual([{ key: 'JOY_X', reformers: ['Pinky'] }])
  })

  it('leaves the same axis without the modifier on its own command', () => {
    moveXForSlew({ [command.hash]: [{ key: 'JOY_X' }] })
    expect(axes()[command.hash]).toEqual([{ key: 'JOY_X' }])
    expect(axes()[slew.hash]).toEqual([{ key: 'JOY_X', reformers: ['Pinky'] }])
  })
})

describe('clicking a button on the device picture', () => {
  const bound = catalog.commands.key.find((c) => c.category.length)!

  function click(input: string) {
    useSession.setState(session([entry({ wanted: { key: { [bound.hash]: [{ key: 'JOY_BTN5' }] }, axis: {} } })]))
    useMapUi.setState({ listening: null, open: [], filter: 'free', search: 'trim', focus: null, explain: false, scrollTo: null })
    press(input)
    return useMapUi.getState()
  }

  it('shows the binding in the list instead of a card', () => {
    expect(click('JOY_BTN5')).toMatchObject({ focus: 'JOY_BTN5', explain: false, open: [`key:${bound.category[0]}`], filter: 'all', search: '', scrollTo: `key:${bound.category[0]}|${bound.hash}` })
  })

  it('keeps the card for a free button, where it can become a modifier', () => {
    expect(click('JOY_BTN9')).toMatchObject({ focus: 'JOY_BTN9', open: [], scrollTo: null })
  })

  it('explains a binding that will not work in the card', () => {
    click('JOY_BTN5')
    why('JOY_BTN5')
    expect(useMapUi.getState()).toMatchObject({ focus: 'JOY_BTN5', explain: true })
  })
})

describe('copying, moving and clearing one binding', () => {
  const trim = catalog.commands.key[0]
  const other = catalog.commands.key[1]
  const keys = () => useSession.getState().byAircraft[catalog.id].entries[0].wanted!.key

  function carryTo(mode: 'copy' | 'move', wanted: Bindings, kind: Kind, hash: string, from: Combo, input: string) {
    useSession.setState(session([entry({ wanted })], withPinky))
    carry(kind, hash, 'name', from, mode)
    assign(input)
  }

  it('moves an axis with its modifier and tune to the new axis', () => {
    const from = { key: 'JOY_X', reformers: ['Pinky'], filter: LEFT_HALF }
    carryTo('move', { key: {}, axis: { [slew.hash]: [from] } }, 'axis', slew.hash, from, 'JOY_Y')
    expect(axes()[slew.hash]).toEqual([{ key: 'JOY_Y', reformers: ['Pinky'], filter: LEFT_HALF }])
    expect(useMapUi.getState().listening).toBeNull()
  })

  it('copies a binding and keeps the one it came from', () => {
    const from = { key: 'JOY_BTN5', reformers: ['Pinky'] }
    carryTo('copy', { key: { [trim.hash]: [from] }, axis: {} }, 'key', trim.hash, from, 'JOY_BTN7')
    expect(keys()[trim.hash]).toEqual([from, { key: 'JOY_BTN7', reformers: ['Pinky'] }])
  })

  it('takes the new button over from the command that had it, as assigning does', () => {
    const from = { key: 'JOY_BTN5' }
    carryTo('move', { key: { [trim.hash]: [from], [other.hash]: [{ key: 'JOY_BTN7' }] }, axis: {} }, 'key', trim.hash, from, 'JOY_BTN7')
    expect([keys()[trim.hash], keys()[other.hash]]).toEqual([[{ key: 'JOY_BTN7' }], undefined])
  })

  it('does nothing when a binding is moved or copied onto its own button', () => {
    const from = { key: 'JOY_BTN1' }
    carryTo('move', { key: { [trim.hash]: [from, { key: 'JOY_BTN2' }] }, axis: {} }, 'key', trim.hash, from, 'JOY_BTN1')
    expect([keys()[trim.hash], useMapUi.getState().toast, useMapUi.getState().listening]).toEqual([[from, { key: 'JOY_BTN2' }], null, null])
  })

  it('stops copying or moving when another device is picked', () => {
    useSession.setState(session([entry({ wanted: { key: { [trim.hash]: [{ key: 'JOY_BTN1' }] }, axis: {} } }), entry({ uid: 'pedals', dcsId: PEDALS })]))
    carry('key', trim.hash, 'name', { key: 'JOY_BTN1' }, 'move')
    selectEntry(1)
    expect(useMapUi.getState().listening).toBeNull()
  })

  it('clears only the binding asked for', () => {
    const kept = { key: 'JOY_BTN3', reformers: ['LAlt'] }
    useSession.setState(session([entry({ wanted: { key: { [trim.hash]: [{ key: 'JOY_BTN1' }, kept] }, axis: {} } })]))
    removeCombo('key', trim.hash, comboId({ key: 'JOY_BTN1' }), 'name')
    expect(keys()[trim.hash]).toEqual([kept])
  })
})

describe('a column per device', () => {
  const trim = catalog.commands.key[0]
  const bound = { key: { [trim.hash]: [{ key: 'JOY_BTN1' }] }, axis: {} }
  const two = () => useSession.setState(session([entry({ wanted: { key: {}, axis: {} } }), entry({ uid: 'pedals', dcsId: PEDALS, wanted: bound })]))
  const pedals = () => useSession.getState().byAircraft[catalog.id].entries[1].wanted!.key

  it('waits on the device of the field that was clicked', () => {
    two()
    listen(trim.hash, 'key', 'Trim', 'pedals')
    expect([useSession.getState().active, useMapUi.getState().listening?.hash]).toEqual([1, trim.hash])
    assign('JOY_BTN4')
    expect(pedals()[trim.hash]).toEqual([{ key: 'JOY_BTN4' }])
  })

  it('copies and clears on the device of the column', () => {
    two()
    carry('key', trim.hash, 'Trim', { key: 'JOY_BTN1' }, 'copy', 'pedals')
    assign('JOY_BTN2')
    expect(pedals()[trim.hash]).toEqual([{ key: 'JOY_BTN1' }, { key: 'JOY_BTN2' }])
    useSession.setState({ active: 0 })
    removeCombo('key', trim.hash, comboId({ key: 'JOY_BTN1' }), 'Trim', 'pedals')
    expect([pedals()[trim.hash], useSession.getState().active]).toEqual([[{ key: 'JOY_BTN2' }], 1])
  })
})

describe('binding keys of the keyboard', () => {
  const trim = catalog.commands.key[0]
  const keyboard = () => useSession.getState().byAircraft[catalog.id].entries[0].wanted!.key

  it('binds the key with the keyboard modifiers held', () => {
    useSession.setState(session([entry({ uid: 'kb', dcsId: 'Keyboard' })]))
    useMapUi.setState({ listening: { hash: trim.hash, kind: 'key', name: 'Trim' }, adding: [], addAxis: false })
    pressKey('Y', ['LCtrl', 'RShift'])
    expect(keyboard()[trim.hash]).toEqual([{ key: 'Y', reformers: ['LCtrl', 'RShift'] }])
  })

  it('waits for another key while only modifiers are held', () => {
    useSession.setState(session([entry({ uid: 'kb', dcsId: 'Keyboard' })]))
    useMapUi.setState({ listening: { hash: trim.hash, kind: 'key', name: 'Trim' }, adding: [], addAxis: false })
    pressKey('LCtrl', ['LCtrl'])
    expect([keyboard()[trim.hash], useMapUi.getState().listening?.hash]).toEqual([undefined, trim.hash])
  })
})

describe('the picture of the binding pointed at', () => {
  const trim = catalog.commands.key[0]

  it('stays on the last device pointed at when the pointer leaves', () => {
    hoverKeys('pedals', ['JOY_BTN1'])
    unhover('pedals')
    expect(useMapUi.getState().hover).toEqual({ uid: 'pedals', keys: [] })
  })

  it('goes back to the column being bound', () => {
    useSession.setState(session([entry(), entry({ uid: 'pedals', dcsId: PEDALS })]))
    hoverKeys('pedals', ['JOY_BTN1'])
    listen(trim.hash, 'key', 'Trim', 'stick')
    expect(useMapUi.getState().hover).toBeNull()
  })
})

describe('switching the picture from the device chips', () => {
  it('shows the picture of the device and brings its column back', () => {
    useSession.setState(session([entry(), entry({ uid: 'pedals', dcsId: PEDALS })]))
    useMapUi.setState({ hidden: ['pedals'], hover: { uid: 'stick', keys: [] } })
    showPicture('pedals')
    expect([useSession.getState().active, useMapUi.getState().hidden, useMapUi.getState().hover]).toEqual([1, [], null])
  })
})
