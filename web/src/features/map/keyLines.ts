import i18n from 'i18next'
import { comboText } from '../../dcs/combos'
import { tr, trUi } from '../../i18n/i18n'
import { comboIssue, keyState } from '../../state/problems'
import type { SessionState } from '../../state/session'
import type { Entry } from '../../state/types'

export type Tone = 'plain' | 'modifier' | 'ui' | 'warn' | 'free'

export interface KeyLine {
  text: string
  tone: Tone
}

export function keyLines(s: SessionState, entry: Entry, key: string): KeyLine[] {
  const { using, modifier, ui } = keyState(s, entry, key)
  const lines: KeyLine[] = []
  if (modifier) lines.push({ text: i18n.t('map.modifierShort', { name: modifier }), tone: 'modifier' })
  for (const u of ui) lines.push({ text: i18n.t('map.uiLayer', { name: trUi(u.name) }), tone: 'ui' })
  for (const u of using) {
    const name = tr(u.command.name)
    if (u.combo.reformers?.length) lines.push({ text: `${comboText(u.combo)}: ${name}`, tone: 'modifier' })
    else lines.push({ text: name, tone: comboIssue(s, entry, u.combo, u.command.hash) ? 'warn' : 'plain' })
  }
  return lines.length ? lines : [{ text: i18n.t('legend.free'), tone: 'free' }]
}
