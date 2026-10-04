import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Catalog, DeviceDiff } from '../dcs/types'
import { roleOf } from './devices'
import { catalog, entry, session } from './session.fixture'
import { useSession } from './session'

const repo = resolve(import.meta.dirname, '..', '..', '..')
const huey = JSON.parse(readFileSync(resolve(repo, 'aircraft/UH-1H/aircraft.json'), 'utf-8')) as Catalog
const STICK = 'MOZA AB9 FFB Base'
const THROTTLE = 'MOZA AB9 FFB Base'
const PEDALS = 'FANATEC Wheel'

const removed = (key: string) => ({ removed: [{ key }] })
const added = (key: string) => ({ added: [{ key }] })

function roleIn(aircraft: Catalog, diff: DeviceDiff, name: string) {
  useSession.setState(session([entry()], undefined, { catalog: aircraft, aircraftId: aircraft.id }))
  return roleOf(diff, name)
}

describe('which device a DCS file belongs to, by the axes DCS assigns its commands', () => {
  it('takes the cyclic of a helicopter for a stick', () => {
    expect(roleIn(huey, {}, STICK)).toBe('stick')
  })

  it('takes the collective, which DCS assigns as thrust, for a throttle', () => {
    expect(roleIn(huey, { axisDiffs: { a2001cdnil: removed('JOY_Y'), a2002cdnil: removed('JOY_X'), a2087cdnil: added('JOY_RX') } }, THROTTLE)).toBe('throttle')
  })

  it('takes the rudder for pedals', () => {
    const diff = { axisDiffs: { a2001cdnil: removed('JOY_Y'), a2002cdnil: removed('JOY_X'), a2087cdnil: removed('JOY_Z'), a2003cdnil: { ...added('JOY_SLIDER1'), ...removed('JOY_RZ') } } }
    expect(roleIn(huey, diff, PEDALS)).toBe('pedals')
  })

  it('takes the stick of an aeroplane for a stick', () => {
    expect(roleIn(catalog, {}, STICK)).toBe('stick')
  })
})
