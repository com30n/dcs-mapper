import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from './types'
import { EMPTY_SCAN } from '../folder/scan'
import { luaFile } from '../dcs/lua'
import { genericDevice } from '../data/load'
import { addFiles, bestId, loadFromFolder, setStart, toggleDevice } from './devices'
import { catalog, entry, session, STICK } from './session.fixture'
import { setupOf, useSession } from './session'

const repo = resolve(import.meta.dirname, '..', '..', '..')
const MOZA = 'MOZA AB9 FFB Base'
const PEDALS = 'FANATEC Wheel'

const library = ['MOZA/AB9 + MH16', 'MOZA/MTQ + TQF', 'Fanatec/Pedals'].map((id) => ({ id, vendor: '', ...JSON.parse(readFileSync(resolve(repo, 'devices', id, 'device.json'), 'utf-8')) }))
const [mh16] = library
const none = genericDevice(MOZA).id

const serveRepo = (broken = '') => vi.stubGlobal('fetch', async (path: string) =>
  path.includes(encodeURIComponent(broken.split('/')[1] ?? '-')) ? new Response('', { status: 404 }) : new Response(readFileSync(resolve(repo, decodeURIComponent(path.slice(1))))))

const on = (kind: 'key' | 'axis', how: 'added' | 'changed' | 'removed', ...keys: string[]) =>
  ({ [`${kind}Diffs`]: Object.fromEntries(keys.map((key, i) => [catalog.commands[kind][i].hash, { [how]: [{ key }] }])) })

async function pictureFor(diff: object, name = STICK, broken = '') {
  serveRepo(broken)
  useSession.setState(session([], undefined, { library }))
  await addFiles([new File([luaFile('diff', diff)], `${name}.diff.lua`)])
  return setupOf(useSession.getState()).entries[0].deviceId
}

describe('which device a DCS file belongs to, by the buttons and axes it uses', () => {
  it('takes the only library device that has every button and axis the file binds', async () => {
    expect(await pictureFor(on('key', 'added', 'JOY_BTN_POV1_U', 'JOY_BTN3'))).toBe('MOZA/AB9 + MH16')
    expect(await pictureFor(on('axis', 'added', 'JOY_SLIDER2'))).toBe('MOZA/MTQ + TQF')
    expect(await pictureFor(on('key', 'changed', 'JOY_BTN30'))).toBe('MOZA/MTQ + TQF')
  })

  it('leaves the choice to the user when the file does not tell', async () => {
    expect(await pictureFor(on('key', 'added', 'JOY_BTN3'))).toBe(none)
    expect(await pictureFor({})).toBe(none)
    expect(await pictureFor(on('key', 'removed', 'JOY_BTN30'))).toBe(none)
    expect(await pictureFor(on('key', 'added', 'JOY_BTN40'), `${PEDALS} {wheel}`)).toBe(genericDevice(PEDALS).id)
  })

  it('still reads the file when one library device fails to load', async () => {
    expect(await pictureFor(on('key', 'added', 'JOY_BTN_POV1_U'), STICK, 'MOZA/MTQ + TQF')).toBe('MOZA/AB9 + MH16')
  })
})

describe('which DCS id a device from the library gets', () => {
  const stick = `${MOZA} {stick}`
  const throttle = `${MOZA} {throttle}`

  function idFor(files: Record<string, object>) {
    serveRepo()
    const read = async (path: string) => {
      const name = Object.keys(files).find((id) => path.endsWith(`/${id}.diff.lua`))
      return name ? luaFile('diff', files[name]) : null
    }
    const folder = { name: 'DCS', list: async () => [], read, log: async () => null }
    useSession.setState(session([], undefined, { library, folder, scan: { ...EMPTY_SCAN, devices: Object.keys(files), bindings: { [catalog.folder]: Object.keys(files) } } }))
    return bestId(mh16)
  }

  it('takes the id whose file only this device fits', async () => {
    expect(await idFor({ [throttle]: on('key', 'added', 'JOY_BTN30'), [stick]: on('key', 'added', 'JOY_BTN_POV1_U') })).toBe(stick)
  })

  it('leaves the id to the user when the files do not tell', async () => {
    expect(await idFor({ [stick]: {}, [throttle]: on('key', 'added', 'JOY_BTN5') })).toBe('')
    expect(await idFor({ [throttle]: on('key', 'added', 'JOY_BTN30') })).toBe('')
  })
})

