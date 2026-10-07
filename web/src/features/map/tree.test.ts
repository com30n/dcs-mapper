import { describe, expect, it } from 'vitest'
import type { Command, Profile } from '../../dcs/types'
import { categoriesOf, commandsIn, groupRows, mergeProfiles, shownItems } from './tree'

const command = (hash: string, name: string, category: string[]): Command => ({ hash, name, category })
const profile: Profile = {
  commands: {
    key: [command('a', 'Gear - Up', ['Gear']), command('b', 'Gear - Down', ['Gear']), command('c', 'autopilot', ['Systems']), command('d', 'Brakes', ['Gear'])],
    axis: [command('x', 'Pitch', [])],
  },
  defaults: { key: {}, axis: {} },
}
const same = (text: string) => text

describe('map commands', () => {
  it('puts axis commands first and sorts categories like DCS', () => {
    expect(categoriesOf(profile, same).map((c) => c.id)).toEqual(['axis', 'key:Gear', 'key:Systems'])
  })

  it('groups positions of one control into one row', () => {
    const gear = categoriesOf(profile, same)[1]
    const rows = groupRows(commandsIn(profile, gear, same), same)
    expect(rows.map((r) => [r.control, r.slots.map((s) => s.position)])).toEqual([['Brakes', ['']], ['Gear', ['Down', 'Up']]])
  })
})

describe('commands of several devices in one table', () => {
  const mouse: Profile = { commands: { key: [command('c', 'autopilot', ['Systems']), command('m', 'Visual recon', ['View'])], axis: [command('z', 'Zoom', [])] }, defaults: { key: {}, axis: {} } }

  it('lists every command any shown device has, once', () => {
    const merged = mergeProfiles([profile, mouse])
    expect([merged.commands.key.map((c) => c.hash), merged.commands.axis.map((c) => c.hash)]).toEqual([['a', 'b', 'c', 'd', 'm'], ['x', 'z']])
  })

  it('keeps a command that is mapped on any device, or free on all of them', () => {
    const items = mergeProfiles([profile, mouse]).commands.key.map((command) => ({ command, kind: 'key' as const }))
    const stick = { key: { a: [{ key: 'JOY_BTN1' }] }, axis: {} }
    const kbd = { key: { m: [{ key: 'MOUSE_BTN2' }] }, axis: {} }
    const hashes = (filter: 'mapped' | 'free') => shownItems([stick, kbd], items, filter).map((i) => i.command.hash)
    expect([hashes('mapped'), hashes('free')]).toEqual([['a', 'm'], ['b', 'c', 'd']])
  })
})
