import { describe, expect, it } from 'vitest'
import { comboText, isAxisKey, markLabel, pictureLabel } from './combos'
import { dcsKey, KEYBOARD_ROWS } from './keyboard'

describe('keys as DCS names them', () => {
  it('turns the key pressed into its DCS name', () => {
    const names = ['KeyY', 'Digit3', 'Numpad5', 'NumpadAdd', 'NumpadEnter', 'Backspace', 'PrintScreen', 'ScrollLock', 'ContextMenu', 'BracketLeft', 'Quote', 'Backquote', 'ArrowUp', 'F10', 'Escape', 'Space'].map(dcsKey)
    expect(names).toEqual(['Y', '3', 'Num5', 'Num+', 'NumEnter', 'Back', 'SysRQ', 'Scroll', 'Apps', '[', "'", '`', 'Up', 'F10', 'Esc', 'Space'])
  })

  it('knows the modifier keys by side', () => {
    expect(['ControlLeft', 'ShiftRight', 'AltRight', 'MetaLeft'].map(dcsKey)).toEqual(['LCtrl', 'RShift', 'RAlt', 'LWin'])
    expect(dcsKey('Fn')).toBeNull()
  })

  it('draws every key DCS binds by default', () => {
    const drawn = new Set(KEYBOARD_ROWS.flat().map(([id]) => id))
    const defaults = ["'", ',', '-', '.', '/', '0', '1', '9', ';', '=', 'A', 'Back', 'Delete', 'Down', 'End', 'Enter', 'Esc', 'F1', 'F12', 'Home', 'Insert', 'Left', 'Num*', 'Num+', 'Num-', 'Num.', 'Num/', 'Num0', 'NumEnter', 'NumLock', 'PageDown', 'PageUp', 'Pause', 'Right', 'Space', 'SysRQ', 'Tab', 'Up', '[', '\\', ']', '`', 'Scroll', 'Apps', 'LCtrl', 'RWin']
    expect(defaults.filter((k) => !drawn.has(k))).toEqual([])
  })
})

describe('mouse inputs', () => {
  it('treats mouse movement and the wheel as axes', () => {
    expect(['MOUSE_X', 'MOUSE_Z', 'MOUSE_BTN3', 'JOY_X'].map(isAxisKey)).toEqual([true, true, false, true])
  })

  it('names mouse inputs the same on the mark and in its callout', () => {
    const inputs = ['MOUSE_BTN1', 'MOUSE_BTN2', 'MOUSE_BTN3', 'MOUSE_BTN4', 'MOUSE_BTN5', 'MOUSE_X', 'MOUSE_Y', 'MOUSE_Z']
    expect(inputs.map(markLabel)).toEqual(['L', 'R', 'M', '4', '5', 'X', 'Y', 'Z'])
    expect(inputs.map(pictureLabel)).toEqual(inputs.map((input) => `Mouse ${markLabel(input)}`))
  })

  it('shows a mouse binding as DCS shows it in the table', () => {
    expect(comboText({ key: 'MOUSE_BTN3', reformers: ['LAlt'] })).toBe('LAlt + MOUSE_BTN3')
  })
})