describe('picking devices in the library', () => {
  it('takes the device out of the setup on the second click', async () => {
    useSession.setState(session([entry({ uid: 'a' }), entry({ uid: 'c', deviceId: 'Fanatec/Pedals', dcsId: PEDALS })], undefined, { active: 1 }))
    await toggleDevice('MOZA/AB9 + MH16')
    expect(setupOf(useSession.getState()).entries.map((e) => e.uid)).toEqual(['c'])
    expect(useSession.getState().active).toBe(0)
  })

  it('leaves it to the user which copy to take out when the setup has several', async () => {
    useSession.setState(session([entry({ uid: 'a' }), entry({ uid: 'b', dcsId: MOZA }), entry({ uid: 'c', deviceId: 'Fanatec/Pedals', dcsId: PEDALS })]))
    await toggleDevice('MOZA/AB9 + MH16')
    expect(setupOf(useSession.getState()).entries.map((e) => e.uid)).toEqual(['a', 'b', 'c'])
  })

  it('adds a device once when it is clicked again while it loads', async () => {
    vi.stubGlobal('fetch', async (path: string) => new Response(readFileSync(resolve(repo, decodeURIComponent(path.slice(1))))))
    useSession.setState(session([]))
    await Promise.all([toggleDevice('Thrustmaster/HOTAS Warthog Joystick'), toggleDevice('Thrustmaster/HOTAS Warthog Joystick')])
    expect(setupOf(useSession.getState()).entries.map((e) => e.deviceId)).toEqual(['Thrustmaster/HOTAS Warthog Joystick'])
  })
})

describe('opening the DCS folder', () => {
  const folder = { name: 'DCS', list: async () => [], read: async () => null, log: async () => null }
  const button = { [catalog.commands.key[0].hash]: [{ key: 'JOY_BTN1' }] }
  const axis = { [catalog.commands.axis[0].hash]: [{ key: 'JOY_X' }] }

  async function open(change: Partial<Entry> = {}, before = () => {}) {
    useSession.setState(session([entry({ start: 'empty', wanted: { key: {}, axis: {} }, ...change })], undefined, { folder, scan: { ...EMPTY_SCAN, bindings: { [catalog.folder]: [STICK] } } }))
    before()
    await loadFromFolder()
    const s = useSession.getState()
    return { start: setupOf(s).entries[0].start, told: s.message !== '' }
  }

  it('shows what DCS has for a device the user has not changed yet', async () => {
    expect(await open()).toEqual({ start: 'current', told: true })
  })

  it('keeps the buttons and axes the user has bound', async () => {
    expect(await open({ wanted: { key: button, axis: {} } })).toEqual({ start: 'empty', told: false })
    expect(await open({ wanted: { key: {}, axis } })).toEqual({ start: 'empty', told: false })
  })

  it('keeps the force feedback the user has tuned', async () => {
    expect(await open({ extra: { ffDiffs: { trimmer: 0.5 } } })).toEqual({ start: 'empty', told: false })
  })

  it('keeps the start the user has picked', async () => {
    expect(await open({}, () => setStart('stick', 'empty'))).toEqual({ start: 'empty', told: false })
  })

  it('keeps a preset the user has cleared', async () => {
    expect(await open({ start: 'preset' })).toEqual({ start: 'preset', told: false })
  })

  it('does not report a device that already shows what DCS has', async () => {
    expect(await open({ start: 'current', wanted: null })).toEqual({ start: 'current', told: false })
  })

  it('keeps a file the user has given before opening the map', async () => {
    expect(await open({ start: 'file', wanted: null, fileText: 'local diff = {}', fileName: 'mine.diff.lua' })).toEqual({ start: 'file', told: false })
  })
})
