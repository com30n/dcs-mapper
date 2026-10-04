import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Entry } from './types'
import { EMPTY_SCAN } from '../folder/scan'
import { luaFile } from '../dcs/lua'
import { genericDevice } from '../data/load'
import { addFiles, bestId, changePicture, loadFromFolder, setDcsId, setStart, toggleDevice } from './devices'
import { undecided } from './lookup'
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

describe('one DCS id is one device in every aircraft', () => {
  const id = `${MOZA} {base}`
  const other = 'UH-1H'

  function open(files: Record<string, object>, elsewhere: Entry[] = [], nameIn: Record<string, string> = {}) {
    serveRepo()
    const read = async (path: string) => {
      const aircraft = Object.keys(files).find((a) => path === `${a}/joystick/${nameIn[a] ?? id}.diff.lua`)
      return aircraft ? luaFile('diff', files[aircraft]) : null
    }
    const folder = { name: 'DCS', list: async () => [], read, log: async () => null }
    const base = session([], undefined, { library, folder, scan: { ...EMPTY_SCAN, devices: [id], bindings: Object.fromEntries(Object.keys(files).map((a) => [a, [nameIn[a] ?? id]])) } })
    useSession.setState({ ...base, byAircraft: { ...base.byAircraft, [other]: { ...base.byAircraft[catalog.id], entries: elsewhere } } })
    return loadFromFolder().then(() => setupOf(useSession.getState()).entries[0])
  }

  it('reads the files of every aircraft in the folder', async () => {
    expect((await open({ [catalog.folder]: {}, [other]: on('key', 'added', 'JOY_BTN30') })).deviceId).toBe('MOZA/MTQ + TQF')
    expect((await open({ [catalog.folder]: {}, [other]: on('key', 'added', 'JOY_BTN30') }, [], { [other]: `${MOZA} {BASE}` })).deviceId).toBe('MOZA/MTQ + TQF')
  })

  it('keeps the device the user chose for the id in another aircraft', async () => {
    const loaded = await open({ [catalog.folder]: {} }, [entry({ uid: 'there', dcsId: id, deviceId: 'MOZA/MTQ + TQF', pictureChosen: true })])
    expect(loaded.deviceId).toBe('MOZA/MTQ + TQF')
    expect(loaded.pictureChosen).toBe(true)
  })

  it('keeps no picture when the user chose none in another aircraft', async () => {
    const loaded = await open({ [catalog.folder]: on('key', 'added', 'JOY_BTN30') }, [entry({ uid: 'there', dcsId: id, deviceId: none, generic: MOZA, pictureChosen: true })])
    expect([loaded.deviceId, undecided(useSession.getState(), loaded)]).toEqual([none, false])
  })

  it('keeps the work in other aircraft when the device is chosen here', async () => {
    const work = { key: { [catalog.commands.key[0].hash]: [{ key: 'JOY_BTN1' }] }, axis: {} }
    const loaded = await open({ [catalog.folder]: {} }, [entry({ uid: 'there', dcsId: id, deviceId: none, generic: MOZA, start: 'preset', ready: 'built', wanted: work })])
    await changePicture(loaded.uid, 'MOZA/MTQ + TQF')
    const there = useSession.getState().byAircraft[other].entries[0]
    expect([there.deviceId, there.pictureChosen, there.start, there.ready, there.wanted]).toEqual(['MOZA/MTQ + TQF', true, 'preset', 'built', work])
  })

  it('takes a device added from the library as the choice in every aircraft', async () => {
    await open({ [catalog.folder]: {} }, [entry({ uid: 'there', dcsId: id, deviceId: none, generic: MOZA })])
    useSession.setState((s) => ({ byAircraft: { ...s.byAircraft, [catalog.id]: { ...s.byAircraft[catalog.id], entries: [] } } }))
    await toggleDevice('MOZA/AB9 + MH16')
    const s = useSession.getState()
    expect(Object.values(s.byAircraft).flatMap((a) => a.entries).map((e) => [e.dcsId, e.deviceId, undecided(s, e)])).toEqual([[id, 'MOZA/AB9 + MH16', false], [id, 'MOZA/AB9 + MH16', false]])
  })

  it('rebuilds a preset start here when the chosen device has no preset', async () => {
    const loaded = await open({ [catalog.folder]: {} })
    useSession.setState((s) => { const e = s.byAircraft[catalog.id].entries[0]; return { byAircraft: { ...s.byAircraft, [catalog.id]: { ...s.byAircraft[catalog.id], entries: [{ ...e, start: 'preset', ready: 'built' }] } } } })
    await changePicture(loaded.uid, 'MOZA/MTQ + TQF')
    const here = setupOf(useSession.getState()).entries[0]
    expect([here.start, here.ready]).toEqual(['empty', null])
  })

  it('takes a DCS id the user types for a picked device as the choice in every aircraft', async () => {
    await open({ [catalog.folder]: {} }, [entry({ uid: 'there', dcsId: id, deviceId: 'MOZA/MTQ + TQF', pictureChosen: true })])
    useSession.setState((s) => ({ byAircraft: { ...s.byAircraft, [catalog.id]: { ...s.byAircraft[catalog.id], entries: [entry({ uid: 'here', dcsId: '', pictureChosen: true })] } } }))
    setDcsId('here', id)
    expect(useSession.getState().byAircraft[other].entries[0].deviceId).toBe('MOZA/AB9 + MH16')
  })

  it('keeps the work of another copy of the id in this aircraft', async () => {
    const work = { key: { [catalog.commands.key[0].hash]: [{ key: 'JOY_BTN1' }] }, axis: {} }
    await open({ [catalog.folder]: {} })
    const copies = [entry({ uid: 'edited', dcsId: id, deviceId: none, generic: MOZA, ready: 'built', wanted: work }), entry({ uid: 'picked', dcsId: id, deviceId: none, generic: MOZA })]
    useSession.setState((s) => ({ byAircraft: { ...s.byAircraft, [catalog.id]: { ...s.byAircraft[catalog.id], entries: copies } } }))
    await changePicture('picked', 'MOZA/MTQ + TQF')
    const edited = setupOf(useSession.getState()).entries[0]
    expect([edited.deviceId, edited.ready, edited.wanted]).toEqual(['MOZA/MTQ + TQF', 'built', work])
  })

  it('does not pass a picked device on to an id of another device', async () => {
    const warthog = 'Throttle - HOTAS Warthog {lever}'
    await open({ [catalog.folder]: {} }, [entry({ uid: 'there', dcsId: warthog, deviceId: 'Thrustmaster/HOTAS Warthog Throttle', pictureChosen: true })])
    useSession.setState((s) => ({ byAircraft: { ...s.byAircraft, [catalog.id]: { ...s.byAircraft[catalog.id], entries: [entry({ uid: 'here', dcsId: '', pictureChosen: true })] } } }))
    setDcsId('here', warthog)
    expect(useSession.getState().byAircraft[other].entries[0].deviceId).toBe('Thrustmaster/HOTAS Warthog Throttle')
    expect(setupOf(useSession.getState()).entries[0].pictureChosen).toBe(false)
  })

  it('tells devices apart only by a DCS id with its GUID', async () => {
    await open({ [catalog.folder]: {} })
    const picked = [entry({ uid: 'stick', dcsId: '', pictureChosen: true }), entry({ uid: 'throttle', dcsId: '', deviceId: 'MOZA/MTQ + TQF', pictureChosen: true })]
    useSession.setState((s) => ({ devices: { ...s.devices, 'MOZA/MTQ + TQF': library[1] }, byAircraft: { ...s.byAircraft, [catalog.id]: { ...s.byAircraft[catalog.id], entries: picked } } }))
    setDcsId('stick', MOZA)
    setDcsId('throttle', MOZA)
    expect(setupOf(useSession.getState()).entries.map((e) => e.deviceId)).toEqual(['MOZA/AB9 + MH16', 'MOZA/MTQ + TQF'])
    setDcsId('stick', '')
    await addFiles([new File([luaFile('diff', on('key', 'added', 'JOY_BTN_POV1_U'))], `${MOZA}.diff.lua`)])
    expect(setupOf(useSession.getState()).entries[2].deviceId).toBe('MOZA/AB9 + MH16')
  })

  it('stops asking once the DCS name has no devices to choose from', () => {
    const unknown = entry({ dcsId: 'Handbrake PRO {brake}', deviceId: none, generic: MOZA })
    expect(undecided(session([unknown], undefined, { library }), unknown)).toBe(false)
  })

  it('asks which device it is until the user chooses, then uses the choice everywhere', async () => {
    const loaded = await open({ [catalog.folder]: {} }, [entry({ uid: 'there', dcsId: id, deviceId: none, generic: MOZA })])
    expect(undecided(useSession.getState(), loaded)).toBe(true)
    await changePicture(loaded.uid, 'MOZA/MTQ + TQF')
    const s = useSession.getState()
    expect(Object.values(s.byAircraft).flatMap((a) => a.entries).map((e) => [e.deviceId, undecided(s, e)])).toEqual([['MOZA/MTQ + TQF', false], ['MOZA/MTQ + TQF', false]])
  })

  it('takes no picture as a choice too', async () => {
    const loaded = await open({ [catalog.folder]: {} })
    await changePicture(loaded.uid, '')
    expect(undecided(useSession.getState(), setupOf(useSession.getState()).entries[0])).toBe(false)
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
