export type KeySpec = [id: string | null, width: number, label?: string, tall?: number]

export const KEYBOARD_ROWS: KeySpec[][] = [
  [['Esc', 1], [null, 1], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], [null, 0.5], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], [null, 0.5], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], [null, 0.5], ['SysRQ', 1, 'Prt'], ['Scroll', 1, 'Scr'], ['Pause', 1, 'Pse']],
  [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['Back', 2, 'Backspace'], [null, 0.5], ['Insert', 1, 'Ins'], ['Home', 1], ['PageUp', 1, 'PgUp'], [null, 0.5], ['NumLock', 1, 'Num'], ['Num/', 1, '/'], ['Num*', 1, '*'], ['Num-', 1, '−']],
  [['Tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5], [null, 0.5], ['Delete', 1, 'Del'], ['End', 1], ['PageDown', 1, 'PgDn'], [null, 0.5], ['Num7', 1, '7'], ['Num8', 1, '8'], ['Num9', 1, '9'], ['Num+', 1, '+', 2]],
  [['CapsLock', 1.75, 'Caps'], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['Enter', 2.25], [null, 4], ['Num4', 1, '4'], ['Num5', 1, '5'], ['Num6', 1, '6']],
  [['LShift', 2.25, 'Shift'], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['RShift', 2.75, 'Shift'], [null, 1.5], ['Up', 1, '↑'], [null, 1.5], ['Num1', 1, '1'], ['Num2', 1, '2'], ['Num3', 1, '3'], ['NumEnter', 1, 'Ent', 2]],
  [['LCtrl', 1.25, 'Ctrl'], ['LWin', 1.25, 'Win'], ['LAlt', 1.25, 'Alt'], ['Space', 6.25], ['RAlt', 1.25, 'Alt'], ['RWin', 1.25, 'Win'], ['Apps', 1.25, 'Menu'], ['RCtrl', 1.25, 'Ctrl'], [null, 0.5], ['Left', 1, '←'], ['Down', 1, '↓'], ['Right', 1, '→'], [null, 0.5], ['Num0', 2, '0'], ['Num.', 1, '.']],
]

export const KEYBOARD_WIDTH = Math.max(...KEYBOARD_ROWS.map((row) => row.reduce((n, [, width]) => n + width, 0)))

const NAMED: Record<string, string> = {
  Escape: 'Esc', Backspace: 'Back', Tab: 'Tab', Enter: 'Enter', Space: 'Space', CapsLock: 'CapsLock',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', IntlBackslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  PrintScreen: 'SysRQ', ScrollLock: 'Scroll', Pause: 'Pause', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ContextMenu: 'Apps',
  NumLock: 'NumLock', NumpadDivide: 'Num/', NumpadMultiply: 'Num*', NumpadSubtract: 'Num-', NumpadAdd: 'Num+', NumpadEnter: 'NumEnter', NumpadDecimal: 'Num.',
  ControlLeft: 'LCtrl', ControlRight: 'RCtrl', ShiftLeft: 'LShift', ShiftRight: 'RShift', AltLeft: 'LAlt', AltRight: 'RAlt', MetaLeft: 'LWin', MetaRight: 'RWin', OSLeft: 'LWin', OSRight: 'RWin',
}

export function dcsKey(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code) ?? /^Digit(\d)$/.exec(code) ?? /^(F\d{1,2})$/.exec(code)
  if (letter) return letter[1]
  const pad = /^Numpad(\d)$/.exec(code)
  if (pad) return `Num${pad[1]}`
  return NAMED[code] ?? null
}

export const KEYBOARD_MODIFIER_KEYS = ['LAlt', 'LCtrl', 'LShift', 'LWin', 'RAlt', 'RCtrl', 'RShift', 'RWin']

export const MOUSE_INPUTS = ['MOUSE_BTN1', 'MOUSE_BTN2', 'MOUSE_BTN3', 'MOUSE_BTN4', 'MOUSE_BTN5', 'MOUSE_X', 'MOUSE_Y', 'MOUSE_Z']
