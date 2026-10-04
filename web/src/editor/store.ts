import { strToU8, zipSync } from 'fflate'
import i18n from 'i18next'
import { create } from 'zustand'
import { dropDraft, readDrafts, writeDraft } from '../data/drafts'
import { loadDevice, loadDeviceIndex, pictureUrl } from '../data/load'
import type { Crop, Device, DeviceIndexEntry, Frame } from '../data/types'
import { AXES } from '../dcs/combos'
import { hasHat, type PadFrame } from '../gamepad/pads'
import { download } from '../state/export'
import { addPicture, cropOf, dcsNameOf, deviceId, deviceJson, emptyDevice, folderName, marksOf, nextOpen, padInputs, placeMark, removeMark, sortInputs, withCrop } from './model'

export type Mode = 'buttons' | 'card' | 'views'

export interface EditorState {
  library: DeviceIndexEntry[]
  original: Device | null
  device: Device | null
  maker: string
  files: Record<string, File>
  mode: Mode
  picture: string | null
  view: number
  selected: string | null
  reported: string[]
  padName: string | null
  message: string
}

export const useEditor = create<EditorState>()(() => ({
  library: [], original: null, device: null, maker: '', files: {}, mode: 'buttons', picture: null, view: 0,
  selected: null, reported: [], padName: null, message: '',
}))

const get = () => useEditor.getState()
const set = (patch: Partial<EditorState>) => useEditor.setState(patch)
const MAX_BYTES = 3 * 1024 * 1024

export const allInputs = (s: EditorState) =>
  sortInputs([...Object.values(s.device?.pictures ?? {}).flatMap((p) => (p.marks ?? []).map((m) => m.input)), ...s.reported])

export const placedInputs = (s: EditorState) =>
  new Set(Object.values(s.device?.pictures ?? {}).flatMap((p) => (p.marks ?? []).map((m) => m.input)))

export async function loadLibrary() {
  set({ library: await loadDeviceIndex() })
}

export async function openDevice(id: string) {
  const device = await loadDevice(id)
  const picture = Object.keys(device.pictures).find((name) => marksOf(device, name).length) ?? Object.keys(device.pictures)[0] ?? null
  set({ original: device, device, maker: id.split('/')[0], files: {}, mode: 'buttons', picture, view: 0, selected: null, message: '' })
}

export function newDevice() {
  set({ original: emptyDevice(), device: emptyDevice(), maker: '', files: {}, mode: 'buttons', picture: null, view: 0, selected: null, reported: [], message: '' })
}

export const setMeta = (patch: Partial<Pick<Device, 'name' | 'role' | 'dcsName'>>) => set({ device: { ...get().device!, ...patch } })
export const setMaker = (maker: string) => set({ maker })
export const setMode = (mode: Mode) => set({ mode })
export const select = (input: string | null) => set({ selected: input })
export const showPicture = (picture: string) => set({ picture })
export const showView = (view: number) => set({ view })

async function sizeOf(file: File, url: string): Promise<[number, number]> {
  const img = new Image()
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url })
  if (img.naturalWidth && img.naturalHeight) return [img.naturalWidth, img.naturalHeight]
  const box = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(await file.text())
  return box ? [Math.round(Number(box[1])), Math.round(Number(box[2]))] : [1000, 1000]
}

export async function addPictureFile(file: File) {
  if (file.size > MAX_BYTES) return set({ message: i18n.t('editor.tooBig', { name: file.name }) })
  const s = get()
  const base = folderName(file.name.replace(/\.[^.]+$/, '')).replace(/ /g, '-').toLowerCase() || 'picture'
  const ext = (/\.[^.]+$/.exec(file.name)?.[0] ?? '.png').toLowerCase()
  let name = `${base}${ext}`
  for (let i = 2; s.device!.pictures[name]; i++) name = `${base}-${i}${ext}`
  const url = URL.createObjectURL(file)
  const size = await sizeOf(file, url)
  set({ device: addPicture(get().device!, name, size, url), files: { ...get().files, [name]: file }, picture: name, message: '' })
}

export function place(x: number, y: number) {
  const s = get()
  if (!s.device || !s.picture || !s.selected) return
  const wasPlaced = placedInputs(s).has(s.selected)
  const device = placeMark(s.device, s.picture, s.selected, x, y)
  const next = wasPlaced ? s.selected : nextOpen(allInputs({ ...s, device }), placedInputs({ ...s, device }))
  set({ device, selected: next })
}

export function moveMark(input: string, x: number, y: number) {
  const s = get()
  if (s.device && s.picture) set({ device: placeMark(s.device, s.picture, input, x, y) })
}

export function takeOff(input: string) {
  const s = get()
  if (s.device && s.picture) set({ device: removeMark(s.device, s.picture, input) })
}

