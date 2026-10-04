import { create } from 'zustand'

export interface PadInfo {
  id: string
  index: number
}

export const usePads = create<{ pads: PadInfo[]; live: string[] }>(() => ({ pads: [], live: [] }))

export const gamepadsSupported = () => typeof navigator !== 'undefined' && !!navigator.getGamepads
