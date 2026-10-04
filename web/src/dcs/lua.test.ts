import { describe, expect, it } from 'vitest'
import { luaFile, parseLua } from './lua'

const written = `local diff = {
	["axisDiffs"] = {
		["a2001cdnil"] = {
			["changed"] = {
				[1] = {
					["filter"] = {
						["curvature"] = {
							[1] = 0.15,
						},
						["deadzone"] = 0,
						["invert"] = false,
						["saturationX"] = 1,
						["saturationY"] = 1,
						["slider"] = false,
					},
					["key"] = "JOY_Y",
				},
			},
			["name"] = "Тангаж",
		},
	},
	["ffDiffs"] = {
		["shake"] = 0,
	},
	["keyDiffs"] = {
		["d3002pnilu3002cd13vd1vpnilvu0"] = {
			["added"] = {
				[1] = {
					["key"] = "JOY_BTN6",
					["reformers"] = {
						[1] = "LShift",
					},
				},
			},
			["name"] = "机炮扳机 - 第二级 (按下射击) \\"x\\"",
			["removed"] = {
				[1] = {
					["key"] = "JOY_BTN1",
				},
			},
		},
	},
	["offset"] = -0.5,
	["empty"] = {},
}
return diff
`

describe('Lua tables as DCS writes them', () => {
  it('reads nested tables, sequences, numbers, booleans and non-Latin text', () => {
    const diff = parseLua(written) as Record<string, any>
    expect(diff.axisDiffs.a2001cdnil.name).toBe('Тангаж')
    expect(diff.axisDiffs.a2001cdnil.changed[0].filter.curvature).toEqual([0.15])
    expect(diff.keyDiffs['d3002pnilu3002cd13vd1vpnilvu0'].name).toBe('机炮扳机 - 第二级 (按下射击) "x"')
    expect(diff.keyDiffs['d3002pnilu3002cd13vd1vpnilvu0'].added[0].reformers).toEqual(['LShift'])
    expect(diff.ffDiffs).toEqual({ shake: 0 })
    expect(diff.offset).toBe(-0.5)
    expect(diff.empty).toEqual({})
  })

  it('writes what it reads', () => {
    const diff = parseLua(written)
    expect(parseLua(luaFile('diff', diff))).toEqual(diff)
  })

  it('writes a modifiers file DCS can read back', () => {
    const modifiers = { Paddle: { device: 'MOZA AB9 FFB Base {11111111-2222-3333-8001-444553540000}', key: 'JOY_BTN4', switch: false } }
    expect(luaFile('modifiers', modifiers)).toContain('["switch"] = false,')
    expect(parseLua(luaFile('modifiers', modifiers))).toEqual(modifiers)
  })
})