export function resetMarks() {
  const s = get()
  if (!s.device || !s.original) return
  const pictures = Object.fromEntries(Object.entries(s.device.pictures).map(([name, p]) => [name, { ...p, marks: s.original!.pictures[name]?.marks ?? [] }]))
  set({ device: { ...s.device, pictures } })
}

export const addInput = (input: string) => set({ reported: sortInputs([...get().reported, input]), selected: input })

export function reportPad(padId: string, inputs: string[], pressed: string | null) {
  const s = get()
  const patch: Partial<EditorState> = { padName: padId, reported: sortInputs([...s.reported, ...inputs]) }
  if (pressed) patch.selected = pressed
  if (s.device && !s.device.dcsName) patch.device = { ...s.device, dcsName: dcsNameOf(padId) }
  set(patch)
}

export const frameOf = (s: EditorState): Frame | null => (s.mode === 'card' ? s.device?.card ?? null : s.device?.views[s.view] ?? null)

export function setCrop(crop: Required<Crop>) {
  const s = get()
  const frame = frameOf(s)
  if (!s.device || !frame || !cropOf(frame)) return
  if (s.mode === 'card') set({ device: { ...s.device, card: withCrop(frame, crop) } })
  else set({ device: { ...s.device, views: s.device.views.map((v, i) => (i === s.view ? withCrop(v, crop) : v)) } })
}

export function setFramePicture(picture: string) {
  const s = get()
  if (!s.device) return
  if (s.mode === 'card') set({ device: { ...s.device, card: { picture } } })
  else set({ device: { ...s.device, views: s.device.views.map((v, i) => (i === s.view ? { name: v.name, picture } : v)) } })
}

export function addView() {
  const s = get()
  const picture = Object.keys(s.device?.pictures ?? {})[0]
  if (!s.device || !picture) return
  set({ device: { ...s.device, views: [...s.device.views, { name: `View ${s.device.views.length + 1}`, picture }] }, view: s.device.views.length })
}

export const renameView = (name: string) => {
  const s = get()
  set({ device: { ...s.device!, views: s.device!.views.map((v, i) => (i === s.view ? { ...v, name } : v)) } })
}

export function removeView() {
  const s = get()
  if (!s.device || s.device.views.length < 2) return
  set({ device: { ...s.device, views: s.device.views.filter((_, i) => i !== s.view) }, view: 0 })
}

export const idOf = (s: EditorState) => (s.device!.id || deviceId(s.maker, s.device!.name))
export const ready = (s: EditorState) => !!s.device?.name.trim() && Object.keys(s.device.pictures).length > 0

async function bytesOf(s: EditorState, name: string) {
  const file = s.files[name]
  if (file) return new Uint8Array(await file.arrayBuffer())
  return new Uint8Array(await (await fetch(pictureUrl(s.device!, name))).arrayBuffer())
}

export async function downloadFolder() {
  const s = get()
  if (!ready(s)) return set({ message: i18n.t('editor.needs') })
  const id = idOf(s)
  const files: Record<string, Uint8Array> = { [`devices/${id}/device.json`]: strToU8(deviceJson(s.device!)) }
  for (const name of Object.keys(s.device!.pictures)) files[`devices/${id}/${name}`] = await bytesOf(s, name)
  download(`${id.replace('/', ' - ')}.zip`, new Blob([zipSync(files)], { type: 'application/zip' }))
}

const dataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = reject
  reader.readAsDataURL(file)
})

export async function tryInMapper() {
  const s = get()
  if (!ready(s)) return set({ message: i18n.t('editor.needs') })
  const id = idOf(s)
  const pictures = Object.fromEntries(await Promise.all(Object.entries(s.device!.pictures).map(async ([name, p]) => {
    const { src: _src, ...rest } = p
    return [name, s.files[name] ? { ...rest, src: await dataUrl(s.files[name]) } : rest] as const
  })))
  try {
    writeDraft({ ...s.device!, id, pictures })
  } catch {
    return set({ message: i18n.t('editor.tryFailed') })
  }
  window.open('../#/devices', '_blank')
  set({ message: '' })
}

export const isDrafted = (s: EditorState) => !!s.device && !!readDrafts()[idOf(s)]

export async function discardDraft() {
  const s = get()
  dropDraft(idOf(s))
  await loadLibrary()
  if (s.device?.id) await openDevice(s.device.id)
}

const restingAxes = new Map<number, number[]>()

export function padFrame({ pads, states, fresh }: PadFrame) {
  for (const pad of pads) {
    const axes = states.get(pad.index)!.axes
    const rest = restingAxes.get(pad.index) ?? axes
    const moved = AXES.find((_, i) => axes[i] !== undefined && rest[i] !== undefined && Math.abs(axes[i] - rest[i]) > 0.5)
    restingAxes.set(pad.index, moved ? axes : rest)
    const pressed = fresh.get(pad.index)?.at(-1) ?? moved
    if (pressed) reportPad(pad.id, padInputs(pad.buttons.length, hasHat(pad), Math.min(pad.axes.length, AXES.length)), pressed)
  }
}
