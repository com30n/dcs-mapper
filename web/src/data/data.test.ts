import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Json = Record<string, any>

const REPO = resolve(import.meta.dirname, '..', '..', '..')
const INPUT = /^(JOY_BTN\d{1,3}|JOY_BTN_POV[1-4]_(U|UR|R|DR|D|DL|L|UL)|JOY_(X|Y|Z|RX|RY|RZ|SLIDER1|SLIDER2)|MOUSE_(BTN\d|X|Y|Z)|\S{1,16})$/
const ROLES = ['keyboard', 'mouse', 'other', 'panel', 'pedals', 'stick', 'throttle']
const IMAGES = ['.jpeg', '.jpg', '.png', '.svg', '.webp']
const NAME = /^[\p{L}\p{N}_][\p{L}\p{N}_ .+()&-]{0,63}$/u
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

const folders = (path: string) => readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
const isNumber = (value: unknown): value is number => typeof value === 'number'

function imageSize(data: Buffer, ext: string): [number, number] | null {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return [data.readUInt32BE(16), data.readUInt32BE(20)]
  if (data.toString('latin1', 0, 4) === 'RIFF' && data.toString('latin1', 8, 12) === 'WEBP') {
    const chunk = data.toString('latin1', 12, 16)
    if (chunk === 'VP8X') return [1 + data.readUIntLE(24, 3), 1 + data.readUIntLE(27, 3)]
    if (chunk === 'VP8L') {
      const bits = data.readUInt32LE(21)
      return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]
    }
    return [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff]
  }
  if (data[0] === 0xff && data[1] === 0xd8) {
    for (let i = 2; i + 9 <= data.length; i += 2 + data.readUInt16BE(i + 2)) {
      const marker = data[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)]
    }
  }
  if (ext === '.svg') {
    const box = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(data.toString('utf-8'))
    if (box) return [Math.round(Number(box[1])), Math.round(Number(box[2]))]
  }
  return null
}

function readJson(file: string, where: string, errors: string[]): Json | null {
  const name = file.split(/[\\/]/).pop()
  if (!existsSync(file)) {
    errors.push(`${where}: ${name} is missing`)
    return null
  }
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch (error) {
    errors.push(`${where}/${name}: not valid JSON (${(error as Error).message})`)
    return null
  }
}

function checkCrop(where: string, frame: Json, pictures: Json, errors: string[]) {
  if (!(frame.picture in pictures)) errors.push(`${where}: picture "${frame.picture}" is not listed in "pictures"`)
  const { x = 0, y = 0, w = 100, h = 100 } = frame
  if (![x, y, w, h].every(isNumber) || w <= 0 || h <= 0 || x < 0 || y < 0 || x + w > 100.001 || y + h > 100.001) {
    errors.push(`${where}: x, y, w, h are percentages of the picture and must stay inside it`)
  }
}

function checkFrame(where: string, frame: unknown, pictures: Json, errors: string[]) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return errors.push(`${where}: must be an object`)
  const view = frame as Json
  if (!('layers' in view)) return checkCrop(where, view, pictures, errors)
  const size = view.size
  if (!(Array.isArray(size) && size.length === 2 && size.every((v) => isNumber(v) && v > 0))) errors.push(`${where}: a view made of layers needs "size": [width, height]`)
  ;(view.layers ?? []).forEach((layer: Json, i: number) => {
    checkCrop(`${where} layer ${i + 1}`, layer, pictures, errors)
    const at = layer.at
    if (!(Array.isArray(at) && at.length === 3 && at.every(isNumber) && at[2] > 0)) errors.push(`${where} layer ${i + 1}: "at" is [x, y, width] in percent of the view`)
  })
}

