import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Kind } from '../dcs/types'
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
  explain: boolean
  flash: string | null
  toast: string | null
  toastAction: 'undo' | 'redo' | null
  drawer: boolean
  dialog: Dialog | null
  lastPressed: string | null
  identify: string | null
  scrollTo: string | null
  hidden: string[]
  dock: boolean
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
      explain: false,
      flash: null,
      toast: null,
      toastAction: null,
      drawer: false,
      dialog: null,
      lastPressed: null,
      identify: null,
      scrollTo: null,
      hidden: [],
      dock: true,
    }) as MapUiState),
    {
      name: 'hotas-mapper-next-map',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ filter: s.filter, open: s.open, hidden: s.hidden, dock: s.dock }),
    },
  ),
)

export const categoryId = (kind: Kind, name = '') => (kind === 'axis' ? 'axis' : `key:${name}`)

export const closeDialog = () => useMapUi.setState({ dialog: null })
export const cancel = () => useMapUi.setState({ listening: null, adding: [], addAxis: false, focus: null, drawer: false })
