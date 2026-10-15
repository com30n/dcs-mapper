import { describe, expect, it } from 'vitest'
import { catalog, entry, session } from '../../state/session.fixture'
import { calloutShown, keyLines } from './keyLines'

describe('labels next to the buttons', () => {
  it('keeps the labels of bound buttons while waiting for an input', () => {
    const shown = (input: string) => calloutShown(input, { focus: null, hovered: ['JOY_BTN2'], highlight: new Set(['JOY_BTN1']) })
    expect(['JOY_BTN1', 'JOY_BTN2', 'JOY_BTN3'].map(shown)).toEqual([true, true, false])
  })

  it('names the button of a binding with modifiers as short as its mark', () => {
    const command = catalog.commands.key[0]
    const e = entry({ wanted: { key: { [command.hash]: [{ key: 'JOY_BTN_POV1_UR', reformers: ['LAlt'] }] }, axis: {} } })
    expect(keyLines(session([e]), e, 'JOY_BTN_POV1_UR')).toEqual([{ text: expect.stringMatching(/^LAlt \+ POV ↗: /), tone: 'modifier' }])
  })
})
