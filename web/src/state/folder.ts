import i18n from 'i18next'
import { pickFolder, type DcsFolder } from '../folder/folder'
import { scanFolder } from '../folder/scan'
import { reloadFromFolder } from './devices'
import { forget } from './history'
import { useMapUi } from './mapUi'
import { useSession, type SessionState } from './session'

export async function openFolder(folder: DcsFolder) {
  const scan = await scanFolder(folder)
  useSession.setState({ folder, scan, off: [...scan.disabled], message: '' })
  useMapUi.setState({ identify: null, focus: null, listening: null, dialog: null, toast: null, toastAction: null })
  forget()
  await reloadFromFolder()
}

export async function connectFolder() {
  try {
    await openFolder(await pickFolder())
  } catch (error) {
    if ((error as Error).name !== 'AbortError') useSession.setState({ message: i18n.t('error.not-dcs-folder') })
  }
}

const sortedLower = (list: string[]) => JSON.stringify(list.map((d) => d.toLowerCase()).sort())

export const offChanged = (s: SessionState) => !!s.folder && sortedLower(s.off) !== sortedLower(s.scan.disabled)
