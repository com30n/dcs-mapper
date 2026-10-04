export type Role = 'stick' | 'throttle' | 'pedals' | 'panel' | 'other' | 'keyboard' | 'mouse'

export interface Mark {
  input: string
  x: number
  y: number
}

export interface Picture {
  size: [number, number]
  marks?: Mark[]
  src?: string
}

export interface Crop {
  x?: number
  y?: number
  w?: number
  h?: number
}

export interface Layer extends Crop {
  picture: string
  at?: [number, number, number]
}

export type Frame = (Layer & { layers?: undefined }) | { size: [number, number]; layers: Layer[]; picture?: undefined }

export type View = Frame & { name: string }

export interface Device {
  id: string
  name: string
  role: Role
  dcsName: string
  pictures: Record<string, Picture>
  card: Frame | null
  views: View[]
  axes?: { input: string; label: string }[]
  preset?: string | null
  generic?: boolean
}

export interface DeviceIndexEntry {
  id: string
  vendor: string
  name: string
  role: Role
  dcsName: string
  card: Frame | null
  pictures: Record<string, Picture>
}

export interface AircraftIndexEntry {
  id: string
  folder: string
  name: string
  commands: number
  presets: string[]
}

export interface LanguageEntry {
  code: string
  label: string
  name: string
}
