import type { Catalog, ForceFeedback } from './types'

export const FORCE_FEEDBACK: ForceFeedback = { trimmer: 1, shake: 0.5, swapAxes: false, invertX: false, invertY: false }
export const FORCE_FEEDBACK_KEYS = Object.keys(FORCE_FEEDBACK) as (keyof ForceFeedback)[]

export function forceFeedbackFor(catalog: Catalog, template: string): ForceFeedback | null {
  const table = catalog.forceFeedback ?? {}
  const settings = table[template] !== undefined ? table[template] : table['']
  if (!settings || settings.ignore) return null
  return Object.fromEntries(FORCE_FEEDBACK_KEYS.map((k) => [k, settings[k] ?? FORCE_FEEDBACK[k]])) as unknown as ForceFeedback
}

export function forceFeedbackDiff(defaults: ForceFeedback, settings: ForceFeedback): Partial<ForceFeedback> {
  return Object.fromEntries(FORCE_FEEDBACK_KEYS.filter((k) => settings[k] !== defaults[k]).map((k) => [k, settings[k]]))
}
