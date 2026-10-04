import i18n from 'i18next'
import { loadAircraftIndex, loadCatalog, loadDeviceIndex, loadLanguages } from '../data/load'
import { loadAircraftWords, setLanguage } from '../i18n/i18n'
import { ensureDevices, loadFromFolder } from './devices'
import { useMapUi } from './mapUi'
import { setupOf, useSession } from './session'

const get = () => useSession.getState()

export async function boot() {
  const [languages, aircraftIndex, library, uiCatalog] = await Promise.all([loadLanguages(), loadAircraftIndex(), loadDeviceIndex(), loadCatalog('UiLayer')])
  useSession.setState({ languages, aircraftIndex, library, uiCatalog })
  await ensureDevices()
  const saved = get().aircraftId
  if (saved && aircraftIndex.some((a) => a.id === saved)) await chooseAircraft(saved, true)
  else useSession.setState({ aircraftId: null })
}

export async function chooseAircraft(id: string, restoring = false) {
  const entry = get().aircraftIndex.find((a) => a.id === id)!
  const catalog = await loadCatalog(entry.folder)
  await loadAircraftWords(catalog.folder, i18n.language)
  useSession.setState((s) => {
    s.catalog = catalog
    s.aircraftId = id
    s.active = restoring ? Math.max(0, Math.min(s.active, setupOf(s).entries.length - 1)) : 0
  })
  if (restoring) return
  useMapUi.setState({ open: null })
  await loadFromFolder()
}

export async function changeLanguage(code: string) {
  await setLanguage(code)
  const catalog = get().catalog
  if (catalog) await loadAircraftWords(catalog.folder, code)
}

export const fail = (error: unknown) => useSession.setState({ message: error instanceof Error ? error.message : String(error) })
