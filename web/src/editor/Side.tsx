import { inputLabel } from '../dcs/combos'
import { useWords } from '../i18n/i18n'
import { Button } from '../ui/Button'
import { cx } from '../ui/cx'
import { DevicePicture } from '../ui/DevicePicture'
import styles from './Editor.module.css'
import { ALL_INPUTS } from './model'
import { addInput, addView, allInputs, frameOf, placedInputs, removeView, renameView, select, setFramePicture, showView, useEditor } from './store'

function Inputs() {
  const { t } = useWords()
  const s = useEditor()
  const all = allInputs(s)
  const placed = placedInputs(s)
  return (
    <>
      <h2 id="side">{t('editor.buttonsTitle')}</h2>
      <span className="hint">{t('editor.buttonsCount', { placed: all.filter((input) => placed.has(input)).length, total: all.length })}</span>
      {s.padName && <span className="mono small">{t('editor.pad', { name: s.padName })}</span>}
      <ul className={styles.inputs}>
        {all.map((input) => {
          const selected = s.selected === input
          const on = placed.has(input)
          return (
            <li key={input}>
              <button type="button" aria-pressed={selected} className={cx(styles.input, selected ? styles.inputSelected : on ? styles.inputPlaced : styles.inputOpen)}
                onClick={() => select(input)}>
                {selected ? '● ' : on ? '✓ ' : '○ '}{inputLabel(input)}
              </button>
            </li>
          )
        })}
      </ul>
      <span className="muted small">{t('editor.legend')}</span>
      <label className={styles.field}>{t('editor.addInput')}
        <select className="text" value="" onChange={(e) => { if (e.target.value) addInput(e.target.value) }}>
          <option value="">{t('editor.pick')}</option>
          {ALL_INPUTS.filter((input) => !all.includes(input)).map((input) => <option key={input} value={input}>{inputLabel(input)}</option>)}
        </select>
      </label>
    </>
  )
}

function Views() {
  const { t } = useWords()
  const s = useEditor()
  const views = s.device!.views
  return (
    <div className={styles.views}>
      <span className={styles.label}>{t('editor.views')}</span>
      {views.map((view, i) => (
        <button key={i} type="button" aria-pressed={i === s.view} className={cx(styles.pictureItem, i === s.view && styles.on)} onClick={() => showView(i)}>
          <strong className={styles.grow}>{view.name}</strong>
          <span className="muted small">{view.layers ? view.layers.map((l) => l.picture).join(' + ') : view.picture}</span>
        </button>
      ))}
      {views[s.view] && (
        <label className={styles.field}>{t('editor.viewName')}
          <input className="text" value={views[s.view].name} onChange={(e) => renameView(e.target.value)} />
        </label>
      )}
      <div className="row">
        <button type="button" className={styles.dashedButton} onClick={addView}>{t('editor.addView')}</button>
        {views.length > 1 && <Button variant="link" small onClick={removeView}>{t('editor.removeView')}</Button>}
      </div>
    </div>
  )
}

function Preview() {
  const { t } = useWords()
  const s = useEditor()
  const device = s.device!
  const frame = frameOf(s)
  const card = s.mode === 'card'
  return (
    <>
      <h2 id="side">{t(card ? 'editor.cardPreview' : 'editor.viewPreview')}</h2>
      <span className="hint">{t(card ? 'editor.cardHint' : 'editor.viewHint')}</span>
      {frame && <div className={styles.preview}><DevicePicture device={device} frame={frame} /></div>}
      {frame && !frame.layers && (
        <label className={styles.field}>{t('editor.picture')}
          <select className="text" value={frame.picture} onChange={(e) => setFramePicture(e.target.value)}>
            {Object.keys(device.pictures).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      )}
      {!card && <Views />}
    </>
  )
}

export function Side() {
  const mode = useEditor((s) => s.mode)
  return <aside className={styles.side} aria-labelledby="side">{mode === 'buttons' ? <Inputs /> : <Preview />}</aside>
}
