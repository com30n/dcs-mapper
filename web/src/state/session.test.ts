import { expect, it, vi } from 'vitest'
import { catalog, entry } from './session.fixture'

it('takes over the device answers inside entries when it reads the saved session', async () => {
  const id = 'MOZA AB9 FFB Base {base}'
  const old = entry({ dcsId: id, deviceId: 'MOZA/MTQ + TQF', pictureChosen: true })
  const saved = { state: { byAircraft: { [catalog.id]: { entries: [old], modifiers: null, modifiersBase: null } } }, version: 0 }
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(saved), setItem: () => {}, removeItem: () => {} })
  vi.resetModules()
  const { useSession } = await import('./session')
  expect(useSession.getState().pictures).toEqual({ [id.toLowerCase()]: 'MOZA/MTQ + TQF' })
})
