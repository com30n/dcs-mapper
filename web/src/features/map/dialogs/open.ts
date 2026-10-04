import { filterWithDefaults, USER_CURVE_POINTS } from '../../../dcs/axis'
import { forceFeedbackFor } from '../../../dcs/forceFeedback'
import type { AxisFilter } from '../../../dcs/types'
import { entryTemplate } from '../../../state/lookup'
import { useMapUi } from '../../../state/mapUi'
import type { SessionState } from '../../../state/session'
import type { Entry, TuneDraft } from '../../../state/types'

export function tuneDraft(source?: Partial<AxisFilter>): TuneDraft {
  const { deadzone, saturationX, saturationY, curvature, slider, invert, ...rest } = filterWithDefaults(source)
  const user = curvature.length >= 4
  const straight = Array.from({ length: USER_CURVE_POINTS }, (_, i) => i / (USER_CURVE_POINTS - 1))
  return { deadzone, saturationX, saturationY, slider, invert, rest, user, single: user ? 0 : curvature[0], points: user ? [...curvature] : straight }
}

export function draftFilter({ single, points, user, rest, ...filter }: TuneDraft): AxisFilter {
  return { ...rest, ...filter, curvature: user ? [...points] : [single] }
}

export const openTune = (entry: Entry, hash: string, at = 0) =>
  useMapUi.setState({ dialog: { type: 'tune', hash, drafts: (entry.wanted!.axis[hash] ?? []).map((c) => tuneDraft(c.filter)), at, input: 0.4 } })

export const defaultsOf = (s: SessionState, entry: Entry) => forceFeedbackFor(s.catalog!, entryTemplate(s, entry))!

export const openFf = (s: SessionState, entry: Entry) =>
  useMapUi.setState({ dialog: { type: 'ff', draft: { ...defaultsOf(s, entry), ...entry.extra.ffDiffs } } })
