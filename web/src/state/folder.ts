import i18n from 'i18next'
import { pickFolder } from '../folder/folder'
import { scanFolder } from '../folder/scan'
import { bestId, loadFromFolder } from './devices'
import { canonicalId } from './lookup'
import { draftSetup, setupOf, useSession, type SessionState } from './session'

const get = () => useSession.getState()

export async function connectFolder() {
  try {
    const folder = await pickFolder()
    const scan = await scanFolder(folder)
    useSession.setState({ folder, scan, off: [...scan.disabled], message: '' })
    if (!get().aircraftId) return
    for (const entry of setupOf(get()).entries) {
      const s = get()
      const dcsId = entry.dcsId ? canonicalId(s, entry.dcsId) : await bestId(s.devices[entry.deviceId])
      useSession.setState((d) => {
        const target = draftSetup(d).entries.find((e) => e.uid === entry.uid)
        if (target) target.dcsId = dcsId
      })
    }
    await loadFromFolder()
  } catch (error) {
    if ((error as Error).name !== 'AbortError') useSession.setState({ message: i18n.t('error.not-dcs-folder') })
  }
}

const sortedLower = (list: string[]) => JSON.stringify(list.map((d) => d.toLowerCase()).sort())

export const offChanged = (s: SessionState) => !!s.folder && sortedLower(s.off) !== sortedLower(s.scan.disabled)
