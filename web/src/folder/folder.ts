export interface DcsFolder {
  name: string
  list(path: string): Promise<{ name: string; dir: boolean }[]>
  read(path: string): Promise<string | null>
  log(): Promise<string | null>
}

export class NotDcsFolder extends Error {}

const split = (path: string) => path.split('/').filter(Boolean)

async function child(dir: FileSystemDirectoryHandle, name: string) {
  try { return await dir.getDirectoryHandle(name) } catch { return null }
}

async function walk(dir: FileSystemDirectoryHandle | null, parts: string[]) {
  for (const part of parts) {
    if (!dir) return null
    dir = await child(dir, part)
  }
  return dir
}

async function readFile(dir: FileSystemDirectoryHandle | null, name: string) {
  try { return dir ? await (await (await dir.getFileHandle(name)).getFile()).text() : null } catch { return null }
}

export async function handleFolder(root: FileSystemDirectoryHandle): Promise<DcsFolder> {
  const config = await walk(root, ['Config', 'Input'])
  const input = config ?? (root.name === 'Input' ? root : await child(root, 'Input'))
  if (!input) throw new NotDcsFolder()
  const logs = config ? await child(root, 'Logs') : null
  return {
    name: root.name,
    async list(path) {
      const dir = await walk(input, split(path))
      const names: { name: string; dir: boolean }[] = []
      if (dir) for await (const [name, handle] of dir.entries()) names.push({ name, dir: handle.kind === 'directory' })
      return names
    },
    async read(path) {
      const parts = split(path)
      return readFile(await walk(input, parts.slice(0, -1)), parts.at(-1) ?? '')
    },
    log: () => readFile(logs, 'dcs.log'),
  }
}

export function fileListFolder(files: File[]): DcsFolder {
  const paths = files.map((f) => f.webkitRelativePath.split('/'))
  const inputAt = paths.map((p) => p.findIndex((part, i) => part === 'Input' && (i === 0 || p[i - 1] === 'Config'))).find((i) => i >= 0)
  if (inputAt === undefined) throw new NotDcsFolder()
  const byPath = new Map<string, File>()
  let log: File | null = null
  files.forEach((file, i) => {
    const parts = paths[i]
    if (parts[inputAt] === 'Input') byPath.set(parts.slice(inputAt + 1).join('/'), file)
    if (parts.at(-1) === 'dcs.log' && parts.at(-2) === 'Logs') log = file
  })
  return {
    name: paths[0][0],
    async list(path) {
      const prefix = path ? `${path}/` : ''
      const names = new Map<string, boolean>()
      for (const key of byPath.keys()) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length).split('/')
        names.set(rest[0], rest.length > 1)
      }
      return [...names].map(([name, dir]) => ({ name, dir }))
    },
    read: async (path) => byPath.get(path)?.text() ?? null,
    log: async () => (log as File | null)?.text() ?? null,
  }
}

export async function pickFolder(): Promise<DcsFolder> {
  if ('showDirectoryPicker' in window) return handleFolder(await window.showDirectoryPicker({ id: 'dcs-saved-games', mode: 'read' }))
  const input = Object.assign(document.createElement('input'), { type: 'file', webkitdirectory: true })
  const files = await new Promise<File[]>((resolve) => { input.onchange = () => resolve([...(input.files ?? [])]); input.click() })
  return fileListFolder(files)
}