function deviceProblems(vendor: string, name: string): string[] {
  const errors: string[] = []
  const folder = join(REPO, 'devices', vendor, name)
  const where = `devices/${vendor}/${name}`
  for (const part of [vendor, name]) {
    if (!NAME.test(part)) errors.push(`${where}: folder name "${part}" may use letters, digits, spaces and + . ( ) & - only`)
  }
  const device = readJson(join(folder, 'device.json'), where, errors)
  if (!device) return errors
  for (const key of ['name', 'role', 'dcsName', 'pictures', 'card', 'views']) {
    if (!(key in device)) errors.push(`${where}/device.json: "${key}" is missing`)
  }
  if (!ROLES.includes(device.role)) errors.push(`${where}: "role" must be one of ${ROLES.join(', ')}`)
  if ((device.dcsName ?? '').includes('{')) errors.push(`${where}: "dcsName" is the name without the {GUID} part`)
  const pictures: Json = device.pictures ?? {}
  for (const [file, picture] of Object.entries<Json>(pictures)) {
    const path = join(folder, file)
    if (!existsSync(path) || !statSync(path).isFile()) {
      errors.push(`${where}: picture "${file}" is missing`)
      continue
    }
    const ext = extname(file).toLowerCase()
    if (!IMAGES.includes(ext)) errors.push(`${where}: "${file}" must be one of ${IMAGES.join(', ')}`)
    if (statSync(path).size > MAX_IMAGE_BYTES) errors.push(`${where}: "${file}" is larger than 3 MB`)
    const actual = imageSize(readFileSync(path), ext)
    if (actual && JSON.stringify(picture.size) !== JSON.stringify(actual)) {
      errors.push(`${where}: "${file}" is ${actual[0]}x${actual[1]}, so its "size" must be [${actual[0]}, ${actual[1]}]`)
    }
    const seen = new Set<string>()
    for (const mark of picture.marks ?? []) {
      const key = mark.input ?? ''
      if (!INPUT.test(key)) errors.push(`${where}: ${file}: "${key}" is not a DCS input name`)
      if (seen.has(key)) errors.push(`${where}: ${file}: "${key}" is placed twice`)
      seen.add(key)
      if (!(isNumber(mark.x) && isNumber(mark.y) && mark.x >= -100 && mark.x <= 200 && mark.y >= -100 && mark.y <= 200)) {
        errors.push(`${where}: ${file}: "${key}" needs x and y in percent of the picture`)
      }
    }
  }
  checkFrame(`${where}: card`, device.card, pictures, errors)
  ;(device.views ?? []).forEach((view: Json, i: number) => {
    if (!view.name) errors.push(`${where}: view ${i + 1} needs a "name"`)
    checkFrame(`${where}: view "${view.name ?? i + 1}"`, view, pictures, errors)
  })
  const extra = readdirSync(folder).filter((file) => !(file in pictures) && file !== 'device.json').sort()
  if (extra.length) errors.push(`${where}: files not used by device.json: ${extra.join(', ')}`)
  return errors
}

function aircraftProblems(folder: string): string[] {
  const errors: string[] = []
  const where = `aircraft/${folder}`
  const catalog = readJson(join(REPO, 'aircraft', folder, 'aircraft.json'), where, errors)
  if (!catalog) return errors
  for (const key of ['id', 'folder', 'name', 'commands', 'defaults', 'profiles', 'presets']) {
    if (!(key in catalog)) errors.push(`${where}/aircraft.json: "${key}" is missing`)
  }
  if (catalog.folder !== folder) errors.push(`${where}: the folder must be named "${catalog.folder}"`)
  for (const kind of ['key', 'axis']) {
    if ((catalog.commands?.[kind] ?? []).some((c: Json) => !('hash' in c && 'name' in c && 'category' in c))) errors.push(`${where}: a ${kind} command lacks hash, name or category`)
  }
  if (!('' in (catalog.defaults ?? {}))) errors.push(`${where}: "defaults" needs the generic "" entry`)
  const l10n = join(REPO, 'aircraft', folder, 'l10n')
  for (const file of existsSync(l10n) ? readdirSync(l10n).sort() : []) {
    const words = readJson(join(l10n, file), `${where}/l10n`, errors)
    if (words && (Array.isArray(words) || !Object.values(words).every((v) => typeof v === 'string'))) {
      errors.push(`${where}/l10n/${file}: must map each English name to its translation`)
    }
  }
  return errors
}

function localeProblems(file: string): string[] {
  const errors: string[] = []
  const words = readJson(join(REPO, 'locales', file), 'locales', errors)
  if (!words) return errors
  for (const key of ['language.name', 'language.label']) {
    if (!words[key]) errors.push(`locales/${file}: "${key}" is missing (the language as its speakers write it, and a 2-3 letter label)`)
  }
  const english = JSON.parse(readFileSync(join(REPO, 'locales', 'en.json'), 'utf-8'))
  const unknown = Object.keys(words).filter((key) => !(key in english)).sort()
  if (unknown.length) errors.push(`locales/${file}: keys not in en.json: ${unknown.slice(0, 5).join(', ')}`)
  return errors
}

const devices = folders(join(REPO, 'devices')).flatMap((vendor) => folders(join(REPO, 'devices', vendor)).map((name) => [vendor, name]))

describe('files contributors add', () => {
  it.each(devices)('devices/%s/%s', (vendor, name) => expect(deviceProblems(vendor, name)).toEqual([]))
  it.each(folders(join(REPO, 'aircraft')))('aircraft/%s', (folder) => expect(aircraftProblems(folder)).toEqual([]))
  it.each(readdirSync(join(REPO, 'locales')).filter((file) => file.endsWith('.json')).sort())('locales/%s', (file) => expect(localeProblems(file)).toEqual([]))
})
