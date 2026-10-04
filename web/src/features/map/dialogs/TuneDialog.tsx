import { axisResponse } from '../../../dcs/axis'
import { inputLabel } from '../../../dcs/combos'
import { useWords } from '../../../i18n/i18n'
import { saveTune } from '../../../state/bindings'
import { percent } from '../../../state/export'
import { entryProfile } from '../../../state/lookup'
import { closeDialog, useMapUi } from '../../../state/mapUi'
import type { SessionState } from '../../../state/session'
import type { Dialog, Entry, TuneDraft } from '../../../state/types'
import { Button, Chip, Chips } from '../../../ui/Button'
import { Modal } from '../../../ui/Modal'
import styles from './Dialogs.module.css'
import { draftFilter, tuneDraft } from './open'
import { Check, NumberInput, ValueRow } from './ValueRow'

type TuneState = Extract<Dialog, { type: 'tune' }>

const editTune = (change: (dialog: TuneState) => void) => useMapUi.setState((m) => { if (m.dialog?.type === 'tune') change(m.dialog) })
const setDraft = (patch: Partial<TuneDraft>) => editTune((d) => { Object.assign(d.drafts[d.at], patch) })

const px = (v: number) => (160 + v * 160).toFixed(2)
const py = (v: number) => (160 - v * 160).toFixed(2)
const GRID = 'M32 0V320M64 0V320M96 0V320M128 0V320M192 0V320M224 0V320M256 0V320M288 0V320M0 32H320M0 64H320M0 96H320M0 128H320M0 192H320M0 224H320M0 256H320M0 288H320'

export function TuneDialog({ s, entry, dialog }: { s: SessionState; entry: Entry; dialog: TuneState }) {
  const { t, tr } = useWords()
  const combos = entry.wanted!.axis[dialog.hash] ?? []
  const combo = combos[dialog.at]
  if (!combo) return null
  const command = entryProfile(s, entry).commands.axis.find((c) => c.hash === dialog.hash)!
  const d = dialog.drafts[dialog.at]
  const filter = draftFilter(d)
  const curve = Array.from({ length: 321 }, (_, i) => `${px(-1 + i / 160)},${py(axisResponse(filter, -1 + i / 160))}`).join(' ')
  const out = axisResponse(filter, dialog.input)
  const foot = (
    <>
      <Button variant="link" onClick={() => setDraft(tuneDraft())}>{t('tune.reset')}</Button>
      <span className={`muted small ${styles.grow}`}>{t('tune.exact')}</span>
      <Button small onClick={closeDialog}>{t('map.cancel')}</Button>
      <Button variant="primary" small onClick={() => saveTune(dialog.hash, dialog.drafts.map(draftFilter))}>{t('tune.ok')}</Button>
    </>
  )
  return (
    <Modal size="wide" eyebrow={t('tune.eyebrow', { aircraft: tr(s.catalog!.name) })} title={tr(command.name)}
      sub={t('tune.axisOf', { input: inputLabel(combo.key), device: s.devices[entry.deviceId].name })} onClose={closeDialog} foot={foot}>
      {combos.length > 1 && (
        <div className={styles.axes} role="group" aria-label={t('tune.axes')}>
          <span>{t('tune.axes')}</span>
          <Chips>
            {combos.map((c, i) => (
              <Chip key={c.key} className="mono" pressed={i === dialog.at} onClick={() => editTune((x) => { x.at = i })}>{inputLabel(c.key)}</Chip>
            ))}
          </Chips>
        </div>
      )}
      <div className={styles.body}>
        <figure className={styles.chart}>
          <svg viewBox="0 0 320 320" role="img" aria-label={t('tune.chart')}>
            <rect width="320" height="320" className={styles.chartBg} />
            <path className={styles.chartGrid} d={GRID} />
            <path className={styles.chartAxes} d="M160 0V320M0 160H320" />
            <path className={styles.diagonal} d="M0 320L320 0" />
            <polyline className={styles.curve} points={curve} />
            <path className={styles.guide} d={`M${px(dialog.input)} 320V${py(out)}H0`} />
            <circle className={styles.livePoint} r="6" cx={px(dialog.input)} cy={py(out)} />
          </svg>
          <figcaption className="mono"><span>{t('tune.in', { value: percent(dialog.input) })}</span><span>{t('tune.out', { value: percent(out) })}</span></figcaption>
          <label htmlFor="tune-try" className="small muted">{t('tune.try')}</label>
          <input id="tune-try" type="range" min={-100} max={100} step={1} value={percent(dialog.input)}
            onChange={(e) => { const input = Number(e.target.value) / 100; editTune((x) => { x.input = input }) }} />
        </figure>
        <div className={styles.controls}>
          <ValueRow label={t('tune.deadzone')} value={d.deadzone} onChange={(deadzone) => setDraft({ deadzone })} />
          <ValueRow label={t('tune.saturationX')} value={d.saturationX} onChange={(saturationX) => setDraft({ saturationX })} />
          <ValueRow label={t('tune.saturationY')} value={d.saturationY} onChange={(saturationY) => setDraft({ saturationY })} />
          <ValueRow label={t('tune.curvature')} value={d.single} min={-100} disabled={d.user} onChange={(single) => setDraft({ single })} />
          <div className="row">
            <Check checked={d.slider} onChange={(slider) => setDraft({ slider })}>{t('tune.slider')}</Check>
            <Check checked={d.invert} onChange={(invert) => setDraft({ invert })}>{t('tune.invert')}</Check>
            <Check checked={d.user} onChange={(user) => setDraft({ user })}>{t('tune.userCurve')}</Check>
          </div>
          {d.user && (
            <div className={styles.points}>
              <span className="muted small">{t('tune.pointsHint')}</span>
              <div className={styles.pointGrid}>
                {d.points.map((p, i) => {
                  const label = t('tune.point', { at: i * 10 })
                  const setPoint = (v: number) => editTune((x) => { x.drafts[x.at].points[i] = v })
                  return (
                    <div key={i} className={styles.point}>
                      <NumberInput value={p} aria-label={label} onChange={setPoint} />
                      <input type="range" className={styles.vertical} step={1} min={0} max={100} value={percent(p)} aria-label={label}
                        onChange={(e) => setPoint(Number(e.target.value) / 100)} />
                      <span className="mono small">{i * 10}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
