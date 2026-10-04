import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Bindings } from '../dcs/types'
import type { Dialog, Listening } from './types'

export type Filter = 'all' | 'mapped' | 'free' | 'problems'

export interface MapUiState {
  filter: Filter
  open: string[] | null
  search: string
  listening: Listening | null
  adding: string[]
  addAxis: boolean
  focus: string | null
  flash: string | null
  toast: string | null
  undo: { uid: string; wanted: Bindings } | null
  drawer: boolean
  dialog: Dialog | null
  lastPressed: string | null
  identify: string | null
  scrollTo: string | null
}

export const useMapUi = create<MapUiState>()(
  persist(
    immer(() => ({
      filter: 'all',
      open: null,
      search: '',
      listening: null,
      adding: [],
      addAxis: false,
      focus: null,
      flash: null,
      toast: null,
      undo: null,
      drawer: false,
      dialog: null,
      lastPressed: null,
      identify: null,
      scrollTo: null,
    }) as MapUiState),
    {
      name: 'hotas-mapper-next-map',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ filter: s.filter, open: s.open }),
    },
  ),
)

export const closeDialog = () => useMapUi.setState({ dialog: null })
export const cancel = () => useMapUi.setState({ listening: null, adding: [], addAxis: false, focus: null, drawer: false })
