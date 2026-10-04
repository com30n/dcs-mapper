import { describe, expect, it } from 'vitest'
import { dcsCompare, KEYBOARD_MODIFIERS } from '../dcs/combos'
import { parseLua } from '../dcs/lua'
import { profileFor } from '../dcs/diff'
import type { DcsFolder } from '../folder/folder'
import { EMPTY_SCAN } from '../folder/scan'
import { comboChanges, exportFiles, fileDiff } from './export'
import { catalog, entry, session, STICK } from './session.fixture'

const [first, second] = catalog.commands.key
const folder = { name: 'DCS' } as DcsFolder

describe('files to write', () => {
  it('writes devices with an ID and skips those without', () => {
    const s = session([entry(), entry({ uid: 'other', dcsId: '' })])
    const { files, skipped } = exportFiles(s)
    expect(files.map(([path]) => path)).toEqual([`F-16C_50/joystick/${STICK}.diff.lua`])
    expect(skipped.map((e) => e.uid)).toEqual(['other'])
  })

  it('adds modifiers.lua and the menu layer only when they changed', () => {
    const modifiers = { ...KEYBOARD_MODIFIERS, Shift: { device: STICK, key: 'JOY_BTN10', switch: true } }
    const s = session([entry({ uiChanged: true })], modifiers)
    const paths = exportFiles(s).files.map(([path]) => path)
    expect(paths).toContain('F-16C_50/modifiers.lua')
    expect(paths).toContain(`UiLayer/joystick/${STICK}.diff.lua`)
    const written = parseLua(exportFiles(s).files.find(([path]) => path.endsWith('modifiers.lua'))![1])
    expect(written).toMatchObject({ Shift: { device: STICK, key: 'JOY_BTN10', switch: true } })
  })

  it('keeps the other fields of disabled.lua when devices are turned off', () => {
    const scan = { ...EMPTY_SCAN, disabled: [], disabledFile: { pnp: true, devices: {} } }
    const s = session([], KEYBOARD_MODIFIERS, { folder, scan, off: [STICK] })
    const [, text] = exportFiles(s).files.find(([path]) => path === 'disabled.lua')!
    expect(parseLua(text)).toEqual({ pnp: true, devices: { [STICK]: true } })
  })

  it('leaves disabled.lua alone when nothing was turned on or off', () => {
    const scan = { ...EMPTY_SCAN, disabled: [STICK.toUpperCase()] }
    const s = session([], KEYBOARD_MODIFIERS, { folder, scan, off: [STICK] })
    expect(exportFiles(s).files).toEqual([])
  })
})

describe('changes shown before saving', () => {
  it('lists removed and added bindings by command', () => {
    const profile = profileFor(catalog, 'MOZA AB9 FFB Base')
    const before = { key: { [first.hash]: [{ key: 'JOY_BTN1' }] }, axis: {} }
    const after = { key: { [first.hash]: [{ key: 'JOY_BTN2' }], [second.hash]: [{ key: 'JOY_BTN3', reformers: ['LAlt'] }] }, axis: {} }
    const lines = comboChanges(profile, before, after, (text) => text)
    expect(lines).toContainEqual({ sign: '-', name: first.name, text: 'Btn 1' })
    expect(lines).toContainEqual({ sign: '+', name: first.name, text: 'Btn 2' })
    expect(lines).toContainEqual({ sign: '+', name: second.name, text: 'LAlt + Btn 3' })
  })
})

describe('file diff', () => {
  it('shows changed lines of a file with Windows line ends against the new text', () => {
    const { hunks, added, removed } = fileDiff('local diff = {\r\n\t["a"] = 1,\r\n}\r\n', 'local diff = {\n\t["a"] = 2,\n}\n')
    expect([added, removed]).toEqual([1, 1])
    expect(hunks[0].lines).toEqual([' local diff = {', '-\t["a"] = 1,', '+\t["a"] = 2,', ' }'])
  })

  it('shows a new file as added lines only', () => {
    expect(fileDiff(null, 'a\nb\n')).toMatchObject({ added: 2, removed: 0 })
  })
})

describe('DCS sort order', () => {
  it('ignores case first and puts capitals before lower case on a tie', () => {
    expect(['b', 'A', 'a', 'B'].sort(dcsCompare)).toEqual(['A', 'a', 'B', 'b'])
  })
})
