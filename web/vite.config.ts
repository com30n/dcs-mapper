import { cpSync, createReadStream, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const REPO = resolve(import.meta.dirname, '..')
const DATA = ['aircraft', 'devices', 'locales']
const UI_LAYER = 'UiLayer'
const TYPES: Record<string, string> = { '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' }

type Json = Record<string, any>

const read = (path: string): Json => JSON.parse(readFileSync(path, 'utf-8'))
const byName = (a: string, b: string) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0)
const folders = (path: string) => readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(byName)

function cardPictures(device: Json) {
  const card = device.card ?? {}
  const names: string[] = card.layers?.length ? card.layers.map((layer: Json) => layer.picture) : [card.picture]
  return Object.fromEntries(names.filter(Boolean).map((name) => [name, { size: device.pictures[name].size }]))
}

const indexes: Record<string, () => Json[]> = {
  devices: () => folders(join(REPO, 'devices')).flatMap((vendor) => folders(join(REPO, 'devices', vendor))
    .filter((name) => existsSync(join(REPO, 'devices', vendor, name, 'device.json')))
    .map((name) => {
      const device = read(join(REPO, 'devices', vendor, name, 'device.json'))
      return { id: `${vendor}/${name}`, vendor, name: device.name, role: device.role, dcsName: device.dcsName, card: device.card ?? null, pictures: cardPictures(device) }
    })),
  aircraft: () => folders(join(REPO, 'aircraft'))
    .filter((folder) => folder !== UI_LAYER && existsSync(join(REPO, 'aircraft', folder, 'aircraft.json')))
    .map((folder) => {
      const catalog = read(join(REPO, 'aircraft', folder, 'aircraft.json'))
      return { id: catalog.id, folder, name: catalog.name, commands: catalog.commands.key.length + catalog.commands.axis.length, presets: Object.keys(catalog.presets).sort() }
    }),
  locales: () => readdirSync(join(REPO, 'locales')).filter((file) => file.endsWith('.json') && file !== 'index.json').sort(byName)
    .map((file) => {
      const words = read(join(REPO, 'locales', file))
      return { code: file.slice(0, -'.json'.length), label: words['language.label'], name: words['language.name'] }
    }),
}

function siteData(): Plugin {
  return {
    name: 'site-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0])
        const folder = DATA.find((name) => path.startsWith(`/${name}/`))
        if (!folder) return next()
        if (path === `/${folder}/index.json`) {
          res.setHeader('Content-Type', TYPES['.json'])
          return res.end(JSON.stringify(indexes[folder]()))
        }
        const file = resolve(REPO, `.${path}`)
        if (!file.startsWith(join(REPO, folder) + sep) || !existsSync(file) || !statSync(file).isFile()) return next()
        res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    writeBundle({ dir }) {
      for (const folder of DATA) {
        cpSync(join(REPO, folder), join(dir!, folder), { recursive: true })
        writeFileSync(join(dir!, folder, 'index.json'), `${JSON.stringify(indexes[folder](), null, 1)}\n`)
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), siteData()],
  build: { rolldownOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), editor: resolve(import.meta.dirname, 'editor/index.html') } } },
  test: { environment: 'node' },
})
