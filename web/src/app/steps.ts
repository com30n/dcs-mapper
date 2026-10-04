import { redirect } from 'react-router'
import { fail } from '../state/aircraft'
import { useMapUi } from '../state/mapUi'
import { prepareMap } from '../state/prepare'
import { setupOf, useSession, type SessionState } from '../state/session'

export const STEPS = ['aircraft', 'devices', 'map', 'export'] as const
export type Step = (typeof STEPS)[number]

export const pathOf = (step: Step) => (step === 'aircraft' ? '/' : `/${step}`)
export const stepAt = (pathname: string): Step => STEPS.find((step) => pathOf(step) === pathname) ?? 'aircraft'

export function stepAvailable(s: SessionState, step: Step) {
  if (step === 'aircraft') return true
  if (step === 'devices') return !!s.catalog
  return !!s.catalog && setupOf(s).entries.length > 0
}

export function requireStep(step: Step) {
  return async () => {
    useMapUi.setState({ dialog: null })
    const s = useSession.getState()
    if (!stepAvailable(s, step)) throw redirect(s.catalog ? '/devices' : '/')
    if (step !== 'map' && step !== 'export') return null
    try {
      await prepareMap()
    } catch (error) {
      fail(error)
      throw redirect('/devices')
    }
    return null
  }
}
