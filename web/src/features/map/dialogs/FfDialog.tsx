import i18n from 'i18next'
import { FORCE_FEEDBACK_KEYS } from '../../../dcs/forceFeedback'
import type { ForceFeedback } from '../../../dcs/types'
import { useWords } from '../../../i18n/i18n'
import { saveForceFeedback } from '../../../state/bindings'
import { closeDialog, useMapUi } from '../../../state/mapUi'
import type { SessionState } from '../../../state/session'
import type { Entry } from '../../../state/types'
import { Button } from '../../../ui/Button'
import { Modal } from '../../../ui/Modal'
import styles from './Dialogs.module.css'
import { defaultsOf } from './open'
import { Check, ValueRow } from './ValueRow'

const setDraft = (patch: Partial<ForceFeedback>) => useMapUi.setState((m) => { if (m.dialog?.type === 'ff') Object.assign(m.dialog.draft, patch) })

function ffNote(defaults: ForceFeedback, draft: ForceFeedback) {
  const changed = FORCE_FEEDBACK_KEYS.filter((k) => draft[k] !== defaults[k])
  return changed.length ? i18n.t('ff.differs', { names: changed.map((k) => i18n.t(`ff.${k}`)).join(', ') }) : i18n.t('ff.same')
}

export function FfDialog({ s, entry, draft }: { s: SessionState; entry: Entry; draft: ForceFeedback }) {
  const { t, tr } = useWords()
  const defaults = defaultsOf(s, entry)
  const foot = (
    <>
      <Button variant="link" onClick={() => setDraft(defaults)}>{t('tune.reset')}</Button>
      <span className={`muted small ${styles.grow}`}>{ffNote(defaults, draft)}</span>
      <Button small onClick={closeDialog}>{t('map.cancel')}</Button>
      <Button variant="primary" small onClick={() => saveForceFeedback(defaults, draft)}>{t('tune.ok')}</Button>
    </>
  )
  const check = (field: 'swapAxes' | 'invertX' | 'invertY') => (
    <Check key={field} checked={draft[field]} title={t(`ff.${field}Hint`)} onChange={(v) => setDraft({ [field]: v })}>{t(`ff.${field}`)}</Check>
  )
  return (
    <Modal size="narrow" eyebrow={t('ff.eyebrow', { aircraft: tr(s.catalog!.name) })} title={s.devices[entry.deviceId].name} sub={t('ff.lead')} onClose={closeDialog} foot={foot}>
      <ValueRow label={t('ff.trimmer')} value={draft.trimmer} onChange={(trimmer) => setDraft({ trimmer })} />
      <p className="muted small">{t('ff.trimmerHint')}</p>
      <ValueRow label={t('ff.shake')} value={draft.shake} onChange={(shake) => setDraft({ shake })} />
      <p className="muted small">{t('ff.shakeHint')}</p>
      <div className="row">{check('swapAxes')}{check('invertX')}{check('invertY')}</div>
    </Modal>
  )
}
