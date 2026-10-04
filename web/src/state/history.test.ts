import { beforeEach, describe, expect, it } from 'vitest'
import { assign, removeCombo } from './bindings'
import { removeDevice, setStart, turnOff } from './devices'
import { comboId } from '../dcs/combos'
import { openFolder } from './folder'
import { forget, redo, undo } from './history'
import { useMapUi } from './mapUi'
import { catalog, entry, session } from './session.fixture'
import { setupOf, useSession } from './session'

const trim = catalog.commands.key[0]
const trimKeys = () => setupOf(useSession.getState()).entries[0].wanted!.key[trim.hash]

function bind(input: string) {
  useMapUi.setState({ listening: { hash: trim.hash, kind: 'key', name: 'Trim' }, adding: [], addAxis: false })
  assign(input)
}

describe('undo and redo of the changes made in this visit', () => {
  beforeEach(() => {
    forget()
    useSession.setState(session([entry()]))
  })

  it('steps back and forward through the changes, newest first', () => {
    bind('JOY_BTN1')
    bind('JOY_BTN2')
    undo()
    expect(trimKeys()).toEqual([{ key: 'JOY_BTN1' }])
    undo()
    expect(trimKeys()).toBeUndefined()
    redo()
    redo()
    expect(trimKeys()).toEqual([{ key: 'JOY_BTN2' }])
  })

  it('drops what could be redone once a new change is made', () => {
    bind('JOY_BTN1')
    undo()
    bind('JOY_BTN3')
    redo()
    expect(trimKeys()).toEqual([{ key: 'JOY_BTN3' }])
  })

  it('offers redo after an undo and undo after a change', () => {
    bind('JOY_BTN1')
    expect(useMapUi.getState().toastAction).toBe('undo')
    undo()
    expect(useMapUi.getState().toastAction).toBe('redo')
  })

  it('forgets the history when the DCS folder is opened', async () => {
    bind('JOY_BTN1')
    await openFolder({ name: 'DCS', list: async () => [], read: async () => null, log: async () => null })
    useSession.setState(session([entry({ wanted: { key: { [trim.hash]: [{ key: 'JOY_BTN1' }] }, axis: {} } })]))
    undo()
    expect(trimKeys()).toEqual([{ key: 'JOY_BTN1' }])
  })

  it('brings back a device taken out of the setup', () => {
    removeDevice('stick')
    undo()
    expect(setupOf(useSession.getState()).entries.map((e) => e.uid)).toEqual(['stick'])
  })

  it('undoes a change of where a device starts from', () => {
    setStart('stick', 'preset')
    undo()
    expect(setupOf(useSession.getState()).entries[0].start).toBe('empty')
  })

  it('undoes turning a device off in DCS', () => {
    turnOff('stick')
    undo()
    expect([setupOf(useSession.getState()).entries.length, useSession.getState().off]).toEqual([1, []])
  })

  it('undoes clearing a binding', () => {
    bind('JOY_BTN1')
    removeCombo('key', trim.hash, comboId({ key: 'JOY_BTN1' }), 'Trim')
    undo()
    expect(trimKeys()).toEqual([{ key: 'JOY_BTN1' }])
  })
})
