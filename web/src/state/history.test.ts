import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chooseAircraft } from './aircraft'
import { DEFAULT_FILTER } from '../dcs/axis'
import { KEYBOARD_MODIFIERS } from '../dcs/combos'
import { addFiles, linkPad, setDcsId } from './devices'
import { removeModifier } from './modifiers'
import { assign, removeCombo, saveTune } from './bindings'
import { removeDevice, setStart, turnOff } from './devices'
import { comboId } from '../dcs/combos'
import { openFolder } from './folder'
import { forget, keyAction, redo, undo } from './history'
import { useMapUi } from './mapUi'
import { catalog, entry, session, STICK } from './session.fixture'
import { setupOf, useSession } from './session'

vi.mock('../i18n/i18n', async (actual) => ({ ...(await actual<object>()), loadAircraftWords: async () => {} }))

const repo = resolve(import.meta.dirname, '..', '..', '..')
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

  it('forgets the history when another aircraft is chosen', async () => {
    vi.stubGlobal('fetch', async (path: string) => new Response(readFileSync(resolve(repo, decodeURIComponent(path.slice(1))))))
    useSession.setState({ aircraftIndex: [{ id: catalog.id, folder: catalog.folder }, { id: 'UH-1H', folder: 'UH-1H' }] as never })
    bind('JOY_BTN1')
    await chooseAircraft('UH-1H')
    undo()
    expect(useSession.getState().byAircraft[catalog.id].entries[0].wanted!.key[trim.hash]).toEqual([{ key: 'JOY_BTN1' }])
  })

  it('undoes linking a gamepad as a step of its own', () => {
    bind('JOY_BTN1')
    linkPad('stick', 'pad', 1)
    undo()
    expect([setupOf(useSession.getState()).entries[0].padId, trimKeys()]).toEqual([null, [{ key: 'JOY_BTN1' }]])
  })

  it('adds no step when no file could be read', async () => {
    bind('JOY_BTN1')
    await addFiles([new File(['not lua {'], 'broken.diff.lua')])
    undo()
    expect(trimKeys()).toBeUndefined()
  })

  it('undoes typing a DCS id, removing a modifier and tuning an axis', () => {
    const axis = catalog.commands.axis[0]
    useSession.setState(session([entry({ wanted: { key: {}, axis: { [axis.hash]: [{ key: 'JOY_X' }] } } })], { ...KEYBOARD_MODIFIERS, Pinky: { device: STICK, key: 'JOY_BTN6', switch: false } }))
    setDcsId('stick', 'Other {id}')
    removeModifier('Pinky')
    saveTune(axis.hash, [{ ...DEFAULT_FILTER, deadzone: 0.2 }])
    undo()
    undo()
    undo()
    const s = useSession.getState()
    expect([setupOf(s).entries[0].dcsId, Object.keys(setupOf(s).modifiers!).includes('Pinky'), setupOf(s).entries[0].wanted!.axis[axis.hash]]).toEqual([STICK, true, [{ key: 'JOY_X' }]])
  })

  it('reads Ctrl+Z by the letter, or by its place when the layout has no Latin letters', () => {
    const press = (key: string, code: string, shiftKey = false) => keyAction({ key, code, shiftKey, ctrlKey: true, metaKey: false, altKey: false, target: null })
    expect([press('z', 'KeyZ'), press('Z', 'KeyZ', true), press('я', 'KeyZ'), press('z', 'KeyW'), press('w', 'KeyZ')]).toEqual(['undo', 'redo', 'undo', 'undo', null])
  })

  it('leaves Ctrl+Z to text fields and open dialogs', () => {
    const typing = { closest: () => ({}) } as unknown as Element
    expect(keyAction({ key: 'z', code: 'KeyZ', shiftKey: false, ctrlKey: true, metaKey: false, altKey: false, target: typing })).toBeNull()
    useMapUi.setState({ dialog: { type: 'ff', draft: {} as never } })
    expect(keyAction({ key: 'z', code: 'KeyZ', shiftKey: false, ctrlKey: true, metaKey: false, altKey: false, target: null })).toBeNull()
    useMapUi.setState({ dialog: null })
  })

  it('undoes clearing a binding', () => {
    bind('JOY_BTN1')
    removeCombo('key', trim.hash, comboId({ key: 'JOY_BTN1' }), 'Trim')
    undo()
    expect(trimKeys()).toEqual([{ key: 'JOY_BTN1' }])
  })
})
