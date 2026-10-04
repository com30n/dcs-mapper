import { describe, expect, it } from 'vitest'
import { KEYBOARD_MODIFIERS } from '../dcs/combos'
import { catalog, entry, session, STICK, uiCatalog } from './session.fixture'
import { comboIssue, keyState, problemsOf } from './problems'

const hash = catalog.commands.key[0].hash
const uiHash = uiCatalog.commands.key[0].hash
const modifiers = { ...KEYBOARD_MODIFIERS, Shift: { device: STICK, key: 'JOY_BTN10', switch: false } }

describe('why a binding will not work', () => {
  it('flags a command DCS marks as updated', () => {
    const e = entry({ dead: [hash] })
    expect(comboIssue(session([e]), e, { key: 'JOY_BTN1' }, hash)?.code).toBe('dead')
  })

  it('flags a button that is a modifier on the same device', () => {
    const e = entry()
    expect(comboIssue(session([e], modifiers), e, { key: 'JOY_BTN10' }, hash)).toEqual({ code: 'modifierKey', name: 'Shift' })
  })

  it('flags a button the menu layer already uses', () => {
    const e = entry({ uiWanted: { key: { [uiHash]: [{ key: 'JOY_BTN3' }] }, axis: {} } })
    expect(comboIssue(session([e]), e, { key: 'JOY_BTN3' }, hash)?.code).toBe('uiLayer')
  })

  it('flags a modifier that is not defined for this aircraft', () => {
    const e = entry()
    expect(comboIssue(session([e]), e, { key: 'JOY_BTN3', reformers: ['Missing'] }, hash)).toEqual({ code: 'unknownModifier', name: 'Missing' })
  })

  it('flags a modifier whose button the menu layer takes', () => {
    const e = entry({ uiWanted: { key: { [uiHash]: [{ key: 'JOY_BTN10' }] }, axis: {} } })
    expect(comboIssue(session([e], modifiers), e, { key: 'JOY_BTN3', reformers: ['Shift'] }, hash)?.code).toBe('modifierUi')
  })

  it('treats a button used only in UI Layer as an ordinary used button', () => {
    const e = entry({ uiWanted: { key: { [uiHash]: [{ key: 'JOY_BTN25' }] }, axis: {} } })
    expect(keyState(session([e]), e, 'JOY_BTN25').kind).toBe('used')
  })

  it('marks a button as won’t work only when a binding of this aircraft clashes with UI Layer', () => {
    const e = entry({ wanted: { key: { [hash]: [{ key: 'JOY_BTN25' }] }, axis: {} }, uiWanted: { key: { [uiHash]: [{ key: 'JOY_BTN25' }] }, axis: {} } })
    expect(keyState(session([e]), e, 'JOY_BTN25').kind).toBe('warn')
    const withModifier = entry({ wanted: { key: { [hash]: [{ key: 'JOY_BTN25', reformers: ['LAlt'] }] }, axis: {} }, uiWanted: { key: { [uiHash]: [{ key: 'JOY_BTN25' }] }, axis: {} } })
    expect(keyState(session([withModifier]), withModifier, 'JOY_BTN25').kind).toBe('used')
  })

  it('finds every broken binding of a device and nothing else', () => {
    const e = entry({ wanted: { key: { [hash]: [{ key: 'JOY_BTN10' }, { key: 'JOY_BTN2' }] }, axis: {} } })
    const problems = problemsOf(session([e], modifiers), e)
    expect(problems.map((p) => [p.combo.key, p.issue.code])).toEqual([['JOY_BTN10', 'modifierKey']])
  })
})
