import { describe, expect, it } from 'vitest'
import type { Command, Profile } from '../../dcs/types'
import { categoriesOf, commandsIn, groupRows } from './tree'

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
