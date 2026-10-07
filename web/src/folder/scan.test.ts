import { describe, expect, it } from 'vitest'
import { fileListFolder } from './folder'
import { scanFolder } from './scan'

const STICK = 'MOZA AB9 FFB Base {11111111-2222-3333-8001-444553540000}'
const HANDBRAKE = 'Handbrake PRO {33333333-2222-3333-8001-444553540000}'

function savedGames(files: Record<string, string>) {
  return fileListFolder(Object.entries(files).map(([path, text]) => {
    const file = new File([text], path.split('/').at(-1)!)
    Object.defineProperty(file, 'webkitRelativePath', { value: `DCS/${path}` })
    return file
  }))
}

const folder = savedGames({
  [`Config/Input/F-16C_50/joystick/${STICK.toLowerCase()}.diff.lua`]: 'local diff = {} return diff',
  [`Config/Input/su-25T/joystick/${STICK}.diff.lua`]: 'local diff = {} return diff',
  [`Config/Input/su-25T/joystick/${HANDBRAKE}.diff.lua`]: 'local diff = {} return diff',
  'Config/Input/su-25T/joystick/MOZA AB9 FFB Base.diff.lua': 'local diff = {} return diff',
  'Config/Input/su-25T/keyboard/Keyboard.diff.lua': 'local diff = {} return diff',
  'Config/Input/Su-30SM/mouse/Mouse.diff.lua': 'local diff = {} return diff',
  'Config/Input/su-25T/modifiers.lua': 'local modifiers = {} return modifiers',
  'Config/Input/disabled.lua': `local disabled = {\n\t["devices"] = {\n\t\t["${HANDBRAKE}"] = true,\n\t},\n\t["pnp"] = false,\n}\nreturn disabled`,
  'Logs/dcs.log': `INPUT (Main): created [MOZA AB9 FFB Base] with full id [${STICK}],FFB`,
  'Missions/a.miz': 'x',
})

describe('reading Saved Games\\DCS', () => {
  it('finds the aircraft with bindings and the device of each file', async () => {
    const scan = await scanFolder(folder)
    expect(scan.aircraft.sort()).toEqual(['F-16C_50', 'su-25T'])
    expect(scan.bindings['su-25T'].sort()).toEqual([HANDBRAKE, STICK].sort())
  })

  it('notes the aircraft with keyboard and mouse files', async () => {
    expect((await scanFolder(folder)).builtIn).toEqual({ 'su-25T': ['Keyboard'], 'Su-30SM': ['Mouse'] })
  })

  it('names each device once, as dcs.log writes it, whatever the case in the files', async () => {
    expect((await scanFolder(folder)).devices).toEqual([HANDBRAKE, STICK])
  })

  it('keeps the devices turned off in DCS and the rest of disabled.lua', async () => {
    const scan = await scanFolder(folder)
    expect(scan.disabled).toEqual([HANDBRAKE])
    expect(scan.disabledFile?.pnp).toBe(false)
  })

  it('reads files below Config\\Input', async () => {
    expect(await folder.read('su-25T/modifiers.lua')).toContain('modifiers')
    expect(await folder.read('su-25T/missing.lua')).toBeNull()
  })

  it('refuses a folder without Config\\Input', () => {
    expect(() => fileListFolder([Object.defineProperty(new File([''], 'a.miz'), 'webkitRelativePath', { value: 'Missions/a.miz' })])).toThrow()
  })
})
