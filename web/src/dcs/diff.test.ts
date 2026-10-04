import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { comboId } from './combos'
import { buildDiff, currentFrom, profileFor } from './diff'
import { luaFile } from './lua'
import { KINDS, type Bindings, type Catalog } from './types'

const repo = resolve(import.meta.dirname, '..', '..', '..')
const read = <T>(path: string): T => JSON.parse(readFileSync(resolve(repo, path), 'utf-8')) as T
const catalog = read<Catalog>('aircraft/F-16C_50/aircraft.json')
const applied = read<Record<string, { current: Bindings; updated: Record<string, string[]> }>>('test/fixtures/applied-F-16C_50.json')

const normalized = (bindings: Bindings) => Object.fromEntries(KINDS.map((kind) => [kind,
  Object.fromEntries(Object.entries(bindings[kind]).map(([hash, combos]) => [hash, combos.map(comboId).sort()]))]))

describe('applying ED presets', () => {
  it.each(Object.keys(applied))('gives the bindings DCS itself computes for %s', (template) => {
    const result = currentFrom(profileFor(catalog, template), catalog.presets[template])
    expect(normalized(result)).toEqual(normalized(applied[template].current))
    expect([...result.updated].sort()).toEqual([...applied[template].updated.key, ...applied[template].updated.axis].sort())
  })
})

describe('writing a diff', () => {
  it.each(Object.keys(catalog.presets))('reproduces the same bindings when read back for %s', (template) => {
    const profile = profileFor(catalog, template)
    const current = currentFrom(profile, catalog.presets[template])
    const again = currentFrom(profile, buildDiff(profile, current))
    expect(normalized(again)).toEqual(normalized(current))
  })

  it('writes two axes on one command, each with its own filter, and reads both back', () => {
    const profile = profileFor(catalog, '')
    const command = profile.commands.axis.find((c) => !profile.defaults.axis[c.hash])!
    const half = { curvature: [0], deadzone: 0, invert: false, saturationX: 1, saturationY: 0.5, slider: true }
    const pedals = [{ key: 'JOY_SLIDER1', filter: half }, { key: 'JOY_Y', filter: { ...half, invert: true } }]
    const diff = buildDiff(profile, { key: profile.defaults.key, axis: { ...profile.defaults.axis, [command.hash]: pedals } })
    expect(diff.axisDiffs?.[command.hash]?.added).toEqual(pedals)
    expect(currentFrom(profile, diff).axis[command.hash]).toEqual(pedals)
  })

  it('writes each command under the name it is given, as DCS writes the game language', () => {
    const profile = profileFor(catalog, '')
    const command = profile.commands.axis.find((c) => profile.defaults.axis[c.hash])!
    const diff = buildDiff(profile, { key: profile.defaults.key, axis: { ...profile.defaults.axis, [command.hash]: [] } }, {}, (c) => (c.hash === command.hash ? 'Тангаж' : c.name))
    expect(diff.axisDiffs?.[command.hash]?.name).toBe('Тангаж')
  })

  it('keeps removals DCS wrote for combos that are no longer defaults, unless the combo is bound again', () => {
    const profile = profileFor(catalog, '')
    const [hash, [stale]] = Object.entries(profile.defaults.axis)[0]
    const trimmed = { ...profile, defaults: { ...profile.defaults, axis: { ...profile.defaults.axis, [hash]: [] } } }
    const original = { axisDiffs: { [hash]: { name: 'Рыскание', removed: [stale] } } }
    expect(buildDiff(trimmed, trimmed.defaults, {}, undefined, original).axisDiffs?.[hash]?.removed).toEqual([{ key: stale.key }])
    const bound = { ...trimmed.defaults, axis: { ...trimmed.defaults.axis, [hash]: [{ key: stale.key }] } }
    expect(buildDiff(trimmed, bound, {}, undefined, original).axisDiffs?.[hash]?.removed).toBeUndefined()
  })

  it('ends the file the way DCS does, without a final line break', () => {
    expect(luaFile('diff', {}).endsWith('return diff')).toBe(true)
  })

  it('writes nothing for the defaults and keeps other sections', () => {
    const profile = profileFor(catalog, '')
    const diff = buildDiff(profile, profile.defaults, { ffDiffs: { shake: 0 } })
    expect(diff).toEqual({ ffDiffs: { shake: 0 } })
  })
})
